import { ArrowLeft, ArrowRight, Check, CircleCheck, FlaskConical, Printer, ShoppingCart, Timer, TriangleAlert, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { NumberField } from '../components/NumberField'
import { Chip, EmptyState, PageHeader, Panel } from '../components/ui'
import { feasibility, needsOf, planConsumption } from '../core/batch'
import { calculate, type RecipeResult } from '../core/calc'
import { correct } from '../core/correction'
import { buildGuide, type StepKind } from '../core/guide'
import { materialStock } from '../core/inventory'
import { PROFILES_BY_ID } from '../data/profiles'
import { createBatch, type Recipe } from '../db'
import { fmt } from '../format'
import { atBatchSize, groupRecipes, recipeFeasibility, today, useExpert, useFeedbackMode, useWorkshop } from '../hooks'
import { feedbackText, type Feedback } from '../core/feedback'
import { clearSession, loadSession, saveSession } from '../session'
import { GuidedSieden } from './GuidedSieden'
import { useStepContent } from './guideContent'

const STEPS = ['Rezept', 'Menge & Vorrat', 'Sieden', 'Abschluss'] as const

function Stepper({ step }: { step: number }) {
  return (
    <ol className="mb-6 grid grid-cols-4 gap-2" aria-label="Fortschritt">
      {STEPS.map((s, i) => (
        <li key={s} className="flex flex-col gap-1.5" aria-current={i === step ? 'step' : undefined}>
          <span className={`h-1 rounded-full ${i <= step ? 'bg-accent' : 'bg-track'}`} />
          <span className={`text-xs font-medium ${i === step ? 'text-accent' : i < step ? 'text-ink' : 'text-muted'}`}>
            {i + 1}. {s}
          </span>
        </li>
      ))}
    </ol>
  )
}

/** Schritt 1: Rezept wählen. */
export function SiedenStart() {
  const w = useWorkshop()
  if (!w) return null
  const families = groupRecipes(w.recipes)
  return (
    <div>
      <PageHeader eyebrow="Sieden" title="Welche Seife heute?" />
      <Stepper step={0} />
      {families.length === 0 && <EmptyState icon={FlaskConical} title="Noch keine Rezepte" action={<Link className="btn-primary" to="/rezepte">Zu den Rezepten</Link>} />}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {families.map(({ base, variants }) => (
          <section key={base.id} className="card flex flex-col gap-2">
            {[base, ...variants].map((r, i) => {
              const f = recipeFeasibility(r, w.inventory, w.batchFat)
              return (
                <Link
                  key={r.id}
                  to={`/sieden/${r.id}`}
                  className={`group flex items-center gap-3 rounded-xl p-3 transition hover:bg-surface-2 ${i === 0 ? '' : 'ml-4 border-l border-line'}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className={`truncate group-hover:text-accent ${i === 0 ? 'text-lg font-semibold' : 'font-medium'}`}>{r.name}</p>
                    <p className="truncate text-xs text-muted">{r.description}</p>
                  </div>
                  {f && (f.count > 0 ? <Chip tone="ok">Vorrat ok</Chip> : <Chip tone="warn">{f.missing.length} fehlt</Chip>)}
                  <ArrowRight size={18} className="text-muted group-hover:text-accent" aria-hidden />
                </Link>
              )
            })}
          </section>
        ))}
      </div>
    </div>
  )
}

/** Schritte 2–4 für ein gewähltes Rezept. */
export function SiedenRun() {
  const { id } = useParams()
  const w = useWorkshop()
  const recipe = w?.recipes.find((r) => r.id === id)
  if (!w) return null
  if (!recipe) return <EmptyState icon={FlaskConical} title="Rezept nicht gefunden" action={<Link className="btn" to="/sieden">Zurück</Link>} />
  return <Run key={recipe.id} recipe={recipe} w={w} />
}

function Run({ recipe, w }: { recipe: Recipe; w: NonNullable<ReturnType<typeof useWorkshop>> }) {
  const navigate = useNavigate()
  // Unterbrochenes Sieden dieses Rezepts (Neu laden, Update, anderer Bildschirm): genau dort weitermachen
  const [saved] = useState(() => {
    const s = loadSession()
    return s?.recipeId === recipe.id ? s : undefined
  })
  const [step, setStep] = useState(saved?.step ?? 1)
  // Startmenge: eigene Sudgröße (z. B. passend zur Form), sonst die Menge aus dem Rezept.
  const size = atBatchSize(recipe, w.batchFat).input.totalFat
  const [totalFat, setTotalFat] = useState<number | undefined>(saved ? saved.totalFat : size)
  const [checked, setChecked] = useState<Set<string>>(() => new Set(saved?.checked ?? []))
  const [actual, setActual] = useState<Record<string, number | undefined>>(saved?.actual ?? {})
  const [lyeTemp, setLyeTemp] = useState<number | undefined>(saved?.lyeTemp)
  const [fatTemp, setFatTemp] = useState<number | undefined>(saved?.fatTemp)
  const [notes, setNotes] = useState(saved?.notes ?? '')
  const [date, setDate] = useState(saved?.date ?? today())
  const [cureWeeks, setCureWeeks] = useState<number | undefined>(saved ? saved.cureWeeks : recipe.input.lyeType === 'dual' ? 2 : recipe.input.process === 'hot' ? 3 : 5)
  const [deduct, setDeduct] = useState(saved?.deduct ?? true)
  const [busy, setBusy] = useState(false)
  // Schritt für Schritt (Einsteiger) oder Liste (Experte); umschalten behält Häkchen und Ist-Werte
  const { t } = useTranslation()
  const expert = useExpert()
  const [chosenView, setView] = useState<'steps' | 'list' | undefined>(saved?.view)
  const view = chosenView ?? (expert ? 'list' : 'steps')
  const [guideIndex, setGuideIndex] = useState(saved?.guideIndex ?? 0)
  const [cookStart, setCookStart] = useState<number | undefined>(saved?.cookStart)
  const [feedback, setFeedbackState] = useState<Partial<Record<StepKind, Feedback>>>((saved?.feedback as Partial<Record<StepKind, Feedback>>) ?? {})
  const [feedbackNote, setFeedbackNote] = useState(saved?.feedbackNote ?? '')

  // Ab „Los geht’s“ jeden Stand sichern
  useEffect(() => {
    if (step < 2) return
    saveSession({ recipeId: recipe.id, recipeName: recipe.name, step, totalFat, checked: [...checked], actual, lyeTemp, fatTemp, notes, date, cureWeeks, deduct, view: chosenView, guideIndex, cookStart, feedback, feedbackNote })
  }, [recipe.id, recipe.name, step, totalFat, checked, actual, lyeTemp, fatTemp, notes, date, cureWeeks, deduct, chosenView, guideIndex, cookStart, feedback, feedbackNote])

  // Beim Sieden bleibt der Bildschirm an (Screen Wake Lock); nach dem Zurückkehren in die App neu anfordern
  useEffect(() => {
    if (step !== 2 || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | undefined
    const acquire = () => {
      if (document.visibilityState === 'visible') void navigator.wakeLock.request('screen').then((l) => (lock = l)).catch(() => undefined)
    }
    acquire()
    document.addEventListener('visibilitychange', acquire)
    return () => {
      document.removeEventListener('visibilitychange', acquire)
      void lock?.release().catch(() => undefined)
    }
  }, [step])

  /** Mit dem Sieden anfangen; läuft noch ein anderes, erst fragen. */
  function begin() {
    const other = loadSession()
    if (other && other.recipeId !== recipe.id && !confirm(t('Es läuft noch „{{name}}“. Verwerfen und hier neu anfangen?', { name: other.recipeName }))) return
    setStep(2)
  }

  function abort() {
    if (!confirm(t('Sieden abbrechen? Häkchen und Ist-Gewichte gehen verloren.'))) return
    clearSession()
    navigate('/sieden')
  }
  const [shared, setShared] = useState(false)
  const stepContent = useStepContent()
  const feedbackMode = useFeedbackMode()

  const scaled: Recipe = useMemo(() => ({ ...recipe, input: { ...recipe.input, totalFat: totalFat || 0 } }), [recipe, totalFat])
  const result = useMemo(() => calculate(scaled.input), [scaled])
  const needs = needsOf(result)
  const feas = feasibility(w.inventory, needs)
  const plan = planConsumption(w.inventory, needs)
  const ratio = recipe.input.totalFat ? calculate(recipe.input).batchWeight / recipe.input.totalFat : 1.4
  const bars = Math.floor(result.batchWeight / (recipe.barWeight ?? 100))
  const profile = recipe.profileId ? PROFILES_BY_ID[recipe.profileId] : undefined
  const guide = useMemo(() => buildGuide(result, profile?.usage), [result, profile])
  const printLink = totalFat === recipe.input.totalFat ? `/rezepte/${recipe.id}/anleitung` : undefined

  async function shareFeedback() {
    const text = feedbackText({
      header: t('Rückmeldung zu olisoap'),
      recipe: `${recipe.name} (${recipe.input.process === 'hot' ? t('heiß') : t('kalt')})`,
      build: __BUILD__,
      feedback,
      titles: Object.fromEntries(guide.steps.map((s) => [s.kind, stepContent(guide, s).title])),
      labels: { clear: t('Klar'), much: t('Zu viel auf einmal'), unclear: t('Unklar') },
      note: feedbackNote,
      noteLabel: t('Notiz'),
    })
    // Teilen-Menü des Geräts (Messenger, Mail); sonst in die Zwischenablage
    if (navigator.share) await navigator.share({ text }).catch(() => undefined)
    else await navigator.clipboard?.writeText(text)
    setShared(true)
  }

  /** Im Einkauf mit diesem Rezept und dieser Menge als Bedarf weitermachen. */
  function planMissing() {
    // Im Einkauf zählt ein Sud in der eigenen Sudgröße.
    const factor = size ? (totalFat || 0) / size : 1
    navigate(`/einkauf?rezept=${recipe.id}&faktor=${Math.round(factor * 100) / 100}`)
  }

  async function finish() {
    setBusy(true)
    const batch = await createBatch(scaled, {
      date,
      cureWeeks: cureWeeks ?? 0,
      deductStock: deduct,
      extra: { lyeTemp, fatTemp, notes: notes || undefined },
    })
    clearSession()
    navigate(`/chargen/${batch.id}`)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Sieden"
        title={recipe.name}
        actions={
          step === 1 ? (
            <Link className="btn-ghost" to="/sieden">
              <ArrowLeft size={18} /> {t('Anderes Rezept')}
            </Link>
          ) : (
            <button className="btn-ghost text-muted" onClick={abort}>
              <X size={18} /> {t('Abbrechen')}
            </button>
          )
        }
      />
      {saved && step >= 2 && (
        <p className="mb-4 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
          {t('Weiter, wo du aufgehört hast (Stand {{time}}).', { time: new Date(saved.savedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) })}
        </p>
      )}
      <Stepper step={step} />

      {step === 1 && (
        <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
          <Panel title="Menge">
            <div className="space-y-4">
              <label className="label">
                Fettmenge
                <NumberField value={totalFat} digits={0} suffix="g" onChange={setTotalFat} className="text-2xl" />
              </label>
              <label className="label">
                oder Stückzahl ({fmt(recipe.barWeight ?? 100)} g frisch)
                <NumberField value={bars} digits={0} suffix="Stück" onChange={(v) => v && setTotalFat(Math.round((v * (recipe.barWeight ?? 100)) / ratio))} />
              </label>
              <div className="grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
                <div>
                  <p className="eyebrow">Leim</p>
                  <p className="text-xl font-semibold tabular-nums">{fmt(result.batchWeight)} g</p>
                </div>
                <div>
                  <p className="eyebrow">Kosten</p>
                  <p className="text-xl font-semibold tabular-nums">{fmt(plan.cost, 2)} €</p>
                </div>
              </div>
            </div>
          </Panel>

          <Panel
            title="Vorrats-Check"
            action={feas.missing.length === 0 ? <Chip tone="ok">Alles da</Chip> : <Chip tone="warn">{feas.missing.length} fehlt</Chip>}
          >
            <ul className="divide-y divide-line">
              {needs.map((n) => {
                const stock = materialStock(w.inventory, n.key)
                const ok = stock >= n.grams
                return (
                  <li key={n.key} className="flex items-center gap-3 py-2.5">
                    {ok ? <CircleCheck size={18} className="text-ok" aria-label="vorhanden" /> : <TriangleAlert size={18} className="text-warn" aria-label="fehlt" />}
                    <span className="min-w-0 flex-1 truncate">{n.name}</span>
                    <span className="tabular-nums">{fmt(n.grams, n.grams < 100 ? 1 : 0)} g</span>
                    <span className={`w-24 text-right text-sm tabular-nums ${ok ? 'text-muted' : 'text-warn'}`}>{fmt(stock)} g da</span>
                  </li>
                )
              })}
            </ul>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {feas.missing.length > 0 && (
                <button className="btn" onClick={planMissing}>
                  <ShoppingCart size={18} /> Fehlendes auf Einkaufsliste
                </button>
              )}
              <button className="btn-primary" disabled={!totalFat} onClick={begin}>
                Los geht’s <ArrowRight size={18} />
              </button>
            </div>
          </Panel>
        </div>
      )}

      {step === 2 && (
        <div className="mb-5 flex justify-center">
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface-2 p-1" role="group" aria-label={t('Ansicht')}>
            {(
              [
                ['steps', t('Schritt für Schritt')],
                ['list', t('Liste')],
              ] as const
            ).map(([v, label]) => (
              <button key={v} type="button" aria-pressed={view === v} className={`min-h-11 rounded-lg px-4 text-sm font-medium ${view === v ? 'bg-accent text-accent-ink' : 'text-muted hover:text-ink'}`} onClick={() => setView(v)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && view === 'steps' && (
        <GuidedSieden
          guide={guide}
          result={result}
          index={Math.min(guideIndex, guide.steps.length - 1)}
          setIndex={setGuideIndex}
          checked={checked}
          toggle={(k) => setChecked((s) => (s.has(k) ? new Set([...s].filter((x) => x !== k)) : new Set([...s, k])))}
          actual={actual}
          setActual={(k, v) => setActual((a) => ({ ...a, [k]: v }))}
          temps={{ lyeTemp, fatTemp, setLyeTemp, setFatTemp }}
          cookStart={cookStart}
          setCookStart={setCookStart}
          feedbackMode={feedbackMode}
          feedback={feedback}
          setFeedback={(k, f) => setFeedbackState((x) => ({ ...x, [k]: f }))}
          printLink={printLink}
          onBack={() => setStep(1)}
          onDone={() => setStep(3)}
        />
      )}

      {step === 2 && view === 'list' && (
        <SiedeModus
          cook={{ start: cookStart, setStart: setCookStart }}
          result={result}
          checked={checked}
          toggle={(k) => setChecked((s) => (s.has(k) ? new Set([...s].filter((x) => x !== k)) : new Set([...s, k])))}
          actual={actual}
          setActual={(k, v) => setActual((a) => ({ ...a, [k]: v }))}
          temps={{ lyeTemp, fatTemp, setLyeTemp, setFatTemp }}
          notes={recipe.notes}
          worksheet={totalFat === recipe.input.totalFat ? `/rezepte/${recipe.id}/druck` : undefined}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <div className="mx-auto max-w-xl">
          <Panel title="Charge anlegen">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="label">
                Siededatum
                <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label className="label">
                Reifezeit
                <NumberField value={cureWeeks} digits={0} suffix="Wochen" onChange={setCureWeeks} />
              </label>
              <label className="label sm:col-span-2">
                Notizen
                <textarea className="field min-h-24" placeholder="Spur nach … Minuten, Gelphase, Auffälligkeiten" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
              <label className="flex min-h-11 items-center gap-3 text-sm sm:col-span-2">
                <input type="checkbox" className="size-5 accent-[var(--color-accent)]" checked={deduct} onChange={(e) => setDeduct(e.target.checked)} />
                Verbrauch aus dem Vorrat abbuchen
              </label>
            </div>
            {Object.values(feedback).some(Boolean) && (
              <div className="mt-6 space-y-3 rounded-xl border border-line bg-surface-2 p-4">
                <p className="font-medium">{t('Deine Rückmeldung zu den Schritten')}</p>
                <label className="label">
                  {t('Was war schwierig? (freiwillig)')}
                  <textarea className="field min-h-20" value={feedbackNote} onChange={(e) => setFeedbackNote(e.target.value)} />
                </label>
                <button className="btn" onClick={shareFeedback}>
                  {shared ? t('Geteilt bzw. kopiert') : t('Rückmeldung teilen')}
                </button>
              </div>
            )}
            <div className="mt-6 flex justify-between gap-2">
              <button className="btn-ghost" onClick={() => setStep(2)}>
                <ArrowLeft size={18} /> Zurück
              </button>
              <button className="btn-primary" disabled={busy} onClick={finish}>
                <Check size={18} /> Charge speichern
              </button>
            </div>
          </Panel>
        </div>
      )}
    </div>
  )
}

interface ModusProps {
  cook: { start?: number; setStart: (t: number) => void }
  result: RecipeResult
  checked: Set<string>
  toggle: (key: string) => void
  actual: Record<string, number | undefined>
  setActual: (key: string, v: number | undefined) => void
  temps: { lyeTemp?: number; fatTemp?: number; setLyeTemp: (v?: number) => void; setFatTemp: (v?: number) => void }
  notes?: string
  /** Link zum Arbeitsblatt, nur wenn die Menge dem gespeicherten Rezept entspricht. */
  worksheet?: string
  onBack: () => void
  onNext: () => void
}

/** Großer, gut lesbarer Siede-Modus: abhaken, Ist-Werte eintragen, sofort nachrechnen. */
function SiedeModus({ cook, result, checked, toggle, actual, setActual, temps, notes, worksheet, onBack, onNext }: ModusProps) {
  const r = result
  const acids = r.additives.filter((a) => a.additive.phase === 'lye' && a.lyeConsumed > 0)
  const lyeExtras = r.additives.filter((a) => a.additive.phase === 'lye' && a.lyeConsumed === 0)
  const fatExtras = r.additives.filter((a) => a.additive.phase === 'fats')
  const trace = r.additives.filter((a) => a.additive.phase === 'trace')
  // Heißverseifung: zurückgehaltene Fette und die Zusätze der Spur kommen erst nach dem Kochen.
  const hot = r.input.process === 'hot'
  const afterCook = new Set(r.input.fats.filter((f) => hot && f.afterCook).map((f) => f.fatId))

  const item = (k: string, name: string, grams: number, hint?: string, editable?: boolean) => (
    <ChecklistItem
      key={k}
      name={name}
      grams={grams}
      hint={hint}
      done={checked.has(k)}
      onToggle={() => toggle(k)}
      actual={editable ? actual[k] : undefined}
      onActual={editable ? (v) => setActual(k, v) : undefined}
    />
  )

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Phase A · Lauge">
          <ul className="space-y-2">
            {item('water', 'Wasser (destilliert)', r.water)}
            {acids.map((a) => (
              item(`add:${a.additive.id}`, a.additive.name, a.grams, 'Zuerst im kalten Wasser lösen')
            ))}
            {r.lyeParts.map((p) => (
              item(`lye:${p.type}`, p.type, p.weighed, 'Langsam ins Wasser, nie umgekehrt', r.lyeParts.length === 1)
            ))}
            {lyeExtras.map((a) => (
              item(`add:${a.additive.id}`, a.additive.name, a.grams, 'In die abgekühlte Lauge')
            ))}
          </ul>
        </Panel>
        <Panel title="Phase B · Fette">
          <ul className="space-y-2">
            {r.fats
              .filter((l) => !afterCook.has(l.fat.id))
              .map((l) => item(`fat:${l.fat.id}`, l.fat.name, l.grams, undefined, true))}
            {fatExtras.map((a) => (
              item(`add:${a.additive.id}`, a.additive.name, a.grams)
            ))}
          </ul>
        </Panel>
      </div>

      <CorrectionNote result={r} actual={actual} />

      <div className="grid gap-6 xl:grid-cols-2">
        {hot && <CookPanel checked={checked} toggle={toggle} start={cook.start} setStart={cook.setStart} />}
        {hot && (afterCook.size > 0 || trace.length > 0) && (
          <Panel title="Phase D · Nach dem Kochen">
            <p className="mb-3 text-sm text-muted">Etwas abkühlen lassen (ca. 70 °C), einrühren, zügig in die Form drücken und aufklopfen.</p>
            <ul className="space-y-2">
              {r.fats
                .filter((l) => afterCook.has(l.fat.id))
                .map((l) => item(`fat:${l.fat.id}`, l.fat.name, l.grams, 'Überfettungsöl', true))}
              {trace.map((a) => item(`add:${a.additive.id}`, a.additive.name, a.grams))}
            </ul>
          </Panel>
        )}
        {!hot && trace.length > 0 && (
          <Panel title="Phase C · In die Spur">
            <ul className="space-y-2">
              {trace.map((a) => (
                item(`add:${a.additive.id}`, a.additive.name, a.grams)
              ))}
            </ul>
          </Panel>
        )}
        <Panel title="Protokoll">
          <div className="grid grid-cols-2 gap-4">
            <label className="label">
              Temperatur Lauge
              <NumberField value={temps.lyeTemp} digits={0} suffix="°C" onChange={temps.setLyeTemp} />
            </label>
            <label className="label">
              Temperatur Fette
              <NumberField value={temps.fatTemp} digits={0} suffix="°C" onChange={temps.setFatTemp} />
            </label>
          </div>
          {notes && <p className="mt-4 rounded-lg bg-surface-2 p-3 text-sm text-muted">{notes}</p>}
        </Panel>
      </div>

      <div className="flex flex-wrap justify-between gap-2">
        <button className="btn-ghost" onClick={onBack}>
          <ArrowLeft size={18} /> Menge ändern
        </button>
        <div className="flex gap-2">
          {worksheet && (
            <Link className="btn" to={worksheet}>
              <Printer size={18} /> Arbeitsblatt
            </Link>
          )}
          <button className="btn-primary" onClick={onNext}>
            Fertig gesiedet <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

/** Ist-Gewichte weichen ab: sofort sagen, was nachzugeben ist (oder dass es passt). */
export function CorrectionNote({ result: r, actual }: { result: RecipeResult; actual: Record<string, number | undefined> }) {
  const fatActual = r.fats.map((l) => actual[`fat:${l.fat.id}`])
  const lyeActual = r.lyeParts.length === 1 ? actual[`lye:${r.lyeParts[0].type}`] : undefined
  if (!fatActual.some((v) => v !== undefined) && lyeActual === undefined) return null
  const c = correct(r, { fatGrams: fatActual, lyeWeighed: lyeActual })
  return (
    <div className={`card ${Math.abs(c.addLye) < 0.05 ? '' : 'panel-glow'}`} role="status">
      <p className="eyebrow mb-2">Abweichung erkannt</p>
      {Math.abs(c.addLye) < 0.05 ? (
        <p>Passt, keine Korrektur nötig. Überfettung {fmt(c.superfatActual, 1)} %.</p>
      ) : c.addLye > 0 ? (
        <p className="text-lg">
          <b>{fmt(c.addLye, 1)} g {r.lyeParts.map((p) => p.type).join(' + ')}</b> und <b>{fmt(c.addWater, 1)} g Wasser</b> nachgeben,
          <span className="text-muted"> oder so lassen: {fmt(c.superfatActual, 1)} % Überfettung.</span>
        </p>
      ) : (
        <p className="text-lg">
          Zu viel Lauge: Fette um <b>{fmt((c.fatScale - 1) * 100, 1)} %</b> erhöhen (
          {r.fats.map((l, i) => `+${fmt(c.addFatGrams[i], 1)} g ${l.fat.name}`).join(', ')}).
          {c.superfatActual < 0 && <span className="text-bad"> Ohne Korrektur bleibt freie Lauge!</span>}
        </p>
      )}
    </div>
  )
}

interface ItemProps {
  /** Wofür das Häkchen steht, für Screenreader („abgewogen“, „dazugegeben“). */
  doneLabel?: string
  name: string
  grams: number
  hint?: string
  done: boolean
  onToggle: () => void
  actual?: number
  onActual?: (v: number | undefined) => void
}

export function ChecklistItem({ doneLabel = 'abgewogen', name, grams, hint, done, onToggle, actual, onActual }: ItemProps) {
  return (
    <li className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 transition ${done ? 'border-ok/40 bg-ok/5' : 'border-line bg-surface-2'}`}>
      <button
        className={`grid size-11 shrink-0 place-items-center rounded-xl border-2 transition ${done ? 'border-ok bg-ok text-accent-ink' : 'border-line hover:border-accent'}`}
        onClick={onToggle}
        aria-pressed={done}
        aria-label={`${name} ${doneLabel}`}
      >
        {done && <Check size={22} />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`font-medium [overflow-wrap:anywhere] ${done ? 'text-muted line-through' : ''}`}>{name}</p>
        {hint && <p className="truncate text-xs text-muted">{hint}</p>}
      </div>
      <span className={`text-2xl font-semibold tabular-nums sm:text-3xl ${done ? 'text-muted' : ''}`}>
        {fmt(grams, grams < 100 ? 1 : 0)}
        <span className="ml-1 text-base font-normal text-muted">g</span>
      </span>
      {/* Auf dem Handy in eigener Zeile, sonst bleibt vom Namen nur „Na…“ */}
      {onActual && (
        <span className="w-full pl-14 sm:w-28 sm:pl-0">
          <NumberField value={actual} digits={1} placeholder="Ist" ariaLabel={`${name} Ist-Wert`} onChange={onActual} />
        </span>
      )}
    </li>
  )
}

/** Stadien beim Kochen des Leims, in der Reihenfolge, in der man sie sieht. */
const COOK_STAGES: { key: string; name: string; hint: string }[] = [
  { key: 'cook:trace', name: 'Leichte Spur', hint: 'Mixen wie beim Kaltverfahren, dann Deckel drauf' },
  { key: 'cook:gel', name: 'Gel-Stadium', hint: 'Ränder werden glasig, Leim steigt auf: umrühren, Hitze runter' },
  { key: 'cook:vaseline', name: 'Vaseline-Stadium', hint: 'Durchscheinend, zäh, glänzend wie Kartoffelbrei mit Vaseline' },
  { key: 'cook:test', name: 'pH-Test', hint: 'Teststreifen auf angefeuchteten Leim: pH 9–10 ist normal. Deutlich darüber: weiterkochen' },
]

interface CookProps {
  checked: Set<string>
  toggle: (key: string) => void
  /** Startzeit der Stoppuhr; liegt beim Aufrufer, damit sie beim Blättern weiterläuft. */
  start?: number
  setStart: (t: number) => void
  stages?: { key: string; name: string; hint: string }[]
  title?: string
  /** Kurzer Hinweis oben; in der Schritt-Ansicht steht er schon im Schritttext. */
  intro?: boolean
}

/** Heißverseifung: Stadien abhaken und Kochzeit stoppen. Kochen bei ca. 80 °C im Wasserbad oder Slow Cooker. */
export function CookPanel({ checked, toggle, start, setStart, stages = COOK_STAGES, title = 'Phase C · Kochen', intro = true }: CookProps) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!start) return
    const t = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [start])
  const minutes = start ? Math.floor((now - start) / 60_000) : 0
  return (
    <Panel
      title={title}
      action={
        start ? (
          <span className="text-2xl font-semibold tabular-nums">{minutes} min</span>
        ) : (
          <button
            className="btn-primary"
            onClick={() => {
              setStart(Date.now())
              setNow(Date.now())
            }}
          >
            <Timer size={18} /> Kochen startet
          </button>
        )
      }
    >
      {intro && <p className="mb-3 text-sm text-muted">Ca. 80 °C, Deckel drauf, nicht unbeaufsichtigt: Der Leim kann aufsteigen. Meist 45–90 Minuten.</p>}
      <ul className="space-y-2">
        {stages.map((s) => (
          <li key={s.key} className={`flex items-center gap-3 rounded-xl border p-3 transition ${checked.has(s.key) ? 'border-ok/40 bg-ok/5' : 'border-line bg-surface-2'}`}>
            <button
              className={`grid size-11 shrink-0 place-items-center rounded-xl border-2 transition ${checked.has(s.key) ? 'border-ok bg-ok text-accent-ink' : 'border-line hover:border-accent'}`}
              onClick={() => toggle(s.key)}
              aria-pressed={checked.has(s.key)}
              aria-label={`${s.name} erreicht`}
            >
              {checked.has(s.key) && <Check size={22} />}
            </button>
            <div className="min-w-0 flex-1">
              <p className={`font-medium ${checked.has(s.key) ? 'text-muted line-through' : ''}`}>{s.name}</p>
              <p className="text-xs text-muted">{s.hint}</p>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
