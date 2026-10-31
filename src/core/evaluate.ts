import type { RecipeResult } from './calc'
import type { Finding, PropertyKey, Range, TargetProfile } from './types'
import { citrateDose, hardnessRange } from './water'

/** Umstände in der Werkstatt, die die Gegenprobe kennen sollte. */
export interface EvaluateContext {
  /** Wasserhärte in °dH (Profil), fehlt = unbekannt. */
  waterHardness?: number
}

const dh = (v: number) => v.toLocaleString('de-DE', { maximumFractionDigits: 1 })

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
function baseRules(r: RecipeResult, ctx: EvaluateContext): Finding[] {
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
  const chelator = r.additives.some((a) => CHELATORS.includes(a.additive.id))
  const hardness = ctx.waterHardness
  const range = hardness !== undefined ? hardnessRange(hardness) : undefined
  if (hardness !== undefined && range !== 'soft' && !chelator)
    out.push({
      severity: 'info',
      message:
        `Wasser mit ${dh(hardness)} °dH ist ${range === 'hard' ? 'hart' : 'mittelhart'}: Ohne Komplexbildner entsteht beim Waschen mehr Kalkseife (Schmierfilm). ` +
        `Faustregel: ${dh(citrateDose(hardness))} % Zitronensäure.` +
        (pufa > 10 ? ' Citrat bindet zugleich Metallspuren und bremst so die Ranzigkeit.' : ''),
    })
  else if (pufa > 10 && !chelator)
    out.push({ severity: 'info', message: 'Kein Komplexbildner (Zitronensäure/Natriumcitrat): Metallspuren aus Wasser und Werkzeug können die Ranzigkeit beschleunigen.' })
  if (hardness !== undefined && range === 'soft' && chelator && pufa <= 10)
    out.push({ severity: 'info', message: `Bei weichem Wasser (${dh(hardness)} °dH) bringt Citrat gegen Kalkseife wenig. Es bindet aber Metallspuren und bremst Ranzigkeit; Weglassen ist kein Fehler.` })
  if (input.process === 'hot') {
    const after = input.fats.filter((f) => f.afterCook).reduce((sum, f) => sum + f.percent, 0)
    if (after > input.superfat + 0.05)
      out.push({
        severity: 'error',
        message: `Nach dem Kochen ${after.toFixed(1)} % Fett, aber nur ${input.superfat} % Überfettung: Der gekochte Leim hat zu viel Lauge. Höchstens so viel Fett zurückhalten, wie überfettet wird.`,
      })
    // Erfahrungswert aus der HP-Praxis, keine Messung: mehr Wasser hält den gekochten Leim länger formbar.
    if (r.lyeConcentration > 33)
      out.push({ severity: 'info', message: `Heißverseifung mit ${r.lyeConcentration.toFixed(1)} % Laugenkonzentration: Etwas mehr Wasser (ca. 28–30 %) hält den Leim nach dem Kochen fließfähiger und leichter in die Form zu drücken.` })
  } else if (input.fats.some((f) => f.afterCook)) {
    out.push({ severity: 'info', message: '„Nach dem Kochen“ gilt nur bei Heißverseifung; bei Kaltverseifung kommen alle Fette zusammen in den Topf.' })
  }
  // Stearinsäure ist eine freie Fettsäure: verseift sofort und dickt den Leim stark an. Grenze 10 % ist Erfahrungswert.
  const stearic = input.fats.find((f) => f.fatId === 'stearic-acid')?.percent ?? 0
  if (stearic > 10 && input.process !== 'hot')
    out.push({
      severity: 'warning',
      message: `Stearinsäure ${stearic.toFixed(0)} % im Kaltverfahren: Der Leim dickt fast sofort an und lässt sich kaum noch in die Form bringen. Heißverseifung nehmen oder unter 10 % bleiben.`,
    })
  for (const l of r.fats) {
    if (l.fat.id === 'castor' && l.percent > 15)
      out.push({ severity: 'warning', message: 'Rizinusöl über 15 %: Seife wird klebrig und weich.' })
  }
  return out
}

export function evaluate(r: RecipeResult, profile?: TargetProfile, ctx: EvaluateContext = {}): Finding[] {
  const out = baseRules(r, ctx)
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
