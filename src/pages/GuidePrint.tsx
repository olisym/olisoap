import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { calculate } from '../core/calc'
import { buildGuide } from '../core/guide'
import { PROFILES_BY_ID } from '../data/profiles'
import { db, type Recipe } from '../db'
import { fmt } from '../format'
import { useCookStages, useStepContent } from './guideContent'

/** Anleitung zum Nachmachen: dieselben Schritte wie „Schritt für Schritt“, auf Papier zum Abhaken. */
export function GuidePrint() {
  const { id } = useParams()
  const { t } = useTranslation()
  const recipe = useLiveQuery(() => (id ? db.recipes.get(id) : undefined), [id])
  if (!recipe) return <p className="text-muted">{t('Lade …')}</p>
  return <GuidePrintView recipe={recipe} />
}

function GuidePrintView({ recipe }: { recipe: Recipe }) {
  const { t } = useTranslation()
  const content = useStepContent()
  const stages = useCookStages()
  const r = calculate(recipe.input)
  const profile = recipe.profileId ? PROFILES_BY_ID[recipe.profileId] : undefined
  const guide = buildGuide(r, profile?.usage)

  return (
    <article className="mx-auto max-w-3xl text-[15px] leading-snug">
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <Link className="btn" to={`/rezepte/${recipe.id}`}>
          ← {t('Zurück')}
        </Link>
        <button className="btn-primary" onClick={() => window.print()}>
          {t('Drucken')}
        </button>
        <Link className="btn" to={`/rezepte/${recipe.id}/druck`}>
          {t('Arbeitsblatt (kompakt)')}
        </Link>
      </div>

      <header className="border-b-2 border-ink pb-3">
        <p className="text-xs tracking-widest text-muted uppercase">{t('Anleitung zum Nachmachen')}</p>
        <h1 className="text-2xl font-bold">{recipe.name}</h1>
        <p className="mt-1 text-sm">
          {t('{{fat}} g Fett, {{batch}} g Leim, {{process}}', {
            fat: fmt(recipe.input.totalFat),
            batch: fmt(r.batchWeight),
            process: guide.hot ? t('Heißverseifung') : t('Kaltverseifung'),
          })}
        </p>
      </header>

      <ol className="mt-4 space-y-5">
        {guide.steps.map((step, n) => {
          const c = content(guide, step)
          return (
            <li key={step.kind} className="break-inside-avoid">
              <h2 className="text-lg font-semibold">
                {n + 1}. {c.title}
              </h2>
              {c.intro && <p className="mt-1">{c.intro}</p>}
              {c.bullets.length > 0 && (
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {c.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}
              {c.warn && <p className="mt-2 border-l-4 border-ink pl-3 font-medium">{c.warn}</p>}
              {step.items.length > 0 && (
                <table className="mt-2 w-full text-sm">
                  <tbody>
                    {step.items.map((i) => (
                      <tr key={i.key} className="border-t border-line">
                        <td className="w-8 py-1 text-lg leading-none">☐</td>
                        <td className="py-1">{i.name}</td>
                        <td className="py-1 text-right font-semibold tabular-nums">{fmt(i.grams, i.grams < 100 ? 1 : 0)} g</td>
                        {step.kind === 'weigh' && <td className="w-32 py-1 pl-4 text-muted">{t('Ist')}: ______</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {step.kind === 'temperature' && (
                <p className="mt-2">
                  {t('Lauge')} ______ °C &nbsp;&nbsp; {t('Fette')} ______ °C
                </p>
              )}
              {step.kind === 'cook' && (
                <ul className="mt-2 space-y-1">
                  {stages.map((s) => (
                    <li key={s.key}>
                      ☐ <b>{s.name}</b>: {s.hint}
                    </li>
                  ))}
                  <li className="pt-1">
                    {t('Start')} ______ &nbsp;&nbsp; {t('Ende')} ______
                  </li>
                </ul>
              )}
              {c.gate && <p className="mt-2">{c.gate.map((g) => `☐ ${g.label}`).join('     ')}</p>}
              {c.note && <p className="mt-1 text-sm text-muted">{c.note}</p>}
            </li>
          )
        })}
      </ol>

      <footer className="mt-6 border-t border-line pt-2 text-xs text-muted">
        {t('Notizen')}: ______________________________________________________________
      </footer>
    </article>
  )
}
