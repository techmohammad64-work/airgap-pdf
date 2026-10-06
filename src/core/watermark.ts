import { degrees, rgb } from 'pdf-lib'
import { assertEncodable, getFont, hexToRgb, type FontFamily } from './fonts'
import { centredAnchor, pageGeom, visualSize } from './geometry'
import { embedImage, type ImageFormat } from './images'
import { loadPdf, savePdf } from './load'

export type WatermarkPosition = 'center' | 'top' | 'bottom' | 'tile'

export interface WatermarkOptions {
  /** 0-based page indices; empty means all pages. */
  pages: number[]
  kind: 'text' | 'image'
  text?: string
  size?: number
  color?: string
  font?: FontFamily
  bold?: boolean
  image?: Uint8Array
  imageFormat?: ImageFormat
  /** Image width as a fraction of the page width (0..1). */
  imageScale?: number
  /** 0..1 */
  opacity: number
  /** Counter-clockwise tilt in degrees. */
  angle: number
  position: WatermarkPosition
}

export async function watermark(bytes: Uint8Array, o: WatermarkOptions): Promise<Uint8Array> {
  const doc = await loadPdf(bytes)
  const pages = doc.getPages()
  const targets = o.pages.length ? o.pages : pages.map((_, i) => i)

  let draw: (page: (typeof pages)[number], cx: number, cy: number, pageW: number) => void

  if (o.kind === 'text') {
    const text = (o.text ?? '').trim()
    if (!text) throw new Error('Enter the watermark text.')
    const font = await getFont(doc, o.font ?? 'helvetica', o.bold ?? true)
    assertEncodable(font, text)
    const size = o.size ?? 48
    const width = font.widthOfTextAtSize(text, size)
    const height = font.heightAtSize(size, { descender: false })
    const [r, g, b] = hexToRgb(o.color ?? '#d1352b')
    draw = (page, cx, cy) => {
      const a = centredAnchor(pageGeom(page), cx, cy, width, height, o.angle)
      page.drawText(text, { x: a.x, y: a.y, size, font, color: rgb(r, g, b), opacity: o.opacity, rotate: degrees(a.rotate) })
    }
  } else {
    if (!o.image) throw new Error('Choose a watermark image.')
    const img = await embedImage(doc, o.image, o.imageFormat)
    draw = (page, cx, cy, pageW) => {
      const width = pageW * (o.imageScale ?? 0.4)
      const height = (width * img.height) / img.width
      const a = centredAnchor(pageGeom(page), cx, cy, width, height, o.angle)
      page.drawImage(img, { x: a.x, y: a.y, width, height, opacity: o.opacity, rotate: degrees(a.rotate) })
    }
  }

  for (const i of targets) {
    const page = pages[i]
    if (!page) continue
    const { width: W, height: H } = visualSize(pageGeom(page))
    if (o.position === 'tile') {
      const cols = 3
      const rows = 4
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) draw(page, ((c + 0.5) * W) / cols, ((r + 0.5) * H) / rows, W / 2)
    } else {
      const cy = o.position === 'top' ? H * 0.15 : o.position === 'bottom' ? H * 0.85 : H / 2
      draw(page, W / 2, cy, W)
    }
  }
  return savePdf(doc)
}
