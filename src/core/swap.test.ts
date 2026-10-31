import { afterEach, describe, expect, it } from 'vitest'
import { PROFILES_BY_ID } from '../data/profiles'
import { setCustomFats } from '../data/fats'
import { TEMPLATES } from '../data/templates'
import type { RecipeInput } from './types'
import { fatDistance, swapSuggestions } from './swap'

const body = TEMPLATES[0].base.input as RecipeInput // Körperseife: Shea, Oliven, Babassu, Kakao, Rizinus, Avocado
const profile = PROFILES_BY_ID['body-sensitive']
const prices: Record<string, number> = { shea: 14, olive: 9, babassu: 18, cocoa: 22, castor: 9, avocado: 16, coconut: 7, mango: 20, 'sunflower-ho': 4 }
const priceOf = (id: string) => prices[id]

afterEach(() => setCustomFats([]))

describe('Fette tauschen', () => {
  it('ähnliche Fette sind nah, unähnliche fern', () => {
    expect(fatDistance('babassu', 'coconut')).toBeLessThan(15)
    expect(fatDistance('shea', 'mango')).toBeLessThan(15)
    expect(fatDistance('olive', 'castor')).toBeGreaterThan(60)
    expect(fatDistance('olive', 'hemp')).toBeGreaterThan(30)
  })

  it('schlägt Kokos statt Babassu vor: deutlich günstiger, Gegenprobe bleibt', () => {
    const s = swapSuggestions(body, profile, priceOf)
    const coconut = s.find((x) => x.fromId === 'babassu' && x.toId === 'coconut')
    expect(coconut).toBeDefined()
    expect(coconut!.saving).toBeCloseTo((18 - 7) * 0.18, 5)
    expect(s.every((x) => x.saving >= 0.3)).toBe(true)
    // Sortiert nach Ersparnis
    expect(s.map((x) => x.saving)).toEqual([...s.map((x) => x.saving)].sort((a, b) => b - a))
  })

  it('nichts ohne Preis, nichts unter 30 Cent, nichts, was schon im Rezept ist', () => {
    expect(swapSuggestions(body, profile, () => undefined)).toEqual([])
    const tight = swapSuggestions({ ...body, totalFat: 50 }, profile, priceOf)
    expect(tight).toEqual([])
    expect(swapSuggestions(body, profile, priceOf).some((x) => body.fats.some((f) => f.fatId === x.toId))).toBe(false)
  })

  it('gleiches Fett aus anderer Quelle: eigenes „Olivenöl (Aldi)“, auch wenn es etwas anders zusammengesetzt ist', () => {
    setCustomFats([{ id: 'eigen-olivenoel-aldi', baseId: 'olive', name: 'Olivenöl (Aldi)', label: { saturated: 14, mono: 74, poly: 9 } }])
    const s = swapSuggestions(body, profile, (id) => (id === 'eigen-olivenoel-aldi' ? 5.5 : priceOf(id)))
    const aldi = s.find((x) => x.toId === 'eigen-olivenoel-aldi')
    expect(aldi).toMatchObject({ fromId: 'olive', sameFat: true })
  })

  it('kein Tausch, der die Gegenprobe verschlechtert', () => {
    // Normales Sonnenblumenöl (viel Linolsäure) statt Olivenöl wäre billig, reißt aber die Grenze für Linolsäure
    const s = swapSuggestions(body, profile, (id) => (id === 'sunflower' ? 2 : priceOf(id)))
    expect(s.some((x) => x.toId === 'sunflower')).toBe(false)
  })
})
