import Dexie, { type Table, type Transaction } from 'dexie'
import { SEED_EQUIPMENT, SEED_EXERCISES, SEED_TEMPLATE_ITEMS, SEED_TEMPLATES } from './seed'
import type {
  BodyMeasureLog,
  BodyWeightLog,
  CardioLog,
  Equipment,
  Exercise,
  KcalAdjustment,
  NutritionDayLog,
  ProgressionEventRecord,
  ProgressionStateRecord,
  ScheduledSession,
  SessionLog,
  SetLog,
  TemplateItem,
  User,
  WeekPlan,
  WorkoutTemplate,
} from './types'

export const DB_NAME = 'fitness-app'

/** Brings exercises, templates and template items up to the current catalogue. */
async function refreshCatalogue(transaction: Transaction): Promise<void> {
  await transaction.table('exercises').bulkPut(SEED_EXERCISES)
  await transaction.table('workoutTemplates').bulkPut(SEED_TEMPLATES)
  await transaction.table('templateItems').bulkPut(SEED_TEMPLATE_ITEMS)
}

// Schema changes only through a new version() block with an upgrade step,
// never by deleting the database.
export class FitnessDatabase extends Dexie {
  users!: Table<User, string>
  equipment!: Table<Equipment, string>
  exercises!: Table<Exercise, string>
  workoutTemplates!: Table<WorkoutTemplate, string>
  templateItems!: Table<TemplateItem, string>
  weekPlans!: Table<WeekPlan, number>
  scheduledSessions!: Table<ScheduledSession, number>
  sessionLogs!: Table<SessionLog, number>
  setLogs!: Table<SetLog, number>
  progressionStates!: Table<ProgressionStateRecord, [string, string]>
  progressionEvents!: Table<ProgressionEventRecord, number>
  bodyWeightLogs!: Table<BodyWeightLog, number>
  bodyMeasureLogs!: Table<BodyMeasureLog, number>
  nutritionDayLogs!: Table<NutritionDayLog, number>
  kcalAdjustments!: Table<KcalAdjustment, number>
  cardioLogs!: Table<CardioLog, number>

  constructor(name = DB_NAME) {
    super(name)
    this.version(1).stores({
      users: 'id',
      equipment: 'id',
      exercises: 'id',
      workoutTemplates: 'id',
      templateItems: 'id, templateId, exerciseId',
      weekPlans: '++id, userId, weekStart',
      scheduledSessions: '++id, weekPlanId, date',
      sessionLogs: '++id, scheduledSessionId, startedAt',
      setLogs: '++id, sessionLogId, exerciseId',
      progressionStates: '[userId+exerciseId], exerciseId',
      progressionEvents: '++id, exerciseId, date',
      bodyWeightLogs: '++id, userId, date',
      bodyMeasureLogs: '++id, userId, date',
      nutritionDayLogs: '++id, userId, date',
      kcalAdjustments: '++id, userId, date',
      cardioLogs: '++id, userId, date',
    })
    // Version 2: catalogue changed (glute bridge uses one dumbbell). Existing
    // databases get the current catalogue; equipment stays as the user set it.
    this.version(2).stores({}).upgrade(refreshCatalogue)
    // Version 3: entry-phase templates and the plan variant. The set count
    // leaves the progression state (it now follows from template and stage);
    // existing profiles start in the entry phase. No user data is removed.
    this.version(3)
      .stores({})
      .upgrade(async (transaction) => {
        await refreshCatalogue(transaction)
        await transaction
          .table('progressionStates')
          .toCollection()
          .modify((state: Record<string, unknown>) => {
            delete state.currentSets
          })
        await transaction
          .table('users')
          .toCollection()
          .modify((user: User) => {
            user.planPhase ??= 'einstieg'
          })
      })
    // Version 4: exercises carry display texts (subtitle, how-to, what to watch
    // for) instead of the unused cue text. Only the catalogue is rewritten.
    this.version(4).stores({}).upgrade(refreshCatalogue)
    // Runs once, when the database is first created.
    this.on('populate', (transaction) => {
      void transaction.table('equipment').bulkAdd(SEED_EQUIPMENT)
      void transaction.table('exercises').bulkAdd(SEED_EXERCISES)
      void transaction.table('workoutTemplates').bulkAdd(SEED_TEMPLATES)
      void transaction.table('templateItems').bulkAdd(SEED_TEMPLATE_ITEMS)
    })
  }
}

export const db = new FitnessDatabase()
