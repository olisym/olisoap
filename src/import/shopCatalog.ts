import { customFatId, labelValid, type CustomFat } from '../core/customFat'
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
  /** Nährwerttabelle je 100 g (vor allem Supermarkt-Öle): daraus wird ein eigenes Fett mit den echten Werten. */
  naehrwerte?: {
    fett?: number | null
    gesaettigt?: number | null
    einfach_ungesaettigt?: number | null
    mehrfach_ungesaettigt?: number | null
  } | null
}

export interface ShopCatalog {
  format: typeof SHOP_FORMAT
  version: 1
  erstellt_am: string
  shop: {
    name: string
    url?: string | null
    versand_eur?: number | null
    /** Versand nach Gewicht, z. B. [{ "bis_kg": 10, "eur": 5.95 }, { "bis_kg": 30, "eur": 10.71 }]. */
    versand_staffel?: { bis_kg: number; eur: number }[] | null
    versandfrei_ab_eur?: number | null
    mindestbestellwert_eur?: number | null
    gebuehr_eur?: number | null
    /** Laden vor Ort (z. B. Supermarkt): keine Versandkosten. */
    vor_ort?: boolean | null
  }
  produkte: ShopItem[]
}

/**
 * Erkennt das Format großzügig: Erzeugte Dateien lassen manchmal „format“ weg oder schreiben „products“ statt „produkte“.
 * Gibt den Katalog in der erwarteten Form zurück, sonst undefined.
 */
export function asShopCatalog(data: unknown): ShopCatalog | undefined {
  const d = data as Partial<ShopCatalog> & { products?: ShopItem[]; scraped_at?: string }
  const produkte = Array.isArray(d?.produkte) ? d.produkte : Array.isArray(d?.products) ? d.products : undefined
  if (!produkte || typeof d?.shop?.name !== 'string') return undefined
  if (d.format !== undefined && d.format !== SHOP_FORMAT) return undefined
  return { format: SHOP_FORMAT, version: 1, erstellt_am: d.erstellt_am ?? d.scraped_at ?? new Date().toISOString().slice(0, 10), shop: d.shop, produkte }
}

export function isShopCatalog(data: unknown): data is ShopCatalog {
  return asShopCatalog(data) !== undefined
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
  /** Eigene Fette aus Nährwerten; die zugehörigen Artikel zeigen schon darauf. */
  customFats: CustomFat[]
}

/** Name ohne Packungsgröße am Ende („Olivenöl nativ extra 750 ml“ → „Olivenöl nativ extra“), Schreibweise bleibt. */
const withoutSize = (name: string) => name.replace(/[\s,]*\d+([.,]\d+)?\s*(ml|l|liter|g|kg)\b.*$/i, '').trim() || name

/**
 * Eigenes Fett aus der Nährwerttabelle eines Artikels, z. B. „Olivenöl nativ extra (Aldi Süd)“. Fehlt „einfach
 * ungesättigt“, ergibt es sich aus Fett minus gesättigt minus mehrfach ungesättigt.
 */
function fatFromLabel(item: ShopItem, baseId: string, shop: string): CustomFat | undefined {
  const n = item.naehrwerte
  const saturated = num(n?.gesaettigt)
  const poly = num(n?.mehrfach_ungesaettigt)
  const fat = num(n?.fett)
  const mono = num(n?.einfach_ungesaettigt) ?? (fat !== undefined && saturated !== undefined && poly !== undefined ? fat - saturated - poly : undefined)
  if (saturated === undefined || poly === undefined || mono === undefined) return undefined
  const label = { saturated, mono, poly }
  if (!labelValid(label)) return undefined
  const name = `${withoutSize(item.name)} (${shop})`
  return { id: customFatId(name), baseId, name, label }
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
    ...(Array.isArray(s.versand_staffel) &&
      s.versand_staffel.length > 0 && {
        shippingByWeight: s.versand_staffel.filter((t) => num(t?.bis_kg) && num(t?.eur) !== undefined).map((t) => ({ maxKg: t.bis_kg, eur: t.eur })),
      }),
    ...(num(s.versandfrei_ab_eur) !== undefined && { freeShippingFrom: num(s.versandfrei_ab_eur) }),
    ...(num(s.mindestbestellwert_eur) !== undefined && { minOrder: num(s.mindestbestellwert_eur) }),
    ...(num(s.gebuehr_eur) !== undefined && { paymentFee: num(s.gebuehr_eur) }),
    ...(s.vor_ort === true && { local: true }),
  }

  const own = existing.filter((p) => p.supplier === supplier)
  const byUrl = new Map(own.filter((p) => p.url).map((p) => [p.url!, p]))
  const byName = new Map(own.map((p) => [normName(p.name), p]))
  const seen = new Set<string>()
  const products: Product[] = []
  const updates: ShopCatalogImport['updates'] = []
  const customFats = new Map<string, CustomFat>()

  for (const item of data.produkte) {
    const price = num(item.preis_eur)
    if (!item.name || price === undefined) continue
    const key = item.url ?? normName(item.name)
    if (seen.has(key)) continue
    seen.add(key)

    const priceInfo = { listPrice: price, listPriceDate: data.erstellt_am, ...(typeof item.lieferbar === 'boolean' && { available: item.lieferbar }) }
    const known = (item.url && byUrl.get(item.url)) || byName.get(normName(item.name))
    // Nährwerte: eigenes Fett anlegen bzw. aktualisieren, Basis ist das erkannte Fett (bei bekannten Artikeln das zugeordnete)
    // Zeigt der Artikel schon auf ein eigenes Fett, gilt wieder das am Namen erkannte als Basis (Werte werden aufgefrischt)
    const baseId = known?.fatId && !known.fatId.startsWith('eigen-') ? known.fatId : classify(item.name).fatId
    const custom = baseId ? fatFromLabel(item, baseId, supplier) : undefined
    if (custom) customFats.set(custom.id, custom)
    if (known) {
      updates.push({ id: known.id, changes: { ...priceInfo, url: known.url ?? item.url ?? undefined, ...(custom && { fatId: custom.id }) } })
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
      ...(custom && { fatId: custom.id }),
    })
  }
  return { shop, products, updates, customFats: [...customFats.values()] }
}
