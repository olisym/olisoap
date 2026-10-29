import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, ImagePlus, Printer, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
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
type IngredientMode = 'de' | 'inci' | 'none'

/** Maße für Banderolen in mm. Die Banderole läuft quer um das Stück: Rückseite, Kante, Vorderseite, Kante, Klebelasche. */
interface BandSize {
  width: number
  height: number
  band: number
  overlap: number
}

/** Etikett-Design: gilt für alle Chargen. Titel und Untertitel können pro Charge abweichen. */
export interface LabelDesign {
  format: Format
  band: BandSize
  logo?: string
  showLogo: boolean
  showTitle: boolean
  showSubtitle: boolean
  ingredients: IngredientMode
  frontText: string
  backText: string
  showBatch: boolean
  showDate: boolean
  showWeight: boolean
  showBestUse: boolean
}

const DEFAULT_DESIGN: LabelDesign = {
  format: 'band',
  band: { width: 70, height: 20, band: 45, overlap: 15 },
  showLogo: true,
  showTitle: true,
  showSubtitle: true,
  ingredients: 'de',
  frontText: '',
  backText: '',
  showBatch: true,
  showDate: true,
  showWeight: true,
  showBestUse: true,
}

const DESIGN_KEY = 'labelDesign'

function useDesign(): [LabelDesign, (patch: Partial<LabelDesign>) => void] {
  const stored = useLiveQuery(() => db.settings.get(DESIGN_KEY))
  const design = { ...DEFAULT_DESIGN, ...((stored?.value as Partial<LabelDesign>) ?? {}) }
  return [design, (patch) => db.settings.put({ key: DESIGN_KEY, value: { ...design, ...patch } })]
}

/** Logo verkleinern (max. 600 px), damit die Datenbank klein bleibt. Kleine SVG bleiben Vektor, große (oft mit eingebettetem Foto) werden Bild. */
async function readLogo(file: File): Promise<string> {
  const url = await new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(file)
  })
  if (file.type === 'image/svg+xml' && file.size < 100_000) return url
  const img = new Image()
  await new Promise((res, rej) => {
    img.onload = res
    img.onerror = rej
    img.src = url
  })
  // SVG ohne Größenangabe meldet 0 × 0: dann quadratisch annehmen.
  const w = img.naturalWidth || 600
  const h = img.naturalHeight || 600
  const scale = Math.min(1, 600 / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}

export function Labels() {
  const { id } = useParams()
  const batch = useLiveQuery(() => (id ? db.batches.get(id) : undefined), [id])
  const [d, setDesign] = useDesign()
  const [count, setCount] = useState<number>()
  const [skip, setSkip] = useState<number | undefined>(0)
  const [bestUse, setBestUse] = useState<string>()
  if (!batch) return <p className="text-muted">Lade …</p>

  const setBand = (patch: Partial<BandSize>) => setDesign({ band: { ...d.band, ...patch } })
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
    design: d,
    title: batch.labelTitle ?? batch.recipe.name,
    subtitle: batch.labelSubtitle ?? batch.recipe.description ?? '',
    ingredients: d.ingredients === 'none' ? '' : ingredients.map((i) => (d.ingredients === 'inci' ? (i.inci ?? i.de) : i.de)).join(', '),
    until: new Date(until).toLocaleDateString('de-DE', { month: '2-digit', year: 'numeric' }),
    weight,
  }
  const bandLength = 2 * d.band.width + 2 * d.band.height + d.band.overlap
  const tooLong = d.format === 'band' && bandLength > 200
  const updateBatch = (patch: Partial<Batch>) => db.batches.update(batch.id, patch)

  async function print() {
    await updateBatch({ labeledAt: new Date().toISOString().slice(0, 10), bestUse: until })
    window.print()
  }

  return (
    <div>
      <div className="no-print">
        <PageHeader
          eyebrow={`Charge ${batch.number}`}
          title="Etiketten"
          actions={
            <>
              <Link className="btn-ghost" to={`/chargen/${batch.id}`}>
                <ArrowLeft size={18} /> Zur Charge
              </Link>
              <button className="btn-primary" onClick={print} disabled={tooLong}>
                <Printer size={18} /> {n} drucken
              </button>
            </>
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
        <div className="no-print space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Panel title="Format">
            <Segmented
              value={d.format}
              options={[
                ['band', 'Banderole'],
                ['sticker', 'Aufkleber'],
              ]}
              onChange={(format) => setDesign({ format })}
            />
            {d.format === 'band' ? (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="label">
                  Stück breit
                  <NumberField value={d.band.width} digits={0} suffix="mm" onChange={(v) => setBand({ width: v ?? 70 })} />
                </label>
                <label className="label">
                  Stück hoch
                  <NumberField value={d.band.height} digits={0} suffix="mm" onChange={(v) => setBand({ height: v ?? 20 })} />
                </label>
                <label className="label">
                  Banderole breit
                  <NumberField value={d.band.band} digits={0} suffix="mm" onChange={(v) => setBand({ band: v ?? 45 })} />
                </label>
                <label className="label">
                  Klebelasche
                  <NumberField value={d.band.overlap} digits={0} suffix="mm" onChange={(v) => setBand({ overlap: v ?? 15 })} />
                </label>
                <p className={`col-span-2 text-xs ${tooLong ? 'text-bad' : 'text-muted'}`}>
                  {fmt(bandLength)} × {fmt(d.band.band)} mm, {Math.floor(270 / (d.band.band + 3))} pro A4-Seite.
                  {tooLong && ' Zu lang für A4 (max. 200 mm).'}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted">A4, 3 × 8 à 70 × 37 mm (z. B. Avery Zweckform 3475, Herma 4453).</p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="label">
                Anzahl
                <NumberField value={n} digits={0} suffix="Stk" onChange={setCount} />
              </label>
              {d.format === 'sticker' && (
                <label className="label" title="Bereits benutzte Etiketten überspringen">
                  Leer lassen
                  <NumberField value={skip} digits={0} onChange={setSkip} />
                </label>
              )}
            </div>
          </Panel>

          <Panel title="Vorderseite">
            <div className="space-y-3">
              <Toggle checked={d.showLogo} onChange={(showLogo) => setDesign({ showLogo })} label="Logo">
                {d.logo ? (
                  <span className="flex items-center gap-2">
                    <img src={d.logo} alt="" className="h-8 max-w-24 rounded bg-white object-contain p-0.5" />
                    <button className="btn-icon" aria-label="Logo entfernen" onClick={() => setDesign({ logo: undefined })}>
                      <Trash2 size={16} />
                    </button>
                  </span>
                ) : (
                  <label className="btn-ghost min-h-9 cursor-pointer px-2 text-xs">
                    <ImagePlus size={16} /> Hochladen
                    <input type="file" accept="image/*" className="sr-only" onChange={async (e) => e.target.files?.[0] && setDesign({ logo: await readLogo(e.target.files[0]) })} />
                  </label>
                )}
              </Toggle>
              <Toggle checked={d.showTitle} onChange={(showTitle) => setDesign({ showTitle })} label="Name" />
              {d.showTitle && (
                <input className="field w-full" value={info.title} onChange={(e) => updateBatch({ labelTitle: e.target.value })} aria-label="Name auf dem Etikett" />
              )}
              <Toggle checked={d.showSubtitle} onChange={(showSubtitle) => setDesign({ showSubtitle })} label="Untertitel" />
              {d.showSubtitle && (
                <input className="field w-full" value={info.subtitle} onChange={(e) => updateBatch({ labelSubtitle: e.target.value })} aria-label="Untertitel" />
              )}
              <label className="label">
                Freier Text
                <input className="field" placeholder="z. B. handgesiedet" value={d.frontText} onChange={(e) => setDesign({ frontText: e.target.value })} />
              </label>
            </div>
          </Panel>

          <Panel title="Rückseite">
            <div className="space-y-3">
              <div>
                <p className="mb-2 text-sm text-muted">Zutaten</p>
                <Segmented
                  value={d.ingredients}
                  options={[
                    ['de', 'Deutsch'],
                    ['inci', 'INCI'],
                    ['none', 'Keine'],
                  ]}
                  onChange={(ingredients) => setDesign({ ingredients })}
                />
              </div>
              <label className="label">
                Freier Text
                <textarea className="field min-h-16" placeholder="z. B. Hinweise zur Anwendung" value={d.backText} onChange={(e) => setDesign({ backText: e.target.value })} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Toggle checked={d.showBatch} onChange={(showBatch) => setDesign({ showBatch })} label="Charge" />
                <Toggle checked={d.showDate} onChange={(showDate) => setDesign({ showDate })} label="Siededatum" />
                <Toggle checked={d.showWeight} onChange={(showWeight) => setDesign({ showWeight })} label="Gewicht" />
                <Toggle checked={d.showBestUse} onChange={(showBestUse) => setDesign({ showBestUse })} label="Haltbar bis" />
              </div>
              {d.showBestUse && (
                <label className="label">
                  Am besten bis
                  <input type="date" className="field" value={until} onChange={(e) => setBestUse(e.target.value || undefined)} />
                </label>
              )}
              <p className="text-xs text-muted">
                Zutaten absteigend nach geschätztem Gewicht im fertigen Stück. Haltbarkeit: frühestes MHD der verwendeten Fette, höchstens
                {r.properties.polyunsaturated > 10 ? ' 12' : ' 24'} Monate.
                {d.ingredients === 'inci' && missingInci.length > 0 && ` Ohne INCI (deutsch gedruckt): ${missingInci.join(', ')}.`}
              </p>
            </div>
          </Panel>
        </div>

        <div className="overflow-x-auto">
          {d.format === 'band' ? (
            <div className="mx-auto flex w-[210mm] flex-col items-center gap-[3mm] bg-white py-[8mm] text-black shadow-xl print:py-0 print:shadow-none">
              {Array.from({ length: n }, (_, i) => (
                <Band key={i} info={info} />
              ))}
            </div>
          ) : (
            <div className="mx-auto grid w-[210mm] grid-cols-3 content-start bg-white text-black shadow-xl print:shadow-none">
              {Array.from({ length: (skip ?? 0) + n }, (_, i) => (
                <Sticker key={i} info={i >= (skip ?? 0) ? info : undefined} />
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`@media print { @page { size: A4; margin: ${d.format === 'band' ? '8mm 0' : '15mm 0 0 0'}; } }`}</style>
    </div>
  )
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex gap-1 rounded-xl bg-surface-2 p-1">
      {options.map(([v, label]) => (
        <button
          key={v}
          className={`min-h-9 rounded-lg px-3 text-sm font-medium ${value === v ? 'bg-surface text-accent shadow-sm' : 'text-muted hover:text-ink'}`}
          onClick={() => onChange(v)}
          aria-pressed={value === v}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function Toggle({ checked, onChange, label, children }: { checked: boolean; onChange: (v: boolean) => void; label: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-2">
      <label className="flex cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" className="size-5 accent-[var(--color-accent)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
      {checked && children}
    </div>
  )
}

interface LabelInfo {
  batch: Batch
  design: LabelDesign
  title: string
  subtitle: string
  ingredients: string
  until: string
  weight?: number
}

function Meta({ info }: { info: LabelInfo }) {
  const { design: d, batch } = info
  const left = [d.showBatch && `Charge ${batch.number}`, d.showDate && de(batch.date), d.showWeight && info.weight && `ca. ${fmt(info.weight, 0)} g`].filter(Boolean)
  if (!left.length && !d.showBestUse) return null
  return (
    <p className="mt-auto flex justify-between gap-2 pt-[1mm] text-[6pt] leading-tight">
      <span>{left.join(' · ')}</span>
      {d.showBestUse && <span className="font-semibold">bis {info.until}</span>}
    </p>
  )
}

function Front({ info, compact }: { info: LabelInfo; compact?: boolean }) {
  const { design: d } = info
  return (
    <>
      {d.showLogo && d.logo && <img src={d.logo} alt="" className={`object-contain ${compact ? 'mb-[1mm] max-h-[8mm]' : 'mb-[1.5mm] max-h-[14mm] max-w-[50mm]'}`} />}
      {d.showTitle && info.title && <p className={`leading-tight font-bold ${compact ? 'text-[10pt]' : 'text-[14pt]'}`}>{info.title}</p>}
      {d.showSubtitle && info.subtitle && <p className={`mt-[1mm] leading-tight text-black/70 ${compact ? 'line-clamp-1 text-[6pt]' : 'line-clamp-2 text-[6.5pt]'}`}>{info.subtitle}</p>}
      {d.frontText && <p className={`mt-[1mm] leading-tight ${compact ? 'text-[6pt]' : 'text-[7.5pt]'}`}>{d.frontText}</p>}
    </>
  )
}

function Back({ info, size }: { info: LabelInfo; size: string }) {
  const { design: d } = info
  return (
    <>
      {info.ingredients && (
        <>
          <p className={`${size} font-semibold`}>Zutaten</p>
          <p className={`${size} leading-[1.25]`}>{info.ingredients}</p>
        </>
      )}
      {d.backText && <p className={`${size} mt-[1mm] leading-[1.25] whitespace-pre-line`}>{d.backText}</p>}
      <Meta info={info} />
    </>
  )
}

function Sticker({ info }: { info?: LabelInfo }) {
  return (
    <div className="flex h-[37mm] w-[70mm] flex-col overflow-hidden border border-dashed border-black/15 px-[3.5mm] py-[2.5mm] print:border-transparent">
      {info && (
        <>
          <Front info={info} compact />
          <div className="mt-[0.8mm] flex flex-1 flex-col">
            <Back info={info} size="text-[5pt]" />
          </div>
        </>
      )}
    </div>
  )
}

/** Banderole: Rückseite | Kante | Vorderseite | Kante | Klebelasche. Kantentext steht quer. */
function Band({ info }: { info: LabelInfo }) {
  const { band } = info.design
  const edge = (text?: string) => (
    <div className="flex h-full items-center justify-center border-x border-dotted border-black/40" style={{ width: `${band.height}mm` }}>
      {text && <span className="text-[6pt] font-semibold tracking-wide whitespace-nowrap uppercase [writing-mode:vertical-rl]">{text}</span>}
    </div>
  )
  return (
    <div className="flex break-inside-avoid border border-black/30" style={{ height: `${band.band}mm` }}>
      <div className="flex flex-col px-[3mm] py-[2.5mm]" style={{ width: `${band.width}mm` }}>
        <Back info={info} size="text-[5.5pt]" />
      </div>
      {edge(info.design.showTitle ? info.title : undefined)}
      <div className="flex flex-col items-center justify-center px-[3mm] text-center" style={{ width: `${band.width}mm` }}>
        <Front info={info} />
      </div>
      {edge(info.design.showBatch ? `Charge ${info.batch.number}` : undefined)}
      <div className="flex items-center justify-center bg-black/[0.04]" style={{ width: `${band.overlap}mm` }}>
        <span className="text-[5pt] text-black/40 [writing-mode:vertical-rl]">kleben</span>
      </div>
    </div>
  )
}
