import { useLiveQuery } from 'dexie-react-hooks'
import { feasibility, needsOf, type Feasibility } from './core/batch'
import { calculate } from './core/calc'
import type { Inventory } from './core/inventory'
import { effectiveMode, type Mode } from './core/profile'
import { db, loadInventory, type Batch, type OrderItem, type Recipe } from './db'

export interface Workshop {
  recipes: Recipe[]
  batches: Batch[]
  inventory: Inventory
  orderItems: OrderItem[]
  /** Eigene Sudgröße in g Fett (z. B. passend zur Form). Fehlt = Menge aus dem Rezept. */
  batchFat?: number
  /** Gefühlte Kosten je zusätzlicher Bestellung für die Einkaufsplanung. */
  extraOrderCost?: number
}

/** Einstellungsschlüssel (Tabelle settings, wird synchronisiert). */
export const BATCH_FAT_KEY = 'batchFat'
export const EXTRA_ORDER_KEY = 'extraOrderCost'
export const MODE_KEY = 'mode'
export const WATER_KEY = 'waterHardness'

/** Wasserhärte in °dH aus dem Profil; undefined = nicht eingetragen (oder noch am Laden). */
export function useWaterHardness(): number | undefined {
  return useLiveQuery(async () => (await db.settings.get(WATER_KEY))?.value as number | undefined)
}

/** Bedienmodus, gewählt oder abgeleitet; `chosen` sagt, ob schon gewählt wurde. */
export function useMode(): { mode: Mode; chosen: boolean } | undefined {
  return useLiveQuery(async () => {
    const stored = (await db.settings.get(MODE_KEY))?.value
    return { mode: effectiveMode(stored, await db.batches.count()), chosen: stored !== undefined }
  })
}

/** Kurzform für Seiten, die nur wissen müssen, ob Profi-Felder sichtbar sind. Solange unbekannt: wie bisher alles zeigen. */
export function useExpert(): boolean {
  return useMode()?.mode !== 'einsteiger'
}

/** Alle Werkstattdaten auf einmal, live aktualisiert. */
export function useWorkshop(): Workshop | undefined {
  return useLiveQuery(async () => ({
    recipes: await db.recipes.orderBy('name').toArray(),
    batches: await db.batches.orderBy('date').reverse().toArray(),
    inventory: await loadInventory(),
    orderItems: await db.orderItems.toArray(),
    batchFat: (await db.settings.get(BATCH_FAT_KEY))?.value as number | undefined,
    extraOrderCost: (await db.settings.get(EXTRA_ORDER_KEY))?.value as number | undefined,
  }))
}

/**
 * Rezept in der eigenen Sudgröße. Gilt für Seife am Stück; Rasierseife im Tiegel (Mischlauge) behält ihre Menge,
 * weil ein Tiegel viel kleiner ist als eine Kastenform.
 */
export function atBatchSize(recipe: Recipe, batchFat?: number): Recipe {
  if (!batchFat || recipe.input.lyeType === 'dual') return recipe
  return { ...recipe, input: { ...recipe.input, totalFat: batchFat } }
}

export function recipeFeasibility(recipe: Recipe, inventory: Inventory, batchFat?: number): Feasibility | undefined {
  try {
    return feasibility(inventory, needsOf(calculate(atBatchSize(recipe, batchFat).input)))
  } catch {
    return undefined
  }
}

/** Grundseifen mit ihren Varianten, Varianten verwaister Grundseifen zählen als Grundseife. */
export function groupRecipes(recipes: Recipe[]): { base: Recipe; variants: Recipe[] }[] {
  const ids = new Set(recipes.map((r) => r.id))
  return recipes
    .filter((r) => !r.baseId || !ids.has(r.baseId))
    .map((base) => ({ base, variants: recipes.filter((r) => r.baseId === base.id) }))
}

export const today = () => new Date().toISOString().slice(0, 10)
export const de = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('de-DE') : '–')
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5)
