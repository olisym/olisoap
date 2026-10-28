// Ende-zu-Ende-Verschlüsselung: Aus Benutzername und Passphrase werden im Browser zwei Werte abgeleitet.
//   - ein AES-GCM-Schlüssel, der jeden Datensatz verschlüsselt, bevor er den Browser verlässt
//   - ein Anmeldewert für den Server (der Server sieht nie Passphrase oder Schlüssel)

const ITERATIONS = 600_000
const enc = new TextEncoder()
const dec = new TextDecoder()

export interface Keys {
  key: CryptoKey
  /** 64 Hex-Zeichen für die Anmeldung am Server. */
  auth: string
}

export async function deriveKeys(user: string, passphrase: string): Promise<Keys> {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveBits'])
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(`olisoap:v1:${user.trim().toLowerCase()}`), iterations: ITERATIONS },
      base,
      512,
    ),
  )
  const key = await crypto.subtle.importKey('raw', bits.slice(0, 32), 'AES-GCM', false, ['encrypt', 'decrypt'])
  const auth = [...bits.slice(32)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return { key, auth }
}

function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

function fromBase64(s: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
}

export async function encryptJson(key: CryptoKey, value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value))))
  const out = new Uint8Array(iv.length + ct.length)
  out.set(iv)
  out.set(ct, iv.length)
  return toBase64(out)
}

export async function decryptJson<T>(key: CryptoKey, data: string): Promise<T> {
  const bytes = fromBase64(data)
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(0, 12) }, key, bytes.subarray(12))
  return JSON.parse(dec.decode(pt)) as T
}

/** Schneller, nicht kryptografischer Hash (cyrb53), um geänderte Datensätze zu erkennen. */
export function hashString(str: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}
