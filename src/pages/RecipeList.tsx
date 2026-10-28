import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router-dom'
import { Reminders } from '../components/Reminders'
import { calculate } from '../core/calc'
import { db, familyRecipes, type Recipe } from '../db'
import { PROFILES_BY_ID } from '../data/profiles'
import { TEMPLATES } from '../data/templates'
import { fmt } from '../format'

export function newRecipe(): Recipe {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name: 'Neue Grundseife',
    profileId: 'body-sensitive',
    createdAt: now,
    updatedAt: now,
    input: {
      totalFat: 1000,
      lyeType: 'NaOH',
      lyePurity: 100,
      superfat: 7,
      water: { mode: 'concentration', value: 33 },
      fats: [{ fatId: 'olive', percent: 100 }],
      additives: [],
    },
  }
}

function summary(r: Recipe): string {
  try {
    return calculate(r.input)
      .fats.slice()
      .sort((a, b) => b.percent - a.percent)
      .map((l) => `${l.fat.name} ${fmt(l.percent)} %`)
      .join(' · ')
  } catch {
    return 'Rezept enthält unbekannte Zutaten'
  }
}

export function RecipeList() {
  const recipes = useLiveQuery(() => db.recipes.orderBy('name').toArray())
  const navigate = useNavigate()
  if (!recipes) return null

  const ids = new Set(recipes.map((r) => r.id))
  // Varianten, deren Grundseife gelöscht wurde, erscheinen selbst als Grundseife.
  const bases = recipes.filter((r) => !r.baseId || !ids.has(r.baseId))
  const variantsOf = (id: string) => recipes.filter((r) => r.baseId === id)

  async function create() {
    const r = newRecipe()
    await db.recipes.add(r)
    navigate(`/rezepte/${r.id}`)
  }

  async function addFamily(i: number) {
    const rs = familyRecipes(TEMPLATES[i])
    await db.recipes.bulkAdd(rs)
    navigate(`/rezepte/${rs[0].id}`)
  }

  return (
    <section>
      <Reminders />
      <header className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Rezepte</h1>
        <div className="flex gap-2">
          <select className="field" value="" aria-label="Grundseife aus Vorlage" onChange={(e) => e.target.value && addFamily(Number(e.target.value))}>
            <option value="">Grundseife aus Vorlage …</option>
            {TEMPLATES.map((t, i) => (
              <option key={t.base.name} value={i}>
                {t.base.name}
                {t.variants.length > 0 && ` (+ ${t.variants.length} Variante${t.variants.length > 1 ? 'n' : ''})`}
              </option>
            ))}
          </select>
          <button className="btn-primary" onClick={create}>
            + Neue Grundseife
          </button>
        </div>
      </header>
      {recipes.length === 0 && <p className="text-muted">Noch keine Rezepte. Starte mit einer Grundseife aus den Vorlagen.</p>}
      <ul className="space-y-4">
        {bases.map((b) => {
          const variants = variantsOf(b.id)
          return (
            <li key={b.id} className="card">
              <Link to={`/rezepte/${b.id}`} className="group block">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-semibold group-hover:text-accent">{b.name}</h2>
                  {b.profileId && <span className="text-xs text-accent">{PROFILES_BY_ID[b.profileId]?.name}</span>}
                </div>
                <p className="mt-1 text-sm text-muted">{summary(b)}</p>
                <p className="mt-1 text-xs text-muted">
                  {fmt(b.input.totalFat)} g Fett · {fmt(b.input.superfat, 1)} % ÜF
                </p>
              </Link>
              {variants.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-line pt-3">
                  {variants.map((v) => (
                    <li key={v.id}>
                      <Link to={`/rezepte/${v.id}`} className="group flex flex-wrap items-baseline gap-x-3 rounded-md px-2 py-1 hover:bg-track">
                        <span className="text-muted">↳</span>
                        <span className="font-medium group-hover:text-accent">{v.name}</span>
                        <span className="text-xs text-muted">{v.description}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
