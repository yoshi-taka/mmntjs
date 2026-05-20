# Bundle Size Architecture

> この文書がサイズ測定の正準データ。他文書（README, site）はここを参照して記載する。
> 測定は `bun run size`（`scripts/bundle-size.ts`）で行う。

## Current Measurements (2026-05-20)

### From source (Bun.build, minified — what consumer bundlers produce)

| Import | Raw | Gzip | Brotli |
|--------|----:|-----:|-------:|
| `mmntjs` (default) | **150 KB** | **39.0 KB** | 33.2 KB |
| `mmntjs/lite` | **44 KB** | **12.2 KB** | 10.6 KB |
| `mmntjs/full` | **150 KB** | **39.0 KB** | 33.1 KB |
| `mmntjs/temporal` | 157 KB | 46.7 KB | 39.7 KB |
| `mmntjs-timezone` | **449 KB** | **75 KB** | 61.0 KB |
| `mmntjs-timezone/logic` | 166 KB | 44.7 KB | 37.6 KB |
| `mmntjs-timezone/1970-2030` | 231 KB | 62.5 KB | 52.0 KB |

### Dist files (tsup output, splitting:false — self-contained)

| File | Raw | Gzip | Brotli |
|------|----:|-----:|-------:|
| `dist/lite.js` | 85.1 KB | 16.8 KB | 14.1 KB |
| `dist/index.js` (full) | 299.1 KB | 54.8 KB | 44.5 KB |
| `dist/full.js` | 299.1 KB | 54.8 KB | 44.5 KB |
| `dist/temporal-entry.js` | 478.0 KB | 93.9 KB | 77.2 KB |
| `dist/mmntjs.min.js` | 147.7 KB | 39.5 KB | 33.5 KB |
| `dist/plugin/utc.js` | 282.0 KB | 51.0 KB | 36.9 KB |
| `dist/plugin/format-parse.js` | 276.2 KB | 47.8 KB | 33.3 KB |
| `dist/locale/ja.js` | 4.8 KB | 1.5 KB | 1.3 KB |

### Comparison vs moment.js and alternatives

> 全ライブラリ `Bun.build({minify:true, target:"browser"})` でバンドルしたサイズ（gzip）。

| Library | gzip | Notes |
|---------|-----:|-------|
| `mmntjs/lite` | **12.2 KB** | Recommended default |
| `mmntjs` (default) | **39.0 KB** | Full compatibility |
| `moment` (from source) | 20.5 KB | 単一ファイル UMD、locale なし |
| `moment` + 2 locales | 22.1 KB | locale は本体に merge される |
| `dayjs` | 3.0 KB | Minimal |
| `date-fns/format` | 5.5 KB | 関数単位 |

> **timezone について**: `mmntjs-timezone` は3種類のバンドルがあり、どれを指すかで値が倍違う。
> - `mmntjs-timezone/logic`: 44.7 KB gzip — IANA 解決ロジックのみ、データなし
> - `mmntjs-timezone/1970-2030`: 62.5 KB gzip — よく使われる範囲のデータ
> - `mmntjs-timezone` (full): 75 KB gzip — 全データ
> 
> README の「75 KB」は full bundle、BUNDLE_SIZE.md の「40.6 KB」は logic-only を指していた。**以降は full bundle をデフォルトとする**。

## Entry Point Boundaries

### `mmntjs/lite` (12.2 KB gzip / 44 KB raw)

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

### `mmntjs` / `mmntjs/full` (39.0 KB gzip / 150 KB raw)

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

### `mmntjs-timezone` (75 KB gzip / 449 KB raw — full bundle)

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
5. **Tree-shaking**: Core entry initialization always runs on import. Individual named exports (`Duration`, `Locale`, etc.) are tree-shakeable if unused. `plugin/*` and `locale-auto/*` submodules are marked as side-effectful for bundler safety; `locale/*` are pure data and fully tree-shakeable.

## `splitting:false` Evaluation

tsup currently builds with `splitting:false` — each entry point bundles all its dependencies inline.

| Aspect | Assessment |
|--------|-----------|
| Simplicity | ✅ Self-contained, no missing chunk errors |
| CJS/ESM | ✅ Works for both |
| Code duplication | ⚠️ Some across entries (e.g., shared utils duplicated in lite + plugin), but consumers typically use one entry at a time |
| Consumer tree-shaking | ✅ explicit side-effect subpaths + source maps enable good tree-shaking from source |

**Recommendation**: Keep `splitting:false` for library distribution. The duplication is a known trade-off that keeps each entry independently usable. The gap between dist file size (tsup bundled) and consumer bundle size (tree-shaken by bundler) is wide — lite goes from 16.8 KB (dist gzip) → 12.2 KB (consumer), default from 54.8 KB → 39.0 KB.

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
