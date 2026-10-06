// Generates one static HTML entry per route from site/tools.json, plus
// sitemap.xml and robots.txt. Output goes to pages/ (the Vite root).
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const cfg = JSON.parse(readFileSync(join(root, 'site/tools.json'), 'utf8'))
const BASE = normBase(process.env.BASE_PATH || '/')
const SITE_URL = (process.env.SITE_URL || 'https://habitsforgoodinfo-debug.github.io').replace(/\/$/, '')

function normBase(b) {
  if (!b.startsWith('/')) b = '/' + b
  if (!b.endsWith('/')) b += '/'
  return b
}

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const url = (slug) => `${SITE_URL}${BASE}${slug ? slug + '/' : ''}`

function head({ title, description, slug }) {
  return `<meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <!--CSP-->
    <meta name="referrer" content="no-referrer" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${url(slug)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${esc(cfg.site.name)}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${url(slug)}" />
    <meta property="og:image" content="${SITE_URL}${BASE}og-image.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="theme-color" content="#0f1b2d" />
    <link rel="icon" href="${BASE}favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="${BASE}icons/apple-touch-icon.png" />
    <script src="${BASE}theme.js"></script>`
}

function faqJsonLd(faq) {
  if (!faq?.length) return ''
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  }
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`
}

function seoArticle(p) {
  const steps = p.steps.map((s) => `<li>${esc(s)}</li>`).join('')
  const faq = p.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')
  return `<article class="seo" id="seo">
      <h2>How to ${esc(p.name.charAt(0).toLowerCase() + p.name.slice(1))} with ${esc(cfg.site.name)}</h2>
      <ol>${steps}</ol>
      <h2>Why it is private</h2>
      <p>${esc(cfg.site.name)} runs entirely inside your browser. Your file is read into memory on this device, processed there, and saved back to your device. It is never uploaded. Once this page has loaded you can disconnect from the internet and the tool keeps working.</p>
      <h2>Questions</h2>
      ${faq}
    </article>`
}

function page({ slug, title, description, body, dataset, jsonLd = '' }) {
  const data = Object.entries(dataset)
    .filter(([, v]) => v != null)
    .map(([k, v]) => ` data-${k}="${esc(v)}"`)
    .join('')
  return `<!doctype html>
<html lang="en">
  <head>
    ${head({ title, description, slug })}
    ${jsonLd}
  </head>
  <body${data} data-base="${BASE}">
    <div id="app"></div>
    ${body}
    <script type="module" src="/app.ts"></script>
  </body>
</html>
`
}

const out = join(root, 'pages')
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'app.ts'), "import '../src/main'\n")

function write(rel, html) {
  const file = join(out, rel)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, html)
}

write(
  'index.html',
  page({
    slug: '',
    title: `${cfg.site.name} - Private PDF Tools That Work Offline`,
    description: cfg.site.description,
    dataset: { page: 'home' },
    body: '',
  }),
)

for (const p of cfg.pages) {
  write(
    `${p.slug}/index.html`,
    page({
      slug: p.slug,
      title: p.title,
      description: p.description,
      dataset: { page: 'tool', slug: p.slug, tool: p.tool, mode: p.mode },
      body: seoArticle(p),
      jsonLd: faqJsonLd(p.faq),
    }),
  )
}

for (const x of cfg.extra) {
  write(`${x.slug}/index.html`, page({ slug: x.slug, title: x.title, description: x.description, dataset: { page: x.page }, body: '' }))
}

write(
  '404.html',
  page({ slug: '404', title: `Page not found | ${cfg.site.name}`, description: cfg.site.description, dataset: { page: 'notfound' }, body: '' }),
)

const today = new Date().toISOString().slice(0, 10)
const urls = ['', ...cfg.pages.map((p) => p.slug), ...cfg.extra.map((x) => x.slug)]
writeFileSync(
  join(root, 'public/sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${url(u)}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`,
)
writeFileSync(join(root, 'public/robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}${BASE}sitemap.xml\n`)

console.log(`Generated ${urls.length + 1} pages (base ${BASE})`)
