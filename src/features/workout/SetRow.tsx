import { useState } from 'react'
import type { SetLog } from '../../db/types'
import type { Side } from '../../domain/types'
import { formatNumber } from '../../shared/format'
import { Stepper } from './Stepper'
import { setTargetText } from './texts'
import type { ExerciseTarget, PlanRow } from './workoutModel'
import type { SetEntry } from './workoutStore'

const SIDE_LABELS: Record<Side, string> = { links: 'Links', rechts: 'Rechts' }
/** RIR choices; the last one stands for "4 or more". */
const RIR_CHOICES = [0, 1, 2, 3, 4]

interface SetRowProps {
  row: PlanRow
  target: ExerciseTarget
  /** Logged entries of this set; empty while it is still to do. */
  logs: SetLog[]
  open: boolean
  /** Circuits name the exercise in every row. */
  showExerciseName: boolean
  onLog: (entries: SetEntry[], rir: number | null) => void
  onUndo: () => void
}

export function SetRow({ row, target, logs, open, showExerciseName, onLog, onUndo }: SetRowProps) {
  const sides: (Side | null)[] = target.exercise.isUnilateral && !row.isTest ? ['links', 'rechts'] : [null]
  const unitShort = target.unit === 'seconds' ? 's' : 'Wdh.'
  const title = row.isTest
    ? 'Einstufungstest'
    : showExerciseName
      ? target.exercise.nameDe
      : `Satz ${row.setNumber}`

  if (logs.length > 0) {
    const values = sides
      .map((side) => {
        const log = logs.find((entry) => entry.side === side)
        const value = log?.repsDone ?? log?.durationS ?? 0
        return side ? `${SIDE_LABELS[side].charAt(0)} ${formatNumber(value)}` : formatNumber(value)
      })
      .join(' / ')
    const rir = logs[0]?.rir
    return (
      <div className="set-row set-row-done">
        <div>
          <span className="set-title">✓ {title}</span>
          <span className="set-result">
            {values} {unitShort}
            {rir != null && ` · RIR ${rir === 4 ? '4+' : rir}`}
          </span>
        </div>
        <button type="button" className="button-quiet" onClick={onUndo}>
          Korrigieren
        </button>
      </div>
    )
  }

  if (!open) {
    return (
      <div className="set-row set-row-pending">
        <span className="set-title">{title}</span>
        <span className="set-result">{row.isTest ? 'maximale saubere Wdh.' : setTargetText(target)}</span>
      </div>
    )
  }

  return (
    <SetEditor
      key={row.key}
      title={title}
      hint={row.isTest ? 'Maximale saubere Wiederholungen' : setTargetText(target)}
      sides={sides}
      unit={target.unit}
      initialValue={row.isTest ? 0 : (target.repMax ?? 0)}
      rirRequired={row.rirRequired}
      onLog={onLog}
    />
  )
}

interface SetEditorProps {
  title: string
  hint: string
  sides: (Side | null)[]
  unit: 'reps' | 'seconds'
  initialValue: number
  rirRequired: boolean
  onLog: (entries: SetEntry[], rir: number | null) => void
}

function SetEditor({ title, hint, sides, unit, initialValue, rirRequired, onLog }: SetEditorProps) {
  const [values, setValues] = useState<number[]>(() => sides.map(() => initialValue))
  const [rir, setRir] = useState<number | null>(null)
  const unitLabel = unit === 'seconds' ? 'Sekunden' : 'Wiederholungen'

  return (
    <div className="set-row set-row-open">
      <div className="set-open-head">
        <span className="set-title">{title}</span>
        <span className="set-result">Ziel: {hint}</span>
      </div>
      {sides.map((side, index) => (
        <Stepper
          key={side ?? 'both'}
          label={side ? `${SIDE_LABELS[side]}: ${unitLabel}` : unitLabel}
          value={values[index] ?? 0}
          step={unit === 'seconds' ? 5 : 1}
          onChange={(value) => setValues((current) => current.map((old, i) => (i === index ? value : old)))}
        />
      ))}
      {rirRequired && (
        <fieldset className="rir">
          <legend>Wie viele Wiederholungen wären noch gegangen? (RIR)</legend>
          <div className="chips">
            {RIR_CHOICES.map((choice) => (
              <button
                key={choice}
                type="button"
                className={rir === choice ? 'chip chip-selected' : 'chip'}
                aria-pressed={rir === choice}
                onClick={() => setRir(choice)}
              >
                {choice === 4 ? '4+' : choice}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <button
        type="button"
        className="button-primary"
        disabled={rirRequired && rir === null}
        onClick={() =>
          onLog(
            sides.map((side, index) => ({ side, value: values[index] ?? 0 })),
            rirRequired ? rir : null,
          )
        }
      >
        {rirRequired && rir === null ? 'Erst RIR wählen' : 'Satz abhaken'}
      </button>
    </div>
  )
}
