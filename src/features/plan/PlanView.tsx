import { useEffect, useState } from 'react'
import { db } from '../../db/database'
import type { ScheduledSession, SessionStatus } from '../../db/types'
import { addDays, toIsoDate, weekdayIndex, weekStartOf } from '../../domain/dates'
import type { DayType, IsoDate } from '../../domain/types'
import { formatDayMonth, weekdayShort } from '../../shared/format'
import { useLiveQuery } from '../../shared/useLiveQuery'
import { Stepper } from '../workout/Stepper'
import { TEMPLATE_NAMES } from '../workout/texts'
import { startScheduledSession } from '../workout/workoutStore'
import {
  closePastWeeks,
  getWeek,
  logBikeSession,
  saveWeekPlan,
  setSessionDropped,
  suggestedDayTypes,
} from './planStore'

const DAY_TYPE_LABELS: Record<DayType, string> = {
  homeoffice: 'Homeoffice',
  buero: 'Büro',
  reise: 'Reise',
  wochenende: 'Frei',
}
const DAY_TYPES = Object.keys(DAY_TYPE_LABELS) as DayType[]

const STATUS_LABELS: Record<SessionStatus, string> = {
  geplant: 'geplant',
  erledigt: 'erledigt',
  ersetzt: 'ersetzt',
  ausgefallen: 'ausgefallen',
}

export function PlanView() {
  const today = toIsoDate(new Date())
  const thisWeek = weekStartOf(today)
  const [weekOffset, setWeekOffset] = useState(0)
  const weekStart = addDays(thisWeek, weekOffset * 7)

  useEffect(() => {
    void closePastWeeks(db, thisWeek)
  }, [thisWeek])

  const week = useLiveQuery(() => getWeek(db, weekStart), [weekStart])
  const [editing, setEditing] = useState(false)
  if (week === undefined) return null
  const planned = week?.plan.dayTypes !== undefined

  return (
    <main className="screen screen-with-nav">
      <header className="screen-head">
        <h1>Wochenplan</h1>
        <p>
          {formatDayMonth(weekStart)} bis {formatDayMonth(addDays(weekStart, 6))}
        </p>
      </header>

      <div className="segmented" role="group" aria-label="Woche">
        {['Diese Woche', 'Nächste Woche'].map((label, offset) => (
          <button
            key={label}
            type="button"
            className={weekOffset === offset ? 'chip chip-selected' : 'chip'}
            aria-pressed={weekOffset === offset}
            onClick={() => {
              setWeekOffset(offset)
              setEditing(false)
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {!planned || editing ? (
        <DayTypeForm
          key={weekStart}
          weekStart={weekStart}
          canCancel={planned}
          onDone={() => setEditing(false)}
        />
      ) : (
        <>
          {week.sessions.length === 0 && (
            <p className="exercise-note">In dieser Woche ist nichts geplant.</p>
          )}
          {week.sessions.map((session) => (
            <SessionCard key={session.id} session={session} today={today} />
          ))}
          <button type="button" className="button-quiet" onClick={() => setEditing(true)}>
            Tagtypen ändern
          </button>
        </>
      )}
    </main>
  )
}

function DayTypeForm({
  weekStart,
  canCancel,
  onDone,
}: {
  weekStart: IsoDate
  canCancel: boolean
  onDone: () => void
}) {
  const suggestion = useLiveQuery(() => suggestedDayTypes(db, weekStart), [weekStart])
  const [edited, setEdited] = useState<DayType[] | null>(null)
  const dayTypes = edited ?? suggestion
  if (!dayTypes) return null

  return (
    <section className="card">
      <h2>Wie sieht die Woche aus?</h2>
      <p className="exercise-note">
        Kraft liegt auf Montag, Mittwoch und Freitag: Homeoffice ergibt die Langversion, Büro den Kurzzirkel, Reise
        den Reisezirkel.
      </p>
      {dayTypes.map((dayType, index) => (
        <div className="day-row" key={index}>
          <span className="day-name">{weekdayShort(index)}</span>
          <div className="day-options">
            {DAY_TYPES.map((option) => (
              <button
                key={option}
                type="button"
                className={dayType === option ? 'chip chip-selected' : 'chip'}
                aria-pressed={dayType === option}
                aria-label={`${weekdayShort(index)}: ${DAY_TYPE_LABELS[option]}`}
                onClick={() => setEdited(dayTypes.map((old, i) => (i === index ? option : old)))}
              >
                {DAY_TYPE_LABELS[option]}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button
        type="button"
        className="button-primary"
        onClick={() => void saveWeekPlan(db, weekStart, dayTypes).then(onDone)}
      >
        Woche planen
      </button>
      {canCancel && (
        <button type="button" className="button-quiet" onClick={onDone}>
          Abbrechen
        </button>
      )}
    </section>
  )
}

function SessionCard({ session, today }: { session: ScheduledSession; today: IsoDate }) {
  const [bikeFormOpen, setBikeFormOpen] = useState(false)
  const isToday = session.date === today
  const isBike = session.templateId === 'bike_z2'
  const id = session.id!

  return (
    <section className={session.status === 'geplant' ? 'card' : 'card card-done'}>
      <div className="session-head">
        <div>
          <p className="session-day">
            {weekdayShort(weekdayIndex(session.date))} {formatDayMonth(session.date)}
            {isToday && <span className="badge">Heute</span>}
          </p>
          <h2>{TEMPLATE_NAMES[session.templateId]}</h2>
        </div>
        <span className={`status status-${session.status}`}>{STATUS_LABELS[session.status]}</span>
      </div>

      {session.status === 'geplant' && !bikeFormOpen && (
        <>
          <button
            type="button"
            className={isToday ? 'button-primary' : 'button-secondary'}
            onClick={() => (isBike ? setBikeFormOpen(true) : void startScheduledSession(db, id, new Date()))}
          >
            {isBike ? 'Einheit eintragen' : 'Starten'}
          </button>
          <button type="button" className="button-quiet" onClick={() => void setSessionDropped(db, id, true)}>
            Fällt aus
          </button>
        </>
      )}
      {session.status === 'geplant' && bikeFormOpen && (
        <BikeForm sessionId={id} date={today} onClose={() => setBikeFormOpen(false)} />
      )}
      {session.status === 'ausgefallen' && (
        <button type="button" className="button-quiet" onClick={() => void setSessionDropped(db, id, false)}>
          Wieder einplanen
        </button>
      )}
    </section>
  )
}

function BikeForm({ sessionId, date, onClose }: { sessionId: number; date: IsoDate; onClose: () => void }) {
  const [durationMin, setDurationMin] = useState(45)
  const [power, setPower] = useState('')
  const parsedPower = Number.parseInt(power, 10)
  const avgPowerW = Number.isFinite(parsedPower) && parsedPower > 0 ? parsedPower : null

  return (
    <div className="set-row set-row-open">
      <Stepper label="Dauer in Minuten" value={durationMin} step={5} min={5} max={300} onChange={setDurationMin} />
      <label className="field">
        <span>Durchschnittsleistung in Watt (optional)</span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={power}
          onChange={(event) => setPower(event.target.value.replace(/\D/g, ''))}
        />
      </label>
      <button
        type="button"
        className="button-primary"
        onClick={() => void logBikeSession(db, { sessionId, date, durationMin, avgPowerW })}
      >
        Speichern
      </button>
      <button type="button" className="button-quiet" onClick={onClose}>
        Abbrechen
      </button>
    </div>
  )
}
