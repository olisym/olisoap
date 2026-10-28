import { useLiveQuery } from 'dexie-react-hooks'
import { feasibility, needsOf, type Feasibility } from './core/batch'
import { calculate } from './core/calc'
import type { Inventory } from './core/inventory'
import { db, loadInventory, type Batch, type OrderItem, type Recipe } from './db'

export interface Workshop {
  recipes: Recipe[]
  batches: Batch[]
  inventory: Inventory
  orderItems: OrderItem[]
}

/** Alle Werkstattdaten auf einmal, live aktualisiert. */
export function useWorkshop(): Workshop | undefined {
  return useLiveQuery(async () => ({
    recipes: await db.recipes.orderBy('name').toArray(),
    batches: await db.batches.orderBy('date').reverse().toArray(),
    inventory: await loadInventory(),
    orderItems: await db.orderItems.toArray(),
  }))
}

export function recipeFeasibility(recipe: Recipe, inventory: Inventory): Feasibility | undefined {
  try {
    return feasibility(inventory, needsOf(calculate(recipe.input)))
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
