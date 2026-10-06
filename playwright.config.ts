import { defineConfig, devices } from '@playwright/test'
import { resolve } from 'node:path'

const base = (process.env.BASE_PATH || '/').replace(/\/?$/, '/')
// E2E_PORT / E2E_DIST let several builds be tested side by side.
const port = Number(process.env.E2E_PORT || 4173)
const dist = resolve(process.env.E2E_DIST || 'dist')

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}${base}`,
    acceptDownloads: true,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx vite preview --port ${port} --strictPort --outDir ${dist}`,
    url: `http://localhost:${port}${base}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
