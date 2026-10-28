import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Package, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, Chip, EmptyState } from '../components/ui'
import { addDays } from '../core/batch'
import { CATEGORY_LABELS, materialKey, type Inventory, type Lot, type Product, type ProductCategory } from '../core/inventory'
import { bestProduct } from '../core/shopping'
import { ADDITIVES_BY_ID } from '../data/additives'
import { FATS_BY_ID } from '../data/fats'
import { db, loadInventory, type OrderItem } from '../db'
import { fmt } from '../format'
import { de, today } from '../hooks'

interface Material {
  key: string
  name: string
  category: ProductCategory
  lots: Lot[]
  product?: Product
}

function materialName(p: Product): string {
  if (p.fatId) return FATS_BY_ID[p.fatId]?.name ?? p.name
  if (p.additiveId) return ADDITIVES_BY_ID[p.additiveId]?.name ?? p.name
  if (p.lyeType) return p.lyeType
  return p.name
}

/** Fasst Gebinde zu Materialien zusammen: Seifenrohstoffe nach Material, alles andere nach Artikel. */
function materials(inv: Inventory): Material[] {
  const map = new Map<string, Material>()
  const byId = new Map(inv.products.map((p) => [p.id, p]))
  for (const lot of inv.lots) {
    const p = byId.get(lot.productId)
    if (!p) continue
    const key = materialKey(p) ?? `product:${p.id}`
    const m = map.get(key) ?? { key, name: materialName(p), category: p.category, lots: [], product: materialKey(p) ? undefined : p }
    m.lots.push(lot)
    map.set(key, m)
  }
  const order = Object.keys(CATEGORY_LABELS)
  return [...map.values()].sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.name.localeCompare(b.name))
}

/** Vorrat auf einen Blick: Füllstand, Haltbarkeit, Nachbestellen mit einem Klick. */
export function StockOverview() {
  const inv = useLiveQuery(loadInventory)
  const orders = useLiveQuery(() => db.orderItems.where('status').notEqual('received').toArray())
  const [q, setQ] = useState('')
  if (!inv || !orders) return null
  const now = today()
  const soon = addDays(now, 90)
  const list = materials(inv).filter((m) => m.name.toLowerCase().includes(q.toLowerCase()))
  const onList = (m: Material) => orders.some((o: OrderItem) => {
    const p = inv.products.find((x) => x.id === o.productId)
    return p && (materialKey(p) ?? `product:${p.id}`) === m.key
  })

  async function reorder(m: Material) {
    const product = m.product ?? bestProduct(inv!, m.key as never)
    if (!product) return
    const last = inv!.purchases.filter((p) => p.productId === product.id).sort((a, b) => b.date.localeCompare(a.date))[0]
    await db.orderItems.add({ id: crypto.randomUUID(), productId: product.id, packages: 1, unitPrice: last?.unitPrice, reason: 'Nachbestellung', status: 'open', createdAt: new Date().toISOString() })
  }

  return (
    <div className="space-y-4">
      <label className="relative block max-w-md">
        <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden />
        <input className="field w-full pl-10" placeholder="Suchen, z. B. Shea" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Vorrat durchsuchen" />
      </label>
      {list.length === 0 ? (
        <EmptyState icon={Package} title={q ? 'Nichts gefunden' : 'Noch nichts eingelagert'} action={<Link className="btn-primary" to="/lager/gebinde">Gebinde einlagern</Link>}>
          {!q && 'Bestellungen aus dem Einkauf landen beim Wareneingang automatisch hier.'}
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((m) => {
            const left = m.lots.reduce((s, l) => s + l.gramsLeft, 0)
            const initial = m.lots.reduce((s, l) => s + l.gramsInitial, 0)
            const value = m.lots.reduce((s, l) => s + ((l.pricePerKg ?? 0) * l.gramsLeft) / 1000, 0)
            const mhd = m.lots.filter((l) => l.gramsLeft > 0 && l.bestBefore).map((l) => l.bestBefore!).sort()[0]
            const fill = initial ? left / initial : 0
            const tone = left <= 0 ? 'bad' : fill < 0.25 ? 'warn' : 'accent'
            return (
              <li key={m.key} className="card flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{m.name}</p>
                    <p className="eyebrow mt-0.5">{CATEGORY_LABELS[m.category]}</p>
                  </div>
                  {mhd && mhd < now ? <Chip tone="bad">MHD abgelaufen</Chip> : mhd && mhd < soon ? <Chip tone="warn">MHD {de(mhd)}</Chip> : null}
                </div>
                <p className="kpi">
                  {left >= 1000 ? fmt(left / 1000, 2) : fmt(left)}
                  <span className="ml-1 text-base font-normal text-muted">{left >= 1000 ? 'kg' : 'g'}</span>
                </p>
                <Bar value={left} max={initial} tone={tone} label={`Füllstand ${m.name}`} />
                <div className="flex items-center justify-between gap-2 text-xs text-muted">
                  <span>
                    {m.lots.length} Gebinde · {fmt(value, 2)} €
                  </span>
                  {onList(m) ? (
                    <span className="inline-flex items-center gap-1 text-accent">
                      <Check size={14} /> auf der Liste
                    </span>
                  ) : (
                    <button className="btn-ghost min-h-9 px-2 text-xs" onClick={() => reorder(m)}>
                      <Plus size={14} /> Nachbestellen
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
