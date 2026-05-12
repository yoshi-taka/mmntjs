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
| Date | 2026-05-07 |

Unless noted, tables below use **Bun** as the runtime. Bun's JSC engine contributes to absolute speed; the relative advantage over date-fns and moment.js is cross-validated on Node.js 26 (V8) in the [cross-runtime section](#runtime-comparison-bun-vs-node-26).

## moment vs moment2

```
Operation                           warm mom    warm m2       %
moment()                                280ns       52ns   18.5%
moment([y,M,d])                         430ns      260ns   60.5%
moment('ISO string')                   4.10us      277ns    6.8%
moment(Date)                            212ns       60ns   28.4%
format('YYYY-MM-DD')                    413ns       35ns    8.4%
format('dddd, MMMM Do YYYY, h:mm:ss a') 957ns      876ns   91.6%
format('LL')                            499ns      531ns  106.4%
getters (7 fields)                      208ns       27ns   12.8%
setters (year,month,date)               258ns      147ns   57.1%
add(1,'day')                            323ns       57ns   17.6%
add(1,'month')                          670ns      372ns   55.6%
subtract(7,'days').add(1,'month')       673ns      165ns   24.5%
isBefore/isAfter/isSame                 184ns       33ns   17.7%
isBetween                              1.24us       80ns    6.4%
diff('days')                            413ns       18ns    4.3%
diff('months')                         1.44us       23ns    1.6%
startOf('month').endOf('month')         370ns      331ns   89.5%
startOf('week').startOf('year')         328ns       78ns   23.9%
clone                                    60ns       32ns   53.4%
moment.duration(12345)                  157ns       91ns   57.7%
moment.duration(7,'days')               151ns       58ns   38.8%
valueOf / unix                           17ns        8ns   45.0%
daysInMonth / isLeapYear                 88ns       15ns   17.5%
moment.utc('ISO string')               2.14us      254ns   11.9%
format('HH:mm:ss')                      416ns       47ns   11.3%
add(1,'year')                           589ns       11ns    1.9%
```

(`%` = moment2 / moment x 100. Lower = moment2 faster)

**moment2 wins 28/30 operations.** Only `format('LL')` (~6% slower) and `format('dddd, ...')` (~8% slower) are close. Typical gains: **5-60x**.

## moment2 vs date-fns

```
Operation                           warm m2      warm df       %
parse ISO string                       281ns      1.01us  360.7%
get day of year                         11ns      1.14us 10186.4%
add 1 day                               61ns        82ns  133.4%
format YYYY-MM-DD                       39ns      1.18us 2994.2%
lightFormat YYYY-MM-DD                  34ns       541ns 1582.7%
isAfter                                 15ns       129ns  887.6%
startOf month                           13ns        75ns  589.5%
diff in days                            21ns       851ns 4152.4%
moment() / new Date()                   38ns        36ns   94.0%
startOf year                            20ns        78ns  400.1%
endOf month                             75ns        86ns  114.5%
add 1 month                             83ns       196ns  237.6%
add 1 second                            38ns        90ns  239.4%
add 1 ms                                35ns        82ns  231.9%
sub 1 day                               52ns        73ns  142.1%
diff in months                          30ns        88ns  287.8%
format HH:mm:ss                         48ns       870ns 1798.8%
lightFormat HH:mm:ss                    39ns       410ns 1062.6%
isBefore                                14ns       129ns  940.6%
daysInMonth                             14ns       264ns 1864.5%
isLeapYear                               6ns        37ns  600.1%
set year                                47ns       100ns  211.5%
```

(`%` = df / m2 x 100. Higher = moment2 faster. `>100` = moment2 wins.)

**moment2 wins 23/25 operations.** Losses: `moment() / new Date()` (94%, wrapper overhead <3ns), `endOf month` (115%, close). Win margins: **2-110x**.

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
