import type { Need } from './batch'
import { bestProduct, materialStock, offerPrice, packageGrams, pricePerKg, type Inventory, type Product } from './inventory'

export { bestProduct }

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
      const last = product && offerPrice(inv, product)
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
