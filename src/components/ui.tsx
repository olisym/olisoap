import type { LucideIcon } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

// Kleine, wiederverwendbare Bausteine für ein einheitliches Erscheinungsbild.

export function PageHeader({ title, eyebrow, actions, children }: { title: string; eyebrow?: string; actions?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {children && <div className="mt-1 text-sm text-muted">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

export function Panel({ title, icon: Icon, action, children, className = '' }: { title?: string; icon?: LucideIcon; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && (
            <h2 className="eyebrow flex items-center gap-2">
              {Icon && <Icon size={14} className="text-accent" aria-hidden />}
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export type Tone = 'ok' | 'warn' | 'bad' | 'accent' | 'muted'

const TONE_TEXT: Record<Tone, string> = {
  ok: 'text-ok',
  warn: 'text-warn',
  bad: 'text-bad',
  accent: 'text-accent',
  muted: 'text-muted',
}
const TONE_BG: Record<Tone, string> = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  bad: 'bg-bad',
  accent: 'bg-accent',
  muted: 'bg-muted',
}

export function StatusDot({ tone }: { tone: Tone }) {
  return <span aria-hidden className={`inline-block size-2 shrink-0 rounded-full ${TONE_BG[tone]}`} />
}

export function Chip({ tone, children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`chip ${tone ? TONE_TEXT[tone] : ''}`}>
      {tone && <StatusDot tone={tone} />}
      {children}
    </span>
  )
}

export function Kpi({ label, value, unit, tone, hint }: { label: string; value: ReactNode; unit?: string; tone?: Tone; hint?: ReactNode }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className={`kpi mt-1 ${tone ? TONE_TEXT[tone] : ''}`}>
        {value}
        {unit && <span className="ml-1 text-base font-normal text-muted">{unit}</span>}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  )
}

export function Bar({ value, max = 1, tone = 'accent', label }: { value: number; max?: number; tone?: Tone; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100))
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-track" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={`h-full rounded-full ${TONE_BG[tone]}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

/** Große Aufgaben-Kachel für die Startseite. */
export function TaskTile({ to, icon: Icon, title, subtitle, status, primary }: { to: string; icon: LucideIcon; title: string; subtitle: string; status?: ReactNode; primary?: boolean }) {
  return (
    <Link
      to={to}
      className={`group flex min-h-36 flex-col justify-between rounded-[var(--radius-panel)] border p-5 transition ${
        primary ? 'panel-glow border-accent/40 bg-surface hover:border-accent' : 'border-line bg-surface hover:border-accent/60 hover:bg-surface-2'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`grid size-11 place-items-center rounded-xl ${primary ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-accent'}`}>
          <Icon size={22} aria-hidden />
        </span>
        {status}
      </div>
      <div>
        <p className="text-lg font-semibold group-hover:text-accent">{title}</p>
        <p className="text-sm text-muted">{subtitle}</p>
      </div>
    </Link>
  )
}

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-panel)] border border-dashed border-line px-6 py-10 text-center">
      <Icon size={28} className="text-muted" aria-hidden />
      <p className="font-semibold">{title}</p>
      {children && <p className="max-w-md text-sm text-muted">{children}</p>}
      {action}
    </div>
  )
}

/**
 * Feldname mit optionaler Kurzhilfe: „?“ klappt einen Satz direkt unter dem Namen auf.
 * Sichtbar klein, Trefferfläche 44 px. `initiallyOpen` zeigt die Hilfe gleich (Einsteiger-Modus). Gehört in ein <label>, der Hilfetext bleibt dort lesbar, wo die Frage entsteht.
 */
export function LabelText({ children, hint, initiallyOpen = false }: { children: ReactNode; hint?: ReactNode; initiallyOpen?: boolean }) {
  // Folgt `initiallyOpen` (der Modus lädt asynchron), bis man selbst klickt
  const [toggled, setOpen] = useState<boolean>()
  const open = toggled ?? initiallyOpen
  const id = useId()
  return (
    <>
      <span className="flex items-center gap-1.5">
        {children}
        {hint && (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={id}
            aria-label="Was bedeutet das?"
            className={`relative inline-grid size-5 place-items-center rounded-full border text-[11px] leading-none font-semibold before:absolute before:-inset-3 ${open ? 'border-accent bg-accent text-accent-ink' : 'border-line text-muted hover:border-accent hover:text-accent'}`}
            onClick={(e) => {
              e.preventDefault()
              setOpen(!open)
            }}
          >
            ?
          </button>
        )}
      </span>
      {hint && open && (
        <span id={id} role="note" className="block text-xs leading-snug font-normal text-muted">
          {hint}
        </span>
      )}
    </>
  )
}
