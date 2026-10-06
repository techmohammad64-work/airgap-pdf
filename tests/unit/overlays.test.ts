import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { applyOverlays } from '../../src/core/overlays'
import { makePdf, makePng, pageTexts, textPositions } from './helpers'

describe('applyOverlays', () => {
  it('writes multi-line text on the requested page only', async () => {
    const src = await makePdf(2)
    const out = await applyOverlays(src, [
      { type: 'text', page: 1, x: 20, y: 20, text: 'Hello\nWorld', size: 12, color: '#123456', font: 'times', bold: true },
    ])
    const texts = await pageTexts(out)
    expect(texts[0]).toBe('Page 1')
    expect(texts[1]).toContain('Hello')
    expect(texts[1]).toContain('World')
    const { items } = await textPositions(out, 2)
    const hello = items.find((i) => i.str === 'Hello')!
    const world = items.find((i) => i.str === 'World')!
    expect(world.y - hello.y).toBeCloseTo(12 * 1.2, 0)
  })

  it('embeds an image once even when placed many times', async () => {
    const png = makePng(8, 4)
    const src = await makePdf(3)
    const out = await applyOverlays(
      src,
      [0, 1, 2].map((page) => ({ type: 'image' as const, page, x: 10, y: 10, width: 80, height: 40, bytes: png, format: 'png' as const })),
    )
    const doc = await PDFDocument.load(out)
    const text = new TextDecoder('latin1').decode(await doc.save({ useObjectStreams: false }))
    expect(text.match(/\/Subtype \/Image/g)?.length).toBe(1)
  })

  it('draws rectangles and checkmarks without error', async () => {
    const src = await makePdf(1, { rotate: 90 })
    const out = await applyOverlays(src, [
      { type: 'rect', page: 0, x: 10, y: 10, width: 50, height: 20, color: '#ffffff' },
      { type: 'check', page: 0, x: 100, y: 100, size: 20, color: '#0a0a0a' },
    ])
    expect((await PDFDocument.load(out)).getPageCount()).toBe(1)
  })

  it('rejects characters the standard fonts cannot encode', async () => {
    const src = await makePdf(1)
    await expect(
      applyOverlays(src, [{ type: 'text', page: 0, x: 0, y: 0, text: 'Hi 你好', size: 12, color: '#000000', font: 'helvetica' }]),
    ).rejects.toMatchObject({ code: 'unsupported-text' })
  })

  it('accepts accented Latin text', async () => {
    const src = await makePdf(1)
    const out = await applyOverlays(src, [{ type: 'text', page: 0, x: 0, y: 0, text: 'Café déjà vu', size: 12, color: '#000000', font: 'helvetica' }])
    expect((await pageTexts(out))[0]).toContain('Café déjà vu')
  })
})
