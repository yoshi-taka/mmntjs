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
parse ISO string                         317ns     1.26us   4.0x faster
moment() / new Date()                    199ns       36ns   5.5x slower
moment([y,M,d]) / new Date(y,m,d)        358ns       44ns   8.2x slower
format YYYY-MM-DD                         63ns     1.55us  24.4x faster
lightFormat YYYY-MM-DD                    75ns      573ns   7.6x faster
format HH:mm:ss                           73ns     1.04us  14.2x faster
add 1 day [fresh]                        387ns       93ns   4.2x slower
add 1 month [fresh]                      331ns      202ns   1.6x slower
add 1 second [fresh]                     269ns      144ns   1.9x slower
add 1 ms [fresh]                         288ns      123ns   2.3x slower
sub 1 day [fresh]                        229ns      190ns   1.2x slower
isAfter                                   18ns      131ns   7.3x faster
isBefore                                  19ns      127ns   6.7x faster
diff in days                              22ns      872ns  40.3x faster
diff in months                            98ns      114ns   1.2x faster
startOf month [fresh]                    384ns      172ns   2.2x slower
startOf year [fresh]                     407ns      246ns   1.7x slower
startOf day [fresh]                      308ns       87ns   3.6x slower
endOf month [fresh]                      392ns      158ns   2.5x slower
dayOfYear                                 25ns     1.04us  40.7x faster
daysInMonth                                8ns      228ns  29.6x faster
isLeapYear                                 9ns       36ns   4.1x faster
set year [fresh]                         255ns      188ns   1.4x slower
set month [fresh]                        224ns      506ns   2.3x faster
set date [fresh]                         217ns       84ns   2.6x slower
set hour [fresh]                         204ns       88ns   2.3x slower
set minute [fresh]                       207ns       90ns   2.3x slower
set second [fresh]                       196ns       85ns   2.3x slower
set millisecond [fresh]                  210ns       85ns   2.5x slower
```

Ratio = date-fns / mmntjs. Higher = mmntjs faster.

Key observation: with fresh-object workloads, date-fns wins on operations where total cost is dominated by mmntjs's object construction overhead (`add`, `startOf`, setters on freshly parsed strings). mmntjs wins on read-heavy operations (format, diff, dayOfYear, daysInMonth) where its cached field access outperforms date-fns's native Date API calls.

## mmntjs/fns vs date-fns

`bench/fns.ts` removes the Moment wrapper and compares plain Date helpers directly. In the current run, `mmntjs/fns` wins 19 of 26 rows.

Representative rows:

```
Operation                              mmntjs/fns  date-fns   ratio
parse ISO string                           487ns     1.89us   3.9x faster
format YYYY-MM-DD                          470ns     3.12us   6.6x faster
addMonths +1                               95ns       278ns   2.9x faster
differenceInDays                           59ns       966ns  16.3x faster
dayOfYear                                 128ns      1.80us  14.1x faster
startOfDay                                309ns        61ns   5.1x slower
setSeconds                                339ns        69ns   4.9x slower
```

The bundled size story for `mmntjs/fns` is also different: a single `format` import is about 507 B gzip, while `parseISO + format + addDays` is about 1.3 KB gzip.

## mmntjs vs Temporal

Temporal prioritizes immutable correctness and semantic richness. Every Temporal operation creates new objects; mmntjs mutates in-place. This comparison is informative, not adversarial.

**Note:** Temporal's strength is its semantic model, not raw speed. Results are shown for reference only.

### A) PlainDateTime (civil arithmetic)

```
Operation                              mmntjs    Temporal   ratio
now (create)                            262ns     1.25us   4.8x faster
parse date-only ISO                     584ns      175ns   3.3x slower
parse datetime ISO                      412ns      183ns   2.3x slower
parse [y,M,d]                           769ns      653ns   1.2x slower
get year                                 10ns       12ns   1.2x faster
get year+month+day (3 reads)             36ns       70ns   1.9x faster
add 1 day                                56ns      533ns   9.6x faster
add 1 month                             385ns      568ns   1.5x faster
add 1 day (immutable both)              458ns      498ns   1.1x faster
diff in days                             72ns     1.41us  19.7x faster
toISOString                             940ns     1.64us   1.7x faster
startOf month (mut vs immutable)         11ns      276ns  26.2x faster
daysInMonth (method vs property)         35ns       14ns   2.5x slower
set year                                329ns      367ns   1.1x faster
set month+day                           326ns      281ns   1.2x slower
```

### B) ZonedDateTime (timezone semantics)

```
Operation                              mmntjs    Temporal   ratio
parse ISO to zoned                      431ns      370ns   1.2x slower
add 1 day (zoned)                       414ns      650ns   1.6x faster
startOf day (zoned)                     575ns      307ns   1.9x slower
get offset string                        20ns       86ns   4.2x faster
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
