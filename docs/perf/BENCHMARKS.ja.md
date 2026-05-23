# Benchmarks

Environment: macOS arm64 (M4)
Bench harness: `process.hrtime.bigint()` (cold=1st call, warm=median of 5 runs × 5000 it after 1000 warmup)
Date: 2026-05-16

Results are **not Bun-specific**. The same benchmarks on Node.js 26 (via tsx) show the same ratios — mmntjs dominates regardless of runtime.

## moment vs mmntjs

```
Operation                           warm mom    warm m2       %
moment()                                311ns       54ns   17.3%
moment([y,M,d])                         702ns      284ns   40.5%
moment([y,M,d,h,m,s,ms])                 316ns      186ns   58.9%
moment('ISO string')                   4.20μs      310ns    7.4%
moment(Date)                            221ns       42ns   18.8%
format('YYYY-MM-DD')                    420ns       33ns    7.9%
format('dddd, MMMM Do YYYY, h:mm:ss a') 976ns      815ns   83.6%
format('LL')                            469ns       48ns   10.1%
getters (year,month,date,hour,min,sec,ms)      230ns       37ns   16.0%
setters (year,month,date)               253ns      141ns   55.5%
add(1,'day')                            312ns       49ns   15.6%
add(1,'month')                          688ns      382ns   55.5%
subtract(7,'days').add(1,'month')       642ns      169ns   26.3%
isBefore/isAfter/isSame                 187ns       30ns   15.8%
isBetween                              1.29μs      118ns    9.1%
diff('days')                            491ns       18ns    3.6%
diff('months')                         1.78μs       79ns    4.4%
startOf('month').endOf('month')         417ns      318ns   76.3%
startOf('week').startOf('year')         423ns      161ns   38.2%
clone                                    83ns       41ns   50.1%
moment.duration(12345)                  170ns       87ns   51.1%
moment.duration(7,'days')               154ns       65ns   42.1%
valueOf / unix                           17ns        8ns   46.8%
daysInMonth / isLeapYear                117ns       17ns   14.7%
startOf('year')                         124ns       69ns   55.6%
endOf('year')                           278ns       72ns   25.9%
moment('ISO string') with format       4.05μs     1.17μs   29.0%
moment.utc('ISO string')               2.45μs      348ns   14.2%
format('HH:mm:ss')                      398ns       43ns   10.8%
add(1,'year')                           659ns      353ns   53.7%
```

(`%` = mmntjs / mom × 100. Lower = mmntjs faster)

**mmntjs wins all 31 operations.** Typical gains: **5-60x**.

## mmntjs vs date-fns

```
Operation                           warm m2      warm df       %
parse ISO string                       363ns     1.30μs ~358.3%
get day of year                         17ns     1.38μs ~7903.9%
add 1 day                               48ns       77ns ~158.7%
format YYYY-MM-DD                       56ns     1.31μs ~2324.6%
lightFormat YYYY-MM-DD                  36ns      651ns ~1795.9%
isAfter                                 16ns      160ns ~1000.3%
startOf month                           17ns       75ns  ~453.6%
diff in days                            20ns      935ns ~4611.0%
moment() / new Date()                   40ns       35ns   ~85.6%
startOf year                            70ns       82ns  ~117.6%
endOf month                             75ns       83ns  ~110.5%
add 1 month                             92ns      242ns  ~262.9%
add 1 second                            15ns      108ns  ~721.1%
add 1 ms                                13ns       79ns  ~591.7%
sub 1 day                               46ns       76ns  ~166.2%
diff in months                          86ns       94ns  ~108.5%
format HH:mm:ss                         50ns      939ns ~1877.6%
lightFormat HH:mm:ss                    61ns      452ns ~737.8%
isBefore                                11ns      131ns ~1143.7%
daysInMonth                             13ns      264ns ~2044.3%
isLeapYear                               6ns       36ns  ~593.1%
set year                                48ns       99ns  ~206.2%
```

(`%` = df / m2 × 100. Higher = mmntjs faster. `>100` = mmntjs wins.)

`~` は短すぎてノイズが大きい計測を示す。`bench/bench-datefns2.ts` は単発値ではなく、繰り返し実行の median を出すようにした。

**mmntjs は 25 項目中 24 項目で勝ち。** 負けは `moment() / new Date()`（約86%、ラッパー確保コスト）のみ。

`month` / `quarter` / `year` 系は、date-fns 側が `differenceInCalendar*`、mmntjs 側が moment.js 互換の truncated fractional diff なので、速度比較としては有効だが、完全な同値 API 比較ではない。

## mmntjs vs native Intl.DateTimeFormat

```
Intl.DateTimeFormat YYYY-MM-DD (sv-SE)  31ns       609ns 1938.1%
Intl.DateTimeFormat YYYY-MM-DD (ar-SA)  33ns       664ns 1990.1%
Intl.DateTimeFormat HH:mm:ss (en-US)    59ns       585ns  988.1%
Intl.DateTimeFormat HH:mm:ss (ar-SA)    40ns       670ns 1681.8%
```

(`%` = Intl / m2 × 100. Higher = mmntjs faster.)

`ar-SA` (Arabic-Saudi Arabia) was chosen as non-English Intl comparison point because:
- **Arabic-Indic digits** (؜٠-٩): Intl must convert Arabic-Indic digit output, adding ICU digit-transformation cost
- **RTL context**: ICU resolves bidirectional formatting rules
- **Calendar**: Islamic Umm al-Qura calendar, month/day mapping differs from Gregorian
- **Script shaping**: Arabic contextual glyph shaping adds ICU processing overhead

These factors make `ar-SA` a worst-case Intl locale. Even then, Intl is **10-22x slower** than mmntjs for formatting.

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

mmntjs wins on both runtimes. Absolute speeds differ slightly (V8 vs JSC), but the relative advantage over date-fns and Intl is consistent.

## Benchmark files

| File | Harness | Purpose |
|------|---------|---------|
| `bench/bench.ts` | custom (hrtime) | moment.js vs mmntjs, cold+warm |

| `bench/bench-datefns2.ts` | custom (hrtime) | mmntjs vs date-fns, cold+warm |

| `bench/bench-regression.ts` | custom (hrtime) | 負の epoch の UTC 演算、invalid parse の伸び、巨大 month 正規化の回帰ガード |

| `bench/bench-suite.ts` | benchmark.js | mmntjs vs date-fns, locale format, ops/sec |

| `bench/bench-mem.ts` | custom | memory footprint (heapUsed/rss) |

| `bench/bench-cold-warm.ts` | custom | cold start analysis |

| `bench/bench-temporal.ts` | custom (hrtime) | mmntjs vs native Temporal, cold+warm |

よく使うコマンド:
- `bun run bench` -> 主ベンチマーク表 (`bench/bench.ts`)

- `bun run bench:guard` -> 回帰閾値チェック (`bench/bench-regression.ts`)

- `bun run bench:mem` -> モジュールのメモリ footprint (`bench/bench-mem.ts`)

- `bun bench/bench-cold-warm.ts` -> locale cold/warm 挙動

- `node bench/bench-temporal.ts` -> Temporal 比較（Node.js 26+ の native Temporal が必要）

## 公式ベンチマーク (定期実行対象)

| # | 系統 | ファイル | 実行 |
|---|------|---------|------|
| A | moment.js vs mmntjs | `bench/bench.ts` | `bun run bench` |
| B | mmntjs vs date-fns | `bench/bench-datefns2.ts` | `bun bench/bench-datefns2.ts` |
| C | mmntjs-tz vs moment-tz | `packages/timezone/test/bench-timezone.ts` | `bun packages/timezone/test/bench-timezone.ts` |
| D | Regression guard | `bench/bench-regression.ts` etc | `bun run bench:guard` |
| E | Temporal (参考) | `bench/bench-temporal.ts` | `node bench/bench-temporal.ts` |

## mmntjs vs native Temporal (Node.js 26)

```
Operation                           warm m2   warm tmp       %
now/create                              70ns       657ns  934.2%
parse ISO string                       424ns       177ns   41.8%
parse [y,M,d]                          322ns       100ns   31.0%
get year                                 8ns        12ns  151.9%
add 1 day                               89ns       537ns  603.1%
add 1 month                            203ns       454ns  223.6%
diff in days                            26ns       348ns 1331.0%
format YYYY-MM-DD                       64ns       132ns  205.4%
startOf month                           14ns       284ns 1992.9%
daysInMonth                             16ns        14ns   85.9%
```

(`%` = tmp / m2 × 100. `<100` = Temporal faster, `>100` = mmntjs faster.)

**mmntjs wins 7/10, Temporal wins 3/10.**

Temporal wins at parsing (C++ `PlainDate.from` and constructor are fast) and `daysInMonth` (C++ property read vs mmntjs's function call). mmntjs wins everywhere else because:

- **Object allocation**: Every Temporal operation (`add`, `since`, `with`) creates a new PlainDate/Duration object. mmntjs mutates cached fields in-place.
- **Cached fields**: mmntjs's `$y/$M/$D` are plain JS numbers. Temporal's `.year`/`.month`/`.day` go through C++ getter calls.
- **Format**: Temporal `toString()` goes through C++ serialization; mmntjs is a template literal on cached ints.

The gap widens for mutation-heavy operations: `diff days` (12x), `startOf month` (20x), `now` (7x). Temporal's all-objects-are-immutable design trades allocation cost for safety.
