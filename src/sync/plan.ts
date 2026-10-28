// Abgleich-Logik ohne Netzwerk und Datenbank, damit sie testbar ist.
//
// Jedes Gerät merkt sich pro Datensatz den Hash des zuletzt abgeglichenen Stands. Daraus ergibt sich:
//   - lokal geändert: aktueller Hash ≠ gemerkter Hash (oder neu)
//   - lokal gelöscht: Hash gemerkt, Datensatz fehlt
// Kommt vom Server eine Änderung an einem Datensatz, der auch lokal geändert wurde, gewinnt die lokale Fassung
// (sie ist die zuletzt bearbeitete auf diesem Gerät und wird anschließend hochgeladen).

export interface LocalRecord {
  key: string
  hash: string
  value: unknown
}

export interface RemoteChange {
  key: string
  deleted: boolean
  value?: unknown
  hash?: string
}

export interface SyncPlan {
  /** Vom Server übernehmen. */
  apply: RemoteChange[]
  /** Zum Server schicken (deleted = Löschung). */
  push: { key: string; deleted: boolean; value?: unknown; hash?: string }[]
  conflicts: number
}

export function planSync(local: LocalRecord[], known: Map<string, string>, remote: RemoteChange[]): SyncPlan {
  const localByKey = new Map(local.map((r) => [r.key, r]))
  const changed = new Set(local.filter((r) => known.get(r.key) !== r.hash).map((r) => r.key))
  const deleted = new Set([...known.keys()].filter((k) => !localByKey.has(k)))

  const apply: RemoteChange[] = []
  let conflicts = 0
  for (const r of remote) {
    if (changed.has(r.key) || deleted.has(r.key)) {
      // Eigene, schon bekannte Fassung zurückbekommen ist kein Konflikt.
      if (r.hash !== undefined && r.hash === localByKey.get(r.key)?.hash) changed.delete(r.key)
      else conflicts++
      continue
    }
    apply.push(r)
  }

  const push = [
    ...[...changed].map((key) => ({ key, deleted: false, value: localByKey.get(key)!.value, hash: localByKey.get(key)!.hash })),
    ...[...deleted].map((key) => ({ key, deleted: true })),
  ]
  return { apply, push, conflicts }
}
