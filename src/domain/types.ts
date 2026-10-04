// Shared types of the domain layer. Field names are English; enum values keep
// the wording of SPEZIFIKATION.md section 9 so stored data matches the spec.

export type LoadType = 'hantel' | 'koerpergewicht' | 'zeit'
export type DumbbellsUsed = 0 | 1 | 2
export type Side = 'links' | 'rechts'
export type Sex = 'male' | 'female'

export type DayType = 'homeoffice' | 'buero' | 'reise' | 'wochenende'
export type PlanPhase = 'einstieg' | 'voll'
/** A and B rotate; each exists as a full and as an entry-phase template. */
export type RotationSlot = 'A' | 'B'
export type LongTemplateId = 'A_lang' | 'B_lang' | 'A_einstieg' | 'B_einstieg'
export type TemplateId = LongTemplateId | 'kurzzirkel' | 'reisezirkel' | 'bike_z2'

export type Stage = 1 | 2 | 3 | 4 | 5

/** ISO calendar date in device-local time, e.g. "2026-10-05". */
export type IsoDate = string

export interface PlateStock {
  weightKg: number
  /** Total number of plates of this weight across all dumbbells. */
  count: number
}

/** Sets and repetition range of an exercise as dosed in a template. */
export interface Dose {
  sets: number
  repMin: number
  repMax: number
}

export interface ProgressionState {
  userId: string
  exerciseId: string
  currentStage: Stage
  /** Total weight per dumbbell including the bar; null for exercises without a dumbbell. */
  currentLoadKg: number | null
  currentRepMin: number
  currentRepMax: number
  consecutiveTargetHits: number
  consecutiveFloorMisses: number
  /** True once the trigger was met in stage 5: nothing left to progress with this equipment. */
  stage5Completed: boolean
  updatedAt: IsoDate
}

export type ProgressionReason =
  | 'load_increase'
  | 'rep_range_extended_before_large_jump'
  | 'tempo_added'
  | 'extra_set_added'
  | 'variant_introduced'
  | 'equipment_limit_reached'
  | 'load_decrease_after_missed_floor'
  | 'stage_decrease_after_missed_floor'
  | 'manual_load_change'
  | 'pullup_level_changed'
  | 'equipment_changed'

export interface ProgressionEvent {
  userId: string
  exerciseId: string
  date: IsoDate
  fromStage: Stage
  toStage: Stage
  fromLoadKg: number | null
  toLoadKg: number | null
  reason: ProgressionReason
}
