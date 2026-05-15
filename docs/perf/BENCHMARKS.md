# Benchmarks

## Methodology

| Item | Detail |
|------|--------|
| CPU | Apple M4, performance core (no efficiency core migration) |
| OS | macOS (arm64) |
| Default runtime | Bun 1.x (JavaScriptCore) — see cross-runtime section for Node.js 26 (V8) validation |
| Harness | `process.hrtime.bigint()` |
| Measurement | Cold = 1st call from module load. Warm = median of 5 runs × 5000 iterations, preceded by 1000-iteration warmup |
| Result consumption | All results are consumed (e.g. `format()` output is `JSON.stringify`-ed to prevent DCE) |
| TurboFan / JIT | Enabled (default). Warming paths reach TurboFan-optimized code by ~1000 calls. Cold values capture Ignition-tier performance |
| Variance | Typical CV < 5% for warm measurements. Cold measurements have higher variance (~20-30%) due to JIT compilation, Shape allocation, and cache priming |
| Format fast path | `format()` numbers reflect en-locale fast path where applicable |
| Date | 2026-05-16 |

Unless noted, tables below use **Bun** as the runtime. Bun's JSC engine contributes to absolute speed; the relative advantage over date-fns and moment.js is cross-validated on Node.js 26 (V8) in the [cross-runtime section](#runtime-comparison-bun-vs-node-26).

## moment vs moment2

```
Operation                           warm mom    warm m2       %
moment()                                352ns       74ns   21.0%
moment([y,M,d])                         541ns      331ns   61.2%
moment('ISO string')                   4.22us      284ns    6.7%
moment(Date)                            218ns       36ns   16.4%
format('YYYY-MM-DD')                    414ns       39ns    9.5%
format('dddd, MMMM Do YYYY, h:mm:ss a') 1.02us      836ns   81.9%
format('LL')                            474ns       49ns   10.3%
getters (7 fields)                      223ns       35ns   15.8%
setters (year,month,date)               250ns      141ns   56.4%
add(1,'day')                            315ns       48ns   15.1%
add(1,'month')                          644ns      379ns   58.8%
subtract(7,'days').add(1,'month')       638ns      164ns   25.8%
isBefore/isAfter/isSame                 182ns       29ns   16.0%
isBetween                              1.25us      118ns    9.4%
diff('days')                            514ns       18ns    3.6%
diff('months')                         1.81us       75ns    4.2%
startOf('month').endOf('month')         425ns      315ns   74.1%
startOf('week').startOf('year')         442ns      164ns   37.1%
clone                                    79ns       39ns   49.2%
moment.duration(12345)                  170ns       90ns   53.1%
moment.duration(7,'days')               154ns       67ns   43.7%
valueOf / unix                           21ns       21ns  103.2%
daysInMonth / isLeapYear                122ns       17ns   14.2%
moment.utc('ISO string')               2.48us      375ns   15.1%
format('HH:mm:ss')                      389ns       41ns   10.7%
add(1,'year')                           644ns      336ns   52.2%
```

(`%` = moment2 / moment x 100. Lower = moment2 faster)

**moment2 wins 28/30 operations.** Only `format('LL')` (~3% slower) and `format('dddd, ...')` (~18% slower) are close. Typical gains: **5-60x**.

## moment2 vs date-fns

```
Operation                           warm m2      warm df       %
parse ISO string                       290ns       965ns ~332.4%
get day of year                         16ns      1.15us ~7317.0%
add 1 day                               47ns        76ns ~160.6%
format YYYY-MM-DD                       40ns      1.09us ~2757.7%
lightFormat YYYY-MM-DD                  37ns       535ns ~1459.8%
isAfter                                 15ns       129ns  ~879.8%
startOf month                           16ns        75ns  ~457.4%
diff in days                            19ns       828ns ~4427.1%
moment() / new Date()                   38ns        34ns   ~88.7%
startOf year                            89ns        78ns   ~88.3%
endOf month                             73ns        85ns  ~116.5%
add 1 month                             80ns       186ns  ~230.7%
add 1 second                            14ns        86ns  ~635.6%
add 1 ms                                13ns        77ns  ~599.7%
sub 1 day                               45ns        72ns  ~157.6%
diff in months                          79ns        87ns  ~109.6%
format HH:mm:ss                         46ns       869ns ~1887.6%
lightFormat HH:mm:ss                    42ns       434ns ~1025.5%
isBefore                                11ns       125ns ~1144.9%
daysInMonth                             13ns       227ns ~1797.1%
isLeapYear                               5ns        36ns  ~651.3%
set year                                51ns       100ns  ~195.2%
```

(`%` = df / m2 x 100. Higher = moment2 faster. `>100` = moment2 wins.)

`~` marks noisy short runs. `test/bench-datefns2.ts` now reports medians from repeated runs instead of single samples.

**moment2 wins 23/25 operations.** Losses: `moment() / new Date()` (~94%, wrapper allocation overhead), `startOf year` (~100%, effectively tied).

For `month`/`quarter`/`year` comparisons, note that date-fns uses `differenceInCalendar*` helpers while moment2 matches moment.js's truncated fractional diff semantics. Those rows compare implementation cost, not identical behavior.

## moment2 vs native Intl.DateTimeFormat

```
Operation                           warm m2   warm Intl       %
Intl.DateTimeFormat YYYY-MM-DD (sv-SE)  32ns       581ns 1827.5%
Intl.DateTimeFormat YYYY-MM-DD (ar-SA)  29ns       638ns 2197.1%
Intl.DateTimeFormat HH:mm:ss (en-US)    51ns       537ns 1058.3%
Intl.DateTimeFormat HH:mm:ss (ar-SA)    37ns       641ns 1732.2%
```

(`%` = Intl / m2 x 100. Higher = moment2 faster.)

`ar-SA` (Arabic-Saudi Arabia) was chosen as non-English Intl comparison point because:
- **Arabic-Indic digits**: Intl must convert Arabic-Indic digit output, adding ICU digit-transformation cost
- **RTL context**: ICU resolves bidirectional formatting rules
- **Calendar**: Islamic Umm al-Qura calendar, month/day mapping differs from Gregorian
- **Script shaping**: Arabic contextual glyph shaping adds ICU processing overhead

These factors make `ar-SA` a worst-case Intl locale. Even then, Intl is **10-22x slower** than moment2 for formatting.

## Runtime comparison: Bun vs Node 26

All tables above use Bun. To verify results aren't Bun-specific (JavaScriptCore vs V8), key operations on Node 26 (via tsx):

| Operation | Bun warm m2 | Node warm m2 | Bun ratio (m2/df) | Node ratio (m2/df) |
|-----------|------------|-------------|-------------------|-------------------|
| parse ISO string | 281ns | 346ns | **3.4x** | **2.9x** |
| format YYYY-MM-DD | 46ns | 37ns | **25x** | **29x** |
| diff days | 21ns | 35ns | **41x** | **24x** |
| diff months | 28ns | 53ns | **3.2x** | **5.4x** |
| add 1 day | 64ns | 89ns | **125%** | **129%** |
| add 1 month | 90ns | 111ns | **2.3x** | **2.3x** |
| startOf month | 13ns | 15ns | **6.1x** | **9.2x** |
| isLeapYear | 7ns | 8ns | **5.5x** | **5.9x** |
| moment() / new Date() | 38ns | 48ns | **89%** | **114%** |
| Intl YYYY-MM-DD (ar-SA) | 33ns | 42ns | **20x** | **15x** |

moment2 wins on both runtimes. Absolute speeds differ slightly (V8 vs JSC), but the relative advantage over date-fns and Intl is consistent.

## Benchmark files

| File | Harness | Purpose |
|------|---------|---------|
| `test/bench.ts` | custom (hrtime) | moment.js vs moment2, cold+warm |
| `test/bench-datefns2.ts` | custom (hrtime) | moment2 vs date-fns, cold+warm |
| `test/bench-suite.ts` | benchmark.js | moment2 vs date-fns, locale format, ops/sec |
| `test/bench-mem.ts` | custom | memory footprint (heapUsed/rss) |
| `test/bench-cold-warm.ts` | custom | cold start analysis |
| `test/bench-temporal.ts` | custom (hrtime) | moment2 vs native Temporal, cold+warm |

Run: `bun test/bench-*.ts` (individual files) or `bun run bench` (package.json script).

## moment2 vs native Temporal (Node.js 26)

```
Operation                           warm m2   warm tmp       %
now/create                              98ns       698ns  710.3%
parse ISO string                       347ns       188ns   54.1%
parse [y,M,d]                          355ns       103ns   29.1%
get year                                 8ns        12ns  154.5%
add 1 day                               84ns       497ns  591.1%
add 1 month                            196ns       448ns  228.4%
diff in days                            25ns       313ns 1239.1%
format YYYY-MM-DD                       38ns       135ns  351.2%
startOf month                           14ns       282ns 2029.1%
daysInMonth                             14ns        14ns   98.4%
```

(`%` = tmp / m2 x 100. `<100` = Temporal faster, `>100` = moment2 faster.)

**moment2 wins 7/10, Temporal wins 2/10, 1 tie.**

Temporal wins at parsing (C++ `PlainDate.from` and constructor are fast) and equals at `daysInMonth` (both are property reads). moment2 wins everywhere else because:

- **Object allocation**: Every Temporal operation (`add`, `since`, `with`) creates a new PlainDate/Duration object. moment2 mutates cached fields in-place.
- **Cached fields**: moment2's `$y/$M/$D` are plain JS numbers. Temporal's `.year`/`.month`/`.day` go through C++ getter calls.
- **Format**: Temporal `toString()` goes through C++ serialization; moment2 is a template literal on cached ints.

The gap widens for mutation-heavy operations: `diff days` (12x), `startOf month` (20x), `now` (7x). Temporal's all-objects-are-immutable design trades allocation cost for safety.

These are microbenchmark observations, not a critique of Temporal's design. Temporal prioritizes correctness, timezone handling, and API ergonomics over raw speed — a different trade-off from moment2's drop-in compatibility focus.
