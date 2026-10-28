import { sapValue } from '../core/calc'
import type { FattyAcidKey } from '../core/types'
import { FATS } from '../data/fats'
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

export function FatList() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Fette & Öle</h1>
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
                  <div className="font-medium">{f.name}</div>
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
