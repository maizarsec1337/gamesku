import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Dev server meneruskan semua request /api ke backend (tanpa CORS).
    // Backend disiapkan teman satu tim di folder ../backend.
    // Default port 8000; ubah lewat env API_PROXY bila backend lain port.
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.API_PROXY || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    proxy: {
      '/api': {
        target: process.env.API_PROXY || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Pisahkan admin dari toko: pengunjung tidak mengunduh kode dashboard.
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
