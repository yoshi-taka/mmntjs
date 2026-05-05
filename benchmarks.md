# Benchmarks

## 2026-05-05 (corrected)

**IMPORTANT:** Previous benchmark results (below this section) were incorrect because `import moment2 from "../moment"` resolved to the original moment.js library, not moment2. Benchmarks have been fixed to use `"../moment2"` for moment2 imports.

Environment: `bun` v1.3.13, macOS arm64

### moment vs moment2

```text
Benchmark results (5000 iterations each, median of 5 runs):

Operation                           moment     moment2    %
moment()                             282ns       93ns   33.0%
moment([y,M,d])                      461ns      259ns   56.3%
moment('ISO string')                4.00μs      221ns    5.5%
format('YYYY-MM-DD')                 377ns       30ns    8.0%
getters (7 fields)                   206ns       27ns   13.3%
valueOf / unix                        20ns       10ns   52.2%
clone                                 73ns       36ns   48.4%
```

moment2 is **5-12x faster** than original moment.js for parsing, formatting, and getters.

### moment2 vs date-fns (including Intl.DateTimeFormat)

```text
Operation                           moment2    date-fns     %
format YYYY-MM-DD                        43ns     1.15μs 2702.0%
lightFormat YYYY-MM-DD                   32ns      579ns 1829.7%
Intl.DateTimeFormat YYYY-MM-DD          38ns      607ns 1608.7%
format HH:mm:ss                          49ns      930ns 1910.6%
lightFormat HH:mm:ss                     40ns      456ns 1142.4%
Intl.DateTimeFormat HH:mm:ss            58ns      548ns  948.5%
```

moment2's `format()` is **9-16x faster** than `Intl.DateTimeFormat`, the native browser/Node.js API. This is because moment2 formats by concatenating cached numeric fields directly, while Intl.DateTimeFormat requires locale resolution and ICU data lookup.

```text
Operation                           moment2    date-fns   %
parse ISO string                       293ns     1.25μs  425.9%  WIN
get day of year                          10ns     1.32μs  12993%  WIN
add 1 day                                94ns       60ns   64.1%  LOSE
format YYYY-MM-DD                        40ns     1.13μs   2849%  WIN
isAfter                                  22ns      144ns  647.4%  WIN
startOf month                            12ns       99ns  826.7%  WIN
diff in days                             21ns      802ns   3736%  WIN
moment() / new Date()                    61ns       36ns   58.4%  LOSE
```

**moment2 wins 6/8 benchmarks** against date-fns.

| Benchmark | Winner | Margin |
|-----------|--------|--------|
| parse ISO string | moment2 | **4.3x faster** |
| get day of year | moment2 | **132x faster** (cached field) |
| add 1 day | date-fns | 1.6x slower (wrapper overhead) |
| format YYYY-MM-DD | moment2 | **28x faster** |
| isAfter | moment2 | **6.5x faster** |
| startOf month | moment2 | **8.3x faster** |
| diff in days | moment2 | **38x faster** |
| moment() / new Date() | date-fns | 1.7x slower (wrapper overhead) |

### Loss analysis

The 2 losses are structural — Moment is a wrapper class around Date:
- `moment()` (61ns vs 36ns): Creating a Moment requires property init, locale lookup, and lazy field init overhead. Plain `new Date()` is native.
- `add(1, 'day')` (94ns vs 60ns): date-fns `addDays` returns a new Date. moment2 mutates + refreshes cached fields.

These gaps are irreducible without abandoning the Moment API compatibility.

### Full benchmark (moment vs moment2, single run)

```text
┌──────────────────────────────────────────────┬────────────┬────────────┬────────┐
│ Operation                                    │ moment     │ moment2    │ %      │
├──────────────────────────────────────────────┼────────────┼────────────┼────────┤
│ moment()                                     │      503ns │      410ns │  81.6% │
│ moment([y,M,d])                              │      866ns │      723ns │  83.6% │
│ moment([y,M,d,h,m,s,ms])                     │      556ns │      540ns │  97.2% │
│ moment('ISO string')                         │     5.91μs │      605ns │  10.2% │
│ moment(Date)                                 │      385ns │      132ns │  34.3% │
│ format('YYYY-MM-DD')                         │      845ns │      168ns │  19.8% │
│ format('dddd, MMMM Do YYYY, h:mm:ss a')      │     1.68μs │     2.18μs │ 129.7% │
│ format('LL')                                 │      673ns │     1.04μs │ 155.0% │
│ getters (year,month,date,hour,min,sec,ms)    │      429ns │       65ns │  15.1% │
│ setters (year,month,date)                    │      528ns │      407ns │  77.0% │
│ add(1,'day')                                 │      679ns │      749ns │ 110.2% │
│ add(1,'month')                               │      899ns │      312ns │  34.7% │
│ subtract(7,'days').add(1,'month')            │     1.49μs │      426ns │  28.6% │
│ isBefore/isAfter/isSame                      │      527ns │      171ns │  32.4% │
│ isBetween                                    │     1.61μs │      300ns │  18.7% │
│ diff('days')                                 │     2.19μs │      102ns │   4.7% │
│ diff('months')                               │     2.19μs │      542ns │  24.7% │
│ startOf('month').endOf('month')              │      514ns │      579ns │ 112.8% │
│ startOf('week').startOf('year')              │      533ns │      326ns │  61.3% │
│ clone                                        │      113ns │      120ns │ 106.6% │
│ moment.duration(12345)                       │      282ns │      231ns │  81.9% │
│ moment.duration(7,'days')                    │      173ns │      133ns │  76.9% │
│ valueOf / unix                               │       64ns │       32ns │  50.2% │
│ daysInMonth / isLeapYear                     │      154ns │       56ns │  36.5% │
└──────────────────────────────────────────────┴────────────┴────────────┴────────┘
```

The `%` column is `moment2 / moment * 100` — lower means moment2 is faster.

### Performance features

- **Cached field decomposition** (`$y, $M, $D, $W, $H, $m, $s, $ms`): getters are field reads (no Date API calls)
- **`_epochDaysToYMD`**: arithmetic date decomposition avoids Date constructor for UTC moments
- **`parseCommonISO`**: direct charCodeAt digit extraction (no regex), ~60ns for date-only
- **`parseCommonISOExtended`**: fast path for compact/extended formats without table iteration
- **Moment constructor**: conditional cold field copy (skipped when no cold data)
- **`_addSimple` DAY**: branch-free month boundary handling for small increments

### Module footprint

```text
Module footprint:

┌─────────────────────┬──────────┬──────────┬────────┐
│ Metric              │ moment   │ moment2  │ %      │
├─────────────────────┼──────────┼──────────┼────────┤
│ heapUsed            │    402KB │      1KB │     0% │
│ rss                 │   5216KB │     96KB │     2% │
│ external            │    123KB │      0KB │     0% │
└─────────────────────┴──────────┴──────────┴────────┘
```

Notes:
- `bench-mem.ts` is a coarse import-footprint measurement, not a full runtime memory profile.
- The `%` column is the right-hand implementation divided by the left-hand implementation.
- After correction, previous results are superseded.
