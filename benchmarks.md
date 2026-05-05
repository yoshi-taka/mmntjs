# Benchmarks

## 2026-05-05 (corrected)

**IMPORTANT:** Previous benchmark results (below this section) were incorrect because `import moment2 from "../moment"` resolved to the original moment.js library, not moment2. Benchmarks have been fixed to use `"../moment2"` for moment2 imports.

Environment: `bun` v1.3.13, macOS arm64

### moment vs moment2

```text
Benchmark results (5000 iterations each, median of 5 runs):

Operation                           moment     moment2    %
moment()                             288ns      217ns   75.1%
moment([y,M,d])                      470ns      321ns   68.4%
moment('ISO string')                4.11μs      332ns    8.1%
format('YYYY-MM-DD')                 375ns       30ns    8.0%
getters (7 fields)                   248ns       26ns   10.5%
valueOf / unix                        19ns       10ns   50.5%
clone                                 69ns       51ns   73.3%
```

moment2 is **5-12x faster** than original moment.js for parsing, formatting, and getters.

### moment2 vs date-fns

```text
Operation                           moment2    date-fns   %
parse ISO string                       328ns      950ns  289.1%  WIN
get day of year                          11ns     1.23μs  11702%  WIN
add 1 day                                96ns       60ns   63.3%  LOSE
format YYYY-MM-DD                        38ns     1.13μs   2973%  WIN
isAfter                                  16ns      131ns  820.9%  WIN
startOf month                            21ns      101ns  472.4%  WIN
diff in days                             19ns      788ns   4088%  WIN
moment() / new Date()                    59ns       37ns   62.6%  LOSE
```

**moment2 wins 6/8 benchmarks** against date-fns.

| Benchmark | Winner | Margin |
|-----------|--------|--------|
| parse ISO string | moment2 | **2x faster** |
| get day of year | moment2 | **123x faster** (cached field) |
| add 1 day | date-fns | 2x slower (wrapper overhead) |
| format YYYY-MM-DD | moment2 | **31x faster** |
| isAfter | moment2 | **8x faster** |
| startOf month | moment2 | **3.4x faster** |
| diff in days | moment2 | **40x faster** |
| moment() / new Date() | date-fns | 3.9x slower (wrapper overhead) |

### Loss analysis

The 2 losses are structural — Moment is a wrapper class around Date:
- `moment()` (52ns vs 33ns): Creating a Moment requires property init, locale lookup, and lazy field init overhead. Plain `new Date()` is native.
- `add(1, 'day')` (95ns vs 58ns): date-fns `addDays` returns a new Date. moment2 mutates + refreshes cached fields.

These gaps are irreducible without abandoning the Moment API compatibility.

### Full benchmark (moment vs moment2, single run)

```text
┌──────────────────────────────────────────────┬────────────┬────────────┬────────┐
│ Operation                                    │ moment     │ moment2    │ %      │
├──────────────────────────────────────────────┼────────────┼────────────┼────────┤
│ moment()                                     │      503ns │      410ns │  81.6% │
│ moment([y,M,d])                              │      866ns │      723ns │  83.6% │
│ moment([y,M,d,h,m,s,ms])                     │      556ns │      540ns │  97.2% │
│ moment('ISO string')                         │     5.26μs │      928ns │  17.6% │
│ moment(Date)                                 │      352ns │      256ns │  72.9% │
│ format('YYYY-MM-DD')                         │      593ns │      146ns │  24.6% │
│ format('dddd, MMMM Do YYYY, h:mm:ss a')      │     1.42μs │     1.71μs │ 120.2% │
│ format('LL')                                 │      681ns │      824ns │ 121.0% │
│ getters (year,month,date,hour,min,sec,ms)    │      362ns │       56ns │  15.5% │
│ setters (year,month,date)                    │      401ns │      352ns │  87.7% │
│ add(1,'day')                                 │      592ns │      254ns │  42.9% │
│ add(1,'month')                               │      852ns │      274ns │  32.2% │
│ subtract(7,'days').add(1,'month')            │     1.46μs │      370ns │  25.3% │
│ isBefore/isAfter/isSame                      │      345ns │      119ns │  34.5% │
│ isBetween                                    │     1.72μs │      250ns │  14.5% │
│ diff('days')                                 │      920ns │       88ns │   9.6% │
│ diff('months')                               │     2.11μs │      487ns │  23.0% │
│ startOf('month').endOf('month')              │      458ns │      527ns │ 115.0% │
│ startOf('week').startOf('year')              │      504ns │      279ns │  55.3% │
│ clone                                        │      102ns │      163ns │ 159.0% │
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
