# Performance Techniques

mmntjs で現在採用している、実装レベルの高速化手法のまとめ。

この文書は「コード上で何をしているか」を整理するためのカタログであり、「なぜ効くのか」を理論的に掘るための文書ではない。

実際の性能改善要因も、L2 キャッシュやメモリアクセスだけには限られない。allocation 削減、Date/regex/Intl の回避、繰り返しパースの省略、遅延評価、整数演算化、キャッシュ再利用など、複数の要因が混ざっている。

「なぜ効くか」を engine / runtime 観点も含めて見たい場合は [ANALYSIS.md](./ANALYSIS.md) を参照。

この文書は現行コードに存在する手法を主に扱う。commit 履歴全体には、その前段階の実装、後で吸収された中間形、捨てられた試行も含まれる。

以下のコード例は説明のために簡略化している。実際のホットパスは `src/moment-class.ts`、`src/display/format.ts`、`src/core/factory-*.ts`、`src/parse.ts` に分散している。

## 1. フィールドキャッシュ（Decomposed Date Cache）

対象ホットパス: getter、format、calendar math

**問題**: `d.getFullYear()` などの Date API は毎回 V8 のネイティブ関数を呼ぶ。プロトタイプチェーンを辿り、C++ バインディングを経由する。

**解決**: Moment インスタンスに `$y $M $D $W $H $m $s $ms` の 8 フィールドを生やし、constructor/startOf/add で一度だけ Date から読み取ってキャッシュする。Getter は単なるプロパティ読み取り (1 load) になる。

**効果**: getter: 250ns → 10-25ns (10-25x)

```
// Before: プロトタイプチェーン + C++ 呼び出し
year() { return this._getD().getFullYear(); }

// After: キャッシュフィールドの単純参照
year() { return this._isValid ? this.$y : NaN; }
```

## 2. Lazy Field Initialization（`_dirty` flag）

対象ホットパス: `moment()`、getter、mutation 後の read

**問題**: コンストラクタで毎回 `_refreshFields()` を呼ぶと、Date の生成＋8 フィールド読み取り＋8 プロパティ書き込みが必ず発生する。`moment()` のように結果を使わずに捨てるケースでは全て無駄。

**解決**: `_dirty` フラグを導入。コンストラクタでは `_refreshFields()` を呼ばず、`_dirty = true` だけセット。getter 初回アクセス時に `_ensureFields()` で実体化する。

**効果**: `moment()` 130ns → 59ns (2.2x)。特に破棄される Moment が多いケースで効く。

```typescript
// constructor: フィールド初期化を遅延
this._dirty = this._isValid;
// _refreshFields() は呼ばない

// getter: 初回アクセス時に初期化
year() {
  if (!this._isValid) return NaN;
  this._ensureFields();  // 最初だけコストがかかる
  return this.$y;        // 2回目以降は _ensureFields が瞬殺
}

private _ensureFields(): void {
  if (this._dirty) {
    this._dirty = false;
    this._refreshFields();
  }
}
```

## 3. エラー状態の分離（`_cold` を減らす）

対象ホットパス: `isValid()`、constructor fast path

**問題**: `_cold` オブジェクトに `_i` (input), `_f` (format) など常にある情報を入れていたため、全ての Moment に `_cold` が生えていた。`isValid()` の fast path (`if (!cold) return true`) が死んでいた。

**解決**: `_i`, `_f`, `_strict` は `_cold` から出して直接インスタンスプロパティにする。`_cold` はエラー時（overflow, empty, nullInput, invalidMonth 等）のみ生成する。

**効果**: `isValid()` が 7 プロパティアクセス → 1 null check に戻る。`_cold` 確保自体が消える。

```typescript
// Before: 常に _cold がある
_cold = { _i: "2024-01-15", _f: "YYYY-MM-DD", ... }
isValid() {
  if (!this._isValid) return false;
  const cold = this._cold;       // 必ず存在する
  if (!cold) return true;        // ← デッドコード
  if (cold._overflow >= 0) ...   // 必ずチェックされる
}

// After: エラー時のみ _cold
_cold = undefined  // 正常時
isValid() {
  if (!this._isValid) return false;
  const cold = this._cold;
  if (!cold) return true;        // ← 正常時はここで終了
  if (cold._overflow >= 0) ...   // エラー時のみ到達
}
```

## 4. 正規表現より先に Digit Parser を当てる

対象ホットパス: ISO 文字列パース

**問題**: ISO パースはホットパス。最初に正規表現へ流すと、パターン起動コスト、match 配列の確保、余分な文字列処理が先に発生する。

**解決**: 高速 ISO パスは `charCodeAt` ベースを維持しつつ、`parse4Digits`、`p1`、`p2`、`p3`、`p4`、`p5`、`p6` のような小さな digit helper で数値化する。共通点は「regex ではなく生の文字列バイトを直接読む」こと。

**効果**: 実装の helper 境界は変わっても、本質的な勝ち筋は変わらない。すなわち「regex plumbing より digit arithmetic」。

```typescript
// 現行スタイル: raw charCodeAt を使う小さな helper
const year = parse4Digits(str, 0);
const month1 = p2(str, 5);
const day = p2(str, 8);

function p2(str: string, idx: number): number | null {
  const a = str.charCodeAt(idx), b = str.charCodeAt(idx + 1);
  if (a < 48 || a > 57 || b < 48 || b > 57) return null;
  return (a - 48) * 10 + (b - 48);
}
```

## 5. `createFromString` での Fast Path バイパス

対象ホットパス: string factory entrypoint

**問題**: `parseString()` が成功しても、汎用 constructor 経路には overflow bookkeeping、fallback parse、formatted-input 系の処理がまだ残っている。

**解決**: パース結果に `_hasDate` が立っていれば、full / lite の両 factory が先頭で即判定し、`createDateSafe(...)` で直ちに `Moment` を組み立てる。

**効果**: よくある ISO 文字列は余分な parse 段を踏まない。同じショートカットが `src/core/factory-shared.ts` と `src/core/factory-lite-impl.ts` の両方にある。

```typescript
if (parsed._hasDate !== undefined) {
  return new Moment({
    _d: createDateSafe(
      parsed.year, parsed.month, parsed.day,
      parsed.hour ?? 0, parsed.minute ?? 0,
      parsed.second ?? 0, parsed.millisecond ?? 0,
      parsed.offset !== undefined,
    ),
    _offset: parsed.offset,
    _isUTC: parsed.offset !== undefined,
    _i: str,
  });
}
// 汎用の parsed-object 経路は、上を通らなかった場合だけ実行される
```

## 6. Predicate Pushdown と parse hot/cold 分離

対象ホットパス: format 指定なしの `parseString()`

**問題**: 汎用 string parser は、先頭数文字を見れば不要だと分かる処理まで早い段階で走らせがち。locale preparse、広い ISO 判定、RFC 判定、regex fallback が全部重なると無駄が大きい。

**解決**: `parseString()` はできるだけ早く reject / route する。
- `en` かつ no-format は専用 fast path
- `charCodeAt` で digit/slash/sign start を先に分類
- `parseCommonISO` / `parseCommonISOExtended` を先に試す
- RFC 2822 や table-driven ISO は安い predicate が外れたときだけ到達する

```typescript
if (!format && (locale?._abbr ?? "en") === "en") {
  if ((len === 10 || (len >= 19 && len <= 29)) && str.charCodeAt(4) === 45 && str.charCodeAt(7) === 45) {
    const fast = parseCommonISO(str);
    if (fast) return fast;
  }
}

const c0 = trimmed.charCodeAt(0);
const isDigit = c0 >= 48 && c0 <= 57;
const isSlash = c0 === 47;
const isSign = c0 === 43 || c0 === 45;
```

## 7. UTC カレンダー演算 (`ymdToEpochDays` + `daysInMonthFast`)

対象ホットパス: UTC の add/subtract/startOf/endOf の month/year 系

**問題**: UTC の month/year 変更を `Date` や `Date.UTC` ベースで処理すると、ネイティブ往復や month 正規化の余分なコストが乗る。

**解決**: UTC 変更経路は整数演算で閉じる。
- `normalizeMonth()` で month index を正規化
- `daysInMonthFast()` で月末日数をテーブル引き
- `ymdToEpochDays()` で Y/M/D を epoch days に戻す

```typescript
const tm = this.$y * 12 + this.$M + totalMonths;
const y = Math.floor(tm / 12);
const m = normalizeMonth(tm);
let d_ = this.$D;
if (d_ > 28) {
  const md = daysInMonthFast(y, m);
  if (d_ > md) d_ = md;
}

this._t =
  ymdToEpochDays(y, m, d_) * 86400000 +
  this.$H * 3600000 +
  this.$m * 60000 +
  this.$s * 1000 +
  this.$ms;
```

## 8. `_epochDaysToYMD` 算術による Date 生成回避

対象ホットパス: UTC field refresh

**問題**: UTC モードで `_refreshFields()` するとき、`new Date(t)` を作らずにフィールドを計算したい（メモリアロケーション回避）。

**解決**: `(t / 86400000)` から年月日を直接計算する。年 `1..9999` の範囲（epoch day `-719162..2932896`）では Ben Joffe の Julian map で年を復元し、March-based 年内日 `0..365` から year bump・月・日を 732-byte の packed table で一度に取得する。定数除算は上方丸め binary64 逆数との乗算に置き換え、商が非負 int32 なので `|0` で正確に切り捨てる（範囲内で全数検証済み）。tuple を生成せず一つの packed 整数を返す。範囲外は Howard Hinnant 実装へフォールバックし、同じ packed contract で返す。

```typescript
static _epochDaysToYMD(z: number): number {
  if (z >= -719162 && z <= 2932896) {
    const q = 4 * (z + 719468) + 3;
    const century = (q * INV_146097) | 0;
    const julian = q + century * 3 + (century & 3);
    const y = (julian * INV_1461) | 0;
    const dym = (julian - y * 1461) >>> 2;
    return (y + _PACKED_YEAR_OFFSET) * 512 + _MONTH_DAY[dym];
  }
  // 範囲外: 汎用 Hinnant（Math.floor 版）
}
```

## 9. フォーマット Fast Path (`formatCommonEn`)

対象ホットパス: よく使われる英語フォーマット

**問題**: フォーマットはトークンを1文字ずつ解釈する汎用ループを通る。`YYYY-MM-DD` のようなよくあるパターンでも毎回ループする。

**解決**: よく使われるフォーマット（`YYYY-MM-DD`, `HH:mm:ss`, `YYYY-MM-DDTHH:mm:ss.SSSZ`, `LL`, `LT`, `LLLL` など）を `src/display/format.ts` の switch で直接処理。Locale が `en`、Moment が valid、年が `0..9999` のときだけ有効。`_dirty` ならここで1回だけ field refresh する。

**効果**: `format('YYYY-MM-DD')`: 400ns → 35ns (11x)。PAD2 テーブルルックアップ＋テンプレートリテラル1発。

```typescript
function formatCommonEn(m: Moment, format: string): string | undefined {
  if (raw._l !== "en" || !raw._isValid) return undefined;
  const datePart = `${padYear(raw.$y)}-${PAD2[raw.$M + 1]}-${PAD2[raw.$D]}`;
  switch (format) {
    case "YYYY-MM-DD": return datePart;
    case "HH:mm:ss": return `${PAD2[raw.$H]}:${PAD2[raw.$m]}:${PAD2[raw.$s]}`;
    // ...
  }
}
```

## 10. フォーマットパイプラインの二段キャッシュ

対象ホットパス: 同じパターンの繰り返し format

**問題**: format の繰り返しコストは2種類ある。
- `L`, `LL`, `LLLL` など locale token の展開
- 展開後 format に対する render function 配列の再構築

**解決**:
- `expandLocaleCache` が `${locale}:${format}` 単位で locale token 展開をキャッシュ
- `formatRenderCache` が render function 配列をキャッシュ
- locale 側も `_localeRenderFns` を保持でき、locale 固有の再利用が可能

```typescript
const cacheKey = `${m._l}:${format}`;
const cached = expandLocaleCache.get(cacheKey);
if (cached !== undefined) return cached;

let fns = localeRenderCache?.[format];
if (!fns) {
  fns = formatRenderCache.get(format) ?? buildRenderFns(format);
}
```

## 11. Bytecode 化した format parser

対象ホットパス: 同じ format 文字列での `parseWithFormat()` 反復

**問題**: format 文字列を毎回 token 化し、毎回汎用 lookup で handler を探すと、反復パース時のオーバーヘッドが無視できない。

**解決**: format 文字列を一度 opcode 配列にコンパイルしてキャッシュし、以後は直接 handler 参照を実行する。handler 選択自体も、先頭文字と token 長を使う `switch` dispatch で縮めている。

```typescript
type Op =
  | { kind: "token"; handler: TokenHandler; name: string }
  | { kind: "literal"; value: string };

const BYTECODE_CACHE = new LruMap<string, Op[]>(1000);

function compileFormatToOpcodes(format: string): Op[] {
  const cached = BYTECODE_CACHE.get(format);
  if (cached) return cached;
  const ops = tokenizeFormat(format).map(...);
  BYTECODE_CACHE.set(format, ops);
  return ops;
}
```

## 12. コンストラクタの条件付き Cold Field コピー

対象ホットパス: constructor / parse result materialization

**問題**: `coldFieldKeys` 配列を毎回イテレーションして `_cold` オブジェクトを生成していた。ほとんどの Moment は cold data を持たない。

**解決**: 該当するキーがあるか先に OR チェックし、なければ完全スキップ。ある場合も個別の if で必要なフィールドだけコピー（配列イテレーションなし）。

```typescript
// Before: 21要素の配列ループ
for (const key of coldFieldKeys) {
  if (c[key] !== undefined) { ... }
}

// After: 必要なキーだけ直接チェック
if (c._overflow !== undefined || c._empty !== undefined || ...) {
  const cold = {};
  if (c._overflow !== undefined) cold._overflow = c._overflow;
  // ...
}
```

## 13. `clone()` での `_d` 共有回避

対象ホットパス: clone 後の mutation 正しさと eager allocation 回避

**問題**: `Object.create(Moment.prototype)` で clone すると `_d` が共有される。元の moment の Date を clone が書き換える。

**解決**: clone は `_d` をコピーせず `undefined` にし、`_t`（タイムスタンプ）だけ保持する。初回の setter アクセス時に `_getD()` が `new Date(this._t)` を生成するため、自動的に独立する。`_cold` のディープコピーも必要。

```typescript
clone(): Moment {
  const m = Object.create(Moment.prototype) as Moment;
  m._t = this._t;
  m._d = undefined;  // コピーしない！必要になったら _t から生成
  // cold はディープコピー
  const srcCold = this._cold;
  if (srcCold) {
    const dstCold = {};
    for (const key of Object.keys(srcCold)) dstCold[key] = srcCold[key];
    m._cold = dstCold;
  }
  return m;
}
```

## 14. 負の epoch でも安全な UTC floor/ceil helper

対象ホットパス: UTC `startOf` / `endOf`

**問題**: `Math.floor(t / unitMs) * unitMs` だけで UTC `startOf/endOf` を書くと、負の epoch 付近で扱いが雑になりやすい。Date ベースで逃げると不要な allocation も増える。

**解決**: `floorUnitEpoch()` と `endOfUnitEpoch()` を共通 helper にし、UTC の day/hour/minute/second の `startOf/endOf` を整数演算で閉じる。

```typescript
export function floorUnitEpoch(value: number, unitMs: number): number {
  return value - euclideanModulo(value, unitMs);
}

export function endOfUnitEpoch(value: number, unitMs: number): number {
  return value + (unitMs - 1) - euclideanModulo(value, unitMs);
}
```

## 15. `_dayOfWeek` 算術計算 (Tomohiko Sakamoto)

対象ホットパス: field mutation 後の曜日再計算

**問題**: `d.getDay()` で曜日を取得すると Date オブジェクトが必要。

**解決**: 年・月・日から直接曜日を計算する公式。月の補正テーブル＋剰余のみ。`setFullYear(getDay)` より速い。

```typescript
function _dayOfWeek(y: number, m: number, d: number): number {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  y -= m < 3 ? 1 : 0;
  return ((y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + t[m] + d) | 0) % 7;
}
```

---

## 16. `format()` が native `Intl.DateTimeFormat` より 10-22x 速い理由

この節は個別ケースの説明であり、mmntjs の全ての最適化を説明する一般理論ではない。

**問題**: なぜ mmntjs の `format('YYYY-MM-DD')` (〜40ns) が Node.js ネイティブの `Intl.DateTimeFormat.format()` (〜600ns) より速いのか？

**答え**: Intl.DateTimeFormat は **汎用 ICU パイプライン** を通す。mmntjs は **キャッシュされた整数フィールドの直結合**。

| 処理ステップ | Intl.DateTimeFormat | mmntjs |
|-------------|-------------------|---------|
| Locale 解決 | CLDR データから locale 解決 (ICU C++) | なし ("en" 固定) |
| Calendar 解決 | Islamic / Buddhist / Japanese 等の変換テーブル引き | なし (Gregorian 固定) |
| Numbering system | Latin / Arabic-Indic / Thai 桁の解決と変換 | なし (ASCII 固定) |
| 月日解決 | カレンダー依存の月名/曜日名取得 | なし (整数直書き) |
| String assembly | ICU パターンに沿った locale-aware 文字列構築 | テンプレートリテラル1発 |

```typescript
// mmntjs (en, Gregorian, ASCII): 3 field reads + 2 PAD2 lookups + 1 template literal
return `${padYear(this.$y)}-${PAD2[this.$M + 1]}-${PAD2[this.$D]}`;
// → ~40ns, 0 ICU calls, 0 locale resolution, 0 calendar conversion

// Intl.DateTimeFormat: ICU C++ pipe を通過 (数値→文字列変換も含む)
const fmt = new Intl.DateTimeFormat("ar-SA", { ... });
fmt.format(date);  // → ~600ns, ICU C++ calls, locale+calendar+digit resolution
```

**結論**: 単純な `YYYY-MM-DD` フォーマットには Intl.DateTimeFormat はオーバースペック。mmntjs の format は「キャッシュされた整数の sprintf」であり、ICU パイプラインと比較するのがナンセンスなほど軽い。

## 17. 計測結果

数値は時点ごとのスナップショットだが、履歴全体の流れとしては次の順で改善が積まれてきた。
- まず construction / getter コスト
- 次に mutation と UTC 算術
- 次に parse の分類と dispatch
- 最後に format の specialized path と cache layering

この順番には意味がある。後段の多くの改善は、前段で shape 安定化、lazy field refresh、UTC 整数演算化が済んでいることを前提に効いている。

最新のベンチマーク数値は [BENCHMARKS.md](./BENCHMARKS.md) を参照（2026-05-16, macOS arm64 M4）。

代表値（抜粋）:

| Operation | Tech | effect |
|-----------|------|--------|
| parse ISO string | 1, 4, 5 | mmntjs **281ns** vs moment.js 4.10μs (**15x**) |
| format YYYY-MM-DD | 1, 8 | mmntjs **35ns** vs moment.js 413ns (**12x**) |
| getters (7 fields) | 1 | mmntjs **27ns** vs moment.js 208ns (**7.6x**) |
| diff days | 1, 12 | mmntjs **18ns** vs moment.js 413ns (**24x**) |
| moment() | 2 | mmntjs **52ns** vs moment.js 280ns (**5.4x**)
