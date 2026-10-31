import { BookOpen, CircleCheck, CircleHelp, Cloud, CloudOff, Download, Ellipsis, RefreshCw, FlaskConical, Layers, LayoutDashboard, Package, Settings, ShoppingCart, TriangleAlert, Wrench, X, type LucideIcon } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, useLocation } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useSyncStatus } from '../pages/SyncPage'
import { useSession } from '../session'
import { buildLabel, reloadToLatest, useVersionStatus, versionAdvice, type VersionStatus } from '../version'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

// Reihenfolge nach Häufigkeit der Anliegen. Mobil passen fünf Einträge in die untere Leiste (Material 3), der Rest unter "Mehr".
const NAV: NavItem[] = [
  { to: '/', label: 'Übersicht', icon: LayoutDashboard, end: true },
  { to: '/sieden', label: 'Sieden', icon: FlaskConical },
  { to: '/rezepte', label: 'Rezepte', icon: BookOpen },
  { to: '/lager', label: 'Vorrat', icon: Package },
  { to: '/einkauf', label: 'Einkauf', icon: ShoppingCart },
  { to: '/chargen', label: 'Chargen', icon: Layers },
  { to: '/werkzeuge', label: 'Werkzeuge', icon: Wrench },
]
const MOBILE_MAIN = 4

/** Sync-Zustand unten in der Leiste: auf einen Blick, ob alles gesichert ist. */
function SyncIndicator() {
  const s = useSyncStatus()
  const label = { off: 'Sync aus', idle: 'Synchron', syncing: 'Gleicht ab', offline: 'Offline', error: 'Sync-Fehler' }[s.phase]
  const Icon = s.phase === 'syncing' ? RefreshCw : s.phase === 'idle' ? Cloud : CloudOff
  const color = s.phase === 'idle' ? 'text-ok' : s.phase === 'syncing' ? 'text-accent' : s.phase === 'off' ? 'text-muted' : 'text-warn'
  return (
    <NavLink to="/sync" className={`mt-auto flex flex-col items-center gap-1 text-[0.65rem] ${color}`} title={s.lastSync ? `Zuletzt: ${new Date(s.lastSync).toLocaleString('de-DE')}` : label}>
      <Icon size={18} className={s.phase === 'syncing' ? 'animate-spin' : ''} aria-hidden />
      {label}
    </NavLink>
  )
}

type Advice = ReturnType<typeof versionAdvice>

const ADVICE_TONE: Record<Advice, string> = { reload: 'text-accent', serverBehind: 'text-warn', current: 'text-ok', unknown: 'text-muted' }
const ADVICE_DOT: Record<Advice, string> = { reload: 'bg-accent', serverBehind: 'bg-warn', current: 'bg-ok', unknown: 'bg-muted' }

/** Ein wartender Service Worker zählt wie eine neuere Version auf dem Server. */
function useAdvice(waiting: boolean): { v: VersionStatus; advice: Advice } {
  const v = useVersionStatus()
  return { v, advice: waiting ? 'reload' : versionAdvice(v) }
}

/**
 * Versionsstand, immer sichtbar (Vorbild: Volcano-App): „aktuell“, „Neu laden“, wenn der Server eine neuere Version
 * hat, „Server veraltet“, wenn GitHub schon weiter ist als der Server. Dazu der Stand des laufenden Builds.
 */
function VersionIndicator({ waiting, update }: { waiting: boolean; update: () => void }) {
  const { t } = useTranslation()
  const { v, advice } = useAdvice(waiting)
  const title = [t('Läuft: {{build}} vom {{date}}', { build: v.running, date: buildLabel() }), v.server && t('Server: {{build}}', { build: v.server }), v.latest && t('GitHub: {{build}}', { build: v.latest })]
    .filter(Boolean)
    .join('\n')
  const stamp = <span className="text-[0.6rem] font-normal text-muted tabular-nums">{buildLabel()}</span>
  if (advice === 'reload')
    return (
      <button className="flex min-h-11 flex-col items-center gap-0.5 rounded-xl border border-accent/50 bg-accent/10 px-2 py-1 text-[0.65rem] font-semibold text-accent" onClick={() => (waiting ? update() : void reloadToLatest(update))} title={title}>
        <Download size={18} aria-hidden />
        {t('Neu laden')}
      </button>
    )
  if (advice === 'serverBehind')
    return (
      <NavLink to="/sync" className="flex flex-col items-center gap-0.5 text-center text-[0.65rem] text-warn" title={title}>
        <TriangleAlert size={18} aria-hidden />
        {t('Server veraltet')}
        {stamp}
      </NavLink>
    )
  return (
    <span className={`flex flex-col items-center gap-0.5 text-[0.65rem] ${ADVICE_TONE[advice]}`} title={advice === 'unknown' ? `${title}\n${t('Noch nicht geprüft (offline?)')}` : title}>
      {advice === 'current' ? <CircleCheck size={18} aria-hidden /> : <CircleHelp size={18} aria-hidden />}
      {advice === 'current' ? t('aktuell') : t('Stand')}
      {stamp}
    </span>
  )
}

/** Handy: Hinweis über der unteren Leiste, nur wenn etwas zu tun ist. */
function MobileVersionBanner({ waiting, update }: { waiting: boolean; update: () => void }) {
  const { t } = useTranslation()
  const { advice } = useAdvice(waiting)
  if (advice !== 'reload') return null
  return (
    <button className="btn-primary w-full" onClick={() => (waiting ? update() : void reloadToLatest(update))}>
      <Download size={18} aria-hidden />
      {t('Neue Version: jetzt neu laden')}
    </button>
  )
}

/** Handy: Zeile im Menü „Mehr“ mit dem gleichen Stand wie in der Leiste am Rand. */
function MobileVersionLine({ waiting }: { waiting: boolean }) {
  const { t } = useTranslation()
  const { advice } = useAdvice(waiting)
  const label = { current: t('Version aktuell'), reload: t('Neue Version bereit'), serverBehind: t('Server veraltet'), unknown: t('Version nicht geprüft') }[advice]
  return (
    <p className={`flex min-h-10 items-center gap-3 px-3 text-sm ${ADVICE_TONE[advice]}`}>
      <span aria-hidden className={`inline-block size-2.5 rounded-full ${ADVICE_DOT[advice]}`} />
      {label}
      <span className="ml-auto text-xs text-muted tabular-nums">{t('Stand {{date}}', { date: buildLabel() })}</span>
    </p>
  )
}

/** Läuft ein Sieden und man ist woanders: ein Tipp führt zurück an dieselbe Stelle. */
function SessionBanner() {
  const { t } = useTranslation()
  const session = useSession()
  const { pathname } = useLocation()
  if (!session || pathname.startsWith(`/sieden/${session.recipeId}`)) return null
  return (
    <NavLink to={`/sieden/${session.recipeId}`} className="no-print mb-4 flex min-h-12 items-center gap-3 rounded-xl border border-accent/50 bg-accent/10 px-4 py-2 font-medium text-accent">
      <FlaskConical size={20} aria-hidden />
      <span className="min-w-0 flex-1">{t('Sieden läuft: {{name}}', { name: session.recipeName })}</span>
      <span className="text-sm">{t('weiter')} →</span>
    </NavLink>
  )
}

function Logo() {
  return (
    <span className="grid size-10 place-items-center rounded-xl bg-accent font-bold text-accent-ink" aria-hidden>
      os
    </span>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  // Service Worker einmal registrieren; ein wartender neuer Worker heißt: Update bereit.
  const {
    needRefresh: [waiting],
    updateServiceWorker,
  } = useRegisterSW()
  const update = () => void updateServiceWorker(true)
  const mobileAdvice = useAdvice(waiting).advice
  const [more, setMore] = useState(false)
  const location = useLocation()
  useEffect(() => setMore(false), [location.pathname])

  const railLink = ({ isActive }: { isActive: boolean }) =>
    `group flex flex-col items-center gap-1 rounded-xl py-2 text-[0.7rem] font-medium transition-colors ${isActive ? 'text-accent' : 'text-muted hover:text-ink'}`
  const railIcon = (active: boolean) => `grid h-8 w-14 place-items-center rounded-full transition-colors ${active ? 'bg-accent/15' : 'group-hover:bg-surface-2'}`

  return (
    <div className="min-h-dvh">
      {/* Navigationsleiste ab Tablet-Breite */}
      <nav aria-label="Hauptnavigation" className="no-print fixed inset-y-0 left-0 z-30 hidden w-24 flex-col items-center gap-2 border-r border-line bg-surface py-4 md:flex">
        <NavLink to="/" aria-label="olisoap Übersicht" className="mb-3">
          <Logo />
        </NavLink>
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={railLink}>
            {({ isActive }) => (
              <>
                <span className={railIcon(isActive)}>
                  <Icon size={20} aria-hidden />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
        <SyncIndicator />
        <VersionIndicator waiting={waiting} update={update} />
        <NavLink to="/profil" className={({ isActive }) => `btn-ghost ${isActive ? 'text-accent' : ''}`} aria-label="Profil & Einstellungen" title="Profil & Einstellungen">
          <Settings size={18} aria-hidden />
        </NavLink>
      </nav>

      <main className="mx-auto max-w-7xl px-4 pt-6 pb-28 sm:px-6 md:pb-10 md:pl-30">
        <SessionBanner />
        {children}
      </main>

      {/* Auf dem Handy ist in der unteren Leiste kein Platz: Update-Hinweis darüber */}
      <div className="no-print fixed inset-x-3 bottom-20 z-30 md:hidden [&:empty]:hidden">
        <MobileVersionBanner waiting={waiting} update={update} />
      </div>

      {/* Untere Leiste auf dem Handy */}
      <nav aria-label="Hauptnavigation" className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {NAV.slice(0, MOBILE_MAIN).map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={railLink}>
            {({ isActive }) => (
              <>
                <span className={railIcon(isActive)}>
                  <Icon size={20} aria-hidden />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
        <button className={railLink({ isActive: more })} onClick={() => setMore(!more)} aria-expanded={more}>
          <span className={`relative ${railIcon(more)}`}>
            {more ? <X size={20} /> : <Ellipsis size={20} />}
            {/* Versionsstand auf einen Blick, Einzelheiten im Menü */}
            <span aria-hidden className={`absolute top-0.5 right-3 size-2 rounded-full ring-2 ring-surface ${ADVICE_DOT[mobileAdvice]}`} />
          </span>
          Mehr
        </button>
      </nav>
      {more && (
        <div className="no-print fixed inset-x-3 bottom-20 z-40 rounded-2xl border border-line bg-surface p-2 shadow-2xl md:hidden">
          {NAV.slice(MOBILE_MAIN).map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className="flex min-h-12 items-center gap-3 rounded-xl px-3 hover:bg-surface-2">
              <Icon size={20} className="text-accent" aria-hidden />
              {label}
            </NavLink>
          ))}
          <NavLink to="/profil" className="flex min-h-12 items-center gap-3 rounded-xl px-3 hover:bg-surface-2">
            <Settings size={20} className="text-accent" aria-hidden />
            Profil & Einstellungen
          </NavLink>
          <div className="mt-1 border-t border-line pt-1">
            <MobileVersionLine waiting={waiting} />
          </div>
        </div>
      )}
    </div>
  )
}
