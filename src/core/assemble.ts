import { PDFDocument, degrees } from 'pdf-lib'
import { PdfError } from './errors'
import { loadPdf, savePdf } from './load'

export type Rotation = 0 | 90 | 180 | 270

/** A page in the output: either a page copied from a source file, or a blank page. */
export type PageRef =
  | { kind: 'page'; file: number; index: number; rotate?: Rotation }
  | { kind: 'blank'; width?: number; height?: number; rotate?: Rotation }

const A4: [number, number] = [595.28, 841.89]

export const normRotation = (deg: number): Rotation => ((((deg % 360) + 360) % 360) as Rotation)

/**
 * Builds a new PDF from pages of one or more source files.
 * Covers merge, reorder, rotate, delete, duplicate, extract and blank insertion.
 * `rotate` is added to the page's existing rotation.
 */
export async function assemble(files: Uint8Array[], pages: PageRef[]): Promise<Uint8Array> {
  if (!pages.length) throw new PdfError('empty')
  const sources = await Promise.all(files.map((f) => loadPdf(f)))
  const out = await PDFDocument.create()

  // Copy each source's needed pages in one call (shared resources copied once).
  const needed = new Map<number, number[]>()
  for (const p of pages) {
    if (p.kind !== 'page') continue
    const list = needed.get(p.file) ?? []
    if (!list.includes(p.index)) list.push(p.index)
    needed.set(p.file, list)
  }
  const copied = new Map<string, Awaited<ReturnType<PDFDocument['copyPages']>>[number]>()
  for (const [file, indices] of needed) {
    const src = sources[file]
    if (!src) throw new Error(`Missing source file ${file}`)
    for (const i of indices) if (i < 0 || i >= src.getPageCount()) throw new Error(`Page ${i + 1} does not exist`)
    const result = await out.copyPages(src, indices)
    indices.forEach((i, k) => copied.set(`${file}:${i}`, result[k]))
  }

  const used = new Set<string>()
  for (const p of pages) {
    if (p.kind === 'blank') {
      const page = out.addPage([p.width ?? A4[0], p.height ?? A4[1]])
      if (p.rotate) page.setRotation(degrees(normRotation(p.rotate)))
      continue
    }
    const key = `${p.file}:${p.index}`
    let page = copied.get(key)!
    // A page object can only appear once; duplicates need a fresh copy.
    if (used.has(key)) [page] = await out.copyPages(sources[p.file], [p.index])
    used.add(key)
    out.addPage(page)
    if (p.rotate) page.setRotation(degrees(normRotation(page.getRotation().angle + p.rotate)))
  }
  return savePdf(out)
}

/** Merges whole files in order. */
export async function merge(files: Uint8Array[]): Promise<Uint8Array> {
  const docs = await Promise.all(files.map((f) => loadPdf(f)))
  const pages: PageRef[] = []
  docs.forEach((d, file) => {
    for (let index = 0; index < d.getPageCount(); index++) pages.push({ kind: 'page', file, index })
  })
  return assemble(files, pages)
}

/** Splits one file into several, one output per group of 0-based page indices. */
export async function split(file: Uint8Array, groups: number[][]): Promise<Uint8Array[]> {
  const out: Uint8Array[] = []
  for (const g of groups) out.push(await assemble([file], g.map((index) => ({ kind: 'page', file: 0, index }))))
  return out
}
