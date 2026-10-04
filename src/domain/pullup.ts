// Pull-up progression (SPEZIFIKATION.md section 6, "Klimmzüge"). Pull-ups do
// not run through the five generic stages; the placement test picks a scheme.

export type PullupLevel = 'negatives' | 'max_reps' | 'rep_range' | 'weighted'

export interface PullupScheme {
  sets: number
  /** Null where the scheme has no fixed bound ("as many clean reps as possible"). */
  repMin: number | null
  repMax: number | null
  /** Negative repetitions: lowering only. */
  negativesOnly: boolean
  loweringSeconds: number | null
  targetRir: number | null
}

export const PULLUP_SETS = 4

export function pullupLevelFromTest(maxCleanReps: number): PullupLevel {
  if (!Number.isInteger(maxCleanReps) || maxCleanReps < 0) {
    throw new Error('Test result must be a non-negative whole number')
  }
  if (maxCleanReps === 0) return 'negatives'
  if (maxCleanReps <= 4) return 'max_reps'
  return 'rep_range'
}

export function pullupScheme(level: PullupLevel): PullupScheme {
  switch (level) {
    case 'negatives':
      return { sets: PULLUP_SETS, repMin: 3, repMax: 5, negativesOnly: true, loweringSeconds: 5, targetRir: null }
    case 'max_reps':
      return { sets: PULLUP_SETS, repMin: null, repMax: null, negativesOnly: false, loweringSeconds: null, targetRir: 1 }
    case 'rep_range':
    case 'weighted':
      return { sets: PULLUP_SETS, repMin: 5, repMax: 10, negativesOnly: false, loweringSeconds: null, targetRir: null }
  }
}

export interface PullupOutcome {
  level: PullupLevel
  /** True when the next B session should start with a new placement test. */
  retestDue: boolean
}

/**
 * Evaluates one B session. `repsPerSet` are the repetitions of each set in
 * order; `requiredSets` is the set count of the session's template (4 in the
 * full plan, 3 in the entry phase).
 */
export function evaluatePullupSession(
  level: PullupLevel,
  repsPerSet: number[],
  requiredSets: number = PULLUP_SETS,
): PullupOutcome {
  const allSetsReach = (target: number) =>
    repsPerSet.length >= requiredSets && repsPerSet.every((reps) => reps >= target)

  switch (level) {
    case 'negatives':
      return { level, retestDue: allSetsReach(5) }
    case 'max_reps':
      return { level: allSetsReach(5) ? 'rep_range' : level, retestDue: false }
    case 'rep_range':
      return { level: allSetsReach(10) ? 'weighted' : level, retestDue: false }
    case 'weighted':
      return { level, retestDue: false }
  }
}
