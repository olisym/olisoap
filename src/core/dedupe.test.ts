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
