import { describe, expect, it } from 'vitest'
import { addDays } from './dates'
import { deloadDue, deloadSets, trainingWeeksSinceDeload, type WeekRecord } from './deload'
import { shorteningApplies, shouldSuggestShortening } from './shortening'

const FIRST = '2030-01-07'
/** Consecutive weeks from FIRST; "t" trained, "-" not trained, "d" deload week. */
const weeks = (pattern: string): WeekRecord[] =>
  [...pattern].map((kind, index) => ({
    weekStart: addDays(FIRST, index * 7),
    weekType: kind === 'd' ? 'deload' : 'normal',
    trained: kind !== '-',
  }))
const weekAfter = (pattern: string) => addDays(FIRST, pattern.length * 7)
const count = (pattern: string) => trainingWeeksSinceDeload(weeks(pattern), weekAfter(pattern))

describe('deload sets', () => {
  it('halves the sets, rounding up', () => {
    expect([1, 2, 3, 4, 5].map(deloadSets)).toEqual([1, 1, 2, 2, 3])
  })
})

describe('deload suggestion', () => {
  it('is due after seven training weeks', () => {
    expect(deloadDue(count('tttttt'))).toBe(false)
    expect(deloadDue(count('ttttttt'))).toBe(true)
  })

  it('does not count weeks without a completed strength session', () => {
    expect(count('tt-tt-ttt')).toBe(7)
    expect(count('tt-tt-tt')).toBe(6)
  })

  it('starts counting again after a deload week', () => {
    expect(count('tttttttd')).toBe(0)
    expect(count('tttttttdtt')).toBe(2)
  })

  it('ignores the current week and later ones', () => {
    expect(trainingWeeksSinceDeload(weeks('tttt'), addDays(FIRST, 14))).toBe(2)
  })
})

describe('shortening rule', () => {
  const sessions = (durations: number[]) =>
    durations.map((durationMin, index) => ({ date: addDays(FIRST, index * 2), durationMin }))
  const suggest = (durations: number[], overrides: { alreadyShortened?: boolean; declinedOn?: string | null } = {}) =>
    shouldSuggestShortening({ longSessions: sessions(durations), alreadyShortened: false, declinedOn: null, ...overrides })

  it('applies to the long versions only', () => {
    expect(shorteningApplies('A_lang')).toBe(true)
    expect(shorteningApplies('B_lang')).toBe(true)
    expect(shorteningApplies('A_einstieg')).toBe(false)
    expect(shorteningApplies('B_einstieg')).toBe(false)
    expect(shorteningApplies('kurzzirkel')).toBe(false)
  })

  it('suggests dropping exercise 7 after two long versions in a row above 55 minutes', () => {
    expect(suggest([50, 56, 58])).toBe(true)
  })

  it('does not suggest when one of the last two stayed at or below 55 minutes', () => {
    expect(suggest([60, 60, 55])).toBe(false)
    expect(suggest([60, 54, 60])).toBe(false)
  })

  it('needs two sessions', () => {
    expect(suggest([70])).toBe(false)
  })

  it('stays quiet once shortened', () => {
    expect(suggest([60, 60], { alreadyShortened: true })).toBe(false)
  })

  it('after a decline only counts sessions since then', () => {
    expect(suggest([60, 60], { declinedOn: addDays(FIRST, 2) })).toBe(false)
    expect(suggest([60, 60, 60, 60], { declinedOn: addDays(FIRST, 2) })).toBe(true)
  })
})
