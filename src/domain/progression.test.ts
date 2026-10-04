import { describe, expect, it } from 'vitest'
import { computeLoadSteps, type LoadStep } from './loads'
import {
  equipmentLimitReached,
  evaluateSession,
  initialProgressionState,
  rebaseToLoad,
  tempoApplies,
  type LoggedSet,
  type SessionOutcome,
} from './progression'
import type { Dose, ProgressionState } from './types'

const STEPS = computeLoadSteps(
  {
    barWeightKg: 2.3,
    dumbbellCount: 2,
    plates: [
      { weightKg: 2, count: 4 },
      { weightKg: 1.25, count: 4 },
      { weightKg: 1, count: 8 },
    ],
    maxPlatesPerSide: 4,
  },
  2,
)
const BASE: Dose = { sets: 3, repMin: 12, repMax: 15 }

const start = (startLoadKg: number | null, loadSteps: LoadStep[] | null = STEPS, base = BASE) =>
  initialProgressionState({
    userId: 'test-user',
    exerciseId: 'test_exercise',
    base,
    loadSteps,
    startLoadKg,
    date: '2030-01-07',
  })

/** One set per entry; the RIR applies to the last set. */
const setsOf = (reps: number[], lastRir: number | null = 2): LoggedSet[] =>
  reps.map((repsDone, i) => ({
    setNumber: i + 1,
    side: null,
    repsDone,
    rir: i === reps.length - 1 ? lastRir : null,
  }))

const run = (
  state: ProgressionState,
  reps: number[],
  options: { lastRir?: number | null; counts?: boolean; loadSteps?: LoadStep[] | null; base?: Dose } = {},
): SessionOutcome =>
  evaluateSession({
    state,
    base: options.base ?? BASE,
    loadSteps: options.loadSteps === undefined ? STEPS : options.loadSteps,
    sets: setsOf(reps, options.lastRir ?? 2),
    countsForProgression: options.counts ?? true,
    date: '2030-01-09',
  })

/** Repeats the same session until the state changes stage, load or range. */
const runUntilEvent = (state: ProgressionState, reps: number[], options: Parameters<typeof run>[2] = {}) => {
  let outcome = run(state, reps, options)
  for (let i = 0; i < 5 && !outcome.event; i++) outcome = run(outcome.state, reps, options)
  if (!outcome.event) throw new Error('No progression event')
  return outcome
}

describe('start state', () => {
  it('starts below the cap in stage 1', () => {
    expect(start(6.3).currentStage).toBe(1)
  })

  it('starts at the cap in stage 2', () => {
    expect(start(12.8).currentStage).toBe(2)
  })

  it('starts exercises without a dumbbell in stage 2 without a load', () => {
    const state = start(null, null)
    expect(state.currentStage).toBe(2)
    expect(state.currentLoadKg).toBeNull()
  })

  it('takes sets and rep range from the template', () => {
    expect(start(6.3)).toMatchObject({ currentSets: 3, currentRepMin: 12, currentRepMax: 15 })
  })

  it('rejects a start load that cannot be set', () => {
    expect(() => start(7)).toThrow()
  })
})

describe('advance trigger', () => {
  it('needs two sessions in a row with the upper bound in all sets', () => {
    const first = run(start(4.3), [15, 15, 15])
    expect(first.event).toBeNull()
    expect(first.state.consecutiveTargetHits).toBe(1)

    const second = run(first.state, [15, 15, 15])
    expect(second.event?.reason).toBe('load_increase')
  })

  it('starts counting again after a session below the upper bound', () => {
    const first = run(start(4.3), [15, 15, 15])
    const broken = run(first.state, [15, 15, 14])
    expect(broken.state.consecutiveTargetHits).toBe(0)
    expect(run(broken.state, [15, 15, 15]).event).toBeNull()
  })

  it('does not count a session with a missing set', () => {
    expect(run(start(4.3), [15, 15]).state.consecutiveTargetHits).toBe(0)
  })

  it('advances after one session with RIR 4 or more in the last set', () => {
    expect(run(start(4.3), [15, 15, 15], { lastRir: 4 }).event?.reason).toBe('load_increase')
  })

  it('does not fast-track with RIR 3', () => {
    expect(run(start(4.3), [15, 15, 15], { lastRir: 3 }).event).toBeNull()
  })

  it('does not fast-track when a set misses the upper bound', () => {
    expect(run(start(4.3), [15, 14, 15], { lastRir: 5 }).event).toBeNull()
  })
})

describe('stages 1 and 2: double progression', () => {
  it('moves to the next load step and resets the reps to the lower bound', () => {
    const { state, event } = runUntilEvent(start(4.3), [15, 15, 15])
    expect(state).toMatchObject({ currentLoadKg: 4.8, currentRepMin: 12, currentRepMax: 15, currentStage: 1 })
    expect(event).toMatchObject({ fromLoadKg: 4.3, toLoadKg: 4.8, fromStage: 1, toStage: 1 })
    expect(state.consecutiveTargetHits).toBe(0)
  })

  it('switches to stage 2 once the load reaches the cap', () => {
    const extended = runUntilEvent(start(10.8), [15, 15, 15])
    const { state } = runUntilEvent(extended.state, [20, 20, 20])
    expect(state).toMatchObject({ currentLoadKg: 12.8, currentStage: 2 })
  })
})

describe('large load jumps', () => {
  it('first raises the upper bound by 5 when the jump exceeds 15 %', () => {
    const { state, event } = runUntilEvent(start(4.8), [15, 15, 15])
    expect(state).toMatchObject({ currentLoadKg: 4.8, currentRepMin: 12, currentRepMax: 20 })
    expect(event?.reason).toBe('rep_range_extended_before_large_jump')
  })

  it('jumps only once the raised bound is reached, then restores the range', () => {
    const extended = runUntilEvent(start(4.8), [15, 15, 15])
    expect(run(extended.state, [19, 19, 19]).state.consecutiveTargetHits).toBe(0)

    const { state, event } = runUntilEvent(extended.state, [20, 20, 20])
    expect(state).toMatchObject({ currentLoadKg: 6.3, currentRepMin: 12, currentRepMax: 15 })
    expect(event?.reason).toBe('load_increase')
  })

  it('jumps directly when the step is 15 % or less', () => {
    expect(runUntilEvent(start(6.3), [15, 15, 15]).state.currentLoadKg).toBe(6.8)
  })
})

describe('stages 3 to 5', () => {
  const atCap = () => start(12.8)

  it('goes from stage 2 to tempo with the reps back at the lower bound', () => {
    const { state, event } = runUntilEvent(atCap(), [15, 15, 15])
    expect(state).toMatchObject({ currentStage: 3, currentLoadKg: 12.8, currentRepMin: 12, currentRepMax: 15 })
    expect(event).toMatchObject({ fromStage: 2, toStage: 3, reason: 'tempo_added' })
    expect(tempoApplies(state)).toBe(true)
    expect(tempoApplies(atCap())).toBe(false)
  })

  it('sends exercises without a dumbbell from stage 2 to tempo', () => {
    const { state } = runUntilEvent(start(null, null), [15, 15, 15], { loadSteps: null })
    expect(state.currentStage).toBe(3)
  })

  it('adds exactly one set in stage 4 and then requires it for the trigger', () => {
    const stage3 = runUntilEvent(atCap(), [15, 15, 15]).state
    const { state, event } = runUntilEvent(stage3, [15, 15, 15])
    expect(state).toMatchObject({ currentStage: 4, currentSets: 4 })
    expect(event?.reason).toBe('extra_set_added')

    expect(run(state, [15, 15, 15]).state.consecutiveTargetHits).toBe(0)
    expect(run(state, [15, 15, 15, 15]).state.consecutiveTargetHits).toBe(1)
  })

  it('introduces the variant in stage 5 without adding another set', () => {
    const stage3 = runUntilEvent(atCap(), [15, 15, 15]).state
    const stage4 = runUntilEvent(stage3, [15, 15, 15]).state
    const { state, event } = runUntilEvent(stage4, [15, 15, 15, 15])
    expect(state).toMatchObject({ currentStage: 5, currentSets: 4, currentRepMin: 12, currentRepMax: 15 })
    expect(event?.reason).toBe('variant_introduced')
    expect(state.stage5Completed).toBe(false)
  })

  it('marks stage 5 as completed when its trigger is met, only once', () => {
    const stage3 = runUntilEvent(atCap(), [15, 15, 15]).state
    const stage4 = runUntilEvent(stage3, [15, 15, 15]).state
    const stage5 = runUntilEvent(stage4, [15, 15, 15, 15]).state
    const done = runUntilEvent(stage5, [15, 15, 15, 15])
    expect(done.state).toMatchObject({ currentStage: 5, stage5Completed: true })
    expect(done.event?.reason).toBe('equipment_limit_reached')

    const after = run(run(done.state, [15, 15, 15, 15]).state, [15, 15, 15, 15])
    expect(after.event).toBeNull()
  })
})

describe('step back', () => {
  it('lowers the load one step after two first-set misses of the lower bound in a row', () => {
    const first = run(start(6.8), [11, 12, 12])
    expect(first.event).toBeNull()
    const { state, event } = run(first.state, [10, 12, 12])
    expect(state).toMatchObject({ currentLoadKg: 6.3, currentStage: 1, currentRepMin: 12, currentRepMax: 15 })
    expect(event).toMatchObject({ reason: 'load_decrease_after_missed_floor', fromLoadKg: 6.8, toLoadKg: 6.3 })
  })

  it('only looks at the first set', () => {
    const first = run(start(6.8), [12, 9, 8])
    expect(first.state.consecutiveFloorMisses).toBe(0)
  })

  it('needs the misses in a row', () => {
    const first = run(start(6.8), [11, 12, 12])
    const ok = run(first.state, [12, 12, 12])
    expect(run(ok.state, [11, 12, 12]).event).toBeNull()
  })

  it('returns from the cap to stage 1', () => {
    const first = run(start(12.8), [11, 11, 11])
    expect(run(first.state, [11, 11, 11]).state).toMatchObject({ currentLoadKg: 10.8, currentStage: 1 })
  })

  it('changes nothing at the bare bar or without a dumbbell', () => {
    const bar = run(run(start(2.3), [5, 5, 5]).state, [5, 5, 5])
    expect(bar.event).toBeNull()
    expect(bar.state.currentLoadKg).toBe(2.3)

    const bodyweight = run(run(start(null, null), [5, 5, 5], { loadSteps: null }).state, [5, 5, 5], {
      loadSteps: null,
    })
    expect(bodyweight.event).toBeNull()
  })
})

describe('step back from stage 3 on and without a dumbbell', () => {
  const missTwice = (state: ProgressionState, reps: number[], options: Parameters<typeof run>[2] = {}) =>
    run(run(state, reps, options).state, reps, options)
  const stage3 = () => runUntilEvent(start(12.8), [15, 15, 15]).state
  const stage4 = () => runUntilEvent(stage3(), [15, 15, 15]).state
  const stage5 = () => runUntilEvent(stage4(), [15, 15, 15, 15]).state

  it('drops the tempo: stage 3 back to stage 2 at the same load', () => {
    const { state, event } = missTwice(stage3(), [11, 11, 11])
    expect(state).toMatchObject({ currentStage: 2, currentLoadKg: 12.8, currentRepMin: 12, currentRepMax: 15 })
    expect(event).toMatchObject({ fromStage: 3, toStage: 2, reason: 'stage_decrease_after_missed_floor' })
  })

  it('removes the extra set: stage 4 back to stage 3', () => {
    const { state } = missTwice(stage4(), [11, 11, 11, 11])
    expect(state).toMatchObject({ currentStage: 3, currentSets: 3 })
  })

  it('drops the variant: stage 5 back to stage 4, keeping the extra set', () => {
    const done = runUntilEvent(stage5(), [15, 15, 15, 15]).state
    const { state } = missTwice(done, [11, 11, 11, 11])
    expect(state).toMatchObject({ currentStage: 4, currentSets: 4, stage5Completed: false })
  })

  it('also goes one stage back for exercises without a dumbbell', () => {
    const bodyweightStage3 = runUntilEvent(start(null, null), [15, 15, 15], { loadSteps: null }).state
    const { state, event } = missTwice(bodyweightStage3, [11, 11, 11], { loadSteps: null })
    expect(state.currentStage).toBe(2)
    expect(event?.reason).toBe('stage_decrease_after_missed_floor')
  })
})

describe('manual load change', () => {
  const rebase = (state: ProgressionState, loadKg: number) =>
    rebaseToLoad({ state, base: BASE, loadSteps: STEPS, loadKg, date: '2030-01-09' })

  it('restarts the state at the chosen load and writes an event', () => {
    const extended = runUntilEvent(start(4.8), [15, 15, 15]).state
    const { state, event } = rebase(extended, 8.3)
    expect(state).toMatchObject({ currentLoadKg: 8.3, currentStage: 1, currentRepMax: 15, consecutiveTargetHits: 0 })
    expect(event).toMatchObject({ reason: 'manual_load_change', fromLoadKg: 4.8, toLoadKg: 8.3 })
  })

  it('sets stage 2 when the chosen load is the cap', () => {
    expect(rebase(start(6.3), 12.8).state.currentStage).toBe(2)
  })

  it('does nothing for the same load or from stage 3 on', () => {
    expect(rebase(start(6.3), 6.3).event).toBeNull()
    const stage3 = runUntilEvent(start(12.8), [15, 15, 15]).state
    expect(rebase(stage3, 10.8)).toEqual({ state: stage3, event: null })
  })

  it('rejects a load that cannot be set', () => {
    expect(() => rebase(start(6.3), 7)).toThrow()
  })
})

describe('what counts', () => {
  it('ignores sessions that do not count for progression (circuits, deload)', () => {
    const state = start(4.3)
    const outcome = run(state, [15, 15, 15], { lastRir: 5, counts: false })
    expect(outcome.event).toBeNull()
    expect(outcome.state).toBe(state)
  })

  it('uses the weaker side for unilateral exercises', () => {
    const sets: LoggedSet[] = [1, 2, 3].flatMap((setNumber) => [
      { setNumber, side: 'links' as const, repsDone: 15, rir: setNumber === 3 ? 5 : null },
      { setNumber, side: 'rechts' as const, repsDone: 14, rir: setNumber === 3 ? 4 : null },
    ])
    const outcome = evaluateSession({
      state: start(4.3),
      base: BASE,
      loadSteps: STEPS,
      sets,
      countsForProgression: true,
      date: '2030-01-09',
    })
    expect(outcome.state.consecutiveTargetHits).toBe(0)
    expect(outcome.event).toBeNull()
  })

  it('uses the lower RIR of both sides for the fast track', () => {
    const sets: LoggedSet[] = [1, 2, 3].flatMap((setNumber) => [
      { setNumber, side: 'links' as const, repsDone: 15, rir: setNumber === 3 ? 5 : null },
      { setNumber, side: 'rechts' as const, repsDone: 15, rir: setNumber === 3 ? 2 : null },
    ])
    const outcome = evaluateSession({
      state: start(4.3),
      base: BASE,
      loadSteps: STEPS,
      sets,
      countsForProgression: true,
      date: '2030-01-09',
    })
    expect(outcome.event).toBeNull()
    expect(outcome.state.consecutiveTargetHits).toBe(1)
  })

  it('writes an event with reason for every change and none otherwise', () => {
    const { event } = runUntilEvent(start(4.3), [15, 15, 15])
    expect(event).toEqual({
      userId: 'test-user',
      exerciseId: 'test_exercise',
      date: '2030-01-09',
      fromStage: 1,
      toStage: 1,
      fromLoadKg: 4.3,
      toLoadKg: 4.8,
      reason: 'load_increase',
    })
    expect(run(start(4.3), [13, 13, 13]).event).toBeNull()
  })

  it('is deterministic', () => {
    expect(run(start(4.3), [15, 15, 15])).toEqual(run(start(4.3), [15, 15, 15]))
  })
})

describe('equipment limit', () => {
  const completed = (exerciseId: string, stage5Completed = true): ProgressionState => ({
    ...start(12.8),
    exerciseId,
    currentStage: 5,
    stage5Completed,
  })

  it('is reached when three of the four main exercises completed stage 5', () => {
    expect(
      equipmentLimitReached([completed('front_squat_db'), completed('row_one_arm'), completed('floor_press')]),
    ).toBe(true)
  })

  it('is not reached with two main exercises', () => {
    expect(
      equipmentLimitReached([
        completed('front_squat_db'),
        completed('row_one_arm'),
        completed('floor_press', false),
        completed('biceps_curl'),
      ]),
    ).toBe(false)
  })
})
