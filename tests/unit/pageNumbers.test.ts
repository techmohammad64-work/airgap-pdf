import { describe, expect, it } from 'vitest'
import { addPageNumbers, formatNumber } from '../../src/core/pageNumbers'
import { makePdf, pageTexts, textPositions } from './helpers'

const opts = { pages: [], start: 1, format: '{n}', position: 'bc' as const, margin: 20, size: 10, color: '#000000', font: 'helvetica' as const }

describe('page numbers', () => {
  it('formats templates', () => {
    expect(formatNumber('Page {n} of {total}', 2, 9)).toBe('Page 2 of 9')
  })
  it('numbers every page', async () => {
    const out = await addPageNumbers(await makePdf(3), { ...opts, format: 'Page {n} of {total}' })
    const texts = await pageTexts(out)
    expect(texts[0]).toContain('Page 1 of 3')
    expect(texts[2]).toContain('Page 3 of 3')
  })
  it('skips pages and honours the start number', async () => {
    const out = await addPageNumbers(await makePdf(3), { ...opts, pages: [1, 2], start: 5, format: '{n}/{total}' })
    const texts = await pageTexts(out)
    expect(texts[0]).toBe('Page 1')
    expect(texts[1]).toContain('5/6')
    expect(texts[2]).toContain('6/6')
  })
  for (const rotate of [0, 90, 180, 270]) {
    it(`puts bottom-right numbers in the visual bottom-right corner (rotation ${rotate})`, async () => {
      const out = await addPageNumbers(await makePdf(1, { rotate }), { ...opts, position: 'br', format: 'N{n}' })
      const { items, width, height } = await textPositions(out)
      const n = items.find((i) => i.str === 'N1')!
      expect(n.y).toBeCloseTo(height - 20, 0)
      expect(n.x).toBeGreaterThan(width - 60)
      expect(n.x).toBeLessThan(width - 20)
    })
  }
  it('puts top-left numbers in the top-left corner', async () => {
    const out = await addPageNumbers(await makePdf(1), { ...opts, position: 'tl', format: 'N{n}' })
    const { items } = await textPositions(out)
    const n = items.find((i) => i.str === 'N1')!
    expect(n.x).toBeCloseTo(20, 0)
    expect(n.y).toBeGreaterThan(20)
    expect(n.y).toBeLessThan(35)
  })
})
