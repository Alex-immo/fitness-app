import type { Equipment, Exercise, ProgressionStateRecord, SetLog, TemplateItem, WorkoutTemplate } from '../../db/types'
import { capLoadKg, computeLoadSteps, isSelectableLoad, type DumbbellSetup, type LoadStep } from '../../domain/loads'
import { setsFor, tempoApplies } from '../../domain/progression'
import { pullupLevelFromTest, pullupScheme, type PullupLevel } from '../../domain/pullup'

// Turns a template plus the current progression states into what the workout
// view shows: per exercise the target, and the sets in the order they are done.
// Pure functions; reading and writing the database happens in workoutStore.

export const PULLUP_ID = 'pullup'
/** Set number under which the pull-up placement test is logged. */
export const TEST_SET_NUMBER = 0

export interface ExerciseTarget {
  item: TemplateItem
  exercise: Exercise
  sets: number
  /** Null until the pull-up placement test of this session is done. */
  repMin: number | null
  repMax: number | null
  unit: 'reps' | 'seconds'
  /** Selectable loads; null when the exercise is done without a dumbbell. */
  loadSteps: LoadStep[] | null
  /** Load to preselect. */
  loadKg: number | null
  /** From stage 3 on the load stays at its value. */
  loadLocked: boolean
  tempo: boolean
  /** Text of the harder variant once stage 5 is reached. */
  variantText: string | null
  needsPullupTest: boolean
  pullupLevel: PullupLevel | null
}

export interface PlanRow {
  key: string
  itemId: string
  exerciseId: string
  setNumber: number
  isTest: boolean
  /** RIR is mandatory here: last set of an exercise in a session that counts. */
  rirRequired: boolean
  restSeconds: number
}

export interface PlanGroup {
  key: string
  kind: 'exercise' | 'round'
  /** Item id for exercise groups, round number for round groups. */
  itemId: string | null
  round: number | null
  rows: PlanRow[]
}

export interface WorkoutPlan {
  targets: Map<string, ExerciseTarget>
  groups: PlanGroup[]
  totalRows: number
}

export function dumbbellSetupOf(equipment: Equipment | undefined): DumbbellSetup | null {
  if (!equipment || equipment.barWeightKg === null || equipment.maxPlatesPerSide === null) return null
  return {
    barWeightKg: equipment.barWeightKg,
    dumbbellCount: equipment.count,
    plates: equipment.plates,
    maxPlatesPerSide: equipment.maxPlatesPerSide,
  }
}

export function loadStepsFor(exercise: Exercise, item: TemplateItem, setup: DumbbellSetup | null): LoadStep[] | null {
  if (!setup || exercise.loadType !== 'hantel' || item.withoutLoad || exercise.dumbbellsUsed === 0) return null
  return computeLoadSteps(setup, exercise.dumbbellsUsed)
}

function defaultLoad(exercise: Exercise, steps: LoadStep[]): number {
  if (exercise.startLoadHint === 'cap') return capLoadKg(steps)
  // "Calibrate": start in the middle of the range; the user picks the real start load.
  return steps[Math.floor((steps.length - 1) / 2)]!.loadKg
}

export interface PlanInput {
  template: WorkoutTemplate
  items: TemplateItem[]
  exercises: Exercise[]
  states: ProgressionStateRecord[]
  dumbbell: Equipment | undefined
  /** Sets already logged in this session. */
  setLogs: SetLog[]
  /** Loads the user picked in this session. */
  loadByExercise: Record<string, number>
}

export function buildWorkoutPlan(input: PlanInput): WorkoutPlan {
  const { template } = input
  const exerciseById = new Map(input.exercises.map((exercise) => [exercise.id, exercise]))
  const stateByExercise = new Map(input.states.map((state) => [state.exerciseId, state]))
  const setup = dumbbellSetupOf(input.dumbbell)
  const items = [...input.items].sort((a, b) => a.order - b.order)

  const targets = new Map<string, ExerciseTarget>()
  for (const item of items) {
    const exercise = exerciseById.get(item.exerciseId)
    if (!exercise) throw new Error(`Unknown exercise ${item.exerciseId}`)
    const state = stateByExercise.get(exercise.id)
    // Circuits use the template dose; only sessions that count follow the state.
    const progressed = template.countsForProgression && exercise.loadType !== 'zeit' ? state : undefined
    const loadSteps = loadStepsFor(exercise, item, setup)

    let loadKg: number | null = null
    if (loadSteps) {
      const picked = input.loadByExercise[exercise.id]
      const fromState = state?.currentLoadKg ?? null
      if (picked !== undefined && isSelectableLoad(loadSteps, picked)) loadKg = picked
      else if (fromState !== null && isSelectableLoad(loadSteps, fromState)) loadKg = fromState
      else loadKg = defaultLoad(exercise, loadSteps)
    }

    const target: ExerciseTarget = {
      item,
      exercise,
      sets: setsFor(progressed, item.sets),
      repMin: progressed?.currentRepMin ?? item.repMin,
      repMax: progressed?.currentRepMax ?? item.repMax,
      unit: exercise.loadType === 'zeit' ? 'seconds' : 'reps',
      loadSteps,
      loadKg,
      loadLocked: progressed !== undefined && progressed.currentStage > 2,
      tempo: progressed !== undefined && tempoApplies(progressed),
      variantText:
        progressed?.currentStage === 5 && !progressed.stage5Completed
          ? (exercise.nextVariantText ?? 'Variante festlegen')
          : null,
      needsPullupTest: false,
      pullupLevel: null,
    }

    if (exercise.id === PULLUP_ID) {
      const testLog = input.setLogs.find(
        (log) => log.exerciseId === PULLUP_ID && log.setNumber === TEST_SET_NUMBER && log.repsDone !== null,
      )
      const storedLevel = state?.pullupLevel && !state.pullupRetestDue ? state.pullupLevel : null
      const level = testLog ? pullupLevelFromTest(testLog.repsDone!) : storedLevel
      const scheme = level ? pullupScheme(level) : null
      target.needsPullupTest = storedLevel === null
      target.pullupLevel = level
      target.sets = item.sets
      // "As many clean reps as possible": 5 per set is the goal that moves on.
      target.repMin = scheme ? (scheme.repMin ?? 1) : null
      target.repMax = scheme ? (scheme.repMax ?? 5) : null
      target.tempo = false
      target.variantText = null
    }
    targets.set(item.id, target)
  }

  const row = (target: ExerciseTarget, setNumber: number, restSeconds: number): PlanRow => ({
    key: `${target.item.id}-${setNumber}`,
    itemId: target.item.id,
    exerciseId: target.exercise.id,
    setNumber,
    isTest: setNumber === TEST_SET_NUMBER,
    rirRequired: template.countsForProgression && setNumber === target.sets,
    restSeconds,
  })

  const groups: PlanGroup[] = []
  if (template.type === 'circuit') {
    const rounds = Math.max(0, ...items.map((item) => item.sets))
    for (let round = 1; round <= rounds; round++) {
      groups.push({
        key: `round-${round}`,
        kind: 'round',
        itemId: null,
        round,
        rows: items
          .filter((item) => item.sets >= round)
          .map((item) => row(targets.get(item.id)!, round, round < rounds ? item.restSeconds : 0)),
      })
    }
  } else {
    for (const item of items) {
      const target = targets.get(item.id)!
      const rows: PlanRow[] = []
      if (target.needsPullupTest) rows.push(row(target, TEST_SET_NUMBER, item.restSeconds))
      for (let set = 1; set <= target.sets; set++) rows.push(row(target, set, item.restSeconds))
      groups.push({ key: item.id, kind: 'exercise', itemId: item.id, round: null, rows })
    }
  }

  return { targets, groups, totalRows: groups.reduce((sum, group) => sum + group.rows.length, 0) }
}

export function isRowDone(row: PlanRow, setLogs: SetLog[]): boolean {
  return setLogs.some((log) => log.exerciseId === row.exerciseId && log.setNumber === row.setNumber)
}

/** The row to work on next in a group: its first row that is not logged yet. */
export function openRowKey(group: PlanGroup, setLogs: SetLog[]): string | null {
  return group.rows.find((row) => !isRowDone(row, setLogs))?.key ?? null
}
