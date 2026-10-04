import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FitnessDatabase } from '../../db/database'
import type { DayType } from '../../domain/types'
import { finishWorkout, getActiveSessionLog, startScheduledSession } from '../workout/workoutStore'
import {
  closePastWeeks,
  DEFAULT_DAY_TYPES,
  getWeek,
  logBikeSession,
  saveWeekPlan,
  setSessionDropped,
  suggestedDayTypes,
} from './planStore'

const WEEK_1 = '2030-01-07'
const WEEK_2 = '2030-01-14'
const MONDAY_MORNING = new Date(2030, 0, 7, 6, 30)
const TWO_HOME_OFFICE: DayType[] = ['homeoffice', 'buero', 'homeoffice', 'buero', 'buero', 'wochenende', 'wochenende']

let db: FitnessDatabase
let counter = 0

beforeEach(async () => {
  db = new FitnessDatabase(`plan-test-${counter++}`)
  await db.open()
})
afterEach(async () => {
  await db.delete()
})

const templates = async (weekStart: string) =>
  (await getWeek(db, weekStart))!.sessions.map((session) => `${session.date.slice(8)}:${session.templateId}:${session.status}`)

const complete = async (sessionId: number, now: Date) => {
  const logId = await startScheduledSession(db, sessionId, now)
  await finishWorkout(db, logId, null, now)
}

describe('week planning', () => {
  it('fills the slots from the day types', async () => {
    await saveWeekPlan(db, WEEK_1, DEFAULT_DAY_TYPES)
    expect(await templates(WEEK_1)).toEqual([
      '07:A_lang:geplant',
      '09:B_lang:geplant',
      '11:A_lang:geplant',
      '12:bike_z2:geplant',
    ])
    expect((await getWeek(db, WEEK_1))?.plan).toMatchObject({ weekType: 'normal', dayTypes: DEFAULT_DAY_TYPES })
  })

  it('continues the rotation into the next planned week', async () => {
    await saveWeekPlan(db, WEEK_1, TWO_HOME_OFFICE)
    await saveWeekPlan(db, WEEK_2, DEFAULT_DAY_TYPES)
    expect(await templates(WEEK_1)).toEqual([
      '07:A_lang:geplant',
      '09:B_lang:geplant',
      '11:kurzzirkel:geplant',
      '12:bike_z2:geplant',
    ])
    expect((await templates(WEEK_2)).slice(0, 3)).toEqual(['14:A_lang:geplant', '16:B_lang:geplant', '18:A_lang:geplant'])
  })

  it('replans open sessions when the day types change and keeps one plan per week', async () => {
    await saveWeekPlan(db, WEEK_1, DEFAULT_DAY_TYPES)
    await saveWeekPlan(db, WEEK_1, ['homeoffice', 'reise', 'reise', 'reise', 'homeoffice', 'wochenende', 'wochenende'])
    expect(await templates(WEEK_1)).toEqual([
      '07:A_lang:geplant',
      '09:reisezirkel:geplant',
      '11:B_lang:geplant',
      '12:bike_z2:geplant',
    ])
    expect(await db.weekPlans.count()).toBe(1)
  })

  it('keeps completed sessions when the week is replanned', async () => {
    await saveWeekPlan(db, WEEK_1, DEFAULT_DAY_TYPES)
    const monday = (await getWeek(db, WEEK_1))!.sessions[0]!
    await complete(monday.id!, MONDAY_MORNING)
    await saveWeekPlan(db, WEEK_1, ['buero', 'buero', 'buero', 'buero', 'homeoffice', 'wochenende', 'wochenende'])
    expect(await templates(WEEK_1)).toEqual([
      '07:A_lang:erledigt',
      '09:kurzzirkel:geplant',
      '11:B_lang:geplant',
      '12:bike_z2:geplant',
    ])
  })

  it('suggests the day types of the latest planned week', async () => {
    expect(await suggestedDayTypes(db, WEEK_1)).toEqual(DEFAULT_DAY_TYPES)
    await saveWeekPlan(db, WEEK_1, TWO_HOME_OFFICE)
    expect(await suggestedDayTypes(db, WEEK_2)).toEqual(TWO_HOME_OFFICE)
  })

  it('rejects a week start that is not a Monday', async () => {
    await expect(saveWeekPlan(db, '2030-01-08', DEFAULT_DAY_TYPES)).rejects.toThrow()
  })
})

describe('rotation in the plan', () => {
  it('moves on after a completed long version', async () => {
    await saveWeekPlan(db, WEEK_1, DEFAULT_DAY_TYPES)
    const monday = (await getWeek(db, WEEK_1))!.sessions[0]!
    await complete(monday.id!, MONDAY_MORNING)
    expect((await templates(WEEK_1)).slice(0, 3)).toEqual(['07:A_lang:erledigt', '09:B_lang:geplant', '11:A_lang:geplant'])
  })

  it('gives a dropped long version to the next long session, and back', async () => {
    await saveWeekPlan(db, WEEK_1, DEFAULT_DAY_TYPES)
    const monday = (await getWeek(db, WEEK_1))!.sessions[0]!
    await setSessionDropped(db, monday.id!, true)
    expect((await templates(WEEK_1)).slice(0, 3)).toEqual([
      '07:A_lang:ausgefallen',
      '09:A_lang:geplant',
      '11:B_lang:geplant',
    ])

    await setSessionDropped(db, monday.id!, false)
    expect((await templates(WEEK_1)).slice(0, 3)).toEqual(['07:A_lang:geplant', '09:B_lang:geplant', '11:A_lang:geplant'])
  })

  it('does not plan a dropped day again when the week is saved once more', async () => {
    await saveWeekPlan(db, WEEK_1, DEFAULT_DAY_TYPES)
    const monday = (await getWeek(db, WEEK_1))!.sessions[0]!
    await setSessionDropped(db, monday.id!, true)
    await saveWeekPlan(db, WEEK_1, DEFAULT_DAY_TYPES)
    expect((await templates(WEEK_1))[0]).toBe('07:A_lang:ausgefallen')
    expect((await getWeek(db, WEEK_1))!.sessions).toHaveLength(4)
  })
})

describe('planned sessions', () => {
  it('starts the workout of a planned session and moves it to the day it is done', async () => {
    await saveWeekPlan(db, WEEK_1, DEFAULT_DAY_TYPES)
    const wednesday = (await getWeek(db, WEEK_1))!.sessions[1]!
    const tuesday = new Date(2030, 0, 8, 6, 30)
    const logId = await startScheduledSession(db, wednesday.id!, tuesday)
    expect((await getActiveSessionLog(db))?.id).toBe(logId)
    expect((await db.scheduledSessions.get(wednesday.id!))?.date).toBe('2030-01-08')
    expect(await db.scheduledSessions.count()).toBe(4)
  })

  it('counts never-started sessions of past weeks as dropped', async () => {
    await saveWeekPlan(db, WEEK_1, DEFAULT_DAY_TYPES)
    const monday = (await getWeek(db, WEEK_1))!.sessions[0]!
    await complete(monday.id!, MONDAY_MORNING)
    await saveWeekPlan(db, WEEK_2, DEFAULT_DAY_TYPES)

    await closePastWeeks(db, WEEK_2)
    expect(await templates(WEEK_1)).toEqual([
      '07:A_lang:erledigt',
      '09:B_lang:ausgefallen',
      '11:A_lang:ausgefallen',
      '12:bike_z2:ausgefallen',
    ])
    // Only A was completed, so the new week starts with B.
    expect((await templates(WEEK_2))[0]).toBe('14:B_lang:geplant')
  })

  it('logs a bike session by hand and completes it', async () => {
    await saveWeekPlan(db, WEEK_1, DEFAULT_DAY_TYPES)
    const bike = (await getWeek(db, WEEK_1))!.sessions[3]!
    await logBikeSession(db, { sessionId: bike.id!, date: '2030-01-12', durationMin: 45, avgPowerW: null })
    expect(await db.cardioLogs.toArray()).toMatchObject([{ durationMin: 45, zone: 2, avgPowerW: null }])
    expect((await db.scheduledSessions.get(bike.id!))?.status).toBe('erledigt')
  })
})
