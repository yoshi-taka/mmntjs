# Performance Analysis (Low-Level)

Why the techniques in [TECHNIQUES.md](./TECHNIQUES.md) tend to work.

This document is not a list of optimizations. It is a model of the main performance forces behind them: allocation pressure, hot-path specialization, deferred work, branch behavior, object layout stability, and avoidance of heavyweight subsystems.

The default benchmark runtime in this repo is Bun (JavaScriptCore), but this document still uses V8 terminology where it is the clearest public model for shapes, inline caches, and deopts. Treat those sections as explanatory models, not claims that only V8 matters. The higher-level conclusions are cross-checked on Node 26 as well.

A practical split:
- `TECHNIQUES.md` = what the code does
- `ANALYSIS.md` = why those patterns are usually faster

Parallel lenses are useful here:
- Algorithmic: less asymptotic or constant-factor work
- Runtime/engine: better IC behavior, inlining, lower deopt risk
- Allocation/GC: fewer short-lived helper objects and `Date` instances
- API specialization: common moment.js-compatible cases get dedicated paths
- Compatibility-aware design: fast paths are constrained by moment.js semantics, DST behavior, and parse quirks

Reading the full commit history, most successful optimizations fall into a small number of recurring themes:
- classify earlier, reject earlier
- keep hot and cold paths physically and logically separate
- replace calendar-object work with integer arithmetic where semantics allow it
- cache compiled or expanded representations, not just final values
- specialize the dominant compatibility cases without changing edge-case behavior

## 1. Stable Object Layout

Representative techniques: field cache, `_cold` separation, constructor key-order discipline

**Problem**: V8 assigns the same Hidden Class (Shape) to objects created with the same property order. Property access is optimized to index computation (like C struct access). Shape changes trigger deoptimization.

**mmntjs's approach**:
- Constructor always assigns properties in the same order: `_isAMomentObject -> _l -> _p -> _isValid -> (_i) -> (_f) -> (_strict) -> (_cold)`
- The 8 decomposed fields (`y M D W H m s ms`) live inside a `_p` container object initialized with a fixed-key order at class field declaration — always stable
- Conditional `_i/_f/_strict` assignments happen at fixed points in the constructor

**Past problem**: The old `_cold` object existed on every Moment, but its internal properties varied (some had `_overflow`, others didn't). Access to `_cold` properties became **megamorphic**, defeating V8's Inline Cache.

**Fix**: Promoted `_i/_f/_strict` out of `_cold` to direct instance properties. `_cold` is now only created on errors, making normal-moment Shape completely stable.

**V8 IC states**:
- Monomorphic (1 shape) -> optimal: 1 shape check + fixed offset load
- Polymorphic (2-4 shapes) -> adequate: linear shape chain search
- Megamorphic (>4 shapes) -> slow: hash table lookup

```typescript
// Old: megamorphic _cold access
cold._overflow  // one Moment has number, another has undefined -> different Shape

// New: _cold is undefined or fixed Shape
// Error moments always have the same keys (_overflow,_empty,...) -> monomorphic
```

## 2. Branch Prediction and Branch Reduction

Representative techniques: `_ensureFields`, day fast path, UTC arithmetic fast paths

**Problem**: Many conditional branches cause CPU branch mispredictions. Pipeline flushes cost ~15 cycles each.

### 2a. Getter Early Return

```typescript
// After: short-circuit, inline dirty check
year() {
  if (!this._isValid) return NaN;                  // prediction: invalid is rare -> not taken
  if (this._p.dirty) {                             // prediction: false after field init -> taken
    this._p.dirty = false;
    this._refreshFields();
  }
  return this._p.y;                                // prediction: always taken
}
```

Branch history stabilizes when getters are called sequentially (as in format: year/month/day/...), keeping mispredictions near zero.

### 2b. `_p.dirty` Post-Mutation Check

```typescript
// in getter:
if (this._p.dirty) {   // true after any mutation, then cleared
  this._p.dirty = false;
  this._refreshFields();
}
```

After field init or post-mutation refresh, `_p.dirty` is false until the next mutation. Repeated getter reads hit the "taken" path. Branch predictor learns "strongly not-taken" -> zero mispredictions between mutations.

### 2c. DAY add/subtract stays on the timestamp fast path

```typescript
if (this._p.isUTC) {
  this._p.t += rounded * 86400000;
  this._p.d = undefined;
} else {
  const dt = this._p.d ?? (this._p.d = new Date(this._p.t));
  dt.setDate(dt.getDate() + rounded);
  this._p.t = dt.getTime();
}

this._p.dirty = true;
```

`add(1,'day')` is common enough that it gets its own direct path in `add()`: UTC moments do one integer add on `_t`, local moments use a single `Date#setDate`, and both only mark `_dirty` for deferred field refresh. This avoids the heavier generic unit-mutation machinery on the hottest calendar increment.

### 2d. UTC calendar arithmetic avoids `Date.UTC` and negative-epoch traps

```typescript
const tm = this._p.y * 12 + this._p.M + totalMonths;
const y = Math.floor(tm / 12);
const m = normalizeMonth(tm);
const d_ = this._p.D > 28 ? Math.min(this._p.D, daysInMonthFast(y, m)) : this._p.D;

this._p.t =
  ymdToEpochDays(y, m, d_) * 86400000 +
  this._p.H * 3600000 +
  this._p.m * 60000 +
  this._p.s * 1000 +
  this._p.ms;
```

This matters for two reasons:
- no `Date` allocation or `Date.UTC(...)` call in UTC month/year mutations
- shared helpers (`floorUnitEpoch`, `endOfUnitEpoch`) make UTC `startOf/endOf` correct even for negative epochs, which is now guarded by `bench/bench-regression.ts`

## 3. String Representation and Direct Digit Parsing

Representative techniques: `parseCommonISO`, digit helpers, trim avoidance in fast paths

**Problem**: V8 has multiple internal string representations:
- SeqString: contiguous memory (charCodeAt O(1), cache-friendly)
- ConsString: concatenation tree (charCodeAt O(n))
- SlicedString: substring view (charCodeAt O(1), bounded range)
- ThinString: internal alias

`str.trim()` may produce a **SlicedString** or **ConsString**, making subsequent `charCodeAt` slower (ConsString requires tree traversal).

**mmntjs's approach**:
- `parseCommonISO` never calls `str.trim()` — operates directly on the original string with charCodeAt
- `createFromString` fast path also eliminates `str.trim()`
- Input strings are likely SeqStrings already; using them directly is fastest

```typescript
// Before: extra trim could generate ConsString
const trimmedStr = str.trim();
if (/^\d{4}-\d{2}-\d{2}/.test(trimmedStr)) { ... }

// After: operate on original SeqString directly
if (len === 10 && charCodeAt(4) === 45 && charCodeAt(7) === 45) {
  const year = charCodeAt(0) * 1000 + ...;
}
```

## 4. Avoiding Heavyweight Subsystems: Regex

Representative techniques: fast ISO parser, `_hasDate` short-circuit

**Problem**: V8's irregexp engine JIT-compiles on first execution. Even simple regexes have pattern compilation + execution context overhead. While native code is cached for subsequent runs, `RegExp.exec()` allocates a `RegExpMatchArray` every time.

**mmntjs's approach**:
- Bypasses format-detection regex entirely in `createFromString` fast path
- `parseCommonISO` uses zero regex — entirely charCodeAt-based
- `parseISOWithTable` uses `regex.exec()` but pre-filters with whole-string match

```typescript
// Before: 3 regex matches
const timeMatch = trimmedStr.match(/[T ](\d{2})(?::...)?/);
const hasT = trimmedStr.indexOf("T") >= 0;
if (/^\d{4}-\d{2}-\d{2}([T ]|$)/.test(trimmedStr)) { ... }
else if (/^\d{4}-\d{2}/.test(trimmedStr)) { ... }
else if (/^\d{4}/.test(trimmedStr)) { ... }

// After: 0 regex
if (parsed._hasDate !== undefined) { /* direct Moment creation */ }
```

## 5. Allocation Pressure and GC

Representative techniques: lazy `_d`, `_cold` omission, clone strategy, UTC arithmetic helpers

**Problem**: Excessive object allocation triggers frequent GC. Promotion from Young Generation (nursery) to Old Generation (tenuring) causes stop-the-world pauses.

**Allocations eliminated in mmntjs**:

| Eliminated allocation | Reason |
|---|---|
| `_cold` object | Not created in normal case |
| `Date` object | Lazy init, not created when unnecessary |
| Intermediate `checkOverflow` objects | Skipped in fast path |
| `createUTCDate`/`createDate` calls | Inlined `new Date(...)` |
| Regex `RegExpMatchArray` | Avoided via charCodeAt |
| `str.trim()` new string | Omitted |
| `_d` duplication in clone | `_d = undefined` + `_t` only |

**Tenuring perspective**:
- Benchmark `moment()` calls are created and discarded rapidly -> most are collected in Young Gen
- Smaller Moment byte size -> faster Young Gen GC
- Fewer properties from `_cold` reduction -> less mark-and-sweep work

## 6. Cheap String Assembly

Representative techniques: `PAD2`, `padYear`, `formatCommonEn`, token render caches

**Problem**: Template literals `` `${a}-${b}` `` are optimized by V8 as Tagged Templates. After the first evaluation, the "template object" is cached, making string concatenation fast.

**mmntjs's usage**:
- `formatCommonEn` datePart construction
- `_epochDaysToYMD` return tuple (effectively a template)
- Format string generation

Combined with the `PAD2` table (pre-computed zero-padded strings), this outperforms `padStart`:

```typescript
// PAD2 table lookup + template literal is faster than padStart(2, '0')
const PAD2 = ["00","01","02",...,"99"];
return `${pad2(this._p.H)}:${pad2(this._p.m)}:${pad2(this._p.s)}`;
```

## 7. Small, Inline-Friendly Helpers

Representative techniques: `_ensureFields`, `_dayOfWeek`, digit parsers

**Problem**: TurboFan decides whether to inline functions based on call count. Non-inlined calls have stack frame + `call`/`ret` overhead.

**Functions expected to be inlined**:

| Function | Why inline-friendly |
|---|---|
| `_ensureFields()` | High call frequency, small, conditional only |
| `year()`/`month()`/`date()` | Frequent getters, small bodies |
| `_dayOfWeek()` | Called from `add()` YEAR/MONTH paths, pure function |
| `_getD()` | Called from many setters |

**What blocked inlining**:
- `_cold` property access: variable Shape prevented V8 from inlining
- Function call argument objects: `checkOverflow(parsed)` receives `parsed` with potentially varying Shape

## 8. Container-Object Hot Data

Representative techniques: `_p` field cache (`y/M/D/W/H/m/s/ms`)

**Problem**: Property access traversing instance -> prototype -> prototype requires a Shape check at each step.

**mmntjs's design**:
- All 8 decomposed fields (`y M D W H m s ms`) + internal state (`t d dirty isUTC offset ...`) live inside a single `_p` container object with a fixed Shape
- `_p` is an own property of every Moment, always present -> monomorphic access
- Declared but unset fields (`_overflow`, `_empty`, etc.) -> don't exist on instance, return `undefined` (V8 fast path)
- `_cold` -> own property (only when set)

```
Access depth:
  this._p        -> own property (depth 0)      -> monomorphic
  this._p.y      -> own (depth 0) -> own (depth 1) -> 2-hop, monomorphic
  this._cold     -> own property (depth 0)       -> fast (rare)
  this._cold._overflow -> own (depth 0) -> own (depth 1) -> megamorphic (error only)
  this._i        -> own property (depth 0, always present) -> monomorphic
  this.year()    -> prototype method (depth 1)   -> near-zero cost with IC
```

The extra hop through `_p` is negligible in practice: V8 caches the `_p` pointer location after the first access, and subsequent `_p.y`, `_p.M`, `_p.D` reads are compiled to a fixed offset from the instance pointer.

## 9. Integer Arithmetic Instead of Calendar Objects

Representative techniques: `ymdToEpochDays`, `_epochDaysToYMD`, `_dayOfWeek`, floor/ceil helpers

**Problem**: V8 represents integers as Smi (Small Integer, 31-bit signed) with a tag bit. Values outside Smi range are boxed to HeapNumber, slowing arithmetic.

**mmntjs's considerations**:
- All date fields (year, month, day, hour, minute, second) are within Smi range (`-2^30 ~ 2^30-1`)
- `$ms` (milliseconds, 0-999) is Smi
- `_t` (timestamp) from `Date.now()` (~1.7e12) exceeds Smi range (~1e9) -> HeapNumber. But `_t` is used directly in arithmetic, not stringified.
- `_d` (Date object) is a pointer. `new Date(_t)` is costly.

**Maintaining Smi**:
```typescript
Math.floor(tm / 12)        // result in Smi range
(this._p.D + rounded) | 0   // bitwise to force integer -> Smi
```

## 10. Monomorphic Method Calls

Representative techniques: stable Moment shape, prototype method reuse

**Problem**: V8 optimizes when the same function is called with the same `this` Shape. Different Shapes trigger deoptimization.

**mmntjs's design**: All `Moment.prototype` methods are called with Moment instances as `this`. Since normal-moment Shape is completely fixed, every method call is monomorphic.

```typescript
// All Moment instances share the same Shape -> monomorphic method calls
a.year()  // this.shape === Moment_shape (IC: monomorphic)
b.month() // this.shape === Moment_shape (IC: monomorphic)
```

## 11. Avoiding Cold Error Machinery on Hot Paths

Representative techniques: `formatCommonEn`, `_cold` separation, fast-path bypasses

**Problem**: Functions with `try { } catch { }` blocks have restricted TurboFan optimization (exception handling requires conservative code generation).

**mmntjs's affected paths**:
- `locale.ts` `months()` function has try/catch for locale data fallback
- These are on the hot path (`format()` -> locale access)

**Mitigation**: `formatCommonEn` is locale "en" fixed and never hits the try/catch path. Other locales may hit it. Pre-building locale cache entries can avoid it if needed.

## 12. Avoiding Unnecessary Generality

Representative techniques: special-casing common formats, direct string factory paths, UTC/local specialized branches

**Problem**: General-purpose parsers and formatters often pay broad dispatch costs even when a few bytes are enough to route the input to a much smaller path.

**Representative patterns in mmntjs**:
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

The gain here is broader than V8 specifics:
- less work on rejected inputs
- fewer expensive subsystems reached per parse
- better branch locality because common input classes stabilize quickly
- a clearer hot/cold split that benefits any modern JIT

## 13. Short-Lived Parse Objects and Shape Stability

Representative techniques: parse result objects, `_hasDate` fast-path tagging

**Problem**: Functions returning object literals with consistent key order let V8 memorize and optimize the Shape.

**mmntjs's consideration**:

```typescript
// Consistent key order -> stable Shape (V8 optimizable)
function parseCommonISO(str) {
  if (len === 10) {
    return { year, month, day, _hasDate: true, _hasTime: false };
  }
  return { year, month, day, hour, minute, second, millisecond, offset, _hasDate: true, _hasTime: true };
}
```

Two return paths with different key orders -> 2 Shapes. V8 adapts polymorphically. Since the objects are short-lived (consumed immediately after parse), the practical impact is small.

**Improvement**: Unifying key orders would make it monomorphic, but the objects are ephemeral.

Related recent change: format parsing now also compiles token streams to cached opcode arrays, so repeated parses reuse both the format structure and the token-handler dispatch decisions.

## 14. Arithmetic Calendar Helpers

Representative techniques: `_dayOfWeek`, `ymdToEpochDays`, `_epochDaysToYMD`

**Problem**: `d.getDay()` requires a Date object. Day-of-week recalculation after `setFullYear()` also goes through Date API.

**Solution**: Tomohiko Sakamoto's algorithm computes day-of-week directly from year/month/day.

```typescript
function _dayOfWeek(y: number, m: number, d: number): number {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  y -= m < 3 ? 1 : 0;
  return ((y + Math.floor(y / 4) - Math.floor(y / 100)
           + Math.floor(y / 400) + t[m] + d) | 0) % 7;
}
```

**Why it's fast**:
- Integer arithmetic only (add, subtract, divide, modulo)
- `Math.floor` on positive numbers is idempotent (V8 may optimize to integer division)
- `| 0` forces integer + maintains Smi
- Table `t` is 12 elements -> L1 cache resident
- No Date object allocation -> zero GC pressure
- After inlining: 3-5 instructions

**Usage**: `_addSimple` YEAR/MONTH/QUARTER paths compute `_dayOfWeek(y, m, d_)` directly instead of calling `setFullYear` + `getDay`.

## 15. Table Lookup Encyclopedia

mmntjs uses numerous **pre-computed tables** to avoid computation costs.

### 15a. `PAD2` — Zero-Padded 2-Digit Table

```typescript
const PAD2 = [
  "00", "01", "02", ..., "99",
];
```

Equivalent to `String(0).padStart(2, '0')` but avoids object creation (String wrapper) + method call + heap allocation. The string literals already exist in memory; access is just array index lookup.

### 15b. `leapLadder` / `nonLeapLadder` — Day-of-Year Ladder

```typescript
const nonLeapLadder = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const leapLadder = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
```

**Usage**: `dayOfYear()` computes "month + day -> day of year" in O(1). No loop or summation needed.

```typescript
dayOfYear(): number {
  return this._p.D + (isLeapYear(this._p.y) ? leapLadder : nonLeapLadder)[this._p.M];
}
```

The ladder arrays are 12 elements each (96 bytes total) -> L1 cache resident.

### 15c. `DAYS_IN_MONTH` — Days-per-Month Table

```typescript
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
```

February is the only special case (leap year check). All other months are table lookups. Reduces branch to `month === 1` only.

### 15d. `isoDates` / `isoTimes` — ISO Parse Format Tables

```typescript
const isoDates: [string, RegExp, boolean?][] = [
  ['YYYYYY-MM-DD', /[+-]\d{6}-\d\d-\d\d/],
  ['YYYY-MM-DD',   /\d{4}-\d\d-\d\d/],
  ['GGGG-[W]WW-E', /\d{4}-W\d\d-\d/],
  ['GGGG-[W]WW',   /\d{4}-W\d\d/, false],    // allowT=false
  ['YYYY-DDD',     /\d{4}-\d{3}/],
  // ...14 entries total
];
const isoTimes: [string, RegExp][] = [
  ['HH:mm:ss.SSSS', /\d\d:\d\d:\d\d\.\d+/],
  ['HH:mm:ss,SSSS', /\d\d:\d\d:\d\d,\d+/],
  // ...9 entries total
];
```

**Operation**: `parseISOWithTable` does whole-string match with EXTENDED_ISO_REGEX/BASIC_ISO_REGEX -> linear scan `isoDates` for date part -> linear scan `isoTimes` for time part -> combine matched format string -> pass to `parseWithFormat`.

**Why a table**:
- More maintainable than if-else chains
- Format string + regex pairs can be dynamically combined into token sequences for `parseWithFormat`
- Table is small (14+9 entries), so linear scan is fast enough
- `allowT` flag controls time part permission (e.g. `GGGG-[W]WW` is date-only)

### 15e. `tokenByChar` — Format Token Dispatch Table

```typescript
const tokenByChar: Record<string, { tokens: TokenEntry[]; maxLen: number }> = {};
// Key is first character of format token:
//   Y -> ["YYYY", "YYYYY", "YYYYYY", "Y", "YY", "YYY", "yo"]
//   M -> ["MMMM", "MMM", "MM", "M", "Mo"]
//   D -> ["DD", "D", "Do", "DDD"]
//   d -> ["dddd", "ddd", "dd", "d"]
//   ...
```

`formatMoment` scans one character at a time. `tokenByChar[ch]` fetches all tokens starting with that character in O(1). Matching tries longest tokens first (sorted). **Hash table + token-length sort** instead of linear search.

### 15f. `WEEKDAY_NAMES_MAP` / `monthNames` — String-to-Number Tables

```typescript
const WEEKDAY_NAMES_MAP: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};
const monthNames: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  january: 0, ..., december: 11,
};
```

**Properties**: V8 optimizes string-keyed maps with Hidden Classes (as long as they don't fall into dictionary mode). Short-string lookups are hash + memory reference. Replaces `Date.parse`-equivalent processing with a table lookup.

## 16. Bitwise Leap Year Detection

**Problem**: Standard leap year logic ("divisible by 4, not by 100, or divisible by 400") uses division and modulo, taking 10-30 cycles.

**Solution**: Bitwise optimization:

```typescript
export function isLeapYear(y: number): boolean {
  if (!isFinite(y)) {return false;}
  if ((y & 3) !== 0) {return false;}  // not multiple of 4 -> false (87% filtered here)
  if (y % 100 !== 0) {return true;}   // multiple of 4 but not 100 -> true
  return (y & 15) === 0;              // multiple of 100 -> check multiple of 400 (& 15 faster than % 16)
}
```

**Details**:
- `(y & 3) !== 0`: equivalent to `y % 4 !== 0`. AND is 1 cycle. ~87% of years filtered here.
- `(y & 15) === 0`: substitute for `y % 400 === 0`. `& 15` is faster than `% 16`, and `% 400 === 0` implies `% 16 === 0`. The reverse doesn't hold, but only "multiple of 100" cases reach this line, and for those `y & 15 !== 0` correctly returns false (e.g. 1900: `1900 & 15 = 4`, !== 0 -> false, correct).

## 17. CPU Pipeline Optimization

Representative techniques: switch dispatch, first-char classification, redundant-load elimination

### 17a. Integer Coercion for Smi Maintenance

```typescript
// | 0 forces integer -> guarantees Smi range
const totalMonths = absRound(unit === YEAR ? amount * 12 : unit === QUARTER ? amount * 3 : amount);
const tm = this._p.y * 12 + this._p.M + totalMonths;
const y = Math.floor(tm / 12);   // Math.floor can maintain Smi
const m = ((tm % 12) + 12) % 12; // modulo stays Smi
```

All `_p` fields are in 0-9999 range (`ms` is 0-999), well within Smi range.

### 17b. Template Literal V8 Optimization

V8 detects Tagged Templates and pre-generates a "Template Object". Subsequent calls skip object creation, evaluating only `${expr}` parts.

```typescript
// PAD2 table lookup + template literal = no branches, no function calls
return `${pad2(this._p.H)}:${pad2(this._p.m)}:${pad2(this._p.s)}`;
```

### 17c. Redundant Load Elimination

```typescript
// Bad: 4 _getD() calls (4 property checks + conditional branches)
this._getD().setUTCHours(h);
this._getD().getUTCHours();
this._getD().getTime();
this._getD().getTimezoneOffset();

// Good: bind _getD() to local variable once
const d = this._getD();
d.setUTCHours(h);
this._p.H = d.getUTCHours();
this._p.t = d.getTime();
this._p.offset = -d.getTimezoneOffset();
```

`_getD()` includes `this._p.d` existence check + `_ensureFields()` + conditional `new Date()`. One variable binding (`const d = this._getD()`) eliminates redundant loads where V8's CSE (Common Subexpression Elimination) wouldn't apply.

### 17d. Switch Dispatch Beats Generic Token Lookups

Recent parse-format work compiles format strings to opcode arrays and resolves handlers with nested `switch` dispatch on first char and token length.

```typescript
switch (cc) {
  case 89 /* Y */:
    switch (len) {
      case 6: return hYYYYYY;
      case 5: return hYYYYY;
      case 4: return hYYYY;
    }
}
```

Why it helps:
- branch structure is simple and repetitive
- hot token families (`Y`, `M`, `D`, `H`, `m`, `s`) stay on tight dispatch paths
- repeated format strings skip both tokenization and handler-resolution overhead via cached opcodes

## 18. `_epochDaysToYMD` — Date Generation via Arithmetic

Computes year/month/day from epoch days (`t / 86400000`) using pure arithmetic. For the bounded year range `1..9999` (epoch days `-719162..2932896`) it uses **Ben Joffe's Julian map + a 732-byte packed month/day table**; out-of-range inputs fall back to the general Howard Hinnant algorithm.

```typescript
static _epochDaysToYMD(z: number): [number, number, number] {
  if (z >= -719162 && z <= 2932896) {
    const q = 4 * (z + 719468) + 3;
    const century = Math.floor(q * INV_146097); // (1/146097)(1+ε): upward-rounded reciprocal
    const julian = q - (century & ~3) + century * 4;
    const y = Math.floor(julian * INV_1461);    // (1/1461)(1+ε)
    const dym = (julian - y * 1461) >>> 2;      // March-based day of year 0..365
    const packed = _MONTH_DAY[dym];             // (month << 5) | day
    return [y + (dym >= 306 ? 1 : 0), packed >>> 5, packed & 31];
  }
  // out of range: general Hinnant (Math.floor variant)
}
```

**Why it's fast**:
- Julian map restores the year with only 2 divisions (as reciprocal multiplies), instead of Hinnant's 6
- Month/day come from one `Uint16Array` lookup instead of the `(5*doy+2)/153` arithmetic chain
- The reciprocals `(1/d)(1+ε)` are provably exact over the whole bounded range (verified exhaustively for all 3,652,059 epoch days)
- The table is 732 bytes — fits in L1 cache

**Trade-off**: Readability is low and the fast path is only exact for years 1..9999 (a wider range falls back to Hinnant), but effective for UTC-only paths where Date generation can be entirely avoided.

## 19. Strength Reduction Examples

Replacing expensive operations with cheaper ones:

| Before | After | Effect |
|--------|-------|---------|
| `y % 4 !== 0` | `(y & 3) !== 0` | division (10-30 cycle) -> AND (1 cycle) |
| `y % 400 !== 0` | `(y & 15) !== 0` | same, but conditional use |
| `String(n).padStart(2, '0')` | `PAD2[n]` | function + allocation -> array lookup |
| `new Date(y, M, D).getDay()` | `_dayOfWeek(y, M, D)` | Date alloc + API -> integer arithmetic |
| Full field read from `new Date(...)` | `_epochDaysToYMD` | allocation -> arithmetic |
| Loop with multiple `daysInMonth` calls | if-else + single call | function call reduction |
| `str.trim()` + regex | direct charCodeAt | string alloc + JIT -> O(1) memory access |
| `||` default value | `? :` ternary | subtle, but ternary inlines better in V8 |

## 20. mmntjs's Optimization Stack

```
Layer 5: Algorithms         Sakamoto, _epochDaysToYMD, bitwise leap year
Layer 4: Table Lookups      PAD2, leapLadder, DAYS_IN_MONTH, isoDates, tokenByChar
Layer 3: Cache Strategy     Field cache, LruMap, lazy initialization
Layer 2: Memory Access      Shape stability, _cold reduction, Own Property, inlining
Layer 1: CPU Pipeline       Branch prediction, Smi, CSE, template literal optimization
```

Layers are interdependent — **lower-layer optimizations accelerate upper layers**. For example, Shape stability lets TurboFan inline `_epochDaysToYMD` and apply constant folding. The `_cold` reduction alone fundamentally changes V8's optimization path.

## 21. Data Structure Perspective

### 21a. Moment Object Memory Layout (V8)

All 8 decomposed fields (`y M D W H m s ms`) plus internal state (`t d dirty _tStale isUTC offset locale`) are stored inside a single `_p` container object. The Moment instance itself has only ~6 own properties:

```
Moment object (JSReceiver)
+-- map (Hidden Class pointer)          // 8 bytes -> Shape pointer
+-- properties (FixedArray pointer)     // 8 bytes -> property storage
+-- elements (FixedArray pointer)       // 8 bytes -> numeric indices (unused)
+-- properties backing store (FixedArray)
|   +-- _isAMomentObject                // boolean
|   +-- _l                              // string | undefined
|   +-- _p                              // container object (pointer)
|   +-- _isValid                        // boolean
|   +-- _i                              // conditional: unknown
|   +-- _f                              // conditional: string | string[] | undefined
|   +-- _strict                         // conditional: boolean
|   +-- _cold                           // error only: object | undefined
```

The `_p` object has its own separate allocation and Shape:

```
_p object (JSReceiver)
+-- properties backing store (FixedArray)
|   +-- t                              // number (HeapNumber)
|   +-- d                              // Date | undefined (pointer)
|   +-- dirty                          // boolean
|   +-- _tStale                         // boolean
|   +-- isUTC                          // boolean
|   +-- offset                         // number (Smi)
|   +-- locale                         // Locale | undefined (pointer)
|   +-- y                              // number (Smi)
|   +-- M                              // number (Smi)
|   +-- D                              // number (Smi)
|   +-- W                              // number (Smi)
|   +-- H                              // number (Smi)
|   +-- m                              // number (Smi)
|   +-- s                              // number (Smi)
|   +-- ms                             // number (Smi)
```

**Key property**: The 15 `_p` fields are contiguous in the backing store -> each `_p` property access is "instance → backing store → value" (2 memory accesses). Because the backing store is a FixedArray, subsequent field accesses are contiguous integer-index reads — V8's forte.

**Cache line analysis**: 15 fields x 8 bytes (tagged pointer) = 120 bytes ≈ 2 cache lines. The first 8 fields (`t` through `isUTC`) fit in one cache line; `offset` through `ms` span the second. Accessing `y` brings `M, D, W, H, m, s, ms` into L1 simultaneously.

**AoS vs SoA trade-off**:
- Current: Array of Structures (AoS) — each Moment has a single `_p` container
- SoA would enable SIMD vectorization for bulk processing
- Not adopted — mmntjs is a general-purpose library, single-object operations dominate

### 21b. `_p` Shape Stability

The `_p` object's class field initializer always assigns keys in the same order (`t → d → dirty → _tStale → isUTC → offset → locale → y → M → D → W → H → m → s → ms`). Every `_p` instance shares the same Shape — monomorphic access to all fields.

The Moment instance's Shape is also stable: `_isAMomentObject`, `_l`, `_p`, `_isValid` are always present. `_i` and `_f` are set in all constructors (may be `undefined`). This keeps Moment property access monomorphic for the common case.

### 21c. `_cold` Data Structure Problem

`_cold` is an object with optional keys. Error types produce different key combinations:

```typescript
// Shape A: overflow + empty
_cold = { _overflow: 2, _empty: true }

// Shape B: invalidMonth + nullInput
_cold = { _invalidMonth: "Feb", _nullInput: true }

// Shape C: all
_cold = { _overflow: 2, _empty: true, _invalidMonth: "Feb", _nullInput: true, ... }
```

**Problem**: 10 error moments can produce 10 different Shapes. `isValid()` accessing `cold._overflow` becomes **megamorphic**. V8 gives up on IC after observing 4+ Shapes.

**Current mitigation**: `_cold` is only created for error/invalid moments. Normal moments have `_cold === undefined`, so `isValid()` exits at the first null check without touching `_cold` properties. The megamorphic access only occurs on error paths, where it does not matter.

### 21d. Sparse vs Dense Representation

| Data | Representation | Assessment |
|--------|------|------|
| `_p` container (15 fields) | Dense via class field initializer | Always present, fixed Shape |
| `_i`, `_f`, `_strict` | Conditional assignment in constructor | Always present (undefined or value), fixed Shape |
| `_cold` internal keys | Varies by error type | Sparse, variable Shape |
| `_p.d` (Date) | Conditional creation | Lazy via `_getD()` |

`declare` fields (`_overflow`, `_empty`, etc.) are erased by TypeScript compilation — they don't exist as instance properties. Access returns `undefined` without affecting Shape.

### 21e. `_p` Backing Store Contiguity

The backing store FixedArray for `_p` fields:

| Index | Field | Type |
|-------|-------|------|
| 0 | `t` | HeapNumber |
| 1 | `d` | pointer |
| 2 | `dirty` | boolean |
| 3 | `_tStale` | boolean |
| 4 | `isUTC` | boolean |
| 5 | `offset` | Smi |
| 6 | `locale` | pointer |
| 7 | `y` | Smi |
| 8 | `M` | Smi |
| 9 | `D` | Smi |
| 10 | `W` | Smi |
| 11 | `H` | Smi |
| 12 | `m` | Smi |
| 13 | `s` | Smi |
| 14 | `ms` | Smi |

Contiguous in memory. Accessing `y` (index 7) brings `M D W H m s ms` (indices 8-14) into the same cache line.

### 21f. `_getD()` Return Value Stability

`_getD()` stabilizes to the same Date object after first call:

```typescript
_getD(): Date {
  this._syncT();
  this._ensureFields();
  if (this._p.d) { return this._p.d; }
  this._p.d = new Date(this._p.t);
  return this._p.d;
}
```

After first call, `this._p.d` is set -> subsequent calls skip the branch -> monomorphic. The Date object's Shape is also fixed (V8 ensures all Date instances share the same Shape).

A faster variant `_getDNoEnsure()` exists for callers that have already ensured fields, skipping `_ensureFields()` entirely.

## 22. Memory Page Size Perspective

### 22a. Actual Page Sizes

| Architecture | Normal Page | Huge Page | macOS Implementation |
|---|---|---|---|
| x86_64 (Intel/AMD) | 4KB | 2MB/1GB | 4KB |
| ARM64 (Apple M1-M3) | **16KB** | 2MB | 16KB fixed |
| ARM64 (AWS Graviton) | 4KB/16KB | 2MB/32MB | Configurable |

Target execution environment is macOS (Apple Silicon) with **16KB pages**.

### 22b. Moment Object Page Occupancy

```
Moment size (estimated): ~160 bytes (including V8 overhead)
Per page (16KB): 16KB / 160B ≈ 102 moment instances
Benchmark 5000 iterations: 5000 / 102 ≈ 49 pages

TLB entries: L1 TLB 64 entries (16KB pages), L2 TLB 2048 entries
-> 49 pages < 64 (fits in L1 TLB)
```

**Conclusion**: TLB pressure is negligible at benchmark loads. Only becomes relevant with 100,000+ concurrent Moment instances.

### 22c. GC Heap Page Strategy

V8's garbage collector manages New Space (young generation) and Old Space:

- **New Space**: 1-8MB, 2 semi-spaces. GC via Scavenge (copying).
  - Semispace is contiguous virtual address space -> high address locality -> TLB friendly
  - Benchmark Moments are discarded quickly -> stay in New Space
  - Scavenge pause time < 1ms

- **Old Space**: Grows as needed. Mark-Sweep-Compact.
  - Long-lived Moments promoted here
  - Compaction defragments -> page utilization maintained

**mmntjs's GC footprint**:
- `_cold` reduction: smaller Moment allocation size -> less GC copying
- `_p.dirty` post-mutation flag: field cache refresh on demand instead of every access
- `clone` avoids `_d` sharing -> no `new Date()` equivalent on clone

### 22d. Cache Line Boundaries

Cache line is typically **64 bytes**. V8's property backing store (FixedArray) is contiguous in memory, so cache line boundary management is internal to V8.

**Key observation**: The `_p` container object's 8 decomposed fields plus 7 internal state fields total 120 bytes (15 x 8 bytes ≈ 2 cache lines). Accessing `y` (index 7 in the backing store) brings indices 8-14 (`M D W H m s ms`) into L1 simultaneously.

**-> Reading `_p.y` loads `_p.M _p.D _p.W _p.H _p.m _p.s _p.ms` into L1 simultaneously**

## 23. Multi-Layer Cache Strategy

mmntjs uses multiple cache layers. Some are engine-agnostic application caches, some are JS-engine inline caches, and some are hardware caches underneath both:

```
Layer 5: LRU Cache          LruMap (expandLocaleCache, tokenizeCache, expandedFormatCache)
Layer 4: Locale Cache        _localeCache Map, _monthsCache, _weekdaysCache
Layer 3: Field Cache         _p.{y,M,D,W,H,m,s,ms} (8 fields inside _p container)
Layer 2: JS Engine IC        Fixed Shape + Monomorphic property access (Moment + _p)
Layer 1: CPU Cache           L1 (32KB), L2 (256KB-1MB), TLB (64 entry L1, 2048 L2)
```

### 23a. Layer 1 — CPU Cache

- **L1 Data Cache (32KB/core)**: ~200 Moments per core. Benchmark working set is 5000, but temporal locality (repeated access to same Moment) keeps hot Moments in L1.
- **L2 Cache (256KB-1MB)**: ~1600-6400 Moments. Entire benchmark working set may fit.
- **TLB (L1 64 entry x 16KB = 1MB coverage)**: ~6000 Moments. Covers entire benchmark.

**mmntjs's access pattern**: `add()`, `startOf()`, `format()` touch only fields within the same Moment (high temporal locality). `diff()` touches two Moments, but they're likely clustered in the same GC region (high spatial locality).

### 23b. Layer 2 — V8 Inline Cache (IC)

IC effectiveness in mmntjs:

| IC Type | Condition | mmntjs | Status |
|---------|------|---------|------|
| Monomorphic | 1 Shape | Fixed Shape (post-`_cold` reduction) | Optimal |
| Polymorphic | 2-4 Shapes | Parse return objects (2 Shapes) | Acceptable |
| Megamorphic | 5+ Shapes | `_cold` property access (error only) | Error-only, negligible impact |

**Practical IC effect**: `this._p.y` in getters compiles to `this._p` (monomorphic shape) + fixed offset for `y`. Error-time `cold._overflow` is megamorphic but error rate is near zero.

### 23c. Layer 3 — Field Cache (`_p.{y,M,D,W,H,m,s,ms}`)

**"Cache the results of Date API calls"** — the most direct caching.

| Field | Source | Update Timing |
|-----------|------------|----------------------|
| `_p.y _p.M _p.D _p.W` | `getFullYear()`, `getMonth()`, `getDate()`, `getDay()` | constructor, setter, add, startOf, endOf |
| `_p.H _p.m _p.s _p.ms` | `getHours()`, `getMinutes()`, `getSeconds()`, `getMilliseconds()` | same (time changes only) |

**Consistency guarantee**: All mutation methods (`add`, `startOf`, `set`, etc.) explicitly update all `_p` fields. `_refreshFields()` does a full reload. `_p.dirty` post-mutation flag means fields are only refreshed on demand after mutations, not on every getter access.

**Historical cache miss**:
- Old `clone()` copied uninitialized `_p` fields -> fixed
- External `_p.d` mutation (opt-in via `_dClone: false`)

### 23d. Layer 4 — Locale Cache

```typescript
const _localeCache = new Map<string, Locale>();  // singleton Map
```

Locale cached fields (lazy-generated in parse.ts):

| Cache | Content | Trigger |
|-----------|------|------------|
| `_monthsCache` | Lowercase month names (string[]) | First `MMMM` parse |
| `_monthsRegex` | Fuzzy-match regex | Same |
| `_monthsStrictRegex` | Strict-match regex | Same (strict mode) |
| `_monthsShortCache` | Abbreviated month names | First `MMM` parse |
| `_weekdaysCache` | Weekday names | First `dddd` parse |
| `_weekdaysShortCache` | Abbreviated weekday names | First `ddd` parse |
| `_weekdaysMinCache` | Minimum weekday names | First `dd` parse |

**Size**: Month/weekday arrays are 7-12 elements. Regex is `/^(A|B|C...)/i` form OR-combining all locale names. **Fits in L1 cache**.

### 23e. Layer 5 — LRU Cache (LruMap)

Three independent LRU caches:

#### `expandLocaleCache` (format.ts, max=500)
Expands locale-dependent tokens like `LLLL` -> `"dddd, MMMM Do YYYY, h:mm:ss a"`. Same locale + same format -> O(1) Map lookup.

#### `expandedFormatCache` (parse.ts, max=500)
Expands format string locale tokens (`L` -> longDateFormat) for `parseWithFormat`. Avoids regex `replaceAll()` on repeated use.

#### `tokenizeCache` (parse.ts, max=1000)
Tokenizes format string into `[{type:"token",name:"YYYY"}, {type:"literal",value:"-"}]`. Highest hit rate — tokenization of the same format string (e.g., `"YYYY-MM-DD"`) happens **only once**.

**LruMap implementation**:

```typescript
class LruMap<K, V> {
  private map: Map<K, V>;
  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      this.map.delete(key);   // delete then...
      this.map.set(key, value); // re-insert -> end (most recent)
    }
    return value;
  }
  set(key: K, value: V): void {
    this.map.set(key, value);
    if (this.map.size > this.max) {
      const oldest = this.map.keys().next().value; // Map head = oldest
      this.map.delete(oldest);
    }
  }
}
```

**Key point**: `Map` preserves insertion order -> head = oldest, tail = newest. `get()` uses `delete+set` for O(1) access-order update. Eviction removes the head (oldest) in O(1).

### 23f. Engine-Internal Caches

Indirect benefits from engine-managed caches:

| Cache | Target | Effect |
|-----------|------|------|
| irregexp cache | Compiled regex | Same regex literal's `exec/test` runs JIT code from 2nd call |
| Code cache | TurboFan optimized code | Hot functions are optimized to native code |
| String interning | Identical content strings | Same string literals shared in heap (reference comparison) |
| Shape cache | Object Shape | Same Class -> Shape transition tree cached |
| Feedback vector | Call-site type info | IC-collected type info persists across function calls |

The names differ across V8 and JSC, but the high-level effect is similar: stable object layouts and stable call sites are rewarded.

## 24. TurboFan Optimization and Deoptimization

### 24a. TurboFan Optimization Pipeline

V8's TurboFan JIT compiles hot functions (~1000 calls) to optimized code. Key passes and their effect on mmntjs:

| Optimization Pass | Effect | mmntjs Benefit |
|-----------|------|----------------|
| Type Specialization | Fix variable types, eliminate dynamic dispatch | `_p.y` confirmed as Smi -> unboxed arithmetic |
| Inlining | Expand callee code at call site | `_ensureFields()` reduces to 1-2 instructions |
| Escape Analysis | Stack-allocate objects that don't escape | Heap allocation reduction |
| Constant Folding | Pre-compute compile-time expressions | `Math.floor(5/2)` -> `2` |
| CSE (Common Subexpression Elimination) | Remove redundant loads | Repeated `this._p.y` reads reduced to one |
| LICM (Loop Invariant Code Motion) | Hoist invariants out of loops | Benchmark loop string references |
| Array Bounds Check Elimination | Remove bounds checks where provable | `PAD2[n]` with n proven 0-99 |
| Branch Fusion | Replace branches with CMOV | `a ? b : c` becomes branchless |

### 24b. Escape Analysis Example

```typescript
// benchmark:
for (let i = 0; i < 5000; i++) { mmntjs(); }
```

If the Moment constructor is inlined and the instance doesn't escape (no external reference), TurboFan could:
1. Eliminate heap allocation entirely
2. Eliminate `_refreshFields()` and Date creation
3. Reduce the loop to essentially `Date.now()` calls

**In practice**: The Moment is `return`ed to the caller, so it escapes. TurboFan abandons EA. However, `_dirty` lazy init eliminates `_refreshFields()` (proven unreachable code).

### 24c. Deoptimization Triggers

| Trigger | Risk | mmntjs |
|---------|--------|---------|
| Shape change | New property added to object | `_cold` reduction mitigates. Error Moment creation still changes Shape -> deopt only then |
| Type change | Smi becomes HeapNumber | `_p.y` with values >= 2^30 would trigger (impractical) |
| Array index out of bounds | `pad2(100)` etc. | `_p.H` etc. are 0-59, bounds guaranteed |
| try/catch reached | Optimized code needs exception handler | Rare locale fallback |
| IC limit exceeded | >4 Shapes observed | `_cold` access in error case only |

**Design goal**: Zero deoptimization on normal hot paths. `_cold` reduction, Shape fixing, and type consistency (all `$` fields in Smi range) maintain stable optimized code.

### 24d. Feedback Vector Accumulation

V8 associates a feedback vector (type information log) with each call site:

```typescript
// Call site:
function year() {
  if (!this._isValid) return NaN;
  if (this._p.dirty) { this._p.dirty = false; this._refreshFields(); }
  return this._p.y;
}
// feedback vector:
//   [0] this: Shape(Moment)  <- Monomorphic
//   [1] this._isValid: Boolean
//   [2] this._p: Shape(_p)   <- Monomorphic
//   [3] this._p.y: Smi
```

TurboFan generates type-specialized code based on this feedback. If a 1000-times monomorphic Shape suddenly changes, **deoptimization + re-optimization** occurs.

**mmntjs's strategy**:
- Normal Moments share identical Shape -> feedback is 100% monomorphic
- Error Moments have a different Shape -> don't pollute normal-path feedback
- Deoptimization on error Moments is followed by re-optimization on subsequent normal Moments (penalty is once per error)

## 25. Cold Start / Warm-up Characteristics

### 25a. Initial Call Breakdown

```
First moment() call:
  +-- getCurrentLocale()              // locale.ts: resolves to "en"
  +-- new Moment({ _t: Date.now() })  // constructor (lazy: no _refreshFields)
  +-- Shape initialization            // V8 creates Shape on first instance
```

Cold-specific costs:

| Step | First | Subsequent | Notes |
|------|------|----------|------|
| Module evaluation | several ms | 0 | dependency resolution + code eval |
| Shape creation | several us | 0 | V8 creates Shape on first Moment creation |
| Regex JIT | ~500us | 0 | `EXTENDED_ISO_REGEX` JIT-compiled on first exec |
| Locale init | ~200us | 0 | First `en` locale load |
| TurboFan optimization | ~1ms per function | once per function | After 1000 calls, async optimized compile |

### 25b. Module Evaluation Timeline

```
import mmntjs from "mmntjs"
  +-- src/index.ts evaluation
  |   +-- import "./mmntjs"      -> Moment class definition
  |   +-- import "./format"        -> formatMoment function
  |   +-- import "./parse"         -> parseString, parseCommonISO
  |   +-- import "./units"         -> DAYS_IN_MONTH, isLeapYear, etc.
  |   +-- import "./utils"         -> LruMap, utilities
  |   +-- import "./locale"        -> _localeCache, getLocale
  |   +-- import "./duration_fixed"-> Duration class
  +-- export default moment function
```

**Tree-shaking**: `src/index.ts` imports all modules, but only dependencies from the entry point are evaluated. Unused locales (all except `en` of 138) are lazy-loaded via `import()`.

### 25c. First Parse Regex JIT

```typescript
const EXTENDED_ISO_REGEX = /^\s*((?:[+-]\d{6}|\d{4})-(?:\d\d-\d\d|W\d\d-\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?::\d\d(?::\d\d(?:[.,]\d+)?)?)?)([+-]\d\d(?::?\d\d)?|\s*Z)?)?$/;
```

V8's irregexp JIT-compiles this on first `exec()` (~100us-1ms). Subsequent runs use compiled native code.

**mmntjs's mitigation**: `parseCommonISO` uses no regex, so this cost is avoided. `parseISOWithTable` uses EXTENDED_ISO_REGEX/BASIC_ISO_REGEX, but most ISO strings are handled by `parseCommonISO` first, so the regex JIT doesn't block warm-up.

### 25d. Iterations Required for Warm-up

| Phase | Needed Calls | What Happens |
|---------|----------------|-------------|
| Ignition | 1-10 | Interpreter execution. Feedback vector starts collecting |
| TurboFan queue | ~1000 | Function classified as hot, optimization scheduled |
| TurboFan completion | 1001-2000 | Optimized code activated, native execution thereafter |
| IC stabilization | 4-10 | Monomorphic IC established, stable unless Shape changes |

**mmntjs's time-to-warm**:
- Benchmark (5000 iter): TurboFan optimized + monomorphic IC -> stable measurements
- Real app (1-10 iter): Ignition execution. `_dirty` lazy init helps (avoids unnecessary `_refreshFields`)
- SSR (1 iter): Cold, single execution. Module evaluation + JIT cost dominates

**Cold-state concerns**:
- `tokenizeCache` empty -> first tokenization cost
- Locale cache (`_localeCache`, `_monthsCache`) empty -> first locale access slow
- Shape unconfirmed -> feedback vector not yet collected
- `LruMap` Maps are empty -> cache miss cascade

All these are "one-time" costs. Acceptable for SSR.

### 25e. mmntjs vs date-fns Cold Start Comparison

| Metric | mmntjs | date-fns | Note |
|------|---------|----------|------|
| Module size (bundle) | 82KB | 114KB (date-fns v4) | mmntjs lighter |
| First `parseISO` latency | ~500ns (lazy) | ~1us | mmntjs faster on first call |
| First `format` | ~35ns (fast path) | ~1us | No locale dependency |
| Full feature load | Synchronous (EIM) | Synchronous (EIM) | Both same |
| Dead code elimination | Tree-shake ready | Named exports | Both tree-shakeable |

date-fns's per-function imports can produce smaller bundles if few functions are used. mmntjs includes everything in one entry point, but TurboFan's dead code elimination doesn't remove module-level definitions. In practice, mmntjs matches or beats date-fns cold start (parse ISO: 328ns vs 950ns, format: 38ns vs 1.13us).

## 26. Comparison With Other Libraries

**dayjs**: Same field cache approach as mmntjs.
- Internal `$y, $M, $D, $H, $m, $s, $ms` with direct getter reads (mmntjs uses `_p` container instead)
- Lazy locale loading (`import()`)
- Very similar design philosophy. Performance likely comparable.
- Limited moment.js compatibility.

**luxon**: `DateTime` class, depends on Intl.DateTimeFormat.
- Parse uses `Intl.DateTimeFormat` -> browser-dependent
- First parse is slow (Intl object creation cost)
- Subsequent calls cached
- Slower than mmntjs overall, but locale accuracy advantage

**date-fns**: Functional, operates on native Date directly.
- No wrapper (just returns `new Date()`)
- No cache — calls Date API on every operation
- mmntjs's getters are faster (Date API call vs property read)
- No-wrapper advantage: `moment()` equivalent (current time) is fastest

```
Speed comparison (approx):
         mmntjs  ~=  dayjs  >  date-fns  >  luxon  >>  moment.js
getter:  10ns       10ns      200ns       500ns      250ns
format:  35ns       50ns      1.1us       1.5us      350ns
parse:   330ns      500ns     1.0us       2.0us      5.0us
create:  60ns       80ns      35ns        80ns       280ns
```

(Numbers are approximate. dayjs/luxon include estimated values.)

## 27. Summary: Win Patterns and Loss Patterns

### Wins Over date-fns

**Getters / Field Access**: Cached fields are decisive. date-fns calls Date API every time; mmntjs reads `_p.y` property. **Fixed Shape + Monomorphic IC optimization** wins.

**Formatting**: `formatCommonEn` lookup-table fast path is extremely fast. Template literal + `pad2()` table eliminates `padStart`. **Monomorphic Property Access + Pre-computed Tables** wins.

**Diff / Compare**: `_t` subtraction only. **No Date valueOf()** -> direct native code execution.

### Losses to date-fns

**`moment() / new Date()`**: Wrapper object property initialization (12+ property assignments) is unavoidable. date-fns's `new Date()` is a V8 native at ~30ns.

**`add(1, 'day')`**: date-fns `addDays(date, 1)` internally returns `new Date(date.getTime() + 86400000)`. mmntjs calls `_getD()` -> `setFullYear()` -> updates 8 fields -> `_t` update -> `_updateOffset`. Wrapper structure overhead.

**Non-issue in practice**: These losses only appear in "create and discard" microbenchmarks. Real applications hold and reuse Moment objects.
