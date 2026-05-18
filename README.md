# mmntjs

Most teams don't keep using moment.js because they love it.
They keep using it because rewriting date logic across a large codebase is risky, expensive, and never becomes this quarter's priority.

mmntjs designed for that reality.

Drop-in replacement for moment.js — migration path to [Temporal API](https://tc39.es/proposal-temporal/).

**Website: [mmntjs.veritycost.com](https://mmntjs.veritycost.com)**

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

### Option C: Gradual migration (coexistence mode)

Migrate file by file — `moment` and `mmntjs` can coexist in the same project:

```sh
npm install mmntjs
```

```js
// file-a.js — not yet migrated
import moment from "moment";       // still on moment.js

// file-b.js — migrated
import moment from "mmntjs";       // now on mmntjs
```

This works because the two runtimes don't conflict — you can move module by module at your own pace. No need for a big-bang switch.

> **Tip**: Start with `mmntjs audit ./src` to identify which files use only compatible APIs. Those are your safest first candidates.

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

#### Import path contract

| Import | gzip (bundled) | gzip (dist) | Description |
|--------|--------------:|------------:|-------------|
| `mmntjs` | **39 KB** | 54 KB | Full compatibility (default) — core + display + utc + locale registry + format-parse |
| `mmntjs/lite` | **12 KB** | 16 KB | ISO-centric, size-first — core-lite + strict parsing, no locale registry, no display extras |
| `mmntjs/full` | **39 KB** | 54 KB | Same as default — explicit alias |
| `mmntjs/temporal` | **47 KB** | 37 KB | Temporal bridge — `toTemporal(m)` / `fromTemporal(t)` |
| `mmntjs/plugin/*` | — | +separate | Optional plugins (utc, format-parse) — self-contained, add features to lite |
| `mmntjs/locale/*` | — | +1-8 KB | Individual locales (136 total) — tree-shakeable, each <2 KB gzip |
| `mmntjs-timezone` | **41 KB** | — | Separate package — `installTimezone(moment)` |

> **bundled**: measured from source with `Bun.build({minify:true, target:"browser"})` — represents what consumer bundlers produce.
> **dist**: raw tsup output with `splitting:false` — self-contained files, some code duplication across entries is expected.

```js
// Use lite + plugins for smaller bundles
import moment from "mmntjs/lite";
import "mmntjs/plugin/format-parse";
import "mmntjs/locale/ja";
import "mmntjs-timezone";
```

#### What each entry includes

| Feature | `lite` | `default` | `full` | `temporal` |
|---------|:------:|:---------:|:------:|:----------:|
| `moment()` / format / parse (ISO) | ✅ | ✅ | ✅ | — |
| Strict ISO 8601 parsing | ✅ | ✅ | ✅ | — |
| `.add()` / `.subtract()` / `.startOf()` / `.endOf()` | ✅ | ✅ | ✅ | — |
| `.diff()` / `.from()` / `.to()` | ✅ | ✅ | ✅ | — |
| UTC mode (`moment.utc()` / `.utc()` / `.local()`) | via plugin | ✅ | ✅ | — |
| Locale registry (`moment.locale()` / `defineLocale()`) | — | ✅ | ✅ | — |
| Custom format parsing (`moment("…", "YYYY-MM-DD")`) | via plugin | ✅ | ✅ | — |
| `.format("LLL")` locale-aware | via plugin | ✅ | ✅ | — |
| `moment.duration()` | via plugin | ✅ | ✅ | — |
| `moment.min()` / `moment.max()` / `moment.parseZone()` | — | ✅ | ✅ | — |
| `toTemporal(m)` / `fromTemporal(t)` | — | — | — | ✅ |
| CLI (`mmntjs migrate` / `mmntjs audit`) | — | — | — | — |

> `lite` includes `.format("YYYY-MM-DD")` (basic format tokens) and ISO parsing. Add `format-parse` plugin for custom format strings and locale-aware long date formats.

#### Modularity guarantees

- **Timezone is fully opt-in**: `mmntjs-timezone` is a separate package. Core bundles (`lite`, `default`, `full`) contain zero timezone resolution code — no `Intl.DateTimeFormat` references.
- **Temporal is opt-in**: `mmntjs/temporal` is the only entry that exports `toTemporal`/`fromTemporal`. Neither `lite` nor `default` pulls `@js-temporal/polyfill`.
- **Locales are tree-shakeable**: Each locale is a standalone module. Importing `mmntjs/locale/ja` does not pull `de`, `fr`, or any other locale.
- **CLI is separate**: The `mmntjs` CLI binary uses `dist/bin/cli.js`; none of the library entry points contain CLI code.
- **Side effects**: `"sideEffects": false` in package.json — all entry points are safe for consumer tree-shaking.

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
**Mutation**: 20 operators, 100% kill rate (12/12 applicable, 8 N/A).  
**Fuzzing**: 9 coverage-guided harnesses + grammar-based ISO 8601 generator.

The only known incompatibilities are malformed/edge-case strings discovered through fuzzing (e.g. sign-prefixed strings without delimiters). These are under active repair — see [REMAINING.md](./docs/meta/REMAINING.md) for the shortlist.

> **Compatibility story**: Fuzzer found `moment("0000 03")` — both engines must produce `2000-03-01` (year 2000, March 1). Our ISO table parser was matching `"0000 03"` as year-0000 month-03, a wrong answer. Rather than adding more regex special cases, we introduced a `_claimed` sentinel: when the table parser finds a low-confidence match, it returns `_claimed: true` to delegate to JavaScript's native `new Date(str)` — exactly what moment.js does as its last resort. This single mechanism closed 7+ fuzz-discovered gaps without adding parser complexity.

136 locales, timezone, duration, calendar, custom format parse — all existing moment.js API surface covered.

Runs on Node 16+, browsers (IIFE/CDN), Bun, and Deno. CJS and ESM both supported.

TypeScript types included — `import moment from "moment"` resolves to mmntjs's types automatically. No `@types/moment` needed.

### 2. Modular & Smaller Than moment.js

| Entry | gzip | vs moment.js |
|-------|-----:|--------------|
| `mmntjs` (full) | ~55 KB | vs 77 KB (moment-with-locales.min.js) |
| `mmntjs/lite` | **15.6 KB** | vs 18.9 KB (moment.min.js) |

`lite` drops locale registry, Temporal bridge, custom format parse, and marginal APIs — add them back via plugins only when needed.

### 3. Faster Than date-fns in 24/25 Benchmarks

Also outperforms upstream moment.js in all 31 benchmarked operations. Several hot-path operations outperform current Temporal implementations in microbenchmarks.

| Operation | mmntjs | date-fns | vs moment.js |
|-----------|--------:|---------:|-------------:|
| format YYYY-MM-DD | **56 ns** | 1.31 us (23.4x) | 420 ns (12.7x) |
| parse ISO string | **363 ns** | 1.30 us (3.6x) | 4.20 us (13.5x) |
| diff in days | **20 ns** | 935 ns (46.8x) | 491 ns (27.3x) |
| add 1 second | **15 ns** | 108 ns (7.2x) | — |
| get day of year | **17 ns** | 1.38 us (81.2x) | — |
| moment() / new Date() | **40 ns** | 35 ns (0.9x) | 221 ns (5.3x) |
| startOf month | **17 ns** | 75 ns (4.4x) | — |

The main remaining overhead is raw `moment()` construction from compatibility wrapping (wrapper overhead for moment.js API compatibility, negligible in real apps that reuse Moment objects).

Representative Bun microbenchmarks on Apple Silicon. ns-scale results use median-of-repeated warmed runs after warmup — see [BENCHMARKS.md](./docs/perf/BENCHMARKS.md) for methodology, noise markers, and caveats.

For `month`/`quarter`/`year` comparisons, note that date-fns uses calendar-difference helpers while mmntjs matches moment.js's truncated fractional diff semantics. Those rows are still useful as implementation-cost comparisons, but they are not result-equivalent APIs.

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
