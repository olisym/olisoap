import Dexie, { type EntityTable } from 'dexie'
import { addDays, needsOf, nextBatchNumber, planConsumption, type Deduction, type Need, type Weighing } from './core/batch'
import { calculate } from './core/calc'
import { barCount } from './core/cost'
import type { Inventory, Lot, Product, Purchase } from './core/inventory'
import type { RecipeInput } from './core/types'
import { KOERPERSEIFE_2 } from './data/seedRecipes'

export interface Recipe {
  id: string
  name: string
  description?: string
  profileId?: string
  notes?: string
  input: RecipeInput
  /** Stückgewicht frisch geschnitten in g, für Stückzahl und Kosten pro Stück. */
  barWeight?: number
  /** Vorgängerversion, aus der dieses Rezept entstanden ist. */
  parentId?: string
  createdAt: string
  updatedAt: string
}

export interface Outflow {
  date: string
  count: number
  /** z. B. "verschenkt an …", "selbst benutzt" */
  note?: string
}

export interface Batch {
  id: string
  number: string
  recipeId: string
  /** Rezept, wie es zum Siedezeitpunkt war. Spätere Änderungen am Rezept ändern die Charge nicht. */
  recipe: Recipe
  date: string
  cureWeeks: number
  bars: number
  deductions: Deduction[]
  shortages: Need[]
  cost: number
  unpriced: string[]
  lyeTemp?: number
  fatTemp?: number
  unmoldedAt?: string
  tested?: boolean
  notes?: string
  weighings: Weighing[]
  outflows: Outflow[]
}

export function readyDate(b: Batch): string {
  return addDays(b.date, b.cureWeeks * 7)
}

export function barsLeft(b: Batch): number {
  return b.bars - b.outflows.reduce((s, o) => s + o.count, 0)
}

export const db = new Dexie('olisoap') as Dexie & {
  recipes: EntityTable<Recipe, 'id'>
  products: EntityTable<Product, 'id'>
  purchases: EntityTable<Purchase, 'id'>
  lots: EntityTable<Lot, 'id'>
  batches: EntityTable<Batch, 'id'>
}

db.version(1).stores({
  recipes: 'id, name, updatedAt',
})

db.version(2).stores({
  recipes: 'id, name, updatedAt',
  products: 'id, name, category, sku',
  purchases: 'id, productId, date',
  lots: 'id, productId',
})

db.version(3).stores({
  recipes: 'id, name, updatedAt',
  products: 'id, name, category, sku',
  purchases: 'id, productId, date',
  lots: 'id, productId',
  batches: 'id, recipeId, date, number',
})

db.on('populate', (tx) => {
  const now = new Date().toISOString()
  tx.table('recipes').add({ ...KOERPERSEIFE_2, id: crypto.randomUUID(), createdAt: now, updatedAt: now })
})

export async function loadInventory(): Promise<Inventory> {
  const [products, purchases, lots] = await Promise.all([db.products.toArray(), db.purchases.toArray(), db.lots.toArray()])
  return { products, purchases, lots }
}

export interface BatchOptions {
  date: string
  cureWeeks: number
  deductStock: boolean
}

/** Siedet ein Rezept: legt die Charge an und bucht auf Wunsch den Verbrauch aus dem Lager ab. */
export async function createBatch(recipe: Recipe, opts: BatchOptions): Promise<Batch> {
  return db.transaction('rw', [db.batches, db.lots, db.products, db.purchases], async () => {
    const result = calculate(recipe.input)
    const plan = planConsumption(await loadInventory(), needsOf(result))
    const existing = (await db.batches.toArray()).map((b) => b.number)
    const batch: Batch = {
      id: crypto.randomUUID(),
      number: nextBatchNumber(opts.date, existing),
      recipeId: recipe.id,
      recipe,
      date: opts.date,
      cureWeeks: opts.cureWeeks,
      bars: barCount(result.batchWeight, recipe.barWeight ?? 100),
      deductions: opts.deductStock ? plan.deductions : [],
      shortages: opts.deductStock ? plan.shortages : [],
      cost: plan.cost,
      unpriced: plan.unpriced,
      weighings: [],
      outflows: [],
    }
    if (opts.deductStock)
      for (const d of plan.deductions) await db.lots.where('id').equals(d.lotId).modify((l) => void (l.gramsLeft -= d.grams))
    await db.batches.add(batch)
    return batch
  })
}

/** Löscht eine Charge, auf Wunsch mit Rückbuchung des Verbrauchs. */
export async function deleteBatch(batch: Batch, restoreStock: boolean): Promise<void> {
  await db.transaction('rw', db.batches, db.lots, async () => {
    if (restoreStock)
      for (const d of batch.deductions) await db.lots.where('id').equals(d.lotId).modify((l) => void (l.gramsLeft += d.grams))
    await db.batches.delete(batch.id)
  })
}

export interface Backup {
  app: 'olisoap'
  version: 3
  exportedAt: string
  recipes: Recipe[]
  products: Product[]
  purchases: Purchase[]
  lots: Lot[]
  batches: Batch[]
}

const TABLES = ['recipes', 'products', 'purchases', 'lots', 'batches'] as const

export async function exportBackup(): Promise<Backup> {
  return {
    app: 'olisoap',
    version: 3,
    exportedAt: new Date().toISOString(),
    recipes: await db.recipes.toArray(),
    batches: await db.batches.toArray(),
    ...(await loadInventory()),
  }
}

/** Spielt eine Sicherung ein. Einträge mit gleicher ID werden überschrieben, andere bleiben erhalten. */
export async function importBackup(data: unknown): Promise<Record<(typeof TABLES)[number], number>> {
  const backup = data as Partial<Backup>
  if (backup?.app !== 'olisoap' || !Array.isArray(backup.recipes)) throw new Error('Keine gültige olisoap-Sicherung.')
  const counts = { recipes: 0, products: 0, purchases: 0, lots: 0, batches: 0 }
  await db.transaction('rw', TABLES, async () => {
    for (const t of TABLES) {
      const rows = (backup[t] ?? []) as never[]
      await db.table(t).bulkPut(rows)
      counts[t] = rows.length
    }
  })
  return counts
}
