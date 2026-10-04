import { useId, useState } from 'react'
import type { Exercise } from '../../db/types'

interface ExerciseGuideProps {
  exercise: Exercise
  /** Open from the start, as for an exercise that has not been trained before. */
  initiallyOpen: boolean
}

/** "Ausführung": how the exercise is done and what to watch for, folded away by default. */
export function ExerciseGuide({ exercise, initiallyOpen }: ExerciseGuideProps) {
  const [open, setOpen] = useState(initiallyOpen)
  const id = useId()
  return (
    <div className="guide">
      <button
        type="button"
        className="button-small guide-toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        Ausführung {open ? '▴' : '▾'}
      </button>
      {open && (
        <div id={id} className="guide-text">
          <p>{exercise.howTo}</p>
          <p>
            <strong>Achte darauf:</strong> {exercise.watchFor}
          </p>
        </div>
      )}
    </div>
  )
}
