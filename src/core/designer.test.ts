import { describe, expect, it } from 'vitest'
import { PROFILES, PROFILES_BY_ID } from '../data/profiles'
import { calculate } from './calc'
import { designedInput, designRecipe, projectSum, templateFor, type DesignRequest, type Sliders } from './designer'
import { evaluate } from './evaluate'

const MID: Sliders = { strength: 0.5, lather: 0.5, hardness: 0.5, price: 0.5 }
const CORNERS: Sliders[] = [MID, { strength: 0, lather: 0, hardness: 0, price: 0 }, { strength: 1, lather: 1, hardness: 1, price: 1 }, { strength: 0, lather: 1, hardness: 1, price: 0 }]
// Erfundene, grob realistische Preise in €/kg
const PRICES = { olive: 9, 'sunflower-ho': 4, 'rice-bran': 8, avocado: 16, macadamia: 22, almond: 14, shea: 14, cocoa: 22, mango: 20, babassu: 18, coconut: 7, castor: 9, 'stearic-acid': 8 }
const LAURIC = ['coconut', 'babassu', 'palm-kernel']

function run(profileId: string, patch: Partial<DesignRequest> = {}) {
  const profile = PROFILES_BY_ID[profileId]
  const o = designRecipe({ profile, sliders: MID, process: profile.design?.process ?? 'cold', superfat: templateFor(profileId)!.input.superfat, prices: PRICES, ...patch })
  if (!o.ok) throw new Error(o.problem)
  return o.result
}

describe('Rezept-Assistent', () => {
  it('jede Seifenart: gültige Mischung, wenige Fette, Gegenprobe ohne Warnung', () => {
    for (const profile of PROFILES) {
      const r = run(profile.id)
      expect(r.fats.reduce((s, f) => s + f.percent, 0)).toBe(100)
      expect(r.fats.length).toBeLessThanOrEqual(5)
      expect(r.fats.every((f) => Number.isInteger(f.percent) && f.percent >= 4)).toBe(true)
      const input = designedInput(profile.id, r, profile.design?.process ?? 'cold', templateFor(profile.id)!.input.superfat, 1000)
      expect(input.lyeType).toBe(templateFor(profile.id)!.input.lyeType)
      const findings = evaluate(calculate(input), profile).filter((f) => f.severity !== 'info')
      expect(findings, `${profile.id}: ${findings.map((f) => f.message).join(' | ')}`).toEqual([])
    }
  })

  it('harte Grenzen gelten bei jeder Reglerstellung', () => {
    for (const profile of PROFILES)
      for (const sliders of CORNERS) {
        const r = run(profile.id, { sliders })
        const lauric = r.fats.filter((f) => LAURIC.includes(f.fatId)).reduce((s, f) => s + f.percent, 0)
        expect(lauric).toBeLessThanOrEqual(profile.design!.lauricMax)
        expect(r.properties.polyunsaturated).toBeLessThanOrEqual(profile.properties.polyunsaturated!.max!)
        for (const f of r.fats) expect(f.percent).toBeLessThanOrEqual(profile.design!.fats[f.fatId])
      }
  })

  it('Regler wirken in die richtige Richtung', () => {
    for (const id of ['body-sensitive', 'hair-fine-long']) {
      expect(run(id, { sliders: { ...MID, strength: 1 } }).properties.cleansing).toBeGreaterThan(run(id, { sliders: { ...MID, strength: 0 } }).properties.cleansing)
      // Cremig ↔ großblasig ist ein Verhältnis: bei Körperseife begrenzt die Laurinsäure den großblasigen Schaum
      const balance = (lather: number) => {
        const p = run(id, { sliders: { ...MID, lather } }).properties
        return p.bubbly - p.creamy
      }
      expect(balance(1)).toBeGreaterThan(balance(0))
      expect(run(id, { sliders: { ...MID, price: 0 } }).costPerKg!).toBeLessThan(run(id, { sliders: { ...MID, price: 1 } }).costPerKg!)
    }
  })

  it('Ausschlüsse, Vorrat und Lieblingsöl', () => {
    expect(run('body-sensitive', { excluded: ['olive', 'babassu'] }).fats.some((f) => ['olive', 'babassu'].includes(f.fatId))).toBe(false)
    const stock = new Set(['olive', 'shea', 'coconut', 'castor', 'cocoa'])
    expect(run('body-sensitive', { available: stock }).fats.every((f) => stock.has(f.fatId))).toBe(true)
    const fav = run('body-sensitive', { favorite: 'avocado' })
    expect(fav.fats.find((f) => f.fatId === 'avocado')!.percent).toBeGreaterThanOrEqual(10)
    expect(fav.reasons.find((r) => r.fatId === 'avocado')!.favorite).toBe(true)
    // Lieblingsöl außerhalb der bevorzugten Fette ist erlaubt
    expect(run('body-sensitive', { favorite: 'lard' }).fats.some((f) => f.fatId === 'lard')).toBe(true)
  })

  it('Rasierseife kalt: Gegenprobe warnt vor der Stearinsäure', () => {
    const r = run('shave-brush', { process: 'cold' })
    const msgs = evaluate(calculate(designedInput('shave-brush', r, 'cold', 4, 400)), PROFILES_BY_ID['shave-brush']).map((f) => f.message)
    expect(msgs.some((m) => m.includes('Stearinsäure') && m.includes('Kaltverfahren'))).toBe(true)
  })

  it('zu wenig Fette: klare Meldung statt Unsinn', () => {
    const o = designRecipe({ profile: PROFILES_BY_ID['body-sensitive'], sliders: MID, process: 'cold', superfat: 7, available: new Set(['castor', 'cocoa']) })
    expect(o).toEqual({ ok: false, problem: 'tooFewFats' })
  })

  it('Heißverseifung: Überfettungsöl nach dem Kochen in Höhe der Überfettung, Gegenprobe ohne Fehler', () => {
    for (const profile of PROFILES) {
      const superfat = templateFor(profile.id)!.input.superfat
      const r = run(profile.id, { process: 'hot' })
      const after = r.fats.filter((f) => f.afterCook)
      expect(after).toHaveLength(1)
      expect(after[0].percent).toBe(Math.round(superfat))
      const input = designedInput(profile.id, r, 'hot', superfat, 1000)
      expect(input.process).toBe('hot')
      expect(input.water).toEqual({ mode: 'concentration', value: 30 })
      expect(evaluate(calculate(input), profile).filter((f) => f.severity === 'error')).toEqual([])
    }
  })

  it('Begründung: Rolle je Fett, Grenze erkannt', () => {
    const r = run('body-sensitive')
    const shea = r.reasons.find((x) => x.fatId === 'shea')
    if (shea) expect(shea.roles).toContain('hardness')
    const lauric = r.reasons.find((x) => LAURIC.includes(x.fatId))
    if (lauric) {
      expect(lauric.roles).toContain('cleansing')
      if (r.fats.filter((f) => LAURIC.includes(f.fatId)).reduce((s, f) => s + f.percent, 0) === 18) expect(lauric.capped).toBe(true)
    }
  })

  it('Projektion: exakt wie Halbierung, Grenzen und Summe stimmen (Zufallsfälle)', () => {
    let seed = 7
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let n = 0; n < 300; n++) {
      const size = 2 + Math.floor(rnd() * 12)
      const idx = [...Array(size).keys()]
      const lb = idx.map(() => (rnd() < 0.2 ? Math.round(rnd() * 8) : 0))
      const ub = idx.map((i) => lb[i] + Math.round(rnd() * 40))
      const lo = lb.reduce((a, b) => a + b, 0)
      const hi = ub.reduce((a, b) => a + b, 0)
      const total = lo + rnd() * (hi - lo)
      const y = idx.map(() => rnd() * 120 - 30)
      const out = idx.map(() => 0)
      projectSum(y, lb, ub, idx, total, out)
      expect(out.reduce((a, b) => a + b, 0)).toBeCloseTo(total, 6)
      out.forEach((v, i) => expect(v >= lb[i] - 1e-9 && v <= ub[i] + 1e-9).toBe(true))
      // Vergleich mit Halbierung über τ
      let a = -1e4
      let b = 1e4
      for (let k = 0; k < 200; k++) {
        const m = (a + b) / 2
        const sum = idx.reduce((s, i) => s + Math.min(ub[i], Math.max(lb[i], y[i] - m)), 0)
        if (sum > total) a = m
        else b = m
      }
      idx.forEach((i) => expect(out[i]).toBeCloseTo(Math.min(ub[i], Math.max(lb[i], y[i] - (a + b) / 2)), 5))
    }
  })
})
