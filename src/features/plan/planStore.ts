import type { FitnessDatabase } from '../../db/database'
import { LOCAL_USER_ID } from '../../db/localUser'
import type { ScheduledSession, WeekPlan } from '../../db/types'
import { weekdayIndex } from '../../domain/dates'
import { assignRotation, planWeek } from '../../domain/schedule'
import type { DayType, IsoDate } from '../../domain/types'

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

/**
 * Re-assigns A and B to all planned long sessions so the rotation follows the
 * long versions actually completed. Called whenever a session is planned,
 * completed, dropped or brought back.
 */
export async function rotateOpenSessions(db: FitnessDatabase): Promise<void> {
  await db.transaction('rw', db.scheduledSessions, async () => {
    const sessions = await db.scheduledSessions.orderBy('date').toArray()
    const rotated = assignRotation(sessions)
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
  await db.transaction('rw', db.weekPlans, db.scheduledSessions, db.sessionLogs, async () => {
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
    const planned = planWeek({ weekStart, dayTypes, lastLong: null }).sessions
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
  await db.transaction('rw', db.scheduledSessions, async () => {
    const session = await db.scheduledSessions.get(sessionId)
    if (!session || session.status === 'erledigt') return
    await db.scheduledSessions.update(sessionId, { status: dropped ? 'ausgefallen' : 'geplant' })
    await rotateOpenSessions(db)
  })
}

/** Planned sessions of past weeks that were never started count as dropped. */
export async function closePastWeeks(db: FitnessDatabase, currentWeekStart: IsoDate): Promise<void> {
  await db.transaction('rw', db.scheduledSessions, db.sessionLogs, async () => {
    const stale = await db.scheduledSessions
      .where('date')
      .below(currentWeekStart)
      .filter((session) => session.status === 'geplant')
      .toArray()
    if (stale.length === 0) return
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
