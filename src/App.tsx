import { useState } from 'react'
import { db } from './db/database'
import type { ProgressionEventRecord } from './db/types'
import type { TemplateId } from './domain/types'
import { eventText, TEMPLATE_NAMES } from './features/workout/texts'
import { WorkoutView } from './features/workout/WorkoutView'
import { getActiveSessionLog, startWorkout } from './features/workout/workoutStore'
import { useLiveQuery } from './shared/useLiveQuery'

// Until week planning exists (build step 5) a workout is started by hand.
const STARTABLE: { id: TemplateId; detail: string }[] = [
  { id: 'A_lang', detail: 'Push, Knie-Schwerpunkt · ca. 60 Min' },
  { id: 'B_lang', detail: 'Pull, Hüft-Schwerpunkt · ca. 60 Min' },
  { id: 'kurzzirkel', detail: 'Bürotag · 25 Min' },
  { id: 'reisezirkel', detail: 'ohne Equipment · 20–25 Min' },
]

export function App() {
  const active = useLiveQuery(async () => (await getActiveSessionLog(db)) ?? null, [])
  const [summary, setSummary] = useState<ProgressionEventRecord[] | null>(null)

  if (summary) return <Summary events={summary} onClose={() => setSummary(null)} />
  if (active === undefined) return null
  if (active?.id !== undefined) return <WorkoutView sessionLogId={active.id} onFinished={setSummary} />

  return (
    <main className="screen">
      <header className="screen-head">
        <h1>Fitness-App</h1>
        <p>Welches Workout steht heute an?</p>
      </header>
      {STARTABLE.map(({ id, detail }) => (
        <button key={id} type="button" className="start-button" onClick={() => void startWorkout(db, id, new Date())}>
          <strong>{TEMPLATE_NAMES[id]}</strong>
          <span>{detail}</span>
        </button>
      ))}
    </main>
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
