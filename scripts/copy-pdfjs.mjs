// Copies pdf.js runtime assets (fonts, cmaps, wasm decoders) into public/ so
// they are served from our own origin and precached for offline use.
import { cpSync, existsSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'node_modules/pdfjs-dist')
const dest = join(root, 'public/pdfjs')
rmSync(dest, { recursive: true, force: true })
for (const dir of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  if (existsSync(join(src, dir))) cpSync(join(src, dir), join(dest, dir), { recursive: true })
}
console.log('Copied pdf.js assets to public/pdfjs')
