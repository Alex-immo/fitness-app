import { addDays, weekdayIndex } from './dates'
import type { DayType, IsoDate, LongTemplateId, TemplateId } from './types'

// Week planning and A/B rotation (SPEZIFIKATION.md section 3).

/** Monday, Wednesday, Friday as weekday indexes (0 = Monday). */
export const DEFAULT_STRENGTH_SLOTS: readonly number[] = [0, 2, 4]
/** Saturday. */
export const DEFAULT_BIKE_WEEKDAY = 5

export interface PlannedSession {
  date: IsoDate
  dayType: DayType
  templateId: TemplateId
}

export interface WeekPlanInput {
  /** Monday of the week to plan. */
  weekStart: IsoDate
  /** Day type for Monday to Sunday. */
  dayTypes: readonly DayType[]
  /** Last long version before this week; null if there has been none yet. */
  lastLong: LongTemplateId | null
  strengthSlots?: readonly number[]
  bikeWeekday?: number
}

export interface WeekPlanResult {
  sessions: PlannedSession[]
  /** Last long version after this week, to seed the following week. */
  lastLong: LongTemplateId | null
}

/** The long versions alternate A → B → A → B, starting with A. */
export function nextLongTemplate(lastLong: LongTemplateId | null): LongTemplateId {
  return lastLong === 'A_lang' ? 'B_lang' : 'A_lang'
}

export function planWeek(input: WeekPlanInput): WeekPlanResult {
  const { weekStart, dayTypes } = input
  const strengthSlots = input.strengthSlots ?? DEFAULT_STRENGTH_SLOTS
  const bikeWeekday = input.bikeWeekday ?? DEFAULT_BIKE_WEEKDAY

  if (weekdayIndex(weekStart) !== 0) throw new Error('weekStart must be a Monday')
  if (dayTypes.length !== 7) throw new Error('dayTypes needs one entry per weekday')
  const sortedSlots = [...strengthSlots].sort((a, b) => a - b)
  if (sortedSlots.some((slot, i) => i > 0 && slot - sortedSlots[i - 1]! < 2)) {
    throw new Error('Strength slots need at least one rest day in between')
  }

  let lastLong = input.lastLong
  const sessions: PlannedSession[] = []

  dayTypes.forEach((dayType, weekday) => {
    const date = addDays(weekStart, weekday)
    if (sortedSlots.includes(weekday)) {
      if (dayType === 'homeoffice') {
        lastLong = nextLongTemplate(lastLong)
        sessions.push({ date, dayType, templateId: lastLong })
      } else if (dayType === 'buero') {
        // Replaces the session; it does not move the rotation and is not made up.
        sessions.push({ date, dayType, templateId: 'kurzzirkel' })
      } else if (dayType === 'reise') {
        sessions.push({ date, dayType, templateId: 'reisezirkel' })
      }
      return
    }
    // Zone 2 never shares a morning with strength training.
    if (weekday === bikeWeekday && dayType === 'wochenende') {
      sessions.push({ date, dayType, templateId: 'bike_z2' })
    }
  })

  return { sessions, lastLong }
}

export interface RotationEntry {
  templateId: TemplateId
  /** Only "geplant" and "erledigt" take part; dropped or replaced sessions are skipped. */
  status: 'geplant' | 'erledigt' | 'ersetzt' | 'ausgefallen'
}

const isLong = (templateId: TemplateId): templateId is LongTemplateId =>
  templateId === 'A_lang' || templateId === 'B_lang'

/**
 * Assigns A or B to every planned long session. The rotation follows the long
 * versions actually completed: a long session that was dropped does not count,
 * so the next one takes its place. `sessions` must be in date order from the
 * very first session on; the result has the same order.
 */
export function assignRotation(sessions: readonly RotationEntry[]): TemplateId[] {
  let lastLong: LongTemplateId | null = null
  return sessions.map((session) => {
    if (!isLong(session.templateId)) return session.templateId
    if (session.status === 'erledigt') {
      lastLong = session.templateId
      return session.templateId
    }
    if (session.status !== 'geplant') return session.templateId
    lastLong = nextLongTemplate(lastLong)
    return lastLong
  })
}
