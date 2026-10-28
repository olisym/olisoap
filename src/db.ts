import Dexie, { type EntityTable } from 'dexie'
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

export const db = new Dexie('olisoap') as Dexie & {
  recipes: EntityTable<Recipe, 'id'>
  products: EntityTable<Product, 'id'>
  purchases: EntityTable<Purchase, 'id'>
  lots: EntityTable<Lot, 'id'>
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

db.on('populate', (tx) => {
  const now = new Date().toISOString()
  tx.table('recipes').add({ ...KOERPERSEIFE_2, id: crypto.randomUUID(), createdAt: now, updatedAt: now })
})

export async function loadInventory(): Promise<Inventory> {
  const [products, purchases, lots] = await Promise.all([db.products.toArray(), db.purchases.toArray(), db.lots.toArray()])
  return { products, purchases, lots }
}

export interface Backup {
  app: 'olisoap'
  version: 2
  exportedAt: string
  recipes: Recipe[]
  products: Product[]
  purchases: Purchase[]
  lots: Lot[]
}

const TABLES = ['recipes', 'products', 'purchases', 'lots'] as const

export async function exportBackup(): Promise<Backup> {
  return {
    app: 'olisoap',
    version: 2,
    exportedAt: new Date().toISOString(),
    recipes: await db.recipes.toArray(),
    ...(await loadInventory()),
  }
}

/** Spielt eine Sicherung ein. Einträge mit gleicher ID werden überschrieben, andere bleiben erhalten. */
export async function importBackup(data: unknown): Promise<Record<(typeof TABLES)[number], number>> {
  const backup = data as Partial<Backup>
  if (backup?.app !== 'olisoap' || !Array.isArray(backup.recipes)) throw new Error('Keine gültige olisoap-Sicherung.')
  const counts = { recipes: 0, products: 0, purchases: 0, lots: 0 }
  await db.transaction('rw', TABLES, async () => {
    for (const t of TABLES) {
      const rows = (backup[t] ?? []) as never[]
      await db.table(t).bulkPut(rows)
      counts[t] = rows.length
    }
  })
  return counts
}
