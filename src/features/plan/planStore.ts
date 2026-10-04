import type { FitnessDatabase } from '../../db/database'
import { LOCAL_USER_ID } from '../../db/localUser'
import type { ScheduledSession, WeekPlan, WeekType } from '../../db/types'
import { addDays, minutesBetween, weekdayIndex, weekStartOf } from '../../domain/dates'
import { deloadDue, trainingWeeksSinceDeload, type WeekRecord } from '../../domain/deload'
import { shorteningApplies, shouldSuggestShortening } from '../../domain/shortening'
import { shouldSuggestFullPlan, SUGGESTION_SNOOZE_DAYS, type CompletedSession } from '../../domain/phase'
import { assignRotation, planPhaseOf, planWeek } from '../../domain/schedule'
import type { DayType, IsoDate, PlanPhase } from '../../domain/types'

// Database operations of the week planning.

/** Default week until the user has planned one: home office on the strength slots. */
export const DEFAULT_DAY_TYPES: DayType[] = [
  'homeoffice',
  'buero',
  'homeoffice',
  'buero',
  'homeoffice',
  'wochenende',
  'wochenende',
]

export interface PlannedWeek {
  plan: WeekPlan
  sessions: ScheduledSession[]
}

export async function getWeek(db: FitnessDatabase, weekStart: IsoDate): Promise<PlannedWeek | null> {
  const plan = await db.weekPlans.where('weekStart').equals(weekStart).first()
  if (!plan?.id) return null
  const sessions = await db.scheduledSessions.where('weekPlanId').equals(plan.id).sortBy('date')
  return { plan, sessions }
}

/** Day types to offer for a week: its own, else those of the latest planned week, else the default. */
export async function suggestedDayTypes(db: FitnessDatabase, weekStart: IsoDate): Promise<DayType[]> {
  const own = await db.weekPlans.where('weekStart').equals(weekStart).first()
  if (own?.dayTypes) return own.dayTypes
  const planned = (await db.weekPlans.orderBy('weekStart').toArray()).filter((plan) => plan.dayTypes)
  return planned.at(-1)?.dayTypes ?? DEFAULT_DAY_TYPES
}

/** Plan variant in force; the entry phase until the user switches. */
export const DEFAULT_PLAN_PHASE: PlanPhase = 'einstieg'

export async function getPlanPhase(db: FitnessDatabase): Promise<PlanPhase> {
  return (await db.users.get(LOCAL_USER_ID))?.planPhase ?? DEFAULT_PLAN_PHASE
}

/**
 * Re-assigns the templates of all planned A/B sessions so the rotation follows
 * the sessions actually completed and open ones use the current plan variant.
 * Called whenever a session is planned, completed, dropped or brought back,
 * and when the plan variant changes.
 */
export async function rotateOpenSessions(db: FitnessDatabase): Promise<void> {
  await db.transaction('rw', db.users, db.scheduledSessions, async () => {
    const sessions = await db.scheduledSessions.orderBy('date').toArray()
    const rotated = assignRotation(sessions, await getPlanPhase(db))
    for (const [index, session] of sessions.entries()) {
      const templateId = rotated[index]!
      if (templateId !== session.templateId) await db.scheduledSessions.update(session.id!, { templateId })
    }
  })
}

/**
 * Stores the weekly input and fills the slots from it. Sessions that are
 * completed, dropped or running stay as they are; open ones are planned anew.
 */
export async function saveWeekPlan(db: FitnessDatabase, weekStart: IsoDate, dayTypes: DayType[]): Promise<void> {
  if (weekdayIndex(weekStart) !== 0) throw new Error('weekStart must be a Monday')
  await db.transaction('rw', db.users, db.weekPlans, db.scheduledSessions, db.sessionLogs, async () => {
    const existing = await db.weekPlans.where('weekStart').equals(weekStart).first()
    const weekPlanId =
      existing?.id ?? (await db.weekPlans.add({ userId: LOCAL_USER_ID, weekStart, weekType: 'normal', dayTypes }))
    if (existing) await db.weekPlans.update(weekPlanId, { dayTypes })

    const sessions = await db.scheduledSessions.where('weekPlanId').equals(weekPlanId).toArray()
    const logged = new Set(
      (
        await db.sessionLogs
          .where('scheduledSessionId')
          .anyOf(sessions.map((session) => session.id!))
          .toArray()
      ).map((log) => log.scheduledSessionId),
    )
    const open = sessions.filter((session) => session.status === 'geplant' && !logged.has(session.id!))
    await db.scheduledSessions.bulkDelete(open.map((session) => session.id!))

    const takenDates = new Set(sessions.filter((session) => !open.includes(session)).map((session) => session.date))
    // The rotation is assigned right below, over all sessions.
    const planned = planWeek({ weekStart, dayTypes, lastLong: null, phase: await getPlanPhase(db) }).sessions
    await db.scheduledSessions.bulkAdd(
      planned
        .filter((session) => !takenDates.has(session.date))
        .map((session) => ({ ...session, weekPlanId, status: 'geplant' as const })),
    )
    await rotateOpenSessions(db)
  })
}

/** Drops a planned session (it is not made up) or brings a dropped one back. */
export async function setSessionDropped(db: FitnessDatabase, sessionId: number, dropped: boolean): Promise<void> {
  await db.transaction('rw', db.users, db.scheduledSessions, async () => {
    const session = await db.scheduledSessions.get(sessionId)
    if (!session || session.status === 'erledigt') return
    await db.scheduledSessions.update(sessionId, { status: dropped ? 'ausgefallen' : 'geplant' })
    await rotateOpenSessions(db)
  })
}

/** Planned sessions of past weeks that were never started count as dropped. */
export async function closePastWeeks(db: FitnessDatabase, currentWeekStart: IsoDate): Promise<void> {
  await db.transaction('rw', db.users, db.scheduledSessions, db.sessionLogs, async () => {
    const stale = await db.scheduledSessions
      .where('date')
      .below(currentWeekStart)
      .filter((session) => session.status === 'geplant')
      .toArray()
    const logged = new Set(
      (
        await db.sessionLogs
          .where('scheduledSessionId')
          .anyOf(stale.map((session) => session.id!))
          .toArray()
      ).map((log) => log.scheduledSessionId),
    )
    for (const session of stale) {
      if (!logged.has(session.id!)) await db.scheduledSessions.update(session.id!, { status: 'ausgefallen' })
    }
    await rotateOpenSessions(db)
  })
}

/** Manual entry of a Zone 2 ride; completes the planned bike session. */
export async function logBikeSession(
  db: FitnessDatabase,
  input: { sessionId: number; date: IsoDate; durationMin: number; avgPowerW: number | null },
): Promise<void> {
  await db.transaction('rw', db.scheduledSessions, db.cardioLogs, async () => {
    await db.cardioLogs.add({
      userId: LOCAL_USER_ID,
      date: input.date,
      durationMin: input.durationMin,
      zone: 2,
      avgPowerW: input.avgPowerW,
    })
    await db.scheduledSessions.update(input.sessionId, { status: 'erledigt', date: input.date })
  })
}

/**
 * Switches the plan variant by hand, in either direction. Open home-office
 * sessions move to the new variant; completed ones stay as they were.
 */
export async function setPlanPhase(db: FitnessDatabase, phase: PlanPhase, today: IsoDate): Promise<void> {
  await db.transaction('rw', db.users, db.scheduledSessions, async () => {
    const user = await db.users.get(LOCAL_USER_ID)
    if (!user) throw new Error('No profile yet')
    if ((user.planPhase ?? DEFAULT_PLAN_PHASE) === phase) return
    await db.users.put({ ...user, planPhase: phase, planPhaseSince: today, phaseSuggestionSnoozedUntil: undefined })
    await rotateOpenSessions(db)
  })
}

/** "Ask again in two weeks" on the suggestion to switch to the full plan. */
export async function snoozePhaseSuggestion(db: FitnessDatabase, today: IsoDate): Promise<void> {
  await db.users.update(LOCAL_USER_ID, { phaseSuggestionSnoozedUntil: addDays(today, SUGGESTION_SNOOZE_DAYS) })
}

interface TimedSession extends CompletedSession {
  templateId: ScheduledSession['templateId']
}

/** Completed sessions of normal weeks with their measured duration (start to finish). */
async function completedSessions(db: FitnessDatabase): Promise<TimedSession[]> {
  const deloadPlans = new Set(
    (await db.weekPlans.toArray()).filter((plan) => plan.weekType === 'deload').map((plan) => plan.id),
  )
  const done = await db.scheduledSessions
    .filter((session) => session.status === 'erledigt' && !deloadPlans.has(session.weekPlanId))
    .toArray()
  const result: TimedSession[] = []
  for (const session of done) {
    const log = await db.sessionLogs.where('scheduledSessionId').equals(session.id!).first()
    if (!log?.finishedAt) continue
    result.push({
      date: session.date,
      templateId: session.templateId,
      durationMin: minutesBetween(log.startedAt, log.finishedAt),
    })
  }
  return result
}

/** Whether to suggest the switch from the entry phase to the full plan today. */
export async function fullPlanSuggested(db: FitnessDatabase, today: IsoDate): Promise<boolean> {
  return db.transaction('r', db.users, db.weekPlans, db.scheduledSessions, db.sessionLogs, async () => {
    const user = await db.users.get(LOCAL_USER_ID)
    const phase = user?.planPhase ?? DEFAULT_PLAN_PHASE
    if (phase !== 'einstieg') return false
    const entrySessions = (await completedSessions(db)).filter(
      (session) =>
        planPhaseOf(session.templateId) === 'einstieg' &&
        (user?.planPhaseSince === undefined || session.date >= user.planPhaseSince),
    )
    return shouldSuggestFullPlan({
      phase,
      entrySessions,
      today,
      snoozedUntil: user?.phaseSuggestionSnoozedUntil ?? null,
    })
  })
}

/** Shortening rule: two long versions in a row above 55 minutes. Entry templates never trigger it. */
export async function shorteningSuggested(db: FitnessDatabase): Promise<boolean> {
  return db.transaction('r', db.users, db.weekPlans, db.scheduledSessions, db.sessionLogs, async () => {
    const user = await db.users.get(LOCAL_USER_ID)
    return shouldSuggestShortening({
      longSessions: (await completedSessions(db)).filter((session) => shorteningApplies(session.templateId)),
      alreadyShortened: user?.shortenLong === true,
      declinedOn: user?.shorteningDeclinedOn ?? null,
    })
  })
}

/** Drops exercise 7 from the long versions, or brings it back. */
export async function setShortenLong(db: FitnessDatabase, shortenLong: boolean): Promise<void> {
  await db.users.update(LOCAL_USER_ID, { shortenLong })
}

export async function declineShortening(db: FitnessDatabase, today: IsoDate): Promise<void> {
  await db.users.update(LOCAL_USER_ID, { shorteningDeclinedOn: today })
}

/**
 * Deload suggestion for the current week: due after seven training weeks since
 * the last deload week, counted across both plan variants.
 */
export async function deloadSuggested(db: FitnessDatabase, today: IsoDate): Promise<boolean> {
  return db.transaction('r', db.users, db.weekPlans, db.scheduledSessions, async () => {
    const currentWeekStart = weekStartOf(today)
    const user = await db.users.get(LOCAL_USER_ID)
    if (user?.deloadDeclinedWeek === currentWeekStart) return false

    const plans = await db.weekPlans.toArray()
    if (plans.find((plan) => plan.weekStart === currentWeekStart)?.weekType === 'deload') return false
    const trainedPlans = new Set(
      (
        await db.scheduledSessions
          .filter((session) => session.status === 'erledigt' && session.templateId !== 'bike_z2')
          .toArray()
      ).map((session) => session.weekPlanId),
    )
    const weeks: WeekRecord[] = plans.map((plan) => ({
      weekStart: plan.weekStart,
      weekType: plan.weekType,
      trained: trainedPlans.has(plan.id!),
    }))
    return deloadDue(trainingWeeksSinceDeload(weeks, currentWeekStart))
  })
}

/** Makes a week a deload week or a normal one again. */
export async function setWeekType(db: FitnessDatabase, weekStart: IsoDate, weekType: WeekType): Promise<void> {
  await db.transaction('rw', db.weekPlans, async () => {
    const existing = await db.weekPlans.where('weekStart').equals(weekStart).first()
    if (existing?.id !== undefined) await db.weekPlans.update(existing.id, { weekType })
    else await db.weekPlans.add({ userId: LOCAL_USER_ID, weekStart, weekType })
  })
}

/** "Not this week": the suggestion comes back next week. */
export async function declineDeload(db: FitnessDatabase, today: IsoDate): Promise<void> {
  await db.users.update(LOCAL_USER_ID, { deloadDeclinedWeek: weekStartOf(today) })
}
