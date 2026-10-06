/**
 * Parses "1-3, 5, 8-" style page ranges (1-based, inclusive) into groups of
 * 0-based page indices. An open end ("8-") runs to the last page.
 * Throws an Error with a user-facing message on invalid input.
 */
export function parseRanges(input: string, total: number): number[][] {
  const parts = input
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (!parts.length) throw new Error('Enter at least one page or range, for example 1-3, 5.')
  return parts.map((part) => {
    const m = part.match(/^(\d+)?\s*(-)?\s*(\d+)?$/)
    if (!m || (!m[1] && !m[3])) throw new Error(`"${part}" is not a valid page or range.`)
    const start = m[1] ? Number(m[1]) : 1
    const end = m[2] ? (m[3] ? Number(m[3]) : total) : start
    if (start < 1 || end < 1 || start > total || end > total)
      throw new Error(`"${part}" is outside this document (pages 1-${total}).`)
    const out: number[] = []
    if (start <= end) for (let i = start; i <= end; i++) out.push(i - 1)
    else for (let i = start; i >= end; i--) out.push(i - 1)
    return out
  })
}

/** Flattens ranges into a unique, sorted list of 0-based page indices. */
export function parsePageSet(input: string, total: number): number[] {
  if (!input.trim()) return Array.from({ length: total }, (_, i) => i)
  return [...new Set(parseRanges(input, total).flat())].sort((a, b) => a - b)
}

/** Groups pages into chunks of n: every N pages becomes one file. */
export function chunkPages(total: number, n: number): number[][] {
  if (!Number.isInteger(n) || n < 1) throw new Error('Pages per file must be a whole number of at least 1.')
  const out: number[][] = []
  for (let i = 0; i < total; i += n) out.push(Array.from({ length: Math.min(n, total - i) }, (_, k) => i + k))
  return out
}

/** Formats 0-based indices as a compact 1-based range string: [0,1,2,4] -> "1-3, 5". */
export function formatRanges(pages: number[]): string {
  const s = [...new Set(pages)].sort((a, b) => a - b)
  const out: string[] = []
  for (let i = 0; i < s.length; ) {
    let j = i
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++
    out.push(i === j ? `${s[i] + 1}` : `${s[i] + 1}-${s[j] + 1}`)
    i = j + 1
  }
  return out.join(', ')
}
