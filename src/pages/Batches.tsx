import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Check, Scissors, Tag } from 'lucide-react'
import { NumberField } from '../components/NumberField'
import { addDays, cureStatus, earliestFatBestBefore, type Weighing } from '../core/batch'
import { parseWeights } from '../core/weights'
import { calculate } from '../core/calc'
import { evaluate } from '../core/evaluate'
import { PROFILES_BY_ID } from '../data/profiles'
import { barsLeft, db, deleteBatch, isTub, readyDate, type Batch } from '../db'
import { fmt } from '../format'

export const today = () => new Date().toISOString().slice(0, 10)
const de = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('de-DE') : '–')

type Status = 'curing' | 'ready' | 'empty'

export function batchStatus(b: Batch, now = today()): Status {
  if (barsLeft(b) <= 0) return 'empty'
  return readyDate(b) <= now ? 'ready' : 'curing'
}

const STATUS_STYLE: Record<Status, string> = {
  curing: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  ready: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
  empty: 'bg-track text-muted',
}

function StatusBadge({ batch }: { batch: Batch }) {
  const s = batchStatus(batch)
  const label = s === 'curing' ? `reift bis ${de(readyDate(batch))}` : s === 'ready' ? 'reif' : 'aufgebraucht'
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_STYLE[s]}`}>{label}</span>
}

export function BatchList() {
  const batches = useLiveQuery(() => db.batches.orderBy('date').reverse().toArray())
  const [showEmpty, setShowEmpty] = useState(false)
  if (!batches) return null
  const visible = batches.filter((b) => showEmpty || batchStatus(b) !== 'empty')
  const stock = batches.reduce((s, b) => s + Math.max(0, barsLeft(b)), 0)

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold">Chargen</h1>
        <p className="text-sm text-muted">{stock} Stücke vorrätig</p>
      </header>
      {batches.length === 0 && <p className="text-sm text-muted">Noch nichts gesiedet. Im Rezept auf „Sieden“ klicken, um eine Charge anzulegen.</p>}
      <ul className="space-y-2">
        {visible.map((b) => (
          <li key={b.id}>
            <Link to={`/chargen/${b.id}`} className="card flex flex-wrap items-center gap-x-4 gap-y-1 hover:border-accent">
              <span className="font-mono text-sm text-muted">{b.number}</span>
              <span className="font-semibold">{b.recipe.name}</span>
              <StatusBadge batch={b} />
              {b.recipient && <span className="chip">für {b.recipient}</span>}
              <span className="ml-auto text-sm text-muted tabular-nums">
                {de(b.date)} · {barsLeft(b)}/{b.bars} Stk · {b.bars > 0 ? `${fmt(b.cost / b.bars, 2)} €/Stk` : ''}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {batches.some((b) => batchStatus(b) === 'empty') && (
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} /> Aufgebrauchte anzeigen
        </label>
      )}
    </section>
  )
}

export function BatchDetail() {
  const { id } = useParams()
  const batch = useLiveQuery(() => (id ? db.batches.get(id) : undefined), [id])
  const lots = useLiveQuery(() => db.lots.toArray())
  const products = useLiveQuery(() => db.products.toArray())
  const navigate = useNavigate()
  if (!batch) return <p className="text-muted">Lade …</p>

  const update = (patch: Partial<Batch>) => db.batches.update(batch.id, patch)
  const result = calculate(batch.recipe.input)
  const profile = batch.recipe.profileId ? PROFILES_BY_ID[batch.recipe.profileId] : undefined
  const cure = cureStatus(batch.weighings)
  const fatMhd = earliestFatBestBefore(batch.deductions)
  const left = barsLeft(batch)
  const lotName = (lotId: string) => {
    const lot = lots?.find((l) => l.id === lotId)
    return products?.find((p) => p.id === lot?.productId)?.name ?? 'Gebinde gelöscht'
  }

  async function remove() {
    if (!confirm(`Charge ${batch!.number} löschen?`)) return
    const restore = batch!.deductions.length > 0 && confirm('Verbrauchte Mengen ins Lager zurückbuchen?')
    await deleteBatch(batch!, restore)
    navigate('/chargen')
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-sm text-muted">Charge {batch.number}</p>
          <h1 className="text-2xl font-semibold">
            {batch.recipe.name} <StatusBadge batch={batch} />
          </h1>
        </div>
        <Link className="btn" to={`/chargen/${batch.id}/etikett`}>
          <Tag size={16} /> Etikett
        </Link>
        <Link className="btn" to={`/chargen/${batch.id}/druck`}>
          Arbeitsblatt
        </Link>
        <Link className="btn" to={`/rezepte/${batch.recipeId}`}>
          Zum Rezept
        </Link>
        <button className="btn text-red-600" onClick={remove}>
          Löschen
        </button>
      </header>

      <Lifecycle batch={batch} update={update} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card grid gap-4 sm:grid-cols-2">
          <label className="label">
            Siededatum
            <input type="date" className="field" value={batch.date} onChange={(e) => e.target.value && update({ date: e.target.value })} />
          </label>
          <label className="label">
            Für
            <input className="field" placeholder="z. B. Christoph, selbst" value={batch.recipient ?? ''} onChange={(e) => update({ recipient: e.target.value || undefined })} />
          </label>
          <label className="label">
            Reifezeit
            <NumberField value={batch.cureWeeks} digits={0} suffix="Wochen" onChange={(v) => update({ cureWeeks: v ?? 0 })} />
          </label>
          <label className="label">
            Temperatur Lauge
            <NumberField value={batch.lyeTemp} digits={0} suffix="°C" onChange={(v) => update({ lyeTemp: v })} />
          </label>
          <label className="label">
            Temperatur Fette
            <NumberField value={batch.fatTemp} digits={0} suffix="°C" onChange={(v) => update({ fatTemp: v })} />
          </label>
          <label className="label">
            Ausgeformt & geschnitten
            <input type="date" className="field" value={batch.unmoldedAt ?? ''} onChange={(e) => update({ unmoldedAt: e.target.value || undefined })} />
          </label>
          <label className="label">
            Stücke geschnitten
            <NumberField value={batch.bars} digits={0} suffix="Stk" onChange={(v) => update({ bars: v ?? 0 })} />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={!!batch.tested} onChange={(e) => update({ tested: e.target.checked })} /> Zungen- bzw. pH-Test bestanden
          </label>
          <label className="label sm:col-span-2">
            Notizen (Spur, Gelphase, Auffälligkeiten, Eindruck beim Benutzen)
            <textarea className="field min-h-28" value={batch.notes ?? ''} onChange={(e) => update({ notes: e.target.value || undefined })} />
          </label>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h2 className="mb-2 font-semibold">Eckdaten</h2>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm tabular-nums">
              <dt>Frühestens reif</dt>
              <dd className="text-right">{de(readyDate(batch))}</dd>
              <dt>Kosten gesamt</dt>
              <dd className="text-right">{fmt(batch.cost, 2)} €</dd>
              <dt className="font-semibold">Kosten pro Stück</dt>
              <dd className="text-right font-semibold">{batch.bars > 0 ? `${fmt(batch.cost / batch.bars, 2)} €` : '–'}</dd>
              {batch.cutWeights && batch.cutWeights.length > 0 && (
                <>
                  <dt>Stückgewichte beim Schneiden</dt>
                  <dd className="text-right">
                    Ø {fmt(batch.cutWeights.reduce((a, b) => a + b, 0) / batch.cutWeights.length, 0)} g ({fmt(Math.min(...batch.cutWeights))}–
                    {fmt(Math.max(...batch.cutWeights))})
                  </dd>
                </>
              )}
              <dt>Frühestes MHD der Fette</dt>
              <dd className="text-right">{de(fatMhd)}</dd>
              <dt>Linol- + Linolensäure</dt>
              <dd className="text-right">{fmt(result.properties.polyunsaturated, 1)} %</dd>
            </dl>
            {batch.unpriced.length > 0 && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">Ohne Preis: {batch.unpriced.join(', ')}</p>}
            {result.properties.polyunsaturated > 15 && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">Viele mehrfach ungesättigte Fettsäuren: lieber zügig verbrauchen, auf orange Flecken achten.</p>
            )}
            {evaluate(result, profile).length > 0 && <p className="mt-2 text-xs text-muted">Das Rezept hatte beim Sieden Hinweise, siehe Rezept bzw. Arbeitsblatt.</p>}
          </div>

          <Stock batch={batch} left={left} update={update} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Weighings batch={batch} update={update} cure={cure} />
        <div className="card">
          <h2 className="mb-2 font-semibold">Verbrauch aus dem Lager</h2>
          {batch.deductions.length === 0 && batch.shortages.length === 0 ? (
            <p className="text-sm text-muted">Beim Sieden wurde nichts abgebucht.</p>
          ) : (
            <ul className="space-y-1 text-sm tabular-nums">
              {batch.deductions.map((d, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>{lotName(d.lotId)}</span>
                  <span className="text-muted">{fmt(d.grams, 1)} g</span>
                </li>
              ))}
              {batch.shortages.map((s) => (
                <li key={s.key} className="flex justify-between gap-2 text-amber-700 dark:text-amber-400">
                  <span>{s.name} (nicht im Lager)</span>
                  <span>{fmt(s.grams, 1)} g</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}

function Stock({ batch, left, update }: { batch: Batch; left: number; update: (p: Partial<Batch>) => void }) {
  const [count, setCount] = useState<number | undefined>(1)
  const [note, setNote] = useState('')
  return (
    <div className="card">
      <h2 className="mb-2 font-semibold">
        Bestand: {left} von {batch.bars} Stück
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <NumberField className="w-24" value={count} digits={0} suffix="Stk" ariaLabel="Anzahl" onChange={setCount} />
        <input className="field min-w-0 flex-1" placeholder="verschenkt an … / selbst benutzt" value={note} onChange={(e) => setNote(e.target.value)} />
        <button
          className="btn"
          disabled={!count}
          onClick={() => {
            update({ outflows: [...batch.outflows, { date: today(), count: count!, note: note || undefined }] })
            setNote('')
          }}
        >
          Ausbuchen
        </button>
      </div>
      {batch.outflows.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {batch.outflows.map((o, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-muted tabular-nums">{de(o.date)}</span>
              <span>{o.count} Stk</span>
              <span className="text-muted">{o.note}</span>
              <button className="btn-icon ml-auto" aria-label="Eintrag entfernen" onClick={() => update({ outflows: batch.outflows.filter((_, j) => j !== i) })}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Weighings({ batch, update, cure }: { batch: Batch; update: (p: Partial<Batch>) => void; cure: ReturnType<typeof cureStatus> }) {
  const [grams, setGrams] = useState<number>()
  const [date, setDate] = useState(today())
  const sorted = [...batch.weighings].sort((a, b) => a.date.localeCompare(b.date))
  const first = sorted[0]

  return (
    <div className="card">
      <h2 className="mb-1 font-semibold">Reifekontrolle</h2>
      <p className="mb-3 text-xs text-muted">
        Immer dasselbe Probestück wiegen, etwa einmal pro Woche. Seife verliert beim Reifen vor allem Wasser. Sinkt das Gewicht nicht
        mehr, ist sie durch. Das ist aussagekräftiger als eine feste Wochenzahl.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
        <NumberField className="w-28" value={grams} digits={1} suffix="g" ariaLabel="Gewicht" onChange={setGrams} />
        <button
          className="btn"
          disabled={!grams}
          onClick={() => {
            update({ weighings: [...batch.weighings, { date, grams: grams! } satisfies Weighing] })
            setGrams(undefined)
          }}
        >
          Eintragen
        </button>
      </div>
      {sorted.length > 0 && (
        <table className="mt-3 w-full text-sm tabular-nums">
          <tbody>
            {sorted.map((w, i) => (
              <tr key={i} className="border-t border-line">
                <td className="py-1 text-muted">{de(w.date)}</td>
                <td className="text-muted">Tag {Math.round((Date.parse(w.date) - Date.parse(batch.date)) / 864e5)}</td>
                <td className="text-right">{fmt(w.grams, 1)} g</td>
                <td className="text-right text-muted">{first && w !== first ? `−${fmt(((first.grams - w.grams) / first.grams) * 100, 1)} %` : ''}</td>
                <td className="w-8 text-right">
                  <button className="btn-icon" aria-label="Wägung entfernen" onClick={() => update({ weighings: batch.weighings.filter((x) => x !== w) })}>
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {cure.weeklyLossPercent !== undefined && (
        <p className={`mt-3 rounded-md px-3 py-2 text-sm ${cure.stable ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
          {cure.stable
            ? `✓ Gewicht stabil (letzte Woche −${fmt(cure.weeklyLossPercent, 2)} %). Die Seife ist weitgehend ausgereift.`
            : `Verliert noch −${fmt(cure.weeklyLossPercent, 2)} % pro Woche, reift noch.`}
        </p>
      )}
      {sorted.length === 1 && <p className="mt-2 text-xs text-muted">Nächste Wägung am {de(addDays(sorted[0].date, 7))}.</p>}
    </div>
  )
}

type Stage = { key: string; label: string; done: boolean; detail?: string }

/** Etappen einer Charge, wie sie in der Werkstatt ablaufen. Die aktuelle Etappe hat ihr Werkzeug direkt dabei. */
function Lifecycle({ batch, update }: { batch: Batch; update: (p: Partial<Batch>) => void }) {
  const tub = isTub(batch)
  const now = today()
  const cure = cureStatus(batch.weighings)
  const ready = readyDate(batch) <= now
  const stages: Stage[] = [
    { key: 'boil', label: 'Gesiedet', done: true, detail: de(batch.date) },
    ...(tub ? [] : [{ key: 'cut', label: 'Ausgeformt & geschnitten', done: !!batch.unmoldedAt, detail: batch.unmoldedAt ? `${de(batch.unmoldedAt)} · ${batch.bars} Stk` : undefined }]),
    { key: 'cure', label: 'Gereift', done: ready && (cure.stable || batch.weighings.length < 2), detail: `ab ${de(readyDate(batch))}` },
    { key: 'test', label: 'Geprüft', done: !!batch.tested },
    { key: 'label', label: 'Etikettiert', done: !!batch.labeledAt, detail: batch.labeledAt ? de(batch.labeledAt) : undefined },
  ]
  const current = stages.find((s) => !s.done)

  return (
    <section className="card" aria-label="Etappen">
      <ol className="grid gap-3 sm:grid-cols-5">
        {stages.map((s) => (
          <li key={s.key} className="flex items-center gap-3 sm:flex-col sm:items-start">
            <span className={`grid size-8 shrink-0 place-items-center rounded-full border-2 ${s.done ? 'border-ok bg-ok text-accent-ink' : s === current ? 'border-accent text-accent' : 'border-line text-muted'}`}>
              {s.done ? <Check size={16} /> : <span className="size-2 rounded-full bg-current" />}
            </span>
            <span>
              <span className={`block text-sm font-medium ${s === current ? 'text-accent' : ''}`}>{s.label}</span>
              {s.detail && <span className="block text-xs text-muted">{s.detail}</span>}
            </span>
          </li>
        ))}
      </ol>
      {current?.key === 'cut' && <CutForm batch={batch} update={update} />}
      {current?.key === 'test' && ready && (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <p className="flex-1 text-sm text-muted">Zungentest: kurz mit der Zungenspitze an die Seife. Prickelt es wie eine 9-V-Batterie, braucht sie noch Zeit.</p>
          <button className="btn-primary" onClick={() => update({ tested: true })}>
            <Check size={18} /> Test bestanden
          </button>
        </div>
      )}
      {current?.key === 'label' && (
        <div className="mt-4 flex justify-end border-t border-line pt-4">
          <Link className="btn-primary" to={`/chargen/${batch.id}/etikett`}>
            <Tag size={18} /> Etiketten drucken
          </Link>
        </div>
      )}
    </section>
  )
}

/**
 * Ausformen und Schneiden: entweder Einzelgewichte (Text, auch per Spracheingabe) oder Stückzahl + Gesamtgewicht.
 * Das Ø-Gewicht wird die erste Wägung des Probestücks.
 */
function CutForm({ batch, update }: { batch: Batch; update: (p: Partial<Batch>) => void }) {
  const [date, setDate] = useState(today())
  const [text, setText] = useState('')
  const [count, setCount] = useState<number | undefined>(batch.bars)
  const [total, setTotal] = useState<number>()
  const weights = parseWeights(text)
  const n = weights.length || count
  const sum = weights.length ? weights.reduce((a, b) => a + b, 0) : total
  const avg = n && sum ? sum / n : undefined

  return (
    <div className="mt-4 space-y-3 border-t border-line pt-4">
      <label className="label">
        Einzelgewichte der Stücke (tippen oder diktieren, alles außer Zahlen wird ignoriert)
        <textarea className="field min-h-20 font-mono" placeholder="128 134 121 135 …" value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      {weights.length > 0 && (
        <p className="text-sm">
          <b>{weights.length} Stücke</b> erkannt: {weights.map((w) => fmt(w, w % 1 ? 1 : 0)).join(' · ')}
          <span className="text-muted">
            {' '}
            (Ø {fmt(avg!, 1)} g, {fmt(Math.min(...weights))}–{fmt(Math.max(...weights))} g, gesamt {fmt(sum!)} g)
          </span>
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-[auto_8rem_10rem_1fr_auto] sm:items-end">
        <label className="label">
          Geschnitten am
          <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        {weights.length === 0 ? (
          <>
            <label className="label">
              Stücke
              <NumberField value={count} digits={0} suffix="Stk" onChange={setCount} />
            </label>
            <label className="label">
              oder alle zusammen
              <NumberField value={total} digits={0} suffix="g" onChange={setTotal} />
            </label>
          </>
        ) : (
          <span className="sm:col-span-2" />
        )}
        <p className="text-sm text-muted">{avg ? `Ø ${fmt(avg, 1)} g wird die erste Wägung des Probestücks.` : ''}</p>
        <button
          className="btn-primary"
          disabled={!n}
          onClick={() =>
            update({
              unmoldedAt: date,
              bars: n!,
              cutWeight: sum,
              cutWeights: weights.length ? weights : undefined,
              weighings: avg ? [...batch.weighings, { date, grams: Math.round(avg * 10) / 10 }] : batch.weighings,
            })
          }
        >
          <Scissors size={18} /> Geschnitten
        </button>
      </div>
    </div>
  )
}
