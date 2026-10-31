import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Outflow, OutflowKind } from '../db'
import { today } from '../hooks'
import { NumberField } from './NumberField'

/** Beschriftung der Abgangsarten, an einer Stelle für Charge und „Übrig“. */
export function useOutflowKinds(): Record<OutflowKind, string> {
  const { t } = useTranslation()
  return { own: t('selbst benutzt'), gift: t('verschenkt'), swap: t('getauscht'), sold: t('verkauft'), discarded: t('entsorgt') }
}

/** Stücke ausbuchen: Anzahl, wohin, freie Notiz. Ohne Empfänger (keine Namen Dritter in den Daten). */
export function OutflowForm({ max, onAdd }: { max: number; onAdd: (o: Outflow) => void }) {
  const { t } = useTranslation()
  const kinds = useOutflowKinds()
  const [count, setCount] = useState<number | undefined>(1)
  const [kind, setKind] = useState<OutflowKind>('own')
  const [note, setNote] = useState('')
  const valid = !!count && count > 0 && count <= max
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NumberField className="w-24" value={count} digits={0} suffix={t('Stk')} ariaLabel={t('Anzahl')} onChange={setCount} />
      <select className="field w-40" value={kind} aria-label={t('Wohin')} onChange={(e) => setKind(e.target.value as OutflowKind)}>
        {(Object.keys(kinds) as OutflowKind[]).map((k) => (
          <option key={k} value={k}>
            {kinds[k]}
          </option>
        ))}
      </select>
      <input className="field min-w-0 basis-full sm:basis-0 sm:flex-1" placeholder={t('Notiz (freiwillig)')} value={note} onChange={(e) => setNote(e.target.value)} />
      <button
        className="btn"
        disabled={!valid}
        onClick={() => {
          onAdd({ date: today(), count: count!, kind, note: note || undefined })
          setNote('')
          setCount(1)
        }}
      >
        {t('Ausbuchen')}
      </button>
    </div>
  )
}
