import { describe, expect, it } from 'vitest'
import { versionAdvice } from './version'

describe('Versionsprüfung', () => {
  it('erkennt, was zu tun ist', () => {
    expect(versionAdvice({ running: 'aaaaaaa', server: 'aaaaaaa', latest: 'aaaaaaa' })).toBe('current')
    expect(versionAdvice({ running: 'aaaaaaa', server: 'bbbbbbb', latest: 'bbbbbbb' })).toBe('reload')
    expect(versionAdvice({ running: 'aaaaaaa', server: 'aaaaaaa', latest: 'ccccccc' })).toBe('serverBehind')
    expect(versionAdvice({ running: 'aaaaaaa', server: 'aaaaaaa' })).toBe('current')
    expect(versionAdvice({ running: 'aaaaaaa' })).toBe('unknown')
    expect(versionAdvice({ running: 'lokal', server: 'bbbbbbb' })).toBe('unknown')
  })
})
