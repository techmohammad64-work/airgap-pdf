import { StandardFonts, type PDFDocument, type PDFFont } from 'pdf-lib'
import { PdfError } from './errors'

export type FontFamily = 'helvetica' | 'times' | 'courier'

const FONTS: Record<FontFamily, [StandardFonts, StandardFonts]> = {
  helvetica: [StandardFonts.Helvetica, StandardFonts.HelveticaBold],
  times: [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold],
  courier: [StandardFonts.Courier, StandardFonts.CourierBold],
}

/**
 * Distance from the top of a CSS line box (line-height 1.2) to the text
 * baseline, as a fraction of font size. Keeps PDF output aligned with the
 * on-screen editor, which renders with the matching web fonts.
 */
export const BASELINE: Record<FontFamily, number> = { helvetica: 1.005, times: 0.991, courier: 0.933 }
export const LINE_HEIGHT = 1.2

export async function getFont(doc: PDFDocument, family: FontFamily = 'helvetica', bold = false): Promise<PDFFont> {
  return doc.embedFont(FONTS[family][bold ? 1 : 0])
}

/** Throws a friendly error naming the first character the font cannot encode. */
export function assertEncodable(font: PDFFont, text: string) {
  for (const ch of text.replace(/\n/g, '')) {
    try {
      font.encodeText(ch)
    } catch {
      throw new PdfError('unsupported-text', `Character "${ch}" is not available. Use Latin letters, digits and common symbols.`)
    }
  }
}

export type RGB = [number, number, number]

/** "#rrggbb" -> [r, g, b] in 0..1 */
export function hexToRgb(hex: string): RGB {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return [0, 0, 0]
  return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255]
}
