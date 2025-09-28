import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Disable Sentry in production to avoid ad-blocker issues
    'process.env.SENTRY_DISABLED': JSON.stringify(true)
  },
  build: {
    rollupOptions: {
      // Remove any Sentry related imports during build
      external: (id) => {
        return id.includes('sentry')
      }
    }
  }
})
