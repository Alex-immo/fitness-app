import type { IsoDate, TemplateId } from './types'

// Shortening rule (SPEZIFIKATION.md section 5.3): if a long version takes more
// than 55 minutes twice in a row, the app suggests dropping exercise 7.

export const LONG_DURATION_LIMIT_MIN = 55
export const LONG_SESSIONS_CHECKED = 2
/** Position of the exercise that is dropped. */
export const SHORTENED_ITEM_ORDER = 7

/** The rule applies to the long versions only, not to the entry templates. */
export function shorteningApplies(templateId: TemplateId): boolean {
  return templateId === 'A_lang' || templateId === 'B_lang'
}

export interface TimedSession {
  date: IsoDate
  durationMin: number
}

export function shouldSuggestShortening(input: {
  /** Completed long versions (A lang, B lang) of normal weeks, in any order. */
  longSessions: readonly TimedSession[]
  alreadyShortened: boolean
  /** Day the user last declined; only sessions after it count. */
  declinedOn: IsoDate | null
}): boolean {
  if (input.alreadyShortened) return false
  const latest = input.longSessions
    .filter((session) => input.declinedOn === null || session.date > input.declinedOn)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, LONG_SESSIONS_CHECKED)
  return latest.length === LONG_SESSIONS_CHECKED && latest.every((session) => session.durationMin > LONG_DURATION_LIMIT_MIN)
}
