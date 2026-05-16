# 開発ルール

- `spec.md` をもとに moment2 を制作する
- `root/moment/` ディレクトリが clone してきた moment.js — ここは変更しないこと
- ビルドまで行う。publish 禁止（できないが）
- `npx` 禁止、`bun` 使え（`bun add`, `bun run`, `bun test`, `bun x`）
- なんども `spec.md` を読み、なんども moment.js のテストケースに沿ってるかチェックしよう

## ファイル変更の安全ルール

1. **git初期化**: リポジトリが未コミットなら最初に `git add -A && git commit -m "init"` せよ
2. **dry run**: 複数ファイルにわたるスクリプト（sed, node -e 等）を流す前に `--dry-run` 相当の確認（何が変わるか表示）を実施せよ。いきなり本実行するな
3. **変更後即構文チェック**: ファイルを変更したら直後に `bun build src/変更したファイル.ts --no-bundle` で構文エラーがないか確認せよ
4. **chflags禁止**: ファイルをロックする `chflags uchg` は絶対に使うな。ロックされると `chflags nouchg` が必要になり、存在を忘れて長時間ハマる
5. **シェルスクリプトの冪等性**: 同じスクリプトを2回実行しても壊れないように書け（元の状態を確認してから変更する）
6. **テストは両方のTZで**: 日付処理の変更後は `TZ=UTC bun test` と `TZ=Asia/Tokyo bun test`（またはAmerica/New_York）の両方でテストを通せ。さらにタイムゾーン関連の変更後は `bun run test:tz` も実行し、全6タイムゾーンでの互換性を確認せよ
7. **比較方法**: `bash scripts/compare.sh {bench|test|moment-tests}` — benchは性能比較、testはプロパティ比較、moment-testsはmoment.jsのテストをmoment2で実行（oracle.tsを一時的に差し替え）
8. **commit前にlint**: `bun run lint` を通してから commit せよ。`lint` は `oxfmt`（フォーマッタ）→ `oxlint` の順に実行するので、lint後に差分が出たらそれも含めて commit すること。pre-commit hook で落ちて手戻りが発生するのを防ぐ


---

# Handover Memo

## Phase 4 完了: カバレッジ 34.1% → 74.8% (2026-05-13)

詳細は `docs/testing/QUALITY_UP.md` を参照。

## 開発環境

- `npm` は使わない。`bun` を使う（`bun install`, `bun run build` etc.）
- `npx` 禁止。`bun x` を使う（例: `bun x jazzer`）
- ただし jazzer は `bun run fuzz` で実行可能（package.json に定義済み）
- **テスト実行は `bun test` 直ではなく `bun run test` / `bun run test:hard` を使う**（mutation test の分離実行、grammar fuzz の後処理を含む）

## テスト結果

- `bun run test` (678 tests): ✅ 0 fail
- `bun run test:hard` (4122 tests): 一部 pre-existing failures（diff プロパティテストの moment.js とのアルゴリズム差異、locale equivalence）
- ファズ: `bun run fuzz` で実行可能

## Phase 5: タイムゾーン / DST 互換性の検証と修正 (2026-05-16)

### 修正したバグ

1. **`_ensureFields` 未呼び出しによる `keepLocalTime` の誤動作** (`src/utc-extra.ts`)
   - `localMoment`, `utcMoment`, `utcOffsetMoment` の `keepLocalTime=true` パスで `$y,$M,$D,$H,$m,$s,$ms` を読み取る前に `_ensureFields()` を呼んでいなかった
   - これにより生成直後の Moment で `.utcOffset(N, true)` を呼ぶと時フィールドが初期値0のまま使われ、常に0時と解釈される問題があった
   - **修正**: 該当3関数の keepLocalTime パス先頭に `_ensureFields()` を追加

2. **`moment.utc([year, month, ...])` が配列をローカル時刻として扱っていた** (`src/plugins/utc.ts`)
   - moment.js は `moment.utc([2024, 5, 15, 12, 30])` を UTC として解釈するが、mmntjs はローカル時刻として解釈していた
   - 原因: ファクトリが配列入力に対して `isUTC` フラグを渡さずに `createFromArray` を呼び、ローカル Date で生成していた
   - **修正**: `moment.utc()` ハンドラで配列入力を検出し、`createUTCDate` で直接 UTC Date を構築

3. **配列入力の Moment に `_isUTC` フラグが伝播していない** (`src/core/factory-input-struct.ts`)
   - `createFromArrayInput` は `isUTC` パラメータを受け取っていたが、生成する Moment の `_isUTC` に反映していなかった
   - **修正**: `new Moment({ _isUTC: !!isUTC, ... })` を追加

### 互換性テストスイート

| ファイル | 内容 | テスト数 |
|---------|------|---------|
| `test/timezone-compat.test.ts` | moment() / moment.utc() / parseZone() / utcOffset() / zone() / keepLocalTime / format Z,ZZ,z,zz / isDST / valueOf の moment.js 対比 | 105 tests |
| `test/timezone-dst-subproc.test.ts` | DST境界（spring-forward/fall-back）、format、mode遷移 | 19 tests |

**実行方法**:
- `bun run test:tz` — 全タイムゾーンで互換性テスト + DSTテスト
- `bun run test:dst` — DSTテストのみ
- `bash scripts/run-timezone-tests.sh`
- `TZ=America/New_York bun test test/timezone-compat.test.ts`

**検証済みタイムゾーン**: UTC, America/New_York, Europe/Berlin, Asia/Tokyo, Australia/Sydney, America/Los_Angeles

**結果**: 124 tests × 6 timezones = 744 test cases、全パス

### DST 境界テスト内容

- **Spring-forward** (例: 2024-03-10 America/New_York):
  - 存在しないローカル時刻 02:30 の解釈（JS Date の挙動に従う moment.js 準拠）
  - isDST の変化（冬時間→夏時間）
- **Fall-back** (例: 2024-11-03 America/New_York):
  - 重複するローカル時刻 01:30 の解釈
  - isDST の変化（EDT→EST）
- **Mode 遷移近傍**:
  - local → utc → local で valueOf 保存
  - utcOffset(N, true) で wall-clock 保存
  - format Z/ZZ の一致

### 設計上の制約と moment.js との一致点

1. **UTC / 固定 UTC オフセットのみ**: 本体の moment.js と同様、IANA タイムゾーン解決は行わない
2. **DST 検出**: ランタイムのローカルタイムゾーンの JS Date 挙動に従う。固定オフセットのモーメントは常に `isDST()=false`
3. **valueOf()**: 全モード間で moment.js と完全一致
4. **parseZone()**: wall-clock + offset 保存
5. **keepLocalTime**: moment.js と完全一致
6. **format Z/ZZ/z/zz**: moment.js と完全一致
7. **うるう秒**: 非サポート（JS Date / Unix epoch に従う）

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

corpus seeds (`test/fuzz/corpus/`) を moment.js テストケースから抽出済み。新たにバグを発見した際は regression test に追加し、必要に応じて corpus にも seed を追加すること。corpus を使ったテストは `bun x jazzer test/fuzz/<name>.fuzz.js --sync -i dist/ -- test/fuzz/corpus/<name>/` で実行可能。`.dict` ファイルは `-dict=test/fuzz/corpus/<name>.dict` で使用。

### 3. Delta Debugging 導入
- `test/fuzz/ddmin.ts`: ddmin アルゴリズム汎用実装（文字列・配列対応）
- `test/fuzz/delta-debug.mjs`: post-hoc 最小化スクリプト（`bun run fuzz:ddmin -- crash-xxx`）
- `-minimize_crash=1` を jazzer の fuzz 実行に追加済み
- ddmin で既存 crash ファイルを検証済み（1-3 B 削減できたが、既に libFuzzer がほぼ最小化済みだった）
- 操作列の削減（operations fuzz）への ddmin 適用は未着手（各操作が独立した try/catch なので現状の恩恵は小さい）

