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

- `src/moment_fixed.ts` — 変更なし
- `src/duration_fixed.ts` — 変更なし
- `src/utils.ts` — 変更なし
- `moment/` ディレクトリ — 変更なし（元の moment.js ライブラリ）

## テスト結果

- `bun test` (3470 tests): ✅ baseline と同数（36 fail、locale/equivalence は pre-existing）
- ファズ: 旧〜26k回 → 新52k回まで通過（〜2倍改善）

## パフォーマンス（予測）

- `parseCommonISOExtended` の fast path により、コンパクト/通算日/週フォーマットのパースがテーブルイテレーションを回避
- 標準ISO文字列（`parseCommonISO`）は従来通り最速
- 無効文字列は従来通り `parseISOWithTable` で早期リジェクト

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
ファザーは永遠に新しいエッジケースを発見し続ける。今回の修正でだいぶ改善したが、根本的には moment.js の format parsing を完全に再現する必要がある（moment.js の `configFromStringAndFormat` 相当の実装）。

### 3. 速度改善
- `src/parse.ts`: `parseCommonISO` の digit extraction をインライン化（`four()`/`two()` 関数呼び出しを直接 charCodeAt に置き換え）
- `src/index.ts`: `createFromString` に `parseCommonISO` 結果の高速パス追加（format 検出 regex / checkOverflow / createUTCDate をバイパス）
- `src/moment_fixed.ts`: コンストラクタの cold field コピーを条件付きに（cold data がない時は配列イテレーションをスキップ）
- `src/moment_fixed.ts`: `_refreshFields` UTC パス改善（`_d` がある時は `getUTCFullYear()` 等を直接呼び出し、`_epochDaysToYMD` 算術を回避）
- `src/moment_fixed.ts`: `_addSimple` DAY の while ループを if-else 分岐に最適化（小さい値の場合はループオーバーヘッド排除）

**ベンチマーク修正**: 全ベンチマークファイル（`test/bench*.ts`）の `import moment2 from "../moment"` を `"../moment2"` に修正。元のインポートは moment.js v2.30.1（オリジナル）を参照していた。

**moment2 vs date-fns: 6/8 勝利**
- parse ISO string: 499ns vs 973ns (1.95x)
- format YYYY-MM-DD: 35ns vs 1.13μs (32x)
- diff in days: 20ns vs 789ns (40x)
- isAfter: 20ns vs 137ns (7x)
- startOf month: 13ns vs 98ns (7.5x)
- get day of year: 10ns vs 1.20μs (120x、キャッシュフィールド)
- add 1 day: LOSE (92ns vs 58ns、ラッパーオーバーヘッド)
- moment()/new Date(): LOSE (133ns vs 38ns、ラッパーオーバーヘッド)

**moment2 vs 元の moment.js**: ISOパース 12倍、フォーマット 11倍、getter 10倍高速化。

### 4. Delta Debugging 導入
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
