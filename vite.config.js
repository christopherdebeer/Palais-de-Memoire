import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/Palais-de-Memoire/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    minify: false,
  },
  server: {
    port: 3000,
    host: true,
    fs: {
      // Exclude prototype folder to prevent websim dependency issues
      deny: ['**/prototype/**']
    }
  },
  // Exclude prototype folder from module resolution
  resolve: {
    alias: {
      '/prototype': false
    }
  }
})