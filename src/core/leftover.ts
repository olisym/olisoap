import { addDays, earliestFatBestBefore, type Deduction, type Need } from './batch'
import { calculate } from './calc'
import { materialKey, type Inventory, type MaterialKey } from './inventory'
import { suggestBestUse } from './label'
import { MONTHS_PER_BATCH, shelfMonths } from './shelfLife'
import type { RecipeInput } from './types'

// „Übrig“: was weg sollte, bevor es verdirbt. Fertige Seife nach „am besten verwenden bis“, offene oder ablaufende
// Fette mit den Rezepten, die sie aufbrauchen. Ziel: Verluste durch Ranzigwerden vermeiden.

/** Was „Übrig“ von einer Charge braucht (Ausschnitt aus Batch, damit der Kern ohne Datenbank testbar bleibt). */
export interface BatchLike {
  id: string
  number: string
  date: string
  cureWeeks: number
  bars: number
  outflows: { count: number }[]
  deductions: Deduction[]
  bestUse?: string
  recipe: { name: string; input: RecipeInput }
}

export interface SoapLeft {
  batchId: string
  name: string
  number: string
  left: number
  readyDate: string
  ready: boolean
  /** Am besten verwenden bis: vom Etikett, sonst Vorschlag aus MHD der Fette und Linolsäure (Faustregel). */
  bestUse: string
}

/** Fertige und reifende Seife mit Reststück: fertige zuerst (nur die kann man benutzen), darin nach „am besten bis“. */
export function soapLeftovers(batches: BatchLike[], today: string): SoapLeft[] {
  return batches
    .map((b) => {
      const left = b.bars - b.outflows.reduce((s, o) => s + o.count, 0)
      const readyDate = addDays(b.date, b.cureWeeks * 7)
      let pufa = 0
      try {
        pufa = calculate(b.recipe.input).properties.polyunsaturated
      } catch {
        // Unvollständiges Rezept: Vorschlag ohne Linolsäure-Abschlag
      }
      const bestUse = b.bestUse ?? suggestBestUse(b.date, pufa, earliestFatBestBefore(b.deductions))
      return { batchId: b.id, name: b.recipe.name, number: b.number, left, readyDate, ready: readyDate <= today, bestUse }
    })
    .filter((s) => s.left > 0)
    .sort((a, b) => Number(b.ready) - Number(a.ready) || a.bestUse.localeCompare(b.bestUse) || a.readyDate.localeCompare(b.readyDate))
}

export interface FatAtRisk {
  key: MaterialKey
  name: string
  /** Menge, die bis `until` verbraucht sein sollte. */
  grams: number
  /** Frühestes Ende: MHD oder Anbruch + Haltbarkeit (Faustregel). */
  until: string
  /** Woher das Ende kommt. */
  reason: 'bestBefore' | 'opened'
  /** Rezepte, die dieses Fett verbrauchen, mit der Menge je Sud; wer am meisten braucht, zuerst. */
  uses: { recipeId: string; name: string; gramsPerBatch: number; batches: number }[]
  /** Wie viele Sude bis `until` realistisch sind (ein Sud alle `MONTHS_PER_BATCH` Monate, der erste sofort). */
  possibleBatches: number
}

const addMonths = (iso: string, months: number) => addDays(iso, Math.round(months * 30.4))

/**
 * Fette, die innerhalb von `horizonDays` ablaufen oder schon abgelaufen sind. Ende je Gebinde: MHD, bei angebrochenen
 * Gebinden höchstens Anbruch plus Haltbarkeit offen (Faustregel aus `shelfLife.ts`).
 */
export function fatsAtRisk(
  inv: Inventory,
  recipes: { id: string; name: string; needs: Need[] }[],
  today: string,
  horizonDays = 90,
  names: (key: MaterialKey) => string = (k) => k,
): FatAtRisk[] {
  const limit = addDays(today, horizonDays)
  const byId = new Map(inv.products.map((p) => [p.id, p]))
  const out = new Map<MaterialKey, FatAtRisk>()
  for (const lot of inv.lots) {
    if (lot.gramsLeft <= 0) continue
    const product = byId.get(lot.productId)
    const key = product && materialKey(product)
    if (!key?.startsWith('fat:')) continue
    const months = shelfMonths(key)
    const opened = lot.openedAt && months !== undefined ? addMonths(lot.openedAt, months) : undefined
    const until = [lot.bestBefore, opened].filter((d): d is string => !!d).sort()[0]
    if (!until || until > limit) continue
    const reason = until === opened && (!lot.bestBefore || opened < lot.bestBefore) ? 'opened' : 'bestBefore'
    const entry = out.get(key)
    if (!entry) out.set(key, { key, name: names(key), grams: lot.gramsLeft, until, reason, uses: [], possibleBatches: 0 })
    else {
      entry.grams += lot.gramsLeft
      if (until < entry.until) Object.assign(entry, { until, reason })
    }
  }
  for (const f of out.values()) {
    const daysLeft = (Date.parse(f.until) - Date.parse(today)) / 864e5
    f.possibleBatches = daysLeft < 0 ? 0 : 1 + Math.floor(daysLeft / (MONTHS_PER_BATCH * 30.4))
    f.uses = recipes
      .map((r) => ({ recipeId: r.id, name: r.name, gramsPerBatch: r.needs.find((n) => n.key === f.key)?.grams ?? 0 }))
      .filter((u) => u.gramsPerBatch > 0)
      .map((u) => ({ ...u, batches: Math.ceil(f.grams / u.gramsPerBatch) }))
      .sort((a, b) => b.gramsPerBatch - a.gramsPerBatch)
  }
  return [...out.values()].sort((a, b) => a.until.localeCompare(b.until))
}
