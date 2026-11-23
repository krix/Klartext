import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative Pfade: die App läuft auch unter einem Unterpfad (z. B. GitHub Pages).
  base: './',
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
