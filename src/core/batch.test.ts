import { describe, expect, it } from 'vitest'
import { addDays, cureStatus, earliestFatBestBefore, nextBatchNumber, planConsumption } from './batch'
import type { Inventory } from './inventory'

const inv: Inventory = {
  products: [
    { id: 'shea', name: 'Shea', category: 'fat', fatId: 'shea', unit: 'g', packageSize: 1000 },
    { id: 'naoh', name: 'NaOH', category: 'lye', lyeType: 'NaOH', unit: 'g', packageSize: 1000 },
  ],
  purchases: [{ id: 'pu', productId: 'naoh', date: '2026-01-01', quantity: 1, unitPrice: 5 }],
  lots: [
    { id: 'new', productId: 'shea', gramsInitial: 1000, gramsLeft: 1000, pricePerKg: 20, bestBefore: '2028-01-01' },
    { id: 'old', productId: 'shea', gramsInitial: 1000, gramsLeft: 300, pricePerKg: 10, bestBefore: '2027-01-01' },
  ],
}

describe('planConsumption', () => {
  it('nimmt zuerst, was zuerst abläuft, und rechnet mit den Gebindepreisen', () => {
    const c = planConsumption(inv, [{ key: 'fat:shea', name: 'Shea', grams: 500 }])
    expect(c.deductions).toEqual([
      expect.objectContaining({ lotId: 'old', grams: 300 }),
      expect.objectContaining({ lotId: 'new', grams: 200 }),
    ])
    expect(c.cost).toBeCloseTo(0.3 * 10 + 0.2 * 20, 6)
    expect(c.shortages).toHaveLength(0)
    expect(earliestFatBestBefore(c.deductions)).toBe('2027-01-01')
  })

  it('meldet Fehlmengen und bepreist sie mit dem letzten Einkauf', () => {
    const c = planConsumption(inv, [{ key: 'lye:NaOH', name: 'NaOH', grams: 200 }])
    expect(c.shortages[0]).toMatchObject({ key: 'lye:NaOH', grams: 200 })
    expect(c.cost).toBeCloseTo(1, 6)
    expect(c.unpriced).toHaveLength(0)
  })

  it('kennzeichnet Zutaten ohne Preis', () => {
    const c = planConsumption(inv, [{ key: 'fat:olive', name: 'Olivenöl', grams: 100 }])
    expect(c.unpriced).toEqual(['Olivenöl'])
  })
})

describe('cureStatus', () => {
  it('erkennt, wenn das Gewicht stabil ist', () => {
    const s = cureStatus([
      { date: '2026-10-01', grams: 120 },
      { date: '2026-10-15', grams: 112 },
      { date: '2026-10-29', grams: 110 },
      { date: '2026-11-05', grams: 109.7 },
    ])
    expect(s.lossPercent).toBeCloseTo(8.58, 1)
    expect(s.weeklyLossPercent).toBeCloseTo(0.25, 2)
    expect(s.stable).toBe(true)
  })

  it('ist nicht stabil ohne Wochenvergleich', () => {
    expect(cureStatus([{ date: '2026-10-01', grams: 120 }, { date: '2026-10-03', grams: 118 }]).stable).toBe(false)
  })
})

describe('Hilfsfunktionen', () => {
  it('Datum und Chargennummer', () => {
    expect(addDays('2026-10-24', 35)).toBe('2026-11-28')
    expect(nextBatchNumber('2026-10-24', ['261024-1', '261020-3'])).toBe('261024-2')
  })
})
