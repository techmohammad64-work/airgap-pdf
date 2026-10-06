import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { pageGeom, toPdf, visualSize } from '../../src/core/geometry'
import { applyOverlays } from '../../src/core/overlays'
import { makePdf, textPositions } from './helpers'

describe('toPdf', () => {
  const g = { x0: 0, y0: 0, w: 300, h: 400 }
  it('maps visual corners for every rotation', () => {
    expect(toPdf({ ...g, rotation: 0 }, 0, 0)).toEqual({ x: 0, y: 400 })
    expect(toPdf({ ...g, rotation: 90 }, 0, 0)).toEqual({ x: 0, y: 0 })
    expect(toPdf({ ...g, rotation: 180 }, 0, 0)).toEqual({ x: 300, y: 0 })
    expect(toPdf({ ...g, rotation: 270 }, 0, 0)).toEqual({ x: 300, y: 400 })
  })
  it('honours a crop box offset', () => {
    expect(toPdf({ x0: 50, y0: 20, w: 100, h: 100, rotation: 0 }, 10, 10)).toEqual({ x: 60, y: 110 })
  })
})

describe('visual placement matches what a viewer shows', () => {
  for (const rotate of [0, 90, 180, 270]) {
    it(`places text where requested on a page rotated ${rotate}°`, async () => {
      const src = await makePdf(1, { rotate, label: 'Base' })
      const doc = await PDFDocument.load(src)
      const vs = visualSize(pageGeom(doc.getPage(0)))
      const out = await applyOverlays(src, [
        { type: 'text', page: 0, x: 30, y: 50, text: 'MARK', size: 20, color: '#000000', font: 'helvetica' },
      ])
      const { items, width, height } = await textPositions(out)
      expect([Math.round(width), Math.round(height)]).toEqual([Math.round(vs.width), Math.round(vs.height)])
      const mark = items.find((i) => i.str === 'MARK')!
      // pdf.js reports the baseline origin in viewport (visual) coordinates.
      expect(mark.x).toBeCloseTo(30, 0)
      expect(mark.y).toBeCloseTo(50 + 1.005 * 20, 0)
    })
  }

  it('respects a crop box', async () => {
    const src = await makePdf(1, { cropBox: [50, 50, 200, 300] })
    const out = await applyOverlays(src, [
      { type: 'text', page: 0, x: 10, y: 10, text: 'CROP', size: 10, color: '#000000', font: 'helvetica' },
    ])
    const { items, width } = await textPositions(out)
    expect(Math.round(width)).toBe(200)
    const m = items.find((i) => i.str === 'CROP')!
    expect(m.x).toBeCloseTo(10, 0)
  })
})
