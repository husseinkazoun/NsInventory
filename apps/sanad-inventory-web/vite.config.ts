import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev port is 5174 to avoid clashing with the Laravel root Vite on 5173.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5174,
  },
  preview: {
    host: '127.0.0.1',
    port: 5174,
  },
})
