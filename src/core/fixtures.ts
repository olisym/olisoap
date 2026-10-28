import type { RecipeInput } from './types'

// Referenzrezept für die Tests: ein handgerechnetes Arbeitsblatt (2.000 g GFM, 10 % ÜF, 600 g Wasser,
// 256 g NaOH für die Fette + 25 g für 40 g Zitronensäure).
export const REFERENCE_2000G: RecipeInput = {
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
}
