import type { Additive } from '../core/types'

// Säuren verbrauchen Lauge: n(Säuregruppen) × M(NaOH bzw. KOH) / M(Säure).
// Zitronensäure ist dreiprotonig: 3 × 40,00 / 192,12 = 0,6246 g NaOH pro g (wasserfrei).
const NAOH = 40.0
const KOH = 56.11
const acid = (molarMass: number, protons: number) => ({
  NaOH: (protons * NAOH) / molarMass,
  KOH: (protons * KOH) / molarMass,
})

export const ADDITIVES: Additive[] = [
  {
    id: 'citric-anhydrous',
    name: 'Zitronensäure (wasserfrei)',
    phase: 'lye',
    neutralizes: acid(192.12, 3),
    typicalPercent: [1, 3],
    purpose: 'Bildet mit der Lauge Natriumcitrat. Das bindet Calcium und Magnesium aus hartem Wasser und verringert Kalkseife (Schmierfilm).',
    evidence: 'Komplexbildung von Citrat mit Ca²⁺/Mg²⁺ ist gut belegte Chemie. Wie stark der Effekt bei der Anwendung ist, hängt von der Wasserhärte ab.',
  },
  {
    id: 'citric-monohydrate',
    name: 'Zitronensäure (Monohydrat)',
    phase: 'lye',
    neutralizes: acid(210.14, 3),
    typicalPercent: [1, 3],
    purpose: 'Wie wasserfreie Zitronensäure, aber mit Kristallwasser (verbraucht etwas weniger Lauge pro Gramm).',
    evidence: 'Siehe wasserfreie Zitronensäure.',
  },
  {
    id: 'sodium-citrate',
    name: 'Natriumcitrat (Trinatriumcitrat-Dihydrat)',
    phase: 'lye',
    typicalPercent: [1, 3],
    purpose: 'Kalkseifen-Blocker, ohne Laugenverbrauch und ohne Hitzeentwicklung beim Lösen.',
    evidence: 'Gleiche Wirkung wie Zitronensäure plus Lauge, nur ohne Umrechnung.',
  },
  {
    id: 'sodium-lactate-60',
    name: 'Natriumlaktat (60 % Lösung)',
    phase: 'lye',
    waterFraction: 0.4,
    density: 1.33,
    typicalPercent: [1, 3],
    purpose: 'Härtere Seife früher aus der Form, leichteres Schneiden.',
    evidence: 'Härtender Effekt in der Praxis gut reproduzierbar. Pflegewirkung auf die Haut nach dem Abspülen kaum relevant.',
  },
  {
    id: 'kaolin',
    name: 'Weiße Tonerde (Kaolin)',
    phase: 'trace',
    typicalPercent: [1, 3],
    purpose: 'Verändert das Hautgefühl beim Waschen (Gleitfähigkeit), etwas cremigerer Schaum.',
    evidence: 'Wirkung auf das Schaumgefühl ist eine Praxiserfahrung, belastbare Studien zur Hautwirkung in Seife fehlen.',
  },
  {
    id: 'silk-protein',
    name: 'Seidenprotein (flüssig)',
    phase: 'trace',
    typicalPercent: [0.5, 2],
    purpose: 'Seidigeres Schaumgefühl.',
    evidence: 'Belege für eine Hautwirkung in einem abgespülten, alkalischen Produkt fehlen weitgehend. Wird von Siedern subjektiv geschätzt.',
  },
  {
    id: 'glycerin',
    name: 'Glycerin (pflanzlich, 99,5 %)',
    phase: 'trace',
    density: 1.26,
    typicalPercent: [3, 10],
    purpose: 'Rasierseife: weichere Seife im Tiegel, leichteres Aufnehmen mit dem Pinsel, gleitfähigerer Schaum. In Körperseife meist überflüssig, Glycerin entsteht beim Verseifen ohnehin.',
    evidence: 'Feuchthaltende Wirkung von Glycerin ist gut belegt. Der Effekt auf den Rasierschaum ist Praxiserfahrung, aber gut reproduzierbar.',
  },
  {
    id: 'salt',
    name: 'Kochsalz',
    phase: 'lye',
    typicalPercent: [0.5, 1],
    purpose: 'Härtere Seife (kleine Mengen).',
    evidence: 'Härtender Effekt praktisch belegt, größere Mengen verringern den Schaum.',
  },
  {
    id: 'sugar',
    name: 'Zucker',
    phase: 'lye',
    typicalPercent: [0.5, 2],
    purpose: 'Mehr Schaum.',
    evidence: 'Schaumverstärkung praktisch gut reproduzierbar.',
  },
]

export const ADDITIVES_BY_ID: Record<string, Additive> = Object.fromEntries(ADDITIVES.map((a) => [a.id, a]))
