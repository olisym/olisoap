import { useEffect, useState } from 'react'
import { parseNumber } from '../format'

/** Ohne Tausenderpunkte und ohne überflüssige Nullen, damit sich der Wert bequem bearbeiten lässt. */
function display(v: number | undefined, digits: number): string {
  if (v === undefined) return ''
  const f = 10 ** digits
  return String(Math.round(v * f) / f).replace('.', ',')
}

interface Props {
  value: number | undefined
  onChange: (value: number | undefined) => void
  digits?: number
  suffix?: string
  placeholder?: string
  className?: string
  ariaLabel?: string
}

/** Zahleneingabe, die Komma versteht und beim Tippen nicht springt. */
export function NumberField({ value, onChange, digits = 2, suffix, placeholder, className = '', ariaLabel }: Props) {
  const [text, setText] = useState(display(value, digits))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(display(value, digits))
  }, [value, focused, digits])

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <input
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        placeholder={placeholder}
        className="field w-full text-right tabular-nums"
        value={text}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setText(e.target.value)
          const n = parseNumber(e.target.value)
          if (n !== undefined || e.target.value.trim() === '') onChange(n)
        }}
      />
      {suffix && <span className="text-sm text-muted">{suffix}</span>}
    </span>
  )
}
