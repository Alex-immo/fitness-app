import { describe, expect, it } from 'vitest'
import {
  capLoadKg,
  computeLoadSteps,
  isLargeJump,
  jumpToNextKg,
  nextLoadStep,
  previousLoadStep,
  type DumbbellSetup,
} from './loads'

const SETUP: DumbbellSetup = {
  barWeightKg: 2.3,
  dumbbellCount: 2,
  plates: [
    { weightKg: 2, count: 4 },
    { weightKg: 1.25, count: 4 },
    { weightKg: 1, count: 8 },
  ],
  maxPlatesPerSide: 4,
}

describe('load steps with two dumbbells', () => {
  const steps = computeLoadSteps(SETUP, 2)

  it('matches the table in section 2, including the plates per side', () => {
    expect(steps).toEqual([
      { loadKg: 2.3, platesPerSide: [] },
      { loadKg: 4.3, platesPerSide: [1] },
      { loadKg: 4.8, platesPerSide: [1.25] },
      { loadKg: 6.3, platesPerSide: [2] },
      { loadKg: 6.8, platesPerSide: [1.25, 1] },
      { loadKg: 8.3, platesPerSide: [2, 1] },
      { loadKg: 8.8, platesPerSide: [2, 1.25] },
      { loadKg: 10.3, platesPerSide: [2, 1, 1] },
      { loadKg: 10.8, platesPerSide: [2, 1.25, 1] },
      { loadKg: 12.8, platesPerSide: [2, 1.25, 1, 1] },
    ])
  })

  it('has the jumps from the table and no fixed increment', () => {
    const jumps = steps.map((step) => jumpToNextKg(steps, step.loadKg))
    expect(jumps).toEqual([2, 0.5, 1.5, 0.5, 1.5, 0.5, 1.5, 0.5, 2, null])
  })

  it('caps at 12.8 kg per dumbbell', () => {
    expect(capLoadKg(steps)).toBe(12.8)
    expect(nextLoadStep(steps, 12.8)).toBeNull()
  })

  it('steps up and down along the table', () => {
    expect(nextLoadStep(steps, 6.8)?.loadKg).toBe(8.3)
    expect(previousLoadStep(steps, 6.8)?.loadKg).toBe(6.3)
    expect(previousLoadStep(steps, 2.3)).toBeNull()
  })

  it('rejects a load that cannot be set', () => {
    expect(() => nextLoadStep(steps, 5)).toThrow()
  })
})

describe('load steps with one dumbbell', () => {
  const steps = computeLoadSteps(SETUP, 1)
  const loads = steps.map((step) => step.loadKg)

  it('contains the four additional steps from section 2 with their plates', () => {
    expect(steps).toEqual(
      expect.arrayContaining([
        { loadKg: 13.3, platesPerSide: [2, 1.25, 1.25, 1] },
        { loadKg: 14.3, platesPerSide: [2, 2, 1, 1] },
        { loadKg: 14.8, platesPerSide: [2, 2, 1.25, 1] },
        { loadKg: 15.3, platesPerSide: [2, 2, 1.25, 1.25] },
      ]),
    )
  })

  it('contains every two-dumbbell load', () => {
    for (const step of computeLoadSteps(SETUP, 2)) expect(loads).toContain(step.loadKg)
  })

  it('caps at 15.3 kg', () => {
    expect(capLoadKg(steps)).toBe(15.3)
  })

  it('also yields the intermediate loads the pooled plates allow', () => {
    // Not listed in the spec table, but they follow from the plate set.
    expect(loads).toEqual([
      2.3, 4.3, 4.8, 6.3, 6.8, 7.3, 8.3, 8.8, 9.3, 10.3, 10.8, 11.3, 12.3, 12.8, 13.3, 14.3, 14.8, 15.3,
    ])
  })
})

describe('plate rules', () => {
  it('never uses more plates per side than allowed', () => {
    for (const used of [1, 2] as const) {
      for (const step of computeLoadSteps(SETUP, used)) expect(step.platesPerSide.length).toBeLessThanOrEqual(4)
    }
  })

  it('follows an edited plate set without code changes', () => {
    const bigger: DumbbellSetup = { ...SETUP, plates: [...SETUP.plates, { weightKg: 5, count: 4 }] }
    expect(capLoadKg(computeLoadSteps(bigger, 2))).toBe(20.8)
  })

  it('respects a lower plate limit', () => {
    expect(capLoadKg(computeLoadSteps({ ...SETUP, maxPlatesPerSide: 3 }, 2))).toBe(10.8)
  })

  it('refuses an exercise that needs more dumbbells than available', () => {
    expect(() => computeLoadSteps({ ...SETUP, dumbbellCount: 1 }, 2)).toThrow()
  })
})

describe('large jumps', () => {
  it('counts a jump above 15 % of the current load as large', () => {
    expect(isLargeJump(4.8, 6.3)).toBe(true)
    expect(isLargeJump(10.8, 12.8)).toBe(true)
    expect(isLargeJump(4.3, 4.8)).toBe(false)
    expect(isLargeJump(10, 11.5)).toBe(false)
  })
})
