import { describe, expect, it } from 'vitest'
import { countTrainingWeeks, shouldSuggestFullPlan, type CompletedSession } from './phase'

/** One session per week on four consecutive Mondays, then extra ones as given. */
const fourWeeks = (durations: [number, number, number, number]): CompletedSession[] =>
  ['2030-01-07', '2030-01-14', '2030-01-21', '2030-01-28'].map((date, i) => ({ date, durationMin: durations[i]! }))

const suggest = (entrySessions: CompletedSession[], overrides: Partial<Parameters<typeof shouldSuggestFullPlan>[0]> = {}) =>
  shouldSuggestFullPlan({ phase: 'einstieg', entrySessions, today: '2030-02-01', snoozedUntil: null, ...overrides })

describe('training weeks', () => {
  it('counts calendar weeks, not sessions', () => {
    expect(countTrainingWeeks(['2030-01-07', '2030-01-09', '2030-01-11', '2030-01-14'])).toBe(2)
    expect(countTrainingWeeks([])).toBe(0)
  })
})

describe('suggestion to switch to the full plan', () => {
  it('is made after four training weeks when the last two sessions were under 45 minutes', () => {
    expect(suggest(fourWeeks([50, 50, 44, 40]))).toBe(true)
  })

  it('is not made when one of the last two sessions took 45 minutes or more', () => {
    expect(suggest(fourWeeks([40, 40, 45, 40]))).toBe(false)
    expect(suggest(fourWeeks([40, 40, 40, 52]))).toBe(false)
  })

  it('only looks at the last two sessions, whatever the order they are passed in', () => {
    expect(suggest([...fourWeeks([60, 60, 40, 40])].reverse())).toBe(true)
  })

  it('is not made before four training weeks', () => {
    const threeWeeks = fourWeeks([40, 40, 40, 40]).slice(0, 3)
    expect(suggest(threeWeeks)).toBe(false)
    // Many sessions in few weeks are still too few weeks.
    expect(suggest([...threeWeeks, { date: '2030-01-23', durationMin: 30 }, { date: '2030-01-25', durationMin: 30 }])).toBe(
      false,
    )
  })

  it('is not made with fewer than two sessions', () => {
    expect(suggest([])).toBe(false)
    expect(suggest([{ date: '2030-01-07', durationMin: 30 }])).toBe(false)
  })

  it('is not made in the full phase', () => {
    expect(suggest(fourWeeks([40, 40, 40, 40]), { phase: 'voll' })).toBe(false)
  })

  it('stays quiet while postponed and comes back afterwards', () => {
    const sessions = fourWeeks([40, 40, 40, 40])
    expect(suggest(sessions, { snoozedUntil: '2030-02-15' })).toBe(false)
    expect(suggest(sessions, { snoozedUntil: '2030-02-15', today: '2030-02-15' })).toBe(true)
  })
})
