import { ArrowLeft, ArrowRight, Check, CircleCheck, FlaskConical, Printer, ShoppingCart, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { NumberField } from '../components/NumberField'
import { Chip, EmptyState, PageHeader, Panel } from '../components/ui'
import { feasibility, needsOf, planConsumption } from '../core/batch'
import { calculate, type RecipeResult } from '../core/calc'
import { correct } from '../core/correction'
import { materialStock } from '../core/inventory'
import { createBatch, type Recipe } from '../db'
import { fmt } from '../format'
import { atBatchSize, groupRecipes, recipeFeasibility, today, useWorkshop } from '../hooks'

const STEPS = ['Rezept', 'Menge & Vorrat', 'Sieden', 'Abschluss'] as const

function Stepper({ step }: { step: number }) {
  return (
    <ol className="mb-6 grid grid-cols-4 gap-2" aria-label="Fortschritt">
      {STEPS.map((s, i) => (
        <li key={s} className="flex flex-col gap-1.5" aria-current={i === step ? 'step' : undefined}>
          <span className={`h-1 rounded-full ${i <= step ? 'bg-accent' : 'bg-track'}`} />
          <span className={`text-xs font-medium ${i === step ? 'text-accent' : i < step ? 'text-ink' : 'text-muted'}`}>
            {i + 1}. {s}
          </span>
        </li>
      ))}
    </ol>
  )
}

/** Schritt 1: Rezept wählen. */
export function SiedenStart() {
  const w = useWorkshop()
  if (!w) return null
  const families = groupRecipes(w.recipes)
  return (
    <div>
      <PageHeader eyebrow="Sieden" title="Welche Seife heute?" />
      <Stepper step={0} />
      {families.length === 0 && <EmptyState icon={FlaskConical} title="Noch keine Rezepte" action={<Link className="btn-primary" to="/rezepte">Zu den Rezepten</Link>} />}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {families.map(({ base, variants }) => (
          <section key={base.id} className="card flex flex-col gap-2">
            {[base, ...variants].map((r, i) => {
              const f = recipeFeasibility(r, w.inventory, w.batchFat)
              return (
                <Link
                  key={r.id}
                  to={`/sieden/${r.id}`}
                  className={`group flex items-center gap-3 rounded-xl p-3 transition hover:bg-surface-2 ${i === 0 ? '' : 'ml-4 border-l border-line'}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className={`truncate group-hover:text-accent ${i === 0 ? 'text-lg font-semibold' : 'font-medium'}`}>{r.name}</p>
                    <p className="truncate text-xs text-muted">{r.description}</p>
                  </div>
                  {f && (f.count > 0 ? <Chip tone="ok">Vorrat ok</Chip> : <Chip tone="warn">{f.missing.length} fehlt</Chip>)}
                  <ArrowRight size={18} className="text-muted group-hover:text-accent" aria-hidden />
                </Link>
              )
            })}
          </section>
        ))}
      </div>
    </div>
  )
}

/** Schritte 2–4 für ein gewähltes Rezept. */
export function SiedenRun() {
  const { id } = useParams()
  const w = useWorkshop()
  const recipe = w?.recipes.find((r) => r.id === id)
  if (!w) return null
  if (!recipe) return <EmptyState icon={FlaskConical} title="Rezept nicht gefunden" action={<Link className="btn" to="/sieden">Zurück</Link>} />
  return <Run key={recipe.id} recipe={recipe} w={w} />
}

function Run({ recipe, w }: { recipe: Recipe; w: NonNullable<ReturnType<typeof useWorkshop>> }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  // Startmenge: eigene Sudgröße (z. B. passend zur Form), sonst die Menge aus dem Rezept.
  const size = atBatchSize(recipe, w.batchFat).input.totalFat
  const [totalFat, setTotalFat] = useState<number | undefined>(size)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [actual, setActual] = useState<Record<string, number | undefined>>({})
  const [lyeTemp, setLyeTemp] = useState<number>()
  const [fatTemp, setFatTemp] = useState<number>()
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(today())
  const [cureWeeks, setCureWeeks] = useState<number | undefined>(recipe.input.lyeType === 'dual' ? 2 : 5)
  const [deduct, setDeduct] = useState(true)
  const [busy, setBusy] = useState(false)

  const scaled: Recipe = useMemo(() => ({ ...recipe, input: { ...recipe.input, totalFat: totalFat || 0 } }), [recipe, totalFat])
  const result = useMemo(() => calculate(scaled.input), [scaled])
  const needs = needsOf(result)
  const feas = feasibility(w.inventory, needs)
  const plan = planConsumption(w.inventory, needs)
  const ratio = recipe.input.totalFat ? calculate(recipe.input).batchWeight / recipe.input.totalFat : 1.4
  const bars = Math.floor(result.batchWeight / (recipe.barWeight ?? 100))

  /** Im Einkauf mit diesem Rezept und dieser Menge als Bedarf weitermachen. */
  function planMissing() {
    // Im Einkauf zählt ein Sud in der eigenen Sudgröße.
    const factor = size ? (totalFat || 0) / size : 1
    navigate(`/einkauf?rezept=${recipe.id}&faktor=${Math.round(factor * 100) / 100}`)
  }

  async function finish() {
    setBusy(true)
    const batch = await createBatch(scaled, {
      date,
      cureWeeks: cureWeeks ?? 0,
      deductStock: deduct,
      extra: { lyeTemp, fatTemp, notes: notes || undefined },
    })
    navigate(`/chargen/${batch.id}`)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Sieden"
        title={recipe.name}
        actions={
          <Link className="btn-ghost" to="/sieden">
            <ArrowLeft size={18} /> Anderes Rezept
          </Link>
        }
      />
      <Stepper step={step} />

      {step === 1 && (
        <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
          <Panel title="Menge">
            <div className="space-y-4">
              <label className="label">
                Fettmenge
                <NumberField value={totalFat} digits={0} suffix="g" onChange={setTotalFat} className="text-2xl" />
              </label>
              <label className="label">
                oder Stückzahl ({fmt(recipe.barWeight ?? 100)} g frisch)
                <NumberField value={bars} digits={0} suffix="Stück" onChange={(v) => v && setTotalFat(Math.round((v * (recipe.barWeight ?? 100)) / ratio))} />
              </label>
              <div className="grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
                <div>
                  <p className="eyebrow">Leim</p>
                  <p className="text-xl font-semibold tabular-nums">{fmt(result.batchWeight)} g</p>
                </div>
                <div>
                  <p className="eyebrow">Kosten</p>
                  <p className="text-xl font-semibold tabular-nums">{fmt(plan.cost, 2)} €</p>
                </div>
              </div>
            </div>
          </Panel>

          <Panel
            title="Vorrats-Check"
            action={feas.missing.length === 0 ? <Chip tone="ok">Alles da</Chip> : <Chip tone="warn">{feas.missing.length} fehlt</Chip>}
          >
            <ul className="divide-y divide-line">
              {needs.map((n) => {
                const stock = materialStock(w.inventory, n.key)
                const ok = stock >= n.grams
                return (
                  <li key={n.key} className="flex items-center gap-3 py-2.5">
                    {ok ? <CircleCheck size={18} className="text-ok" aria-label="vorhanden" /> : <TriangleAlert size={18} className="text-warn" aria-label="fehlt" />}
                    <span className="min-w-0 flex-1 truncate">{n.name}</span>
                    <span className="tabular-nums">{fmt(n.grams, n.grams < 100 ? 1 : 0)} g</span>
                    <span className={`w-24 text-right text-sm tabular-nums ${ok ? 'text-muted' : 'text-warn'}`}>{fmt(stock)} g da</span>
                  </li>
                )
              })}
            </ul>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {feas.missing.length > 0 && (
                <button className="btn" onClick={planMissing}>
                  <ShoppingCart size={18} /> Fehlendes auf Einkaufsliste
                </button>
              )}
              <button className="btn-primary" disabled={!totalFat} onClick={() => setStep(2)}>
                Los geht’s <ArrowRight size={18} />
              </button>
            </div>
          </Panel>
        </div>
      )}

      {step === 2 && (
        <SiedeModus
          result={result}
          checked={checked}
          toggle={(k) => setChecked((s) => (s.has(k) ? new Set([...s].filter((x) => x !== k)) : new Set([...s, k])))}
          actual={actual}
          setActual={(k, v) => setActual((a) => ({ ...a, [k]: v }))}
          temps={{ lyeTemp, fatTemp, setLyeTemp, setFatTemp }}
          notes={recipe.notes}
          worksheet={totalFat === recipe.input.totalFat ? `/rezepte/${recipe.id}/druck` : undefined}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <div className="mx-auto max-w-xl">
          <Panel title="Charge anlegen">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="label">
                Siededatum
                <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label className="label">
                Reifezeit
                <NumberField value={cureWeeks} digits={0} suffix="Wochen" onChange={setCureWeeks} />
              </label>
              <label className="label sm:col-span-2">
                Notizen
                <textarea className="field min-h-24" placeholder="Spur nach … Minuten, Gelphase, Auffälligkeiten" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
              <label className="flex min-h-11 items-center gap-3 text-sm sm:col-span-2">
                <input type="checkbox" className="size-5 accent-[var(--color-accent)]" checked={deduct} onChange={(e) => setDeduct(e.target.checked)} />
                Verbrauch aus dem Vorrat abbuchen
              </label>
            </div>
            <div className="mt-6 flex justify-between gap-2">
              <button className="btn-ghost" onClick={() => setStep(2)}>
                <ArrowLeft size={18} /> Zurück
              </button>
              <button className="btn-primary" disabled={busy} onClick={finish}>
                <Check size={18} /> Charge speichern
              </button>
            </div>
          </Panel>
        </div>
      )}
    </div>
  )
}

interface ModusProps {
  result: RecipeResult
  checked: Set<string>
  toggle: (key: string) => void
  actual: Record<string, number | undefined>
  setActual: (key: string, v: number | undefined) => void
  temps: { lyeTemp?: number; fatTemp?: number; setLyeTemp: (v?: number) => void; setFatTemp: (v?: number) => void }
  notes?: string
  /** Link zum Arbeitsblatt, nur wenn die Menge dem gespeicherten Rezept entspricht. */
  worksheet?: string
  onBack: () => void
  onNext: () => void
}

/** Großer, gut lesbarer Siede-Modus: abhaken, Ist-Werte eintragen, sofort nachrechnen. */
function SiedeModus({ result, checked, toggle, actual, setActual, temps, notes, worksheet, onBack, onNext }: ModusProps) {
  const r = result
  const acids = r.additives.filter((a) => a.additive.phase === 'lye' && a.lyeConsumed > 0)
  const lyeExtras = r.additives.filter((a) => a.additive.phase === 'lye' && a.lyeConsumed === 0)
  const fatExtras = r.additives.filter((a) => a.additive.phase === 'fats')
  const trace = r.additives.filter((a) => a.additive.phase === 'trace')

  const fatActual = r.fats.map((l) => actual[`fat:${l.fat.id}`])
  const lyeActual = r.lyeParts.length === 1 ? actual[`lye:${r.lyeParts[0].type}`] : undefined
  const deviates = fatActual.some((v) => v !== undefined) || lyeActual !== undefined
  const c = deviates ? correct(r, { fatGrams: fatActual, lyeWeighed: lyeActual }) : undefined

  const item = (k: string, name: string, grams: number, hint?: string, editable?: boolean) => (
    <ChecklistItem
      key={k}
      name={name}
      grams={grams}
      hint={hint}
      done={checked.has(k)}
      onToggle={() => toggle(k)}
      actual={editable ? actual[k] : undefined}
      onActual={editable ? (v) => setActual(k, v) : undefined}
    />
  )

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Phase A · Lauge">
          <ul className="space-y-2">
            {item('water', 'Wasser (destilliert)', r.water)}
            {acids.map((a) => (
              item(`add:${a.additive.id}`, a.additive.name, a.grams, 'Zuerst im kalten Wasser lösen')
            ))}
            {r.lyeParts.map((p) => (
              item(`lye:${p.type}`, p.type, p.weighed, 'Langsam ins Wasser, nie umgekehrt', r.lyeParts.length === 1)
            ))}
            {lyeExtras.map((a) => (
              item(`add:${a.additive.id}`, a.additive.name, a.grams, 'In die abgekühlte Lauge')
            ))}
          </ul>
        </Panel>
        <Panel title="Phase B · Fette">
          <ul className="space-y-2">
            {r.fats.map((l) => (
              item(`fat:${l.fat.id}`, l.fat.name, l.grams, undefined, true)
            ))}
            {fatExtras.map((a) => (
              item(`add:${a.additive.id}`, a.additive.name, a.grams)
            ))}
          </ul>
        </Panel>
      </div>

      {c && (
        <div className={`card ${Math.abs(c.addLye) < 0.05 ? '' : 'panel-glow'}`} role="status">
          <p className="eyebrow mb-2">Abweichung erkannt</p>
          {Math.abs(c.addLye) < 0.05 ? (
            <p>Passt, keine Korrektur nötig. Überfettung {fmt(c.superfatActual, 1)} %.</p>
          ) : c.addLye > 0 ? (
            <p className="text-lg">
              <b>{fmt(c.addLye, 1)} g {r.lyeParts.map((p) => p.type).join(' + ')}</b> und <b>{fmt(c.addWater, 1)} g Wasser</b> nachgeben,
              <span className="text-muted"> oder so lassen: {fmt(c.superfatActual, 1)} % Überfettung.</span>
            </p>
          ) : (
            <p className="text-lg">
              Zu viel Lauge: Fette um <b>{fmt((c.fatScale - 1) * 100, 1)} %</b> erhöhen (
              {r.fats.map((l, i) => `+${fmt(c.addFatGrams[i], 1)} g ${l.fat.name}`).join(', ')}).
              {c.superfatActual < 0 && <span className="text-bad"> Ohne Korrektur bleibt freie Lauge!</span>}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        {trace.length > 0 && (
          <Panel title="Phase C · In die Spur">
            <ul className="space-y-2">
              {trace.map((a) => (
                item(`add:${a.additive.id}`, a.additive.name, a.grams)
              ))}
            </ul>
          </Panel>
        )}
        <Panel title="Protokoll">
          <div className="grid grid-cols-2 gap-4">
            <label className="label">
              Temperatur Lauge
              <NumberField value={temps.lyeTemp} digits={0} suffix="°C" onChange={temps.setLyeTemp} />
            </label>
            <label className="label">
              Temperatur Fette
              <NumberField value={temps.fatTemp} digits={0} suffix="°C" onChange={temps.setFatTemp} />
            </label>
          </div>
          {notes && <p className="mt-4 rounded-lg bg-surface-2 p-3 text-sm text-muted">{notes}</p>}
        </Panel>
      </div>

      <div className="flex flex-wrap justify-between gap-2">
        <button className="btn-ghost" onClick={onBack}>
          <ArrowLeft size={18} /> Menge ändern
        </button>
        <div className="flex gap-2">
          {worksheet && (
            <Link className="btn" to={worksheet}>
              <Printer size={18} /> Arbeitsblatt
            </Link>
          )}
          <button className="btn-primary" onClick={onNext}>
            Fertig gesiedet <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

interface ItemProps {
  name: string
  grams: number
  hint?: string
  done: boolean
  onToggle: () => void
  actual?: number
  onActual?: (v: number | undefined) => void
}

function ChecklistItem({ name, grams, hint, done, onToggle, actual, onActual }: ItemProps) {
  return (
    <li className={`flex items-center gap-3 rounded-xl border p-3 transition ${done ? 'border-ok/40 bg-ok/5' : 'border-line bg-surface-2'}`}>
      <button
        className={`grid size-11 shrink-0 place-items-center rounded-xl border-2 transition ${done ? 'border-ok bg-ok text-accent-ink' : 'border-line hover:border-accent'}`}
        onClick={onToggle}
        aria-pressed={done}
        aria-label={`${name} abgewogen`}
      >
        {done && <Check size={22} />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`truncate font-medium ${done ? 'text-muted line-through' : ''}`}>{name}</p>
        {hint && <p className="truncate text-xs text-muted">{hint}</p>}
      </div>
      <span className={`text-2xl font-semibold tabular-nums sm:text-3xl ${done ? 'text-muted' : ''}`}>
        {fmt(grams, grams < 100 ? 1 : 0)}
        <span className="ml-1 text-base font-normal text-muted">g</span>
      </span>
      {onActual && <NumberField className="w-28" value={actual} digits={1} placeholder="Ist" ariaLabel={`${name} Ist-Wert`} onChange={onActual} />}
    </li>
  )
}
