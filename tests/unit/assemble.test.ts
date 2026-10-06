import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { assemble, merge, split } from '../../src/core/assemble'
import { loadPdf, pageCount } from '../../src/core/load'
import { PdfError } from '../../src/core/errors'
import { makeEncrypted, makePdf, pageTexts } from './helpers'

describe('merge', () => {
  it('concatenates files in order', async () => {
    const a = await makePdf(2, { label: 'A' })
    const b = await makePdf(3, { label: 'B' })
    const out = await merge([a, b])
    expect(await pageTexts(out)).toEqual(['A 1', 'A 2', 'B 1', 'B 2', 'B 3'])
  })
})

describe('assemble', () => {
  it('reorders, interleaves and drops pages across files', async () => {
    const a = await makePdf(2, { label: 'A' })
    const b = await makePdf(2, { label: 'B' })
    const out = await assemble(
      [a, b],
      [
        { kind: 'page', file: 1, index: 1 },
        { kind: 'page', file: 0, index: 0 },
        { kind: 'page', file: 1, index: 0 },
      ],
    )
    expect(await pageTexts(out)).toEqual(['B 2', 'A 1', 'B 1'])
  })

  it('duplicates a page', async () => {
    const a = await makePdf(1)
    const out = await assemble(
      [a],
      [
        { kind: 'page', file: 0, index: 0 },
        { kind: 'page', file: 0, index: 0 },
      ],
    )
    expect(await pageTexts(out)).toEqual(['Page 1', 'Page 1'])
  })

  it('adds rotation on top of existing rotation', async () => {
    const a = await makePdf(2, { rotate: 90 })
    const out = await assemble(
      [a],
      [
        { kind: 'page', file: 0, index: 0, rotate: 90 },
        { kind: 'page', file: 0, index: 1, rotate: 270 },
      ],
    )
    const doc = await PDFDocument.load(out)
    expect(doc.getPages().map((p) => p.getRotation().angle)).toEqual([180, 0])
  })

  it('inserts blank pages (A4 by default, or a given size)', async () => {
    const a = await makePdf(1, { size: [200, 100] })
    const out = await assemble(
      [a],
      [
        { kind: 'blank' },
        { kind: 'page', file: 0, index: 0 },
        { kind: 'blank', width: 200, height: 100 },
      ],
    )
    const doc = await PDFDocument.load(out)
    const sizes = doc.getPages().map((p) => [Math.round(p.getWidth()), Math.round(p.getHeight())])
    expect(sizes).toEqual([
      [595, 842],
      [200, 100],
      [200, 100],
    ])
  })

  it('refuses an empty page list', async () => {
    await expect(assemble([await makePdf(1)], [])).rejects.toMatchObject({ code: 'empty' })
  })

  it('rejects a page index that does not exist', async () => {
    await expect(assemble([await makePdf(1)], [{ kind: 'page', file: 0, index: 5 }])).rejects.toThrow(/does not exist/)
  })
})

describe('split', () => {
  it('produces one file per group', async () => {
    const a = await makePdf(5)
    const parts = await split(a, [[0, 1], [4], [2, 3]])
    expect(parts).toHaveLength(3)
    expect(await pageTexts(parts[0])).toEqual(['Page 1', 'Page 2'])
    expect(await pageTexts(parts[1])).toEqual(['Page 5'])
    expect(await pageTexts(parts[2])).toEqual(['Page 3', 'Page 4'])
  })
})

describe('loading errors', () => {
  it('reports invalid files with a friendly error', async () => {
    const err = await loadPdf(new TextEncoder().encode('not a pdf')).catch((e) => e)
    expect(err).toBeInstanceOf(PdfError)
    expect(err.code).toBe('invalid')
  })
  it('reports encrypted files', async () => {
    const err = await loadPdf(await makeEncrypted()).catch((e) => e)
    expect(err).toBeInstanceOf(PdfError)
    expect(err.code).toBe('encrypted')
  })
  it('counts pages', async () => {
    expect(await pageCount(await makePdf(4))).toBe(4)
  })
})
