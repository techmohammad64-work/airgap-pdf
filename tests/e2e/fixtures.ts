// Shared helpers for end-to-end tests: generates fixture files and reads downloads.
import { test as base, expect, type Download, type Page } from '@playwright/test'
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib'
import { readFile } from 'node:fs/promises'
import { deflateSync } from 'node:zlib'

export { expect }

export async function makePdf(n: number, label = 'Page', opts: { rotate?: number; size?: [number, number] } = {}) {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 1; i <= n; i++) {
    const page = doc.addPage(opts.size ?? [300, 400])
    page.drawText(`${label} ${i}`, { x: 40, y: 200, size: 20, font })
    if (opts.rotate) page.setRotation(degrees(opts.rotate))
  }
  return Buffer.from(await doc.save())
}

export async function makeForm() {
  const doc = await PDFDocument.create()
  const page = doc.addPage([400, 400])
  const form = doc.getForm()
  form.createTextField('full_name').addToPage(page, { x: 20, y: 340, width: 200, height: 24 })
  form.createCheckBox('agree').addToPage(page, { x: 20, y: 300, width: 16, height: 16 })
  const dd = form.createDropdown('country')
  dd.addOptions(['Canada', 'India', 'Kenya'])
  dd.addToPage(page, { x: 20, y: 260, width: 150, height: 24 })
  return Buffer.from(await doc.save())
}

export function makePng(w: number, h: number, rgb: [number, number, number] = [30, 90, 200]) {
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (b: Buffer) => {
    let c = 0xffffffff
    for (const x of b) c = table[(c ^ x) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type), data])
    const c = Buffer.alloc(4)
    c.writeUInt32BE(crc(td))
    return Buffer.concat([len, td, c])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr.set([8, 2, 0, 0, 0], 8)
  const raw = Buffer.alloc(h * (1 + w * 3))
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(rgb, y * (1 + w * 3) + 1 + x * 3)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

export const pdfFile = (name: string, buffer: Buffer) => ({ name, mimeType: 'application/pdf', buffer })
export const pngFile = (name: string, buffer: Buffer) => ({ name, mimeType: 'image/png', buffer })

/** Adds files via the tool's (first) file input. */
export async function addFiles(page: Page, files: { name: string; mimeType: string; buffer: Buffer }[]) {
  await page.getByTestId('file-input').first().setInputFiles(files)
}

/** Clicks the run button and returns the saved download's bytes. */
export async function runAndDownload(page: Page, button = page.getByTestId('run')): Promise<{ download: Download; bytes: Buffer }> {
  const [download] = await Promise.all([page.waitForEvent('download'), button.click()])
  const path = await download.path()
  return { download, bytes: await readFile(path!) }
}

export async function loadPdf(bytes: Buffer) {
  return PDFDocument.load(bytes)
}

/** Text per page, extracted with pdf.js in Node. */
export async function pageTexts(bytes: Buffer | Uint8Array): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false }).promise
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

/**
 * Test fixture that records every network request the page makes, so tests
 * can assert nothing ever leaves the site's own origin.
 */
export const test = base.extend<{ requests: string[] }>({
  requests: async ({ page, baseURL }, use) => {
    const origin = new URL(baseURL!).origin
    const external: string[] = []
    page.on('request', (r) => {
      const u = r.url()
      if (!u.startsWith(origin) && !u.startsWith('blob:') && !u.startsWith('data:')) external.push(u)
    })
    await use(external)
    expect(external, 'no request may leave the site origin').toEqual([])
  },
})
