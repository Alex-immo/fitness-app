import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FitnessDatabase } from '../../db/database'
import { createProfile, logWeight, addProtein, getUser } from '../body/bodyStore'
import { getWeek, saveWeekPlan, DEFAULT_DAY_TYPES } from '../plan/planStore'
import { finishWorkout, logSet, startScheduledSession } from '../workout/workoutStore'
import {
  backupFileName,
  backupReminderDue,
  createBackup,
  parseBackup,
  restoreBackup,
} from './backupStore'
import { BACKUP_FORMAT_VERSION } from './backupSchema'

// Invented values throughout.
const NOW = new Date(2030, 0, 7, 6, 30, 0)
const LATER = new Date(2030, 0, 20, 9, 0, 0)

let db: FitnessDatabase
let counter = 0

beforeEach(async () => {
  db = new FitnessDatabase(`backup-test-${counter++}`)
  await db.open()
})
afterEach(async () => {
  await db.delete()
})

/** A profile, a planned week, one completed workout with a set, weigh-ins and protein. */
async function fillDatabase() {
  await createProfile(db, { heightCm: 200, birthYear: 1980, sex: 'male', weightKg: 100 }, '2030-01-07')
  await logWeight(db, '2030-01-09', 100.4)
  await addProtein(db, '2030-01-07', 120)
  await saveWeekPlan(db, '2030-01-07', DEFAULT_DAY_TYPES)
  const session = (await getWeek(db, '2030-01-07'))!.sessions[0]!
  const logId = await startScheduledSession(db, session.id!, NOW)
  await logSet(db, {
    sessionLogId: logId,
    exerciseId: 'front_squat_db',
    setNumber: 1,
    entries: [{ side: null, value: 12 }],
    unit: 'reps',
    loadKg: 12.8,
    rir: 2,
    tempoApplied: false,
    restSeconds: 90,
    now: NOW,
  })
  await finishWorkout(db, logId, 7, NOW)
}

const dump = async (database: FitnessDatabase) => (await createBackup(database, LATER)).data
const exportText = async () => JSON.stringify(await createBackup(db, LATER))

describe('export', () => {
  it('writes one file with app, version, timestamp and all user tables', async () => {
    await fillDatabase()
    const backup = await createBackup(db, LATER)
    expect(backup).toMatchObject({
      app: 'fitness-app',
      formatVersion: BACKUP_FORMAT_VERSION,
      schemaVersion: 3,
      exportedAt: '2030-01-20T09:00:00',
    })
    expect(Object.keys(backup.data).sort()).toEqual(
      [
        'bodyMeasureLogs',
        'bodyWeightLogs',
        'cardioLogs',
        'equipment',
        'kcalAdjustments',
        'nutritionDayLogs',
        'progressionEvents',
        'progressionStates',
        'scheduledSessions',
        'sessionLogs',
        'setLogs',
        'users',
        'weekPlans',
      ].sort(),
    )
    expect(backup.data.setLogs).toHaveLength(1)
    expect(backup.data.bodyWeightLogs).toHaveLength(2)
  })

  it('leaves the exercise catalogue out', async () => {
    expect(Object.keys((await createBackup(db, LATER)).data)).not.toContain('exercises')
  })

  it('names the file by date with the ignored extension', () => {
    expect(backupFileName(LATER)).toBe('fitness-app-2030-01-20.backup.json')
  })

  it('passes its own import check', async () => {
    await fillDatabase()
    const result = parseBackup(await exportText())
    expect(result).toMatchObject({
      ok: true,
      summary: { exportedAt: '2030-01-20T09:00:00', completedSessions: 1, sets: 1, weighIns: 2 },
    })
  })
})

describe('import check', () => {
  const broken = async (change: (backup: Record<string, any>) => void) => {
    await fillDatabase()
    const backup = JSON.parse(await exportText())
    change(backup)
    return parseBackup(JSON.stringify(backup))
  }

  it('refuses text that is not JSON', () => {
    expect(parseBackup('not json')).toMatchObject({ ok: false })
  })

  it('refuses JSON that is not a backup of this app', () => {
    expect(parseBackup('{}').ok).toBe(false)
    expect(parseBackup('null').ok).toBe(false)
    expect(parseBackup(JSON.stringify({ app: 'other-app', formatVersion: 1 })).ok).toBe(false)
  })

  it('refuses a backup from a newer format version and says so', async () => {
    const result = await broken((backup) => (backup.formatVersion = BACKUP_FORMAT_VERSION + 1))
    expect(result).toMatchObject({ ok: false })
    expect(result.ok ? '' : result.reason).toMatch(/neueren Version/)
  })

  it('refuses a missing table', async () => {
    expect((await broken((backup) => delete backup.data.setLogs)).ok).toBe(false)
  })

  it('refuses a wrong field type', async () => {
    expect((await broken((backup) => (backup.data.bodyWeightLogs[0].weightKg = '100'))).ok).toBe(false)
  })

  it('refuses an unknown template', async () => {
    expect((await broken((backup) => (backup.data.scheduledSessions[0].templateId = 'C_lang'))).ok).toBe(false)
  })

  it('refuses a set that points to a missing workout', async () => {
    const result = await broken((backup) => (backup.data.setLogs[0].sessionLogId = 999))
    expect(result.ok ? '' : result.reason).toMatch(/nicht stimmig/)
  })

  it('drops fields it does not know, such as the old stored set count', async () => {
    await fillDatabase()
    const backup = JSON.parse(await exportText())
    backup.data.progressionStates[0].currentSets = 4
    backup.somethingElse = true
    const result = parseBackup(JSON.stringify(backup))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.backup.data.progressionStates[0]).not.toHaveProperty('currentSets')
  })
})

describe('restore', () => {
  it('brings everything back on an empty device', async () => {
    await fillDatabase()
    const text = await exportText()
    const original = await dump(db)

    const other = new FitnessDatabase(`backup-test-other-${counter++}`)
    await other.open()
    const parsed = parseBackup(text)
    if (!parsed.ok) throw new Error(parsed.reason)
    await restoreBackup(other, parsed.backup, LATER)

    const restored = await dump(other)
    expect({ ...restored, users: [] }).toEqual({ ...original, users: [] })
    expect(restored.users[0]).toMatchObject({ ...original.users[0], lastBackupOn: '2030-01-20' })
    expect(await other.exercises.count()).toBe(19)
    await other.delete()
  })

  it('replaces what was there instead of mixing', async () => {
    await fillDatabase()
    const parsed = parseBackup(await exportText())
    if (!parsed.ok) throw new Error(parsed.reason)

    await logWeight(db, '2030-01-15', 103)
    await addProtein(db, '2030-01-15', 50)
    await restoreBackup(db, parsed.backup, LATER)
    expect((await db.bodyWeightLogs.toArray()).map((log) => log.date)).toEqual(['2030-01-07', '2030-01-09'])
    expect(await db.nutritionDayLogs.count()).toBe(1)
  })

  it('takes over nothing if writing fails part-way', async () => {
    await fillDatabase()
    const parsed = parseBackup(await exportText())
    if (!parsed.ok) throw new Error(parsed.reason)
    const before = await dump(db)

    // Two rows with the same key make the write fail in a late table.
    const corrupt = structuredClone(parsed.backup)
    corrupt.data.setLogs.push({ ...corrupt.data.setLogs[0]! })
    await expect(restoreBackup(db, corrupt, LATER)).rejects.toThrow()
    expect(await dump(db)).toEqual(before)
    expect((await getUser(db))?.lastBackupOn).toBeUndefined()
  })
})

describe('weekly reminder', () => {
  it('is due a week after the last backup', () => {
    expect(backupReminderDue('2030-01-13', '2030-01-07', '2030-01-01')).toBe(false)
    expect(backupReminderDue('2030-01-14', '2030-01-07', '2030-01-01')).toBe(true)
  })

  it('is due a week after first use if there has been no backup', () => {
    expect(backupReminderDue('2030-01-07', null, '2030-01-01')).toBe(false)
    expect(backupReminderDue('2030-01-08', null, '2030-01-01')).toBe(true)
  })

  it('is not due before the app has been used', () => {
    expect(backupReminderDue('2030-01-08', null, null)).toBe(false)
  })
})
