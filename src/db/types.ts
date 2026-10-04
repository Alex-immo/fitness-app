import type { PullupLevel } from '../domain/pullup'
import type {
  DayType,
  DumbbellsUsed,
  IsoDate,
  LoadType,
  PlateStock,
  ProgressionEvent,
  ProgressionState,
  Sex,
  Side,
  TemplateId,
} from '../domain/types'

// Records of the local tables (SPEZIFIKATION.md section 9). Fields beyond the
// spec are marked "extension".

export interface User {
  id: string
  heightCm: number
  birthYear: number
  sex: Sex
  goal: string
  kcalTarget: number
  proteinTargetG: number
  gainTargetPctPerWeek: number
}

export interface Equipment {
  id: string
  nameDe: string
  count: number
  /** Null for equipment that carries no load. */
  barWeightKg: number | null
  plates: PlateStock[]
  maxPlatesPerSide: number | null
}

export type StartLoadHint = 'cap' | 'calibrate'

export interface Exercise {
  id: string
  nameDe: string
  movementPattern: string
  equipmentIds: string[]
  isUnilateral: boolean
  loadType: LoadType
  dumbbellsUsed: DumbbellsUsed
  nextVariantText: string | null
  cueText: string
  /** Extension: where the spec expects the start load; null without a dumbbell. */
  startLoadHint: StartLoadHint | null
}

export type TemplateType = 'straight_sets' | 'circuit' | 'cardio'

export interface WorkoutTemplate {
  id: TemplateId
  type: TemplateType
  estimatedMinutes: number
  countsForProgression: boolean
}

export interface TemplateItem {
  id: string
  templateId: TemplateId
  exerciseId: string
  order: number
  /** Rounds for circuit templates. */
  sets: number
  /** Repetitions, or seconds for exercises with load type "zeit". Null: set by the pull-up placement. */
  repMin: number | null
  repMax: number | null
  /** Rest after each set. In circuits only the last item carries the rest between rounds. */
  restSeconds: number
  note: string
  /** Extension: true where a dumbbell exercise is done without load (travel circuit). */
  withoutLoad: boolean
}

export type WeekType = 'normal' | 'deload'

export interface WeekPlan {
  id?: number
  userId: string
  weekStart: IsoDate
  weekType: WeekType
}

export type SessionStatus = 'geplant' | 'erledigt' | 'ersetzt' | 'ausgefallen'

export interface ScheduledSession {
  id?: number
  weekPlanId: number
  date: IsoDate
  templateId: TemplateId
  dayType: DayType
  status: SessionStatus
}

export interface SessionLog {
  id?: number
  scheduledSessionId: number
  /** ISO timestamp in device-local time. */
  startedAt: string
  finishedAt: string | null
  perceivedEffort: number | null
}

export interface SetLog {
  id?: number
  sessionLogId: number
  exerciseId: string
  setNumber: number
  side: Side | null
  loadKg: number | null
  repsDone: number | null
  durationS: number | null
  rir: number | null
  tempoApplied: boolean
}

export interface ProgressionStateRecord extends ProgressionState {
  /** Extension: only set for the pull-up, which follows its own scheme. */
  pullupLevel?: PullupLevel
}

export interface ProgressionEventRecord extends ProgressionEvent {
  id?: number
}

export interface BodyWeightLog {
  id?: number
  userId: string
  date: IsoDate
  weightKg: number
}

export interface BodyMeasureLog {
  id?: number
  userId: string
  date: IsoDate
  waistCm: number | null
  armCm: number | null
  chestCm: number | null
}

export interface NutritionDayLog {
  id?: number
  userId: string
  date: IsoDate
  proteinG: number
}

export interface KcalAdjustment {
  id?: number
  userId: string
  date: IsoDate
  trendPctPerWeek: number
  oldTarget: number
  newTarget: number
}

export interface CardioLog {
  id?: number
  userId: string
  date: IsoDate
  durationMin: number
  zone: number
  avgPowerW: number | null
}
