import type { IsoDate } from './types'

// Calendar arithmetic on plain "YYYY-MM-DD" strings. The dates are device-local
// calendar days; UTC is only used as a time-zone-free calculator.

function toUtc(date: IsoDate): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) throw new Error(`Not an ISO date: ${date}`)
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const utc = toUtc(date)
  utc.setUTCDate(utc.getUTCDate() + days)
  return utc.toISOString().slice(0, 10)
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(date: IsoDate): number {
  return (toUtc(date).getUTCDay() + 6) % 7
}

/** Monday of the week the date falls in. */
export function weekStartOf(date: IsoDate): IsoDate {
  return addDays(date, -weekdayIndex(date))
}
