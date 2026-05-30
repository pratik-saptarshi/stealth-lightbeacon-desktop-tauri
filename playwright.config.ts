import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/playwright',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4180',
    viewport: { width: 800, height: 600 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm exec vite --host 127.0.0.1 --port 4180',
    port: 4180,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
