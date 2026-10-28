import { describe, expect, it } from 'vitest'
import { KOERPERSEIFE_2 } from '../data/seedRecipes'
import { calculate, sapValue } from './calc'
import { correct } from './correction'
import { evaluate } from './evaluate'
import type { RecipeInput } from './types'

const base: RecipeInput = {
  totalFat: 1000,
  lyeType: 'NaOH',
  lyePurity: 100,
  superfat: 0,
  water: { mode: 'percentOfFats', value: 30 },
  fats: [{ fatId: 'olive', percent: 100 }],
  additives: [],
}

describe('sapValue', () => {
  it('rechnet KOH- in NaOH-Verseifungszahl um', () => {
    // Olivenöl: 190 mg KOH/g → 0,1354 g NaOH/g (gängige Tabellenwerte: 0,135)
    expect(sapValue(190, 'NaOH')).toBeCloseTo(0.1354, 4)
    expect(sapValue(190, 'KOH')).toBeCloseTo(0.19, 4)
  })
})

describe('calculate', () => {
  it('100 % Olivenöl, 0 % ÜF', () => {
    const r = calculate(base)
    expect(r.lyeWeighed).toBeCloseTo(135.4, 1)
    expect(r.water).toBe(300)
  })

  it('Überfettung reduziert die Lauge linear', () => {
    expect(calculate({ ...base, superfat: 10 }).lyeWeighed).toBeCloseTo(135.4 * 0.9, 1)
  })

  it('Reinheit erhöht die Einwaage', () => {
    expect(calculate({ ...base, lyePurity: 90, lyeType: 'KOH' }).lyeWeighed).toBeCloseTo(190 / 0.9, 1)
  })

  it('Mischlauge: teilt in NaOH und KOH auf', () => {
    const r = calculate({ ...base, lyeType: 'dual', kohShare: 40, kohPurity: 90 })
    const naoh = r.lyeParts.find((p) => p.type === 'NaOH')!
    const koh = r.lyeParts.find((p) => p.type === 'KOH')!
    expect(naoh.weighed).toBeCloseTo(135.4 * 0.6, 1)
    expect(koh.weighed).toBeCloseTo((190 * 0.4) / 0.9, 1)
    expect(r.lyeWeighed).toBeCloseTo(naoh.weighed + koh.weighed, 6)
    // Korrektur: 5 % mehr Fett → 5 % mehr Mischlauge
    expect(correct(r, { fatGrams: [1050] }).addLye).toBeCloseTo(r.lyeWeighed * 0.05, 4)
  })

  it('Wassermodi', () => {
    const conc = calculate({ ...base, water: { mode: 'concentration', value: 33 } })
    expect(conc.lyeConcentration).toBeCloseTo(33, 6)
    const ratio = calculate({ ...base, water: { mode: 'ratio', value: 2 } })
    expect(ratio.water).toBeCloseTo(ratio.lyeWeighed * 2, 6)
  })

  it('Körperseife 2.0 stimmt mit dem Arbeitsblatt überein', () => {
    const r = calculate(KOERPERSEIFE_2.input)
    // Arbeitsblatt: 256 g für die Fette + 25 g für die Zitronensäure = 281 g. Tabellenwerte schwanken um ±1 %.
    expect(r.lyeForFats).toBeGreaterThan(253)
    expect(r.lyeForFats).toBeLessThan(259)
    expect(r.lyeForAdditives).toBeCloseTo(24.98, 1)
    expect(r.water).toBe(600)
    expect(r.properties.polyunsaturated).toBeLessThan(15)
  })
})

describe('correct', () => {
  const plan = calculate({ ...base, superfat: 5 })

  it('ohne Abweichung ist nichts zu tun', () => {
    const c = correct(plan, {})
    expect(c.addLye).toBeCloseTo(0, 6)
    expect(c.superfatActual).toBeCloseTo(5, 6)
  })

  it('zu viel Fett eingewogen → Lauge nachgeben', () => {
    const c = correct(plan, { fatGrams: [1050] })
    expect(c.addLye).toBeCloseTo(plan.lyeWeighed * 0.05, 4)
    expect(c.addWater).toBeCloseTo(c.addLye * (plan.water / plan.lyeWeighed), 4)
    expect(c.superfatActual).toBeGreaterThan(5)
  })

  it('zu viel Lauge eingewogen → Fett nachgeben', () => {
    const c = correct(plan, { lyeWeighed: plan.lyeWeighed * 1.02 })
    expect(c.superfatActual).toBeLessThan(5)
    expect(c.fatScale).toBeCloseTo(1.02, 6)
    expect(c.addFatGrams[0]).toBeCloseTo(20, 4)
  })

  it('Säure wird bei der Korrektur berücksichtigt', () => {
    const p = calculate(KOERPERSEIFE_2.input)
    const c = correct(p, {})
    expect(c.superfatActual).toBeCloseTo(10, 6)
  })
})

describe('evaluate', () => {
  it('meldet falsche Prozentsumme', () => {
    const r = calculate({ ...base, fats: [{ fatId: 'olive', percent: 90 }] })
    expect(evaluate(r).some((f) => f.severity === 'error')).toBe(true)
  })

  it('warnt bei hoher Überfettung mit vielen ungesättigten Fettsäuren', () => {
    const r = calculate({ ...base, superfat: 10, fats: [{ fatId: 'olive', percent: 50 }, { fatId: 'argan', percent: 50 }] })
    const msgs = evaluate(r).map((f) => f.message)
    expect(msgs.some((m) => m.includes('oxidationsanfällig'))).toBe(true)
    expect(msgs.some((m) => m.includes('Komplexbildner'))).toBe(true)
  })

  it('warnt bei hohem Linolsäureanteil', () => {
    const r = calculate({ ...base, fats: [{ fatId: 'sunflower', percent: 100 }] })
    expect(evaluate(r).some((f) => f.message.includes('Linol'))).toBe(true)
  })
})
