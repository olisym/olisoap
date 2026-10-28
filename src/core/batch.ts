import type { RecipeResult } from './calc'
import { materialKey, materialPrice, materialStock, type Inventory, type Lot, type MaterialKey } from './inventory'

// Chargen: eine gesiedete Seife. Verbrauch wird aus den Gebinden abgebucht (zuerst, was zuerst abläuft).

export interface Need {
  key: MaterialKey
  name: string
  grams: number
}

export interface Deduction {
  lotId: string
  key: MaterialKey
  grams: number
  pricePerKg?: number
  bestBefore?: string
}

export interface Consumption {
  deductions: Deduction[]
  shortages: Need[]
  /** Kosten aus den tatsächlich verbrauchten Gebinden, Fehlmengen zum bekannten Materialpreis. */
  cost: number
  /** Zutaten ohne jeden Preis. */
  unpriced: string[]
}

export function needsOf(r: RecipeResult): Need[] {
  return [
    ...r.fats.map((l) => ({ key: `fat:${l.fat.id}` as MaterialKey, name: l.fat.name, grams: l.grams })),
    ...r.lyeParts.map((p) => ({ key: `lye:${p.type}` as MaterialKey, name: p.type, grams: p.weighed })),
    ...r.additives.map((a) => ({ key: `additive:${a.additive.id}` as MaterialKey, name: a.additive.name, grams: a.grams })),
  ].filter((n) => n.grams > 0)
}

/** Reihenfolge der Entnahme: angebrochene zuerst, dann nach MHD, dann nach Kaufdatum. */
function lotOrder(a: Lot, b: Lot): number {
  return (
    Number(!a.openedAt) - Number(!b.openedAt) ||
    (a.bestBefore ?? '9999').localeCompare(b.bestBefore ?? '9999') ||
    (a.purchasedAt ?? '9999').localeCompare(b.purchasedAt ?? '9999')
  )
}

export function planConsumption(inv: Inventory, needs: Need[]): Consumption {
  const keyOf = new Map(inv.products.map((p) => [p.id, materialKey(p)]))
  const deductions: Deduction[] = []
  const shortages: Need[] = []
  const unpriced: string[] = []
  let cost = 0

  for (const need of needs) {
    let rest = need.grams
    const lots = inv.lots.filter((l) => keyOf.get(l.productId) === need.key && l.gramsLeft > 0).sort(lotOrder)
    for (const lot of lots) {
      if (rest <= 1e-9) break
      const grams = Math.min(rest, lot.gramsLeft)
      deductions.push({ lotId: lot.id, key: need.key, grams, pricePerKg: lot.pricePerKg, bestBefore: lot.bestBefore })
      rest -= grams
    }
    const fallback = materialPrice(inv, need.key)?.pricePerKg
    const taken = deductions.filter((d) => d.key === need.key)
    let priced = true
    for (const d of taken) {
      const price = d.pricePerKg ?? fallback
      if (price === undefined) priced = false
      else cost += (price * d.grams) / 1000
    }
    if (rest > 1e-9) {
      shortages.push({ ...need, grams: rest })
      if (fallback === undefined) priced = false
      else cost += (fallback * rest) / 1000
    }
    if (!priced) unpriced.push(need.name)
  }
  return { deductions, shortages, cost, unpriced }
}

/** Frühestes MHD der verbrauchten Fette: Anhaltspunkt für die Haltbarkeit der Seife. */
export function earliestFatBestBefore(deductions: Deduction[]): string | undefined {
  return deductions
    .filter((d) => d.key.startsWith('fat:') && d.bestBefore)
    .map((d) => d.bestBefore!)
    .sort()[0]
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export interface Weighing {
  date: string
  grams: number
}

export interface CureStatus {
  lossPercent?: number
  /** Gewichtsverlust der letzten Woche in % des Ausgangsgewichts. */
  weeklyLossPercent?: number
  /** Gewicht hat sich seit mindestens 7 Tagen kaum noch verändert (< 0,5 %). */
  stable: boolean
}

// Seife verliert beim Reifen vor allem Wasser. Wenn das Gewicht nicht mehr sinkt, ist sie "durch".
// Das ist ein besserer Indikator als eine feste Wochenzahl, ersetzt aber nicht den Zungen- oder pH-Test.
export function cureStatus(weighings: Weighing[]): CureStatus {
  const w = [...weighings].sort((a, b) => a.date.localeCompare(b.date))
  if (w.length < 2) return { stable: false }
  const first = w[0]
  const last = w[w.length - 1]
  const lossPercent = ((first.grams - last.grams) / first.grams) * 100
  const weekAgo = addDays(last.date, -7)
  const ref = [...w].reverse().find((x) => x.date <= weekAgo)
  if (!ref) return { lossPercent, stable: false }
  const weeklyLossPercent = ((ref.grams - last.grams) / first.grams) * 100
  return { lossPercent, weeklyLossPercent, stable: weeklyLossPercent < 0.5 }
}

/** Neue Chargennummer im Format JJMMTT-n. */
export function nextBatchNumber(date: string, existing: string[]): string {
  const prefix = date.slice(2).replace(/-/g, '')
  const used = existing.filter((n) => n.startsWith(`${prefix}-`)).map((n) => Number(n.split('-')[1]) || 0)
  return `${prefix}-${Math.max(0, ...used) + 1}`
}

export interface Feasibility {
  /** Wie viele Ansätze dieser Größe der Bestand hergibt. */
  count: number
  /** Zutat, die zuerst ausgeht. */
  limiting?: Need
  /** Was für einen Ansatz fehlt. */
  missing: Need[]
}

/** Reicht der Bestand? Zutaten ohne jedes Gebinde im Lager zählen als fehlend. */
export function feasibility(inv: Inventory, needs: Need[]): Feasibility {
  let count = Infinity
  let limiting: Need | undefined
  const missing: Need[] = []
  for (const need of needs) {
    const stock = materialStock(inv, need.key)
    const n = Math.floor(stock / need.grams + 1e-9)
    if (n < count) {
      count = n
      limiting = need
    }
    if (stock < need.grams) missing.push({ ...need, grams: need.grams - stock })
  }
  return { count: Number.isFinite(count) ? count : 0, limiting, missing }
}
