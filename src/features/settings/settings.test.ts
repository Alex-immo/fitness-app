import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FitnessDatabase } from '../../db/database'
import { LOCAL_USER_ID } from '../../db/localUser'
import { createProfile, getUser } from '../body/bodyStore'
import { finishWorkout, logSet, startWorkout } from '../workout/workoutStore'
import { capsOf, dumbbellIsValid, saveDumbbell, updateProfile, type DumbbellInput } from './settingsStore'

// Invented values throughout.
const NOW = new Date(2030, 0, 7, 6, 30)
const TODAY = '2030-02-01'
const SEED_SET: DumbbellInput = {
  barWeightKg: 2.3,
  plates: [
    { weightKg: 2, count: 4 },
    { weightKg: 1.25, count: 4 },
    { weightKg: 1, count: 8 },
  ],
  maxPlatesPerSide: 4,
}
const WITH_5_KG: DumbbellInput = { ...SEED_SET, plates: [{ weightKg: 5, count: 4 }, ...SEED_SET.plates] }

let db: FitnessDatabase
let counter = 0

beforeEach(async () => {
  db = new FitnessDatabase(`settings-test-${counter++}`)
  await db.open()
})
afterEach(async () => {
  await db.delete()
})

/** Completes an A session with one set of front squats at the given load. */
async function trainFrontSquat(loadKg: number) {
  const id = await startWorkout(db, 'A_lang', NOW)
  await logSet(db, {
    sessionLogId: id,
    exerciseId: 'front_squat_db',
    setNumber: 1,
    entries: [{ side: null, value: 12 }],
    unit: 'reps',
    loadKg,
    rir: null,
    tempoApplied: false,
    restSeconds: 90,
    now: NOW,
  })
  await finishWorkout(db, id, null, NOW)
}
const frontSquat = () => db.progressionStates.get([LOCAL_USER_ID, 'front_squat_db'])
const dumbbell = async () => (await db.equipment.get('dumbbell'))!

describe('equipment', () => {
  it('shows the caps of the seed set', async () => {
    expect(capsOf(await dumbbell())).toEqual({ oneDumbbellKg: 15.3, twoDumbbellsKg: 12.8 })
  })

  it('stores a bought plate pair and raises the caps without touching code', async () => {
    await saveDumbbell(db, WITH_5_KG, TODAY)
    expect(capsOf(await dumbbell())).toEqual({ oneDumbbellKg: 30.3, twoDumbbellsKg: 20.8 })
    expect((await dumbbell()).plates[0]).toEqual({ weightKg: 5, count: 4 })
  })

  it('stores bar weight and plate limit', async () => {
    await saveDumbbell(db, { ...SEED_SET, barWeightKg: 2, maxPlatesPerSide: 3 }, TODAY)
    expect(await dumbbell()).toMatchObject({ barWeightKg: 2, maxPlatesPerSide: 3, count: 2, nameDe: 'Kurzhanteln' })
    expect(capsOf(await dumbbell())?.twoDumbbellsKg).toBe(10.5)
  })

  it('drops plate rows with a count of zero', async () => {
    await saveDumbbell(db, { ...SEED_SET, plates: [...SEED_SET.plates, { weightKg: 10, count: 0 }] }, TODAY)
    expect((await dumbbell()).plates.map((plate) => plate.weightKg)).toEqual([2, 1.25, 1])
  })

  it('makes load the variable again for an exercise that sat at the old cap', async () => {
    await trainFrontSquat(12.8)
    expect(await frontSquat()).toMatchObject({ currentStage: 2, currentLoadKg: 12.8 })

    const events = await saveDumbbell(db, WITH_5_KG, TODAY)
    expect(events).toMatchObject([{ exerciseId: 'front_squat_db', reason: 'equipment_changed', toStage: 1 }])
    expect(await frontSquat()).toMatchObject({ currentStage: 1, currentLoadKg: 12.8 })
    expect(await db.progressionEvents.count()).toBe(1)
  })

  it('moves a load that can no longer be set to the next lighter step', async () => {
    await trainFrontSquat(12.8)
    await saveDumbbell(db, { ...SEED_SET, plates: [{ weightKg: 2, count: 4 }] }, TODAY)
    expect(await frontSquat()).toMatchObject({ currentLoadKg: 6.3, currentStage: 2 })
  })

  it('writes no event when nothing changes for the states', async () => {
    await trainFrontSquat(12.8)
    expect(await saveDumbbell(db, SEED_SET, TODAY)).toEqual([])
  })

  it('refuses values out of range and duplicate plate weights', async () => {
    expect(dumbbellIsValid(SEED_SET)).toBe(true)
    expect(dumbbellIsValid({ ...SEED_SET, barWeightKg: 0 })).toBe(false)
    expect(dumbbellIsValid({ ...SEED_SET, maxPlatesPerSide: 0 })).toBe(false)
    expect(dumbbellIsValid({ ...SEED_SET, plates: [{ weightKg: 2, count: 2.5 }] })).toBe(false)
    expect(dumbbellIsValid({ ...SEED_SET, plates: [{ weightKg: 2, count: 4 }, { weightKg: 2, count: 2 }] })).toBe(false)
    await expect(saveDumbbell(db, { ...SEED_SET, barWeightKg: 100 }, TODAY)).rejects.toThrow()
    expect((await dumbbell()).barWeightKg).toBe(2.3)
  })

  it('is refused while a workout is running', async () => {
    await startWorkout(db, 'A_lang', NOW)
    await expect(saveDumbbell(db, WITH_5_KG, TODAY)).rejects.toThrow()
    expect(capsOf(await dumbbell())?.twoDumbbellsKg).toBe(12.8)
  })
})

describe('profile', () => {
  beforeEach(async () => {
    await createProfile(db, { heightCm: 200, birthYear: 1980, sex: 'male', weightKg: 100 }, '2030-01-07')
  })

  it('stores the new values', async () => {
    await updateProfile(db, { heightCm: 190, birthYear: 1985, sex: 'female' }, TODAY)
    expect(await getUser(db)).toMatchObject({ heightCm: 190, birthYear: 1985, sex: 'female' })
  })

  it('moves the calorie target by the change of the formula and keeps earlier adjustments', async () => {
    // Start target 3300; a biweekly adjustment raised it by 150.
    await db.users.update(LOCAL_USER_ID, { kcalTarget: 3450 })
    // 10 cm less: BMR −62.5, maintenance −93.75 → start target 3200 instead of 3300.
    const result = await updateProfile(db, { heightCm: 190, birthYear: 1980, sex: 'male' }, TODAY)
    expect(result).toEqual({ oldTarget: 3450, newTarget: 3350 })
    expect((await getUser(db))?.kcalTarget).toBe(3350)
  })

  it('leaves the target alone when nothing relevant changes', async () => {
    const result = await updateProfile(db, { heightCm: 200, birthYear: 1980, sex: 'male' }, TODAY)
    expect(result).toEqual({ oldTarget: 3300, newTarget: 3300 })
  })

  it('refuses values out of range', async () => {
    await expect(updateProfile(db, { heightCm: 20, birthYear: 1980, sex: 'male' }, TODAY)).rejects.toThrow()
    expect((await getUser(db))?.heightCm).toBe(200)
  })
})
