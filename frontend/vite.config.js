// Konfigurasi Vite.
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    // Dev server meneruskan /api ke backend (port via env API_PROXY).
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.API_PROXY || 'http://localhost:8000',
        changeOrigin: true,
      },
      '/uploads': {
        target: process.env.API_PROXY || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: process.env.API_PROXY || 'http://localhost:8000',
        changeOrigin: true,
      },
      '/uploads': {
        target: process.env.API_PROXY || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Build langsung ke dist terpadu (satu paket dengan backend PHP).
    outDir: '../dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Pisahkan chunk admin dari toko.
        manualChunks(id) {
          if (id.includes('halaman-admin') || id.includes('komponen/admin') || id.includes('IkonAdmin')) {
            return 'admin'
          }
          return undefined
        },
      },
    },
  },
})
