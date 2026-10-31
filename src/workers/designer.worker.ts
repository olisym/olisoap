import { designRecipe, type DesignRequest } from '../core/designer'
import type { SoapProperties } from '../core/types'

// Rechnet im Hintergrund, was sich mit einem Regler ganz links bzw. ganz rechts erreichen ließe (die übrigen Regler
// bleiben stehen). Acht Durchläufe würden die Regler auf dem Handy sonst spürbar bremsen.

export interface RangeJob {
  id: number
  requests: DesignRequest[]
}

export interface RangeAnswer {
  id: number
  results: ({ properties: SoapProperties; costPerKg?: number } | null)[]
}

self.onmessage = (e: MessageEvent<RangeJob>) => {
  const results = e.data.requests.map((r) => {
    const o = designRecipe(r)
    return o.ok ? { properties: o.result.properties, costPerKg: o.result.costPerKg } : null
  })
  // Im Worker hat postMessage keinen Ziel-Ursprung; die DOM-Typen kennen nur die Fenster-Variante
  ;(self as unknown as { postMessage: (m: RangeAnswer) => void }).postMessage({ id: e.data.id, results })
}
