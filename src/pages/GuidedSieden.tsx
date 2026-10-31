import { ArrowLeft, ArrowRight, Check, Printer, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { NumberField } from '../components/NumberField'
import type { RecipeResult } from '../core/calc'
import type { Feedback } from '../core/feedback'
import type { Guide, StepKind } from '../core/guide'
import { ChecklistItem, CookPanel, CorrectionNote } from './Sieden'
import { useCookStages, useStepContent } from './guideContent'


export interface GuidedProps {
  guide: Guide
  result: RecipeResult
  index: number
  setIndex: (i: number) => void
  checked: Set<string>
  toggle: (key: string) => void
  actual: Record<string, number | undefined>
  setActual: (key: string, v: number | undefined) => void
  temps: { lyeTemp?: number; fatTemp?: number; setLyeTemp: (v?: number) => void; setFatTemp: (v?: number) => void }
  cookStart?: number
  setCookStart: (t: number) => void
  /** Rückmeldeknöpfe nur im Testmodus (Profil). */
  feedbackMode: boolean
  feedback: Partial<Record<StepKind, Feedback>>
  setFeedback: (kind: StepKind, f: Feedback | undefined) => void
  /** Anleitung zum Ausdrucken, nur wenn die Menge dem gespeicherten Rezept entspricht. */
  printLink?: string
  onBack: () => void
  onDone: () => void
}

/** Sieden Schritt für Schritt: ein Schritt je Bildschirm, große Schrift, Mengen aus dem Rezept. */
export function GuidedSieden(p: GuidedProps) {
  const { t } = useTranslation()
  const content = useStepContent()
  const stages = useCookStages()
  const top = useRef<HTMLDivElement>(null)
  const step = p.guide.steps[p.index]
  const c = content(p.guide, step)
  const last = p.index === p.guide.steps.length - 1
  const gateOpen = (c.gate ?? []).every((g) => p.checked.has(g.key))

  // Neuer Schritt: oben anfangen, sonst steht man auf dem Handy mitten im nächsten Text
  useEffect(() => {
    top.current?.scrollIntoView({ block: 'start' })
  }, [p.index])

  // Beim Abwiegen heißt das Häkchen „abgewogen“, danach „dazugegeben“; Ist-Gewichte gelten für beide
  const weigh = step.kind === 'weigh'
  // Ist-Werte erst auf Wunsch: Wer richtig gewogen hat, braucht die Felder nicht (weniger auf einmal)
  const [showActual, setShowActual] = useState(() => Object.values(p.actual).some((v) => v !== undefined))
  const itemKey = (key: string) => (weigh ? `weigh:${key}` : key)
  const feedbackOptions: [Feedback, string][] = [
    ['clear', t('Klar')],
    ['much', t('Zu viel auf einmal')],
    ['unclear', t('Unklar')],
  ]

  return (
    <div ref={top} className="mx-auto max-w-2xl scroll-mt-4 space-y-5">
      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm text-muted">
          <span>{t('Schritt {{n}} von {{total}}', { n: p.index + 1, total: p.guide.steps.length })}</span>
          {p.printLink && (
            <Link className="inline-flex min-h-11 items-center gap-1.5 hover:text-ink" to={p.printLink}>
              <Printer size={16} aria-hidden /> {t('Anleitung drucken')}
            </Link>
          )}
        </div>
        <div className="flex gap-1" aria-hidden>
          {p.guide.steps.map((s, i) => (
            <span key={s.kind} className={`h-1 flex-1 rounded-full ${i <= p.index ? 'bg-accent' : 'bg-track'}`} />
          ))}
        </div>
      </div>

      <section className="card space-y-4" aria-labelledby="guide-title">
        <h2 id="guide-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {c.title}
        </h2>
        {c.intro && <p className="text-lg">{c.intro}</p>}
        {c.bullets.length > 0 && (
          <ul className="space-y-2.5 text-lg leading-snug">
            {c.bullets.map((b, i) => (
              <li key={i} className="flex gap-3">
                <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-accent" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
        {c.warn && (
          <p className="flex gap-3 rounded-xl border border-warn/50 bg-warn/10 p-3 text-base">
            <TriangleAlert size={20} className="mt-0.5 shrink-0 text-warn" aria-hidden />
            <span>{c.warn}</span>
          </p>
        )}

        {step.items.length > 0 && (
          <ul className="space-y-2">
            {step.items.map((i) => (
              <ChecklistItem
                key={i.key}
                doneLabel={weigh ? t('abgewogen') : t('dazugegeben')}
                name={i.name}
                grams={i.grams}
                done={p.checked.has(itemKey(i.key))}
                onToggle={() => p.toggle(itemKey(i.key))}
                actual={weigh && showActual && i.editable ? p.actual[i.key] : undefined}
                onActual={weigh && showActual && i.editable ? (v) => p.setActual(i.key, v) : undefined}
              />
            ))}
          </ul>
        )}
        {weigh && !showActual && (
          <button type="button" className="min-h-11 text-left text-sm text-accent underline" onClick={() => setShowActual(true)}>
            {t('Etwas weicht ab? Ist-Gewicht eintragen')}
          </button>
        )}
        {weigh && <CorrectionNote result={p.result} actual={p.actual} />}

        {step.kind === 'temperature' && (
          <div className="grid grid-cols-2 gap-4">
            <label className="label">
              {t('Lauge')}
              <NumberField value={p.temps.lyeTemp} digits={0} suffix="°C" onChange={p.temps.setLyeTemp} />
            </label>
            <label className="label">
              {t('Fette')}
              <NumberField value={p.temps.fatTemp} digits={0} suffix="°C" onChange={p.temps.setFatTemp} />
            </label>
          </div>
        )}

        {step.kind === 'cook' && <CookPanel checked={p.checked} toggle={p.toggle} start={p.cookStart} setStart={p.setCookStart} stages={stages} title={t('Stadien')} intro={false} />}

        {c.gate && (
          <div className="space-y-2">
            {c.gate.map((g) => (
              <label key={g.key} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3 text-lg ${p.checked.has(g.key) ? 'border-ok/40 bg-ok/5' : 'border-line bg-surface-2'}`}>
                <input type="checkbox" className="size-6 accent-[var(--color-accent)]" checked={p.checked.has(g.key)} onChange={() => p.toggle(g.key)} />
                {g.label}
              </label>
            ))}
          </div>
        )}

        {c.note && <p className="text-sm text-muted">{c.note}</p>}
      </section>

      <div className="flex items-center justify-between gap-3">
        <button className="btn-ghost min-h-12" onClick={() => (p.index === 0 ? p.onBack() : p.setIndex(p.index - 1))}>
          <ArrowLeft size={18} /> {p.index === 0 ? t('Menge ändern') : t('Zurück')}
        </button>
        <button className="btn-primary min-h-12 px-6 text-lg" disabled={!gateOpen} onClick={() => (last ? p.onDone() : p.setIndex(p.index + 1))}>
          {last ? (
            <>
              <Check size={20} /> {t('Fertig gesiedet')}
            </>
          ) : (
            <>
              {t('Weiter')} <ArrowRight size={20} />
            </>
          )}
        </button>
      </div>
      {!gateOpen && <p className="text-right text-sm text-muted">{t('Erst abhaken, dann geht es weiter.')}</p>}

      {p.feedbackMode && (
        <fieldset className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <legend className="sr-only">{t('Wie war dieser Schritt?')}</legend>
          <span className="mr-1 text-sm text-muted" aria-hidden>
            {t('Wie war dieser Schritt?')}
          </span>
          {feedbackOptions.map(([f, label]) => {
            const on = p.feedback[step.kind] === f
            return (
              <button key={f} type="button" aria-pressed={on} className={`min-h-11 rounded-full border px-3 text-sm ${on ? 'border-accent bg-accent/15 text-accent' : 'border-line text-muted hover:text-ink'}`} onClick={() => p.setFeedback(step.kind, on ? undefined : f)}>
                {label}
              </button>
            )
          })}
        </fieldset>
      )}
    </div>
  )
}
