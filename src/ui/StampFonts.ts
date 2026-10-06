// Shared helpers for the stamp-style tools (watermark, page numbers) and forms.
import type { FontFamily } from '../core/fonts'

export const FONT_OPTIONS: { value: FontFamily; label: string }[] = [
  { value: 'helvetica', label: 'Helvetica (sans-serif)' },
  { value: 'times', label: 'Times (serif)' },
  { value: 'courier', label: 'Courier (monospace)' },
]

/** CSS font stacks that approximate the standard PDF fonts on screen. */
export const CSS_FONT: Record<FontFamily, string> = {
  helvetica: "Helvetica, Arial, 'Liberation Sans', sans-serif",
  times: "'Times New Roman', Times, 'Liberation Serif', serif",
  courier: "'Courier New', Courier, 'Liberation Mono', monospace",
}

/** "full_name" -> "Full name", "dateOfBirth" -> "Date of birth". */
export function humanise(name: string): string {
  const last = name.split('.').filter(Boolean).pop() ?? name
  const s = last
    .replace(/\[\d+\]/g, '')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/[_\-\s]+/g, ' ')
    .trim()
    .toLowerCase()
  return s ? s[0].toUpperCase() + s.slice(1) : name
}
