/**
 * Liest Gewichte aus beliebigem Text, z. B. aus einer Spracheingabe ("128 Absatz 134 … 121").
 * Komma und Punkt gelten als Dezimaltrenner. Werte außerhalb des plausiblen Bereichs werden verworfen.
 */
export function parseWeights(text: string, min = 10, max = 2000): number[] {
  return (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((t) => Number(t.replace(',', '.'))).filter((n) => n >= min && n <= max)
}
