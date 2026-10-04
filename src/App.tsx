import { useEffect, useState } from 'react'
import { db } from './db/database'

interface CatalogCounts {
  exercises: number
  templates: number
  equipment: number
}

// Placeholder start screen. The real views follow from build step 4 onwards.
export function App() {
  const [counts, setCounts] = useState<CatalogCounts | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([db.exercises.count(), db.workoutTemplates.count(), db.equipment.count()])
      .then(([exercises, templates, equipment]) => {
        if (!cancelled) setCounts({ exercises, templates, equipment })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="start">
      <h1>Fitness-App</h1>
      <p>Das Grundgerüst steht. Die Trainingsansicht folgt im nächsten Schritt.</p>
      {failed && <p className="status">Die lokale Datenbank ließ sich nicht öffnen.</p>}
      {counts && (
        <p className="status">
          Lokale Datenbank bereit: {counts.exercises} Übungen, {counts.templates} Vorlagen,{' '}
          {counts.equipment} Geräte.
        </p>
      )}
    </main>
  )
}
