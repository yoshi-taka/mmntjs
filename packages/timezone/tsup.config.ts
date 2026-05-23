import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    logic: 'src/logic.ts',
    '1970-2030': 'src/1970-2030.ts',
    '10-year-range': 'src/10-year-range.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'node14',
})
