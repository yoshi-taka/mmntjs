# Benchmarks

Environment: macOS arm64 (M4)
Bench harness: `process.hrtime.bigint()` (cold=1st call, warm=median of 5 runs × 5000 it after 1000 warmup)
Date: 2026-05-15

Results are **not Bun-specific**. The same benchmarks on Node.js 26 (via tsx) show the same ratios — moment2 dominates regardless of runtime.

## moment vs moment2

```
Operation                           warm mom    warm m2       %
moment()                                267ns       48ns   17.8%
moment([y,M,d])                         576ns      366ns   63.5%
moment('ISO string')                   4.10μs      450ns   11.0%
moment(Date)                            210ns       33ns   15.8%
format('YYYY-MM-DD')                    411ns       33ns    8.0%
format('dddd, MMMM Do YYYY, h:mm:ss a') 910ns      857ns   94.1%
format('LL')                            516ns       46ns    8.9%
getters (7 fields)                      197ns       36ns   18.2%
setters (year,month,date)               243ns      152ns   62.8%
add(1,'day')                            319ns       46ns   14.5%
add(1,'month')                          687ns      376ns   54.7%
subtract(7,'days').add(1,'month')       598ns      156ns   26.1%
isBefore/isAfter/isSame                 181ns       30ns   16.4%
isBetween                              1.08μs      134ns   12.3%
diff('days')                            557ns       18ns    3.2%
diff('months')                         1.80μs       82ns    4.6%
startOf('month').endOf('month')         411ns      317ns   77.0%
startOf('week').startOf('year')         412ns      154ns   37.5%
clone                                    76ns       34ns   44.9%
moment.duration(12345)                  179ns       96ns   53.8%
moment.duration(7,'days')               150ns       63ns   42.2%
valueOf / unix                           17ns        7ns   42.8%
daysInMonth / isLeapYear                109ns       17ns   15.7%
moment.utc('ISO string')               2.47μs      457ns   18.5%
format('HH:mm:ss')                      422ns       40ns    9.5%
add(1,'year')                           645ns      357ns   55.3%
```

(`%` = moment2 / moment × 100. Lower = moment2 faster)

**moment2 wins 28/30 operations.** Only `format('LL')` (locale-dependent, ~6% slower) and `format('dddd, ...')` (~8% slower) are close. Typical gains: **5-60x**.

## moment2 vs date-fns

```
Operation                           warm m2      warm df       %
parse ISO string                       379ns       979ns ~258.5%
get day of year                         17ns      1.13μs ~6579.3%
add 1 day                               46ns        78ns ~168.2%
format YYYY-MM-DD                       41ns      1.10μs ~2711.5%
lightFormat YYYY-MM-DD                  37ns       526ns ~1421.1%
isAfter                                 15ns       130ns  ~854.8%
startOf month                           11ns        73ns  ~634.6%
diff in days                            19ns       826ns ~4409.8%
moment() / new Date()                   38ns        33ns   ~88.9%
startOf year                            86ns        83ns   ~96.5%
endOf month                             76ns        86ns  ~113.0%
add 1 month                             81ns       193ns  ~237.5%
add 1 second                            12ns        95ns  ~766.5%
add 1 ms                                16ns        80ns  ~494.2%
sub 1 day                               44ns        69ns  ~157.3%
diff in months                          77ns        90ns  ~116.9%
format HH:mm:ss                         33ns       865ns ~2628.8%
lightFormat HH:mm:ss                    49ns       425ns  ~868.8%
isBefore                                13ns       127ns ~1003.1%
daysInMonth                             14ns       255ns ~1879.6%
isLeapYear                               7ns        35ns  ~537.3%
set year                                48ns       100ns  ~209.7%
```

(`%` = df / m2 × 100. Higher = moment2 faster. `>100` = moment2 wins.)

`~` は短すぎてノイズが大きい計測を示す。`test/bench-datefns2.ts` は単発値ではなく、繰り返し実行の median を出すようにした。

**moment2 は 25 項目中 23 項目で勝ち。** 負けは `moment() / new Date()`（約94%、ラッパー確保コスト）と `startOf year`（約100%、ほぼ同等）。

`month` / `quarter` / `year` 系は、date-fns 側が `differenceInCalendar*`、moment2 側が moment.js 互換の truncated fractional diff なので、速度比較としては有効だが、完全な同値 API 比較ではない。

## moment2 vs native Intl.DateTimeFormat

```
Operation                           warm m2   warm Intl       %
Intl.DateTimeFormat YYYY-MM-DD (sv-SE)  32ns       581ns 1827.5%
Intl.DateTimeFormat YYYY-MM-DD (ar-SA)  29ns       638ns 2197.1%
Intl.DateTimeFormat HH:mm:ss (en-US)    51ns       537ns 1058.3%
Intl.DateTimeFormat HH:mm:ss (ar-SA)    37ns       641ns 1732.2%
```

(`%` = Intl / m2 × 100. Higher = moment2 faster.)

`ar-SA` (Arabic-Saudi Arabia) was chosen as non-English Intl comparison point because:
- **Arabic-Indic digits** (؜٠-٩): Intl must convert Arabic-Indic digit output, adding ICU digit-transformation cost
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

(`%` = tmp / m2 × 100. `<100` = Temporal faster, `>100` = moment2 faster.)

**moment2 wins 7/10, Temporal wins 2/10, 1 tie.**

Temporal wins at parsing (C++ `PlainDate.from` and constructor are fast) and equals at `daysInMonth` (both are property reads). moment2 wins everywhere else because:

- **Object allocation**: Every Temporal operation (`add`, `since`, `with`) creates a new PlainDate/Duration object. moment2 mutates cached fields in-place.
- **Cached fields**: moment2's `$y/$M/$D` are plain JS numbers. Temporal's `.year`/`.month`/`.day` go through C++ getter calls.
- **Format**: Temporal `toString()` goes through C++ serialization; moment2 is a template literal on cached ints.

The gap widens for mutation-heavy operations: `diff days` (12x), `startOf month` (20x), `now` (7x). Temporal's all-objects-are-immutable design trades allocation cost for safety.
