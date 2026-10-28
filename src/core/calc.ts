import { ADDITIVES_BY_ID } from '../data/additives'
import { FATS_BY_ID } from '../data/fats'
import type {
  Additive,
  Fat,
  FattyAcidKey,
  FattyAcids,
  LyeType,
  RecipeInput,
  SoapProperties,
  WaterMode,
} from './types'

// Der Kern: aus einem Rezept (Prozente + Einstellungen) werden alle Mengen und Kennzahlen abgeleitet.
// Alle Werkzeuge (Korrekturrechner, Profilprüfung, später der Optimierer) bauen auf diesen Funktionen auf.

export const MOLAR_MASS = { NaOH: 40.0, KOH: 56.11 } as const

/** g reine Lauge, die 1 g Fett vollständig verseift. */
export function sapValue(sapKoh: number, lyeType: LyeType): number {
  const perGramKoh = sapKoh / 1000
  return lyeType === 'KOH' ? perGramKoh : (perGramKoh * MOLAR_MASS.NaOH) / MOLAR_MASS.KOH
}

export interface FatLine {
  fat: Fat
  percent: number
  grams: number
  sapKoh: number
  /** Reine Lauge für vollständige Verseifung dieser Fettmenge (0 % Überfettung). */
  lyeFull: number
}

export interface AdditiveLine {
  additive: Additive
  percentOfFats: number
  grams: number
  /** Reine Lauge, die der Zusatz neutralisiert. */
  lyeConsumed: number
  water: number
  reason?: string
}

export interface RecipeResult {
  input: RecipeInput
  fats: FatLine[]
  additives: AdditiveLine[]
  percentSum: number
  /** Reine Lauge für die Fette nach Abzug der Überfettung. */
  lyeForFats: number
  lyeForAdditives: number
  lyePure: number
  /** Einzuwiegende Lauge unter Berücksichtigung der Reinheit. */
  lyeWeighed: number
  water: number
  waterFromAdditives: number
  /** Laugenkonzentration der angesetzten Lauge: Lauge / (Lauge + Wasser). */
  lyeConcentration: number
  batchWeight: number
  fattyAcids: Required<FattyAcids>
  properties: SoapProperties
}

export function resolveFat(fatId: string): Fat {
  const fat = FATS_BY_ID[fatId]
  if (!fat) throw new Error(`Unbekanntes Fett: ${fatId}`)
  return fat
}

export function waterAmount(water: WaterMode, totalFat: number, lyeWeighed: number): number {
  switch (water.mode) {
    case 'percentOfFats':
      return (totalFat * water.value) / 100
    case 'concentration':
      return (lyeWeighed * (100 - water.value)) / water.value
    case 'ratio':
      return lyeWeighed * water.value
  }
}

const FA_KEYS: FattyAcidKey[] = [
  'caprylic',
  'capric',
  'lauric',
  'myristic',
  'palmitic',
  'palmitoleic',
  'stearic',
  'ricinoleic',
  'oleic',
  'linoleic',
  'linolenic',
]

/** Gewichtetes Fettsäureprofil einer Fettmischung. */
export function blendFattyAcids(lines: { fat: Fat; percent: number }[]): Required<FattyAcids> {
  const total = lines.reduce((s, l) => s + l.percent, 0) || 1
  const profile = Object.fromEntries(FA_KEYS.map((k) => [k, 0])) as Required<FattyAcids>
  for (const { fat, percent } of lines) {
    for (const k of FA_KEYS) profile[k] += ((fat.fattyAcids[k] ?? 0) * percent) / total
  }
  return profile
}

// Kennzahlen nach der verbreiteten SoapCalc-Konvention. Das sind Heuristiken zum Vergleichen von Rezepten,
// keine Messwerte. Kurzkettige Fettsäuren (C8/C10) zählen dort nicht zur Reinigung, das übernehmen wir zur
// Vergleichbarkeit mit bekannten Richtbereichen.
export function soapProperties(lines: { fat: Fat; percent: number; sapKoh: number }[]): SoapProperties {
  const fa = blendFattyAcids(lines)
  const total = lines.reduce((s, l) => s + l.percent, 0) || 1
  const iodine = lines.reduce((s, l) => s + (l.fat.iodine * l.percent) / total, 0)
  const sapKoh = lines.reduce((s, l) => s + (l.sapKoh * l.percent) / total, 0)
  return {
    hardness: fa.lauric + fa.myristic + fa.palmitic + fa.stearic,
    cleansing: fa.lauric + fa.myristic,
    conditioning: fa.oleic + fa.ricinoleic + fa.linoleic + fa.linolenic,
    bubbly: fa.lauric + fa.myristic + fa.ricinoleic,
    creamy: fa.palmitic + fa.stearic + fa.ricinoleic,
    iodine,
    ins: sapKoh - iodine,
    polyunsaturated: fa.linoleic + fa.linolenic,
  }
}

export function calculate(input: RecipeInput): RecipeResult {
  const fats: FatLine[] = input.fats.map((rf) => {
    const fat = resolveFat(rf.fatId)
    const sapKoh = rf.sapKohOverride ?? fat.sapKoh
    const grams = (input.totalFat * rf.percent) / 100
    return { fat, percent: rf.percent, grams, sapKoh, lyeFull: grams * sapValue(sapKoh, input.lyeType) }
  })
  const percentSum = fats.reduce((s, l) => s + l.percent, 0)

  const additives: AdditiveLine[] = input.additives.map((ra) => {
    const additive = ADDITIVES_BY_ID[ra.additiveId]
    if (!additive) throw new Error(`Unbekannter Zusatz: ${ra.additiveId}`)
    const grams = (input.totalFat * ra.percentOfFats) / 100
    return {
      additive,
      percentOfFats: ra.percentOfFats,
      grams,
      lyeConsumed: grams * (additive.neutralizes?.[input.lyeType] ?? 0),
      water: grams * (additive.waterFraction ?? 0),
      reason: ra.reason,
    }
  })

  const lyeForFats = fats.reduce((s, l) => s + l.lyeFull, 0) * (1 - input.superfat / 100)
  const lyeForAdditives = additives.reduce((s, a) => s + a.lyeConsumed, 0)
  const lyePure = lyeForFats + lyeForAdditives
  const lyeWeighed = lyePure / (input.lyePurity / 100)
  const water = waterAmount(input.water, input.totalFat, lyeWeighed)
  const waterFromAdditives = additives.reduce((s, a) => s + a.water, 0)

  return {
    input,
    fats,
    additives,
    percentSum,
    lyeForFats,
    lyeForAdditives,
    lyePure,
    lyeWeighed,
    water,
    waterFromAdditives,
    lyeConcentration: lyeWeighed + water > 0 ? (lyeWeighed / (lyeWeighed + water)) * 100 : 0,
    batchWeight: input.totalFat + lyeWeighed + water + additives.reduce((s, a) => s + a.grams, 0),
    fattyAcids: blendFattyAcids(fats),
    properties: soapProperties(fats),
  }
}

/** Überfettung, die sich ergibt, wenn für die gegebene Fettmenge nur `lyePureForFats` zur Verfügung steht. */
export function superfatFor(lyeFull: number, lyePureForFats: number): number {
  return lyeFull > 0 ? (1 - lyePureForFats / lyeFull) * 100 : 0
}
