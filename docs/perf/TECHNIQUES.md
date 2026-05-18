# Performance Techniques

Implementation-level performance techniques currently used in mmntjs.

This document answers "what do we do in the code". It is a catalog of concrete hot-path techniques, not a full theory of why they help.

Performance here does not come from a single source such as L2 cache locality. Different techniques help for different reasons: fewer allocations, less Date/regex/Intl work, less repeated parsing, less eagerly paid work, more direct arithmetic, and better cache reuse.

If you want the "why this tends to work" view, including engine/runtime discussion, read [ANALYSIS.md](./ANALYSIS.md).

This file focuses on techniques that are present in the current code. The full commit history also contains intermediate forms, discarded experiments, and steps that were later subsumed by stronger versions of the same idea.

Examples below are intentionally simplified. The current code paths live across `src/moment-class.ts`, `src/display/format.ts`, `src/core/factory-*.ts`, and `src/parse.ts`.

## 1. Field Cache (Decomposed Date Cache)

Hot path: getters, formatters, calendar math

**Problem**: `d.getFullYear()` and similar Date APIs hit V8's native C++ bindings on every call, traversing the prototype chain.

**Solution**: Store 8 decomposed fields (`$y $M $D $W $H $m $s $ms`) directly on the Moment instance. Populate them once from the Date object in the constructor/startOf/add. Getters become simple property reads (1 load).

**Effect**: getter: 250ns -> 10-25ns (10-25x)

```
// Before: prototype chain + C++ call
year() { return this._getD().getFullYear(); }

// After: cached field lookup
year() { return this._isValid ? this.$y : NaN; }
```

## 2. Lazy Field Initialization (`_dirty` flag)

Hot path: `moment()`, getters, post-mutation reads

**Problem**: Calling `_refreshFields()` in every constructor unconditionally generates a Date + reads/writes 8 fields. For throwaway `moment()` calls this is pure waste.

**Solution**: Introduce a `_dirty` flag. Set `_dirty = true` in the constructor without calling `_refreshFields()`. On first getter access, `_ensureFields()` materializes the fields.

**Effect**: `moment()` 130ns -> 59ns (2.2x). Particularly effective for ephemeral moments.

```typescript
// constructor: defer field init
this._dirty = this._isValid;
// _refreshFields() not called

// getter: init on first access
year() {
  if (!this._isValid) return NaN;
  this._ensureFields();  // cost paid once
  return this.$y;        // subsequent calls: _ensureFields is a no-op
}

private _ensureFields(): void {
  if (this._dirty) {
    this._dirty = false;
    this._refreshFields();
  }
}
```

## 3. Error State Separation (reducing `_cold`)

Hot path: `isValid()`, constructor fast path

**Problem**: The old `_cold` object held `_i` (input), `_f` (format), etc., which exist on every Moment. This made `_cold` always present, killing the `isValid()` fast path (`if (!cold) return true`).

**Solution**: Promote `_i`, `_f`, `_strict` from `_cold` to direct instance properties. `_cold` is now only created on errors (overflow, empty, nullInput, invalidMonth, etc.).

**Effect**: `isValid()` drops from 7 property accesses to 1 null check. `_cold` allocation is eliminated entirely for normal moments.

```typescript
// Before: _cold always present
_cold = { _i: "2024-01-15", _f: "YYYY-MM-DD", ... }
isValid() {
  if (!this._isValid) return false;
  const cold = this._cold;       // always exists
  if (!cold) return true;        // dead code
  if (cold._overflow >= 0) ...   // always checked
}

// After: _cold only when invalid
_cold = undefined  // normal case
isValid() {
  if (!this._isValid) return false;
  const cold = this._cold;
  if (!cold) return true;        // normal: exits here
  if (cold._overflow >= 0) ...   // error only
}
```

## 4. Digit Parsers Instead of Regex-First Parsing

Hot path: ISO string parsing

**Problem**: ISO parsing is hot. Regex-first parsing pays pattern startup cost, match-array allocation, and extra substring handling before any date fields exist.

**Solution**: The fast ISO path stays `charCodeAt`-based and uses tiny digit helpers such as `parse4Digits`, `p1`, `p2`, `p3`, `p4`, `p5`, `p6`. This keeps parsing on raw string bytes and avoids the regex engine for common inputs.

**Effect**: The hot path remains allocation-light and predictable. Exact helper boundaries changed over time, but the core win is still "digit arithmetic over regex plumbing".

```typescript
// Current style: tiny digit helpers over raw charCodeAt
const year = parse4Digits(str, 0);
const month1 = p2(str, 5);
const day = p2(str, 8);

function p2(str: string, idx: number): number | null {
  const a = str.charCodeAt(idx), b = str.charCodeAt(idx + 1);
  if (a < 48 || a > 57 || b < 48 || b > 57) return null;
  return (a - 48) * 10 + (b - 48);
}
```

## 5. Fast Path Bypass in `createFromString`

Hot path: string factory entrypoints

**Problem**: After `parseString()` succeeds, the generic constructor path still has more work available: overflow bookkeeping, fallback parsing, and full formatted-input handling.

**Solution**: Tag parse results with `_hasDate`. Both full and lite factories check that flag first and immediately materialize a `Moment` via `createDateSafe(...)`, bypassing the slower general path.

**Effect**: Common ISO strings avoid extra parse stages, and the same shortcut exists in both `src/core/factory-shared.ts` and `src/core/factory-lite-impl.ts`.

```typescript
if (parsed._hasDate !== undefined) {
  return new Moment({
    _d: createDateSafe(
      parsed.year, parsed.month, parsed.day,
      parsed.hour ?? 0, parsed.minute ?? 0,
      parsed.second ?? 0, parsed.millisecond ?? 0,
      parsed.offset !== undefined,
    ),
    _offset: parsed.offset,
    _isUTC: parsed.offset !== undefined,
    _i: str,
  });
}
// General parsed-object construction only runs when the fast path is skipped.
```

## 6. Predicate Pushdown and Parse Hot/Cold Separation

Hot path: `parseString()` without explicit format

**Problem**: A generic string parser tends to do expensive work too early: locale preparse, broad ISO attempts, RFC checks, and regex-based fallbacks even when the first few bytes already rule most of that out.

**Solution**: `parseString()` now rejects or routes inputs as early as possible.
- `en` + no-format calls get a dedicated fast path.
- simple `charCodeAt` checks classify digit/slash/sign starts.
- `parseCommonISO` and `parseCommonISOExtended` run before broader paths.
- RFC 2822 and table-driven ISO parsing are only reached when the cheaper predicates fail.

```typescript
if (!format && (locale?._abbr ?? "en") === "en") {
  if ((len === 10 || (len >= 19 && len <= 29)) && str.charCodeAt(4) === 45 && str.charCodeAt(7) === 45) {
    const fast = parseCommonISO(str);
    if (fast) return fast;
  }
}

const c0 = trimmed.charCodeAt(0);
const isDigit = c0 >= 48 && c0 <= 57;
const isSlash = c0 === 47;
const isSign = c0 === 43 || c0 === 45;
```

## 7. UTC Calendar Arithmetic (`ymdToEpochDays` + `daysInMonthFast`)

Hot path: UTC add/subtract/startOf/endOf month/year paths

**Problem**: UTC month/year mutations are surprisingly expensive if they bounce through `Date`, `Date.UTC`, or repeated month-normalization helpers on every call.

**Solution**: The UTC mutation path computes everything in integer space:
- `normalizeMonth()` wraps the month index.
- `daysInMonthFast()` uses a tiny table + leap-year branch.
- `ymdToEpochDays()` turns Y/M/D back into epoch days without allocating a `Date`.

```typescript
const tm = this.$y * 12 + this.$M + totalMonths;
const y = Math.floor(tm / 12);
const m = normalizeMonth(tm);
let d_ = this.$D;
if (d_ > 28) {
  const md = daysInMonthFast(y, m);
  if (d_ > md) d_ = md;
}

this._t =
  ymdToEpochDays(y, m, d_) * 86400000 +
  this.$H * 3600000 +
  this.$m * 60000 +
  this.$s * 1000 +
  this.$ms;
```

## 8. `_epochDaysToYMD` — Date Allocation Avoidance via Arithmetic

Hot path: UTC field refresh

**Problem**: UTC-mode `_refreshFields()` needs year/month/day from epoch ms. Creating a `new Date(t)` allocates memory.

**Solution**: Calculate year/month/day directly from `(t / 86400000)` using pure arithmetic. No loops, minimal branches. Also used for Tomohiko Sakamoto's day-of-week.

```typescript
private static _epochDaysToYMD(z: number): [number, number, number] {
  z += 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + ...) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  return [y + (m <= 2 ? 1 : 0), m - 1, d];
}
```

## 9. Format Fast Path (`formatCommonEn`)

Hot path: common English formats

**Problem**: The general format loop interprets tokens one character at a time. Even `YYYY-MM-DD` goes through the full loop.

**Solution**: Handle common formats (`YYYY-MM-DD`, `HH:mm:ss`, `YYYY-MM-DDTHH:mm:ss.SSSZ`, `LL`, `LT`, `LLLL`, etc.) in `src/display/format.ts`. Only active for locale `en`, valid moments, and year `0..9999`. The fast path also checks `_dirty` and forces one field refresh only when needed.

**Effect**: `format('YYYY-MM-DD')`: 400ns -> 35ns (11x). PAD2 table lookup + template literal in one shot.

```typescript
function formatCommonEn(m: Moment, format: string): string | undefined {
  if (raw._l !== "en" || !raw._isValid) return undefined;
  const datePart = `${padYear(raw.$y)}-${PAD2[raw.$M + 1]}-${PAD2[raw.$D]}`;
  switch (format) {
    case "YYYY-MM-DD": return datePart;
    case "HH:mm:ss": return `${PAD2[raw.$H]}:${PAD2[raw.$m]}:${PAD2[raw.$s]}`;
    // ...
  }
}
```

## 10. Two-Level Caching in the Format Pipeline

Hot path: repeated formatting of the same patterns

**Problem**: Formatting has two separate recurring costs:
- expanding locale tokens like `L`, `LL`, `LLLL`
- rebuilding token render functions for the final expanded format

**Solution**:
- `expandLocaleCache` caches locale-token expansion by `${locale}:${format}`
- `formatRenderCache` caches compiled render-function arrays
- locales can also keep `_localeRenderFns` on their config object for locale-specific reuse

```typescript
const cacheKey = `${m._l}:${format}`;
const cached = expandLocaleCache.get(cacheKey);
if (cached !== undefined) return cached;

let fns = localeRenderCache?.[format];
if (!fns) {
  fns = formatRenderCache.get(format) ?? buildRenderFns(format);
}
```

## 11. Bytecode-Compiled Format Parsing

Hot path: `parseWithFormat()` on repeated format strings

**Problem**: Re-tokenizing format strings and dispatching token handlers through generic lookups on every parse adds avoidable overhead.

**Solution**: Compile format strings into cached opcode arrays once, then execute them with direct handler references. Handler selection itself is reduced to nested `switch` dispatch keyed by first char and token length.

```typescript
type Op =
  | { kind: "token"; handler: TokenHandler; name: string }
  | { kind: "literal"; value: string };

const BYTECODE_CACHE = new LruMap<string, Op[]>(1000);

function compileFormatToOpcodes(format: string): Op[] {
  const cached = BYTECODE_CACHE.get(format);
  if (cached) return cached;
  const ops = tokenizeFormat(format).map(...);
  BYTECODE_CACHE.set(format, ops);
  return ops;
}
```

## 12. Conditional Cold Field Copy in Constructor

Hot path: constructor / parse result materialization

**Problem**: Iterating `coldFieldKeys` array on every Moment to build a `_cold` object. Most Moments have no cold data.

**Solution**: Check with an OR guard first. If any key is present, copy only the necessary fields with individual if checks (no array iteration).

```typescript
// Before: 21-element array loop
for (const key of coldFieldKeys) {
  if (c[key] !== undefined) { ... }
}

// After: direct key checks
if (c._overflow !== undefined || c._empty !== undefined || ...) {
  const cold = {};
  if (c._overflow !== undefined) cold._overflow = c._overflow;
  // ...
}
```

## 13. `clone()` — Avoiding `_d` Sharing

Hot path: clone + later mutation correctness without extra eager allocation

**Problem**: `Object.create(Moment.prototype)` shares `_d` between original and clone. The clone's mutations corrupt the original's Date.

**Solution**: Clone does not copy `_d`. Instead it keeps only `_t` (timestamp). On first setter access, `_getD()` creates `new Date(this._t)`, guaranteeing independence. Deep-copy `_cold`.

```typescript
clone(): Moment {
  const m = Object.create(Moment.prototype) as Moment;
  m._t = this._t;
  m._d = undefined;  // not copied! regenerated from _t on demand
  // deep copy _cold
  const srcCold = this._cold;
  if (srcCold) {
    const dstCold = {};
    for (const key of Object.keys(srcCold)) dstCold[key] = srcCold[key];
    m._cold = dstCold;
  }
  return m;
}
```

## 14. Negative-Epoch-Safe UTC Floor/Ceil Helpers

Hot path: UTC `startOf` / `endOf`

**Problem**: `Math.floor(t / unitMs) * unitMs` is easy to write, but it is wrong or awkward around negative epochs if you do not normalize carefully. Date-heavy `startOf/endOf` paths also allocate unnecessarily.

**Solution**: `floorUnitEpoch()` and `endOfUnitEpoch()` centralize the arithmetic for UTC `startOf/endOf` on day/hour/minute/second boundaries.

```typescript
export function floorUnitEpoch(value: number, unitMs: number): number {
  return value - euclideanModulo(value, unitMs);
}

export function endOfUnitEpoch(value: number, unitMs: number): number {
  return value + (unitMs - 1) - euclideanModulo(value, unitMs);
}
```

## 15. Arithmetic `_dayOfWeek` (Tomohiko Sakamoto)

Hot path: UTC/local calendar recomputation after field mutation

**Problem**: `d.getDay()` requires a Date object.

**Solution**: Compute day-of-week directly from year, month, day using Sakamoto's algorithm. Month correction table + modulo only. Faster than `setFullYear(getDay)`.

```typescript
function _dayOfWeek(y: number, m: number, d: number): number {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  y -= m < 3 ? 1 : 0;
  return ((y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + t[m] + d) | 0) % 7;
}
```

---

## 16. Why `format()` is 10-22x faster than native `Intl.DateTimeFormat`

This section is a focused case study, not a general model for all optimizations in mmntjs.

**Question**: Why is mmntjs's `format('YYYY-MM-DD')` (~40ns) faster than Node.js's native `Intl.DateTimeFormat.format()` (~600ns)?

**Answer**: Intl.DateTimeFormat goes through a **generalized ICU pipeline**. mmntjs does a **template literal on cached integer fields**.

| Step | Intl.DateTimeFormat | mmntjs |
|-------------|-------------------|---------|
| Locale resolution | CLDR data lookup (ICU C++) | None ("en" fixed) |
| Calendar resolution | Islamic/Buddhist/Japanese calendar table lookup | None (Gregorian fixed) |
| Numbering system | Latin/Arabic-Indic/Thai digit conversion | None (ASCII fixed) |
| Month/day resolution | Calendar-dependent name lookup | None (raw integer write) |
| String assembly | ICU pattern-based locale-aware construction | Single template literal |

```typescript
// mmntjs (en, Gregorian, ASCII): 3 field reads + 2 PAD2 lookups + 1 template literal
return `${padYear(this.$y)}-${PAD2[this.$M + 1]}-${PAD2[this.$D]}`;
// -> ~40ns, 0 ICU calls, 0 locale resolution, 0 calendar conversion

// Intl.DateTimeFormat: ICU C++ pipe (includes number-to-string conversion)
const fmt = new Intl.DateTimeFormat("ar-SA", { ... });
fmt.format(date);  // -> ~600ns, ICU C++ calls, locale+calendar+digit resolution
```

**Conclusion**: For simple `YYYY-MM-DD` formatting, Intl.DateTimeFormat is over-engineered. mmntjs's format is "sprintf on cached integers" — comparing against the ICU pipeline is apples-to-oranges.

## 17. Benchmark Results

These numbers are snapshots. The broader implementation trajectory from the full history has been:
- construction/getter costs reduced first
- then mutation and UTC arithmetic costs
- then parse classification and parse dispatch
- then format specialization and cache layering

That order matters: many later wins build on earlier shape stabilization, lazy field refresh, and integer-based UTC paths.

Latest benchmark data: see [BENCHMARKS.md](./BENCHMARKS.md) (2026-05-16, macOS arm64 M4).

Key figures (excerpt):

| Operation | Tech | effect |
|-----------|------|--------|
| parse ISO string | 1, 4, 5 | mmntjs **310ns** vs moment.js 4.20us (**14x**) |
| format YYYY-MM-DD | 1, 8 | mmntjs **33ns** vs moment.js 420ns (**13x**) |
| getters (7 fields) | 1 | mmntjs **37ns** vs moment.js 230ns (**6.2x**) |
| diff days | 1, 12 | mmntjs **18ns** vs moment.js 491ns (**27x**) |
| moment() | 2 | mmntjs **54ns** vs moment.js 311ns (**5.8x**) |
