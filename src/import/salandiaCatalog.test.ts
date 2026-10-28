import { describe, expect, it } from 'vitest'
import { importSalandiaCatalog, shopCategoryOf } from './salandiaCatalog'

describe('Salandia-Katalog', () => {
  it('kürzt den Shop-Pfad auf die sinnvolle Kategorie', () => {
    expect(shopCategoryOf('Wellness & Hobbythek > Pflanzenöl > K - R')).toBe('Pflanzenöl')
    expect(shopCategoryOf('Wellness & Hobbythek > Basisgrundstoffe Hobbythek > A - B')).toBe('Basisgrundstoffe')
    expect(shopCategoryOf('Wellness & Hobbythek > Ätherische Öle/ Duftstoffe > Naturreine Öle')).toBe('Ätherische Öle/Duftstoffe › Naturreine Öle')
    expect(shopCategoryOf('Wellness & Hobbythek > Zubehör Wellness & Hobbythek > Flaschen & Gläser')).toBe('Zubehör › Flaschen & Gläser')
    expect(shopCategoryOf(null)).toBeUndefined()
  })

  it('ergänzt die Shop-Kategorie auch bei bekannten Artikeln', () => {
    const existing = [{ id: 'a', name: 'Kokosöl 1000 g', category: 'fat' as const, fatId: 'coconut', unit: 'g' as const, packageSize: 1000 }]
    const { products, updates } = importSalandiaCatalog(
      {
        source: 'salandia',
        scraped_at: '2026-10-28',
        products: [
          { name: 'Kokosöl 1000 g', sku: null, url: null, kategorie: 'Wellness & Hobbythek > Pflanzenöl > K - R', packungsgroesse: 1000, einheit: 'g', preis_eur: 9.9, bio: false, lieferbar: true },
        ],
      },
      existing,
    )
    expect(products).toHaveLength(0)
    expect(updates[0].changes.shopCategory).toBe('Pflanzenöl')
  })
})
