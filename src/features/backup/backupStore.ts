import type { FitnessDatabase } from '../../db/database'
import { LOCAL_USER_ID } from '../../db/localUser'
import type {
  BodyMeasureLog,
  BodyWeightLog,
  CardioLog,
  Equipment,
  KcalAdjustment,
  NutritionDayLog,
  ProgressionEventRecord,
  ProgressionStateRecord,
  ScheduledSession,
  SessionLog,
  SetLog,
  User,
  WeekPlan,
} from '../../db/types'
import { addDays, toIsoDate, toLocalTimestamp } from '../../domain/dates'
import type { IsoDate } from '../../domain/types'
import { BACKUP_APP_ID, BACKUP_FORMAT_VERSION, backupSchema, type Backup, type BackupData } from './backupSchema'

// Export and import of all user data as one JSON file. The exercise catalogue
// is not part of the file; it comes with the app.

export const BACKUP_REMINDER_DAYS = 7
/** Larger files are refused unread; years of training stay far below this. */
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024

/** Compile-time check that the schema and the database records agree. */
type DatabaseRows = {
  users: User[]
  equipment: Equipment[]
  weekPlans: WeekPlan[]
  scheduledSessions: ScheduledSession[]
  sessionLogs: SessionLog[]
  setLogs: SetLog[]
  progressionStates: ProgressionStateRecord[]
  progressionEvents: ProgressionEventRecord[]
  bodyWeightLogs: BodyWeightLog[]
  bodyMeasureLogs: BodyMeasureLog[]
  nutritionDayLogs: NutritionDayLog[]
  kcalAdjustments: KcalAdjustment[]
  cardioLogs: CardioLog[]
}
/** Whatever passes the schema must fit the database records. */
export const asDatabaseRows = (data: BackupData): DatabaseRows => data

const TABLE_NAMES = [
  'users',
  'equipment',
  'weekPlans',
  'scheduledSessions',
  'sessionLogs',
  'setLogs',
  'progressionStates',
  'progressionEvents',
  'bodyWeightLogs',
  'bodyMeasureLogs',
  'nutritionDayLogs',
  'kcalAdjustments',
  'cardioLogs',
] as const satisfies readonly (keyof DatabaseRows)[]

export function backupFileName(now: Date): string {
  return `fitness-app-${toIsoDate(now)}.backup.json`
}

export async function createBackup(db: FitnessDatabase, now: Date): Promise<Backup> {
  const tables = TABLE_NAMES.map((name) => db.table(name))
  return db.transaction('r', tables, async () => {
    const data = {} as Record<(typeof TABLE_NAMES)[number], unknown[]>
    for (const name of TABLE_NAMES) data[name] = await db.table(name).toArray()
    return {
      app: BACKUP_APP_ID,
      formatVersion: BACKUP_FORMAT_VERSION,
      schemaVersion: db.verno,
      exportedAt: toLocalTimestamp(now),
      data: data as DatabaseRows satisfies BackupData,
    }
  })
}

export interface BackupSummary {
  exportedAt: string
  completedSessions: number
  sets: number
  weighIns: number
}

export type ParseResult = { ok: true; backup: Backup; summary: BackupSummary } | { ok: false; reason: string }

const idsOf = (rows: { id?: number }[]) => new Set(rows.map((row) => row.id))
const hasDuplicateIds = (rows: { id?: number }[]) => idsOf(rows).size !== rows.length

/** References between tables must resolve, otherwise the app would show broken sessions. */
function referenceProblem(data: BackupData): string | null {
  const numbered = [
    data.weekPlans,
    data.scheduledSessions,
    data.sessionLogs,
    data.setLogs,
    data.progressionEvents,
    data.bodyWeightLogs,
    data.bodyMeasureLogs,
    data.nutritionDayLogs,
    data.kcalAdjustments,
    data.cardioLogs,
  ]
  if (numbered.some((rows) => rows.some((row) => row.id === undefined) || hasDuplicateIds(rows))) {
    return 'Einträge ohne oder mit doppelter Kennung.'
  }
  const weekPlanIds = idsOf(data.weekPlans)
  const scheduledIds = idsOf(data.scheduledSessions)
  const sessionLogIds = idsOf(data.sessionLogs)
  if (data.scheduledSessions.some((session) => !weekPlanIds.has(session.weekPlanId))) {
    return 'Eine Einheit verweist auf eine Woche, die fehlt.'
  }
  if (data.sessionLogs.some((log) => !scheduledIds.has(log.scheduledSessionId))) {
    return 'Ein Workout verweist auf eine Einheit, die fehlt.'
  }
  if (data.setLogs.some((log) => !sessionLogIds.has(log.sessionLogId))) {
    return 'Ein Satz verweist auf ein Workout, das fehlt.'
  }
  return null
}

/** Checks the text of a backup file. Nothing is written; an invalid file is refused as a whole. */
export function parseBackup(text: string): ParseResult {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'Die Datei ist kein gültiges JSON.' }
  }
  const version = (json as { formatVersion?: unknown } | null)?.formatVersion
  if (typeof version === 'number' && version > BACKUP_FORMAT_VERSION) {
    return { ok: false, reason: 'Das Backup stammt aus einer neueren Version der App. Bitte zuerst die App aktualisieren.' }
  }
  const parsed = backupSchema.safeParse(json)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const where = issue ? issue.path.join('.') : ''
    return { ok: false, reason: `Die Datei ist kein Backup dieser App${where ? ` (Fehler bei „${where}“)` : ''}.` }
  }
  const problem = referenceProblem(parsed.data.data)
  if (problem) return { ok: false, reason: `Das Backup ist in sich nicht stimmig: ${problem}` }

  const { data } = parsed.data
  return {
    ok: true,
    backup: parsed.data,
    summary: {
      exportedAt: parsed.data.exportedAt,
      completedSessions: data.scheduledSessions.filter((session) => session.status === 'erledigt').length,
      sets: data.setLogs.length,
      weighIns: data.bodyWeightLogs.length,
    },
  }
}

/**
 * Replaces all user data with the backup, in one transaction: either
 * everything is taken over or nothing changes.
 */
export async function restoreBackup(db: FitnessDatabase, backup: Backup, now: Date): Promise<void> {
  const rows = asDatabaseRows(backup.data)
  const tables = TABLE_NAMES.map((name) => db.table(name))
  await db.transaction('rw', tables, async () => {
    for (const name of TABLE_NAMES) {
      await db.table(name).clear()
      await db.table(name).bulkAdd(rows[name])
    }
    await db.users.update(LOCAL_USER_ID, { lastBackupOn: toIsoDate(now) })
  })
}

export async function markBackupDone(db: FitnessDatabase, now: Date): Promise<void> {
  await db.users.update(LOCAL_USER_ID, { lastBackupOn: toIsoDate(now) })
}

/** Weekly reminder: due a week after the last backup, or a week after first use if there has been none. */
export function backupReminderDue(today: IsoDate, lastBackupOn: IsoDate | null, firstUseOn: IsoDate | null): boolean {
  const anchor = lastBackupOn ?? firstUseOn
  return anchor !== null && today >= addDays(anchor, BACKUP_REMINDER_DAYS)
}

export async function backupReminderDueFor(db: FitnessDatabase, today: IsoDate): Promise<boolean> {
  const user = await db.users.get(LOCAL_USER_ID)
  const firstWeighIn = await db.bodyWeightLogs.orderBy('date').first()
  return backupReminderDue(today, user?.lastBackupOn ?? null, firstWeighIn?.date ?? null)
}
