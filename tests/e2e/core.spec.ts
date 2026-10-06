import { readFileSync } from 'node:fs'
import { test, expect, makePdf, pdfFile, addFiles, runAndDownload, pageTexts } from './fixtures'

const tools = JSON.parse(readFileSync(new URL('../../site/tools.json', import.meta.url), 'utf8'))

test.describe('site', () => {
  test('home page lists every tool and links work', async ({ page, requests }) => {
    void requests
    await page.goto('./')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('never')
    for (const p of tools.pages) {
      await expect(page.locator(`a[href$="/${p.slug}/"]`).first()).toBeVisible()
    }
  })

  test('every tool page has SEO metadata, CSP and loads its tool', async ({ page, requests }) => {
    void requests
    for (const p of tools.pages) {
      await page.goto(`${p.slug}/`)
      await expect(page).toHaveTitle(p.title)
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', p.description)
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/${p.slug}/$`))
      await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute('content', /connect-src 'self'/)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(p.h1)
      await expect(page.locator('#seo')).toBeAttached()
      // The tool itself rendered (dropzone visible) rather than an error or stub.
      await expect(page.getByTestId('file-input').first()).toBeAttached()
      await expect(page.getByText('coming soon')).toHaveCount(0)
    }
  })

  test('sitemap and robots are served', async ({ request }) => {
    const sitemap = await (await request.get('sitemap.xml')).text()
    for (const p of tools.pages) expect(sitemap).toContain(`/${p.slug}/`)
    expect(await (await request.get('robots.txt')).text()).toContain('Sitemap:')
  })

  test('unknown pages show the not-found page', async ({ page }) => {
    await page.goto('404.html')
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  })
})

test.describe('privacy guarantees', () => {
  test('the browser blocks sending data to another website', async ({ page }) => {
    await page.goto('privacy/')
    await page.getByTestId('leak-test').click()
    await expect(page.getByTestId('leak-result')).toContainText('Blocked by your browser')
  })

  test('works fully offline after the first visit', async ({ page, context, requests }) => {
    void requests
    await page.goto('merge-pdf/')
    await expect(page.getByTestId('offline-chip')).toContainText('Ready offline', { timeout: 30_000 })

    await context.setOffline(true)
    await page.reload()
    await expect(page.getByTestId('connection-chip')).toContainText('Offline')

    await addFiles(page, [pdfFile('a.pdf', await makePdf(1, 'A')), pdfFile('b.pdf', await makePdf(1, 'B'))])
    const { bytes } = await runAndDownload(page)
    expect(await pageTexts(bytes)).toEqual(['A 1', 'B 1'])

    // Other tool pages are available offline too.
    await page.goto('split-pdf/')
    await expect(page.getByTestId('file-input')).toBeAttached()
    await context.setOffline(false)
  })
})

test.describe('merge', () => {
  test('merges files in order and reorders files', async ({ page, requests }) => {
    void requests
    await page.goto('merge-pdf/')
    await addFiles(page, [pdfFile('a.pdf', await makePdf(2, 'A')), pdfFile('b.pdf', await makePdf(1, 'B'))])
    await expect(page.getByText('a.pdf')).toBeVisible()
    let out = await runAndDownload(page)
    expect(out.download.suggestedFilename()).toBe('a-merged.pdf')
    expect(await pageTexts(out.bytes)).toEqual(['A 1', 'A 2', 'B 1'])

    await page.getByRole('button', { name: 'Keep editing' }).click()
    await page.getByRole('button', { name: 'Move b.pdf earlier' }).click()
    out = await runAndDownload(page)
    expect(await pageTexts(out.bytes)).toEqual(['B 1', 'A 1', 'A 2'])
  })

  test('removes single pages in page view', async ({ page, requests }) => {
    void requests
    await page.goto('merge-pdf/')
    await addFiles(page, [pdfFile('a.pdf', await makePdf(2, 'A')), pdfFile('b.pdf', await makePdf(2, 'B'))])
    await page.getByRole('button', { name: /Pages \(4\)/ }).click()
    await page.getByRole('button', { name: 'Remove page 2' }).click()
    const { bytes } = await runAndDownload(page)
    expect(await pageTexts(bytes)).toEqual(['A 1', 'B 1', 'B 2'])
  })

  test('shows a friendly error for a damaged file', async ({ page }) => {
    await page.goto('merge-pdf/')
    await addFiles(page, [pdfFile('broken.pdf', Buffer.from('this is not a pdf'))])
    await expect(page.getByRole('alert')).toContainText('could not be read')
  })

  test('asks for at least two files', async ({ page }) => {
    await page.goto('merge-pdf/')
    await addFiles(page, [pdfFile('a.pdf', await makePdf(1))])
    await page.getByTestId('run').click()
    await expect(page.getByRole('alert')).toContainText('at least two')
  })
})
