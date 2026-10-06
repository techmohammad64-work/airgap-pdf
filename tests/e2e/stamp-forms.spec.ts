import { test, expect, makePdf, makeForm, makePng, pdfFile, pngFile, addFiles, runAndDownload, loadPdf, pageTexts } from './fixtures'

test.describe('watermark', () => {
  test('adds a text watermark to every page', async ({ page, requests }) => {
    void requests
    await page.goto('watermark-pdf/')
    await addFiles(page, [pdfFile('report.pdf', await makePdf(3))])
    await expect(page.getByTestId('wm-text')).toHaveValue('CONFIDENTIAL')
    const { download, bytes } = await runAndDownload(page)
    expect(download.suggestedFilename()).toBe('report-watermarked.pdf')
    const texts = await pageTexts(bytes)
    expect(texts).toHaveLength(3)
    for (const t of texts) expect(t).toContain('CONFIDENTIAL')
  })

  test('watermarks only the chosen page range', async ({ page, requests }) => {
    void requests
    await page.goto('watermark-pdf/')
    await addFiles(page, [pdfFile('report.pdf', await makePdf(3))])
    await page.getByTestId('wm-text').fill('DRAFT COPY')
    await page.getByTestId('pages-range').click()
    await page.getByTestId('range').fill('2')
    const { bytes } = await runAndDownload(page)
    const texts = await pageTexts(bytes)
    expect(texts[0]).not.toContain('DRAFT COPY')
    expect(texts[1]).toContain('DRAFT COPY')
    expect(texts[2]).not.toContain('DRAFT COPY')
  })

  test('adds an image watermark', async ({ page, requests }) => {
    void requests
    await page.goto('watermark-pdf/')
    await addFiles(page, [pdfFile('report.pdf', await makePdf(2))])
    await page.getByRole('button', { name: 'Image' }).click()
    await page.locator('input[type=file][accept="image/*"]').setInputFiles([pngFile('logo.png', makePng(40, 20))])
    await expect(page.getByText('logo.png')).toBeVisible()
    const { download, bytes } = await runAndDownload(page)
    expect(download.suggestedFilename()).toBe('report-watermarked.pdf')
    const doc = await loadPdf(bytes)
    expect(doc.getPageCount()).toBe(2)
    // The original has no images; the watermark adds an embedded XObject image.
    expect(bytes.toString('latin1')).toMatch(/\/Subtype\s*\/Image/)
  })
})

test.describe('page numbers', () => {
  test('numbers every page as "Page n of N"', async ({ page, requests }) => {
    void requests
    await page.goto('add-page-numbers-to-pdf/')
    await addFiles(page, [pdfFile('book.pdf', await makePdf(3, 'Doc'))])
    await page.getByRole('button', { name: 'Page 1 of N', exact: true }).click()
    await expect(page.getByTestId('format')).toHaveValue('Page {n} of {total}')
    const { download, bytes } = await runAndDownload(page)
    expect(download.suggestedFilename()).toBe('book-numbered.pdf')
    const texts = await pageTexts(bytes)
    texts.forEach((t, i) => expect(t).toContain(`Page ${i + 1} of 3`))
  })

  test('skips the cover page and starts at 1', async ({ page, requests }) => {
    void requests
    await page.goto('add-page-numbers-to-pdf/')
    await addFiles(page, [pdfFile('book.pdf', await makePdf(3, 'Doc'))])
    await page.getByRole('button', { name: 'Page 1 of N', exact: true }).click()
    await page.getByTestId('range').fill('2-')
    await page.getByTestId('start').fill('1')
    const { bytes } = await runAndDownload(page)
    const texts = await pageTexts(bytes)
    expect(texts[0]).not.toContain('Page')
    expect(texts[1]).toContain('Page 1 of 2')
    expect(texts[2]).toContain('Page 2 of 2')
  })
})

test.describe('fill form', () => {
  test('fills fields and keeps them editable', async ({ page, requests }) => {
    void requests
    await page.goto('fill-pdf-form/')
    await addFiles(page, [pdfFile('application.pdf', await makeForm())])
    await expect(page.getByText('Full name')).toBeVisible()
    await page.getByTestId('field-full_name').fill('Ada Lovelace')
    await page.getByTestId('field-agree').check()
    await page.getByTestId('field-country').selectOption('India')
    const { download, bytes } = await runAndDownload(page)
    expect(download.suggestedFilename()).toBe('application-filled.pdf')
    const form = (await loadPdf(bytes)).getForm()
    expect(form.getTextField('full_name').getText()).toBe('Ada Lovelace')
    expect(form.getCheckBox('agree').isChecked()).toBe(true)
    expect(form.getDropdown('country').getSelected()).toEqual(['India'])
  })

  test('flattens the form when asked', async ({ page, requests }) => {
    void requests
    await page.goto('fill-pdf-form/')
    await addFiles(page, [pdfFile('application.pdf', await makeForm())])
    await page.getByTestId('field-full_name').fill('Grace Hopper')
    await page.getByTestId('flatten').check()
    const { bytes } = await runAndDownload(page)
    const doc = await loadPdf(bytes)
    expect(doc.getForm().getFields()).toHaveLength(0)
    expect((await pageTexts(bytes))[0]).toContain('Grace Hopper')
  })

  test('explains when a PDF has no fields', async ({ page, requests }) => {
    void requests
    await page.goto('fill-pdf-form/')
    await addFiles(page, [pdfFile('plain.pdf', await makePdf(1))])
    const notice = page.getByTestId('no-fields')
    await expect(notice).toBeVisible()
    await expect(notice).toContainText("doesn't have fillable fields")
    await expect(notice.getByRole('link', { name: 'Add text' })).toHaveAttribute('href', /add-text-to-pdf\/$/)
    await expect(page.getByTestId('run')).toBeDisabled()
  })
})
