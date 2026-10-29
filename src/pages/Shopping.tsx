import { Calculator, Copy, ExternalLink, Minus, PackageCheck, Plus, ShoppingCart, Truck, X } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { NumberField } from '../components/NumberField'
import { EmptyState, PageHeader, Panel } from '../components/ui'
import { needsOf } from '../core/batch'
import { calculate } from '../core/calc'
import { CATEGORY_LABELS, materialKey, offerPrice, packageGrams, type Product } from '../core/inventory'
import { planShopping, type ShoppingMode, type ShoppingSuggestion } from '../core/shopping'
import type { Need } from '../core/batch'
import { db, receiveOrderItem, type OrderItem } from '../db'
import { fmt } from '../format'
import { de, groupRecipes, useWorkshop } from '../hooks'

export function Shopping() {
  const w = useWorkshop()
  const [params] = useSearchParams()
  const [mode, setModeState] = useState<ShoppingMode>(() => (readPref('shoppingMode') === 'total' ? 'total' : 'perKg'))
  const setMode = (m: ShoppingMode) => {
    setModeState(m)
    writePref('shoppingMode', m)
  }
  const [plan, setPlan] = useState<Record<string, number>>(() => {
    const id = params.get('rezept')
    return id ? { [id]: Number(params.get('faktor')) || 1 } : {}
  })
  if (!w) return null
  const { inventory, orderItems } = w
  const byId = new Map(inventory.products.map((p) => [p.id, p]))

  const needs = w.recipes.flatMap((r) => {
    const n = plan[r.id] ?? 0
    if (!n) return []
    try {
      return needsOf(calculate(r.input)).map((x) => ({ ...x, grams: x.grams * n }))
    } catch {
      return []
    }
  })
  // Was schon auf der Liste oder unterwegs ist, zählt wie Vorrat.
  const pending = orderItems.filter((o) => o.status !== 'received')
  const pendingInv = {
    ...inventory,
    lots: [
      ...inventory.lots,
      ...pending.map((o) => {
        const p = byId.get(o.productId)
        const g = p ? (packageGrams(p) ?? 0) * o.packages : 0
        return { id: o.id, productId: o.productId, gramsInitial: g, gramsLeft: g }
      }),
    ],
  }
  const suggestions = planShopping(pendingInv, needs, mode)
  const totalOf = (m: ShoppingMode) => planShopping(pendingInv, needs, m).reduce((sum, x) => sum + (x.total ?? 0), 0)

  const open = orderItems.filter((o) => o.status === 'open')
  const ordered = orderItems.filter((o) => o.status === 'ordered')
  const received = orderItems.filter((o) => o.status === 'received').sort((a, b) => (b.receivedAt ?? '').localeCompare(a.receivedAt ?? '')).slice(0, 8)
  const openTotal = open.reduce((s, o) => s + (o.unitPrice ?? 0) * o.packages, 0)

  async function addSuggestions(list: ShoppingSuggestion[]) {
    const now = new Date().toISOString()
    const reason = w!.recipes.filter((r) => plan[r.id]).map((r) => `${r.name} ×${plan[r.id]}`).join(', ')
    await db.orderItems.bulkAdd(
      list.flatMap((s) =>
        s.lines.map((l) => ({ id: crypto.randomUUID(), productId: l.product.id, packages: l.packages, unitPrice: l.unitPrice, reason, status: 'open' as const, createdAt: now })),
      ),
    )
    // Bedarf ohne bekannten Artikel bleibt stehen, damit er nicht verloren geht.
    if (list.every((s) => s.lines.length)) setPlan({})
  }

  function copyList() {
    const text = bySupplier(open, byId)
      .map(
        ([supplier, items]) =>
          `${supplier}\n` +
          items
            .map((o) => {
              const p = byId.get(o.productId)
              return `${o.packages}× ${p?.name ?? '?'}${p?.sku ? ` (${p.sku})` : ''}${p?.url ? `\n   ${p.url}` : ''}`
            })
            .join('\n'),
      )
      .join('\n\n')
    navigator.clipboard?.writeText(text)
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Einkauf" title="Was muss bestellt werden?" />

      <Panel title="Bedarf berechnen" icon={Calculator}>
        <p className="mb-4 text-sm text-muted">Wie oft willst du was sieden? Die App zieht Vorrat und offene Bestellungen ab und schlägt Packungen vor.</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {groupRecipes(w.recipes).flatMap(({ base, variants }) =>
            [base, ...variants].map((r) => {
              const n = plan[r.id] ?? 0
              return (
                <div key={r.id} className={`flex items-center gap-2 rounded-xl border p-2 pl-3 ${n ? 'border-accent/50 bg-accent/5' : 'border-line bg-surface-2'}`}>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.name}</span>
                  <button className="btn-ghost min-w-11 px-0" aria-label={`${r.name} weniger`} disabled={!n} onClick={() => setPlan({ ...plan, [r.id]: Math.max(0, Math.ceil(n) - 1) })}>
                    <Minus size={16} />
                  </button>
                  <span className="w-8 text-center font-semibold tabular-nums">{fmt(n, n % 1 ? 1 : 0)}</span>
                  <button className="btn-ghost min-w-11 px-0" aria-label={`${r.name} mehr`} onClick={() => setPlan({ ...plan, [r.id]: Math.floor(n) + 1 })}>
                    <Plus size={16} />
                  </button>
                </div>
              )
            }),
          )}
        </div>
        {needs.length > 0 && (
          <div className="mt-5 border-t border-line pt-4">
            {suggestions.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-ok">
                <PackageCheck size={18} /> Alles vorrätig oder schon bestellt.
              </p>
            ) : (
              <>
                <div className="mb-3 inline-flex flex-wrap gap-1 rounded-xl bg-surface-2 p-1" role="group" aria-label="Packungen wählen nach">
                  {(
                    [
                      ['perKg', 'Bester Preis pro kg'],
                      ['total', 'Nur was gebraucht wird'],
                    ] as const
                  ).map(([m, label]) => (
                    <button
                      key={m}
                      aria-pressed={mode === m}
                      className={`min-h-10 rounded-lg px-3 text-sm font-medium ${mode === m ? 'bg-surface text-accent shadow-sm' : 'text-muted hover:text-ink'}`}
                      onClick={() => setMode(m)}
                    >
                      {label} · {fmt(totalOf(m), 2)} €
                    </button>
                  ))}
                </div>
                <ul className="divide-y divide-line">
                  {suggestions.map((s) => (
                    <li key={s.need.key} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                      <span className="min-w-40 flex-1">
                        <span className="font-medium">{s.need.name}</span>
                        <span className="ml-2 text-sm text-muted">fehlt {fmt(s.shortfall)} g</span>
                      </span>
                      {s.lines.length ? (
                        <span className="text-right text-sm text-muted">
                          {s.lines.map((l) => (
                            <span key={l.product.id} className="block">
                              {l.packages}× {l.product.name}
                            </span>
                          ))}
                          {s.leftover >= 1 && <span className="block text-xs">Rest ca. {fmt(s.leftover)} g</span>}
                        </span>
                      ) : (
                        <AssignProduct need={s.need} products={inventory.products} />
                      )}
                      <span className="w-20 text-right font-semibold tabular-nums">{s.total !== undefined ? `${fmt(s.total, 2)} €` : '–'}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex justify-end">
                  <button className="btn-primary" disabled={!suggestions.some((s) => s.lines.length)} onClick={() => addSuggestions(suggestions)}>
                    <ShoppingCart size={18} /> Auf die Einkaufsliste
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel
          title="Einkaufsliste"
          icon={ShoppingCart}
          action={open.length > 0 && <span className="text-lg font-semibold tabular-nums">{fmt(openTotal, 2)} €</span>}
        >
          {open.length === 0 ? (
            <EmptyState icon={ShoppingCart} title="Liste ist leer">
              Oben Bedarf berechnen, im Siede-Ablauf „Fehlendes auf Einkaufsliste“ wählen oder einen Artikel direkt hinzufügen.
            </EmptyState>
          ) : (
            <>
              <div className="space-y-4">
                {bySupplier(open, byId).map(([supplier, items]) => (
                  <section key={supplier} aria-label={supplier}>
                    <h3 className="eyebrow mb-2 flex justify-between">
                      <span>{supplier}</span>
                      <span className="tabular-nums">{fmt(items.reduce((sum, o) => sum + (o.unitPrice ?? 0) * o.packages, 0), 2)} €</span>
                    </h3>
                    <ul className="space-y-2">
                      {items.map((o) => (
                        <OpenItem key={o.id} item={o} product={byId.get(o.productId)} />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button className="btn" onClick={copyList}>
                  <Copy size={18} /> Liste kopieren
                </button>
                <button
                  className="btn-primary"
                  onClick={() => db.orderItems.bulkUpdate(open.map((o) => ({ key: o.id, changes: { status: 'ordered', orderedAt: new Date().toISOString().slice(0, 10) } })))}
                >
                  <Truck size={18} /> Als bestellt markieren
                </button>
              </div>
            </>
          )}
          <AddManual products={inventory.products} />
        </Panel>

        <div className="space-y-6">
          <Panel title="Unterwegs" icon={Truck}>
            {ordered.length === 0 ? (
              <p className="text-sm text-muted">Nichts unterwegs.</p>
            ) : (
              <ul className="space-y-3">
                {ordered.map((o) => (
                  <Incoming key={o.id} item={o} product={byId.get(o.productId)} />
                ))}
              </ul>
            )}
          </Panel>
          {received.length > 0 && (
            <Panel title="Zuletzt eingetroffen" icon={PackageCheck}>
              <ul className="space-y-1 text-sm">
                {received.map((o) => (
                  <li key={o.id} className="flex justify-between gap-2">
                    <span className="truncate">
                      {o.packages}× {byId.get(o.productId)?.name}
                    </span>
                    <span className="text-muted">{de(o.receivedAt)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}

/** Offene Posten nach Shop gruppiert, Shops mit Links (Versand) zuerst, Supermarkt zuletzt. */
function bySupplier(items: OrderItem[], byId: Map<string, Product>): [string, OrderItem[]][] {
  const groups = new Map<string, OrderItem[]>()
  for (const o of items) {
    const supplier = byId.get(o.productId)?.supplier ?? 'Sonstige'
    groups.set(supplier, [...(groups.get(supplier) ?? []), o])
  }
  return [...groups].sort(([a], [b]) => Number(a === SUPERMARKET) - Number(b === SUPERMARKET) || a.localeCompare(b, 'de'))
}

const SUPERMARKET = 'Supermarkt'

function OpenItem({ item, product }: { item: OrderItem; product?: Product }) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-2 p-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium break-words">{product?.name ?? 'Artikel gelöscht'}</p>
        <p className="truncate text-xs text-muted">{[product?.sku, item.reason && `für ${item.reason}`].filter(Boolean).join(' · ')}</p>
      </div>
      <div className="flex items-center">
        <button className="btn-ghost min-w-11 px-0" aria-label="Weniger" onClick={() => (item.packages > 1 ? db.orderItems.update(item.id, { packages: item.packages - 1 }) : db.orderItems.delete(item.id))}>
          <Minus size={16} />
        </button>
        <span className="w-8 text-center font-semibold tabular-nums">{item.packages}</span>
        <button className="btn-ghost min-w-11 px-0" aria-label="Mehr" onClick={() => db.orderItems.update(item.id, { packages: item.packages + 1 })}>
          <Plus size={16} />
        </button>
      </div>
      <span className="w-20 text-right tabular-nums">{item.unitPrice !== undefined ? `${fmt(item.unitPrice * item.packages, 2)} €` : '–'}</span>
      {product?.url && (
        <a className="btn" href={product.url} target="_blank" rel="noreferrer" aria-label={`${product.name} im Shop öffnen`}>
          <ExternalLink size={16} /> Shop
        </a>
      )}
      <button className="btn-icon" aria-label="Entfernen" onClick={() => db.orderItems.delete(item.id)}>
        <X size={18} />
      </button>
    </li>
  )
}

function Incoming({ item, product }: { item: OrderItem; product?: Product }) {
  const [price, setPrice] = useState(item.unitPrice)
  const [mhd, setMhd] = useState('')
  return (
    <li className="rounded-xl border border-line bg-surface-2 p-3">
      <p className="font-medium">
        {item.packages}× {product?.name ?? 'Artikel gelöscht'}
      </p>
      <p className="mb-2 text-xs text-muted">bestellt {de(item.orderedAt)}</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="label w-28">
          Preis/Pck.
          <NumberField value={price} digits={2} suffix="€" onChange={setPrice} />
        </label>
        <label className="label">
          MHD
          <input type="date" className="field" value={mhd} onChange={(e) => setMhd(e.target.value)} />
        </label>
        <button className="btn-primary" disabled={!product} onClick={() => receiveOrderItem(item, price, mhd || undefined)}>
          <PackageCheck size={18} /> Eingetroffen
        </button>
      </div>
    </li>
  )
}

function AddManual({ products }: { products: Product[] }) {
  const [q, setQ] = useState('')
  // Suche statt Auswahlliste: bei über 2000 Katalog-Artikeln ist ein Menü nicht bedienbar.
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const matches = words.length
    ? products
        .filter((p) => words.every((w) => p.name.toLowerCase().includes(w)))
        .sort((a, b) => Number(!materialKey(a)) - Number(!materialKey(b)) || a.name.localeCompare(b.name, 'de'))
        .slice(0, 8)
    : []

  async function add(product: Product) {
    const inv = { products, purchases: await db.purchases.where('productId').equals(product.id).toArray(), lots: [] }
    await db.orderItems.add({ id: crypto.randomUUID(), productId: product.id, packages: 1, unitPrice: offerPrice(inv, product)?.unitPrice, status: 'open', createdAt: new Date().toISOString() })
    setQ('')
  }

  return (
    <div className="mt-5 space-y-2 border-t border-line pt-4">
      <input className="field w-full" placeholder="Artikel direkt hinzufügen, z. B. Lavendel" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Artikel suchen und hinzufügen" />
      {matches.length > 0 && (
        <ul className="space-y-1">
          {matches.map((p) => (
            <li key={p.id}>
              <button className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-surface-2" onClick={() => add(p)}>
                <Plus size={16} className="shrink-0 text-accent" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="shrink-0 text-xs text-muted">{CATEGORY_LABELS[p.category]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {words.length > 0 && matches.length === 0 && <p className="text-sm text-muted">Nichts gefunden.</p>}
    </div>
  )
}

/** Merker pro Gerät (Browser-Speicher kann fehlen, z. B. im privaten Fenster). */
function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // egal, dann eben nicht gemerkt
  }
}

/** Fehlt ein Artikel für ein Material, passende aus dem Katalog vorschlagen und mit einem Klick zuordnen. */
function AssignProduct({ need, products }: { need: Need; products: Product[] }) {
  // Für ein Fett nur Fette vorschlagen (sonst taucht bei „Oliven“ das Olivenkern-Granulat auf), für ätherische Öle nur ätherische.
  const fits = (p: Product) =>
    need.key.startsWith('fat:')
      ? p.category === 'fat'
      : need.key.startsWith('lye:')
        ? p.category === 'lye' || p.category === 'cosmetic'
        : need.key.startsWith('additive:eo-') === /ätherisch/i.test(p.name) && p.category !== 'fat' && p.category !== 'packaging'
  const [q, setQ] = useState(() => need.name.split(/[\s(]/)[0].replace(/öl$/i, ''))
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const matches = words.length
    ? products
        .filter((p) => words.every((w) => p.name.toLowerCase().includes(w)) && fits(p))
        .sort((a, b) => Number(!!materialKey(a)) - Number(!!materialKey(b)) || a.name.localeCompare(b.name, 'de'))
        .slice(0, 8)
    : []

  /** Artikel „Supermarkt“ anlegen: Literflasche bei Ölen, sonst 1 kg. Den Preis gibt es beim Wareneingang. */
  function buyLocally() {
    const [kind] = need.key.split(':')
    const product: Product = { id: crypto.randomUUID(), name: need.name, supplier: SUPERMARKET, category: 'other', unit: kind === 'fat' ? 'ml' : 'g', packageSize: 1000 }
    return db.products.add({ ...product, ...materialPatch(product) })
  }

  function assign(p: Product) {
    return db.products.update(p.id, materialPatch(p))
  }

  function materialPatch(p: Product): Partial<Product> {
    const [kind, id] = need.key.split(':')
    return kind === 'fat'
      ? { category: 'fat', fatId: id, additiveId: undefined, lyeType: undefined }
      : kind === 'lye'
        ? { category: 'lye', lyeType: id as Product['lyeType'], fatId: undefined, additiveId: undefined }
        : { category: p.category === 'essentialOil' ? 'essentialOil' : 'additive', additiveId: id, fatId: undefined, lyeType: undefined }
  }

  return (
    <details className="w-full text-sm sm:w-auto">
      <summary className="cursor-pointer text-warn">Noch kein Artikel zugeordnet</summary>
      <div className="mt-2 space-y-1 sm:w-96">
        <input className="field w-full" value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Artikel für ${need.name} suchen`} />
        {matches.map((p) => (
          <button key={p.id} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left hover:bg-surface-2" onClick={() => assign(p)}>
            <Plus size={16} className="shrink-0 text-accent" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
            {materialKey(p) && <span className="shrink-0 text-xs text-muted">bisher anders zugeordnet</span>}
          </button>
        ))}
        {words.length > 0 && matches.length === 0 && <p className="text-muted">Nichts im Katalog.</p>}
        <button className="btn w-full justify-start" onClick={buyLocally}>
          <ShoppingCart size={16} /> Kaufe ich im Supermarkt
        </button>
      </div>
    </details>
  )
}
