import type { RecipeResult } from './calc'
import type { Finding, PropertyKey, Range, TargetProfile } from './types'

export const PROPERTY_LABELS: Record<PropertyKey, string> = {
  hardness: 'Härte',
  cleansing: 'Reinigung',
  conditioning: 'Pflege',
  bubbly: 'Schaum (großblasig)',
  creamy: 'Schaum (cremig)',
  iodine: 'Jodzahl',
  ins: 'INS',
  polyunsaturated: 'Linol- + Linolensäure',
}

const CHELATORS = ['citric-anhydrous', 'citric-monohydrate', 'sodium-citrate']

export function inRange(value: number, range: Range): boolean {
  return (range.min === undefined || value >= range.min) && (range.max === undefined || value <= range.max)
}

export function formatRange(range: Range): string {
  if (range.min !== undefined && range.max !== undefined) return `${range.min}–${range.max}`
  if (range.min !== undefined) return `≥ ${range.min}`
  if (range.max !== undefined) return `≤ ${range.max}`
  return '–'
}

/** Feste Regeln, die unabhängig vom Zielprofil gelten. */
function baseRules(r: RecipeResult): Finding[] {
  const out: Finding[] = []
  const { input } = r
  if (Math.abs(r.percentSum - 100) > 0.05)
    out.push({ severity: 'error', message: `Fettanteile ergeben ${r.percentSum.toFixed(1)} % statt 100 %.` })
  if (input.superfat < 0)
    out.push({ severity: 'error', message: 'Negative Überfettung: Es bleibt freie Lauge in der Seife.' })
  else if (input.superfat > 20)
    out.push({ severity: 'warning', message: 'Überfettung über 20 %: Seife wird weich und neigt zu Ranzigkeit.' })
  if (r.lyeConcentration > 40)
    out.push({ severity: 'warning', message: `Laugenkonzentration ${r.lyeConcentration.toFixed(1)} %: sehr stark, NaOH kann auskristallisieren, Leim dickt schnell an.` })
  else if (r.lyeConcentration < 25 && r.lyeConcentration > 0)
    out.push({ severity: 'warning', message: `Laugenkonzentration ${r.lyeConcentration.toFixed(1)} %: viel Wasser, längere Reifezeit, Gefahr von Glycerinflüssen und Schrumpfen.` })
  if (r.properties.polyunsaturated > 15)
    out.push({ severity: 'warning', message: `Linol- + Linolensäure ${r.properties.polyunsaturated.toFixed(1)} %: erhöhtes Risiko für Ranzigkeit und orange Flecken.` })
  // Ranzigkeit: freies (unverseiftes) Fett oxidiert, Metallspuren beschleunigen das. Hohe Überfettung bei vielen
  // mehrfach ungesättigten Fettsäuren und fehlender Komplexbildner sind die typische Kombination für orange Flecken.
  const pufa = r.properties.polyunsaturated
  if (pufa > 10 && input.superfat >= 8)
    out.push({ severity: 'warning', message: `Überfettung ${input.superfat} % bei ${pufa.toFixed(1)} % Linol-/Linolensäure: Das freie Fett ist oxidationsanfällig. Überfettung senken oder ungesättigte Öle reduzieren.` })
  if (pufa > 10 && !r.additives.some((a) => CHELATORS.includes(a.additive.id)))
    out.push({ severity: 'info', message: 'Kein Komplexbildner (Zitronensäure/Natriumcitrat): Metallspuren aus Wasser und Werkzeug können die Ranzigkeit beschleunigen.' })
  for (const l of r.fats) {
    if (l.fat.id === 'castor' && l.percent > 15)
      out.push({ severity: 'warning', message: 'Rizinusöl über 15 %: Seife wird klebrig und weich.' })
  }
  return out
}

export function evaluate(r: RecipeResult, profile?: TargetProfile): Finding[] {
  const out = baseRules(r)
  if (!profile) return out
  for (const [key, range] of Object.entries(profile.properties) as [PropertyKey, Range][]) {
    const value = r.properties[key]
    if (!inRange(value, range))
      out.push({
        severity: 'warning',
        message: `${PROPERTY_LABELS[key]} ${value.toFixed(0)} liegt außerhalb des Zielbereichs ${formatRange(range)} (${profile.name}).`,
      })
  }
  if (profile.superfat && !inRange(r.input.superfat, profile.superfat))
    out.push({
      severity: 'warning',
      message: `Überfettung ${r.input.superfat} % liegt außerhalb des Zielbereichs ${formatRange(profile.superfat)} % (${profile.name}).`,
    })
  return out
}
