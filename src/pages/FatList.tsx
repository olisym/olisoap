import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NumberField } from '../components/NumberField'
import { Chip, LabelText, Panel } from '../components/ui'
import { sapValue } from '../core/calc'
import { customFatId, deriveFat, labelValid, type CustomFat } from '../core/customFat'
import type { FattyAcidKey } from '../core/types'
import { FATS, FATS_BY_ID, isCustomFat } from '../data/fats'
import { db } from '../db'
import { fmt } from '../format'

const COLUMNS: [FattyAcidKey, string][] = [
  ['lauric', 'Laurin'],
  ['myristic', 'Myristin'],
  ['palmitic', 'Palmitin'],
  ['stearic', 'Stearin'],
  ['ricinoleic', 'Rizinol'],
  ['oleic', 'Öl'],
  ['linoleic', 'Linol'],
  ['linolenic', 'Linolen'],
]

const pufa = (id: string) => (FATS_BY_ID[id]?.fattyAcids.linoleic ?? 0) + (FATS_BY_ID[id]?.fattyAcids.linolenic ?? 0)

interface Draft {
  id?: string
  baseId: string
  name: string
  fat?: number
  saturated?: number
  mono?: number
  poly?: number
}

/**
 * Eigenes Fett mit Werten von der Nährwerttabelle. Fehlt dort „einfach ungesättigt“ (häufig), ergibt es sich aus
 * Fett minus gesättigt minus mehrfach ungesättigt.
 */
function CustomFatEditor() {
  const { t } = useTranslation()
  const list = useLiveQuery(() => db.customFats.toArray())
  const recipes = useLiveQuery(() => db.recipes.toArray())
  const products = useLiveQuery(() => db.products.toArray())
  const [draft, setDraft] = useState<Draft>()
  const [message, setMessage] = useState<string>()
  const builtIn = FATS.filter((f) => !isCustomFat(f.id))

  const mono = draft && (draft.mono ?? (draft.fat !== undefined && draft.saturated !== undefined && draft.poly !== undefined ? draft.fat - draft.saturated - draft.poly : undefined))
  const label = draft && draft.saturated !== undefined && draft.poly !== undefined && mono !== undefined ? { saturated: draft.saturated, mono, poly: draft.poly } : undefined
  const ok = !!draft?.name.trim() && !!label && labelValid(label) && mono! >= 0
  const preview = ok ? deriveFat(FATS_BY_ID[draft!.baseId], { id: 'vorschau', baseId: draft!.baseId, name: draft!.name, label: label! }) : undefined
  const usedBy = (id: string) => (recipes ?? []).filter((r) => r.input.fats.some((f) => f.fatId === id)).length + (products ?? []).filter((p) => p.fatId === id).length

  async function save() {
    if (!ok || !draft) return
    const id = draft.id ?? customFatId(draft.name)
    if (!draft.id && (FATS_BY_ID[id] || (await db.customFats.get(id)))) return setMessage(t('Diesen Namen gibt es schon.'))
    const entry: CustomFat = { id, baseId: draft.baseId, name: draft.name.trim(), label: label! }
    await db.customFats.put(entry)
    setDraft(undefined)
    setMessage(undefined)
  }

  async function remove(c: CustomFat) {
    const n = usedBy(c.id)
    if (n) return setMessage(t('„{{name}}“ wird noch verwendet ({{n}} Rezepte bzw. Artikel). Erst dort ein anderes Fett wählen.', { name: c.name, n }))
    if (confirm(t('„{{name}}“ löschen?', { name: c.name }))) await db.customFats.delete(c.id)
  }

  return (
    <Panel title={t('Eigene Fette')} action={!draft && <button className="btn" onClick={() => setDraft({ baseId: 'olive', name: '', fat: 100 })}>{t('Neues eigenes Fett')}</button>}>
      <p className="mb-3 max-w-prose text-sm text-muted">
        {t('Ein bekanntes Fett mit den Werten von deiner Flasche, z. B. „Olivenöl (Aldi)“. Die App rechnet dann in Rezept, Gegenprobe und Haltbarkeit mit deinem Öl statt mit dem Durchschnitt.')}
      </p>
      {list && list.length > 0 && (
        <ul className="mb-4 divide-y divide-line">
          {list.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{c.name}</span>{' '}
                <span className="text-sm text-muted">
                  {t('Basis {{base}} · Linol-/Linolensäure {{p}} % statt {{b}} %', { base: FATS_BY_ID[c.baseId]?.name ?? c.baseId, p: fmt(pufa(c.id), 1), b: fmt(pufa(c.baseId), 1) })}
                </span>
              </span>
              <button className="btn-ghost min-h-11" onClick={() => setDraft({ id: c.id, baseId: c.baseId, name: c.name, saturated: c.label.saturated, mono: c.label.mono, poly: c.label.poly })}>
                {t('Bearbeiten')}
              </button>
              <button className="btn-ghost min-h-11 text-bad" onClick={() => remove(c)}>
                {t('Löschen')}
              </button>
            </li>
          ))}
        </ul>
      )}
      {message && <p className="mb-3 text-sm text-warn">{message}</p>}
      {draft && (
        <div className="space-y-4 rounded-xl border border-line bg-surface-2 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="label">
              {t('Basis')}
              <select className="field" value={draft.baseId} disabled={!!draft.id} onChange={(e) => setDraft({ ...draft, baseId: e.target.value })}>
                {builtIn.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="label">
              {t('Name')}
              <input className="field" value={draft.name} disabled={!!draft.id} placeholder={t('z. B. {{name}} (Aldi)', { name: FATS_BY_ID[draft.baseId]?.name })} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>
          </div>
          <p className="text-sm text-muted">{t('Aus der Nährwerttabelle, je 100 g:')}</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <label className="label">
              {t('Fett')}
              <NumberField value={draft.fat} digits={1} suffix="g" onChange={(v) => setDraft({ ...draft, fat: v })} />
            </label>
            <label className="label">
              {t('davon gesättigt')}
              <NumberField value={draft.saturated} digits={1} suffix="g" onChange={(v) => setDraft({ ...draft, saturated: v })} />
            </label>
            <label className="label">
              <LabelText hint={t('Steht oft nicht auf dem Etikett. Leer lassen: Die App rechnet Fett minus gesättigt minus mehrfach ungesättigt.')}>{t('einfach unges.')}</LabelText>
              <NumberField value={draft.mono} digits={1} suffix="g" placeholder={mono !== undefined && draft.mono === undefined ? fmt(mono, 1) : ''} onChange={(v) => setDraft({ ...draft, mono: v })} />
            </label>
            <label className="label">
              {t('mehrfach unges.')}
              <NumberField value={draft.poly} digits={1} suffix="g" onChange={(v) => setDraft({ ...draft, poly: v })} />
            </label>
          </div>
          {preview && (
            <p className="text-sm">
              {t('Linol-/Linolensäure {{p}} % (Durchschnitt {{b}} %), Jodzahl {{i}} ({{bi}}).', {
                p: fmt((preview.fattyAcids.linoleic ?? 0) + (preview.fattyAcids.linolenic ?? 0), 1),
                b: fmt(pufa(draft.baseId), 1),
                i: preview.iodine,
                bi: FATS_BY_ID[draft.baseId].iodine,
              })}
            </p>
          )}
          <div className="flex gap-2">
            <button className="btn-primary" disabled={!ok} onClick={save}>
              {t('Speichern')}
            </button>
            <button className="btn-ghost" onClick={() => (setDraft(undefined), setMessage(undefined))}>
              {t('Abbrechen')}
            </button>
          </div>
        </div>
      )}
    </Panel>
  )
}

export function FatList() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Fette & Öle</h1>
      <CustomFatEditor />
      <p className="max-w-prose text-sm text-muted">
        Richtwerte. Naturprodukte schwanken um einige Prozent. Liegt ein Analysezertifikat des Lieferanten vor, die
        Verseifungszahl im Rezept überschreiben.
      </p>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="pb-2 font-normal">Fett</th>
              <th className="pb-2 text-right font-normal">VZ KOH</th>
              <th className="pb-2 text-right font-normal">NaOH</th>
              <th className="pb-2 text-right font-normal">Jod</th>
              {COLUMNS.map(([, l]) => (
                <th key={l} className="pb-2 text-right font-normal">
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FATS.map((f) => (
              <tr key={f.id} className="border-t border-line align-top">
                <td className="py-1.5 pr-3">
                  <div className="font-medium">
                    {f.name} {isCustomFat(f.id) && <Chip tone="accent">eigen</Chip>}
                  </div>
                  {f.notes && <div className="max-w-md text-xs text-muted">{f.notes}</div>}
                </td>
                <td className="text-right tabular-nums">{f.sapKoh}</td>
                <td className="text-right tabular-nums">{fmt(sapValue(f.sapKoh, 'NaOH'), 4)}</td>
                <td className="text-right tabular-nums">{f.iodine}</td>
                {COLUMNS.map(([k]) => (
                  <td key={k} className="pl-2 text-right tabular-nums">
                    {f.fattyAcids[k] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
