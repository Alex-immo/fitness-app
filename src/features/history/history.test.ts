import { describe, expect, it } from 'vitest'
import type { SessionLog, SetLog } from '../../db/types'
import { exerciseHistory } from './historyModel'

const session = (id: number, day: string, finished = true): SessionLog => ({
  id,
  scheduledSessionId: id,
  startedAt: `${day}T06:30:00`,
  finishedAt: finished ? `${day}T07:20:00` : null,
  perceivedEffort: null,
})
const set = (sessionLogId: number, exerciseId: string, setNumber: number, overrides: Partial<SetLog> = {}): SetLog => ({
  sessionLogId,
  exerciseId,
  setNumber,
  side: null,
  loadKg: 8.3,
  repsDone: 12,
  durationS: null,
  rir: null,
  tempoApplied: false,
  ...overrides,
})

describe('exercise history', () => {
  const sessions = [session(1, '2030-01-07'), session(2, '2030-01-09'), session(3, '2030-01-11', false)]

  it('lists completed sessions newest first with load and reps per set', () => {
    const history = exerciseHistory(
      'floor_press',
      [
        set(1, 'floor_press', 2, { repsDone: 13 }),
        set(1, 'floor_press', 1, { repsDone: 14 }),
        set(2, 'floor_press', 1, { repsDone: 15, loadKg: 8.8, rir: 2 }),
        set(1, 'lateral_raise', 1),
      ],
      sessions,
    )
    expect(history.map((entry) => entry.date)).toEqual(['2030-01-09', '2030-01-07'])
    expect(history[0]).toMatchObject({ loadKg: 8.8, sets: [{ setNumber: 1, both: 15, rir: 2 }] })
    expect(history[1]?.sets.map((s) => s.both)).toEqual([14, 13])
  })

  it('leaves out the running workout', () => {
    expect(exerciseHistory('floor_press', [set(3, 'floor_press', 1)], sessions)).toEqual([])
  })

  it('shows both sides of a unilateral set with the lower RIR', () => {
    const history = exerciseHistory(
      'row_one_arm',
      [
        set(1, 'row_one_arm', 1, { side: 'links', repsDone: 15, rir: 3 }),
        set(1, 'row_one_arm', 1, { side: 'rechts', repsDone: 14, rir: 2 }),
      ],
      sessions,
    )
    expect(history[0]?.sets).toEqual([{ setNumber: 1, left: 15, right: 14, both: null, rir: 2 }])
  })

  it('shows seconds for time-based exercises and skips the pull-up test', () => {
    const plank = exerciseHistory('side_plank', [set(1, 'side_plank', 1, { repsDone: null, durationS: 40, loadKg: null })], sessions)
    expect(plank[0]).toMatchObject({ loadKg: null, sets: [{ both: 40 }] })
    const pullup = exerciseHistory('pullup', [set(1, 'pullup', 0, { repsDone: 3 }), set(1, 'pullup', 1, { repsDone: 2 })], sessions)
    expect(pullup[0]?.sets.map((s) => s.setNumber)).toEqual([1])
  })
})
