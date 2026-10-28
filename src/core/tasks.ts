import { addDays, cureStatus, type Weighing } from './batch'

// Was ist heute zu tun? Aufgaben ergeben sich aus dem Stand jeder Charge, nicht aus einer separaten Aufgabenliste.

export interface BatchState {
  id: string
  name: string
  number: string
  date: string
  readyDate: string
  /** Tiegelware: kein Ausformen/Schneiden. */
  tub: boolean
  unmoldedAt?: string
  weighings: Weighing[]
  tested?: boolean
  labeledAt?: string
  barsLeft: number
}

export type TaskKind = 'cut' | 'weigh' | 'test' | 'label'

export interface Task {
  batchId: string
  kind: TaskKind
  due: string
  title: string
  detail: string
}

/** Ausformen und Schneiden typischerweise 24–48 h nach dem Sieden. */
export const CUT_AFTER_DAYS = 1

export function batchTasks(b: BatchState, today: string): Task[] {
  if (b.barsLeft <= 0) return []
  const t = (kind: TaskKind, due: string, title: string, detail: string): Task => ({ batchId: b.id, kind, due, title, detail })
  const out: Task[] = []
  const formed = b.tub || !!b.unmoldedAt

  if (!formed) {
    const due = addDays(b.date, CUT_AFTER_DAYS)
    if (due <= today) out.push(t('cut', due, `${b.name} ausformen & schneiden`, `Charge ${b.number}, Stücke zählen und wiegen`))
    return out
  }

  const cure = cureStatus(b.weighings)
  if (b.readyDate > today || !cure.stable) {
    const last = b.weighings.map((w) => w.date).sort().at(-1)
    const due = last ? addDays(last, 7) : (b.unmoldedAt ?? b.date)
    if (due <= today && !(b.readyDate <= today && cure.stable)) out.push(t('weigh', due, `${b.name} wiegen`, `Charge ${b.number}, Probestück`))
  }
  if (b.readyDate <= today && !b.tested) out.push(t('test', b.readyDate, `${b.name} prüfen`, `Charge ${b.number}, Zungen- oder pH-Test`))
  if (b.tested && !b.labeledAt) out.push(t('label', b.readyDate, `${b.name} etikettieren`, `Charge ${b.number}`))
  return out
}

export function allTasks(batches: BatchState[], today: string): Task[] {
  return batches.flatMap((b) => batchTasks(b, today)).sort((a, b) => a.due.localeCompare(b.due))
}
