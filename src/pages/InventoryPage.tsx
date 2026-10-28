import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { NumberField } from '../components/NumberField'
import {
  CATEGORY_LABELS,
  materialKey,
  packageGrams,
  pricePerKg,
  type Lot,
  type Product,
  type ProductCategory,
  type ProductUnit,
} from '../core/inventory'
import { ADDITIVES } from '../data/additives'
import { FATS } from '../data/fats'
import { db, loadInventory } from '../db'
import { fmt } from '../format'
import { importSalandia } from '../import/salandia'

const CATEGORIES = Object.keys(CATEGORY_LABELS) as ProductCategory[]
/** Kategorien, die in Seifenrezepten verrechnet werden. */
const SOAP_CATEGORIES: ProductCategory[] = ['fat', 'lye', 'additive']

export function InventoryPage() {
  const tab = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-1.5 text-sm ${isActive ? 'bg-surface font-semibold shadow-sm' : 'text-muted hover:text-ink'}`
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Lager</h1>
      <nav className="inline-flex gap-1 rounded-lg bg-track p-1">
        <NavLink to="/lager" end className={tab}>
          Bestand
        </NavLink>
        <NavLink to="/lager/artikel" className={tab}>
          Artikel & Preise
        </NavLink>
        <NavLink to="/lager/import" className={tab}>
          Import
        </NavLink>
      </nav>
      <Routes>
        <Route index element={<Stock />} />
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
    setPrice(latestPrice(id, inv!.purchases)?.unitPrice)
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

function Products() {
  const inv = useLiveQuery(loadInventory)
  const [filter, setFilter] = useState<ProductCategory | 'soap' | 'all'>('soap')
  if (!inv) return null
  const update = (id: string, patch: Partial<Product>) => db.products.update(id, patch)
  const products = inv.products
    .filter((p) => filter === 'all' || (filter === 'soap' ? SOAP_CATEGORIES.includes(p.category) : p.category === filter))
    .sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || a.name.localeCompare(b.name))

  async function addProduct() {
    await db.products.add({ id: crypto.randomUUID(), name: 'Neuer Artikel', category: 'lye', lyeType: 'NaOH', unit: 'g', packageSize: 1000 })
    setFilter('soap')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select className="field" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="soap">Seifenrelevant</option>
          <option value="all">Alle</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <button className="btn" onClick={addProduct}>
          + Artikel anlegen
        </button>
        <span className="text-sm text-muted">{products.length} Artikel</span>
      </div>
      <div className="card overflow-x-auto">
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
            {products.map((p) => {
              const last = latestPrice(p.id, inv.purchases)
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
                        {fmt(last.unitPrice, 2)} €<div className="text-xs text-muted">{new Date(last.date).toLocaleDateString('de-DE')}</div>
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
            })}
          </tbody>
        </table>
      </div>
    </div>
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
  const [status, setStatus] = useState<string>()

  async function upload(file: File) {
    try {
      const inv = await loadInventory()
      const { products, purchases } = importSalandia(JSON.parse(await file.text()), inv.products, inv.purchases)
      await db.transaction('rw', db.products, db.purchases, async () => {
        await db.products.bulkAdd(products)
        await db.purchases.bulkAdd(purchases)
      })
      setStatus(`${products.length} neue Artikel und ${purchases.length} Einkäufe übernommen. Bereits bekannte wurden übersprungen.`)
    } catch (e) {
      setStatus(`Fehler: ${(e as Error).message}`)
    }
  }

  return (
    <div className="card max-w-prose space-y-3">
      <h2 className="font-semibold">Salandia-Bestellungen</h2>
      <p className="text-sm text-muted">
        Liest die Bestellübersicht als JSON ein und legt daraus Artikel mit Preishistorie an. Fette und Zusätze werden anhand des
        Namens zugeordnet. Bitte unter „Artikel & Preise“ kurz prüfen. Mehrfaches Einlesen ist unschädlich.
      </p>
      <label className="btn-primary cursor-pointer">
        JSON-Datei wählen
        <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </label>
      {status && <p className="text-sm">{status}</p>}
      <p className="text-xs text-muted">
        Das MHD im Export stammt vom aktuellen Shop-Artikel, nicht von deiner gelieferten Charge. Es wird deshalb nicht übernommen,
        sondern beim Einlagern eingetragen.
      </p>
    </div>
  )
}
