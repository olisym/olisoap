import { addDays } from './batch'
import type { RecipeResult } from './calc'

// Zutatenliste für Etiketten. Die Reihenfolge nach Gewicht im fertigen Produkt ist eine Näherung:
// Verseifungsprodukte ≈ verseifte Fettmenge, Glycerin ≈ 10 % davon, Restwasser nach dem Reifen ≈ 40 % des Ansatzwassers.

export interface Ingredient {
  de: string
  inci?: string
  grams: number
}

const GLYCERIN_PER_FAT = 0.1
const RESIDUAL_WATER = 0.4

export function soapIngredients(r: RecipeResult): Ingredient[] {
  const sf = r.input.superfat / 100
  const kohShare = r.input.lyeType === 'KOH' ? 1 : r.input.lyeType === 'dual' ? (r.input.kohShare ?? 0) / 100 : 0
  const out: Ingredient[] = []
  let saponified = 0

  for (const l of r.fats) {
    const inci = l.fat.inci
    // Wachse und Fette ohne Seifen-INCI erscheinen mit ihrer Öl-Bezeichnung in voller Menge.
    if (!inci?.sodium && !inci?.potassium) {
      out.push({ de: l.fat.name, inci: inci?.oil, grams: l.grams })
      continue
    }
    const soap = l.grams * (1 - sf)
    saponified += soap
    if (kohShare < 1) out.push({ de: `verseiftes ${l.fat.name}`, inci: inci.sodium, grams: soap * (1 - kohShare) })
    if (kohShare > 0) out.push({ de: `verseiftes ${l.fat.name}`, inci: inci.potassium, grams: soap * kohShare })
    if (sf > 0) out.push({ de: l.fat.name, inci: inci.oil, grams: l.grams * sf })
  }

  out.push({ de: 'Wasser', inci: 'Aqua', grams: (r.water + r.waterFromAdditives) * RESIDUAL_WATER })
  out.push({ de: 'Glycerin', inci: 'Glycerin', grams: saponified * GLYCERIN_PER_FAT })
  for (const a of r.additives) out.push({ de: a.additive.name, inci: a.additive.inci, grams: a.grams })

  // Gleiche Bezeichnungen zusammenfassen (z. B. Glycerin aus Verseifung und als Zusatz).
  const merged = new Map<string, Ingredient>()
  for (const i of out) {
    const key = i.inci ?? i.de
    const prev = merged.get(key)
    merged.set(key, prev ? { ...prev, grams: prev.grams + i.grams } : i)
  }
  return [...merged.values()].filter((i) => i.grams > 0).sort((a, b) => b.grams - a.grams)
}

/**
 * Vorschlag "Am besten verwenden bis": frühestes MHD der verwendeten Fette, höchstens 24 Monate nach dem Sieden,
 * bei vielen mehrfach ungesättigten Fettsäuren (> 10 %) höchstens 12 Monate. Eine Faustregel, keine Prüfung.
 */
export function suggestBestUse(siedeDate: string, polyunsaturated: number, earliestFatMhd?: string): string {
  const cap = addDays(siedeDate, polyunsaturated > 10 ? 365 : 730)
  return earliestFatMhd && earliestFatMhd < cap ? earliestFatMhd : cap
}
