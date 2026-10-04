import { capLoadKg, isLargeJump, isSelectableLoad, nextLoadStep, previousLoadStep, type LoadStep } from './loads'
import type { Dose, IsoDate, ProgressionEvent, ProgressionReason, ProgressionState, Side, Stage } from './types'

// Five-stage progression per exercise (SPEZIFIKATION.md section 6).
// Rule-based and deterministic: same state and same session give the same result.
//
// Stage meaning as stored in ProgressionState:
//   1  load below the cap, double progression (reps up, then next load step)
//   2  load at the cap or no dumbbell: only repetitions left as a variable
//   3  slow tempo (applies from here on)
//   4  one extra set (applies from here on)
//   5  harder variant

/** Extra repetitions on the upper bound before a large load jump. */
export const LARGE_JUMP_REP_BONUS = 5
/** Sessions in a row that must hit the upper bound in all sets. */
export const HITS_FOR_ADVANCE = 2
/** RIR in the last set from which a single session is enough. */
export const FAST_TRACK_MIN_RIR = 4
/** First-set misses of the lower bound in a row that trigger a step back. */
export const MISSES_FOR_REGRESS = 2

export const MAIN_EXERCISE_IDS = ['front_squat_db', 'bulgarian_split_squat', 'row_one_arm', 'floor_press'] as const
export const MAIN_EXERCISES_FOR_EQUIPMENT_LIMIT = 3

export interface LoggedSet {
  setNumber: number
  side: Side | null
  repsDone: number
  rir: number | null
}

export interface SessionInput {
  state: ProgressionState
  /** Dose from the template, i.e. the range the exercise returns to after a reset. */
  base: Dose
  /** Selectable loads for this exercise; null for exercises without a dumbbell. */
  loadSteps: LoadStep[] | null
  sets: LoggedSet[]
  /** False for circuits and deload weeks: logged, but never changes the state. */
  countsForProgression: boolean
  date: IsoDate
}

export interface SessionOutcome {
  state: ProgressionState
  event: ProgressionEvent | null
}

export function initialProgressionState(input: {
  userId: string
  exerciseId: string
  base: Dose
  loadSteps: LoadStep[] | null
  /** Load chosen in the first session; ignored for exercises without a dumbbell. */
  startLoadKg: number | null
  date: IsoDate
}): ProgressionState {
  const { loadSteps, startLoadKg } = input
  let stage: Stage = 2
  let load: number | null = null
  if (loadSteps) {
    if (startLoadKg === null || !isSelectableLoad(loadSteps, startLoadKg)) {
      throw new Error(`Start load ${startLoadKg} kg is not a selectable load`)
    }
    load = startLoadKg
    stage = startLoadKg < capLoadKg(loadSteps) ? 1 : 2
  }
  return {
    userId: input.userId,
    exerciseId: input.exerciseId,
    currentStage: stage,
    currentLoadKg: load,
    currentSets: input.base.sets,
    currentRepMin: input.base.repMin,
    currentRepMax: input.base.repMax,
    consecutiveTargetHits: 0,
    consecutiveFloorMisses: 0,
    stage5Completed: false,
    updatedAt: input.date,
  }
}

/**
 * Repetitions per set in set order. For unilateral exercises the weaker side
 * counts, for both the repetitions and the RIR.
 */
export function effectiveSets(sets: LoggedSet[]): { setNumber: number; reps: number; rir: number | null }[] {
  const bySetNumber = new Map<number, { setNumber: number; reps: number; rir: number | null }>()
  for (const set of sets) {
    const existing = bySetNumber.get(set.setNumber)
    if (!existing) {
      bySetNumber.set(set.setNumber, { setNumber: set.setNumber, reps: set.repsDone, rir: set.rir })
      continue
    }
    existing.reps = Math.min(existing.reps, set.repsDone)
    if (set.rir !== null) existing.rir = existing.rir === null ? set.rir : Math.min(existing.rir, set.rir)
  }
  return [...bySetNumber.values()].sort((a, b) => a.setNumber - b.setNumber)
}

export function evaluateSession(input: SessionInput): SessionOutcome {
  const { state } = input
  if (!input.countsForProgression) return { state, event: null }

  const sets = effectiveSets(input.sets)
  const first = sets[0]
  const last = sets[sets.length - 1]
  if (!first || !last) return { state, event: null }

  const hitAll = sets.length >= state.currentSets && sets.every((set) => set.reps >= state.currentRepMax)
  const missedFloor = first.reps < state.currentRepMin
  const hits = hitAll ? state.consecutiveTargetHits + 1 : 0
  const misses = missedFloor ? state.consecutiveFloorMisses + 1 : 0
  const fastTrack = hitAll && last.rir !== null && last.rir >= FAST_TRACK_MIN_RIR

  const counted: ProgressionState = {
    ...state,
    consecutiveTargetHits: hits,
    consecutiveFloorMisses: misses,
    updatedAt: input.date,
  }

  if (hitAll && (hits >= HITS_FOR_ADVANCE || fastTrack)) return advance(counted, input)
  if (misses >= MISSES_FOR_REGRESS) return regress(counted, input)
  return { state: counted, event: null }
}

function change(
  from: ProgressionState,
  patch: Partial<ProgressionState>,
  reason: ProgressionReason,
  date: IsoDate,
): SessionOutcome {
  const state: ProgressionState = { ...from, ...patch, consecutiveTargetHits: 0, consecutiveFloorMisses: 0 }
  return {
    state,
    event: {
      userId: from.userId,
      exerciseId: from.exerciseId,
      date,
      fromStage: from.currentStage,
      toStage: state.currentStage,
      fromLoadKg: from.currentLoadKg,
      toLoadKg: state.currentLoadKg,
      reason,
    },
  }
}

function advance(state: ProgressionState, { base, loadSteps, date }: SessionInput): SessionOutcome {
  const baseRange = { currentRepMin: base.repMin, currentRepMax: base.repMax }

  if (state.currentStage <= 2) {
    const next = loadSteps && state.currentLoadKg !== null ? nextLoadStep(loadSteps, state.currentLoadKg) : null
    if (next && loadSteps && state.currentLoadKg !== null) {
      const rangeAlreadyExtended = state.currentRepMax > base.repMax
      if (isLargeJump(state.currentLoadKg, next.loadKg) && !rangeAlreadyExtended) {
        return change(
          state,
          { currentRepMax: base.repMax + LARGE_JUMP_REP_BONUS },
          'rep_range_extended_before_large_jump',
          date,
        )
      }
      const stage: Stage = next.loadKg < capLoadKg(loadSteps) ? 1 : 2
      return change(state, { currentStage: stage, currentLoadKg: next.loadKg, ...baseRange }, 'load_increase', date)
    }
    return change(state, { currentStage: 3, ...baseRange }, 'tempo_added', date)
  }

  if (state.currentStage === 3) {
    return change(state, { currentStage: 4, currentSets: state.currentSets + 1 }, 'extra_set_added', date)
  }
  if (state.currentStage === 4) {
    return change(state, { currentStage: 5, ...baseRange }, 'variant_introduced', date)
  }
  if (!state.stage5Completed) {
    return change(state, { stage5Completed: true }, 'equipment_limit_reached', date)
  }
  return { state: { ...state, consecutiveTargetHits: 0 }, event: null }
}

function regress(state: ProgressionState, { base, loadSteps, date }: SessionInput): SessionOutcome {
  const unchanged: SessionOutcome = { state: { ...state, consecutiveFloorMisses: 0 }, event: null }
  // The spec defines the step back as a lower load, so it only applies while
  // load is the variable in play (stages 1 and 2).
  if (!loadSteps || state.currentLoadKg === null || state.currentStage > 2) return unchanged
  const previous = previousLoadStep(loadSteps, state.currentLoadKg)
  if (!previous) return unchanged
  return change(
    state,
    { currentStage: 1, currentLoadKg: previous.loadKg, currentRepMin: base.repMin, currentRepMax: base.repMax },
    'load_decrease_after_missed_floor',
    date,
  )
}

/** Slow tempo (4 s down, 1 s pause in the stretch) applies from stage 3 on. */
export function tempoApplies(state: ProgressionState): boolean {
  return state.currentStage >= 3
}

/**
 * Equipment limit: three of the four main exercises have completed stage 5.
 * From then on the app reports the need for heavier equipment.
 */
export function equipmentLimitReached(states: ProgressionState[]): boolean {
  const completed = states.filter(
    (state) => state.stage5Completed && (MAIN_EXERCISE_IDS as readonly string[]).includes(state.exerciseId),
  )
  return new Set(completed.map((state) => state.exerciseId)).size >= MAIN_EXERCISES_FOR_EQUIPMENT_LIMIT
}
