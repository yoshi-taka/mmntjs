import { defineConfig } from 'tsup'

const shared = {
  sourcemap: true,
  target: 'node16' as const,
}

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/lite.ts', 'src/full.ts', 'src/locale/*.ts', 'src/plugin/*.ts', 'src/bin/cli.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    clean: true,
    ...shared,
  },
  {
    entry: ['src/temporal-entry.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    clean: false,
    // Bundle temporal polyfill to preserve zero-dependency contract
    noExternal: ['@js-temporal/polyfill'],
    ...shared,
  },
  {
    entry: { 'mmntjs.min': 'src/index.ts' },
    format: ['iife'],
    globalName: 'mmntjs',
    minify: true,
    clean: false,
    outExtension() {
      return { js: '.js' }
    },
    ...shared,
  },
])
