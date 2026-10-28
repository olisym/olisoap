import { ADDITIVES_BY_ID } from '../data/additives'
import { FATS_BY_ID } from '../data/fats'
import type { LyeType } from './types'

// Lager und Preise: Artikel (was man kaufen kann), Einkäufe (Preishistorie), Gebinde (was im Regal steht).
// Verknüpft mit dem Rechenkern über einen Material-Schlüssel wie "fat:shea" oder "lye:NaOH".

export type ProductCategory = 'fat' | 'lye' | 'additive' | 'essentialOil' | 'cosmetic' | 'packaging' | 'other'

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  fat: 'Fette & Öle',
  lye: 'Lauge',
  additive: 'Seifenzusätze',
  essentialOil: 'Ätherische Öle',
  cosmetic: 'Kosmetik-Rohstoffe',
  packaging: 'Verpackung & Werkzeug',
  other: 'Sonstiges',
}

export type ProductUnit = 'g' | 'ml' | 'Stk'

export interface Product {
  id: string
  name: string
  supplier?: string
  sku?: string
  url?: string
  category: ProductCategory
  fatId?: string
  additiveId?: string
  lyeType?: LyeType
  unit: ProductUnit
  /** Inhalt einer Packung in `unit`. */
  packageSize: number
  /** g/ml, überschreibt die Dichte aus der Fett- bzw. Zusatztabelle. */
  density?: number
  organic?: boolean
  notes?: string
  /** Aktueller Shop-Preis pro Packung (aus einem Katalog-Import), unabhängig von eigenen Einkäufen. */
  listPrice?: number
  listPriceDate?: string
  /** Laut Shop lieferbar. Fehlt = unbekannt. */
  available?: boolean
}

export interface Purchase {
  id: string
  productId: string
  date: string
  quantity: number
  /** Bruttopreis pro Packung in EUR. */
  unitPrice: number
  orderNumber?: string
}

export interface Lot {
  id: string
  productId: string
  purchasedAt?: string
  gramsInitial: number
  gramsLeft: number
  /** EUR pro kg, beim Anlegen aus dem Einkaufspreis übernommen. */
  pricePerKg?: number
  bestBefore?: string
  openedAt?: string
  notes?: string
}

export type MaterialKey = `fat:${string}` | `additive:${string}` | `lye:${LyeType}`

export function materialKey(p: Product): MaterialKey | undefined {
  if (p.category === 'fat' && p.fatId) return `fat:${p.fatId}`
  if (p.category === 'additive' && p.additiveId) return `additive:${p.additiveId}`
  if (p.category === 'lye' && p.lyeType) return `lye:${p.lyeType}`
  return undefined
}

export function productDensity(p: Product): number {
  if (p.density) return p.density
  if (p.fatId) return FATS_BY_ID[p.fatId]?.density ?? 0.92
  if (p.additiveId) return ADDITIVES_BY_ID[p.additiveId]?.density ?? 1
  return 1
}

/** Gewicht einer Packung in g, oder undefined bei Stückware. */
export function packageGrams(p: Product): number | undefined {
  if (p.unit === 'g') return p.packageSize
  if (p.unit === 'ml') return p.packageSize * productDensity(p)
  return undefined
}

export function pricePerKg(p: Product, unitPrice: number): number | undefined {
  const g = packageGrams(p)
  return g ? (unitPrice / g) * 1000 : undefined
}

export interface Inventory {
  products: Product[]
  purchases: Purchase[]
  lots: Lot[]
}

export interface MaterialPrice {
  pricePerKg: number
  source: 'stock' | 'purchase' | 'list'
  /** Datum des zugrunde liegenden Einkaufs. */
  date?: string
}

export interface Offer {
  unitPrice: number
  date: string
  source: 'purchase' | 'list'
}

const yearsBefore = (iso: string, years: number) => `${Number(iso.slice(0, 4)) - years}${iso.slice(4)}`

/** Aktuellster bekannter Preis eines Artikels: Shop-Katalog oder eigener Einkauf, je nachdem was neuer ist. */
export function offerPrice(inv: Inventory, p: Product): Offer | undefined {
  const last = inv.purchases.filter((x) => x.productId === p.id).sort((a, b) => b.date.localeCompare(a.date))[0]
  const purchase: Offer | undefined = last && { unitPrice: last.unitPrice, date: last.date, source: 'purchase' }
  const list: Offer | undefined = p.listPrice !== undefined && p.listPriceDate ? { unitPrice: p.listPrice, date: p.listPriceDate, source: 'list' } : undefined
  if (!purchase || !list) return purchase ?? list
  return list.date >= purchase.date ? list : purchase
}

/** Größte Packung, die ohne eigene Kaufhistorie vorgeschlagen wird (Großgebinde nur, wenn man sie schon mal gekauft hat). */
const MAX_SUGGESTED_PACKAGE_G = 5000

/**
 * Bester Artikel für ein Material:
 * 1. unter den in den letzten drei Jahren selbst gekauften Artikeln der günstigste pro kg (bekannte Qualität und Größe),
 * 2. sonst unter den lieferbaren Katalog-Artikeln bis 5 kg der günstigste pro kg,
 * 3. sonst irgendein passender Artikel.
 */
export function bestProduct(inv: Inventory, key: MaterialKey, today = new Date().toISOString().slice(0, 10)): Product | undefined {
  const candidates = inv.products.filter((p) => materialKey(p) === key && packageGrams(p))
  const perKg = (p: Product) => {
    const o = offerPrice(inv, p)
    return o ? pricePerKg(p, o.unitPrice)! : Infinity
  }
  const cheapest = (list: Product[]) => list.sort((a, b) => perKg(a) - perKg(b))[0]
  const cutoff = yearsBefore(today, 3)
  const bought = candidates.filter((p) => inv.purchases.some((x) => x.productId === p.id && x.date >= cutoff))
  if (bought.length) return cheapest(bought)
  const listed = candidates.filter(
    (p) => p.listPrice !== undefined && p.listPriceDate && p.listPriceDate >= yearsBefore(today, 1) && p.available !== false && packageGrams(p)! <= MAX_SUGGESTED_PACKAGE_G,
  )
  return cheapest(listed) ?? candidates[0]
}

/** Preis eines Materials: gewichteter Schnitt der Gebinde im Lager, sonst der Preis des besten Artikels. */
export function materialPrice(inv: Inventory, key: MaterialKey): MaterialPrice | undefined {
  const ids = new Set(inv.products.filter((p) => materialKey(p) === key).map((p) => p.id))
  const lots = inv.lots.filter((l) => ids.has(l.productId) && l.gramsLeft > 0 && l.pricePerKg !== undefined)
  const grams = lots.reduce((s, l) => s + l.gramsLeft, 0)
  if (grams > 0)
    return { pricePerKg: lots.reduce((s, l) => s + l.pricePerKg! * l.gramsLeft, 0) / grams, source: 'stock' }

  const product = bestProduct(inv, key)
  const offer = product && offerPrice(inv, product)
  const perKg = offer && pricePerKg(product, offer.unitPrice)
  return perKg !== undefined && offer ? { pricePerKg: perKg, source: offer.source, date: offer.date } : undefined
}

/** Vorrätige Menge eines Materials in g. */
export function materialStock(inv: Inventory, key: MaterialKey): number {
  const ids = new Set(inv.products.filter((p) => materialKey(p) === key).map((p) => p.id))
  return inv.lots.filter((l) => ids.has(l.productId)).reduce((s, l) => s + l.gramsLeft, 0)
}
