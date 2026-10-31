import { BookOpen, Cloud, CloudOff, Download, Ellipsis, RefreshCw, FlaskConical, Layers, LayoutDashboard, Package, Settings, ShoppingCart, TriangleAlert, Wrench, X, type LucideIcon } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useSyncStatus } from '../pages/SyncPage'
import { reloadToLatest, useVersionStatus, versionAdvice } from '../version'

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

/**
 * Versionshinweis unter dem Sync-Zustand: „Update“, wenn der Server eine neuere Version hat (auch ein wartender
 * Service Worker zählt), „Server veraltet“, wenn GitHub schon weiter ist als der Server. Sonst unsichtbar.
 */
function VersionIndicator({ compact = false, waiting, update }: { compact?: boolean; waiting: boolean; update: () => void }) {
  const v = useVersionStatus()
  const advice = waiting ? 'reload' : versionAdvice(v)
  if (advice === 'reload')
    return (
      <button
        className={compact ? 'btn-primary w-full' : 'flex flex-col items-center gap-1 text-[0.65rem] font-semibold text-accent'}
        onClick={() => (waiting ? update() : void reloadToLatest(update))}
        title="Neue Version verfügbar"
      >
        <Download size={18} aria-hidden />
        {compact ? 'Neue Version: jetzt neu laden' : 'Update'}
      </button>
    )
  if (advice === 'serverBehind' && !compact)
    return (
      <NavLink to="/sync" className="flex flex-col items-center gap-1 text-center text-[0.65rem] text-warn" title={`Server: ${v.server}, GitHub: ${v.latest}`}>
        <TriangleAlert size={18} aria-hidden />
        Server veraltet
      </NavLink>
    )
  return null
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

      <main className="mx-auto max-w-7xl px-4 pt-6 pb-28 sm:px-6 md:pb-10 md:pl-30">{children}</main>

      {/* Auf dem Handy ist in der unteren Leiste kein Platz: Update-Hinweis darüber */}
      <div className="no-print fixed inset-x-3 bottom-20 z-30 md:hidden [&:empty]:hidden">
        <VersionIndicator compact waiting={waiting} update={update} />
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
          <span className={railIcon(more)}>{more ? <X size={20} /> : <Ellipsis size={20} />}</span>
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
        </div>
      )}
    </div>
  )
}
