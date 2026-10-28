import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { NumberField } from '../components/NumberField'
import { calculate } from '../core/calc'
import { correct } from '../core/correction'
import { db } from '../db'
import { fmt } from '../format'

export function Correction() {
  const { id } = useParams()
  const navigate = useNavigate()
  const recipes = useLiveQuery(() => db.recipes.orderBy('name').toArray())
  const recipe = recipes?.find((r) => r.id === id)
  const [fatGrams, setFatGrams] = useState<(number | undefined)[]>([])
  const [lyeWeighed, setLyeWeighed] = useState<number>()

  const plan = recipe ? calculate(recipe.input) : undefined
  const c = plan ? correct(plan, { fatGrams, lyeWeighed }) : undefined
  const lye = recipe?.input.lyeType ?? 'NaOH'

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Korrekturrechner</h1>
      <p className="max-w-prose text-sm text-muted">
        Etwas zu viel oder zu wenig eingewogen? Trag die tatsächlichen Mengen ein. Leere Felder gelten als wie geplant.
      </p>
      <select
        className="field"
        value={id ?? ''}
        onChange={(e) => {
          setFatGrams([])
          setLyeWeighed(undefined)
          navigate(`/korrektur/${e.target.value}`)
        }}
      >
        <option value="">Rezept wählen …</option>
        {recipes?.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>

      {plan && c && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card">
            <h2 className="mb-3 font-semibold">Ist-Einwaage</h2>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="pb-2 font-normal">Zutat</th>
                  <th className="pr-3 pb-2 text-right font-normal">Plan</th>
                  <th className="w-36 pb-2 font-normal">Ist</th>
                </tr>
              </thead>
              <tbody>
                {plan.fats.map((l, i) => (
                  <tr key={l.fat.id} className="border-t border-line">
                    <td className="py-1.5">{l.fat.name}</td>
                    <td className="pr-3 text-right text-muted tabular-nums">{fmt(l.grams, 1)} g</td>
                    <td>
                      <NumberField
                        value={fatGrams[i]}
                        digits={1}
                        suffix="g"
                        placeholder={fmt(l.grams, 1)}
                        ariaLabel={`${l.fat.name} Ist`}
                        onChange={(v) => setFatGrams((prev) => Object.assign([...prev], { [i]: v }))}
                      />
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-line">
                  <td className="py-1.5 font-semibold">{lye}</td>
                  <td className="pr-3 text-right text-muted tabular-nums">{fmt(plan.lyeWeighed, 1)} g</td>
                  <td>
                    <NumberField value={lyeWeighed} digits={1} suffix="g" placeholder={fmt(plan.lyeWeighed, 1)} ariaLabel="Lauge Ist" onChange={setLyeWeighed} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card space-y-3">
            <h2 className="font-semibold">Ergebnis</h2>
            <p className="text-sm">
              Überfettung jetzt: <b className="text-lg tabular-nums">{fmt(c.superfatActual, 1)} %</b>{' '}
              <span className="text-muted">(geplant {fmt(recipe!.input.superfat, 1)} %)</span>
            </p>
            {Math.abs(c.addLye) < 0.05 ? (
              <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm">✓ Passt, keine Korrektur nötig.</p>
            ) : c.addLye > 0 ? (
              <div className="rounded-md bg-sky-500/10 px-3 py-2 text-sm">
                <p className="font-semibold">Lauge nachgeben</p>
                <p>
                  <b className="tabular-nums">{fmt(c.addLye, 1)} g {lye}</b> und <b className="tabular-nums">{fmt(c.addWater, 1)} g Wasser</b>{' '}
                  (hält die Konzentration). Neues {lye} gesamt: {fmt(c.lyeWeighedRequired, 1)} g.
                </p>
                <p className="mt-1 text-xs text-muted">
                  Oder so lassen: Die Seife hat dann {fmt(c.superfatActual, 1)} % Überfettung.
                </p>
              </div>
            ) : (
              <div className="rounded-md bg-amber-500/10 px-3 py-2 text-sm">
                <p className="font-semibold">Zu viel Lauge: Fett nachgeben</p>
                <p className="mb-1">Alle Fette um {fmt((c.fatScale - 1) * 100, 1)} % erhöhen:</p>
                <ul className="tabular-nums">
                  {plan.fats.map((l, i) => (
                    <li key={l.fat.id}>
                      + {fmt(c.addFatGrams[i], 1)} g {l.fat.name}
                    </li>
                  ))}
                </ul>
                {c.superfatActual < 0 && <p className="mt-2 font-semibold text-red-600">Ohne Korrektur bleibt freie Lauge in der Seife!</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
