import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Single-file build so the demo can be hosted as one self-contained page (and run from a USB stick).
// Tailwind runs at build time only; nothing from it ships at run time except the generated CSS.
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: { assetsInlineLimit: 100_000_000, cssCodeSplit: false },
})
