// Wasserhärte. Belegt: Härtebereiche nach § 9 Wasch- und Reinigungsmittelgesetz (WRMG) und die Umrechnung
// 1 mmol/l Calciumcarbonat = 5,6 °dH. Dass Citrat Calcium und Magnesium bindet und so weniger Kalkseife entsteht,
// ist gut belegte Chemie. Wie viel Zitronensäure bei welcher Härte, ist dagegen eine Faustregel aus der Praxis.

export type HardnessRange = 'soft' | 'medium' | 'hard'

/** °dH je mmol/l Gesamthärte (als Calciumcarbonat). */
export const DH_PER_MMOL = 5.6

/** Grenzen nach WRMG: weich < 1,5 mmol/l (8,4 °dH), mittel bis 2,5 mmol/l (14 °dH), darüber hart. */
export const SOFT_MAX_DH = 8.4
export const MEDIUM_MAX_DH = 14
/** Früherer Härtebereich 4 („sehr hart“) des WRMG vor 2007. */
export const VERY_HARD_DH = 21

export function hardnessRange(dH: number): HardnessRange {
  return dH < SOFT_MAX_DH ? 'soft' : dH <= MEDIUM_MAX_DH ? 'medium' : 'hard'
}

export const mmolToDh = (mmol: number) => mmol * DH_PER_MMOL
export const dhToMmol = (dH: number) => dH / DH_PER_MMOL

/**
 * Zitronensäure (wasserfrei) in % der Fette gegen Kalkseife, Faustregel: weich keine, mittel 1 %, hart 1,5 %,
 * sehr hart 2 %. Unabhängig davon bindet Citrat Metallspuren und bremst so Ranzigkeit (siehe Gegenprobe).
 */
export function citrateDose(dH: number): number {
  if (dH >= VERY_HARD_DH) return 2
  return { soft: 0, medium: 1, hard: 1.5 }[hardnessRange(dH)]
}
