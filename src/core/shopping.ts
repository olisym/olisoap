import type { Need } from './batch'
import { materialKey, materialStock, packageGrams, pricePerKg, type Inventory, type Product } from './inventory'

// Einkauf: aus dem Bedarf (z. B. geplante Sude) und dem Bestand eine Bestellliste ableiten.

export interface ShoppingSuggestion {
  need: Need
  /** Fehlmenge in g nach Abzug des Bestands. */
  shortfall: number
  product?: Product
  packages: number
  unitPrice?: number
  pricePerKg?: number
}

function latestPrice(inv: Inventory, productId: string) {
  return inv.purchases.filter((p) => p.productId === productId).sort((a, b) => b.date.localeCompare(a.date))[0]
}

/**
 * Bester Artikel für ein Material: der günstigste pro kg unter den Artikeln, die in den letzten drei Jahren
 * gekauft wurden (ältere Preise sind meist überholt). Ohne Einkauf: irgendein passender Artikel.
 */
export function bestProduct(inv: Inventory, key: Need['key'], today = new Date().toISOString().slice(0, 10)): Product | undefined {
  const candidates = inv.products.filter((p) => materialKey(p) === key && packageGrams(p))
  const cutoff = `${Number(today.slice(0, 4)) - 3}${today.slice(4)}`
  const priced = candidates
    .map((p) => ({ p, last: latestPrice(inv, p.id) }))
    .filter((x) => x.last && x.last.date >= cutoff)
    .map((x) => ({ p: x.p, perKg: pricePerKg(x.p, x.last!.unitPrice)! }))
    .sort((a, b) => a.perKg - b.perKg)
  return priced[0]?.p ?? candidates[0]
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

export function planShopping(inv: Inventory, needs: Need[]): ShoppingSuggestion[] {
  return mergeNeeds(needs)
    .map((need): ShoppingSuggestion | undefined => {
      const shortfall = need.grams - materialStock(inv, need.key)
      if (shortfall <= 0) return undefined
      const product = bestProduct(inv, need.key)
      const grams = product && packageGrams(product)
      const last = product && latestPrice(inv, product.id)
      return {
        need,
        shortfall,
        product,
        packages: grams ? Math.ceil(shortfall / grams) : 0,
        unitPrice: last?.unitPrice,
        pricePerKg: product && last ? pricePerKg(product, last.unitPrice) : undefined,
      }
    })
    .filter((s): s is ShoppingSuggestion => !!s)
}
