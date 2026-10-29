import { addDays, needsOf } from '../core/batch'
import { calculate } from '../core/calc'
import { bestProduct, packageGrams, pricePerKg, type MaterialKey, type Product } from '../core/inventory'
import { ADDITIVES_BY_ID } from '../data/additives'
import { FATS_BY_ID } from '../data/fats'
import { createBatch, db, loadInventory, type Batch, type Recipe } from '../db'

// Beispiel-Werkstatt für den Demo-Link: Vorrat, Einkäufe und Chargen in allen Etappen, relativ zu heute,
// damit „Heute zu tun“, Reifeprozess und Hinweise immer etwas zeigen. Nur für einen leeren Browser gedacht.

/** Reproduzierbare Pseudo-Zufallszahlen, damit die Demo bei jedem Laden gleich aussieht. */
function random(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

/** Typischer Gewichtsverlust beim Reifen: schnell in den ersten Wochen, dann flach (ca. 11 % nach 6 Wochen). */
const lossAfter = (days: number) => 0.12 * (1 - Math.exp(-days / 12))

/** Preise für Ware, die es im Katalog nicht gibt (Supermarkt bzw. anderer Shop), Stand Herbst 2026, grob. */
const LOCAL_PRICE: Record<string, { supplier: string; price: number }> = {
  'fat:olive': { supplier: 'Supermarkt', price: 9.99 },
  'fat:sunflower-ho': { supplier: 'Supermarkt', price: 3.49 },
}

export async function loadDemoScenario(today = new Date().toISOString().slice(0, 10)): Promise<void> {
  const rnd = random(42)
  const day = (offset: number) => addDays(today, offset)

  // Eine Variante mit ätherischem Öl, wie man sie nach ein paar Suden hätte.
  const base = (await db.recipes.get('vorlage-koerperseife'))!
  const lavender: Recipe = {
    ...structuredClone(base),
    id: 'demo-koerperseife-lavendel',
    name: 'Körperseife Lavendel',
    baseId: base.id,
    input: {
      ...base.input,
      additives: [...base.input.additives, { additiveId: 'eo-lavender', percentOfFats: 1, reason: 'Duft. 1 % bleibt bei empfindlicher Haut im üblichen Rahmen.' }],
    },
    createdAt: `${day(-100)}T10:00:00.000Z`,
    updatedAt: `${day(-100)}T10:00:00.000Z`,
  }
  await db.recipes.put(lavender)
  const recipe = async (id: string) => (await db.recipes.get(id))!

  const plan: { recipe: Recipe; date: number }[] = [
    { recipe: await recipe('vorlage-koerperseife'), date: -75 },
    { recipe: await recipe('vorlage-haarseife'), date: -38 },
    { recipe: await recipe('vorlage-rasierseife'), date: -21 },
    { recipe: await recipe('vorlage-haarseife-spar'), date: -12 },
    { recipe: lavender, date: -1 },
  ]

  // Vorrat: je Material genug für alle Sude plus Reserve, gekauft vor drei Monaten.
  const need = new Map<MaterialKey, number>()
  for (const p of plan) for (const n of needsOf(calculate(p.recipe.input))) need.set(n.key, (need.get(n.key) ?? 0) + n.grams)
  for (const [key, grams] of need) {
    const inv = await loadInventory()
    let product = bestProduct(inv, key)
    if (!product) {
      const local = LOCAL_PRICE[key] ?? { supplier: 'Sonstige', price: 12 }
      const [kind, id] = key.split(':')
      product = {
        id: crypto.randomUUID(),
        name: (kind === 'fat' ? FATS_BY_ID[id]?.name : ADDITIVES_BY_ID[id]?.name) ?? id,
        supplier: local.supplier,
        category: kind === 'fat' ? 'fat' : 'additive',
        ...(kind === 'fat' ? { fatId: id } : { additiveId: id }),
        unit: kind === 'fat' ? 'ml' : 'g',
        packageSize: 1000,
        listPrice: local.price,
        listPriceDate: day(-90),
      } satisfies Product
      await db.products.add(product)
    }
    const pkg = packageGrams(product) ?? 1000
    const packages = Math.max(1, Math.ceil((grams * 1.3) / pkg))
    const unitPrice = product.listPrice ?? 10
    const purchasedAt = day(-90 - Math.round(rnd() * 60))
    await db.purchases.add({ id: crypto.randomUUID(), productId: product.id, date: purchasedAt, quantity: packages, unitPrice })
    // Avocadoöl läuft bald ab (zeigt den Hinweis), Rizinus ist angebrochen, der Rest hält 18 Monate.
    const bestBefore = key === 'fat:avocado' ? day(25) : addDays(purchasedAt, 540)
    await db.lots.add({
      id: crypto.randomUUID(),
      productId: product.id,
      purchasedAt,
      gramsInitial: pkg * packages,
      gramsLeft: pkg * packages,
      pricePerKg: pricePerKg(product, unitPrice),
      bestBefore,
      ...(key === 'fat:castor' && { openedAt: day(-60) }),
    })
  }

  // Chargen über den echten Ablauf anlegen (Abbuchung, Kosten), danach die Etappen nachtragen.
  const batches: Batch[] = []
  for (const p of plan) batches.push(await createBatch(p.recipe, { date: day(p.date), cureWeeks: p.recipe.input.lyeType === 'dual' ? 8 : 6, deductStock: true }))
  const [body, hair, shave, hairSpar] = batches

  const cut = (b: Batch, cutDay: string) => {
    const avg = calculate(b.recipe.input).batchWeight / b.bars
    const cutWeights = Array.from({ length: b.bars }, () => Math.round(avg * (0.95 + rnd() * 0.08)))
    return { unmoldedAt: cutDay, cutWeights, cutWeight: cutWeights.reduce((s, w) => s + w, 0) }
  }
  /** Wöchentliche Wägung eines Probestücks seit dem Schneiden, bis heute oder bis `until`. */
  const weighings = (from: string, sample: number, until = today) => {
    const out = []
    for (let d = 0; addDays(from, d) <= until; d += 7) out.push({ date: addDays(from, d), grams: Math.round(sample * (1 - lossAfter(d + 1)) * 10) / 10 })
    return out
  }

  const bodyCut = cut(body, day(-74))
  await db.batches.update(body.id, {
    ...bodyCut,
    weighings: weighings(day(-74), bodyCut.cutWeights[0], day(-25)),
    tested: true,
    labeledAt: day(-28),
    lyeTemp: 35,
    fatTemp: 38,
    outflows: [
      { date: day(-26), count: 4, note: 'verschenkt' },
      { date: day(-9), count: 2, note: 'selbst benutzt' },
    ],
  })
  const hairCut = cut(hair, day(-37))
  // Letzte Wägung vor sechs Tagen: die nächste ist bald fällig, reif ist sie in wenigen Tagen.
  await db.batches.update(hair.id, { ...hairCut, weighings: weighings(day(-37), hairCut.cutWeights[0], day(-6)) })
  // Tiegel: kein Schneiden, gewogen wird der ganze Tiegel.
  const tub = Math.round(calculate(shave.recipe.input).batchWeight / shave.bars)
  await db.batches.update(shave.id, { weighings: weighings(day(-21), tub, day(-1)), notes: 'Im Tiegel, Deckel erst drauf, wenn die Oberfläche trocken ist.' })
  const sparCut = cut(hairSpar, day(-11))
  // Wägung überfällig: erscheint unter „Heute zu tun“.
  await db.batches.update(hairSpar.id, { ...sparCut, weighings: weighings(day(-11), sparCut.cutWeights[0], day(-11)) })
  // Die Lavendel-Charge von gestern wartet aufs Schneiden.

  // Einkauf: eine Bestellung unterwegs, ein Posten auf der Liste.
  const inv = await loadInventory()
  const now = new Date().toISOString()
  const castor = bestProduct(inv, 'fat:castor')
  const rosemary = bestProduct(inv, 'additive:eo-rosemary')
  if (castor)
    await db.orderItems.add({ id: crypto.randomUUID(), productId: castor.id, packages: 1, unitPrice: castor.listPrice, reason: 'Haarseife ×2', status: 'ordered', createdAt: now, orderedAt: day(-2) })
  if (rosemary) await db.orderItems.add({ id: crypto.randomUUID(), productId: rosemary.id, packages: 1, unitPrice: rosemary.listPrice, status: 'open', createdAt: now })
}
