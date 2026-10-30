import { describe, expect, it } from 'vitest'
import { feasibility } from './batch'
import type { Inventory } from './inventory'
import { bestProduct, mergeNeeds, planShopping, productLine } from './shopping'

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
    expect(s.lines).toMatchObject([{ packages: 1, unitPrice: 16 }])
    expect(s.leftover).toBe(600)
  })

  it('Gesamtpreis: kombiniert Größen derselben Produktlinie, nur was gebraucht wird', () => {
    const kokos = (id: string, ml: number, price: number) => ({
      id,
      name: `Sala Kokosöl kaltgepresst bio ${ml} ml Glas`,
      category: 'fat' as const,
      fatId: 'coconut',
      unit: 'ml' as const,
      packageSize: ml,
      listPrice: price,
      listPriceDate: '2026-10-28',
    })
    const k: Inventory = {
      products: [
        kokos('k1000', 1000, 14.29),
        kokos('k250', 250, 4.49),
        kokos('k500', 500, 8.79),
        { ...kokos('mct', 250, 1), name: 'Sala MCT-Öl 250 ml' },
        // aus einer alten Bestellung, ohne aktuellen Shop-Preis
        { ...kokos('alt', 250, 0), listPrice: undefined, listPriceDate: undefined, name: 'Sala Kokosöl kaltgepresst bio 250 ml Dose' },
      ],
      purchases: [
        { id: 'p', productId: 'k1000', date: '2026-01-01', quantity: 1, unitPrice: 14.29 },
        { id: 'q', productId: 'alt', date: '2023-01-01', quantity: 1, unitPrice: 2 },
      ],
      lots: [],
    }
    const need = { key: 'fat:coconut' as const, name: 'Kokosöl', grams: 200 }
    // Bester kg-Preis: der gekaufte Liter (920 g)
    expect(planShopping(k, [need], 'perKg')[0].lines.map((l) => l.product.id)).toEqual(['k1000'])
    // Gesamtpreis: 250 ml (≈ 230 g) reichen; das MCT-Öl gehört nicht zur Produktlinie, der alte Einkaufspreis zählt nicht
    const [t] = planShopping(k, [need], 'total', '2026-10-29')
    expect(t.lines.map((l) => [l.product.id, l.packages])).toEqual([['k250', 1]])
    expect(t.total).toBe(4.49)
    // 700 g: 500 ml + 250 ml (13,28 €) ist billiger als 1 L (14,29 €)
    const [u] = planShopping(k, [{ ...need, grams: 650 }], 'total', '2026-10-29')
    expect(u.lines.map((l) => l.product.id).sort()).toEqual(['k250', 'k500'])
    expect(u.total).toBeCloseTo(13.28)
  })

  it('erkennt die Produktlinie unabhängig von Größe und Gebinde', () => {
    expect(productLine('Sala Kokosöl kaltgepresst bio 250 ml Glastiegel')).toBe('sala kokosöl kaltgepresst bio')
    expect(productLine('Sala Kokosöl kaltgepresst bio 1 L 1000 ml Glas')).toBe('sala kokosöl kaltgepresst bio')
    expect(productLine('Sala Rizinusöl kaltgepresst BIO 2,5 L 2500 ml Kanister')).toBe('sala rizinusöl kaltgepresst bio')
    expect(productLine('Rizinusöl kaltgepresst BIO 5 Liter')).toBe('rizinusöl kaltgepresst bio')
    expect(productLine('Babassuöl raffiniert 5 Kg')).toBe('babassuöl raffiniert')
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
