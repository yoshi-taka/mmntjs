# Table-Driven Dispatch Analysis for mmntjs

## 1. Evaluation Summary

| # | Table | Verdict | Rationale |
|---|-------|---------|-----------|
| 1a | `TIME_UNIT_MS` (HOUR/MINUTE/SECOND/MS multipliers) | **IMPLEMENTED** | Replaces 12 duplicated case bodies (3 methods × 2 files × 4 units → 3 merged × 2 files) |
| 1b | `UNIT_KIND_BY_CODE` category table | REJECTED | Switch fallthrough already groups units by kind. Adding a table + switch on kind just adds indirection. |
| 1c | `UTC_FIXED_UNIT` flag table | REJECTED | A simple range check `HOUR <= code && code <= MILLISECOND` is sufficient — no table needed. |
| 2 | `ISO_SHAPE_BY_LENGTH` parse table | REJECTED | Current charCode routing is already O(1) per character check. A length-based table would need to inspect multiple positions anyway, adding complexity. |
| 3 | Function-handler dispatch tables | REJECTED | Switch on `UnitCode` is already optimal — integer comparison, V8-inlineable as jump table. `handlers[code](...)` would deopt (function call boundary, polymorphic). |
| 4 | `DAYS_IN_MONTH` | Already exists | `const DAYS_IN_MONTH = [31,28,31,30,31,30,31,31,30,31,30,31]` in `units.ts:182` |

---

## 2. Implemented: TIME_UNIT_MS

### Problem

The `add`, `_addSimple`, and `diff` methods in both `moment-class.ts` and `moment-lite.ts` had 4 near-identical case bodies for HOUR, MINUTE, SECOND, and MILLISECOND. The only difference was the multiplier:

```
HOUR:       _t ±= amount * 3600000
MINUTE:     _t ±= amount * 60000
SECOND:     _t ±= amount * 1000
MILLISECOND: _t ±= amount * 1
```

### Solution

Added a small lookup table and merged the 4 cases into 1 per method:

```typescript
const TIME_UNIT_MS: Record<number, number> = {
  [HOUR]: HOUR_MS,
  [MINUTE]: MINUTE_MS,
  [SECOND]: SECOND_MS,
  [MILLISECOND]: 1,
};
```

Then in each method:

```typescript
case HOUR:
case MINUTE:
case SECOND:
case MILLISECOND: {
  const ms = TIME_UNIT_MS[code];
  this._t += Number.isInteger(amount) ? amount * ms : Math.round(amount * ms);
  this._d = undefined;
  this._dirty = true;
  if (isNaN(this._t)) this._isValid = false;
  return this;
}
```

### Code reduction

| File | Before | After | Delta |
|------|--------|-------|-------|
| `moment-class.ts` | 4 cases × ~7 lines = 28 lines × 3 methods = 84 lines | 3 merged × ~7 lines = 21 lines | **-63 lines** |
| `moment-lite.ts` | 4 cases × ~4 lines = 16 lines × 2 methods = 32 lines | 2 merged × ~3 lines = 6 lines | **-26 lines** |
| `TIME_UNIT_MS` table | — | +5 lines × 2 files | +10 lines |
| **Total** | 116 lines | 37 lines | **-79 lines net** |

### Bundle impact

| Bundle | Before | After | Delta |
|--------|--------|-------|-------|
| `dist/index.js` | 289,325 B | 287,705 B | **-1,620 B (-0.56%)** |
| `dist/lite.js` | 85,251 B | 84,675 B | **-576 B (-0.68%)** |
| `dist/mmntjs.min.js` | 143,151 B | 142,353 B | **-798 B (-0.56%)** |

The bundle shrinks because 79 lines of near-identical code are replaced by one table + one merged case body. Minification also benefits: the table of 4 numeric constants compresses better than 12 repetitions of the same arithmetic pattern with different literals.

### Performance

Benchmarks show no measurable change. The table lookup `TIME_UNIT_MS[code]` adds one memory load per call, but V8 optimizes small constant-object property access to a constant load (inline cache). This is within noise for all measured operations.

### V8 inlineability

The merged case body is hot-path-code-size-neutral:
- **Before**: 4 separate small cases (each easy to inline individually)
- **After**: 1 slightly larger case (same total instructions, one table load replaces three literal loads)

No deopt risk — the table is a `const` at module scope, never modified. V8 will optimize the `TIME_UNIT_MS[code]` access as a constant load from a fixed-shape object.

---

## 3. Rejected Tables

### UNIT_KIND_BY_CODE — unit category table

**Proposed**: Classify each UnitCode as FIXED_MS / DAY / MONTH / YEAR / WEEK / OTHER, then switch on the category.

**Why rejected**: The current code already groups units by kind via switch fallthrough:

```typescript
case YEAR:
case QUARTER:
case MONTH: { /* month arithmetic */ }
case ISO_WEEK:
case WEEK:
case DAY:
case DATE: { /* day arithmetic */ }
```

Adding a category table just adds one more level of indirection without reducing any branches. The switch on `UnitCode` is already optimal — V8 compiles it to a jump table.

### UTC_FIXED_UNIT_BY_CODE — UTC-safe flag table

**Proposed**: A boolean table marking which units can use `_t` arithmetic in UTC mode.

**Why rejected**: Any time unit (HOUR ≤ code ≤ MILLISECOND) is always UTC-safe. Any calendar unit (MONTH, YEAR, etc.) is never UTC-safe for `_t`-only arithmetic. A simple range check + inline constant comparison suffices:

```typescript
// Instead of a table lookup for UTC safety:
const alwaysUtcSafe = code >= HOUR && code <= MILLISECOND;
```

### ISO_SHAPE_BY_LENGTH — parse shape table

**Proposed**: A table mapping string length + separator pattern to a parse handler index.

**Why rejected**: The current parser routes by `charCodeAt(0)`, then tries specific fast paths with quick reject checks. A single length-based table cannot distinguish all ~15 parse shapes without also checking additional characters (dash at 4, T at 10, Z at end, etc.). The current multi-level approach (charCode classifier → specific parser → charCode validation) is already the right decomposition.

### Function-handler dispatch (`handlers[code](...)`)

**Proposed**: Replace `switch(code) { case YEAR: ... case MONTH: ... }` with `HANDLERS[code](this, amount)`.

**Why rejected**: 
- Function call boundary prevents inlining of the handler body
- Polymorphic handler functions deopt V8's inline cache
- Switch on integer `UnitCode` compiles to a jump table (O(1), inlineable)
- Handler tables are only faster when the handler bodies are large enough that dispatch cost is negligible — not the case here

---

## 4. Branches That Should Remain Switch/Direct

| Method | Why switch is correct |
|--------|----------------------|
| `add` inline (DAY/MONTH) | Each has unique logic (UTC vs local split for DAY, month arithmetic for MONTH). Cannot merge with TIME_UNIT_MS. |
| `add` default → `_addSimple` | Different call convention: inline returns `this`, `_addSimple` breaks and the caller does NaN check. |
| `_addSimple` YEAR/MONTH/QUARTER | Month arithmetic is unique (ymdToEpochDays + time-of-day recomposition). |
| `_addSimple` WEEK/DAY/DATE | Day arithmetic with `setDate` / `_t += DAY_MS`. |
| `startOf` | Each unit has unique boundary logic. Cannot be table-driven without function handlers (deopt risk). |
| `endOf` | Same as startOf. |
| `diff` YEAR/MONTH/QUARTER | Complex calendar month diff algorithm. Unique per method. |
| `diff` MILLISECOND | Slightly different overflow handling (`a - b \|\| 0` instead of `r < 0 ? ...`). |
| `diff` WEEK | 7x multiplier on DAY logic. |
| Parse shape detection | Multi-level first-char + length + separator checks cannot be collapsed into a single table. |

---

## 5. Conclusion

**One table implemented**: `TIME_UNIT_MS` — 4 entries, -79 lines, -0.56% bundle.

The only table-driven dispatch that measurably improves the codebase is a **data table** (unit-millisecond constants) replacing duplicated case bodies. **Handler tables** and **category tables** would add indirection without benefit.

Branches that need different logic per unit (startOf, endOf, calendar diff) should remain as switch statements — they are already optimal.
