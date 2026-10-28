// Grundtypen des Rechenkerns. Alles hier ist reine Daten, ohne UI- oder Speicherbezug.

/** Fettsäureanteile in Prozent (Massenanteil an den Gesamtfettsäuren). */
export interface FattyAcids {
  caprylic?: number // C8:0
  capric?: number // C10:0
  lauric?: number // C12:0
  myristic?: number // C14:0
  palmitic?: number // C16:0
  palmitoleic?: number // C16:1
  stearic?: number // C18:0
  ricinoleic?: number // C18:1-OH
  oleic?: number // C18:1
  linoleic?: number // C18:2
  linolenic?: number // C18:3
}

export type FattyAcidKey = keyof FattyAcids

export interface Fat {
  id: string
  name: string
  /** Verseifungszahl in mg KOH pro g Fett. NaOH wird daraus umgerechnet. */
  sapKoh: number
  fattyAcids: FattyAcids
  iodine: number
  /** Dichte in g/ml bei Raumtemperatur (für Ware, die nach Volumen verkauft wird). Standard 0,92. */
  density?: number
  /** Kurze, sachliche Notiz: wofür das Fett taugt, was es kritisch macht. */
  notes?: string
  /** INCI-Bezeichnungen: verseift mit NaOH, verseift mit KOH, unverseiftes Öl (Überfettung). */
  inci?: { sodium?: string; potassium?: string; oil?: string }
}

export type LyeType = 'NaOH' | 'KOH'

/** Lauge im Rezept: eine Sorte oder Mischlauge (z. B. für Rasierseife). */
export type RecipeLye = LyeType | 'dual'

export type WaterMode =
  | { mode: 'percentOfFats'; value: number } // Wasser in % der Gesamtfettmenge
  | { mode: 'concentration'; value: number } // Laugenkonzentration in % (Lauge / (Lauge + Wasser))
  | { mode: 'ratio'; value: number } // Wasser : Lauge (z. B. 2 = 2:1)

export interface RecipeFat {
  fatId: string
  /** Anteil an der Gesamtfettmenge in Prozent. */
  percent: number
  /** Optional abweichende Verseifungszahl (mg KOH/g), z. B. aus dem Analysezertifikat des Lieferanten. */
  sapKohOverride?: number
}

export interface RecipeAdditive {
  additiveId: string
  /** Dosierung in % der Gesamtfettmenge. */
  percentOfFats: number
  /** Eigene Begründung, warum der Zusatz im Rezept ist. */
  reason?: string
}

export interface RecipeInput {
  totalFat: number // g
  fats: RecipeFat[]
  lyeType: RecipeLye
  /** Reinheit der Lauge in Prozent (handelsübliches NaOH ca. 99 %, KOH ca. 90 %). Bei Mischlauge: Reinheit des NaOH. */
  lyePurity: number
  /** Nur Mischlauge: Anteil KOH an der Verseifung in Prozent (molar, also an der verseiften Fettmenge). */
  kohShare?: number
  /** Nur Mischlauge: Reinheit des KOH in Prozent. */
  kohPurity?: number
  superfat: number // %
  water: WaterMode
  additives: RecipeAdditive[]
}

export type AdditivePhase = 'lye' | 'fats' | 'trace'

export interface Additive {
  id: string
  name: string
  phase: AdditivePhase
  /** g NaOH bzw. KOH, die 1 g des Zusatzes neutralisiert (z. B. Säuren). */
  neutralizes?: { NaOH: number; KOH: number }
  /** Wasseranteil des Zusatzes (0–1), z. B. Natriumlaktat 60 % → 0,4 Wasser. */
  waterFraction?: number
  typicalPercent?: [number, number]
  /** Dichte in g/ml, falls nach Volumen verkauft. */
  density?: number
  purpose: string
  /** Sachliche Einordnung der Belege (was ist gut belegt, was ist Behauptung). */
  evidence: string
  /** INCI-Bezeichnung im fertigen Produkt (Säuren als ihr Natriumsalz). */
  inci?: string
}

export interface SoapProperties {
  hardness: number
  cleansing: number
  conditioning: number
  bubbly: number
  creamy: number
  iodine: number
  ins: number
  /** Linol- + Linolensäure: Hauptfaktor für Ranzigkeit / orange Flecken. */
  polyunsaturated: number
}

export type PropertyKey = keyof SoapProperties

export interface Range {
  min?: number
  max?: number
}

export interface TargetProfile {
  id: string
  name: string
  description: string
  properties: Partial<Record<PropertyKey, Range>>
  superfat?: Range
  lyeConcentration?: Range
}

export type Severity = 'error' | 'warning' | 'info'

export interface Finding {
  severity: Severity
  message: string
}
