import { useEffect, useState } from 'react'
import { formatClock } from '../../shared/format'

interface RestTimerProps {
  /** Epoch milliseconds at which the rest ends. */
  endsAt: number
  totalSeconds: number
  onSkip: () => void
}

/** Countdown of the running rest. Based on the end time, so it stays correct after a reload. */
export function RestTimer({ endsAt, totalSeconds, onSkip }: RestTimerProps) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(interval)
  }, [])

  const remaining = (endsAt - now) / 1000
  const over = remaining <= 0
  return (
    <div className={over ? 'rest-timer rest-timer-over' : 'rest-timer'} role="timer">
      <div className="rest-timer-text">
        <span>{over ? 'Pause vorbei' : 'Pause'}</span>
        <strong>{formatClock(remaining)}</strong>
      </div>
      <progress max={totalSeconds} value={Math.max(0, Math.min(totalSeconds, remaining))} />
      <button type="button" onClick={onSkip}>
        {over ? 'Schließen' : 'Überspringen'}
      </button>
    </div>
  )
}
