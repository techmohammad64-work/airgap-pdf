# Deploying AirgapPDF

The build output (`dist/`) is plain static files. Any static host works.

## GitHub Pages (default, free)

Already configured in `.github/workflows/deploy.yml`.

1. Push to `main`.
2. In the repository go to **Settings > Pages** and set **Source** to
   **GitHub Actions** (one-time).
3. Every push to `main` runs type checks, unit tests, the build and the
   end-to-end tests, then publishes. A failing test blocks the deploy.

The site is served at `https://<user>.github.io/<repo>/`.

### Custom domain (recommended for a commercial site)

1. Buy a domain, e.g. `airgappdf.com`.
2. **Settings > Pages > Custom domain**: enter it and follow GitHub's DNS
   instructions. Tick **Enforce HTTPS**.
3. **Settings > Secrets and variables > Actions > Variables**, add:
   - `BASE_PATH` = `/`
   - `SITE_URL` = `https://airgappdf.com`
4. Re-run the workflow (Actions tab > Test and deploy > Run workflow).

`BASE_PATH` controls the URL prefix of every link and asset. `SITE_URL` is used
for canonical links, Open Graph tags and `sitemap.xml`.

## Cloudflare Pages or Netlify (alternative)

These hosts also apply `public/_headers`, which sends the security policy as
real HTTP headers (stronger than the `<meta>` tag, and adds
`frame-ancestors 'none'`).

- Build command: `npm run build`
- Output directory: `dist`
- Environment variables: `BASE_PATH=/`, `SITE_URL=https://your-domain`
- Node version: 20

## After going live

- Submit `https://your-domain/sitemap.xml` in Google Search Console.
- Open the site, wait for **Ready offline**, turn off Wi-Fi and try a tool.

## Adding ads later (read before you do)

Ad networks load third-party scripts and contact their servers. That conflicts
with the core promise, so keep these rules:

1. **Never put ads on tool pages.** Those pages handle user files and must keep
   `connect-src 'self'`.
2. Ads may go on content pages only (home, guides, blog). Give those pages
   their own, looser policy: in `vite.config.ts` the `csp()` plugin can pick a
   different policy per page (for example by checking `data-page` in the HTML).
3. Update the **How we prove it** page so it stays truthful, e.g. "Tool pages
   never load third-party code; ads appear only on informational pages."
4. Use a privacy-respecting, cookieless ad provider where possible (for example
   EthicalAds or Carbon) and show a consent banner where the law requires it.
