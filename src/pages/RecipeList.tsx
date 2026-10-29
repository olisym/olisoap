import { BookOpen, FlaskConical, PencilRuler, Plus, Search, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Chip, EmptyState, PageHeader, Panel } from '../components/ui'
import { calculate } from '../core/calc'
import { recipeCost } from '../core/cost'
import { materialPrice, type Inventory } from '../core/inventory'
import { db, familyRecipes, type Recipe } from '../db'
import { PROFILES_BY_ID } from '../data/profiles'
import { TEMPLATES } from '../data/templates'
import { fmt } from '../format'
import { groupRecipes, recipeFeasibility, useWorkshop } from '../hooks'

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

/** Kurzprofil eines Rezepts für Karten: Fette, Kennzahlen, Kosten pro Stück. */
function facts(r: Recipe, inv: Inventory) {
  try {
    const res = calculate(r.input)
    const cost = recipeCost(res, (k) => materialPrice(inv, k))
    const bars = Math.floor(res.batchWeight / (r.barWeight ?? 100))
    return {
      fats: res.fats
        .slice()
        .sort((a, b) => b.percent - a.percent)
        .map((l) => `${l.fat.name} ${fmt(l.percent)}`)
        .join(' · '),
      cleansing: res.properties.cleansing,
      hardness: res.properties.hardness,
      perBar: bars && cost.missing.length < res.fats.length ? cost.total / bars : undefined,
    }
  } catch {
    return undefined
  }
}

export function RecipeList() {
  const w = useWorkshop()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  if (!w) return null
  const develop = params.get('entwickeln') === '1'
  const families = groupRecipes(w.recipes).filter(
    ({ base, variants }) => !q || [base, ...variants].some((r) => r.name.toLowerCase().includes(q.toLowerCase())),
  )

  async function create() {
    const r = newRecipe()
    await db.recipes.add(r)
    navigate(`/rezepte/${r.id}`)
  }

  async function variantOf(base: Recipe) {
    const now = new Date().toISOString()
    const v: Recipe = { ...structuredClone(base), id: crypto.randomUUID(), baseId: base.id, name: `${base.name} Variante`, createdAt: now, updatedAt: now }
    await db.recipes.add(v)
    navigate(`/rezepte/${v.id}`)
  }

  async function addFamily(i: number) {
    const rs = familyRecipes(TEMPLATES[i])
    // Vorlagen haben feste Kennungen: Vorhandene (evtl. bearbeitete) bleiben, nur Fehlendes kommt dazu.
    const existing = new Set((await db.recipes.bulkGet(rs.map((r) => r.id))).filter(Boolean).map((r) => r!.id))
    await db.recipes.bulkAdd(rs.filter((r) => !existing.has(r.id)))
    navigate(`/rezepte/${rs[0].id}`)
  }

  const card = (r: Recipe, variant: boolean) => {
    const f = facts(r, w.inventory)
    const feas = recipeFeasibility(r, w.inventory)
    return (
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${variant ? 'rounded-xl bg-surface-2 p-3' : ''}`}>
        <Link to={`/rezepte/${r.id}`} className="group min-w-0 flex-1">
          <p className={`truncate group-hover:text-accent ${variant ? 'font-medium' : 'text-lg font-semibold'}`}>{r.name}</p>
          <p className="truncate text-xs text-muted">{f?.fats ?? 'Rezept unvollständig'}</p>
        </Link>
        {f && (
          <div className="flex flex-wrap gap-1.5">
            <Chip>Reinigung {fmt(f.cleansing)}</Chip>
            <Chip>Härte {fmt(f.hardness)}</Chip>
            {f.perBar !== undefined && <Chip>{fmt(f.perBar, 2)} €/Stk</Chip>}
          </div>
        )}
        <Link className={feas && feas.count > 0 ? 'btn-primary' : 'btn'} to={`/sieden/${r.id}`} aria-label={`${r.name} sieden`}>
          <FlaskConical size={16} /> Sieden
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Rezepte"
        title="Grundseifen & Varianten"
        actions={
          <button className="btn-primary" onClick={() => setParams({ entwickeln: '1' })}>
            <PencilRuler size={18} /> Entwickeln
          </button>
        }
      />

      {develop && (
        <Panel
          title="Was möchtest du entwickeln?"
          icon={Sparkles}
          className="panel-glow"
          action={
            <button className="btn-ghost" onClick={() => setParams({})} aria-label="Schließen">
              <X size={18} />
            </button>
          }
        >
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <p className="mb-2 font-medium">Variante einer Grundseife</p>
              <p className="mb-3 text-sm text-muted">Eine Sache ändern, Unterschiede sofort sehen.</p>
              <div className="flex flex-col gap-2">
                {groupRecipes(w.recipes).map(({ base }) => (
                  <button key={base.id} className="btn justify-start" onClick={() => variantOf(base)}>
                    <Plus size={16} /> {base.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 font-medium">Grundseife aus Vorlage</p>
              <p className="mb-3 text-sm text-muted">Geprüfte Startpunkte inkl. Spar-Variante.</p>
              <div className="flex flex-col gap-2">
                {TEMPLATES.map((t, i) => (
                  <button key={t.base.name} className="btn justify-start" onClick={() => addFamily(i)}>
                    <Plus size={16} /> {t.base.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 font-medium">Leere Grundseife</p>
              <p className="mb-3 text-sm text-muted">Von null an, mit Live-Kennzahlen und Zielprofil.</p>
              <button className="btn justify-start" onClick={create}>
                <Plus size={16} /> Neue Grundseife
              </button>
            </div>
          </div>
        </Panel>
      )}

      <label className="relative block max-w-md">
        <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden />
        <input className="field w-full pl-10" placeholder="Rezept suchen" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rezepte durchsuchen" />
      </label>

      {families.length === 0 && (
        <EmptyState icon={BookOpen} title={q ? 'Nichts gefunden' : 'Noch keine Rezepte'} action={!q && <button className="btn-primary" onClick={() => setParams({ entwickeln: '1' })}>Entwickeln</button>} />
      )}

      <ul className="space-y-4">
        {families.map(({ base, variants }) => (
          <li key={base.id} className="card space-y-3">
            {base.profileId && <p className="eyebrow">{PROFILES_BY_ID[base.profileId]?.name}</p>}
            {card(base, false)}
            {variants.length > 0 && (
              <ul className="space-y-2">
                {variants.map((v) => (
                  <li key={v.id}>{card(v, true)}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
