import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { NumberField } from '../components/NumberField'
import { PageHeader } from '../components/ui'
import { StockOverview } from './StockOverview'
import {
  bestProduct,
  CATEGORY_LABELS,
  materialKey,
  type MaterialKey,
  packageGrams,
  offerPrice,
  pricePerKg,
  type Inventory,
  type Lot,
  type Product,
  type ProductCategory,
  type ProductUnit,
} from '../core/inventory'
import { ADDITIVES } from '../data/additives'
import { FATS } from '../data/fats'
import { db, loadInventory, type Recipe } from '../db'
import { fmt } from '../format'
import { importSalandia } from '../import/salandia'
import { importSalandiaCatalog, isCatalog } from '../import/salandiaCatalog'
import { asShopCatalog, importShopCatalog } from '../import/shopCatalog'
import { ChevronRight, Upload } from 'lucide-react'
import { Leftovers } from './Leftovers'

const CATEGORIES = Object.keys(CATEGORY_LABELS) as ProductCategory[]
/** Kategorien, die in Seifenrezepten verrechnet werden. */
const SOAP_CATEGORIES: ProductCategory[] = ['fat', 'lye', 'additive']

export function InventoryPage() {
  const tab = ({ isActive }: { isActive: boolean }) =>
    `inline-flex min-h-10 items-center rounded-lg px-4 text-sm font-medium transition-colors ${isActive ? 'bg-surface text-accent shadow-sm' : 'text-muted hover:text-ink'}`
  return (
    <section>
      <PageHeader eyebrow="Vorrat" title="Was ist da?" />
      <nav className="mb-6 inline-flex flex-wrap gap-1 rounded-xl bg-surface-2 p-1" aria-label="Vorrat-Bereiche">
        <NavLink to="/lager" end className={tab}>
          Übersicht
        </NavLink>
        <NavLink to="/lager/uebrig" className={tab}>
          Übrig
        </NavLink>
        <NavLink to="/lager/gebinde" className={tab}>
          Gebinde
        </NavLink>
        <NavLink to="/lager/artikel" className={tab}>
          Artikel & Preise
        </NavLink>
        <NavLink to="/lager/import" className={tab}>
          Import
        </NavLink>
      </nav>
      <Routes>
        <Route index element={<StockOverview />} />
        <Route path="uebrig" element={<Leftovers />} />
        <Route path="gebinde" element={<Stock />} />
        <Route path="artikel" element={<Products />} />
        <Route path="import" element={<Import />} />
      </Routes>
    </section>
  )
}

function latestPrice(productId: string, purchases: { productId: string; date: string; unitPrice: number }[]) {
  return purchases.filter((p) => p.productId === productId).sort((a, b) => b.date.localeCompare(a.date))[0]
}

function materialLabel(p: Product): string | undefined {
  if (p.fatId) return FATS.find((f) => f.id === p.fatId)?.name
  if (p.additiveId) return ADDITIVES.find((a) => a.id === p.additiveId)?.name
  return p.lyeType
}

function Stock() {
  const inv = useLiveQuery(loadInventory)
  const [adding, setAdding] = useState(false)
  if (!inv) return null
  const byId = new Map(inv.products.map((p) => [p.id, p]))
  const lots = inv.lots
    .map((l) => ({ lot: l, product: byId.get(l.productId) }))
    .filter((x): x is { lot: Lot; product: Product } => !!x.product)
    .sort((a, b) => CATEGORIES.indexOf(a.product.category) - CATEGORIES.indexOf(b.product.category) || a.product.name.localeCompare(b.product.name))
  const today = new Date().toISOString().slice(0, 10)
  const soon = new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10)
  const update = (id: string, patch: Partial<Lot>) => db.lots.update(id, patch)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" onClick={() => setAdding(!adding)}>
          + Gebinde einlagern
        </button>
        <p className="text-sm text-muted">
          Lagerwert: <b>{fmt(lots.reduce((s, { lot }) => s + ((lot.pricePerKg ?? 0) * lot.gramsLeft) / 1000, 0), 2)} €</b>
        </p>
      </div>
      {adding && <AddLot onDone={() => setAdding(false)} />}
      {lots.length === 0 && !adding && (
        <p className="text-sm text-muted">
          Noch nichts eingelagert. Tipp: Erst unter „Import“ deine Salandia-Bestellungen einlesen, dann hier die Gebinde anlegen, die
          tatsächlich im Regal stehen.
        </p>
      )}
      {lots.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="pb-2 font-normal">Artikel</th>
                <th className="w-32 pb-2 font-normal">Rest</th>
                <th className="pb-2 text-right font-normal">€/kg</th>
                <th className="pb-2 pl-3 font-normal">Geöffnet</th>
                <th className="pb-2 pl-3 font-normal">MHD</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lots.map(({ lot, product }) => {
                const mhdClass = !lot.bestBefore ? '' : lot.bestBefore < today ? 'text-red-600 font-semibold' : lot.bestBefore < soon ? 'text-amber-600' : ''
                return (
                  <tr key={lot.id} className="border-t border-line">
                    <td className="py-1.5 pr-2">
                      <div>{product.name}</div>
                      <div className="text-xs text-muted">
                        {CATEGORY_LABELS[product.category]}
                        {materialLabel(product) && ` · ${materialLabel(product)}`}
                        {lot.purchasedAt && ` · gekauft ${new Date(lot.purchasedAt).toLocaleDateString('de-DE')}`}
                      </div>
                    </td>
                    <td className="pr-2">
                      <NumberField value={lot.gramsLeft} digits={0} suffix="g" ariaLabel="Restmenge" onChange={(v) => update(lot.id, { gramsLeft: v ?? 0 })} />
                    </td>
                    <td className="text-right tabular-nums">{lot.pricePerKg !== undefined ? fmt(lot.pricePerKg, 2) : '–'}</td>
                    <td className="pl-3">
                      <input type="date" className="field" value={lot.openedAt ?? ''} onChange={(e) => update(lot.id, { openedAt: e.target.value || undefined })} />
                    </td>
                    <td className={`pl-3 ${mhdClass}`}>
                      <input type="date" className="field" value={lot.bestBefore ?? ''} onChange={(e) => update(lot.id, { bestBefore: e.target.value || undefined })} />
                    </td>
                    <td>
                      <button className="btn-icon" aria-label="Gebinde entfernen" onClick={() => confirm('Gebinde entfernen?') && db.lots.delete(lot.id)}>
                        ×
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function AddLot({ onDone }: { onDone: () => void }) {
  const inv = useLiveQuery(loadInventory)
  const [productId, setProductId] = useState('')
  const [count, setCount] = useState<number | undefined>(1)
  const [price, setPrice] = useState<number>()
  const [bestBefore, setBestBefore] = useState('')
  const [weighed, setWeighed] = useState<number>()
  if (!inv) return null
  const products = inv.products
    .filter((p) => p.unit !== 'Stk')
    .sort((a, b) => Number(!SOAP_CATEGORIES.includes(a.category)) - Number(!SOAP_CATEGORIES.includes(b.category)) || a.name.localeCompare(b.name))
  const product = products.find((p) => p.id === productId)
  const nominal = product ? (packageGrams(product) ?? 0) * (count ?? 0) : 0
  const grams = weighed ?? nominal

  function choose(id: string) {
    setProductId(id)
    const p = inv!.products.find((x) => x.id === id)
    setPrice(p && offerPrice(inv!, p)?.unitPrice)
  }

  async function save() {
    if (!product || !grams) return
    const last = latestPrice(product.id, inv!.purchases)
    await db.lots.add({
      id: crypto.randomUUID(),
      productId: product.id,
      purchasedAt: last?.date,
      gramsInitial: grams,
      gramsLeft: grams,
      pricePerKg: price !== undefined && count ? (price * count * 1000) / grams : undefined,
      bestBefore: bestBefore || undefined,
    })
    // Gewogene Ware nach Volumen: Dichte am Artikel merken, damit Preise und künftige Gebinde stimmen.
    if (weighed && product.unit === 'ml' && count) await db.products.update(product.id, { density: weighed / (product.packageSize * count) })
    onDone()
  }

  return (
    <div className="card grid gap-3 sm:grid-cols-[1fr_7rem_9rem_9rem_10rem_auto] sm:items-end">
      <label className="label">
        Artikel
        <select className="field" value={productId} onChange={(e) => choose(e.target.value)}>
          <option value="">Bitte wählen …</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="label">
        Packungen
        <NumberField value={count} digits={1} onChange={setCount} />
      </label>
      <label className="label">
        Preis/Packung
        <NumberField value={price} digits={2} suffix="€" onChange={setPrice} />
      </label>
      <label className="label" title="Inhalt ohne Gefäß. Leer = aus Packungsgröße und Dichte berechnet.">
        Netto gewogen
        <NumberField value={weighed} digits={0} suffix="g" placeholder={nominal ? fmt(nominal) : ''} onChange={setWeighed} />
      </label>
      <label className="label">
        MHD
        <input type="date" className="field" value={bestBefore} onChange={(e) => setBestBefore(e.target.value)} />
      </label>
      <button className="btn-primary" disabled={!grams} onClick={save}>
        {grams ? `${fmt(grams)} g einlagern` : 'Einlagern'}
      </button>
      {product?.unit === 'ml' && (
        <p className="text-xs text-muted sm:col-span-6">
          {fmt(product.packageSize)} ml × Dichte {fmt(packageGrams({ ...product, packageSize: 1 }) ?? 1, 3)} → {fmt(packageGrams(product) ?? 0)} g pro
          Packung. Genauer: Inhalt einmal netto wiegen (Gefäß tarieren oder leer nachwiegen). Die Dichte wird dann am Artikel
          gespeichert und gilt für alle weiteren Gebinde.
        </p>
      )}
    </div>
  )
}

type Scope = 'mine' | 'all'

/** Materialien, die in mindestens einem Rezept vorkommen. */
function recipeMaterials(recipes: Recipe[]): Set<MaterialKey> {
  const keys = new Set<MaterialKey>()
  for (const r of recipes) {
    for (const f of r.input.fats) keys.add(`fat:${f.fatId}`)
    for (const a of r.input.additives) keys.add(`additive:${a.additiveId}`)
    if (r.input.lyeType !== 'KOH') keys.add('lye:NaOH')
    if (r.input.lyeType !== 'NaOH') keys.add('lye:KOH')
  }
  return keys
}

/** Gruppen erst ab dieser Größe einklappen bzw. kürzen, damit lange Kataloge flüssig bleiben. */
const PAGE = 40

function Products() {
  const inv = useLiveQuery(loadInventory)
  const recipes = useLiveQuery(() => db.recipes.toArray())
  const [scope, setScope] = useState<Scope>('mine')
  const [filter, setFilter] = useState<ProductCategory | 'all'>('all')
  const [q, setQ] = useState('')
  if (!inv || !recipes) return null

  const bought = new Set([...inv.purchases.map((p) => p.productId), ...inv.lots.map((l) => l.productId)])
  // Je Rezept-Material nur die Packung, die der Einkauf vorschlagen würde, nicht alle Größen und Qualitäten.
  const suggested = new Set([...recipeMaterials(recipes)].map((k) => bestProduct(inv, k)?.id))
  // „Meine Artikel“: gekauft, im Vorrat, selbst angelegt oder Einkaufsvorschlag für ein Rezept.
  const isMine = (p: Product) => bought.has(p.id) || p.listPrice === undefined || suggested.has(p.id)
  const needle = q.trim().toLowerCase()
  const products = inv.products
    .filter((p) => filter === 'all' || p.category === filter)
    .filter((p) => !needle || `${p.name} ${p.shopCategory ?? ''}`.toLowerCase().includes(needle))
    .filter((p) => scope === 'all' || needle || isMine(p))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))
  const groups = CATEGORIES.map((c) => ({ category: c, items: products.filter((p) => p.category === c) })).filter((g) => g.items.length)
  const mineCount = inv.products.filter(isMine).length

  async function addProduct() {
    await db.products.add({ id: crypto.randomUUID(), name: 'Neuer Artikel', category: 'lye', lyeType: 'NaOH', unit: 'g', packageSize: 1000 })
    setScope('mine')
    setFilter('all')
  }

  const tab = (active: boolean) => `min-h-10 rounded-lg px-3 text-sm font-medium ${active ? 'bg-surface text-accent shadow-sm' : 'text-muted hover:text-ink'}`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex gap-1 rounded-xl bg-surface-2 p-1" role="group" aria-label="Umfang">
          <button className={tab(scope === 'mine')} aria-pressed={scope === 'mine'} onClick={() => setScope('mine')}>
            Meine Artikel ({mineCount})
          </button>
          <button className={tab(scope === 'all')} aria-pressed={scope === 'all'} onClick={() => setScope('all')}>
            Ganzer Katalog ({inv.products.length})
          </button>
        </div>
        <select className="field" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Kategorie">
          <option value="all">Alle Kategorien</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <input className="field min-w-48 flex-1" placeholder="Suchen, auch im ganzen Katalog" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Artikel suchen" />
        <button className="btn" onClick={addProduct}>
          + Artikel anlegen
        </button>
      </div>
      {scope === 'mine' && !needle && (
        <p className="text-xs text-muted">Gekauft, im Vorrat, selbst angelegt oder Einkaufsvorschlag für deine Rezepte. Die Suche findet alles.</p>
      )}
      {groups.length === 0 && <p className="text-sm text-muted">Nichts gefunden.</p>}
      {groups.map((g) => (
        <ProductGroup key={`${scope}-${g.category}`} title={CATEGORY_LABELS[g.category]} items={g.items} inv={inv} open={scope === 'mine' || !!needle || groups.length === 1} />
      ))}
    </div>
  )
}

function ProductGroup({ title, items, inv, open }: { title: string; items: Product[]; inv: Inventory; open: boolean }) {
  const [expanded, setExpanded] = useState(open)
  const [limit, setLimit] = useState(PAGE)
  return (
    <details className="group card" open={expanded} onToggle={(e) => setExpanded(e.currentTarget.open)}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 font-semibold">
        <ChevronRight size={18} className="text-muted transition-transform group-open:rotate-90" aria-hidden />
        <span className="flex-1">{title}</span>
        <span className="text-sm font-normal text-muted">{items.length} Artikel</span>
      </summary>
      {expanded && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="pb-2 font-normal">Artikel</th>
                <th className="pb-2 font-normal">Kategorie / Material</th>
                <th className="w-40 pb-2 font-normal">Packung</th>
                <th className="w-24 pb-2 font-normal" title="g/ml, nur für Ware nach Volumen">
                  Dichte
                </th>
                <th className="pb-2 text-right font-normal">Letzter Preis</th>
                <th className="pb-2 text-right font-normal">€/kg</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.slice(0, limit).map((p) => (
                <ProductRow key={p.id} p={p} inv={inv} />
              ))}
            </tbody>
          </table>
          {items.length > limit && (
            <button className="btn-ghost mt-2" onClick={() => setLimit(items.length)}>
              Alle {items.length} zeigen
            </button>
          )}
        </div>
      )}
    </details>
  )
}

function ProductRow({ p, inv }: { p: Product; inv: Inventory }) {
  const update = (id: string, patch: Partial<Product>) => db.products.update(id, patch)
  const last = offerPrice(inv, p)
  const perKg = last ? pricePerKg(p, last.unitPrice) : undefined
  const unlinked = SOAP_CATEGORIES.includes(p.category) && !materialKey(p)
  return (
    <tr key={p.id} className="border-t border-line align-top">
      <td className="py-1.5 pr-2">
        <input className="field w-full min-w-56" value={p.name} onChange={(e) => update(p.id, { name: e.target.value })} />
        {p.url && (
          <a className="text-xs text-accent hover:underline" href={p.url} target="_blank" rel="noreferrer">
            {p.supplier ?? 'Shop'} {p.sku}
          </a>
        )}
        {p.shopCategory && <span className="ml-2 text-xs text-muted">{p.shopCategory}</span>}
      </td>
      <td className="space-y-1 py-1.5 pr-2">
        <select className="field w-full" value={p.category} onChange={(e) => update(p.id, { category: e.target.value as ProductCategory })}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        {p.category === 'fat' && (
          <select className={`field w-full ${unlinked ? 'border-amber-500' : ''}`} value={p.fatId ?? ''} onChange={(e) => update(p.id, { fatId: e.target.value || undefined })}>
            <option value="">– Fett zuordnen –</option>
            {FATS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        )}
        {p.category === 'additive' && (
          <select className={`field w-full ${unlinked ? 'border-amber-500' : ''}`} value={p.additiveId ?? ''} onChange={(e) => update(p.id, { additiveId: e.target.value || undefined })}>
            <option value="">– Zusatz zuordnen –</option>
            {ADDITIVES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        )}
        {p.category === 'lye' && (
          <select className="field w-full" value={p.lyeType ?? ''} onChange={(e) => update(p.id, { lyeType: (e.target.value || undefined) as Product['lyeType'] })}>
            <option value="">– Lauge wählen –</option>
            <option value="NaOH">NaOH</option>
            <option value="KOH">KOH</option>
          </select>
        )}
      </td>
      <td className="py-1.5 pr-2">
        <span className="flex gap-1">
          <NumberField value={p.packageSize} digits={1} ariaLabel="Packungsgröße" onChange={(v) => update(p.id, { packageSize: v ?? 0 })} />
          <select className="field" value={p.unit} onChange={(e) => update(p.id, { unit: e.target.value as ProductUnit })}>
            <option>g</option>
            <option>ml</option>
            <option>Stk</option>
          </select>
        </span>
      </td>
      <td className="py-1.5 pr-2">
        {p.unit === 'ml' && (
          <NumberField value={p.density} digits={3} placeholder={fmt(packageGrams({ ...p, packageSize: 1 }) ?? 1, 3)} ariaLabel="Dichte" onChange={(v) => update(p.id, { density: v })} />
        )}
      </td>
      <td className="py-1.5 text-right tabular-nums">
        {last ? (
          <>
            {fmt(last.unitPrice, 2)} €
            <div className="text-xs text-muted">
              {last.source === 'list' ? 'Shop' : 'gekauft'} {new Date(last.date).toLocaleDateString('de-DE')}
              {p.available === false && ' · nicht lieferbar'}
            </div>
          </>
        ) : (
          <PriceEntry productId={p.id} />
        )}
      </td>
      <td className="py-1.5 pl-3 text-right font-semibold tabular-nums">{perKg !== undefined ? fmt(perKg, 2) : '–'}</td>
      <td>
        <button className="btn-icon" aria-label="Artikel löschen" onClick={() => confirm(`„${p.name}“ löschen?`) && db.products.delete(p.id)}>
          ×
        </button>
      </td>
    </tr>
  )
}

/** Preis für einen manuell angelegten Artikel erfassen (als Einkauf von heute). */
function PriceEntry({ productId }: { productId: string }) {
  const [price, setPrice] = useState<number>()
  return (
    <span className="flex items-center gap-1">
      <NumberField className="w-24" value={price} digits={2} suffix="€" ariaLabel="Preis" onChange={setPrice} />
      <button
        className="btn"
        disabled={price === undefined}
        onClick={() =>
          db.purchases.add({ id: crypto.randomUUID(), productId, date: new Date().toISOString().slice(0, 10), quantity: 1, unitPrice: price! })
        }
      >
        ✓
      </button>
    </span>
  )
}

function Import() {
  const [status, setStatus] = useState<string[]>([])

  async function importFile(file: File): Promise<string> {
    const data = JSON.parse(await file.text())
    const inv = await loadInventory()
    const shopCatalog = asShopCatalog(data)
    if (shopCatalog) {
      const { shop, products, updates, customFats } = importShopCatalog(shopCatalog, inv.products, await db.shops.get(shopCatalog.shop.name.trim()))
      await db.transaction('rw', db.products, db.shops, db.customFats, async () => {
        await db.customFats.bulkPut(customFats)
        await db.products.bulkAdd(products)
        await db.products.bulkUpdate(updates.map((u) => ({ key: u.id, changes: u.changes })))
        await db.shops.put(shop)
      })
      const shipping = shop.shipping !== undefined ? `, Versand ${fmt(shop.shipping, 2)} €${shop.freeShippingFrom !== undefined ? `, frei ab ${fmt(shop.freeShippingFrom, 0)} €` : ''}` : ''
      const own = customFats.length ? `, ${customFats.length} eigene Fette mit Werten vom Etikett` : ''
      return `${file.name}: ${shop.name}${shop.local ? ' (Laden vor Ort)' : ''}, ${products.length} neue Artikel, ${updates.length} Preise aktualisiert${shipping}${own}.`
    }
    if (isCatalog(data)) {
      const { products, updates } = importSalandiaCatalog(data, inv.products)
      await db.transaction('rw', db.products, async () => {
        await db.products.bulkAdd(products)
        await db.products.bulkUpdate(updates.map((u) => ({ key: u.id, changes: u.changes })))
      })
      return `${file.name}: Katalog vom ${new Date(data.scraped_at).toLocaleDateString('de-DE')}, ${products.length} neue Artikel, ${updates.length} Preise aktualisiert.`
    }
    if (!Array.isArray(data?.orders)) throw new Error('Format nicht erkannt. Erwartet: Shop-Katalog (mit „shop“ und „produkte“), Salandia-Katalog oder -Bestellübersicht.')
    const { products, purchases } = importSalandia(data, inv.products, inv.purchases)
    await db.transaction('rw', db.products, db.purchases, async () => {
      await db.products.bulkAdd(products)
      await db.purchases.bulkAdd(purchases)
    })
    return `${file.name}: Bestellungen, ${products.length} neue Artikel, ${purchases.length} Einkäufe.`
  }

  async function upload(files: FileList) {
    const out: string[] = []
    for (const f of Array.from(files)) {
      try {
        out.push(await importFile(f))
      } catch (e) {
        out.push(`${f.name}: Fehler, ${(e as Error).message}`)
      }
    }
    setStatus(out)
  }

  return (
    <div className="card max-w-2xl space-y-4">
      <h2 className="font-semibold">Shop-Daten importieren</h2>
      <p className="text-sm text-muted">
        Eine oder mehrere JSON-Dateien wählen, die App erkennt das Format selbst: <b>Shop-Katalog</b> (beliebiger Shop, mit
        Versandkosten), Salandia-Katalog oder Salandia-Bestellübersicht. Fette, Laugen und Zusätze werden automatisch zugeordnet.
        Mehrfaches Einlesen ist unschädlich: Bekanntes wird nur aktualisiert.
      </p>
      <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line text-muted transition hover:border-accent hover:text-ink">
        <Upload size={24} aria-hidden />
        <span className="font-medium">JSON-Dateien wählen</span>
        <input type="file" multiple accept="application/json,.json" className="sr-only" onChange={(e) => e.target.files?.length && upload(e.target.files)} />
      </label>
      {status.length > 0 && (
        <ul className="space-y-1 text-sm">
          {status.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
