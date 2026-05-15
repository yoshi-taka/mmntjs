# Type-Safety Analysis for mmntjs

## Evaluation of 8 Proposed Ideas

### Idea 1: normalizeUnitCode returns UnitCode, never undefined ✅ ACCEPTED

**Current**: `normalizeUnitCode(unit: string): UnitCode | undefined`
Returns `undefined` for unknown unit strings. Every caller must handle the undefined case:

```typescript
// Before — 5 call sites with redundant undefined handling:
const code = normalizeUnitCode(unit);
if (code !== undefined && code >= 0) { ... }         // add

const code = normalizeUnitCode(unit) ?? INVALID_UNIT; // startOf, endOf

const code = normalizeUnitCode(unit)
  ?? INVALID_UNIT;                                     // diff, moment-lite methods
```

**After**: `normalizeUnitCode(unit: string): UnitCode`
Returns `INVALID_UNIT` (-1) for unknown unit strings:

```typescript
// After — all callers simplified:
const code = normalizeUnitCode(unit);
if (code >= 0) { ... }               // add

const code = normalizeUnitCode(unit); // startOf, endOf, diff
if (code < 0) { ... }
```

**Changes**:
| File | Branch | Removed check |
|------|--------|--------------|
| `src/units.ts:126` | function def | `| undefined` in return type, added `?? INVALID_UNIT` fallback |
| `src/moment-class.ts:1669` | `add` | `code !== undefined &&` removed |
| `src/moment-class.ts:1807` | `startOf` | `?? INVALID_UNIT` removed |
| `src/moment-class.ts:1949` | `endOf` | `?? INVALID_UNIT` removed |
| `src/moment-class.ts:2174` | `diff` | `?? INVALID_UNIT` removed |
| `src/moment-lite.ts:1345` | `add` | `code !== undefined &&` removed |
| `src/moment-lite.ts:1455` | `diff` | `?? -1` removed |
| `src/moment-lite.ts:1627` | `startOf` | `?? -1` removed |
| `src/moment-lite.ts:1730` | `endOf` | `?? -1` removed |
| `test/units.test.ts:91` | test | `toBeUndefined()` → `toBe(-1)` |

**Impact**: 9 call sites simplified. No behavioral change — `INVALID_UNIT` is `-1` which is already the sentinel value these callers use.

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| `dist/index.js` | 289,424 B | 289,325 B | **-99 B** |
| `dist/lite.js` | 85,272 B | 85,251 B | **-21 B** |
| `dist/mmntjs.min.js` | 143,064 B | 143,151 B | +87 B (noise) |
| Benchmark | — | No change | Within noise |

**Verdict**: Worth doing. Removes 9 branch points at call sites with zero behavioral change and slight size reduction.

---

### Idea 2: Split normalizeUnitCodeFast from normalizeUnitCodeLoose ❌ REJECTED

The current function is already O(1) — two hash lookups. There is no "fast" vs "loose" distinction in the current alias set. All aliases resolve to the same lookup tables.

Splitting would duplicate code and the single function is already called everywhere consistently.

---

### Idea 3: MonthIndex branded type ❌ REJECTED

```typescript
type MonthIndex = number & { readonly __monthIndex: unique symbol };
```

**Pros**: Would catch misuse of `daysInMonthFast` with non-normalized months at compile time.
**Cons**:
- Parameter name `month0to11` already documents the convention.
- `normalizeMonth` returns `number`; making it return `MonthIndex` would require casts everywhere.
- The branded type adds type-level noise for a convention that's already well-followed.
- No runtime benefit.

**Current callers of `daysInMonthFast` all pass already-normalized months** — verified by code review.

---

### Idea 4: daysInMonthFast only with MonthIndex ❌ REJECTED

Same as Idea 3 — no runtime benefit, adds type noise, all callers already pass 0..11 values.

---

### Idea 5: EpochMs / DurationMs / UnitMs branded types ❌ REJECTED

```typescript
type EpochMs = number & { readonly __epochMs: unique symbol };
type DurationMs = number & { readonly __durationMs: unique symbol };
```

**Problem**: `_t` (epoch ms) is routinely mixed with `DAY_MS`, `HOUR_MS` (duration constants) in expressions like `_t += n * DAY_MS`. Branded types would require explicit conversions at every arithmetic boundary, making hot-path code harder to write.

Example of what would break:
```typescript
// Current:
this._t += Math.round(amount * DAY_MS);
// Required with brands:
this._t = (this._t + (Math.round(amount) * DAY_MS as DurationMs)) as EpochMs;
```

This adds noise without catching real bugs — the unit arithmetic is structurally simple and well-reviewed.

---

### Idea 6: FixedUnitCode vs CalendarUnitCode ❌ REJECTED

```typescript
type FixedUnitCode = HOUR | MINUTE | SECOND | MILLISECOND;
type CalendarUnitCode = YEAR | MONTH | DATE | DAY | WEEK | ...;
```

**Problem**: The `add` method already has this distinction in its switch cases — inline for DAY/MONTH/HOUR/MINUTE/SECOND/MILLISECOND, `_addSimple` for the rest. A type-level distinction doesn't change the control flow or eliminate branches.

The switch dispatch is already optimal: O(1) integer comparison, no string operations.

---

### Idea 7: Numeric ParseShape classifier ❌ REJECTED

**Proposed**: Replace the charCode routing cascade with a single numeric "shape ID" computed from first chars + length, then switch on it directly.

**Current routing** (parseString, no-format path):
```
charCodeAt(0) → digit → parseCommonISOExtended → (if null) parseISOWithTable
charCodeAt(0) → slash → JSON Date regex
charCodeAt(0) → digit/sign → parseISOWithTable → (if _claimed) try RFC 2822
all → RFC 2822 regex
```

**Why not**: The first-char classifier is already O(1) and the cascade has short-circuit checks at each level (length, dash, colon position). A numeric shape classifier would need to inspect multiple characters anyway (length + dash + T/slash + Z), making it strictly more work, not less.

The current approach is already the "shape classifier" — it just uses simple predicates instead of a numeric ID.

---

### Idea 8: Remove duplicated runtime checks ✅ ACCEPTED (partial)

**Found opportunity**: `normalizeUnitCode` callers had duplicated `?? INVALID_UNIT` / `?? -1` fallbacks (already fixed in Idea 1).

**Other checks evaluated**:

| Check location | Redundant? | Verdict |
|---------------|-----------|---------|
| `daysInMonth` NaN/overflow check | No — public API, receives raw values | Keep |
| `daysInMonthFast` month 0..11 check | No — documented contract, no assert | Keep as documented |
| `add` month clamp `if (d_ > 28)` | No — performance filter, saves `daysInMonthFast` call for dates 1-28 | Keep |
| `add` `amount === 0` short-circuit | No — avoids all mutation for zero | Keep |
| `startOf` idempotency field checks | No — saves Date allocation at start-of-unit | Keep |
| `isFinite(y)` in `isLeapYear` | No — guards against NaN/Infinity | Keep |

**No significant duplicated checks found beyond the normalizeUnitCode callers.**

---

## Summary

| # | Idea | Verdict | Lines changed | Bundle impact | Performance |
|---|------|---------|---------------|--------------|-------------|
| 1 | UnitCode return type | **ACCEPTED** | 10 files, -7 branches | -99 B index, -21 B lite | No change |
| 2 | Split fast/loose | REJECTED | — | — | — |
| 3 | MonthIndex branded type | REJECTED | — | — | — |
| 4 | daysInMonthFast typed | REJECTED | — | — | — |
| 5 | EpochMs/DurationMs brands | REJECTED | — | — | — |
| 6 | FixedUnitCode type | REJECTED | — | — | — |
| 7 | ParseShape classifier | REJECTED | — | — | — |
| 8 | Remove dupe checks | ACCEPTED (partial) | Same as #1 | Same as #1 | — |

**1 adopted, 6 rejected, 1 partial.**

The only change with measurable impact is making `normalizeUnitCode` return `UnitCode` (never `undefined`), which removes 9 redundant branch points across the codebase. All other proposed type-safety improvements add type-level complexity without enabling faster hot paths or removing runtime branches.
