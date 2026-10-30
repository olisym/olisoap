import type { Need } from './batch'
import { optimizeShops, type ShopTerms } from './shops'
import { bestProduct, materialKey, materialStock, offerPrice, packageGrams, pricePerKg, type Inventory, type MaterialKey, type Product } from './inventory'

export { bestProduct }

// Einkauf: aus dem Bedarf (z. B. geplante Sude) und dem Bestand eine Bestellliste ableiten.

/**
 * - `perKg`: eine Packungsgröße mit dem besten Preis pro kg (Vorrat für später, Rest bleibt übrig)
 * - `total`: kleinste Gesamtsumme für genau diesen Bedarf: Packungen derselben Produktlinie kombiniert, über alle Shops
 *   verteilt, Versand und Gebühren eingerechnet (siehe shops.ts)
 */
export type ShoppingMode = 'perKg' | 'total'

export interface ShoppingLine {
  product: Product
  packages: number
  unitPrice?: number
}

export interface ShoppingSuggestion {
  need: Need
  /** Fehlmenge in g nach Abzug des Bestands. */
  shortfall: number
  /** Leer, wenn noch kein Artikel zum Material passt. */
  lines: ShoppingLine[]
  /** Summe der Zeilen; undefined, wenn ein Preis fehlt. */
  total?: number
  /** Was nach dem Sieden übrig bleibt, in g. */
  leftover: number
  pricePerKg?: number
}

/** Summiert gleichartige Bedarfe (mehrere Rezepte) zu einem Bedarf pro Material. */
export function mergeNeeds(needs: Need[]): Need[] {
  const map = new Map<string, Need>()
  for (const n of needs) {
    const prev = map.get(n.key)
    map.set(n.key, prev ? { ...prev, grams: prev.grams + n.grams } : { ...n })
  }
  return [...map.values()]
}

/** Name ohne Größe und Gebinde: „Sala Kokosöl kaltgepresst bio 250 ml Glastiegel“ → „sala kokosöl kaltgepresst bio“. */
export function productLine(name: string): string {
  return name
    .split(/\s\d+(?:[.,]\d+)?\s?(?:kg|g|l|ml)\b/i)[0]
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export interface Pack {
  product: Product
  grams: number
  price: number
}

/**
 * Günstigste Kombination, die mindestens `need` g abdeckt (beliebig viele Packungen je Größe).
 * Bei gleichem Preis gewinnt weniger Rest. Dynamische Programmierung in 1-g-Schritten.
 */
export function cheapestCover(packs: Pack[], need: number): { lines: { pack: Pack; count: number }[]; price: number; grams: number } | undefined {
  const target = Math.ceil(need)
  if (!packs.length || target <= 0) return undefined
  const cost = new Float64Array(target + 1).fill(Infinity)
  const got = new Float64Array(target + 1)
  const pick = new Int32Array(target + 1).fill(-1)
  cost[0] = 0
  for (let g = 1; g <= target; g++) {
    for (let i = 0; i < packs.length; i++) {
      const rest = Math.max(0, g - Math.floor(packs[i].grams))
      const c = Math.round((cost[rest] + packs[i].price) * 100) / 100
      const total = got[rest] + packs[i].grams
      if (c < cost[g] || (c === cost[g] && total < got[g])) {
        cost[g] = c
        got[g] = total
        pick[g] = i
      }
    }
  }
  if (!Number.isFinite(cost[target])) return undefined
  const counts = new Map<number, number>()
  for (let g = target; g > 0; ) {
    const i = pick[g]
    counts.set(i, (counts.get(i) ?? 0) + 1)
    g = Math.max(0, g - Math.floor(packs[i].grams))
  }
  return {
    lines: [...counts].map(([i, count]) => ({ pack: packs[i], count })).sort((a, b) => b.pack.grams - a.pack.grams),
    price: cost[target],
    grams: got[target],
  }
}

/**
 * Packungen derselben Produktlinie wie der Vorschlag (gleiche Qualität, andere Größen und Gebinde).
 * Gibt es aktuelle Preise (jünger als ein Jahr), zählen nur diese: ein alter Einkaufspreis ist kein Angebot mehr.
 */
export function linePacks(inv: Inventory, key: MaterialKey, best: Product, today: string): Pack[] {
  const line = productLine(best.name)
  const cutoff = `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`
  const packs = inv.products
    .filter((p) => materialKey(p) === key && p.available !== false && productLine(p.name) === line)
    .flatMap((p) => {
      const grams = packageGrams(p)
      const offer = offerPrice(inv, p)
      return grams && offer ? [{ product: p, grams, price: offer.unitPrice, current: offer.date >= cutoff }] : []
    })
  return packs.some((p) => p.current) ? packs.filter((p) => p.current) : packs
}

export function planShopping(
  inv: Inventory,
  needs: Need[],
  mode: ShoppingMode = 'perKg',
  today = new Date().toISOString().slice(0, 10),
  shops: ShopTerms[] = [],
): ShoppingSuggestion[] {
  // Nur was gebraucht wird: über alle Shops verteilen, Versand und Gebühren eingerechnet.
  if (mode === 'total') return optimizeShops(inv, needs, shops, today)
  return mergeNeeds(needs)
    .map((need): ShoppingSuggestion | undefined => {
      const shortfall = need.grams - materialStock(inv, need.key)
      if (shortfall <= 0) return undefined
      const product = bestProduct(inv, need.key)
      const grams = product && packageGrams(product)
      if (!product || !grams) return { need, shortfall, lines: [], leftover: 0 }
      const unitPrice = offerPrice(inv, product)?.unitPrice
      const perKg = unitPrice !== undefined ? pricePerKg(product, unitPrice) : undefined

      const packages = Math.ceil(shortfall / grams)
      return {
        need,
        shortfall,
        lines: [{ product, packages, unitPrice }],
        total: unitPrice !== undefined ? unitPrice * packages : undefined,
        leftover: packages * grams - shortfall,
        pricePerKg: perKg,
      }
    })
    .filter((s): s is ShoppingSuggestion => !!s)
}
