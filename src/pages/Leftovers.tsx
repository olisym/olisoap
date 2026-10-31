import { FlaskConical, Wand2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { OutflowForm } from '../components/OutflowForm'
import { Chip, EmptyState, Panel } from '../components/ui'
import { addDays, needsOf } from '../core/batch'
import { calculate } from '../core/calc'
import { fatsAtRisk, soapLeftovers } from '../core/leftover'
import { FATS_BY_ID } from '../data/fats'
import { db } from '../db'
import { fmt } from '../format'
import { atBatchSize, de, today, useWorkshop } from '../hooks'

const HORIZON_DAYS = 90

/** Was weg sollte, bevor es verdirbt: fertige Seife und Fette, die bald ablaufen. */
export function Leftovers() {
  const { t } = useTranslation()
  const w = useWorkshop()
  const [open, setOpen] = useState<string>()
  const now = today()
  const soon = addDays(now, HORIZON_DAYS)

  const soaps = useMemo(() => (w ? soapLeftovers(w.batches, now) : []), [w, now])
  const fats = useMemo(() => {
    if (!w) return []
    const recipes = w.recipes.flatMap((r) => {
      try {
        return [{ id: r.id, name: r.name, needs: needsOf(calculate(atBatchSize(r, w.batchFat).input)) }]
      } catch {
        return []
      }
    })
    return fatsAtRisk(w.inventory, recipes, now, HORIZON_DAYS, (k) => FATS_BY_ID[k.slice(4)]?.name ?? k)
  }, [w, now])

  if (!w) return null
  const ready = soaps.filter((s) => s.ready).reduce((n, s) => n + s.left, 0)
  const curing = soaps.filter((s) => !s.ready).reduce((n, s) => n + s.left, 0)

  return (
    <div className="space-y-6">
      <p className="text-muted">
        {t('Was weg sollte, bevor es verdirbt. Oben steht, was zuerst dran ist.')}
      </p>

      <Panel title={t('Seife')} action={soaps.length > 0 ? <Chip>{t('{{ready}} fertig · {{curing}} reifen', { ready, curing })}</Chip> : undefined}>
        {soaps.length === 0 ? (
          <p className="text-sm text-muted">{t('Keine Seife auf Lager.')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {soaps.map((s) => {
              const tone = s.bestUse < now ? 'bad' : s.bestUse < soon ? 'warn' : undefined
              return (
                <li key={s.batchId} className="py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Link to={`/chargen/${s.batchId}`} className="min-w-0 flex-1 hover:text-accent">
                      <span className="font-medium">{s.name}</span> <span className="text-sm text-muted">{t('Charge {{n}}', { n: s.number })}</span>
                    </Link>
                    <span className="text-xl font-semibold tabular-nums">
                      {s.left} <span className="text-sm font-normal text-muted">{t('Stück')}</span>
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                    {s.ready ? <Chip tone="ok">{t('reif')}</Chip> : <Chip>{t('reif ab {{date}}', { date: de(s.readyDate) })}</Chip>}
                    <Chip tone={tone}>{s.bestUse < now ? t('verwenden bis {{date}}: überschritten', { date: de(s.bestUse) }) : t('am besten bis {{date}}', { date: de(s.bestUse) })}</Chip>
                    <button type="button" className="ml-auto min-h-11 text-accent underline" aria-expanded={open === s.batchId} onClick={() => setOpen(open === s.batchId ? undefined : s.batchId)}>
                      {open === s.batchId ? t('Schließen') : t('Ausbuchen')}
                    </button>
                  </div>
                  {open === s.batchId && (
                    <div className="mt-2">
                      <OutflowForm
                        max={s.left}
                        onAdd={async (o) => {
                          const b = await db.batches.get(s.batchId)
                          if (b) await db.batches.update(b.id, { outflows: [...b.outflows, o] })
                          setOpen(undefined)
                        }}
                      />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">{t('„Am besten bis“ vom Etikett, sonst Vorschlag aus dem MHD der Fette und dem Anteil an Linolsäure (Faustregel).')}</p>
      </Panel>

      <Panel title={t('Fette, die bald ablaufen')} action={fats.length > 0 ? <Chip tone="warn">{t('{{n}} in 3 Monaten', { n: fats.length })}</Chip> : undefined}>
        {fats.length === 0 ? (
          <p className="text-sm text-muted">{t('Kein Fett läuft in den nächsten 3 Monaten ab.')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {fats.map((f) => {
              const best = f.uses[0]
              // Schafft man es mit dem Rezept bis zum Ablauf? Sonst: Rezept mit mehr davon entwerfen
              const inTime = !!best && best.batches <= f.possibleBatches
              const sude = (n: number) => t('{{count}} Sude', { count: n, defaultValue_one: '{{count}} Sud', defaultValue_other: '{{count}} Sude' })
              return (
                <li key={f.key} className="py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="min-w-0 flex-1 font-medium">{f.name}</span>
                    <span className="text-xl font-semibold tabular-nums">
                      {fmt(f.grams)} <span className="text-sm font-normal text-muted">g</span>
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                    <Chip tone={f.until < now ? 'bad' : 'warn'}>
                      {f.until < now ? t('abgelaufen seit {{date}}', { date: de(f.until) }) : t('bis {{date}}', { date: de(f.until) })}
                    </Chip>
                    <span className="text-muted">{f.reason === 'opened' ? t('offen, Haltbarkeit nach Faustregel') : t('MHD')}</span>
                  </div>
                  {f.until >= now && (
                    <div className="mt-2 space-y-2 text-sm">
                      {best ? (
                        <p>
                          {t('{{name}} braucht {{g}} g je Sud, also {{sude}} bis aufgebraucht.', { name: best.name, g: fmt(best.gramsPerBatch), sude: sude(best.batches) })}{' '}
                          <span className="text-muted">
                            {inTime ? t('Bis zum Ablauf zu schaffen.') : t('Bis zum Ablauf gehen etwa {{sude}} (ein Sud alle zwei Monate).', { sude: sude(f.possibleBatches) })}
                          </span>
                        </p>
                      ) : (
                        <p className="text-muted">{t('Kein Rezept nutzt dieses Fett.')}</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {best && (
                          <Link className={inTime ? 'btn-primary min-h-11' : 'btn min-h-11'} to={`/sieden/${best.recipeId}`}>
                            <FlaskConical size={16} aria-hidden /> {t('{{name}} sieden', { name: best.name })}
                          </Link>
                        )}
                        {!inTime && (
                          <Link className="btn-primary min-h-11" to={`/entwickeln?fett=${f.key.slice(4)}`}>
                            <Wand2 size={16} aria-hidden /> {t('Rezept mit mehr {{name}} entwerfen', { name: f.name })}
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                  {f.until < now && <p className="mt-2 text-sm text-muted">{t('Das MHD ist kein Verfallsdatum: Riecht das Fett scharf, nach alter Nuss oder Farbe, ist es ranzig und nicht mehr für Seife geeignet.')}</p>}
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      {soaps.length === 0 && fats.length === 0 && <EmptyState icon={FlaskConical} title={t('Nichts übrig')}>{t('Weder Seife auf Lager noch ablaufende Fette.')}</EmptyState>}
    </div>
  )
}
