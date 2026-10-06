// Signature images: trimming, encoding and the opt-in "remember on this device" store.

export interface Signature {
  id: string
  /** PNG data URL, used for previews */
  url: string
  /** PNG bytes, embedded into the PDF */
  bytes: Uint8Array
  /** Pixel size of the image */
  width: number
  height: number
  remembered: boolean
}

// Self-hosted handwriting fonts (SIL Open Font License), bundled so typed
// signatures look the same on every device, online or offline.
import '@fontsource/dancing-script/latin-400.css'
import '@fontsource/great-vibes/latin-400.css'
import '@fontsource/caveat/latin-400.css'

const KEY = 'airgap-signatures'

/** Handwriting styles: bundled fonts first, device fonts as fallback. */
export const SIGNATURE_STYLES: { name: string; css: string; italic: boolean }[] = [
  { name: 'Script', css: "'Dancing Script', 'Segoe Script', 'Brush Script MT', cursive", italic: false },
  { name: 'Elegant', css: "'Great Vibes', 'Lucida Handwriting', 'Apple Chancery', cursive", italic: false },
  { name: 'Casual', css: "'Caveat', 'Bradley Hand', 'Segoe Print', cursive", italic: false },
  { name: 'Classic', css: "'Palatino Linotype', 'Book Antiqua', Palatino, 'URW Palladio L', 'P052', Georgia, serif", italic: true },
]

export const PEN_COLORS = [
  { name: 'Black', value: '#111827' },
  { name: 'Blue', value: '#1d3fbb' },
]

/** Crops a canvas to its non-transparent pixels plus `pad`. Null if it is empty. */
export function trimCanvas(src: HTMLCanvasElement, pad = 6): HTMLCanvasElement | null {
  const { width: w, height: h } = src
  if (!w || !h) return null
  const data = src.getContext('2d')!.getImageData(0, 0, w, h).data
  let x0 = w,
    y0 = h,
    x1 = -1,
    y1 = -1
  for (let y = 0; y < h; y++) {
    const row = y * w * 4
    for (let x = 0; x < w; x++) {
      if (data[row + x * 4 + 3] > 8) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 < 0) return null
  x0 = Math.max(0, x0 - pad)
  y0 = Math.max(0, y0 - pad)
  x1 = Math.min(w - 1, x1 + pad)
  y1 = Math.min(h - 1, y1 + pad)
  const out = document.createElement('canvas')
  out.width = x1 - x0 + 1
  out.height = y1 - y0 + 1
  out.getContext('2d')!.drawImage(src, x0, y0, out.width, out.height, 0, 0, out.width, out.height)
  return out
}

/** Makes near-white pixels transparent (soft edge between 205 and 240). */
export function removeWhite(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.min(d[i], d[i + 1], d[i + 2])
    if (v >= 240) d[i + 3] = 0
    else if (v > 205) d[i + 3] = Math.round((d[i + 3] * (240 - v)) / 35)
  }
  ctx.putImageData(img, 0, 0)
}

function dataUrlBytes(url: string): Uint8Array {
  const bin = atob(url.slice(url.indexOf(',') + 1))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function canvasToSignature(canvas: HTMLCanvasElement): Signature {
  const url = canvas.toDataURL('image/png')
  return { id: `sig-${Math.random().toString(36).slice(2, 10)}`, url, bytes: dataUrlBytes(url), width: canvas.width, height: canvas.height, remembered: false }
}

/** Signatures the user explicitly chose to keep on this device. */
export function loadRemembered(): Signature[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as { id: string; url: string; width: number; height: number }[]
    return list
      .filter((s) => typeof s.url === 'string' && s.url.startsWith('data:image/png;base64,'))
      .map((s) => ({ ...s, bytes: dataUrlBytes(s.url), remembered: true }))
  } catch {
    return []
  }
}

/** Persists the remembered subset; removes the key entirely when none are left. */
export function storeRemembered(all: Signature[]) {
  try {
    const keep = all.filter((s) => s.remembered).map(({ id, url, width, height }) => ({ id, url, width, height }))
    if (keep.length) localStorage.setItem(KEY, JSON.stringify(keep))
    else localStorage.removeItem(KEY)
  } catch {
    // Storage blocked or full: remembering is best effort.
  }
}

/** Ensures the bundled signature fonts are loaded before drawing them on a canvas. */
export function loadSignatureFonts(): Promise<unknown> {
  if (!('fonts' in document)) return Promise.resolve()
  return Promise.all(['Dancing Script', 'Great Vibes', 'Caveat'].map((f) => document.fonts.load(`48px "${f}"`))).catch(() => {})
}
