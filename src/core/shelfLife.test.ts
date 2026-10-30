import { describe, expect, it } from 'vitest'
import { shelfLifeCap, shelfMonths } from './shelfLife'

describe('Haltbarkeit (Faustregel)', () => {
  it('stabile Fette halten länger als linolsäurereiche', () => {
    expect(shelfMonths('fat:coconut')).toBeGreaterThan(shelfMonths('fat:avocado')!)
    expect(shelfMonths('fat:avocado')).toBeGreaterThan(shelfMonths('fat:hemp')!)
    expect(shelfMonths('lye:NaOH')).toBeUndefined()
  })
  it('begrenzt die Packung auf das, was man in der Haltbarkeit verbraucht', () => {
    const hemp = shelfLifeCap('fat:hemp', 100)!
    expect(hemp).toBeLessThan(shelfLifeCap('fat:coconut', 100)!)
    expect(hemp).toBeGreaterThanOrEqual(100)
    expect(shelfLifeCap('lye:NaOH', 300)).toBeUndefined()
  })
})
