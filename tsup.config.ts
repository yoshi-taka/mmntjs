import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/lite.ts', 'src/full.ts', 'src/temporal-entry.ts', 'src/locale/*.ts', 'src/plugin/*.ts', 'src/bin/cli.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    target: 'node16',
  },
  {
    entry: { 'mmntjs.min': 'src/index.ts' },
    format: ['iife'],
    globalName: 'mmntjs',
    minify: true,
    sourcemap: true,
    target: 'node16',
    clean: false,
    outExtension() {
      return { js: '.js' }
    },
  },
])
