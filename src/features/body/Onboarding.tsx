import { useState } from 'react'
import { db } from '../../db/database'
import { toIsoDate } from '../../domain/dates'
import type { Sex } from '../../domain/types'
import { parseDecimal } from '../../shared/format'
import { createProfile, PROFILE_LIMITS, profileIsValid } from './bodyStore'

const SEX_LABELS: Record<Sex, string> = { male: 'männlich', female: 'weiblich' }

/** First start: asks for the profile values the calorie formula needs. */
export function Onboarding() {
  const [height, setHeight] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [weight, setWeight] = useState('')
  const [sex, setSex] = useState<Sex | null>(null)
  const [saving, setSaving] = useState(false)

  const today = toIsoDate(new Date())
  const values = {
    heightCm: parseDecimal(height),
    birthYear: parseDecimal(birthYear),
    weightKg: parseDecimal(weight),
  }
  const complete =
    sex !== null && values.heightCm !== null && values.birthYear !== null && values.weightKg !== null
      ? { heightCm: values.heightCm, birthYear: values.birthYear, weightKg: values.weightKg, sex }
      : null
  const valid = complete !== null && profileIsValid(complete, Number(today.slice(0, 4)))
  const anyInput = height !== '' && birthYear !== '' && weight !== '' && sex !== null

  return (
    <main className="screen">
      <header className="screen-head">
        <h1>Willkommen</h1>
        <p>Aus diesen Angaben berechnet die App dein Kalorienziel und dein Protein-Minimum.</p>
      </header>
      <section className="card">
        <label className="field">
          <span>Größe in cm</span>
          <input type="text" inputMode="numeric" maxLength={3} value={height} onChange={(e) => setHeight(e.target.value)} />
        </label>
        <label className="field">
          <span>Geburtsjahr</span>
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Aktuelles Gewicht in kg</span>
          <input type="text" inputMode="decimal" maxLength={5} value={weight} onChange={(e) => setWeight(e.target.value)} />
        </label>
        <fieldset className="rir">
          <legend>Geschlecht (für die Formel des Grundumsatzes)</legend>
          <div className="segmented">
            {(Object.keys(SEX_LABELS) as Sex[]).map((option) => (
              <button
                key={option}
                type="button"
                className={sex === option ? 'chip chip-selected' : 'chip'}
                aria-pressed={sex === option}
                onClick={() => setSex(option)}
              >
                {SEX_LABELS[option]}
              </button>
            ))}
          </div>
        </fieldset>
        {anyInput && !valid && (
          <p className="exercise-note" role="alert">
            Bitte prüfen: Größe {PROFILE_LIMITS.heightCm.min}–{PROFILE_LIMITS.heightCm.max} cm, Gewicht{' '}
            {PROFILE_LIMITS.weightKg.min}–{PROFILE_LIMITS.weightKg.max} kg, Geburtsjahr vierstellig.
          </p>
        )}
        <button
          type="button"
          className="button-primary"
          disabled={!valid || saving}
          onClick={() => {
            if (!complete) return
            setSaving(true)
            void createProfile(db, complete, today).catch(() => setSaving(false))
          }}
        >
          Los geht’s
        </button>
      </section>
      <p className="exercise-note">Die Angaben bleiben auf diesem Gerät. Die App sendet nichts ins Netz.</p>
    </main>
  )
}
