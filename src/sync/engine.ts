import Dexie, { type EntityTable } from 'dexie'
import { db } from '../db'
import { decryptJson, deriveKeys, encryptJson, hashString } from './crypto'
import { planSync, type LocalRecord, type RemoteChange } from './plan'

// Synchronisation mit der eigenen Sync-API. Zugangsdaten und Abgleichstand liegen in einer eigenen Datenbank,
// die selbst nie synchronisiert wird.

/** Tabellen, die zwischen Geräten abgeglichen werden, mit ihrem Primärschlüssel. */
const SYNCED: Record<string, string> = {
  recipes: 'id',
  products: 'id',
  purchases: 'id',
  lots: 'id',
  batches: 'id',
  orderItems: 'id',
  settings: 'key',
}

interface Account {
  id: 'account'
  server: string
  user: string
  auth: string
  key: CryptoKey
  token: string
  lastSeq: number
  lastSync?: string
}

const local = new Dexie('olisoap-sync') as Dexie & {
  state: EntityTable<Account, 'id'>
  hashes: EntityTable<{ key: string; hash: string }, 'key'>
}
local.version(1).stores({ state: 'id', hashes: 'key' })

export type SyncPhase = 'off' | 'idle' | 'syncing' | 'offline' | 'error'

export interface SyncStatus {
  phase: SyncPhase
  user?: string
  server?: string
  lastSync?: string
  message?: string
  conflicts?: number
}

let status: SyncStatus = { phase: 'off' }
const listeners = new Set<() => void>()
function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch }
  listeners.forEach((l) => l())
}
export const syncStore = {
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
  get: () => status,
}

/** Standard-Server: gleiche Adresse wie die App, auf GitHub Pages der Netcup-Server. */
export function defaultServer(): string {
  return location.hostname.endsWith('github.io') ? 'https://olisoap.error13.de/api/index.php' : new URL(`${import.meta.env.BASE_URL}api/index.php`, location.href).href
}

class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function call<T>(server: string, action: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(`${server}?a=${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Token im Körper statt im Authorization-Header: manche Webspaces reichen den Header nicht an PHP weiter.
    body: JSON.stringify(token ? { ...(body as object), token } : body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new HttpError(res.status, (data as { error?: string }).error ?? `Fehler ${res.status} (Diagnose: ${server}?a=health)`)
  return data as T
}

const recordKey = (tbl: string, id: string) => `${tbl}/${id}`

async function localRecords(): Promise<LocalRecord[]> {
  const out: LocalRecord[] = []
  for (const [tbl, pk] of Object.entries(SYNCED)) {
    for (const row of await db.table(tbl).toArray()) {
      const json = JSON.stringify(row)
      out.push({ key: recordKey(tbl, String((row as Record<string, unknown>)[pk])), hash: hashString(json), value: row })
    }
  }
  return out
}

async function pullAll(acc: Account): Promise<{ changes: RemoteChange[]; seq: number }> {
  const changes: RemoteChange[] = []
  let seq = acc.lastSeq
  for (;;) {
    const page = await call<{ records: { tbl: string; id: string; seq: number; deleted: boolean; data: string | null }[]; more: boolean }>(
      acc.server,
      'pull',
      { since: seq },
      acc.token,
    )
    for (const r of page.records) {
      seq = Math.max(seq, r.seq)
      if (!(r.tbl in SYNCED)) continue
      const value = r.deleted || !r.data ? undefined : await decryptJson(acc.key, r.data)
      changes.push({ key: recordKey(r.tbl, r.id), deleted: r.deleted, value, hash: value === undefined ? undefined : hashString(JSON.stringify(value)) })
    }
    if (!page.more) break
  }
  return { changes, seq }
}

let running: Promise<void> | undefined

/** Ein Abgleich: holen, anwenden, eigene Änderungen hochladen. Läuft nie doppelt. */
export function syncNow(mode: 'normal' | 'replaceLocal' = 'normal'): Promise<void> {
  running ??= doSync(mode, false).finally(() => (running = undefined))
  return running
}

async function doSync(mode: 'normal' | 'replaceLocal', retried: boolean): Promise<void> {
  const acc = await local.state.get('account')
  if (!acc) return setStatus({ phase: 'off' })
  if (!navigator.onLine) return setStatus({ phase: 'offline' })
  setStatus({ phase: 'syncing', user: acc.user, server: acc.server })
  try {
    if (mode === 'replaceLocal') {
      await db.transaction('rw', Object.keys(SYNCED), async () => {
        for (const tbl of Object.keys(SYNCED)) await db.table(tbl).clear()
      })
      await local.hashes.clear()
      acc.lastSeq = 0
    }
    const { changes, seq } = await pullAll(acc)
    const known = new Map((await local.hashes.toArray()).map((h) => [h.key, h.hash]))
    const plan = planSync(await localRecords(), known, changes)

    // Fremde Änderungen übernehmen.
    await db.transaction('rw', Object.keys(SYNCED), async () => {
      for (const c of plan.apply) {
        const [tbl, ...rest] = c.key.split('/')
        const id = rest.join('/')
        if (c.deleted) await db.table(tbl).delete(id)
        else await db.table(tbl).put(c.value)
      }
    })
    await local.hashes.bulkPut(plan.apply.filter((c) => !c.deleted).map((c) => ({ key: c.key, hash: c.hash! })))
    await local.hashes.bulkDelete(plan.apply.filter((c) => c.deleted).map((c) => c.key))

    // Eigene Änderungen verschlüsselt hochladen, in Paketen.
    let maxSeq = seq
    for (let i = 0; i < plan.push.length; i += 200) {
      const chunk = plan.push.slice(i, i + 200)
      const records = await Promise.all(
        chunk.map(async (p) => {
          const [tbl, ...rest] = p.key.split('/')
          return { tbl, id: rest.join('/'), deleted: p.deleted, data: p.deleted ? undefined : await encryptJson(acc.key, p.value) }
        }),
      )
      const res = await call<{ seqs: number[] }>(acc.server, 'push', { records }, acc.token)
      maxSeq = Math.max(maxSeq, ...res.seqs)
      await local.hashes.bulkPut(chunk.filter((p) => !p.deleted).map((p) => ({ key: p.key, hash: p.hash! })))
      await local.hashes.bulkDelete(chunk.filter((p) => p.deleted).map((p) => p.key))
    }

    const lastSync = new Date().toISOString()
    await local.state.update('account', { lastSeq: maxSeq, lastSync })
    setStatus({ phase: 'idle', lastSync, message: undefined, conflicts: plan.conflicts || undefined })
  } catch (e) {
    if (e instanceof HttpError && e.status === 401 && !retried) {
      // Sitzung abgelaufen: mit dem gespeicherten Anmeldewert still neu anmelden.
      try {
        const { token } = await call<{ token: string }>(acc.server, 'login', { user: acc.user, auth: acc.auth })
        await local.state.update('account', { token })
        return doSync(mode, true)
      } catch {
        return setStatus({ phase: 'error', message: 'Anmeldung fehlgeschlagen. Bitte neu anmelden.' })
      }
    }
    setStatus({ phase: navigator.onLine ? 'error' : 'offline', message: (e as Error).message })
  }
}

/** Anmelden oder Konto anlegen. Danach entscheidet `firstSync`, wie mit vorhandenen Daten umgegangen wird. */
export async function signIn(server: string, user: string, passphrase: string, registerCode?: string): Promise<{ serverHasData: boolean }> {
  const { key, auth } = await deriveKeys(user, passphrase)
  const { token } = await call<{ token: string }>(server, registerCode ? 'register' : 'login', { user: user.trim(), auth, code: registerCode })
  await local.hashes.clear()
  await local.state.put({ id: 'account', server, user: user.trim(), auth, key, token, lastSeq: 0 })
  const probe = await call<{ records: unknown[] }>(server, 'pull', { since: 0 }, token)
  setStatus({ phase: 'idle', user: user.trim(), server })
  return { serverHasData: probe.records.length > 0 }
}

export async function signOut(): Promise<void> {
  const acc = await local.state.get('account')
  if (acc) await call(acc.server, 'logout', {}, acc.token).catch(() => undefined)
  await local.state.clear()
  await local.hashes.clear()
  setStatus({ phase: 'off', user: undefined, server: undefined, lastSync: undefined })
}

/** Startet den automatischen Abgleich: beim Start, alle 30 s, beim Zurückkehren in die App und wenn das Netz zurück ist. */
export async function startAutoSync(): Promise<void> {
  const acc = await local.state.get('account')
  if (acc) setStatus({ phase: 'idle', user: acc.user, server: acc.server, lastSync: acc.lastSync })
  const tick = () => {
    if (document.visibilityState === 'visible') void syncNow()
  }
  tick()
  setInterval(tick, 30_000)
  document.addEventListener('visibilitychange', tick)
  window.addEventListener('online', tick)
  window.addEventListener('offline', () => status.phase !== 'off' && setStatus({ phase: 'offline' }))
}
