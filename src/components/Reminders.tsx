import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { addDays } from '../core/batch'
import { barsLeft, db, readyDate } from '../db'

interface Reminder {
  key: string
  to: string
  text: string
  tone: 'info' | 'warn'
}

const de = (iso: string) => new Date(iso).toLocaleDateString('de-DE')

/** Was gerade ansteht: reife Chargen, fällige Wägungen, ablaufende Gebinde. */
export function Reminders() {
  const data = useLiveQuery(async () => ({
    batches: await db.batches.toArray(),
    lots: await db.lots.toArray(),
    products: await db.products.toArray(),
  }))
  if (!data) return null
  const now = new Date().toISOString().slice(0, 10)
  const inWeek = addDays(now, 7)
  const in90 = addDays(now, 90)
  const items: Reminder[] = []

  for (const b of data.batches) {
    if (barsLeft(b) <= 0) continue
    const ready = readyDate(b)
    if (ready > now && ready <= inWeek)
      items.push({ key: `r${b.id}`, to: `/chargen/${b.id}`, text: `${b.recipe.name} (${b.number}) ist ab ${de(ready)} reif.`, tone: 'info' })
    if (ready > now) {
      const last = b.weighings.map((w) => w.date).sort().at(-1)
      if (last && addDays(last, 7) <= now)
        items.push({ key: `w${b.id}`, to: `/chargen/${b.id}`, text: `${b.recipe.name} (${b.number}): Probestück wiegen.`, tone: 'info' })
    }
  }
  for (const l of data.lots) {
    if (l.gramsLeft <= 0 || !l.bestBefore || l.bestBefore > in90) continue
    const name = data.products.find((p) => p.id === l.productId)?.name ?? 'Gebinde'
    items.push({
      key: `l${l.id}`,
      to: '/lager',
      text: l.bestBefore < now ? `${name}: MHD abgelaufen (${de(l.bestBefore)}).` : `${name}: MHD ${de(l.bestBefore)}, bald verbrauchen.`,
      tone: l.bestBefore < now ? 'warn' : 'info',
    })
  }

  if (items.length === 0) return null
  return (
    <ul className="mb-6 space-y-1.5">
      {items.map((i) => (
        <li key={i.key}>
          <Link
            to={i.to}
            className={`block rounded-md border px-3 py-2 text-sm hover:border-accent ${i.tone === 'warn' ? 'border-amber-500/40 bg-amber-500/10' : 'border-line bg-surface'}`}
          >
            {i.text}
          </Link>
        </li>
      ))}
    </ul>
  )
}
