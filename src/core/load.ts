import { PDFDocument } from 'pdf-lib'
import { PdfError } from './errors'

/** Loads a PDF, translating pdf-lib failures into friendly PdfErrors. */
export async function loadPdf(bytes: Uint8Array): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, { updateMetadata: false })
  } catch (e) {
    const msg = String((e as Error)?.message ?? e)
    if (/encrypt/i.test(msg)) throw new PdfError('encrypted')
    throw new PdfError('invalid')
  }
}

/** Saves a document with consistent options. */
export async function savePdf(doc: PDFDocument): Promise<Uint8Array> {
  doc.setProducer('AirgapPDF')
  doc.setModificationDate(new Date())
  return doc.save({ useObjectStreams: true })
}

export async function pageCount(bytes: Uint8Array): Promise<number> {
  return (await loadPdf(bytes)).getPageCount()
}
