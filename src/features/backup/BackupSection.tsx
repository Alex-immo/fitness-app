import { useEffect, useState } from 'react'
import { db } from '../../db/database'
import { formatDayMonth } from '../../shared/format'
import { useLiveQuery } from '../../shared/useLiveQuery'
import { getUser } from '../body/bodyStore'
import {
  backupFileName,
  createBackup,
  markBackupDone,
  MAX_BACKUP_BYTES,
  parseBackup,
  restoreBackup,
  type ParseResult,
} from './backupStore'

type Pending = Extract<ParseResult, { ok: true }>

const formatDate = (date: string) => `${formatDayMonth(date)}${date.slice(0, 4)}`

export function BackupSection() {
  const user = useLiveQuery(async () => (await getUser(db)) ?? null, [])
  const [download, setDownload] = useState<{ url: string; name: string } | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Release the download link's memory when it is replaced or the view closes.
  useEffect(() => () => {
    if (download) URL.revokeObjectURL(download.url)
  }, [download])

  const exportBackup = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const now = new Date()
      const name = backupFileName(now)
      const json = JSON.stringify(await createBackup(db, now))
      const file = new File([json], name, { type: 'application/json' })
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Fitness-App Backup' })
          await markBackupDone(db, now)
          setMessage('Backup geteilt.')
          return
        } catch (error) {
          // Closing the share sheet is not an error; anything else falls back to the download link.
          if (error instanceof DOMException && error.name === 'AbortError') return
        }
      }
      setDownload({ url: URL.createObjectURL(file), name })
    } finally {
      setBusy(false)
    }
  }

  const chooseFile = async (file: File | undefined) => {
    setMessage(null)
    setPending(null)
    if (!file) return
    if (file.size > MAX_BACKUP_BYTES) {
      setMessage('Die Datei ist zu groß für ein Backup dieser App.')
      return
    }
    const result = parseBackup(await file.text())
    if (result.ok) setPending(result)
    else setMessage(`${result.reason} Es wurde nichts geändert.`)
  }

  const restore = async () => {
    if (!pending) return
    setBusy(true)
    try {
      await restoreBackup(db, pending.backup, new Date())
      setMessage('Backup eingespielt.')
    } catch {
      setMessage('Das Einspielen ist fehlgeschlagen. Es wurde nichts geändert.')
    } finally {
      setPending(null)
      setBusy(false)
    }
  }

  return (
    <section className="card">
      <h2>Backup</h2>
      <p className="exercise-note">
        Sichert alle Daten in eine Datei, zum Beispiel über „In Dateien sichern“ nach iCloud Drive.{' '}
        {user?.lastBackupOn ? `Letztes Backup: ${formatDate(user.lastBackupOn)}.` : 'Noch kein Backup.'}
      </p>
      <button type="button" className="button-primary" disabled={busy} onClick={() => void exportBackup()}>
        Backup erstellen
      </button>
      {download && (
        <a
          className="button-link"
          href={download.url}
          download={download.name}
          onClick={() => void markBackupDone(db, new Date())}
        >
          {download.name} herunterladen
        </a>
      )}

      {pending ? (
        <div className="confirm">
          <p>
            Backup vom {formatDate(pending.summary.exportedAt.slice(0, 10))}: {pending.summary.completedSessions}{' '}
            erledigte Einheiten, {pending.summary.sets} Sätze, {pending.summary.weighIns} Gewichtseinträge. Alle Daten
            auf diesem Gerät werden damit ersetzt.
          </p>
          <button type="button" className="button-danger" disabled={busy} onClick={() => void restore()}>
            Daten ersetzen
          </button>
          <button type="button" className="button-quiet" onClick={() => setPending(null)}>
            Abbrechen
          </button>
        </div>
      ) : (
        <label className="button-file">
          Backup einspielen
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              void chooseFile(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </label>
      )}
      {message && (
        <p className="exercise-note" role="status">
          {message}
        </p>
      )}
    </section>
  )
}
