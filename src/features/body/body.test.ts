import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FitnessDatabase } from '../../db/database'
import { addDays } from '../../domain/dates'
import { addProtein, createProfile, getUser, logWeight, profileIsValid, runKcalEvaluation } from './bodyStore'

// Invented round numbers, not anyone's real data.
const PROFILE = { heightCm: 200, birthYear: 1980, sex: 'male' as const, weightKg: 100 }
const DAY_1 = '2030-01-07'

let db: FitnessDatabase
let counter = 0

beforeEach(async () => {
  db = new FitnessDatabase(`body-test-${counter++}`)
  await db.open()
})
afterEach(async () => {
  await db.delete()
})

/** Logs the same weight on Monday, Wednesday and Friday of a week. */
const logWeek = async (weekStart: string, weightKg: number) => {
  for (const offset of [0, 2, 4]) await logWeight(db, addDays(weekStart, offset), weightKg)
}

describe('profile', () => {
  it('stores the profile with start targets and the start weight', async () => {
    await createProfile(db, PROFILE, DAY_1)
    expect(await getUser(db)).toMatchObject({
      heightCm: 200,
      birthYear: 1980,
      sex: 'male',
      kcalTarget: 3300,
      proteinTargetG: 160,
    })
    expect(await db.bodyWeightLogs.toArray()).toMatchObject([{ date: DAY_1, weightKg: 100 }])
  })

  it('keeps the weight out of the user record', async () => {
    await createProfile(db, PROFILE, DAY_1)
    expect(await getUser(db)).not.toHaveProperty('weightKg')
  })

  it('rejects values out of range', async () => {
    expect(profileIsValid({ ...PROFILE, heightCm: 20 }, 2030)).toBe(false)
    expect(profileIsValid({ ...PROFILE, birthYear: 2029 }, 2030)).toBe(false)
    expect(profileIsValid({ ...PROFILE, weightKg: 500 }, 2030)).toBe(false)
    expect(profileIsValid(PROFILE, 2030)).toBe(true)
    await expect(createProfile(db, { ...PROFILE, weightKg: 5 }, DAY_1)).rejects.toThrow()
    expect(await getUser(db)).toBeUndefined()
  })
})

describe('weight log', () => {
  it('keeps one weigh-in per day', async () => {
    await createProfile(db, PROFILE, DAY_1)
    await logWeight(db, DAY_1, 100.4)
    expect(await db.bodyWeightLogs.toArray()).toMatchObject([{ date: DAY_1, weightKg: 100.4 }])
  })

  it('lets the protein minimum follow the latest weight', async () => {
    await createProfile(db, PROFILE, DAY_1)
    await logWeight(db, '2030-01-09', 105)
    expect((await getUser(db))?.proteinTargetG).toBe(168)
  })
})

describe('protein sum', () => {
  it('adds up per day and never drops below zero', async () => {
    await addProtein(db, DAY_1, 30)
    await addProtein(db, DAY_1, 25)
    await addProtein(db, '2030-01-08', 10)
    await addProtein(db, '2030-01-08', -40)
    expect((await db.nutritionDayLogs.orderBy('date').toArray()).map((log) => log.proteinG)).toEqual([55, 0])
  })
})

describe('biweekly calorie rule', () => {
  it('is not due before two full weeks have passed', async () => {
    await createProfile(db, PROFILE, DAY_1)
    expect(await runKcalEvaluation(db, '2030-01-20')).toEqual({ kind: 'not_due' })
  })

  it('raises the target by 150 kcal when the weight stalls, and logs it', async () => {
    await createProfile(db, PROFILE, DAY_1)
    await logWeek('2030-01-07', 100)
    await logWeek('2030-01-14', 100.1)
    const result = await runKcalEvaluation(db, '2030-01-21')
    expect(result).toMatchObject({
      kind: 'evaluated',
      adjustment: { date: '2030-01-21', trendPctPerWeek: 0.1, oldTarget: 3300, newTarget: 3450 },
    })
    expect((await getUser(db))?.kcalTarget).toBe(3450)
    expect(await db.kcalAdjustments.count()).toBe(1)
  })

  it('lowers the target by 100 kcal when the weight rises too fast', async () => {
    await createProfile(db, PROFILE, DAY_1)
    await logWeek('2030-01-07', 100)
    await logWeek('2030-01-14', 100.8)
    await runKcalEvaluation(db, '2030-01-21')
    expect((await getUser(db))?.kcalTarget).toBe(3200)
  })

  it('logs an evaluation inside the target range without changing the target', async () => {
    await createProfile(db, PROFILE, DAY_1)
    await logWeek('2030-01-07', 100)
    await logWeek('2030-01-14', 100.4)
    await runKcalEvaluation(db, '2030-01-21')
    expect(await db.kcalAdjustments.toArray()).toMatchObject([{ oldTarget: 3300, newTarget: 3300 }])
  })

  it('does not evaluate twice within two weeks', async () => {
    await createProfile(db, PROFILE, DAY_1)
    await logWeek('2030-01-07', 100)
    await logWeek('2030-01-14', 100.1)
    await runKcalEvaluation(db, '2030-01-21')
    await logWeek('2030-01-21', 100.1)
    expect(await runKcalEvaluation(db, '2030-01-22')).toEqual({ kind: 'not_due' })
    expect(await runKcalEvaluation(db, '2030-01-28')).toEqual({ kind: 'not_due' })
    expect((await getUser(db))?.kcalTarget).toBe(3450)
  })

  it('makes no adjustment with fewer than two weigh-ins in a week and stays due', async () => {
    await createProfile(db, PROFILE, DAY_1)
    await logWeek('2030-01-14', 100.1)
    expect(await runKcalEvaluation(db, '2030-01-21')).toEqual({ kind: 'insufficient_data' })
    expect((await getUser(db))?.kcalTarget).toBe(3300)
    expect(await db.kcalAdjustments.count()).toBe(0)

    await logWeek('2030-01-21', 100.2)
    expect((await runKcalEvaluation(db, '2030-01-28')).kind).toBe('evaluated')
  })
})
