import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { needsOf, planConsumption } from '../core/batch'
import type { RecipeResult } from '../core/calc'
import type { Inventory } from '../core/inventory'
import { createBatch, type Recipe } from '../db'
import { fmt } from '../format'
import { NumberField } from './NumberField'

interface Props {
  recipe: Recipe
  result: RecipeResult
  inventory: Inventory
  onClose: () => void
}

/** Charge anlegen: Datum, Reifezeit, Lagerabbuchung. Zeigt vorab, was fehlt und was es kostet. */
export function SiedenPanel({ recipe, result, inventory, onClose }: Props) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [cureWeeks, setCureWeeks] = useState<number | undefined>(5)
  const [deductStock, setDeductStock] = useState(inventory.lots.length > 0)
  const navigate = useNavigate()
  const plan = planConsumption(inventory, needsOf(result))

  async function go() {
    const batch = await createBatch(recipe, { date, cureWeeks: cureWeeks ?? 0, deductStock })
    navigate(`/chargen/${batch.id}`)
  }

  return (
    <div className="card space-y-3 border-accent">
      <h2 className="font-semibold">Sieden: neue Charge</h2>
      <div className="flex flex-wrap items-end gap-4">
        <label className="label">
          Siededatum
          <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="label w-36">
          Reifezeit
          <NumberField value={cureWeeks} digits={0} suffix="Wochen" onChange={setCureWeeks} />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" checked={deductStock} onChange={(e) => setDeductStock(e.target.checked)} /> Verbrauch aus dem Lager abbuchen
        </label>
      </div>
      {deductStock && plan.shortages.length > 0 && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Nicht (ausreichend) im Lager: {plan.shortages.map((s) => `${s.name} ${fmt(s.grams, 0)} g`).join(', ')}. Die Charge wird trotzdem
          angelegt, abgebucht wird nur, was da ist.
        </p>
      )}
      <p className="text-sm text-muted">
        Voraussichtliche Kosten: <b>{fmt(plan.cost, 2)} €</b>
        {plan.unpriced.length > 0 && ` (ohne ${plan.unpriced.join(', ')})`}. Die Kosten werden mit der Charge festgeschrieben.
      </p>
      <div className="flex gap-2">
        <button className="btn-primary" onClick={go}>
          Charge anlegen
        </button>
        <button className="btn" onClick={onClose}>
          Abbrechen
        </button>
      </div>
    </div>
  )
}
