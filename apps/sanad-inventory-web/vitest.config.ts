import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Kept separate from vite.config.ts so the production build config stays
// free of test-only concerns.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // No `globals: true` — the tests import describe/it/expect explicitly, so
    // `tsc --noEmit` typechecks them without extra ambient type config.
    include: ['src/**/*.test.{ts,tsx}', 'supabase/staging/**/*.test.mjs'],
    setupFiles: ['src/test/setup.ts'],
    restoreMocks: true,
  },
})
