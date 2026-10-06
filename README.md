# AirgapPDF

**PDF tools that never touch the internet.**

AirgapPDF is a free PDF toolkit that runs entirely in your browser. Files are
read into memory on your device, processed there and saved back to your
device. Nothing is ever uploaded. Once the site has loaded you can disconnect
from the internet and every tool keeps working.

## Tools

| Organize pages | Edit and sign |
|---|---|
| Merge PDF | Sign PDF (draw, type or upload) |
| Split PDF (ranges, every N pages, pick pages) | Add text, checkmarks, dates, white-out |
| Organize pages (reorder, rotate, delete, duplicate, blank pages) | Watermark (text or image) |
| Rotate / delete / extract pages | Page numbers |
| Images to PDF | Fill PDF forms (with optional flattening) |
| PDF to images (PNG / JPG) | True redaction (content removed, not just covered) |

## How the privacy promise is enforced

1. **No server code exists.** The site is static files. All PDF work is done by
   [pdf-lib](https://pdf-lib.js.org/) and Mozilla's [pdf.js](https://mozilla.github.io/pdf.js/)
   running in your browser.
2. **The browser blocks outbound connections.** Every page ships a
   Content-Security-Policy with `connect-src 'self'`, so page code cannot send
   data to any other origin. See `src/lib/csp.ts`.
3. **Fully offline.** A service worker precaches every page, script, font and
   pdf.js asset on first visit (`vite.config.ts`). The header shows *Ready
   offline* when caching is complete.
4. **No third-party code.** No CDNs, analytics, cookies or trackers. Fonts and
   pdf.js assets are self-hosted.

The in-app page **How we prove it** (`/privacy/`) walks users through
verifying all of this themselves.

## Development

Requires Node.js 20+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (core PDF functions)
npm run build      # production build into dist/
npm run preview    # serve dist/ on http://localhost:4173
npm run test:e2e   # end-to-end browser tests against the production build
```

Project layout:

```
site/tools.json        Tool registry: names, routes, SEO copy (single source of truth)
scripts/gen-pages.mjs  Generates one static HTML page per tool + sitemap/robots
src/core/              Pure PDF functions (pdf-lib), unit tested in Node
src/worker/            Web Worker running core functions off the main thread
src/render/            pdf.js wrapper for previews and rasterizing
src/ui/                Shared Svelte components
src/tools/             One Svelte component per tool
src/pages/             Home, tool page shell, privacy page
tests/unit/            Vitest unit tests
tests/e2e/             Playwright end-to-end tests
```

## Deployment

See [DEPLOY.md](DEPLOY.md).
