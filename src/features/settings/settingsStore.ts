import type { FitnessDatabase } from '../../db/database'
import { LOCAL_USER_ID } from '../../db/localUser'
import type { Equipment, ProgressionEventRecord } from '../../db/types'
import { computeLoadSteps } from '../../domain/loads'
import { startTargets } from '../../domain/nutrition'
import { reconcileWithLoadSteps } from '../../domain/progression'
import type { IsoDate, PlateStock, Sex } from '../../domain/types'
import { profileIsValid } from '../body/bodyStore'
import { dumbbellSetupOf } from '../workout/workoutModel'
import { getActiveSessionLog } from '../workout/workoutStore'

// Database operations for editing equipment and profile.

export const DUMBBELL_ID = 'dumbbell'

export interface DumbbellInput {
  barWeightKg: number
  plates: PlateStock[]
  maxPlatesPerSide: number
}

export const EQUIPMENT_LIMITS = {
  barWeightKg: { min: 0.5, max: 20 },
  plateWeightKg: { min: 0.25, max: 25 },
  plateCount: { min: 0, max: 40 },
  maxPlatesPerSide: { min: 1, max: 10 },
}

export function dumbbellIsValid(input: DumbbellInput): boolean {
  const within = (value: number, range: { min: number; max: number }) => value >= range.min && value <= range.max
  const weights = input.plates.map((plate) => plate.weightKg)
  return (
    within(input.barWeightKg, EQUIPMENT_LIMITS.barWeightKg) &&
    Number.isInteger(input.maxPlatesPerSide) &&
    within(input.maxPlatesPerSide, EQUIPMENT_LIMITS.maxPlatesPerSide) &&
    new Set(weights).size === weights.length &&
    input.plates.every(
      (plate) =>
        within(plate.weightKg, EQUIPMENT_LIMITS.plateWeightKg) &&
        Number.isInteger(plate.count) &&
        within(plate.count, EQUIPMENT_LIMITS.plateCount),
    )
  )
}

/** Caps that follow from a dumbbell set, for one and for two dumbbells. */
export function capsOf(equipment: Equipment): { oneDumbbellKg: number; twoDumbbellsKg: number } | null {
  const setup = dumbbellSetupOf(equipment)
  if (!setup) return null
  const cap = (used: 1 | 2) => computeLoadSteps(setup, used).at(-1)!.loadKg
  return { oneDumbbellKg: cap(1), twoDumbbellsKg: cap(2) }
}

/**
 * Stores bar weight, plate set and plate limit, then brings every progression
 * state in line with the loads that can now be set. Refused while a workout is
 * running, because its sets were logged against the old loads.
 */
export async function saveDumbbell(
  db: FitnessDatabase,
  input: DumbbellInput,
  today: IsoDate,
): Promise<ProgressionEventRecord[]> {
  if (!dumbbellIsValid(input)) throw new Error('Equipment values out of range')
  return db.transaction(
    'rw',
    [db.equipment, db.exercises, db.sessionLogs, db.progressionStates, db.progressionEvents],
    async () => {
      if (await getActiveSessionLog(db)) throw new Error('A workout is running')
      const existing = await db.equipment.get(DUMBBELL_ID)
      if (!existing) throw new Error('Dumbbell equipment missing')
      const plates = [...input.plates].filter((plate) => plate.count > 0).sort((a, b) => b.weightKg - a.weightKg)
      const updated: Equipment = { ...existing, ...input, plates }
      await db.equipment.put(updated)

      const setup = dumbbellSetupOf(updated)!
      const events: ProgressionEventRecord[] = []
      for (const state of await db.progressionStates.toArray()) {
        const exercise = await db.exercises.get(state.exerciseId)
        if (!exercise || exercise.loadType !== 'hantel' || exercise.dumbbellsUsed === 0) continue
        const outcome = reconcileWithLoadSteps(state, computeLoadSteps(setup, exercise.dumbbellsUsed), today)
        if (!outcome.event) continue
        // Keep the pull-up fields and anything else stored next to the domain state.
        await db.progressionStates.put({ ...state, ...outcome.state })
        events.push(outcome.event)
      }
      await db.progressionEvents.bulkAdd(events)
      return events
    },
  )
}

export interface ProfileEdit {
  heightCm: number
  birthYear: number
  sex: Sex
}

/**
 * Changes the profile. The calorie target moves by as much as the start
 * formula changes for the new values, so the biweekly adjustments made so far
 * are kept.
 */
export async function updateProfile(
  db: FitnessDatabase,
  edit: ProfileEdit,
  today: IsoDate,
): Promise<{ oldTarget: number; newTarget: number }> {
  return db.transaction('rw', db.users, db.bodyWeightLogs, async () => {
    const user = await db.users.get(LOCAL_USER_ID)
    const latest = await db.bodyWeightLogs.orderBy('date').last()
    if (!user || !latest) throw new Error('No profile yet')
    const currentYear = Number(today.slice(0, 4))
    const weightKg = latest.weightKg
    if (!profileIsValid({ ...edit, weightKg }, currentYear)) throw new Error('Profile values out of range')

    const before = startTargets({ heightCm: user.heightCm, birthYear: user.birthYear, sex: user.sex, weightKg }, currentYear)
    const after = startTargets({ ...edit, weightKg }, currentYear)
    const newTarget = user.kcalTarget + (after.kcalTarget - before.kcalTarget)
    await db.users.update(LOCAL_USER_ID, { ...edit, kcalTarget: newTarget })
    return { oldTarget: user.kcalTarget, newTarget }
  })
}
