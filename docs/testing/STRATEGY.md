# Testing Strategy

## Overview

mmntjs is a drop-in replacement for moment.js. The core testing strategy is **Differential Testing using upstream moment.js as the oracle**.
All tests run with `TZ=UTC` fixed.

```
Core test (moment.js official):  630/630 ✅
Property-based:                  112 tests, ~14.8k oracle assertions ✅
Stateful Model-Based:            3 tests, 400 sequences, ~4800 oracle assertions ✅
Branch-Targeted:                 37 tests, ~5.3k oracle/consistency assertions ✅
Mutation:                        10/10 kill ✅
Timezone:                         8/8 tests ✅
Locale:                       3246/3246 (138 locales) ✅
Tree-shaking:                     7/7 tests ✅
Moment2 spec:                    14/14 tests ✅
──────────────────────────────────────
Regression Corpus (generated): 41 tests ✅
Total:                         ~4108/4108 ✅
```

## Test Methods

### 1. Moment.js Official Test Suite (QUnit Compatibility Layer)

**Tools**: `test/qunit.js` + `test/moment/*.js`

Runs moment.js's 52 QUnit test files on `bun:test` through a QUnit adapter (`test/qunit.js`).
The adapter uses `test/oracle.ts` to toggle between original moment.js and mmntjs.

```
test/oracle.ts  -->  import moment from '../moment/moment'    # upstream
                   // import moment from '../src/index.ts'      # mmntjs
```

### 2. Property-Based Testing (fast-check + oracle comparison)

**Tools**: `test/properties/*.test.ts` + `fast-check`

4 files, all comparing mmntjs output against upstream moment.js:

| File | Content | Assertions |
|----------|------|---------------|
| `basic.test.ts` | Full API coverage: add/subtract/diff/format/getter-setter/comparison/display/UTC/duration/parsingFlags/weeks/bigInt/string/format-tokens/startOf-endOf | ~70 tests |
| `metamorphic.test.ts` | Metamorphic relations: add/subtract round-trip, diff antisymmetry, comparison consistency, startOf/endOf idempotence, zone conversion round-trip, duration invariants | ~30 tests |
| `boundary.test.ts` | Boundary values: null/undefined/NaN/Infinity, empty string, 68/69 year threshold, leap years, month boundaries, day/hour/min/sec/ms boundaries, year/month/date range | ~30 tests |
| `equivalence.test.ts` | Equivalence partitioning: valid/invalid month, day boundaries, time components, 2-digit year, leap year classification, format token classification, comparison methods | ~30 tests |

**Pattern**:
```typescript
import fc from 'fast-check'
import moment from '../../src/index.ts'
import originalMoment from '../../moment/moment'

test('add() matches moment', () => {
  fc.assert(
    fc.property(safeDates, dayAmounts, dayUnits, (date, amount, unit) => {
      expect(moment(date).add(amount, unit).format('YYYY-MM-DD'))
        .toBe(originalMoment(date).add(amount, unit).format('YYYY-MM-DD'))
    }),
    { numRuns: 100 }
  )
})
```

### 3. Fuzz Testing (Jazzer.js + coverage-guided + oracle comparison)

**Tools**: `test/fuzz/*.fuzz.js` + `@jazzer.js/core`

9 fuzz harnesses use libFuzzer (coverage-guided) to generate random inputs and compare mmntjs against upstream moment.js.
All harnesses report with `throw new Error(...)` on mismatch.

| Harness | Fuzz Target | Comparison |
|----------|-----------|---------|
| `parse.fuzz.js` | `moment(str)` | isValid, format, valueOf |
| `format.fuzz.js` | `moment(str).format(fmt)` | format output |
| `duration.fuzz.js` | `moment.duration({key: val})` | get, as, add |
| `operations.fuzz.js` | `moment(date).add/startOf/diff` | format, isValid, add, startOf, diff |
| `utc.fuzz.js` | `moment.utc(str)` | isValid, format, valueOf, toISOString |
| `reltime.fuzz.js` | `calendar/from/to` | relative time strings |
| `array-input.fuzz.js` | `moment([y, M, d, ...])` | isValid, format, valueOf |
| `object-input.fuzz.js` | `moment({year, month, ...})` | isValid, format, valueOf |
| `grammar.fuzz.js` | Grammar-based ISO 8601 generation | isValid, format, valueOf |

**Execution**:
- `bun run fuzz` -> parse.fuzz.js for 60 seconds
- `bun run fuzz:quick` -> all 9 harnesses for 500 iterations each
- `bun run fuzz:grammar` -> grammar.fuzz.js for 10,000 iterations
- `bun run fuzz:grammar:quick` -> grammar.fuzz.js for 500 iterations

**Pattern**:
```javascript
export function fuzz(buf) {
  const str = buf.toString('utf-8')
  const m2 = moment.utc(str)
  const mOrig = originalMoment.utc(str)

  if (m2.isValid() !== mOrig.isValid()) {
    throw new Error(`isValid mismatch: mmntjs=${m2.isValid()}, original=${mOrig.isValid()}`)
  }
  if (m2.format('YYYY-MM-DD HH:mm:ss.SSS') !== mOrig.format('YYYY-MM-DD HH:mm:ss.SSS')) {
    throw new Error(`format mismatch: ...`)
  }
}
```

### 3.1. Grammar-Based Fuzzing

**Tools**: `test/fuzz/grammar.fuzz.js`

Traditional fuzz harnesses treat libFuzzer's random byte sequences as raw UTF-8 strings. Most inputs fail ISO 8601 syntax and are rejected early.

`grammar.fuzz.js` uses the byte sequence to **drive grammar production rules**, systematically generating syntactically valid ISO 8601 strings:

```
ISOdatetime = date (sep time)? (timezone)?
date        = YYYY-MM-DD | YYYYMMDD | YYYY-DDD | YYYYDDD | GGGG-Www-D | GGGG-Www | GGGGWwwD | GGGGWww | YYYY-MM | YYYY
time        = HH:mm:ss.SSS | HH:mm:ss,SSS | HH:mm:ss | HH:mm | HHmmss.SSS | HHmmss,SSS | HHmmss | HHmm | HH
timezone    = Z | +-HH:mm | +-HHmm
sign        = +- (6-digit year) | none (4-digit year)
```

By following the grammar:
- Exercises all format branches of `parseCommonISOExtended`, `parseISOWithTable`, `parseCommonISO`
- Mass-produces syntactically valid but semantically invalid strings (e.g. `2024-02-30`, leap-year violations, non-existent week 53) to test overflow detection
- Covers mixed extended/basic format combinations (extended date + basic time, etc.)

Combined with libFuzzer's coverage guidance, this efficiently explores deep paths unreachable by random fuzzing.

**Execution**:
```bash
bun run fuzz:grammar        # 10,000 iterations
bun run fuzz:grammar:quick  # 500 iterations
```

### 4. Mutation Testing (oracle comparison)

**Tools**: `test/mutation.test.ts` + `fast-check`

Injects 10 types of bugs into `src/mmntjs.ts` mechanically, then verifies that upstream moment.js detects them with random inputs from fast-check.

| Mutation | Change |
|-----------------|---------|
| valueOf: off by +1ms | `return this._d.getTime()` -> `+ 1` |
| add days: wrong direction | `getDate() + days` -> `- days` |
| diff: sign flipped | `this - other` -> `other - this` |
| isBefore: comparison flipped | `<` -> `>` |
| isAfter: comparison flipped | `>` -> `<` |
| add months: wrong direction | `d.setMonth(newMonth)` -> `curMonth - months` |
| startOf: hours set to noon | `setHours(0,...)` -> `setHours(12,...)` |
| isValid always returns true | `return this._isValid` -> `return true` |
| clone: CoW protection removed | CoW guard removed |
| endOf: no -1ms | `setMilliseconds(-1)` -> `0` |

**Pattern**:
```typescript
// Mutate
let mutated = original.replace(/return this\._d\.getTime\(\)/, 'return this._d.getTime() + 1')
fs.writeFileSync(filePath, mutated)

// oracle comparison
fc.assert(fc.property(fc.date({ noInvalidDate: true }), (input) => {
  return mutatedMoment(input).valueOf() === originalMoment(input).valueOf()
}), { numRuns: 100 })
```

### 5. Metamorphic Testing

**Tools**: `test/properties/metamorphic.test.ts`

Self-consistency verification that does not require an oracle. Ensures mmntjs's output is mathematically/logically consistent.

Key invariants:
- add/subtract round-trip: `m.add(n, u).subtract(n, u) === m`
- diff antisymmetry: `diff(a, b) === -diff(b, a)`
- diff invariance under identical shifts
- comparison exclusivity: `isBefore + isSame + isAfter === 1`
- startOf/endOf idempotence
- `startOf <= original <= endOf`
- clone independence
- UTC <-> Local round-trip
- utcOffset invariants

### 6. Stateful Model-Based Testing (fast-check commands)

**Tools**: `test/stateful-model.test.ts` + `fast-check` + `fc.commands`

Tests **chained mutations** on the same Moment object — sequences of operations where
each step mutates the object in-place and the next operation depends on the resulting state.
This catches bugs that single-call property tests or independent fuzz harnesses miss.

**Architecture**:

```
MomentModel { isValid: boolean }   ← simplified model of moment state
       ↑ fc.Command.check/run       ↑ 9 command types
MomentPair { m2, mOrig }          ← real system (parallel instances)
       ↓ verifyEqual(r)             ↓ oracle comparison after each command
valueOf + format + utcOffset + locale + self-diff ===
```

**9 Command types**:

| Command | Parameters | Model guard |
|---------|-----------|-------------|
| `AddCommand` | amount, unit | isValid |
| `SubtractCommand` | amount, unit | isValid |
| `StartOfCommand` | year/quarter/month/week/isoWeek/day/hour/minute/second | isValid |
| `EndOfCommand` | same units | isValid |
| `UtcCommand` | keepLocalTime | always |
| `LocalCommand` | keepLocalTime | always |
| `UtcOffsetCommand` | offset, keepLocalTime | always |
| `CloneCommand` | — | always |
| `LocaleCommand` | locale name | always |

**Verification (`verifyEqual`)** at every step:

- `isValid()` — must always match
- `valueOf()` — epoch must match
- `format()` — string representation
- `utcOffset()` — timezone offset in minutes
- `locale()` — active locale
- `self-diff` — `m.diff(m) === 0`

**3 test scenarios**:

1. **Mixed sequences** — 9 command types, up to 12 commands, 200 runs
2. **UTC/Local/Offset transitions** — focus on timezone mode switching, 10 commands, 100 runs
3. **Clone independence** — verify clone() isolation after mutation, 8 commands, 100 runs

**Bug classes caught**:

- **Mutable state not refreshed** after mutation (e.g., `_addSimple` not updating `_offset`
  for local year/quarter/month changes — **found 1 bug**)
- **Early return skipping post-mutation cleanup** (e.g., `_startOfLocal` and `_endOfLocal`
  returning before updating `_offset` for QUARTER/WEEK/ISO_WEEK — **found 1 bug**)
- UTC/local offset staleness after `add()`/`subtract()` crossing DST boundaries
- Clone independence violations (CoW bugs)
- Locale state corruption after mixed operations
- Invalid-state propagation failures

**Known limitations**:

- Pre-1900 dates in timezones with fractional historical offsets (e.g., Japan +9:18:59 before 1888)
  can cause <60s discrepancies between mmntjs and moment.js for `utc(true)` — test date range
  is constrained to `>= 1950` to avoid this.
- `parseZone` not included as a command since it replaces the moment entirely.
- Duration operations tested separately via `test/duration-extra.test.ts`.

**Execution**:
```bash
TZ=UTC bun test test/stateful-model.test.ts
TZ=America/New_York bun test test/stateful-model.test.ts
TZ=Asia/Tokyo bun test test/stateful-model.test.ts
```

Also included in `test:hard` (6 TZs) and `test:tz` (6 TZs) for multi-timezone coverage.

### 7. Equivalence Class Testing

**Tools**: `test/properties/equivalence.test.ts`

Partitions input space into valid/invalid/boundary classes and selects representative values for oracle comparison.

| Partition | Classes |
|--------|--------|
| Month | valid(0,6,11), low invalid(-1,-12), high invalid(12,13) |
| Day | safe(1-28), month boundary(29-31), negative/0, overflow(32+) |
| Hour/min/sec/ms | valid range, out of range, negative |
| Year | negative, 0, 2-digit, 9999, 10000 |
| Leap year | divisible by 400, divisible by 100, divisible by 4, other |

### 7. Locale Testing

**Tools**: `test/locale/*.test.ts` (138 files)

Auto-generated from moment.js locale tests (`moment/src/test/locale/*.js`) via `scripts/generate-locale-tests.mjs`.
Verifies all 138 locales.

### 8. Delta Debugging (Fault Input Minimization)

**Tools**: `test/fuzz/ddmin.ts` / `test/fuzz/delta-debug.mjs`

Minimizes mismatch inputs found by fuzzing using the **ddmin algorithm** (Zeller & Hildebrandt).
Operates alongside libFuzzer's built-in `-minimize_crash=1` and also supports operation sequence reduction.

**ddmin algorithm**:
- Split input into n chunks
- Remove each chunk and test
- If removable, remove permanently and decrease n
- If not, double n (finer granularity)
- Repeat until convergence

**Functions**:
- `ddmin<T>(input: T[], test): T[]` — generic
- `ddminString(input: string, test): string` — string utility
- `ddminArray<T>(input: T[], test): T[]` — array utility

**Usage**:
```bash
# Minimize crash file (default: parse harness)
bun test/fuzz/delta-debug.mjs crash-xxxxxx

# With harness spec
bun test/fuzz/delta-debug.mjs crash-yyyyyy utc
```

**Results**: Existing crash files minimized:
- `-000700-005` (11 B) -> `-000700-05` (10 B, 1 B saved)
- `93280531 09-3911` (16 B) -> `9328031 09-11` (13 B, 3 B saved)

### 9. Snapshot / A/B Comparison

**Tools**: `scripts/snapshot.sh`

`scripts/snapshot.sh save` saves entire `src/` to `src.snapshot/`.
`scripts/snapshot.sh compare` swaps the current `src/` with the snapshot, enabling A/B performance comparison.

## Differential Testing Architecture

```
                     +---------------------------+
                     |   Random / Fuzz Input    |
                     |  (fast-check / libFuzzer) |
                     +------------+--------------+
                                  |
                   +--------------+--------------+
                   |                             |
           +-------+-------+           +---------+---------+
           |   mmntjs     |           |   moment.js      |
           | (src/index.ts)|           | (moment/moment)  |
           +-------+-------+           +---------+---------+
                   |                             |
                   +-------------+---------------+
                                 |
                          +------+------+
                          |   Compare   |
                          |  output === |
                          +------+------+
                                 |
                     +-----------+-----------+
                     |                       |
                == Match                 != Mismatch
                (pass)                 (bug / regression)
```

## Test Commands

| Command | Content |
|----------|------|
| `bun test` | core + mmntjs + tree-shaking + timezone + mutation |
| `bun run test:hard` | core + properties + locale + fuzz |
| `bun run fuzz` | parse fuzz (60s, minimize_crash=1) |
| `bun run fuzz:quick` | all 9 fuzz (500 runs each) |
| `bun run fuzz:grammar` | Grammar-based fuzz (10,000 runs) |
| `bun run fuzz:grammar:quick` | Grammar-based fuzz (500 runs) |
| `bun run fuzz:ddmin -- crash-xxx` | ddmin-crash minimization |
| `bun test test/properties/` | property tests only |
| `bun test test/properties/basic.test.ts` | specific file |
| `bun test test/stateful-model.test.ts` | stateful model-based tests |
| `TZ=America/New_York bun test test/stateful-model.test.ts` | in non-UTC timezone |
| `bun test test/branch-targeted.test.ts` | branch-targeted tests |
| `bun run bench` | performance benchmarks |
| `bun run bench:mem` | memory benchmarks |

## How to Add Tests

### Add a Property-Based Test

```typescript
import fc from 'fast-check'
import moment from '../../src/index.ts'
import originalMoment from '../../moment/moment'

test('your feature matches moment', () => {
  fc.assert(
    fc.property(yourArbitrary, (input) => {
      expect(moment(input).yourMethod()).toBe(originalMoment(input).yourMethod())
    }),
    { numRuns: 100 }
  )
})
```

### Add a Fuzz Harness

```javascript
import _moment from '../../dist/index.js'
import _originalMoment from '../../moment/moment.js'

const moment = _moment
const originalMoment = _originalMoment

export function fuzz(buf) {
  // buf: Buffer -- libFuzzer random input
  const input = buf.toString('utf-8')
  const m2 = moment(input)
  const mOrig = originalMoment(input)

  if (m2.isValid() !== mOrig.isValid()) {
    throw new Error(`Validity mismatch: ...`)
  }
  if (m2.format() !== mOrig.format()) {
    throw new Error(`Format mismatch: ...`)
  }
}
```

### Add a Branch-Targeted Test

Use `compare(str)` for oracle comparison and `compareKnownDiff(str)` for cases where
mmntjs is deliberately more permissive:

```typescript
test("signed compact date formats match oracle", () => {
  const cases = ["+0012340101", "-0012340101"];
  for (const c of cases) {
    compare(c);  // fails if isValid or valueOf differs from moment.js
  }
});

test("W53 for years with 52 weeks (known diff)", () => {
  compareKnownDiff("2023-W53");  // mmntjs may accept, moment.js rejects
});
```

### Add a Mutation Test

Add a Mutation object to `makeMutations([...])` in `test/mutation.test.ts`:

```typescript
{
  name: 'description',
  file: 'src/mmntjs.ts',
  patterns: [[/original code/g, 'mutated code']],
  inputs: fc.someArbitrary(),
  testFn: (input) => mutatedMoment(input).method() === originalMoment(input).method(),
}
```

## Pairwise / Combinatorial Testing

**Decision**: Not adopted. Grammar-Based Fuzzing (section 3.1) replaces it.

### Rationale

mmntjs's parametric APIs (array constructor `moment([y,M,d,h,m,s,ms])`, ISO format selection table, duration object construction, etc.) can exhibit 2-way parameter interactions. Pairwise testing systematically covers these combinations, but grammar-based fuzzing was preferred:

1. **Oracle presence makes random testing extremely effective**
   Property-based testing (fast-check, 14.8k assertions) and coverage-guided fuzzing (52k iterations) already exist, using upstream moment.js as oracle. Key parameter pairs are probabilistically covered; pairwise adds little new detection value.

2. **Grammar-based fuzzing explores deeper paths**
   For ISO 8601 string parsing, grammar-based approaches that generate syntactically valid inputs explore deeper parse paths more efficiently than pairwise.

3. **Priority**
   36 pre-existing test failures (locale, equivalence) remain unresolved. Grammar-based fuzzing implementation offered better ROI than pairwise.

### Reference: Candidate Pairwise Areas

| Area | Parameters | Partitions | Pairwise Tests |
|------|-------------|--------|-------------------|
| Array constructor overflow | 7 (y/M/d/h/m/s/ms) | 5 each | ~55 |
| ISO parse format selection | 13 date x 9 time x 3 TZ | 351 total | feasible exhaustively |
| Format token interaction | ~20 representative tokens | 2-3 each | ~200 |

These areas are covered by grammar-based fuzzing (section 3.1) and existing random + oracle tests.

### 10. Concolic-Inspired Branch-Targeted Testing

**Decision**: Adopted (partial). Full concolic/symbolic execution was evaluated and rejected.

#### Evaluation of Three Approaches

| Approach | Verdict | Rationale |
|----------|---------|-----------|
| **Full concolic testing** (e.g. Jalangi, Colossus) | **REJECTED** | No production-grade concolic engine exists for modern TypeScript/JavaScript. ~495 parser branches would require prohibitive symbolic modeling of JS Date, locale data, and external dependencies. Cost/benefit is poor given existing grammar-based fuzzing + property testing already achieves high coverage. |
| **Limited symbolic execution** for pure parser functions | **PARTIALLY ADOPTED** (as concolic-inspired targeted generators) | Pure parser functions (`parseCommonISO`, `classifyISODatePart`, `parseISOWithTable`) have deterministic input→output mappings suitable for targeted generators. Rather than a symbolic engine, we use coverage-gap analysis to identify hard-to-reach branches and design fast-check generators that intentionally exercise them. |
| **Concolic-inspired branch-targeted testing** | **ADOPTED** | Combines coverage data from existing tests with manual branch analysis to create targeted generators. This is practical, maintainable, and does not require a symbolic execution engine. |

**Tools**: `test/branch-targeted.test.ts` + `fast-check` + manual branch analysis

#### Approach

1. **Branch audit**: Manually enumerate all `if/else/switch/ternary` branches in `src/parse.ts` (~495 decision points), `src/parse-format.ts` (~390), and `src/units.ts` (~37)
2. **Coverage gap analysis**: Compare branch conditions against existing fuzz/property-test inputs to identify under-tested or untested conditions
3. **Targeted generators**: Create fast-check arbitraries and fixed test cases that specifically exercise these branch conditions
4. **Oracle comparison**: Compare mmntjs output against upstream moment.js, with `compareKnownDiff` for cases where mmntjs is deliberately more permissive

#### Target Branches and Generators

| Branch Condition | Generator | Test Count |
|-----------------|-----------|------------|
| **W53 week validity** | Years with 53 ISO weeks vs 52 weeks | 1 property + fixed cases |
| **Day-of-year 366** | Leap years vs non-leap years | 1 property + fixed cases |
| **DDD 000** | Zero day-of-year | Fixed cases |
| **Signed extended years** (`[+-]YYYYYY`) | Random ±6-digit year, month, day | 1 property (200 runs) + fixed |
| **Compact signed dates** (`[+-]YYYYYYMMDD` 11-char) | Fixed edge cases (was a bug — `classifyISODatePart` missing branch) | Fixed |
| **Strict mode format/input pairs** | Random dates → format → strict parse round-trip | 1 property (200 runs) |
| **Multi-format strict arrays** | 2+ candidate format strings | Fixed |
| **Mixed basic+extended ISO** | Extended date + basic time, basic date + extended time | Fixed cases |
| **Timezone offset boundaries** | -12:00 to +14:00 range, 15-min granularity | 1 property (200 runs) + fixed |
| **BigHour detection** | hh/hhh with hour >12 in strict mode | Fixed cases |
| **Overflow lattice** | All month×day combos for leap/non-leap years | 1 exhaustive (744 combos per year) |
| **Format token overflow** | SSSS+, repeated tokens, bracket escaping | Fixed cases |
| **Duration partial objects** | Single-key, empty, random partial objects | 1 property (100 runs) + fixed |
| **Feb 29 / Apr 31 / etc.** | Lattice of valid/invalid dates | Fixed cases |

#### Bug Discoveries During Implementation

1. **`classifyISODatePart` missing 11-char compact signed date branch** (`src/parse.ts`):
   - Condition: `len === 11 && sign-prefixed && no-dash` (e.g., `+0012340101`)
   - `classifyISODatePart` returned `null` for this format, causing `parseISOWithTable` to reject it
   - Original moment.js accepts these inputs
   - **Fix**: Added `if (len === 11 && (ch0 === 43 || ch0 === 45)) return ["YYYYYYMMDD", true]`

2. **Grammar fuzzer skipping signed year oracle comparison** (`test/fuzz/grammar.fuzz.js`):
   - All signed year strings (`+YYYYYY`, `-YYYYYY`) were silently skipped at line 144-146
   - This masked regression in signed year parsing
   - Proper oracle comparison confirmed remaining issues with signed week dates (tracked as known diffs)

#### Known Diffs (mmntjs more permissive)

Where mmntjs accepts inputs that original moment.js rejects in strict/overflow conditions:

- **W53 for years with 52 ISO weeks**: moment.js rejects `2023-W53`, mmntjs accepts (auto-corrects to W52)
- **W00, W54**: moment.js rejects, mmntjs may auto-correct
- **DDD 366 for non-leap years**: moment.js rejects, mmntjs accepts (auto-corrects to DDD 365)
- **DDD 000**: moment.js rejects, mmntjs may accept
- **Array constructor overflow**: moment.js sets `_overflow` field and marks invalid; mmntjs uses JS Date auto-correction
- **Strict mode incomplete input**: moment.js requires all tokens consumed; mmntjs may accept partial
- **Mixed basic/extended ISO**: moment.js uses `new Date(str)` fallback; mmntjs has explicit parser paths

These diffs are tracked but not treated as bugs — they represent deliberately more permissive parsing in mmntjs.

#### How This Complements Existing Tests

| Test Type | Covers | Doesn't Cover |
|-----------|--------|---------------|
| Grammar-based fuzzing | Syntactically valid ISO variants | Individual branch conditions, strict mode |
| Property-based testing | API-level invariants, format tokens | Parser branch-specific conditions |
| Stateful model testing | Mutation chaining, clone independence | Parser edge cases |
| **Branch-targeted (new)** | Specific branch conditions, overflow lattice, signed years, strict mode | Long chains, random exploration |

**Execution**:
```bash
bun test test/branch-targeted.test.ts
TZ=America/New_York bun test test/branch-targeted.test.ts
TZ=Asia/Tokyo bun test test/branch-targeted.test.ts
```

Also included in `test:hard` (UTC) and `test:tz` (6 TZs).

### 11. Coverage Heatmap and Corpus Management

**Decision**: Adopted (with practical constraints).

#### Rationale

Fuzzing generates valuable edge-case inputs. Without a corpus management strategy:
- libFuzzer re-discovers the same paths on every run
- Crash inputs are lost between sessions
- Coverage gains cannot be tracked over time
- Hard-to-reach branches remain unexplored across runs

A corpus management system treats fuzzing as an accumulated knowledge process rather than stateless random execution.

#### Corpus Directory Structure

```
test/fuzz/corpus/
  parse/        ISO 8601 string inputs (44 seeds)
  format/       Format string inputs (184 seeds, incl. existing)
  duration/     Duration construction inputs (110 seeds, incl. existing)
  operations/   Operation sequences (124 seeds, incl. existing)
  utc/          UTC-specific inputs (25 seeds, incl. existing)
  reltime/      Relative time inputs (7 seeds, incl. existing)
  grammar/      Grammar fuzz seeds (17 seeds)
  parse-zone/   parseZone inputs (9 seeds)
  locale/       Locale-specific inputs (16 seeds)
  strict/       Strict-mode parsing inputs (14 seeds)
  diff/         Cross-lib diff inputs (7 seeds)
  arrays/       Array constructor inputs (12 seeds)
  objects/      Object constructor inputs (7 seeds)
test/fuzz/crashes/    Preserved crash inputs (9 existing)
test/fuzz/regression/ Regression test inputs
test/fuzz/coverage/   Coverage heatmap JSON snapshots
```

Total: 638 seed files, 7.6 KB across 13 categories.

#### Corpus Lifecycle

| Phase | Trigger | Action |
|-------|---------|--------|
| Init | `fuzz:corpus:init` | Extract seeds from test suite edge cases |
| Fuzz | `fuzz:quick` / `fuzz:nightly` | libFuzzer reads corpus as seeds, writes new coverage-increasing inputs |
| Dedup | `fuzz:corpus:minimize` | Remove byte-identical files, keep smallest for each hash |
| Replay | `fuzz:corpus:replay` | Run all corpus files through Jazzer harnesses to verify current build |
| Heatmap | `coverage:heatmap` | Generate coverage heatmap from LCOV data, save snapshot for delta tracking |
| Archive | Manual | Crash inputs from `crash-*` moved to `test/fuzz/crashes/` for long-term retention |

#### CI/CD Integration

```
PR CI:  fuzz:quick (500 runs x 12 harnesses) + corpus replay
Nightly: fuzz:nightly (120s x 12 harnesses) + corpus minimize + heatmap
Weekly:  fuzz:nightly:long (600s) + deep corpus analysis
```

#### Coverage Heatmap Architecture

Generated by `scripts/fuzz-coverage-heatmap.ts` from Bun's LCOV output. Produces a JSON report with:
- **Overall coverage** percentage across src/
- **Subsystem breakdown** with color coding (red < 50%, yellow 50-80%, green > 80%)
- **Coldest files** sorted by coverage percentage
- **Coldest lines** (line-level zero-hit regions)
- **Coverage deltas** from previous snapshot (regression detection)
- **Historical snapshot** saved for next comparison

Example output:

| Subsystem | Coverage | Status |
|-----------|----------|--------|
| `src/parse` | 21.9% | red |
| `src/moment-class` | 79.7% | yellow |
| `src/format` | 83.5% | green |
| `src/duration` | 78.1% | yellow |
| `src/units` | 81.1% | green |
| `src/reltime` | 100% | green |

#### Performance Tradeoffs

| Aspect | Tradeoff |
|--------|----------|
| Corpus size | 638 files / 7.6 KB — negligible. Could grow to ~1 MB with nightly fuzzing. |
| Fuzz speed | Smaller corpus = faster startup. libFuzzer re-energizes from corpus on each run. |
| Heatmap accuracy | Depends on test coverage breadth. Full `test:coverage` for accurate percentages. |
| Delta tracking | Previous snapshot stored as JSON. No DB needed. |

#### How This Complements Other Techniques

| Technique | Corpus Benefit |
|-----------|---------------|
| Grammar-based fuzzing | Grammar seeds provide valid ISO skeletons; corpus captures libFuzzer mutations |
| Mutation testing | Corpus replay confirms mutations are detected |
| Delta debugging | Minimized crash inputs preserved in test/fuzz/crashes/ |
| Branch-targeted testing | Heatmap identifies which branches need targeted generators |

#### NPM Scripts Reference

| Script | Purpose |
|--------|---------|
| `fuzz:corpus:init` | Initialize/reinitialize corpus seed files |
| `fuzz:corpus:minimize` | Deduplicate and report corpus statistics |
| `fuzz:corpus:replay` | Replay corpus against current build |
| `fuzz:heatmap` | Generate coverage heatmap (requires prior `test:coverage`) |
| `coverage:heatmap` | Run coverage + heatmap in one step |
| `fuzz:nightly` | Full nightly workflow (120s per target) |
| `fuzz:nightly:long` | Extended nightly workflow (600s per target) |

#### Retention Policy

- **Corpus seeds**: Retained indefinitely in git. Updated when new edge cases are discovered.
- **Crash inputs**: Retained in `test/fuzz/crashes/`. Reviewed weekly. Archived after fix is verified.
- **Regression inputs**: Copied to `test/fuzz/regression/` as named entries with metadata.
- **Coverage snapshots**: Previous snapshot kept for delta tracking. Older snapshots pruned automatically.
- **libFuzzer-generated files**: Not committed to git (corpus dirs are git-tracked but libFuzzer output files are gitignored via `crash-*` pattern).

### 12. Reduction-Preserving Regression Corpus

**Decision**: Adopted.

#### Purpose

The regression corpus preserves minimized failing inputs as long-term quality assets.
Unlike the general fuzzing corpus (optimized for coverage growth, may be rotated/merged/deleted),
the regression corpus is optimized for bug preservation — entries are never deleted
and each is a named, documented reproducer.

#### Key Differences from General Fuzz Corpus

| Aspect | General Corpus | Regression Corpus |
|--------|---------------|-------------------|
| Purpose | Coverage growth | Bug preservation |
| Retention | May be rotated/merged | Never deleted |
| Naming | Content-hashed (anonymous) | Named by bug class |
| Metadata | None | JSON per entry with oracle, bug class, date |
| CI behavior | Seed for libFuzzer | Explicit test cases |
| Staleness | Removed if no new coverage | Kept even if coverage drops |

#### Directory Structure

```
test/fuzz/regression/
  parse/           27 entries
  utc/             9 entries
  stateful/        3 entries
  arrays/          1 entry
  parse-zone/      1 entry
```

Each entry is a directory containing `input` (the minimized input string)
and `meta.json` (metadata describing the bug, oracle, expected behavior).

#### Metadata Format

```json
{
  "target": "parse-zone",
  "bugClass": "invalid date overflow with timezone offset",
  "oracle": "upstream moment.js",
  "added": "2026-05-17",
  "failureDescription": "overflow not detected when combined with timezone",
  "expected": { "isValid": false }
}
```

#### CI Workflow

```
1. Fuzz/property test finds mismatch
2. Minimize with delta debugging or libFuzzer
3. Save to regression corpus via fuzz:regression:add
4. Regenerate test file via fuzz:regression:generate
5. Replay in CI: bun test test/regression/generated.test.ts
```

#### Bug Classes Preserved (41 entries)

| Bug Class | Count | Source |
|-----------|-------|--------|
| Fuzzer crash | 9 | libFuzzer crash files |
| Fixed parse crash | 9 | regression test suite |
| Fixed UTC crash | 9 | regression test suite |
| Known diff (parse) | 3 | mmntjs/moment.js disagreement |
| Stateful model bugs | 3 | Stateful model-based testing |
| Past fixed bugs | 5 | Handover memo history |
| Array constructor | 1 | Past bug fix |
| parseZone edge case | 1 | Past bug fix |
| Mixed format parse | 1 | Known diff |

#### How This Complements Other Techniques

| Technique | Complement |
|-----------|------------|
| Delta debugging | Minimized inputs preserved with full metadata |
| General fuzz corpus | Regression entries never deleted; fuzz corpus may be rotated |
| Property-based testing | Regression entries provide oracle anchor for specific edge cases |
| Mutation testing | Regression replay confirms mutations don't reintroduce old bugs |
| Grammar fuzzing | Regression entries include non-grammar inputs (binary, protocol) |

#### NPM Scripts

| Script | Purpose |
|--------|---------|
| `fuzz:regression:import` | Import crash files and known bugs into corpus |
| `fuzz:regression:generate` | Generate bun:test file from regression corpus |
| `fuzz:regression:replay` | Replay regression corpus via subprocess |
| `fuzz:regression:add` | Add a new regression entry |

## Tooling

| Tool | Purpose |
|--------|------|
| `bun:test` | Test runner |
| `fast-check` | Property-based testing |
| `@jazzer.js/core` | Coverage-guided fuzzing (libFuzzer) |
| `oxlint` | Linting (`bun run lint`) |
| `typescript` | Type checking (`bun run typecheck`) |
| `knip` | Dead code detection |
| `fallow` | Dependency analysis |
