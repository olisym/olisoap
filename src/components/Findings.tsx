import type { Finding } from '../core/types'

const STYLE = {
  error: 'border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-200',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200',
  info: 'border-sky-500/40 bg-sky-500/10 text-sky-900 dark:text-sky-200',
}

const ICON = { error: '✕', warning: '!', info: 'i' }

export function Findings({ findings }: { findings: Finding[] }) {
  if (findings.length === 0)
    return (
      <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-200">
        ✓ Keine Auffälligkeiten.
      </p>
    )
  return (
    <ul className="space-y-1.5">
      {findings.map((f, i) => (
        <li key={i} className={`flex gap-2 rounded-md border px-3 py-2 text-sm ${STYLE[f.severity]}`}>
          <span aria-hidden className="font-bold">
            {ICON[f.severity]}
          </span>
          {f.message}
        </li>
      ))}
    </ul>
  )
}
