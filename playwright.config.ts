import { defineConfig, devices } from '@playwright/test'

// Detect if we want to run tests inside a compiled Tauri frame
const runTauriNative = process.env.TAURI_E2E === 'true'

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
  // If running native Tauri tests, we configure the dev server to keep running,
  // and configure standard launch parameters or tauri-driver hooks.
  webServer: {
    command: 'node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4180',
    port: 4180,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'browser-smoke',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    ...(runTauriNative
      ? [
          {
            name: 'tauri-native',
            use: {
              // Custom metadata passed to tests to trigger native Tauri window frame execution
              userAgent: 'Tauri-E2E-Native',
            },
          },
        ]
      : []),
  ],
})
