import type { Product, ProductCategory, ProductUnit } from '../core/inventory'
import type { ShopTerms } from '../core/shops'
import { classify, parsePackage } from './salandia'

// Allgemeines Importformat für beliebige Shops (z. B. per Claude in Chrome erstellt): ein Shop je Datei,
// mit Versandbedingungen und Artikeln. Der Prompt dazu steht in docs/shop-katalog-prompt.md.

export const SHOP_FORMAT = 'olisoap-shop-katalog'

/** Art des Artikels, vom Prompt vorgegeben. Hilft, wenn der Name allein nicht reicht. */
type Kind = 'fett' | 'lauge' | 'zusatz' | 'aetherisch' | 'emulgator' | 'konservierer' | 'wirkstoff' | 'sonstiges'

interface ShopItem {
  name: string
  url?: string | null
  art?: Kind | null
  packungsgroesse?: number | null
  einheit?: 'g' | 'ml' | 'Stk' | null
  preis_eur?: number | null
  lieferbar?: boolean | null
  bio?: boolean | null
  artikelnummer?: string | null
}

export interface ShopCatalog {
  format: typeof SHOP_FORMAT
  version: 1
  erstellt_am: string
  shop: {
    name: string
    url?: string | null
    versand_eur?: number | null
    versandfrei_ab_eur?: number | null
    mindestbestellwert_eur?: number | null
    gebuehr_eur?: number | null
  }
  produkte: ShopItem[]
}

export function isShopCatalog(data: unknown): data is ShopCatalog {
  const d = data as Partial<ShopCatalog>
  return d?.format === SHOP_FORMAT && typeof d.shop?.name === 'string' && Array.isArray(d.produkte)
}

const KIND_CATEGORY: Record<Kind, ProductCategory> = {
  fett: 'fat',
  lauge: 'lye',
  zusatz: 'additive',
  aetherisch: 'essentialOil',
  emulgator: 'cosmetic',
  konservierer: 'cosmetic',
  wirkstoff: 'cosmetic',
  sonstiges: 'other',
}

const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : undefined)
const normName = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

export interface ShopCatalogImport {
  shop: ShopTerms
  products: Product[]
  updates: { id: string; changes: Partial<Product> }[]
}

/**
 * Neue Artikel werden angelegt, bekannte desselben Shops (gleiche URL oder gleicher Name) bekommen nur Preis
 * und Lieferbarkeit. Eigene Zuordnungen bleiben unangetastet. Die Versandbedingungen ergänzen die gespeicherten.
 */
export function importShopCatalog(data: ShopCatalog, existing: Product[], storedShop?: ShopTerms): ShopCatalogImport {
  const supplier = data.shop.name.trim()
  const s = data.shop
  const shop: ShopTerms = {
    ...storedShop,
    name: supplier,
    ...(num(s.versand_eur) !== undefined && { shipping: num(s.versand_eur) }),
    ...(num(s.versandfrei_ab_eur) !== undefined && { freeShippingFrom: num(s.versandfrei_ab_eur) }),
    ...(num(s.mindestbestellwert_eur) !== undefined && { minOrder: num(s.mindestbestellwert_eur) }),
    ...(num(s.gebuehr_eur) !== undefined && { paymentFee: num(s.gebuehr_eur) }),
  }

  const own = existing.filter((p) => p.supplier === supplier)
  const byUrl = new Map(own.filter((p) => p.url).map((p) => [p.url!, p]))
  const byName = new Map(own.map((p) => [normName(p.name), p]))
  const seen = new Set<string>()
  const products: Product[] = []
  const updates: ShopCatalogImport['updates'] = []

  for (const item of data.produkte) {
    const price = num(item.preis_eur)
    if (!item.name || price === undefined) continue
    const key = item.url ?? normName(item.name)
    if (seen.has(key)) continue
    seen.add(key)

    const priceInfo = { listPrice: price, listPriceDate: data.erstellt_am, ...(typeof item.lieferbar === 'boolean' && { available: item.lieferbar }) }
    const known = (item.url && byUrl.get(item.url)) || byName.get(normName(item.name))
    if (known) {
      updates.push({ id: known.id, changes: { ...priceInfo, url: known.url ?? item.url ?? undefined } })
      continue
    }

    const size = num(item.packungsgroesse)
    const pkg: { unit: ProductUnit; packageSize: number } = size && item.einheit ? { unit: item.einheit, packageSize: size } : parsePackage(item.name)
    // Ätherische Öle erkennt die Zuordnung am Wort „ätherisch“; viele Shops schreiben nur „Lavendelöl“.
    const kind = item.art ?? undefined
    const fromName = classify(kind === 'aetherisch' && !/ätherisch/i.test(item.name) ? `${item.name} ätherisches Öl` : item.name)
    const recognized = fromName.fatId || fromName.additiveId || fromName.lyeType || fromName.category !== 'cosmetic'
    products.push({
      id: crypto.randomUUID(),
      name: item.name,
      supplier,
      sku: item.artikelnummer ?? undefined,
      url: item.url ?? undefined,
      organic: item.bio ?? /\bbio\b/i.test(item.name),
      ...pkg,
      ...fromName,
      category: recognized ? fromName.category : kind ? KIND_CATEGORY[kind] : fromName.category,
      ...priceInfo,
    })
  }
  return { shop, products, updates }
}
