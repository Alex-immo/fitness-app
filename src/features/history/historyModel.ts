import type { SessionLog, SetLog } from '../../db/types'
import type { IsoDate } from '../../domain/types'

// History of one exercise: what was done in each completed session.

export interface HistorySet {
  setNumber: number
  /** Repetitions or seconds; null where a side was not logged. */
  left: number | null
  right: number | null
  /** Value of exercises done with both sides at once. */
  both: number | null
  rir: number | null
}

export interface HistorySession {
  sessionLogId: number
  date: IsoDate
  loadKg: number | null
  sets: HistorySet[]
}

/** Completed sessions with this exercise, newest first. The pull-up placement test (set 0) is left out. */
export function exerciseHistory(exerciseId: string, setLogs: SetLog[], sessionLogs: SessionLog[]): HistorySession[] {
  const finished = new Map(
    sessionLogs.filter((log) => log.finishedAt !== null && log.id !== undefined).map((log) => [log.id!, log]),
  )
  const bySession = new Map<number, SetLog[]>()
  for (const log of setLogs) {
    if (log.exerciseId !== exerciseId || log.setNumber < 1 || !finished.has(log.sessionLogId)) continue
    bySession.set(log.sessionLogId, [...(bySession.get(log.sessionLogId) ?? []), log])
  }

  return [...bySession.entries()]
    .map(([sessionLogId, logs]) => {
      const sets = new Map<number, HistorySet>()
      for (const log of logs) {
        const set = sets.get(log.setNumber) ?? { setNumber: log.setNumber, left: null, right: null, both: null, rir: null }
        const value = log.repsDone ?? log.durationS
        if (log.side === 'links') set.left = value
        else if (log.side === 'rechts') set.right = value
        else set.both = value
        if (log.rir !== null) set.rir = set.rir === null ? log.rir : Math.min(set.rir, log.rir)
        sets.set(log.setNumber, set)
      }
      return {
        sessionLogId,
        date: finished.get(sessionLogId)!.startedAt.slice(0, 10),
        loadKg: logs[0]?.loadKg ?? null,
        sets: [...sets.values()].sort((a, b) => a.setNumber - b.setNumber),
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.sessionLogId - a.sessionLogId)
}
