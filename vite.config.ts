import { defineConfig, type Plugin } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'
import { readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { CSP } from './src/lib/csp.ts'

const root = resolve(import.meta.dirname, 'pages')
const base = normBase(process.env.BASE_PATH || '/')

function normBase(b: string) {
  if (!b.startsWith('/')) b = '/' + b
  return b.endsWith('/') ? b : b + '/'
}

/** Every generated HTML file under pages/ is a build entry. */
function htmlEntries(dir: string, out: Record<string, string> = {}) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) htmlEntries(p, out)
    else if (name.endsWith('.html')) out[p.slice(root.length + 1).replace(/\.html$/, '').replace(/\\/g, '/')] = p
  }
  return out
}

/** Injects the Content-Security-Policy meta tag into production pages only (Vite's dev server needs inline HMR). */
function csp(): Plugin {
  return {
    name: 'airgap-csp',
    apply: 'build',
    transformIndexHtml: (html) => html.replace('<!--CSP-->', `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
  }
}

export default defineConfig({
  root,
  base,
  publicDir: resolve(import.meta.dirname, 'public'),
  plugins: [
    svelte(),
    csp(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'AirgapPDF - Private PDF Tools',
        short_name: 'AirgapPDF',
        description: 'PDF tools that never touch the internet. Everything runs on your device.',
        theme_color: '#0f1b2d',
        background_color: '#f6f7f9',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache everything, so every tool works with no network at all.
        globPatterns: ['**/*.{html,js,mjs,css,svg,png,ico,webmanifest,json,bcmap,pfb,ttf,otf,wasm,icc,txt,xml}'],
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        ignoreURLParametersMatching: [/.*/],
      },
      devOptions: { enabled: false },
    }),
  ],
  worker: { format: 'es' },
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: { input: htmlEntries(root) },
  },
  server: { fs: { allow: [import.meta.dirname] } },
})
