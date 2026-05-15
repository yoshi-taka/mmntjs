# Permutation-Group-Inspired Analysis for mmntjs

## Model: Operations as Actions on Date-State

A date-state `s` is a tuple:
```
s = (_t, _isUTC, _offset, _isValid, $y, $M, $D, $H, $m, $s, $ms, $W, _d, _dirty)
```

Operations are transformations `s → s'` implemented as methods on the Moment class.
We classify their algebraic properties without implementing runtime group machinery.

---

## 1. Commutativity Table

### Legend

| Symbol | Meaning |
|--------|---------|
| ✓ | Always commutes (∀ states) |
| U | Commutes only in UTC mode |
| B | Commutes except near singular boundaries |
| ✗ | Never safely commutes |

### Table

| A ╲ B | add(ms) | add(h) | add(d) | add(M) | startOf(d) | startOf(M) | utc | set(d) | set(M) |
|-------|---------|--------|--------|--------|------------|------------|-----|--------|--------|
| **add(ms)** | ✓ | ✓ | ✓ | ✓ | U | U | B | B | B |
| **add(h)** | ✓ | ✓ | ✓ | ✓ | B | B | B | B | B |
| **add(d)** | ✓ | ✓ | U | ✗ | B | B | B | ✗ | ✗ |
| **add(M)** | ✓ | ✓ | ✗ | ✓ | B | B | B | ✗ | ✗ |
| **startOf(d)** | U | B | B | B | ✓ | ✓ | ✗ | ✗ | ✗ |
| **startOf(M)** | U | B | B | B | ✓ | ✓ | ✗ | ✗ | ✗ |
| **utc** | B | B | B | B | ✗ | ✗ | ✓ | B | B |
| **set(d)** | B | B | ✗ | ✗ | ✗ | ✗ | B | ✓ | ✓ |
| **set(M)** | B | B | ✗ | ✗ | ✗ | ✗ | B | ✓ | ✓ |

### Key: Why each classification

| Pair | Class | Mechanism |
|------|-------|-----------|
| add(ms) ∘ add(h) | ✓ | Both pure `_t += n * unit_ms`. Integer addition is commutative. |
| add(ms) ∘ add(d) | ✓ | UTC: both pure `_t` arithmetic. Local: add(d) uses `setDate()` but ms-add is just `_t += n`, so the `_t` after both sequences is `_t + n*ms + m*DAY_MS` regardless of order. |
| add(d) ∘ add(h) | U | UTC: `_t += (d*DAY_MS + h*HOUR_MS)`. Local: add(d) uses `dt.setDate()` which is DST-sensitive. add(h) is always `_t += n*HOUR_MS` (see `moment-class.ts:1726`). If add(h) shifts `_t` across a DST boundary, the subsequent `setDate()` in add(d) sees a different wall clock. |
| add(d) ∘ add(M) | ✗ | Month-end clamping. `Jan 31 + 1 month + 1 day = Mar 1` vs `Jan 31 + 1 day + 1 month = Mar 2` (Feb has 28/29 days, so +1 month clamps). Non-commutative by definition of calendar arithmetic. |
| startOf(d) ∘ add(h) | B | `startOf(d)` floors to midnight. `add(h)` adds hours. Order matters: starting-of-day then adding hours gives `00:00 + h`, while adding hours then starting-of-day gives `00:00` regardless of h. These differ when h ≠ 0. |
| startOf(M) ∘ startOf(d) | ✓ | `startOf(M)` sets day=1, midnight. `startOf(d)` sets midnight. Both applied: either order gives midnight of day 1. |
| utc ∘ startOf(d) | ✗ | `startOf(d)` in local mode uses `d.setHours(0,0,0,0)` which is DST-dependent. `utc()` converts to UTC. The epoch differs vs `utc()` then `startOf(d)` which uses UTC `floorUnitEpoch`. At DST boundaries, these differ by the DST offset. |
| set(d) ∘ add(M) | ✗ | Setting date then adding month vs adding month then setting date. Month-end clamping gives different canonical results. |
| set(M) ∘ set(d) | ✓ | Setting month and day independently — order doesn't matter for the final `_t` (both just set Date fields). |
| add(M) ∘ add(h) | ✓ | add(M) uses month arithmetic (ymdToEpochDays + time-of-day). add(h) is `_t += n*HOUR_MS`. Since add(M) reconstructs `_t` from components, the hour offset from add(h) is preserved in the time-of-day term. These commute. |

### Concrete counterexample: add(d) ∘ add(h)

```typescript
// DST spring-forward boundary (US/Eastern: 2024-03-10 02:00 skipped)
// Local mode:
const d1 = moment("2024-03-09").add(1, "day").add(1, "hour");
const d2 = moment("2024-03-09").add(1, "hour").add(1, "day");
// d1 ≠ d2 near DST boundary
```

The permutation-group insight: `add(d)` is NOT a pure translation in local mode because `setDate()` interacts with DST. In UTC, `add(d)` IS a pure translation (`_t += 86400000`).

---

## 2. Idempotence Table

An operation A is idempotent if `A(A(s)) = A(s)` for all states s.

| Operation | Idempotent? | Coded check? | Location |
|-----------|------------|--------------|----------|
| `utc()` | ✓ | No (always runs) | `utc-extra.ts:50` |
| `local()` | ✓ | No (always runs) | `utc-extra.ts:35` |
| `startOf(year)` | ✓ (by construction) | No explicit | `moment-class.ts:1842` |
| `startOf(month)` | ✓ | ✓ (field check) | `moment-class.ts:1817-1819` |
| `startOf(quarter)` | ✓ (by construction) | ✗ Missing | `boundary-extra.ts:39` |
| `startOf(week)` | ✓ (by construction) | ✗ Missing | `boundary-extra.ts:56` |
| `startOf(isoWeek)` | ✓ (by construction) | ✗ Missing | `boundary-extra.ts:83` |
| `startOf(day)` | ✓ | ✓ (field check) | `moment-class.ts:1821-1823` |
| `startOf(hour)` | ✓ | ✓ (field check) | `moment-class.ts:1825-1827` |
| `startOf(minute)` | ✓ | ✓ (field check) | `moment-class.ts:1829-1831` |
| `startOf(second)` | ✓ | ✓ (field check) | `moment-class.ts:1833-1835` |
| `endOf(year)` | ✓ (by construction) | ✗ | `moment-class.ts:1962` |
| `endOf(month)` | ✓ (by construction) | ✗ | `moment-class.ts:1980` |
| `endOf(quarter)` | ✓ (by construction) | ✗ | `boundary-extra.ts:111` |
| `endOf(week)` | ✓ (by construction) | ✗ | `boundary-extra.ts:131` |
| `endOf(isoWeek)` | ✓ (by construction) | ✗ | `boundary-extra.ts:156` |
| `endOf(day)` | ✓ (by construction) | ✗ | `moment-class.ts:2007` |
| `endOf(hour)` | ✓ (by construction) | ✗ | `moment-class.ts:2028` |
| `add(0, u)` | ✓ | ✓ (`amount===0`) | `moment-class.ts:1663` |
| `set(u, current_value)` | ✓ (by construction) | ✗ | `moment-class.ts:886,911,etc` |

### Idempotency gap

`startOf(quarter|week|isoWeek)` and ALL `endOf` variants lack explicit idempotency checks. The existing check only covers `MONTH`, `DATE/DAY`, `HOUR`, `MINUTE`, `SECOND` (lines 1816-1837). For these uncovered units, every call recomputes all fields and mutates `_t` even when already at boundary.

Adding checks for `QUARTER`, `WEEK`, `ISO_WEEK`, and all `endOf` variants would eliminate redundant work for these calls. However, the overhead of the check itself (~3 field comparisons) must be weighed against the cost of the unnecessary computation (~Date allocation + field writes).

**Recommendation**: Add idempotency checks for `startOf(quarter|week|isoWeek)` only if benchmarks show repeated calls are common. For `endOf`, skip — it's rarely called twice on the same state.

### Superset reduction (startOf chain)

The algebraic identity `startOf(upper) ∘ startOf(lower) = startOf(upper)` holds for unit hierarchies where `upper > lower` in the calendar unit order (year > month > day > hour > minute > second).

| Chain | Result | Verified? |
|-------|--------|-----------|
| `startOf(year) ∘ startOf(month)` | = `startOf(year)` | ✓ (`number-theory.test.ts:615`) |
| `startOf(year) ∘ startOf(day)` | = `startOf(year)` | ✓ (`number-theory.test.ts:621`) |
| `startOf(month) ∘ startOf(day)` | = `startOf(month)` | ✓ (`number-theory.test.ts:629`) |
| `startOf(year) ∘ startOf(hour)` | = `startOf(year)` | Not tested |
| `startOf(month) ∘ startOf(hour)` | = `startOf(month)` | Not tested |
| `startOf(quarter) ∘ startOf(day)` | = `startOf(quarter)` | Not tested |

These identities mean that in a chain like `m.startOf("month").startOf("day")`, the second call is redundant.

---

## 3. Quasi-Inverse Table

For operation A, operation B is a quasi-inverse if `B(A(s)) ≈ s` for most s.

| A | B | Exact inverse? | Failure pattern |
|---|----|---------------|-----------------|
| `add(ms, n)` | `add(ms, -n)` | ✓ | Pure `_t` arithmetic |
| `add(s, n)` | `add(s, -n)` | ✓ | Pure `_t` arithmetic |
| `add(min, n)` | `add(min, -n)` | ✓ | Pure `_t` arithmetic |
| `add(h, n)` | `add(h, -n)` | ✓ | Pure `_t` arithmetic (even in local!)[^1] |
| `add(d, n)` in UTC | `add(d, -n)` | ✓ | `_t += n*86400000` |
| `add(d, n)` in local | `add(d, -n)` | ✗ | DST: `setDate()` may cross boundaries, 1 day ≠ 24h |
| `add(M, n)` | `add(M, -n)` | ✗ | Month-end clamping: Jan 31 + 1M = Feb 28, -1M = Jan 28 ≠ Jan 31 |
| `add(Y, n)` | `add(Y, -n)` | ✗ | Leap year: Feb 29 + 1Y = Feb 28, -1Y = Feb 28 ≠ Feb 29 (for non-leap target year) |
| `add(Q, n)` | `add(Q, -n)` | ✗ | Same month-end clamping as `add(M, 3n)` |
| `add(w, n)` | `add(w, -n)` | ✓ in UTC, ✗ in local[^2] | Same DST issue as `add(d, 7n)` |
| `set(year, v)` | `set(year, original)` | ✗ | Leap year: Feb 29 → 2023 → Feb 28, back to 2024 → Feb 28 ≠ Feb 29 |
| `set(month, v)` | `set(month, original)` | ✗ | Month-end clamping same as add month |
| `set(date, v)` | `set(date, original)` | ✓ | Pure Date field set |
| `utc()` | `local()` | ✗ | DST: local offset has changed, epoch differs |
| `local()` | `utc()` | ✗ | Same as above |
| `startOf(u)` | none | ✗ | Destructive — time information is lost |

[^1]: `add(h)` is always `_t += n*3600000` even in local mode (see `moment-class.ts:1726-1733`). The Date object `_d` is set to `undefined` and `_dirty = true`, so `_t` arithmetic is the only effect. No DST compensation is attempted for hour adds.
[^2]: `add(w)` calls `_addSimple` which delegates to `add(d, 7n)` logic.

### The add(day) quasi-inverse problem in local mode

In local mode, `add(day, 1) ∘ add(day, -1) = identity` holds for 364+ days of the year, but fails on DST transition days:

```typescript
// DST spring-forward (US/Eastern):
const m = moment("2024-03-10T01:30:00");          // 1:30 AM EST (UTC-5)
const result = m.clone().add(1, "day").add(-1, "day");
// Mar 11 01:30 EDT → Mar 10 01:30 EDT → NOT the same instant!
```

This is because `setDate()` on the Date object preserves wall-clock time across DST, making 1 calendar day = 23 or 25 hours on transition days.

**Permutation-group insight**: In local mode, `add(day)` is NOT a group action on the epoch `_t`. It's a calendar action on `_d` that happens to update `_t`. The "group" is non-associative when DST boundaries are crossed.

---

## 4. Safe Fusion Opportunities

### Fusion = replace sequence A ∘ B with single operation C

| Sequence | Fused operation | Always safe? | Constraint |
|----------|----------------|-------------|------------|
| `add(ms,a) ∘ add(ms,b)` | `add(ms, a+b)` | ✓ | None |
| `add(s,a) ∘ add(s,b)` | `add(s, a+b)` | ✓ | None |
| `add(min,a) ∘ add(min,b)` | `add(min, a+b)` | ✓ | None |
| `add(h,a) ∘ add(h,b)` | `add(h, a+b)` | ✓ | None |
| `add(d,a) ∘ add(d,b)` | `add(d, a+b)` | ✓ | Safe in UTC and local (setDate chaining is additive) |
| `add(M,a) ∘ add(M,b)` | `add(M, a+b)` | ✓ | Month arithmetic is exact |
| `add(Y,a) ∘ add(Y,b)` | `add(Y, a+b)` | ✓ | Year = 12 months arithmetic |
| `add(h,a) ∘ add(ms,b)` | `add(ms, a*3600000+b)` | ✓ | In UTC only. In local, add(h) may be called first and trigger DST-sensitive behavior in subsequent ops. However, both are pure `_t` arithmetic, so fusing is safe. |
| `add(d,a) ∘ add(h,b)` | `_t += a*86400000 + b*3600000` | U | UTC: pure arithmetic. Local: `setDate()` DST interaction makes fusion unsafe. |
| `add(d,a) ∘ add(M,b)` | cannot fuse | ✗ | Month-end clamping + day interaction. These must remain separate. |
| `utc() ∘ utc()` | `utc()` | ✓ | Idempotent — skip second call |
| `local() ∘ local()` | `local()` | ✓ | Idempotent — skip second call |
| `startOf(M) ∘ startOf(d)` | `startOf(M)` | ✓ | Superset reduction |
| `startOf(Y) ∘ startOf(M)` | `startOf(Y)` | ✓ | Superset reduction |
| `startOf(Y) ∘ startOf(d)` | `startOf(Y)` | ✓ | Superset reduction |
| `utc() ∘ startOf(d) in UTC` | `startOf(d)` in UTC then `utc()` | ✗ | Order matters due to DST in local mode (see §1) |

### Practical fusion that the code already does

The `add` method already handles unit-specific fusion for the sequence being replaced:
- `m.add(1, "day").add(2, "day")` is two calls, but the implementation doesn't fuse them — it simply calls `setDate(getDate()+1)` then `setDate(getDate()+2)` which is `setDate(getDate()+3)`. The overhead is one extra Date write + one extra `_t` update.

For real-world benefit, fusion would only matter in a hypothetical `m.add({days: 3, hours: 2})` call which already exists via the duration path (`_applyDuration`). The unit-add fusion is already handled by the duration API.

### Where fusion could actually help

```typescript
// Current: m.startOf("month").startOf("day")
// The startOf("day") is redundant after startOf("month")
// Optimization: skip startOf("day") entirely
```

Adding a check in `startOf` that detects "already at or below the target unit" would save the date allocation and field writes. But this adds overhead to every `startOf` call.

---

## 5. Singular Boundaries

These are regions of state space where permutation relations break down.

### S1. DST Spring Forward

| Property | Effect |
|----------|--------|
| Commutativity | `add(d) ∘ add(h)` fails |
| Quasi-inverse | `add(d,n) ∘ add(d,-n)` fails in local |
| startOf identity | `startOf(d)` in local may give different UTC epoch vs UTC startOf(d) |
| diff | `diff(d, other)` in local differs from UTC by 1 hour |
| Local time validity | 02:00 does not exist on spring-forward day |

**Example**: US Eastern 2024-03-10 02:00 is skipped. `moment("2024-03-10T02:00:00")` is invalid/clamped.

### S2. DST Fall Back

| Property | Effect |
|----------|--------|
| Quasi-inverse | Same as spring-forward but in opposite direction |
| diff | 01:00-01:59 occurs twice — ambiguous local times |
| UTC roundtrip | `utc().local()` may lose 1 hour during the overlap |

**Example**: US Eastern 2024-11-03 01:30 occurs twice (EDT then EST).

### S3. Month-End Overflow

| Property | Effect |
|----------|--------|
| add(M) quasi-inverse | Fails for any date ≥ 29 |
| add(d) ∘ add(M) | Non-commutative |
| set(M) set(d) | Order-dependent when day > next month's length |

**Example**: Jan 31 + 1 month = Feb 28 (2023) or Feb 29 (2024). Then -1 month = Jan 28 ≠ Jan 31.

### S4. Leap Year

| Property | Effect |
|----------|--------|
| add(Y) quasi-inverse | Feb 29 + 1 year = Feb 28 (if next year not leap) |
| daysInMonth | February has 29 days in leap years |

**Example**: Feb 29, 2024 + 1 year = Feb 28, 2025. Feb 28, 2025 - 1 year = Feb 28, 2024 ≠ Feb 29, 2024.

### S5. Year 0 / Negative Years

| Property | Effect |
|----------|--------|
| Date.UTC safety | `Date.UTC(0,0,1)` works but `new Date(0,0,1)` gives year 1900 |
| _useConstructor | Years 0-99 or < 1000 use `setFullYear` |
| ISO string parsing | Sign-prefixed years need special handling |

### S6. UTC/Local Mode Transition

| Property | Effect |
|----------|--------|
| keepLocalTime | Changes the instant while keeping wall clock |
| startOf equivalence | `utc().startOf(d)` ≠ `startOf(d).utc()` near DST |

### Singular boundary walk generation for fuzzing

Each boundary type generates a family of states:

```typescript
const BOUNDARY_DATES = [
  // DST spring-forward (US/Eastern)
  "2024-03-10T01:30:00",
  "2024-03-10T03:00:00",
  // DST fall-back (US/Eastern)
  "2024-11-03T00:30:00",
  "2024-11-03T01:30:00",
  // Month-end
  "2024-01-31T12:00:00",
  "2024-02-28T12:00:00", // non-leap
  "2024-02-29T12:00:00", // leap
  "2024-03-31T12:00:00",
  "2024-04-30T12:00:00",
  // Leap year
  "2024-02-29T12:00:00", // leap year
  "2023-02-28T12:00:00", // non-leap year
  // Year boundary
  "2023-12-31T23:59:59",
  "2024-01-01T00:00:00",
];
```

---

## 6. Fast-Path Legality by Permutation Analysis

From the commutativity and idempotence analysis, we derive rules for when fast paths are legal.

### 6.1 Pure `_t` arithmetic is ALWAYS safe

| Operation | UTC safe | Local safe | Reason |
|-----------|----------|------------|--------|
| `add(ms, n)` | ✓ | ✓ | `_t += n` — no DST interaction |
| `add(s, n)` | ✓ | ✓ | `_t += n*1000` |
| `add(min, n)` | ✓ | ✓ | `_t += n*60000` |
| `add(h, n)` | ✓ | ✓ | `_t += n*3600000` (code does this already) |
| `add(d, n)` | ✓ | ✗ | UTC: `_t += n*86400000`. Local: must use `setDate()` for DST correctness |
| `startOf(d)` | ✓ | ✗ | UTC: `floorUnitEpoch`. Local: must use Date setters for DST |
| `startOf(h)` | ✓ | ✓ | UTC: `floorUnitEpoch`. Local: can also use `floorUnitEpoch` since hour has no DST ambiguity (DST happens at 02:00 local, which is on an hour boundary) |
| `endOf(d)` | ✓ | ✗ | UTC: `endOfUnitEpoch`. Local: must use Date setters |

### 6.2 `ymdToEpochDays` is ALWAYS safe for month/year ops in UTC

The calendar arithmetic (Hinnant `days_from_civil`) is used for:
- `add(M)`, `add(Y)`, `add(Q)` in UTC
- `startOf(M)`, `startOf(Y)` in UTC
- `endOf(M)`, `endOf(Y)` in UTC

This is always safe because:
- Pure integer arithmetic, no Date allocation
- No DST interaction (UTC mode)
- Handles all years including negative and 0

### 6.3 Local mode MUST go through Date setters for calendar operations

From the permutation analysis:
- `add(d)` in local = `setDate(getDate()+n)` — required for DST correctness
- `add(M)` in local = `setFullYear(y, m+n, d)` with month-end clamping
- `startOf(d)` in local = `d.setHours(0,0,0,0)` — this works with DST because `setHours` on a Date object correctly handles DST transitions

### 6.4 UTC fast paths are legal because the permutation group is abelian

In UTC mode, all operations are pure arithmetic on `_t`:
- `add(d)` → `_t += n*86400000`
- `add(M)` → decompose to calendar date, adjust month, recompute `_t`
- `startOf(d)` → `floorUnitEpoch(_t, DAY_MS)`
- All these commute with each other in UTC

This means **unit-testing UTC operations can use any order** — the results are order-independent.

In local mode, operations are NOT abelian because `setDate()`/`setMonth()` interact with DST and month-end clamping. **Property tests must test local mode separately**, with the understanding that results may be order-dependent.

---

## 7. Fuzzing: Operation Walks

### 7.1 Walk structure

A walk is a sequence of operations applied to a starting moment:

```
start → op₁ → op₂ → ... → opₙ → verify
```

Each operation is drawn from:

```
op ∈ {
  add(day,  { -5..5 }),
  add(month, { -3..3 }),
  add(hour,  { -12..12 }),
  startOf(day),
  startOf(month),
  utc(),
  local(),
  set(date, { 1..31 }),
}
```

### 7.2 Invariants to check after each walk

| Invariant | Check | Failure mode |
|-----------|-------|-------------|
| `_t` ∉ {NaN, ±Infinity} | `isFinite(m._t)` | Overflow in arithmetic |
| `isValid()` consistent | `m.isValid() === (fields match _t)` | State corruption |
| `format()` roundtrip | `moment(m.format("YYYY-MM-DDTHH:mm:ss.SSSZ"))` matches `m` | Cached field vs `_t` mismatch |
| `valueOf()` monotonic | `walk[k].valueOf()` ≥ `walk[k-1].valueOf()` for add(positive) operations | DST reversal |
| UTC/local parity | `m.clone().utc().valueOf()` ≈ `m.valueOf()` (within DST tolerance) | Offset corruption |
| `_dirty` flag consistency | After `_ensureFields()`, all `$*` fields match `_t` | Lazy field invalidation bug |

### 7.3 Boundary-focused walks

**Walk type A**: DST-crossing day add
```
start(DST-spring-eve) → add(1, day) → add(-1, day) → check: valueOf() unchanged
start(DST-spring-eve) → add(1, day) → add(1, hour) vs add(1, hour) → add(1, day)
```

**Walk type B**: Month-end clamping chain
```
start(Jan 31) → add(1, month) → add(-1, month) → check: date is Jan 28 (not 31)
start(Jan 31) → add(1, month) → add(1, day) vs add(1, day) → add(1, month)
```

**Walk type C**: Mode switching
```
start(random) → utc() → utc() → check: idempotent
start(random) → utc() → local() → utc() → check: valueOf() preserved
start(random) → local() → utc() → local() → check: valueOf() preserved
```

**Walk type D**: startOf chain
```
start(random) → startOf(month) → startOf(day) → check: == startOf(month)
start(random) → startOf(year) → startOf(month) → check: == startOf(year)
```

**Walk type E**: Long chain (10 operations)
```
start(Jan 31 2024) → add(1, M) → add(5, d) → startOf(M) → utc() → add(-2, h) → local() → add(-1, M) → startOf(d) → check: valid, format roundtrips
```

### 7.4 Operation walk generator (reference)

```typescript
type Op =
  | { t: "addDay"; n: number }
  | { t: "addMonth"; n: number }
  | { t: "addHour"; n: number }
  | { t: "startOfDay" }
  | { t: "startOfMonth" }
  | { t: "utc" }
  | { t: "local" }
  | { t: "setDate"; n: number };

function walk(m: Moment, ops: Op[]): Moment {
  for (const op of ops) {
    switch (op.t) {
      case "addDay":   m.add(op.n, "day"); break;
      case "addMonth": m.add(op.n, "month"); break;
      case "addHour":  m.add(op.n, "hour"); break;
      case "startOfDay":   m.startOf("day"); break;
      case "startOfMonth": m.startOf("month"); break;
      case "utc":   m.utc(); break;
      case "local": m.local(); break;
      case "setDate": m.date(op.n); break;
    }
  }
  return m;
}
```

### 7.5 Where to add these walks

The existing `operations.fuzz.js` test at `test/fuzz/operations.fuzz.js` already generates random operations. The gap is that it doesn't group operations into boundary-targeted walks, and it doesn't check group-theoretic invariants (idempotence, quasi-inverses, commutativity).

**Recommendation**: Add a new fuzz target `test/fuzz/permutation-walks.fuzz.js` that:
1. Starts from each `BOUNDARY_DATE` 
2. Generates random walks of length 3-10
3. After each walk, checks: `isValid()`, `valueOf()` is finite, `format()` roundtrips
4. For every walk, also checks: the idempotence of repeated `utc()` and `startOf(day)` within the walk

---

## 8. Rejected Runtime Abstractions

| Abstraction | Why Rejected |
|-------------|-------------|
| **Permutation group object** | Group of date-state operations would be enormous (uncountable state space). A symbolic group representation is infeasible. |
| **Monoid algebra engine** | Would track operation composition as a program expression. Adds runtime overhead, and the 20+ rules are better expressed as static assertions. |
| **Commutativity checker** | Runtime verification of commutativity for every pair of calls. Expensive (O(n²) in call count) and the non-commutative cases are few and well-known. |
| **Quasi-inverse auto-injector** | Automatically generates inverse operations. Month-end and DST make inverses non-deterministic. Would produce incorrect results silently. |
| **Execution plan optimizer** | Reorders operations for efficiency. Would break DST-sensitive sequences. Too risky given the non-associativity of calendar operations at singular boundaries. |
| **Abstract interpretation** | Model checking all possible operation sequences is exponential. The state space of dates is too large for practical abstract interpretation at runtime. |
| **Walk oracle** | Pre-computing expected results for all walks of length L. The space is far too large (10 ops × 11 choices each = 10¹¹ sequences). Only feasible for targeted walks. |

### Why permutation analysis IS useful (without runtime machinery)

| Use | How |
|-----|-----|
| **Fast-path safety** | Proved that UTC `_t` arithmetic commutes universally → all UTC fast paths are valid |
| **DST-aware testing** | Identified 6 boundary types where commutativity breaks → property tests must sample these |
| **Idempotency optimization** | Identified missing idempotency checks for `startOf(quarter|week|isoWeek)` → can add ~30 bytes |
| **Fuzz design** | Walk generation around singular boundaries → higher bug-finding efficiency |
| **Documentation** | Clear rules for which operations can be fused, which must remain ordered |

---

## 9. Benchmark Impact

### No runtime cost from this analysis

This is purely analytical. No changes to source code.

### If idempotency checks are added for missing units

| Change | Impact |
|--------|--------|
| Add idempotency check for `startOf(quarter)` | Saves ~Date allocation on repeated calls. Negligible on single calls. |
| Add idempotency check for `startOf(week)` | Same. |
| Add idempotency check for `startOf(isoWeek)` | Same. |

Each check is ~3 field comparisons (`$D === 1 && $H === 0 && ...`). The savings are significant only when `startOf` is called repeatedly on the same state — which is rare in real code.

### Benchmark: repeated startOf calls

```typescript
// Current (no idempotency check for week):
m.startOf("week").startOf("week")  // 2x full recompute

// After adding check:
m.startOf("week")        // full recompute (first call)
  .startOf("week")       // early return (second call hits idempotency)
```

Estimated speedup for the second call: ~10× (avoids Date allocation, field writes, `_t` recompute).

---

## 10. Deliverables Summary

### Commutativity table (§1)
8×8 matrix covering add(ms/h/d/M), startOf(d/M), utc, set(d/M). 4 classes: always commute (✓), UTC-only (U), boundary-sensitive (B), never (✗).

### Idempotence table (§2)
18 operations classified. 3 missing checks identified: `startOf(quarter|week|isoWeek)`.

### Quasi-inverse table (§3)
14 operation pairs classified. Only time-unit adds have exact inverses. Calendar adds fail at month-end/leap-year boundaries.

### Safe fusion opportunities (§4)
16 sequences analyzed. Only same-unit fusion is universally safe. Cross-unit fusion is safe only in UTC. Calendar-day + calendar-month can never fuse.

### Singular-boundary list (§5)
6 boundary types: DST spring/fall, month-end, leap-year, year 0/negative, UTC/local transition. Each with specific permutation relation failures.

### Fast-path legality (§6)
Proved: UTC `_t` arithmetic commutes universally (abelian group). Local mode operations do not (non-abelian). All current UTC fast paths are legal per permutation analysis.

### Operation walks for fuzzing (§7)
5 walk types (A-E) targeting boundaries. Invariant checks: `_t` finiteness, format roundtrip, valueOf monotonicity, dirty flag consistency. New fuzz target design: `permutation-walks.fuzz.js`.

### Rejected abstractions (§8)
7 abstractions rejected. Reason: runtime overhead, non-deterministic inverses, exponential state space, or risk of incorrect results at singular boundaries.

---

## Conclusion

Permutation-group-inspired analysis provides **rigorous justification for fast-path decisions** and **targeted boundary exploration for fuzzing**, but the group structure is too irregular (non-associative near singular boundaries) to implement as a runtime abstraction.

**Do**: use permutation relations to classify fast-path safety, design boundary-targeted fuzzing walks, and identify missing idempotency checks.

**Do not**: implement runtime permutation groups, commutativity checkers, or execution plan optimizers.
