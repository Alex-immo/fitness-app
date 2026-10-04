import type { PlateStock } from './types'

// Selectable loads derived from the plate set (SPEZIFIKATION.md section 2).
// Weights are handled in grams internally so sums stay exact.

export interface DumbbellSetup {
  barWeightKg: number
  /** Number of dumbbell bars available. */
  dumbbellCount: number
  plates: PlateStock[]
  maxPlatesPerSide: number
}

export interface LoadStep {
  /** Total weight per dumbbell including the bar. */
  loadKg: number
  /** Plates on each side of the bar, heaviest first. Empty for the bare bar. */
  platesPerSide: number[]
}

/** A jump above this share of the current load counts as large (section 6). */
export const LARGE_JUMP_THRESHOLD = 0.15

const toGrams = (kg: number) => Math.round(kg * 1000)

/**
 * All loads that can be set symmetrically for an exercise using one or two
 * dumbbells, lightest first. With one dumbbell the plates of all bars may go
 * onto a single bar. If several plate combinations give the same load, the one
 * with the fewest plates wins.
 */
export function computeLoadSteps(setup: DumbbellSetup, dumbbellsUsed: 1 | 2): LoadStep[] {
  if (dumbbellsUsed > setup.dumbbellCount) {
    throw new Error(`Exercise needs ${dumbbellsUsed} dumbbells, only ${setup.dumbbellCount} available`)
  }
  const sidesToLoad = dumbbellsUsed * 2
  const plateTypes = setup.plates
    .map((plate) => ({ grams: toGrams(plate.weightKg), perSide: Math.floor(plate.count / sidesToLoad) }))
    .filter((plate) => plate.perSide > 0 && plate.grams > 0)
    .sort((a, b) => b.grams - a.grams)

  const bestBySideGrams = new Map<number, number[]>()

  const visit = (typeIndex: number, chosen: number[], sideGrams: number) => {
    if (typeIndex === plateTypes.length) {
      const best = bestBySideGrams.get(sideGrams)
      if (!best || chosen.length < best.length) bestBySideGrams.set(sideGrams, [...chosen])
      return
    }
    const type = plateTypes[typeIndex]!
    const maxOfType = Math.min(type.perSide, setup.maxPlatesPerSide - chosen.length)
    // Try more of the heavier plate first so ties resolve towards heavier plates.
    for (let n = maxOfType; n >= 0; n--) {
      visit(typeIndex + 1, [...chosen, ...Array<number>(n).fill(type.grams)], sideGrams + n * type.grams)
    }
  }
  visit(0, [], 0)

  const barGrams = toGrams(setup.barWeightKg)
  return [...bestBySideGrams.entries()]
    .sort(([a], [b]) => a - b)
    .map(([sideGrams, plates]) => ({
      loadKg: (barGrams + 2 * sideGrams) / 1000,
      platesPerSide: plates.map((grams) => grams / 1000),
    }))
}

function indexOfLoad(steps: LoadStep[], loadKg: number): number {
  const index = steps.findIndex((step) => toGrams(step.loadKg) === toGrams(loadKg))
  if (index === -1) throw new Error(`${loadKg} kg is not a selectable load`)
  return index
}

export function isSelectableLoad(steps: LoadStep[], loadKg: number): boolean {
  return steps.some((step) => toGrams(step.loadKg) === toGrams(loadKg))
}

/** Next heavier step, or null at the cap. */
export function nextLoadStep(steps: LoadStep[], loadKg: number): LoadStep | null {
  return steps[indexOfLoad(steps, loadKg) + 1] ?? null
}

/** Next lighter step, or null at the bare bar. */
export function previousLoadStep(steps: LoadStep[], loadKg: number): LoadStep | null {
  return steps[indexOfLoad(steps, loadKg) - 1] ?? null
}

export function capLoadKg(steps: LoadStep[]): number {
  const last = steps[steps.length - 1]
  if (!last) throw new Error('No load steps available')
  return last.loadKg
}

/** Jump from this load to the next step in kg, or null at the cap. */
export function jumpToNextKg(steps: LoadStep[], loadKg: number): number | null {
  const next = nextLoadStep(steps, loadKg)
  return next ? (toGrams(next.loadKg) - toGrams(loadKg)) / 1000 : null
}

export function isLargeJump(fromKg: number, toKg: number): boolean {
  return (toGrams(toKg) - toGrams(fromKg)) / toGrams(fromKg) > LARGE_JUMP_THRESHOLD
}
