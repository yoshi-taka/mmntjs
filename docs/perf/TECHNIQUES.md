# Performance Techniques

Techniques used to accelerate moment2, viewed from the L2 cache perspective — assuming memory access is the bottleneck.

## 1. Field Cache (Decomposed Date Cache)

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

## 4. Inline Digit Extraction (direct charCodeAt)

**Problem**: `parseCommonISO` called helper functions `four()`/`two()` incurring stack frame + call overhead.

**Solution**: Inline `charCodeAt(i) - 48` directly. Compute the full number in one expression: `((c0)*10 + c1)*100 + (c2*10 + c3)`.

**Effect**: parse: 60ns -> 40ns (1.5x). Function calls eliminated, branch prediction improves.

```typescript
// Before: 4 function calls
const year = four(str, 0);
const month1 = two(str, 5);
const day = two(str, 8);

// After: inline charCodeAt
const y0 = str.charCodeAt(0) - 48, y1 = str.charCodeAt(1) - 48;
const y2 = str.charCodeAt(2) - 48, y3 = str.charCodeAt(3) - 48;
const year = y0 * 1000 + y1 * 100 + y2 * 10 + y3;
const m0 = str.charCodeAt(5) - 48, m1 = str.charCodeAt(6) - 48;
const month1 = m0 * 10 + m1;
```

## 5. Fast Path Bypass in `createFromString`

**Problem**: After `parseCommonISO` succeeds, the code still ran `checkOverflow()`, `createUTCDate()`/`createDate()`, and format-detection regex (3-4 times). `str.trim()` was also extraneous.

**Solution**: Tag parse results with a `_hasDate` flag. Check it at the top of `createFromString`. If set, immediately `new Date(...)` and return a Moment in 18 lines.

**Effect**: parse ISO: 500ns -> 330ns (1.5x). Regex engine startup avoided.

```typescript
if (parsed._hasDate !== undefined) {
  const { year, month, day, hour, minute, second, millisecond, offset } = parsed;
  const d = offset !== undefined
    ? new Date(Date.UTC(year!, month!, day!, ...))
    : new Date(year!, month!, day!, ...);
  return new Moment({ _d: d, ... });
}
// checkOverflow + regex + createDate only reached when above is skipped
```

## 6. `_addSimple` DAY: while -> if-else

**Problem**: `add(1, 'day')` always runs `while (this.$D > daysInMonth(...))`. Crossing a month boundary on a single-day add is rare, but the loop check fires every time.

**Solution**: Use if-else for small increments. Minimize `daysInMonth()` calls.

```typescript
// Before: while loop (calls daysInMonth every iteration)
this.$D += rounded;
while (this.$D > daysInMonth(this.$y, this.$M)) {
  this.$D -= daysInMonth(this.$y, this.$M);
  this.$M++;
}

// After: if-else for rare cases
this.$D += rounded;
const maxDay = daysInMonth(this.$y, this.$M);
if (this.$D > maxDay) {
  this.$D -= maxDay;
  this.$M++;
  if (this.$D > daysInMonth(this.$y, this.$M)) {
    this.$D = daysInMonth(this.$y, this.$M);
  }
}
```

## 7. `_epochDaysToYMD` — Date Allocation Avoidance via Arithmetic

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

## 8. Format Fast Path (`formatCommonEn`)

**Problem**: The general format loop interprets tokens one character at a time. Even `YYYY-MM-DD` goes through the full loop.

**Solution**: Handle common formats (`YYYY-MM-DD`, `HH:mm:ss`, `YYYY-MM-DDTHH:mm:ss.SSSZ`, etc.) in a switch statement. Only active for locale "en" and year 0-9999.

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

## 9. LRU Cache for Format Expansion

**Problem**: Locale-dependent tokens like `LLLL` are expensive to expand every time.

**Solution**: `LruMap<string, string>(500)` caches expansion results. Same locale + same format hits the cache on second use.

```typescript
const expandedCacheKey = `${locale || "en"}:${format}`;
let expandedFormat = expandedFormatCache.get(expandedCacheKey);
if (!expandedFormat) {
  expandedFormat = format.replaceAll(/LTS|LT|.../g, ...);
  expandedFormatCache.set(expandedCacheKey, expandedFormat);
}
```

## 10. Conditional Cold Field Copy in Constructor

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

## 11. `clone()` — Avoiding `_d` Sharing

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

## 12. `differenceInCalendarDays` Optimization

**Problem**: diff just computes `valueOf()` difference and divides. That's usually sufficient.

**Solution**: `diff(input, 'days')` is simply `(this._t - other._t) / 86400000` floored. Uses the cached `_t` directly, avoiding Date API.

```typescript
case DAY: {
  const diff = this.valueOf() - other.valueOf();
  return Math.floor(diff / 86400000);
}
```

## 13. Arithmetic `_dayOfWeek` (Tomohiko Sakamoto)

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

## 14. Why `format()` is 10-22x faster than native `Intl.DateTimeFormat`

**Question**: Why is moment2's `format('YYYY-MM-DD')` (~40ns) faster than Node.js's native `Intl.DateTimeFormat.format()` (~600ns)?

**Answer**: Intl.DateTimeFormat goes through a **generalized ICU pipeline**. moment2 does a **template literal on cached integer fields**.

| Step | Intl.DateTimeFormat | moment2 |
|-------------|-------------------|---------|
| Locale resolution | CLDR data lookup (ICU C++) | None ("en" fixed) |
| Calendar resolution | Islamic/Buddhist/Japanese calendar table lookup | None (Gregorian fixed) |
| Numbering system | Latin/Arabic-Indic/Thai digit conversion | None (ASCII fixed) |
| Month/day resolution | Calendar-dependent name lookup | None (raw integer write) |
| String assembly | ICU pattern-based locale-aware construction | Single template literal |

```typescript
// moment2 (en, Gregorian, ASCII): 3 field reads + 2 PAD2 lookups + 1 template literal
return `${padYear(this.$y)}-${PAD2[this.$M + 1]}-${PAD2[this.$D]}`;
// -> ~40ns, 0 ICU calls, 0 locale resolution, 0 calendar conversion

// Intl.DateTimeFormat: ICU C++ pipe (includes number-to-string conversion)
const fmt = new Intl.DateTimeFormat("ar-SA", { ... });
fmt.format(date);  // -> ~600ns, ICU C++ calls, locale+calendar+digit resolution
```

**Conclusion**: For simple `YYYY-MM-DD` formatting, Intl.DateTimeFormat is over-engineered. moment2's format is "sprintf on cached integers" — comparing against the ICU pipeline is apples-to-oranges.

## Benchmark Results

Latest benchmark data: see [BENCHMARKS.md](./BENCHMARKS.md) (2026-05-16, macOS arm64 M4).

Key figures (excerpt):

| Operation | Tech | effect |
|-----------|------|--------|
| parse ISO string | 1, 4, 5 | moment2 **310ns** vs moment.js 4.20us (**14x**) |
| format YYYY-MM-DD | 1, 8 | moment2 **33ns** vs moment.js 420ns (**13x**) |
| getters (7 fields) | 1 | moment2 **37ns** vs moment.js 230ns (**6.2x**) |
| diff days | 1, 12 | moment2 **18ns** vs moment.js 491ns (**27x**) |
| moment() | 2 | moment2 **54ns** vs moment.js 311ns (**5.8x**) |
