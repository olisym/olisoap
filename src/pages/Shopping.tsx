import { Calculator, Copy, ExternalLink, Minus, PackageCheck, Plus, ShoppingCart, Truck, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { NumberField } from '../components/NumberField'
import { EmptyState, PageHeader, Panel } from '../components/ui'
import { needsOf } from '../core/batch'
import { calculate } from '../core/calc'
import { CATEGORY_LABELS, materialKey, packageGrams, type Product } from '../core/inventory'
import { planShopping, type ShoppingSuggestion } from '../core/shopping'
import { db, receiveOrderItem, type OrderItem } from '../db'
import { fmt } from '../format'
import { de, groupRecipes, useWorkshop } from '../hooks'

export function Shopping() {
  const w = useWorkshop()
  const [params] = useSearchParams()
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
  const suggestions = planShopping(pendingInv, needs)

  const open = orderItems.filter((o) => o.status === 'open')
  const ordered = orderItems.filter((o) => o.status === 'ordered')
  const received = orderItems.filter((o) => o.status === 'received').sort((a, b) => (b.receivedAt ?? '').localeCompare(a.receivedAt ?? '')).slice(0, 8)
  const openTotal = open.reduce((s, o) => s + (o.unitPrice ?? 0) * o.packages, 0)

  async function addSuggestions(list: ShoppingSuggestion[]) {
    const now = new Date().toISOString()
    const reason = w!.recipes.filter((r) => plan[r.id]).map((r) => `${r.name} ×${plan[r.id]}`).join(', ')
    await db.orderItems.bulkAdd(
      list
        .filter((s) => s.product && s.packages > 0)
        .map((s) => ({ id: crypto.randomUUID(), productId: s.product!.id, packages: s.packages, unitPrice: s.unitPrice, reason, status: 'open' as const, createdAt: now })),
    )
    // Bedarf ohne bekannten Artikel bleibt stehen, damit er nicht verloren geht.
    if (list.every((s) => s.product)) setPlan({})
  }

  function copyList() {
    const text = open
      .map((o) => {
        const p = byId.get(o.productId)
        return `${o.packages}× ${p?.name ?? '?'}${p?.sku ? ` (${p.sku})` : ''}${p?.url ? `\n   ${p.url}` : ''}`
      })
      .join('\n')
    navigator.clipboard?.writeText(text)
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Einkauf" title="Was muss bestellt werden?" />

      <Panel title="Bedarf berechnen" icon={Calculator}>
        <p className="mb-4 text-sm text-muted">Wie oft willst du was sieden? Die App zieht Vorrat und offene Bestellungen ab und schlägt die günstigste Packung vor.</p>
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
                <ul className="divide-y divide-line">
                  {suggestions.map((s) => (
                    <li key={s.need.key} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                      <span className="min-w-40 flex-1">
                        <span className="font-medium">{s.need.name}</span>
                        <span className="ml-2 text-sm text-muted">fehlt {fmt(s.shortfall)} g</span>
                      </span>
                      {s.product ? (
                        <span className="text-sm text-muted">
                          {s.packages}× {s.product.name}
                        </span>
                      ) : (
                        <Link className="text-sm text-warn hover:underline" to="/lager/artikel">
                          Noch kein Artikel, hier anlegen
                        </Link>
                      )}
                      <span className="w-20 text-right font-semibold tabular-nums">{s.unitPrice !== undefined ? `${fmt(s.unitPrice * s.packages, 2)} €` : '–'}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex justify-end">
                  <button className="btn-primary" disabled={!suggestions.some((s) => s.product && s.packages > 0)} onClick={() => addSuggestions(suggestions)}>
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
              <ul className="space-y-2">
                {open.map((o) => (
                  <OpenItem key={o.id} item={o} product={byId.get(o.productId)} />
                ))}
              </ul>
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

function OpenItem({ item, product }: { item: OrderItem; product?: Product }) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-2 p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{product?.name ?? 'Artikel gelöscht'}</p>
        <p className="truncate text-xs text-muted">
          {product?.supplier ?? ''} {product?.sku ?? ''} {item.reason && `· für ${item.reason}`}
        </p>
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
  const [productId, setProductId] = useState('')
  const sorted = [...products].sort((a, b) => Number(!materialKey(a)) - Number(!materialKey(b)) || a.name.localeCompare(b.name))
  return (
    <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
      <select className="field min-w-0 flex-1" value={productId} onChange={(e) => setProductId(e.target.value)} aria-label="Artikel hinzufügen">
        <option value="">Artikel direkt hinzufügen …</option>
        {sorted.map((p) => (
          <option key={p.id} value={p.id}>
            {CATEGORY_LABELS[p.category]}: {p.name}
          </option>
        ))}
      </select>
      <button
        className="btn"
        disabled={!productId}
        onClick={async () => {
          const last = await db.purchases.where('productId').equals(productId).sortBy('date')
          await db.orderItems.add({ id: crypto.randomUUID(), productId, packages: 1, unitPrice: last.at(-1)?.unitPrice, status: 'open', createdAt: new Date().toISOString() })
          setProductId('')
        }}
      >
        <Plus size={18} /> Hinzufügen
      </button>
    </div>
  )
}
