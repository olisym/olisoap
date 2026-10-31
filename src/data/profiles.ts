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
    design: {
      // Laurinsäure-Öle knapp halten (Hautreizung), Härte lieber über Stearin-/Palmitinsäure
      fats: { olive: 60, 'sunflower-ho': 50, 'rice-bran': 15, avocado: 15, macadamia: 15, almond: 10, shea: 35, cocoa: 15, mango: 25, babassu: 18, coconut: 18, castor: 8 },
      lauricMax: 18,
      targets: { cleansing: [11, 17], bubbly: [15, 21], creamy: [33, 25], hardness: [37, 46], conditioning: 58 },
      hotOils: ['avocado', 'macadamia', 'almond', 'olive', 'shea'],
    },
  },
  {
    id: 'hair-fine-long',
    name: 'Haarseife – lange, feine Haare',
    description: 'Gründliche, aber nicht strippende Reinigung, eher niedrige Überfettung, damit feines Haar nicht beschwert wird.',
    properties: {
      hardness: { min: 35, max: 50 },
      cleansing: { min: 15, max: 25 },
      conditioning: { min: 45, max: 65 },
      bubbly: { min: 20 },
      polyunsaturated: { max: 15 },
    },
    superfat: { min: 3, max: 7 },
    design: {
      // Nur ölsäurereiche Flüssigöle, Rizinus für stabilen Schaum
      fats: { 'sunflower-ho': 45, olive: 30, macadamia: 15, babassu: 35, coconut: 35, castor: 15, cocoa: 15, shea: 15, mango: 15 },
      lauricMax: 35,
      targets: { cleansing: [16, 24], bubbly: [22, 32], creamy: [29, 21], hardness: [37, 46], conditioning: 55 },
      hotOils: ['macadamia', 'sunflower-ho', 'olive'],
    },
  },
  {
    id: 'shave-brush',
    name: 'Rasierseife – Pinsel',
    description: 'Dichter, stabiler, gleitfähiger Schaum. Viel Stearin-/Palmitinsäure, moderate Reinigung, niedrige Überfettung (zu viel freies Fett zerstört den Schaum).',
    properties: {
      hardness: { min: 50 },
      cleansing: { min: 12, max: 25 },
      bubbly: { min: 20 },
      creamy: { min: 45 },
      polyunsaturated: { max: 10 },
    },
    superfat: { min: 2, max: 6 },
    design: {
      // Stearinsäure trägt den Schaum, Laurinsäure nur für den Anschaum
      fats: { 'stearic-acid': 50, babassu: 25, coconut: 25, shea: 25, mango: 20, cocoa: 15, castor: 10, avocado: 10 },
      lauricMax: 25,
      targets: { cleansing: [13, 22], bubbly: [21, 30], creamy: [62, 48], hardness: [58, 72] },
      hotOils: ['avocado', 'shea'],
      process: 'hot',
    },
  },
]

export const PROFILES_BY_ID: Record<string, TargetProfile> = Object.fromEntries(PROFILES.map((p) => [p.id, p]))
