import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useParams } from 'react-router-dom'
import { calculate, type AdditiveLine } from '../core/calc'
import { evaluate } from '../core/evaluate'
import { PROFILES_BY_ID } from '../data/profiles'
import { db, readyDate, type Batch, type Recipe } from '../db'
import { fmt } from '../format'
import { useWaterHardness } from '../hooks'

function Row({ name, grams, share, note }: { name: string; grams: number; share: string; note?: string }) {
  return (
    <tr className="border-t border-line align-top">
      <td className="w-8 py-1.5 text-lg leading-none">☐</td>
      <td className="py-1.5 pr-2">{name}</td>
      <td className="py-1.5 pr-4 text-right font-semibold tabular-nums">{fmt(grams, grams < 100 ? 1 : 0)} g</td>
      <td className="py-1.5 pr-4 text-right text-muted tabular-nums">{share}</td>
      <td className="py-1.5 text-xs text-muted">{note}</td>
    </tr>
  )
}

function Phase({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <tr>
        <th colSpan={5} className="pt-4 pb-1 text-left text-xs font-semibold tracking-wide uppercase">
          {title}
        </th>
      </tr>
      {children}
    </>
  )
}

export function Worksheet() {
  const { id } = useParams()
  const recipe = useLiveQuery(() => (id ? db.recipes.get(id) : undefined), [id])
  if (!recipe) return <p className="text-muted">Lade …</p>
  return <WorksheetView recipe={recipe} back={`/rezepte/${recipe.id}`} />
}

export function BatchWorksheet() {
  const { id } = useParams()
  const batch = useLiveQuery(() => (id ? db.batches.get(id) : undefined), [id])
  if (!batch) return <p className="text-muted">Lade …</p>
  return <WorksheetView recipe={batch.recipe} batch={batch} back={`/chargen/${batch.id}`} />
}

const de = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('de-DE') : '')

function WorksheetView({ recipe, batch, back }: { recipe: Recipe; batch?: Batch; back: string }) {
  const r = calculate(recipe.input)
  const waterHardness = useWaterHardness()
  const { input } = recipe
  const profile = recipe.profileId ? PROFILES_BY_ID[recipe.profileId] : undefined
  const findings = evaluate(r, profile, { waterHardness })
  const pctOfFats = (a: AdditiveLine) => `${fmt(a.percentOfFats, 1)} % d. GFM`
  const lyePhase = r.additives.filter((a) => a.additive.phase === 'lye')
  const fatPhase = r.additives.filter((a) => a.additive.phase === 'fats')
  const tracePhase = r.additives.filter((a) => a.additive.phase === 'trace')
  const acids = lyePhase.filter((a) => a.lyeConsumed > 0)
  const hot = input.process === 'hot'
  const isAfterCook = (fatId: string) => hot && input.fats.some((f) => f.fatId === fatId && f.afterCook)
  const acidShare = r.lyePure > 0 ? r.lyeForAdditives / r.lyePure : 0

  return (
    <article className="worksheet mx-auto max-w-3xl">
      <div className="no-print mb-4 flex gap-2">
        <Link className="btn" to={back}>
          ← Zurück
        </Link>
        <button className="btn-primary" onClick={() => window.print()}>
          Drucken
        </button>
        {!batch && (
          <Link className="btn" to={`/rezepte/${recipe.id}/anleitung`}>
            Anleitung Schritt für Schritt
          </Link>
        )}
      </div>

      <header className="border-b-2 border-ink pb-3">
        <p className="text-xs tracking-widest text-muted uppercase">Arbeitsblatt</p>
        <h1 className="text-2xl font-bold">{recipe.name}</h1>
        {recipe.description && <p className="text-sm text-muted">{recipe.description}</p>}
        <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <span>Fett: <b>{fmt(input.totalFat)} g</b></span>
          <span>Überfettung: <b>{fmt(input.superfat, 1)} %</b></span>
          <span>Wasser: <b>{fmt(r.water)} g</b></span>
          {r.lyeParts.map((p) => (
            <span key={p.type}>{p.type}: <b>{fmt(p.weighed, 1)} g</b></span>
          ))}
          <span>Konzentration: <b>{fmt(r.lyeConcentration, 1)} %</b></span>
        </p>
      </header>

      <table className="mt-2 w-full text-sm">
        <tbody>
          <Phase title="Phase A: Lauge">
            <Row
              name="Wasser (destilliert / Osmose)"
              grams={r.water}
              share={`${fmt((r.water / input.totalFat) * 100, 1)} % d. GFM`}
              note={r.waterFromAdditives > 0 ? `Bereits abgezogen: ${fmt(r.waterFromAdditives, 0)} g Wasser aus flüssigen Zusätzen` : undefined}
            />
            {acids.map((a) => (
              <Row key={a.additive.id} name={a.additive.name} grams={a.grams} share={pctOfFats(a)} note="Zuerst vollständig im kalten Wasser lösen, dann erst die Lauge." />
            ))}
            {r.lyeParts.map((p) => (
              <Row
                key={p.type}
                name={`${p.type}${p.purity < 100 ? ` (${fmt(p.purity, 1)} %)` : ''}`}
                grams={p.weighed}
                share={`${fmt(input.superfat, 1)} % ÜF`}
                note={
                  acidShare > 0
                    ? `${fmt(p.weighed * (1 - acidShare), 1)} g für Fette + ${fmt(p.weighed * acidShare, 1)} g für Säure`
                    : undefined
                }
              />
            ))}
            {lyePhase
              .filter((a) => a.lyeConsumed === 0)
              .map((a) => (
                <Row key={a.additive.id} name={a.additive.name} grams={a.grams} share={pctOfFats(a)} note={a.reason} />
              ))}
          </Phase>
          <Phase title="Phase B: Fette & Öle">
            {r.fats.filter((l) => !isAfterCook(l.fat.id)).map((l) => (
              <Row key={l.fat.id} name={l.fat.name} grams={l.grams} share={`${fmt(l.percent, 1)} %`} />
            ))}
            {fatPhase.map((a) => (
              <Row key={a.additive.id} name={a.additive.name} grams={a.grams} share={pctOfFats(a)} note={a.reason} />
            ))}
          </Phase>
          {hot ? (
            <>
              <Phase title="Phase C: Kochen bei ca. 80 °C bis Vaseline-Stadium, pH-Test">
                <tr>
                  <td colSpan={5} className="py-1 text-xs text-muted">Beginn ____:____ Uhr · Gel ____:____ · Vaseline ____:____ · Test ok ____:____</td>
                </tr>
              </Phase>
              {(tracePhase.length > 0 || r.fats.some((l) => isAfterCook(l.fat.id))) && (
                <Phase title="Phase D: Nach dem Kochen (ca. 70 °C)">
                  {r.fats.filter((l) => isAfterCook(l.fat.id)).map((l) => (
                    <Row key={l.fat.id} name={l.fat.name} grams={l.grams} share={`${fmt(l.percent, 1)} %`} note="Überfettungsöl" />
                  ))}
                  {tracePhase.map((a) => (
                    <Row key={a.additive.id} name={a.additive.name} grams={a.grams} share={pctOfFats(a)} note={a.reason} />
                  ))}
                </Phase>
              )}
            </>
          ) : (
            tracePhase.length > 0 && (
              <Phase title="Phase C: Zugabe in der Spur">
                {tracePhase.map((a) => (
                  <Row key={a.additive.id} name={a.additive.name} grams={a.grams} share={pctOfFats(a)} note={a.reason} />
                ))}
              </Phase>
            )
          )}
        </tbody>
      </table>

      <p className="mt-3 text-xs text-muted">Gesamtgewicht Leim: {fmt(r.batchWeight)} g</p>

      {findings.length > 0 && (
        <ul className="mt-3 list-disc pl-5 text-xs">
          {findings.map((f, i) => (
            <li key={i}>{f.message}</li>
          ))}
        </ul>
      )}

      {recipe.notes && (
        <section className="mt-4">
          <h2 className="text-xs font-semibold tracking-wide uppercase">Notizen</h2>
          <p className="text-sm whitespace-pre-wrap">{recipe.notes}</p>
        </section>
      )}

      <section className="mt-6 break-inside-avoid">
        <h2 className="text-xs font-semibold tracking-wide uppercase">Chargenprotokoll</h2>
        <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
          {(
            [
              ['Siededatum', de(batch?.date)],
              ['Chargen-Nr.', batch?.number],
              ['Temp. Lauge / Fette (°C)', ''],
              ['Ausgeformt & geschnitten', ''],
              ['Reif ab', batch ? `${de(readyDate(batch))} (frühestens)` : ''],
              ['pH-Test OK', ''],
            ] as const
          ).map(([l, v]) => (
            <div key={l} className="border-b border-ink/40 pb-1 text-muted">
              {l}: <span className="font-semibold text-ink">{v}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted">Notizen (Spur, Gelphase, Duft, Auffälligkeiten):</p>
        <div className="mt-6 space-y-6">
          <div className="border-b border-ink/40" />
          <div className="border-b border-ink/40" />
          <div className="border-b border-ink/40" />
        </div>
      </section>
    </article>
  )
}
