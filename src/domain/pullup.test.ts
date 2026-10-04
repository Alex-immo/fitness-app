import { describe, expect, it } from 'vitest'
import { evaluatePullupSession, pullupLevelFromTest, pullupScheme } from './pullup'

describe('pull-up placement test', () => {
  it('maps the test result to the start scheme', () => {
    expect(pullupLevelFromTest(0)).toBe('negatives')
    expect(pullupLevelFromTest(1)).toBe('max_reps')
    expect(pullupLevelFromTest(4)).toBe('max_reps')
    expect(pullupLevelFromTest(5)).toBe('rep_range')
    expect(pullupLevelFromTest(12)).toBe('rep_range')
  })

  it('rejects impossible results', () => {
    expect(() => pullupLevelFromTest(-1)).toThrow()
    expect(() => pullupLevelFromTest(2.5)).toThrow()
  })
})

describe('pull-up schemes', () => {
  it('prescribes 4 sets of 3–5 negatives with 5 s lowering after a test of 0', () => {
    expect(pullupScheme('negatives')).toMatchObject({
      sets: 4,
      repMin: 3,
      repMax: 5,
      negativesOnly: true,
      loweringSeconds: 5,
    })
  })

  it('prescribes 4 sets of as many clean reps as possible at RIR 1 after a test of 1–4', () => {
    expect(pullupScheme('max_reps')).toMatchObject({ sets: 4, repMin: null, repMax: null, targetRir: 1 })
  })

  it('prescribes 4 sets of 5–10 after a test of 5 or more', () => {
    expect(pullupScheme('rep_range')).toMatchObject({ sets: 4, repMin: 5, repMax: 10, negativesOnly: false })
  })
})

describe('pull-up advance', () => {
  it('asks for a new test after 4 × 5 negatives', () => {
    expect(evaluatePullupSession('negatives', [5, 5, 5, 5])).toEqual({ level: 'negatives', retestDue: true })
    expect(evaluatePullupSession('negatives', [5, 5, 5, 4]).retestDue).toBe(false)
  })

  it('moves to the next row after 4 × 5', () => {
    expect(evaluatePullupSession('max_reps', [6, 5, 5, 5]).level).toBe('rep_range')
    expect(evaluatePullupSession('max_reps', [5, 5, 4, 4]).level).toBe('max_reps')
  })

  it('moves to added load after 4 × 10', () => {
    expect(evaluatePullupSession('rep_range', [10, 10, 10, 10]).level).toBe('weighted')
    expect(evaluatePullupSession('rep_range', [10, 10, 10, 9]).level).toBe('rep_range')
  })

  it('needs all four sets', () => {
    expect(evaluatePullupSession('rep_range', [10, 10, 10]).level).toBe('rep_range')
  })
})
