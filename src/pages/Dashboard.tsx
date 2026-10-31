import { BookOpen, CalendarClock, FlaskConical, Hourglass, ListChecks, Package, PencilRuler, Scale, Scissors, ShieldCheck, ShoppingCart, Tag, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { addDays } from '../core/batch'
import { allTasks, type TaskKind } from '../core/tasks'
import { barsLeft, isTub, readyDate } from '../db'
import { fmt } from '../format'
import { atBatchSize, daysBetween, de, groupRecipes, recipeFeasibility, today, useWorkshop } from '../hooks'
import { Bar, Chip, Kpi, Panel, StatusDot, TaskTile } from '../components/ui'

const TASK_ICON: Record<TaskKind, LucideIcon> = { cut: Scissors, weigh: Scale, test: ShieldCheck, label: Tag }

function greeting(): string {
  const h = new Date().getHours()
  return h < 11 ? 'Guten Morgen' : h < 18 ? 'Guten Tag' : 'Guten Abend'
}

export function Dashboard() {
  const w = useWorkshop()
  if (!w) return null
  const now = today()
  const { recipes, batches, inventory, orderItems } = w

  const families = groupRecipes(recipes)
  const feas = recipes.map((r) => ({ recipe: r, f: recipeFeasibility(r, inventory, w.batchFat) }))
  const ready = feas.filter((x) => x.f && x.f.count > 0)
  const curing = batches.filter((b) => barsLeft(b) > 0 && readyDate(b) > now).sort((a, b) => readyDate(a).localeCompare(readyDate(b)))
  const barsInStock = batches.filter((b) => readyDate(b) <= now).reduce((s, b) => s + Math.max(0, barsLeft(b)), 0)
  const stockValue = inventory.lots.reduce((s, l) => s + ((l.pricePerKg ?? 0) * l.gramsLeft) / 1000, 0)
  const openOrders = orderItems.filter((o) => o.status === 'open').length
  const onTheWay = orderItems.filter((o) => o.status === 'ordered').length
  const recent = batches.slice(0, 5)
  const avgCost = recent.length ? recent.reduce((s, b) => s + (b.bars ? b.cost / b.bars : 0), 0) / recent.length : undefined

  const productName = (id: string) => inventory.products.find((p) => p.id === id)?.name ?? 'Gebinde'
  const in90 = addDays(now, 90)
  const tasks = allTasks(
    batches.map((b) => ({
      id: b.id,
      name: b.recipe.name,
      number: b.number,
      date: b.date,
      readyDate: readyDate(b),
      tub: isTub(b),
      unmoldedAt: b.unmoldedAt,
      weighings: b.weighings,
      tested: b.tested,
      labeledAt: b.labeledAt,
      barsLeft: barsLeft(b),
    })),
    now,
  )
  const alerts = [
    ...inventory.lots
      .filter((l) => l.gramsLeft > 0 && l.bestBefore && l.bestBefore <= in90)
      .sort((a, b) => a.bestBefore!.localeCompare(b.bestBefore!))
      .map((l) => ({
        key: l.id,
        tone: (l.bestBefore! < now ? 'bad' : 'warn') as 'bad' | 'warn',
        text: productName(l.productId),
        detail: l.bestBefore! < now ? `MHD abgelaufen ${de(l.bestBefore)}` : `MHD ${de(l.bestBefore)}`,
        to: '/lager',
      })),
  ]

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow">{new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{greeting()}. Was steht an?</h1>
      </header>

      <section aria-label="Anliegen" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <TaskTile
          primary
          to="/sieden"
          icon={FlaskConical}
          title="Sieden"
          subtitle="Charge planen und los"
          status={<Chip tone={ready.length ? 'ok' : 'warn'}>{ready.length} siedbar</Chip>}
        />
        <TaskTile to="/rezepte" icon={BookOpen} title="Rezepte" subtitle="Nachschlagen und vergleichen" status={<Chip>{families.length} Grundseifen</Chip>} />
        <TaskTile
          to="/lager"
          icon={Package}
          title="Vorrat"
          subtitle="Was ist da, was läuft ab"
          status={
            alerts.length ? (
              <Chip tone="warn">{alerts.length} Hinweise</Chip>
            ) : inventory.lots.some((l) => l.gramsLeft > 0) ? (
              <Chip tone="ok">alles ok</Chip>
            ) : (
              <Chip>leer</Chip>
            )
          }
        />
        <TaskTile
          to="/einkauf"
          icon={ShoppingCart}
          title="Einkauf"
          subtitle="Bedarf berechnen, bestellen"
          status={openOrders + onTheWay > 0 ? <Chip tone="accent">{openOrders} offen · {onTheWay} unterwegs</Chip> : undefined}
        />
        <TaskTile to="/rezepte?entwickeln=1" icon={PencilRuler} title="Entwickeln" subtitle="Assistent, Variante oder Grundseife" />
      </section>

      <section aria-label="Kennzahlen" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Link to="/lager/uebrig" className="card transition hover:border-accent/60">
          <Kpi label="Seife fertig" value={barsInStock} unit="Stück" hint="Übrig ansehen →" />
        </Link>
        <div className="card">
          <Kpi label="Am Reifen" value={curing.length} unit={curing.length === 1 ? 'Charge' : 'Chargen'} />
        </div>
        <div className="card">
          <Kpi label="Lagerwert" value={fmt(stockValue, 0)} unit="€" />
        </div>
        <div className="card">
          <Kpi label="Ø Kosten pro Stück" value={avgCost !== undefined ? fmt(avgCost, 2) : '–'} unit={avgCost !== undefined ? '€' : undefined} hint="letzte 5 Chargen" />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Reifeprozess" icon={Hourglass} action={<Link className="text-sm text-accent hover:underline" to="/chargen">Alle Chargen</Link>} className="lg:col-span-2">
          {curing.length === 0 ? (
            <p className="text-sm text-muted">Gerade reift nichts.</p>
          ) : (
            <ul className="space-y-4">
              {curing.map((b) => {
                const total = b.cureWeeks * 7
                const done = daysBetween(b.date, now)
                return (
                  <li key={b.id}>
                    <Link to={`/chargen/${b.id}`} className="group block">
                      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium group-hover:text-accent">{b.recipe.name}</span>
                        <span className="text-sm text-muted tabular-nums">
                          Tag {done} von {total} · reif {de(readyDate(b))}
                        </span>
                      </div>
                      <Bar value={done} max={total} label={`Reifung ${b.recipe.name}`} />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Heute zu tun" icon={ListChecks}>
          {tasks.length + alerts.length === 0 ? (
            <p className="text-sm text-muted">Nichts zu tun.</p>
          ) : (
            <ul className="space-y-1">
              {tasks.map((t) => {
                const Icon = TASK_ICON[t.kind]
                return (
                  <li key={`${t.batchId}${t.kind}`}>
                    <Link to={`/chargen/${t.batchId}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
                      <Icon size={16} className="shrink-0 text-accent" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{t.title}</span>
                        <span className="block truncate text-xs text-muted">{t.detail}</span>
                      </span>
                      {t.due < now && <span className="text-xs whitespace-nowrap text-warn">seit {de(t.due)}</span>}
                    </Link>
                  </li>
                )
              })}
              {alerts.slice(0, 8).map((a) => (
                <li key={a.key}>
                  <Link to={a.to} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
                    <StatusDot tone={a.tone} />
                    <span className="min-w-0 flex-1 truncate text-sm">{a.text}</span>
                    <span className="text-xs whitespace-nowrap text-muted">{a.detail}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Was kann ich sieden?" icon={CalendarClock} action={<Link className="text-sm text-accent hover:underline" to="/einkauf">Bedarf planen</Link>}>
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {feas.map(({ recipe, f }) => (
            <li key={recipe.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{recipe.name}</p>
                <p className="truncate text-xs text-muted">
                  {!f ? 'Rezept unvollständig' : f.count > 0 ? `Vorrat reicht für ${f.count}× ${fmt(atBatchSize(recipe, w.batchFat).input.totalFat)} g` : `Fehlt: ${f.missing.map((m) => m.name).join(', ')}`}
                </p>
              </div>
              {f && f.count > 0 ? (
                <Link className="btn-primary" to={`/sieden/${recipe.id}`}>
                  Sieden
                </Link>
              ) : (
                <Link className="btn" to={`/einkauf?rezept=${recipe.id}`}>
                  Besorgen
                </Link>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}
