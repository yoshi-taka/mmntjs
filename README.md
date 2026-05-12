# mmntjs

Most teams don't keep using moment.js because they love it.
They keep using it because rewriting date logic across a large codebase is risky, expensive, and never becomes this quarter's priority.

mmntjs designed for that reality.

Drop-in replacement for moment.js — migration path to [Temporal API](https://tc39.es/proposal-temporal/).

## Quick Start

### Option A: Zero-code alias (switch today)

Replace moment.js with no code changes:

```sh
npm install moment@npm:mmntjs
```

```js
import moment from "moment";           // unchanged
moment("2024-01-01").add(1, "month");  // now runs on mmntjs
```

### Option B: Automated codemod (migrate imports)

Swap imports from `moment` to `mmntjs` across your codebase:

```sh
npx mmntjs migrate --check ./src     # dry run first
npx mmntjs migrate --apply ./src     # apply codemod
```

### As a standalone library

```sh
npm install mmntjs
```

```js
import moment from "mmntjs";
moment().format("YYYY-MM-DD");
moment.duration(2, "hours").humanize();
```

### Entry Points

| Import | Size (gzip) | Description |
|--------|------------:|-------------|
| `mmntjs` (bare import) | ~55 KB | Full compatibility (default) |
| `mmntjs/lite` | **15.6 KB** | ISO-centric, size-first SKU |
| `mmntjs/plugin/*` | +separate | Optional plugins (format-parse, duration, …) |
| `mmntjs/locale/*` | +separate | Individual locales (136 total) |

```js
// Use lite + plugins for smaller bundles
import moment from "mmntjs/lite";
import "mmntjs/plugin/format-parse";
import "mmntjs/locale/ja";
import "mmntjs-timezone";
```

### Platform Support

| Runtime | Support |
|---------|---------|
| Node.js | 16+ (CJS `require("mmntjs")`, ESM) |
| Browser | IIFE via CDN (`<script src="…/mmntjs.min.js">`) |
| Bun | Native ESM, first-class support |
| Deno | Compatible via npm specifiers |

```html
<script src="https://cdn.jsdelivr.net/npm/mmntjs/dist/mmntjs.min.js"></script>
<script>
  mmntjs().format("LLLL");
</script>
```

```js
// Node.js CJS
const moment = require("mmntjs");
```

---



## Three Pillars

### 1. Near-100% Drop-in Compatibility

**moment.js's own test suite**: 678/678 pass (52 QUnit files via compat layer).  
**Oracle comparison**: 112 properties, 45k+ assertions against upstream moment.js.  
**Mutation**: 10/10 injected bugs detected.  
**Fuzzing**: 9 coverage-guided harnesses + grammar-based ISO 8601 generator.

The only known incompatibilities are malformed/edge-case strings discovered through fuzzing (e.g. sign-prefixed strings without delimiters). These are under active repair — see [REMAINING.md](./docs/meta/REMAINING.md) for the shortlist.

136 locales, timezone, duration, calendar, custom format parse — all existing moment.js API surface covered.

Runs on Node 16+, browsers (IIFE/CDN), Bun, and Deno. CJS and ESM both supported.

TypeScript types included — `import moment from "moment"` resolves to mmntjs's types automatically. No `@types/moment` needed.

### 2. Modular & Smaller Than moment.js

| Entry | gzip | vs moment.js |
|-------|-----:|--------------|
| `mmntjs` (full) | ~55 KB | vs 77 KB (moment-with-locales.min.js) |
| `mmntjs/lite` | **15.6 KB** | vs 18.9 KB (moment.min.js) |

`lite` drops locale registry, Temporal bridge, custom format parse, and marginal APIs — add them back via plugins only when needed.

### 3. Faster Than date-fns in 23/25 Benchmarks

Also outperforms upstream moment.js in 28/30. Several hot-path operations outperform current Temporal implementations in microbenchmarks.

| Operation | mmntjs | date-fns | vs moment.js |
|-----------|--------:|---------:|-------------:|
| format YYYY-MM-DD | **35 ns** | 1.18 us (34x) | 413 ns (12x) |
| parse ISO string | **281 ns** | 1.01 us (3.6x) | 4.10 us (15x) |
| diff in days | **18 ns** | 851 ns (47x) | 413 ns (23x) |
| get day of year | **11 ns** | 1.14 us (104x) | — |
| moment() / new Date() | **52 ns** | 36 ns (0.9x) | 280 ns (5.4x) |
| startOf month | **13 ns** | 75 ns (5.8x) | — |

The main remaining regression is raw `moment()` construction overhead from compatibility wrapping. (wrapper overhead for moment.js API compatibility, negligible in real apps that reuse Moment objects).

Representative microbenchmarks on Node.js 26 (Apple M-series). ns-scale results use warmed monomorphic paths after 1000-iteration warmup — see [BENCHMARKS.md](./docs/perf/BENCHMARKS.md) for full methodology and caveats.

Techniques: decomposed field cache, lazy init, Shape stability, charCodeAt parsing, branch reduction, pre-computed tables. See [Performance Analysis](./docs/perf/ANALYSIS.md), [Techniques](./docs/perf/TECHNIQUES.md), [Benchmarks](./docs/perf/BENCHMARKS.md).

## Beyond a Runtime Replacement

mmntjs is not just a drop-in replacement. It also serves as a **migration-analysis toolchain** for legacy Moment codebases targeting [Temporal](https://tc39.es/proposal-temporal/):

```
Legacy moment.js codebase
  │
  ├── mmntjs audit ./src        ← Observability: inventory all moment API usage
  ├── mmntjs stats ./src        ← Quantify: usage patterns, migration surface
  │
  ├── mmntjs migrate --check    ← Dry-run compatibility assessment
  ├── mmntjs migrate --apply    ← Automated codemod (moment → mmntjs)
  │
  └── mmntjs report ./src       ← Temporal migration guidance per module
```

Each phase is independent. Start with audit to understand your legacy surface, then migrate to mmntjs at your own pace, and finally generate a Temporal migration report when ready.

## Development

```sh
bun install
bun run build          # CJS + ESM + IIFE + DTS
bun run test:hard      # Full test suite
bun run lint           # oxlint
```

## License

MIT
