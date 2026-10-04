import { useState } from 'react'
import { db } from './db/database'
import type { ProgressionEventRecord } from './db/types'
import { BodyView } from './features/body/BodyView'
import { getUser } from './features/body/bodyStore'
import { Onboarding } from './features/body/Onboarding'
import { HistoryView } from './features/history/HistoryView'
import { PlanView } from './features/plan/PlanView'
import { SettingsView } from './features/settings/SettingsView'
import { eventText } from './features/workout/texts'
import { WorkoutView } from './features/workout/WorkoutView'
import { getActiveSessionLog } from './features/workout/workoutStore'
import { useLiveQuery } from './shared/useLiveQuery'

type Tab = 'plan' | 'body' | 'history' | 'settings'
const TABS: { id: Tab; label: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'body', label: 'Körper' },
  { id: 'history', label: 'Verlauf' },
  { id: 'settings', label: 'Mehr' },
]

export function App() {
  const state = useLiveQuery(
    async () => ({ user: (await getUser(db)) ?? null, active: (await getActiveSessionLog(db)) ?? null }),
    [],
  )
  const [summary, setSummary] = useState<ProgressionEventRecord[] | null>(null)
  const [tab, setTab] = useState<Tab>('plan')
  // "Zurück" in a running workout shows the tabs again; the workout keeps running.
  const [workoutHidden, setWorkoutHidden] = useState(false)

  if (state === undefined) return null
  if (!state.user) return <Onboarding />
  if (summary) {
    return (
      <Summary
        events={summary}
        onClose={() => {
          setSummary(null)
          setWorkoutHidden(false)
        }}
      />
    )
  }
  const activeId = state.active?.id
  if (activeId !== undefined && !workoutHidden) {
    return <WorkoutView sessionLogId={activeId} onFinished={setSummary} onBack={() => setWorkoutHidden(true)} />
  }
  const resume = activeId !== undefined ? () => setWorkoutHidden(false) : undefined

  return (
    <>
      {tab === 'plan' && <PlanView onResumeWorkout={resume} />}
      {tab === 'body' && <BodyView />}
      {tab === 'history' && <HistoryView />}
      {tab === 'settings' && <SettingsView />}
      <nav className="tabbar" aria-label="Bereiche">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'tab tab-selected' : 'tab'}
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
    </>
  )
}

function Summary({ events, onClose }: { events: ProgressionEventRecord[]; onClose: () => void }) {
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  const nameOf = (id: string) => exercises?.find((exercise) => exercise.id === id)?.nameDe ?? id

  return (
    <main className="screen">
      <header className="screen-head">
        <h1>Workout gespeichert</h1>
        <p>{events.length === 0 ? 'Keine Änderung an den Stufen. Weiter so.' : 'Das ändert sich beim nächsten Mal:'}</p>
      </header>
      {events.map((event, index) => (
        <section className="card" key={index}>
          <h2>{nameOf(event.exerciseId)}</h2>
          <p className="exercise-note">{eventText(event)}</p>
        </section>
      ))}
      <button type="button" className="button-primary" onClick={onClose}>
        Fertig
      </button>
    </main>
  )
}
