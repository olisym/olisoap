import { Cloud, Database, GraduationCap, Moon, Sun, Wrench, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { NumberField } from '../components/NumberField'
import { LabelText, PageHeader, Panel } from '../components/ui'
import type { Mode } from '../core/profile'
import { db } from '../db'
import { BATCH_FAT_KEY, EXTRA_ORDER_KEY, MODE_KEY, useMode, useWorkshop } from '../hooks'
import { useTheme, type Theme } from '../theme'

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
  const { t } = useTranslation()
  const m = useMode()
  const w = useWorkshop()
  const [theme, setTheme] = useTheme()
  if (!m || !w) return <p className="text-muted">{t('Lade …')}</p>

  // Texte hier statt als Konstante oben, damit t() sie sieht (und Werkzeuge sie finden)
  const modes: { id: Mode; icon: LucideIcon; title: string; text: string }[] = [
    { id: 'einsteiger', icon: GraduationCap, title: t('Einsteiger'), text: t('Weniger Felder, Erklärungen direkt sichtbar. Eine Lauge, ein Wassermodus.') },
    { id: 'experte', icon: Wrench, title: t('Experte'), text: t('Alle Felder: eigene Verseifungszahlen, Mischlauge, alle Wassermodi.') },
  ]
  const themes: [Theme, LucideIcon, string][] = [
    ['dark', Moon, t('Dunkel')],
    ['light', Sun, t('Hell')],
  ]

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader eyebrow={t('Profil')} title={t('Profil & Einstellungen')} />

      <Panel title={t('Modus')} icon={GraduationCap}>
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="sr-only">{t('Modus')}</legend>
          {modes.map((x) => (
            <Choice key={x.id} name="mode" checked={m.mode === x.id} icon={x.icon} title={x.title} text={x.text} onSelect={() => db.settings.put({ key: MODE_KEY, value: x.id })} />
          ))}
        </fieldset>
        <p className="mt-3 text-xs text-muted">
          {m.chosen
            ? t('Rechnung und Rezepte bleiben gleich, nur die Anzeige ändert sich.')
            : m.mode === 'experte'
              ? t('Noch nicht gewählt: Experte, weil es schon Chargen gibt.')
              : t('Noch nicht gewählt: Einsteiger, solange es keine Chargen gibt.')}
        </p>
      </Panel>

      <Panel title={t('Werkstatt')} icon={Wrench}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="label">
            <LabelText hint={t('Fettmenge pro Sud, passend zu deiner Form. Gilt für Seife am Stück; Rasierseife im Tiegel behält ihre Menge aus dem Rezept.')}>{t('Fett je Sud')}</LabelText>
            <NumberField value={w.batchFat} digits={0} suffix="g" placeholder={t('wie Rezept')} ariaLabel={t('Fettmenge pro Sud')} onChange={(v) => db.settings.put({ key: BATCH_FAT_KEY, value: v || undefined })} />
          </label>
          <label className="label">
            <LabelText hint={t('Was dir eine zusätzliche Bestellung an Aufwand wert ist (Paket annehmen, Überblick behalten). Der Einkauf teilt nur auf, wenn die Ersparnis größer ist. Zählt nicht zum Preis.')}>
              {t('Aufwand je weitere Bestellung')}
            </LabelText>
            <NumberField value={w.extraOrderCost} digits={2} suffix="€" placeholder="0" ariaLabel={t('Aufwand je weitere Bestellung')} onChange={(v) => db.settings.put({ key: EXTRA_ORDER_KEY, value: v || undefined })} />
          </label>
        </div>
      </Panel>

      <Panel title={t('Darstellung')} icon={theme === 'dark' ? Moon : Sun}>
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="sr-only">{t('Design')}</legend>
          {themes.map(([id, icon, title]) => (
            <Choice key={id} name="theme" checked={theme === id} icon={icon} title={title} onSelect={() => setTheme(id)} />
          ))}
        </fieldset>
        <p className="mt-3 text-xs text-muted">{t('Gilt nur auf diesem Gerät.')}</p>
      </Panel>

      <div className="flex flex-wrap gap-3">
        <Link className="btn" to="/sync">
          <Cloud size={16} aria-hidden /> {t('Sync & Konto')}
        </Link>
        <Link className="btn" to="/daten">
          <Database size={16} aria-hidden /> {t('Daten & Sicherung')}
        </Link>
      </div>
    </div>
  )
}
