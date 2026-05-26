import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  clearScreen: false,
  plugins: [react()],
  server: {
    hmr: {
      port: 1421,
    },
    port: 1420,
    strictPort: true,
  },
})
