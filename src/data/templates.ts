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
  {
    name: 'Haarseife 2.0',
    description: 'Nachfolger der Gemini-Haarseife: gleich hart und schäumend, aber ranzstabil und etwas milder.',
    profileId: 'hair-fine-long',
    barWeight: 80,
    notes:
      'Gegenüber 1.0: normales Distelöl (78 % Linolsäure) durch Sonnenblumenöl High Oleic ersetzt → Linol-/Linolensäure 25,6 % → 2,7 %. ' +
      'Babassu 40 → 32 % (Reinigung 28 → 22), Kakaobutter für Härte, Macadamia bleibt (Restbestand verbrauchen, seifentechnisch neutral). ' +
      'Brokkolisamenöl, Keratin, Seide weggelassen: in verseifter, abgespülter Form ohne belegte Wirkung. Saure Rinse wie gehabt.',
    input: {
      totalFat: 500,
      lyeType: 'NaOH',
      lyePurity: 100,
      superfat: 5,
      water: { mode: 'concentration', value: 33 },
      fats: [
        { fatId: 'sunflower-ho', percent: 33 },
        { fatId: 'babassu', percent: 32 },
        { fatId: 'castor', percent: 15 },
        { fatId: 'macadamia', percent: 10 },
        { fatId: 'cocoa', percent: 10 },
      ],
      additives: [citrate],
    },
  },
  {
    name: 'Haarseife 2.0 Spar',
    description: 'Wie 2.0, Kokos statt Babassu, Shea statt Macadamia.',
    profileId: 'hair-fine-long',
    barWeight: 80,
    notes: 'Rohstoffkosten ca. 12 €/kg Fett statt ca. 18 €. Sonnenblumenöl unbedingt High Oleic.',
    input: {
      totalFat: 500,
      lyeType: 'NaOH',
      lyePurity: 100,
      superfat: 5,
      water: { mode: 'concentration', value: 33 },
      fats: [
        { fatId: 'sunflower-ho', percent: 35 },
        { fatId: 'coconut', percent: 30 },
        { fatId: 'castor', percent: 15 },
        { fatId: 'cocoa', percent: 10 },
        { fatId: 'shea', percent: 10 },
      ],
      additives: [citrate],
    },
  },
  {
    name: 'Rasierseife 1.0',
    description: 'Für Pinsel und Tiegel: Stearinsäure-Basis, Mischlauge 50 % KOH, Glycerin. Unbeduftet für empfindliche Haut.',
    profileId: 'shave-brush',
    barWeight: 100,
    notes:
      'Empfohlen im Heißverfahren: Stearinsäure dickt im Kaltverfahren fast sofort an. Fette und Stearinsäure bei ca. 70 °C schmelzen, Lauge zugeben, ' +
      'im Wasserbad oder Slow Cooker 1–2 h garen, bis keine Lauge mehr nachweisbar ist (Zungentest). Dann Glycerin einrühren und warm in den Tiegel drücken. ' +
      'Deckel erst nach einigen Tagen bis Wochen schließen, wenn die Oberfläche trocken ist. ' +
      'Kein Duft: frisch rasierte Haut ist die empfindlichste Stelle für Duftstoff-Reizungen.',
    input: {
      totalFat: 400,
      lyeType: 'dual',
      lyePurity: 100,
      kohShare: 50,
      kohPurity: 90,
      superfat: 4,
      water: { mode: 'concentration', value: 30 },
      fats: [
        { fatId: 'stearic-acid', percent: 40 },
        { fatId: 'babassu', percent: 20 },
        { fatId: 'shea', percent: 20 },
        { fatId: 'castor', percent: 10 },
        { fatId: 'avocado', percent: 10 },
      ],
      additives: [
        { ...citrate, reason: 'Hartes Wasser verschlechtert Rasierschaum deutlich: Citrat bindet einen Teil von Ca/Mg.' },
        { additiveId: 'glycerin', percentOfFats: 7, reason: 'Weicher im Tiegel, leichter mit dem Pinsel aufzunehmen, gleitfähiger Schaum.' },
      ],
    },
  },
]
