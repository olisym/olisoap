import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Printer } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { NumberField } from '../components/NumberField'
import { PageHeader, Panel } from '../components/ui'
import { earliestFatBestBefore } from '../core/batch'
import { calculate } from '../core/calc'
import { soapIngredients, suggestBestUse } from '../core/label'
import { barsLeft, db } from '../db'
import { fmt } from '../format'
import { de } from '../hooks'

// Bogen A4 mit 3 × 8 Etiketten à 70 × 37 mm (gängiges Format, z. B. Avery Zweckform 3475 / Herma 4453).
const COLS = 3
const ROWS = 8

export function Labels() {
  const { id } = useParams()
  const batch = useLiveQuery(() => (id ? db.batches.get(id) : undefined), [id])
  const [inci, setInci] = useState(false)
  const [count, setCount] = useState<number>()
  const [skip, setSkip] = useState<number | undefined>(0)
  const [bestUse, setBestUse] = useState<string>()
  if (!batch) return <p className="text-muted">Lade …</p>

  const r = calculate(batch.recipe.input)
  const ingredients = soapIngredients(r)
  const missingInci = ingredients.filter((i) => !i.inci).map((i) => i.de)
  const suggestion = suggestBestUse(batch.date, r.properties.polyunsaturated, earliestFatBestBefore(batch.deductions))
  const until = bestUse ?? batch.bestUse ?? suggestion
  const n = count ?? Math.max(1, barsLeft(batch))
  // Gewicht auf dem Etikett: letzte Wägung des Probestücks, sonst Schnittgewicht abzüglich ca. 10 % Reifeverlust.
  const lastWeighing = [...batch.weighings].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.grams
  const weight = lastWeighing ?? (batch.cutWeight && batch.bars ? (batch.cutWeight / batch.bars) * 0.9 : undefined)
  const text = ingredients.map((i) => (inci ? (i.inci ?? i.de) : i.de)).join(', ')

  async function print() {
    await db.batches.update(batch!.id, { labeledAt: new Date().toISOString().slice(0, 10), bestUse: until })
    window.print()
  }

  const labels = Array.from({ length: (skip ?? 0) + n }, (_, i) => i >= (skip ?? 0))

  return (
    <div>
      <div className="no-print">
        <PageHeader
          eyebrow={`Charge ${batch.number}`}
          title={`Etiketten: ${batch.recipe.name}`}
          actions={
            <>
              <Link className="btn-ghost" to={`/chargen/${batch.id}`}>
                <ArrowLeft size={18} /> Zur Charge
              </Link>
              <button className="btn-primary" onClick={print}>
                <Printer size={18} /> Drucken
              </button>
            </>
          }
        />
        <Panel className="mb-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="label">
              Anzahl
              <NumberField value={n} digits={0} suffix="Stk" onChange={setCount} />
            </label>
            <label className="label" title="Bereits benutzte Etiketten auf dem Bogen überspringen">
              Leere Plätze am Anfang
              <NumberField value={skip} digits={0} onChange={setSkip} />
            </label>
            <label className="label">
              Am besten bis
              <input type="date" className="field" value={until} onChange={(e) => setBestUse(e.target.value || undefined)} />
            </label>
            <label className="flex min-h-11 items-center gap-3 self-end text-sm">
              <input type="checkbox" className="size-5 accent-[var(--color-accent)]" checked={inci} onChange={(e) => setInci(e.target.checked)} />
              Zutaten als INCI
            </label>
          </div>
          <p className="mt-3 text-xs text-muted">
            Bogen A4, 3 × 8 Etiketten à 70 × 37 mm. Haltbarkeit vorgeschlagen aus dem frühesten MHD der verwendeten Fette, höchstens
            {r.properties.polyunsaturated > 10 ? ' 12' : ' 24'} Monate. Zutaten absteigend nach geschätztem Gewicht im fertigen Stück.
            {inci && missingInci.length > 0 && ` Ohne INCI-Bezeichnung (deutsch gedruckt): ${missingInci.join(', ')}.`}
          </p>
        </Panel>
      </div>

      <div className="label-sheet mx-auto grid w-[210mm] grid-cols-3 content-start gap-0 bg-white px-[0mm] py-[0mm] text-black shadow-xl print:shadow-none">
        {labels.slice(0, COLS * ROWS * Math.ceil(labels.length / (COLS * ROWS))).map((filled, i) => (
          <div key={i} className="flex h-[37mm] w-[70mm] flex-col overflow-hidden border border-dashed border-black/15 px-[3.5mm] py-[2.5mm] print:border-transparent">
            {filled && (
              <>
                <p className="text-[10pt] leading-tight font-bold">{batch.recipe.name}</p>
                <p className="mt-[0.8mm] text-[5pt] leading-[1.22]">{text}</p>
                <p className="mt-auto flex justify-between text-[6pt] leading-tight">
                  <span>
                    Charge {batch.number} · {de(batch.date)}
                    {weight && ` · ca. ${fmt(weight, 0)} g`}
                  </span>
                  <span className="font-semibold">bis {new Date(until).toLocaleDateString('de-DE', { month: '2-digit', year: 'numeric' })}</span>
                </p>
              </>
            )}
          </div>
        ))}
      </div>

      <style>{`@media print { @page { size: A4; margin: 15mm 0 0 0; } .label-sheet { width: 210mm; } }`}</style>
    </div>
  )
}
