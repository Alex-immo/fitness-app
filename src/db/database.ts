import Dexie, { type Table } from 'dexie'
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
