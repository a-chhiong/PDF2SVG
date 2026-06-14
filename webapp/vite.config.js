import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';

export default defineConfig({
  base: './',
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
