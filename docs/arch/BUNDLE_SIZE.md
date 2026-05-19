# Bundle Size Architecture

## Current Measurements (2026-05-17)

### From source (Bun.build, minified + gzip — what consumer bundlers produce)

| Import | Raw | Gzip | Brotli |
|--------|----:|-----:|-------:|
| `mmntjs` (default) | 148 KB | 39.0 KB | 32.8 KB |
| `mmntjs/lite` | 43 KB | 11.9 KB | 10.4 KB |
| `mmntjs/full` | 148 KB | 39.0 KB | 32.8 KB |
| `mmntjs/temporal` | 157 KB | 46.7 KB | 39.7 KB |
| `mmntjs-timezone` | 152 KB | 40.6 KB | 33.9 KB |

### Dist files (tsup output, splitting:false — self-contained)

| File | Raw | Gzip | Brotli |
|------|----:|-----:|-------:|
| `dist/lite.js` | 83.5 KB | 16.4 KB | 13.9 KB |
| `dist/index.js` (full) | 294.2 KB | 54.2 KB | 43.6 KB |
| `dist/temporal-entry.js` | 212.9 KB | 37.2 KB | 30.8 KB |
| `dist/mmntjs.min.js` | 145.3 KB | 39.0 KB | 33.0 KB |
| `dist/plugin/utc.js` | 247.1 KB | 44.3 KB | 31.9 KB |
| `dist/plugin/format-parse.js` | 245.3 KB | 42.1 KB | 28.5 KB |
| `dist/locale/ja.js` | 4.8 KB | 1.5 KB | 1.3 KB |

### Comparison vs moment.js and alternatives

| Library | gzip | Notes |
|---------|-----:|-------|
| `mmntjs/lite` | **11.9 KB** | ISO-centric subset |
| `mmntjs` (default) | **39.0 KB** | Full compatibility |
| `moment/min/moment.min.js` | 18.9 KB | No locales |
| `moment/min/moment-with-locales.min.js` | 77.0 KB | All locales |
| `dayjs/dayjs.min.js` | 3.0 KB | Minimal |
| `date-fns/format.js` | 5.5 KB | Function-scoped |

## Entry Point Boundaries

### `mmntjs/lite` (11.9 KB gzip)

Smallest useful drop-in. Includes:
- MomentLite class (parse, format, add/subtract, startOf/endOf, diff)
- ISO 8601 strict parsing
- Basic format tokens (YYYY, MM, DD, HH, mm, ss, SSS)
- UTC mode via `moment.utc()` (built-in)
- No locale registry — English only
- No custom format parsing (`moment(str, fmt)`)
- No `duration` static
- No `parseZone`, `min`, `max`
- No locale-aware formatting (`LLLL`, relative time)

### `mmntjs` / `mmntjs/full` (39.0 KB gzip)

Full moment.js API compatible build. Adds to lite:
- Full Moment class with locale runtime
- Locale registry (`defineLocale`, `updateLocale`, `locales()`)
- Custom format parsing (`moment(str, fmt, [strict])`)
- Duration (`moment.duration()`)
- UTC plugin (`moment.utc()`, `.utc()`, `.local()`, `.utcOffset()`, `.parseZone()`)
- Display extras (`calendar()`, relative time)
- Debug extras (`parsingFlags()`, `creationData()`, `inspect()`)
- `moment.min()`, `moment.max()`, `moment.parseZone()`

### `mmntjs/temporal` (46.7 KB gzip)

Temporal API bridge — separate entry, not included in default:
- `toTemporal(moment)` — convert Moment → Temporal.PlainDate / ZonedDateTime
- `fromTemporal(temporal)` — convert Temporal → Moment
- Lazy-loads `@js-temporal/polyfill` via `require()` — polyfill only runs when conversion is called

### `mmntjs-timezone` (40.6 KB gzip)

Separate peer package (`mmntjs-timezone`):
- Full moment-timezone compatible API
- Uses `Intl.DateTimeFormat` for IANA timezone resolution
- Zero timezone code in any `mmntjs` entry
- Requires explicit `import "mmntjs-timezone"` — never auto-loaded

## Modularity Guarantees

These are enforced by `test/bundle-smoke.test.ts` and `test/tree-shaking.test.ts`:

1. **Timezone isolation**: No `Intl.DateTimeFormat`, `installTimezone`, `tz.add`, or `mmntjs-timezone` strings appear in any `lite`, `default`, or `full` bundle.
2. **Temporal isolation**: No `toTemporal`/`fromTemporal`/`@js-temporal/polyfill` in `lite` or `default`. Only `temporal` entry exports them.
3. **Locale isolation**: Importing `mmntjs/locale/ja` does not pull `de`, `fr`, or any other locale. Each locale is a standalone pure-data module (<2 KB gzip). For moment-style side effects, use `mmntjs/locale-auto/ja`.
4. **CLI exclusion**: The `mmntjs` CLI binary (`dist/bin/cli.js`) is never bundled into library entry points.
5. **Tree-shaking**: Only `plugin/*` and `locale-auto/*` are marked as side-effectful. Core entries and `locale/*` remain tree-shakeable.

## `splitting:false` Evaluation

tsup currently builds with `splitting:false` — each entry point bundles all its dependencies inline.

| Aspect | Assessment |
|--------|-----------|
| Simplicity | ✅ Self-contained, no missing chunk errors |
| CJS/ESM | ✅ Works for both |
| Code duplication | ⚠️ Some across entries (e.g., shared utils duplicated in lite + plugin), but consumers typically use one entry at a time |
| Consumer tree-shaking | ✅ explicit side-effect subpaths + source maps enable good tree-shaking from source |

**Recommendation**: Keep `splitting:false` for library distribution. The duplication is a known trade-off that keeps each entry independently usable. The gap between dist file size (tsup bundled) and consumer bundle size (tree-shaken by bundler) is wide — lite goes from 16 KB (dist) → 12 KB (consumer), default from 54 KB → 39 KB.

## Size Regression Guard

`bun run size` — prints current measurements.
`bun run size:guard` — fails if:
- lite exceeds 60 KB raw / 16 KB gzip
- default exceeds 180 KB raw / 47 KB gzip
- full exceeds 180 KB raw / 47 KB gzip
- temporal exceeds 200 KB raw / 50 KB gzip
- timezone code appears in core bundles
- Temporal code appears in lite/default bundles
- Locale files contain data from other locales

## History

Phase 1: Split locale into individual imports (removed 137× from core bundle).
Phase 2: Separate `lite` / `full` / `temporal` entry points.
Phase 3: Remove locale registry from lite.
Phase 4: Remove Temporal bridge from core (moved to `temporal-entry.ts`).
Phase 5: Add bundle-size measurement + size regression guard (this document).
