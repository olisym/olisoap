import { needsOf } from '../core/batch'
import { calculate } from '../core/calc'
import type { Product, ProductUnit } from '../core/inventory'
import type { ShopTerms } from '../core/shops'
import { ADDITIVES_BY_ID } from '../data/additives'
import { FATS_BY_ID } from '../data/fats'
import type { Recipe } from '../db'

// Erfundene Beispiel-Shops für den Demo-Link. Keine echten Shop-Daten: Namen und Preise sind ausgedacht,
// grob in der Größenordnung von Heimkosmetik-Shops (Herbst 2026), damit die Einkaufsplanung plausibel aussieht.

export const DEMO_SHOPS: ShopTerms[] = [
  { name: 'Beispiel-Shop Nord', shipping: 5.95, freeShippingFrom: 60 },
  { name: 'Beispiel-Shop Süd', shipping: 4.9, freeShippingFrom: 40, paymentFee: 0.5 },
  { name: 'Supermarkt', local: true },
]

/** Grundpreis in €/kg bei 1-kg-Packung (ausgedacht). */
const BASE: Record<string, number> = {
  'fat:shea': 16,
  'fat:cocoa': 28,
  'fat:babassu': 26,
  'fat:coconut': 13,
  'fat:castor': 14,
  'fat:avocado': 16,
  'fat:macadamia': 15,
  'fat:stearic-acid': 10,
  'lye:NaOH': 8,
  'lye:KOH': 11,
  'additive:citric-anhydrous': 9,
  'additive:glycerin': 9,
}
/** Im Supermarkt: Preis je Liter. */
const SUPERMARKET: Record<string, number> = { 'fat:olive': 9.99, 'fat:sunflower-ho': 3.49 }
/** Bei Raumtemperatur flüssig: im Shop nach ml verkauft. */
const LIQUID = new Set(['fat:castor', 'fat:avocado', 'fat:macadamia', 'additive:glycerin'])

/** Kleine Packungen kosten pro kg mehr. */
const sizeFactor = (kg: number) => (kg <= 0.1 ? 1.9 : kg <= 0.25 ? 1.45 : kg <= 0.5 ? 1.2 : kg <= 1 ? 1 : 0.8)
const round = (x: number) => Math.round(x * 10) / 10 - 0.01

export function demoCatalog(recipes: Recipe[], today: string): Product[] {
  const keys = new Set(recipes.flatMap((r) => needsOf(calculate(r.input)).map((n) => n.key)))
  keys.add('additive:eo-rosemary')
  keys.add('additive:eo-lavender')
  const products: Product[] = []
  for (const key of keys) {
    const [kind, id] = key.split(':')
    const name = kind === 'lye' ? (id === 'NaOH' ? 'Natriumhydroxid (NaOH)' : 'Kaliumhydroxid (KOH)') : ((kind === 'fat' ? FATS_BY_ID[id]?.name : ADDITIVES_BY_ID[id]?.name) ?? id)
    const material = kind === 'fat' ? { category: 'fat' as const, fatId: id } : kind === 'lye' ? { category: 'lye' as const, lyeType: id as 'NaOH' | 'KOH' } : { category: (id.startsWith('eo-') ? 'essentialOil' : 'additive') as Product['category'], additiveId: id }

    if (SUPERMARKET[key]) {
      products.push({ id: `demo-${id}-super`, name: `${name} 1 L`, supplier: 'Supermarkt', ...material, unit: 'ml', packageSize: 1000, listPrice: SUPERMARKET[key], listPriceDate: today })
      continue
    }
    const eo = id.startsWith('eo-')
    const unit: ProductUnit = eo || LIQUID.has(key) ? 'ml' : 'g'
    const sizes = eo ? [10, 30, 100] : [100, 250, 500, 1000, 5000]
    // Nord ist bei Fetten etwas teurer, Süd bei ätherischen Ölen: so lohnt sich mal Bündeln, mal Aufteilen.
    for (const [shop, factor] of [['Beispiel-Shop Nord', eo ? 0.9 : 1.05], ['Beispiel-Shop Süd', eo ? 1.15 : 0.95]] as const) {
      for (const size of sizes) {
        const price = eo ? round((size / 10) * 3.6 * (size >= 100 ? 0.75 : size >= 30 ? 0.9 : 1) * factor) : round((BASE[key] ?? 15) * (size / 1000) * sizeFactor(size / 1000) * factor)
        products.push({
          id: `demo-${id}-${shop.endsWith('Nord') ? 'n' : 's'}-${size}`,
          name: `${name} ${size >= 1000 ? `${size / 1000} ${unit === 'ml' ? 'L' : 'kg'}` : `${size} ${unit}`}`,
          supplier: shop,
          ...material,
          unit,
          packageSize: size,
          listPrice: Math.max(0.99, price),
          listPriceDate: today,
        })
      }
    }
  }
  return products
}
