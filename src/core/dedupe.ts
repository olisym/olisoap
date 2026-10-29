// Doppelte Rezepte erkennen, z. B. Grundseifen, die zwei Geräte vor dem ersten Abgleich jeweils selbst angelegt haben.
// Rein und deterministisch: Jedes Gerät mit gleichem Datenstand trifft dieselbe Entscheidung, sonst würden sich zwei
// Geräte gegenseitig die jeweils andere Kopie löschen.

interface RecipeLike {
  id: string
  baseId?: string
  createdAt?: string
  updatedAt?: string
}

/** JSON mit sortierten Schlüsseln, damit gleiche Inhalte gleich aussehen. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  if (v && typeof v === 'object')
    return `{${Object.keys(v)
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
      .join(',')}}`
  return JSON.stringify(v)
}

/** Inhalt ohne Kennung und Zeitstempel; die Grundseife zählt in ihrer bereinigten Form mit. */
function signature(r: RecipeLike, baseId: string | undefined): string {
  const { id: _id, createdAt: _c, updatedAt: _u, baseId: _b, ...content } = r
  return stable({ ...content, baseId })
}

export interface Dedupe {
  /** Zu löschende Rezepte. */
  remove: string[]
  /** Gelöschte Kennung → behaltene Kennung, zum Umhängen von Chargen und Varianten. */
  replace: Map<string, string>
}

/**
 * Behalten wird je Gruppe gleicher Rezepte: zuerst eine Vorlage mit fester Kennung, dann das Rezept mit den meisten
 * Verweisen (Chargen, Varianten), dann die kleinste Kennung.
 */
export function findDuplicateRecipes(recipes: RecipeLike[], referencedIds: string[]): Dedupe {
  const refs = new Map<string, number>()
  for (const id of [...referencedIds, ...recipes.flatMap((r) => (r.baseId ? [r.baseId] : []))]) refs.set(id, (refs.get(id) ?? 0) + 1)
  const replace = new Map<string, string>()
  const resolve = (id: string | undefined) => (id ? (replace.get(id) ?? id) : undefined)
  const rank = (a: RecipeLike, b: RecipeLike) =>
    Number(!a.id.startsWith('vorlage-')) - Number(!b.id.startsWith('vorlage-')) || (refs.get(b.id) ?? 0) - (refs.get(a.id) ?? 0) || a.id.localeCompare(b.id)

  // Erst Grundseifen, dann Varianten (deren Grundseife dann schon feststeht).
  for (const level of [recipes.filter((r) => !r.baseId), recipes.filter((r) => r.baseId)]) {
    const groups = new Map<string, RecipeLike[]>()
    for (const r of level) {
      const key = signature(r, resolve(r.baseId))
      groups.set(key, [...(groups.get(key) ?? []), r])
    }
    for (const group of groups.values()) {
      if (group.length < 2) continue
      const [keep, ...rest] = [...group].sort(rank)
      for (const r of rest) replace.set(r.id, keep.id)
    }
  }
  return { remove: [...replace.keys()], replace }
}
