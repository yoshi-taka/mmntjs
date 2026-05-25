# 開発ルール

- `spec.md` をもとに mmntjs を制作する
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
 7. **テスト失敗を「pre-existing」でごまかすな**: テストが落ちた場合、まず原因を特定し修正しろ。本当にpre-existingだと確信できる場合（親コミットでも全く同じ条件で再現する）は、その証拠（親コミットでの再現ログ）を添えて報告し、ユーザーの判断を仰げ。
      - 違反した場合: ユーザーの指摘を受けてから修正すると手間が倍になる。最初から正直に向き合え。
 8. **PBT（property-based test）が落ちたらseedを探せ**: fast-check は `SEED=` または `seed:` をエラー出力に含む。そのseedを `assertProp(property, { seed: N })` に渡せば常に再現する。seedが出ていない場合は `bun run test:hard` 等で何度か実行し、counterexample を収集せよ。異なるseedで同じ傾向のcounterexampleが出れば、根本原因が特定しやすい。
      - seed再現例: `TZ=America/New_York bun test test/stateful-model.test.ts -t "test name"` で実行し、表示された `{ seed: N }` をコピーして使う
 9. **比較方法**: `bash scripts/compare.sh {bench|test|moment-tests}` — benchは性能比較、testはプロパティ比較、moment-testsはmoment.jsのテストをmmntjsで実行（oracle.tsを一時的に差し替え）
10. **commit前にlint → git add**: `lint` は `oxfmt`（フォーマッタ）→ `oxlint` の順に実行される。**先に `bun run lint` を通してから `git add` し、その後 `git commit` せよ。** この順序でやれば pre-commit hook 内の `oxfmt` が何も変更せず、hook 通過後のぶり返し差分が発生しない。lint 後に未ステージの差分が出たらそれも含めて commit すること。pre-commit hook で落ちて手戻りが発生するのを防ぐ。
11. **テスト実行は `bun run test` が公式**: `bun run test` は curated subset + `TZ=UTC` で動く。`bun test` は全テストファイルを現在のTZで実行するため、JST等の非UTC環境ではoffset無しISO文字列パースや `Z`/`ZZ` フォーマットのテストが落ちる。全テストを通すには `TZ=UTC bun test` を使え。
12. **push禁止（機械的）**: `git push` は**絶対に bash で実行しない。** リモート URL は `git@github.com:BLOCKED-PUSH-mmntjs.git` に固定されており、push は常に失敗する。
     - ユーザーが明示的に「pushしろ」と言った場合のみ、`bash scripts/git-push.sh enable` + `git push origin <branch>` + `bash scripts/git-push.sh disable` の順で実行してよい。
     - `scripts/git-push.sh` は絶対に削除・変更しない。
     - ユーザーが問題を報告しても、自分で「直してpush」するな。
13. **`git push --tags` 禁止**: 全タグを一括pushすると過去のreleaseタグが再送され、ワークフローが多重起動する事故の原因になる。**リリースタグは `bash scripts/git-push.sh enable && git push origin <tag名> && bash scripts/git-push.sh disable` でpushすること。** `--tags` は絶対に使うな。
     - **`git push` 単体も同じ**: 許可なく push すると未ステージの変更や意図しないコミットが送られる。ルール12に従い、`scripts/git-push.sh` を使え。
13. **property-based testing / fuzzing に flaky は存在しない**: fast-check や jazzer が見つけた counterexample は必ず調査・修正すること。乱数シードを固定して再現し、コードのバグとして対処する。「flaky」「テスト間干渉」「pre-existing」で誤魔化さない
     - 違反した場合: 即刻応答停止 & ユーザーのお説教タイム。連続違反では罰走10km
14. **property-based testing / fuzzing に flaky は存在しない**: fast-check や jazzer が見つけた counterexample は必ず調査・修正すること。乱数シードを固定して再現し、コードのバグとして対処する。「flaky」「テスト間干渉」「pre-existing」で誤魔化さない
     - 違反した場合: 即刻応答停止 & ユーザーのお説教タイム。連続違反では罰走10km
15. **lite-fns は lite と同じ実装を使うこと**: `src/lite-fns.ts` の各関数は `src/moment-lite.ts` / `src/display/format-basic.ts` と同じロジックをコピーして使う（delegate 禁止＝オブジェクト生成コスト回避）。**full（`moment-class.ts`）・lite（`moment-lite.ts`）・lite-fns（`lite-fns.ts`）の3実装は常に同期すること。** いずれかに修正が入ったら残り2つにも同じ修正を適用する。逆もしかり。
16. **`git commit --no-verify` 禁止**: pre-commit hook（lint + audit）をスキップする `--no-verify` / `-n` は**ユーザーから明示的に許可を得た場合のみ**使用すること。自分で判断して no-verify するな。hook が落ちた場合は hook を通す修正をするのが原則。
17. **audit 迂回禁止**: `exit 0` のラップ、audit 自体の削除、`fail: false` などで pre-commit hook の audit を迂回するな。fallow が死んだら fallow の設定を正しく直せ（ignore ではなく entry 追加で）。**"それ動かないから"は理由にならない — 動くように直せ。**


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

- `bun run test` (630 tests): ✅ 0 fail
- `bun run test:hard` (4642 tests): ✅ 0 fail
- `bun run test:tz`: 全6タイムゾーン × 124 tests = 744 tests ✅
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

### 2026-05-17: `moment.utc()` fallback が正しくパースされた結果を上書きする問題を修正
`src/plugins/utc.ts` で `new Date(str + " UTC")` が常に試行され、ISO パーサーが正しく解釈した結果を上書きしていた。
- **修正**: `m._isValid` が true（パーサー成功）の場合は `new Date(str + " UTC")` をスキップし、算術変換（local→UTC）を行う
- **影響を受けた入力**: `moment.utc("0010")`, `"0011"`, `"0000"`, `"0066"`, `"0050"`, `"0055"`, `"-110990-09"` — 全て moment.js と一致するように修正
- **テスト**: 6件の KNOWN_DIFF → FIXED_UTC に移動、全1403テストパス

### 2026-05-17: タイムゾーンブロブの圧縮パック形式に完全移行
`packages/timezone/src/builtin-data.generated.ts` を pre-unpacked JSON（2.74MB）から moment-timezone のオリジナル base-60 パック形式に変更。
- **効果**: 2.74MB → 725KB（73%削減、2.0MB減）
- **仕組み**: パック文字列（`name|abbrs|offsets|indices|untils|population`）をそのまま保持。ランタイムの `unpack()` が初回アクセス時に遅延デコード
- **生成**: `_zones` の生パック文字列をそのまま出力、`unpackPacked` / デルタエンコード / abbrTable の全中間処理を削除
- **テスト**: 全1403テストパス、タイムゾーン358テストパス

## 確認済みエッジケース

**治ったもの:**
- `0000 03` — `_claimed` → `new Date(str)` フォールバックで moment.js 準拠
- `0000000` — DDD=0 を許可し overflow チェックで弾く
- `+2222121222` — YYYYYY regex の貪欲マッチ修正
- `-775505110` — dash分離＋YYYYMMDD マッチで moment.js 準拠
- `8888W81` — ISO週overflow 検出を追加
- `-0501350128` — YYYYYYMMDD 形式で sign を保持
- `+085501-757` — DDD regex を `\d{3}` に修正、dayOfYear overflow 検出を追加

## 残っている課題

### 1. moment.js のアンカーなし regex マッチングとの差異
`parseWithFormat` は `^` アンカー付き regex で現在位置からマッチする。moment.js は `String.match(regex)` で文字列全体からマッチ位置を探す。

**対応状況**: 3つの sign-prefixed edge case は `trySignPrefixedDateFallback` を追加して修正済み（FIXED_PARSE に含む）。残る本質的差異は `parseWithFormat` に non-anchored マッチングの skip logic を追加するか、`parseISOWithTable` で個別対応が必要。

### 2. fuzz継続
ファザーは永遠に新しいエッジケースを発見し続ける。`bun run fuzz` で実行可能。crash 最小化は `bun run fuzz:ddmin -- crash-xxx`。

corpus seeds (`test/fuzz/corpus/`) を moment.js テストケースから抽出済み。新たにバグを発見した際は regression test に追加し、必要に応じて corpus にも seed を追加すること。corpus を使ったテストは `bun x jazzer test/fuzz/<name>.fuzz.js --sync -i dist/ -- test/fuzz/corpus/<name>/` で実行可能。`.dict` ファイルは `-dict=test/fuzz/corpus/<name>.dict` で使用。

### 3. Delta Debugging 導入
- `test/fuzz/ddmin.ts`: ddmin アルゴリズム汎用実装（文字列・配列対応）
- `test/fuzz/delta-debug.mjs`: post-hoc 最小化スクリプト（`bun run fuzz:ddmin -- crash-xxx`）
- `-minimize_crash=1` を jazzer の fuzz 実行に追加済み
- ddmin で既存 crash ファイルを検証済み（1-3 B 削減できたが、既に libFuzzer がほぼ最小化済みだった）
- 操作列の削減（operations fuzz）への ddmin 適用は未着手（各操作が独立した try/catch なので現状の恩恵は小さい）

