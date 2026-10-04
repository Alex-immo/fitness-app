import type { LoadStep } from '../domain/loads'

// German display formats: decimal comma, units with a space.

const numberFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })

export const formatNumber = (value: number): string => numberFormat.format(value)
export const formatKg = (kg: number): string => `${formatNumber(kg)} kg`

/** Plates on each side of the bar, e.g. "2 + 1,25 + 1" or "leer". */
export function formatPlatesPerSide(step: LoadStep): string {
  return step.platesPerSide.length === 0 ? 'leer' : step.platesPerSide.map(formatNumber).join(' + ')
}

export function formatRange(min: number, max: number): string {
  return min === max ? formatNumber(min) : `${formatNumber(min)}–${formatNumber(max)}`
}

/** Minutes and seconds, e.g. "1:05". */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

const WEEKDAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

export const weekdayShort = (index: number): string => WEEKDAYS_SHORT[index] ?? ''

/** Day and month of an ISO date, e.g. "07.01.". */
export function formatDayMonth(date: string): string {
  return `${date.slice(8, 10)}.${date.slice(5, 7)}.`
}

/** Parses a number typed with decimal comma or point; null if it is not a number. */
export function parseDecimal(text: string): number | null {
  const normalized = text.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null
  return Number(normalized)
}

const oneDecimal = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const signed = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2, signDisplay: 'always' })
const whole = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 })

export const formatWeight = (kg: number): string => `${oneDecimal.format(kg)} kg`
export const formatSignedPct = (pct: number): string => `${signed.format(pct)} %`
export const formatKcal = (kcal: number): string => `${whole.format(kcal)} kcal`
