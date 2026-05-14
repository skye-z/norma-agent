import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main/index.ts', 'src/main/preload.ts'],
  outDir: 'dist/main',
  format: ['cjs'],
  target: 'node22',
  clean: true,
  external: ['electron'],
});
