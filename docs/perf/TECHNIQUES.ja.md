# Performance Techniques

moment2 で使っている高速化手法のまとめ。特に「メモリアクセスが遅い」という前提に立った L2 キャッシュ観点の設計。

## 1. フィールドキャッシュ（Decomposed Date Cache）

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

## 4. インライン Digit Extraction（charCodeAt 直接計算）

**問題**: `parseCommonISO` で `four()`/`two()` 関数を呼ぶと、スタックフレーム＋関数呼び出しのオーバーヘッドがある。

**解決**: `charCodeAt(i) - 48` を直接インライン展開。`((c0)*10 + c1)*100 + (c2*10 + c3)` のように一気に計算。

**効果**: parse: 60ns → 40ns (1.5x)。関数呼び出しが消え、分岐予測が当たりやすくなる。

```typescript
// Before: 関数呼び出し4回
const year = four(str, 0);  // two(str,0)→two(str,2)→計算
const month1 = two(str, 5);
const day = two(str, 8);

// After: インライン charCodeAt
const y0 = str.charCodeAt(0) - 48, y1 = str.charCodeAt(1) - 48;
const y2 = str.charCodeAt(2) - 48, y3 = str.charCodeAt(3) - 48;
const year = y0 * 1000 + y1 * 100 + y2 * 10 + y3;
const m0 = str.charCodeAt(5) - 48, m1 = str.charCodeAt(6) - 48;
const month1 = m0 * 10 + m1;
```

## 5. `createFromString` での Fast Path バイパス

**問題**: `parseCommonISO` が成功した後も、`checkOverflow()`、`createUTCDate()`/`createDate()`、フォーマット検出の正規表現（3-4回）を実行していた。`str.trim()` も余分。

**解決**: `_hasDate` フラグをパース結果に付けておき、`createFromString` の先頭でチェック。該当すれば即座に `new Date(...)` して Moment を返す。18行で完結。

**効果**: parse ISO: 500ns → 330ns (1.5x)。正規表現エンジンの起動を回避。

```typescript
if (parsed._hasDate !== undefined) {
  const { year, month, day, hour, minute, second, millisecond, offset } = parsed;
  const d = offset !== undefined
    ? new Date(Date.UTC(year!, month!, day!, ...))
    : new Date(year!, month!, day!, ...);
  return new Moment({ _d: d, ... });
}
// 従来の checkOverflow + 正規表現 + createDate は上を通らなかった
```

## 6. `_addSimple` DAY の while→if-else 最適化

**問題**: `add(1, 'day')` で `while (this.$D > daysInMonth(...))` のループが常に実行される。1日加算で月を跨ぐことは稀だが、ループの条件チェックは毎回走る。

**解決**: `rounded` が小さい場合は `if-else` で1回だけチェック。`daysInMonth()` の呼び出しも最小化。

```typescript
// Before: while ループ（毎回 daysInMonth を呼ぶ）
this.$D += rounded;
while (this.$D > daysInMonth(this.$y, this.$M)) {
  this.$D -= daysInMonth(this.$y, this.$M);
  this.$M++;
}

// After: 稀なケースだけ処理
this.$D += rounded;
const maxDay = daysInMonth(this.$y, this.$M);
if (this.$D > maxDay) {
  this.$D -= maxDay;
  this.$M++;
  if (this.$D > daysInMonth(this.$y, this.$M)) {
    this.$D = daysInMonth(this.$y, this.$M);
  }
}
```

## 7. `_epochDaysToYMD` 算術による Date 生成回避

**問題**: UTC モードで `_refreshFields()` するとき、`new Date(t)` を作らずにフィールドを計算したい（メモリアロケーション回避）。

**解決**: `(t / 86400000)` から年月日を直接計算するアルゴリズムを使用。加算・減算・剰余のみ。Tomohiko Sakamoto の曜日計算も同様。

```typescript
private static _epochDaysToYMD(z: number): [number, number, number] {
  z += 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + ...) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  return [y + (m <= 2 ? 1 : 0), m - 1, d];
}
```

## 8. フォーマット Fast Path (`formatCommonEn`)

**問題**: フォーマットはトークンを1文字ずつ解釈する汎用ループを通る。`YYYY-MM-DD` のようなよくあるパターンでも毎回ループする。

**解決**: よく使われるフォーマット（`YYYY-MM-DD`, `HH:mm:ss`, `YYYY-MM-DDTHH:mm:ss.SSSZ` など）を switch で直接処理。Locale が "en" かつ年が 0-9999 のときだけ有効。

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

## 9. LRU キャッシュによるフォーマット展開結果の再利用

**問題**: `LLLL` などのロケール依存トークンは毎回展開すると重い。

**解決**: `LruMap<string, string>(500)` に展開結果をキャッシュ。同じロケール＋同じフォーマットなら2回目以降はキャッシュヒット。

```typescript
const expandedCacheKey = `${locale || "en"}:${format}`;
let expandedFormat = expandedFormatCache.get(expandedCacheKey);
if (!expandedFormat) {
  expandedFormat = format.replaceAll(/LTS|LT|.../g, ...);
  expandedFormatCache.set(expandedCacheKey, expandedFormat);
}
```

## 10. コンストラクタの条件付き Cold Field コピー

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

## 11. `clone()` での `_d` 共有回避

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

## 12. `differenceInCalendarDays` 最適化

**問題**: diff は `valueOf()` の差を計算して割るだけ。通常はこれで十分。

**解決**: `diff(input, 'days')` は単に `(this._t - other._t) / 86400000` の floor。moment のキャッシュから直接計算するので Date 経由より速い。

```typescript
case DAY: {
  const diff = this.valueOf() - other.valueOf();
  return Math.floor(diff / 86400000);
}
```

## 13. `_dayOfWeek` 算術計算 (Tomohiko Sakamoto)

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

## 14. `format()` が native `Intl.DateTimeFormat` より 10-22x 速い理由

**問題**: なぜ moment2 の `format('YYYY-MM-DD')` (〜40ns) が Node.js ネイティブの `Intl.DateTimeFormat.format()` (〜600ns) より速いのか？

**答え**: Intl.DateTimeFormat は **汎用 ICU パイプライン** を通す。moment2 は **キャッシュされた整数フィールドの直結合**。

| 処理ステップ | Intl.DateTimeFormat | moment2 |
|-------------|-------------------|---------|
| Locale 解決 | CLDR データから locale 解決 (ICU C++) | なし ("en" 固定) |
| Calendar 解決 | Islamic / Buddhist / Japanese 等の変換テーブル引き | なし (Gregorian 固定) |
| Numbering system | Latin / Arabic-Indic / Thai 桁の解決と変換 | なし (ASCII 固定) |
| 月日解決 | カレンダー依存の月名/曜日名取得 | なし (整数直書き) |
| String assembly | ICU パターンに沿った locale-aware 文字列構築 | テンプレートリテラル1発 |

```typescript
// moment2 (en, Gregorian, ASCII): 3 field reads + 2 PAD2 lookups + 1 template literal
return `${padYear(this.$y)}-${PAD2[this.$M + 1]}-${PAD2[this.$D]}`;
// → ~40ns, 0 ICU calls, 0 locale resolution, 0 calendar conversion

// Intl.DateTimeFormat: ICU C++ pipe を通過 (数値→文字列変換も含む)
const fmt = new Intl.DateTimeFormat("ar-SA", { ... });
fmt.format(date);  // → ~600ns, ICU C++ calls, locale+calendar+digit resolution
```

**結論**: 単純な `YYYY-MM-DD` フォーマットには Intl.DateTimeFormat はオーバースペック。moment2 の format は「キャッシュされた整数の sprintf」であり、ICU パイプラインと比較するのがナンセンスなほど軽い。

## 計測結果

最新のベンチマーク数値は [BENCHMARKS.md](./BENCHMARKS.md) を参照（2026-05-07, macOS arm64 M4）。

代表値（抜粋）:

| Operation | Tech | effect |
|-----------|------|--------|
| parse ISO string | 1, 4, 5 | moment2 **281ns** vs moment.js 4.10μs (**15x**) |
| format YYYY-MM-DD | 1, 8 | moment2 **35ns** vs moment.js 413ns (**12x**) |
| getters (7 fields) | 1 | moment2 **27ns** vs moment.js 208ns (**7.6x**) |
| diff days | 1, 12 | moment2 **18ns** vs moment.js 413ns (**24x**) |
| moment() | 2 | moment2 **52ns** vs moment.js 280ns (**5.4x**)
