import { Cloud, CloudOff, LogOut, RefreshCw, ShieldCheck } from 'lucide-react'
import { useState, useSyncExternalStore } from 'react'
import { Chip, PageHeader, Panel } from '../components/ui'
import { defaultServer, signIn, signOut, syncNow, syncStore } from '../sync/engine'
import { useVersionStatus, versionAdvice } from '../version'

export function useSyncStatus() {
  return useSyncExternalStore(syncStore.subscribe, syncStore.get)
}

export function SyncPage() {
  const status = useSyncStatus()
  const [server, setServer] = useState(defaultServer)
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [register, setRegister] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [choice, setChoice] = useState(false)

  async function submit() {
    setError(undefined)
    if (register && pass !== pass2) return setError('Die Passphrasen stimmen nicht überein.')
    if (pass.length < 12) return setError('Bitte mindestens 12 Zeichen. Ein Satz aus mehreren Wörtern ist gut zu merken und sicher.')
    setBusy(true)
    try {
      const { serverHasData } = await signIn(server, user, pass, register ? code : undefined)
      setPass('')
      setPass2('')
      if (serverHasData) setChoice(true)
      else await syncNow()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function firstSync(mode: 'normal' | 'replaceLocal') {
    setBusy(true)
    await syncNow(mode)
    setChoice(false)
    setBusy(false)
  }

  const signedIn = status.phase !== 'off'

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader eyebrow="Werkzeuge" title="Sync & Konto">
        Gleicher Stand auf PC, Tablet und Handy, mit automatischer Sicherung auf deinem Server.
      </PageHeader>

      <Panel title="Verschlüsselung" icon={ShieldCheck}>
        <p className="text-sm text-muted">
          Alles wird in diesem Browser verschlüsselt, bevor es das Gerät verlässt (AES-256-GCM, Schlüssel aus deiner Passphrase).
          Der Server speichert nur unlesbaren Datensalat und kennt weder Passphrase noch Schlüssel. Deshalb gilt:{' '}
          <b className="text-ink">Passphrase vergessen heißt Daten auf dem Server verloren.</b> Die Daten auf deinen Geräten bleiben erhalten. Am besten im
          Passwort-Manager speichern.
        </p>
      </Panel>

      {signedIn ? (
        <Panel
          title="Status"
          icon={status.phase === 'offline' || status.phase === 'error' ? CloudOff : Cloud}
          action={
            <Chip tone={status.phase === 'idle' ? 'ok' : status.phase === 'syncing' ? 'accent' : 'warn'}>
              {{ idle: 'synchron', syncing: 'gleicht ab …', offline: 'offline', error: 'Fehler', off: 'aus' }[status.phase]}
            </Chip>
          }
        >
          {choice ? (
            <div className="space-y-3">
              <p className="font-medium">Auf dem Server liegen schon Daten. Wie weiter?</p>
              <button className="btn-primary w-full justify-start" disabled={busy} onClick={() => firstSync('replaceLocal')}>
                Daten vom Server übernehmen (empfohlen für ein weiteres Gerät)
              </button>
              <p className="text-xs text-muted">Ersetzt Rezepte, Vorrat, Chargen und Einstellungen in diesem Browser durch den Stand vom Server.</p>
              <button className="btn w-full justify-start" disabled={busy} onClick={() => firstSync('normal')}>
                Zusammenführen
              </button>
              <p className="text-xs text-muted">Behält beides. Unveränderte doppelte Rezepte werden dabei automatisch zusammengeführt.</p>
            </div>
          ) : (
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted">Konto</dt>
              <dd>{status.user}</dd>
              <dt className="text-muted">Server</dt>
              <dd className="truncate">{status.server}</dd>
              <dt className="text-muted">Zuletzt</dt>
              <dd>{status.lastSync ? new Date(status.lastSync).toLocaleString('de-DE') : '–'}</dd>
              {status.message && (
                <>
                  <dt className="text-muted">Hinweis</dt>
                  <dd className="text-warn">{status.message}</dd>
                </>
              )}
              {status.conflicts && (
                <>
                  <dt className="text-muted">Konflikte</dt>
                  <dd>{status.conflicts} Datensätze waren auf zwei Geräten geändert. Der Stand dieses Geräts wurde behalten.</dd>
                </>
              )}
            </dl>
          )}
          {!choice && (
            <div className="mt-5 flex flex-wrap gap-2">
              <button className="btn-primary" disabled={status.phase === 'syncing'} onClick={() => syncNow()}>
                <RefreshCw size={18} /> Jetzt abgleichen
              </button>
              <button className="btn" onClick={() => confirm('Abmelden? Die Daten in diesem Browser bleiben erhalten.') && signOut()}>
                <LogOut size={18} /> Abmelden
              </button>
            </div>
          )}
        </Panel>
      ) : (
        <Panel title={register ? 'Konto anlegen' : 'Anmelden'} icon={Cloud}>
          <div className="space-y-4">
            <div className="inline-flex gap-1 rounded-xl bg-surface-2 p-1">
              {[false, true].map((r) => (
                <button
                  key={String(r)}
                  className={`min-h-9 rounded-lg px-3 text-sm font-medium ${register === r ? 'bg-surface text-accent shadow-sm' : 'text-muted hover:text-ink'}`}
                  onClick={() => setRegister(r)}
                >
                  {r ? 'Neues Konto' : 'Anmelden'}
                </button>
              ))}
            </div>
            <label className="label">
              Benutzername
              <input className="field" autoComplete="username" value={user} onChange={(e) => setUser(e.target.value)} />
            </label>
            <label className="label">
              Passphrase
              <input className="field" type="password" autoComplete={register ? 'new-password' : 'current-password'} value={pass} onChange={(e) => setPass(e.target.value)} />
            </label>
            {register && (
              <label className="label">
                Passphrase wiederholen
                <input className="field" type="password" autoComplete="new-password" value={pass2} onChange={(e) => setPass2(e.target.value)} />
              </label>
            )}
            {register && (
              <label className="label">
                Registrierungscode
                <input className="field" value={code} onChange={(e) => setCode(e.target.value)} placeholder="steht in olisoap-config.php auf dem Server" />
              </label>
            )}
            <details className="text-sm">
              <summary className="cursor-pointer text-muted">Server</summary>
              <input className="field mt-2 w-full" value={server} onChange={(e) => setServer(e.target.value)} aria-label="Server-Adresse" />
            </details>
            {error && <p className="text-sm text-bad">{error}</p>}
            <button className="btn-primary" disabled={busy || !user || !pass || (register && !code)} onClick={submit}>
              {busy ? 'Schlüssel wird berechnet …' : register ? 'Konto anlegen' : 'Anmelden'}
            </button>
            <p className="text-xs text-muted">Das Berechnen des Schlüssels dauert absichtlich ein bis zwei Sekunden, das macht Rateversuche teuer.</p>
          </div>
        </Panel>
      )}
      <VersionInfo />
    </div>
  )
}

/** Versionen im Klartext, zum Abgleich mit „Build …“ in Plesk. */
function VersionInfo() {
  const v = useVersionStatus()
  const advice = versionAdvice(v)
  return (
    <p className="text-xs text-muted">
      App-Version {v.running}
      {v.server && ` · Server ${v.server}`}
      {v.latest && ` · GitHub ${v.latest}`}
      {advice === 'reload' && <span className="text-accent"> · Neuere Version auf dem Server: Seite neu laden.</span>}
      {advice === 'serverBehind' && <span className="text-warn"> · Der Server hat die neueste Version noch nicht: in Plesk unter Git „Jetzt abrufen“.</span>}
    </p>
  )
}
