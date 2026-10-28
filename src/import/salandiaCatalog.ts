import type { Product, ProductCategory, ProductUnit } from '../core/inventory'
import { classify, parsePackage } from './salandia'

// Import eines Katalog-Auszugs von salandia.de (Artikel mit aktuellen Preisen, z. B. per Claude in Chrome erstellt).

interface CatalogItem {
  name: string
  sku: string | null
  url: string | null
  kategorie: string | null
  packungsgroesse: number | null
  einheit: 'g' | 'ml' | 'Stk' | null
  preis_eur: number | null
  bio: boolean | null
  lieferbar: boolean | null
}

export interface CatalogExport {
  source: string
  scraped_at: string
  products: CatalogItem[]
}

export function isCatalog(data: unknown): data is CatalogExport {
  const d = data as Partial<CatalogExport>
  return Array.isArray(d?.products) && typeof d.scraped_at === 'string'
}

/** Shop-Kategorie als Hinweis, wenn der Name allein nicht reicht. */
function categoryHint(kategorie: string | null): ProductCategory | undefined {
  if (!kategorie) return undefined
  if (/ätherische öle|duftstoffe/i.test(kategorie)) return 'essentialOil'
  if (/flaschen|gläser|dosen|tiegel|zubehör/i.test(kategorie)) return 'packaging'
  if (/pflanzenöl/i.test(kategorie)) return 'fat'
  return undefined
}

/** Shop-Pfad ohne Wurzel und ohne Alphabet-Abschnitte („A - B“): „Wellness & Hobbythek > Pflanzenöl > K - R“ → „Pflanzenöl“. */
export function shopCategoryOf(kategorie: string | null): string | undefined {
  if (!kategorie) return undefined
  const parts = kategorie
    .split('>')
    .map((s) => s.trim())
    .filter((s, i) => s && !(i === 0 && /wellness/i.test(s)) && !/^[A-ZÄÖÜ]\s*-\s*[A-ZÄÖÜ]$/.test(s))
    .map((s) => s.replace(/\s*(Wellness & )?Hobbythek$/i, '').replace(/\/\s+/g, '/'))
  return parts.join(' › ') || undefined
}

const normName = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

export interface CatalogImport {
  products: Product[]
  updates: { id: string; changes: Partial<Product> }[]
}

/**
 * Neue Artikel werden angelegt, bekannte (gleiche URL oder gleicher Name) bekommen nur den aktuellen Preis,
 * die Lieferbarkeit und die Shop-Kategorie. Eigene Einstellungen wie Zuordnung oder Dichte bleiben unangetastet.
 */
export function importSalandiaCatalog(data: CatalogExport, existing: Product[]): CatalogImport {
  const byUrl = new Map(existing.filter((p) => p.url).map((p) => [p.url!, p]))
  const byName = new Map(existing.map((p) => [normName(p.name), p]))
  const seen = new Set<string>()
  const products: Product[] = []
  const updates: CatalogImport['updates'] = []

  for (const item of data.products) {
    if (item.preis_eur === null || !item.name) continue
    const key = item.url ?? normName(item.name)
    if (seen.has(key)) continue
    seen.add(key)

    const shopCategory = shopCategoryOf(item.kategorie)
    const priceInfo = {
      listPrice: item.preis_eur,
      listPriceDate: data.scraped_at,
      ...(item.lieferbar !== null && { available: item.lieferbar }),
      ...(shopCategory && { shopCategory }),
    }
    const known = (item.url && byUrl.get(item.url)) || byName.get(normName(item.name))
    if (known) {
      updates.push({ id: known.id, changes: { ...priceInfo, url: known.url ?? item.url ?? undefined } })
      continue
    }

    const pkg: { unit: ProductUnit; packageSize: number } =
      item.packungsgroesse && item.einheit ? { unit: item.einheit, packageSize: item.packungsgroesse } : parsePackage(item.name)
    const fromName = classify(item.name)
    const hint = categoryHint(item.kategorie)
    // Der Name entscheidet, wenn er ein bekanntes Material erkennt; sonst gilt die Shop-Kategorie.
    const recognized = fromName.fatId || fromName.additiveId || fromName.lyeType || fromName.category !== 'cosmetic'
    products.push({
      id: crypto.randomUUID(),
      name: item.name,
      supplier: 'Salandia',
      sku: item.sku ?? undefined,
      url: item.url ?? undefined,
      organic: item.bio ?? /\bbio\b/i.test(item.name),
      ...pkg,
      ...fromName,
      category: recognized ? fromName.category : (hint ?? fromName.category),
      ...priceInfo,
    })
  }
  return { products, updates }
}
