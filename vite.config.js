import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // Silently updates the app when you push new code
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.png'], // Add any custom fonts or static assets here
      manifest: {
        name: 'Pronomad Enterprise Engine',
        short_name: 'Pronomad',
        description: 'Offline-first Tour & Finance Management',
        theme_color: '#134e4a', // Dark Teal for the Android top bar
        background_color: '#f8fafc', // Slate 50 for the loading screen
        display: 'standalone', // Hides the browser URL bar so it looks like a native app
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable' // Ensures the icon looks good on Android circles/teardrops
          }
        ]
      }
    })
  ]
})