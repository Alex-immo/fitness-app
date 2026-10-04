import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves the app under /<repository>/. The deploy workflow passes
// that path in BASE_PATH, so the repository name is not hard-coded here.
const rawBase = process.env.BASE_PATH ?? '/'
const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

// Only the production build gets the CSP meta tag: the dev server needs inline
// scripts for hot reloading, which the policy forbids.
function cspMetaTag(): Plugin {
  return {
    name: 'csp-meta-tag',
    apply: 'build',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
          injectTo: 'head-prepend',
        },
      ]
    },
  }
}

export default defineConfig({
  base,
  plugins: [
    react(),
    cspMetaTag(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Fitness-App',
        short_name: 'Fitness',
        description: 'Persönliche Trainings-App für den Muskelaufbau',
        lang: 'de',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#101418',
        theme_color: '#101418',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
