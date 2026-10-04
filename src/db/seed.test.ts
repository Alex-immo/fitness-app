import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { FitnessDatabase } from './database'
import { SEED_EQUIPMENT, SEED_EXERCISES, SEED_TEMPLATE_ITEMS, SEED_TEMPLATES } from './seed'
import { computeLoadSteps } from '../domain/loads'

const itemsOf = (templateId: string) => SEED_TEMPLATE_ITEMS.filter((item) => item.templateId === templateId)

describe('seed catalogue', () => {
  it('contains the 19 exercises, 5 templates and 5 pieces of equipment from the spec', () => {
    expect(SEED_EXERCISES).toHaveLength(19)
    expect(SEED_TEMPLATES.map((t) => t.id)).toEqual(['A_lang', 'B_lang', 'kurzzirkel', 'reisezirkel', 'bike_z2'])
    expect(SEED_EQUIPMENT).toHaveLength(5)
  })

  it('has unique ids', () => {
    for (const rows of [SEED_EXERCISES, SEED_TEMPLATES, SEED_TEMPLATE_ITEMS, SEED_EQUIPMENT]) {
      const ids = rows.map((row) => row.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('only references exercises, templates and equipment that exist', () => {
    const exerciseIds = new Set(SEED_EXERCISES.map((e) => e.id))
    const templateIds = new Set<string>(SEED_TEMPLATES.map((t) => t.id))
    const equipmentIds = new Set(SEED_EQUIPMENT.map((e) => e.id))
    for (const item of SEED_TEMPLATE_ITEMS) {
      expect(exerciseIds.has(item.exerciseId)).toBe(true)
      expect(templateIds.has(item.templateId)).toBe(true)
    }
    for (const exercise of SEED_EXERCISES) {
      for (const id of exercise.equipmentIds) expect(equipmentIds.has(id)).toBe(true)
    }
  })

  it('has nine exercises in each long version and four in each circuit, in order', () => {
    expect(itemsOf('A_lang')).toHaveLength(9)
    expect(itemsOf('B_lang')).toHaveLength(9)
    expect(itemsOf('kurzzirkel')).toHaveLength(4)
    expect(itemsOf('reisezirkel')).toHaveLength(4)
    expect(itemsOf('bike_z2')).toHaveLength(0)
    expect(itemsOf('A_lang').map((item) => item.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('counts only the long versions for progression', () => {
    const counting = SEED_TEMPLATES.filter((t) => t.countsForProgression).map((t) => t.id)
    expect(counting).toEqual(['A_lang', 'B_lang'])
  })

  it('doses the same exercise per template', () => {
    const rest = (templateId: string) => itemsOf(templateId).find((i) => i.exerciseId === 'row_one_arm')?.restSeconds
    expect(rest('A_lang')).toBe(45)
    expect(rest('B_lang')).toBe(60)
  })

  it('gives dumbbell exercises a dumbbell count and a start hint, others neither', () => {
    for (const exercise of SEED_EXERCISES) {
      const usesDumbbell = exercise.loadType === 'hantel'
      expect(exercise.dumbbellsUsed > 0).toBe(usesDumbbell)
      expect(exercise.startLoadHint !== null).toBe(usesDumbbell)
    }
  })

  it('needs no equipment in the travel circuit', () => {
    const byId = new Map(SEED_EXERCISES.map((e) => [e.id, e]))
    for (const item of itemsOf('reisezirkel')) {
      const usesDumbbell = byId.get(item.exerciseId)?.loadType === 'hantel'
      expect(item.withoutLoad).toBe(usesDumbbell)
    }
  })

  it('carries the plate set that yields the caps from the spec', () => {
    const dumbbell = SEED_EQUIPMENT.find((e) => e.id === 'dumbbell')!
    const setup = {
      barWeightKg: dumbbell.barWeightKg!,
      dumbbellCount: dumbbell.count,
      plates: dumbbell.plates,
      maxPlatesPerSide: dumbbell.maxPlatesPerSide!,
    }
    expect(computeLoadSteps(setup, 2).at(-1)?.loadKg).toBe(12.8)
    expect(computeLoadSteps(setup, 1).at(-1)?.loadKg).toBe(15.3)
  })

  it('contains no profile data', () => {
    expect(JSON.stringify([SEED_EXERCISES, SEED_TEMPLATES, SEED_TEMPLATE_ITEMS, SEED_EQUIPMENT])).not.toMatch(
      /birthYear|heightCm|"sex"|kcalTarget/,
    )
  })
})

describe('database', () => {
  it('seeds the catalogue on first open and leaves user tables empty', async () => {
    const database = new FitnessDatabase('fitness-app-test')
    await database.open()
    expect(await database.exercises.count()).toBe(19)
    expect(await database.workoutTemplates.count()).toBe(5)
    expect(await database.templateItems.count()).toBe(26)
    expect(await database.equipment.count()).toBe(5)
    expect(await database.users.count()).toBe(0)
    expect(await database.bodyWeightLogs.count()).toBe(0)
    expect(await database.templateItems.where('templateId').equals('B_lang').count()).toBe(9)
    database.close()
  })

  it('does not seed again on reopening', async () => {
    const database = new FitnessDatabase('fitness-app-test')
    await database.open()
    expect(await database.exercises.count()).toBe(19)
    await database.delete()
  })
})
