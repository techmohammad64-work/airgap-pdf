# AirgapPDF - Design Spec

Date: 2026-10-05

## Product

AirgapPDF is a free, browser-based PDF toolkit. Every operation runs on the
user's device. Files are never uploaded. Once the site is loaded the user can
disconnect from the internet and every tool keeps working.

Monetization: free at launch. Ads may be added later on content pages only
(home, guides). Tool pages never load third-party code.

## USP and trust design

- All processing in the browser (pdf-lib for writing, pdf.js for rendering).
- All code, fonts and pdf.js assets bundled and self-hosted. No CDN at runtime.
- Strict Content-Security-Policy on tool pages: `connect-src 'self'`, so the
  browser itself refuses to send data to any other origin.
- PWA with a service worker that precaches the full app. "Ready offline" badge
  once cached. Installable.
- Live connection indicator: "Online - files stay local" / "Offline - working
  locally".
- Optional, dismissible first-drop hint: "Want proof? Turn off your internet and
  keep going." Going offline is never required.
- "How we prove it" page: airplane-mode test, DevTools Network check, CSP
  explained, link to the open-source code.
- Files live only in memory. Nothing written to storage. Signature "remember on
  this device" is opt-in, off by default.

## v1 tools (each has its own indexable URL)

Page ops:
- Merge PDF (`/merge-pdf/`)
- Split PDF (`/split-pdf/`): ranges, every N pages, selected pages; ZIP output
- Organize pages (`/organize-pdf/`): reorder, rotate, delete, duplicate, insert
  blank. Landing variants: `/rotate-pdf/`, `/delete-pdf-pages/`,
  `/extract-pdf-pages/`
- Images to PDF (`/images-to-pdf/`): JPG/PNG/WebP, page size, margins,
  orientation
- PDF to images (`/pdf-to-images/`): PNG/JPG at chosen DPI, ZIP for many pages

Edit and sign:
- Sign PDF (`/sign-pdf/`): draw, type, upload; place and resize
- Add text (`/add-text-to-pdf/`): text boxes, checkmark, date, white-out
- Watermark (`/watermark-pdf/`): text or image, opacity, angle, position, pages
- Page numbers (`/add-page-numbers-to-pdf/`): position, format, start, range
- Fill forms (`/fill-pdf-form/`): AcroForm fields, optional flatten
- Redact (`/redact-pdf/`): true redaction by rasterizing affected pages

Deferred to v2: compress, password protect/unlock, metadata removal, OCR,
licensing / Pro tier.

## Edge cases

- Encrypted PDFs: clear "locked PDFs not supported yet" message.
- Files over 200 MB: memory warning before processing.
- Corrupt files: friendly error, no crash.
- Standard PDF fonts are used for text tools (Latin characters). Unsupported
  characters produce a clear message.

## Architecture

- Vite multi-page build, Svelte 5, TypeScript.
- `src/core/`: pure PDF functions on bytes (pdf-lib). Unit tested in Node.
- `src/worker/`: Web Worker RPC running core functions off the main thread.
- `src/render/`: pdf.js wrapper (thumbnails, page canvases, rasterizing).
- `src/ui/`: shared components (layout, dropzone, page grid, page editor).
- `src/tools/`: one Svelte component per tool.
- `site/tools.json`: single registry for tool metadata, SEO copy and routes.
  A generator script builds one static HTML page per route with pre-rendered
  SEO content, plus sitemap.xml and robots.txt.
- Overlay coordinates are passed to core in "visual points" (top-left origin of
  the page as displayed). Core maps them to PDF user space for every rotation.

## Deployment

- GitHub Actions builds and deploys to GitHub Pages on push to `main`.
- `BASE_PATH` env controls the URL prefix (`/airgap-pdf/` on github.io, `/` on a
  custom domain). `SITE_URL` controls canonical URLs and sitemap.
- Static `dist/` also deploys unchanged to Cloudflare Pages or Netlify;
  `public/_headers` supplies real HTTP security headers there.

## Testing

- Vitest unit tests for every core function, verified by re-reading output with
  pdf-lib and extracting text with pdf.js.
- Playwright end-to-end tests against the production build: each tool runs on
  fixture files and the downloaded output is verified; offline test (go offline,
  reload, process a file); network test (no requests leave the origin while
  processing).
