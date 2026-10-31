import { describe, expect, it } from 'vitest'
import { TEMPLATES } from '../data/templates'
import { calculate } from './calc'
import { buildGuide } from './guide'
import type { RecipeInput } from './types'

const byName = (name: string) => [...TEMPLATES.flatMap((f) => [f.base, ...f.variants])].find((t) => t.name === name)!.input as RecipeInput
const kinds = (input: RecipeInput, usage?: 'acidRinse' | 'brush') => buildGuide(calculate(input), usage).steps.map((s) => s.kind)

describe('Anleitung', () => {
  it('Kaltverfahren: Reihenfolge von Sicherheit bis Reifen', () => {
    expect(kinds(byName('Körperseife'))).toEqual(['equipment', 'safety', 'weigh', 'lye', 'fats', 'temperature', 'blend', 'mold', 'firstDays', 'cure', 'cleanup'])
  })

  it('Heißverfahren: Kochen und „Nach dem Kochen“ statt Form direkt nach der Spur, keine Temperatur-Abstimmung', () => {
    const k = kinds(byName('Körperseife heiß'))
    expect(k).toContain('cook')
    expect(k.indexOf('afterCook')).toBe(k.indexOf('cook') + 1)
    expect(k).not.toContain('temperature')
    expect(k).not.toContain('mold')
  })

  it('Überfettungsöl bei heiß erst nach dem Kochen, nicht bei den Fetten', () => {
    const g = buildGuide(calculate(byName('Körperseife heiß')))
    const fats = g.steps.find((s) => s.kind === 'fats')!.items.map((i) => i.key)
    const after = g.steps.find((s) => s.kind === 'afterCook')!.items.map((i) => i.key)
    expect(fats).not.toContain('fat:avocado')
    expect(after).toContain('fat:avocado')
  })

  it('Säure zuerst ins Wasser: Zitronensäure steht vor der Lauge', () => {
    const lye = buildGuide(calculate(byName('Körperseife'))).steps.find((s) => s.kind === 'lye')!.items.map((i) => i.key)
    expect(lye.indexOf('add:citric-anhydrous')).toBeGreaterThan(lye.indexOf('water'))
    expect(lye.indexOf('add:citric-anhydrous')).toBeLessThan(lye.indexOf('lye:NaOH'))
  })

  it('Abwiegen enthält jede Zutat genau einmal mit der Menge aus der Rechnung', () => {
    const r = calculate(byName('Rasierseife'))
    const weigh = buildGuide(r).steps.find((s) => s.kind === 'weigh')!.items
    expect(new Set(weigh.map((i) => i.key)).size).toBe(weigh.length)
    expect(weigh.length).toBe(1 + r.lyeParts.length + r.fats.length + r.additives.length)
    // Mischlauge: zwei Laugen, keine Korrektur über das Ist-Gewicht
    expect(weigh.filter((i) => i.key.startsWith('lye:')).every((i) => !i.editable)).toBe(true)
  })

  it('Besonderheiten: Tiegel, Stearinsäure, viel Butter, Feinwaage, Benutzung', () => {
    const shave = buildGuide(calculate(byName('Rasierseife')), 'brush')
    expect(shave).toMatchObject({ tub: true, stearic: true, hot: true, lyes: ['NaOH', 'KOH'], usage: 'brush' })
    expect(shave.steps.at(-1)!.kind).toBe('use')
    const body = buildGuide(calculate(byName('Körperseife')))
    expect(body.butterRich).toBe(true)
    expect(body.solidFats).toContain('Sheabutter')
    expect(body.tub).toBe(false)
    const hair = buildGuide(calculate({ ...byName('Haarseife'), totalFat: 300 }), 'acidRinse')
    expect(hair.fineScale).toBe(true)
    expect(hair.usage).toBe('acidRinse')
  })
})
