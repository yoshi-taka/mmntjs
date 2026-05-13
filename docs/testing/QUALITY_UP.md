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
    - `src/parse.ts` (2085行, 62.7%)
    - `src/parse-format.ts` (2111行, 70.3% stmt, 48.0% branch) — branch低い
    - ✅ `core-base.ts`: 53.4% → **83.3%** (+29.9pt)
    - ✅ `core-lite.ts`: 55.6% → **80.0%** (+24.4pt)
    - ✅ `duration.ts`: 67.4% → **80.4%** (+13.0pt)
    - ✅ `moment-lite.ts`: 59.5% → **73.1%** (+13.6pt)

## Phase 4 Oracle Audit 進捗 (2026-05-13)

Phase 4 で追加した UT を、実装都合ではなく `moment/` の moment.js 実測に合わせて再精査中。

- **監査・修正済みテスト**
  - `test/parse-main.test.ts`
  - `test/parse-format.test.ts`
  - `test/locale-mgmt.test.ts`
  - `test/locale-extra.test.ts`
  - `test/utc-extra.test.ts`
  - `test/factory-input-format.test.ts`
  - `test/display-extra.test.ts`
  - `test/moment-class-extra.test.ts`
  - `test/factory-lite.test.ts`
  - `test/moment-lite.test.ts`
  - `test/format-basic.test.ts`
  - `test/units.test.ts`
  - `test/duration-between.test.ts`
  - `test/debug-extra.test.ts`
  - `test/calendar-extra.test.ts`
  - `test/duration-extra.test.ts`
  - `test/plugins.test.ts`
  - `test/parse-lite.test.ts`
  - `test/parse-lite-strict.test.ts`
  - `test/properties/basic.test.ts`

- **この監査で直した実装バグ**
  - custom locale の month/weekday strict parse が英語 fallback しすぎる
  - apostrophe variant を month/weekday parse で過剰受理する
  - strict parse が prefix-consume (`janfun` → `jan`) を許していた
  - `moment.locale("xx")` が unknown locale で current locale を保持しない
  - missing parent locale の `defineLocale` 挙動
  - `moment.months("MMM", i)` / `weekdays("format"|"shortFormat"|"minFormat")` の static API 差異
  - instance `locale(false)` の戻り値差異
  - `weekYear(y)` setter が local moment で効かない
  - `isDST()` が UTC offset moment で `true` になる
  - format array 中の `RFC_2822` を過剰受理する
  - lite の `week()` / `isoWeek()` / `isoWeekYear()` setter/getter 差異
  - lite の `moment(undefined, [])` 挙動
  - `get("invalid")` の戻り値差異
  - `moment.invalid({foo:"bar"})` の custom parsing flag が消える
  - `clone()` が local offset / cold flags を落とす
  - `Duration` の `quarter` / `quarters` / `Q` 処理が壊れている
  - non-float `diff("month"|"year"|"quarter")` が local TZ で 1 ずれる
  - valid formatted parse / overflow parse で `parsingFlags()` 用の metadata を落としている

- **監査済み検証コマンド**
  - `TZ=UTC bun test test/parse-main.test.ts test/parse-format.test.ts`
  - `TZ=Asia/Tokyo bun test test/parse-main.test.ts test/parse-format.test.ts`
  - `TZ=UTC bun test test/locale-mgmt.test.ts test/locale-extra.test.ts test/utc-extra.test.ts`
  - `TZ=Asia/Tokyo bun test test/locale-mgmt.test.ts test/locale-extra.test.ts test/utc-extra.test.ts`
  - `TZ=UTC bun test test/factory-input-format.test.ts`
  - `TZ=Asia/Tokyo bun test test/factory-input-format.test.ts`
  - `TZ=UTC bun test test/display-extra.test.ts test/moment-class-extra.test.ts test/factory-lite.test.ts test/moment-lite.test.ts`
  - `TZ=Asia/Tokyo bun test test/display-extra.test.ts test/moment-class-extra.test.ts test/factory-lite.test.ts test/moment-lite.test.ts`
  - `TZ=UTC bun test test/calendar-extra.test.ts test/debug-extra.test.ts test/units.test.ts test/duration-between.test.ts`
  - `TZ=Asia/Tokyo bun test test/calendar-extra.test.ts test/debug-extra.test.ts test/units.test.ts test/duration-between.test.ts`
  - `TZ=UTC bun test test/plugins.test.ts test/duration-extra.test.ts test/format-basic.test.ts test/parse-lite.test.ts test/parse-lite-strict.test.ts`
  - `TZ=Asia/Tokyo bun test test/plugins.test.ts test/duration-extra.test.ts test/format-basic.test.ts test/parse-lite.test.ts test/parse-lite-strict.test.ts`
  - `TZ=UTC bun test test/properties/basic.test.ts`
  - `TZ=Asia/Tokyo bun test test/properties/basic.test.ts`

- **未監査の Phase 4 追加テスト**
  - Phase 4 追加 UT の oracle 監査は一通り完了
  - 以後は Phase 5 以降、または fuzz / property で見つかる新規差分を随時回収

## Phase 5: 差分ファジング多様化 ✅

- date-fns, luxon, dayjs との比較ハーネス追加 (diff-datefns/diff-luxon/diff-dayjs)
- 全ハーネスは `fuzz:quick` に統合 (11 targets)、`test` / `test:hard` 両方で実行
- 各500 runs、0 failure 確認

## Phase 6: TZ バリエーション ✅

- `test/fuzz/tz-helper.js`: 8タイムゾーンからランダム選択 (UTC, Asia/Tokyo, America/New_York, Europe/London, Australia/Sydney, Pacific/Auckland, Asia/Shanghai, Europe/Berlin)
- 全11 fuzz ハーネスに `applyRandomTZ(buf)` 組込み
- `test:hard` に `TZ=Asia/Tokyo bun run fuzz:quick` 追加 (両TZでのファズ実行)

## Phase 7: SBST 本格化 ✅

- `test/sbst-weighted.test.ts`: カバレッジガイド付き weighted arbitrary を8種類実装
  - パース互換トークン (26種、重み付け)
  - ロケールトークン / タイムゾーントークン / ISO週トークン / 四半期トークン
  - デュレーションユニット / 演算ユニット (mapToConstant で重み制御)
  - エスケープ文字・エッジフォーマット
- `test/sbst-adversarial.test.ts`: adversarial testing 11テスト
  - NaN/Infinity 全コンストラクタ位置、極端な年・フォーマット文字列
  - 空オブジェクト/null/undefined、無効ロケール
  - `isMoment`/`isDate`/`isDuration` 非 Moment 値
  - 極値間の diff、無効 moment への連鎖的操作
- 全22テスト、`TZ=UTC` / `TZ=Asia/Tokyo` 両方で pass
