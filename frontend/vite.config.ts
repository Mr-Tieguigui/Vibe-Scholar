import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5179,
    strictPort: true,
    watch: { usePolling: true, interval: 200 },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8007',
        changeOrigin: true,
      },
    },
  },
})
