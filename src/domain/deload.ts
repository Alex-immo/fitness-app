import type { IsoDate } from './types'

// Deload week (SPEZIFIKATION.md section 6): suggested after seven training
// weeks; half the sets at the same load and repetitions; no triggers.

export const DELOAD_AFTER_TRAINING_WEEKS = 7

/** Half the sets, rounded up. */
export function deloadSets(sets: number): number {
  return Math.ceil(sets / 2)
}

export interface WeekRecord {
  weekStart: IsoDate
  weekType: 'normal' | 'deload'
  /** At least one strength session of this week was completed, in whichever plan variant. */
  trained: boolean
}

/**
 * Training weeks before `currentWeekStart` since the last deload week. A week
 * counts if a strength session was completed in it; the count runs across both
 * plan variants and starts again after a deload week.
 */
export function trainingWeeksSinceDeload(weeks: readonly WeekRecord[], currentWeekStart: IsoDate): number {
  const past = weeks
    .filter((week) => week.weekStart < currentWeekStart)
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
  let count = 0
  for (const week of past) {
    if (week.weekType === 'deload') count = 0
    else if (week.trained) count++
  }
  return count
}

export function deloadDue(trainingWeeks: number): boolean {
  return trainingWeeks >= DELOAD_AFTER_TRAINING_WEEKS
}
