import { openPdf, type PDFDocumentProxy } from '../render/pdfjs'
import { LARGE_FILE, readBytes } from './files'

/** A PDF the user added: original bytes plus a pdf.js handle for previews. */
export interface PdfFile {
  id: string
  name: string
  size: number
  bytes: Uint8Array
  doc: PDFDocumentProxy
  pageCount: number
}

let counter = 0
export const uid = (prefix = 'id') => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`

/** Asks before loading very large files that might exhaust device memory. */
export function confirmLarge(files: File[]): boolean {
  const big = files.filter((f) => f.size > LARGE_FILE)
  if (!big.length) return true
  return confirm(
    `${big.map((f) => f.name).join(', ')} ${big.length > 1 ? 'are' : 'is'} very large. Processing may be slow or run out of memory on this device. Continue?`,
  )
}

export async function loadPdfFile(file: File): Promise<PdfFile> {
  const bytes = await readBytes(file)
  const doc = await openPdf(bytes)
  return { id: uid('pdf'), name: file.name, size: file.size, bytes, doc, pageCount: doc.numPages }
}

export function closePdf(f: PdfFile | null | undefined) {
  f?.doc.destroy().catch(() => {})
}
