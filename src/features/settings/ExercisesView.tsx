import { db } from '../../db/database'
import { SEED_EXERCISES } from '../../db/seed'
import type { Exercise } from '../../db/types'
import { useLiveQuery } from '../../shared/useLiveQuery'

const CATALOGUE_ORDER = new Map(SEED_EXERCISES.map((exercise, index) => [exercise.id, index]))
const positionOf = (exercise: Exercise) => CATALOGUE_ORDER.get(exercise.id) ?? Number.MAX_SAFE_INTEGER

/** Groups the exercises by movement pattern, in the order of the catalogue in the specification. */
export function groupByMovementPattern(exercises: Exercise[]): { pattern: string; exercises: Exercise[] }[] {
  const groups = new Map<string, Exercise[]>()
  for (const exercise of [...exercises].sort((a, b) => positionOf(a) - positionOf(b))) {
    groups.set(exercise.movementPattern, [...(groups.get(exercise.movementPattern) ?? []), exercise])
  }
  return [...groups.entries()].map(([pattern, grouped]) => ({ pattern, exercises: grouped }))
}

export function ExercisesView({ onBack }: { onBack: () => void }) {
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  if (!exercises) return null

  return (
    <main className="screen screen-with-nav">
      <header className="screen-head">
        <button type="button" className="button-small button-back" onClick={onBack}>
          ‹ Zurück
        </button>
        <h1>Übungen</h1>
        <p>Ausführung und Hinweise, nach Bewegungsmuster</p>
      </header>
      {groupByMovementPattern(exercises).map(({ pattern, exercises: grouped }) => (
        <section key={pattern} className="pattern-group">
          <h2 className="pattern-title">{pattern}</h2>
          {grouped.map((exercise) => (
            <article className="card" key={exercise.id}>
              <div>
                <h3 className="exercise-name">{exercise.nameDe}</h3>
                <p className="exercise-note">{exercise.subtitle}</p>
              </div>
              <p>{exercise.howTo}</p>
              <p>
                <strong>Achte darauf:</strong> {exercise.watchFor}
              </p>
            </article>
          ))}
        </section>
      ))}
    </main>
  )
}
