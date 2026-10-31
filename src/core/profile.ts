/** Bedienmodus: Einsteiger sehen weniger Profi-Felder und mehr Erklärung. Rechnung und Daten bleiben gleich. */
export type Mode = 'einsteiger' | 'experte'

/**
 * Gewählter Modus, sonst abgeleitet: Wer schon Chargen hat, siedet offenbar und bekommt alle Felder.
 * Absichtlich wird beim ersten Start nichts gespeichert, damit ein frisches Gerät beim Sync keine gewählte
 * Einstellung überschreibt (lokale Fassung gewinnt).
 */
export function effectiveMode(stored: unknown, batchCount: number): Mode {
  if (stored === 'einsteiger' || stored === 'experte') return stored
  return batchCount > 0 ? 'experte' : 'einsteiger'
}
