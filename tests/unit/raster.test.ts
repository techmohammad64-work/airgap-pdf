import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { replacePagesWithImages } from '../../src/core/raster'
import { makePdf, makePng, pageTexts } from './helpers'

describe('replacePagesWithImages (true redaction)', () => {
  it('removes all text from replaced pages and keeps the others', async () => {
    const src = await makePdf(3, { label: 'SECRET' })
    const out = await replacePagesWithImages(src, [{ index: 1, bytes: makePng(30, 40), format: 'png' }])
    expect(await pageTexts(out)).toEqual(['SECRET 1', '', 'SECRET 3'])
  })
  it('leaves no trace of the replaced content anywhere in the file', async () => {
    const src = await makePdf(1, { label: 'TOPSECRET' })
    const out = await replacePagesWithImages(src, [{ index: 0, bytes: makePng(30, 40), format: 'png' }])
    const raw = new TextDecoder('latin1').decode(await (await PDFDocument.load(out)).save({ useObjectStreams: false }))
    expect(raw).not.toContain('TOPSECRET')
    // pdf-lib writes text as hex strings; check that form too.
    const hex = Buffer.from('TOPSECRET').toString('hex').toUpperCase()
    expect(raw.toUpperCase()).not.toContain(hex)
  })
  it('uses the visual page size for rotated pages', async () => {
    const src = await makePdf(1, { rotate: 90, size: [300, 400] })
    const out = await replacePagesWithImages(src, [{ index: 0, bytes: makePng(40, 30), format: 'png' }])
    const p = (await PDFDocument.load(out)).getPage(0)
    expect([p.getWidth(), p.getHeight(), p.getRotation().angle]).toEqual([400, 300, 0])
  })
})
