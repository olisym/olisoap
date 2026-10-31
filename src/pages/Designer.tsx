import { FlaskConical, Save, ShoppingCart, Sparkles } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Findings } from '../components/Findings'
import { PropertyBars } from '../components/PropertyBars'
import { Chip, PageHeader, Panel } from '../components/ui'
import { needsOf, feasibility } from '../core/batch'
import { calculate } from '../core/calc'
import { barCount, recipeCost } from '../core/cost'
import { designedInput, designRecipe, templateFor, type DesignProcess, type FatReason, type Sliders } from '../core/designer'
import { evaluate } from '../core/evaluate'
import { materialPrice, materialStock, type MaterialKey } from '../core/inventory'
import { shelfMonths } from '../core/shelfLife'
import { FATS, FATS_BY_ID } from '../data/fats'
import { PROFILES } from '../data/profiles'
import { db, type Recipe } from '../db'
import { fmt } from '../format'
import { useWorkshop } from '../hooks'

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

/** Regler zwischen zwei Alltagswörtern. */
function Slider({ left, right, value, onChange }: { left: string; right: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="sr-only">
        {left} – {right}
      </span>
      <input type="range" min={0} max={100} step={5} value={Math.round(value * 100)} onChange={(e) => onChange(Number(e.target.value) / 100)} className="h-11 w-full cursor-pointer accent-[var(--color-accent)]" />
      <span className="-mt-1 flex justify-between text-sm">
        <span className={value <= 0.5 ? 'text-ink' : 'text-muted'}>{left}</span>
        <span className={value >= 0.5 ? 'text-ink' : 'text-muted'}>{right}</span>
      </span>
    </label>
  )
}

export function Designer() {
  const { t } = useTranslation()
  const w = useWorkshop()
  const navigate = useNavigate()
  const [profileId, setProfileId] = useState(DESIGNABLE[0].id)
  const [process, setProcess] = useState<DesignProcess>('cold')
  const [sliders, setSliders] = useState<Sliders>({ strength: 0.5, lather: 0.5, hardness: 0.5, price: 0.5 })
  const [source, setSource] = useState<'stock' | 'any'>('any')
  const [favorite, setFavorite] = useState('')
  const [excluded, setExcluded] = useState<string[]>([])
  // Regler bleiben flüssig, gerechnet wird mit dem zuletzt ruhigen Stand
  const request = useDeferredValue({ profileId, process, sliders, source, favorite, excluded })

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

  const outcome = useMemo(
    () =>
      designRecipe({
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

  if (!w) return <p className="text-muted">{t('Lade …')}</p>

  const result = outcome.ok ? outcome.result : undefined
  const input = result && designedInput(profile.id, result, request.process, superfat, totalFat)
  const calc = input && calculate(input)
  const findings = calc ? evaluate(calc, profile) : []
  const cost = calc && recipeCost(calc, (k: MaterialKey) => materialPrice(w.inventory, k))
  const bars = calc && barCount(calc.batchWeight, template?.barWeight ?? 100)
  const feas = calc && feasibility(w.inventory, needsOf(calc))
  const shelf = result && Math.min(...result.fats.map((f) => shelfMonths(`fat:${f.fatId}`) ?? 99))

  const set = (patch: Partial<Sliders>) => setSliders({ ...sliders, ...patch })
  const toggleExcluded = (id: string) => setExcluded(excluded.includes(id) ? excluded.filter((x) => x !== id) : [...excluded, id])
  const candidates = Object.keys(DESIGNABLE.find((p) => p.id === profileId)!.design!.fats)

  // Wünsche, die sich mit den Grenzen der Seifenart nicht ganz erfüllen lassen
  const KEY_LABELS = { hardness: t('Härte'), cleansing: t('Reinigung'), bubbly: t('großblasiger Schaum'), creamy: t('cremiger Schaum') } as const
  // Nur bewusst verschobene Regler zählen; in der Mitte heißt „egal“
  const sliderOf = { hardness: request.sliders.hardness, cleansing: request.sliders.strength, bubbly: request.sliders.lather, creamy: request.sliders.lather }
  const missed = result
    ? (Object.keys(KEY_LABELS) as (keyof typeof KEY_LABELS)[]).filter((k) => {
        const s = sliderOf[k] - 0.5
        const short = s > 0 ? result.targets[k] - result.properties[k] : result.properties[k] - result.targets[k]
        // Beim cremigen Schaum zeigt der Regler in die Gegenrichtung (links = cremig)
        const wanted = k === 'creamy' ? -short : short
        return Math.abs(s) >= 0.2 && wanted > 3
      })
    : []

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
              <Segmented label={t('Seifenart')} value={profileId} options={DESIGNABLE.map((p) => [p.id, templateFor(p.id)?.name ?? p.name])} onChange={(v) => (setProfileId(v), setExcluded([]))} />
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
              <div className="space-y-2">
                <Slider left={t('mild')} right={t('kräftig')} value={sliders.strength} onChange={(v) => set({ strength: v })} />
                <Slider left={t('cremig')} right={t('großblasig')} value={sliders.lather} onChange={(v) => set({ lather: v })} />
                <Slider left={t('weich')} right={t('hart')} value={sliders.hardness} onChange={(v) => set({ hardness: v })} />
                <Slider left={t('günstig')} right={t('Preis egal')} value={sliders.price} onChange={(v) => set({ price: v })} />
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
                  {t('Überfettung {{sf}} %, Lauge und Zusätze wie bei der Grundseife „{{name}}“.', { sf: fmt(superfat, 0), name: template?.name ?? profile.name })}
                  {request.process === 'both' && ' ' + t('Gesiedet wird kalt; wer heiß siedet, stellt im Rezept auf „Heiß“, das markierte Öl kommt dann nach dem Kochen dazu.')}
                </p>
              </Panel>

              {missed.length > 0 && (
                <p className="rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-sm">
                  {t('Nicht ganz erreichbar: {{list}}. Die Grenzen der Seifenart gehen vor, manche Wünsche ziehen in entgegengesetzte Richtungen (z. B. hart und großblasig).', {
                    list: missed.map((k) => `${KEY_LABELS[k]} (${t('Ziel {{target}}, erreicht {{value}}', { target: fmt(result.targets[k], 0), value: fmt(result.properties[k], 0) })})`).join(', '),
                  })}
                </p>
              )}

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
