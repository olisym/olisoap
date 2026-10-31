import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Findings } from '../components/Findings'
import { NumberField } from '../components/NumberField'
import { PropertyBars } from '../components/PropertyBars'
import { VariantDiff } from '../components/VariantDiff'
import { calculate, sapBasis, sapValue, type RecipeResult } from '../core/calc'
import { barCount, recipeCost } from '../core/cost'
import { materialPrice, materialStock, type Inventory } from '../core/inventory'
import { evaluate } from '../core/evaluate'
import { swapSuggestions } from '../core/swap'
import type { RecipeInput, TargetProfile, WaterMode } from '../core/types'
import { ADDITIVES, ADDITIVES_BY_ID } from '../data/additives'
import { FATS, FATS_BY_ID } from '../data/fats'
import { PROFILES, PROFILES_BY_ID } from '../data/profiles'
import { db, loadInventory, type Recipe } from '../db'
import { fmt } from '../format'
import { LabelText } from '../components/ui'
import { useExpert, useWaterHardness } from '../hooks'

const WATER_LABELS: Record<WaterMode['mode'], string> = {
  percentOfFats: 'Wasser in % der Fette',
  concentration: 'Laugenkonzentration %',
  ratio: 'Wasser : Lauge',
}

export function RecipeEditor() {
  const { id } = useParams()
  const stored = useLiveQuery(() => (id ? db.recipes.get(id) : undefined), [id])
  const [draft, setDraft] = useState<Recipe>()
  const inventory = useLiveQuery(loadInventory)
  const base = useLiveQuery(() => (stored?.baseId ? db.recipes.get(stored.baseId) : undefined), [stored?.baseId])
  const bases = useLiveQuery(() => db.recipes.filter((r) => !r.baseId).toArray())
  const navigate = useNavigate()
  const expert = useExpert()
  const waterHardness = useWaterHardness()

  useEffect(() => {
    if (stored && stored.id !== draft?.id) setDraft(stored)
  }, [stored, draft?.id])

  const result = useMemo(() => {
    if (!draft) return undefined
    try {
      return calculate(draft.input)
    } catch {
      return undefined
    }
  }, [draft])

  if (stored === undefined && !draft) return <p className="text-muted">Lade …</p>
  if (!draft) return <p>Rezept nicht gefunden.</p>

  const dirty = JSON.stringify(draft) !== JSON.stringify(stored)
  const profile = draft.profileId ? PROFILES_BY_ID[draft.profileId] : undefined
  const findings = result ? evaluate(result, profile, { waterHardness }) : []

  const set = (patch: Partial<Recipe>) => setDraft({ ...draft, ...patch })
  const setInput = (patch: Partial<RecipeInput>) => set({ input: { ...draft.input, ...patch } })
  const { input } = draft

  async function save() {
    await db.recipes.put({ ...draft!, updatedAt: new Date().toISOString() })
  }

  /** Variante anlegen. Varianten hängen immer direkt an der Grundseife. */
  async function createVariant(patch?: { input: RecipeInput; name: string }) {
    const now = new Date().toISOString()
    const baseId = draft!.baseId ?? draft!.id
    const copy: Recipe = {
      ...structuredClone(draft!),
      ...(patch && { input: patch.input }),
      id: crypto.randomUUID(),
      baseId,
      parentId: undefined,
      name: patch?.name ?? `${base?.name ?? draft!.name} Variante`,
      createdAt: now,
      updatedAt: now,
    }
    await db.recipes.add(copy)
    setDraft(copy)
    navigate(`/rezepte/${copy.id}`)
  }

  async function remove() {
    const hasVariants = (await db.recipes.where('id').notEqual(draft!.id).filter((r) => r.baseId === draft!.id).count()) > 0
    if (!confirm(`„${draft!.name}“ wirklich löschen?${hasVariants ? ' Ihre Varianten bleiben als eigenständige Rezepte erhalten.' : ''}`)) return
    await db.recipes.delete(draft!.id)
    navigate('/rezepte')
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <input
          className="field w-full min-w-0 text-xl font-semibold sm:w-auto sm:min-w-64 sm:flex-1"
          value={draft.name}
          aria-label="Rezeptname"
          onChange={(e) => set({ name: e.target.value })}
        />
        <button className="btn-primary" disabled={!dirty} onClick={save}>
          {dirty ? 'Speichern' : 'Gespeichert'}
        </button>
        <button className="btn" onClick={() => createVariant()}>
          Variante anlegen
        </button>
        {dirty || !result ? (
          <button className="btn-primary" disabled title="Erst speichern">
            Sieden
          </button>
        ) : (
            <Link className="btn-primary" to={`/sieden/${draft.id}`}>
              Sieden
            </Link>
        )}
        <Link className="btn" to={`/rezepte/${draft.id}/druck`}>
          Arbeitsblatt
        </Link>
        <Link className="btn" to={`/korrektur/${draft.id}`}>
          Korrektur
        </Link>
        <button className="btn text-red-600" onClick={remove}>
          Löschen
        </button>
      </header>


      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <div className="card grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="label">
              <LabelText hint="Wofür die Seife gedacht ist. Bestimmt, welche Bereiche bei den Kennzahlen grün sind und worauf die Gegenprobe achtet.">Seifenart</LabelText>
              <select className="field" value={draft.profileId ?? ''} onChange={(e) => set({ profileId: e.target.value || undefined })}>
                <option value="">– ohne –</option>
                {PROFILES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="label">
              <LabelText hint="Eine Variante ist eine Abwandlung einer Grundseife, z. B. mit Duft oder günstigeren Fetten. Die App zeigt dann die Unterschiede.">Variante von</LabelText>
              <select className="field" value={draft.baseId ?? ''} onChange={(e) => set({ baseId: e.target.value || undefined })}>
                <option value="">– keine, ist eine Grundseife –</option>
                {(bases ?? [])
                  .filter((r) => r.id !== draft.id)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="label">
              <LabelText hint="Summe aller Fette und Öle. Lauge, Wasser und Zusätze rechnet die App daraus.">Fette gesamt</LabelText>
              <NumberField value={input.totalFat} digits={0} suffix="g" onChange={(v) => setInput({ totalFat: v ?? 0 })} />
            </label>
            <label className="label">
              <LabelText initiallyOpen={!expert} hint="Anteil der Fette, der absichtlich unverseift bleibt: Puffer gegen Wiegefehler, milder auf der Haut. Üblich 5–8 %, Haarseife eher 3–5 %.">Überfettung</LabelText>
              <NumberField value={input.superfat} digits={1} suffix="%" onChange={(v) => setInput({ superfat: v ?? 0 })} />
            </label>
            <label className="label">
              <LabelText hint="NaOH ergibt feste Seife, KOH weiche bzw. flüssige. Eine Mischung macht Rasierseife cremig und streichfähig.">Lauge</LabelText>
              <select
                className="field"
                value={input.lyeType}
                onChange={(e) => {
                  const lyeType = e.target.value as RecipeInput['lyeType']
                  setInput(
                    lyeType === 'dual'
                      ? { lyeType, lyePurity: 100, kohShare: input.kohShare ?? 50, kohPurity: input.kohPurity ?? 90 }
                      : { lyeType, lyePurity: lyeType === 'KOH' ? 90 : 100 },
                  )
                }}
              >
                <option value="NaOH">NaOH (feste Seife)</option>
                <option value="KOH">KOH (Flüssigseife)</option>
                {/* Einsteiger: Mischlauge nur, wenn das Rezept sie schon nutzt (z. B. Rasierseife-Vorlage) */}
                {(expert || input.lyeType === 'dual') && <option value="dual">NaOH + KOH (z. B. Rasierseife)</option>}
              </select>
            </label>
            <label className="label">
              <LabelText hint="Kalt: Leim bis zur Spur, in die Form, 4–6 Wochen reifen. Heiß: Leim wird gekocht, bis er fertig verseift ist; Duft und Überfettungsöl kommen danach. Benutzbar nach etwa einer Woche, rustikalere Oberfläche.">
                Verfahren
              </LabelText>
              <select className="field" value={input.process ?? 'cold'} onChange={(e) => setInput({ process: e.target.value === 'hot' ? 'hot' : undefined })}>
                <option value="cold">Kalt (CP)</option>
                <option value="hot">Heiß (HP)</option>
              </select>
            </label>
            <label className="label">
              <LabelText hint="Steht auf der Verpackung. NaOH meist 99–100 %, KOH oft um 90 %. Die App wiegt entsprechend mehr ein.">
                Reinheit {input.lyeType === 'dual' ? 'NaOH' : 'der Lauge'}
              </LabelText>
              <NumberField value={input.lyePurity} digits={1} suffix="%" onChange={(v) => setInput({ lyePurity: v || 100 })} />
            </label>
            {input.lyeType === 'dual' && (
              <>
                <label className="label">
                  <LabelText hint="Anteil der Fette, der mit KOH verseift wird. Mehr KOH macht die Seife weicher und den Schaum cremiger.">KOH-Anteil</LabelText>
                  <NumberField value={input.kohShare} digits={0} suffix="%" onChange={(v) => setInput({ kohShare: v ?? 0 })} />
                </label>
                <label className="label">
                  Reinheit KOH
                  <NumberField value={input.kohPurity} digits={1} suffix="%" onChange={(v) => setInput({ kohPurity: v || 90 })} />
                </label>
              </>
            )}
            <label className="label">
              <LabelText
                initiallyOpen={!expert}
                hint={input.water.mode === 'concentration' ? 'Anteil der Lauge an Lauge + Wasser. Üblich sind 30–35 %. Höher (weniger Wasser): schneller fest, weniger Zeit zum Arbeiten.' : 'Wie viel Wasser zur Lauge kommt. Üblich sind 30–35 % Laugenkonzentration. Weniger Wasser: schneller fest, weniger Zeit zum Arbeiten.'}
              >
                {/* Einsteiger: ein Wassermodus; ein Rezept mit anderem Modus behält ihn und zeigt ihn an */}
                {!expert ? (
                  WATER_LABELS[input.water.mode]
                ) : (
                <select
                  className="field-inline"
                  value={input.water.mode}
                  onChange={(e) => {
                    const mode = e.target.value as WaterMode['mode']
                    setInput({ water: { mode, value: mode === 'ratio' ? 2 : mode === 'concentration' ? 33 : 30 } })
                  }}
                >
                  {Object.entries(WATER_LABELS).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
                )}
              </LabelText>
              <NumberField
                value={input.water.value}
                digits={2}
                suffix={input.water.mode === 'ratio' ? ': 1' : '%'}
                onChange={(v) => setInput({ water: { ...input.water, value: v ?? 0 } })}
              />
            </label>
          </div>

          <FatTable draft={draft} setInput={setInput} expert={expert} />
          <AdditiveTable draft={draft} setInput={setInput} />

          <label className="label card">
            Notizen
            <textarea className="field min-h-24" value={draft.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
          </label>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          {result && (
            <>
              <div className="card">
                <h2 className="mb-2 font-semibold">Lauge</h2>
                <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm tabular-nums">
                  {result.lyeForAdditives > 0 && (
                    <>
                      <dt>davon für Säuren</dt>
                      <dd className="text-right">{fmt((result.lyeForAdditives / result.lyePure) * 100, 1)} %</dd>
                    </>
                  )}
                  {result.lyeParts.map((p) => (
                    <Fragment key={p.type}>
                      <dt className="font-semibold">
                        {p.type} einwiegen{p.purity < 100 && <span className="font-normal text-muted"> ({fmt(p.purity, 0)} %)</span>}
                      </dt>
                      <dd className="text-right text-lg font-semibold">{fmt(p.weighed, 1)} g</dd>
                    </Fragment>
                  ))}
                  <dt className="font-semibold">Wasser</dt>
                  <dd className="text-right text-lg font-semibold">{fmt(result.water, 0)} g</dd>
                  {result.waterFromAdditives > 0 && (
                    <>
                      <dt className="text-muted">+ Wasser aus Zusätzen</dt>
                      <dd className="text-right text-muted">{fmt(result.waterFromAdditives, 0)} g</dd>
                    </>
                  )}
                  <dt>Laugenkonzentration</dt>
                  <dd className="text-right">{fmt(result.lyeConcentration, 1)} %</dd>
                  <dt>Wasser : Lauge</dt>
                  <dd className="text-right">{fmt(result.water / result.lyeWeighed, 2)} : 1</dd>
                  <dt>Gesamtgewicht Leim</dt>
                  <dd className="text-right">{fmt(result.batchWeight)} g</dd>
                </dl>
              </div>
              <div className="card">
                <h2 className="mb-3 font-semibold">Kennzahlen</h2>
                <PropertyBars properties={result.properties} profile={profile} />
                <p className="mt-3 text-xs text-muted">
                  Heuristik nach SoapCalc-Konvention, gut zum Vergleichen von Rezepten. Grüne Bereiche: passend zur Seifenart.
                </p>
              </div>
              {base && <VariantDiff variant={draft} base={base} />}
              <Findings findings={findings} />
              {inventory && (
                <SwapCard
                  input={input}
                  profile={profile}
                  inventory={inventory}
                  waterHardness={waterHardness}
                  onSwap={(fats) => setInput({ fats })}
                  onVariant={(fats, name) => createVariant({ input: { ...input, fats }, name: `${draft.name} ${name}` })}
                />
              )}
              {inventory && <CostCard result={result} inventory={inventory} barWeight={draft.barWeight ?? 100} onBarWeight={(barWeight) => set({ barWeight })} />}
            </>
          )}
        </aside>
      </div>
    </section>
  )
}

interface TableProps {
  draft: Recipe
  setInput: (patch: Partial<RecipeInput>) => void
}

function FatTable({ draft, setInput, expert }: TableProps & { expert: boolean }) {
  const { input } = draft
  const sum = input.fats.reduce((s, f) => s + f.percent, 0)
  const update = (i: number, patch: Partial<RecipeInput['fats'][number]>) =>
    setInput({ fats: input.fats.map((f, j) => (j === i ? { ...f, ...patch } : f)) })
  const used = new Set(input.fats.map((f) => f.fatId))
  const hot = input.process === 'hot'
  // Einsteiger: VZ-Spalte nur, wenn das Rezept eigene Werte hat, damit nichts unsichtbar mitrechnet
  const showSap = expert || input.fats.some((f) => f.sapKohOverride !== undefined)

  return (
    <div className="card overflow-x-auto">
      <h2 className="mb-3 font-semibold">Fette & Öle</h2>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted">
          <tr>
            <th className="pb-2 font-normal">Fett</th>
            <th className="w-24 pb-2 font-normal">Anteil</th>
            <th className="w-28 pb-2 font-normal">Menge</th>
            {showSap && (
              <th className="w-28 pb-2 font-normal">
                <LabelText hint="Verseifungszahl: mg KOH je g Fett, aus der Fettdatenbank. Nur ändern, wenn das Analysezertifikat abweicht.">VZ</LabelText>
              </th>
            )}
            {hot && (
              <th className="w-24 pb-2 font-normal">
                <LabelText hint="Erst nach dem Kochen einrühren, als gezieltes Überfettungsöl. Höchstens so viel, wie überfettet wird.">Danach</LabelText>
              </th>
            )}
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {input.fats.map((f, i) => {
            const fat = FATS.find((x) => x.id === f.fatId)
            return (
              <tr key={i} className="border-t border-line">
                <td className="py-1.5 pr-2">
                  <select className="field w-full" value={f.fatId} onChange={(e) => update(i, { fatId: e.target.value, sapKohOverride: undefined })}>
                    {FATS.map((x) => (
                      <option key={x.id} value={x.id} disabled={used.has(x.id) && x.id !== f.fatId}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="pr-2">
                  <NumberField value={f.percent} digits={2} suffix="%" onChange={(v) => update(i, { percent: v ?? 0 })} ariaLabel="Anteil" />
                </td>
                <td className="pr-2">
                  <NumberField
                    value={(input.totalFat * f.percent) / 100}
                    digits={1}
                    suffix="g"
                    ariaLabel="Menge"
                    onChange={(v) => input.totalFat > 0 && update(i, { percent: ((v ?? 0) / input.totalFat) * 100 })}
                  />
                </td>
                {showSap && (
                  <td className="pr-2">
                    <NumberField
                      value={f.sapKohOverride}
                      digits={1}
                      placeholder={fat ? String(fat.sapKoh) : ''}
                      ariaLabel="Verseifungszahl"
                      onChange={(v) => update(i, { sapKohOverride: v })}
                    />
                  </td>
                )}
                {hot && (
                  <td className="pr-2 text-center">
                    <input
                      type="checkbox"
                      className="size-5 accent-[var(--color-accent)]"
                      checked={!!f.afterCook}
                      aria-label={`${fat?.name ?? f.fatId} nach dem Kochen`}
                      onChange={(e) => update(i, { afterCook: e.target.checked || undefined })}
                    />
                  </td>
                )}
                <td>
                  <button className="btn-icon" aria-label="Entfernen" onClick={() => setInput({ fats: input.fats.filter((_, j) => j !== i) })}>
                    ×
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-line">
            <td className="py-2">
              <button
                className="btn"
                onClick={() => {
                  const next = FATS.find((x) => !used.has(x.id))
                  if (next) setInput({ fats: [...input.fats, { fatId: next.id, percent: Math.max(0, 100 - sum) }] })
                }}
              >
                + Fett
              </button>
            </td>
            <td className={`text-right tabular-nums ${Math.abs(sum - 100) > 0.05 ? 'font-semibold text-red-600' : 'text-muted'}`}>
              {fmt(sum, 1)} %
            </td>
            <td className="text-right tabular-nums text-muted">{fmt((input.totalFat * sum) / 100)} g</td>
            <td colSpan={1 + (hot ? 1 : 0) + (showSap ? 1 : 0)} className="text-right text-xs text-muted">
              {showSap && (
                <>
                  {sapBasis(input.lyeType)}-VZ Ø{' '}
                  {fmt(
                    input.fats.reduce((s, f) => {
                      const fat = FATS.find((x) => x.id === f.fatId)
                      return s + (fat ? sapValue(f.sapKohOverride ?? fat.sapKoh, sapBasis(input.lyeType)) * f.percent : 0)
                    }, 0) / (sum || 1),
                    4,
                  )}
                </>
              )}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function AdditiveTable({ draft, setInput }: TableProps) {
  const { input } = draft
  const update = (i: number, patch: Partial<RecipeInput['additives'][number]>) =>
    setInput({ additives: input.additives.map((a, j) => (j === i ? { ...a, ...patch } : a)) })

  return (
    <div className="card overflow-x-auto">
      <h2 className="mb-1 font-semibold">Zusätze</h2>
      <p className="mb-3 text-xs text-muted">Jeder Zusatz braucht einen Grund. Säuren werden automatisch in der Lauge verrechnet.</p>
      <div className="space-y-3">
        {input.additives.map((a, i) => {
          const add = ADDITIVES_BY_ID[a.additiveId]
          return (
            <div key={i} className="rounded-md border border-line p-3">
              <div className="flex flex-wrap items-center gap-2">
                <select className="field min-w-0 flex-1" value={a.additiveId} onChange={(e) => update(i, { additiveId: e.target.value })}>
                  <optgroup label="Zusätze">
                    {ADDITIVES.filter((x) => !x.fragrance).map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Duft (ätherische Öle)">
                    {ADDITIVES.filter((x) => x.fragrance).map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <NumberField className="w-28" value={a.percentOfFats} digits={2} suffix="%" ariaLabel="Dosierung" onChange={(v) => update(i, { percentOfFats: v ?? 0 })} />
                <span className="w-20 text-right text-sm tabular-nums">{fmt((input.totalFat * a.percentOfFats) / 100, 1)} g</span>
                <button className="btn-icon" aria-label="Entfernen" onClick={() => setInput({ additives: input.additives.filter((_, j) => j !== i) })}>
                  ×
                </button>
              </div>
              {add && (
                <div className="mt-2 space-y-1 text-xs text-muted">
                  <p>
                    <span className="font-semibold">Wozu:</span> {add.purpose}
                    {add.typicalPercent && ` Üblich: ${fmt(add.typicalPercent[0], 1)}–${fmt(add.typicalPercent[1], 1)} %.`}
                  </p>
                  <p>
                    <span className="font-semibold">Evidenz:</span> {add.evidence}
                  </p>
                </div>
              )}
              <input
                className="field mt-2 w-full text-sm"
                placeholder="Mein Grund für diesen Zusatz …"
                value={a.reason ?? ''}
                onChange={(e) => update(i, { reason: e.target.value || undefined })}
              />
            </div>
          )
        })}
      </div>
      <button className="btn mt-3" onClick={() => setInput({ additives: [...input.additives, { additiveId: ADDITIVES[0].id, percentOfFats: 1 }] })}>
        + Zusatz
      </button>
    </div>
  )
}

interface CostProps {
  result: RecipeResult
  inventory: Inventory
  barWeight: number
  onBarWeight: (g: number | undefined) => void
}

/**
 * Günstiger tauschen: nur sichtbar, wenn ein Fett 1:1 durch ein gleiches aus anderer Quelle oder ein sehr ähnliches
 * ersetzt werden kann, das je Sud spürbar billiger ist und die Gegenprobe nicht verschlechtert.
 */
function SwapCard({ input, profile, inventory, waterHardness, onSwap, onVariant }: {
  input: RecipeInput
  profile?: TargetProfile
  inventory: Inventory
  waterHardness?: number
  onSwap: (fats: RecipeInput['fats']) => void
  onVariant: (fats: RecipeInput['fats'], suffix: string) => void
}) {
  const { t } = useTranslation()
  const suggestions = useMemo(
    () => swapSuggestions(input, profile, (id) => materialPrice(inventory, `fat:${id}`)?.pricePerKg, { waterHardness }),
    [input, profile, inventory, waterHardness],
  )
  if (!suggestions.length) return null
  const swapped = (from: string, to: string) => input.fats.map((f) => (f.fatId === from ? { ...f, fatId: to, sapKohOverride: undefined } : f))
  return (
    <div className="card">
      <h2 className="mb-1 font-semibold">{t('Günstiger tauschen')}</h2>
      <p className="mb-3 text-xs text-muted">{t('Je Sud mit {{g}} g Fett. Die Gegenprobe bleibt mindestens so gut.', { g: fmt(input.totalFat) })}</p>
      <ul className="space-y-3">
        {suggestions.map((s) => (
          <li key={s.fromId + s.toId} className="text-sm">
            <p>
              <b>{FATS_BY_ID[s.fromId].name}</b> → <b>{FATS_BY_ID[s.toId].name}</b>
            </p>
            <p className="text-muted">
              {t('{{euro}} € günstiger', { euro: fmt(s.saving, 2) })} · {s.sameFat ? t('gleiches Fett, andere Quelle') : t('ähnliche Fettsäuren')}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <button className="btn min-h-11" onClick={() => onSwap(swapped(s.fromId, s.toId))}>
                {t('Tauschen')}
              </button>
              <button className="btn-ghost min-h-11" onClick={() => onVariant(swapped(s.fromId, s.toId), t('mit {{name}}', { name: FATS_BY_ID[s.toId].name }))}>
                {t('Als Variante anlegen')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function CostCard({ result, inventory, barWeight, onBarWeight }: CostProps) {
  const cost = recipeCost(result, (key) => materialPrice(inventory, key))
  const bars = barCount(result.batchWeight, barWeight)
  const hasStock = inventory.lots.length > 0

  return (
    <div className="card">
      <h2 className="mb-2 font-semibold">Kosten{hasStock && ' & Bestand'}</h2>
      <table className="w-full text-sm tabular-nums [&_td+td]:whitespace-nowrap">
        <thead className="text-left text-xs text-muted">
          <tr>
            <th className="font-normal">Zutat</th>
            <th className="text-right font-normal">Bedarf</th>
            {hasStock && <th className="text-right font-normal">Lager</th>}
            <th className="text-right font-normal">€</th>
          </tr>
        </thead>
        <tbody>
          {cost.lines.map((l) => {
            const stock = materialStock(inventory, l.key)
            return (
              <tr key={l.key} className="border-t border-line">
                <td className="py-1 pr-2">{l.name}</td>
                <td className="text-right">{fmt(l.grams, l.grams < 100 ? 1 : 0)} g</td>
                {hasStock && <td className={`pl-2 text-right ${stock < l.grams ? 'font-semibold text-red-600' : 'text-muted'}`}>{fmt(stock)} g</td>}
                <td className="pl-2 text-right" title={l.price ? `${fmt(l.price.pricePerKg, 2)} €/kg (${l.price.source === 'stock' ? 'Lager' : `Einkauf ${l.price.date}`})` : 'kein Preis bekannt'}>
                  {l.cost !== undefined ? fmt(l.cost, 2) : '–'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <dl className="mt-3 grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 border-t border-line pt-3 text-sm tabular-nums">
        <dt className="font-semibold">Gesamt</dt>
        <dd className="text-right text-lg font-semibold">{fmt(cost.total, 2)} €</dd>
        <dt>Stückgewicht frisch</dt>
        <dd className="w-28">
          <NumberField value={barWeight} digits={0} suffix="g" ariaLabel="Stückgewicht" onChange={onBarWeight} />
        </dd>
        <dt>Stücke</dt>
        <dd className="text-right">{bars}</dd>
        <dt className="font-semibold">pro Stück</dt>
        <dd className="text-right text-lg font-semibold">{bars > 0 ? `${fmt(cost.total / bars, 2)} €` : '–'}</dd>
      </dl>
      {cost.missing.length > 0 && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          Ohne Preis (nicht eingerechnet): {cost.missing.join(', ')}. Preise unter Lager → Artikel & Preise erfassen.
        </p>
      )}
    </div>
  )
}
