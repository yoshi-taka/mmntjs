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
6. **テストは両方のTZで**: 日付処理の変更後は `TZ=UTC bun test` と `TZ=Asia/Tokyo bun test`（またはAmerica/New_York）の両方でテストを通せ
7. **比較方法**: `bash scripts/compare.sh {bench|test|moment-tests}` — benchは性能比較、testはプロパティ比較、moment-testsはmoment.jsのテストをmoment2で実行（oracle.tsを一時的に差し替え）


---

# Handover Memo

## 開発環境

- `npm` は使わない。`bun` を使う（`bun install`, `bun run build` etc.）
- `npx` 禁止。`bun x` を使う（例: `bun x jazzer`）
- ただし jazzer は `bun run fuzz` で実行可能（package.json に定義済み）
- **テスト実行は `bun test` 直ではなく `bun run test` / `bun run test:hard` を使う**（mutation test の分離実行、grammar fuzz の後処理を含む）

## テスト結果

- `bun run test` (678 tests): ✅ 0 fail
- `bun run test:hard` (4122 tests): 一部 pre-existing failures（diff プロパティテストの moment.js とのアルゴリズム差異、locale equivalence）
- ファズ: `bun run fuzz` で実行可能

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

