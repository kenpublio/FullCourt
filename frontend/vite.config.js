import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Local UI previews should always fetch the latest HTML and styles.
  server: { headers: { 'Cache-Control': 'no-store' } },
  preview: { headers: { 'Cache-Control': 'no-store' } },
})
