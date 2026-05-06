import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/full.ts', 'src/core-entry.ts', 'src/temporal-entry.ts', 'src/locale/*.ts', 'src/bin/cli.ts'],
    format: ['cjs', 'esm'],
    dts: false,
    splitting: false,
    sourcemap: true,
    clean: true,
    target: 'node14',
  },
  {
    entry: { 'moment2.min': 'src/index.ts' },
    format: ['iife'],
    globalName: 'moment2',
    minify: true,
    sourcemap: true,
    target: 'node14',
    clean: false,
    outExtension() {
      return { js: '.js' }
    },
  },
])
