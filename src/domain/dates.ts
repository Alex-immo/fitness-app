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

const pad = (value: number) => String(value).padStart(2, '0')

/** Calendar day of a point in time, in the device's local time zone. */
export function toIsoDate(date: Date): IsoDate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Local timestamp without zone, e.g. "2030-01-07T06:30:00". */
export function toLocalTimestamp(date: Date): string {
  return `${toIsoDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** Minutes between two local timestamps as written by toLocalTimestamp. */
export function minutesBetween(start: string, end: string): number {
  return (new Date(end).getTime() - new Date(start).getTime()) / 60_000
}
