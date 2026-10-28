import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Printer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { NumberField } from '../components/NumberField'
import { PageHeader, Panel } from '../components/ui'
import { earliestFatBestBefore } from '../core/batch'
import { calculate } from '../core/calc'
import { soapIngredients, suggestBestUse } from '../core/label'
import { barsLeft, db, type Batch } from '../db'
import { fmt } from '../format'
import { de } from '../hooks'

type Format = 'band' | 'sticker'

/** Maße für Banderolen in mm. Die Banderole läuft quer um das Stück: Oberseite, Kante, Unterseite, Kante, Klebelasche. */
interface BandSize {
  width: number
  height: number
  band: number
  overlap: number
}

const DEFAULT_BAND: BandSize = { width: 70, height: 20, band: 45, overlap: 15 }
const STORAGE_KEY = 'olisoap-label-settings'

function loadSettings(): { format: Format; size: BandSize; inci: boolean } {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '')
    return { format: s.format ?? 'band', size: { ...DEFAULT_BAND, ...s.size }, inci: !!s.inci }
  } catch {
    return { format: 'band', size: DEFAULT_BAND, inci: false }
  }
}

export function Labels() {
  const { id } = useParams()
  const batch = useLiveQuery(() => (id ? db.batches.get(id) : undefined), [id])
  const [settings, setSettings] = useState(loadSettings)
  const [count, setCount] = useState<number>()
  const [skip, setSkip] = useState<number | undefined>(0)
  const [bestUse, setBestUse] = useState<string>()
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // Einstellungen gelten dann nur für diese Sitzung.
    }
  }, [settings])
  if (!batch) return <p className="text-muted">Lade …</p>

  const { format, size, inci } = settings
  const setSize = (patch: Partial<BandSize>) => setSettings({ ...settings, size: { ...size, ...patch } })
  const r = calculate(batch.recipe.input)
  const ingredients = soapIngredients(r)
  const missingInci = ingredients.filter((i) => !i.inci).map((i) => i.de)
  const until = bestUse ?? batch.bestUse ?? suggestBestUse(batch.date, r.properties.polyunsaturated, earliestFatBestBefore(batch.deductions))
  const n = count ?? Math.max(1, barsLeft(batch))
  // Gewicht: letzte Wägung des Probestücks, sonst Schnittgewicht abzüglich ca. 10 % Reifeverlust.
  const lastWeighing = [...batch.weighings].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.grams
  const weight = lastWeighing ?? (batch.cutWeight && batch.bars ? (batch.cutWeight / batch.bars) * 0.9 : undefined)
  const info: LabelInfo = {
    batch,
    text: ingredients.map((i) => (inci ? (i.inci ?? i.de) : i.de)).join(', '),
    until: new Date(until).toLocaleDateString('de-DE', { month: '2-digit', year: 'numeric' }),
    weight,
  }
  const bandLength = 2 * size.width + 2 * size.height + size.overlap
  const tooLong = format === 'band' && bandLength > 200

  async function print() {
    await db.batches.update(batch!.id, { labeledAt: new Date().toISOString().slice(0, 10), bestUse: until })
    window.print()
  }

  const slots = Array.from({ length: (skip ?? 0) + n }, (_, i) => i >= (skip ?? 0))

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
              <button className="btn-primary" onClick={print} disabled={tooLong}>
                <Printer size={18} /> Drucken
              </button>
            </>
          }
        />
        <Panel className="mb-6">
          <div className="mb-4 inline-flex gap-1 rounded-xl bg-surface-2 p-1">
            {(['band', 'sticker'] as const).map((f) => (
              <button
                key={f}
                className={`min-h-10 rounded-lg px-4 text-sm font-medium ${format === f ? 'bg-surface text-accent shadow-sm' : 'text-muted hover:text-ink'}`}
                onClick={() => setSettings({ ...settings, format: f })}
              >
                {f === 'band' ? 'Banderole zum Umwickeln' : 'Aufkleber 70 × 37 mm'}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="label">
              Anzahl
              <NumberField value={n} digits={0} suffix="Stk" onChange={setCount} />
            </label>
            {format === 'sticker' && (
              <label className="label" title="Bereits benutzte Etiketten auf dem Bogen überspringen">
                Leere Plätze am Anfang
                <NumberField value={skip} digits={0} onChange={setSkip} />
              </label>
            )}
            <label className="label">
              Am besten bis
              <input type="date" className="field" value={until} onChange={(e) => setBestUse(e.target.value || undefined)} />
            </label>
            <label className="flex min-h-11 items-center gap-3 self-end text-sm">
              <input type="checkbox" className="size-5 accent-[var(--color-accent)]" checked={inci} onChange={(e) => setSettings({ ...settings, inci: e.target.checked })} />
              Zutaten als INCI
            </label>
          </div>
          {format === 'band' && (
            <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="label">
                Stück: Breite (umwickelt)
                <NumberField value={size.width} digits={0} suffix="mm" onChange={(v) => setSize({ width: v ?? 70 })} />
              </label>
              <label className="label">
                Stück: Höhe
                <NumberField value={size.height} digits={0} suffix="mm" onChange={(v) => setSize({ height: v ?? 20 })} />
              </label>
              <label className="label">
                Banderole: Breite
                <NumberField value={size.band} digits={0} suffix="mm" onChange={(v) => setSize({ band: v ?? 45 })} />
              </label>
              <label className="label">
                Klebelasche
                <NumberField value={size.overlap} digits={0} suffix="mm" onChange={(v) => setSize({ overlap: v ?? 15 })} />
              </label>
            </div>
          )}
          <p className={`mt-3 text-xs ${tooLong ? 'text-bad' : 'text-muted'}`}>
            {format === 'band'
              ? `Banderole ${fmt(bandLength)} × ${fmt(size.band)} mm, ${Math.floor(270 / (size.band + 3))} pro A4-Seite. Gepunktete Linien sind Falzkanten, Schnittkante grau.` +
                (tooLong ? ' Zu lang für A4 (max. 200 mm): Klebelasche oder Maße verkleinern.' : '')
              : 'Bogen A4, 3 × 8 Etiketten à 70 × 37 mm (z. B. Avery Zweckform 3475 / Herma 4453).'}{' '}
            Zutaten absteigend nach geschätztem Gewicht im fertigen Stück.
            {inci && missingInci.length > 0 && ` Ohne INCI-Bezeichnung (deutsch gedruckt): ${missingInci.join(', ')}.`}
          </p>
        </Panel>
      </div>

      {format === 'band' ? (
        <div className="mx-auto flex w-[210mm] flex-col items-center gap-[3mm] bg-white py-[8mm] text-black shadow-xl print:py-0 print:shadow-none">
          {Array.from({ length: n }, (_, i) => (
            <Band key={i} info={info} size={size} />
          ))}
        </div>
      ) : (
        <div className="mx-auto grid w-[210mm] grid-cols-3 content-start bg-white text-black shadow-xl print:shadow-none">
          {slots.map((filled, i) => (
            <Sticker key={i} info={filled ? info : undefined} />
          ))}
        </div>
      )}

      <style>{`@media print { @page { size: A4; margin: ${format === 'band' ? '8mm 0' : '15mm 0 0 0'}; } }`}</style>
    </div>
  )
}

interface LabelInfo {
  batch: Batch
  text: string
  until: string
  weight?: number
}

function Footer({ info }: { info: LabelInfo }) {
  return (
    <p className="mt-auto flex justify-between gap-2 text-[6pt] leading-tight">
      <span>
        Charge {info.batch.number} · {de(info.batch.date)}
        {info.weight && ` · ca. ${fmt(info.weight, 0)} g`}
      </span>
      <span className="font-semibold">bis {info.until}</span>
    </p>
  )
}

function Sticker({ info }: { info?: LabelInfo }) {
  return (
    <div className="flex h-[37mm] w-[70mm] flex-col overflow-hidden border border-dashed border-black/15 px-[3.5mm] py-[2.5mm] print:border-transparent">
      {info && (
        <>
          <p className="text-[10pt] leading-tight font-bold">
            {info.batch.recipe.name}
            {info.batch.recipient && <span className="ml-1 text-[7pt] font-normal">für {info.batch.recipient}</span>}
          </p>
          <p className="mt-[0.8mm] text-[5pt] leading-[1.22]">{info.text}</p>
          <Footer info={info} />
        </>
      )}
    </div>
  )
}

/** Banderole: Rückseite | Kante | Vorderseite | Kante | Klebelasche. Kantentext steht quer. */
function Band({ info, size }: { info: LabelInfo; size: BandSize }) {
  const { batch } = info
  const edge = (text: string) => (
    <div className="flex h-full items-center justify-center border-x border-dotted border-black/40" style={{ width: `${size.height}mm` }}>
      <span className="text-[6pt] font-semibold tracking-wide whitespace-nowrap uppercase [writing-mode:vertical-rl]">{text}</span>
    </div>
  )
  return (
    <div className="flex break-inside-avoid border border-black/30" style={{ height: `${size.band}mm` }}>
      <div className="flex flex-col px-[3mm] py-[2.5mm]" style={{ width: `${size.width}mm` }}>
        <p className="text-[5.5pt] font-semibold">Zutaten</p>
        <p className="text-[5.5pt] leading-[1.25]">{info.text}</p>
        <Footer info={info} />
      </div>
      {edge(batch.recipe.name)}
      <div className="flex flex-col items-center justify-center px-[3mm] text-center" style={{ width: `${size.width}mm` }}>
        <p className="text-[14pt] leading-tight font-bold">{batch.recipe.name}</p>
        {batch.recipient && <p className="mt-[1mm] text-[9pt]">für {batch.recipient}</p>}
        {batch.recipe.description && <p className="mt-[1.5mm] line-clamp-2 text-[6.5pt] leading-tight text-black/70">{batch.recipe.description}</p>}
      </div>
      {edge(`Charge ${batch.number}`)}
      <div className="flex items-center justify-center bg-black/[0.04]" style={{ width: `${size.overlap}mm` }}>
        <span className="text-[5pt] text-black/40 [writing-mode:vertical-rl]">kleben</span>
      </div>
    </div>
  )
}
