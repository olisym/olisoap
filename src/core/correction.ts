import { sapBasis, sapValue, superfatFor, type RecipeResult } from './calc'

// Korrekturrechner: Ist-Einwaage weicht vom Plan ab. Die Lauge ist evtl. schon angesetzt.

export interface ActualWeights {
  /** Tatsächlich eingewogene Fettmengen, Index wie in result.fats. Fehlende Einträge = wie geplant. */
  fatGrams?: (number | undefined)[]
  /** Tatsächlich eingewogene Lauge (Rohware inkl. Unreinheit). Fehlt = wie geplant. */
  lyeWeighed?: number
}

export interface Correction {
  actualFatTotal: number
  /** Lauge für die Ist-Fette bei 0 % Überfettung (rein). */
  lyeFullActual: number
  /** Lauge, die für die Ist-Fette bei der geplanten Überfettung einzuwiegen wäre (inkl. Säuren, Reinheit). */
  lyeWeighedRequired: number
  lyeWeighedActual: number
  /** Überfettung, wenn nichts korrigiert wird. */
  superfatActual: number
  /** Option A: so viel Lauge nachgeben (negativ = zu viel Lauge, dann Option B). */
  addLye: number
  /** Wasser, das mit der nachgegebenen Lauge die Konzentration hält. */
  addWater: number
  /** Option B (zu viel Lauge): alle Fette um diesen Faktor erhöhen, um die Überfettung zu halten. */
  fatScale: number
  addFatGrams: number[]
}

export function correct(result: RecipeResult, actual: ActualWeights): Correction {
  const { input } = result
  // Verhältnis reine Lauge : Einwaage, gilt auch für Mischlauge (feste Mischung).
  const purity = result.lyeWeighed > 0 ? result.lyePure / result.lyeWeighed : 1
  const sf = input.superfat / 100

  const fatGrams = result.fats.map((l, i) => actual.fatGrams?.[i] ?? l.grams)
  const lyeFullActual = result.fats.reduce(
    (s, l, i) => s + fatGrams[i] * sapValue(l.sapKoh, sapBasis(input.lyeType)),
    0,
  )
  const lyeWeighedRequired = (lyeFullActual * (1 - sf) + result.lyeForAdditives) / purity
  const lyeWeighedActual = actual.lyeWeighed ?? result.lyeWeighed

  // Säuren verbrauchen ihren Anteil zuerst, der Rest steht den Fetten zur Verfügung.
  const lyePureForFats = lyeWeighedActual * purity - result.lyeForAdditives
  const superfatActual = superfatFor(lyeFullActual, lyePureForFats)

  const addLye = lyeWeighedRequired - lyeWeighedActual
  const waterPerLye = result.lyeWeighed > 0 ? result.water / result.lyeWeighed : 0

  // Wie viel Fett insgesamt nötig wäre, damit die vorhandene Lauge wieder die Ziel-Überfettung ergibt.
  const lyeFullNeeded = lyePureForFats / (1 - sf)
  const fatScale = lyeFullActual > 0 ? Math.max(1, lyeFullNeeded / lyeFullActual) : 1

  return {
    actualFatTotal: fatGrams.reduce((s, g) => s + g, 0),
    lyeFullActual,
    lyeWeighedRequired,
    lyeWeighedActual,
    superfatActual,
    addLye,
    addWater: addLye > 0 ? addLye * waterPerLye : 0,
    fatScale,
    addFatGrams: fatGrams.map((g) => g * (fatScale - 1)),
  }
}
