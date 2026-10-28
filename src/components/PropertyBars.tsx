import { PROPERTY_LABELS, formatRange, inRange } from '../core/evaluate'
import type { PropertyKey, SoapProperties, TargetProfile } from '../core/types'
import { fmt } from '../format'

const SCALE: Record<PropertyKey, number> = {
  hardness: 100,
  cleansing: 100,
  conditioning: 100,
  bubbly: 100,
  creamy: 100,
  iodine: 150,
  ins: 300,
  polyunsaturated: 50,
}

const ORDER: PropertyKey[] = ['hardness', 'cleansing', 'conditioning', 'bubbly', 'creamy', 'polyunsaturated', 'iodine', 'ins']

export function PropertyBars({ properties, profile }: { properties: SoapProperties; profile?: TargetProfile }) {
  return (
    <dl className="space-y-2">
      {ORDER.map((key) => {
        const value = properties[key]
        const range = profile?.properties[key]
        const ok = !range || inRange(value, range)
        const max = SCALE[key]
        const pct = (v: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`
        return (
          <div key={key} className="grid grid-cols-[9.5rem_1fr_3rem] items-center gap-2 text-sm">
            <dt className="text-muted">{PROPERTY_LABELS[key]}</dt>
            <dd className="relative h-3 rounded-full bg-track">
              {range && (
                <span
                  className="absolute inset-y-0 rounded-full bg-emerald-500/25"
                  style={{ left: pct(range.min ?? 0), right: `calc(100% - ${pct(range.max ?? max)})` }}
                  title={`Ziel: ${formatRange(range)}`}
                />
              )}
              <span
                className={`absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded ${ok ? 'bg-ink' : 'bg-amber-500'}`}
                style={{ left: pct(value) }}
              />
            </dd>
            <dd className={`text-right tabular-nums ${ok ? '' : 'font-semibold text-amber-600 dark:text-amber-400'}`}>
              {fmt(value)}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
