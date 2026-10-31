/** Kurze Rückmeldung je Schritt der Anleitung, für Leute, die nicht viele Worte machen. */
export type Feedback = 'clear' | 'much' | 'unclear'

/** Rückmeldung als kurzer Text zum Weiterschicken (Messenger, Mail). Kein Server: Der Nutzer entscheidet, wohin. */
export function feedbackText(opts: { recipe: string; build: string; feedback: Partial<Record<string, Feedback>>; titles: Record<string, string>; note: string; labels: Record<Feedback, string>; header: string; noteLabel: string }): string {
  const lines = [opts.header, opts.recipe]
  for (const f of ['unclear', 'much', 'clear'] as Feedback[]) {
    const steps = Object.entries(opts.feedback)
      .filter(([, v]) => v === f)
      .map(([k]) => opts.titles[k])
    if (steps.length) lines.push(`${opts.labels[f]}: ${steps.join(', ')}`)
  }
  if (opts.note.trim()) lines.push(`${opts.noteLabel}: ${opts.note.trim()}`)
  lines.push(`Build ${opts.build}`)
  return lines.join('\n')
}
