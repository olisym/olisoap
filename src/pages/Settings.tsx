import { Cloud, Database, GraduationCap, Moon, Sun, Wrench, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { NumberField } from '../components/NumberField'
import { LabelText, PageHeader, Panel } from '../components/ui'
import type { Mode } from '../core/profile'
import { db } from '../db'
import { BATCH_FAT_KEY, EXTRA_ORDER_KEY, MODE_KEY, useMode, useWorkshop } from '../hooks'
import { useTheme, type Theme } from '../theme'

const MODES: { id: Mode; icon: LucideIcon; title: string; text: string }[] = [
  { id: 'einsteiger', icon: GraduationCap, title: 'Einsteiger', text: 'Weniger Felder, Erklärungen direkt sichtbar. Eine Lauge, ein Wassermodus.' },
  { id: 'experte', icon: Wrench, title: 'Experte', text: 'Alle Felder: eigene Verseifungszahlen, Mischlauge, alle Wassermodi.' },
]

/** Große Auswahlkachel als Radio-Button (Trefferfläche ≥ 44 px). */
function Choice({ name, checked, icon: Icon, title, text, onSelect }: { name: string; checked: boolean; icon: LucideIcon; title: string; text?: string; onSelect: () => void }) {
  return (
    <label className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border p-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${checked ? 'border-accent bg-accent/5' : 'border-line bg-surface-2 hover:border-accent/60'}`}>
      <input type="radio" name={name} className="sr-only" checked={checked} onChange={onSelect} />
      <Icon size={20} className={`mt-0.5 shrink-0 ${checked ? 'text-accent' : 'text-muted'}`} aria-hidden />
      <span className="min-w-0">
        <span className="block font-semibold">{title}</span>
        {text && <span className="block text-sm text-muted">{text}</span>}
      </span>
    </label>
  )
}

export function Settings() {
  const m = useMode()
  const w = useWorkshop()
  const [theme, setTheme] = useTheme()
  if (!m || !w) return <p className="text-muted">Lade …</p>

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader eyebrow="Profil" title="Profil & Einstellungen" />

      <Panel title="Modus" icon={GraduationCap}>
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="sr-only">Modus</legend>
          {MODES.map((x) => (
            <Choice key={x.id} name="mode" checked={m.mode === x.id} icon={x.icon} title={x.title} text={x.text} onSelect={() => db.settings.put({ key: MODE_KEY, value: x.id })} />
          ))}
        </fieldset>
        <p className="mt-3 text-xs text-muted">
          {m.chosen ? 'Rechnung und Rezepte bleiben gleich, nur die Anzeige ändert sich.' : `Noch nicht gewählt: ${m.mode === 'experte' ? 'Experte, weil es schon Chargen gibt' : 'Einsteiger, solange es keine Chargen gibt'}.`}
        </p>
      </Panel>

      <Panel title="Werkstatt" icon={Wrench}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="label">
            <LabelText hint="Fettmenge pro Sud, passend zu deiner Form. Gilt für Seife am Stück; Rasierseife im Tiegel behält ihre Menge aus dem Rezept.">Fett je Sud</LabelText>
            <NumberField value={w.batchFat} digits={0} suffix="g" placeholder="wie Rezept" ariaLabel="Fettmenge pro Sud" onChange={(v) => db.settings.put({ key: BATCH_FAT_KEY, value: v || undefined })} />
          </label>
          <label className="label">
            <LabelText hint="Was dir eine zusätzliche Bestellung an Aufwand wert ist (Paket annehmen, Überblick behalten). Der Einkauf teilt nur auf, wenn die Ersparnis größer ist. Zählt nicht zum Preis.">
              Aufwand je weitere Bestellung
            </LabelText>
            <NumberField value={w.extraOrderCost} digits={2} suffix="€" placeholder="0" ariaLabel="Aufwand je weitere Bestellung" onChange={(v) => db.settings.put({ key: EXTRA_ORDER_KEY, value: v || undefined })} />
          </label>
        </div>
      </Panel>

      <Panel title="Darstellung" icon={theme === 'dark' ? Moon : Sun}>
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="sr-only">Design</legend>
          {([['dark', Moon, 'Dunkel'], ['light', Sun, 'Hell']] as [Theme, LucideIcon, string][]).map(([t, icon, title]) => (
            <Choice key={t} name="theme" checked={theme === t} icon={icon} title={title} onSelect={() => setTheme(t)} />
          ))}
        </fieldset>
        <p className="mt-3 text-xs text-muted">Gilt nur auf diesem Gerät.</p>
      </Panel>

      <div className="flex flex-wrap gap-3">
        <Link className="btn" to="/sync">
          <Cloud size={16} aria-hidden /> Sync & Konto
        </Link>
        <Link className="btn" to="/daten">
          <Database size={16} aria-hidden /> Daten & Sicherung
        </Link>
      </div>
    </div>
  )
}
