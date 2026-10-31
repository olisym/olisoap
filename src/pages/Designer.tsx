import { FlaskConical, Save, ShoppingCart, Sparkles } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { Findings } from '../components/Findings'
import { PropertyBars } from '../components/PropertyBars'
import { Chip, PageHeader, Panel } from '../components/ui'
import { needsOf, feasibility } from '../core/batch'
import { calculate } from '../core/calc'
import { barCount, recipeCost } from '../core/cost'
import { designedInput, designRecipe, templateFor, type DesignProcess, type DesignRequest, type FatReason, type Sliders } from '../core/designer'
import { evaluate } from '../core/evaluate'
import { materialPrice, materialStock, type MaterialKey } from '../core/inventory'
import { shelfMonths } from '../core/shelfLife'
import type { SoapProperties } from '../core/types'
import { FATS, FATS_BY_ID } from '../data/fats'
import { PROFILES } from '../data/profiles'
import { db, type Recipe } from '../db'
import { fmt } from '../format'
import { useWaterHardness, useWorkshop } from '../hooks'
import type { RangeAnswer, RangeJob } from '../workers/designer.worker'

const DESIGNABLE = PROFILES.filter((p) => p.design)

/** Auswahl aus wenigen Möglichkeiten als Knopfreihe (Material 3 „segmented button“), Trefferfläche ≥ 44 px. */
function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm text-muted">{label}</legend>
      <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl border border-line bg-surface-2 p-1">
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            className={`min-h-11 rounded-lg px-2 text-sm font-medium ${value === v ? 'bg-accent text-accent-ink' : 'text-muted hover:text-ink'}`}
            onClick={() => onChange(v)}
          >
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

interface SliderProps {
  left: string
  right: string
  value: number
  onChange: (v: number) => void
  /** Erreichbarer Bereich (0–1 auf der Reglerskala) mit den übrigen Reglern, wie sie stehen. */
  band?: [number, number]
  /** Wo der Vorschlag tatsächlich landet. */
  marker?: number
  /** Zusatz unter den Enden, z. B. Preis der Fettmischung. */
  leftNote?: string
  rightNote?: string
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/**
 * Regler zwischen zwei Alltagswörtern. Darunter die erreichbare Fläche und ein Punkt für das Erreichte: Wer hin und
 * her schiebt, sieht sofort, was mit dieser Seifenart geht, ohne Erklärtext.
 */
function Slider({ left, right, value, onChange, band, marker, leftNote, rightNote }: SliderProps) {
  const pct = (v: number) => `${clamp01(v) * 100}%`
  return (
    <label className="block">
      <span className="sr-only">
        {left} – {right}
      </span>
      <input type="range" min={0} max={100} step={5} value={Math.round(value * 100)} onChange={(e) => onChange(Number(e.target.value) / 100)} className="h-11 w-full cursor-pointer accent-[var(--color-accent)]" />
      {(band || marker !== undefined) && (
        // Innenabstand ≈ halbe Daumenbreite, damit Fläche und Punkt unter dem Daumen stehen
        <span className="block px-2" aria-hidden>
          <span className="relative -mt-1 block h-2 rounded-full bg-track">
            {band && <span className="absolute inset-y-0 rounded-full bg-accent/35" style={{ left: pct(Math.min(...band)), width: `calc(${pct(Math.max(...band))} - ${pct(Math.min(...band))})` }} />}
            {marker !== undefined && <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-ink" style={{ left: pct(marker) }} />}
          </span>
        </span>
      )}
      <span className="mt-1 flex justify-between text-sm">
        <span className={value <= 0.5 ? 'text-ink' : 'text-muted'}>
          {left}
          {leftNote && <span className="block text-xs text-muted">{leftNote}</span>}
        </span>
        <span className={`text-right ${value >= 0.5 ? 'text-ink' : 'text-muted'}`}>
          {right}
          {rightNote && <span className="block text-xs text-muted">{rightNote}</span>}
        </span>
      </span>
    </label>
  )
}

const SLIDER_KEYS = ['strength', 'lather', 'hardness', 'price'] as const

/** Erreichbare Bereiche je Regler, im Hintergrund gerechnet (Web Worker); bis zur Antwort ohne Fläche. */
function useRanges(base: DesignRequest | undefined): RangeAnswer['results'] | undefined {
  const worker = useRef<Worker>(undefined)
  // Höchstens ein Auftrag läuft; währenddessen zählt nur der neueste Stand (sonst staut es sich beim Schieben)
  const busy = useRef(false)
  const pending = useRef<RangeJob>(undefined)
  const latest = useRef(0)
  const [results, setResults] = useState<RangeAnswer['results']>()
  useEffect(() => {
    if (!base) return
    if (!worker.current) {
      worker.current = new Worker(new URL('../workers/designer.worker.ts', import.meta.url), { type: 'module' })
      worker.current.onmessage = (e: MessageEvent<RangeAnswer>) => {
        if (e.data.id === latest.current) setResults(e.data.results)
        busy.current = !!pending.current
        if (pending.current) worker.current!.postMessage(pending.current)
        pending.current = undefined
      }
    }
    const requests = SLIDER_KEYS.flatMap((k) => [0, 1].map((v) => ({ ...base, sliders: { ...base.sliders, [k]: v } })))
    const job: RangeJob = { id: ++latest.current, requests }
    if (busy.current) pending.current = job
    else {
      busy.current = true
      worker.current.postMessage(job)
    }
  }, [base])
  useEffect(() => () => worker.current?.terminate(), [])
  return results
}

export function Designer() {
  const { t } = useTranslation()
  const w = useWorkshop()
  const waterHardness = useWaterHardness()
  const navigate = useNavigate()
  const [profileId, setProfileId] = useState(DESIGNABLE[0].id)
  const [process, setProcess] = useState<DesignProcess>('cold')
  const [sliders, setSliders] = useState<Sliders>({ strength: 0.5, lather: 0.5, hardness: 0.5, price: 0.5 })
  const [source, setSource] = useState<'stock' | 'any'>('any')
  const [favorite, setFavorite] = useState('')
  const [excluded, setExcluded] = useState<string[]>([])
  // Regler bleiben flüssig, gerechnet wird mit dem zuletzt ruhigen Stand
  // Erst bündeln (gleiches Objekt, solange sich nichts ändert), dann verzögern. Ein frisches Objekt je Zeichnen
  // hätte bei jeder Antwort des Workers neu rechnen lassen: eine Endlosschleife.
  const current = useMemo(() => ({ profileId, process, sliders, source, favorite, excluded }), [profileId, process, sliders, source, favorite, excluded])
  const request = useDeferredValue(current)

  const profile = DESIGNABLE.find((p) => p.id === request.profileId)!
  const template = templateFor(profile.id)
  const superfat = template?.input.superfat ?? 6
  const totalFat = (template?.input.lyeType !== 'dual' && w?.batchFat) || template?.input.totalFat || 1000

  const inventory = w?.inventory
  const stock = useMemo(() => new Set(inventory ? FATS.filter((f) => materialStock(inventory, `fat:${f.id}`) > 0).map((f) => f.id) : []), [inventory])
  const prices = useMemo(() => {
    const out: Record<string, number> = {}
    if (inventory) for (const f of FATS) {
      const p = materialPrice(inventory, `fat:${f.id}`)
      if (p) out[f.id] = p.pricePerKg
    }
    return out
  }, [inventory])

  const designRequest = useMemo<DesignRequest>(
    () => ({
      profile: DESIGNABLE.find((p) => p.id === request.profileId)!,
      sliders: request.sliders,
      process: request.process,
      superfat: templateFor(request.profileId)?.input.superfat ?? 6,
      available: request.source === 'stock' ? stock : undefined,
      excluded: request.excluded,
      favorite: request.favorite || undefined,
      prices,
    }),
    [request, stock, prices],
  )
  const outcome = useMemo(() => designRecipe(designRequest), [designRequest])
  const ranges = useRanges(w ? designRequest : undefined)

  if (!w) return <p className="text-muted">{t('Lade …')}</p>

  const result = outcome.ok ? outcome.result : undefined
  const input = result && designedInput(profile.id, result, request.process, superfat, totalFat, waterHardness)
  const calc = input && calculate(input)
  const findings = calc ? evaluate(calc, profile, { waterHardness }) : []
  const cost = calc && recipeCost(calc, (k: MaterialKey) => materialPrice(w.inventory, k))
  const bars = calc && barCount(calc.batchWeight, template?.barWeight ?? 100)
  const feas = calc && feasibility(w.inventory, needsOf(calc))
  const shelf = result && Math.min(...result.fats.map((f) => shelfMonths(`fat:${f.fatId}`) ?? 99))

  const set = (patch: Partial<Sliders>) => setSliders({ ...sliders, ...patch })
  const toggleExcluded = (id: string) => setExcluded(excluded.includes(id) ? excluded.filter((x) => x !== id) : [...excluded, id])
  const candidates = Object.keys(DESIGNABLE.find((p) => p.id === profileId)!.design!.fats)

  // Position einer Kennzahl auf der Reglerskala (linkes Ende = erster Zielwert der Seifenart)
  const rules = profile.design!.targets
  const at = (v: number, [a, b]: [number, number]) => (v - a) / (b - a)
  const position = (k: (typeof SLIDER_KEYS)[number], p: SoapProperties) =>
    k === 'strength' ? at(p.cleansing, rules.cleansing) : k === 'hardness' ? at(p.hardness, rules.hardness) : (at(p.bubbly, rules.bubbly) + at(p.creamy, rules.creamy)) / 2
  const sliderView = (k: (typeof SLIDER_KEYS)[number], i: number) => {
    const lo = ranges?.[i * 2]
    const hi = ranges?.[i * 2 + 1]
    if (k === 'price') {
      const euro = (r?: { costPerKg?: number } | null) => (r?.costPerKg !== undefined ? t('{{price}} €/kg', { price: fmt(r.costPerKg, 2) }) : undefined)
      return { leftNote: euro(lo), rightNote: euro(hi) }
    }
    return {
      band: lo && hi ? ([position(k, lo.properties), position(k, hi.properties)] as [number, number]) : undefined,
      marker: result ? position(k, result.properties) : undefined,
    }
  }

  function reasonText(r: FatReason): string {
    const parts = r.roles.map(
      (role) =>
        ({
          cleansing: t('Reinigung und großblasiger Schaum (Laurinsäure)'),
          hardness: t('Härte und cremiger Schaum (Stearin-/Palmitinsäure)'),
          castor: t('trägt und stabilisiert den Schaum (Ricinolsäure)'),
          conditioning: t('Milde und Pflege (Ölsäure)'),
        })[role],
    )
    if (r.afterCook) parts.push(t('kommt nach dem Kochen dazu, als Überfettung'))
    if (r.favorite) parts.push(t('dein Lieblingsöl'))
    if (r.capped) parts.push(['coconut', 'babassu', 'palm-kernel'].includes(r.fatId) ? t('Laurinsäure-Öle hier höchstens {{max}} % (Hautverträglichkeit)', { max: profile.design!.lauricMax }) : t('am Höchstanteil'))
    if (r.cheap) parts.push(t('günstig'))
    return parts.join(' · ')
  }

  async function save(then: 'edit' | 'boil' | 'shop') {
    if (!input || !result) return
    const now = new Date().toISOString()
    const recipe: Recipe = {
      id: crypto.randomUUID(),
      name: t('{{name}} Entwurf', { name: template?.name ?? profile.name }),
      profileId: profile.id,
      barWeight: template?.barWeight,
      description: t('Mit dem Rezept-Assistenten zusammengestellt.'),
      notes: result.reasons.map((r) => `${FATS_BY_ID[r.fatId].name} ${r.percent} %: ${reasonText(r)}`).join('\n'),
      input,
      createdAt: now,
      updatedAt: now,
    }
    await db.recipes.add(recipe)
    navigate(then === 'boil' ? `/sieden/${recipe.id}` : then === 'shop' ? `/einkauf?rezept=${recipe.id}` : `/rezepte/${recipe.id}`)
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t('Entwickeln')} title={t('Neue Seife zusammenstellen')}>
        {t('Wähle, was die Seife können soll. Die App schlägt Fette vor und begründet jedes.')}
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <div className="space-y-5">
          <Panel>
            <div className="space-y-5">
              <Segmented label={t('Seifenart')} value={profileId} options={DESIGNABLE.map((p) => [p.id, templateFor(p.id)?.name ?? p.name])} onChange={(v) => (setProfileId(v), setExcluded([]), setProcess(DESIGNABLE.find((p) => p.id === v)?.design?.process ?? 'cold'))} />
              <Segmented
                label={t('Verfahren')}
                value={process}
                options={[
                  ['cold', t('Kalt')],
                  ['hot', t('Heiß')],
                  ['both', t('Beides')],
                ]}
                onChange={setProcess}
              />
              <p className="-mt-3 text-sm text-muted">
                {profile.design?.process === 'hot' && process !== 'hot'
                  ? t('Für diese Seifenart heiß: Viel Stearinsäure dickt kalt fast sofort an.')
                  : process === 'cold'
                    ? t('Kalt: glatte Oberfläche, 4–6 Wochen reifen.')
                    : process === 'hot'
                      ? t('Heiß: nach etwa einer Woche benutzbar, rustikalere Oberfläche. Ein Pflegeöl kommt gezielt nach dem Kochen dazu.')
                      : t('Beides: ein Rezept, das kalt und heiß funktioniert.')}
              </p>
              <div className="space-y-2">
                <Slider left={t('mild')} right={t('kräftig')} value={sliders.strength} onChange={(v) => set({ strength: v })} {...sliderView('strength', 0)} />
                <Slider left={t('cremig')} right={t('großblasig')} value={sliders.lather} onChange={(v) => set({ lather: v })} {...sliderView('lather', 1)} />
                <Slider left={t('weich')} right={t('hart')} value={sliders.hardness} onChange={(v) => set({ hardness: v })} {...sliderView('hardness', 2)} />
                <Slider left={t('günstig')} right={t('Preis egal')} value={sliders.price} onChange={(v) => set({ price: v })} {...sliderView('price', 3)} />
                <p className="text-xs text-muted">{t('Helle Fläche: erreichbar mit dieser Seifenart. Punkt: wo der Vorschlag landet.')}</p>
              </div>
            </div>
          </Panel>

          <Panel title={t('Fette')}>
            <div className="space-y-4">
              <Segmented
                label={t('Woraus?')}
                value={source}
                options={[
                  ['stock', t('Nur was da ist')],
                  ['any', t('Darf einkaufen')],
                ]}
                onChange={setSource}
              />
              <label className="label">
                {t('Lieblingsöl')}
                <select className="field" value={favorite} onChange={(e) => setFavorite(e.target.value)}>
                  <option value="">{t('– keins –')}</option>
                  {FATS.filter((f) => source === 'any' || stock.has(f.id)).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <p className="mb-1.5 text-sm text-muted">{t('Antippen zum Ausschließen')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {candidates
                    .filter((id) => source === 'any' || stock.has(id))
                    .map((id) => {
                      const off = excluded.includes(id)
                      return (
                        <button key={id} type="button" aria-pressed={off} className={`min-h-11 rounded-full border px-3 text-sm ${off ? 'border-line text-muted line-through' : 'border-accent/40 bg-accent/5'}`} onClick={() => toggleExcluded(id)}>
                          {FATS_BY_ID[id].name}
                        </button>
                      )
                    })}
                </div>
              </div>
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          {!result ? (
            <Panel>
              <p className="text-sm">
                {outcome.ok === false && outcome.problem === 'tooFewFats'
                  ? source === 'stock'
                    ? t('Mit dem Vorrat lässt sich diese Seifenart nicht sinnvoll mischen. Auf „Darf einkaufen“ stellen oder weniger ausschließen.')
                    : t('Zu viele Fette ausgeschlossen: Die übrigen reichen nicht für 100 %.')
                  : t('Für diese Seifenart gibt es keine Vorgaben.')}
              </p>
            </Panel>
          ) : (
            <>
              <Panel title={t('Vorschlag')} icon={Sparkles} action={<Chip>{t('{{fat}} g Fett', { fat: fmt(totalFat, 0) })}</Chip>}>
                <ul className="space-y-3">
                  {result.reasons.map((r) => (
                    <li key={r.fatId} className="grid grid-cols-[1fr_auto] gap-x-3">
                      <span className="font-medium">{FATS_BY_ID[r.fatId].name}</span>
                      <span className="text-right font-semibold tabular-nums">
                        {r.percent} % <span className="font-normal text-muted">· {fmt((totalFat * r.percent) / 100, 0)} g</span>
                      </span>
                      <span className="col-span-2 text-sm text-muted">{reasonText(r)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-muted">
                  {t('Überfettung {{sf}} %, Lauge und Zusätze wie bei der Grundseife „{{name}}“.', { sf: fmt(superfat, 0), name: template?.name ?? profile.name })}{' '}
                  {waterHardness !== undefined ? (
                    t('Zitronensäure passend zu {{dh}} °dH.', { dh: fmt(waterHardness, 1) })
                  ) : (
                    <Link to="/profil" className="underline">
                      {t('Wasserhärte im Profil eintragen, dann passt die App die Zitronensäure an.')}
                    </Link>
                  )}
                  {request.process === 'both' && ' ' + t('Gesiedet wird kalt; wer heiß siedet, stellt im Rezept auf „Heiß“, das markierte Öl kommt dann nach dem Kochen dazu.')}
                </p>
              </Panel>


              <Panel title={t('Gegenprobe')}>
                <Findings findings={findings} />
                <div className="mt-4">
                  <PropertyBars properties={result.properties} profile={profile} />
                </div>
              </Panel>

              <Panel title={t('Kosten, Vorrat, Haltbarkeit')}>
                <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
                  {cost && cost.missing.length < (calc?.fats.length ?? 0) && (
                    <>
                      <dt>{t('Ein Sud')}</dt>
                      <dd className="text-right font-semibold tabular-nums">{fmt(cost.total, 2)} €</dd>
                      {bars ? (
                        <>
                          <dt>{t('pro Stück ({{n}} Stück)', { n: bars })}</dt>
                          <dd className="text-right tabular-nums">{fmt(cost.total / bars, 2)} €</dd>
                        </>
                      ) : null}
                    </>
                  )}
                  {result.costPerKg !== undefined && (
                    <>
                      <dt>{t('Fettmischung')}</dt>
                      <dd className="text-right tabular-nums">{fmt(result.costPerKg, 2)} €/kg</dd>
                    </>
                  )}
                  <dt>{t('Vorrat')}</dt>
                  <dd className="text-right">{feas && feas.count > 0 ? t('reicht für {{n}} Sud(e)', { n: feas.count }) : t('fehlt: {{list}}', { list: feas?.missing.map((m) => m.name).join(', ') })}</dd>
                  {shelf !== undefined && shelf < 99 && (
                    <>
                      <dt>{t('Offene Fette halten')}</dt>
                      <dd className="text-right">{t('ca. {{n}} Monate (Faustregel)', { n: shelf })}</dd>
                    </>
                  )}
                </dl>
                {cost && cost.missing.length > 0 && <p className="mt-2 text-xs text-muted">{t('Ohne Preis: {{list}}', { list: cost.missing.join(', ') })}</p>}
              </Panel>

              <div className="flex flex-wrap gap-3">
                <button className="btn-primary" onClick={() => save('edit')}>
                  <Save size={18} aria-hidden /> {t('Als Rezept speichern')}
                </button>
                <button className={feas && feas.count > 0 ? 'btn-primary' : 'btn'} onClick={() => save('boil')}>
                  <FlaskConical size={18} aria-hidden /> {t('Speichern und sieden')}
                </button>
                <button className="btn" onClick={() => save('shop')}>
                  <ShoppingCart size={18} aria-hidden /> {t('Speichern und einkaufen')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
