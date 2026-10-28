import Dexie, { type EntityTable } from 'dexie'
import type { RecipeInput } from './core/types'
import { KOERPERSEIFE_2 } from './data/seedRecipes'

export interface Recipe {
  id: string
  name: string
  description?: string
  profileId?: string
  notes?: string
  input: RecipeInput
  /** Vorgängerversion, aus der dieses Rezept entstanden ist. */
  parentId?: string
  createdAt: string
  updatedAt: string
}

export const db = new Dexie('olisoap') as Dexie & {
  recipes: EntityTable<Recipe, 'id'>
}

db.version(1).stores({
  recipes: 'id, name, updatedAt',
})

db.on('populate', (tx) => {
  const now = new Date().toISOString()
  tx.table('recipes').add({ ...KOERPERSEIFE_2, id: crypto.randomUUID(), createdAt: now, updatedAt: now })
})

export interface Backup {
  app: 'olisoap'
  version: 1
  exportedAt: string
  recipes: Recipe[]
}

export async function exportBackup(): Promise<Backup> {
  return { app: 'olisoap', version: 1, exportedAt: new Date().toISOString(), recipes: await db.recipes.toArray() }
}

export async function importBackup(data: unknown): Promise<number> {
  const backup = data as Partial<Backup>
  if (backup?.app !== 'olisoap' || !Array.isArray(backup.recipes)) throw new Error('Keine gültige olisoap-Sicherung.')
  await db.recipes.bulkPut(backup.recipes)
  return backup.recipes.length
}
