import { describe, expect, it } from 'vitest'
import { effectiveMode } from './profile'

describe('Bedienmodus', () => {
  it('gewählter Modus gilt immer', () => {
    expect(effectiveMode('einsteiger', 12)).toBe('einsteiger')
    expect(effectiveMode('experte', 0)).toBe('experte')
  })
  it('ohne Wahl: Einsteiger ohne Chargen, Experte mit Chargen', () => {
    expect(effectiveMode(undefined, 0)).toBe('einsteiger')
    expect(effectiveMode(undefined, 3)).toBe('experte')
    expect(effectiveMode('quatsch', 0)).toBe('einsteiger')
  })
})
