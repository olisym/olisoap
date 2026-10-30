import { FlaskConical } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../components/ui'
import { DEMO_SHOPS, demoCatalog } from '../demo/catalog'
import { loadDemoScenario } from '../demo/scenario'
import { db } from '../db'

// Demo-Link (#/demo): legt erfundene Beispiel-Shops und eine Beispiel-Werkstatt (Vorrat, Chargen, Einkauf) an
// und öffnet die Übersicht. Vorhandene Daten werden nie angefasst: Gibt es schon Artikel, passiert nichts.

export function Demo() {
  const navigate = useNavigate()
  const [error, setError] = useState<string>()

  useEffect(() => {
    void (async () => {
      try {
        if ((await db.products.count()) === 0) {
          const today = new Date().toISOString().slice(0, 10)
          await db.shops.bulkPut(DEMO_SHOPS)
          await db.products.bulkAdd(demoCatalog(await db.recipes.toArray(), today))
          await loadDemoScenario(today)
        }
        navigate('/', { replace: true })
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
    <p className="text-muted">Beispieldaten werden angelegt …</p>
  )
}
