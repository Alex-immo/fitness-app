import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FitnessDatabase } from '../../db/database'
import type { TemplateId } from '../../domain/types'
import { buildWorkoutPlan, openRowKey, type WorkoutPlan } from './workoutModel'
import {
  discardWorkout,
  finishWorkout,
  getActiveSessionLog,
  LOCAL_USER_ID,
  logSet,
  setExerciseLoad,
  startWorkout,
  undoSet,
} from './workoutStore'

// A Monday morning; all values are invented.
const NOW = new Date(2030, 0, 7, 6, 30, 0)
const LATER = new Date(2030, 0, 9, 6, 30, 0)

let db: FitnessDatabase
let counter = 0

beforeEach(async () => {
  db = new FitnessDatabase(`workout-test-${counter++}`)
  await db.open()
})
afterEach(async () => {
  await db.delete()
})

async function planOf(sessionLogId: number): Promise<WorkoutPlan> {
  const sessionLog = (await db.sessionLogs.get(sessionLogId))!
  const scheduled = (await db.scheduledSessions.get(sessionLog.scheduledSessionId))!
  const template = (await db.workoutTemplates.get(scheduled.templateId))!
  return buildWorkoutPlan({
    template,
    items: await db.templateItems.where('templateId').equals(template.id).toArray(),
    exercises: await db.exercises.toArray(),
    states: await db.progressionStates.toArray(),
    dumbbell: await db.equipment.get('dumbbell'),
    setLogs: await db.setLogs.where('sessionLogId').equals(sessionLogId).toArray(),
    loadByExercise: sessionLog.draft?.loadByExercise ?? {},
  })
}

/** Logs every set of one exercise with the same repetitions on all sides. */
async function logExercise(sessionLogId: number, exerciseId: string, reps: number, lastRir = 2, now = NOW) {
  const plan = await planOf(sessionLogId)
  const target = [...plan.targets.values()].find((t) => t.exercise.id === exerciseId)!
  for (let setNumber = 1; setNumber <= target.sets; setNumber++) {
    await logSet(db, {
      sessionLogId,
      exerciseId,
      setNumber,
      entries: target.exercise.isUnilateral
        ? [
            { side: 'links', value: reps },
            { side: 'rechts', value: reps },
          ]
        : [{ side: null, value: reps }],
      unit: target.unit,
      loadKg: target.loadKg,
      rir: setNumber === target.sets ? lastRir : null,
      tempoApplied: target.tempo,
      restSeconds: target.item.restSeconds,
      now,
    })
  }
}

const start = (templateId: TemplateId, now = NOW) => startWorkout(db, templateId, now)
const stateOf = (exerciseId: string) => db.progressionStates.get([LOCAL_USER_ID, exerciseId])

describe('workout plan', () => {
  it('lists the exercises of a long version in order with their sets', async () => {
    const plan = await planOf(await start('A_lang'))
    expect(plan.groups).toHaveLength(9)
    expect(plan.groups[0]?.rows.map((row) => row.setNumber)).toEqual([1, 2, 3, 4])
    expect(plan.totalRows).toBe(25)
  })

  it('requires RIR only in the last set of each exercise', async () => {
    const plan = await planOf(await start('A_lang'))
    expect(plan.groups[0]?.rows.map((row) => row.rirRequired)).toEqual([false, false, false, true])
  })

  it('orders a circuit by rounds, resting only between rounds, and asks for no RIR', async () => {
    const plan = await planOf(await start('kurzzirkel'))
    expect(plan.groups.map((group) => group.kind)).toEqual(['round', 'round', 'round', 'round'])
    expect(plan.groups[0]?.rows.map((row) => row.exerciseId)).toEqual([
      'goblet_squat',
      'pushup_feet_elevated',
      'row_one_arm',
      'glute_bridge_single_leg',
    ])
    expect(plan.groups[0]?.rows.map((row) => row.restSeconds)).toEqual([0, 0, 0, 45])
    expect(plan.groups[3]?.rows.at(-1)?.restSeconds).toBe(0)
    expect(plan.groups.flatMap((group) => group.rows).some((row) => row.rirRequired)).toBe(false)
  })

  it('offers only computed load steps and preselects cap or a middle step', async () => {
    const plan = await planOf(await start('A_lang'))
    const byExercise = new Map([...plan.targets.values()].map((t) => [t.exercise.id, t]))
    expect(byExercise.get('front_squat_db')).toMatchObject({ loadKg: 12.8 })
    expect(byExercise.get('row_one_arm')).toMatchObject({ loadKg: 15.3 })
    expect(byExercise.get('lateral_raise')?.loadKg).toBe(6.8)
    expect(byExercise.get('pushup_feet_elevated')?.loadSteps).toBeNull()
    expect(byExercise.get('side_plank')).toMatchObject({ unit: 'seconds', repMax: 40, loadSteps: null })
  })

  it('does the travel circuit without any load', async () => {
    const plan = await planOf(await start('reisezirkel'))
    expect([...plan.targets.values()].every((target) => target.loadSteps === null)).toBe(true)
  })

  it('keeps all circuit loads on one bar', async () => {
    const plan = await planOf(await start('kurzzirkel'))
    const loaded = [...plan.targets.values()].filter((target) => target.loadSteps)
    expect(loaded.map((target) => target.exercise.dumbbellsUsed)).toEqual([1, 1, 1])
  })

  it('opens the first set that is not logged yet', async () => {
    const id = await start('A_lang')
    await logSet(db, {
      sessionLogId: id,
      exerciseId: 'front_squat_db',
      setNumber: 1,
      entries: [{ side: null, value: 12 }],
      unit: 'reps',
      loadKg: 12.8,
      rir: null,
      tempoApplied: false,
      restSeconds: 90,
      now: NOW,
    })
    const plan = await planOf(id)
    const logs = await db.setLogs.toArray()
    expect(openRowKey(plan.groups[0]!, logs)).toBe('A_lang-1-2')

    await undoSet(db, id, 'front_squat_db', 1)
    expect(openRowKey(plan.groups[0]!, await db.setLogs.toArray())).toBe('A_lang-1-1')
  })
})

describe('running workout', () => {
  it('is stored at once and found again after a reload', async () => {
    const id = await start('A_lang')
    await setExerciseLoad(db, id, 'lateral_raise', 4.3)
    await logSet(db, {
      sessionLogId: id,
      exerciseId: 'front_squat_db',
      setNumber: 1,
      entries: [{ side: null, value: 12 }],
      unit: 'reps',
      loadKg: 12.8,
      rir: null,
      tempoApplied: false,
      restSeconds: 90,
      now: NOW,
    })
    db.close()

    db = new FitnessDatabase(db.name)
    await db.open()
    const active = await getActiveSessionLog(db)
    expect(active?.id).toBe(id)
    expect(active?.startedAt).toBe('2030-01-07T06:30:00')
    expect(active?.draft).toMatchObject({
      loadByExercise: { lateral_raise: 4.3 },
      restSeconds: 90,
      restEndsAt: NOW.getTime() + 90_000,
    })
    expect(await db.setLogs.count()).toBe(1)
    const plan = await planOf(id)
    expect([...plan.targets.values()].find((t) => t.exercise.id === 'lateral_raise')?.loadKg).toBe(4.3)
  })

  it('does not start a second workout while one is running', async () => {
    const first = await start('A_lang')
    expect(await start('B_lang')).toBe(first)
    expect(await db.sessionLogs.count()).toBe(1)
  })

  it('stores both sides of a unilateral set', async () => {
    const id = await start('A_lang')
    await logExercise(id, 'bulgarian_split_squat', 10)
    const logs = await db.setLogs.toArray()
    expect(logs).toHaveLength(6)
    expect(new Set(logs.map((log) => log.side))).toEqual(new Set(['links', 'rechts']))
  })

  it('stores seconds for time-based exercises', async () => {
    const id = await start('A_lang')
    await logExercise(id, 'side_plank', 40)
    const log = (await db.setLogs.toArray())[0]
    expect(log).toMatchObject({ durationS: 40, repsDone: null, loadKg: null })
  })

  it('can be discarded without leaving anything behind', async () => {
    const id = await start('A_lang')
    await logExercise(id, 'front_squat_db', 12)
    await discardWorkout(db, id)
    expect(await db.sessionLogs.count()).toBe(0)
    expect(await db.setLogs.count()).toBe(0)
    expect(await db.scheduledSessions.count()).toBe(0)
    expect(await db.progressionStates.count()).toBe(0)
  })
})

describe('finishing a workout', () => {
  it('closes the session and marks it done', async () => {
    const id = await start('A_lang')
    await logExercise(id, 'front_squat_db', 12)
    await finishWorkout(db, id, 7, NOW)
    const log = await db.sessionLogs.get(id)
    expect(log).toMatchObject({ finishedAt: '2030-01-07T06:30:00', perceivedEffort: 7 })
    expect(log?.draft).toBeUndefined()
    expect((await db.scheduledSessions.toArray())[0]?.status).toBe('erledigt')
    expect(await getActiveSessionLog(db)).toBeUndefined()
  })

  it('creates the progression state from the first session with the chosen start load', async () => {
    const id = await start('A_lang')
    await setExerciseLoad(db, id, 'lateral_raise', 4.3)
    await logExercise(id, 'lateral_raise', 13)
    await logExercise(id, 'front_squat_db', 12)
    await finishWorkout(db, id, null, NOW)
    expect(await stateOf('lateral_raise')).toMatchObject({ currentLoadKg: 4.3, currentStage: 1, currentRepMax: 15 })
    expect(await stateOf('front_squat_db')).toMatchObject({ currentLoadKg: 12.8, currentStage: 2 })
    expect(await stateOf('floor_press')).toBeUndefined()
  })

  it('advances after two sessions at the upper bound and writes the event', async () => {
    const first = await start('A_lang')
    await setExerciseLoad(db, first, 'lateral_raise', 4.3)
    await logExercise(first, 'lateral_raise', 15)
    expect(await finishWorkout(db, first, null, NOW)).toEqual([])

    const second = await start('A_lang', LATER)
    await logExercise(second, 'lateral_raise', 15, 2, LATER)
    const events = await finishWorkout(db, second, null, LATER)
    expect(events).toMatchObject([{ exerciseId: 'lateral_raise', reason: 'load_increase', toLoadKg: 4.8 }])
    expect(await db.progressionEvents.count()).toBe(1)
    expect((await stateOf('lateral_raise'))?.currentLoadKg).toBe(4.8)

    const third = await start('A_lang', LATER)
    const plan = await planOf(third)
    expect([...plan.targets.values()].find((t) => t.exercise.id === 'lateral_raise')?.loadKg).toBe(4.8)
  })

  it('shows tempo and the extra set once the state reaches those stages', async () => {
    const run = async (reps: number, now: Date) => {
      const id = await start('A_lang', now)
      await logExercise(id, 'front_squat_db', reps, 4, now)
      return finishWorkout(db, id, null, now)
    }
    // At the cap: fast track moves one stage per session.
    await run(15, NOW)
    expect(await stateOf('front_squat_db')).toMatchObject({ currentStage: 3 })
    await run(15, LATER)
    expect(await stateOf('front_squat_db')).toMatchObject({ currentStage: 4 })

    const plan = await planOf(await start('A_lang', LATER))
    const target = [...plan.targets.values()].find((t) => t.exercise.id === 'front_squat_db')
    expect(target).toMatchObject({ sets: 5, tempo: true, loadLocked: true })
    await discardWorkout(db, (await getActiveSessionLog(db))!.id!)

    // The same state in the entry template: its 3 sets plus the extra one.
    const entryPlan = await planOf(await start('A_einstieg', LATER))
    const entryTarget = [...entryPlan.targets.values()].find((t) => t.exercise.id === 'front_squat_db')
    expect(entryTarget).toMatchObject({ sets: 4, tempo: true, loadLocked: true })
    expect(entryPlan.groups[0]?.rows.map((row) => row.rirRequired)).toEqual([false, false, false, true])
  })

  it('records a manual load change in a later session', async () => {
    const first = await start('A_lang')
    await setExerciseLoad(db, first, 'lateral_raise', 6.3)
    await logExercise(first, 'lateral_raise', 12)
    await finishWorkout(db, first, null, NOW)

    const second = await start('A_lang', LATER)
    await setExerciseLoad(db, second, 'lateral_raise', 4.8)
    await logExercise(second, 'lateral_raise', 13, 2, LATER)
    const events = await finishWorkout(db, second, null, LATER)
    expect(events).toMatchObject([{ reason: 'manual_load_change', fromLoadKg: 6.3, toLoadKg: 4.8 }])
  })

  it('logs circuits without touching the progression', async () => {
    const id = await start('kurzzirkel')
    await logExercise(id, 'goblet_squat', 15, 5)
    expect(await finishWorkout(db, id, null, NOW)).toEqual([])
    expect(await db.progressionStates.count()).toBe(0)
    expect(await db.setLogs.count()).toBe(4)
  })

  it('only logs time-based exercises', async () => {
    const id = await start('A_lang')
    await logExercise(id, 'side_plank', 40)
    await finishWorkout(db, id, null, NOW)
    expect(await stateOf('side_plank')).toBeUndefined()
  })
})

describe('pull-ups', () => {
  const logPullups = async (id: number, test: number | null, reps: number[], now = NOW) => {
    const sets = test === null ? reps.map((r, i) => [i + 1, r]) : [[0, test], ...reps.map((r, i) => [i + 1, r])]
    for (const [setNumber, value] of sets) {
      await logSet(db, {
        sessionLogId: id,
        exerciseId: 'pullup',
        setNumber: setNumber!,
        entries: [{ side: null, value: value! }],
        unit: 'reps',
        loadKg: null,
        rir: null,
        tempoApplied: false,
        restSeconds: 90,
        now,
      })
    }
  }
  const pullupTarget = async (id: number) =>
    [...(await planOf(id)).targets.values()].find((t) => t.exercise.id === 'pullup')!

  it('starts the first B session with the placement test', async () => {
    const id = await start('B_lang')
    const plan = await planOf(id)
    expect(plan.groups[1]?.rows.map((row) => row.setNumber)).toEqual([0, 1, 2, 3, 4])
    expect(await pullupTarget(id)).toMatchObject({ needsPullupTest: true, pullupLevel: null, repMax: null })
  })

  it('derives the scheme from the test within the same session', async () => {
    const id = await start('B_lang')
    await logPullups(id, 0, [])
    expect(await pullupTarget(id)).toMatchObject({ pullupLevel: 'negatives', repMin: 3, repMax: 5, sets: 4 })
  })

  it('stores the level and skips the test next time', async () => {
    const first = await start('B_lang')
    await logPullups(first, 3, [3, 3, 2, 2])
    const events = await finishWorkout(db, first, null, NOW)
    expect(events).toMatchObject([{ exerciseId: 'pullup', reason: 'pullup_level_changed' }])
    expect(await stateOf('pullup')).toMatchObject({ pullupLevel: 'max_reps', pullupRetestDue: false })

    const second = await start('B_lang', LATER)
    expect(await pullupTarget(second)).toMatchObject({ needsPullupTest: false, pullupLevel: 'max_reps' })
  })

  it('moves to the next row after 4 × 5', async () => {
    const first = await start('B_lang')
    await logPullups(first, 4, [5, 5, 5, 5])
    await finishWorkout(db, first, null, NOW)
    expect(await stateOf('pullup')).toMatchObject({ pullupLevel: 'rep_range', currentRepMin: 5, currentRepMax: 10 })
  })

  it('asks for a new test after 4 × 5 negatives', async () => {
    const first = await start('B_lang')
    await logPullups(first, 0, [5, 5, 5, 5])
    await finishWorkout(db, first, null, NOW)
    expect(await stateOf('pullup')).toMatchObject({ pullupLevel: 'negatives', pullupRetestDue: true })

    const second = await start('B_lang', LATER)
    expect((await pullupTarget(second)).needsPullupTest).toBe(true)
  })
})

describe('entry phase', () => {
  it('lists 7 exercises and 17 sets per entry template', async () => {
    const planA = await planOf(await start('A_einstieg'))
    expect(planA.groups).toHaveLength(7)
    expect(planA.totalRows).toBe(17)
    await discardWorkout(db, (await getActiveSessionLog(db))!.id!)

    const planB = await planOf(await start('B_einstieg'))
    // 17 sets plus the pull-up placement test of the first B session.
    expect(planB.totalRows).toBe(18)
    expect(planB.groups[1]?.rows.map((row) => row.setNumber)).toEqual([0, 1, 2, 3])
  })

  it('shares the progression state with the long version', async () => {
    const first = await start('A_einstieg')
    await setExerciseLoad(db, first, 'lateral_raise', 4.3)
    await logExercise(first, 'lateral_raise', 15)
    expect(await db.setLogs.count()).toBe(2)
    await finishWorkout(db, first, null, NOW)
    expect(await stateOf('lateral_raise')).toMatchObject({ currentLoadKg: 4.3, consecutiveTargetHits: 1 })

    const second = await start('A_lang', LATER)
    await logExercise(second, 'lateral_raise', 15, 2, LATER)
    expect(await db.setLogs.count()).toBe(5)
    const events = await finishWorkout(db, second, null, LATER)
    expect(events).toMatchObject([{ exerciseId: 'lateral_raise', reason: 'load_increase', toLoadKg: 4.8 }])
  })

  it('moves the pull-up scheme on after 3 × 5 in the entry template', async () => {
    const id = await start('B_einstieg')
    for (const [setNumber, value] of [
      [0, 4],
      [1, 5],
      [2, 5],
      [3, 5],
    ]) {
      await logSet(db, {
        sessionLogId: id,
        exerciseId: 'pullup',
        setNumber: setNumber!,
        entries: [{ side: null, value: value! }],
        unit: 'reps',
        loadKg: null,
        rir: null,
        tempoApplied: false,
        restSeconds: 90,
        now: NOW,
      })
    }
    await finishWorkout(db, id, null, NOW)
    expect(await stateOf('pullup')).toMatchObject({ pullupLevel: 'rep_range' })
  })
})
