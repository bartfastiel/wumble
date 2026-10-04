import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import pkg from './package.json' with { type: 'json' };

// Cross-origin isolation lets the page share memory with the audio thread (next/). The server sends the same headers.
const isolation = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' };

// Source maps only for the e2e build: tools/e2e-coverage.mjs maps the Playwright coverage back to src/ with them
export default defineConfig(({ mode }) => ({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: mode === 'e2e',
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        next: resolve(import.meta.dirname, 'next/index.html'),
      },
    },
  },
  server: { headers: isolation },
  preview: { headers: isolation },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'relay/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**', 'relay/**'],
      // Browser glue (DOM, WebGL, AudioWorklet) is covered by the end-to-end tests, like src/ui
      exclude: [
        'src/ui/**',
        'src/main.ts',
        'src/next/platform/**',
        'src/next/main.ts',
        '**/*.test.ts',
        'src/**/*.d.ts',
        'src/**/__fixtures__/**',
      ],
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
    },
  },
}));
