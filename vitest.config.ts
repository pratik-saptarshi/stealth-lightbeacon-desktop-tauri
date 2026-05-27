import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['tests/playwright/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/App.tsx'],
      thresholds: {
        statements: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
})
