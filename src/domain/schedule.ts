import { addDays, weekdayIndex } from './dates'
import type { DayType, IsoDate, LongTemplateId, PlanPhase, RotationSlot, TemplateId } from './types'

// Week planning and A/B rotation (SPEZIFIKATION.md section 3).

/** Monday, Wednesday, Friday as weekday indexes (0 = Monday). */
export const DEFAULT_STRENGTH_SLOTS: readonly number[] = [0, 2, 4]
/** Saturday. */
export const DEFAULT_BIKE_WEEKDAY = 5

const LONG_TEMPLATES: Record<PlanPhase, Record<RotationSlot, LongTemplateId>> = {
  einstieg: { A: 'A_einstieg', B: 'B_einstieg' },
  voll: { A: 'A_lang', B: 'B_lang' },
}

/** A or B for the templates that rotate; null for circuits and bike. */
export function rotationSlotOf(templateId: TemplateId): RotationSlot | null {
  for (const slots of Object.values(LONG_TEMPLATES)) {
    if (slots.A === templateId) return 'A'
    if (slots.B === templateId) return 'B'
  }
  return null
}

/** Plan variant a rotating template belongs to; null for circuits and bike. */
export function planPhaseOf(templateId: TemplateId): PlanPhase | null {
  for (const phase of Object.keys(LONG_TEMPLATES) as PlanPhase[]) {
    if (LONG_TEMPLATES[phase].A === templateId || LONG_TEMPLATES[phase].B === templateId) return phase
  }
  return null
}

export function longTemplate(slot: RotationSlot, phase: PlanPhase): LongTemplateId {
  return LONG_TEMPLATES[phase][slot]
}

/**
 * A and B alternate, starting with A. The rotation carries on across a change
 * of plan variant: after A of one variant comes B of the other.
 */
export function nextLongTemplate(lastLong: LongTemplateId | null, phase: PlanPhase): LongTemplateId {
  const lastSlot = lastLong ? rotationSlotOf(lastLong) : null
  return longTemplate(lastSlot === 'A' ? 'B' : 'A', phase)
}

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
  /** Last A or B session before this week; null if there has been none yet. */
  lastLong: LongTemplateId | null
  /** Plan variant that decides which templates home-office days get. */
  phase: PlanPhase
  strengthSlots?: readonly number[]
  bikeWeekday?: number
}

export interface WeekPlanResult {
  sessions: PlannedSession[]
  /** Last A or B session after this week, to seed the following week. */
  lastLong: LongTemplateId | null
}

export function planWeek(input: WeekPlanInput): WeekPlanResult {
  const { weekStart, dayTypes, phase } = input
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
        lastLong = nextLongTemplate(lastLong, phase)
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

/**
 * Assigns the template to every planned A/B session. The rotation follows the
 * sessions actually completed: one that was dropped does not count, so the
 * next one takes its place. Planned sessions get the template of the current
 * plan variant; completed ones stay as they were. `sessions` must be in date
 * order from the very first session on; the result has the same order.
 */
export function assignRotation(sessions: readonly RotationEntry[], phase: PlanPhase): TemplateId[] {
  let lastLong: LongTemplateId | null = null
  return sessions.map((session) => {
    if (rotationSlotOf(session.templateId) === null) return session.templateId
    const templateId = session.templateId as LongTemplateId
    if (session.status === 'erledigt') {
      lastLong = templateId
      return templateId
    }
    if (session.status !== 'geplant') return templateId
    lastLong = nextLongTemplate(lastLong, phase)
    return lastLong
  })
}
