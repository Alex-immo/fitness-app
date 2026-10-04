import type { Sex } from './types'

// Calorie target and weight trend (SPEZIFIKATION.md section 7).

export const ACTIVITY_FACTOR = 1.5
export const SURPLUS_KCAL = 280
export const KCAL_ROUNDING = 50
export const PROTEIN_MIN_G_PER_KG = 1.6
export const PROTEIN_MAX_G_PER_KG = 2.2

export const TREND_MIN_PCT_PER_WEEK = 0.25
export const TREND_MAX_PCT_PER_WEEK = 0.5
export const ADJUSTMENT_BELOW_RANGE_KCAL = 150
export const ADJUSTMENT_ABOVE_RANGE_KCAL = -100
/** Fewer weigh-ins than this in either week: no adjustment, only a notice. */
export const MIN_WEIGH_INS_PER_WEEK = 2

export interface Profile {
  weightKg: number
  heightCm: number
  birthYear: number
  sex: Sex
}

export interface StartTargets {
  bmrKcal: number
  maintenanceKcal: number
  kcalTarget: number
  proteinMinG: number
  proteinMaxG: number
}

/** Basal metabolic rate after Mifflin-St Jeor. */
export function basalMetabolicRate(input: { weightKg: number; heightCm: number; ageYears: number; sex: Sex }): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.ageYears
  return input.sex === 'male' ? base + 5 : base - 161
}

export function startTargets(profile: Profile, currentYear: number): StartTargets {
  const bmrKcal = basalMetabolicRate({ ...profile, ageYears: currentYear - profile.birthYear })
  const maintenanceKcal = bmrKcal * ACTIVITY_FACTOR
  return {
    bmrKcal,
    maintenanceKcal,
    kcalTarget: Math.round((maintenanceKcal + SURPLUS_KCAL) / KCAL_ROUNDING) * KCAL_ROUNDING,
    proteinMinG: Math.round(profile.weightKg * PROTEIN_MIN_G_PER_KG),
    proteinMaxG: Math.round(profile.weightKg * PROTEIN_MAX_G_PER_KG),
  }
}

export function weeklyMean(weightsKg: readonly number[]): number | null {
  if (weightsKg.length === 0) return null
  return weightsKg.reduce((sum, weight) => sum + weight, 0) / weightsKg.length
}

export type TrendEvaluation =
  | { kind: 'insufficient_data' }
  | {
      kind: 'evaluated'
      /** Change of the weekly mean from the first to the second week, in percent. */
      trendPctPerWeek: number
      adjustmentKcal: number
      oldTarget: number
      newTarget: number
    }

/** Biweekly evaluation: compares the weekly means of two consecutive weeks. */
export function evaluateTrend(input: {
  firstWeekKg: readonly number[]
  secondWeekKg: readonly number[]
  currentTarget: number
}): TrendEvaluation {
  const { firstWeekKg, secondWeekKg, currentTarget } = input
  const firstMean = weeklyMean(firstWeekKg)
  const secondMean = weeklyMean(secondWeekKg)
  if (
    firstMean === null ||
    secondMean === null ||
    firstWeekKg.length < MIN_WEIGH_INS_PER_WEEK ||
    secondWeekKg.length < MIN_WEIGH_INS_PER_WEEK
  ) {
    return { kind: 'insufficient_data' }
  }

  // Rounded to three decimals so the range bounds are not missed by float noise.
  const trendPctPerWeek = Math.round(((secondMean - firstMean) / firstMean) * 100 * 1000) / 1000
  let adjustmentKcal = 0
  if (trendPctPerWeek < TREND_MIN_PCT_PER_WEEK) adjustmentKcal = ADJUSTMENT_BELOW_RANGE_KCAL
  else if (trendPctPerWeek > TREND_MAX_PCT_PER_WEEK) adjustmentKcal = ADJUSTMENT_ABOVE_RANGE_KCAL

  return {
    kind: 'evaluated',
    trendPctPerWeek,
    adjustmentKcal,
    oldTarget: currentTarget,
    newTarget: currentTarget + adjustmentKcal,
  }
}
