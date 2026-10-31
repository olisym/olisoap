import { useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'

/** Hell/dunkel; gilt je Gerät (localStorage), `index.html` setzt es vor dem ersten Zeichnen. */
export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme as Theme) || 'dark')
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('olisoap-theme', theme)
    } catch {
      // Ohne Speicher gilt das Design nur für diese Sitzung.
    }
  }, [theme])
  return [theme, setTheme]
}
