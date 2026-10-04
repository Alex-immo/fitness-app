import { weekStartOf } from './dates'
import type { IsoDate, PlanPhase } from './types'

// Suggestion to move from the entry phase to the full plan
// (SPEZIFIKATION.md section 3). The app only suggests; it never switches itself.

/** Training weeks in the entry phase before the app checks for a switch. */
export const ENTRY_WEEKS_BEFORE_SUGGESTION = 4
/** Completed entry sessions looked at, counted from the latest. */
export const ENTRY_SESSIONS_CHECKED = 2
/** Each of them has to be shorter than this. */
export const ENTRY_DURATION_LIMIT_MIN = 45
/** "Ask again later" postpones the suggestion by two weeks. */
export const SUGGESTION_SNOOZE_DAYS = 14

export interface CompletedSession {
  date: IsoDate
  durationMin: number
}

/** Calendar weeks with at least one of the given sessions. */
export function countTrainingWeeks(dates: readonly IsoDate[]): number {
  return new Set(dates.map(weekStartOf)).size
}

export function shouldSuggestFullPlan(input: {
  phase: PlanPhase
  /** Completed entry-phase sessions since the entry phase began, in any order. */
  entrySessions: readonly CompletedSession[]
  today: IsoDate
  /** Day until which the user postponed the suggestion; null if not postponed. */
  snoozedUntil: IsoDate | null
}): boolean {
  if (input.phase !== 'einstieg') return false
  if (input.snoozedUntil !== null && input.today < input.snoozedUntil) return false
  if (countTrainingWeeks(input.entrySessions.map((session) => session.date)) < ENTRY_WEEKS_BEFORE_SUGGESTION) {
    return false
  }
  const latest = [...input.entrySessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, ENTRY_SESSIONS_CHECKED)
  return (
    latest.length === ENTRY_SESSIONS_CHECKED && latest.every((session) => session.durationMin < ENTRY_DURATION_LIMIT_MIN)
  )
}
