import { PDFDocument, StandardFonts, degrees } from 'pdf-lib'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { deflateSync } from 'node:zlib'

const FONTS = new URL('../../node_modules/pdfjs-dist/standard_fonts/', import.meta.url).pathname

/** Creates a PDF whose pages each contain the text "Page N" (1-based). */
export async function makePdf(
  n: number,
  opts: { size?: [number, number]; rotate?: number; label?: string; cropBox?: [number, number, number, number] } = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 1; i <= n; i++) {
    const page = doc.addPage(opts.size ?? [300, 400])
    page.drawText(`${opts.label ?? 'Page'} ${i}`, { x: 40, y: 200, size: 20, font })
    if (opts.rotate) page.setRotation(degrees(opts.rotate))
    if (opts.cropBox) page.setCropBox(...opts.cropBox)
  }
  return doc.save()
}

export async function makeForm(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([400, 400])
  const form = doc.getForm()
  form.createTextField('name').addToPage(page, { x: 20, y: 340, width: 200, height: 24 })
  form.createCheckBox('agree').addToPage(page, { x: 20, y: 300, width: 16, height: 16 })
  const dd = form.createDropdown('country')
  dd.addOptions(['Canada', 'India', 'Kenya'])
  dd.addToPage(page, { x: 20, y: 260, width: 150, height: 24 })
  const rg = form.createRadioGroup('plan')
  rg.addOptionToPage('basic', page, { x: 20, y: 220, width: 16, height: 16 })
  rg.addOptionToPage('pro', page, { x: 60, y: 220, width: 16, height: 16 })
  const ro = form.createTextField('locked')
  ro.setText('fixed')
  ro.enableReadOnly()
  ro.addToPage(page, { x: 20, y: 180, width: 100, height: 24 })
  return doc.save()
}

export async function makeEncrypted(): Promise<Uint8Array> {
  // pdf-lib cannot encrypt; fake it by adding an /Encrypt entry to the trailer.
  const doc = await PDFDocument.create()
  doc.addPage()
  const bytes = await doc.save({ useObjectStreams: false })
  const text = new TextDecoder('latin1').decode(bytes)
  const patched = text.replace('trailer\n<<', 'trailer\n<<\n/Encrypt << /Filter /Standard /V 1 /R 2 /O (x) /U (x) /P -4 >>')
  return new Uint8Array([...patched].map((c) => c.charCodeAt(0)))
}

/** Text of each page, extracted with pdf.js. */
export async function pageTexts(bytes: Uint8Array): Promise<string[]> {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: false, isEvalSupported: false, standardFontDataUrl: FONTS }).promise
  const out: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent()
    out.push(
      tc.items
        .map((it) => ('str' in it ? it.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
  }
  await doc.destroy()
  return out
}

/** Text items with their positions in visual (viewport) coordinates, top-left origin. */
export async function textPositions(bytes: Uint8Array, pageNo = 1) {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, standardFontDataUrl: FONTS }).promise
  const page = await doc.getPage(pageNo)
  const vp = page.getViewport({ scale: 1 })
  const tc = await page.getTextContent()
  const items = tc.items
    .filter((it) => 'str' in it && it.str.trim())
    .map((it) => {
      const t = it as { str: string; transform: number[] }
      const [x, y] = vp.convertToViewportPoint(t.transform[4], t.transform[5])
      return { str: t.str, x, y }
    })
  await doc.destroy()
  return { items, width: vp.width, height: vp.height }
}

/** Builds a valid solid-colour RGB PNG of the given size. */
export function makePng(w: number, h: number, rgb: [number, number, number] = [200, 30, 30]): Uint8Array {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (buf: Uint8Array) => {
    let c = 0xffffffff
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length)
    const dv = new DataView(out.buffer)
    dv.setUint32(0, data.length)
    out.set(new TextEncoder().encode(type), 4)
    out.set(data, 8)
    dv.setUint32(8 + data.length, crc(out.subarray(4, 8 + data.length)))
    return out
  }
  const ihdr = new Uint8Array(13)
  const dv = new DataView(ihdr.buffer)
  dv.setUint32(0, w)
  dv.setUint32(4, h)
  ihdr.set([8, 2, 0, 0, 0], 8)
  const raw = new Uint8Array(h * (1 + w * 3))
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(rgb, y * (1 + w * 3) + 1 + x * 3)
  const idat = new Uint8Array(deflateSync(raw))
  const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const parts = [sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', new Uint8Array())]
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) out.set(p, (o += p.length) - p.length)
  return out
}
