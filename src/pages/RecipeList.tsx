import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router-dom'
import { Reminders } from '../components/Reminders'
import { calculate } from '../core/calc'
import { db, type Recipe } from '../db'
import { PROFILES_BY_ID } from '../data/profiles'
import { TEMPLATES } from '../data/templates'
import { fmt } from '../format'

export function newRecipe(): Recipe {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name: 'Neues Rezept',
    profileId: 'body-sensitive',
    createdAt: now,
    updatedAt: now,
    input: {
      totalFat: 1000,
      lyeType: 'NaOH',
      lyePurity: 100,
      superfat: 8,
      water: { mode: 'concentration', value: 33 },
      fats: [{ fatId: 'olive', percent: 100 }],
      additives: [],
    },
  }
}

export function RecipeList() {
  const recipes = useLiveQuery(() => db.recipes.orderBy('updatedAt').reverse().toArray())
  const navigate = useNavigate()

  async function create(templateIndex?: number) {
    const base = newRecipe()
    const r = templateIndex === undefined ? base : { ...base, ...structuredClone(TEMPLATES[templateIndex]) }
    await db.recipes.add(r)
    navigate(`/rezepte/${r.id}`)
  }

  return (
    <section>
      <Reminders />
      <header className="mb-4 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Rezepte</h1>
        <div className="flex gap-2">
          <select className="field" value="" aria-label="Aus Vorlage" onChange={(e) => e.target.value && create(Number(e.target.value))}>
            <option value="">Aus Vorlage …</option>
            {TEMPLATES.map((t, i) => (
              <option key={t.name} value={i}>
                {t.name}
              </option>
            ))}
          </select>
          <button className="btn-primary" onClick={() => create()}>
            + Neues Rezept
          </button>
        </div>
      </header>
      {recipes?.length === 0 && <p className="text-muted">Noch keine Rezepte.</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {recipes?.map((r) => {
          let summary = ''
          try {
            const res = calculate(r.input)
            summary = res.fats
              .slice()
              .sort((a, b) => b.percent - a.percent)
              .map((l) => `${l.fat.name} ${fmt(l.percent)} %`)
              .join(' · ')
          } catch {
            summary = 'Rezept enthält unbekannte Zutaten'
          }
          return (
            <li key={r.id}>
              <Link to={`/rezepte/${r.id}`} className="card block h-full hover:border-accent">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-semibold">{r.name}</h2>
                  <span className="text-xs text-muted">{new Date(r.updatedAt).toLocaleDateString('de-DE')}</span>
                </div>
                {r.profileId && <p className="text-xs text-accent">{PROFILES_BY_ID[r.profileId]?.name}</p>}
                <p className="mt-2 text-sm text-muted">{summary}</p>
                <p className="mt-1 text-xs text-muted">
                  {fmt(r.input.totalFat)} g Fett · {fmt(r.input.superfat, 1)} % ÜF
                </p>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
