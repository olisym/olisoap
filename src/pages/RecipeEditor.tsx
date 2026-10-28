import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Findings } from '../components/Findings'
import { NumberField } from '../components/NumberField'
import { PropertyBars } from '../components/PropertyBars'
import { calculate, sapValue, type RecipeResult } from '../core/calc'
import { barCount, recipeCost } from '../core/cost'
import { materialPrice, materialStock, type Inventory } from '../core/inventory'
import { evaluate } from '../core/evaluate'
import type { RecipeInput, WaterMode } from '../core/types'
import { ADDITIVES, ADDITIVES_BY_ID } from '../data/additives'
import { FATS } from '../data/fats'
import { PROFILES, PROFILES_BY_ID } from '../data/profiles'
import { db, loadInventory, type Recipe } from '../db'
import { fmt } from '../format'

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
  const navigate = useNavigate()

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
  const findings = result ? evaluate(result, profile) : []

  const set = (patch: Partial<Recipe>) => setDraft({ ...draft, ...patch })
  const setInput = (patch: Partial<RecipeInput>) => set({ input: { ...draft.input, ...patch } })
  const { input } = draft

  async function save() {
    await db.recipes.put({ ...draft!, updatedAt: new Date().toISOString() })
  }

  async function saveAsVersion() {
    const now = new Date().toISOString()
    const copy: Recipe = { ...draft!, id: crypto.randomUUID(), parentId: draft!.id, name: `${draft!.name} (neue Version)`, createdAt: now, updatedAt: now }
    await db.recipes.add(copy)
    setDraft(copy)
    navigate(`/rezepte/${copy.id}`)
  }

  async function remove() {
    if (!confirm(`„${draft!.name}“ wirklich löschen?`)) return
    await db.recipes.delete(draft!.id)
    navigate('/')
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <input
          className="field min-w-0 flex-1 text-xl font-semibold"
          value={draft.name}
          aria-label="Rezeptname"
          onChange={(e) => set({ name: e.target.value })}
        />
        <button className="btn-primary" disabled={!dirty} onClick={save}>
          {dirty ? 'Speichern' : 'Gespeichert'}
        </button>
        <button className="btn" onClick={saveAsVersion}>
          Als neue Version
        </button>
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
              Zielprofil
              <select className="field" value={draft.profileId ?? ''} onChange={(e) => set({ profileId: e.target.value || undefined })}>
                <option value="">– keins –</option>
                {PROFILES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="label">
              Gesamtfettmenge
              <NumberField value={input.totalFat} digits={0} suffix="g" onChange={(v) => setInput({ totalFat: v ?? 0 })} />
            </label>
            <label className="label">
              Überfettung
              <NumberField value={input.superfat} digits={1} suffix="%" onChange={(v) => setInput({ superfat: v ?? 0 })} />
            </label>
            <label className="label">
              Lauge
              <select
                className="field"
                value={input.lyeType}
                onChange={(e) => {
                  const lyeType = e.target.value as RecipeInput['lyeType']
                  setInput({ lyeType, lyePurity: lyeType === 'KOH' ? 90 : 100 })
                }}
              >
                <option value="NaOH">NaOH (feste Seife)</option>
                <option value="KOH">KOH (Flüssigseife)</option>
              </select>
            </label>
            <label className="label">
              Reinheit der Lauge
              <NumberField value={input.lyePurity} digits={1} suffix="%" onChange={(v) => setInput({ lyePurity: v || 100 })} />
            </label>
            <label className="label">
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
              <NumberField
                value={input.water.value}
                digits={2}
                suffix={input.water.mode === 'ratio' ? ': 1' : '%'}
                onChange={(v) => setInput({ water: { ...input.water, value: v ?? 0 } })}
              />
            </label>
          </div>

          <FatTable draft={draft} setInput={setInput} />
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
                  <dt>{input.lyeType} für Fette</dt>
                  <dd className="text-right">{fmt(result.lyeForFats / (input.lyePurity / 100), 1)} g</dd>
                  {result.lyeForAdditives > 0 && (
                    <>
                      <dt>{input.lyeType} für Säuren</dt>
                      <dd className="text-right">{fmt(result.lyeForAdditives / (input.lyePurity / 100), 1)} g</dd>
                    </>
                  )}
                  <dt className="font-semibold">{input.lyeType} einwiegen</dt>
                  <dd className="text-right text-lg font-semibold">{fmt(result.lyeWeighed, 1)} g</dd>
                  <dt className="font-semibold">Wasser</dt>
                  <dd className="text-right text-lg font-semibold">{fmt(result.water, 0)} g</dd>
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
                  Heuristik nach SoapCalc-Konvention, gut zum Vergleichen von Rezepten. Grüne Bereiche: Zielprofil.
                </p>
              </div>
              <Findings findings={findings} />
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

function FatTable({ draft, setInput }: TableProps) {
  const { input } = draft
  const sum = input.fats.reduce((s, f) => s + f.percent, 0)
  const update = (i: number, patch: Partial<RecipeInput['fats'][number]>) =>
    setInput({ fats: input.fats.map((f, j) => (j === i ? { ...f, ...patch } : f)) })
  const used = new Set(input.fats.map((f) => f.fatId))

  return (
    <div className="card overflow-x-auto">
      <h2 className="mb-3 font-semibold">Fette & Öle</h2>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted">
          <tr>
            <th className="pb-2 font-normal">Fett</th>
            <th className="w-24 pb-2 font-normal">Anteil</th>
            <th className="w-28 pb-2 font-normal">Menge</th>
            <th className="w-28 pb-2 font-normal" title="Verseifungszahl in mg KOH/g. Leer = Tabellenwert.">
              VZ (KOH)
            </th>
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
                <td className="pr-2">
                  <NumberField
                    value={f.sapKohOverride}
                    digits={1}
                    placeholder={fat ? String(fat.sapKoh) : ''}
                    ariaLabel="Verseifungszahl"
                    onChange={(v) => update(i, { sapKohOverride: v })}
                  />
                </td>
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
            <td colSpan={2} className="text-right text-xs text-muted">
              {input.lyeType}-VZ Ø{' '}
              {fmt(
                input.fats.reduce((s, f) => {
                  const fat = FATS.find((x) => x.id === f.fatId)
                  return s + (fat ? sapValue(f.sapKohOverride ?? fat.sapKoh, input.lyeType) * f.percent : 0)
                }, 0) / (sum || 1),
                4,
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
                  {ADDITIVES.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
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
