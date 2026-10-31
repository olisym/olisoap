import { useSyncExternalStore } from 'react'

// Laufendes Sieden, auf dem Gerät gesichert (localStorage, nicht synchronisiert): Neu laden, Update oder ein
// versehentlicher Tipp auf die Leiste verlieren keine Häkchen, Ist-Gewichte oder die Stoppuhr. Beendet wird nur mit
// „Charge speichern“ oder bewusst mit „Abbrechen“.

const KEY = 'olisoap-sieden'
/** Älter als drei Tage: niemand siedet so lange, dann ist es ein vergessener Rest. */
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000
const EVENT = 'olisoap-sieden'

export interface SiedeSession {
  recipeId: string
  recipeName: string
  savedAt: number
  step: number
  totalFat?: number
  checked: string[]
  actual: Record<string, number | undefined>
  lyeTemp?: number
  fatTemp?: number
  notes: string
  date: string
  cureWeeks?: number
  deduct: boolean
  view?: 'steps' | 'list'
  guideIndex: number
  cookStart?: number
  feedback: Record<string, string | undefined>
  feedbackNote: string
}

function read(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

let cachedRaw: string | null = null
let cached: SiedeSession | undefined

export function loadSession(): SiedeSession | undefined {
  const raw = read()
  if (raw === cachedRaw) return cached
  cachedRaw = raw
  try {
    const s = raw ? (JSON.parse(raw) as SiedeSession) : undefined
    cached = s && Date.now() - s.savedAt < MAX_AGE_MS ? s : undefined
  } catch {
    cached = undefined
  }
  return cached
}

export function saveSession(s: Omit<SiedeSession, 'savedAt'>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...s, savedAt: Date.now() }))
  } catch {
    // Ohne Speicher (privater Modus) gilt der Stand nur, solange die Seite offen ist.
  }
  window.dispatchEvent(new Event(EVENT))
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // siehe oben
  }
  window.dispatchEvent(new Event(EVENT))
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange)
  // Andere Tabs desselben Geräts
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

/** Laufendes Sieden, live (auch aus anderen Tabs). */
export function useSession(): SiedeSession | undefined {
  return useSyncExternalStore(subscribe, loadSession)
}
