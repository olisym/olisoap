import { describe, expect, it } from 'vitest'
import { KOERPERSEIFE_2 } from '../data/seedRecipes'
import { classify, importSalandia, parsePackage } from '../import/salandia'
import { calculate } from './calc'
import { barCount, recipeCost } from './cost'
import { materialPrice, materialStock, packageGrams, type Inventory, type Product } from './inventory'

const shea: Product = { id: 'p1', name: 'Shea 1 kg', category: 'fat', fatId: 'shea', unit: 'g', packageSize: 1000 }
const castor: Product = { id: 'p2', name: 'Rizinus 500 ml', category: 'fat', fatId: 'castor', unit: 'ml', packageSize: 500 }

describe('Packungen und Preise', () => {
  it('rechnet ml über die Dichte in g um', () => {
    expect(packageGrams(castor)).toBeCloseTo(480, 6) // 500 ml × 0,96
    expect(packageGrams({ ...castor, density: 1 })).toBe(500)
  })

  it('nimmt den Lagerpreis vor dem letzten Einkauf', () => {
    const inv: Inventory = {
      products: [shea],
      purchases: [
        { id: 'a', productId: 'p1', date: '2025-01-01', quantity: 1, unitPrice: 10 },
        { id: 'b', productId: 'p1', date: '2026-01-01', quantity: 1, unitPrice: 16 },
      ],
      lots: [],
    }
    expect(materialPrice(inv, 'fat:shea')).toMatchObject({ pricePerKg: 16, source: 'purchase' })
    inv.lots.push(
      { id: 'l1', productId: 'p1', gramsInitial: 1000, gramsLeft: 300, pricePerKg: 10 },
      { id: 'l2', productId: 'p1', gramsInitial: 1000, gramsLeft: 100, pricePerKg: 18 },
    )
    expect(materialPrice(inv, 'fat:shea')).toMatchObject({ pricePerKg: 12, source: 'stock' })
    expect(materialStock(inv, 'fat:shea')).toBe(400)
  })
})

describe('Rezeptkosten', () => {
  it('summiert bekannte Preise und meldet fehlende', () => {
    const r = calculate(KOERPERSEIFE_2.input)
    const c = recipeCost(r, (k) => (k === 'fat:shea' ? { pricePerKg: 16, source: 'purchase' } : undefined))
    expect(c.total).toBeCloseTo(0.7 * 16, 6)
    expect(c.missing).toContain('Babassuöl')
    expect(barCount(r.batchWeight, 100)).toBe(30)
  })
})

describe('Salandia-Import', () => {
  it('erkennt Packungsgrößen', () => {
    expect(parsePackage('Sala Kokosöl kaltgepresst bio 1 L 1000 ml Glas')).toEqual({ unit: 'ml', packageSize: 1000 })
    expect(parsePackage('Sala Neempulver 2,5 kg 2500 g Beutel')).toEqual({ unit: 'g', packageSize: 2500 })
    expect(parsePackage('Sala Natriumlaktat 60%ig E325 100 ml PET Flasche')).toEqual({ unit: 'ml', packageSize: 100 })
    expect(parsePackage('Sala Glasrührstab 20 cm Durchmesser 6 mm')).toEqual({ unit: 'Stk', packageSize: 1 })
  })

  it('ordnet Artikel zu', () => {
    expect(classify('Sala Rizinusöl kaltgepresst BIO 250 ml Glasflasche')).toMatchObject({ category: 'fat', fatId: 'castor' })
    expect(classify('Sala Mariendistelöl kaltgepresst BIO 500 ml')).toMatchObject({ fatId: 'milk-thistle' })
    expect(classify('Sala Distelöl Safloröl kaltgepresst bio 1 L')).toMatchObject({ fatId: 'safflower' })
    expect(classify('Sala Lemongrasöl ätherisches Öl naturrein 250 ml Glasflasche')).toMatchObject({ category: 'essentialOil' })
    expect(classify('Sala Xanthan Gum Pulver E415 konv. 500 g Beutel')).toMatchObject({ category: 'cosmetic' })
  })

  it('legt Artikel einmal an und importiert Einkäufe nicht doppelt', () => {
    const data = {
      orders: [
        { order_number: '1', order_date: '2026-01-01', items: [{ name: 'Sala Rizinusöl BIO 250 ml', sku: 'SAL-1', product_url: null, quantity: 1, unit_price_eur: 6 }] },
        { order_number: '2', order_date: '2026-02-01', items: [{ name: 'Sala Rizinusöl BIO 250 ml Glas', sku: 'SAL-1Auslistung', product_url: null, quantity: 2, unit_price_eur: 7 }] },
      ],
    }
    const first = importSalandia(data, [], [])
    expect(first.products).toHaveLength(1)
    expect(first.purchases).toHaveLength(2)
    const again = importSalandia(data, first.products, first.purchases)
    expect(again.products).toHaveLength(0)
    expect(again.purchases).toHaveLength(0)
  })
})

describe('Salandia-Kategorien', () => {
  it('hält Rohstoffe in Glasflaschen nicht für Verpackung', () => {
    expect(classify('Sala d-Panthenol Provitamin B5 75% 100 ml Glasflasche').category).toBe('cosmetic')
    expect(classify('Sala Braunglas Salbentiegel 60 ml').category).toBe('packaging')
  })
})
