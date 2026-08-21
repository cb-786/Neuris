import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The backend runs on :8000. We proxy in dev so the browser sees a same-origin
// API, which keeps cookies/CORS simple and mirrors the nginx setup in prod.
// Override with VITE_PROXY_TARGET when the backend is not on the default port.
const backend = process.env.VITE_PROXY_TARGET || 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/health': { target: backend, changeOrigin: true },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/health': { target: backend, changeOrigin: true },
    },
  },
})
