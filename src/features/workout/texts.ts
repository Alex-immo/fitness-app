import type { ProgressionEventRecord } from '../../db/types'
import type { PullupLevel } from '../../domain/pullup'
import type { TemplateId } from '../../domain/types'
import { formatKg, formatRange } from '../../shared/format'
import type { ExerciseTarget } from './workoutModel'

export const TEMPLATE_NAMES: Record<TemplateId, string> = {
  A_lang: 'Workout A lang',
  B_lang: 'Workout B lang',
  A_einstieg: 'Workout A Einstieg',
  B_einstieg: 'Workout B Einstieg',
  kurzzirkel: 'Kurzzirkel',
  reisezirkel: 'Reisezirkel',
  bike_z2: 'Bike Zone 2',
}

export const TEMPO_HINT = 'Tempo: 4 s ablassen, 1 s Pause in der Dehnung'

const PULLUP_HINTS: Record<PullupLevel, string> = {
  negatives: 'Negativ-Wiederholungen: hochspringen, 5 s ablassen',
  max_reps: 'So viele saubere Wiederholungen wie möglich, eine in Reserve',
  rep_range: 'Saubere Wiederholungen aus dem vollen Hang',
  weighted: 'Mit Zusatzlast im Rucksack',
}

export const pullupHint = (level: PullupLevel): string => PULLUP_HINTS[level]

/** Target of one set, e.g. "12–15 Wdh. je Seite" or "40 s je Seite". */
export function setTargetText(target: ExerciseTarget): string {
  if (target.repMin === null || target.repMax === null) return 'nach Einstufung'
  const amount =
    target.unit === 'seconds' ? `${formatRange(target.repMin, target.repMax)} s` : `${formatRange(target.repMin, target.repMax)} Wdh.`
  return target.exercise.isUnilateral ? `${amount} je Seite` : amount
}

const kg = (value: number | null) => (value === null ? '–' : formatKg(value))

/** Reason of a progression event in the words shown to the user. */
export function eventText(event: ProgressionEventRecord): string {
  switch (event.reason) {
    case 'load_increase':
      return `Last steigt: ${kg(event.fromLoadKg)} → ${kg(event.toLoadKg)}, Wiederholungen zurück auf die Untergrenze`
    case 'rep_range_extended_before_large_jump':
      return 'Großer Lastsprung voraus: Obergrenze steigt zuerst um 5 Wiederholungen'
    case 'tempo_added':
      return 'Stufe 3: langsames Tempo (4 s ablassen, 1 s Pause), Wiederholungen zurück auf die Untergrenze'
    case 'extra_set_added':
      return 'Stufe 4: ein Satz mehr'
    case 'variant_introduced':
      return 'Stufe 5: schwerere Variante, Wiederholungen zurück auf die Untergrenze'
    case 'equipment_limit_reached':
      return 'Stufe 5 abgeschlossen: mit diesem Equipment ausgereizt'
    case 'load_decrease_after_missed_floor':
      return `Untergrenze zweimal verfehlt: Last geht zurück, ${kg(event.fromLoadKg)} → ${kg(event.toLoadKg)}`
    case 'stage_decrease_after_missed_floor':
      return `Untergrenze zweimal verfehlt: zurück auf Stufe ${event.toStage}`
    case 'manual_load_change':
      return `Last von Hand geändert: ${kg(event.fromLoadKg)} → ${kg(event.toLoadKg)}`
    case 'equipment_changed':
      return `Equipment geändert: jetzt Stufe ${event.toStage} bei ${kg(event.toLoadKg)}`
    case 'pullup_level_changed':
      return 'Neues Klimmzug-Schema ab der nächsten Einheit'
  }
}
