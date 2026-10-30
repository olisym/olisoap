import { useSyncExternalStore } from 'react'

// Versionsprüfung: Läuft im Browser die Version, die auf dem Server liegt? Und hat der Server die neueste Version
// aus GitHub schon übernommen (Plesk zieht den Branch „deploy“ teils verzögert)? Die Kennung ist der kurze
// Commit-Hash, wie er auch als „Build …“ im Branch deploy steht.

const REPO = 'olisym/olisoap'
const EVERY_MS = 30 * 60 * 1000

export interface VersionStatus {
  running: string
  /** Version auf dem Server (version.json), undefined = noch nicht geprüft oder nicht erreichbar. */
  server?: string
  /** Neueste Version im Branch deploy auf GitHub (nur bei eigener Domain geprüft). */
  latest?: string
  checkedAt?: string
}

/** Was zu tun ist: neu laden (Server hat Neueres) oder Server aktualisieren (GitHub hat Neueres). */
export function versionAdvice(v: VersionStatus): 'current' | 'reload' | 'serverBehind' | 'unknown' {
  if (v.running === 'lokal' || !v.server) return 'unknown'
  if (v.server !== v.running) return 'reload'
  if (v.latest && v.latest !== v.server) return 'serverBehind'
  return 'current'
}

async function serverBuild(): Promise<string | undefined> {
  const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' })
  return res.ok ? ((await res.json()) as { build?: string }).build : undefined
}

/** Kurzer Hash aus der Commit-Nachricht „Build abc1234“ des Branches deploy. */
async function latestBuild(): Promise<string | undefined> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/commits/deploy`, { cache: 'no-store' })
  if (!res.ok) return undefined
  const msg = ((await res.json()) as { commit?: { message?: string } }).commit?.message ?? ''
  return msg.match(/^Build ([0-9a-f]{7})/)?.[1]
}

let status: VersionStatus = { running: __BUILD__ }
const listeners = new Set<() => void>()
const versionStore = {
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
  get: () => status,
}

/** Prüft beim Start, alle 30 Minuten und beim Zurückkehren in die App. Fehler (offline) werden still ignoriert. */
export function startVersionCheck(): void {
  if (__BUILD__ === 'lokal') return
  // GitHub Pages baut aus demselben Commit; der Branch deploy betrifft nur die eigene Domain.
  const ownDomain = !location.hostname.endsWith('github.io') && location.hostname !== 'localhost'
  const check = async () => {
    if (document.visibilityState !== 'visible' || !navigator.onLine) return
    const [server, latest] = await Promise.all([serverBuild().catch(() => undefined), ownDomain ? latestBuild().catch(() => undefined) : undefined])
    status = { ...status, server: server ?? status.server, latest: latest ?? status.latest, checkedAt: new Date().toISOString() }
    listeners.forEach((l) => l())
    // Neuere Version auf dem Server: den Service Worker sofort nachsehen lassen, sonst liefert ein Neuladen
    // die alte Fassung aus dem Offline-Speicher. Ein wartender Worker erscheint dann als „Update“.
    if (server && server !== __BUILD__) await navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => undefined)
  }
  void check()
  setInterval(check, EVERY_MS)
  document.addEventListener('visibilitychange', check)
}

export function useVersionStatus(): VersionStatus {
  return useSyncExternalStore(versionStore.subscribe, versionStore.get)
}

/** Auf die neue Version wechseln: wartenden Service Worker übernehmen, sonst einfach neu laden. */
export async function reloadToLatest(activateWaiting: () => void): Promise<void> {
  const reg = await navigator.serviceWorker?.getRegistration().catch(() => undefined)
  await reg?.update().catch(() => undefined)
  if (reg?.waiting) activateWaiting()
  else location.reload()
}
