# Benchmarks

## Design Principles

1. **Compare equivalent semantics only.**
   - moment.js = Moment compatibility comparison (`bench/moment-compat.ts`)
   - date-fns = native Date utility comparison (`bench/date-fns.ts`)
   - Temporal = immutable semantic engine comparison (`bench/temporal.ts`)

2. **Separate benchmark intent.**
   - **Public-facing** — representative operations, small table, simple ratios
   - **First-call latency** — diagnostic only, not marketing
   - **Developer microbenchmarks** — internal code-path optimization workbench

3. **Public tables prioritize readability over exhaustiveness.**

4. **Avoid designs that accidentally favor mmntjs.**
   - Mutating operations (add, subtract, setters, startOf, endOf) use **fresh objects per iteration** to prevent accumulated state bias
   - Read-only operations (format, getters, valueOf, diff, comparison) may reuse instances
   - The comparison is slightly conservative / mildly unfavorable to mmntjs by design

5. **Fresh-object workloads** for all mutating operations ensure accumulated state does not compound across iterations.

## Methodology

| Item | Detail |
|------|--------|
| CPU | Apple M4, performance core (no efficiency core migration) |
| OS | macOS (arm64) |
| Default runtime | Bun 1.x (JavaScriptCore) — see cross-runtime section for Node.js 26 (V8) validation |
| Harness | `process.hrtime.bigint()` |
| Measurement | Warm = median of 5 runs × 5000 iterations, preceded by 1000-iteration warmup. First-call = median of 20 isolated single-invocation samples |
| Result consumption | All results are consumed (e.g. `format()` output is `JSON.stringify`-ed to prevent DCE) |
| TurboFan / JIT | Enabled (default). Warming paths reach turbo-optimized code by ~1000 calls |
| Variance | Typical CV < 5% for warm measurements. First-call measurements have higher variance (~20-30%) due to JIT compilation, Shape allocation, and cache priming |
| Fresh objects | All mutating operations (add, subtract, setters, startOf, endOf) create a new instance per iteration. Read-only operations (format, getters, diff, comparison) may reuse a shared instance |
| Format fast path | `format()` numbers reflect en-locale fast path where applicable |
| Date | 2026-05-23 |

## Benchmark Files

| File | Purpose | Run command |
|------|---------|-------------|
| `bench/moment-compat.ts` | mmntjs vs moment.js — public table + detailed appendix | `bun run bench` |
| `bench/date-fns.ts` | mmntjs vs date-fns — semantically equivalent ops only | `bun run bench:date-fns` |
| `bench/temporal.ts` | mmntjs vs Temporal — PlainDateTime + ZonedDateTime | `node bench/temporal.ts` |
| `bench/cold.ts` | First-call latency — diagnostic only | `bun run bench:cold` |
| `bench/micro.ts` | Developer microbenchmarks — optimization workbench | `bun run bench:micro` |
| `bench/bench-suite.ts` | mmntjs vs date-fns suite using benchmark.js library | `bun run bench:suite` |
| `bench/bench-regression.ts` | Regression guard — negative-epoch UTC, parse growth, large month | `bun run bench:guard` |
| `bench/bench-mem.ts` | Memory footprint (heapUsed/rss) | `bun run bench:mem` |
| `bench/bench-setters-compare.ts` | Setter strategy comparison (Date.set* vs epoch delta vs arith+guard) | direct `bun` |
| `bench/bench-setter-ab.ts` | Micro A/B tests (typeof check, isInteger, hour() strategies) | direct `bun` |
| `bench/bench-lookup.ts` | Lookup latency guard (format token dispatch, timezone zone lookup, locale data access) | `bun run bench:guard` |
| `bench/bench-parse-eval.ts` | Parse-eval regression guard (ISO parse+format, array/object parse, chained ops) | `bun run bench:guard` |

## mmntjs vs moment.js — Public Table

```
Operation                              mmntjs     moment    ratio
moment()                                527ns      670ns     1.3x faster
moment(Date)                             94ns      345ns     3.7x faster
moment('ISO string')                    259ns     6.09us    23.3x faster
format('YYYY-MM-DD')                     91ns      445ns     4.9x faster
format('HH:mm:ss')                       55ns      499ns     9.0x faster
format('LL')                             58ns      541ns     9.3x faster
add(1,'day') [fresh]                    286ns     2.67us     9.3x faster
add(1,'month') [fresh]                  318ns     2.58us     8.1x faster
startOf('day') [fresh]                  189ns     2.13us    11.2x faster
startOf('month') [fresh]                400ns     2.00us     5.0x faster
diff('days')                             35ns      462ns    13.2x faster
diff('months')                           97ns     1.44us    14.9x faster
isBefore / isAfter / isSame              39ns      188ns     4.8x faster
startOf('month').endOf('month') [fresh] 479ns     2.15us     4.5x faster
```

`[fresh]` = fresh object created per iteration. Ratio = moment / mmntjs. Higher = mmntjs faster.

## Detailed Appendix

`bench/moment-compat.ts` still prints the full warm appendix, cold-path diagnostics, and first-call tables. Keep the CLI output as the source of truth for the long tail of rows; copy representative numbers into docs only when they are used in a public-facing argument.

## mmntjs vs date-fns

Only semantically equivalent operations are compared.

**Note:** date-fns operates on native Date utilities (immutable style), while mmntjs preserves Moment-compatible mutable object semantics. Each date-fns function creates a new Date instance; mmntjs mutates in-place. This structural difference means mmntjs pays object-creation cost for fresh-object workloads, which this benchmark uses for mutating operations.

Not compared: clone (no date-fns equivalent), locale-heavy Moment features, mutable chain semantics.

```
Operation                              mmntjs    date-fns    ratio
parse ISO string                         308ns      916ns   3.0x faster
moment() / new Date()                    143ns       35ns   4.1x slower
moment([y,M,d]) / new Date(y,m,d)        225ns       35ns   6.5x slower
format YYYY-MM-DD                         58ns     1.05us  18.0x faster
lightFormat YYYY-MM-DD                    50ns      556ns  11.2x faster
format HH:mm:ss                           90ns      856ns   9.5x faster
add 1 day [fresh]                        285ns       98ns   2.9x slower
add 1 month [fresh]                      329ns      194ns   1.7x slower
add 1 second [fresh]                     263ns      127ns   2.1x slower
add 1 ms [fresh]                         292ns      122ns   2.4x slower
sub 1 day [fresh]                        219ns      183ns   1.2x slower
isAfter                                   18ns      131ns   7.4x faster
isBefore                                  19ns      134ns   7.0x faster
diff in days                              22ns      805ns  35.9x faster
diff in months                            98ns      105ns   1.1x faster
startOf month [fresh]                    361ns      172ns   2.1x slower
startOf year [fresh]                     400ns      230ns   1.7x slower
startOf day [fresh]                      237ns       83ns   2.9x slower
endOf month [fresh]                      360ns      153ns   2.3x slower
dayOfYear                                 20ns     1.01us  49.7x faster
daysInMonth                                7ns      218ns  29.6x faster
isLeapYear                                 9ns       35ns   3.8x faster
set year [fresh]                         237ns      184ns   1.3x slower
set month [fresh]                        223ns      495ns   2.2x faster
set date [fresh]                         219ns       79ns   2.8x slower
set hour [fresh]                         216ns       83ns   2.6x slower
set minute [fresh]                       190ns       84ns   2.3x slower
set second [fresh]                       196ns       84ns   2.3x slower
set millisecond [fresh]                  204ns       82ns   2.5x slower
```

Ratio = date-fns / mmntjs. Higher = mmntjs faster.

Key observation: with fresh-object workloads, date-fns wins on operations where total cost is dominated by mmntjs's object construction overhead (`add`, `startOf`, setters on freshly parsed strings). mmntjs wins on read-heavy operations (format, diff, dayOfYear, daysInMonth) where its cached field access outperforms date-fns's native Date API calls.

### Why the object API loses some rows

These losses are structural — every `moment()` call constructs a wrapper object around a `Date` to preserve moment-compatible mutability, method chaining, `.fn`/`.prototype` extensibility, and locale context. `date-fns` operates on bare `Date` instances and avoids this cost entirely. The `[fresh]` marker in the table means a new wrapper is created and destroyed per iteration, which amplifies the overhead. Real applications often reuse Moment objects across many operations, amortizing the construction cost.

The standalone `mmntjs/fns` entry removes the wrapper layer entirely — it operates on plain `Date` objects and flips most losses to wins.

## mmntjs/fns vs date-fns

`bench/fns.ts` removes the Moment wrapper and compares plain Date helpers directly. With epoch-delta setter optimization applied, `mmntjs/fns` wins or ties every row against `date-fns`.

Representative rows:

```
Operation                              mmntjs/fns  date-fns   ratio
differenceInDays                            41ns     1.03us  25.0x faster
dayOfYear                                   55ns     1.11us  20.1x faster
format YYYY-MM-DD                          176ns     1.39us   7.9x faster
setMonth                                    92ns      466ns   5.0x faster
parse ISO string                           350ns      991ns   2.8x faster
setMinutes                                  41ns       71ns   1.7x faster
setHours                                    39ns       60ns   1.6x faster
setDate                                     60ns       63ns   1.1x faster
```

Setter rows use epoch delta arithmetic instead of `Date.set*()` calls, which avoids native setter overhead and flips the object API's setter losses into wins. See [`src/fns/_kernel.ts`](../src/fns/_kernel.ts) for implementation details.

The bundled size story for `mmntjs/fns` is also different: a single `format` import is about 507 B gzip, while `parseISO + format + addDays` is about 1.3 KB gzip.

## mmntjs vs Temporal

Temporal is designed for immutable correctness, not raw speed. Every operation allocates new objects; mmntjs mutates in-place. This is a design trade-off, not a benchmark contest.

**Note:** Temporal's strength is its semantic model, not raw speed. Results are shown for reference only.

### A) PlainDateTime (civil arithmetic)

Mutating operations use fresh objects per iteration — same methodology as the date-fns table above.

```
Operation                              mmntjs    Temporal   ratio
now (create)                            230ns      673ns   2.9x faster
parse date-only ISO                     394ns      177ns   2.2x slower
parse datetime ISO                      327ns      182ns   1.8x slower
parse [y,M,d]                           341ns      102ns   3.3x slower
get year                                  9ns       12ns   1.4x faster
get year+month+day (3 reads)             15ns       26ns   1.8x faster
add 1 day                               238ns      468ns   2.0x faster
add 1 month                             321ns      481ns   1.5x faster
add 1 day (immutable both)              378ns      469ns   1.2x faster
diff in days                             27ns      373ns  13.7x faster
toISOString                             249ns      338ns   1.4x faster
startOf month (mut vs immutable)        321ns      333ns   1.0x faster
daysInMonth (method vs property)         10ns       13ns   1.3x faster
set year                                246ns      271ns   1.1x faster
set month+day                           304ns      258ns   1.2x slower
```

### B) ZonedDateTime (timezone semantics)

```
Operation                              mmntjs    Temporal   ratio
parse ISO to zoned                      399ns      351ns   1.1x slower
add 1 day (zoned)                       372ns      606ns   1.6x faster
startOf day (zoned)                     468ns      297ns   1.6x slower
get offset string                        24ns       82ns   3.4x faster
```

Ratio = Temporal / mmntjs. Higher = mmntjs faster.

## Cross-reference: Benchmark evolution

Previous benchmark files (retained for reproducibility):

| Old file | Status | Replacement |
|----------|--------|-------------|
| `bench/bench.ts` | retained | split into `moment-compat.ts` + `cold.ts` + `micro.ts` |
| `bench/bench-datefns2.ts` | retained | replaced by `date-fns.ts` |
| `bench/bench-datefns.ts` | retained (early version) | superseded |
| `bench/bench-cold-warm.ts` | retained | superseded by `cold.ts` + `micro.ts` |
| `bench/bench-temporal.ts` | retained | replaced by `temporal.ts` |
