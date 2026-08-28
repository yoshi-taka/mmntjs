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

**Solution**: Store 8 decomposed fields (`p.y p.M p.D p.W p.H p.m p.s p.ms`) inside a `_p` container object on the Moment instance. Populate them once from the Date object or via `_refreshFields()` post-mutation. Getters become property reads from `_p` (2 hops: instance → `_p` → field).

**Effect**: getter: 250ns -> 10-25ns (10-25x)

```
// Before: prototype chain + C++ call
year() { return this._getD().getFullYear(); }

// After: cached field lookup from _p container
year() { return this._isValid ? this._p.y : NaN; }
```

## 2. Dirty-Flag Post-Mutation Field Refresh

Hot path: getters, post-mutation reads

**Problem**: After mutating a field (year, month, day, etc.) or the underlying Date, the 8 decomposed fields become stale. Re-reading them from the Date on every getter would defeat the field cache.

**Solution**: `_p.dirty` is a boolean flag set to `true` after any mutation via Date API (`setDate`, `setHours`, etc.) or direct field writes. Getters check `_p.dirty` once; if true, they call `_refreshFields()` to reload all 8 fields from the current Date/timestamp. After the first getter access post-mutation, `_p.dirty` is `false` again until the next mutation.

Non-mutating operations (`format`, `diff`, `isBefore`) do not set `_p.dirty`, so the field cache stays valid across repeated reads.

```typescript
// getter: refresh on demand
year() {
  if (!this._isValid) return NaN;
  if (this._p.dirty) {
    this._p.dirty = false;
    this._refreshFields();
  }
  return this._p.y;
}
```

### `_presetFields` — Bypass Refresh Entirely

An additional fast path exists: the constructor accepts `_presetFields` with pre-computed `{y, M, D, H, m, s, ms}` values from parsing. When provided, fields are set directly and `_p.dirty` is set to `false` — no `_refreshFields()` call, no Date creation. This is used after successful ISO parsing and the `_hasDate` fast path (see technique 5).

```typescript
if (c._presetFields) {
  const f = c._presetFields;
  this._p.y = f.y;
  this._p.M = f.M;
  this._p.D = f.D;
  // ... all fields set directly ...
  this._p.dirty = false;      // no _refreshFields() needed
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

**Solution**: The fast ISO path stays `charCodeAt`-based. The fast ISO parsers (`parseCommonISO`, `parseCommonISOExtended`) inline charCodeAt arithmetic directly for maximum straight-line performance. Additionally, `p1`–`p6` digit helpers (`src/parse-shared.ts`) are available for the token-dispatch parse path (`parseWithFormat`).

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

### Even Earlier Path: `parseFixedISOZ` / `parseFixedLocalDate`

Before `parseString()` is called at all, `createFromString` checks if the format string matches a small set of fixed ISO patterns (`"YYYY-MM-DDTHH:mm:ss.SSSZ"`, `"YYYY-MM-DDTHH:mm:ssZ"`, `"YYYY-MM-DD"`). When matched, a dedicated parser runs and constructs the Moment with `_presetFields`, bypassing the entire parse pipeline and field refresh.

```typescript
if (directFormat === "YYYY-MM-DDTHH:mm:ss.SSSZ" || directFormat === "YYYY-MM-DDTHH:mm:ssZ") {
  const z = parseFixedISOZ(str);
  if (z.kind === "zoned") {
    return createMomentZoned(z, str);  // uses _presetFields
  }
}
```

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
const tm = this._p.y * 12 + this._p.M + totalMonths;
const y = Math.floor(tm / 12);
const m = normalizeMonth(tm);
let d_ = this._p.D;
if (d_ > 28) {
  const md = daysInMonthFast(y, m);
  if (d_ > md) d_ = md;
}

this._p.t =
  ymdToEpochDays(y, m, d_) * 86400000 +
  this._p.H * 3600000 +
  this._p.m * 60000 +
  this._p.s * 1000 +
  this._p.ms;
```

## 8. `_epochDaysToYMD` — Date Allocation Avoidance via Arithmetic

Hot path: UTC field refresh

**Problem**: UTC-mode `_refreshFields()` needs year/month/day from epoch ms. Creating a `new Date(t)` allocates memory.

**Solution**: Calculate year/month/day directly from `(t / 86400000)` using pure arithmetic. For years `1..9999` (epoch days `-719162..2932896`), restore the year via Ben Joffe's Julian map and fetch the year bump/month/day in one lookup from a 732-byte packed table. The two constant divisions become multiplies by upward-rounded binary64 reciprocals (exhaustively verified over the whole bounded range), and `|0` performs exact truncation because every quotient is a nonnegative int32. The function returns one packed integer instead of allocating a tuple. Out-of-range inputs fall back to the general Howard Hinnant implementation and use the same packed return contract.

```typescript
static _epochDaysToYMD(z: number): number {
  if (z >= -719162 && z <= 2932896) {
    const q = 4 * (z + 719468) + 3;
    const century = (q * INV_146097) | 0;
    const julian = q + century * 3 + (century & 3);
    const y = (julian * INV_1461) | 0;
    const dym = (julian - y * 1461) >>> 2;
    return (y + _PACKED_YEAR_OFFSET) * 512 + _MONTH_DAY[dym];
  }
  // out of range: general Hinnant (Math.floor variant)
}
```

## 9. Format Fast Path (`formatCommonEn`)

Hot path: common English formats

**Problem**: The general format loop interprets tokens one character at a time. Even `YYYY-MM-DD` goes through the full loop.

**Solution**: Handle common formats (`YYYY-MM-DD`, `HH:mm:ss`, `YYYY-MM-DDTHH:mm:ss.SSSZ`, `LL`, `LT`, `LLLL`, etc.) in `src/display/format.ts`. Only active for locale `en`, valid moments, and year `0..9999`. The fast path also checks `_dirty` and forces one field refresh only when needed.

**Effect**: `format('YYYY-MM-DD')`: 400ns -> 48ns (8x). `pad2()` lookup + template literal in one shot.

```typescript
const enTmts: Record<string, (p: P3, datePart: string) => string> = {
  "YYYY-MM-DD": (p) => datePart,
  "HH:mm:ss": (p) => `${pad2(p.H)}:${pad2(p.m)}:${pad2(p.s)}`,
  // ...
};

function formatCommonEn(m: FormattableMoment, format: string): string | undefined {
  const raw = m as unknown as { _l: string; _isValid: boolean; _p: P3 & { dirty: boolean } };
  if (raw._l !== "en" || !raw._isValid) return undefined;
  if (raw._p.dirty) { (m as unknown as { _ensureFields: () => void })._ensureFields(); }
  const p = raw._p;
  if (p.y < 0 || p.y > 9999) return undefined;
  const datePart = `${zeroFill(p.y, 4)}-${pad2(p.M + 1)}-${pad2(p.D)}`;
  if (format === "YYYY-MM-DDTHH:mm:ss.SSSZ") return `${datePart}T${pad2(p.H)}:...`;
  return enTmts[format]?.(p, datePart);
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

## 13. `clone()` — Avoiding `_d` Sharing + Fast Path

Hot path: clone + later mutation correctness without extra eager allocation

**Problem**: `Object.create(Moment.prototype)` shares `_d` between original and clone. The clone's mutations corrupt the original's Date.

**Solution**: Clone does not copy `_p.d`. Instead it keeps `_p.t` (timestamp). On first setter access, `_getD()` creates `new Date(this._p.t)`, guaranteeing independence. Deep-copy `_cold` via spread operator.

A fast path `_cloneFast()` exists for non-stale moments: it skips `_syncT()` and creates an independent `_p` without a Date allocation.

```typescript
clone(): this {
  if (!this._p._tStale) {
    return this._cloneFast();       // skip _syncT + Date allocation
  }
  const p = this._p;
  this._syncT();
  const m = Object.create(Moment.prototype) as this;
  m._p = { ...p, d: p.d ? new Date(p.t) : undefined };  // new Date from t
  // deep copy _cold
  if (this._cold) {
    m._cold = { ...this._cold } as MomentCold;            // spread, not for-of
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
const _DOW_OFFSET = new Uint8Array([0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4]);

function _dayOfWeek(y: number, m: number, d: number): number {
  y -= m < 3 ? 1 : 0;
  return euclideanModulo(
    (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + _DOW_OFFSET[m] + d) | 0,
    7,
  );
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
// mmntjs (en, Gregorian, ASCII): 3 field reads + 2 pad2 calls + 1 template literal
return `${zeroFill(this._p.y, 4)}-${pad2(this._p.M + 1)}-${pad2(this._p.D)}`;
// -> ~48ns, 0 ICU calls, 0 locale resolution, 0 calendar conversion

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

Latest benchmark data: see [BENCHMARKS.md](./BENCHMARKS.md) (2026-05-26, macOS arm64 M4).

Key figures (excerpt):

| Operation | Tech | effect |
|-----------|------|--------|
| parse ISO string | 1, 4, 5 | mmntjs **223ns** vs moment.js 3.97us (**18x**) |
| format YYYY-MM-DD | 1, 8 | mmntjs **48ns** vs moment.js 395ns (**8x**) |
| getters (7 fields) | 1 | mmntjs **36ns** vs moment.js 217ns (**6x**) |
| diff days | 1, 12 | mmntjs **32ns** vs moment.js 421ns (**13x**) |
| moment() | 2 | mmntjs **165ns** vs moment.js 260ns (**1.6x**) |

---

## 18. Branded-State Type System for Per-State Dispatch

Hot path: `add`, `set`, `startOf`, `endOf`, `diff`

**Problem**: A Moment can be in one of several internal states (fresh Date, stale timestamp, UTC, local). Runtime checks like `if (this._p.isUTC)` or `if (this._p.d)` pile up in every mutation method, wasting cycles.

**Solution**: Define branded refinement types for each state (`CleanLocalFreshWithDate`, `CleanLocalFreshNoDate`, `CleanLocalStale`, `CleanUTC`, `CleanUTCWithOffset`) and type-guard functors that narrow `_P` to the specific branded type. Mutation functions are written as per-state morphisms that accept only the narrowed type, eliminating runtime checks.

```typescript
type CleanLocalFreshWithDate = _P & {
  dirty: false; _tStale: false; isUTC: false; d: Date;
};
type CleanUTC = _P & {
  dirty: false; isUTC: true; offset: 0;
};

function isCleanLocalFreshWithDate(p: _P): p is _P & CleanLocalFreshWithDate {
  return !p.dirty && !p._tStale && !p.isUTC && p.d != null;
}
function isCleanUTC(p: _P): p is _P & CleanUTC {
  return !p.dirty && p.isUTC;
}
```

Each mutation entry point (`_addDayFast`, `_setMonth`, `_startOfDayFast`) dispatches through these guards, routing to the fastest kernel for the current state.

## 19. Per-State Fast Mutation Morphisms

Hot path: `add`, `set`, `startOf`, `endOf`, `diff`

**Problem**: Generic mutation handlers (e.g., `add(1, "day")` → switch on state) still check `_isUTC`, `_p.dirty`, `_tStale`, and `_p.d` inside a single function. These checks are stable per call (state doesn't change mid-mutation), but the compiler may not eliminate them all.

**Solution**: 25+ dedicated per-state morphisms, each accepting only one branded state. They live next to each other with names like `addDayUTC`, `addDay_CLFD`, `addDay_CLFN_overflow`, `startOfDay_CLFD`, `endOfMonthUTC`, `diffDaysUTC`, etc.

```typescript
function addDayUTC(p: _P & CleanUTC, amount: number): void {
  p.t += amount * DAY_MS;              // pure integer arithmetic, no Date
  p.d = undefined;
}

function addDay_CLFD(p: _P & CleanLocalFreshWithDate, amount: number): void {
  p.d.setDate(p.d.getDate() + amount); // direct Date mutation, no refresh
  p.t = p.d.getTime();
  p.dirty = true;
}
```

The call site in `_addDayFast` tries the fastest guard first, falls back through slower states, and finally calls a cold `_addDay` fallback for dirty/edge cases.

## 20. Fast Entry Points: `_addMsFast`, `_addDayFast`, `_addMonthFast`, `_startOfYearFast`, `_endOfDayFast`

Hot path: `add()`, `startOf()`, `endOf()`

**Problem**: The public `add()`, `startOf()`, `endOf()` methods must handle all unit types, validate inputs, normalize units, and check for callbacks — even when the operation is a simple "add 1 day" or "start of day".

**Solution**: Each operation has a fast entry point that pre-checks the common case (no callback, clean state, valid integer amount) and routes directly to the appropriate per-state morphism without going through the full generic switch/validation.

```typescript
private _addDayFast(amount: number): void {
  const p = this._p;
  if (!p.dirty && !p._tStale && !updateOffsetCallback && Number.isInteger(amount)) {
    if (isCleanUTC(p))        { addDayUTC(p, amount); return; }
    if (isCleanLocalFreshWithDate(p)) { addDay_CLFD(p, amount); return; }
    if (isCleanLocalFreshNoDate(p))  { addDay_CLFN(p, amount); return; }
  }
  this._addDay(amount);  // cold fallback
}
```

Similar patterns exist for `_addMonthFast`, `_addYearFast`, `_addQuarterFast`, `_startOfDayFast`, `_startOfMonthFast`, `_startOfYearFast`, `_endOfDayFast`, `_endOfMonthFast`, `_endOfYearFast`.

## 21. Safe-Day Range (D ≤ 28) — Skip Month-End Clipping

Hot path: `year()`, `month()`, `date()` setters, `add()`, `startOf()`, `endOf()`

**Problem**: After setting year/month, the day may exceed the new month's length (e.g., Jan 31 → Feb). A `daysInMonth` check + clamp is needed to avoid invalid dates. But every setter would pay this cost unconditionally.

**Solution**: All months have at least 28 days. If `_p.D ≤ 28`, the day is guaranteed valid for any month — no `daysInMonth` check or clamping needed. This invariant is encoded at the type level with branded types `OrdinaryDate28` (`src/types.ts:299`) and `Date28` (`src/fns/_types.ts:8`), refined via `refineDate28()` / `asDate28()` which check `n >= 1 && n <= 28`:

```typescript
// src/types.ts
declare const __ordDate28: unique symbol;
export type OrdinaryDate28 = number & { [__ordDate28]: true };

export function refineDate28(v: unknown): OrdinaryDate28 | null {
  return Number.isInteger(n) && n >= 1 && n <= 28 ? (n as OrdinaryDate28) : null;
}
```

Per-state morphisms accept `OrdinaryDate28` directly, eliminating the runtime clamp check:

```typescript
function setDate28_CLFD(p: _P & CleanLocalFreshWithDate, val: OrdinaryDate28): void {
  p.d.setDate(val);   // no daysInMonth guard needed
  p.t = p.d.getTime();
  p.dirty = true;
}
function setDate28_UTC(p: _P & CleanUTC, val: OrdinaryDate28): void {
  p.t = ymdToEpochDays(p.y, p.M, val) * DAY_MS + _tod(p);  // pure arithmetic
  p.d = undefined;
}
```

The pattern appears in:
- `year()` setter: skip clamp when D ≤ 28 (`src/moment-class.ts:1248,1260`)
- `month()` setter: same (`src/moment-class.ts:1367,1374`)
- `month()` setter public entry: numeric fast path checks D ≤ 28 (`src/moment-class.ts:2145`)
- `setDate28_CLFD`, `setDate28_CLFN`, `setDate28_UTC` — per-state morphisms for date setters (`src/moment-class.ts:94-119`)
- `addMonthUTC`, `addMonth_CLFD`, `addMonth_CLFN`: `d_ > 28` guards the clamp (`src/moment-class.ts:284,310,335`)
- UTC month/year mutation kernel: `d_ > 28` before `daysInMonthFast` (`src/moment-class.ts:284`)

**Effect**: For the majority of dates (1st–28th), the clamp branch is never taken. The branch predictor learns "strongly not-taken" → zero mispredictions. For D > 28 (29th–31st), the check is still cheap (integer compare + rare clamp). The branded types also catch programming errors at compile time when a value outside [1,28] would be passed to a fast-path kernel.

## 22. `_ensureFreshFields()` — Skip `_syncT` Variant

Hot path: setters that mutate fields directly

**Problem**: After setting a field directly (e.g., `_p.y = 2024`), `_ensureFields()` calls `_syncT()` first, which would write `_p.t` from the fields. But if we're in fields-master mode (`_tStale = true`), the fields are already the source of truth — calling `_syncT()` is wasted work.

**Solution**: `_ensureFreshFields()` skips `_syncT()` and only checks `_p.dirty`. Safe for setters that only touch fields and never read `_p.t`.

```typescript
/** Like _ensureFields but skips _syncT. Safe when _tStale is true
 *  and fields are already the source of truth. */
_ensureFreshFields(): void {
  if (this._p.dirty) {
    this._p.dirty = false;
    this._refreshFields();
  }
}
```

## 23. `_tzOffsetAt` — Reusable Date Probe with Cache

Hot path: `_updateOffset`, UTC offset query, DST detection

**Problem**: Every `getTimezoneOffset()` call creates internal engine state. `new Date(t).getTimezoneOffset()` allocates a Date object each time, which is wasteful when querying the same timestamp repeatedly.

**Solution**: A single module-level `_probeDate` is reused for all timezone offset queries. A 1-entry cache avoids redundant probes when the same timestamp is queried in quick succession (common in `add`/`set` chains).

```typescript
const _probeDate = new Date(0);
const _probeCache = { t: NaN, offset: NaN };

function _tzOffsetAt(t: number): number {
  if (t === _probeCache.t) { return _probeCache.offset; }  // cache hit
  _probeDate.setTime(t);
  _probeCache.t = t;
  _probeCache.offset = -_probeDate.getTimezoneOffset();
  return _probeCache.offset;
}
```

## 24. `_applyOp` Region Dispatch State Machine

Hot path: setters (`year()`, `month()`, `date()`, etc.)

**Problem**: Each setter has repetitive `if (isUTC) ... else if (d != null) ... else ...` state checks. These branches duplicate across 8+ setters.

**Solution**: `_applyOp()` classifies the current state into one of 3 regions (UTC, clean local, t-stale) and dispatches to a specialized handler for each region. Setters call `_applyOp()` instead of repeating the branch themselves.

```typescript
private _applyOp(op: number, val: number): void {
  const p = this._p;
  if (p.dirty) {
    p.dirty = false;
    this._refreshFields();   // reify fields before op
  }
  switch (_region(p)) {
    case 1: return this._opCleanUTC(op, val);
    case 0: return this._opCleanLocal(op, val);
    case 2:
    case 3: return this._opTStale(op, val);
  }
}
```

## 25. `_endOfMonthFromStartFast` — Specialized Combined Operation

Hot path: `endOf('month')` immediately after `startOf('month')`

**Problem**: `startOf('month').endOf('month')` is a common reporting pattern. The normal `endOf('month')` path checks state, ensures fields, identifies the unit, and routes to a generic handler — all of which is overkill when the moment is already at `D=1, H=0, m=0, s=0, ms=0` with clean state.

**Solution**: A dedicated kernel detects this "already at start of month" condition and computes the end-of-month timestamp directly:

```typescript
private _endOfMonthFromStartFast(): void {
  const p = this._p;
  if (p.isUTC) {
    const endDay = daysInMonthFast(p.y, p.M);
    p.t = (ymdToEpochDays(p.y, p.M, endDay) + 1) * DAY_MS - 1;
    p.d = undefined;
    p._tStale = false;
  } else if (p.d != null && !p._tStale) {
    p.d.setFullYear(p.y, p.M + 1, 0);  // sets to last day of month
    p.t = p.d.getTime();
    p.dirty = true;
  }
}
```

## 26. `charCodeAt` Fast Unit Detection

Hot path: `startOf()`, `endOf()`, `add()` unit string parsing

**Problem**: Identifying a unit string like `"day"` or `"month"` via `normalizeUnits()` or `===` comparison with every possible unit string is wasteful for the 1-2 most common units.

**Solution**: Hot entry points check the most common units using `charCodeAt` byte comparisons before falling back to the general unit resolver.

```typescript
// In endOf():
if (
  unit.length === 3 &&
  unit.charCodeAt(0) === 100 &&  // 'd'
  unit.charCodeAt(1) === 97 &&   // 'a'
  unit.charCodeAt(2) === 121     // 'y'
) {
  return this._endOfDayFast();
}
```

This avoids `normalizeUnits()` call, string allocation, and the full unit-resolution switch for the common "day" case.

---

## 27. `narrowCommonUnit` — Two-Tier Unit Normalization

Hot path: `add()`, `subtract()`

**Problem**: `normalizeUnits()` must handle all moment.js unit aliases (`"day"`, `"days"`, `"d"`, `"D"`, etc.). This involves string normalization, case folding, and a switch on the result. For the most common units (day, month, year), this is overkill.

**Solution**: `narrowCommonUnit()` returns a numeric `UnitCode` only for the most frequent aliases (`d`/`D`/`day`/`days` → `DAY`, `M`/`month`/`months` → `MONTH`, etc.). For anything unusual it returns `INVALID_UNIT`, letting the caller fall back to full `normalizeUnitCode()`.

```typescript
function narrowCommonUnit(key: string): UnitCode {
  const len = key.length;
  if (len === 1) {
    switch (key.charCodeAt(0)) {
      case 100: case 68: return DAY;    // d/D
      case 77: return MONTH;            // M
      // ...
    }
  }
  // ...
  return INVALID_UNIT;  // fallback needed
}
```

Used in the `add()` entry point before the generic switch, filtering the common cases into dedicated kernels.

## 28. `CANDIDATES_TABLE` — First-Char Token Dispatch in Format Parser

Hot path: `parseWithFormat()`, `tokenizeFormat()`

**Problem**: Tokenizing a format string requires matching each character against all 90+ registered format tokens. Scanning all tokens linearly per character is wasteful.

**Solution**: A pre-built `(string[] | undefined)[]` array indexed by ASCII character code. Each slot holds all known format tokens starting with that character, sorted longest-first. When `tokenizeFormat` encounters a character, it looks up the slot in O(1) and iterates only the relevant candidates.

```typescript
const CANDIDATES_TABLE: (string[] | undefined)[] = [];
// At init time: CANDIDATES_TABLE[89] = ["YYYY", "YYYYY", "YYYYYY", "Y", "YY", "YYY", "yo"]
// CANDIDATES_TABLE[77] = ["MMMM", "MMM", "MM", "M", "Mo"]
// At tokenize time:
const candidates = CANDIDATES_TABLE[ch];
if (candidates) {
  for (const token of candidates) {
    if (format.startsWith(token, pos)) {
      // matched
    }
  }
}
```

This is layered with `tokenizeCache` (LruMap, max=1000) which caches the token array for repeated format strings, and `BYTECODE_CACHE` (LruMap, max=1000) which caches the compiled opcodes built from tokens.

## 29. Duration Fast Paths: `createDurationFromMsFast` and `bubbleMillisecondsOnly`

Hot path: `moment.duration(12345)`, `duration.add()`, chained duration operations

**Problem**: The full `Duration` constructor runs `_bubble()`, which handles month-to-day/year conversions via `daysToMonths` / `monthsToDays` ratio arithmetic. For ms-only durations (the common case), this is unnecessary.

**Solution**: `createDurationFromMsFast` constructs a Duration directly from raw milliseconds with no locale lookup, no object property iteration, and a simplified bubble that only does `absFloor` division chain:

```typescript
function createDurationFromMsFast(ms: number): Duration {
  const m = new Duration(0);  // minimal init
  const absMs = Math.abs(ms);
  m._bdMilliseconds = absMs % 1000;
  m._bdSeconds = absFloor(absMs / 1000) % 60;
  m._bdMinutes = absFloor(absMs / 60000) % 60;
  m._bdHours = absFloor(absMs / 3600000) % 24;
  m._bdDays = absFloor(absMs / 86400000);
  // ... years/months from ratios
  m._ms = ms;
  return m;
}
```

`bubbleMillisecondsOnly` is the same logic used for mutation paths (e.g., `add(ms)` on an existing Duration). Both avoid the general `_bubble()` function's `daysToMonths` loop.

## 30. DST-Aware Epoch Delta Setters (`fns/_kernel.ts`)

Hot path: `mmntjs/fns` setDate, setMonth, setHours, addDays

**Problem**: Native `Date.set*()` methods are C++ API calls that are both slow and allocate engine-internal state. But pure epoch-delta arithmetic (`new Date(t + delta)`) breaks when the DST offset changes between the old and new timestamp.

**Solution**: Try epoch-delta first. If the timezone offset at the new timestamp matches the old one, return immediately — no Date API call. Only fall back to `Date.set*()` when DST crosses:

```typescript
export function _setHours(d: Date, h: Hour): Date {
  const oldOffset = d.getTimezoneOffset();
  const t = Date.UTC(
    d.getFullYear(), d.getMonth(), d.getDate(),
    h, d.getMinutes(), d.getSeconds(), d.getMilliseconds(),
  );
  const temp = new Date(t);
  if (temp.getTimezoneOffset() === oldOffset) {
    return temp;  // fast path: same DST
  }
  // DST boundary — fall back to local setter
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h,
    d.getMinutes(), d.getSeconds(), d.getMilliseconds());
}
```

Same pattern in `_setDate28Fast` (day <= 28) and `_addDays`. The `fns` kernels also use `Int8Array` for the days-in-month table and bitwise leap-year detection (`y & 3`, `y & 15`).

## 31. Lite Build: No-`_tStale` Simplified State Machine

Hot path: all `moment-lite.ts` operations

**Problem**: The full Moment class has a dual-master state machine (fields-master `_tStale=true` vs timestamp-master `_tStale=false`). Every kernel must check or set `_tStale`, adding branches and complexity.

**Solution**: The lite build (`MomentLite`) eliminates `_tStale` entirely. After any field mutation, `_p.t` is always recomputed from the Date object. This simplifies every mutation kernel (no staleness checks, no `_syncT()` calls) and allows `_valueOfFast()` to read `_p.t` unconditionally.

```typescript
// moment-lite.ts — no _tStale field
_p = {
  t: 0,
  d: undefined as Date | undefined,
  dirty: false,
  isUTC: false,
  offset: 0,
  locale: undefined as Locale | undefined,
  y: 0, M: 0, D: 0, W: 0, H: 0, m: 0, s: 0, ms: 0,
};

// _valueOfFast — unconditional t read
_valueOfFast(): number { return this._p.t; }
```

## 32. Timezone Blob Lazy Loading and Per-Zone Materialization

Hot path: first timezone lookup after import

**Problem**: The builtin timezone data is stored as packed strings (base-60 encoded). Eagerly unpacking all ~600 zones at import would block startup for tens of milliseconds and allocate ~2.7 MB.

**Solution**: The data blobs stay as packed strings until the first zone access. On first access:
1. Line indexes for zones, links, and countries are built via `ensureIndexBuilt()` — scans the blob once
2. `_linksBlob` and `_countriesBlob` are freed immediately after indexing (set to `""`)
3. Individual zones are materialized lazily via `materializeZone()` on first access — calls `unpack()` which decodes base-60 offsets, abbreviations, and untils
4. Once all builtin zones are materialized, `_zonesBlob` is freed too

```typescript
function ensureIndexBuilt(): void {
  if (_zoneIndexesBuilt) return;
  // scan _zonesBlob to build {name → offset} index
  // build link index and country index
  _linksBlob = "";       // free immediately
  _countriesBlob = "";   // free immediately
  _zoneIndexesBuilt = true;
}

function materializeZone(name: string): void {
  ensureIndexBuilt();
  // unpack + decode zone data at the known offset
}
```

Additional timezone memory optimizations:
- Abbreviation interning (`internString()`): deduplicates `"EST"`, `"PST"` etc. across zones
- Adaptive typed arrays (`Int16Array` vs `Int32Array`): uses 2-byte entries when offset values fit
- `InternalZone._index` last-interval cache: remembers the last binary search result, skipping the search entirely for consecutive lookups at nearby timestamps
