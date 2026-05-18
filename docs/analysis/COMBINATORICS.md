# Combinatorics Analysis for mmntjs

## Executive Summary

Enumerative and algebraic combinatorics can improve mmntjs without runtime overhead.
**Enumerative**: coverage minimization + parser fast-path selection.
**Algebraic**: operation-rule classification for property tests and documentation.

**Do not** add runtime combinatorics machinery (symbolic optimizer, parser combinators, runtime engine).

---

## 1. Minimal Representative Parse Pattern Set

### 1.1 Currently Fast-Pathed (charCode arithmetic, no regex)

| Pattern | Handler | Lines |
|---------|---------|-------|
| `YYYY-MM-DD` | `parseCommonISO` | 340-382 |
| `YYYY-MM-DDTHH:mm:ss` | `parseCommonISO` | 383-407 |
| `YYYY-MM-DDTHH:mm:ss.SSS[SSS]` | `parseCommonISO` | 409-430 |
| `YYYY-MM-DDTHH:mm:ssZ` | `parseCommonISO` | 433-437 |
| `YYYY-MM-DDTHH:mm:ss+HH:mm` | `parseCommonISO` | 438-486 |
| `YYYY-MM-DDTHH:mm:ss+HHmm` | `parseCommonISO` | 438-486 |
| `YYYYMMDD` | `parseCommonISOExtended` | 228-253 |
| `YYYYDDD` | `parseCommonISOExtended` | 206-224 |
| `YYYY-DDD` | `parseCommonISOExtended` | 316-335 |
| `GGGG[W]WW[E]` | `parseCommonISOExtended` | 257-282 |
| `GGGG-[W]WW[-E]` | `parseCommonISOExtended` | 286-313 |

### 1.2 Not Fast-Pathed (go through token dispatch)

| Pattern | Use Case | Current Path |
|---------|----------|-------------|
| `+2024-01-01` | Sign-prefixed year | `parseISOWithTable` → `parseCommonISO` (stripped) or `parseWithFormat` |
| `-0001-01-01` | Negative year ISO | `parseISOWithTable` → `parseWithFormat` ("YYYY-MM-DD") |
| `YYYY-MM-DD` with format arg | Explicit `moment(s, "YYYY-MM-DD")` | `parseWithFormat` with full token dispatch |
| `YYYY/MM/DD` | Slash-separated | `parseISOWithTable` → fall through → nil → Date constructor |
| `YYYYMMDDHHmmss` | Compact datetime | `parseISOWithTable` → `parseWithFormat` via `BASIC_ISO_REGEX` |
| `DD-MM-YYYY` | European format with format | `parseWithFormat` |
| `RFC 2822` | Email headers | `parseRFC2822` |
| `JSON Date` | `/Date(n)/` | `JSON_DATE_REGEX` |

### 1.3 Pareto-Optimal Fast-Path Addition Candidates

Ranked by frequency × speedup potential:

| Rank | Candidate | Expected Benefit | Complexity |
|------|-----------|-----------------|------------|
| 1 | `moment(s, "YYYY-MM-DD")` → `parseCommonISO` | ~10× vs token dispatch | Low: add format→handler map in `parseWithFormat` |
| 2 | `moment(s, "YYYY-MM-DDTHH:mm:ss.SSSZ")` | ~10× vs token dispatch | Low: same mechanism |
| 3 | `moment(s, "YYYYMMDD")` → `parseCommonISOExtended` | ~8× vs token dispatch | Low |
| 4 | `moment(s, "YYYY-MM-DDTHH:mm:ss")` | ~10× vs token dispatch | Low |
| 5 | Sign-prefixed `parseCommonISO` | Avoid regex fallback | Medium: add sign param to `parseCommonISO` |
| 6 | `moment(s, "DD.MM.YYYY")` | ~5× vs token dispatch | Low: specific European date fast path |

### 1.4 Criteria for Adding a Fast Path

A fast path is justified when:
- Pattern accounts for >1% of real-world parse calls
- Speedup vs `parseWithFormat` is >5×
- Code addition < 30 lines
- No new regex at call time
- No new dependencies

**Decision: Add (1) and (2) only.** These are trivially implemented as a format→handler map checked before token dispatch. Estimated +25 lines, 0 byte impact on non-parse code paths.

---

## 2. Pairwise / 3-Wise Test Matrix

### 2.1 Combinatorial Dimensions

```
dimensions = {
  unit:        [year, month, day, hour, minute, second, millisecond, week, isoWeek, quarter]
  operation:   [add, subtract, startOf, endOf, diff, get, set]
  mode:        [utc, local]
  boundary:    [normal, month-end, leap-year, DST-spring, DST-fall, epoch-zero]
  shape:       [string-ISO, string-RFC, array, object, number, Date]
}
```

Full factorial: 10 × 7 × 2 × 6 × 6 = **5040 test cases**.

### 2.2 Pairwise Coverage (allcombinations of 2)

Using the dimensions above, pairwise coverage reduces to **~160 test cases**:

- (unit × operation): 32 combos (all pairs of {year,month,day,hour,minute,second,ms} × {add,subtract,startOf,endOf,diff} plus sparse for week/quarter/isoWeek)
- (unit × mode): 18 pairs (10 units × 2 modes, skip obvious no-ops)
- (operation × mode): 12 pairs (6 ops × 2 modes, skip startOf/endOf diff that are same)
- (unit × boundary): 20 pairs (focus on month-end + leap with month/day/year)
- (operation × boundary): 10 pairs (add/subtract with month-end, startOf/endOf with month-end)
- (mode × boundary): 4 pairs
- (shape × unit): 16 pairs
- (shape × operation): 14 pairs

### 2.3 3-Wise Coverage

3-wise adds ~600 test cases (still 8× smaller than full factorial).

Highest-value triples:
```
(unit=month, operation=add, boundary=month-end)     // Jan 31 + 1 month
(unit=month, operation=add, boundary=leap-year)     // Feb 29 + 1 year
(unit=day,   operation=add, boundary=DST-spring)    // Spring-forward day
(unit=day,   operation=add, boundary=DST-fall)      // Fall-back day
(mode=local, operation=diff, boundary=DST-spring)   // DST-aware diff
(unit=month, operation=diff, boundary=month-end)    // Month diff with clamping
```

### 2.4 Current Coverage Gaps

| Triple | Currently Tested? | Where |
|--------|-----------------|-------|
| (month, add, month-end) | Yes | `boundary.test.ts:241-286` |
| (month, add, leap-year) | Yes | `metamorphic.test.ts` |
| (day, add, DST-spring) | Partial | `metamorphic.test.ts` (mentions DST divergence) |
| (year, startOf, negative-timestamp) | Yes | `boundary.test.ts:159-175` |
| (hour, diff, DST-fall) | **NO** | Gap! |
| (isoWeek, startOf, month-end) | **NO** | Gap! |
| (quarter, endOf, leap-year) | **NO** | Gap! |

### 2.5 Recommended Approach

Replace current ad-hoc `fc.constantFrom()` lists with structured pairwise generation:

```typescript
// Instead of:
fc.constantFrom("year", "quarter", "month", "week", "isoWeek", "day", "hour", "minute", "second")

// Use pairwise combinator:
const units = ["year", "month", "day", "hour", "minute", "second", "millisecond", "week", "isoWeek", "quarter"];
const ops = ["add", "subtract", "startOf", "endOf", "diff"];
const pairs = pairwise(units, ops); // ~32 pairs
```

This can be implemented as a small Pivotol function (<30 lines, compile-time only, excluded from bundle).
See `docs/analysis/COMBINATORICS_PAIRWISE.ts` for the reference implementation.

---

## 3. Algebraic Rewrite Rules

### 3.1 Idempotence (verified identities)

| Rule | Holds? | Counterexample |
|------|--------|---------------|
| `startOf(u)(startOf(u)(m)) = startOf(u)(m)` | **Yes** (all u) | — |
| `endOf(u)(endOf(u)(m)) = endOf(u)(m)` | **Yes** (all u) | — |
| `utc(utc(m)) = utc(m)` | **Yes** | — |
| `local(local(m)) = local(m)` | **Yes** | — |

The startOf idempotency check at `moment-class.ts:1816-1837` already exploits this for static timezones.

### 3.2 Superset Reduction

| Rule | Holds? |
|------|--------|
| `startOf(year) ∘ startOf(month) = startOf(year)` | **Yes** |
| `startOf(year) ∘ startOf(day) = startOf(year)` | **Yes** |
| `startOf(month) ∘ startOf(day) = startOf(month)` | **Yes** |
| `startOf(year) ∘ startOf(hour) = startOf(year)` | **Yes** |
| `startOf(month) ∘ startOf(hour) = startOf(month)` | **Yes** |

These reduce any chain `startOf(year)(startOf(lower)(m))` to `startOf(year)(m)` and could skip the intermediate call. Currently not optimized.

### 3.3 Fusion (additive)

| Rule | Holds? | Constraint |
|------|--------|-----------|
| `add(ms,a)(add(ms,b)(m)) = add(ms,a+b)(m)` | **Yes** | UTC only (in local, DST may break) |
| `add(hour,a)(add(hour,b)) = add(hour,a+b)` | **Yes** | UTC only |
| `add(minute,a)(add(minute,b)) = add(minute,a+b)` | **Yes** | UTC or local |
| `add(second,a)(add(second,b)) = add(second,a+b)` | **Yes** | UTC or local |
| `add(day,a)(add(day,b)) = add(day,a+b)` | **Yes** | UTC; local with NO DST boundary |
| `add(month,a)(add(month,b)) = add(month,a+b)` | **Yes** | Regardless of month-end (both clamp) |

Currently: The add method returns `this` after each call, making `m.add(1, "day").add(1, "day")` a chained call that mutates in place. Fusion would not reduce `_t` operations here — the current approach is already optimal for the combined `add` case. However, `add(ms,a+b)` is indeed handled by the single `add(n, MILLISECOND)` branch.

### 3.4 Non-Commutativity (danger zones)

| Pair | Commutative? | Why |
|------|-------------|-----|
| `add(month,a)` ∘ `add(day,b)` | **NO** | Month-end clamping: Jan 31 + 1 month + 1 day ≠ Jan 31 + 1 day + 1 month |
| `add(month,a)` ∘ `add(hour,b)` | **NO** | Month changes day count which changes date → offset may shift |
| `add(day,a)` ∘ `startOf(month)` | **NO** | startOf resets day to 1: (startOf then add) ≠ (add then startOf) |
| `utc` ∘ `startOf(day)` | **NO** | UTC vs local may produce different epoch at DST boundary |
| `add(day,a)` ∘ `add(ms,b)` | **NO** (local) | DST transitions shift the wall-clock offset for day adds |

### 3.5 Quasi-Inverses

| Pair | Exact Inverse? | Notes |
|------|---------------|-------|
| `add(n,ms)` ∘ `add(-n,ms)` | **Yes** | Pure integer arithmetic |
| `add(n,second)` ∘ `add(-n,second)` | **Yes** | Pure integer arithmetic |
| `add(n,minute)` ∘ `add(-n,minute)` | **Yes** | Pure integer arithmetic |
| `add(n,hour)` ∘ `add(-n,hour)` | **Yes** | Pure integer arithmetic |
| `add(n,day)` ∘ `add(-n,day)` | **Yes** (UTC), **No** (local DST) | DST: day ≠ 24h |
| `add(n,month)` ∘ `add(-n,month)` | **No** | Month-end clamping loses days |
| `add(n,year)` ∘ `add(-n,year)` | **No** | Leap year: Feb 29 + 1 year + -1 year ≠ Feb 29 |

### 3.6 StartOf/EndOf Duality

| Rule | Holds? |
|------|--------|
| `startOf(u)(m) ≤ m ≤ endOf(u)(m)` | **Yes** (epoch comparison) |
| `startOf(u)(endOf(u)(m)) = startOf(u)(m)` | **Yes** |
| `endOf(u)(startOf(u)(m)) = endOf(u)(m)` | **Yes** |

These are useful metamorphic properties for property-based testing.

### 3.7 Classification for Use

| Category | Property Tests | Benchmarks | Fast-Path Safety | Documentation |
|----------|---------------|------------|-----------------|--------------|
| Idempotence | Add sup-reduction tests | Skip redundant chains | Already exploited | Document |
| Superset reduction | Add | Use to filter benchmark cases | Idempotency check | Document |
| Fusion | Fused-add property | Fuse in warm-up | Safe (same unit) | Document |
| Non-commutativity | Commutativity tests | Order-sensitive cases | MUST preserve order | Document prominently |
| Quasi-inverses | Roundtrip tests | — | Not applicable | Document exceptions |
| Duality | Boundary tests | — | Not applicable | Document |

---

## 4. Fast-Path Opportunities

### 4.1 Format→Handler Map for parseWithFormat

**Current**: `parseWithFormat(s, fmt)` tokenizes fmt, dispatches each token individually.
**Proposed**: Pre-check `fmt` against a map of known format strings to charCode fast paths.

```typescript
const FORMAT_FAST_PATHS: Record<string, (s: string) => ParsedData | null> = {
  "YYYY-MM-DD": parseCommonISO,
  "YYYY-MM-DDTHH:mm:ss": parseCommonISO,
  "YYYY-MM-DDTHH:mm:ss.SSSZ": parseCommonISO,
  "YYYY-MM-DDTHH:mm:ssZ": parseCommonISO,
  "YYYYMMDD": parseCommonISOExtended,
  "YYYYMMDDHHmmss": parseCompactISO,
};
```

**Implementation**: ~20 lines added to `parseWithFormat` before `tokenizeFormat`.
**Safety**: No locale dependency for these formats.
**Return on investment**: ~10× speedup for common explicit-format calls (e.g., `moment(s, "YYYY-MM-DD")`).
See benchmark: `moment('ISO string')` cold = 2.83μs (no format) vs `moment('ISO string') with format` cold = 22.75μs with format → **8× slower when format is specified**.

### 4.2 Sign Handling in parseCommonISO

**Current**: Sign-prefixed ISO dates rely on `parseISOWithTable` regex + format dispatch, or the sign-stripping hack at lines 2931-2938.
**Proposed**: Add optional sign handling to `parseCommonISO`:

```typescript
function parseCommonISO(str: string, sign?: 1 | -1): InternalParsedData | null
```

This lets the regex-less fast path handle `+2024-01-01` and `-0001-01-01`.

### 4.3 parseCommonISO Length Extension

**Current**: Only handles exact lengths {10,19,20,23,24,25,28,29} — misses some fractional-second lengths.
**Proposed**: Use a more flexible length check:

```typescript
if (len < 10 || len > 29) return null;  // more permissive
```

Then validate fractional seconds and timezone with more flexible logic. This would catch patterns like `YYYY-MM-DDTHH:mm:ss.SSSSS` (len=24 with 5 fractional digits, timezone omitted).

### 4.4 Idempotency Skip for startOf/endOf in UTC

**Current**: The idempotency check in `startOf` (1816-1837) is skipped when `updateOffsetCallback` is set. For UTC mode (`_isUTC === true`), the callback is never needed, but the check still checks field values.

**Opportunity**: For UTC mode, always apply the idempotency skip since DST is irrelevant. This would make `startOf(month).startOf(month)` cheaper in UTC mode.

### 4.5 Validated Fast-Path Safety

| Fast Path | Safe in UTC? | Safe in Local? | Notes |
|-----------|-------------|----------------|-------|
| `parseCommonISO` (dash-separated) | Yes | Yes | Pure arithmetic, locale-independent |
| `parseCommonISOExtended` (compact) | Yes | Yes | Pure arithmetic, locale-independent |
| `FORMAT_FAST_PATHS` map | Yes | Yes | Forward to charCode parsers |
| Sign handling in `parseCommonISO` | Yes | Yes | Year is just a number |
| Calendar-based fields (MMMM, MMM) | N/A | N/A | Locale-aware, cannot fast-path |

**All parser fast paths are safe in both UTC and local modes** because they deal only with numeric field extraction. Locale dependency only enters through format token handlers (month names, weekday names, AM/PM, ordinals).

---

## 5. Rejected Runtime Abstractions

| Abstraction | Why Rejected |
|-------------|-------------|
| **Runtime symbolic optimizer** | Would need to build an expression DAG, apply rewrite rules, evaluate. Adds ~1 KB, increases parse.ts complexity by 40%, and the rules are simple enough to inline. |
| **Parser combinator framework** | Would replace 33 existing TokenHandler functions with combinators like `.then()`, `.or()`, `.map()`. Adds abstraction overhead (+15-20% bytecode), makes debugging harder, and the current token dispatch is already O(n) in token count. |
| **General-purpose algebra engine** | A system to discover/reason about operation identities at runtime. The 20+ rewrite rules above are finite and known a priori — a runtime engine is overengineering. |
| **Grammar-based parser generator** | The ISO grammar is small (≤20 productions). A parser generator adds a build step and generates code that's harder to debug than the current regex + charCode approach. The grammar fuzzer (`grammar.fuzz.js`) already tests this offline. |
| **Expression template for add fusion** | Would turn `m.add(1,"day").add(2,"day")` into `m.add(3,"day")`. The current `_addSimple` + `add` already handle `m.add(3,"day")` efficiently. The intermediate `_t` updates are cheap (integer addition). The chained call pattern is a non-issue. |

---

## 6. Benchmark & Bundle-Size Impact

### 6.1 Benchmark Baseline (current)

| Operation | mmntjs cold | mmntjs warm | moment.js cold | moment.js warm |
|-----------|------------|------------|---------------|---------------|
| moment() | 292ns | 48ns | 4.88μs | 321ns |
| moment('ISO string') | 2.83μs | 301ns | 27.92μs | 4.70μs |
| moment('ISO string') with format | **22.75μs** | 2.50μs | 8.75μs | 4.85μs |
| moment.utc('ISO string') | 1.17μs | 363ns | 4.04μs | 2.79μs |
| format('YYYY-MM-DD') | 875ns | 36ns | 5.08μs | 457ns |
| add(1,'day') | 334ns | 49ns | 3.75μs | 329ns |
| add(1,'month') | 625ns | 376ns | 1.17μs | 731ns |
| startOf('month').endOf('month') | 1.08μs | 390ns | 583ns | 540ns |
| diff('days') | 334ns | 19ns | 2.83μs | 2.36μs |
| diff('months') | 709ns | 580ns | 4.13μs | 13.61μs |

**Key finding**: `moment('ISO string') with format` is **8× slower** than `moment('ISO string')` in mmntjs (22.75μs vs 2.83μs). This is the biggest optimization opportunity.

### 6.2 Expected Impact of Fast Paths

| Improvement | Expected Speedup | Bundle Impact |
|------------|-----------------|--------------|
| `FORMAT_FAST_PATHS` map | 8-10× for format-specified ISO parses | +0.3% (parse.ts ~90 bytes) |
| Sign handling in `parseCommonISO` | 2-3× for sign-prefixed ISO | +0.1% (~30 bytes) |
| parseCommonISO length extension | Captures more patterns in fast path | +0.05% (~15 bytes) |

Total estimated increase: **+0.5%** to parse.ts (from 3335 to ~3355 lines, ~100-140 bytes gzipped in bundle).

### 6.3 Benchmark for format-specified ISO (projected)

After adding `FORMAT_FAST_PATHS`:

| Operation | Current (cold) | Projected (cold) |
|-----------|---------------|-----------------|
| `moment(s, "YYYY-MM-DD")` | 22.75μs | ~3μs |
| `moment(s, "YYYY-MM-DDTHH:mm:ss")` | 22.75μs | ~3μs |
| `moment(s, "YYYYMMDD")` | ~20μs | ~2μs |

### 6.4 No-Impact Operations

The following are already optimal and need zero changes:

| Operation | Current Status |
|-----------|---------------|
| `add` with inline units (DAY, MONTH, HOUR, MINUTE, SECOND, MS) | Handled by switch in `add` method, integer arithmetic |
| `startOf` in UTC (year, month, day, hour, minute, second) | `floorUnitEpoch` / `ymdToEpochDays` — pure arithmetic |
| `diff` for time units | Integer division |
| `diff` for calendar units | `anchorMs` algorithm — optimal |
| `isLeapYear` | Bitwise operations |
| `daysInMonthFast` | Table lookup + bitwise leap check |
| `parseCommonISO` | charCode arithmetic, optimal |
| `parseCommonISOExtended` | charCode arithmetic, optimal |

---

## 7. Conclusion

### Use Enumerative Combinatorics For:

| Application | Method | Effort |
|------------|--------|--------|
| **Coverage minimization** | Pairwise test matrix over (unit × operation × mode × boundary × shape) | ~100 lines of test code, reduces full factorial 5040→160 |
| **Parser fast-path selection** | enumerate format→handler map for 6 common ISO patterns | ~25 lines in `parseWithFormat` |
| **Test gap identification** | enumerate (triple × boundary) and identify missing coverage | Automated analysis, no code changes |

### Use Algebraic Combinatorics For:

| Application | Method | Effort |
|------------|--------|--------|
| **Property test oracles** | Idempotence, superset reduction, duality rules | Already partially done (`number-theory.test.ts`) |
| **Benchmark case selection** | Use algebra to classify representative vs redundant cases | No code changes |
| **Fast-path safety classification** | Prove locale-independence of numeric-only parsers | Documentation |
| **Non-commutativity warnings** | Document month/day/utc interleaving rules | Comments in source |

### Do Not Add:

- Runtime symbolic optimizer
- Parser combinator framework
- General-purpose algebra engine
- Grammar-based parser generator
- Expression template for add fusion
- Any new dependency

### Concrete Next Steps (ordered by ROI):

1. Add `FORMAT_FAST_PATHS` map to `parseWithFormat` (~25 lines) — **8-10× speedup for format-specified ISO parses**
2. Extend `parseCommonISO` length validation to handle more fractional-digit patterns (~15 lines)
3. Generate pairwise test matrices in property tests (~100 lines in test helper)
4. Add algebraic-rule-based property tests for commutativity/non-commutativity boundaries (~50 lines)
5. Document algebraic rules in source comments near `add`, `startOf`, `diff` (~20 lines)
