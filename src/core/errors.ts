export type PdfErrorCode = 'encrypted' | 'invalid' | 'unsupported-text' | 'unsupported-image' | 'empty'

const MESSAGES: Record<PdfErrorCode, string> = {
  encrypted: 'This PDF is password-protected. Locked PDFs are not supported yet.',
  invalid: 'This file could not be read as a PDF. It may be damaged or not a PDF at all.',
  'unsupported-text': 'Some characters cannot be written with the built-in PDF fonts.',
  'unsupported-image': 'This image format is not supported.',
  empty: 'There is nothing to save. Add at least one page.',
}

export class PdfError extends Error {
  code: PdfErrorCode
  constructor(code: PdfErrorCode, detail?: string) {
    super(detail ? `${MESSAGES[code]} ${detail}` : MESSAGES[code])
    this.code = code
    this.name = 'PdfError'
  }
}
