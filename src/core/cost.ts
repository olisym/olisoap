import type { RecipeResult } from './calc'
import type { MaterialKey, MaterialPrice } from './inventory'

export interface CostLine {
  key: MaterialKey
  name: string
  grams: number
  price?: MaterialPrice
  cost?: number
}

export interface RecipeCost {
  lines: CostLine[]
  total: number
  /** Zutaten ohne bekannten Preis (fließen nicht in die Summe ein). */
  missing: string[]
}

export function recipeCost(r: RecipeResult, priceOf: (key: MaterialKey) => MaterialPrice | undefined): RecipeCost {
  const raw: Omit<CostLine, 'price' | 'cost'>[] = [
    ...r.fats.map((l) => ({ key: `fat:${l.fat.id}` as MaterialKey, name: l.fat.name, grams: l.grams })),
    { key: `lye:${r.input.lyeType}` as MaterialKey, name: r.input.lyeType, grams: r.lyeWeighed },
    ...r.additives.map((a) => ({ key: `additive:${a.additive.id}` as MaterialKey, name: a.additive.name, grams: a.grams })),
  ]
  const lines = raw.map((l) => {
    const price = priceOf(l.key)
    return { ...l, price, cost: price ? (price.pricePerKg * l.grams) / 1000 : undefined }
  })
  return {
    lines,
    total: lines.reduce((s, l) => s + (l.cost ?? 0), 0),
    missing: lines.filter((l) => l.cost === undefined && l.grams > 0).map((l) => l.name),
  }
}

/** Anzahl Stücke aus dem frischen Leimgewicht und dem gewünschten Stückgewicht (frisch geschnitten). */
export function barCount(batchWeight: number, barWeight: number): number {
  return barWeight > 0 ? Math.floor(batchWeight / barWeight) : 0
}
