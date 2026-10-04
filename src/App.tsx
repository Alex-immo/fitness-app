import { useState } from 'react'
import { db } from './db/database'
import type { ProgressionEventRecord } from './db/types'
import { PlanView } from './features/plan/PlanView'
import { eventText } from './features/workout/texts'
import { WorkoutView } from './features/workout/WorkoutView'
import { getActiveSessionLog } from './features/workout/workoutStore'
import { useLiveQuery } from './shared/useLiveQuery'

export function App() {
  const active = useLiveQuery(async () => (await getActiveSessionLog(db)) ?? null, [])
  const [summary, setSummary] = useState<ProgressionEventRecord[] | null>(null)

  if (summary) return <Summary events={summary} onClose={() => setSummary(null)} />
  if (active === undefined) return null
  if (active?.id !== undefined) return <WorkoutView sessionLogId={active.id} onFinished={setSummary} />

  return <PlanView />
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
