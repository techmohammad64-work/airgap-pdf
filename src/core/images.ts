import { PDFDocument } from 'pdf-lib'
import { PdfError } from './errors'
import { savePdf } from './load'

export type ImageFormat = 'png' | 'jpg'

export function detectImageFormat(bytes: Uint8Array): ImageFormat | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png'
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpg'
  return null
}

export async function embedImage(doc: PDFDocument, bytes: Uint8Array, format?: ImageFormat) {
  const f = format ?? detectImageFormat(bytes)
  try {
    if (f === 'png') return await doc.embedPng(bytes)
    if (f === 'jpg') return await doc.embedJpg(bytes)
  } catch {
    throw new PdfError('unsupported-image', 'The image file appears to be damaged.')
  }
  throw new PdfError('unsupported-image')
}

export type PageSize = 'a4' | 'letter' | 'fit'
export type Orientation = 'auto' | 'portrait' | 'landscape'

export interface ImagesToPdfOptions {
  pageSize: PageSize
  orientation: Orientation
  /** Margin in points on every side. */
  margin: number
}

const SIZES = { a4: [595.28, 841.89], letter: [612, 792] } as const

/** Creates a PDF with one image per page, scaled to fit and centred. */
export async function imagesToPdf(images: Uint8Array[], opts: ImagesToPdfOptions): Promise<Uint8Array> {
  if (!images.length) throw new PdfError('empty')
  const doc = await PDFDocument.create()
  for (const bytes of images) {
    const img = await embedImage(doc, bytes)
    const m = Math.max(0, opts.margin)
    let pw: number, ph: number
    if (opts.pageSize === 'fit') {
      pw = img.width + 2 * m
      ph = img.height + 2 * m
    } else {
      const [w, h] = SIZES[opts.pageSize]
      const landscape = opts.orientation === 'landscape' || (opts.orientation === 'auto' && img.width > img.height)
      ;[pw, ph] = landscape ? [h, w] : [w, h]
    }
    const page = doc.addPage([pw, ph])
    const scale = Math.min((pw - 2 * m) / img.width, (ph - 2 * m) / img.height, opts.pageSize === 'fit' ? 1 : Infinity)
    const w = img.width * scale
    const h = img.height * scale
    page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h })
  }
  return savePdf(doc)
}
