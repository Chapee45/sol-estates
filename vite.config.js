import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// DEPLOY_BASE is set by `npm run deploy` so the build works when hosted at
// https://<user>.github.io/sol-estates/ — local dev stays at /.
export default defineConfig({
  base: process.env.DEPLOY_BASE || '/',
  plugins: [react()],
  server: { port: 5173, strictPort: true },
})
