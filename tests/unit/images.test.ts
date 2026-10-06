import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { detectImageFormat, imagesToPdf } from '../../src/core/images'
import { makePng } from './helpers'

const size = async (bytes: Uint8Array) =>
  (await PDFDocument.load(bytes)).getPages().map((p) => [Math.round(p.getWidth()), Math.round(p.getHeight())])

describe('imagesToPdf', () => {
  it('creates one page per image', async () => {
    const out = await imagesToPdf([makePng(40, 20), makePng(20, 40)], { pageSize: 'a4', orientation: 'portrait', margin: 0 })
    expect(await size(out)).toEqual([
      [595, 842],
      [595, 842],
    ])
  })
  it('auto orientation turns pages landscape for wide images', async () => {
    const out = await imagesToPdf([makePng(40, 20), makePng(20, 40)], { pageSize: 'letter', orientation: 'auto', margin: 0 })
    expect(await size(out)).toEqual([
      [792, 612],
      [612, 792],
    ])
  })
  it('fit sizes the page to the image plus margins', async () => {
    const out = await imagesToPdf([makePng(100, 50)], { pageSize: 'fit', orientation: 'auto', margin: 10 })
    expect(await size(out)).toEqual([[120, 70]])
  })
  it('rejects an empty list and unknown formats', async () => {
    await expect(imagesToPdf([], { pageSize: 'a4', orientation: 'auto', margin: 0 })).rejects.toMatchObject({ code: 'empty' })
    await expect(imagesToPdf([new Uint8Array([1, 2, 3])], { pageSize: 'a4', orientation: 'auto', margin: 0 })).rejects.toMatchObject({
      code: 'unsupported-image',
    })
  })
  it('detects formats by magic bytes', () => {
    expect(detectImageFormat(makePng(1, 1))).toBe('png')
    expect(detectImageFormat(new Uint8Array([0xff, 0xd8, 0xff]))).toBe('jpg')
    expect(detectImageFormat(new Uint8Array([0, 0]))).toBeNull()
  })
})
