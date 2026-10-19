/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The app version shown in the interface comes from package.json (a single place to change it).
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  // PptxGenJS and JSZip are only loaded at export time: pre-bundle them so that, in
  // development, Vite does not reload the page on the first export.
  optimizeDeps: {
    include: ['pptxgenjs', 'jszip'],
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
