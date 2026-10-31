import { describe, expect, it } from 'vitest'
import { calculate } from './calc'
import { soapIngredients, suggestBestUse } from './label'
import type { RecipeInput } from './types'

const input: RecipeInput = {
  totalFat: 1000,
  lyeType: 'NaOH',
  lyePurity: 100,
  superfat: 7,
  water: { mode: 'concentration', value: 33 },
  fats: [
    { fatId: 'olive', percent: 60 },
    { fatId: 'coconut', percent: 30 },
    { fatId: 'beeswax', percent: 10 },
  ],
  additives: [{ additiveId: 'citric-anhydrous', percentOfFats: 1.5 }],
}

describe('Etikett', () => {
  it('listet Verseifungsprodukte, Überfettung, Wasser und Zusätze absteigend', () => {
    const list = soapIngredients(calculate(input))
    expect(list.map((i) => i.inci).slice(0, 2)).toEqual(['Sodium Olivate', 'Sodium Cocoate'])
    expect(list.find((i) => i.inci === 'Cera Alba')?.grams).toBe(100)
    expect(list.some((i) => i.inci === 'Olea Europaea Fruit Oil')).toBe(true)
    expect(list.at(-1)?.inci).toBe('Sodium Citrate')
    for (let i = 1; i < list.length; i++) expect(list[i - 1].grams).toBeGreaterThanOrEqual(list[i].grams)
  })

  it('Mischlauge erzeugt Natrium- und Kaliumseifen', () => {
    const list = soapIngredients(calculate({ ...input, lyeType: 'dual', kohShare: 50, kohPurity: 90 }))
    expect(list.some((i) => i.inci === 'Potassium Olivate')).toBe(true)
    expect(list.some((i) => i.inci === 'Sodium Olivate')).toBe(true)
  })

  it('Haltbarkeits-Vorschlag', () => {
    expect(suggestBestUse('2026-10-24', 5)).toBe('2028-10-23')
    expect(suggestBestUse('2026-10-24', 12)).toBe('2027-10-24')
    // Mehr freies Fett mit Linolsäure: kürzer; wenig Linolsäure: Überfettung egal
    expect(suggestBestUse('2026-10-24', 12, 8) < suggestBestUse('2026-10-24', 12, 5)).toBe(true)
    expect(suggestBestUse('2026-10-24', 18, 5) < suggestBestUse('2026-10-24', 12, 5)).toBe(true)
    expect(suggestBestUse('2026-10-24', 5, 12)).toBe(suggestBestUse('2026-10-24', 5, 0))
  })
})
