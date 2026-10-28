import { useState } from 'react'
import { exportBackup, importBackup } from '../db'

export function DataPage() {
  const [status, setStatus] = useState<string>()

  async function download() {
    const backup = await exportBackup()
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `olisoap-sicherung-${backup.exportedAt.slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    setStatus(`${backup.recipes.length} Rezepte, ${backup.batches.length} Chargen, ${backup.products.length} Artikel und ${backup.lots.length} Gebinde exportiert.`)
  }

  async function upload(file: File) {
    try {
      const n = await importBackup(JSON.parse(await file.text()))
      setStatus(`${n.recipes} Rezepte, ${n.batches} Chargen, ${n.products} Artikel, ${n.purchases} Einkäufe und ${n.lots} Gebinde eingespielt.`)
    } catch (e) {
      setStatus(`Fehler: ${(e as Error).message}`)
    }
  }

  return (
    <section className="max-w-prose space-y-4">
      <h1 className="text-2xl font-semibold">Daten & Sicherung</h1>
      <p className="text-sm text-muted">
        Deine Daten liegen derzeit nur in diesem Browser auf diesem Gerät. Bitte regelmäßig sichern, bis die
        Synchronisation steht.
      </p>
      <div className="card flex flex-wrap gap-3">
        <button className="btn-primary" onClick={download}>
          Sicherung herunterladen
        </button>
        <label className="btn cursor-pointer">
          Sicherung einspielen
          <input type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
      </div>
      {status && <p className="text-sm">{status}</p>}
      <p className="text-xs text-muted">Beim Einspielen werden Einträge mit gleicher ID überschrieben, andere bleiben erhalten.</p>
    </section>
  )
}
