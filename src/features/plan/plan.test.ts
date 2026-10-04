import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FitnessDatabase } from '../../db/database'
import type { DayType } from '../../domain/types'
import { finishWorkout, getActiveSessionLog, startScheduledSession } from '../workout/workoutStore'
import { LOCAL_USER_ID } from '../../db/localUser'
import { addDays } from '../../domain/dates'
import {
  closePastWeeks,
  DEFAULT_DAY_TYPES,
  getWeek,
  logBikeSession,
  fullPlanSuggested,
  getPlanPhase,
  saveWeekPlan,
  setPlanPhase,
  setSessionDropped,
  snoozePhaseSuggestion,
  suggestedDayTypes,
} from './planStore'

const WEEK_1 = '2030-01-07'
const WEEK_2 = '2030-01-14'
const MONDAY_MORNING = new Date(2030, 0, 7, 6, 30)
const TWO_HOME_OFFICE: DayType[] = ['homeoffice', 'buero', 'homeoffice', 'buero', 'buero', 'wochenende', 'wochenende']

// Invented profile values.
const TEST_USER = {
  id: LOCAL_USER_ID,
  heightCm: 200,
  birthYear: 1980,
  sex: 'male' as const,
  goal: 'muskelaufbau',
  kcalTarget: 3000,
  proteinTargetG: 160,
  gainTargetPctPerWeek: 0.375,
}

let db: FitnessDatabase
let counter = 0

beforeEach(async () => {
  db = new FitnessDatabase(`plan-test-${counter++}`)
  await db.open()
  await db.users.put({ ...TEST_USER, planPhase: 'voll' })
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

describe('plan variant', () => {
  const useEntryPhase = () => db.users.put({ ...TEST_USER, planPhase: 'einstieg' })

  it('defaults to the entry phase, also for profiles from before the setting existed', async () => {
    await db.users.put(TEST_USER)
    expect(await getPlanPhase(db)).toBe('einstieg')
    await saveWeekPlan(db, WEEK_1, DEFAULT_DAY_TYPES)
    expect(await templates(WEEK_1)).toEqual([
      '07:A_einstieg:geplant',
      '09:B_einstieg:geplant',
      '11:A_einstieg:geplant',
      '12:bike_z2:geplant',
    ])
  })

  it('leaves circuits and bike as they are in the entry phase', async () => {
    await useEntryPhase()
    await saveWeekPlan(db, WEEK_1, ['buero', 'reise', 'reise', 'reise', 'homeoffice', 'wochenende', 'wochenende'])
    expect(await templates(WEEK_1)).toEqual([
      '07:kurzzirkel:geplant',
      '09:reisezirkel:geplant',
      '11:A_einstieg:geplant',
      '12:bike_z2:geplant',
    ])
  })

  it('continues the rotation across a switch and moves only open sessions', async () => {
    await useEntryPhase()
    await saveWeekPlan(db, WEEK_1, DEFAULT_DAY_TYPES)
    await saveWeekPlan(db, WEEK_2, DEFAULT_DAY_TYPES)
    const monday = (await getWeek(db, WEEK_1))!.sessions[0]!
    await complete(monday.id!, MONDAY_MORNING)

    await setPlanPhase(db, 'voll', '2030-01-08')
    expect((await templates(WEEK_1)).slice(0, 3)).toEqual(['07:A_einstieg:erledigt', '09:B_lang:geplant', '11:A_lang:geplant'])
    expect((await templates(WEEK_2))[0]).toBe('14:B_lang:geplant')
    expect(await db.users.get(LOCAL_USER_ID)).toMatchObject({ planPhase: 'voll', planPhaseSince: '2030-01-08' })

    await setPlanPhase(db, 'einstieg', '2030-01-08')
    expect((await templates(WEEK_1)).slice(0, 3)).toEqual([
      '07:A_einstieg:erledigt',
      '09:B_einstieg:geplant',
      '11:A_einstieg:geplant',
    ])
  })
})

describe('suggestion to switch to the full plan', () => {
  /** Completes one entry session per week on consecutive Mondays with the given durations. */
  const trainWeeks = async (durationsMin: number[]) => {
    for (const [index, durationMin] of durationsMin.entries()) {
      const weekStart = addDays(WEEK_1, index * 7)
      await saveWeekPlan(db, weekStart, ['homeoffice', 'buero', 'buero', 'buero', 'buero', 'wochenende', 'wochenende'])
      const session = (await getWeek(db, weekStart))!.sessions[0]!
      const startedAt = new Date(2030, 0, 7 + index * 7, 6, 0)
      const logId = await startScheduledSession(db, session.id!, startedAt)
      await finishWorkout(db, logId, null, new Date(startedAt.getTime() + durationMin * 60_000))
    }
  }
  const TODAY = '2030-02-01'

  beforeEach(async () => {
    await db.users.put({ ...TEST_USER, planPhase: 'einstieg' })
  })

  it('is made after four training weeks with the last two sessions under 45 minutes', async () => {
    await trainWeeks([50, 48, 44, 41])
    expect(await fullPlanSuggested(db, TODAY)).toBe(true)
  })

  it('is not made when one of the last two sessions took 45 minutes or more', async () => {
    await trainWeeks([40, 40, 46, 41])
    expect(await fullPlanSuggested(db, TODAY)).toBe(false)
  })

  it('is not made with too few sessions', async () => {
    await trainWeeks([40, 40, 40])
    expect(await fullPlanSuggested(db, TODAY)).toBe(false)
  })

  it('can be postponed by two weeks and never switches by itself', async () => {
    await trainWeeks([40, 40, 40, 40])
    await snoozePhaseSuggestion(db, TODAY)
    expect(await fullPlanSuggested(db, '2030-02-14')).toBe(false)
    expect(await fullPlanSuggested(db, '2030-02-15')).toBe(true)
    expect(await getPlanPhase(db)).toBe('einstieg')
  })

  it('ends once the user confirms the switch', async () => {
    await trainWeeks([40, 40, 40, 40])
    await setPlanPhase(db, 'voll', TODAY)
    expect(await fullPlanSuggested(db, TODAY)).toBe(false)
  })

  it('counts training weeks anew after switching back to the entry phase', async () => {
    await trainWeeks([40, 40, 40, 40])
    await setPlanPhase(db, 'voll', TODAY)
    await setPlanPhase(db, 'einstieg', '2030-02-04')
    expect(await fullPlanSuggested(db, '2030-02-04')).toBe(false)
  })
})
