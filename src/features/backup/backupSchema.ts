import { z } from 'zod'

// Shape of a backup file. Import accepts a file only if it matches this schema
// completely; unknown fields are dropped, so files written by older versions
// of the app (with fields that no longer exist) still load.

/** Version of the file format. Raise it when the shape below changes incompatibly. */
export const BACKUP_FORMAT_VERSION = 2
export const BACKUP_APP_ID = 'fitness-app'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const timestamp = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
const id = z.number().int().positive()
const optionalId = id.optional()

const sex = z.enum(['male', 'female'])
const planPhase = z.enum(['einstieg', 'voll'])
const dayType = z.enum(['homeoffice', 'buero', 'reise', 'wochenende'])
const templateId = z.enum(['A_lang', 'B_lang', 'A_einstieg', 'B_einstieg', 'kurzzirkel', 'reisezirkel', 'bike_z2'])
const stage = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)])
const side = z.enum(['links', 'rechts'])

const user = z.object({
  id: z.string().min(1),
  heightCm: z.number().positive(),
  birthYear: z.number().int(),
  sex,
  goal: z.string(),
  kcalTarget: z.number().positive(),
  proteinTargetG: z.number().nonnegative(),
  gainTargetPctPerWeek: z.number(),
  planPhase: planPhase.optional(),
  planPhaseSince: isoDate.optional(),
  phaseSuggestionSnoozedUntil: isoDate.optional(),
  shortenLong: z.boolean().optional(),
  shorteningDeclinedOn: isoDate.optional(),
  deloadDeclinedWeek: isoDate.optional(),
  lastBackupOn: isoDate.optional(),
})

const equipment = z.object({
  id: z.string().min(1),
  nameDe: z.string(),
  count: z.number().int().nonnegative(),
  barWeightKg: z.number().positive().nullable(),
  plates: z.array(z.object({ weightKg: z.number().positive(), count: z.number().int().nonnegative() })),
  maxPlatesPerSide: z.number().int().positive().nullable(),
})

const weekPlan = z.object({
  id: optionalId,
  userId: z.string(),
  weekStart: isoDate,
  weekType: z.enum(['normal', 'deload']),
  dayTypes: z.array(dayType).length(7).optional(),
})

const scheduledSession = z.object({
  id: optionalId,
  weekPlanId: id,
  date: isoDate,
  templateId,
  dayType,
  status: z.enum(['geplant', 'erledigt', 'ersetzt', 'ausgefallen']),
})

const sessionLog = z.object({
  id: optionalId,
  scheduledSessionId: id,
  startedAt: timestamp,
  finishedAt: timestamp.nullable(),
  perceivedEffort: z.number().int().min(1).max(10).nullable(),
  draft: z
    .object({
      loadByExercise: z.record(z.string(), z.number()),
      restEndsAt: z.number().nullable(),
      restSeconds: z.number().nonnegative(),
    })
    .optional(),
})

const setLog = z.object({
  id: optionalId,
  sessionLogId: id,
  exerciseId: z.string().min(1),
  setNumber: z.number().int().nonnegative(),
  side: side.nullable(),
  loadKg: z.number().positive().nullable(),
  repsDone: z.number().int().nonnegative().nullable(),
  durationS: z.number().nonnegative().nullable(),
  rir: z.number().int().nonnegative().nullable(),
  tempoApplied: z.boolean(),
})

const progressionState = z.object({
  userId: z.string(),
  exerciseId: z.string().min(1),
  currentStage: stage,
  currentLoadKg: z.number().positive().nullable(),
  currentRepMin: z.number().int().nonnegative(),
  currentRepMax: z.number().int().nonnegative(),
  consecutiveTargetHits: z.number().int().nonnegative(),
  consecutiveFloorMisses: z.number().int().nonnegative(),
  stage5Completed: z.boolean(),
  updatedAt: isoDate,
  pullupLevel: z.enum(['negatives', 'max_reps', 'rep_range', 'weighted']).optional(),
  pullupRetestDue: z.boolean().optional(),
})

const progressionEvent = z.object({
  id: optionalId,
  userId: z.string(),
  exerciseId: z.string().min(1),
  date: isoDate,
  fromStage: stage,
  toStage: stage,
  fromLoadKg: z.number().positive().nullable(),
  toLoadKg: z.number().positive().nullable(),
  reason: z.enum([
    'load_increase',
    'rep_range_extended_before_large_jump',
    'tempo_added',
    'extra_set_added',
    'variant_introduced',
    'equipment_limit_reached',
    'load_decrease_after_missed_floor',
    'stage_decrease_after_missed_floor',
    'manual_load_change',
    'pullup_level_changed',
    // Since format version 2.
    'equipment_changed',
  ]),
})

const dated = { id: optionalId, userId: z.string(), date: isoDate }

export const backupDataSchema = z.object({
  users: z.array(user).max(1),
  equipment: z.array(equipment),
  weekPlans: z.array(weekPlan),
  scheduledSessions: z.array(scheduledSession),
  sessionLogs: z.array(sessionLog),
  setLogs: z.array(setLog),
  progressionStates: z.array(progressionState),
  progressionEvents: z.array(progressionEvent),
  bodyWeightLogs: z.array(z.object({ ...dated, weightKg: z.number().positive() })),
  bodyMeasureLogs: z.array(
    z.object({
      ...dated,
      waistCm: z.number().positive().nullable(),
      armCm: z.number().positive().nullable(),
      chestCm: z.number().positive().nullable(),
    }),
  ),
  nutritionDayLogs: z.array(z.object({ ...dated, proteinG: z.number().nonnegative() })),
  kcalAdjustments: z.array(
    z.object({ ...dated, trendPctPerWeek: z.number(), oldTarget: z.number().positive(), newTarget: z.number().positive() }),
  ),
  cardioLogs: z.array(
    z.object({
      ...dated,
      durationMin: z.number().positive(),
      zone: z.number().int().positive(),
      avgPowerW: z.number().positive().nullable(),
    }),
  ),
})

export const backupSchema = z.object({
  app: z.literal(BACKUP_APP_ID),
  formatVersion: z.number().int().positive(),
  /** Version of the database schema the data was exported from. */
  schemaVersion: z.number().int().positive(),
  exportedAt: timestamp,
  data: backupDataSchema,
})

export type BackupData = z.infer<typeof backupDataSchema>
export type Backup = z.infer<typeof backupSchema>
