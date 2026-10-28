import type { TargetProfile } from '../core/types'

// Startwerte, abgeleitet aus den verbreiteten SoapCalc-Richtbereichen und an die Zwecke angepasst.
// Das sind Ausgangspunkte zum Nachschärfen anhand eigener Erfahrung, keine festen Wahrheiten.
export const PROFILES: TargetProfile[] = [
  {
    id: 'body-sensitive',
    name: 'Körperseife – empfindliche Haut',
    description: 'Milde Reinigung, gute Härte, oxidationsstabil.',
    properties: {
      hardness: { min: 35, max: 50 },
      cleansing: { min: 10, max: 18 },
      conditioning: { min: 50, max: 70 },
      bubbly: { min: 14 },
      creamy: { min: 20 },
      iodine: { max: 70 },
      polyunsaturated: { max: 15 },
    },
    superfat: { min: 6, max: 12 },
  },
  {
    id: 'hair-fine-long',
    name: 'Haarseife – lange, feine Haare',
    description: 'Gründliche, aber nicht strippende Reinigung, eher niedrige Überfettung, damit feines Haar nicht beschwert wird.',
    properties: {
      hardness: { min: 35, max: 50 },
      cleansing: { min: 12, max: 20 },
      conditioning: { min: 45, max: 65 },
      bubbly: { min: 20 },
      polyunsaturated: { max: 15 },
    },
    superfat: { min: 3, max: 7 },
  },
]

export const PROFILES_BY_ID: Record<string, TargetProfile> = Object.fromEntries(PROFILES.map((p) => [p.id, p]))
