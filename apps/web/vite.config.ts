import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Single repo-root .env for API and web (only VITE_* vars reach the browser)
  envDir: '../..',
  server: {
    allowedHosts: ['.trycloudflare.com'], // npm start -- --share
    proxy: { '/api': `http://localhost:${process.env.API_PORT ?? 8100}` },
  },
})
