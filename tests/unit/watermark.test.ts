import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { watermark } from '../../src/core/watermark'
import { makePdf, makePng, pageTexts, textPositions } from './helpers'

const base = { opacity: 0.3, angle: 0, position: 'center' as const }

describe('watermark', () => {
  it('stamps text on all pages by default', async () => {
    const out = await watermark(await makePdf(3), { ...base, pages: [], kind: 'text', text: 'CONFIDENTIAL', size: 30 })
    const texts = await pageTexts(out)
    expect(texts.every((t) => t.includes('CONFIDENTIAL'))).toBe(true)
  })
  it('only stamps the selected pages', async () => {
    const out = await watermark(await makePdf(3), { ...base, pages: [1], kind: 'text', text: 'DRAFT' })
    expect((await pageTexts(out)).map((t) => t.includes('DRAFT'))).toEqual([false, true, false])
  })
  it('centres unrotated text on the page', async () => {
    const out = await watermark(await makePdf(1, { size: [400, 400] }), { ...base, pages: [], kind: 'text', text: 'MID', size: 40 })
    const { items } = await textPositions(out)
    const mid = items.find((i) => i.str === 'MID')!
    expect(mid.x).toBeGreaterThan(150)
    expect(mid.x).toBeLessThan(200)
    expect(mid.y).toBeGreaterThan(200)
    expect(mid.y).toBeLessThan(230)
  })
  it('tiles 12 copies per page', async () => {
    const out = await watermark(await makePdf(1), { ...base, pages: [], kind: 'text', text: 'T', size: 10, position: 'tile', angle: 45 })
    const { items } = await textPositions(out)
    expect(items.filter((i) => i.str === 'T')).toHaveLength(12)
  })
  it('stamps an image', async () => {
    const out = await watermark(await makePdf(2, { rotate: 90 }), { ...base, pages: [], kind: 'image', image: makePng(10, 10), imageScale: 0.3 })
    const doc = await PDFDocument.load(out)
    expect(doc.getPageCount()).toBe(2)
  })
  it('requires text', async () => {
    await expect(watermark(await makePdf(1), { ...base, pages: [], kind: 'text', text: '  ' })).rejects.toThrow(/watermark text/)
  })
})
