import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'

// Migrationen laufen auf den echten Daten des Nutzers: hier gegen eine Datenbank im alten Stand prüfen.

describe('Migration v9: Anbruchdatum aus den Chargen', () => {
  it('trägt das früheste Siededatum nach, lässt vorhandene Daten und unbenutzte Gebinde in Ruhe', async () => {
    // Alter Stand: Version 8 mit denselben Tabellen
    const old = new Dexie('olisoap')
    old.version(8).stores({
      recipes: 'id, name, updatedAt',
      products: 'id, name, category, sku',
      purchases: 'id, productId, date',
      lots: 'id, productId',
      batches: 'id, recipeId, date, number',
      orderItems: 'id, productId, status',
      settings: 'key',
      shops: 'name',
    })
    await old.open()
    await old.table('lots').bulkAdd([
      { id: 'used', productId: 'p', gramsInitial: 1000, gramsLeft: 400 },
      { id: 'known', productId: 'p', gramsInitial: 1000, gramsLeft: 400, openedAt: '2026-01-05' },
      { id: 'unused', productId: 'p', gramsInitial: 1000, gramsLeft: 1000 },
    ])
    await old.table('batches').bulkAdd([
      { id: 'b2', recipeId: 'r', date: '2026-09-01', number: '2', deductions: [{ lotId: 'used', key: 'fat:shea', grams: 300 }, { lotId: 'known', key: 'fat:shea', grams: 100 }] },
      { id: 'b1', recipeId: 'r', date: '2026-07-15', number: '1', deductions: [{ lotId: 'used', key: 'fat:shea', grams: 300 }] },
    ])
    old.close()

    // Neuer Stand: die App öffnet ihre Datenbank mit allen Versionen
    const { db } = await import('./db')
    await db.open()
    const lots = Object.fromEntries((await db.lots.toArray()).map((l) => [l.id, l.openedAt]))
    expect(lots).toEqual({ used: '2026-07-15', known: '2026-01-05', unused: undefined })
    // Vorlagen werden bei vorhandener Datenbank nicht neu angelegt (kein „populate“)
    expect(await db.recipes.count()).toBe(0)
    db.close()
  })
})

describe('Sieden setzt das Anbruchdatum', () => {
  it('beim ersten Abbuchen, ein vorhandenes bleibt', async () => {
    const { db, createBatch } = await import('./db')
    const { REFERENCE_2000G } = await import('./core/fixtures')
    await db.open()
    await db.products.add({ id: 'shea', name: 'Shea 5 kg', category: 'fat', fatId: 'shea', unit: 'g', packageSize: 5000 })
    await db.lots.bulkAdd([
      { id: 'neu', productId: 'shea', gramsInitial: 500, gramsLeft: 500 },
      { id: 'alt', productId: 'shea', gramsInitial: 5000, gramsLeft: 5000, openedAt: '2026-05-01' },
    ])
    const now = new Date().toISOString()
    await createBatch({ id: 'r', name: 'Test', input: REFERENCE_2000G, createdAt: now, updatedAt: now }, { date: '2026-10-31', cureWeeks: 5, deductStock: true })
    // Angebrochene zuerst: „alt“ deckt die 700 g Shea allein, „neu“ bleibt unberührt
    expect((await db.lots.get('alt'))?.openedAt).toBe('2026-05-01')
    expect((await db.lots.get('neu'))?.openedAt).toBeUndefined()
    await db.lots.update('alt', { gramsLeft: 100 })
    await createBatch({ id: 'r', name: 'Test', input: REFERENCE_2000G, createdAt: now, updatedAt: now }, { date: '2026-11-07', cureWeeks: 5, deductStock: true })
    expect((await db.lots.get('neu'))?.openedAt).toBe('2026-11-07')
    db.close()
  })
})
