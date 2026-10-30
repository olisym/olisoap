import { FATS_BY_ID } from '../data/fats'
import type { MaterialKey } from './inventory'

// Haltbarkeit offener Fette als Faustregel. Grundlage ist gut belegte Chemie: Mehrfach ungesättigte Fettsäuren
// oxidieren um ein Vielfaches schneller als Ölsäure (Linolsäure grob 10- bis 40-mal, Linolensäure noch schneller).
// Die Monatswerte selbst sind Erfahrungswerte für kühle, dunkle, gut verschlossene Lagerung, keine Messwerte.

/** Angenommener Rhythmus: ein Sud alle zwei Monate. Daraus folgt, wie viel man in der Haltbarkeit verbraucht. */
export const MONTHS_PER_BATCH = 2

/** Monate, die ein geöffnetes Fett ungefähr hält; undefined = kein relevantes Verderben (Lauge, Säuren, Salz). */
export function shelfMonths(key: MaterialKey): number | undefined {
  const [kind, id] = key.split(':')
  if (kind !== 'fat') return undefined
  const fa = FATS_BY_ID[id]?.fattyAcids
  if (!fa) return 12
  const pufa = (fa.linoleic ?? 0) + 2 * (fa.linolenic ?? 0)
  if (pufa < 5) return 24
  if (pufa < 15) return 18
  if (pufa < 30) return 12
  if (pufa < 50) return 9
  return 6
}

/**
 * Größte sinnvolle Packung für einen Bedarf: nicht mehr, als man innerhalb der Haltbarkeit verbraucht,
 * bei einem Sud alle zwei Monate. Mindestens der Bedarf selbst.
 */
export function shelfLifeCap(key: MaterialKey, shortfall: number): number | undefined {
  const months = shelfMonths(key)
  return months === undefined ? undefined : shortfall * Math.max(1, months / MONTHS_PER_BATCH)
}
