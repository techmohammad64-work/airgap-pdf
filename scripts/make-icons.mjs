// Renders PWA icons and the Open Graph share image from SVG/HTML using
// Playwright's Chromium. Run once after changing the logo: node scripts/make-icons.mjs
import { chromium } from '@playwright/test'
import { readFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(join(root, 'public/favicon.svg'), 'utf8')
const out = join(root, 'public/icons')
mkdirSync(out, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage()

async function shot(html, w, h, file) {
  await page.setViewportSize({ width: w, height: h })
  await page.setContent(`<html><body style="margin:0">${html}</body></html>`)
  await page.screenshot({ path: file, omitBackground: true })
}

const icon = (size, pad = 0, bg = 'transparent') =>
  `<div style="width:${size}px;height:${size}px;display:grid;place-items:center;background:${bg}">
     <div style="width:${size - pad * 2}px;height:${size - pad * 2}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></div>`

await shot(icon(192), 192, 192, join(out, 'icon-192.png'))
await shot(icon(512), 512, 512, join(out, 'icon-512.png'))
await shot(icon(512, 80, '#0f1b2d'), 512, 512, join(out, 'icon-maskable-512.png'))
await shot(icon(180, 0, '#0f1b2d'), 180, 180, join(out, 'apple-touch-icon.png'))

await shot(
  `<div style="width:1200px;height:630px;box-sizing:border-box;padding:80px;background:#0f1b2d;color:#fff;font-family:system-ui,Segoe UI,Roboto,sans-serif;display:flex;flex-direction:column;justify-content:space-between">
    <div style="display:flex;align-items:center;gap:20px"><div style="width:84px;height:84px;border-radius:20px;box-shadow:0 0 0 3px #34425f">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div>
      <div style="font-size:52px;font-weight:800;letter-spacing:-1px">Airgap<span style="color:#3fcf98">PDF</span></div></div>
    <div style="font-size:72px;font-weight:800;line-height:1.05;letter-spacing:-2px">PDF tools that never<br/>touch the internet.</div>
    <div style="font-size:30px;color:#b3bdcc">Merge, split, sign, edit, redact. 100% on your device.</div>
  </div>`,
  1200,
  630,
  join(root, 'public/og-image.png'),
)
await browser.close()
console.log('Icons written to public/icons and public/og-image.png')
