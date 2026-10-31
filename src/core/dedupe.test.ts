import { describe, expect, it } from 'vitest'
import { findDuplicateRecipes } from './dedupe'

const input = { totalFat: 1000, fats: [{ fatId: 'olive', percent: 100 }] }

describe('Doppelte Rezepte', () => {
  it('entfernt unveränderte Doppel samt Varianten und hängt Verweise um', () => {
    const recipes = [
      { id: 'b', name: 'Körperseife', input, createdAt: '2026-10-01', updatedAt: '2026-10-01' },
      { id: 'a', name: 'Körperseife', input, createdAt: '2026-10-20', updatedAt: '2026-10-20' },
      { id: 'bv', name: 'Körperseife Spar', input, baseId: 'b' },
      { id: 'av', name: 'Körperseife Spar', input, baseId: 'a' },
    ]
    // Grundseifen gleichauf → kleinste Kennung a bleibt; die Variante bv hat eine Charge und bleibt (hängt dann an a).
    const d = findDuplicateRecipes(recipes, ['bv'])
    expect(d.remove.sort()).toEqual(['av', 'b'])
    expect(d.replace.get('b')).toBe('a')
    expect(d.replace.get('av')).toBe('bv')
  })

  it('lässt geänderte Rezepte in Ruhe', () => {
    const recipes = [
      { id: 'a', name: 'Körperseife', input },
      { id: 'b', name: 'Körperseife', input: { ...input, totalFat: 2000 } },
    ]
    expect(findDuplicateRecipes(recipes, []).remove).toEqual([])
  })

  it('bevorzugt Vorlagen mit fester Kennung', () => {
    const recipes = [
      { id: '0abc', name: 'Haarseife', input },
      { id: 'vorlage-haarseife', name: 'Haarseife', input },
    ]
    expect(findDuplicateRecipes(recipes, ['0abc']).remove).toEqual(['0abc'])
  })
})

describe('Unberührte Vorlagen', () => {
  const T = '2026-01-01T00:00:00.000Z'
  it('weichen einem gleichnamigen Rezept, auch wenn der Inhalt abweicht; Varianten und Chargen werden umgehängt', () => {
    const recipes = [
      { id: 'vorlage-koerperseife', name: 'Körperseife', input, createdAt: T, updatedAt: T },
      { id: 'vorlage-koerperseife-spar', name: 'Körperseife Spar', input, baseId: 'vorlage-koerperseife', createdAt: T, updatedAt: T },
      { id: 'u1', name: 'Körperseife', input: { ...input, totalFat: 2000 }, updatedAt: '2026-09-01' },
      { id: 'u2', name: 'Körperseife Spar', input: { ...input, totalFat: 1500 }, baseId: 'u1', updatedAt: '2026-09-01' },
      { id: 'mine', name: 'Meine Variante', input, baseId: 'vorlage-koerperseife', updatedAt: '2026-10-01' },
    ]
    const d = findDuplicateRecipes(recipes, ['vorlage-koerperseife'])
    expect(d.remove.sort()).toEqual(['vorlage-koerperseife', 'vorlage-koerperseife-spar'])
    expect(d.replace.get('vorlage-koerperseife')).toBe('u1')
  })

  it('bearbeitete Vorlagen und Vorlagen ohne Namensgleichen bleiben', () => {
    const recipes = [
      { id: 'vorlage-haarseife', name: 'Haarseife', input, updatedAt: '2026-10-30' },
      { id: 'x', name: 'Haarseife', input: { ...input, totalFat: 2 } },
      { id: 'vorlage-rasierseife', name: 'Rasierseife', input, createdAt: T, updatedAt: T },
    ]
    expect(findDuplicateRecipes(recipes, []).remove).toEqual([])
  })

  it('löst Ketten auf: niemand zeigt auf ein gelöschtes Rezept', () => {
    const recipes = [
      { id: 'vorlage-koerperseife', name: 'Körperseife', input, createdAt: T, updatedAt: T },
      { id: 'b', name: 'Körperseife', input, updatedAt: '2026-01-02' },
      { id: 'a', name: 'Körperseife', input, updatedAt: '2026-01-02' },
    ]
    const d = findDuplicateRecipes(recipes, [])
    for (const to of d.replace.values()) expect(d.remove).not.toContain(to)
  })
})
