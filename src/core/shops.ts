import type { Need } from './batch'
import { bestProduct, materialStock, offerPrice, packageGrams, type Inventory, type MaterialKey, type Product } from './inventory'
import { shelfMonths } from './shelfLife'
import { cheapestCover, linePacks, mergeNeeds, type ShoppingLine, type ShoppingSuggestion } from './shopping'

// Einkauf über mehrere Shops: Jeder Shop hat Nebenkosten (Versand pauschal oder nach Gewicht, versandkostenfrei ab,
// Mindestbestellwert, Zahlungsgebühr). Gesucht ist die Verteilung des Bedarfs auf die Shops mit der kleinsten Gesamtsumme.

export interface ShopTerms {
  /** Entspricht `Product.supplier`. */
  name: string
  /** Versandkosten in €. Fehlt = unbekannt (wird als 0 gerechnet und gemeldet). */
  shipping?: number
  /** Versand nach Paketgewicht, aufsteigend: bis `maxKg` kostet es `eur`. Hat Vorrang vor `shipping`. */
  shippingByWeight?: { maxKg: number; eur: number }[]
  /** Ab diesem Warenwert versandkostenfrei. */
  freeShippingFrom?: number
  /** Unter diesem Warenwert wird die Differenz als Aufschlag gerechnet (man müsste ohnehin mehr kaufen). */
  minOrder?: number
  /** Feste Gebühr pro Bestellung, z. B. für die Zahlungsart. */
  paymentFee?: number
  /** Laden vor Ort: keine Versandkosten. */
  local?: boolean
  /** Persönliche Vorliebe: bevorzugt (darf etwas teurer sein) oder meiden (nur, wenn es nirgends sonst gibt). */
  preference?: 'prefer' | 'avoid'
}

/** Einstellungen für die Verteilung auf Shops, die nicht zu einem einzelnen Shop gehören. */
export interface ShopPreferences {
  /** Gefühlte Kosten je zusätzlicher Bestellung (Pakete annehmen, Konten, Überblick), nur für die Entscheidung. */
  extraOrderCost?: number
}

/** Ein bevorzugter Shop darf bis zu so viel teurer sein. */
export const PREFER_MARGIN = 0.1

export interface ShopOrder {
  shop: string
  subtotal: number
  shipping: number
  fee: number
  /** Aufschlag bis zum Mindestbestellwert. */
  minimumGap: number
  total: number
  /** Versandkosten nicht hinterlegt. */
  unknownShipping: boolean
  /** Geschätztes Paketgewicht in kg (Inhalt plus Verpackung). */
  weightKg: number
}

/** Verpackung, Gläser und Kanister: grob 15 % auf das Inhaltsgewicht. */
const PACKAGING_FACTOR = 1.15

/** Paketgewicht in kg aus dem Inhalt in g. */
export const parcelKg = (contentGrams: number) => (contentGrams * PACKAGING_FACTOR) / 1000

/** Versand nach Gewichtsstufe; schwerer als die höchste Stufe heißt mehrere Pakete. */
function weightShipping(tiers: { maxKg: number; eur: number }[], kg: number): number {
  const sorted = [...tiers].sort((a, b) => a.maxKg - b.maxKg)
  const tier = sorted.find((t) => kg <= t.maxKg)
  if (tier) return tier.eur
  const last = sorted[sorted.length - 1]
  return Math.ceil(kg / last.maxKg) * last.eur
}

/** Nebenkosten einer Bestellung bei einem Shop. `weightKg`: geschätztes Paketgewicht (für Versand nach Gewicht). */
export function shopCosts(subtotal: number, terms: ShopTerms | undefined, name: string, weightKg = 0): ShopOrder {
  const free = terms?.local || (terms?.freeShippingFrom !== undefined && subtotal >= terms.freeShippingFrom)
  const tiers = terms?.shippingByWeight?.length ? terms.shippingByWeight : undefined
  const shipping = free ? 0 : tiers ? weightShipping(tiers, weightKg) : (terms?.shipping ?? 0)
  const fee = terms?.paymentFee ?? 0
  const minimumGap = terms?.minOrder !== undefined ? Math.max(0, terms.minOrder - subtotal) : 0
  return {
    shop: name,
    subtotal,
    shipping,
    fee,
    minimumGap,
    total: subtotal + shipping + fee + minimumGap,
    unknownShipping: !terms?.local && terms?.shipping === undefined && !tiers,
    weightKg,
  }
}

const shopOf = (p: Product) => p.supplier ?? 'Sonstige'

/** Bestellungen je Shop aus fertigen Vorschlägen (für beide Einkaufs-Modi). */
export function summarizeOrders(suggestions: ShoppingSuggestion[], shops: ShopTerms[]): ShopOrder[] {
  const subtotals = new Map<string, number>()
  const grams = new Map<string, number>()
  for (const s of suggestions)
    for (const l of s.lines) {
      const shop = shopOf(l.product)
      subtotals.set(shop, (subtotals.get(shop) ?? 0) + (l.unitPrice ?? 0) * l.packages)
      grams.set(shop, (grams.get(shop) ?? 0) + (packageGrams(l.product) ?? 0) * l.packages)
    }
  const terms = new Map(shops.map((t) => [t.name, t]))
  return [...subtotals].map(([name, sub]) => shopCosts(sub, terms.get(name), name, parcelKg(grams.get(name) ?? 0)))
}

interface Option {
  shop: string
  lines: ShoppingLine[]
  /** Preis der Packungen; undefined = Preis unbekannt (z. B. Supermarkt), zählt als 0. */
  cost?: number
  grams: number
}

/** Je Shop die günstigste Abdeckung des Bedarfs mit Packungen einer Produktlinie dieses Shops. */
function optionsFor(inv: Inventory, key: MaterialKey, shortfall: number, today: string): Option[] {
  const shops = new Set(inv.products.map(shopOf))
  const out: Option[] = []
  for (const shop of shops) {
    // Nicht lieferbare Artikel kommen nicht in Frage.
    const sub = { ...inv, products: inv.products.filter((p) => shopOf(p) === shop && p.available !== false) }
    const best = bestProduct(sub, key, today)
    const grams = best && packageGrams(best)
    if (!best || !grams) continue
    const cover = cheapestCover(linePacks(sub, key, best, today), shortfall)
    if (cover) {
      out.push({ shop, lines: cover.lines.map((l) => ({ product: l.pack.product, packages: l.count, unitPrice: l.pack.price })), cost: cover.price, grams: cover.grams })
    } else if (offerPrice(sub, best) === undefined) {
      // Ohne Preis (Laden vor Ort): eine Größe, so oft wie nötig. Mit veraltetem Preis dagegen: kein Angebot.
      const packages = Math.ceil(shortfall / grams)
      out.push({ shop, lines: [{ product: best, packages, unitPrice: offerPrice(inv, best)?.unitPrice }], grams: packages * grams })
    }
  }
  return out
}

/**
 * Bewertung einer Zuordnung Material → Option: Ware + Nebenkosten aller beteiligten Shops, dazu persönliche
 * Gewichte (Vorliebe, Aufwand je weitere Bestellung). Die Gewichte steuern nur die Wahl, angezeigt wird der echte Preis.
 */
function assignmentCost(choice: Option[], terms: Map<string, ShopTerms>, prefs: ShopPreferences = {}): number {
  const subtotals = new Map<string, number>()
  const grams = new Map<string, number>()
  for (const o of choice) {
    subtotals.set(o.shop, (subtotals.get(o.shop) ?? 0) + (o.cost ?? 0))
    grams.set(o.shop, (grams.get(o.shop) ?? 0) + o.grams)
  }
  let total = 0
  let orders = 0
  for (const [shop, sub] of subtotals) {
    const t = terms.get(shop)
    total += shopCosts(sub, t, shop, parcelKg(grams.get(shop) ?? 0)).total
    if (t?.preference === 'prefer') total -= sub * PREFER_MARGIN
    if (!t?.local) orders++
  }
  total += Math.max(0, orders - 1) * (prefs.extraOrderCost ?? 0)
  return Math.round(total * 100) / 100
}

/** Bis zu dieser Zahl an Kombinationen wird exakt durchgerechnet, darüber schrittweise verbessert. */
const EXHAUSTIVE_LIMIT = 50_000

/**
 * Verteilt den Bedarf auf Shops mit der kleinsten Gesamtsumme (Ware + Versand + Gebühren + Mindestbestellwert).
 * Bei wenigen Kombinationen exakt; sonst Heuristik: von mehreren Startpunkten aus werden einzelne Materialien
 * so lange umgehängt, wie es billiger wird.
 */
export function optimizeShops(
  inv: Inventory,
  needs: Need[],
  shops: ShopTerms[],
  today = new Date().toISOString().slice(0, 10),
  prefs: ShopPreferences = {},
): ShoppingSuggestion[] {
  const terms = new Map(shops.map((t) => [t.name, t]))
  const avoided = (o: Option) => terms.get(o.shop)?.preference === 'avoid'
  const items = mergeNeeds(needs)
    .map((need) => ({ need, shortfall: need.grams - materialStock(inv, need.key) }))
    .filter((x) => x.shortfall > 0)
    .map((x) => {
      const all = optionsFor(inv, x.need.key, x.shortfall, today)
      // Gemiedene Shops nur, wenn es das Material sonst nirgends gibt.
      const options = all.some((o) => !avoided(o)) ? all.filter((o) => !avoided(o)) : all
      return { ...x, options }
    })
  const open = items.filter((x) => x.options.length)

  let best: Option[] = open.map((x) => x.options.reduce((a, b) => ((a.cost ?? 0) <= (b.cost ?? 0) ? a : b)))
  let bestCost = assignmentCost(best, terms, prefs)
  const combinations = open.reduce((n, x) => n * x.options.length, 1)

  if (combinations <= EXHAUSTIVE_LIMIT) {
    const idx = open.map(() => 0)
    for (let n = 0; n < combinations; n++) {
      const choice = open.map((x, i) => x.options[idx[i]])
      const cost = assignmentCost(choice, terms, prefs)
      if (cost < bestCost) {
        best = choice
        bestCost = cost
      }
      for (let i = 0; i < idx.length && ++idx[i] === open[i].options.length; i++) idx[i] = 0
    }
  } else {
    // Start bei „jeweils günstigst“ und bei „möglichst alles bei Shop X“ (je Shop), dann einzeln umhängen.
    const starts = [best, ...[...new Set(open.flatMap((x) => x.options.map((o) => o.shop)))].map((shop) => open.map((x, i) => x.options.find((o) => o.shop === shop) ?? best[i]))]
    for (const start of starts) {
      let current = start
      let currentCost = assignmentCost(current, terms, prefs)
      for (let improved = true; improved; ) {
        improved = false
        for (let i = 0; i < open.length; i++)
          for (const o of open[i].options) {
            const choice = current.map((b, j) => (j === i ? o : b))
            const cost = assignmentCost(choice, terms, prefs)
            if (cost < currentCost - 0.001) {
              current = choice
              currentCost = cost
              improved = true
            }
          }
      }
      if (currentCost < bestCost) {
        best = current
        bestCost = currentCost
      }
    }
  }

  const chosen = new Map(open.map((x, i) => [x.need.key, best[i]]))
  return items.map(({ need, shortfall }) => {
    const o = chosen.get(need.key)
    if (!o) return { need, shortfall, lines: [], leftover: 0 }
    return {
      need,
      shortfall,
      lines: o.lines,
      total: o.cost,
      leftover: o.grams - shortfall,
      pricePerKg: o.cost !== undefined ? (o.cost / o.grams) * 1000 : undefined,
      shelfMonths: shelfMonths(need.key),
    }
  })
}
