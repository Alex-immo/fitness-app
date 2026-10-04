import { useState } from 'react'
import { db } from '../../db/database'
import type { Equipment } from '../../db/types'
import { toIsoDate } from '../../domain/dates'
import { formatKg, formatNumber, parseDecimal } from '../../shared/format'
import { Stepper } from '../workout/Stepper'
import { capsOf, dumbbellIsValid, EQUIPMENT_LIMITS, saveDumbbell, type DumbbellInput } from './settingsStore'

interface PlateRow {
  key: number
  weight: string
  count: number
}

interface EquipmentSectionProps {
  dumbbell: Equipment
  /** Loads cannot change under a running workout. */
  workoutRunning: boolean
}

export function EquipmentSection({ dumbbell, workoutRunning }: EquipmentSectionProps) {
  const [bar, setBar] = useState(formatNumber(dumbbell.barWeightKg ?? 0))
  const [rows, setRows] = useState<PlateRow[]>(() =>
    dumbbell.plates.map((plate, key) => ({ key, weight: formatNumber(plate.weightKg), count: plate.count })),
  )
  const [maxPlates, setMaxPlates] = useState(dumbbell.maxPlatesPerSide ?? 1)
  const [message, setMessage] = useState<string | null>(null)

  const barWeightKg = parseDecimal(bar)
  const weights = rows.map((row) => parseDecimal(row.weight))
  const input: DumbbellInput | null =
    barWeightKg !== null && weights.every((weight) => weight !== null)
      ? {
          barWeightKg,
          plates: rows.map((row, index) => ({ weightKg: weights[index]!, count: row.count })),
          maxPlatesPerSide: maxPlates,
        }
      : null
  const valid = input !== null && dumbbellIsValid(input)
  const caps = valid ? capsOf({ ...dumbbell, ...input }) : null
  const savedCaps = capsOf(dumbbell)

  const updateRow = (key: number, patch: Partial<PlateRow>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))

  const save = async () => {
    if (!input) return
    try {
      const events = await saveDumbbell(db, input, toIsoDate(new Date()))
      setRows((current) => current.filter((row) => row.count > 0))
      setMessage(
        events.length === 0
          ? 'Gespeichert.'
          : `Gespeichert. ${events.length} ${events.length === 1 ? 'Übung wurde' : 'Übungen wurden'} an die neuen Lasten angepasst (siehe Verlauf).`,
      )
    } catch {
      setMessage('Speichern nicht möglich. Bitte die Werte prüfen.')
    }
  }

  return (
    <details className="card history">
      <summary>
        <span className="set-title">Kurzhanteln</span>
        <span className="set-result">
          {savedCaps
            ? `Deckel: ${formatKg(savedCaps.twoDumbbellsKg)} je Hantel, ${formatKg(savedCaps.oneDumbbellKg)} mit einer Hantel`
            : 'nicht eingerichtet'}
        </span>
      </summary>
      <label className="field">
        <span>Gewicht einer Stange in kg</span>
        <input type="text" inputMode="decimal" maxLength={5} value={bar} onChange={(e) => setBar(e.target.value)} />
      </label>

      <h3>Scheiben (Anzahl insgesamt)</h3>
      {rows.map((row) => (
        <div className="plate-row" key={row.key}>
          <label className="field">
            <span>Scheibe in kg</span>
            <input
              type="text"
              inputMode="decimal"
              maxLength={5}
              value={row.weight}
              onChange={(e) => updateRow(row.key, { weight: e.target.value })}
            />
          </label>
          <Stepper
            label="Anzahl"
            value={row.count}
            step={2}
            min={EQUIPMENT_LIMITS.plateCount.min}
            max={EQUIPMENT_LIMITS.plateCount.max}
            onChange={(count) => updateRow(row.key, { count })}
          />
        </div>
      ))}
      <button
        type="button"
        className="button-secondary"
        onClick={() =>
          setRows((current) => [...current, { key: Math.max(-1, ...current.map((row) => row.key)) + 1, weight: '', count: 4 }])
        }
      >
        Scheibe hinzufügen
      </button>
      <p className="exercise-note">Eine Scheibe mit Anzahl 0 wird beim Speichern entfernt.</p>

      <Stepper
        label="Höchstens Scheiben pro Seite"
        value={maxPlates}
        min={EQUIPMENT_LIMITS.maxPlatesPerSide.min}
        max={EQUIPMENT_LIMITS.maxPlatesPerSide.max}
        onChange={setMaxPlates}
      />

      {caps ? (
        <p className="exercise-flag">
          Ergibt als Deckel: {formatKg(caps.twoDumbbellsKg)} je Hantel, {formatKg(caps.oneDumbbellKg)} mit einer Hantel
        </p>
      ) : (
        <p className="exercise-note" role="alert">
          Bitte prüfen: Stange {formatNumber(EQUIPMENT_LIMITS.barWeightKg.min)}–{EQUIPMENT_LIMITS.barWeightKg.max} kg,
          Scheiben {formatNumber(EQUIPMENT_LIMITS.plateWeightKg.min)}–{EQUIPMENT_LIMITS.plateWeightKg.max} kg, jedes
          Gewicht nur einmal.
        </p>
      )}
      {workoutRunning && <p className="exercise-note">Während eines laufenden Workouts lässt sich das Equipment nicht ändern.</p>}
      <button type="button" className="button-primary" disabled={!valid || workoutRunning} onClick={() => void save()}>
        Equipment speichern
      </button>
      {message && (
        <p className="exercise-note" role="status">
          {message}
        </p>
      )}
    </details>
  )
}
