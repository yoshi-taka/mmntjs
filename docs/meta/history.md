# 開発履歴

## 変更内容（テーブルベースISOパース書き換え）

### src/parse.ts

**テーブルベースISOパースに書き換え**
- moment.js と同じ `EXTENDED_ISO_REGEX` / `BASIC_ISO_REGEX`（全体マッチャー）を追加
- moment.js と同じ `isoDates` / `isoTimes` / `TZ_REGEX` テーブルを追加
- `parseISOWithTable()` 関数を実装: 全体正規表現 → テーブルルックアップ → `parseWithFormat` 呼び出し
- `parseString` 内の順次正規表現チェック（ISO週/年間通算日/ISO8601/コンパクト）を `parseISOWithTable` に置き換え
- `parseISOWithTable` が「マッチしたが不正」を `{_claimed: true}` で返し、`createFromString` で `new Date(str)` フォールバックを試す

**高速化: fast path追加**
- `parseCommonISOExtended()` を追加: テーブルイテレーション前にコンパクト日付(`YYYYMMDD`)/通算日(`YYYYDDD`)/週(`GGGG[W]WW`)/拡張通算日(`YYYY-DDD`)/拡張週(`GGGG-[W]WW`)を直接パース
- `parseString` 内で `parseISOWithTable` の前に呼び出し

**その他修正**
- `parseISOOrdinal` に年間通算日超過チェック追加（dayOfYear > daysInYear → reject）
- `Date.UTC` の2桁年マッピング問題修正（year 0-99 が 1900-1999 になるのを防止）
- 全正規表現の末尾 `\s*$` → `$` に変更（末尾空白を許容しない）
- `parseString` 内のトリムを削除（末尾空白を moment.js と同じく非対応に）
- `isoDates` ルックアップ時に datePart のダッシュ有無で extended/basic フォーマットを分離（誤マッチ防止）
- `YYYYYY` トークンのregex `\d{1,7}` → `\d{1,6}` に修正（月日の桁を侵食していた）
- `DDD` トークンのregex `\d{1,3}` → `\d{3}` に変更（moment.js 準拠: 常に3桁必須）
- `parseISOWithTable` 内の sign stripping: `YYYYYY` 系フォーマット以外でのみ sign を除去（`YYYYYYMMDD` などは sign を保持）
- `DDD` ハンドラで `dayOfYear === 0` の reject を削除（`createFromString` の overflow チェックに任せる）

### src/index.ts

**パースフォールバック修正**
- `Number(str)` フォールバック削除（"22"がタイムスタンプ扱いされるのを防止）
- デフォルト日ロジック修正: 年+月指定時は日=1（現在日付ではなく）
- `moment.utc()` のタイムゾーン調整: 文字列の末尾に " UTC" を付加して解釈（moment.js 準拠）
- `_claimed` の扱いを変更: 即座に invalid にせず `new Date(str)` フォールバックに流す
- no-format パスで ISO週/年週データが `parseString` から返ってきた場合、`createMomentFromParsed` にルーティングし `checkOverflow` で週番号超過を検出

## 変更しなかったファイル

- `src/duration_fixed.ts` — 変更なし
- `src/duration.ts` — 変更なし
- `src/utils.ts` — 変更なし
- `src/format.ts` — 変更なし
- `moment/` ディレクトリ — 変更なし（元の moment.js ライブラリ）

## 追加のパフォーマンス最適化（2026-05-05）

### 1. diff(YEAR/MONTH/QUARTER) — Date-free addMonths（`src/moment2.ts`）
- `addMonths` クロージャ（`Date.clone + setMonth + getDate`）を `addAnchorMs`（算術計算＋`Date.UTC`）に置き換え
- UTC モード: Date アロケーション 0（従来 4）。ローカル: 3（従来 4）
- `_ensureFields()` を事前呼び出しして stale field バグ修正
  - 従来は新規作成 Moment で `$y=$M=$D=0` のまま `wholeMonthDiff=0` になり誤った結果
  - `bun run test:hard` のテスト通過数 +7（プロパティテストがより多くの入力をパス）
- UTC モードの DST バグも修正（従来は `Date.setMonth` をローカルタイムゾーンで実行）
- `exp/diff-optimize` ブランチで開発、main にマージ済み

### 2. _addSimple — 不要な _getD() 除去（`src/moment2.ts`）
- `_getD()` を関数先頭から各ブランチ内に移動
- YEAR/MONTH ブランチ全モードと UTC DAY/WEEK/DATE で不要な Date 生成を回避
- 時間単位（HOUR/MINUTE/SECOND/MILLISECOND）とローカル DAY パスでは引き続き `_getD()` を使用

### 3. tokenizeFormat — O(n×62) → O(n×avg-tokens-per-char)（`src/parse.ts`）
- `FORMAT_TOKENS`（62 トークン）の線形スキャンを `tokenizeByChar` の first-char インデックスに置き換え
- `startsWith` チェックが 62 回 → 平均 3-4 回に削減
- `format.ts` の `tokenByChar` と同じパターン

### 4. parseWithFormat — regex → charCodeAt（`src/parse.ts`）
- `/\d/.test(ch)` → `isDigit()`（charCodeAt 48-57 レンジ）
- `/[A-Za-z0-9]/.test(ch)` → `isAlphaNum()`
- `/\s/.test(ch)` → `isWs()`
- `!/^[+-]/.test(remaining)` → 直接 charCodeAt 43/45
- `isDigit`, `isAlphaNum`, `isWs`, `charEqCI` ヘルパー関数を追加

### 5. createMomentFromParsed — buildMomentConfig 抽出（`src/index.ts`）
- 6 ブランチに分散した同一の `MomentConfig` 構築＋`_unusedTokens`/`_unusedInput`/`_charsLeftOver`/`_empty`/`_invalidMonth` 条件付きコピーを `buildMomentConfig()` ヘルパーに抽出
- **108 行削減**（+42/-150）。各ブランチが 1 行で完結

### 6. four()/two() → inline charCodeAt（`src/parse.ts`）
- `parseCommonISOExtended` の全 5 箇所の `four(str, 0)` と 3 箇所の `two(str, i)` を直接 charCodeAt に展開
- `parseCommonISO` のタイムゾーンオフセット解析の `two()` も同様に inline
- 不要になった `two()` / `four()` 関数を削除

### 見送った最適化
- **`_refreshFields` 剰余簡略化**: `((x % n) + n) % n` は pre-1970 の負の `_t` で必要
- **diff から `Date.UTC` 排除**: ネイティブ C++ 関数より JS 算術が遅い
- **`createFromString` に `parseCommonISO` 直接呼び出し**: `parseString` が先頭で既に呼んでおり、関数呼び出し 1 回分の節約にコード重複が見合わない
- **コンストラクタ cold field 条件付き化**: `if (hasInfoCold)` ガードが既に存在。17 個の `!== undefined` は V8 最適化で 1ns 以下/個

## パフォーマンス比較

bench-datefns2（warm median）:

| 操作 | moment2 | date-fns | 比 |
|------|---------|----------|-----|
| parse ISO string | ~522ns | ~1.21μs | 2.3x |
| format YYYY-MM-DD | ~43ns | ~1.10μs | 25x |
| diff in days | ~22ns | ~836ns | 38x |
| diff in months | **~84ns** | ~100ns | **1.2x** |
| add 1 day | **~74ns** | ~81ns | **110%** |
| sub 1 day | **~63ns** | ~73ns | **115%** |
| add 1 month | **~102ns** | ~194ns | **1.9x** |
| add 1 second | **~46ns** | ~88ns | **189%** |
| startOf month | **~12ns** | ~73ns | **6.2x** |
| startOf year | ~80ns | ~80ns | ~100% |
| endOf month | **~72ns** | ~86ns | **120%** |
| set year | **~47ns** | ~114ns | **245%** |
| moment()/new Date() | ~37ns | ~34ns | 94% |
| isLeapYear | ~6ns | ~41ns | 7x |
| isAfter | ~15ns | ~127ns | 8.5x |
| get day of year | ~17ns | ~1.17μs | 69x |
| format HH:mm:ss | ~35ns | ~925ns | 26x |

moment2 vs 元の moment.js（bench.ts, warm after 100 warmup）:

| 操作 | moment.js | moment2 | 比 |
|------|-----------|---------|-----|
| moment() | ~260ns | ~44ns | 5.9x |
| moment('ISO string') | ~4.6μs | ~305ns | 15x |
| format('YYYY-MM-DD') | ~424ns | ~35ns | 12x |
| diff('days') | ~551ns | ~23ns | 24x |
| diff('months') | ~2.1μs | **~18ns** | **117x** |
| add(1,'day') | ~519ns | ~61ns | 8.5x |
| add(1,'month') | ~727ns | ~388ns | 1.9x |
| valueOf / unix | ~17ns | ~7ns | 2.4x |
| getters (7 fields) | ~274ns | ~27ns | 10x |

date-fns 比は 25 項目中 23 項目で勝ち。`moment() / new Date()` は負け、`startOf year` はほぼ同等。`diff in months` は `differenceInCalendarMonths` との比較なので、速度比較として読むべきで、完全な同値 API 比較ではない。

最適化履歴:
| commit | 内容 |
|--------|------|
| `01cc3ed` | dispatch table + charCodeAt digit parsing for parseWithFormat |
| `af47a79` | endOf month/year/quarter — setMonth(m+1,0) + constant time fields |
| `9a62f3b` | diff — extract anchorMs from closure |
| `b64f8aa` | diff months !float — calendar-based comparison, no Date allocation |
| `eb53484` | add months — _d.setFullYear mutation; isLeapYear direct $y |
| `ba79546` | fast path for YYYY-MM-DD string and [y,M,d] array parse |
| `103d7e2` | _addSimple MONTH — guard against _d undefined (clone case) |
| `bf6a64a` | inline _addMonths into _addSimple, fast-path day clamp for $D<=28 |
| (current) | fix: restore !float fast path for diff(YEAR/MONTH/QUARTER), fix bench-datefns2 all mutation chained |

ベンチマーク: `bun test/bench-datefns2.ts`（date-fns 比較）, `bun run bench`（moment.js 比較）

## 注意: 作業ツリー破壊の反省

2026-05-05、clone()最適化の実験中、`git checkout -- src/moment2.ts` で部分戻しをした結果、関連ファイル間で不整合が発生し復旧作業で全未コミット変更を失った。

**原因:**
1. 作業開始前に `git status` / `git diff` を確認しなかった
2. `git checkout -- <file>` で部分戻しをした
3. 退避手段（`git stash`）を使わなかった

**対策（今後のルール）:**
1. 作業開始時は必ず `git status` / `git diff --stat` を確認する
2. 実験や改変は必ずブランチを切って行う
3. 未コミット変更がある状態で別の実験を始めたい場合 → コミットか `git stash`
4. `git checkout --` で消える変更は二度と戻せない（reflog に残らない）
