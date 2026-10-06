import { unzipSync } from 'fflate'
import { test, expect, makePdf, makePng, pdfFile, pngFile, addFiles, runAndDownload, loadPdf, pageTexts } from './fixtures'

const unzip = (bytes: Buffer) => unzipSync(new Uint8Array(bytes))
const rotations = async (bytes: Buffer) => (await loadPdf(bytes)).getPages().map((p) => p.getRotation().angle)

test.describe('split', () => {
  test('splits by page ranges into a zip', async ({ page, requests }) => {
    await page.goto('split-pdf/')
    await addFiles(page, [pdfFile('doc.pdf', await makePdf(10))])
    await page.getByTestId('ranges').fill('1-3, 5, 8-')
    await expect(page.getByTestId('preview')).toContainText('3 files')
    await expect(page.getByTestId('preview')).toContainText('pages 8-10')
    const { download, bytes } = await runAndDownload(page)
    expect(download.suggestedFilename()).toBe('doc-split.zip')
    const files = unzip(bytes)
    expect(Object.keys(files).sort()).toEqual(['doc-part-1.pdf', 'doc-part-2.pdf', 'doc-part-3.pdf'])
    expect(await pageTexts(files['doc-part-1.pdf'])).toEqual(['Page 1', 'Page 2', 'Page 3'])
    expect(await pageTexts(files['doc-part-2.pdf'])).toEqual(['Page 5'])
    expect(await pageTexts(files['doc-part-3.pdf'])).toEqual(['Page 8', 'Page 9', 'Page 10'])
    expect(requests).toEqual([])
  })

  test('splits every N pages', async ({ page, requests }) => {
    await page.goto('split-pdf/')
    await addFiles(page, [pdfFile('doc.pdf', await makePdf(5))])
    await page.getByRole('button', { name: 'Every N pages' }).click()
    await page.getByTestId('every').fill('2')
    await expect(page.getByTestId('preview')).toContainText('3 files')
    const { bytes } = await runAndDownload(page)
    const files = unzip(bytes)
    expect(await pageTexts(files['doc-part-1.pdf'])).toEqual(['Page 1', 'Page 2'])
    expect(await pageTexts(files['doc-part-2.pdf'])).toEqual(['Page 3', 'Page 4'])
    expect(await pageTexts(files['doc-part-3.pdf'])).toEqual(['Page 5'])
    expect(requests).toEqual([])
  })

  test('selected pages become one PDF', async ({ page, requests }) => {
    await page.goto('split-pdf/')
    await addFiles(page, [pdfFile('doc.pdf', await makePdf(4))])
    await page.getByRole('button', { name: 'Select pages' }).click()
    await page.getByRole('button', { name: 'Page 2', exact: true }).click()
    await page.getByRole('button', { name: 'Page 4', exact: true }).click()
    const { download, bytes } = await runAndDownload(page)
    expect(download.suggestedFilename()).toBe('doc-split.pdf')
    expect(await pageTexts(bytes)).toEqual(['Page 2', 'Page 4'])
    expect(requests).toEqual([])
  })
})

test.describe('organize', () => {
  test('rotates, deletes, reorders, with undo and redo', async ({ page, requests }) => {
    await page.goto('organize-pdf/')
    await addFiles(page, [pdfFile('doc.pdf', await makePdf(3))])
    const tiles = page.getByTestId('page')
    await expect(tiles).toHaveCount(3)

    await page.getByRole('button', { name: 'Rotate page 1 right' }).click()
    await page.getByRole('button', { name: 'Delete page 2' }).click()
    await expect(tiles).toHaveCount(2)
    await page.keyboard.press('Control+z')
    await expect(tiles).toHaveCount(3)
    await page.keyboard.press('Control+Shift+z')
    await expect(tiles).toHaveCount(2)

    // Drag the last page (original page 3) in front of the first.
    await tiles.nth(1).dragTo(tiles.nth(0), { targetPosition: { x: 5, y: 40 } })
    await expect(tiles.nth(0)).toContainText('was p3')

    const { download, bytes } = await runAndDownload(page)
    expect(download.suggestedFilename()).toBe('doc-organized.pdf')
    expect(await pageTexts(bytes)).toEqual(['Page 3', 'Page 1'])
    expect(await rotations(bytes)).toEqual([0, 90])
    expect(requests).toEqual([])
  })

  test('duplicates and inserts blank pages', async ({ page, requests }) => {
    await page.goto('organize-pdf/')
    await addFiles(page, [pdfFile('doc.pdf', await makePdf(2))])
    await page.getByRole('button', { name: 'Duplicate page 1' }).click()
    await page.getByRole('button', { name: 'Insert blank page', exact: true }).click()
    await expect(page.getByTestId('page')).toHaveCount(4)
    const { bytes } = await runAndDownload(page)
    expect(await pageTexts(bytes)).toEqual(['Page 1', 'Page 1', 'Page 2', ''])
    expect(requests).toEqual([])
  })

  test('rotate mode rotates every page', async ({ page, requests }) => {
    await page.goto('rotate-pdf/')
    await addFiles(page, [pdfFile('doc.pdf', await makePdf(3))])
    await page.getByRole('button', { name: 'Rotate all right' }).click()
    await page.getByRole('button', { name: 'Rotate page 2 left' }).click()
    await expect(page.getByTestId('run')).toHaveText(/Save rotated PDF/)
    const { download, bytes } = await runAndDownload(page)
    expect(download.suggestedFilename()).toBe('doc-rotated.pdf')
    expect(await rotations(bytes)).toEqual([90, 0, 90])
    expect(requests).toEqual([])
  })

  test('delete mode removes marked pages and refuses to delete all', async ({ page, requests }) => {
    await page.goto('delete-pdf-pages/')
    await addFiles(page, [pdfFile('doc.pdf', await makePdf(3))])
    await page.getByRole('button', { name: 'Mark all' }).click()
    await page.getByTestId('run').click()
    await expect(page.getByRole('alert')).toContainText("can't delete every page")

    await page.getByRole('button', { name: 'Clear marks' }).click()
    await page.getByRole('button', { name: 'Mark for deletion: page 2' }).click()
    await expect(page.getByTestId('run')).toHaveText(/Delete 1 page/)
    const { download, bytes } = await runAndDownload(page)
    expect(download.suggestedFilename()).toBe('doc-edited.pdf')
    expect(await pageTexts(bytes)).toEqual(['Page 1', 'Page 3'])
    expect(requests).toEqual([])
  })

  test('extract mode saves only selected pages in order', async ({ page, requests }) => {
    await page.goto('extract-pdf-pages/')
    await addFiles(page, [pdfFile('doc.pdf', await makePdf(5))])
    await page.getByRole('button', { name: 'Select: page 4' }).click()
    await page.getByRole('button', { name: 'Select: page 2' }).click()
    await expect(page.getByTestId('run')).toHaveText(/Extract 2 pages/)
    let { download, bytes } = await runAndDownload(page)
    expect(download.suggestedFilename()).toBe('doc-extracted.pdf')
    expect(await pageTexts(bytes)).toEqual(['Page 2', 'Page 4'])

    await page.getByRole('button', { name: 'Keep editing' }).click()
    await page.getByLabel('Page numbers').fill('1, 3-5')
    await page.getByRole('button', { name: 'Apply' }).click()
    ;({ bytes } = await runAndDownload(page))
    expect(await pageTexts(bytes)).toEqual(['Page 1', 'Page 3', 'Page 4', 'Page 5'])
    expect(requests).toEqual([])
  })
})

test('images to PDF makes one page per image', async ({ page, requests }) => {
  await page.goto('images-to-pdf/')
  await addFiles(page, [pngFile('a.png', makePng(40, 30)), pngFile('b.png', makePng(20, 50, [200, 40, 40]))])
  await expect(page.getByRole('img', { name: 'b.png' })).toBeVisible()
  const { download, bytes } = await runAndDownload(page)
  expect(download.suggestedFilename()).toBe('images.pdf')
  const doc = await loadPdf(bytes)
  expect(doc.getPageCount()).toBe(2)
  // A4 with auto orientation: the wide image gets a landscape page.
  const [w, h] = [doc.getPage(0).getWidth(), doc.getPage(0).getHeight()]
  expect(w).toBeGreaterThan(h)
  expect(requests).toEqual([])
})

test.describe('pdf to images', () => {
  test('single page becomes a PNG', async ({ page, requests }) => {
    await page.goto('pdf-to-images/')
    await addFiles(page, [pdfFile('doc.pdf', await makePdf(1))])
    const { download, bytes } = await runAndDownload(page)
    expect(download.suggestedFilename()).toBe('doc-page-1.png')
    expect([...bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47])
    expect(requests).toEqual([])
  })

  test('several pages become a zip', async ({ page, requests }) => {
    await page.goto('pdf-to-images/')
    await addFiles(page, [pdfFile('doc.pdf', await makePdf(4))])
    await page.getByRole('button', { name: 'JPG' }).click()
    await page.getByRole('button', { name: 'Choose pages' }).click()
    await page.getByTestId('pages').fill('2-4')
    const { download, bytes } = await runAndDownload(page)
    expect(download.suggestedFilename()).toBe('doc-images.zip')
    const files = unzip(bytes)
    expect(Object.keys(files).sort()).toEqual(['doc-page-2.jpg', 'doc-page-3.jpg', 'doc-page-4.jpg'])
    for (const f of Object.values(files)) expect([...f.subarray(0, 2)]).toEqual([0xff, 0xd8])
    expect(requests).toEqual([])
  })
})
