import { useState } from 'react'
import { db } from '../../db/database'
import { toIsoDate } from '../../domain/dates'
import type { PlanPhase } from '../../domain/types'
import { checkForUpdate, type UpdateResult } from '../../shared/appUpdate'
import { formatDayMonth } from '../../shared/format'
import { useLiveQuery } from '../../shared/useLiveQuery'
import { BackupSection } from '../backup/BackupSection'
import { getUser } from '../body/bodyStore'
import { setPlanPhase, setShortenLong } from '../plan/planStore'
import { getActiveSessionLog } from '../workout/workoutStore'
import { EquipmentSection } from './EquipmentSection'
import { ExercisesView } from './ExercisesView'
import { ProfileSection } from './ProfileSection'
import { DUMBBELL_ID } from './settingsStore'

const PHASES: { id: PlanPhase; label: string; detail: string }[] = [
  { id: 'einstieg', label: 'Einstieg', detail: '7 Übungen, 17 Sätze je Einheit' },
  { id: 'voll', label: 'Voll', detail: '9 Übungen, 25 Sätze je Einheit' },
]

export function SettingsView() {
  const data = useLiveQuery(
    async () => ({
      user: (await getUser(db)) ?? null,
      dumbbell: (await db.equipment.get(DUMBBELL_ID)) ?? null,
      workoutRunning: (await getActiveSessionLog(db)) !== undefined,
    }),
    [],
  )
  const [page, setPage] = useState<'settings' | 'exercises'>('settings')
  if (page === 'exercises') return <ExercisesView onBack={() => setPage('settings')} />
  if (!data?.user) return null
  const { user, dumbbell, workoutRunning } = data
  const phase = user.planPhase ?? 'einstieg'
  const shortened = user.shortenLong === true

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
      <section className="card">
        <h2>Langversion kürzen</h2>
        <p className="exercise-note">
          Streicht Übung 7 aus A lang und B lang (Trizeps bzw. Bizeps). Gilt nicht für die Einstiegsphase.
        </p>
        <div className="segmented" role="group" aria-label="Langversion kürzen">
          {[false, true].map((option) => (
            <button
              key={String(option)}
              type="button"
              className={shortened === option ? 'chip chip-selected' : 'chip'}
              aria-pressed={shortened === option}
              onClick={() => void setShortenLong(db, option)}
            >
              {option ? 'Ohne Übung 7' : 'Alle 9 Übungen'}
            </button>
          ))}
        </div>
      </section>
      <button type="button" className="start-button" onClick={() => setPage('exercises')}>
        <strong>Übungen</strong>
        <span>Ausführung und Hinweise zu allen Übungen</span>
      </button>
      <ProfileSection user={user} />
      {dumbbell && <EquipmentSection dumbbell={dumbbell} workoutRunning={workoutRunning} />}
      <BackupSection />
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
