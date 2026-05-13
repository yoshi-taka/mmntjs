# Quality Uplift Plan (短期)

現状の品質基盤を短期間で底上げするための段階的プラン。

## 現状サマリ

| カテゴリ | 内訳 |
|----------|------|
| moment.js 互換テスト | 52 files |
| moment2 固有テスト | 167 lines, 1 file |
| ロケールテスト | 138 files |
| プロパティベーステスト | 4 files |
| ファズハーネス | 9個 |
| ミューテーション | 12 operators, `moment2.ts` のみ |
| クラッシュファイル | 22個 (未トリアージ) |
| SBST | 2 files (POC) |
| カバレッジ | 導入済み (baseline 74.8%) |

## Phase 1: クラッシュ整理

- 22個の `crash-*` ファイルをハーネスごとに分別
- 現在のビルドで再現するか確認
- 固定済みは削除、未解決は `test/regression/` に回帰テスト化
- ddmin で最小化してから登録

## Phase 2: ミューテーション拡充 ✅

- 対象ファイル拡大: `parse.ts`, `duration.ts`, `format-tokens.ts`, `display/format.ts`, `units.ts`
- operator 追加: 境界値オフバイワン, 符号反転, 丸め変更, 条件反転, 早期return削除
- survival rate 自動集計
- Mutation count: 12 → 20 (8 new operators)
- Survival rate: 100% (20/20 killed)

## Phase 3: ファズ corpus & 辞書 ✅

- `test/fuzz/corpus/{parse,format,duration,operations,utc,array-input,object-input,reltime}/` 作成
- moment.js テストケース等を seed として配置 (495 files)
- `.dict` ファイル導入: `iso-tokens.dict`, `month-names.dict`, `format-tokens.dict`
- corpus を git 管理

## Phase 4: カバレッジ計測 ✅

- `bun test --coverage` で行カバレッジ取得 ✅
  - スクリプト: `test:coverage`, `test:coverage:full`
  - レポーター: lcov + text、出力先: `coverage/`
- CI で閾値設定 ✅
  - `.github/workflows/ci.yml` に coverage step 追加
  - 閾値: 67% (67.8%到達、上昇に伴い更新)
  - 目標: 80%
- 低カバレッジ箇所に mutation / プロパティテストを優先追加 ✅
  - **最終ベースライン: 73.27%** (全1224 tests)、Phase 4.5 修正後
  - **改善ファイル:** core-base 54.6%→83.3%, core-lite 25.0%→80.0%
  - **改善サマリ (全23テストファイル):**

| テストファイル | テスト数 | 主なカバレッジ対象 |
|---|---|---|
| `test/properties/basic.test.ts` | +7 | `relativeTimeRounding/Threshold`, `normalizeUnits` etc. |
| `test/format-basic.test.ts` | 11 | `formatMomentBasic` |
| `test/units.test.ts` | 22 | `normalizeUnits`, `normalizeUnitCode`, `isLeapYear`, `daysInMonth` |
| `test/duration-between.test.ts` | 10 | `diffMomentsForDuration` |
| `test/parse-lite.test.ts` | 38 | `parseString` ISO/RFC2822/JSON |
| `test/parse-lite-strict.test.ts` | 32 | `parseString` strict版ISO |
| `test/locale-mgmt.test.ts` | 35 | `locale()`/`defineLocale()`/`updateLocale()` |
| `test/utc-extra.test.ts` | +11 | `local()`/`utc()` keepLocalTime, `zone()` |
| `test/parse-format.test.ts` | 50 | フォーマットトークンパーサー |
| `test/parse-main.test.ts` | 87 | `parseString` 全トークンハンドラ |
| `test/moment-lite.test.ts` | +8 | lite `get/set`, `isBetween` |
| `test/factory-input-format.test.ts` | 21 | strict mode, 複数フォーマット |
| `test/debug-extra.test.ts` | 14 | `toArray`, `parsingFlags`, `inspect` |
| `test/locale-extra.test.ts` | 16 | `weekday`, `week`, `weekYear` |
| `test/duration-extra.test.ts` | 22 | ISO/C#/TimeSpan, `humanize` |
| `test/display-extra.test.ts` | 12 | `calendar`, `fromNow` |
| `test/calendar-extra.test.ts` | 10 | `isoWeek`, `isoWeekday`, `dayOfYear` |
| `test/factory-lite.test.ts` | 14 | lite null/NaN/Infinity/utc |
| `test/plugins.test.ts` | 12 | min/max/now/isMoment |
| `test/moment-class-extra.test.ts` | 26 | `set/get`, `isBetween` |

  - **Phase 4.5 修正 (2026-05-13, 10→2 failures):**
    - `add(duration)` が Duration オブジェクトを無視 → `core-base.ts`/`moment-lite.ts` に `isDuration` チェック追加
    - `isoWeeksInYear` が local time で誤計算 → `calendar-extra.ts` で `_ensureFields()` 呼び出し追加
    - `utcOffset` の `-0` 消失 → `utc-extra.ts` で `_ensureFields()` + `=== undefined` チェック
    - `"2024-01-32"` が valid になる → `factory-shared.ts` の `createMomentFromParsed` で `checkOverflow` 呼び出し
    - `firstWeekOffset` がlocal timeを使用 → 常に UTC ベースに変更 (calendar-extra.ts, moment-class.ts, locale-extra.ts)

  - **修正したバグ (9件):**

| バグ | 影響 | 修正ファイル |
|---|---|---|
| `isBefore` が `>` を使ってた | isBeforeが逆の結果を返す | `moment-class.ts` |
| `isMoment(null)` クラッシュ | TypeError | `utils.ts` |
| `format("dd")`/`toString()` 空文字 | フォーマット出力壊れ | `locale-runtime.ts` |
| `normalizeUnitCode("year")` → `undefined` | get/set一部動作しない | `units.ts` |
| strict mode extra chars 無視 | strict指定が効かない | `factory-input-format.ts` |
| `setRelTimeRounding`/`setRelTimeThreshold` 戻り値 | moment.js非互換 | `display/reltime.ts` |
| `isLeapYear` invalid moment で true | 誤判定 | `moment-class.ts`, `moment-lite.ts` |
| 各種 `-0` 戻り値 | `Object.is` 比較で不一致 | 複数ファイル |
| `duration({from,to})` 常に invalid | resolver未登録 | `entry/init.ts` |

  - **残っている property test failures (2件):**
    1. `diff for all unit types matches moment` — 一部unitで moment.js とdiff値が異なる
    2. `parsingFlags with format string matches moment` — `charsLeftOver` 算出の差

  - **70%未満ファイル (継続課題):**
    - `src/moment-lite.ts` (1128行, 59.5%)
    - `src/parse.ts` (2085行, 62.7%)
    - `src/duration.ts` (774行, 67.4%)
    - `src/parse-format.ts` (2111行, 70.3% stmt, 48.0% branch)
    - ✅ `core-base.ts`: 53.4% → **83.3%** (+29.9pt)
    - ✅ `core-lite.ts`: 55.6% → **80.0%** (+24.4pt)
    - ✅ `parse-format.ts`: 39.9% → **70.3%** (stmt) (+30.4pt)

## Phase 5: 差分ファジング多様化

- date-fns, luxon, dayjs との比較ハーネス追加
- `test:hard` のみで実行

## Phase 6: TZ バリエーション

- ファズハーネスにランダム TZ 切り替え
- `TZ=UTC` / `TZ=Asia/Tokyo` 両方でファズ実行

## Phase 7: SBST 本格化

- カバレッジガイド付き weighted arbitrary
- 既存プロパティテストに SBST モード追加
- adversarial testing (NaN, overflow, 極値)
