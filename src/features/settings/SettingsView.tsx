import { db } from '../../db/database'
import { toIsoDate } from '../../domain/dates'
import type { PlanPhase } from '../../domain/types'
import { useLiveQuery } from '../../shared/useLiveQuery'
import { getPlanPhase, setPlanPhase } from '../plan/planStore'

const PHASES: { id: PlanPhase; label: string; detail: string }[] = [
  { id: 'einstieg', label: 'Einstieg', detail: '7 Übungen, 17 Sätze je Einheit' },
  { id: 'voll', label: 'Voll', detail: '9 Übungen, 25 Sätze je Einheit' },
]

export function SettingsView() {
  const phase = useLiveQuery(() => getPlanPhase(db), [])
  if (phase === undefined) return null

  return (
    <main className="screen screen-with-nav">
      <header className="screen-head">
        <h1>Einstellungen</h1>
      </header>
      <section className="card">
        <h2>Planvariante</h2>
        <p className="exercise-note">
          Gilt für die Homeoffice-Tage. Offene Einheiten wechseln sofort mit, erledigte bleiben. Die A/B-Rotation
          und dein Stand je Übung laufen weiter.
        </p>
        <div className="segmented" role="group" aria-label="Planvariante">
          {PHASES.map(({ id, label, detail }) => (
            <button
              key={id}
              type="button"
              className={phase === id ? 'chip chip-selected phase-option' : 'chip phase-option'}
              aria-pressed={phase === id}
              onClick={() => void setPlanPhase(db, id, toIsoDate(new Date()))}
            >
              <strong>{label}</strong>
              <span>{detail}</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}
