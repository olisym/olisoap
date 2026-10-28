import { describe, expect, it } from 'vitest'
import { feasibility } from './batch'
import type { Inventory } from './inventory'
import { bestProduct, mergeNeeds, planShopping } from './shopping'

const inv: Inventory = {
  products: [
    { id: 'big', name: 'Shea 1 kg', category: 'fat', fatId: 'shea', unit: 'g', packageSize: 1000 },
    { id: 'small', name: 'Shea 500 g', category: 'fat', fatId: 'shea', unit: 'g', packageSize: 500 },
    { id: 'old', name: 'Shea alt', category: 'fat', fatId: 'shea', unit: 'g', packageSize: 1000 },
  ],
  purchases: [
    { id: 'a', productId: 'big', date: '2026-01-01', quantity: 1, unitPrice: 16 },
    { id: 'b', productId: 'small', date: '2026-01-01', quantity: 1, unitPrice: 9 },
    { id: 'c', productId: 'old', date: '2020-01-01', quantity: 1, unitPrice: 5 },
  ],
  lots: [{ id: 'l', productId: 'big', gramsInitial: 1000, gramsLeft: 300 }],
}
const shea = { key: 'fat:shea' as const, name: 'Shea', grams: 700 }

describe('Einkauf', () => {
  it('wählt den günstigsten aktuellen Artikel, ignoriert alte Preise', () => {
    expect(bestProduct(inv, 'fat:shea', '2026-10-28')?.id).toBe('big')
  })

  it('berechnet Fehlmenge und Packungen', () => {
    const [s] = planShopping(inv, [shea])
    expect(s.shortfall).toBe(400)
    expect(s.packages).toBe(1)
    expect(s.unitPrice).toBe(16)
  })

  it('fasst Bedarfe zusammen und lässt Gedecktes weg', () => {
    expect(mergeNeeds([shea, shea])[0].grams).toBe(1400)
    expect(planShopping(inv, [{ ...shea, grams: 200 }])).toHaveLength(0)
  })

  it('Machbarkeit: Anzahl Ansätze und Engpass', () => {
    const f = feasibility(inv, [{ ...shea, grams: 100 }, { key: 'fat:olive', name: 'Olive', grams: 50 }])
    expect(f.count).toBe(0)
    expect(f.limiting?.name).toBe('Olive')
    expect(f.missing.map((m) => m.name)).toEqual(['Olive'])
    expect(feasibility(inv, [{ ...shea, grams: 100 }]).count).toBe(3)
  })
})
