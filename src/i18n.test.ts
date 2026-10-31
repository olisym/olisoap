import { describe, expect, it } from 'vitest'
import i18n from './i18n'

describe('Übersetzung', () => {
  it('deutscher Text ist Schlüssel und Ergebnis, Platzhalter werden eingesetzt', () => {
    expect(i18n.t('Neu laden')).toBe('Neu laden')
    expect(i18n.t('Stand {{date}}', { date: '31.10. 01:30' })).toBe('Stand 31.10. 01:30')
    expect(i18n.t('Ziel: 30–35 %. Höher: schneller fest.')).toBe('Ziel: 30–35 %. Höher: schneller fest.')
  })
  it('Mehrzahl über defaultValue_one/_other', () => {
    const t = (count: number) => i18n.t('{{count}} Rezepte', { count, defaultValue_one: '{{count}} Rezept', defaultValue_other: '{{count}} Rezepte' })
    expect(t(1)).toBe('1 Rezept')
    expect(t(3)).toBe('3 Rezepte')
  })
})
