import { describe, expect, it } from 'vitest'
import { basalMetabolicRate, evaluateTrend, proteinRangeG, startTargets, weeklyMean } from './nutrition'

// All values are invented round numbers, not anyone's real data.

describe('start values', () => {
  it('computes the basal metabolic rate after Mifflin-St Jeor', () => {
    expect(basalMetabolicRate({ weightKg: 100, heightCm: 200, ageYears: 50, sex: 'male' })).toBe(2005)
    expect(basalMetabolicRate({ weightKg: 100, heightCm: 200, ageYears: 50, sex: 'female' })).toBe(1839)
  })

  it('derives maintenance, calorie target and protein range', () => {
    const targets = startTargets({ weightKg: 100, heightCm: 200, birthYear: 1980, sex: 'male' }, 2030)
    expect(targets.bmrKcal).toBe(2005)
    expect(targets.maintenanceKcal).toBe(3007.5)
    // 3007.5 + 280 = 3287.5, rounded to the nearest 50.
    expect(targets.kcalTarget).toBe(3300)
    expect(targets.proteinMinG).toBe(160)
    expect(targets.proteinMaxG).toBe(220)
  })

  it('rounds the calorie target to 50', () => {
    const targets = startTargets({ weightKg: 60, heightCm: 160, birthYear: 2000, sex: 'female' }, 2030)
    // BMR 1289, maintenance 1933.5, plus 280 = 2213.5.
    expect(targets.kcalTarget).toBe(2200)
  })
})

describe('protein range', () => {
  it('follows the current body weight', () => {
    expect(proteinRangeG(100)).toEqual({ minG: 160, maxG: 220 })
    expect(proteinRangeG(105)).toEqual({ minG: 168, maxG: 231 })
  })
})

describe('weekly mean', () => {
  it('averages the weigh-ins of a week', () => {
    expect(weeklyMean([100, 101, 102])).toBe(101)
    expect(weeklyMean([])).toBeNull()
  })
})

describe('biweekly calorie rule', () => {
  const evaluate = (firstWeekKg: number[], secondWeekKg: number[]) =>
    evaluateTrend({ firstWeekKg, secondWeekKg, currentTarget: 3000 })

  it('adds 150 kcal below 0.25 % per week', () => {
    expect(evaluate([100, 100, 100], [100.2, 100.2, 100.2])).toEqual({
      kind: 'evaluated',
      trendPctPerWeek: 0.2,
      adjustmentKcal: 150,
      oldTarget: 3000,
      newTarget: 3150,
    })
  })

  it('adds 150 kcal when the weight falls', () => {
    expect(evaluate([100, 100], [99.5, 99.5])).toMatchObject({ trendPctPerWeek: -0.5, newTarget: 3150 })
  })

  it('keeps the target inside 0.25–0.5 % per week, bounds included', () => {
    expect(evaluate([100, 100], [100.25, 100.25])).toMatchObject({ adjustmentKcal: 0, newTarget: 3000 })
    expect(evaluate([100, 100], [100.4, 100.4])).toMatchObject({ adjustmentKcal: 0, newTarget: 3000 })
    expect(evaluate([80, 80], [80.4, 80.4])).toMatchObject({ trendPctPerWeek: 0.5, adjustmentKcal: 0 })
  })

  it('subtracts 100 kcal above 0.5 % per week', () => {
    expect(evaluate([100, 100], [100.6, 100.6])).toMatchObject({ adjustmentKcal: -100, newTarget: 2900 })
  })

  it('uses the weekly means, not single weigh-ins', () => {
    expect(evaluate([99, 100, 101], [100.1, 100.3, 100.5])).toMatchObject({ trendPctPerWeek: 0.3, adjustmentKcal: 0 })
  })

  it('makes no adjustment with fewer than two weigh-ins in either week', () => {
    expect(evaluate([100], [100.6, 100.6])).toEqual({ kind: 'insufficient_data' })
    expect(evaluate([100, 100], [100.6])).toEqual({ kind: 'insufficient_data' })
    expect(evaluate([], [])).toEqual({ kind: 'insufficient_data' })
  })
})
