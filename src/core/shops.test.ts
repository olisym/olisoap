import { describe, expect, it } from 'vitest'
import type { Inventory, Product } from './inventory'
import { optimizeShops, shopCosts, summarizeOrders, type ShopTerms } from './shops'

const today = '2026-10-30'
const item = (id: string, shop: string, fatId: string, grams: number, price: number): Product => ({
  id,
  name: `${shop} ${fatId} ${grams} g`,
  supplier: shop,
  category: 'fat',
  fatId,
  unit: 'g',
  packageSize: grams,
  listPrice: price,
  listPriceDate: today,
})
const inv = (products: Product[]): Inventory => ({ products, purchases: [], lots: [] })
const need = (fatId: string, grams: number) => ({ key: `fat:${fatId}` as const, name: fatId, grams })
const shopOfLines = (s: ReturnType<typeof optimizeShops>) => Object.fromEntries(s.map((x) => [x.need.name, x.lines[0]?.product.supplier]))

describe('Nebenkosten', () => {
  it('Versand, versandkostenfrei ab, Gebühr, Mindestbestellwert', () => {
    const t: ShopTerms = { name: 'A', shipping: 5.9, freeShippingFrom: 50, paymentFee: 0.35, minOrder: 15 }
    expect(shopCosts(10, t, 'A')).toMatchObject({ shipping: 5.9, fee: 0.35, minimumGap: 5, total: 21.25 })
    expect(shopCosts(60, t, 'A')).toMatchObject({ shipping: 0, total: 60.35 })
    expect(shopCosts(10, undefined, 'X').unknownShipping).toBe(true)
    expect(shopCosts(10, { name: 'Laden', local: true }, 'Laden')).toMatchObject({ shipping: 0, unknownShipping: false })
  })

  it('Versand nach Gewicht: Stufe, mehrere Pakete, Freigrenze hat Vorrang', () => {
    const t: ShopTerms = { name: 'M', shippingByWeight: [{ maxKg: 30, eur: 10.71 }, { maxKg: 10, eur: 5.95 }], freeShippingFrom: 400 }
    expect(shopCosts(50, t, 'M', 3).shipping).toBe(5.95)
    expect(shopCosts(50, t, 'M', 12).shipping).toBe(10.71)
    expect(shopCosts(50, t, 'M', 45).shipping).toBeCloseTo(21.42)
    expect(shopCosts(450, t, 'M', 45).shipping).toBe(0)
    expect(shopCosts(50, t, 'M', 3).unknownShipping).toBe(false)
  })
})

describe('Einkauf über mehrere Shops', () => {
  const shops: ShopTerms[] = [
    { name: 'A', shipping: 5.9, freeShippingFrom: 50 },
    { name: 'B', shipping: 4.9 },
  ]

  it('bündelt bei einem Shop, wenn ein zweiter Versand teurer wäre als die Ersparnis', () => {
    const products = [item('a-shea', 'A', 'shea', 500, 10), item('a-cocoa', 'A', 'cocoa', 500, 9), item('b-cocoa', 'B', 'cocoa', 500, 8)]
    // Einzeln am günstigsten: Kakao bei B (8 statt 9), aber dann zweimal Versand.
    const s = optimizeShops(inv(products), [need('shea', 400), need('cocoa', 400)], shops, today)
    expect(shopOfLines(s)).toEqual({ shea: 'A', cocoa: 'A' })
    expect(summarizeOrders(s, shops)).toEqual([expect.objectContaining({ shop: 'A', subtotal: 19, shipping: 5.9, total: 24.9 })])
  })

  it('teilt auf, wenn die Ersparnis den zweiten Versand übersteigt', () => {
    const products = [item('a-shea', 'A', 'shea', 500, 10), item('a-cocoa', 'A', 'cocoa', 500, 30), item('b-cocoa', 'B', 'cocoa', 500, 12)]
    const s = optimizeShops(inv(products), [need('shea', 400), need('cocoa', 400)], shops, today)
    expect(shopOfLines(s)).toEqual({ shea: 'A', cocoa: 'B' })
  })

  it('nimmt Teureres in Kauf, um die Grenze für versandkostenfrei zu erreichen', () => {
    // A: 44 + 7 = 51 → versandfrei. Alternativ Kakao bei B: 44 + 5,90 + 6 + 4,90 = 60,80.
    const products = [item('a-shea', 'A', 'shea', 5000, 44), item('a-cocoa', 'A', 'cocoa', 500, 7), item('b-cocoa', 'B', 'cocoa', 500, 6)]
    const s = optimizeShops(inv(products), [need('shea', 4000), need('cocoa', 400)], shops, today)
    expect(shopOfLines(s)).toEqual({ shea: 'A', cocoa: 'A' })
    expect(summarizeOrders(s, shops)[0]).toMatchObject({ subtotal: 51, shipping: 0 })
  })

  it('Laden vor Ort ohne Preis bleibt drin und kostet keinen Versand', () => {
    const products = [item('a-shea', 'A', 'shea', 500, 10), { ...item('olive', 'Supermarkt', 'olive', 1000, 0), listPrice: undefined, listPriceDate: undefined }]
    const s = optimizeShops(inv(products), [need('shea', 400), need('olive', 300)], [...shops, { name: 'Supermarkt', local: true }], today)
    expect(shopOfLines(s)).toEqual({ shea: 'A', olive: 'Supermarkt' })
    expect(summarizeOrders(s, [...shops, { name: 'Supermarkt', local: true }]).find((o) => o.shop === 'Supermarkt')?.total).toBe(0)
  })

  it('rechnet schwere Bestellungen bei Versand nach Gewicht teurer', () => {
    // 5 kg NaOH: bei A pauschal 5,90, bei W nach Gewicht (über 5 kg: 10,50). W ist 3 € billiger in der Ware.
    const products = [item('a-naoh', 'A', 'naoh', 5000, 30), item('w-naoh', 'W', 'naoh', 5000, 27)]
    const terms: ShopTerms[] = [{ name: 'A', shipping: 5.9 }, { name: 'W', shippingByWeight: [{ maxKg: 2, eur: 5 }, { maxKg: 10, eur: 10.5 }] }]
    const s = optimizeShops(inv(products), [need('naoh', 4500)], terms, today)
    expect(shopOfLines(s).naoh).toBe('A')
    expect(summarizeOrders(s, terms)[0].weightKg).toBeCloseTo(5.75)
  })

  it('Vorlieben: meiden, bevorzugen und Aufwand je weitere Bestellung', () => {
    const products = [item('a-shea', 'A', 'shea', 500, 10), item('b-shea', 'B', 'shea', 500, 10.5), item('b-cocoa', 'B', 'cocoa', 500, 9), item('a-cocoa', 'A', 'cocoa', 500, 9.4)]
    const needs = [need('shea', 400), need('cocoa', 400)]
    const flat: ShopTerms[] = [
      { name: 'A', shipping: 0 },
      { name: 'B', shipping: 0 },
    ]
    // Ohne Vorliebe: jeweils der günstigere Shop
    expect(shopOfLines(optimizeShops(inv(products), needs, flat, today))).toEqual({ shea: 'A', cocoa: 'B' })
    // Aufwand 2 € je weiterer Bestellung: alles bei A (19,40) statt A+B (19 + 2)
    expect(shopOfLines(optimizeShops(inv(products), needs, flat, today, { extraOrderCost: 2 }))).toEqual({ shea: 'A', cocoa: 'A' })
    // B bevorzugt: 5 % teurer ist in Ordnung
    expect(shopOfLines(optimizeShops(inv(products), needs, [flat[0], { ...flat[1], preference: 'prefer' }], today))).toEqual({ shea: 'B', cocoa: 'B' })
    // B meiden: alles bei A, obwohl Kakao bei B billiger wäre
    expect(shopOfLines(optimizeShops(inv(products), needs, [flat[0], { ...flat[1], preference: 'avoid' }], today))).toEqual({ shea: 'A', cocoa: 'A' })
    // Gemieden, aber einzige Quelle: trotzdem dort
    expect(shopOfLines(optimizeShops(inv([item('b-cocoa', 'B', 'cocoa', 500, 9)]), [need('cocoa', 400)], [{ name: 'B', preference: 'avoid' }], today))).toEqual({ cocoa: 'B' })
  })

  it('übergeht nicht lieferbare Artikel', () => {
    const products = [{ ...item('a-olive', 'A', 'olive', 500, 3), available: false }, item('b-olive', 'B', 'olive', 500, 6)]
    const s = optimizeShops(inv(products), [need('olive', 400)], shops, today)
    expect(s[0].lines.map((l) => l.product.id)).toEqual(['b-olive'])
    expect(s[0].total).toBe(6)
  })

  it('berücksichtigt den Mindestbestellwert', () => {
    // B ist für Kakao billiger, hat aber 20 € Mindestbestellwert: 8 + 12 Aufschlag + 4,90.
    const products = [item('a-shea', 'A', 'shea', 500, 10), item('a-cocoa', 'A', 'cocoa', 500, 9.5), item('b-cocoa', 'B', 'cocoa', 500, 3)]
    const s = optimizeShops(inv(products), [need('shea', 400), need('cocoa', 400)], [shops[0], { name: 'B', shipping: 0, minOrder: 20 }], today)
    expect(shopOfLines(s).cocoa).toBe('A')
  })

  it('bleibt bei vielen Materialien und Shops schnell und nie teurer als „jeweils günstigst“', () => {
    const fats = ['shea', 'cocoa', 'olive', 'castor', 'avocado', 'babassu', 'coconut', 'sunflower-ho', 'macadamia', 'sesame']
    const names = ['A', 'B', 'C', 'D', 'E', 'F']
    const products = fats.flatMap((f, i) => names.map((n, j) => item(`${n}-${f}`, n, f, 1000, 8 + ((i * 7 + j * 3) % 9))))
    const terms = names.map((n, j) => ({ name: n, shipping: 4.9 + j * 0.5, freeShippingFrom: 60 }))
    const t0 = performance.now()
    const s = optimizeShops(inv(products), fats.map((f) => need(f, 800)), terms, today)
    expect(performance.now() - t0).toBeLessThan(1000)
    const sum = (x: ReturnType<typeof optimizeShops>) => summarizeOrders(x, terms).reduce((a, o) => a + o.total, 0)
    // Vergleich 1: jedes Material beim günstigsten Shop, jeder beteiligte Shop mit eigenem Versand
    const cheapest = fats.map((f) => products.filter((p) => p.fatId === f).sort((a, b) => a.listPrice! - b.listPrice!)[0])
    const naive = cheapest.reduce((a, p) => a + p.listPrice!, 0) + [...new Set(cheapest.map((p) => p.supplier))].reduce((a, n) => a + shopCosts(0, terms.find((t) => t.name === n), n!).shipping, 0)
    // Vergleich 2: alles bei einem Shop
    const single = Math.min(...names.map((n) => shopCosts(products.filter((p) => p.supplier === n).reduce((a, p) => a + p.listPrice!, 0), terms.find((t) => t.name === n), n).total))
    expect(sum(s)).toBeLessThanOrEqual(Math.min(naive, single) + 0.001)
  })
})
