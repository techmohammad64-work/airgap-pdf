import { degrees, rgb, LineCapStyle } from 'pdf-lib'
import { assertEncodable, BASELINE, getFont, hexToRgb, LINE_HEIGHT, type FontFamily } from './fonts'
import { anchor, pageGeom } from './geometry'
import { loadPdf, savePdf } from './load'
import { embedImage, type ImageFormat } from './images'

/** All positions and sizes are in visual points (see geometry.ts). */
export type Overlay =
  | {
      type: 'text'
      page: number
      x: number
      y: number
      text: string
      size: number
      color: string
      font: FontFamily
      bold?: boolean
    }
  | { type: 'image'; page: number; x: number; y: number; width: number; height: number; bytes: Uint8Array; format: ImageFormat }
  | { type: 'rect'; page: number; x: number; y: number; width: number; height: number; color: string }
  | { type: 'check'; page: number; x: number; y: number; size: number; color: string }

/** Draws text, images, filled rectangles and checkmarks onto pages. */
export async function applyOverlays(bytes: Uint8Array, overlays: Overlay[]): Promise<Uint8Array> {
  const doc = await loadPdf(bytes)
  const pages = doc.getPages()
  const imageCache = new Map<Uint8Array, Awaited<ReturnType<typeof embedImage>>>()

  for (const o of overlays) {
    const page = pages[o.page]
    if (!page) throw new Error(`Page ${o.page + 1} does not exist`)
    const g = pageGeom(page)

    if (o.type === 'text') {
      const font = await getFont(doc, o.font, o.bold)
      assertEncodable(font, o.text)
      const [r, gr, b] = hexToRgb(o.color)
      o.text.split('\n').forEach((line, i) => {
        if (!line) return
        const by = o.y + (i * LINE_HEIGHT + BASELINE[o.font]) * o.size
        const a = anchor(g, o.x, by)
        page.drawText(line, { x: a.x, y: a.y, size: o.size, font, color: rgb(r, gr, b), rotate: degrees(a.rotate) })
      })
    } else if (o.type === 'image') {
      let img = imageCache.get(o.bytes)
      if (!img) imageCache.set(o.bytes, (img = await embedImage(doc, o.bytes, o.format)))
      const a = anchor(g, o.x, o.y + o.height)
      page.drawImage(img, { x: a.x, y: a.y, width: o.width, height: o.height, rotate: degrees(a.rotate) })
    } else if (o.type === 'rect') {
      const [r, gr, b] = hexToRgb(o.color)
      const a = anchor(g, o.x, o.y + o.height)
      page.drawRectangle({ x: a.x, y: a.y, width: o.width, height: o.height, color: rgb(r, gr, b), rotate: degrees(a.rotate) })
    } else if (o.type === 'check') {
      const [r, gr, b] = hexToRgb(o.color)
      const a = anchor(g, o.x, o.y)
      page.drawSvgPath('M 10 52 L 38 80 L 92 18', {
        x: a.x,
        y: a.y,
        scale: o.size / 100,
        rotate: degrees(a.rotate),
        borderColor: rgb(r, gr, b),
        borderWidth: 14,
        borderLineCap: LineCapStyle.Round,
      })
    }
  }
  return savePdf(doc)
}

