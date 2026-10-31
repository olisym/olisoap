// Doppelte Rezepte erkennen, z. B. Grundseifen, die zwei Geräte vor dem ersten Abgleich jeweils selbst angelegt haben.
// Rein und deterministisch: Jedes Gerät mit gleichem Datenstand trifft dieselbe Entscheidung, sonst würden sich zwei
// Geräte gegenseitig die jeweils andere Kopie löschen.

interface RecipeLike {
  id: string
  name?: string
  baseId?: string
  createdAt?: string
  updatedAt?: string
}

/** Fester Zeitstempel für Vorlagen: gleiche Vorlage auf zwei Geräten = gleicher Inhalt, kein Konflikt. */
export const TEMPLATE_DATE = '2026-01-01T00:00:00.000Z'

/**
 * Unberührte Vorlage: so, wie ein frisches Gerät sie anlegt (feste Kennung, fester Zeitstempel). Sie ist nur ein
 * Vorschlag und darf weder Daten vom Server überschreiben noch neben einem gleichnamigen Rezept stehen bleiben.
 */
export function isPristineTemplate(r: { id?: string; updatedAt?: string } | undefined): boolean {
  return !!r?.id?.startsWith('vorlage-') && r.updatedAt === TEMPLATE_DATE
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

  // Unberührte Vorlage neben einem gleichnamigen Rezept (z. B. eigene ältere Kopie mit anderer Kennung, oder die
  // Vorlage wurde seitdem geändert): Die Vorlage weicht, das andere Rezept ist das, mit dem gearbeitet wurde.
  const nameKey = (r: RecipeLike) => r.name?.trim().toLowerCase()
  for (const p of recipes.filter(isPristineTemplate)) {
    const others = recipes.filter((r) => r.id !== p.id && !isPristineTemplate(r) && nameKey(r) && nameKey(r) === nameKey(p)).sort(rank)
    if (others.length) replace.set(p.id, others[0].id)
  }

  // Erst Grundseifen, dann Varianten (deren Grundseife dann schon feststeht).
  const unmatched = (r: RecipeLike) => !replace.has(r.id)
  for (const level of [recipes.filter((r) => !r.baseId && unmatched(r)), recipes.filter((r) => r.baseId && unmatched(r))]) {
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
  // Ketten auflösen (a → b → c wird a → c), damit Chargen und Varianten nie auf ein gelöschtes Rezept zeigen
  for (const [from, to] of replace) {
    let target = to
    for (let n = 0; replace.has(target) && n < recipes.length; n++) target = replace.get(target)!
    replace.set(from, target)
  }
  return { remove: [...replace.keys()], replace }
}
