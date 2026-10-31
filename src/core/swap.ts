import { baseFatId, FATS, FATS_BY_ID } from '../data/fats'
import { calculate } from './calc'
import { evaluate, type EvaluateContext } from './evaluate'
import type { FattyAcids, RecipeInput, TargetProfile } from './types'

// Fette tauschen: ein Fett 1:1 durch ein gleiches aus anderer Quelle oder ein sehr ähnliches ersetzen, wenn das je Sud
// spürbar günstiger ist und die Gegenprobe nicht schlechter wird. Nur Hinweise, nie automatisch.

export interface SwapSuggestion {
  fromId: string
  toId: string
  /** Ersparnis je Sud in € bei der Fettmenge des Rezepts. */
  saving: number
  /** Gleiches Fett aus anderer Quelle (z. B. eigenes „Olivenöl (Aldi)“ statt Olivenöl). */
  sameFat: boolean
}

/** Mindestersparnis je Sud, darunter lohnt kein Hinweis. */
export const MIN_SAVING = 0.3
/** Größter Abstand der Fettsäuregruppen (Prozentpunkte), der noch als „ähnlich“ gilt. */
const MAX_DISTANCE = 30

const sum = (fa: FattyAcids, keys: (keyof FattyAcids)[]) => keys.reduce((s, k) => s + (fa[k] ?? 0), 0)
const groups = (fa: FattyAcids) => [
  sum(fa, ['caprylic', 'capric', 'lauric', 'myristic']),
  sum(fa, ['palmitic', 'stearic']),
  sum(fa, ['palmitoleic', 'oleic']),
  sum(fa, ['linoleic', 'linolenic']),
  sum(fa, ['ricinoleic']),
]

/** Abstand zweier Fette über die Fettsäuregruppen, die für Seife zählen (Reinigung, Härte, Pflege, Ranzigkeit, Schaum). */
export function fatDistance(a: string, b: string): number {
  const ga = groups(FATS_BY_ID[a].fattyAcids)
  const gb = groups(FATS_BY_ID[b].fattyAcids)
  return ga.reduce((s, v, i) => s + Math.abs(v - gb[i]), 0)
}

const problems = (input: RecipeInput, profile: TargetProfile | undefined, ctx: EvaluateContext) => {
  try {
    return evaluate(calculate(input), profile, ctx)
      .filter((f) => f.severity !== 'info')
      .map((f) => f.message.replace(/[\d.,]+/g, '#'))
  } catch {
    return undefined
  }
}

export function swapSuggestions(
  input: RecipeInput,
  profile: TargetProfile | undefined,
  priceOf: (fatId: string) => number | undefined,
  ctx: EvaluateContext = {},
  limit = 3,
): SwapSuggestion[] {
  const before = problems(input, profile, ctx)
  if (!before) return []
  const used = new Set(input.fats.map((f) => f.fatId))
  const out: SwapSuggestion[] = []
  for (const line of input.fats) {
    const price = priceOf(line.fatId)
    if (price === undefined || !FATS_BY_ID[line.fatId]) continue
    const grams = (input.totalFat * line.percent) / 100
    for (const fat of FATS) {
      if (used.has(fat.id)) continue
      const sameFat = baseFatId(fat.id) === baseFatId(line.fatId)
      if (!sameFat && fatDistance(line.fatId, fat.id) > MAX_DISTANCE) continue
      const other = priceOf(fat.id)
      if (other === undefined) continue
      const saving = ((price - other) * grams) / 1000
      if (saving < MIN_SAVING) continue
      const swapped: RecipeInput = { ...input, fats: input.fats.map((f) => (f === line ? { ...f, fatId: fat.id, sapKohOverride: undefined } : f)) }
      const after = problems(swapped, profile, ctx)
      // Gegenprobe darf nicht schlechter werden: keine neue Warnung (Zahlen in den Texten zählen nicht)
      if (!after || after.some((m) => !before.includes(m))) continue
      out.push({ fromId: line.fatId, toId: fat.id, saving, sameFat })
    }
  }
  return out.sort((a, b) => b.saving - a.saving).slice(0, limit)
}
