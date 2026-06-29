import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';

export default defineConfig({
  base: './',
  optimizeDeps: {
    // CRITICAL FIX: Tell Vite to leave mupdf out of dependency optimization pre-bundling.
    // This allows the engine to fetch its companion .wasm asset from its true relative folder path.
    exclude: ['mupdf'],
    esbuildOptions: {
      target: 'es2022'
    }
  },
  build: {
    target: 'es2022',
    outDir: 'dist', // Output to webapp/dist/
    emptyOutDir: true,  // Automatically clear the output directory before building
    minify: 'esbuild',
    // Don't inline any fonts as base64 — fonts must be served as separate files
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]'
      }
    }
  },
  server: {
    port: 3000,
    open: true
  },
  // Ensure font files in public/assets/fonts/ are served correctly
  publicDir: 'public'
});