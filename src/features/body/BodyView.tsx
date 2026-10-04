import { useEffect, useState } from 'react'
import { db } from '../../db/database'
import { toIsoDate, weekStartOf } from '../../domain/dates'
import {
  MIN_WEIGH_INS_PER_WEEK,
  proteinRangeG,
  summarizeWeeks,
  TREND_MAX_PCT_PER_WEEK,
  TREND_MIN_PCT_PER_WEEK,
} from '../../domain/nutrition'
import { formatDayMonth, formatKcal, formatNumber, formatSignedPct, formatWeight } from '../../shared/format'
import { useLiveQuery } from '../../shared/useLiveQuery'
import { Stepper } from '../workout/Stepper'
import { addProtein, getUser, logWeight, PROFILE_LIMITS, runKcalEvaluation, type KcalEvaluationResult } from './bodyStore'

const WEEKS_SHOWN = 4
const PROTEIN_STEPS = [10, 25]

export function BodyView() {
  const today = toIsoDate(new Date())
  const [evaluation, setEvaluation] = useState<KcalEvaluationResult | null>(null)

  useEffect(() => {
    let cancelled = false
    void runKcalEvaluation(db, today).then((result) => {
      if (!cancelled) setEvaluation(result)
    })
    return () => {
      cancelled = true
    }
  }, [today])

  const data = useLiveQuery(async () => {
    const [user, weighIns, proteinToday, lastAdjustment] = await Promise.all([
      getUser(db),
      db.bodyWeightLogs.orderBy('date').toArray(),
      db.nutritionDayLogs.where('date').equals(today).first(),
      db.kcalAdjustments.orderBy('date').last(),
    ])
    return { user, weighIns, proteinG: proteinToday?.proteinG ?? 0, lastAdjustment }
  }, [today])

  if (!data?.user) return null
  const { user, weighIns, proteinG, lastAdjustment } = data
  const latest = weighIns.at(-1)
  const todayEntry = weighIns.find((entry) => entry.date === today)
  const weeks = summarizeWeeks(weighIns, weekStartOf(today), WEEKS_SHOWN)
  const protein = proteinRangeG(latest?.weightKg ?? 0)

  return (
    <main className="screen screen-with-nav">
      <header className="screen-head">
        <h1>Körper</h1>
        <p>Gewicht, Kalorienziel und Protein</p>
      </header>

      <WeightCard
        key={`${today}-${todayEntry?.weightKg ?? latest?.weightKg ?? 0}`}
        initialKg={todayEntry?.weightKg ?? latest?.weightKg ?? 0}
        savedToday={todayEntry !== undefined}
        onSave={(weightKg) => void logWeight(db, today, weightKg)}
      />

      <section className="card">
        <h2>Gewichtstrend</h2>
        <p className="exercise-note">
          Ziel: {formatNumber(TREND_MIN_PCT_PER_WEEK)}–{formatNumber(TREND_MAX_PCT_PER_WEEK)} % pro Woche
        </p>
        <table className="weeks">
          <thead>
            <tr>
              <th scope="col">Woche ab</th>
              <th scope="col">Mittel</th>
              <th scope="col">Messungen</th>
              <th scope="col">Trend</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week.weekStart}>
                <th scope="row">{formatDayMonth(week.weekStart)}</th>
                <td>{week.meanKg === null ? '–' : formatWeight(week.meanKg)}</td>
                <td>{week.count}</td>
                <td>{week.changePct === null ? '–' : formatSignedPct(week.changePct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>Kalorienziel</h2>
        <p className="big-number">{formatKcal(user.kcalTarget)}</p>
        <p className="exercise-note">Wird alle zwei Wochen am Gewichtstrend angepasst.</p>
        {evaluation?.kind === 'insufficient_data' && (
          <p className="exercise-flag">
            Auswertung offen: In einer der letzten beiden Wochen fehlen Messungen (mindestens {MIN_WEIGH_INS_PER_WEEK}{' '}
            pro Woche). Das Ziel bleibt vorerst.
          </p>
        )}
        {lastAdjustment && (
          <p className="exercise-note">
            Letzte Auswertung am {formatDayMonth(lastAdjustment.date)}: Trend{' '}
            {formatSignedPct(lastAdjustment.trendPctPerWeek)} pro Woche,{' '}
            {lastAdjustment.newTarget === lastAdjustment.oldTarget
              ? 'Ziel unverändert'
              : `Ziel ${formatKcal(lastAdjustment.oldTarget)} → ${formatKcal(lastAdjustment.newTarget)}`}
            .
          </p>
        )}
      </section>

      <section className="card">
        <h2>Protein heute</h2>
        <p className="big-number">{formatNumber(proteinG)} g</p>
        <progress max={protein.minG} value={Math.min(proteinG, protein.minG)} />
        <p className="exercise-note">
          Minimum {formatNumber(protein.minG)} g, Zielbereich bis {formatNumber(protein.maxG)} g
        </p>
        <div className="segmented-3">
          {PROTEIN_STEPS.map((step) => (
            <button key={step} type="button" className="chip" onClick={() => void addProtein(db, today, step)}>
              +{step} g
            </button>
          ))}
          <button type="button" className="chip" disabled={proteinG === 0} onClick={() => void addProtein(db, today, -10)}>
            −10 g
          </button>
        </div>
      </section>
    </main>
  )
}

function WeightCard({
  initialKg,
  savedToday,
  onSave,
}: {
  initialKg: number
  savedToday: boolean
  onSave: (weightKg: number) => void
}) {
  const [weightKg, setWeightKg] = useState(initialKg)
  const changed = weightKg !== initialKg

  return (
    <section className="card">
      <h2>Gewicht heute</h2>
      <Stepper
        label="Morgens, in kg"
        value={weightKg}
        step={0.1}
        min={PROFILE_LIMITS.weightKg.min}
        max={PROFILE_LIMITS.weightKg.max}
        format={(value) => formatWeight(value).replace(' kg', '')}
        onChange={setWeightKg}
      />
      <button
        type="button"
        className="button-primary"
        disabled={savedToday && !changed}
        onClick={() => onSave(weightKg)}
      >
        {savedToday && !changed ? 'Heute eingetragen ✓' : savedToday ? 'Korrigieren' : 'Eintragen'}
      </button>
    </section>
  )
}
