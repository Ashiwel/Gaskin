/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import optimizeLocales from '@react-aria/optimize-locales-plugin'

// Single-file build so the demo can be hosted as one self-contained page (and run from a USB stick).
// Tailwind runs at build time only; nothing from it ships at run time except the generated CSS.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // React Aria ships built-in strings ("Clear", "Next month"...) for 34 locales. Keep the ones
    // Gaskin's worker interface uses that React Aria translates; the rest fall back to English.
    { ...optimizeLocales.vite({ locales: ['en-GB', 'en-US', 'fr-FR', 'ar-AE'] }), enforce: 'pre' as const },
    viteSingleFile(),
  ],
  build: { assetsInlineLimit: 100_000_000, cssCodeSplit: false },
  // The app's own tests. mcp-server/ and server/ have their own suites, configs and timeouts
  // (run them with `npm test` in each folder); collecting them here ran them a second time under
  // vitest's 5-second default and made the MCP de-identification test time out on a busy machine.
  test: { include: ['src/**/*.test.{ts,tsx}'] },
})
