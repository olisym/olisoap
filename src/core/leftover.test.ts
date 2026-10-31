import { describe, expect, it } from 'vitest'
import { REFERENCE_2000G } from './fixtures'
import type { Inventory, Product } from './inventory'
import { fatsAtRisk, soapLeftovers, type BatchLike } from './leftover'

const today = '2026-10-31'

const batch = (patch: Partial<BatchLike>): BatchLike => ({
  id: 'b',
  number: '2026-01',
  date: '2026-08-01',
  cureWeeks: 5,
  bars: 10,
  outflows: [],
  deductions: [],
  recipe: { name: 'Körperseife', input: REFERENCE_2000G },
  ...patch,
})

describe('Übrig: Seife', () => {
  it('nur Chargen mit Reststück; zuerst, was zuerst verbraucht werden sollte', () => {
    const list = soapLeftovers(
      [
        batch({ id: 'leer', outflows: [{ count: 10 }] }),
        batch({ id: 'spaet', bestUse: '2028-01-01' }),
        batch({ id: 'frueh', bestUse: '2027-03-01', outflows: [{ count: 4 }] }),
        batch({ id: 'reift', date: '2026-10-20', bestUse: '2028-01-01' }),
      ],
      today,
    )
    expect(list.map((s) => s.batchId)).toEqual(['frueh', 'spaet', 'reift'])
    expect(list[0]).toMatchObject({ left: 6, ready: true })
    expect(list.find((s) => s.batchId === 'reift')).toMatchObject({ ready: false, readyDate: '2026-11-24' })
  })

  it('fertige vor reifender, auch wenn die reifende früher abläuft', () => {
    const list = soapLeftovers([batch({ id: 'reift', date: '2026-10-20', bestUse: '2026-11-01' }), batch({ id: 'fertig', bestUse: '2027-06-01' })], today)
    expect(list.map((s) => s.batchId)).toEqual(['fertig', 'reift'])
  })

  it('ohne Etikett: Vorschlag aus dem frühesten MHD der verbrauchten Fette', () => {
    const [s] = soapLeftovers([batch({ deductions: [{ lotId: 'l', key: 'fat:shea', grams: 100, bestBefore: '2027-02-01' }] })], today)
    expect(s.bestUse).toBe('2027-02-01')
  })
})

describe('Übrig: Fette', () => {
  const shea: Product = { id: 'p1', name: 'Shea 1 kg', category: 'fat', fatId: 'shea', unit: 'g', packageSize: 1000 }
  const hemp: Product = { id: 'p2', name: 'Hanföl', category: 'fat', fatId: 'hemp', unit: 'g', packageSize: 500 }
  const naoh: Product = { id: 'p3', name: 'NaOH', category: 'lye', lyeType: 'NaOH', unit: 'g', packageSize: 1000 }
  const recipes = [
    { id: 'r1', name: 'Körperseife', needs: [{ key: 'fat:shea' as const, name: 'Sheabutter', grams: 300 }] },
    { id: 'r2', name: 'Rasierseife', needs: [{ key: 'fat:shea' as const, name: 'Sheabutter', grams: 80 }] },
  ]

  it('MHD in Reichweite oder abgelaufen; Lauge zählt nicht; Rezepte, die es aufbrauchen', () => {
    const inv: Inventory = {
      products: [shea, hemp, naoh],
      purchases: [],
      lots: [
        { id: 'a', productId: 'p1', gramsInitial: 1000, gramsLeft: 700, bestBefore: '2026-12-15' },
        { id: 'b', productId: 'p1', gramsInitial: 1000, gramsLeft: 1000, bestBefore: '2028-01-01' },
        { id: 'c', productId: 'p3', gramsInitial: 1000, gramsLeft: 500, bestBefore: '2026-11-01' },
        { id: 'd', productId: 'p2', gramsInitial: 500, gramsLeft: 0, bestBefore: '2026-11-01' },
      ],
    }
    const list = fatsAtRisk(inv, recipes, today)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ key: 'fat:shea', grams: 700, until: '2026-12-15', reason: 'bestBefore', possibleBatches: 1 })
    expect(list[0].uses).toEqual([
      { recipeId: 'r1', name: 'Körperseife', gramsPerBatch: 300, batches: 3 },
      { recipeId: 'r2', name: 'Rasierseife', gramsPerBatch: 80, batches: 9 },
    ])
  })

  it('angebrochen: Ende aus Anbruch plus Haltbarkeit, auch vor dem MHD', () => {
    const inv: Inventory = {
      products: [hemp],
      purchases: [],
      // Hanföl: viel Linolensäure, hält offen ca. 6 Monate (Faustregel)
      lots: [{ id: 'a', productId: 'p2', gramsInitial: 500, gramsLeft: 200, bestBefore: '2027-12-01', openedAt: '2026-06-01' }],
    }
    const [f] = fatsAtRisk(inv, [], today)
    expect(f.reason).toBe('opened')
    expect(f.until < '2026-12-15').toBe(true)
    expect(f.uses).toEqual([])
  })

  it('wie viele Sude bis zum Ablauf realistisch sind (ein Sud alle zwei Monate)', () => {
    const inv = (bestBefore: string): Inventory => ({ products: [shea], purchases: [], lots: [{ id: 'a', productId: 'p1', gramsInitial: 1000, gramsLeft: 900, bestBefore }] })
    expect(fatsAtRisk(inv('2026-10-01'), recipes, today)[0].possibleBatches).toBe(0)
    expect(fatsAtRisk(inv('2026-11-20'), recipes, today)[0].possibleBatches).toBe(1)
    expect(fatsAtRisk(inv('2027-01-20'), recipes, today)[0].possibleBatches).toBe(2)
  })
})
