// Shared types and helpers for the page editor tools (Sign, Add text, Redact).
import { LINE_HEIGHT, type FontFamily } from '../core/fonts'

/**
 * One thing placed on a page. Position and size are VISUAL POINTS: origin at
 * the top-left of the page as displayed, y down, units = PDF points.
 * Tools extend this with their own data (text, image, colour...).
 */
export interface EditorItem {
  id: string
  /** 0-based page index */
  page: number
  x: number
  y: number
  width: number
  height: number
  kind: string
  /** How the corner handle resizes the item. Default 'free'. */
  resize?: 'free' | 'aspect' | 'none'
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** On-screen font stacks matching the standard PDF fonts used by core. */
export const FONT_CSS: Record<FontFamily, string> = {
  helvetica: "Helvetica, Arial, 'Liberation Sans', 'Nimbus Sans', sans-serif",
  times: "'Times New Roman', Times, 'Liberation Serif', 'Nimbus Roman', serif",
  courier: "'Courier New', Courier, 'Liberation Mono', 'Nimbus Mono PS', monospace",
}

export const FONT_LABEL: Record<FontFamily, string> = { helvetica: 'Helvetica', times: 'Times', courier: 'Courier' }

let measureCtx: CanvasRenderingContext2D | null = null

/** Size in points of a (multi-line) text block rendered with line-height 1.2. */
export function measureText(text: string, font: FontFamily, size: number, bold = false): { width: number; height: number } {
  measureCtx ??= document.createElement('canvas').getContext('2d')!
  measureCtx.font = `${bold ? 'bold ' : ''}${size}px ${FONT_CSS[font]}`
  const lines = text.split('\n')
  const w = Math.max(...lines.map((l) => measureCtx!.measureText(l).width))
  // Slack keeps the caret visible and absorbs tiny font metric differences.
  return { width: Math.max(w, size * 0.6) + size * 0.5, height: lines.length * LINE_HEIGHT * size }
}

/** Today's date in the user's locale, e.g. "05/10/2026". */
export function today(): string {
  // Latin digits: the built-in PDF fonts cannot draw other numbering systems.
  return new Date().toLocaleDateString(undefined, { numberingSystem: 'latn' } as Intl.DateTimeFormatOptions)
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi))

/** A text box. (x, y) is the top-left of the first line box. */
export interface TextItem extends EditorItem {
  kind: 'text'
  text: string
  font: FontFamily
  size: number
  color: string
  bold: boolean
}

export function newText(page: number, x: number, y: number, text = '', opts: Partial<Pick<TextItem, 'font' | 'size' | 'color' | 'bold'>> = {}): TextItem {
  const t = { font: 'helvetica' as FontFamily, size: 14, color: '#000000', bold: false, ...opts }
  const m = measureText(text, t.font, t.size, t.bold)
  return { id: `it-${Math.random().toString(36).slice(2, 10)}`, kind: 'text', page, x, y, ...m, resize: 'none', text, ...t }
}
