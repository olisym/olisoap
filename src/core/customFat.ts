import type { Fat, FattyAcidKey, FattyAcids } from './types'

// Eigene Fette: ein bekanntes Fett mit Werten vom Etikett, z. B. „Olivenöl (Aldi)“. Die Nährwerttabelle nennt je
// 100 g gesättigte, einfach und mehrfach ungesättigte Fettsäuren. Diese drei Summen ersetzen die des Basisfetts; innerhalb
// jeder Gruppe bleibt die Verteilung des Basisfetts (die nennt das Etikett nicht). Verseifungszahl und INCI bleiben,
// die Jodzahl wird um die rechnerische Änderung verschoben.

/** Gramm je 100 g laut Nährwerttabelle. */
export interface LabelFats {
  saturated: number
  mono: number
  poly: number
}

export interface CustomFat {
  /** Feste Kennung, beginnt mit „eigen-“. */
  id: string
  /** Bekanntes Fett, dessen Verteilung und Verseifungszahl gelten. */
  baseId: string
  name: string
  label: LabelFats
  notes?: string
}

const GROUPS: Record<keyof LabelFats, FattyAcidKey[]> = {
  saturated: ['caprylic', 'capric', 'lauric', 'myristic', 'palmitic', 'stearic'],
  mono: ['palmitoleic', 'oleic', 'ricinoleic'],
  poly: ['linoleic', 'linolenic'],
}
/** Wohin eine Gruppe geht, die das Basisfett gar nicht hat. */
const FALLBACK: Record<keyof LabelFats, FattyAcidKey> = { saturated: 'palmitic', mono: 'oleic', poly: 'linoleic' }

/** Rechnerische Jodzahl je Prozent Fettsäure: Doppelbindungen × 253,8 / Molmasse (AOCS Cd 1c-85, Ricinolsäure ergänzt). */
const IODINE_PER_PERCENT: Partial<Record<FattyAcidKey, number>> = { palmitoleic: 0.95, oleic: 0.86, ricinoleic: 0.85, linoleic: 1.732, linolenic: 2.616 }

const iodineOf = (fa: FattyAcids) => Object.entries(IODINE_PER_PERCENT).reduce((s, [k, f]) => s + (fa[k as FattyAcidKey] ?? 0) * f!, 0)

export function labelValid(l: LabelFats): boolean {
  return [l.saturated, l.mono, l.poly].every((v) => Number.isFinite(v) && v >= 0) && l.saturated + l.mono + l.poly > 0
}

export function deriveFat(base: Fat, c: CustomFat): Fat {
  if (!labelValid(c.label)) return { ...base, id: c.id, name: c.name }
  const listed = Object.values(base.fattyAcids).reduce((s, v) => s + (v ?? 0), 0) || 100
  const total = c.label.saturated + c.label.mono + c.label.poly
  const fattyAcids: FattyAcids = {}
  for (const group of Object.keys(GROUPS) as (keyof LabelFats)[]) {
    // Anteil der Gruppe an den erfassten Fettsäuren, wie im Basisfett auf dessen Summe bezogen
    const target = (c.label[group] / total) * listed
    const keys = GROUPS[group]
    const baseSum = keys.reduce((s, k) => s + (base.fattyAcids[k] ?? 0), 0)
    if (baseSum > 0) for (const k of keys) {
      const v = ((base.fattyAcids[k] ?? 0) / baseSum) * target
      if (v > 0) fattyAcids[k] = Math.round(v * 10) / 10
    }
    else if (target > 0) fattyAcids[FALLBACK[group]] = Math.round(target * 10) / 10
  }
  return {
    ...base,
    id: c.id,
    name: c.name,
    fattyAcids,
    iodine: Math.max(0, Math.round(base.iodine + iodineOf(fattyAcids) - iodineOf(base.fattyAcids))),
    notes: c.notes ?? base.notes,
  }
}

/** Kennung aus dem Namen; kurz genug für die Sync-API (≤ 100 Zeichen). */
export function customFatId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
  return `eigen-${slug || 'fett'}`
}
