# Testing Strategy

## Overview

moment2 is a drop-in replacement for moment.js. The core testing strategy is **Differential Testing using upstream moment.js as the oracle**.
All tests run with `TZ=UTC` fixed.

```
Core test (moment.js official):  678/678 ✅
Property-based:                  112 tests, ~14.8k oracle assertions ✅
Mutation:                        10/10 kill ✅
Timezone:                         8/8 tests ✅
Locale:                       3246/3246 (138 locales) ✅
Tree-shaking:                     7/7 tests ✅
Moment2 spec:                    14/14 tests ✅
──────────────────────────────────────
Total:                         ~4122/4122 ✅
```

## Test Methods

### 1. Moment.js Official Test Suite (QUnit Compatibility Layer)

**Tools**: `test/qunit.js` + `test/moment/*.js`

Runs moment.js's 52 QUnit test files on `bun:test` through a QUnit adapter (`test/qunit.js`).
The adapter uses `test/oracle.ts` to toggle between original moment.js and moment2.

```
test/oracle.ts  -->  import moment from '../moment/moment'    # upstream
                   // import moment from '../src/index.ts'      # moment2
```

### 2. Property-Based Testing (fast-check + oracle comparison)

**Tools**: `test/properties/*.test.ts` + `fast-check`

4 files, all comparing moment2 output against upstream moment.js:

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

9 fuzz harnesses use libFuzzer (coverage-guided) to generate random inputs and compare moment2 against upstream moment.js.
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
    throw new Error(`isValid mismatch: moment2=${m2.isValid()}, original=${mOrig.isValid()}`)
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

Injects 10 types of bugs into `src/moment2.ts` mechanically, then verifies that upstream moment.js detects them with random inputs from fast-check.

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

Self-consistency verification that does not require an oracle. Ensures moment2's output is mathematically/logically consistent.

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

### 6. Equivalence Class Testing

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
           |   moment2     |           |   moment.js      |
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
| `bun test` | core + moment2 + tree-shaking + timezone + mutation |
| `bun run test:hard` | core + properties + locale + fuzz |
| `bun run fuzz` | parse fuzz (60s, minimize_crash=1) |
| `bun run fuzz:quick` | all 9 fuzz (500 runs each) |
| `bun run fuzz:grammar` | Grammar-based fuzz (10,000 runs) |
| `bun run fuzz:grammar:quick` | Grammar-based fuzz (500 runs) |
| `bun run fuzz:ddmin -- crash-xxx` | ddmin-crash minimization |
| `bun test test/properties/` | property tests only |
| `bun test test/properties/basic.test.ts` | specific file |
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

### Add a Mutation Test

Add a Mutation object to `makeMutations([...])` in `test/mutation.test.ts`:

```typescript
{
  name: 'description',
  file: 'src/moment2.ts',
  patterns: [[/original code/g, 'mutated code']],
  inputs: fc.someArbitrary(),
  testFn: (input) => mutatedMoment(input).method() === originalMoment(input).method(),
}
```

## Pairwise / Combinatorial Testing

**Decision**: Not adopted. Grammar-Based Fuzzing (section 3.1) replaces it.

### Rationale

moment2's parametric APIs (array constructor `moment([y,M,d,h,m,s,ms])`, ISO format selection table, duration object construction, etc.) can exhibit 2-way parameter interactions. Pairwise testing systematically covers these combinations, but grammar-based fuzzing was preferred:

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
