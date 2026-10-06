// End-to-end tests for the page editor tools: Add text, Sign and Redact.
import type { Locator, Page } from '@playwright/test'
import { addFiles, expect, loadPdf, makePdf, pageTexts, pdfFile, runAndDownload, test } from './fixtures'

/** Optional screenshots for a visual sanity check: EDITOR_SHOTS=/some/dir */
async function shot(page: Page, name: string) {
  if (process.env.EDITOR_SHOTS) await page.screenshot({ path: `${process.env.EDITOR_SHOTS}/${name}.png`, fullPage: false })
}

async function open(page: Page, route: string, pdf: Buffer) {
  await page.goto(route)
  await addFiles(page, [pdfFile('doc.pdf', pdf)])
  const layer = page.getByTestId('editor-page-1')
  await expect(layer).toBeVisible()
  // Wait for the first page to be painted by pdf.js.
  await expect(page.locator('.page canvas').first()).toBeAttached()
  return layer
}

/** Press-drag inside a page layer, positions as fractions of its size. */
async function dragOn(page: Page, layer: Locator, from: [number, number], to: [number, number]) {
  await layer.scrollIntoViewIfNeeded()
  const b = (await layer.boundingBox())!
  await page.mouse.move(b.x + b.width * from[0], b.y + b.height * from[1])
  await page.mouse.down()
  await page.mouse.move(b.x + b.width * ((from[0] + to[0]) / 2), b.y + b.height * ((from[1] + to[1]) / 2), { steps: 4 })
  await page.mouse.move(b.x + b.width * to[0], b.y + b.height * to[1], { steps: 4 })
  await page.mouse.up()
}

async function hasImage(bytes: Buffer) {
  const doc = await loadPdf(bytes)
  const raw = Buffer.from(await doc.save({ useObjectStreams: false }))
  return raw.includes('/Subtype /Image')
}

test('add text: typed text ends up in the PDF', async ({ page, requests }) => {
  void requests
  const layer = await open(page, 'add-text-to-pdf/', await makePdf(2))
  await expect(page.getByTestId('tool-text')).toHaveAttribute('aria-pressed', 'true')
  await layer.click({ position: { x: 60, y: 60 } })
  await expect(page.getByTestId('editor-text')).toBeFocused()
  await page.keyboard.type('Hello Airgap')
  await shot(page, 'add-text')
  const { download, bytes } = await runAndDownload(page)
  expect(download.suggestedFilename()).toBe('doc-edited.pdf')
  const texts = await pageTexts(bytes)
  expect(texts[0]).toContain('Hello Airgap')
  expect(texts[1]).toBe('Page 2')
})

test('add text: checkmark and white-out export', async ({ page, requests }) => {
  void requests
  const layer = await open(page, 'add-text-to-pdf/', await makePdf(1))
  await page.getByTestId('tool-check').click()
  await layer.click({ position: { x: 40, y: 40 } })
  await expect(page.locator('[data-kind="check"]')).toHaveCount(1)
  await page.getByTestId('tool-whiteout').click()
  await dragOn(page, layer, [0.1, 0.45], [0.6, 0.55])
  await expect(page.locator('[data-kind="whiteout"]')).toHaveCount(1)
  // A date box too.
  await page.getByTestId('tool-date').click()
  await layer.click({ position: { x: 60, y: 120 } })
  await expect(page.locator('[data-kind="text"]')).toHaveCount(1)
  const { bytes } = await runAndDownload(page)
  const doc = await loadPdf(bytes)
  expect(doc.getPageCount()).toBe(1)
  await expect(page.getByTestId('result')).toContainText('1 checkmark')
  await expect(page.getByTestId('result')).toContainText('1 white-out')
})

test('add text: unsupported characters show a clear error', async ({ page, requests }) => {
  void requests
  const layer = await open(page, 'add-text-to-pdf/', await makePdf(1))
  await layer.click({ position: { x: 60, y: 60 } })
  await page.keyboard.insertText('你好')
  await page.getByTestId('run').click()
  await expect(page.getByRole('alert')).toContainText('not available')
  await expect(page.getByTestId('result')).toHaveCount(0)
})

test('delete key removes the selected item', async ({ page, requests }) => {
  void requests
  const layer = await open(page, 'add-text-to-pdf/', await makePdf(1))
  await page.getByTestId('tool-check').click()
  await layer.click({ position: { x: 40, y: 40 } })
  await expect(page.getByTestId('editor-item')).toHaveCount(1)
  await page.keyboard.press('Delete')
  await expect(page.getByTestId('editor-item')).toHaveCount(0)
})

test('sign: typed signature is placed as an image', async ({ page, requests }) => {
  void requests
  const layer = await open(page, 'sign-pdf/', await makePdf(2))
  await page.getByTestId('sig-new').click()
  await page.getByTestId('sig-tab-type').click()
  await page.getByTestId('sig-type-input').fill('Jane Doe')
  await page.getByTestId('sig-style-1').click()
  await shot(page, 'sign-type-modal')
  await page.getByTestId('sig-save').click()
  await expect(page.getByTestId('sig-dialog')).toBeHidden()
  await layer.click({ position: { x: 150, y: 250 } })
  await expect(page.locator('[data-kind="sig"]')).toHaveCount(1)
  // Place it a second time from the saved list.
  await page.getByTestId('sig-item-0').click()
  await layer.click({ position: { x: 150, y: 100 } })
  await expect(page.locator('[data-kind="sig"]')).toHaveCount(2)
  await shot(page, 'sign-placed')
  // Not remembered unless asked.
  expect(await page.evaluate(() => localStorage.getItem('airgap-signatures'))).toBeNull()
  const { download, bytes } = await runAndDownload(page)
  expect(download.suggestedFilename()).toBe('doc-signed.pdf')
  expect(await hasImage(bytes)).toBe(true)
  expect((await pageTexts(bytes))[0]).toBe('Page 1')
})

test('sign: drawn signature, remembered and forgotten', async ({ page, requests }) => {
  void requests
  const layer = await open(page, 'sign-pdf/', await makePdf(1))
  await page.getByTestId('sig-new').click()
  const pad = page.getByTestId('sig-pad')
  const b = (await pad.boundingBox())!
  await page.mouse.move(b.x + 40, b.y + 120)
  await page.mouse.down()
  for (let i = 1; i <= 20; i++) await page.mouse.move(b.x + 40 + i * 12, b.y + 120 - Math.sin(i / 2) * 40)
  await page.mouse.up()
  await page.getByTestId('sig-remember').check()
  await shot(page, 'sign-draw-modal')
  await page.getByTestId('sig-save').click()
  await layer.click({ position: { x: 120, y: 300 } })
  await expect(page.locator('[data-kind="sig"]')).toHaveCount(1)
  expect(await page.evaluate(() => localStorage.getItem('airgap-signatures'))).toContain('data:image/png')
  const { bytes } = await runAndDownload(page)
  expect(await hasImage(bytes)).toBe(true)
  await page.getByRole('button', { name: 'Keep editing' }).click()
  await page.getByTestId('sig-forget').click()
  expect(await page.evaluate(() => localStorage.getItem('airgap-signatures'))).toBeNull()
})

test('redact: one area on page 2 removes its text only', async ({ page, requests }) => {
  void requests
  await open(page, 'redact-pdf/', await makePdf(3, 'SECRET'))
  const layer2 = page.getByTestId('editor-page-2')
  await dragOn(page, layer2, [0.05, 0.4], [0.9, 0.6])
  await expect(page.locator('[data-kind="box"]')).toHaveCount(1)
  await expect(page.getByTestId('redact-note')).toContainText('Redacted pages become images')
  await shot(page, 'redact')
  const { download, bytes } = await runAndDownload(page)
  expect(download.suggestedFilename()).toBe('doc-redacted.pdf')
  expect(await pageTexts(bytes)).toEqual(['SECRET 1', '', 'SECRET 3'])
  await expect(page.getByTestId('result')).toContainText('1 area on 1 page removed')
})

test('redact: entire page', async ({ page, requests }) => {
  void requests
  await open(page, 'redact-pdf/', await makePdf(2, 'SECRET'))
  await page.getByTestId('redact-page-1').click()
  const { bytes } = await runAndDownload(page)
  expect(await pageTexts(bytes)).toEqual(['', 'SECRET 2'])
})

test('editor fits a phone screen', async ({ page, requests }) => {
  void requests
  await page.setViewportSize({ width: 390, height: 844 })
  const layer = await open(page, 'add-text-to-pdf/', await makePdf(2))
  await layer.click({ position: { x: 40, y: 60 } })
  await page.keyboard.type('Phone')
  await shot(page, 'mobile')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  const box = (await layer.boundingBox())!
  expect(box.width).toBeLessThanOrEqual(390)
})
