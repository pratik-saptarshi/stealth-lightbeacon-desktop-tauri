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
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/__tests__/**',
        'src/**/test/**',
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/test/**',
      ],
      thresholds: {
        lines: 85,
        statements: 85,
        branches: 85,
        functions: 85,
        perFile: true,
      },
    },
  },
})
