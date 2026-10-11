import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Third Mainland: how Lagos moves',
        short_name: 'Third Mainland',
        description: 'A night map of Lagos roads, BRT, ferries and rail through a modelled weekday.',
        lang: 'en-NG',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#070b10',
        theme_color: '#070b10',
        categories: ['travel', 'navigation', 'education'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The map file, photos and fonts are small enough to keep the whole thing offline.
        globPatterns: ['**/*.{js,css,html,json,woff2,svg,png,jpg}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        // three.js is most of the weight and changes rarely; keep it in its own cacheable chunk.
        advancedChunks: { groups: [{ name: 'three', test: /node_modules[\\/]three/ }] },
      },
    },
  },
})
