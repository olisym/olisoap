const cache = new Map<number, Intl.NumberFormat>()

/** Zahl im deutschen Format, standardmäßig ganzzahlig. */
export function fmt(n: number, digits = 0): string {
  let f = cache.get(digits)
  if (!f) {
    f = new Intl.NumberFormat('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    cache.set(digits, f)
  }
  return f.format(n)
}

/** Akzeptiert Komma und Punkt als Dezimaltrennzeichen. */
export function parseNumber(s: string): number | undefined {
  const t = s.trim().replace(',', '.')
  if (t === '') return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}
