import { describe, expect, it } from 'vitest'
import { FATS_BY_ID } from '../data/fats'
import { customFatId, deriveFat } from './customFat'

const olive = FATS_BY_ID.olive

describe('Eigene Fette', () => {
  it('Etikett gleich dem Durchschnitt: Profil bleibt (fast) gleich', () => {
    // Olivenöl in der Tabelle: 16 % gesättigt, 71 % einfach, 11 % mehrfach ungesättigt (Summe 98)
    const f = deriveFat(olive, { id: 'eigen-x', baseId: 'olive', name: 'X', label: { saturated: 16, mono: 71, poly: 11 } })
    expect(f.fattyAcids.oleic).toBeCloseTo(71, 0)
    expect(f.fattyAcids.linoleic).toBeCloseTo(10, 0)
    expect(f.iodine).toBe(olive.iodine)
    expect(f.sapKoh).toBe(olive.sapKoh)
    expect(f.inci).toEqual(olive.inci)
  })

  it('mehr mehrfach ungesättigte laut Etikett: mehr Linolsäure, höhere Jodzahl, Verhältnis in der Gruppe bleibt', () => {
    const f = deriveFat(olive, { id: 'eigen-x', baseId: 'olive', name: 'Olivenöl (Supermarkt)', label: { saturated: 14, mono: 68, poly: 18 } })
    const poly = (f.fattyAcids.linoleic ?? 0) + (f.fattyAcids.linolenic ?? 0)
    expect(poly).toBeCloseTo(18 * 0.98, 0)
    expect((f.fattyAcids.linoleic ?? 0) / (f.fattyAcids.linolenic ?? 1)).toBeCloseTo(10, 0)
    expect(f.iodine).toBeGreaterThan(olive.iodine)
    expect(f.name).toBe('Olivenöl (Supermarkt)')
  })

  it('Gruppe, die das Basisfett nicht hat, landet bei der typischen Fettsäure', () => {
    const f = deriveFat(FATS_BY_ID['stearic-acid'], { id: 'eigen-y', baseId: 'stearic-acid', name: 'Y', label: { saturated: 95, mono: 5, poly: 0 } })
    expect(f.fattyAcids.oleic).toBeGreaterThan(0)
  })

  it('unbrauchbare Werte: Basisprofil bleibt', () => {
    const f = deriveFat(olive, { id: 'eigen-z', baseId: 'olive', name: 'Z', label: { saturated: 0, mono: 0, poly: 0 } })
    expect(f.fattyAcids).toEqual(olive.fattyAcids)
  })

  it('Kennung kurz, ohne Umlaute', () => {
    expect(customFatId('Olivenöl nativ extra (Aldi Süd)')).toBe('eigen-olivenoel-nativ-extra-aldi-sued')
    expect(customFatId('x'.repeat(200)).length).toBeLessThanOrEqual(100)
  })
})
