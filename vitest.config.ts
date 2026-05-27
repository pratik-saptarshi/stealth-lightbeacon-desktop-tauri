import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: ['.worktrees/**', 'node_modules/**', 'target/**'],
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary', 'json'],
      include: ['src/App.tsx'],
      thresholds: {
        statements: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
})
