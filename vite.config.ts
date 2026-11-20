import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5273,
    // Same-origin in the browser, so no CORS and no API base URL in the client.
    proxy: { '/api': { target: 'http://localhost:5274', changeOrigin: true } },
  },
})
