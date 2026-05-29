import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src', // Set Vite's project root directory to the src/ folder
  build: {
    target: 'es2022',
    outDir: '../dist', // Output to webapp/dist/ (next to src/)
    emptyOutDir: true,  // Automatically clear the output directory before building
    minify: 'esbuild',
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
  }
});
