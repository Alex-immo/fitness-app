import type { FitnessDatabase } from '../../db/database'
import { LOCAL_USER_ID } from '../../db/localUser'
import type { KcalAdjustment, User } from '../../db/types'
import {
  evaluateTrend,
  evaluationWeeks,
  kcalEvaluationDue,
  proteinRangeG,
  startTargets,
  TREND_MAX_PCT_PER_WEEK,
  TREND_MIN_PCT_PER_WEEK,
  weighInsOfWeek,
} from '../../domain/nutrition'
import type { IsoDate, Sex } from '../../domain/types'

// Database operations for profile, body weight, calorie target and protein.

export interface ProfileInput {
  heightCm: number
  birthYear: number
  sex: Sex
  weightKg: number
}

export const PROFILE_LIMITS = {
  heightCm: { min: 120, max: 230 },
  weightKg: { min: 30, max: 250 },
  minAgeYears: 14,
  maxAgeYears: 100,
}

export function profileIsValid(input: ProfileInput, currentYear: number): boolean {
  const age = currentYear - input.birthYear
  return (
    input.heightCm >= PROFILE_LIMITS.heightCm.min &&
    input.heightCm <= PROFILE_LIMITS.heightCm.max &&
    input.weightKg >= PROFILE_LIMITS.weightKg.min &&
    input.weightKg <= PROFILE_LIMITS.weightKg.max &&
    Number.isInteger(input.birthYear) &&
    age >= PROFILE_LIMITS.minAgeYears &&
    age <= PROFILE_LIMITS.maxAgeYears
  )
}

export function getUser(db: FitnessDatabase): Promise<User | undefined> {
  return db.users.get(LOCAL_USER_ID)
}

/** First start: stores the profile, the start targets and the start weight. */
export async function createProfile(db: FitnessDatabase, input: ProfileInput, today: IsoDate): Promise<void> {
  const currentYear = Number(today.slice(0, 4))
  if (!profileIsValid(input, currentYear)) throw new Error('Profile values out of range')
  const targets = startTargets(input, currentYear)
  await db.transaction('rw', db.users, db.bodyWeightLogs, async () => {
    await db.users.put({
      id: LOCAL_USER_ID,
      heightCm: input.heightCm,
      birthYear: input.birthYear,
      sex: input.sex,
      goal: 'muskelaufbau',
      kcalTarget: targets.kcalTarget,
      proteinTargetG: targets.proteinMinG,
      gainTargetPctPerWeek: (TREND_MIN_PCT_PER_WEEK + TREND_MAX_PCT_PER_WEEK) / 2,
    })
    await logWeight(db, today, input.weightKg)
  })
}

/** One weigh-in per day: a second entry on the same day replaces the first. */
export async function logWeight(db: FitnessDatabase, date: IsoDate, weightKg: number): Promise<void> {
  await db.transaction('rw', db.users, db.bodyWeightLogs, async () => {
    const existing = await db.bodyWeightLogs.where('date').equals(date).first()
    if (existing?.id !== undefined) await db.bodyWeightLogs.update(existing.id, { weightKg })
    else await db.bodyWeightLogs.add({ userId: LOCAL_USER_ID, date, weightKg })
    // The protein minimum follows the current weight.
    const latest = await db.bodyWeightLogs.orderBy('date').last()
    if (latest) await db.users.update(LOCAL_USER_ID, { proteinTargetG: proteinRangeG(latest.weightKg).minG })
  })
}

/** Adds to (or takes from) the protein sum of a day; the sum never drops below zero. */
export async function addProtein(db: FitnessDatabase, date: IsoDate, deltaG: number): Promise<void> {
  await db.transaction('rw', db.nutritionDayLogs, async () => {
    const existing = await db.nutritionDayLogs.where('date').equals(date).first()
    const proteinG = Math.max(0, (existing?.proteinG ?? 0) + deltaG)
    if (existing?.id !== undefined) await db.nutritionDayLogs.update(existing.id, { proteinG })
    else await db.nutritionDayLogs.add({ userId: LOCAL_USER_ID, date, proteinG })
  })
}

export type KcalEvaluationResult =
  | { kind: 'not_due' }
  | { kind: 'insufficient_data' }
  | { kind: 'evaluated'; adjustment: KcalAdjustment }

/**
 * Biweekly rule: if an evaluation is due, compares the weekly means of the two
 * complete weeks before the current one, adjusts the calorie target and logs
 * the evaluation. With too few weigh-ins nothing changes and it stays due.
 */
export async function runKcalEvaluation(db: FitnessDatabase, today: IsoDate): Promise<KcalEvaluationResult> {
  return db.transaction('rw', db.users, db.bodyWeightLogs, db.kcalAdjustments, async () => {
    const user = await getUser(db)
    if (!user) return { kind: 'not_due' }
    const lastAdjustment = await db.kcalAdjustments.orderBy('date').last()
    const firstWeighIn = await db.bodyWeightLogs.orderBy('date').first()
    if (!kcalEvaluationDue(today, lastAdjustment?.date ?? firstWeighIn?.date ?? null)) return { kind: 'not_due' }

    const weighIns = await db.bodyWeightLogs.toArray()
    const { firstWeekStart, secondWeekStart } = evaluationWeeks(today)
    const result = evaluateTrend({
      firstWeekKg: weighInsOfWeek(weighIns, firstWeekStart),
      secondWeekKg: weighInsOfWeek(weighIns, secondWeekStart),
      currentTarget: user.kcalTarget,
    })
    if (result.kind === 'insufficient_data') return { kind: 'insufficient_data' }

    const adjustment: KcalAdjustment = {
      userId: LOCAL_USER_ID,
      date: today,
      trendPctPerWeek: result.trendPctPerWeek,
      oldTarget: result.oldTarget,
      newTarget: result.newTarget,
    }
    await db.kcalAdjustments.add(adjustment)
    await db.users.update(LOCAL_USER_ID, { kcalTarget: result.newTarget })
    return { kind: 'evaluated', adjustment }
  })
}
