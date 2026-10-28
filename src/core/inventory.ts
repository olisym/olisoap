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
  source: 'stock' | 'purchase'
  /** Datum des zugrunde liegenden Einkaufs. */
  date?: string
}

/** Preis eines Materials: gewichteter Schnitt der Gebinde im Lager, sonst der letzte Einkaufspreis. */
export function materialPrice(inv: Inventory, key: MaterialKey): MaterialPrice | undefined {
  const products = inv.products.filter((p) => materialKey(p) === key)
  const ids = new Set(products.map((p) => p.id))

  const lots = inv.lots.filter((l) => ids.has(l.productId) && l.gramsLeft > 0 && l.pricePerKg !== undefined)
  const grams = lots.reduce((s, l) => s + l.gramsLeft, 0)
  if (grams > 0)
    return { pricePerKg: lots.reduce((s, l) => s + l.pricePerKg! * l.gramsLeft, 0) / grams, source: 'stock' }

  const byId = new Map(products.map((p) => [p.id, p]))
  const latest = inv.purchases
    .filter((pu) => ids.has(pu.productId))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((pu) => ({ pu, price: pricePerKg(byId.get(pu.productId)!, pu.unitPrice) }))
    .find((x) => x.price !== undefined)
  return latest ? { pricePerKg: latest.price!, source: 'purchase', date: latest.pu.date } : undefined
}

/** Vorrätige Menge eines Materials in g. */
export function materialStock(inv: Inventory, key: MaterialKey): number {
  const ids = new Set(inv.products.filter((p) => materialKey(p) === key).map((p) => p.id))
  return inv.lots.filter((l) => ids.has(l.productId)).reduce((s, l) => s + l.gramsLeft, 0)
}
