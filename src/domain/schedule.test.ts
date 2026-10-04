import { describe, expect, it } from 'vitest'
import { addDays, weekStartOf, weekdayIndex } from './dates'
import { assignRotation, nextLongTemplate, planWeek, type RotationEntry } from './schedule'
import type { DayType } from './types'

const MONDAY = '2030-01-07'
const week = (mo: DayType, tu: DayType, we: DayType, th: DayType, fr: DayType): DayType[] => [
  mo,
  tu,
  we,
  th,
  fr,
  'wochenende',
  'wochenende',
]
const summary = (dayTypes: DayType[], lastLong: 'A_lang' | 'B_lang' | null = null) =>
  planWeek({ weekStart: MONDAY, dayTypes, lastLong }).sessions.map(
    (session) => `${weekdayIndex(session.date)}:${session.templateId}`,
  )

describe('dates', () => {
  it('treats Monday as the start of the week', () => {
    expect(weekdayIndex(MONDAY)).toBe(0)
    expect(weekStartOf('2030-01-13')).toBe(MONDAY)
    expect(weekStartOf(MONDAY)).toBe(MONDAY)
  })

  it('adds days across month and year ends', () => {
    expect(addDays('2029-12-31', 1)).toBe('2030-01-01')
    expect(addDays('2030-03-01', -1)).toBe('2030-02-28')
  })
})

describe('A/B rotation', () => {
  it('alternates A → B → A and starts with A', () => {
    expect(nextLongTemplate(null)).toBe('A_lang')
    expect(nextLongTemplate('A_lang')).toBe('B_lang')
    expect(nextLongTemplate('B_lang')).toBe('A_lang')
  })
})

describe('week planning', () => {
  it('plans three home-office days as A, B, A plus bike on Saturday', () => {
    const days = week('homeoffice', 'homeoffice', 'homeoffice', 'buero', 'homeoffice')
    expect(summary(days)).toEqual(['0:A_lang', '2:B_lang', '4:A_lang', '5:bike_z2'])
  })

  it('replaces a missing home-office day with the short circuit; the next week starts with A', () => {
    const days = week('homeoffice', 'buero', 'homeoffice', 'buero', 'buero')
    const plan = planWeek({ weekStart: MONDAY, dayTypes: days, lastLong: null })
    expect(plan.sessions.map((s) => s.templateId)).toEqual(['A_lang', 'B_lang', 'kurzzirkel', 'bike_z2'])
    expect(plan.lastLong).toBe('B_lang')

    const next = planWeek({ weekStart: addDays(MONDAY, 7), dayTypes: days, lastLong: plan.lastLong })
    expect(next.sessions[0]?.templateId).toBe('A_lang')
  })

  it('plans a travel week Tue–Thu as A, travel circuit, B', () => {
    const days = week('homeoffice', 'reise', 'reise', 'reise', 'homeoffice')
    expect(summary(days)).toEqual(['0:A_lang', '2:reisezirkel', '4:B_lang', '5:bike_z2'])
  })

  it('does not let circuits move the rotation', () => {
    const days = week('buero', 'buero', 'reise', 'buero', 'homeoffice')
    expect(summary(days, 'A_lang')).toEqual(['0:kurzzirkel', '2:reisezirkel', '4:B_lang', '5:bike_z2'])
  })

  it('continues the rotation from the previous week', () => {
    const days = week('homeoffice', 'buero', 'homeoffice', 'buero', 'homeoffice')
    expect(summary(days, 'A_lang')).toEqual(['0:B_lang', '2:A_lang', '4:B_lang', '5:bike_z2'])
  })

  it('plans three strength sessions with a rest day in between and no make-up sessions', () => {
    const days = week('buero', 'homeoffice', 'buero', 'homeoffice', 'buero')
    const strength = planWeek({ weekStart: MONDAY, dayTypes: days, lastLong: null }).sessions.filter(
      (session) => session.templateId !== 'bike_z2',
    )
    expect(strength.map((s) => s.templateId)).toEqual(['kurzzirkel', 'kurzzirkel', 'kurzzirkel'])
    expect(strength.map((s) => weekdayIndex(s.date))).toEqual([0, 2, 4])
  })

  it('never puts bike and strength on the same day', () => {
    const days = week('homeoffice', 'buero', 'homeoffice', 'buero', 'homeoffice')
    const plan = planWeek({ weekStart: MONDAY, dayTypes: days, lastLong: null, strengthSlots: [1, 3, 5] })
    const dates = plan.sessions.map((s) => s.date)
    expect(new Set(dates).size).toBe(dates.length)
    expect(plan.sessions.some((s) => s.templateId === 'bike_z2')).toBe(false)
  })

  it('rejects adjacent strength slots', () => {
    const days = week('homeoffice', 'homeoffice', 'homeoffice', 'homeoffice', 'homeoffice')
    expect(() => planWeek({ weekStart: MONDAY, dayTypes: days, lastLong: null, strengthSlots: [0, 1, 3] })).toThrow()
  })

  it('rejects a week start that is not a Monday and incomplete input', () => {
    const days = week('homeoffice', 'buero', 'homeoffice', 'buero', 'homeoffice')
    expect(() => planWeek({ weekStart: '2030-01-08', dayTypes: days, lastLong: null })).toThrow()
    expect(() => planWeek({ weekStart: MONDAY, dayTypes: days.slice(0, 5), lastLong: null })).toThrow()
  })
})

describe('rotation over planned and completed sessions', () => {
  const entry = (templateId: RotationEntry['templateId'], status: RotationEntry['status']): RotationEntry => ({
    templateId,
    status,
  })

  it('continues after the last completed long version', () => {
    expect(
      assignRotation([entry('A_lang', 'erledigt'), entry('A_lang', 'geplant'), entry('A_lang', 'geplant')]),
    ).toEqual(['A_lang', 'B_lang', 'A_lang'])
  })

  it('does not count a dropped long version: the next one takes its place', () => {
    expect(
      assignRotation([entry('A_lang', 'erledigt'), entry('B_lang', 'ausgefallen'), entry('A_lang', 'geplant')]),
    ).toEqual(['A_lang', 'B_lang', 'B_lang'])
  })

  it('is not moved by circuits or bike sessions', () => {
    expect(
      assignRotation([
        entry('A_lang', 'erledigt'),
        entry('kurzzirkel', 'erledigt'),
        entry('bike_z2', 'geplant'),
        entry('reisezirkel', 'geplant'),
        entry('A_lang', 'geplant'),
      ]),
    ).toEqual(['A_lang', 'kurzzirkel', 'bike_z2', 'reisezirkel', 'B_lang'])
  })

  it('never rewrites completed sessions and starts with A', () => {
    expect(assignRotation([entry('B_lang', 'geplant'), entry('B_lang', 'erledigt'), entry('B_lang', 'geplant')])).toEqual([
      'A_lang',
      'B_lang',
      'A_lang',
    ])
  })
})
