import type { RecipeResult } from './calc'
import type { LyeType } from './types'

// Schritt-für-Schritt-Anleitung zum Sieden, als reine Daten aus dem gerechneten Rezept. Die Texte stehen in der
// Oberfläche (übersetzbar); hier steht nur, welche Schritte es gibt, was dazugehört und welche Besonderheiten gelten.
// Schlüssel der Zutaten wie in der Checkliste des Siede-Modus, damit beide Ansichten denselben Fortschritt teilen.

export type StepKind =
  | 'equipment'
  | 'safety'
  | 'weigh'
  | 'lye'
  | 'fats'
  | 'temperature'
  | 'blend'
  | 'trace'
  | 'mold'
  | 'cook'
  | 'afterCook'
  | 'firstDays'
  | 'cure'
  | 'cleanup'
  | 'use'

export interface GuideItem {
  key: string
  name: string
  grams: number
  /** Ist-Gewicht eintragbar (Fette und eine einzelne Lauge: daraus rechnet die Korrektur). */
  editable?: boolean
}

/** Wie die fertige Seife benutzt wird, wenn das zum Gelingen gehört. */
export type Usage = 'acidRinse' | 'brush'

export interface GuideStep {
  kind: StepKind
  items: GuideItem[]
}

export interface Guide {
  steps: GuideStep[]
  hot: boolean
  /** Rasierseife im Tiegel: nicht ausformen und schneiden. */
  tub: boolean
  lyes: LyeType[]
  /** Säuren, die zuerst im Wasser gelöst werden (verbrauchen Lauge). */
  acids: GuideItem[]
  /** Zusätze, die in die abgekühlte Lauge kommen. */
  lyeExtras: GuideItem[]
  /** Namen der festen Fette (Butter, Stearinsäure), die geschmolzen werden müssen. */
  solidFats: string[]
  /** Viele feste Fette: nicht zu kühl arbeiten, sonst falsche Spur. */
  butterRich: boolean
  /** Stearinsäure im Rezept: schmilzt erst bei ca. 55–70 °C. */
  stearic: boolean
  fragrance: boolean
  /** Mengen unter 10 g: Feinwaage hilft. */
  fineScale: boolean
  usage?: Usage
}

/** Feste Fette bei Raumtemperatur. */
const SOLID = new Set(['shea', 'cocoa', 'mango', 'coconut', 'babassu', 'palm-kernel', 'palm', 'lard', 'tallow', 'stearic-acid', 'beeswax'])
/** Butter, die beim Abkühlen auskristallisieren und eine Spur vortäuschen können. */
const BUTTERS = new Set(['shea', 'cocoa', 'mango', 'stearic-acid', 'palm', 'lard', 'tallow'])

export function buildGuide(r: RecipeResult, usage?: Usage): Guide {
  const hot = r.input.process === 'hot'
  const tub = r.input.lyeType === 'dual'
  const afterCookIds = new Set(r.input.fats.filter((f) => hot && f.afterCook).map((f) => f.fatId))
  const add = (a: RecipeResult['additives'][number]): GuideItem => ({ key: `add:${a.additive.id}`, name: a.additive.name, grams: a.grams })
  const acids = r.additives.filter((a) => a.additive.phase === 'lye' && a.lyeConsumed > 0).map(add)
  const lyeExtras = r.additives.filter((a) => a.additive.phase === 'lye' && a.lyeConsumed === 0).map(add)
  const fatExtras = r.additives.filter((a) => a.additive.phase === 'fats').map(add)
  const traceAdds = r.additives.filter((a) => a.additive.phase === 'trace').map(add)
  const fat = (l: RecipeResult['fats'][number]): GuideItem => ({ key: `fat:${l.fat.id}`, name: l.fat.name, grams: l.grams, editable: true })
  const mainFats = r.fats.filter((l) => !afterCookIds.has(l.fat.id)).map(fat)
  const laterFats = r.fats.filter((l) => afterCookIds.has(l.fat.id)).map(fat)
  const lyeItems: GuideItem[] = r.lyeParts.map((p) => ({ key: `lye:${p.type}`, name: p.type, grams: p.weighed, editable: r.lyeParts.length === 1 }))
  const water: GuideItem = { key: 'water', name: 'Wasser (destilliert)', grams: r.water }
  const all = [water, ...acids, ...lyeItems, ...lyeExtras, ...mainFats, ...fatExtras, ...laterFats, ...traceAdds]
  const butterShare = r.fats.filter((l) => BUTTERS.has(l.fat.id)).reduce((s, l) => s + l.percent, 0)

  const step = (kind: StepKind, items: GuideItem[] = []): GuideStep => ({ kind, items })
  const steps: GuideStep[] = [
    step('equipment'),
    step('safety'),
    step('weigh', all),
    step('lye', [water, ...acids, ...lyeItems, ...lyeExtras]),
    step('fats', [...mainFats, ...fatExtras]),
    ...(hot ? [] : [step('temperature')]),
    step('blend'),
    ...(hot ? [step('cook'), step('afterCook', [...laterFats, ...traceAdds])] : [...(traceAdds.length ? [step('trace', traceAdds)] : []), step('mold')]),
    step('firstDays'),
    step('cure'),
    step('cleanup'),
    ...(usage ? [step('use')] : []),
  ]
  return {
    steps,
    hot,
    tub,
    lyes: r.lyeParts.map((p) => p.type),
    acids,
    lyeExtras,
    solidFats: r.fats.filter((l) => SOLID.has(l.fat.id) && !afterCookIds.has(l.fat.id)).map((l) => l.fat.name),
    butterRich: butterShare >= 25,
    stearic: r.fats.some((l) => l.fat.id === 'stearic-acid'),
    fragrance: r.additives.some((a) => a.additive.fragrance),
    fineScale: all.some((i) => i.grams > 0 && i.grams < 10),
    usage,
  }
}
