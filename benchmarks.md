# Benchmarks

## 2026-05-05

Environment:

- command: `bun test/bench.ts`
- command: `bun test/bench-datefns.ts`
- command: `bun test/bench-datefns2.ts`
- command: `bun --expose-gc test/bench-mem.ts`

### moment vs moment2

```text
Benchmark results (5000 iterations each):

┌──────────────────────────────────────────────┬────────────┬────────────┬────────┐
│ Operation                                    │ moment     │ moment2    │ %      │
├──────────────────────────────────────────────┼────────────┼────────────┼────────┤
│ moment()                                     │      480ns │      327ns │  68.1% │
│ moment([y,M,d])                              │     1.25μs │      554ns │  44.3% │
│ moment([y,M,d,h,m,s,ms])                     │      533ns │      804ns │ 151.0% │
│ moment('ISO string')                         │     5.56μs │     4.92μs │  88.4% │
│ moment(Date)                                 │      347ns │      229ns │  66.1% │
│ format('YYYY-MM-DD')                         │     1.31μs │      418ns │  31.8% │
│ format('dddd, MMMM Do YYYY, h:mm:ss a')      │     1.21μs │     1.92μs │ 158.2% │
│ format('LL')                                 │      522ns │      505ns │  96.7% │
│ getters (year,month,date,hour,min,sec,ms)    │      268ns │      223ns │  83.1% │
│ setters (year,month,date)                    │      418ns │      266ns │  63.7% │
│ add(1,'day')                                 │      660ns │      384ns │  58.2% │
│ add(1,'month')                               │     1.11μs │      696ns │  62.9% │
│ subtract(7,'days').add(1,'month')            │     1.21μs │     1.04μs │  86.2% │
│ isBefore/isAfter/isSame                      │      296ns │      195ns │  65.7% │
│ isBetween                                    │     1.54μs │     1.13μs │  73.3% │
│ diff('days')                                 │      720ns │      598ns │  83.1% │
│ diff('months')                               │     2.00μs │     2.09μs │ 104.2% │
│ startOf('month').endOf('month')              │      478ns │      672ns │ 140.7% │
│ startOf('week').startOf('year')              │      637ns │      412ns │  64.6% │
│ clone                                        │      259ns │      201ns │  77.6% │
│ moment.duration(12345)                       │      646ns │      278ns │  43.0% │
│ moment.duration(7,'days')                    │      155ns │      151ns │  97.5% │
│ valueOf / unix                               │       46ns │       39ns │  83.8% │
│ daysInMonth / isLeapYear                     │      133ns │      103ns │  77.0% │
└──────────────────────────────────────────────┴────────────┴────────────┴────────┘
```

### moment2 vs date-fns

```text
Benchmark results (5000 iterations each):

┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Operation                                    │ moment2    │ date-fns   │ %        │
│──────────────────────────────────────────────────────────────────────────────────────────┤
│ parse ISO string                             │     7.70μs │     1.65μs │  21.5% │
│ get day of year                              │      950ns │     3.56μs │ 375.2% │
│ add 1 day                                    │     1.13μs │      168ns │  14.9% │
│ format YYYY-MM-DD                            │      791ns │     1.40μs │ 177.6% │
│ isAfter                                      │      217ns │      190ns │  87.5% │
│ moment() / new Date()                        │      581ns │      128ns │  22.1% │
│ format long (dddd, MMMM Do YYYY)             │     1.55μs │     3.80μs │ 245.1% │
│ add 1 month                                  │     1.08μs │      129ns │  12.0% │
│ startOf('month')                             │      568ns │      304ns │  53.6% │
│ diff in days                                 │     1.95μs │      417ns │  21.3% │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### moment2 vs date-fns (alternate bench)

```text
Operation                           moment2    date-fns   %
parse ISO string                        5.39μs     1.02μs   18.9%
get day of year                          624ns     1.26μs  202.2%
add 1 day                                353ns       61ns   17.2%
format YYYY-MM-DD                        358ns     1.18μs  329.4%
isAfter                                   62ns      131ns  209.4%
startOf month                            119ns       97ns   81.1%
diff in days                             388ns      837ns  215.9%
moment() / new Date()                    218ns       34ns   15.6%
```

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
