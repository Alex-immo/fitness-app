import { useState } from 'react'
import { db } from '../../db/database'
import { toIsoDate } from '../../domain/dates'
import type { PlanPhase } from '../../domain/types'
import { checkForUpdate, type UpdateResult } from '../../shared/appUpdate'
import { formatDayMonth } from '../../shared/format'
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
      <AppVersion />
    </main>
  )
}

const UPDATE_MESSAGES: Record<Exclude<UpdateResult, 'updated'>, string> = {
  current: 'Du hast die neueste Version.',
  unavailable: 'Prüfung nicht möglich. Bist du online?',
}

function AppVersion() {
  const [checking, setChecking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const update = async () => {
    setChecking(true)
    setMessage(null)
    const result = await checkForUpdate()
    if (result === 'updated') {
      window.location.reload()
      return
    }
    setMessage(UPDATE_MESSAGES[result])
    setChecking(false)
  }

  return (
    <section className="version">
      <p>
        Version {__APP_VERSION__} vom {formatDayMonth(__APP_BUILD_DATE__)}
        {__APP_BUILD_DATE__.slice(0, 4)}
      </p>
      <button type="button" className="button-small" disabled={checking} onClick={() => void update()}>
        {checking ? 'Prüfe …' : 'Aktualisieren'}
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  )
}
