import type { Product, ProductUnit, Purchase } from '../core/inventory'

// Import der Bestellübersicht von salandia.de (JSON-Export aus dem Kundenkonto).

interface SalandiaItem {
  name: string
  sku: string | null
  product_url: string | null
  organic?: boolean
  quantity: number
  unit_price_eur: number
}

interface SalandiaOrder {
  order_number: string
  order_date: string
  items: SalandiaItem[]
}

interface SalandiaExport {
  orders: SalandiaOrder[]
}

/** Erkennt Packungsgrößen wie "1 L", "500 ml", "2,5 kg", "100 g". Die erste Angabe im Namen gilt. */
export function parsePackage(name: string): { unit: ProductUnit; packageSize: number } {
  const m = name.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)(?![a-zäöüß])/i)
  if (!m) return { unit: 'Stk', packageSize: 1 }
  const n = Number(m[1].replace(',', '.'))
  switch (m[2].toLowerCase()) {
    case 'kg':
      return { unit: 'g', packageSize: n * 1000 }
    case 'g':
      return { unit: 'g', packageSize: n }
    case 'l':
      return { unit: 'ml', packageSize: n * 1000 }
    default:
      return { unit: 'ml', packageSize: n }
  }
}

type Rule = [RegExp, Partial<Pick<Product, 'category' | 'fatId' | 'additiveId' | 'lyeType'>>]

// Reihenfolge zählt: spezifischere Regeln zuerst.
const RULES: Rule[] = [
  // Ätherische Öle: erst die bekannten, dann der Rest allgemein.
  [/^(?=.*ätherisch)(?=.*(?:rosmarin))/i, { category: 'essentialOil', additiveId: 'eo-rosemary' }],
  [/^(?=.*ätherisch)(?=.*(?:bergamott))/i, { category: 'essentialOil', additiveId: 'eo-bergamot' }],
  [/^(?=.*ätherisch)(?=.*(?:lavendel))/i, { category: 'essentialOil', additiveId: 'eo-lavender' }],
  [/^(?=.*ätherisch)(?=.*(?:zedernholz))/i, { category: 'essentialOil', additiveId: 'eo-cedarwood' }],
  [/^(?=.*ätherisch)(?=.*(?:latschenkiefer))/i, { category: 'essentialOil', additiveId: 'eo-dwarf-pine' }],
  [/^(?=.*ätherisch)(?=.*(?:zirbel))/i, { category: 'essentialOil', additiveId: 'eo-stone-pine' }],
  [/^(?=.*ätherisch)(?=.*(?:edeltanne|weißtanne))/i, { category: 'essentialOil', additiveId: 'eo-silver-fir' }],
  [/^(?=.*ätherisch)(?=.*(?:zypresse))/i, { category: 'essentialOil', additiveId: 'eo-cypress' }],
  [/^(?=.*ätherisch)(?=.*(?:eukalyptus))/i, { category: 'essentialOil', additiveId: 'eo-eucalyptus' }],
  [/^(?=.*ätherisch)(?=.*(?:pfefferminz|minzöl))/i, { category: 'essentialOil', additiveId: 'eo-peppermint' }],
  [/^(?=.*ätherisch)(?=.*(?:patchouli))/i, { category: 'essentialOil', additiveId: 'eo-patchouli' }],
  [/^(?=.*ätherisch)(?=.*(?:zitronenöl))/i, { category: 'essentialOil', additiveId: 'eo-lemon' }],
  [/^(?=.*ätherisch)(?=.*(?:orangenöl))/i, { category: 'essentialOil', additiveId: 'eo-orange' }],
  [/^(?=.*ätherisch)(?=.*(?:teebaum))/i, { category: 'essentialOil', additiveId: 'eo-tea-tree' }],
  [/^(?=.*ätherisch)(?=.*(?:nelkenblüten|nelkenöl))/i, { category: 'essentialOil', additiveId: 'eo-clove' }],
  [/^(?=.*ätherisch)(?=.*(?:cassia|zimtöl))/i, { category: 'essentialOil', additiveId: 'eo-cassia' }],
  [/^(?=.*ätherisch)(?=.*(?:litsea))/i, { category: 'essentialOil', additiveId: 'eo-litsea' }],
  [/ätherisches öl/i, { category: 'essentialOil' }],
  [/kokosöl/i, { category: 'fat', fatId: 'coconut' }],
  [/babassu/i, { category: 'fat', fatId: 'babassu' }],
  [/sheabutter/i, { category: 'fat', fatId: 'shea' }],
  [/mangobutter/i, { category: 'fat', fatId: 'mango' }],
  [/kakaobutter/i, { category: 'fat', fatId: 'cocoa' }],
  [/mandelöl/i, { category: 'fat', fatId: 'almond' }],
  [/rizinus/i, { category: 'fat', fatId: 'castor' }],
  [/avocadoöl/i, { category: 'fat', fatId: 'avocado' }],
  [/jojoba/i, { category: 'fat', fatId: 'jojoba' }],
  [/arganöl/i, { category: 'fat', fatId: 'argan' }],
  [/macadamia/i, { category: 'fat', fatId: 'macadamia' }],
  [/mariendistel/i, { category: 'fat', fatId: 'milk-thistle' }],
  [/distelöl|saflor/i, { category: 'fat', fatId: 'safflower' }],
  [/brokkoli/i, { category: 'fat', fatId: 'broccoli-seed' }],
  [/sesamöl/i, { category: 'fat', fatId: 'sesame' }],
  [/sonnenblumen.*(high oleic|\bho\b)/i, { category: 'fat', fatId: 'sunflower-ho' }],
  [/sonnenblumenöl/i, { category: 'fat', fatId: 'sunflower' }],
  [/aprikosenkern/i, { category: 'fat', fatId: 'apricot-kernel' }],
  [/traubenkern/i, { category: 'fat', fatId: 'grapeseed' }],
  [/weizenkeim/i, { category: 'fat', fatId: 'wheat-germ' }],
  [/reiskeim/i, { category: 'fat', fatId: 'rice-bran' }],
  [/kamelienöl/i, { category: 'fat', fatId: 'camellia' }],
  [/leinöl/i, { category: 'fat', fatId: 'linseed' }],
  [/olivenöl/i, { category: 'fat', fatId: 'olive' }],
  [/rapsöl/i, { category: 'fat', fatId: 'canola' }],
  [/hanföl/i, { category: 'fat', fatId: 'hemp' }],
  [/bienenwachs/i, { category: 'fat', fatId: 'beeswax' }],
  [/stearinsäure/i, { category: 'fat', fatId: 'stearic-acid' }],
  [/glycerin/i, { category: 'additive', additiveId: 'glycerin' }],
  [/natriumlaktat/i, { category: 'additive', additiveId: 'sodium-lactate-60' }],
  [/seidenprotein|silkprotein/i, { category: 'additive', additiveId: 'silk-protein' }],
  [/zitronensäure/i, { category: 'additive', additiveId: 'citric-anhydrous' }],
  [/natriumcitrat/i, { category: 'additive', additiveId: 'sodium-citrate' }],
  [/kaolin|weiße tonerde/i, { category: 'additive', additiveId: 'kaolin' }],
  [/natriumhydroxid|ätznatron/i, { category: 'lye', lyeType: 'NaOH' }],
  [/kaliumhydroxid|ätzkali/i, { category: 'lye', lyeType: 'KOH' }],
  [/blauglas|braunglas|salbentiegel|rührstab|pipettenflasche|leerflasche/i, { category: 'packaging' }],
  [/hefeflocken|zahncreme|deo ?stick/i, { category: 'other' }],
]

export function classify(name: string): Pick<Product, 'category'> & Partial<Product> {
  for (const [re, props] of RULES) if (re.test(name)) return { category: 'cosmetic', ...props } as Product
  return { category: 'cosmetic' }
}

/** Gleiche SKU = gleicher Artikel. Ohne SKU zählt der Name. */
export function productKey(p: { sku?: string | null; name: string }): string {
  const sku = p.sku?.replace(/Auslistung$/, '')
  return sku ? `sku:${sku}` : `name:${p.name.toLowerCase().trim()}`
}

export interface ImportResult {
  products: Product[]
  purchases: Purchase[]
}

/**
 * Wandelt den Export in Artikel und Einkäufe um. Vorhandene Artikel werden über SKU bzw. Name erkannt
 * und behalten ihre Einstellungen (z. B. manuell korrigierte Kategorie).
 */
export function importSalandia(data: unknown, existing: Product[], existingPurchases: Purchase[]): ImportResult {
  const exp = data as Partial<SalandiaExport>
  if (!Array.isArray(exp?.orders)) throw new Error('Keine Salandia-Bestellübersicht erkannt.')

  const byKey = new Map(existing.map((p) => [productKey(p), p]))
  const newProducts: Product[] = []
  const purchaseIds = new Set(existingPurchases.map((p) => p.id))
  const purchases: Purchase[] = []

  for (const order of exp.orders) {
    for (const item of order.items) {
      const key = productKey(item)
      let product = byKey.get(key)
      if (!product) {
        product = {
          id: crypto.randomUUID(),
          name: item.name,
          supplier: 'Salandia',
          sku: item.sku?.replace(/Auslistung$/, '') || undefined,
          url: item.product_url ?? undefined,
          organic: item.organic || /\bbio\b/i.test(item.name),
          ...parsePackage(item.name),
          ...classify(item.name),
        }
        byKey.set(key, product)
        newProducts.push(product)
      }
      const id = `salandia:${order.order_number}:${key}`
      if (purchaseIds.has(id)) continue
      purchaseIds.add(id)
      purchases.push({
        id,
        productId: product.id,
        date: order.order_date,
        quantity: item.quantity,
        unitPrice: item.unit_price_eur,
        orderNumber: order.order_number,
      })
    }
  }
  return { products: newProducts, purchases }
}

