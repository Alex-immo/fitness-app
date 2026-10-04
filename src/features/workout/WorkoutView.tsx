import { useMemo, useState } from 'react'
import { db } from '../../db/database'
import type { ProgressionEventRecord, SetLog } from '../../db/types'
import { formatKg, formatPlatesPerSide } from '../../shared/format'
import { useLiveQuery } from '../../shared/useLiveQuery'
import { RestTimer } from './RestTimer'
import { SetRow } from './SetRow'
import { pullupHint, setTargetText, TEMPLATE_NAMES, TEMPO_HINT } from './texts'
import { useWakeLock } from './useWakeLock'
import { buildWorkoutPlan, isRowDone, openRowKey, type ExerciseTarget, type PlanGroup } from './workoutModel'
import {
  clearRest,
  discardWorkout,
  finishWorkout,
  logSet,
  setExerciseLoad,
  undoSet,
  type SetEntry,
} from './workoutStore'

const EFFORT_CHOICES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

interface WorkoutViewProps {
  sessionLogId: number
  onFinished: (events: ProgressionEventRecord[]) => void
  /** Leaves the view without ending the workout. */
  onBack: () => void
}

export function WorkoutView({ sessionLogId, onFinished, onBack }: WorkoutViewProps) {
  useWakeLock()

  const data = useLiveQuery(async () => {
    const sessionLog = await db.sessionLogs.get(sessionLogId)
    if (!sessionLog) return null
    const scheduled = await db.scheduledSessions.get(sessionLog.scheduledSessionId)
    const template = scheduled && (await db.workoutTemplates.get(scheduled.templateId))
    if (!template) return null
    const [items, exercises, states, setLogs, dumbbell] = await Promise.all([
      db.templateItems.where('templateId').equals(template.id).toArray(),
      db.exercises.toArray(),
      db.progressionStates.toArray(),
      db.setLogs.where('sessionLogId').equals(sessionLogId).toArray(),
      db.equipment.get('dumbbell'),
    ])
    return { sessionLog, template, items, exercises, states, setLogs, dumbbell }
  }, [sessionLogId])

  const plan = useMemo(
    () =>
      data &&
      buildWorkoutPlan({
        template: data.template,
        items: data.items,
        exercises: data.exercises,
        states: data.states,
        dumbbell: data.dumbbell,
        setLogs: data.setLogs,
        loadByExercise: data.sessionLog.draft?.loadByExercise ?? {},
      }),
    [data],
  )

  if (!data || !plan) return null
  const { sessionLog, template, setLogs } = data
  const draft = sessionLog.draft
  const doneRows = plan.groups.reduce(
    (sum, group) => sum + group.rows.filter((row) => isRowDone(row, setLogs)).length,
    0,
  )
  const loadTargets = [...plan.targets.values()].filter((target) => target.loadSteps)

  const handleLog = (target: ExerciseTarget, setNumber: number, restSeconds: number) => {
    return (entries: SetEntry[], rir: number | null) => {
      void logSet(db, {
        sessionLogId,
        exerciseId: target.exercise.id,
        setNumber,
        entries,
        unit: target.unit,
        loadKg: target.loadKg,
        rir,
        tempoApplied: target.tempo,
        restSeconds,
        now: new Date(),
      })
    }
  }

  return (
    <main className="screen workout">
      <header className="screen-head">
        <button type="button" className="button-small button-back" onClick={onBack}>
          ‹ Zurück
        </button>
        <h1>{TEMPLATE_NAMES[template.id]}</h1>
        <p>
          {doneRows} von {plan.totalRows} Sätzen erledigt
        </p>
      </header>

      {template.type === 'circuit' && loadTargets.length > 0 && (
        <section className="card">
          <h2>Lasten</h2>
          {loadTargets.map((target) => (
            <LoadPicker
              key={target.item.id}
              target={target}
              label={target.exercise.nameDe}
              setLogs={setLogs}
              sessionLogId={sessionLogId}
            />
          ))}
        </section>
      )}

      {plan.groups.map((group) => (
        <GroupCard
          key={group.key}
          group={group}
          targets={plan.targets}
          setLogs={setLogs}
          sessionLogId={sessionLogId}
          roundCount={plan.groups.length}
          onLog={handleLog}
        />
      ))}

      <FinishCard
        allDone={doneRows === plan.totalRows}
        onFinish={async (effort) => onFinished(await finishWorkout(db, sessionLogId, effort, new Date()))}
        onDiscard={() => void discardWorkout(db, sessionLogId)}
      />

      {draft?.restEndsAt != null && (
        <RestTimer
          endsAt={draft.restEndsAt}
          totalSeconds={draft.restSeconds}
          onSkip={() => void clearRest(db, sessionLogId)}
        />
      )}
    </main>
  )
}

interface GroupCardProps {
  group: PlanGroup
  targets: Map<string, ExerciseTarget>
  setLogs: SetLog[]
  sessionLogId: number
  roundCount: number
  onLog: (
    target: ExerciseTarget,
    setNumber: number,
    restSeconds: number,
  ) => (entries: SetEntry[], rir: number | null) => void
}

function GroupCard({ group, targets, setLogs, sessionLogId, roundCount, onLog }: GroupCardProps) {
  const openKey = openRowKey(group, setLogs)
  const groupTarget = group.itemId ? targets.get(group.itemId) : undefined

  return (
    <section className={openKey ? 'card' : 'card card-done'}>
      {groupTarget ? (
        <ExerciseHead target={groupTarget} setLogs={setLogs} sessionLogId={sessionLogId} />
      ) : (
        <h2>
          Runde {group.round} von {roundCount}
        </h2>
      )}
      {group.rows.map((row) => {
        const target = targets.get(row.itemId)
        if (!target) return null
        return (
          <SetRow
            key={row.key}
            row={row}
            target={target}
            logs={setLogs.filter((log) => log.exerciseId === row.exerciseId && log.setNumber === row.setNumber)}
            open={row.key === openKey}
            showExerciseName={group.kind === 'round'}
            onLog={onLog(target, row.setNumber, row.restSeconds)}
            onUndo={() => void undoSet(db, sessionLogId, row.exerciseId, row.setNumber)}
          />
        )
      })}
    </section>
  )
}

function ExerciseHead({
  target,
  setLogs,
  sessionLogId,
}: {
  target: ExerciseTarget
  setLogs: SetLog[]
  sessionLogId: number
}) {
  const { exercise, item } = target
  return (
    <div className="exercise-head">
      <h2>{exercise.nameDe}</h2>
      <p className="exercise-target">
        {target.sets} × {setTargetText(target)}
        {item.withoutLoad && ' · ohne Last'}
      </p>
      {item.note && !target.pullupLevel && <p className="exercise-note">{item.note}</p>}
      {target.pullupLevel && <p className="exercise-note">{pullupHint(target.pullupLevel)}</p>}
      {target.tempo && <p className="exercise-flag">{TEMPO_HINT}</p>}
      {target.variantText && <p className="exercise-flag">Variante: {target.variantText}</p>}
      {target.loadSteps && (
        <LoadPicker target={target} label="Last" setLogs={setLogs} sessionLogId={sessionLogId} />
      )}
    </div>
  )
}

/** The load is always one of the computed steps, shown with the plates per side. */
function LoadPicker({
  target,
  label,
  setLogs,
  sessionLogId,
}: {
  target: ExerciseTarget
  label: string
  setLogs: SetLog[]
  sessionLogId: number
}) {
  const steps = target.loadSteps ?? []
  const perUnit = target.exercise.dumbbellsUsed === 2 ? ' je Hantel' : ''
  const started = setLogs.some((log) => log.exerciseId === target.exercise.id)
  const current = steps.find((step) => step.loadKg === target.loadKg)
  const id = `load-${target.item.id}`

  return (
    <div className="load-picker">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={target.loadKg ?? ''}
        disabled={target.loadLocked || started}
        onChange={(event) => void setExerciseLoad(db, sessionLogId, target.exercise.id, Number(event.target.value))}
      >
        {steps.map((step) => (
          <option key={step.loadKg} value={step.loadKg}>
            {formatKg(step.loadKg)}
            {perUnit}
          </option>
        ))}
      </select>
      {current && <p className="load-plates">Pro Seite: {formatPlatesPerSide(current)}</p>}
    </div>
  )
}

function FinishCard({
  allDone,
  onFinish,
  onDiscard,
}: {
  allDone: boolean
  onFinish: (effort: number | null) => Promise<void>
  onDiscard: () => void
}) {
  const [effort, setEffort] = useState<number | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [saving, setSaving] = useState(false)

  return (
    <section className="card">
      <h2>Abschluss</h2>
      <fieldset className="rir">
        <legend>Wie anstrengend war die Einheit? (1 leicht – 10 maximal)</legend>
        <div className="chips">
          {EFFORT_CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              className={effort === choice ? 'chip chip-selected' : 'chip'}
              aria-pressed={effort === choice}
              onClick={() => setEffort(choice)}
            >
              {choice}
            </button>
          ))}
        </div>
      </fieldset>
      {!allDone && <p className="exercise-note">Noch nicht alle Sätze sind abgehakt. Offene Sätze zählen nicht.</p>}
      <button
        type="button"
        className="button-primary"
        disabled={saving}
        onClick={() => {
          setSaving(true)
          void onFinish(effort).catch(() => setSaving(false))
        }}
      >
        Workout beenden
      </button>
      {confirmDiscard ? (
        <div className="confirm">
          <p>Alle Sätze dieser Einheit werden gelöscht.</p>
          <button type="button" className="button-danger" onClick={onDiscard}>
            Wirklich verwerfen
          </button>
          <button type="button" className="button-quiet" onClick={() => setConfirmDiscard(false)}>
            Doch nicht
          </button>
        </div>
      ) : (
        <button type="button" className="button-quiet" onClick={() => setConfirmDiscard(true)}>
          Workout verwerfen
        </button>
      )}
    </section>
  )
}
