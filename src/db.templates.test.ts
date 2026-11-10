import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { calculate } from './core/calc'
import { evaluate } from './core/evaluate'
import { PROFILES_BY_ID } from './data/profiles'
import { TEMPLATES } from './data/templates'

const all = TEMPLATES.flatMap((f) => [f.base, ...f.variants])
const byName = (name: string) => all.find((t) => t.name === name)!

describe('Vorlage „Körperseife Waschbecken“', () => {
  const sink = calculate(byName('Körperseife Waschbecken').input)
  const body = calculate(byName('Körperseife').input)

  it('besteht die Gegenprobe bei hartem Wasser ohne Befund', () => {
    expect(evaluate(sink, PROFILES_BY_ID['body-sensitive'], { waterHardness: 15 })).toEqual([])
  })

  it('ist gleich mild wie die Grundseife, hat aber mehr Palmitin- und Stearinsäure', () => {
    expect(sink.properties.cleansing).toBeCloseTo(body.properties.cleansing, 5)
    const firm = (r: typeof sink) => r.fattyAcids.palmitic + r.fattyAcids.stearic
    expect(firm(sink)).toBeGreaterThan(firm(body) + 3)
    expect(sink.fattyAcids.oleic).toBeLessThan(body.fattyAcids.oleic)
  })
})

describe('Migration v11: Variante „Körperseife Waschbecken“ nachreichen', () => {
  it('ergänzt sie bei vorhandener Grundseife, bearbeitete Rezepte bleiben, ohne Grundseife kommt nichts dazu', async () => {
    // Alter Stand: Version 10 mit bearbeiteter Körperseife, Haarseife gelöscht
    const old = new Dexie('olisoap')
    old.version(10).stores({
      recipes: 'id, name, updatedAt',
      products: 'id, name, category, sku',
      purchases: 'id, productId, date',
      lots: 'id, productId',
      batches: 'id, recipeId, date, number',
      orderItems: 'id, productId, status',
      settings: 'key',
      shops: 'name',
      customFats: 'id',
    })
    await old.open()
    await old.table('recipes').bulkAdd([
      { id: 'vorlage-koerperseife', name: 'Meine Körperseife', input: byName('Körperseife').input, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-10-20T10:00:00.000Z' },
      { id: 'vorlage-rasierseife', name: 'Rasierseife', input: byName('Rasierseife').input, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    ])
    old.close()

    const { db } = await import('./db')
    await db.open()
    const ids = (await db.recipes.toArray()).map((r) => r.id).sort()
    expect(ids).toEqual(['vorlage-koerperseife', 'vorlage-koerperseife-waschbecken', 'vorlage-rasierseife'])
    const sink = await db.recipes.get('vorlage-koerperseife-waschbecken')
    expect(sink?.baseId).toBe('vorlage-koerperseife')
    expect(sink?.barWeight).toBe(75)
    expect((await db.recipes.get('vorlage-koerperseife'))?.name).toBe('Meine Körperseife')
    db.close()
  })
})
