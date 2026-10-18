import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Tests du moteur deterministe (src/lib) : fonctions pures, aucune dependance au navigateur ni a Supabase reel.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
