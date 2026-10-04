import type { FitnessDatabase } from '../../db/database'
import { LOCAL_USER_ID } from '../../db/localUser'
import type { ProgressionEventRecord, ProgressionStateRecord, SessionLog, SetLog } from '../../db/types'
import { toIsoDate, toLocalTimestamp, weekStartOf } from '../../domain/dates'
import { evaluateSession, initialProgressionState, rebaseToLoad, type LoggedSet } from '../../domain/progression'
import { evaluatePullupSession, pullupLevelFromTest, pullupScheme } from '../../domain/pullup'
import type { DayType, Side, TemplateId } from '../../domain/types'
import { rotateOpenSessions } from '../plan/planStore'
import { dumbbellSetupOf, loadStepsFor, PULLUP_ID, TEST_SET_NUMBER } from './workoutModel'

// Database operations of the workout view. Every action is written at once so
// a running workout survives switching apps and reloading.

export { LOCAL_USER_ID }

const DAY_TYPE_BY_TEMPLATE: Record<TemplateId, DayType> = {
  A_lang: 'homeoffice',
  B_lang: 'homeoffice',
  A_einstieg: 'homeoffice',
  B_einstieg: 'homeoffice',
  kurzzirkel: 'buero',
  reisezirkel: 'reise',
  bike_z2: 'wochenende',
}

export async function getActiveSessionLog(db: FitnessDatabase): Promise<SessionLog | undefined> {
  return db.sessionLogs.filter((log) => log.finishedAt === null).first()
}

export async function startWorkout(db: FitnessDatabase, templateId: TemplateId, now: Date): Promise<number> {
  return db.transaction('rw', db.weekPlans, db.scheduledSessions, db.sessionLogs, async () => {
    const active = await getActiveSessionLog(db)
    if (active?.id !== undefined) return active.id

    const date = toIsoDate(now)
    const weekStart = weekStartOf(date)
    const existingPlan = await db.weekPlans.where('weekStart').equals(weekStart).first()
    const weekPlanId =
      existingPlan?.id ?? (await db.weekPlans.add({ userId: LOCAL_USER_ID, weekStart, weekType: 'normal' }))
    const scheduledSessionId = await db.scheduledSessions.add({
      weekPlanId,
      date,
      templateId,
      dayType: DAY_TYPE_BY_TEMPLATE[templateId],
      status: 'geplant',
    })
    return startScheduledSession(db, scheduledSessionId, now)
  })
}

/** Starts the workout of a planned session. The session moves to the day it is actually done. */
export async function startScheduledSession(
  db: FitnessDatabase,
  scheduledSessionId: number,
  now: Date,
): Promise<number> {
  return db.transaction('rw', db.scheduledSessions, db.sessionLogs, async () => {
    const active = await getActiveSessionLog(db)
    if (active?.id !== undefined) return active.id
    await db.scheduledSessions.update(scheduledSessionId, { date: toIsoDate(now) })
    return db.sessionLogs.add({
      scheduledSessionId,
      startedAt: toLocalTimestamp(now),
      finishedAt: null,
      perceivedEffort: null,
      draft: { loadByExercise: {}, restEndsAt: null, restSeconds: 0 },
    })
  })
}

export interface SetEntry {
  side: Side | null
  /** Repetitions, or seconds for time-based exercises. */
  value: number
}

export async function logSet(
  db: FitnessDatabase,
  input: {
    sessionLogId: number
    exerciseId: string
    setNumber: number
    entries: SetEntry[]
    unit: 'reps' | 'seconds'
    loadKg: number | null
    rir: number | null
    tempoApplied: boolean
    restSeconds: number
    now: Date
  },
): Promise<void> {
  await db.transaction('rw', db.sessionLogs, db.setLogs, async () => {
    await db.setLogs.bulkAdd(
      input.entries.map(
        (entry): SetLog => ({
          sessionLogId: input.sessionLogId,
          exerciseId: input.exerciseId,
          setNumber: input.setNumber,
          side: entry.side,
          loadKg: input.loadKg,
          repsDone: input.unit === 'reps' ? entry.value : null,
          durationS: input.unit === 'seconds' ? entry.value : null,
          rir: input.rir,
          tempoApplied: input.tempoApplied,
        }),
      ),
    )
    await db.sessionLogs
      .where(':id')
      .equals(input.sessionLogId)
      .modify((log) => {
        if (!log.draft) return
        log.draft.restSeconds = input.restSeconds
        log.draft.restEndsAt = input.restSeconds > 0 ? input.now.getTime() + input.restSeconds * 1000 : null
      })
  })
}

export async function undoSet(
  db: FitnessDatabase,
  sessionLogId: number,
  exerciseId: string,
  setNumber: number,
): Promise<void> {
  await db.setLogs
    .where('sessionLogId')
    .equals(sessionLogId)
    .filter((log) => log.exerciseId === exerciseId && log.setNumber === setNumber)
    .delete()
}

export async function setExerciseLoad(
  db: FitnessDatabase,
  sessionLogId: number,
  exerciseId: string,
  loadKg: number,
): Promise<void> {
  await db.sessionLogs
    .where(':id')
    .equals(sessionLogId)
    .modify((log) => {
      if (log.draft) log.draft.loadByExercise[exerciseId] = loadKg
    })
}

export async function clearRest(db: FitnessDatabase, sessionLogId: number): Promise<void> {
  await db.sessionLogs
    .where(':id')
    .equals(sessionLogId)
    .modify((log) => {
      if (log.draft) log.draft.restEndsAt = null
    })
}

/** Throws away the running workout and its sets. The session stays in the plan and can be started again. */
export async function discardWorkout(db: FitnessDatabase, sessionLogId: number): Promise<void> {
  await db.transaction('rw', db.sessionLogs, db.setLogs, async () => {
    const log = await db.sessionLogs.get(sessionLogId)
    if (!log || log.finishedAt !== null) return
    await db.setLogs.where('sessionLogId').equals(sessionLogId).delete()
    await db.sessionLogs.delete(sessionLogId)
  })
}

/**
 * Closes the workout and applies the progression rules to every exercise of a
 * session that counts. Returns the progression events it wrote.
 */
export async function finishWorkout(
  db: FitnessDatabase,
  sessionLogId: number,
  perceivedEffort: number | null,
  now: Date,
): Promise<ProgressionEventRecord[]> {
  return db.transaction(
    'rw',
    [
      db.users,
      db.sessionLogs,
      db.setLogs,
      db.scheduledSessions,
      db.workoutTemplates,
      db.templateItems,
      db.exercises,
      db.equipment,
      db.progressionStates,
      db.progressionEvents,
    ],
    async () => {
      const sessionLog = await db.sessionLogs.get(sessionLogId)
      if (!sessionLog || sessionLog.finishedAt !== null) return []
      const scheduled = await db.scheduledSessions.get(sessionLog.scheduledSessionId)
      if (!scheduled) throw new Error('Scheduled session missing')
      const template = await db.workoutTemplates.get(scheduled.templateId)
      if (!template) throw new Error('Template missing')

      const date = toIsoDate(now)
      const events: ProgressionEventRecord[] = []

      if (template.countsForProgression) {
        const items = await db.templateItems.where('templateId').equals(template.id).sortBy('order')
        const setup = dumbbellSetupOf(await db.equipment.get('dumbbell'))
        const setLogs = await db.setLogs.where('sessionLogId').equals(sessionLogId).toArray()

        for (const item of items) {
          const exercise = await db.exercises.get(item.exerciseId)
          const logs = setLogs.filter((log) => log.exerciseId === item.exerciseId)
          if (!exercise || logs.length === 0 || exercise.loadType === 'zeit') continue
          const existing = await db.progressionStates.get([LOCAL_USER_ID, exercise.id])

          if (exercise.id === PULLUP_ID) {
            const result = pullupResult(existing, logs, item.sets, date)
            if (!result) continue
            await db.progressionStates.put(result.state)
            if (result.event) events.push(result.event)
            continue
          }
          if (item.repMin === null || item.repMax === null) continue

          const base = { sets: item.sets, repMin: item.repMin, repMax: item.repMax }
          const loadSteps = loadStepsFor(exercise, item, setup)
          const loggedLoad = logs.find((log) => log.setNumber > TEST_SET_NUMBER)?.loadKg ?? null

          let state: ProgressionStateRecord =
            existing ??
            initialProgressionState({
              userId: LOCAL_USER_ID,
              exerciseId: exercise.id,
              base,
              loadSteps,
              startLoadKg: loggedLoad,
              date,
            })
          if (existing && loadSteps && loggedLoad !== null) {
            const rebased = rebaseToLoad({ state, base, loadSteps, loadKg: loggedLoad, date })
            state = rebased.state
            if (rebased.event) events.push(rebased.event)
          }

          const sets: LoggedSet[] = logs.map((log) => ({
            setNumber: log.setNumber,
            side: log.side,
            repsDone: log.repsDone ?? 0,
            rir: log.rir,
          }))
          const outcome = evaluateSession({ state, base, loadSteps, sets, countsForProgression: true, date })
          await db.progressionStates.put(outcome.state)
          if (outcome.event) events.push(outcome.event)
        }
      }

      await db.progressionEvents.bulkAdd(events)
      await db.sessionLogs.where(':id').equals(sessionLogId).modify((log) => {
        log.finishedAt = toLocalTimestamp(now)
        log.perceivedEffort = perceivedEffort
        delete log.draft
      })
      await db.scheduledSessions.update(scheduled.id!, { status: 'erledigt' })
      await rotateOpenSessions(db)
      return events
    },
  )
}

function pullupResult(
  existing: ProgressionStateRecord | undefined,
  logs: SetLog[],
  templateSets: number,
  date: string,
): { state: ProgressionStateRecord; event: ProgressionEventRecord | null } | null {
  const testLog = logs.find((log) => log.setNumber === TEST_SET_NUMBER)
  const previousLevel = existing?.pullupLevel ?? null
  const level = testLog?.repsDone != null ? pullupLevelFromTest(testLog.repsDone) : previousLevel
  if (!level) return null

  const repsPerSet = logs
    .filter((log) => log.setNumber > TEST_SET_NUMBER)
    .sort((a, b) => a.setNumber - b.setNumber)
    .map((log) => log.repsDone ?? 0)
  const outcome = repsPerSet.length > 0 ? evaluatePullupSession(level, repsPerSet, templateSets) : { level, retestDue: false }
  const scheme = pullupScheme(outcome.level)

  const state: ProgressionStateRecord = {
    userId: LOCAL_USER_ID,
    exerciseId: PULLUP_ID,
    currentStage: 2,
    currentLoadKg: null,
    currentRepMin: scheme.repMin ?? 1,
    currentRepMax: scheme.repMax ?? 5,
    consecutiveTargetHits: 0,
    consecutiveFloorMisses: 0,
    stage5Completed: false,
    updatedAt: date,
    pullupLevel: outcome.level,
    pullupRetestDue: outcome.retestDue,
  }
  const changed = outcome.level !== previousLevel
  return {
    state,
    event: changed
      ? {
          userId: LOCAL_USER_ID,
          exerciseId: PULLUP_ID,
          date,
          fromStage: 2,
          toStage: 2,
          fromLoadKg: null,
          toLoadKg: null,
          reason: 'pullup_level_changed',
        }
      : null,
  }
}
