import { describe, expect, it } from 'vitest'
import { batchTasks, type BatchState } from './tasks'

const base: BatchState = { id: 'b', name: 'Körperseife', number: '261024-1', date: '2026-10-24', readyDate: '2026-11-28', tub: false, weighings: [], barsLeft: 14 }

describe('Aufgaben aus dem Chargenstand', () => {
  it('Schneiden ist ab dem Tag nach dem Sieden fällig', () => {
    expect(batchTasks(base, '2026-10-24')).toEqual([])
    expect(batchTasks(base, '2026-10-25').map((t) => t.kind)).toEqual(['cut'])
  })

  it('nach dem Schneiden wöchentlich wiegen', () => {
    const cut = { ...base, unmoldedAt: '2026-10-25', weighings: [{ date: '2026-10-25', grams: 110 }] }
    expect(batchTasks(cut, '2026-10-30')).toEqual([])
    expect(batchTasks(cut, '2026-11-01').map((t) => t.kind)).toEqual(['weigh'])
  })

  it('reif und stabil: prüfen, dann etikettieren', () => {
    const ripe = {
      ...base,
      unmoldedAt: '2026-10-25',
      weighings: [
        { date: '2026-11-14', grams: 100 },
        { date: '2026-11-21', grams: 99.8 },
      ],
    }
    expect(batchTasks(ripe, '2026-11-28').map((t) => t.kind)).toEqual(['test'])
    expect(batchTasks({ ...ripe, tested: true }, '2026-11-28').map((t) => t.kind)).toEqual(['label'])
    expect(batchTasks({ ...ripe, tested: true, labeledAt: '2026-11-28' }, '2026-11-28')).toEqual([])
  })

  it('Tiegelware wird nicht geschnitten, aufgebrauchte Chargen haben keine Aufgaben', () => {
    expect(batchTasks({ ...base, tub: true }, '2026-10-26').map((t) => t.kind)).toEqual(['weigh'])
    expect(batchTasks({ ...base, barsLeft: 0 }, '2026-10-26')).toEqual([])
  })
})
