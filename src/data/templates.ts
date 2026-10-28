import type { Recipe } from '../db'
import { KOERPERSEIFE_2 } from './seedRecipes'

export type Template = Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>

const citrate = { additiveId: 'citric-anhydrous', percentOfFats: 1.5, reason: 'Hartes Wasser (Duisburg ca. 12–17 °dH): Natriumcitrat bindet einen Teil von Ca/Mg im Schaum.' }

export const TEMPLATES: Template[] = [
  KOERPERSEIFE_2,
  {
    name: 'Körperseife 3.0',
    description: 'Mild, cremig, ranzstabil. Weniger Laurinsäure als 2.0, Härte über Stearin- und Palmitinsäure statt über Kokos/Babassu.',
    profileId: 'body-sensitive',
    barWeight: 100,
    notes:
      'Gegenüber 2.0: Reinigung 17,5 → 12,6, cremiger Schaum 28 → 35. Mandelöl durch Olivenöl ersetzt (stabiler, günstiger), Kakaobutter für Härte. ' +
      'Arbeitstemperatur ca. 35–40 °C, damit Shea und Kakaobutter nicht vorzeitig auskristallisieren (falsche Spur). ' +
      'Duft: wenn überhaupt, max. 1 % ätherisches Öl, für empfindliche Haut besser unbeduftet.',
    input: {
      totalFat: 1000,
      lyeType: 'NaOH',
      lyePurity: 100,
      superfat: 7,
      water: { mode: 'concentration', value: 33 },
      fats: [
        { fatId: 'shea', percent: 30 },
        { fatId: 'olive', percent: 30 },
        { fatId: 'babassu', percent: 18 },
        { fatId: 'cocoa', percent: 10 },
        { fatId: 'castor', percent: 7 },
        { fatId: 'avocado', percent: 5 },
      ],
      additives: [citrate],
    },
  },
  {
    name: 'Körperseife 3.0 Spar',
    description: 'Gleiche Idee, auf Preis optimiert: Kokos statt Babassu, Sonnenblumenöl High Oleic statt Oliven- und Avocadoöl.',
    profileId: 'body-sensitive',
    barWeight: 100,
    notes:
      'Rohstoffkosten ca. 30 % unter 3.0. Sonnenblumenöl unbedingt High Oleic (≥ 80 % Ölsäure), normales Sonnenblumenöl ist zu linolsäurereich. ' +
      'Arbeitstemperatur ca. 35–40 °C.',
    input: {
      totalFat: 1000,
      lyeType: 'NaOH',
      lyePurity: 100,
      superfat: 7,
      water: { mode: 'concentration', value: 33 },
      fats: [
        { fatId: 'sunflower-ho', percent: 35 },
        { fatId: 'shea', percent: 25 },
        { fatId: 'coconut', percent: 20 },
        { fatId: 'cocoa', percent: 15 },
        { fatId: 'castor', percent: 5 },
      ],
      additives: [citrate],
    },
  },
]
