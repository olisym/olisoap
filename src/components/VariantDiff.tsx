import { Link } from 'react-router-dom'
import { calculate } from '../core/calc'
import { PROPERTY_LABELS } from '../core/evaluate'
import type { PropertyKey } from '../core/types'
import { ADDITIVES_BY_ID } from '../data/additives'
import { FATS_BY_ID } from '../data/fats'
import type { Recipe } from '../db'
import { fmt } from '../format'

const KEYS: PropertyKey[] = ['hardness', 'cleansing', 'conditioning', 'bubbly', 'creamy', 'polyunsaturated']

const delta = (d: number, digits = 0) => (Math.abs(d) < 10 ** -digits / 2 ? '±0' : `${d > 0 ? '+' : '−'}${fmt(Math.abs(d), digits)}`)

/** Was diese Variante von ihrer Grundseife unterscheidet: Fette, Einstellungen, Zusätze, Kennzahlen. */
export function VariantDiff({ variant, base }: { variant: Recipe; base: Recipe }) {
  let rv, rb
  try {
    rv = calculate(variant.input)
    rb = calculate(base.input)
  } catch {
    return null
  }
  const v = variant.input
  const b = base.input
  const pct = (fats: Recipe['input']['fats'], id: string) => fats.find((f) => f.fatId === id)?.percent ?? 0
  const fatIds = [...new Set([...b.fats, ...v.fats].map((f) => f.fatId))]
  const fatChanges = fatIds
    .map((id) => ({ id, from: pct(b.fats, id), to: pct(v.fats, id) }))
    .filter((c) => Math.abs(c.to - c.from) > 0.01)
  const add = (list: Recipe['input']['additives'], id: string) => list.find((a) => a.additiveId === id)?.percentOfFats ?? 0
  const addIds = [...new Set([...b.additives, ...v.additives].map((a) => a.additiveId))]
  const addChanges = addIds.map((id) => ({ id, from: add(b.additives, id), to: add(v.additives, id) })).filter((c) => Math.abs(c.to - c.from) > 0.01)

  const settings: string[] = []
  if (v.superfat !== b.superfat) settings.push(`Überfettung ${fmt(b.superfat, 1)} → ${fmt(v.superfat, 1)} %`)
  if (v.lyeType !== b.lyeType || (v.kohShare ?? 0) !== (b.kohShare ?? 0)) settings.push('Lauge geändert')
  if (Math.abs(rv.lyeConcentration - rb.lyeConcentration) > 0.1)
    settings.push(`Laugenkonzentration ${fmt(rb.lyeConcentration, 1)} → ${fmt(rv.lyeConcentration, 1)} %`)

  const nothing = fatChanges.length === 0 && addChanges.length === 0 && settings.length === 0

  return (
    <div className="card">
      <h2 className="mb-1 font-semibold">Unterschiede zur Grundseife</h2>
      <p className="mb-3 text-sm text-muted">
        Variante von{' '}
        <Link className="text-accent hover:underline" to={`/rezepte/${base.id}`}>
          {base.name}
        </Link>
      </p>
      {nothing ? (
        <p className="text-sm text-muted">Noch identisch mit der Grundseife.</p>
      ) : (
        <ul className="space-y-0.5 text-sm tabular-nums">
          {fatChanges.map((c) => (
            <li key={c.id} className="flex justify-between gap-2">
              <span>{FATS_BY_ID[c.id]?.name ?? c.id}</span>
              <span>
                {fmt(c.from, 1)} → <b>{fmt(c.to, 1)} %</b>
              </span>
            </li>
          ))}
          {addChanges.map((c) => (
            <li key={c.id} className="flex justify-between gap-2">
              <span>{ADDITIVES_BY_ID[c.id]?.name ?? c.id}</span>
              <span>
                {fmt(c.from, 1)} → <b>{fmt(c.to, 1)} %</b>
              </span>
            </li>
          ))}
          {settings.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      )}
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 border-t border-line pt-3 text-xs text-muted tabular-nums">
        {KEYS.map((k) => (
          <div key={k} className="contents">
            <dt>{PROPERTY_LABELS[k]}</dt>
            <dd className="text-right">
              {fmt(rv.properties[k])} ({delta(rv.properties[k] - rb.properties[k])})
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
