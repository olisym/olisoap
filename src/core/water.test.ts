import { describe, expect, it } from 'vitest'
import { PROFILES_BY_ID } from '../data/profiles'
import { calculate } from './calc'
import { adjustCitrate, designedInput, designRecipe } from './designer'
import { evaluate } from './evaluate'
import type { RecipeInput } from './types'
import { citrateDose, dhToMmol, hardnessRange, mmolToDh } from './water'

const base: RecipeInput = {
  totalFat: 1000,
  lyeType: 'NaOH',
  lyePurity: 100,
  superfat: 6,
  water: { mode: 'concentration', value: 33 },
  fats: [
    { fatId: 'olive', percent: 70 },
    { fatId: 'coconut', percent: 30 },
  ],
  additives: [],
}
const withCitrate: RecipeInput = { ...base, additives: [{ additiveId: 'citric-anhydrous', percentOfFats: 1.5 }] }
const messages = (input: RecipeInput, waterHardness?: number) => evaluate(calculate(input), undefined, { waterHardness }).map((f) => f.message)

describe('Wasserhärte', () => {
  it('Härtebereiche nach WRMG und Umrechnung', () => {
    expect(hardnessRange(8.3)).toBe('soft')
    expect(hardnessRange(8.4)).toBe('medium')
    expect(hardnessRange(14)).toBe('medium')
    expect(hardnessRange(14.1)).toBe('hard')
    expect(mmolToDh(2.5)).toBeCloseTo(14)
    expect(dhToMmol(mmolToDh(1.7))).toBeCloseTo(1.7)
  })

  it('Faustregel steigt mit der Härte', () => {
    expect([5, 10, 16, 25].map(citrateDose)).toEqual([0, 1, 1.5, 2])
  })

  it('Gegenprobe: hartes Wasser ohne Komplexbildner → Hinweis mit Dosis, sonst still', () => {
    expect(messages(base, 16).some((m) => m.includes('16 °dH ist hart') && m.includes('1,5 % Zitronensäure'))).toBe(true)
    expect(messages(base, 10).some((m) => m.includes('mittelhart'))).toBe(true)
    expect(messages(withCitrate, 16).some((m) => m.includes('°dH'))).toBe(false)
    expect(messages(base).some((m) => m.includes('°dH'))).toBe(false)
  })

  it('Gegenprobe: weiches Wasser mit Citrat → Weglassen ist kein Fehler', () => {
    expect(messages(withCitrate, 6).some((m) => m.includes('weichem Wasser'))).toBe(true)
    expect(messages(base, 6).some((m) => m.includes('°dH'))).toBe(false)
  })

  it('Assistent passt die Zitronensäure der Grundseife an', () => {
    const citrate = () => [{ additiveId: 'citric-anhydrous', percentOfFats: 1.5, reason: 'x' }]
    expect(adjustCitrate(citrate(), 5, 16)[0].percentOfFats).toBe(1.5)
    expect(adjustCitrate(citrate(), 5, 25)[0]).toMatchObject({ percentOfFats: 2 })
    expect(adjustCitrate(citrate(), 5, 25)[0].reason).toContain('25 °dH')
    expect(adjustCitrate(citrate(), 5, 6)).toEqual([])
    // Weich, aber viel Linolsäure: Citrat bleibt wegen der Metallspuren
    expect(adjustCitrate(citrate(), 12, 6)[0].percentOfFats).toBe(1)
    expect(adjustCitrate(citrate(), 5)[0].percentOfFats).toBe(1.5)
  })

  it('Rezept aus dem Assistenten: Gegenprobe ohne Kalk-Hinweis, egal wie hart', () => {
    const profile = PROFILES_BY_ID['body-sensitive']
    const o = designRecipe({ profile, sliders: { strength: 0.5, lather: 0.5, hardness: 0.5, price: 0.5 }, process: 'cold', superfat: 7 })
    if (!o.ok) throw new Error(o.problem)
    for (const dH of [4, 11, 18, 26]) {
      const msgs = evaluate(calculate(designedInput(profile.id, o.result, 'cold', 7, 1000, dH)), profile, { waterHardness: dH }).map((f) => f.message)
      expect(msgs.some((m) => m.includes('Kalkseife'))).toBe(false)
    }
  })
})
