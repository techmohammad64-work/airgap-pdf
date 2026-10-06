import { PDFDocument } from 'pdf-lib'
import { embedImage, type ImageFormat } from './images'
import { loadPdf, savePdf } from './load'
import { pageGeom, visualSize } from './geometry'

export interface PageImage {
  index: number
  bytes: Uint8Array
  format: ImageFormat
}

/**
 * Rebuilds the document with some pages replaced by flat images (used for
 * true redaction). A brand-new document is created and only the kept pages
 * are copied, so no content from replaced pages survives anywhere in the file.
 * Document metadata is dropped for the same reason.
 */
export async function replacePagesWithImages(bytes: Uint8Array, images: PageImage[]): Promise<Uint8Array> {
  const src = await loadPdf(bytes)
  const out = await PDFDocument.create()
  const byIndex = new Map(images.map((i) => [i.index, i]))
  const srcPages = src.getPages()
  const keep = srcPages.map((_, i) => i).filter((i) => !byIndex.has(i))
  const copied = await out.copyPages(src, keep)
  const copiedByIndex = new Map(keep.map((i, k) => [i, copied[k]]))

  for (let i = 0; i < srcPages.length; i++) {
    const img = byIndex.get(i)
    if (!img) {
      out.addPage(copiedByIndex.get(i)!)
      continue
    }
    const { width, height } = visualSize(pageGeom(srcPages[i]))
    const page = out.addPage([width, height])
    page.drawImage(await embedImage(out, img.bytes, img.format), { x: 0, y: 0, width, height })
  }
  return savePdf(out)
}
