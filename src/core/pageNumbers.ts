import { degrees, rgb } from 'pdf-lib'
import { assertEncodable, getFont, hexToRgb, type FontFamily } from './fonts'
import { anchor, pageGeom, visualSize } from './geometry'
import { loadPdf, savePdf } from './load'

export type NumberPosition = 'tl' | 'tc' | 'tr' | 'bl' | 'bc' | 'br'

export interface PageNumberOptions {
  /** 0-based page indices to number; empty means all pages. */
  pages: number[]
  /** Number printed on the first numbered page. */
  start: number
  /** Template with {n} and {total}, e.g. "Page {n} of {total}". */
  format: string
  position: NumberPosition
  /** Distance from the page edge in points. */
  margin: number
  size: number
  color: string
  font: FontFamily
}

export function formatNumber(format: string, n: number, total: number) {
  return format.replace(/\{n\}/g, String(n)).replace(/\{total\}/g, String(total))
}

export async function addPageNumbers(bytes: Uint8Array, o: PageNumberOptions): Promise<Uint8Array> {
  const doc = await loadPdf(bytes)
  const pages = doc.getPages()
  const targets = (o.pages.length ? o.pages : pages.map((_, i) => i)).filter((i) => i < pages.length)
  const font = await getFont(doc, o.font)
  const [r, g, b] = hexToRgb(o.color)
  const total = o.start + targets.length - 1

  targets.forEach((pi, k) => {
    const page = pages[pi]
    const geom = pageGeom(page)
    const { width: W, height: H } = visualSize(geom)
    const text = formatNumber(o.format, o.start + k, total)
    assertEncodable(font, text)
    const tw = font.widthOfTextAtSize(text, o.size)
    const capH = font.heightAtSize(o.size, { descender: false })
    const col = o.position[1]
    const x = col === 'l' ? o.margin : col === 'c' ? (W - tw) / 2 : W - o.margin - tw
    const y = o.position[0] === 't' ? o.margin + capH : H - o.margin
    const a = anchor(geom, x, y)
    page.drawText(text, { x: a.x, y: a.y, size: o.size, font, color: rgb(r, g, b), rotate: degrees(a.rotate) })
  })
  return savePdf(doc)
}
