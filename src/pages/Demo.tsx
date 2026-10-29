import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../components/ui'
import { db } from '../db'
import { importSalandiaCatalog, isCatalog } from '../import/salandiaCatalog'
import { FlaskConical } from 'lucide-react'

// Demo-Link (#/demo): lädt einen Beispiel-Katalog und öffnet den Einkauf mit einer Grundseife.
// Die Datei demo/katalog.json liegt nur auf dem Server, nicht im Repository (keine gescrapten Kataloge im Repo).
// Vorhandene Daten werden nie angefasst: Gibt es schon Artikel, wird nichts importiert.

export function Demo() {
  const navigate = useNavigate()
  const [error, setError] = useState<string>()

  useEffect(() => {
    void (async () => {
      try {
        if ((await db.products.count()) === 0) {
          const res = await fetch(`${import.meta.env.BASE_URL}demo/katalog.json`)
          const data = res.ok ? await res.json() : undefined
          if (!isCatalog(data)) throw new Error('Auf diesem Server liegen keine Beispieldaten.')
          await db.products.bulkAdd(importSalandiaCatalog(data, []).products)
        }
        navigate('/einkauf?rezept=vorlage-koerperseife&faktor=1', { replace: true })
      } catch (e) {
        setError((e as Error).message)
      }
    })()
  }, [navigate])

  return error ? (
    <EmptyState icon={FlaskConical} title="Demo nicht verfügbar">
      {error}
    </EmptyState>
  ) : (
    <p className="text-muted">Beispieldaten werden geladen …</p>
  )
}
