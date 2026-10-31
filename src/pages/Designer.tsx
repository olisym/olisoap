import { ArrowLeft, ArrowRight, Check, FlaskConical, Save, ShoppingCart, Sparkles } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Findings } from '../components/Findings'
import { PropertyBars } from '../components/PropertyBars'
import { Chip, PageHeader, Panel, StatusDot } from '../components/ui'
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
  /** Name der Eigenschaft, z. B. „Reinigung“. */
  title: string
  left: string
  right: string
  value: number
  onChange: (v: number) => void
  /** Rechts neben dem Namen: was der Vorschlag erreicht. */
  reading?: string
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
 * Ein Balken je Eigenschaft: Auf der Schiene liegen die erreichbare Fläche und der Punkt für den Vorschlag, der Ring
 * ist der eigene Wunsch. Punkt im Ring heißt: Wunsch erfüllt. Fläche und Punkt gleiten, statt zu springen.
 */
function Slider({ title, left, right, value, onChange, reading, band, marker, leftNote, rightNote }: SliderProps) {
  const pct = (v: number) => `${clamp01(v) * 100}%`
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium">{title}</span>
        {reading && <span className="text-sm text-muted tabular-nums">{reading}</span>}
      </div>
      <div className="relative h-11">
        {/* Schiene um eine halbe Ringbreite eingerückt, damit Fläche und Punkt genau unter dem Ring stehen */}
        <div className="absolute inset-x-[11px] top-1/2 h-2 -translate-y-1/2 rounded-full bg-track" aria-hidden>
          {band && <div className="absolute inset-y-0 rounded-full bg-accent/40 transition-[left,width] duration-300 ease-out" style={{ left: pct(Math.min(...band)), width: `calc(${pct(Math.max(...band))} - ${pct(Math.min(...band))})` }} />}
          {marker !== undefined && <div className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink transition-[left] duration-300 ease-out" style={{ left: pct(marker) }} />}
        </div>
        <input type="range" min={0} max={100} step={5} value={Math.round(value * 100)} aria-label={`${title}: ${left} – ${right}`} onChange={(e) => onChange(Number(e.target.value) / 100)} className="wish-range absolute inset-0 w-full" />
      </div>
      <div className="flex justify-between text-sm">
        <span className={value <= 0.5 ? 'text-ink' : 'text-muted'}>
          {left}
          {leftNote && <span className="block text-xs text-muted">{leftNote}</span>}
        </span>
        <span className={`text-right ${value >= 0.5 ? 'text-ink' : 'text-muted'}`}>
          {right}
          {rightNote && <span className="block text-xs text-muted">{rightNote}</span>}
        </span>
      </div>
    </div>
  )
}

/** Legende der Regler, einmal oben. */
function SliderLegend() {
  const { t } = useTranslation()
  return (
    <div className="space-y-1.5 text-sm text-muted">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2 w-6 rounded-full bg-accent/40" /> {t('erreichbar')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-3 rounded-full bg-ink" /> {t('Vorschlag')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-4 rounded-full border-[3px] border-accent" /> {t('dein Wunsch')}
        </span>
      </div>
      <p>{t('Die Eigenschaften hängen über dieselben Fettsäuren zusammen: Verschiebst du eine, ändert sich, was bei den anderen erreichbar ist. Punkt im Ring heißt erfüllt, Mitte heißt egal.')}</p>
    </div>
  )
}

/** Breiter Bildschirm (Tablet quer, PC): Eingabe und Ergebnis nebeneinander. Schmal: Schritt für Schritt. */
function useWide(): boolean {
  const query = '(min-width: 1024px)'
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia(query)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => matchMedia(query).matches,
  )
}

/** Große Auswahlkarte (Seifenart, Verfahren), Trefferfläche ≥ 44 px. */
function ChoiceCard({ selected, title, text, badge, onSelect }: { selected: boolean; title: string; text?: string; badge?: string; onSelect: () => void }) {
  return (
    <button type="button" aria-pressed={selected} onClick={onSelect} className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left ${selected ? 'border-accent bg-accent/10' : 'border-line bg-surface-2 hover:border-accent/60'}`}>
      <span aria-hidden className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 ${selected ? 'border-accent bg-accent text-accent-ink' : 'border-line'}`}>
        {selected && <Check size={14} />}
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2 text-lg font-semibold">
          {title}
          {badge && <Chip tone="accent">{badge}</Chip>}
        </span>
        {text && <span className="block text-sm text-muted">{text}</span>}
      </span>
    </button>
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
  const shown = useRef(0)
  const [results, setResults] = useState<RangeAnswer['results']>()
  useEffect(() => {
    if (!base) return
    if (!worker.current) {
      worker.current = new Worker(new URL('../workers/designer.worker.ts', import.meta.url), { type: 'module' })
      worker.current.onmessage = (e: MessageEvent<RangeAnswer>) => {
        // Jede Antwort, die neuer ist als die angezeigte: So laufen die anderen Regler beim Ziehen sichtbar mit
        if (e.data.id > shown.current) {
          shown.current = e.data.id
          setResults(e.data.results)
        }
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

type WizardStep = 'art' | 'process' | 'fats' | 'props' | 'result'
const WIZARD: WizardStep[] = ['art', 'process', 'fats', 'props', 'result']

export function Designer() {
  const { t } = useTranslation()
  const w = useWorkshop()
  const waterHardness = useWaterHardness()
  const navigate = useNavigate()
  const wide = useWide()
  const [stepIndex, setStepIndex] = useState(0)
  const top = useRef<HTMLDivElement>(null)
  const [profileId, setProfileId] = useState(DESIGNABLE[0].id)
  const [process, setProcess] = useState<DesignProcess>('cold')
  const [sliders, setSliders] = useState<Sliders>({ strength: 0.5, lather: 0.5, hardness: 0.5, price: 0.5 })
  const [source, setSource] = useState<'stock' | 'any'>('any')
  // Aus „Übrig“: ein Fett, das weg muss, als Lieblingsöl vorbelegen (?fett=avocado)
  const [params] = useSearchParams()
  const [favorite, setFavorite] = useState(() => (FATS_BY_ID[params.get('fett') ?? ''] ? params.get('fett')! : ''))
  const [excluded, setExcluded] = useState<string[]>([])
  // Erst bündeln (gleiches Objekt, solange sich nichts ändert), dann verzögern. Ein frisches Objekt je Zeichnen
  // hätte bei jeder Antwort des Workers neu rechnen lassen: eine Endlosschleife.
  const current = useMemo(() => ({ profileId, process, sliders, source, favorite, excluded }), [profileId, process, sliders, source, favorite, excluded])
  const request = useDeferredValue(current)
  const step = WIZARD[stepIndex]

  // Neuer Schritt: oben anfangen
  useEffect(() => {
    if (!wide) top.current?.scrollIntoView({ block: 'start' })
  }, [stepIndex, wide])

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
  // Bereiche nur, wo Regler zu sehen sind (Siebe: vorher steht die Auswahl noch nicht fest)
  const ranges = useRanges(w && (wide || step === 'props') ? designRequest : undefined)

  if (!w) return <p className="text-muted">{t('Lade …')}</p>

  const result = outcome.ok ? outcome.result : undefined
  const input = result && designedInput(profile.id, result, request.process, superfat, totalFat, waterHardness)
  const calc = input && calculate(input)
  const findings = calc ? evaluate(calc, profile, { waterHardness }) : []
  const warnings = findings.filter((f) => f.severity !== 'info')
  const cost = calc && recipeCost(calc, (k: MaterialKey) => materialPrice(w.inventory, k))
  const bars = calc && barCount(calc.batchWeight, template?.barWeight ?? 100)
  const feas = calc && feasibility(w.inventory, needsOf(calc))
  const shelf = result && Math.min(...result.fats.map((f) => shelfMonths(`fat:${f.fatId}`) ?? 99))

  const set = (patch: Partial<Sliders>) => setSliders({ ...sliders, ...patch })
  const toggleExcluded = (id: string) => setExcluded(excluded.includes(id) ? excluded.filter((x) => x !== id) : [...excluded, id])
  const chooseProfile = (id: string) => {
    setProfileId(id)
    setExcluded([])
    setProcess(DESIGNABLE.find((p) => p.id === id)?.design?.process ?? 'cold')
  }
  const selectedProfile = DESIGNABLE.find((p) => p.id === profileId)!
  const candidates = Object.keys(selectedProfile.design!.fats)

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
      const span = lo?.costPerKg !== undefined && hi?.costPerKg !== undefined && hi.costPerKg > lo.costPerKg ? ([lo.costPerKg, hi.costPerKg] as const) : undefined
      return {
        leftNote: euro(lo),
        rightNote: euro(hi),
        band: span ? ([0, 1] as [number, number]) : undefined,
        marker: span && result?.costPerKg !== undefined ? (result.costPerKg - span[0]) / (span[1] - span[0]) : undefined,
        reading: result?.costPerKg !== undefined ? t('{{price}} €/kg', { price: fmt(result.costPerKg, 2) }) : undefined,
      }
    }
    const p = result?.properties
    return {
      band: lo && hi ? ([position(k, lo.properties), position(k, hi.properties)] as [number, number]) : undefined,
      marker: p ? position(k, p) : undefined,
      reading: !p ? undefined : k === 'strength' ? fmt(p.cleansing) : k === 'hardness' ? fmt(p.hardness) : t('großblasig {{b}} · cremig {{c}}', { b: fmt(p.bubbly), c: fmt(p.creamy) }),
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

  const processHint = (p: DesignProcess) =>
    ({
      cold: t('Glatte Oberfläche, 4–6 Wochen reifen.'),
      hot: t('Nach etwa einer Woche benutzbar, rustikalere Oberfläche. Ein Pflegeöl kommt gezielt nach dem Kochen dazu.'),
      both: t('Ein Rezept, das kalt und heiß funktioniert.'),
    })[p]
  const processNames: [DesignProcess, string][] = [
    ['cold', t('Kalt')],
    ['hot', t('Heiß')],
    ['both', t('Beides')],
  ]
  const recommendHot = selectedProfile.design?.process === 'hot'

  // ——— Bausteine, für beide Anordnungen gleich ———

  const slidersBlock = (
    <div className="space-y-4">
      <SliderLegend />
      <Slider title={t('Reinigung')} left={t('mild')} right={t('kräftig')} value={sliders.strength} onChange={(v) => set({ strength: v })} {...sliderView('strength', 0)} />
      <Slider title={t('Schaum')} left={t('cremig')} right={t('großblasig')} value={sliders.lather} onChange={(v) => set({ lather: v })} {...sliderView('lather', 1)} />
      <Slider title={t('Härte')} left={t('weich')} right={t('hart')} value={sliders.hardness} onChange={(v) => set({ hardness: v })} {...sliderView('hardness', 2)} />
      <Slider title={t('Preis')} left={t('günstig')} right={t('egal')} value={sliders.price} onChange={(v) => set({ price: v })} {...sliderView('price', 3)} />
    </div>
  )

  const fatsBlock = (
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
        <p className="mb-1.5 text-sm text-muted">{t('Diese Fette kommen für „{{name}}“ in Frage. Antippen zum Ausschließen.', { name: templateFor(profileId)?.name ?? selectedProfile.name })}</p>
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
  )

  const noResult = (
    <Panel>
      <p className="text-sm">
        {outcome.ok === false && outcome.problem === 'tooFewFats'
          ? source === 'stock'
            ? t('Mit dem Vorrat lässt sich diese Seifenart nicht sinnvoll mischen. Auf „Darf einkaufen“ stellen oder weniger ausschließen.')
            : t('Zu viele Fette ausgeschlossen: Die übrigen reichen nicht für 100 %.')
          : t('Für diese Seifenart gibt es keine Vorgaben.')}
      </p>
    </Panel>
  )

  const resultBlock = !result ? (
    noResult
  ) : (
    <div className="space-y-5">
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
    </div>
  )

  // Einleitung nur, solange man sie braucht: im Schritt-Modus ab Schritt 2 zählt jeder Zentimeter für die Regler
  const header = (
    <PageHeader eyebrow={t('Entwickeln')} title={t('Neue Seife zusammenstellen')}>
      {(wide || stepIndex === 0) && t('Wähle, was die Seife können soll. Die App schlägt Fette vor und begründet jedes.')}
    </PageHeader>
  )

  // ——— Breit: alles nebeneinander, Ergebnis live ———
  if (wide)
    return (
      <div className="space-y-6">
        {header}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
          <div className="space-y-5">
            <Panel>
              <div className="space-y-5">
                <Segmented label={t('Seifenart')} value={profileId} options={DESIGNABLE.map((p) => [p.id, templateFor(p.id)?.name ?? p.name])} onChange={chooseProfile} />
                <div>
                  <Segmented label={t('Verfahren')} value={process} options={processNames} onChange={setProcess} />
                  <p className="mt-1.5 text-sm text-muted">{recommendHot && process !== 'hot' ? t('Für diese Seifenart heiß: Viel Stearinsäure dickt kalt fast sofort an.') : processHint(process)}</p>
                </div>
              </div>
            </Panel>
            <Panel title={t('Eigenschaften')}>{slidersBlock}</Panel>
            <Panel title={t('Fette')}>{fatsBlock}</Panel>
          </div>
          {resultBlock}
        </div>
      </div>
    )

  // ——— Schmal: Schritt für Schritt, wie Siebe hintereinander ———
  const titles: Record<WizardStep, string> = { art: t('Seifenart'), process: t('Verfahren'), fats: t('Fette'), props: t('Eigenschaften'), result: t('Ergebnis') }
  const shortTitles: Record<WizardStep, string> = { art: t('Art'), process: t('Verfahren'), fats: t('Fette'), props: t('Ziele'), result: t('Ergebnis') }
  const intros: Record<WizardStep, string> = {
    art: t('Wofür ist die Seife? Davon hängt ab, welche Fette in Frage kommen und welche Grenzen gelten.'),
    process: t('Wie willst du sieden?'),
    fats: t('Woraus soll die Seife sein?'),
    props: t('Was soll die Seife können?'),
    result: t('Der Vorschlag mit Begründung, Gegenprobe und Kosten.'),
  }
  const bodies: Record<WizardStep, ReactNode> = {
    art: (
      <div className="space-y-2">
        {DESIGNABLE.map((p) => (
          <ChoiceCard key={p.id} selected={profileId === p.id} title={templateFor(p.id)?.name ?? p.name} text={p.description} onSelect={() => chooseProfile(p.id)} />
        ))}
      </div>
    ),
    process: (
      <div className="space-y-2">
        {processNames.map(([v, name]) => (
          <ChoiceCard key={v} selected={process === v} title={name} text={processHint(v)} badge={recommendHot && v === 'hot' ? t('empfohlen') : undefined} onSelect={() => setProcess(v)} />
        ))}
        {recommendHot && process !== 'hot' && <p className="rounded-xl border border-warn/50 bg-warn/10 p-3 text-sm">{t('Für diese Seifenart heiß: Viel Stearinsäure dickt kalt fast sofort an.')}</p>}
      </div>
    ),
    fats: fatsBlock,
    props: slidersBlock,
    result: resultBlock,
  }
  const last = stepIndex === WIZARD.length - 1

  return (
    <div ref={top} className="mx-auto max-w-2xl scroll-mt-4 space-y-5 pb-20">
      {header}
      <ol className="grid grid-cols-5 gap-1.5" aria-label={t('Schritte')}>
        {WIZARD.map((s, i) => (
          <li key={s}>
            <button type="button" disabled={i > stepIndex} onClick={() => setStepIndex(i)} aria-current={i === stepIndex ? 'step' : undefined} className="flex min-h-11 w-full flex-col gap-1.5 text-left disabled:cursor-default">
              <span className={`h-1 w-full rounded-full ${i <= stepIndex ? 'bg-accent' : 'bg-track'}`} />
              <span className={`truncate text-xs font-medium ${i === stepIndex ? 'text-accent' : i < stepIndex ? 'text-ink' : 'text-muted'}`}>{shortTitles[s]}</span>
            </button>
          </li>
        ))}
      </ol>

      <section className="card space-y-4" aria-labelledby="wizard-title">
        <div>
          <h2 id="wizard-title" className="text-2xl font-semibold tracking-tight">
            {titles[step]}
          </h2>
          <p className="text-muted">{intros[step]}</p>
        </div>
        {step === 'result' ? null : bodies[step]}
      </section>
      {step === 'result' && bodies.result}

      <div className="flex items-center justify-between gap-3">
        <button className="btn-ghost min-h-12" disabled={stepIndex === 0} onClick={() => setStepIndex(stepIndex - 1)}>
          <ArrowLeft size={18} /> {t('Zurück')}
        </button>
        {!last && (
          <button className="btn-primary min-h-12 px-6 text-lg" onClick={() => setStepIndex(stepIndex + 1)}>
            {stepIndex === WIZARD.length - 2 ? t('Zum Ergebnis') : t('Weiter')} <ArrowRight size={20} />
          </button>
        )}
      </div>

      {/* Bei den Reglern: das Wichtigste vom Ergebnis immer im Blick, Tipp führt zum vollen Ergebnis */}
      {step === 'props' && result && (
        <button
          type="button"
          onClick={() => setStepIndex(WIZARD.indexOf('result'))}
          className="fixed inset-x-3 bottom-20 z-20 flex min-h-12 items-center gap-3 rounded-2xl border border-line bg-surface/95 px-4 py-2 text-left shadow-2xl backdrop-blur md:bottom-4 md:left-30"
        >
          <StatusDot tone={warnings.length ? 'warn' : 'ok'} />
          <span className="min-w-0 flex-1 truncate text-sm">{result.fats.map((f) => `${FATS_BY_ID[f.fatId].name.split(' ')[0]} ${f.percent}`).join(' · ')}</span>
          {result.costPerKg !== undefined && <span className="text-sm text-muted tabular-nums">{fmt(result.costPerKg, 2)} €/kg</span>}
          <ArrowRight size={18} className="text-accent" aria-hidden />
        </button>
      )}
    </div>
  )
}
