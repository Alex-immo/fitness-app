import { useState } from 'react'
import { db } from '../../db/database'
import type { User } from '../../db/types'
import { toIsoDate } from '../../domain/dates'
import type { Sex } from '../../domain/types'
import { formatKcal, parseDecimal } from '../../shared/format'
import { PROFILE_LIMITS } from '../body/bodyStore'
import { updateProfile } from './settingsStore'

const SEX_LABELS: Record<Sex, string> = { male: 'männlich', female: 'weiblich' }

export function ProfileSection({ user }: { user: User }) {
  const [height, setHeight] = useState(String(user.heightCm))
  const [birthYear, setBirthYear] = useState(String(user.birthYear))
  const [sex, setSex] = useState<Sex>(user.sex)
  const [message, setMessage] = useState<string | null>(null)

  const heightCm = parseDecimal(height)
  const year = parseDecimal(birthYear)
  const changed = heightCm !== user.heightCm || year !== user.birthYear || sex !== user.sex

  const save = async () => {
    if (heightCm === null || year === null) return
    try {
      const { oldTarget, newTarget } = await updateProfile(db, { heightCm, birthYear: year, sex }, toIsoDate(new Date()))
      setMessage(
        oldTarget === newTarget
          ? 'Gespeichert. Das Kalorienziel bleibt gleich.'
          : `Gespeichert. Kalorienziel: ${formatKcal(oldTarget)} → ${formatKcal(newTarget)}.`,
      )
    } catch {
      setMessage(
        `Bitte prüfen: Größe ${PROFILE_LIMITS.heightCm.min}–${PROFILE_LIMITS.heightCm.max} cm, Geburtsjahr vierstellig.`,
      )
    }
  }

  return (
    <details className="card history">
      <summary>
        <span className="set-title">Profil</span>
        <span className="set-result">
          {user.heightCm} cm · Jahrgang {user.birthYear} · {SEX_LABELS[user.sex]}
        </span>
      </summary>
      <p className="exercise-note">Das Gewicht trägst du im Tab „Körper“ ein.</p>
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
      <div className="segmented" role="group" aria-label="Geschlecht">
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
      <button type="button" className="button-primary" disabled={!changed} onClick={() => void save()}>
        Profil speichern
      </button>
      {message && (
        <p className="exercise-note" role="status">
          {message}
        </p>
      )}
    </details>
  )
}
