import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// BASE_PATH wird beim Deployment gesetzt (GitHub Pages: /olisoap/, eigene Subdomain: /).
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  // Kurzer Commit-Hash, steht auf der Sync-Seite; entspricht „Build …“ im Branch deploy bzw. in Plesk.
  define: { __BUILD__: JSON.stringify((process.env.GITHUB_SHA ?? 'lokal').slice(0, 7)) },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
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
