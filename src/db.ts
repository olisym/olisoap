import Dexie, { type EntityTable } from 'dexie'
import { addDays, needsOf, nextBatchNumber, planConsumption, type Deduction, type Need, type Weighing } from './core/batch'
import { calculate } from './core/calc'
import { barCount } from './core/cost'
import { packageGrams, pricePerKg, type Inventory, type Lot, type Product, type Purchase } from './core/inventory'
import type { RecipeInput } from './core/types'
import { TEMPLATES, type TemplateFamily } from './data/templates'
import { findDuplicateRecipes } from './core/dedupe'
import type { ShopTerms } from './core/shops'
import { purchaseId } from './import/salandia'

export interface Recipe {
  id: string
  name: string
  description?: string
  profileId?: string
  notes?: string
  input: RecipeInput
  /** Stückgewicht frisch geschnitten in g, für Stückzahl und Kosten pro Stück. */
  barWeight?: number
  /** Grundseife, von der dieses Rezept eine Variante ist. Fehlt = selbst eine Grundseife. */
  baseId?: string
  /** Veraltet (frühere Versionierung), wird nicht mehr gesetzt. */
  parentId?: string
  createdAt: string
  updatedAt: string
}

export type OrderStatus = 'open' | 'ordered' | 'received'

/** Eine Zeile der Einkaufsliste. Beim Wareneingang wird daraus ein Einkauf und ein Gebinde im Lager. */
export interface OrderItem {
  id: string
  productId: string
  packages: number
  /** Erwarteter Preis pro Packung (aus dem letzten Einkauf), beim Wareneingang korrigierbar. */
  unitPrice?: number
  /** Wofür, z. B. "Körperseife ×2". */
  reason?: string
  status: OrderStatus
  createdAt: string
  orderedAt?: string
  receivedAt?: string
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
  /** Gesamtgewicht aller Stücke beim Schneiden in g. */
  cutWeight?: number
  /** Einzelgewichte der Stücke beim Schneiden in g. */
  cutWeights?: number[]
  /** Etikett gedruckt am. */
  labeledAt?: string
  /** "Am besten verwenden bis" für das Etikett. Fehlt = Vorschlag aus MHD der Fette. */
  bestUse?: string
  /** Etikett-Text für diese Charge, falls abweichend vom Rezept. */
  labelTitle?: string
  labelSubtitle?: string
}

/** Rasierseife im Tiegel wird nicht ausgeformt und geschnitten. */
export function isTub(b: Batch): boolean {
  return b.recipe.input.lyeType === 'dual'
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
  orderItems: EntityTable<OrderItem, 'id'>
  settings: EntityTable<Setting, 'key'>
  shops: EntityTable<ShopTerms, 'name'>
}

/** Einstellungen als Schlüssel-Wert-Paare, z. B. das Etikett-Design. Liegen in der Datenbank, damit sie mit gesichert werden. */
export interface Setting {
  key: string
  value: unknown
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

/** Legt eine Grundseife samt Varianten als Rezepte an. */
/** Feste Kennung für Vorlagen, damit jedes Gerät dieselben Grundseifen anlegt und der Abgleich sie nicht verdoppelt. */
const templateId = (name: string) =>
  'vorlage-' +
  name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** Fester Zeitstempel für Vorlagen: gleiche Vorlage auf zwei Geräten = gleicher Inhalt, kein Konflikt. */
const TEMPLATE_DATE = '2026-01-01T00:00:00.000Z'

export function familyRecipes(family: TemplateFamily): Recipe[] {
  const base: Recipe = { ...structuredClone(family.base), id: templateId(family.base.name), createdAt: TEMPLATE_DATE, updatedAt: TEMPLATE_DATE }
  const variants = family.variants.map((v) => ({ ...structuredClone(v), id: templateId(v.name), baseId: base.id, createdAt: TEMPLATE_DATE, updatedAt: TEMPLATE_DATE }))
  return [base, ...variants]
}

db.version(4).stores({
  recipes: 'id, name, updatedAt',
  products: 'id, name, category, sku',
  purchases: 'id, productId, date',
  lots: 'id, productId',
  batches: 'id, recipeId, date, number',
  orderItems: 'id, productId, status',
})

db.version(5).stores({
  recipes: 'id, name, updatedAt',
  products: 'id, name, category, sku',
  purchases: 'id, productId, date',
  lots: 'id, productId',
  batches: 'id, recipeId, date, number',
  orderItems: 'id, productId, status',
  settings: 'key',
})

// Einkäufe aus dem Salandia-Import hatten den ganzen Artikelnamen in der Kennung (zu lang für die Sync-API).
db.version(6)
  .stores({})
  .upgrade(async (tx) => {
    const purchases = tx.table<Purchase, string>('purchases')
    const old = await purchases.filter((p) => /^salandia:[^:]+:(sku|name):/.test(p.id)).toArray()
    await purchases.bulkDelete(old.map((p) => p.id))
    await purchases.bulkPut(
      old.map((p) => {
        const [, order, ...key] = p.id.split(':')
        return { ...p, id: purchaseId(order, key.join(':')) }
      }),
    )
  })

// Shops mit Versandkosten und Gebühren für den Einkauf über mehrere Anbieter.
db.version(7).stores({ shops: 'name' })

// Neue Vorlagen-Varianten für Nutzer mit vorhandener Datenbank nachreichen, wenn die Grundseife noch da ist.
const NEW_TEMPLATE_VARIANTS = ['vorlage-koerperseife-heiss']
db.version(8)
  .stores({})
  .upgrade(async (tx) => {
    const recipes = tx.table<Recipe, string>('recipes')
    for (const family of TEMPLATES) {
      const [base, ...variants] = familyRecipes(family)
      if (!(await recipes.get(base.id))) continue
      for (const v of variants) if (NEW_TEMPLATE_VARIANTS.includes(v.id) && !(await recipes.get(v.id))) await recipes.add(v)
    }
  })

db.on('populate', (tx) => {
  tx.table('recipes').bulkAdd(TEMPLATES.flatMap(familyRecipes))
})

/**
 * Entfernt unveränderte doppelte Rezepte und hängt Chargen und Varianten auf die behaltene Fassung um.
 * Gibt die Zahl der entfernten Rezepte zurück.
 */
export async function removeDuplicateRecipes(): Promise<number> {
  return db.transaction('rw', db.recipes, db.batches, async () => {
    const batches = await db.batches.toArray()
    const { remove, replace } = findDuplicateRecipes(await db.recipes.toArray(), batches.map((b) => b.recipeId))
    if (!remove.length) return 0
    for (const b of batches) if (replace.has(b.recipeId)) await db.batches.update(b.id, { recipeId: replace.get(b.recipeId)! })
    for (const r of await db.recipes.toArray()) if (r.baseId && replace.has(r.baseId)) await db.recipes.update(r.id, { baseId: replace.get(r.baseId)! })
    await db.recipes.bulkDelete(remove)
    return remove.length
  })
}

/** Löscht alle Rezepte und legt die Grundseifen neu an. Chargen bleiben erhalten (sie enthalten eine Kopie ihres Rezepts). */
export async function resetRecipes(): Promise<void> {
  await db.transaction('rw', db.recipes, async () => {
    await db.recipes.clear()
    await db.recipes.bulkAdd(TEMPLATES.flatMap(familyRecipes))
  })
}

export async function loadInventory(): Promise<Inventory> {
  const [products, purchases, lots] = await Promise.all([db.products.toArray(), db.purchases.toArray(), db.lots.toArray()])
  return { products, purchases, lots }
}

export interface BatchOptions {
  date: string
  cureWeeks: number
  deductStock: boolean
  /** Weitere Angaben aus dem Siedeprotokoll (Temperaturen, Notizen). */
  extra?: Pick<Partial<Batch>, 'lyeTemp' | 'fatTemp' | 'notes'>
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
      ...opts.extra,
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

/** Wareneingang: Einkauf in die Preishistorie, Ware als Gebinde ins Lager. */
export async function receiveOrderItem(item: OrderItem, unitPrice: number | undefined, bestBefore?: string): Promise<void> {
  await db.transaction('rw', [db.orderItems, db.products, db.purchases, db.lots], async () => {
    const product = await db.products.get(item.productId)
    if (!product) throw new Error('Artikel nicht gefunden')
    const today = new Date().toISOString().slice(0, 10)
    if (unitPrice !== undefined)
      await db.purchases.add({ id: crypto.randomUUID(), productId: product.id, date: today, quantity: item.packages, unitPrice })
    const grams = packageGrams(product)
    if (grams)
      for (let i = 0; i < item.packages; i++)
        await db.lots.add({
          id: crypto.randomUUID(),
          productId: product.id,
          purchasedAt: today,
          gramsInitial: grams,
          gramsLeft: grams,
          pricePerKg: unitPrice !== undefined ? pricePerKg(product, unitPrice) : undefined,
          bestBefore,
        })
    await db.orderItems.update(item.id, { status: 'received', receivedAt: today, unitPrice })
  })
}

export interface Backup {
  app: 'olisoap'
  version: number
  exportedAt: string
  recipes: Recipe[]
  products: Product[]
  purchases: Purchase[]
  lots: Lot[]
  batches: Batch[]
  orderItems: OrderItem[]
  settings: Setting[]
  shops?: ShopTerms[]
}

const TABLES = ['recipes', 'products', 'purchases', 'lots', 'batches', 'orderItems', 'settings', 'shops'] as const

export async function exportBackup(): Promise<Backup> {
  return {
    app: 'olisoap',
    version: 7,
    exportedAt: new Date().toISOString(),
    recipes: await db.recipes.toArray(),
    batches: await db.batches.toArray(),
    orderItems: await db.orderItems.toArray(),
    settings: await db.settings.toArray(),
    shops: await db.shops.toArray(),
    ...(await loadInventory()),
  }
}

/** Spielt eine Sicherung ein. Einträge mit gleicher ID werden überschrieben, andere bleiben erhalten. */
export async function importBackup(data: unknown): Promise<Record<(typeof TABLES)[number], number>> {
  const backup = data as Partial<Backup>
  if (backup?.app !== 'olisoap' || !Array.isArray(backup.recipes)) throw new Error('Keine gültige olisoap-Sicherung.')
  const counts = { recipes: 0, products: 0, purchases: 0, lots: 0, batches: 0, orderItems: 0, settings: 0, shops: 0 }
  await db.transaction('rw', TABLES, async () => {
    for (const t of TABLES) {
      const rows = (backup[t] ?? []) as never[]
      await db.table(t).bulkPut(rows)
      counts[t] = rows.length
    }
  })
  return counts
}
