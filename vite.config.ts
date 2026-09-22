import { defineConfig } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };

// Source maps only for the e2e build: tools/e2e-coverage.mjs maps the Playwright coverage back to src/ with them
export default defineConfig(({ mode }) => ({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { target: 'es2022', outDir: 'dist', sourcemap: mode === 'e2e' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'relay/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**', 'relay/**'],
      exclude: ['src/ui/**', 'src/main.ts', '**/*.test.ts', 'src/**/*.d.ts', 'src/**/__fixtures__/**'],
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
    },
  },
}));
