import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Inject the runtime container env into the client bundle. Vite normally only reads
  // .env files, so without this a docker-compose `VITE_API_URL` wouldn't reach the browser.
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || ''),
  },
  optimizeDeps: {
    // Pre-bundle ALL deps (incl. deck.gl, maplibre-gl) at startup.
    // Old conflicting pages (Analytics.jsx etc.) have been deleted — safe to scan all src files.
    entries: ['src/**/*.{jsx,js}'],
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    // Host headers the dev server accepts. Set VITE_ALLOWED_HOSTS (comma-separated) for
    // production behind a reverse proxy; a leading dot (".jannis-schuler.de") allows all subdomains.
    allowedHosts: (process.env.VITE_ALLOWED_HOSTS || 'localhost')
      .split(',').map(s => s.trim()).filter(Boolean),
    watch: {
      usePolling: true,
    },
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://backend:8000',
        changeOrigin: true,
      },
    },
  },
})
