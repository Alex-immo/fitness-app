import { db } from '../../db/database'
import type { Exercise, ProgressionEventRecord, ProgressionStateRecord } from '../../db/types'
import type { PullupLevel } from '../../domain/pullup'
import { formatDayMonth, formatKg, formatNumber, formatRange } from '../../shared/format'
import { useLiveQuery } from '../../shared/useLiveQuery'
import { eventText } from '../workout/texts'
import { exerciseHistory, type HistorySession, type HistorySet } from './historyModel'

const SESSIONS_SHOWN = 8
const EVENTS_SHOWN = 5

const PULLUP_LEVEL_NAMES: Record<PullupLevel, string> = {
  negatives: 'Negativ-Wiederholungen',
  max_reps: 'so viele saubere Wdh. wie möglich',
  rep_range: '5–10 Wdh.',
  weighted: '5–10 Wdh. mit Zusatzlast',
}

const STAGE_NAMES = ['', 'Last steigern', 'Wiederholungen steigern', 'Tempo', 'Zusatzsatz', 'Variante']

function stateText(exercise: Exercise, state: ProgressionStateRecord | undefined): string {
  if (exercise.loadType === 'zeit') return 'wird nur protokolliert'
  if (!state) return 'noch nicht trainiert'
  if (state.pullupLevel) return `Schema: ${PULLUP_LEVEL_NAMES[state.pullupLevel]}`
  const parts = [
    `Stufe ${state.currentStage} (${STAGE_NAMES[state.currentStage]})`,
    state.currentLoadKg === null ? null : formatKg(state.currentLoadKg),
    `${formatRange(state.currentRepMin, state.currentRepMax)} Wdh.`,
  ]
  return parts.filter(Boolean).join(' · ')
}

function setText(set: HistorySet): string {
  const value = set.both !== null ? formatNumber(set.both) : `${set.left ?? '–'}/${set.right ?? '–'}`
  return set.rir === null ? value : `${value} (RIR ${set.rir === 4 ? '4+' : set.rir})`
}

export function HistoryView() {
  const data = useLiveQuery(async () => {
    const [exercises, states, setLogs, sessionLogs, events] = await Promise.all([
      db.exercises.toArray(),
      db.progressionStates.toArray(),
      db.setLogs.toArray(),
      db.sessionLogs.toArray(),
      db.progressionEvents.orderBy('date').reverse().toArray(),
    ])
    return { exercises, states, setLogs, sessionLogs, events }
  }, [])
  if (!data) return null

  const rows = data.exercises
    .map((exercise) => ({
      exercise,
      state: data.states.find((state) => state.exerciseId === exercise.id),
      sessions: exerciseHistory(exercise.id, data.setLogs, data.sessionLogs),
      events: data.events.filter((event) => event.exerciseId === exercise.id),
    }))
    .sort((a, b) => Number(b.sessions.length > 0) - Number(a.sessions.length > 0))

  return (
    <main className="screen screen-with-nav">
      <header className="screen-head">
        <h1>Verlauf</h1>
        <p>Stand und letzte Einheiten je Übung</p>
      </header>
      {rows.map(({ exercise, state, sessions, events }) => (
        <details className="card history" key={exercise.id}>
          <summary>
            <span className="set-title">{exercise.nameDe}</span>
            <span className="set-result">{stateText(exercise, state)}</span>
          </summary>
          <SessionList sessions={sessions} unit={exercise.loadType === 'zeit' ? 's' : 'Wdh.'} />
          <EventList events={events} />
        </details>
      ))}
    </main>
  )
}

function SessionList({ sessions, unit }: { sessions: HistorySession[]; unit: string }) {
  if (sessions.length === 0) return <p className="exercise-note">Noch keine erledigte Einheit.</p>
  return (
    <ul className="history-list">
      {sessions.slice(0, SESSIONS_SHOWN).map((session) => (
        <li key={session.sessionLogId}>
          <span className="history-date">
            {formatDayMonth(session.date)}
            {session.loadKg !== null && ` · ${formatKg(session.loadKg)}`}
          </span>
          <span>
            {session.sets.map(setText).join(' · ')} {unit}
          </span>
        </li>
      ))}
    </ul>
  )
}

function EventList({ events }: { events: ProgressionEventRecord[] }) {
  if (events.length === 0) return null
  return (
    <>
      <h3>Änderungen</h3>
      <ul className="history-list">
        {events.slice(0, EVENTS_SHOWN).map((event) => (
          <li key={event.id}>
            <span className="history-date">{formatDayMonth(event.date)}</span>
            <span>{eventText(event)}</span>
          </li>
        ))}
      </ul>
    </>
  )
}
