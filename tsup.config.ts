import { defineConfig } from 'tsup'

const shared = {
  sourcemap: true,
  target: 'node16' as const,
}

function cjsFooter() {
  return {
    footer: ({ format }: { format: string }) => {
      if (format !== 'cjs') return undefined;
      // CJS interop: make require('mmntjs') return the default function
      // with named exports attached (not { default: fn, ... })
      return {
        js: `var _mm = module.exports; if(_mm&&_mm.default&&_mm!==_mm.default){Object.keys(_mm).forEach(function(k){if(k!=="default")_mm.default[k]=_mm[k]});module.exports=_mm.default}`,
      };
    },
  };
}

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/lite.ts', 'src/full.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    clean: true,
    ...shared,
    ...cjsFooter(),
  },
  {
    entry: ['src/fns/index.ts', 'src/locale/*.ts', 'src/plugin/*.ts', 'src/bin/cli.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    clean: false,
    ...shared,
  },
  {
    entry: ['src/temporal-entry.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    clean: false,
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
