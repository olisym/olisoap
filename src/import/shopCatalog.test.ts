import { describe, expect, it } from 'vitest'
import { asShopCatalog, importShopCatalog, isShopCatalog, SHOP_FORMAT, type ShopCatalog } from './shopCatalog'

const catalog: ShopCatalog = {
  format: SHOP_FORMAT,
  version: 1,
  erstellt_am: '2026-10-30',
  shop: { name: 'Testshop', url: 'https://test.example', versand_eur: 4.9, versandfrei_ab_eur: 49, mindestbestellwert_eur: null, gebuehr_eur: null },
  produkte: [
    { name: 'Shea Butter raffiniert 500 g', url: 'https://test.example/shea', art: 'fett', packungsgroesse: 500, einheit: 'g', preis_eur: 9.9, lieferbar: true },
    { name: 'Lavendelöl fein 30 ml', art: 'aetherisch', packungsgroesse: 30, einheit: 'ml', preis_eur: 7.5 },
    { name: 'MCT-Öl aus Kokosfett 1 L', art: 'fett', preis_eur: 20 },
    { name: 'Kokosfett 1 kg', art: 'fett', preis_eur: 8 },
    { name: 'Natriumhydroxid Perlen 1 kg', art: 'lauge', preis_eur: 11.9 },
    { name: 'Olivem 1000', art: 'emulgator', packungsgroesse: 100, einheit: 'g', preis_eur: 6 },
    { name: 'ohne Preis', preis_eur: null },
  ],
}

describe('Shop-Katalog (allgemeines Format)', () => {
  it('erkennt das Format', () => {
    expect(isShopCatalog(catalog)).toBe(true)
    expect(isShopCatalog({ products: [], scraped_at: 'x' })).toBe(false)
  })

  it('verzeiht fehlendes „format“ und „products“ statt „produkte“', () => {
    const { format: _f, produkte, ...rest } = catalog
    const loose = asShopCatalog({ ...rest, products: produkte })
    expect(loose?.produkte).toHaveLength(produkte.length)
    expect(asShopCatalog({ ...catalog, format: 'etwas-anderes' })).toBeUndefined()
  })

  it('legt Artikel mit Zuordnung an und übernimmt die Versandbedingungen', () => {
    const r = importShopCatalog(catalog, [])
    expect(r.shop).toEqual({ name: 'Testshop', shipping: 4.9, freeShippingFrom: 49 })
    const by = Object.fromEntries(r.products.map((p) => [p.name, p]))
    expect(by['Shea Butter raffiniert 500 g']).toMatchObject({ supplier: 'Testshop', category: 'fat', fatId: 'shea', unit: 'g', packageSize: 500, listPrice: 9.9 })
    expect(by['Lavendelöl fein 30 ml']).toMatchObject({ category: 'essentialOil', additiveId: 'eo-lavender' })
    expect(by['MCT-Öl aus Kokosfett 1 L'].fatId).toBeUndefined()
    expect(by['Kokosfett 1 kg']).toMatchObject({ fatId: 'coconut', unit: 'g', packageSize: 1000 })
    expect(by['Natriumhydroxid Perlen 1 kg']).toMatchObject({ category: 'lye', lyeType: 'NaOH' })
    expect(by['Olivem 1000'].category).toBe('cosmetic')
    expect(r.products).toHaveLength(6)
  })

  it('übernimmt Versand nach Gewicht', () => {
    const r = importShopCatalog({ ...catalog, shop: { ...catalog.shop, versand_eur: null, versand_staffel: [{ bis_kg: 10, eur: 5.95 }, { bis_kg: 30, eur: 10.71 }] } }, [])
    expect(r.shop.shippingByWeight).toEqual([
      { maxKg: 10, eur: 5.95 },
      { maxKg: 30, eur: 10.71 },
    ])
    expect(r.shop.shipping).toBeUndefined()
  })

  it('aktualisiert bekannte Artikel desselben Shops nur im Preis, behält eigene Einstellungen', () => {
    const first = importShopCatalog(catalog, []).products
    const edited = first.map((p) => (p.name.startsWith('Shea') ? { ...p, density: 0.9 } : p))
    const again = importShopCatalog({ ...catalog, erstellt_am: '2026-11-15', produkte: [{ ...catalog.produkte[0], preis_eur: 10.5 }] }, edited, { name: 'Testshop', paymentFee: 0.35 })
    expect(again.products).toHaveLength(0)
    expect(again.updates[0].changes).toMatchObject({ listPrice: 10.5, listPriceDate: '2026-11-15' })
    expect(again.shop.paymentFee).toBe(0.35)
  })
})
