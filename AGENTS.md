# Handover Memo

## 開発環境

- `npm` は使わない。`bun` を使う（`bun install`, `bun run build` etc.）
- `npx` 禁止。`bun x` を使う（例: `bun x jazzer`）
- ただし jazzer は `bun run fuzz` で実行可能（package.json に定義済み）
- **テスト実行は `bun test` 直ではなく `bun run test` / `bun run test:hard` を使う**（mutation test の分離実行、grammar fuzz の後処理を含む）

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

### 1. diff(YEAR/MONTH/QUARTER) — Date-free addMonths（`src/moment_fixed.ts`）
- `addMonths` クロージャ（`Date.clone + setMonth + getDate`）を `addAnchorMs`（算術計算＋`Date.UTC`）に置き換え
- UTC モード: Date アロケーション 0（従来 4）。ローカル: 3（従来 4）
- `_ensureFields()` を事前呼び出しして stale field バグ修正
  - 従来は新規作成 Moment で `$y=$M=$D=0` のまま `wholeMonthDiff=0` になり誤った結果
  - `bun run test:hard` のテスト通過数 +7（プロパティテストがより多くの入力をパス）
- UTC モードの DST バグも修正（従来は `Date.setMonth` をローカルタイムゾーンで実行）
- `exp/diff-optimize` ブランチで開発、main にマージ済み

### 2. _addSimple — 不要な _getD() 除去（`src/moment_fixed.ts`）
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

## テスト結果

- `bun run test` (669 tests): ✅ 0 fail
- `bun run test:hard` (4117 tests): 一部 pre-existing failures（diff プロパティテストの moment.js とのアルゴリズム差異、locale equivalence）
- ファズ: 引き続き `bun run fuzz` で実行可能

## パフォーマンス（bench-datefns2, 5 runs median）

| 操作 | moment2 | date-fns | 比 |
|------|---------|----------|-----|
| parse ISO string | ~300ns | ~1.0μs | 3.3x |
| format YYYY-MM-DD | ~45ns | ~1.2μs | 27x |
| diff in days | ~22ns | ~850ns | 39x |
| isAfter | ~20ns | ~150ns | 7.5x |
| startOf month | ~14ns | ~110ns | 7.9x |
| get day of year | ~12ns | ~1.3μs | 108x |
| add 1 day | ~100ns | ~60ns | LOSE (wrapper overhead) |
| moment()/new Date() | ~65ns | ~40ns | LOSE (wrapper overhead) |

moment2 vs 元の moment.js: ISOパース ~20x、フォーマット ~10x、getter ~10x。

## 確認済みエッジケース

**治ったもの:**
- `0000 03` — `_claimed` → `new Date(str)` フォールバックで moment.js 準拠
- `0000000` — DDD=0 を許可し overflow チェックで弾く
- `+2222121222` — YYYYYY regex の貪欲マッチ修正
- `-775505110` — dash分離＋YYYYMMDD マッチで moment.js 準拠
- `8888W81` — ISO週overflow 検出を追加
- `-0501350128` — YYYYYYMMDD 形式で sign を保持
- `+085501-757` — DDD regex を `\d{3}` に修正

**未対応（pre-existing、moment.js のアンカーなしregexとの差異）:**
- `-055555-05`: moment2=INVALID, moment.js=0555-05-01
- `-881802-88`: moment2=8818-02-01, moment.js=INVALID
- `-000700-005`: moment2=-0700-05-01, moment.js=0007-01-05

## 残っている課題

### 1. moment.js のアンカーなし regex マッチングとの差異
`parseWithFormat` は `^` アンカー付き regex で現在位置からマッチする。moment.js は `String.match(regex)` で文字列全体からマッチ位置を探す。この差異により sign-prefixed 文字列のパース結果が一部異なる。本質的には `parseWithFormat` に non-anchored マッチングの skip logic を追加するか、`parseISOWithTable` で個別対応が必要。

### 2. fuzz継続
ファザーは永遠に新しいエッジケースを発見し続ける。`bun run fuzz` で実行可能。crash 最小化は `bun run fuzz:ddmin -- crash-xxx`。

### 3. Delta Debugging 導入
- `test/fuzz/ddmin.ts`: ddmin アルゴリズム汎用実装（文字列・配列対応）
- `test/fuzz/delta-debug.mjs`: post-hoc 最小化スクリプト（`bun run fuzz:ddmin -- crash-xxx`）
- `-minimize_crash=1` を jazzer の fuzz 実行に追加済み
- ddmin で既存 crash ファイルを検証済み（1-3 B 削減できたが、既に libFuzzer がほぼ最小化済みだった）
- 操作列の削減（operations fuzz）への ddmin 適用は未着手（各操作が独立した try/catch なので現状の恩恵は小さい）

## 注意: 作業ツリー破壊の反省

### 発生日
2026-05-05、clone()最適化の実験中。

### 何が起きたか
- `src/moment_fixed.ts`, `src/format.ts` に未コミットの作業中変更があった（`_ensureFields()` lazy init 機構の追加）
- `git checkout -- src/moment_fixed.ts` を実行し、moment_fixed.ts の未コミット変更だけをHEADに戻した
- しかし format.ts は変更されたまま残り、`_ensureFields()` を参照していて実行時エラーになった
- 復旧しようと `git checkout -- src/format.ts src/index.ts src/parse.ts` を実行し、全未コミット変更を失った

### 原因
1. **作業開始前に `git status` / `git diff` を確認しなかった** — 未コミット変更がある状態で作業を始めたことに気づかなかった
2. **`git checkout -- <file>` で部分戻しをした** — 関連ファイル間で不整合が起きるリスクを無視した
3. **退避手段を使わなかった** — `git stash` / `git stash push -m "msg"` すれば全変更を安全に退避できた

### 対策（今後のルール）
1. **作業開始時は必ず `git status` / `git diff --stat` を確認する**
2. **実験や改変は必ずブランチを切って行う。絶対にカレントブランチで直接編集しない:**
   ```
   git checkout -b exp/clone-optimize
   ```
3. **未コミット変更がある状態で別の実験を始めたい場合:**
   - 先にコミットしてからブランチを切る: `git add -A && git commit -m "wip: ..."`
   - または `git stash push -m "msg"` で退避
4. **`git checkout -- <file>` で未コミット変更を消さない。どうしても必要なら事前に:**
   - `git diff HEAD -- <file>` で内容を確認
   - 全関連ファイルの整合性を確認する
5. **`git checkout --` で消える変更は二度と戻せない**（reflog に残らない）
