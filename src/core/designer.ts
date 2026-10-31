import { baseFatId, FATS_BY_ID } from '../data/fats'
import { soapProperties } from './calc'
import { TEMPLATES } from '../data/templates'
import type { DesignRules, RecipeAdditive, RecipeFat, RecipeInput, SoapProperties, TargetProfile } from './types'
import { citrateDose, hardnessRange } from './water'

// Rezept-Assistent: Fettmischung aus Reglern, Seifenart und Vorrat. Die Kennzahlen (SoapCalc-Konvention) sind linear
// in den Fettanteilen, deshalb genügt ein kleines Optimierungsproblem: Abstand zu den Zielwerten plus Preis klein
// halten, unter festen Grenzen (Summe 100 %, Höchstanteile, Laurinsäure-Öle, Linol-/Linolensäure). Gelöst mit
// projiziertem Gradientenabstieg, danach auf wenige Fette ausgedünnt und auf ganze Prozent gerundet.

/** Reglerstellungen 0–1: mild→kräftig, cremig→großblasig, weich→hart, günstig→Preis egal. */
export interface Sliders {
  strength: number
  lather: number
  hardness: number
  price: number
}

export type DesignProcess = 'cold' | 'hot' | 'both'

export interface DesignRequest {
  profile: TargetProfile
  sliders: Sliders
  process: DesignProcess
  /** Überfettung in %: so viel Öl kommt bei Heißverseifung nach dem Kochen dazu. */
  superfat: number
  /** Nur diese Fette verwenden (z. B. was im Vorrat ist); fehlt = alle bevorzugten. */
  available?: ReadonlySet<string>
  excluded?: readonly string[]
  /** Lieblingsöl: kommt mit mindestens 10 % ins Rezept (sofern Grenzen es erlauben). */
  favorite?: string
  /** Preise in €/kg je Fett-Kennung. */
  prices?: Readonly<Record<string, number>>
  maxFats?: number
}

/** Wofür ein Fett im Rezept steht (für die Begründung). */
export type FatRole = 'cleansing' | 'hardness' | 'castor' | 'conditioning'

export interface FatReason {
  fatId: string
  percent: number
  roles: FatRole[]
  /** Steht am Höchstanteil (Fett selbst oder Gruppe der Laurinsäure-Öle). */
  capped: boolean
  favorite: boolean
  afterCook: boolean
  /** Deutlich günstiger als der Schnitt der Kandidaten. */
  cheap: boolean
}

export interface DesignResult {
  fats: RecipeFat[]
  properties: SoapProperties
  targets: Record<TargetKey, number>
  /** Preis der Fettmischung in €/kg, nur wenn alle Preise bekannt sind. */
  costPerKg?: number
  missingPrices: string[]
  reasons: FatReason[]
}

export type DesignOutcome = { ok: true; result: DesignResult } | { ok: false; problem: 'noRules' | 'tooFewFats' }

type TargetKey = 'hardness' | 'cleansing' | 'bubbly' | 'creamy' | 'conditioning'
const KEYS: TargetKey[] = ['hardness', 'cleansing', 'bubbly', 'creamy', 'conditioning']
// Gewichte: Milde ist bei empfindlicher Haut am wichtigsten, Pflege ergibt sich meist von selbst
const WEIGHT: Record<TargetKey, number> = { hardness: 1, cleansing: 1.5, bubbly: 1, creamy: 1, conditioning: 0.3 }
/** Ein Fehler von so vielen Kennzahl-Punkten zählt als 1. */
const SCALE = 5
/** Preisgewicht ganz links („günstig“). */
const PRICE_WEIGHT = 4
const LAURIC_IDS = new Set(['coconut', 'babassu', 'palm-kernel'])
/** Laurinsäure-Öl, auch als eigenes Fett (z. B. „Kokosöl (Aldi)“). */
const LAURIC = { has: (id: string) => LAURIC_IDS.has(baseFatId(id)) }
/** Weniger als das lohnt das Abwiegen nicht. */
const MIN_PERCENT = 4
const FAVORITE_MIN = 10
/** Höchstanteil für ein Lieblingsöl außerhalb der bevorzugten Fette. */
const FOREIGN_MAX = 20
const UNKNOWN_PRICE_FACTOR = 1.3

const lerp = ([a, b]: [number, number], t: number) => a + (b - a) * Math.min(1, Math.max(0, t))

/**
 * Wie stark ein Reglerwunsch zählt: in der Mitte heißt „egal“ (kaum Gewicht), am Rand voll. Sonst ziehen bei
 * Körperseife Härte, cremiger Schaum und Reinigung (dieselben Fettsäuren) gegeneinander und kein Regler wirkt.
 */
export function sliderWeights(s: Sliders): Record<TargetKey, number> {
  const pull = (v: number) => 0.15 + 1.7 * Math.abs(v - 0.5)
  return {
    cleansing: WEIGHT.cleansing * pull(s.strength),
    bubbly: WEIGHT.bubbly * pull(s.lather),
    creamy: WEIGHT.creamy * pull(s.lather),
    hardness: WEIGHT.hardness * pull(s.hardness),
    conditioning: WEIGHT.conditioning,
  }
}

/** Zielwerte aus den Reglern. */
export function designTargets(rules: DesignRules, s: Sliders): Record<TargetKey, number> {
  return {
    cleansing: lerp(rules.targets.cleansing, s.strength),
    bubbly: lerp(rules.targets.bubbly, s.lather),
    creamy: lerp(rules.targets.creamy, s.lather),
    hardness: lerp(rules.targets.hardness, s.hardness),
    conditioning: rules.targets.conditioning ?? NaN,
  }
}

// Kennzahlen eines einzelnen Fetts; ändern sich nie, werden aber bei jedem Probelauf gebraucht
const PROPS_CACHE = new Map<string, SoapProperties>()
function fatProps(id: string): SoapProperties {
  let p = PROPS_CACHE.get(id)
  if (!p) {
    const fat = FATS_BY_ID[id]
    p = soapProperties([{ fat, percent: 100, sapKoh: fat.sapKoh }])
    PROPS_CACHE.set(id, p)
  }
  return p
}

const pufaOf = (id: string) => (FATS_BY_ID[id].fattyAcids.linoleic ?? 0) + (FATS_BY_ID[id].fattyAcids.linolenic ?? 0)

interface Problem {
  ids: string[]
  lb: number[]
  ub: number[]
  /** Kennzahlen je Fett (Zeile = Fett). */
  props: SoapProperties[]
  targets: Record<TargetKey, number>
  weights: Record<TargetKey, number>
  costGrad: number[]
  /** Laurinsäure-Öle: ihre Summe darf `lauricMax` nicht übersteigen (exakt über die Projektion). */
  lauric: boolean[]
  lauricMax: number
  /** Weitere Grenzen lo ≤ Σ coef·x ≤ hi als Strafterm: Zielbereiche der Seifenart, Linol-/Linolensäure, Jodzahl. */
  caps: { coef: number[]; lo?: number; hi?: number }[]
  /** Vorbereitet für die Zielfunktion: je verfolgter Kennzahl Spalte (Kennzahl/100 je Fett), Ziel, Gewicht. */
  fast: { cols: Float64Array[]; tgt: number[]; wt: number[] }
}

function prepare(props: SoapProperties[], targets: Record<TargetKey, number>, weights: Record<TargetKey, number>): Problem['fast'] {
  const keys = KEYS.filter((k) => !Number.isNaN(targets[k]))
  return { cols: keys.map((k) => Float64Array.from(props, (p) => p[k] / 100)), tgt: keys.map((k) => targets[k]), wt: keys.map((k) => weights[k]) }
}

// Je Punkt außerhalb eines Zielbereichs der Seifenart: deutlich teurer als ein verfehlter Reglerwunsch
const PENALTY = 10

function objective(p: Problem, x: number[], g: number[]): number {
  const n = x.length
  const { cols, tgt, wt } = p.fast
  let f = 0
  for (let i = 0; i < n; i++) {
    // Preis plus kleiner Zug zur Verteilung: sonst landet bei gleichwertigen Fetten alles auf einem
    f += p.costGrad[i] * x[i] + 0.5 * (x[i] / 100) ** 2
    g[i] = p.costGrad[i] + x[i] / 1e4
  }
  // Spalten sind schon durch 100 geteilt: Σ x·col = Kennzahl der Mischung
  for (let k = 0; k < cols.length; k++) {
    const col = cols[k]
    let value = 0
    for (let i = 0; i < n; i++) value += x[i] * col[i]
    const err = (value - tgt[k]) / SCALE
    f += wt[k] * err * err
    const d = (2 * wt[k] * err) / SCALE
    for (let i = 0; i < n; i++) g[i] += d * col[i]
  }
  for (const c of p.caps) {
    let v = 0
    for (let i = 0; i < n; i++) v += c.coef[i] * x[i]
    const off = c.hi !== undefined && v > c.hi ? v - c.hi : c.lo !== undefined && v < c.lo ? v - c.lo : 0
    if (off) {
      f += PENALTY * off * off
      for (let i = 0; i < n; i++) g[i] += 2 * PENALTY * off * c.coef[i]
    }
  }
  return f
}

/** Projektion der Einträge `idx` von y auf { lb ≤ x ≤ ub, Σ x = total } (Halbierung über die Verschiebung τ). */
export function projectSum(y: number[], lb: number[], ub: number[], idx: number[], total: number, out: number[]): void {
  // Σ clip(y − τ, lb, ub) ist stückweise linear in τ mit Knicken bei y − ub (Eintrag wird frei) und y − lb
  // (Eintrag liegt fest). Über die sortierten Knicke laufen und das passende Stück direkt lösen: exakt und ohne
  // die 45 Halbierungsschritte, die vorher die Hälfte der Rechenzeit kosteten.
  const events: [number, number][] = []
  let sum = 0
  for (const i of idx) {
    sum += ub[i]
    if (ub[i] > lb[i]) events.push([y[i] - ub[i], 1], [y[i] - lb[i], -1])
  }
  let tau = -Infinity
  if (sum > total) {
    events.sort((a, b) => a[0] - b[0])
    let free = 0
    let at = events.length ? events[0][0] : 0
    tau = at
    for (const [pos, kind] of events) {
      const next = sum - free * (pos - at)
      if (next <= total) {
        tau = at + (sum - total) / free
        break
      }
      sum = next
      at = pos
      tau = pos
      free += kind
    }
  }
  for (const i of idx) out[i] = Math.min(ub[i], Math.max(lb[i], y[i] - tau))
}

/**
 * Projektion auf { lb ≤ x ≤ ub, Σ x = 100, Σ Laurinsäure-Öle ≤ lauricMax }. Verletzt die einfache Projektion die
 * Grenze, liegt die richtige genau auf ihr: dann beide Gruppen getrennt auf ihre feste Summe projizieren.
 */
interface Groups {
  all: number[]
  lauric: number[]
  rest: number[]
}

const groupsOf = (p: Problem): Groups => {
  const all = p.ids.map((_, i) => i)
  return { all, lauric: all.filter((i) => p.lauric[i]), rest: all.filter((i) => !p.lauric[i]) }
}

function project(p: Problem, y: number[], out: number[], g: Groups): void {
  projectSum(y, p.lb, p.ub, g.all, 100, out)
  let lauric = 0
  for (const i of g.lauric) lauric += out[i]
  if (lauric <= p.lauricMax + 1e-9) return
  projectSum(y, p.lb, p.ub, g.lauric, p.lauricMax, out)
  projectSum(y, p.lb, p.ub, g.rest, 100 - p.lauricMax, out)
}

/** Passt die Mischung in die Grenzen (Höchstanteile, Laurinsäure-Öle)? */
function feasible(p: Problem): boolean {
  let rest = 0
  let lauric = 0
  p.ub.forEach((u, i) => (p.lauric[i] ? (lauric += u) : (rest += u)))
  return rest + Math.min(lauric, p.lauricMax) >= 100
}

/**
 * Größte Krümmung (größter Eigenwert der Hesse-Matrix, Strafterme als aktiv gerechnet) per Potenziteration.
 * Die grobe Gershgorin-Schranke lag bei 12 Fetten bis zu zwölfmal zu hoch: entsprechend winzige Schritte.
 */
function curvature(p: Problem): number {
  const n = p.ids.length
  const H = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  for (let i = 0; i < n; i++) {
    H[i][i] += 1 / 1e4
    for (let j = 0; j < n; j++) {
      for (const k of KEYS) if (!Number.isNaN(p.targets[k])) H[i][j] += (2 * p.weights[k] * p.props[i][k] * p.props[j][k]) / 1e4 / (SCALE * SCALE)
      for (const c of p.caps) H[i][j] += 2 * PENALTY * c.coef[i] * c.coef[j]
    }
  }
  let v = new Array<number>(n).fill(1 / Math.sqrt(n))
  let lambda = 0
  for (let it = 0; it < 60; it++) {
    const w = H.map((row) => row.reduce((s, h, j) => s + h * v[j], 0))
    const norm = Math.hypot(...w)
    if (!norm) break
    lambda = norm
    v = w.map((x) => x / norm)
  }
  // Potenziteration nähert sich von unten: Sicherheitszuschlag
  return 1.15 * lambda
}

/** Beschleunigter projizierter Gradientenabstieg (FISTA mit Neustart), Schrittweite aus der Krümmung. */
function solve(p: Problem, start?: number[]): { x: number[]; f: number } {
  const n = p.ids.length
  const L = curvature(p)
  const groups = groupsOf(p)
  const x = new Array<number>(n).fill(0)
  project(p, start ?? p.ub.map((u) => u / 2), x, groups)
  const y = [...x]
  const next = new Array<number>(n).fill(0)
  const g = new Array<number>(n).fill(0)
  const step = y.map(() => 0)
  let f = objective(p, x, g)
  let t = 1
  let stall = 0
  for (let it = 0; it < 1500; it++) {
    objective(p, y, g)
    for (let i = 0; i < n; i++) step[i] = y[i] - g[i] / L
    project(p, step, next, groups)
    const fNext = objective(p, next, g)
    let moved = 0
    for (let i = 0; i < n; i++) moved = Math.max(moved, Math.abs(next[i] - x[i]))
    // Gerundet wird auf ganze Prozent: ein Fünfhundertstel Prozent Bewegung je Schritt ist „angekommen“.
    // Vor dem Neustart prüfen: Am Ziel steigt f durch Rundungsrauschen minimal, das darf keine Endlosschleife werden.
    if (moved < 2e-3) {
      if (fNext <= f) for (let i = 0; i < n; i++) x[i] = next[i]
      f = Math.min(f, fNext)
      break
    }
    if (fNext > f) {
      // Neustart: Schwung bremst nur noch
      t = 1
      for (let i = 0; i < n; i++) y[i] = x[i]
      continue
    }
    // Stillstand (z. B. Pendeln an einer Grenze): kaum noch Gewinn über viele Schritte
    stall = f - fNext < 1e-9 ? stall + 1 : 0
    if (stall > 25) {
      for (let i = 0; i < n; i++) x[i] = next[i]
      f = fNext
      break
    }
    const tNext = (1 + Math.sqrt(1 + 4 * t * t)) / 2
    for (let i = 0; i < n; i++) {
      y[i] = next[i] + ((t - 1) / tNext) * (next[i] - x[i])
      x[i] = next[i]
    }
    t = tNext
    f = fNext
  }
  return { x, f }
}

/** Ganze Prozent mit Summe 100, innerhalb der (ganzzahligen) Grenzen; größte Reste zuerst. */
function roundPercents(x: number[], p: Problem): number[] {
  const { lb, ub } = p
  const r = x.map((v, i) => Math.min(ub[i], Math.max(lb[i], Math.floor(v))))
  let rest = 100 - r.reduce((s, v) => s + v, 0)
  const order = x.map((_, i) => i).sort((a, b) => x[b] - Math.floor(x[b]) - (x[a] - Math.floor(x[a])))
  for (let pass = 0; rest > 0 && pass < 100; pass++)
    for (const i of order) {
      if (rest === 0) break
      if (r[i] < ub[i]) {
        r[i]++
        rest--
      }
    }
  // Runden darf die Grenze der Laurinsäure-Öle nicht reißen: Überschuss auf ein anderes Fett mit Platz schieben
  const lauricSum = () => r.reduce((s, v, i) => s + (p.lauric[i] ? v : 0), 0)
  while (lauricSum() > p.lauricMax) {
    const from = r.findIndex((v, i) => p.lauric[i] && v > lb[i])
    const to = r.findIndex((v, i) => !p.lauric[i] && v > 0 && v < ub[i])
    if (from < 0 || to < 0) break
    r[from]--
    r[to]++
  }
  return r
}

export function designRecipe(req: DesignRequest): DesignOutcome {
  const rules = req.profile.design
  if (!rules) return { ok: false, problem: 'noRules' }
  const excluded = new Set(req.excluded ?? [])
  const usable = (id: string) => FATS_BY_ID[id] && !excluded.has(id) && (!req.available || req.available.has(id))
  const maxOf: Record<string, number> = Object.fromEntries(Object.entries(rules.fats).filter(([id]) => usable(id)))
  const favorite = req.favorite && usable(req.favorite) ? req.favorite : undefined
  if (favorite && maxOf[favorite] === undefined) maxOf[favorite] = FOREIGN_MAX

  // Heißverseifung (oder beides): ein Pflegeöl in Höhe der Überfettung kommt nach dem Kochen dazu
  const sf = Math.round(req.superfat)
  const hotOil = req.process !== 'cold' && sf > 0 ? rules.hotOils.find((id) => id !== favorite && maxOf[id] !== undefined) : undefined

  const ids = Object.keys(maxOf)
  const lb = ids.map((id) => (id === hotOil ? sf : id === favorite ? Math.min(FAVORITE_MIN, maxOf[id]) : 0))
  const ub = ids.map((id) => (id === hotOil ? sf : maxOf[id]))
  const prices = req.prices ?? {}
  const known = ids.map((id) => prices[id]).filter((v): v is number => v !== undefined && v > 0)
  const meanPrice = known.length ? known.reduce((s, v) => s + v, 0) / known.length : 0
  // Unbekannter Preis zählt etwas über dem Schnitt: Was kein Shop führt, ist schwerer zu bekommen
  const priceOf = (id: string) => prices[id] ?? UNKNOWN_PRICE_FACTOR * meanPrice
  const lambda = meanPrice ? (PRICE_WEIGHT * (1 - req.sliders.price)) / meanPrice : 0
  const pufaMax = req.profile.properties.polyunsaturated?.max ?? 15
  const iodineMax = req.profile.properties.iodine?.max

  const targets = designTargets(rules, req.sliders)
  const weights = sliderWeights(req.sliders)
  const props = ids.map(fatProps)
  const fast = prepare(props, targets, weights)
  const build = (active: boolean[]): Problem => ({
    ids,
    lb: lb.map((v, i) => (active[i] ? v : 0)),
    ub: ub.map((v, i) => (active[i] ? v : 0)),
    props,
    targets,
    weights,
    fast,
    costGrad: ids.map((id) => (lambda * priceOf(id)) / 100),
    lauric: ids.map((id) => LAURIC.has(id)),
    lauricMax: rules.lauricMax,
    caps: [
      // Sicherheitsabstand, damit das Runden die Grenze nicht reißt
      { coef: ids.map((id) => pufaOf(id) / 100), hi: pufaMax - 1 },
      ...(iodineMax ? [{ coef: ids.map((id) => FATS_BY_ID[id].iodine / 100), hi: iodineMax - 2 }] : []),
      // Zielbereiche der Seifenart (Gegenprobe), einen Punkt nach innen
      ...KEYS.flatMap((k) => {
        const range = req.profile.properties[k]
        if (!range) return []
        return [{ coef: ids.map((id) => fatProps(id)[k] / 100), lo: range.min !== undefined ? range.min + 1 : undefined, hi: range.max !== undefined ? range.max - 1 : undefined }]
      }),
    ],
  })

  // Ausdünnen, bis alle Anteile sich lohnen und höchstens maxFats übrig sind. Ungenutzte Fette fliegen sofort raus;
  // sonst unter den drei kleinsten das, dessen Fehlen am wenigsten schadet (nicht einfach das kleinste: Rizinus
  // ist mit 7 % klein, trägt aber den Schaum).
  const maxFats = req.maxFats ?? 5
  const fixed = (i: number) => ids[i] === hotOil || ids[i] === favorite
  const active = ids.map(() => true)
  if (!ids.length || !feasible(build(active))) return { ok: false, problem: 'tooFewFats' }
  let { x } = solve(build(active))
  for (;;) {
    ids.forEach((_, i) => {
      if (active[i] && !fixed(i) && x[i] < 0.05) active[i] = false
    })
    const live = active.filter(Boolean).length
    const removable = ids.map((_, i) => i).filter((i) => active[i] && !fixed(i)).sort((a, b) => x[a] - x[b])
    if (!removable.length || (x[removable[0]] >= MIN_PERCENT && live <= maxFats)) break
    let best: { i: number; x: number[]; f: number } | undefined
    for (const i of removable.slice(0, 3)) {
      const trial = [...active]
      trial[i] = false
      const room = build(trial)
      if (!feasible(room)) continue
      const res = solve(room, x.map((v, j) => (j === i ? 0 : v)))
      if (!best || res.f < best.f) best = { i, ...res }
    }
    if (!best) break
    active[best.i] = false
    x = best.x
  }

  const p = build(active)
  const r = roundPercents(x, p)
  const fats: RecipeFat[] = ids
    .map((fatId, i) => ({ fatId, percent: r[i], ...(fatId === hotOil ? { afterCook: true } : {}) }))
    .filter((f) => f.percent > 0)
    .sort((a, b) => b.percent - a.percent)

  const properties = soapProperties(fats.map((f) => ({ fat: FATS_BY_ID[f.fatId], percent: f.percent, sapKoh: FATS_BY_ID[f.fatId].sapKoh })))
  const missingPrices = fats.filter((f) => prices[f.fatId] === undefined).map((f) => f.fatId)
  const costPerKg = missingPrices.length ? undefined : fats.reduce((s, f) => s + (f.percent / 100) * prices[f.fatId], 0)
  const lauricSum = fats.filter((f) => LAURIC.has(f.fatId)).reduce((s, f) => s + f.percent, 0)
  const reasons: FatReason[] = fats.map((f) => ({
    fatId: f.fatId,
    percent: f.percent,
    roles: fatRoles(f.fatId),
    capped: f.fatId !== hotOil && (f.percent >= maxOf[f.fatId] || (LAURIC.has(f.fatId) && lauricSum >= rules.lauricMax)),
    favorite: f.fatId === favorite,
    afterCook: f.fatId === hotOil,
    cheap: prices[f.fatId] !== undefined && meanPrice > 0 && prices[f.fatId] < 0.75 * meanPrice,
  }))
  return { ok: true, result: { fats, properties, targets, costPerKg, missingPrices, reasons } }
}

/** Hauptaufgabe eines Fetts nach seinen Fettsäuren. */
export function fatRoles(id: string): FatRole[] {
  const fa = FATS_BY_ID[id].fattyAcids
  const roles: FatRole[] = []
  if ((fa.lauric ?? 0) + (fa.myristic ?? 0) >= 40) roles.push('cleansing')
  if ((fa.palmitic ?? 0) + (fa.stearic ?? 0) >= 40) roles.push('hardness')
  if ((fa.ricinoleic ?? 0) >= 50) roles.push('castor')
  if (!roles.length) roles.push('conditioning')
  return roles
}

/** Grundseife der Seifenart: liefert Lauge, Überfettung, Wasser und Zusätze für das neue Rezept. */
export function templateFor(profileId: string) {
  return TEMPLATES.find((t) => t.base.profileId === profileId)?.base
}

/**
 * Vollständiges Rezept aus dem Ergebnis. Lauge und Zusätze wie in der Grundseife der Seifenart; Heißverseifung
 * (und „beides“) mit 30 % Laugenkonzentration, damit der gekochte Leim formbar bleibt (Erfahrungswert).
 */
export function designedInput(profileId: string, result: DesignResult, process: DesignProcess, superfat: number, totalFat: number, waterHardness?: number): RecipeInput {
  const base = templateFor(profileId)?.input
  return {
    totalFat,
    fats: result.fats,
    lyeType: base?.lyeType ?? 'NaOH',
    lyePurity: base?.lyePurity ?? 100,
    ...(base?.lyeType === 'dual' ? { kohShare: base.kohShare, kohPurity: base.kohPurity } : {}),
    superfat,
    water: process === 'cold' ? (base?.water ?? { mode: 'concentration', value: 33 }) : { mode: 'concentration', value: 30 },
    additives: adjustCitrate(structuredClone(base?.additives ?? []), result.properties.polyunsaturated, waterHardness),
    ...(process === 'hot' ? { process: 'hot' as const } : {}),
  }
}

/**
 * Zitronensäure der Grundseife an die eigene Wasserhärte anpassen (Menge: Faustregel aus water.ts). Bei weichem
 * Wasser bleibt sie nur, wenn viel Linol-/Linolensäure drin ist: Citrat bindet auch Metallspuren (Ranzigkeit).
 */
export function adjustCitrate(additives: RecipeAdditive[], pufa: number, waterHardness?: number): RecipeAdditive[] {
  const i = additives.findIndex((a) => a.additiveId === 'citric-anhydrous')
  if (waterHardness === undefined || i < 0) return additives
  const dH = waterHardness.toLocaleString('de-DE', { maximumFractionDigits: 1 })
  const dose = citrateDose(waterHardness)
  if (dose > 0) {
    const label = hardnessRange(waterHardness) === 'hard' ? 'hart' : 'mittelhart'
    additives[i] = { ...additives[i], percentOfFats: dose, reason: `Wasser mit ${dH} °dH (${label}): Natriumcitrat bindet einen Teil von Ca/Mg im Schaum, weniger Kalkseife. Menge nach Faustregel.` }
    return additives
  }
  if (pufa > 10) {
    additives[i] = { ...additives[i], percentOfFats: 1, reason: `Weiches Wasser (${dH} °dH), aber viel Linol-/Linolensäure: Citrat bindet Metallspuren und bremst Ranzigkeit.` }
    return additives
  }
  return additives.filter((_, j) => j !== i)
}
