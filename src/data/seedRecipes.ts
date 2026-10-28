import type { Recipe } from '../db'

// Körperseife 2.0 nach Olivers Arbeitsblatt (2.000 g GFM). Dient zugleich als Referenz für die Tests.
export const KOERPERSEIFE_2: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'> = {
  name: 'Körperseife 2.0',
  description:
    'Ranzstabile Dusch- und Körperseife mit Kaolin, grünem Avocadoöl und Zitronensäure gegen Kalkseife.',
  profileId: 'body-sensitive',
  notes: 'Arbeitstemperatur 28–32 °C. Avocadoöl mit Kaolin zur Paste verrühren und in der leichten Spur zugeben.',
  input: {
    totalFat: 2000,
    lyeType: 'NaOH',
    lyePurity: 100,
    superfat: 10,
    water: { mode: 'percentOfFats', value: 30 },
    fats: [
      { fatId: 'shea', percent: 35 },
      { fatId: 'babassu', percent: 25 },
      { fatId: 'almond', percent: 25 },
      { fatId: 'castor', percent: 5 },
      { fatId: 'avocado', percent: 10 },
    ],
    additives: [
      { additiveId: 'citric-anhydrous', percentOfFats: 2, reason: 'Hartes Wasser: Natriumcitrat gegen Kalkseife.' },
      { additiveId: 'sodium-lactate-60', percentOfFats: 2, reason: 'Früher ausformen und schneiden.' },
      { additiveId: 'kaolin', percentOfFats: 2 },
      { additiveId: 'silk-protein', percentOfFats: 2 },
    ],
  },
}
