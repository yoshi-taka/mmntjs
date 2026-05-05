# Testing

## 概要

moment2 は moment.js のドロップイン代替品であり、テスト戦略の核は **本家 moment.js を oracle とする Differential Testing** である。
全テストは `TZ=UTC` 固定で実行される。

```
Core test (moment.js公式):  ~625 tests ✅
Property-based:             112 tests, ~14.8k oracle assertions ✅
Mutation:                   10/10 kill ✅
Timezone:                    8/8 tests ✅
Locale:                   3246/3246 (138 locales) ✅
Tree-shaking:                7/7 tests ✅
Moment2 spec:               14/14 tests ✅
─────────────────────────────────────
Total:                    ~4068/4068 ✅
```

## テスト手法一覧

### 1. Moment.js 公式テストスイート（QUnit 互換レイヤー）

**手段**: `test/qunit.js` + `test/moment/*.js`

moment.js 本体の QUnit テスト 52 ファイルを、QUnit→Bun アダプタ (`test/qunit.js`) 経由で `bun:test` 上で実行する。
アダプタ内部では `test/oracle.ts` を通じて moment.js (本家) か moment2 かを切り替え可能。

```
test/oracle.ts  ──→  import moment from '../moment/moment'    # 本家
                   // import moment from '../src/index.ts'      # moment2
```

### 2. プロパティベーステスト（fast-check + oracle 比較）

**手段**: `test/properties/*.test.ts` + `fast-check`

4 ファイルで構成され、すべて **moment2 の出力を本家 moment.js と比較**する。

| ファイル | 内容 | アサーション数 |
|----------|------|---------------|
| `basic.test.ts` | 全 API 網羅: add/subtract/diff/format/getter-setter/comparison/display/UTC/duration/parsingFlags/weeks/bigInt/string/format-tokens/startOf-endOf | ~70 tests |
| `metamorphic.test.ts` | メタモルフィック関係: add/subtract ラウンドトリップ、diff 反対称性、比較の一貫性、startOf/endOf ベキ等性、zone 変換ラウンドトリップ、duration 不変条件 | ~30 tests |
| `boundary.test.ts` | 境界値: null/undefined/NaN/Infinity、空文字、68/69 年閾値、閏年、月境界、日/時/分/秒/ms 境界、年月日範囲 | ~30 tests |
| `equivalence.test.ts` | 等価クラス分割: 有効/無効月、日境界、時間成分、2桁年、閏年分類、format token 分類、比較メソッド | ~30 tests |

**パターン**:
```typescript
import fc from 'fast-check'
import moment from '../../src/index.ts'
import originalMoment from '../../moment/moment'

test('add() matches moment', () => {
  fc.assert(
    fc.property(safeDates, dayAmounts, dayUnits, (date, amount, unit) => {
      expect(moment(date).add(amount, unit).format('YYYY-MM-DD'))
        .toBe(originalMoment(date).add(amount, unit).format('YYYY-MM-DD'))
    }),
    { numRuns: 100 }
  )
})
```

### 3. ファズテスト（Jazzer.js + coverage-guided + oracle 比較）

**手段**: `test/fuzz/*.fuzz.js` + `@jazzer.js/core`

8 つのファズハーネスが libFuzzer (coverage-guided) でランダム入力を生成し、moment2 と本家 moment.js の出力を比較する。
すべてのハーネスは差分検出時に `throw new Error(...)` で報告する。

| ハーネス | ファズ対象 | 比較項目 |
|----------|-----------|---------|
| `parse.fuzz.js` | `moment(str)` | isValid, format, valueOf |
| `format.fuzz.js` | `moment(str).format(fmt)` | format 出力 |
| `duration.fuzz.js` | `moment.duration({key: val})` | get, as, add |
| `operations.fuzz.js` | `moment(date).add/startOf/diff` | format, isValid, add, startOf, diff |
| `utc.fuzz.js` | `moment.utc(str)` | isValid, format, valueOf, toISOString |
| `reltime.fuzz.js` | `calendar/from/to` | 相対時刻文字列 |
| `array-input.fuzz.js` | `moment([y, M, d, ...])` | isValid, format, valueOf |
| `object-input.fuzz.js` | `moment({year, month, ...})` | isValid, format, valueOf |
| `grammar.fuzz.js` | Grammar-based ISO 8601 生成 | isValid, format, valueOf |

**実行**:
- `bun run fuzz` → parse.fuzz.js を 60秒間実行
- `bun run fuzz:quick` → 全 8 ハーネスを各 500 iterations
- `bun run fuzz:grammar` → grammar.fuzz.js を 10,000 iterations
- `bun run fuzz:grammar:quick` → grammar.fuzz.js を 500 iterations

**パターン**:
```javascript
export function fuzz(buf) {
  const str = buf.toString('utf-8')
  const m2 = moment.utc(str)
  const mOrig = originalMoment.utc(str)

  if (m2.isValid() !== mOrig.isValid()) {
    throw new Error(`isValid mismatch: moment2=${m2.isValid()}, original=${mOrig.isValid()}`)
  }
  if (m2.format('YYYY-MM-DD HH:mm:ss.SSS') !== mOrig.format('YYYY-MM-DD HH:mm:ss.SSS')) {
    throw new Error(`format mismatch: ...`)
  }
}
```

### 3.1. Grammar-Based Fuzzing

**手段**: `test/fuzz/grammar.fuzz.js`

従来の fuzz harness (`parse.fuzz.js` 等) は libFuzzer のランダムバイト列をそのまま UTF-8 文字列として扱うため、大半の入力は ISO 8601 の構文を満たさず早期リジェクトされる。

`grammar.fuzz.js` は **buf のバイト列で文法の生成規則を駆動**し、構文的に正しい ISO 8601 文字列を系統的に生成する:

```
ISOdatetime = date (sep time)? (timezone)?
date        = YYYY-MM-DD | YYYYMMDD | YYYY-DDD | YYYYDDD | GGGG-Www-D | GGGG-Www | GGGGWwwD | GGGGWww | YYYY-MM | YYYY
time        = HH:mm:ss.SSS | HH:mm:ss,SSS | HH:mm:ss | HH:mm | HHmmss.SSS | HHmmss,SSS | HHmmss | HHmm | HH
timezone    = Z | ±HH:mm | ±HHmm
sign        = ± (6-digit year) ｜ none (4-digit year)
```

文法に従うことで:
- `parseCommonISOExtended` / `parseISOWithTable` / `parseCommonISO` の全フォーマット分岐を確実に通る
- 構文的に正しいが意味的に不正な文字列（`2024-02-30`、非閏年の `2023-366`、週53がない年の `2024-W53` など）を大量生成 → overflow 検出ロジックの検証
- 拡張形式と基本形式の混在（extended date + basic time 等）を網羅

libFuzzer の coverage guidance と組み合わせることで、ランダム fuzz では到達しにくい deep path を効率的に探索する。

**実行**:
```bash
bun run fuzz:grammar        # 10,000 iterations
bun run fuzz:grammar:quick  # 500 iterations
```

### 4. ミューテーションテスト（oracle 比較）

**手段**: `test/mutation.test.ts` + `fast-check`

`src/moment.ts` に 10 種類のバグを機械的に注入し、fast-check で生成したランダム入力に対して
本家 moment.js が検出できるかテストする。

| ミューテーション | 変更内容 |
|-----------------|---------|
| valueOf: off by +1ms | `return this._d.getTime()` → `+ 1` |
| add days: wrong direction | `getDate() + days` → `- days` |
| diff: sign flipped | `this - other` → `other - this` |
| isBefore: comparison flipped | `<` → `>` |
| isAfter: comparison flipped | `>` → `<` |
| add months: wrong direction | `d.setMonth(newMonth)` → `curMonth - months` |
| startOf: hours set to noon | `setHours(0,...)` → `setHours(12,...)` |
| isValid always returns true | `return this._isValid` → `return true` |
| clone: CoW protection removed | CoW guard 削除 |
| endOf: no -1ms | `setMilliseconds(-1)` → `0` |

**パターン**:
```typescript
// ミューテーション注入
let mutated = original.replace(/return this\._d\.getTime\(\)/, 'return this._d.getTime() + 1')
fs.writeFileSync(filePath, mutated)

// oracle 比較
fc.assert(fc.property(fc.date({ noInvalidDate: true }), (input) => {
  return mutatedMoment(input).valueOf() === originalMoment(input).valueOf()
}), { numRuns: 100 })
```

### 5. メタモルフィックテスト

**手段**: `test/properties/metamorphic.test.ts`

oracle を必要としない自己整合性検証。moment2 の出力が数学的・論理的に矛盾しないことを確認する。

主な不変条件:
- add/subtract ラウンドトリップ `m.add(n, u).subtract(n, u) === m`
- diff の反対称性 `diff(a, b) === -diff(b, a)`
- 同一シフト後の diff 不変性
- 比較の排他性 `isBefore + isSame + isAfter === 1`
- startOf/endOf のベキ等性
- `startOf ≤ original ≤ endOf`
- クローン独立性
- UTC⇔Local ラウンドトリップ
- utcOffset 不変条件

### 6. 等価クラステスト（equivalence partitioning）

**手段**: `test/properties/equivalence.test.ts`

入力空間を有効/無効/境界のクラスに分割し、各クラスから代表値を選んで oracle 比較する。

| 分割軸 | クラス |
|--------|--------|
| 月 | 有効(0,6,11), 下限異常(-1,-12), 上限異常(12,13) |
| 日 | 安全(1-28), 月境界(29-31), 負/0, 超過(32+) |
| 時/分/秒/ms | 有効範囲, 範囲超過, 負 |
| 年 | 負, 0, 2桁, 9999, 10000 |
| 閏年 | 400で割れる, 100で割れる, 4で割れる, その他 |

### 7. ロケールテスト

**手段**: `test/locale/*.test.ts` (138 ファイル)

moment.js のロケールテスト (`moment/src/test/locale/*.js`) から `scripts/generate-locale-tests.mjs` で自動生成。
moment2 の全ロケール (138) の出力を検証する。

### 8. Delta Debugging（障害入力最小化）

**手段**: `test/fuzz/ddmin.ts` / `test/fuzz/delta-debug.mjs`

fuzz で発見した不一致入力を **ddmin アルゴリズム** (Zeller & Hildebrandt) で最小化する。
`libFuzzer` の組み込み `-minimize_crash=1` に加え、操作列の削減にも対応している。

**ddmin アルゴリズム**:
- 入力を n 個のチャンクに分割
- 各チャンクを除去してテストが通るか確認
- 除去可能なチャンクがあれば永久除去し n を減少
- 除去できない場合は n を 2 倍にして粒度を上げる
- 収束するまで繰り返す

**関数**:
- `ddmin<T>(input: T[], test): T[]` — 汎用
- `ddminString(input: string, test): string` — 文字列入力用ユーティリティ
- `ddminArray<T>(input: T[], test): T[]` — 配列入力用ユーティリティ

**実行例**:
```bash
# crashファイルをddminで最小化（デフォルト: parse harness）
bun test/fuzz/delta-debug.mjs crash-xxxxxx

# harness指定
bun test/fuzz/delta-debug.mjs crash-yyyyyy utc
```

**実績**: 既存の crash ファイルに対して:
- `-000700-005` (11 B) → `-000700-05` (10 B, 1 B削減)
- `93280531 09-3911` (16 B) → `9328031 09-11` (13 B, 3 B削減)

### 9. スナップショット / A/B 比較

**手段**: `scripts/snapshot.sh`

`scripts/snapshot.sh save` で `src/` 全体を `src.snapshot/` に保存。
`scripts/snapshot.sh compare` で現行 `src/` と比較用の `snapshot/` を入れ替え、A/B パフォーマンス比較が可能。

## Differential Testing の全体構造

```
                     ┌─────────────────────────┐
                     │   Random / Fuzz Input   │
                     │  (fast-check / libFuzzer)│
                     └──────────┬──────────────┘
                                │
                 ┌──────────────┴──────────────┐
                 │                             │
         ┌───────▼───────┐            ┌───────▼───────┐
         │   moment2     │            │  moment.js    │
         │ (src/index.ts)│            │ (moment/moment)│
         └───────┬───────┘            └───────┬───────┘
                 │                             │
                 └──────────────┬──────────────┘
                                │
                         ┌──────▼──────┐
                         │   Compare   │
                         │  output === │
                         └──────┬──────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
               ✅ 一致                 ❌ 不一致
               (pass)              (bug / regression)
```

## テスト実行コマンド

| コマンド | 内容 |
|----------|------|
| `bun test` | core + moment2 + tree-shaking + timezone + mutation |
| `bun run test:hard` | core + properties + locale + fuzz |
| `bun run fuzz` | parse fuzz (60秒, minimize_crash=1) |
| `bun run fuzz:quick` | 全 8 fuzz (各 500 runs) |
| `bun run fuzz:grammar` | Grammar-based fuzz (10,000 runs) |
| `bun run fuzz:grammar:quick` | Grammar-based fuzz (500 runs) |
| `bun run fuzz:ddmin -- crash-xxx` | crash ファイルを ddmin 最小化 |
| `bun test test/properties/` | プロパティテストのみ |
| `bun test test/properties/basic.test.ts` | 特定ファイルのみ |
| `bun run bench` | パフォーマンスベンチマーク |
| `bun run bench:mem` | メモリベンチマーク |

## テストの追加方法

### Property-based test を追加する

```typescript
import fc from 'fast-check'
import moment from '../../src/index.ts'
import originalMoment from '../../moment/moment'

test('your feature matches moment', () => {
  fc.assert(
    fc.property(yourArbitrary, (input) => {
      expect(moment(input).yourMethod()).toBe(originalMoment(input).yourMethod())
    }),
    { numRuns: 100 }
  )
})
```

### Fuzz harness を追加する

```javascript
import _moment from '../../dist/index.js'
import _originalMoment from '../../moment/moment.js'

const moment = _moment
const originalMoment = _originalMoment

export function fuzz(buf) {
  // buf: Buffer — libFuzzer からのランダム入力
  const input = buf.toString('utf-8')
  const m2 = moment(input)
  const mOrig = originalMoment(input)

  if (m2.isValid() !== mOrig.isValid()) {
    throw new Error(`Validity mismatch: ...`)
  }
  if (m2.format() !== mOrig.format()) {
    throw new Error(`Format mismatch: ...`)
  }
}
```

### Mutation test を追加する

`test/mutation.test.ts` の `makeMutations([...])` に Mutation オブジェクトを追加:

```typescript
{
  name: 'description',
  file: 'src/moment.ts',
  patterns: [[/original code/g, 'mutated code']],
  inputs: fc.someArbitrary(),
  testFn: (input) => mutatedMoment(input).method() === originalMoment(input).method(),
}
```

## Pairwise / Combinatorial Testing について

**結論**: 代替として Grammar-Based Fuzzing (3.1節) を採用した。Pairwise は導入しない。

### 検討内容

moment2 のパラメトリックなAPI群（配列コンストラクタ `moment([y,M,d,h,m,s,ms])`、ISOフォーマット選択テーブル、durationオブジェクト構築など）は、パラメータ間の2-way interaction が発生しうる。Pairwise testing はこれらの組み合わせを系統的に網羅する手法だが、以下の理由で grammar-based fuzzing を優先した:

1. **Oracleの存在がランダムテストを極めて強力にしている**
   本家 moment.js を oracle とする property-based testing (fast-check, 14.8k assertions) および coverage-guided fuzzing (52k iterations) が既に存在する。確率的に主要なパラメータペアは既に網羅されており、pairwise が新たに発見するバグは期待できない。

2. **Grammar-based fuzzing の方が深いパスを探索できる**
   ISO 8601 文字列のパースでは、構文レベルで有効な入力を生成できる grammar-based approach の方が、pairwise よりも「parse の深いパスを通るテスト」を効率的に生成できる。

3. **優先順位**
   既存の36件のテスト失敗（locale・equivalence の pre-existing）が未解決であり、pairwise 導入より grammar-based fuzzing の実装の方が工数対効果が高い。

### 参考: pairwise の候補領域

| 領域 | パラメータ数 | 分割数 | ペアワイズテスト数 |
|------|-------------|--------|-------------------|
| 配列コンストラクタ overflow | 7 (y/M/d/h/m/s/ms) | 各5 | ~55 |
| ISO parse format 選択 | 13日付×9時刻×3TZ | 351全数 | 全数でも現実的 |
| format token 相互作用 | 〜20代表トークン | 各2-3 | ~200 |

上記領域は grammar-based fuzzing (3.1節) および既存の random + oracle テストでカバーされている。

## ツール一覧

| ツール | 用途 |
|--------|------|
| `bun:test` | テストランナー |
| `fast-check` | プロパティベーステスト |
| `@jazzer.js/core` | Coverage-guided fuzzing (libFuzzer) |
| `oxlint` | リント (`bun run lint`) |
| `typescript` | 型検査 (`bun run typecheck`) |
| `knip` | デッドコード検出 |
| `fallow` | 依存関係解析 |
