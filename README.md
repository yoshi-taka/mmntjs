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
| `mmntjs` | **45.1 KB** | 63.4 KB | Full compatibility (default) — core + display + utc + locale registry + format-parse |
| `mmntjs/lite` | **14.8 KB** | 20.5 KB | ISO-centric, size-first — core-lite + strict parsing, no locale registry, no display extras |
| `mmntjs/full` | **45.1 KB** | 63.4 KB | Same as default — explicit alias |
| `mmntjs/fns` | **0.5-1.3 KB*** | 6.8 KB | Tree-shakeable Date helpers — single `format` is 507 B gzip, `parseISO+format+addDays` is 1.3 KB gzip |
| `mmntjs/temporal` | **46.7 KB** | 102.6 KB | Temporal bridge — `toTemporal(m)` / `fromTemporal(t)` |
| `mmntjs/plugin/*` | — | +separate | Optional plugins (utc, format-parse) — self-contained, add features to lite |
| `mmntjs/locale/*` | — | +1-5 KB | Individual locales (136 total) — tree-shakeable, each <2 KB gzip |
| `mmntjs-timezone` | **81.1 KB** | 39.0 KB | Separate package — full IANA timezone data + `installTimezone(moment)` |

> **bundled**: measured from source with `Bun.build({minify:true, target:"browser"})` — represents what consumer bundlers produce.
> **dist**: raw tsup output with `splitting:false` — self-contained files, some code duplication across entries is expected.
> `*` `mmntjs/fns` is fully tree-shakeable, so its bundled size depends on what you import.

```js
// Use lite + plugins for smaller bundles
import moment from "mmntjs/lite";
import "mmntjs/plugin/format-parse";
import "mmntjs/locale-auto/ja";
import "mmntjs-timezone";
```

If you want the smallest locale import with explicit registration instead of side effects:

```js
import moment from "mmntjs";
import { jaLocale } from "mmntjs/locale/ja";

moment.locale("ja", jaLocale);
```

#### What each entry includes

| Feature | `lite` | `default` | `full` | `temporal` |
|---------|:------:|:---------:|:------:|:----------:|
| `moment()` / format / parse (ISO) | ✅ | ✅ | ✅ | — |
| Strict ISO 8601 parsing | ✅ | ✅ | ✅ | — |
| `.add()` / `.subtract()` / `.startOf()` / `.endOf()` | ✅ | ✅ | ✅ | — |
| `.diff()` / `.from()` / `.to()` | ✅ | ✅ | ✅ | — |
| UTC mode (`moment.utc()` / `.utc()` / `.local()`) | ✅ | ✅ | ✅ | — |
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
- **Locales are tree-shakeable**: Each locale is a standalone module. Importing `mmntjs/locale/ja` gives you pure locale data; importing `mmntjs/locale-auto/ja` auto-registers that locale for migration convenience.
- **CLI is separate**: The `mmntjs` CLI binary uses `dist/bin/cli.js`; none of the library entry points contain CLI code.
- **Side effects**: Core entry initialization (`moment()` setup) always runs on import. `plugin/*` and `locale-auto/*` submodules are marked as side-effectful for bundler safety. `locale/*` export pure data and are fully tree-shakeable.

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

**moment.js's own test suite**: 630/630 pass (52 QUnit files via compat layer).  
**Oracle comparison**: 112 properties, 45k+ assertions against upstream moment.js.  
**Mutation**: 48/48 killed in the current curated mutation suite.  
**Fuzzing**: 11 coverage-guided harnesses + grammar-based ISO 8601 generator.

The only known incompatibilities are malformed/edge-case strings discovered through fuzzing (e.g. sign-prefixed strings without delimiters). These are under active repair — see [REMAINING.md](./docs/meta/REMAINING.md) for the shortlist.

> **Compatibility story**: Fuzzer found `moment("0000 03")` — both engines must produce `2000-03-01` (year 2000, March 1). Our ISO table parser was matching `"0000 03"` as year-0000 month-03, a wrong answer. Rather than adding more regex special cases, we introduced a `_claimed` sentinel: when the table parser finds a low-confidence match, it returns `_claimed: true` to delegate to JavaScript's native `new Date(str)` — exactly what moment.js does as its last resort. This single mechanism closed 7+ fuzz-discovered gaps without adding parser complexity.

136 locales, timezone, duration, calendar, custom format parse — all existing moment.js API surface covered.

Runs on Node 16+, browsers (IIFE/CDN), Bun, and Deno. CJS and ESM both supported.

TypeScript types included — `import moment from "moment"` resolves to mmntjs's types automatically. No `@types/moment` needed.

### 2. Modular And Measurable

| Entry | gzip (bundled) | Notes |
|-------|---------------:|-------|
| `mmntjs` (full) | **45.1 KB** | Full compatibility entry for migration |
| `mmntjs/lite` | **14.8 KB** | Recommended default when you do not need the full surface |
| `mmntjs/fns` | **507 B - 1.3 KB** | Single helpers stay tiny; size scales with imports |
| `mmntjs-timezone` | **81.1 KB** | Separate package; named-zone data is opt-in |

`lite` drops locale registry, Temporal bridge, custom format parse, and marginal APIs — add them back via plugins only when needed.

### 3. Faster Than moment.js On The Main Compatibility Paths

In the current public `moment` comparison table, mmntjs wins every tracked row. Against `date-fns`, the picture is mixed: the object-oriented `mmntjs` API wins read-heavy rows, while `date-fns` often wins fresh-object mutation rows. The standalone `mmntjs/fns` entry closes much of that gap and wins 19 of 26 direct Date-helper comparisons.

| Operation | mmntjs | date-fns | vs moment.js |
|-----------|--------:|---------:|-------------:|
| format YYYY-MM-DD | **63 ns** | 1.55 us (24.4x) | 445 ns (4.9x) |
| parse ISO string | **317 ns** | 1.26 us (4.0x) | 6.09 us (23.3x) |
| diff in days | **22 ns** | 872 ns (40.3x) | 462 ns (13.2x) |
| add 1 day | **387 ns** | 93 ns (0.24x) | 2.67 us (6.9x) |
| startOf day | **189 ns** | 87 ns (0.46x) | 2.13 us (11.2x) |
| moment() / new Date() | **199 ns** | 36 ns (0.18x) | 670 ns (3.4x) |
| `mmntjs/fns` format YYYY-MM-DD | **507 B gzip** | — | single-import bundle |

The losses against date-fns on fresh-object rows are structural, not implementation gaps. Every `moment()` call allocates a wrapper object around a `Date` — this is the cost of preserving moment-compatible mutability, method chaining, `.fn`/`.prototype` extensibility, and locale context. `date-fns` operates on bare `Date` instances and skips that overhead entirely. The `[fresh]` benchmark marker amplifies the difference because it creates and discards a wrapper per iteration; real applications amortize it by reusing Moment objects. If you want date-fns-style standalone helpers without the wrapper, `mmntjs/fns` is the closer comparison point — it wins 19 of 26 direct Date-helper rows.

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
