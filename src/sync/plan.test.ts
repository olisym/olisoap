import { describe, expect, it } from 'vitest'
import { decryptJson, deriveKeys, encryptJson } from './crypto'
import { planSync } from './plan'

describe('Abgleich', () => {
  const known = new Map([
    ['recipes/a', 'h1'],
    ['recipes/b', 'h2'],
    ['recipes/c', 'h3'],
  ])

  it('erkennt lokale Änderungen, Löschungen und übernimmt fremde Änderungen', () => {
    const local = [
      { key: 'recipes/a', hash: 'h1', value: 'A' }, // unverändert
      { key: 'recipes/b', hash: 'h2x', value: 'B2' }, // lokal geändert
      { key: 'recipes/d', hash: 'h4', value: 'D' }, // neu
      // c lokal gelöscht
    ]
    const remote = [
      { key: 'recipes/a', deleted: false, value: 'A-remote', hash: 'h1r' },
      { key: 'recipes/e', deleted: false, value: 'E', hash: 'h5' },
    ]
    const p = planSync(local, known, remote)
    expect(p.apply.map((r) => r.key)).toEqual(['recipes/a', 'recipes/e'])
    expect(p.push).toEqual([
      { key: 'recipes/b', deleted: false, value: 'B2', hash: 'h2x' },
      { key: 'recipes/d', deleted: false, value: 'D', hash: 'h4' },
      { key: 'recipes/c', deleted: true },
    ])
    expect(p.conflicts).toBe(0)
  })

  it('bei gleichzeitiger Änderung gewinnt die lokale Fassung', () => {
    const p = planSync([{ key: 'recipes/b', hash: 'local', value: 'L' }], known, [{ key: 'recipes/b', deleted: false, value: 'R', hash: 'remote' }])
    expect(p.apply).toEqual([])
    expect(p.push.map((x) => x.key)).toContain('recipes/b')
    expect(p.conflicts).toBe(1)
  })

  it('frisches Gerät: unberührte Vorlage überschreibt nie den Server', () => {
    const T = '2026-01-01T00:00:00.000Z'
    const pristine = { id: 'vorlage-koerperseife', updatedAt: T }
    const edited = { id: 'vorlage-koerperseife', updatedAt: '2026-10-20' }
    // Frisches Gerät kennt noch keine Hashes: alles gilt als lokal neu
    const fresh = planSync([{ key: 'recipes/vorlage-koerperseife', hash: 'tpl', value: pristine }], new Map(), [
      { key: 'recipes/vorlage-koerperseife', deleted: false, value: edited, hash: 'srv' },
    ])
    expect(fresh.apply.map((r) => r.value)).toEqual([edited])
    expect(fresh.push).toEqual([])
    expect(fresh.conflicts).toBe(0)
    // Ohne Gegenstück auf dem Server wird die Vorlage wie bisher hochgeladen
    expect(planSync([{ key: 'recipes/vorlage-haarseife', hash: 'x', value: { id: 'vorlage-haarseife', updatedAt: T } }], new Map(), []).push).toHaveLength(1)
  })
})

describe('Verschlüsselung', () => {
  it('verschlüsselt und entschlüsselt, Anmeldewert ist reproduzierbar', async () => {
    const k1 = await deriveKeys('Oli', 'eine lange passphrase')
    const k2 = await deriveKeys('oli ', 'eine lange passphrase')
    expect(k1.auth).toMatch(/^[0-9a-f]{64}$/)
    expect(k2.auth).toBe(k1.auth)
    const ct = await encryptJson(k1.key, { name: 'Körperseife', n: 1 })
    expect(ct).not.toContain('Körperseife')
    expect(await decryptJson(k2.key, ct)).toEqual({ name: 'Körperseife', n: 1 })
    const other = await deriveKeys('oli', 'falsch')
    await expect(decryptJson(other.key, ct)).rejects.toThrow()
  })
})
