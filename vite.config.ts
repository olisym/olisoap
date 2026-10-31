import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const BUILD = (process.env.GITHUB_SHA ?? 'lokal').slice(0, 7)
const BUILT_AT = new Date().toISOString()

/** Legt version.json neben die App: daran erkennt eine laufende App, dass der Server eine neuere Version hat. */
function versionFile(): Plugin {
  return {
    name: 'olisoap-version',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD, builtAt: BUILT_AT }) })
    },
  }
}

// BASE_PATH wird beim Deployment gesetzt (GitHub Pages: /olisoap/, eigene Subdomain: /).
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  // Kurzer Commit-Hash, steht auf der Sync-Seite; entspricht „Build …“ im Branch deploy bzw. in Plesk.
  define: { __BUILD__: JSON.stringify(BUILD), __BUILT_AT__: JSON.stringify(BUILT_AT) },
  plugins: [
    react(),
    tailwindcss(),
    versionFile(),
    VitePWA({
      // „prompt“: Ein neuer Service Worker wartet, bis man auf „Update, neu laden“ tippt (siehe src/version.ts).
      registerType: 'prompt',
      // Die Sync-API nie aus dem Offline-Cache beantworten (sonst zeigt /api/… die Startseite).
      workbox: { navigateFallbackDenylist: [/\/api\//] },
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'olisoap – Seifenwerkstatt',
        short_name: 'olisoap',
        description: 'Rezepte, Laugenrechner und Siedebuch für Seifensieder.',
        lang: 'de',
        theme_color: '#0a0f15',
        background_color: '#0a0f15',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
