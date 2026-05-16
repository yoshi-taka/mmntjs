# Performance Analysis (Low-Level)

[TECHNIQUES.md](./TECHNIQUES.md) にある手法が、なぜ効きやすいのかを整理する文書。

これは最適化手法の一覧ではなく、その背後にある主要因の整理である。主に allocation pressure、hot-path specialization、deferred work、branch 挙動、object layout の安定性、重い subsystem の回避という観点で説明する。

このリポジトリの標準ベンチ runtime は Bun (JavaScriptCore) だが、Shape / Inline Cache / Deopt の説明として最も公開情報が多いので本文では V8 用語を使う。ただしそれは説明モデルであり、「V8 だけが本質」という意味ではない。高レベルな結論自体は Node 26 側でもクロスチェック済み。

実務上の役割分担はこう考えるとよい。
- `TECHNIQUES.md` = コードで何をしているか
- `ANALYSIS.md` = それがなぜ速くなりやすいか

並行して見るべき説明軸もある。
- アルゴリズム軸: 演算量や定数倍の仕事量そのものを減らす
- runtime / engine 軸: IC 安定化、inline しやすさ、deopt 回避
- allocation / GC 軸: `Date` や短命 helper object を減らす
- API specialization 軸: よく使われる moment.js 互換ケースを専用化する
- compatibility-aware design 軸: moment.js の意味論、DST、parse の癖を壊さない範囲で速くする

履歴を最初から見ると、うまく効いた最適化はだいたい次の反復に収束している。
- 早く classify し、早く reject する
- hot path と cold path を物理的にも論理的にも分ける
- calendar object の仕事を、意味論を保てる範囲で整数演算に置き換える
- 最終値だけでなく、展開済み表現やコンパイル済み表現もキャッシュする
- 互換性の主要ケースを専用化しつつ、端の挙動は壊さない

## 1. 安定した Object Layout

代表的な手法: field cache、`_cold` 分離、constructor の key-order 固定

**問題**: V8 は同じプロパティ順で作成されたオブジェクトを同じ Shape（Hidden Class）に割り当て、プロパティアクセスをインデックス計算（C++ の構造体アクセス相当）に最適化する。Shape が変わると Deopt → 再最適化が走る。

**moment2 の実装**:
- Constructor は常に同じ順序でプロパティを代入:
  `_isAMomentObject → _l → _isUTC → _offset → (_d) → _t → _isValid → _dirty → (_i) → (_f) → (_strict) → (_cold)`
- 条件付きの `_i/_f/_strict` 代入は `undefined` チェック後だが、代入タイミングは constructor 内で固定
- `$y $M $D $W $H $m $s $ms` は class field 初期化子でコンストラクタ先頭で生成される → 常に安定

**問題があった点**: 旧実装では `_cold` が全 Moment に生えていたが、`_cold` 内のプロパティは Moment ごとに異なる（`_overflow` があるものとないもの等）。これにより `_cold` へのアクセスが**メガモーフィック**（複数 Shape にまたがる）になっていた → V8 の Inline Cache が効かない。

**修正**: `_i/_f/_strict` を `_cold` から外し、Moment 本体に昇格。`_cold` が生成されるのはエラー時のみになり、通常時の Shape が完全に安定した。

**参考: V8 の IC 状態**:
- Monomorphic (1 shape) → 最適: 1 shape check + 固定オフセット load
- Polymorphic (2-4 shapes) → そこそこ: shape チェーンを線形探索
- Megamorphic (>4 shapes) → 低速: ハッシュテーブル lookup

```typescript
// 旧: _cold 内のアクセスがメガモーフィック
cold._overflow  // ある Moment は number、別の Moment は undefined → 別 Shape

// 新: _cold 自体が undefined か固定 Shape か
// エラー時は常に決まったキーが入る（_overflow,_empty,...）→ モノモーフィック
```

## 2. 分岐予測と分岐削減

代表的な手法: `_ensureFields`、day fast path、UTC arithmetic fast path

**問題**: 条件分岐が多いと CPU の分岐予測ミス (branch mispredict) が発生。パイプラインがフラッシュされ ~15 cycle のペナルティ。

**moment2 の工夫**:

### 2a. Getter の早期 return

```typescript
// Before: 毎回 _cold アクセス
year() { return this._isValid || (this._cold?._overflow ?? -1) < 0 ? this.$y : NaN; }

// After: ショートサーキット
year() {
  if (!this._isValid) return NaN;       // 予測: invalid は稀 → not taken
  this._ensureFields();                 // 予測: 2回目以降は _dirty=false → taken
  return this.$y;                       // 予測: 常に taken
}
```

分岐予測は「過去の履歴で次を予測」。Getter が連続して呼ばれるパターン（format 内で year/month/day/... を順に呼ぶ）では分岐履歴が安定し、予測ミスがほぼ起きない。

### 2b. `_ensureFields` の `_dirty` チェック

```typescript
private _ensureFields(): void {
  if (this._dirty) {   // 1回目だけ true、その後は常に false
    this._dirty = false;
    this._refreshFields();
  }
}
```

`_dirty` は初回アクセス後 `false` になる。2回目以降の `if (this._dirty)` は「常に不成立」と学習され、CPU の分岐予測子が "strongly not-taken" になる → 予測ミスゼロ。

### 2c. DAY add/subtract は timestamp fast path に残す

```typescript
if (this._isUTC) {
  this._t += rounded * 86400000;
  this._d = undefined;
} else {
  const dt = this._d ?? (this._d = new Date(this._t));
  dt.setDate(dt.getDate() + rounded);
  this._t = dt.getTime();
}

this._dirty = true;
```

`add(1,'day')` は十分にホットなので `add()` に専用経路がある。UTC は `_t` への整数加算1発、local は `Date#setDate` 1回だけで済ませ、どちらも field 再計算はその場でやらず `_dirty` を立てるだけにしている。最も多いカレンダー increment で汎用 unit mutation を踏まないのが効く。

### 2d. UTC カレンダー演算で `Date.UTC` と負 epoch の罠を避ける

```typescript
const tm = this.$y * 12 + this.$M + totalMonths;
const y = Math.floor(tm / 12);
const m = normalizeMonth(tm);
const d_ = this.$D > 28 ? Math.min(this.$D, daysInMonthFast(y, m)) : this.$D;

this._t =
  ymdToEpochDays(y, m, d_) * 86400000 +
  this.$H * 3600000 +
  this.$m * 60000 +
  this.$s * 1000 +
  this.$ms;
```

重要なのは次の2点。
- UTC の month/year 変更で `Date` 生成や `Date.UTC(...)` 呼び出しを避けられる
- `floorUnitEpoch` / `endOfUnitEpoch` により、UTC `startOf/endOf` を負の epoch でも安全に扱える。ここは `test/bench-regression.ts` で回帰監視している

## 3. String Representation と直接 digit parsing

代表的な手法: `parseCommonISO`、digit helper、fast path での trim 回避

**問題**: V8 の文字列には複数の内部表現がある。
- SeqString: 連続したメモリ領域（charCodeAt は O(1)、キャッシュフレンドリー）
- ConsString: 連結文字列（実際はツリー構造。charCodeAt が O(n)）
- SlicedString: 部分文字列（元のバッファを参照。charCodeAt は O(1) だが範囲が限られる）
- ThinString: 内部エイリアス

`str.trim()` は新しい**SlicedString** か **ConsString** を生成する可能性があり、以降の `charCodeAt` が遅くなる（特に ConsString は毎回ツリー探索）。

**moment2 の対応**:
- `parseCommonISO` は `str.trim()` を呼ばず、元の文字列に対して直接 `charCodeAt`
- `createFromString` の fast path でも `str.trim()` を排除
- 引数の文字列は moment() に渡される時点でメモリ上に SeqString として存在する可能性が高い。そのまま使うのが最速

```typescript
// Before: 余分な trim で ConsString が生成される可能性
const trimmedStr = str.trim();
if (/^\d{4}-\d{2}-\d{2}/.test(trimmedStr)) { ... }

// After: 元の SeqString を直接操作
if (len === 10 && charCodeAt(4) === 45 && charCodeAt(7) === 45) {
  const year = charCodeAt(0) * 1000 + ...;
}
```

## 4. 重い Subsystem を避ける: Regex

代表的な手法: fast ISO parser、`_hasDate` short-circuit

**問題**: V8 の irregexp エンジンは初回実行時に JIT コンパイルを行う。たとえ単純な正規表現でも、パターンコンパイル＋実行コンテキスト生成のオーバーヘッドがある。2回目以降はネイティブコードがキャッシュされるが、`RegExp.exec()` の戻り値（`RegExpMatchArray`）のアロケーションは毎回発生する。

**moment2 の対応**:
- `createFromString` 内のフォーマット検出正規表現（`/^\d{4}-\d{2}-\d{2}([T ]|$)/` 等）を fast path で完全バイパス
- `parseCommonISO` は正規表現ゼロ、`charCodeAt` ベース
- `parseISOWithTable` のテーブルイテレーションも `regex.exec()` を使うが、事前の全体マッチで落とせる文字列は落とす

```typescript
// Before: 3回の正規表現マッチ
const timeMatch = trimmedStr.match(/[T ](\d{2})(?::...)?/);
const hasT = trimmedStr.indexOf("T") >= 0;
if (/^\d{4}-\d{2}-\d{2}([T ]|$)/.test(trimmedStr)) { ... }
else if (/^\d{4}-\d{2}/.test(trimmedStr)) { ... }
else if (/^\d{4}/.test(trimmedStr)) { ... }

// After: 0回の正規表現
if (parsed._hasDate !== undefined) { /* 直接 Moment 生成 */ }
```

## 5. Allocation Pressure と GC

代表的な手法: lazy `_d`、`_cold` omission、clone strategy、UTC arithmetic helper

**問題**: オブジェクトの生成が多すぎると GC が頻発する。特に Young Generation (nursery) から Old Generation への昇格 (tenuring) は stop-the-world を引き起こす。

**moment2 で削減したアロケーション**:

| 削減したアロケーション | 理由 |
|---|---|
| `_cold` オブジェクト | 正常時は生成しない |
| `Date` オブジェクト | lazy init で不要時は生成しない |
| `checkOverflow` 用の中間オブジェクト | fast path でスキップ |
| `createUTCDate`/`createDate` の関数呼び出し | インライン `new Date(...)` |
| 正規表現の `RegExpMatchArray` | charCodeAt ベースで回避 |
| `str.trim()` の新しい文字列 | 省略 |
| clone での `_d` 重複 | `_d = undefined` + `_t` のみ保持 |

**Tenuring の観点**:
- benchmark 内で `moment()` が大量に生成＆破棄される → ほとんどが Young Gen で回収される
- fast path で Moment のバイトサイズが小さいほど Young Gen の GC が速い
- `_cold` 削減によって Moment のプロパティ数が減り、GC のマーク＆スイープ対象が減る

## 6. 安い文字列組み立て

代表的な手法: `PAD2`、`padYear`、`formatCommonEn`、token render cache

**問題**: JavaScript のテンプレートリテラル `` `${a}-${b}` `` は V8 によって Tagged Template として最適化される。初回以降は「テンプレートオブジェクト」がキャッシュされ、文字列結合が高速になる。

**moment2 の活用**:
- `formatCommonEn` の datePart 構築
- `_epochDaysToYMD` の戻り値タプル（実質テンプレート）
- フォーマット結果の文字列生成

`PAD2` テーブル（2桁のゼロ埋め済み文字列を事前計算）との組み合わせで、`padStart` よりも高速な文字列生成を実現。

```typescript
// padStart(2, '0') より PAD2[value] のテーブルルックアップ＋テンプレートリテラルが速い
const PAD2 = ["00","01","02",...,"99"];
return `${PAD2[this.$H]}:${PAD2[this.$m]}:${PAD2[this.$s]}`;
```

## 7. 小さく inline しやすい helper

代表的な手法: `_ensureFields`、`_dayOfWeek`、digit parser

**問題**: V8 の TurboFan JIT は関数の呼び出し回数（ヒット数）に応じてインライン展開を判断する。インライン展開されない関数呼び出しはスタフレーム生成＋`call`/`ret` 命令のオーバーヘッド。

**moment2 でインライン化が期待できるパターン**:

| 関数 | インライン化されやすい理由 |
|---|---|
| `_ensureFields()` | 呼び出し頻度が高い、小さい、条件分岐のみ |
| `year()`/`month()`/`date()` | ゲッター頻繁に呼ばれる、ボディが小さい |
| `_dayOfWeek()` | `add()` の YEAR/MONTH パスで呼ばれる、純粋関数 |
| `_getD()` | 多くのセッターから呼ばれる |

**インライン化を阻害していた点**:
- `_cold` のプロパティアクセス: `cold._overflow` は Shape が不定の場合、V8 はインライン化を諦める
- 関数呼び出しの引数オブジェクト: `checkOverflow(parsed)` の `parsed` は毎回異なる Shape を持つ可能性がある

## 8. Hot data を own property に置く

代表的な手法: `$y/$M/$D/$W/$H/$m/$s/$ms` field cache

**問題**: プロパティアクセスがインスタンス→プロトタイプ→プロトタイプとチェーンを辿るたびに Shape チェックが必要。

**moment2 の設計**:
- `$y $M $D $W $H $m $s $ms` → インスタンスの**Own Property**（Class field 初期化子で割り当て）
- 未設定の `declare` フィールド（`_overflow` 等）→ インスタンスに存在しないので `undefined` を返す（プロトタイプにもないので V8 が fast path で処理）
- `_cold` → own property（代入時のみ存在）

```
アクセスの深さ:
  this.$y       → own property (depth 0)      → 最速
  this._cold    → own property (depth 0)      → 速い
  this._cold._overflow → own (depth 0) → own (depth 1) → 2-hop
  this._i       → own property (depth 0, 常に存在) → 速い
  this.year()   → prototype method (depth 1)  → IC が効けばほぼコストゼロ
```

## 9. Calendar object より整数演算

代表的な手法: `ymdToEpochDays`、`_epochDaysToYMD`、`_dayOfWeek`、floor/ceil helper

**問題**: V8 は整数を Smi (Small Integer, 31-bit signed) として表現し、オブジェクトへのポインタにタグを付けて区別する。Smi 範囲を超えると HeapNumber にボックス化され、演算が遅くなる。

**moment2 の配慮**:
- 日付の各フィールド（年・月・日・時・分・秒）は Smi 範囲内（`-2^30 ~ 2^30-1`）
- `$ms`（ミリ秒）も 0-999 なので Smi
- `_t`（タイムスタンプ）は `Date.now()` で 1.7e12 程度 → Smi 範囲（≈1e9）を超えるので HeapNumber。ただし `_t` は直接演算される（文字列化除く）
- `_d`（Date オブジェクト）はポインタ。`new Date(_t)` のコスト大

**Smi を維持するために**:
```typescript
Math.floor(tm / 12)        // 結果は Smi 範囲
(this.$D + rounded) | 0   // ビット演算で整数強制 → Smi 維持
```

## 10. Monomorphic なメソッド呼び出し

代表的な手法: 安定した Moment shape、prototype method の再利用

**問題**: V8 は同じ関数が同じ Shape の `this` で呼ばれると、インラインキャッシュを最適化する。異なる Shape で呼ばれるとデオプティマイズ。

**moment2 の設計**: `Moment.prototype` 上のメソッドは常に `Moment` インスタンスを `this` として呼ばれる。Shape が（通常時は）完全に固定されているため、V8 はすべてのメソッド呼び出しをモノモーフィックに処理できる。

```typescript
// 全 Moment インスタンスは同じ Shape → メソッド呼び出しがモノモーフィック
a.year()  // this.shape === Moment_shape (IC: monomorphic)
b.month() // this.shape === Moment_shape (IC: monomorphic, same Shape)
```

**比較**: date-fns の `format(b, "yyyy-MM-dd")` は第一引数に `Date` を受け取る。Date の Shape も V8 で固定されているため同様にモノモーフィックだが、戻り値の Moment ラップが不要な分だけ速い。

## 11. Hot path から cold error machinery を外す

代表的な手法: `formatCommonEn`、`_cold` 分離、fast-path bypass

**問題**: `try { } catch { }` ブロックがある関数は V8 の TurboFan が最適化を制限する（例外ハンドリングのための安全なコード生成が必要）。

**moment2 の該当箇所**:
- `locale.ts` の `months()` 関数内の `try/catch`（ロケールデータのフォールバック処理）
- これらはホットパス（`format()` からのロケールアクセス）にある → 潜在的に遅い

**対策**: フォーマットの `formatCommonEn` はロケール "en" 固定なので try/catch パスを通らない。他のロケールでは try/catch が入る可能性がある。必要ならロケールキャッシュを事前構築することで回避可能。

## 12. 不要な汎用性を持ち込まない

代表的な手法: common format の special case、直接 string factory path、UTC/local の分岐専用化

**問題**: 汎用 parser / formatter は、先頭数文字を見れば行かなくてよい経路まで広く踏みがち。入力 routing が遅いと、それだけで余分な parse コストが乗る。

**moment2 の代表例**:
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

ここでの利得は V8 固有というより広い。
- reject できる入力で余分な仕事をしない
- 高コスト subsystem へ到達する回数を減らす
- よく来る入力クラスで分岐履歴が安定する
- hot/cold の分離が明確になり、JIT 全般に有利

## 13. 短命な parse object と shape 安定性

代表的な手法: parse result object、`_hasDate` による fast-path tag

**問題**: 関数が毎回同じキー順のオブジェクトリテラルを返す場合、V8 はその Shape を覚えて最適化する。

**moment2 の注意点**:

```typescript
// 毎回同じキー順 → Shape 安定（V8 が最適化可能）
function parseCommonISO(str) {
  if (len === 10) {
    return { year, month, day, _hasDate: true, _hasTime: false };
    //       ^^^^  ^^^^^  ^^^  ^^^^^^^^     ^^^^^^^^
  }
  return { year, month, day, hour, minute, second, millisecond, offset, _hasDate: true, _hasTime: true };
  //       ^^^^  ^^^^^  ^^^  ^^^^  ^^^^^^  ^^^^^^  ^^^^^^^^^^^  ^^^^^^  ^^^^^^^^     ^^^^^^^^
}
```

- 2つの return パスでキー順が異なる → 2つの Shape が存在
- 呼び出し元でどちらの Shape が来るかは文字列の形式に依存 → V8 は Polymorphic に適応する

関連する最近の変更として、format parsing 側も token 列を opcode 配列へコンパイルしてキャッシュするようになった。繰り返し parse では format 構造と token-handler dispatch の両方を再利用できる。

**改善**: キー順を統一すれば Monomorphic になるが、戻り値のオブジェクト自体は short-lived（parse 後に即消費される）なので実害は小さい。

## 14. 算術的な calendar helper

代表的な手法: `_dayOfWeek`、`ymdToEpochDays`、`_epochDaysToYMD`

**問題**: `d.getDay()` で曜日を取得するには Date オブジェクトが必要。また `setFullYear()` 後の曜日再計算も Date API 経由だと遅い。

**解決**: 年月日から直接曜日を計算する Tomohiko Sakamoto のアルゴリズムを使用。

```typescript
function _dayOfWeek(y: number, m: number, d: number): number {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  y -= m < 3 ? 1 : 0;
  return ((y + Math.floor(y / 4) - Math.floor(y / 100)
           + Math.floor(y / 400) + t[m] + d) | 0) % 7;
}
```

**なぜ速いか**:
- 整数演算のみ（加算・減算・除算・剰余）
- `Math.floor` は正の数なら冪等（V8 が最適化して即値除算に置き換える可能性）
- `| 0` で整数強制＋Smi 維持
- **テーブル `t` は 12 要素の小さな配列 → L1 キャッシュに乗る**
- Date オブジェクトの生成不要 → GC 負荷ゼロ
- インライン展開後は 3-5 命令で完了

**使用箇所**: `_addSimple` の YEAR/MONTH/QUARTER パスで、`setFullYear` の代わりに `_dayOfWeek(y, m, d_)` を直接計算する。Date API 呼び出しとそれに伴う Shape チェックを回避。

## 15. テーブルルックアップ大全

moment2 は計算コストを回避するために多数の**事前計算テーブル**を使用している。

### 15a. `PAD2` — 2桁ゼロ埋めテーブル

```typescript
const PAD2 = [
  "00", "01", "02", ..., "99",
];
```

`String(0).padStart(2, '0')` 相当だが、オブジェクト生成（String wrapper）＋メソッド呼び出し＋ヒープアロケーションが発生する `padStart` より遥かに速い。文字列リテラルとして既にメモリ上にあるため、アクセスは配列インデックス参照のみ。

### 15b. `leapLadder` / `nonLeapLadder` — 年間通算日テーブル

```typescript
const nonLeapLadder = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const leapLadder = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
```

**用途**: `dayOfYear()` で「月 + 日 → 年間通算日」を O(1) で計算。ループや加算が不要。

```typescript
dayOfYear(): number {
  return this.$D + (isLeapYear(this.$y) ? leapLadder : nonLeapLadder)[this.$M];
}
```

`isLeapYear` の分岐があるが、分岐予測は月によって安定する（同じ Moment で複数回呼ばれると学習される）。ladder 配列は L1 キャッシュに乗るサイズ（12要素 × 2 = 96 bytes）。

### 15c. `DAYS_IN_MONTH` — 月の日数テーブル

```typescript
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
```

2月だけ特別処理（`isLeapYear` で 28/29 を切り替え）、他はテーブル参照。ループ内で頻繁に呼ばれる `daysInMonth()` の高速化に貢献。条件分岐を月=1 の 1 回に絞っている。

### 15d. `isoDates` / `isoTimes` — ISO パース用フォーマットテーブル

```typescript
const isoDates: [string, RegExp, boolean?][] = [
  ['YYYYYY-MM-DD', /[+-]\d{6}-\d\d-\d\d/],
  ['YYYY-MM-DD',   /\d{4}-\d\d-\d\d/],
  ['GGGG-[W]WW-E', /\d{4}-W\d\d-\d/],
  ['GGGG-[W]WW',   /\d{4}-W\d\d/, false],    // allowT=false
  ['YYYY-DDD',     /\d{4}-\d{3}/],
  // ...全14エントリ
];
const isoTimes: [string, RegExp][] = [
  ['HH:mm:ss.SSSS', /\d\d:\d\d:\d\d\.\d+/],
  ['HH:mm:ss,SSSS', /\d\d:\d\d:\d\d,\d+/],
  // ...全9エントリ
];
```

**動作**: `parseISOWithTable` が EXTENDED_ISO_REGEX/BASIC_ISO_REGEX で全体マッチ → datePart に対して `isoDates` テーブルを線形探索 → timePart に対して `isoTimes` テーブルを線形探索 → 見つかったフォーマット文字列を結合して `parseWithFormat` に渡す。

**なぜテーブルか**: 
- if-else の連鎖より保守性が高い（エントリの追加・削除が容易）
- フォーマット文字列と正規表現が対になっているので、`parseWithFormat` に渡すトークン列を動的に構築できる
- **ただし**: テーブルが 14+9 エントリと小さいため線形探索でも十分。`parseCommonISO` で先に落とせるものは落とす（高速パス）。
- `allowT` フラグで time 部分の許可/禁止を制御（`GGGG-[W]WW` は日付のみ）

### 15e. `tokenByChar` — フォーマットトークンディスパッチテーブル

```typescript
const tokenByChar: Record<string, { tokens: TokenEntry[]; maxLen: number }> = {};
// キーは format token の先頭1文字:
//   Y → ["YYYY", "YYYYY", "YYYYYY", "Y", "YY", "YYY", "yo"]
//   M → ["MMMM", "MMM", "MM", "M", "Mo"]
//   D → ["DD", "D", "Do", "DDD"]
//   d → ["dddd", "ddd", "dd", "d"]
//   ...
```

`formatMoment` が1文字ずつ走査する際、`tokenByChar[ch]` でその文字で始まる全トークンを O(1) で取得。長いトークンからマッチを試みる（ソート済み）。**線形探索ではなくハッシュテーブル＋トークン長ソート**で高速化。

### 15f. `WEEKDAY_NAMES_MAP` / `monthNames` — 文字列→数値変換テーブル

```typescript
const WEEKDAY_NAMES_MAP: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};
const monthNames: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  january: 0, ..., december: 11,
};
```

**特性**: V8 では文字列キーの連想配列も Hidden Class ベースで最適化される（dictionary mode にならない限り）。短い文字列の lookup はハッシュ計算＋メモリ参照のみ。`Date.parse` 相当の処理を自前でテーブル参照に置き換え。

## 16. ビット演算による高速閏年判定

**問題**: 典型的な閏年判定は「4で割れる、100で割れない、または400で割れる」をそのまま実装するが、除算と剰余は CPU の整数除算ユニットを使い 10-30 cycle かかる。

**解決**: ビット演算で高速化。

```typescript
export function isLeapYear(y: number): boolean {
  if (!isFinite(y)) {return false;}
  if ((y & 3) !== 0) {return false;}  // 4の倍数でない → 即 false (87% がここで弾かれる)
  if (y % 100 !== 0) {return true;}   // 4の倍数かつ100の倍数でない → true
  return (y & 15) === 0;              // 100の倍数 → 400の倍数かチェック (& 15 = % 16 より高速)
}
```

**最適化の詳細**:
- `(y & 3) !== 0`: `y % 4 !== 0` と等価。AND 演算は 1 cycle。約87%の年がここで弾かれる（4年に1度だけ通過）。
- `(y & 15) === 0`: `y % 400 === 0` の代替。`& 15` は `% 16` より速いが、厳密には `% 400` と同値ではない。ただし **`% 400 === 0` ならば必ず `% 16 === 0`** が成り立つため、「400の倍数ならOK」の条件を間違えない。ただし「16の倍数だが400の倍数でない年」(例: 2004) をここで通過させてしまうように見えるが、前段の `(y & 3) !== 0` で落ちているか、`y % 100 !== 0` で true になっているため問題ない。「100の倍数」のみがこの行に到達し、`y & 15 !== 0` なら false を返す。

**実質**: 100の倍数で 400の倍数でない年（例: 1900）→ `y % 100 === 0` → fall through → `(1900 & 15) = 4` → !== 0 → false（正しい）。

## 17. CPU パイプラインに乗せる工夫

代表的な手法: switch dispatch、先頭文字分類、冗長 load 削減

### 17a. 整数強制による Smi 維持

V8 では 31-bit符号付き整数を Smi (Small Integer) としてタグ付きポインタで表現する。Smi 範囲外は HeapNumber にボックス化され、演算時にアンボックス化が必要。

```typescript
// | 0 で整数強制 → Smi 範囲を保証
const totalMonths = absRound(unit === YEAR ? amount * 12 : unit === QUARTER ? amount * 3 : amount);
const tm = this.$y * 12 + this.$M + totalMonths;
const y = Math.floor(tm / 12);   // Math.floor は Smi 維持可能
const m = ((tm % 12) + 12) % 12; // 剰余も Smi
```

すべての `$` フィールドは 0-9999 の範囲（`$ms` は 0-999）で Smi 範囲内。演算チェーンも Smi に収まる。

### 17b. テンプレートリテラルの V8 最適化

V8 は Tagged Template を検出すると「Template Object」を事前生成し、以降の呼び出しではオブジェクト生成をスキップする。`${expr}` の式だけ毎回評価する。通常の文字列結合より効率的。

```typescript
// PAD2 テーブル参照 + テンプレートリテラル = 分岐なし、関数呼び出しなし
return `${PAD2[this.$H]}:${PAD2[this.$m]}:${PAD2[this.$s]}`;
```

IR 的には `ToString(PAD2[load $H])` + `ToString(PAD2[load $m])` + `ToString(PAD2[load $s])` がインライン展開され、V8 の文字列ビルダーで最適結合される。

### 17c. 冗長 load の削減

```typescript
// 悪い例: 4回の _getD() 呼び出し（4回のプロパティチェック＋条件分岐）
this._getD().setUTCHours(h);
this._getD().getUTCHours();
this._getD().getTime();
this._getD().getTimezoneOffset();

// 良い例: 1回の _getD() を変数に束縛
const d = this._getD();
d.setUTCHours(h);
this.$H = d.getUTCHours();
this._t = d.getTime();
this._offset = -d.getTimezoneOffset();
```

`_getD()` は `this._d` の存在確認＋`_ensureFields()`＋条件付き `new Date()` を含むため、高コスト。1回の変数束縛でこれらの load を削減。V8 の CSE (Common Subexpression Elimination) が効かないケースでも手動で削減している。

### 17d. generic lookup より switch dispatch

最近の parse-format 最適化では、format 文字列を opcode 配列へコンパイルし、handler 解決を先頭文字と token 長の入れ子 `switch` に落としている。

```typescript
switch (cc) {
  case 89 /* Y */:
    switch (len) {
      case 6: return hYYYYYY;
      case 5: return hYYYYY;
      case 4: return hYYYY;
    }
}
```

効く理由は次の通り。
- 分岐構造が単純で反復的
- `Y`, `M`, `D`, `H`, `m`, `s` のようなホット token 群が短い dispatch path に乗る
- 同じ format 文字列では tokenize と handler 解決の両方を opcode cache で飛ばせる

## 18. `_epochDaysToYMD` — 算術による Date 生成回避

エポック日数（`t / 86400000`）から年月日を算術計算するアルゴリズム。**浮動小数点除算 + テーブル探索なし**で済む。

```typescript
private static _epochDaysToYMD(z: number): [number, number, number] {
  z += 719468;                              // 基準日を 0000-03-01 にずらす
  const era = Math.floor(z / 146097);        // 400年周期 (146097日)
  const doe = z - era * 146097;              // 周期内の日数
  const yoe = Math.floor((doe - Math.floor(doe / 1460)
        + Math.floor(doe / 36524)
        - Math.floor(doe / 146096)) / 365);  // 年内の経過年
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4)
             - Math.floor(yoe / 100));        // 年内の通算日
  const mp = Math.floor((5 * doy + 2) / 153); // 月フェーズ
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);          // 月に変換
  return [y + (m <= 2 ? 1 : 0), m - 1, d];
}
```

**なぜ速いか**:
- ループなし、分岐最小（`mp < 10 ? 3 : -9` と `m <= 2 ? 1 : 0` のみ）
- すべて整数演算（`Math.floor` は V8 が整数除算に最適化可能）
- 6回の除算は避けられないが、400年周期のテーブルよりキャッシュフレンドリー（テーブルはキャッシュラインを消費する）
- `new Date(t)` のアロケーション + プロパティ読み取り（`getUTCFullYear()` 等の C++ 呼び出し）より速い

**トレードオフ**: 可読性は低いが、UTC 専用パスでの Date 生成回避には効果的。非 UTC ではタイムゾーンオフセットが必要なため使えない。

## 19. Strength Reduction の実例

高コストな演算を低コストなものに置き換える。

| Before | After | 削減効果 |
|--------|-------|---------|
| `y % 4 !== 0` | `(y & 3) !== 0` | 除算(10-30 cycle) → AND(1 cycle) |
| `y % 400 !== 0` | `(y & 15) !== 0` | 同上。ただし条件付きで使う |
| `String(n).padStart(2, '0')` | `PAD2[n]` | 関数呼び出し + アロケーション → 配列参照 |
| `new Date(y, M, D).getDay()` | `_dayOfWeek(y, M, D)` | Date 生成 + API → 整数演算 |
| `new Date(...)` からの全フィールド読み取り | `_epochDaysToYMD` | アロケーション → 算術計算 |
| ループでの daysInMonth 複数回呼び出し | if-else + 1回だけ呼び出し | 関数呼び出し削減 |
| `str.trim()` + 正規表現マッチ | `charCodeAt` 直接検査 | 文字列生成 + 正規表現JIT → O(1) メモリアクセス |
| `||` によるデフォルト値 | 三項演算子 `? :` | 微妙だが、V8 では三項の方がインライン展開されやすい |

## 20. まとめ: moment2 の高速化スタック

```
Layer 5: アルゴリズム      Sakamoto, _epochDaysToYMD, ビット演算 leap year
Layer 4: テーブル参照      PAD2, leapLadder, DAYS_IN_MONTH, isoDates, tokenByChar
Layer 3: キャッシュ戦略    フィールドキャッシュ, LruMap, 遅延初期化
Layer 2: メモリアクセス    Shape 安定, _cold 削減, Own Property, インライン展開
Layer 1: CPU パイプライン  分岐予測, Smi 維持, CSE, テンプレートリテラル最適化
```

各層が独立して効くわけではなく、**下層の最適化が上層をさらに速くする**。例えば Shape が安定すると TurboFan が `_epochDaysToYMD` をインライン展開し、さらに定数畳み込みが効くようになる。`_cold` 削減ひとつで V8 の最適化経路が根本から変わるという好例。

## 21. データ構造の観点

### 21a. Moment オブジェクトのメモリレイアウト

V8 における Moment インスタンスの構造:

```
Moment object (JSReceiver)
├── map (Hidden Class pointer)          // 8 bytes → Shape へのポインタ
├── properties (FixedArray pointer)     // 8 bytes → プロパティ格納域
├── elements (FixedArray pointer)       // 8 bytes → 数値インデックス用（未使用）
├── in-object properties (最大4-8個)    // インラインプロパティ
│   ├── _isAMomentObject                // 初期化順1: boolean
│   ├── _l                              // 初期化順2: string | undefined
│   ├── _isUTC                          // 初期化順3: boolean
│   ├── _offset                         // 初期化順4: number (Smi)
│   ├── _d                              // 初期化順5: Date | undefined (pointer)
│   ├── _t                              // 初期化順6: number (HeapNumber or Smi)
│   └── _isValid                        // 初期化順7: boolean
├── properties backing store (FixedArray) // 容量に応じて拡張
│   ├── $y, $M, $D, $W                  // class field 初期化子 (Smi)
│   ├── $H, $m, $s, $ms                 // class field 初期化子 (Smi)
│   ├── _dirty                          // boolean
│   ├── _i                              // 条件付き: unknown
│   ├── _f                              // 条件付き: string | undefined
│   ├── _strict                         // 条件付き: boolean
│   └── _cold                           // エラー時のみ: object | undefined
```

**重要な特性**:
- `$y 〜 $ms` の8フィールドは class field 初期化子で同じタイミングで生成される → backing store 内で**連続したスロット**に配置される可能性が高い
- 8フィールド × 各8 bytes（タグ付きポインタ）= **64 bytes ちょうど** → 1 cache line に収まる
- `$y` を読むと `$M`, `$D`, ... も同じ cache line 上にある → 後続のアクセスが L1 ヒットする
- `_d` が指す Date オブジェクトは別アロケーション → 別 cache line → `_getD()` は2-hop

**AoS  vs SoA トレードオフ**:
- 現在: Array of Structures (AoS) — 各 Moment が全フィールドを持つ
- 代替: Structure of Arrays (SoA) — `$y[]`, `$M[]`, `$D[]` を別々の TypedArray で持つ
- SoA だと日付の一括処理（例: 100万件の dayOfYear 計算）で SIMD ベクトル化が可能
- ただし moment2 は汎用ライブラリで単一オブジェクト操作が主、かつ moment.js 互換 API を保つ必要があるため SoA は採用していない

### 21b. プロパティバッキングストアの拡張戦略

V8 のプロパティ格納域（backing store）は容量不足になると再アロケーションされる。

| プロパティ数 | 状態 | 格納場所 |
|---|---|---|
| 0-4 | 全 in-object | オブジェクトヘッダ内（最速、0-hop） |
| 5-8 | 一部 in-object + backing store | 両方に分散 |
| 9+ | backing store に追い出し | FixedArray（1-hop） |

moment2 は class field が4つ（`_isAMomentObject`, `_isUTC` 等のインライン化は V8 の裁量）＋8つの `$` フィールド＋条件付きフィールド。合計 15+ プロパティ → 確実に backing store に格納される。

**意味**: どのプロパティも「オブジェクト→backing store 配列→値」の 2 回のメモリアクセスが必要。ただし backing store は FixedArray（メモリ上で連続）なので、**一度ポインタを解決すれば後続のアクセスは連続メモリへの整数インデックスアクセス**になる。このパターンは V8 が最も得意とする。

### 21c. `_cold` のデータ構造的問題

`_cold` はオプショナルなキーを持つオブジェクト。エラー種別によってキーの組み合わせが異なる:

```typescript
// Shape A: overflow + empty
_cold = { _overflow: 2, _empty: true }

// Shape B: invalidMonth + nullInput
_cold = { _invalidMonth: "Feb", _nullInput: true }

// Shape C: 全部
_cold = { _overflow: 2, _empty: true, _invalidMonth: "Feb", _nullInput: true, ... }
```

**問題**: エラー Moment 10個作ると10通りの Shape が生まれ、`isValid()` 内の `cold._overflow` などのアクセスが**メガモーフィック**になる。V8 は 4 種類以上の Shape が観測されると Inline Cache を諦め、毎回ハッシュテーブル lookup を行う。

**解決策（未実装）**:
- `_cold` をオブジェクトではなく**固定長配列** + ビットマスクで表現する。キーを数値インデックスにマッピングすれば Shape は常に単一。
- または Moment クラスに全 cold field を直置き（エラー時のみ値が入る）→ 未設定のプロパティアクセスは `undefined` を返すだけで Shape は変わらない。

### 21d. 疎 vs 密な表現

| データ | 表現 | 評価 |
|--------|------|------|
| `$y..$ms` (8 fields) | class field 初期化子で密 | ✅ 常に存在、Shape 固定 |
| `_i`, `_f`, `_strict` | constructor で条件付き代入 | ✅ 常に存在（undefined か値か）、Shape 固定 |
| `_cold` 内のキー | エラー種別により可変 | ❌ 疎、Shape 不定 |
| `_d` | constructor で設定 | ✅ 常に存在（Date か undefined） |

`declare` フィールド（`_overflow`, `_empty` 等）は TypeScript コンパイル後に消え、インスタンスに実体を持たない。アクセスすると `undefined` が返る。これらはインスタンスの Shape に影響を与えない。

**改善提案**: `declare` をやめて `_overflow?: number` として class field 初期化子を与えず、constructor での代入時のみ実体化する。こうすると購入されることはないが、Shape が動的に変化する（`_overflow` が突然出現する）ため V8 が Deopt する可能性がある。現在の `_cold` 経由の方が Shape の変化範囲を限定できているといえる。

## 22. メモリページサイズの観点

### 22a. ページサイズの実態

| アーキテクチャ | 通常ページ | Huge Page | macOS 実装 |
|---|---|---|---|
| x86_64 (Intel/AMD) | 4KB | 2MB/1GB | 4KB |
| ARM64 (Apple M1-M3) | **16KB** | 2MB | 16KB固定 |
| ARM64 (AWS Graviton) | 4KB/16KB | 2MB/32MB | 選択可 |

moment2 の実行環境は macOS (Apple Silicon) が想定される。**ページサイズは 16KB**。

### 22b. Moment オブジェクトのページ占有量

```
Moment 1個の推定サイズ: ~160 bytes (V8 内部オーバーヘッド込み)
1ページ (16KB) あたり: 16KB / 160B ≈ 102 moment インスタンス
ベンチマーク 5000 iterations: 5000 / 102 ≈ 49 ページ

TLB エントリ: L1 TLB 64エントリ (16KBページ), L2 TLB 2048エントリ
→ 49 ページ < 64 (L1 TLB に収まる)
```

**結論**: ベンチマーク程度の負荷では TLB プレッシャーは無視できる。瞬間的に 100,000 以上の Moment が生存するようなシナリオで初めて TLB が問題になる。

### 22c. ホットデータのページ内配置

```
ページ [16KB]
├── Moment#0 (~160B)
├── Moment#1 (~160B)
├── Moment#2 (~160B)
├── ... (102 個まで)
└── Moment#101 (~160B)
```

同一ページ内の Moment へのアクセスは TLB ミスにならない。ベンチマークで `a.diff(b)` のように2つの Moment を操作する場合、それらが同じページに存在する確率は ~102/全体サイズ に依存する。5000個の Moment を生成しながら捨てる（GC で回収）場合、V8 の New Space が 1MB（1024KB / 160B ≈ 6550 個分）に収まるため、GC が介入するまでは連続領域に密集している。

### 22d. ページ境界を跨ぐリスク

最もコストが高いのは「1操作で複数の異なるページにアクセスすること」。例えば `add(1, 'day')`:

```typescript
_addSimple(amount, DAY) {
  const dt = this._getD();          // → this._d  (同一オブジェクト内)
  // ...
  dt.setFullYear(this.$y, ...);     // → $y, _d (いずれも同一ページ)
  this.$W = dt.getDay();            // → $W, _d
  this._offset = -dt.getTimezoneOffset();
}
```

**分析**: `_addSimple` は同一 Moment 内のフィールドしかアクセスしない。Moment は V8 ヒープ内の連続領域に存在するため、全てのアクセスが同じページ内で完結する。**1操作 = 1ページ**（まれに _getLocale() で別ページに飛ぶが、hot path ではキャッシュ済み）。

### 22e. V8 ヒープのページ戦略

V8 のガベージコレクタは New Space（若年世代）と Old Space（老齢世代）を管理する:

- **New Space**: 1-8MB、2つの semi-space で構成。GC はコピー (Scavenge) で行われる。
  - Semispace は連続した仮想アドレス空間 → アドレス連続性が高い → TLB friendly
  - benchmark 内で Moment はすぐ捨てられる → New Space に留まる → Old Space に昇格しない
  - New Space 内の GC (Scavenge) は停止時間が短い (< 1ms)

- **Old Space**: 必要に応じて拡張。Mark-Sweep-Compact。
  - 長寿命の Moment はここに昇格する
  - コンパクションによりフラグメンテーションを解消 → ページ利用効率が維持される

**moment2 の GC フットプリント**:
- `_cold` 削減により Moment 1個あたりのアロケーションサイズ減少 → GC のコピー量が減る
- `_dirty` 遅延初期化により `_refreshFields()` での Date 生成が不要なケースがある → Date アロケーション削減
- clone で `_d` を共有しない → clone 時に `new Date()` 相当のコストがかからない

### 22f. キャッシュライン境界

キャッシュラインは通常 **64 bytes**。V8 のプロパティバッキングストア（FixedArray）はメモリ上で連続しており、キャッシュライン境界の意識は V8 内部で行われる。

**注目ポイント**: `$y $M $D $W $H $m $s $ms` の 8 フィールドは合計 64 bytes と推定される:
- 各フィールドは V8 の tagged pointer (8 bytes)
- 8フィールド × 8 bytes = 64 bytes = **1 cache line ちょうど**

**→ $y にアクセスすると $M $D $W $H $m $s $ms も一括で L1 にロードされる**

これは意図的な設計ではないが（class field 初期化子が同じタイミングで走った結果）、結果的に極めて効率的。`daysInMonth(this.$y, this.$M)` で `$y` と `$M` を両方読んでも L1 ヒットが期待できる。

### 22g. ページサイズ最適化の限界と適用外

moment2 のような JavaScript ライブラリでページサイズを直接制御することは不可能。V8 がヒープ管理を完全に抽象化しているため。ただし以下の間接的な配慮は有効:

| 配慮 | 効果 |
|------|------|
| オブジェクトサイズ削減 (`_cold`削減) | 同一ページあたりの Moment 数増加 → TLB 有効利用率向上 |
| 不要なアロケーション削減 (lazy init) | GC 頻度低下 → コンパクションの停止時間減少 |
| プロパティ数の最小化 | Shape 安定性向上 → Deopt 防止 |
| `_d` を clone で共有しない | Old Space でのフラグメンテーション防止 |

**本来ページサイズ最適化が必要な領域**（moment2 では関係ない）:
- 巨大な TypedArray の確保と Huge Page のマッピング（画像処理、ゲームエンジン）
- mmap を使ったファイル I/O のバッファ管理
- DMA を伴うデバイスドライバ

## 23. 多層キャッシュ戦略

moment2 は複数層のキャッシュを使っている。engine 非依存のアプリケーションキャッシュ、JS engine の inline cache、さらにその下の CPU キャッシュが重なっている。

```
Layer 5: LRU キャッシュ     LruMap (expandLocaleCache, tokenizeCache, expandedFormatCache)
Layer 4: ロケールキャッシュ   _localeCache Map, _monthsCache, _weekdaysCache
Layer 3: フィールドキャッシュ $y $M $D $W $H $m $s $ms (8 fields)
Layer 2: JS Engine IC        Shape 固定 + Monomorphic プロパティアクセス
Layer 1: CPU キャッシュ       L1 (32KB), L2 (256KB-1MB), TLB (64 entry L1, 2048 L2)
```

### 23a. Layer 1 — CPU キャッシュ

- **L1 Data Cache (32KB/core)**: Moment 1個 ~160B → 約 200 個収容。benchmark のワーキングセットは 5000 Moment だが、時間的局所性（同じ Moment を繰り返し触る）により少数のホット Moment だけ L1 に乗る。
- **L2 Cache (256KB-1MB)**: 約 1600-6400 Moment → benchmark の全 Moment が収まる可能性がある。
- **TLB (L1 64 entry × 16KB = 1MB カバー)**: 約 6000 Moment 分。benchmark の全ワーキングセットをカバー可能。

**moment2 の特性**: `add()`, `startOf()`, `format()` は同一 Moment 内のフィールドだけ触る（時間的局所性◎）。`diff()` は2つの Moment にアクセスするが、これも同一 GC 領域内に密集している（空間的局所性◎）。

### 23b. Layer 2 — V8 Inline Cache (IC)

**V8 の IC は事実上「プロパティアクセスのキャッシュ」**。同じ Shape のオブジェクトに対して同じプロパティを読むコード位置では、1回目のアクセス結果（Shape + オフセット）をキャッシュし、2回目以降は Shape チェック＋オフセットロードに最適化する。

```typescript
// コード上の1箇所の this.$y が IC エントリを持つ
year() { return this._isValid ? this.$y : NaN; }
//                              ^^^^^^^^
//   IC: Shape が Moment_shape なら「オフセット 0xXX を読め」とキャッシュ
```

IC の種類と moment2 での状態:

| IC 種別 | 条件 | moment2 | 状態 |
|---------|------|---------|------|
| Monomorphic | 1つの Shape のみ | Shape 固定（`_cold` 削減後） | ✅ |
| Polymorphic | 2-4 Shape | parse 戻り値オブジェクト（2 Shape） | ⚠️ 許容範囲 |
| Megamorphic | 5+ Shape | `_cold` 内アクセス（エラー時のみ） | ❌ ただしエラー時のみ |

**実際の IC 効果**: getter の `this.$y` は一度の Shape 比較 + 即値ロードにコンパイルされる。`cold._overflow` もエラー時はメガモーフィックだが、エラー率は極めて低いため実害はない。

### 23c. Layer 3 — フィールドキャッシュ（`$y..$ms`）

**「Date API の結果をキャッシュする」** という最も直接的なキャッシュ。

| フィールド | キャッシュ元 | キャッシュ更新タイミング |
|-----------|------------|----------------------|
| `$y $M $D $W` | `getFullYear()`, `getMonth()`, `getDate()`, `getDay()` | constructor, setter, add, startOf, endOf |
| `$H $m $s $ms` | `getHours()`, `getMinutes()`, `getSeconds()`, `getMilliseconds()` | 同上（時間変更時のみ） |

**一貫性保証**: mutation 系メソッド（`add`, `startOf`, `set`, etc.）は全ての `$` フィールドを明示的に更新する。`_refreshFields()` はフル再読込。`_dirty` 遅延初期化により constructor 直後は未設定だが、getter 初回アクセス時に自動的にロードされる。

**キャッシュミス**: 以下のケースで `$` フィールドが古くなる可能性があった:
- 旧 `clone()` で未初期化 `$` をコピー → `_ensureFields()` の追加で修正済み
- `_d` を外部から直接書き換え → `_dClone: false` は自己責任

### 23d. Layer 4 — ロケールキャッシュ

**Locale オブジェクトのキャッシュ**:

```typescript
const _localeCache = new Map<string, Locale>();  // シングルトン Map
// 一度構築された Locale はキャッシュされ、2回目以降は即返る
function getLocale(locale?: string): Locale {
  const key = locale || currentLocaleName;
  const cached = _localeCache.get(key);
  if (cached) {return cached;}
  const config = resolveLocaleConfig(key);
  const loc = new Locale(config, key);
  _localeCache.set(key, loc);
  return loc;
}
```

**Locale 上のキャッシュフィールド**（parse.ts 内で lazy 生成）:

| キャッシュ | 内容 | 生成トリガー |
|-----------|------|------------|
| `_monthsCache` | 月名の小文字配列 (string[]) | 初回 `MMMM` パース |
| `_monthsRegex` | 曖昧マッチ用正規表現 | 同上 |
| `_monthsStrictRegex` | 厳密マッチ用正規表現 | 同上 (strict mode) |
| `_monthsShortCache` | 短縮月名 (string[]) | 初回 `MMM` パース |
| `_weekdaysCache` | 曜日名 (string[]) | 初回 `dddd` パース |
| `_weekdaysShortCache` | 短縮曜日名 | 初回 `ddd` パース |
| `_weekdaysMinCache` | 最小曜日名 | 初回 `dd` パース |
| 各 Regex | マッチ用正規表現 | 各 xxxCache と同時 |

**サイズ**: Month/Weekday の配列は 7-12 要素。Regex は `/^(A|B|C...)/i` 形式で、ロケールの名前をすべて OR 結合したもの。**L1 キャッシュに収まる**。

### 23e. Layer 5 — LRU キャッシュ（LruMap）

3 つの独立した LRU キャッシュが存在する:

#### (1) `expandLocaleCache` (`format.ts`, max=500)

**用途**: `LLLL` などのロケール依存トークンを展開した結果をキャッシュする。

```typescript
// 初回: "LLLL" → "dddd, MMMM Do YYYY, h:mm:ss a" に展開（文字列処理＋ロケールアクセス）
// 2回目: キャッシュヒット → 即値返却
const cacheKey = `${m._l}:${format}`;
const cached = expandLocaleCache.get(cacheKey);
if (cached !== undefined) {return cached;}
// ... 展開処理 ...
expandLocaleCache.set(cacheKey, result);
```

**ヒット率**: 実際のアプリでは同じロケール＋同じフォーマット文字列が繰り返し使われる。特に `format("LLLL")` のように決まったフォーマットを使い回す場合、初回以降は **O(1) Map lookup のみ**。500 エントリで十分（locale 数 × フォーマット種類 ≈ 数十）。

#### (2) `expandedFormatCache` (`parse.ts`, max=500)

**用途**: `parseWithFormat` が受け取ったフォーマット文字列を展開（`L` → ロケールの longDateFormat）した結果をキャッシュ。

```typescript
const expandedCacheKey = `${locale || "en"}:${format}`;
let expandedFormat = expandedFormatCache.get(expandedCacheKey);
if (!expandedFormat) {
  expandedFormat = format.replaceAll(/LTS|LT|llll|.../g, ...);
  expandedFormatCache.set(expandedCacheKey, expandedFormat);
}
```

`format.replaceAll()` は正規表現エンジンを起動する。同じフォーマットで複数回パースする場合、このキャッシュでそのコストを回避する。

#### (3) `tokenizeCache` (`parse.ts`, max=1000)

**用途**: フォーマット文字列をトークン配列（`[{type:"token",name:"YYYY"}, {type:"literal",value:"-"}]`）に分解した結果をキャッシュする。

```typescript
function tokenizeFormat(format: string): FormatToken[] {
  const cached = tokenizeCache.get(format);
  if (cached) {return cached;}
  // ... 文字列スキャン + FORMAT_TOKENS マッチ ...
  tokenizeCache.set(format, tokens);
  return tokens;
}
```

**重要度**: 最もヒット率が高い。`parseWithFormat` は `moment(input, format)` の度に呼ばれる。同じフォーマット文字列（例: `"YYYY-MM-DD"`）に対するトークン化は**最初の1回だけ**実行される。

#### LruMap の実装と特性

```typescript
class LruMap<K, V> {
  private map: Map<K, V>;
  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      this.map.delete(key);   // 削除して...
      this.map.set(key, value); // 再挿入 → 末尾に移動（最新化）
    }
    return value;
  }
  set(key: K, value: V): void {
    this.map.set(key, value);
    if (this.map.size > this.max) {
      const oldest = this.map.keys().next().value; // Map の先頭 = 最古
      this.map.delete(oldest);
    }
  }
}
```

**ポイント**:
- `Map` は挿入順を保持する → 先頭が最古、末尾が最新
- `get()` は `delete+set` でアクセス順を更新する（O(1)）
- 容量超過時は先頭（最古）を削除する（O(1)）
- フルスキャンや参照カウント不要 → **Map の実装を LRU として流用する** スマートな手法

ただし `get()` が常に `delete+set` を行うため、Map が 500 エントリのときでも毎回 2 回のハッシュテーブル操作が発生する。キャッシュヒット時は「Map lookup（hit）→ delete → set」の 3 操作。これを避けるには単純な Map（LRU なし）で十分な場合もある。

**eviction 判断**: tokenizeCache(1000) はフォーマット文字列をキャッシュする。実用的なフォーマット数は高々数十なので、eviction はほとんど発生しない。expandLocaleCache(500) も同様。

### 23f. engine 内部キャッシュ

engine が暗黙的に行うキャッシュで、moment2 が間接的に恩恵を受けているもの:

| キャッシュ | 対象 | 効果 |
|-----------|------|------|
| **irregexp キャッシュ** | コンパイル済み正規表現 | 同じ正規表現リテラルの `exec/test` は 2回目から JIT コード実行 |
| **コードキャッシュ** | TurboFan 最適化コード | ホット関数は最適化コンパイル後のネイティブコードがキャッシュされる |
| **String インターン** | 同一内容の文字列 | 同じ文字列リテラルはヒープ上で共有される（比較が参照一致になる） |
| **Shape キャッシュ** | オブジェクトの Shape | 同じ Class から生成されたオブジェクトは Shape 遷移ツリーがキャッシュされる |
| **フィードバックベクター** | 各呼び出しサイトの型情報 | IC が収集した型情報はフィードバックベクターに蓄積される（関数が無効化されない限り保持） |

名称は V8 と JSC で一致しない部分もあるが、高レベルの効果は似ている。つまり、安定した object layout と安定した call site は報われやすい。

**コードキャッシュの具体例**: 5000回実行される `moment()` は TurboFan により高度に最適化されたコードにコンパイルされる。ループの定数伝搬、分岐の単純化、不要なプロパティチェックの削除等が適用される。

### 23g. 「キャッシュしてはいけないもの」

すべてをキャッシュすればよいわけではない:

| キャッシュしないもの | 理由 |
|-------------------|------|
| **タイムゾーンオフセット** | DST 境界で変化する。`_offset` は setter や add の度に `_getD().getTimezoneOffset()` で再取得する。一度キャッシュした値を使い回すと DST 遷移時に誤る。 |
| **ロケールデータの生文字列** | ロケールは動的に変更可能（`updateLocale`, `defineLocale`）。変更時は `clearLocaleCache()` で全キャッシュをクリアする。 |
| **日時計算結果** | `diff()` の結果は引数に依存する。汎用的なキャッシュは意味がない。 |

## 24. TurboFan 最適化と Deoptimization の観点

### 24a. TurboFan の最適化パイプライン

V8 の TurboFan JIT は関数がホットになると（~1000回呼び出し）最適化コンパイルを開始する。以下の主要パスが moment2 のコードに適用される:

| 最適化パス | 効果 | moment2 での恩恵 |
|-----------|------|----------------|
| **型特化 (Type Specialization)** | 変数の型を固定し、動的ディスパッチを削除 | getter の `$y` が Smi と確定 → アンボックス化 |
| **インライン展開 (Inlining)** | 呼び出し先のコードを呼び出し元に展開 | `_ensureFields()` が 1-2 命令に縮退 |
| **エスケープ分析 (EA)** | オブジェクトが関数外に出ないことを証明し、スタック割り当てに置き換え | ヒープアロケーション削減 |
| **定数畳み込み (Constant Folding)** | コンパイル時に計算可能な式を事前計算 | `Math.floor(5/2)` → `2` |
| **冗長ロード除去 (CSE)** | 同じアドレスからの load を削減 | `this.$y` の連続読み取りが 1 回に |
| **ループ不変式移動 (LICM)** | ループ内の不変式をループ外に移動 | ベンチマークループの文字列参照 |
| **配列バウンドチェック除去** | 添字が範囲内と証明できればチェックを削除 | `PAD2[n]` で n が 0-99 確定なら不要 |
| **分岐融合 (Branch Fusion)** | 条件分岐を CMOV などに置き換え | `a ? b : c` が分岐なしに |

### 24b. エスケープ分析の実例: moment() の行方

```typescript
// benchmark 内:
for (let i = 0; i < 5000; i++) { moment2(); }
```

TurboFan は `moment2()` の戻り値がループ外で使われず、どこにも保存されないことを検出する。もし Moment コンストラクタがインライン展開され、かつ生成された Moment が「エスケープしない」（関数外への参照が渡らない）と証明できれば:

1. Moment インスタンスの**ヒープ割り当てを完全に除去**
2. `_refreshFields()` が呼ばれないため、Date 生成も除去
3. ループが実質 `Date.now()` の呼び出しだけになる

**実際には**: Moment は `return` で呼び出し元に返されるため「エスケープする」。TurboFan はエスケープ分析を諦める。ただし `_dirty` 遅延初期化により、`_refreshFields()` の呼び出しは除去される（呼ばれないコードと判定されるため）。

### 24c. Deoptimization（脫最適化）のトリガー

以下の事象が発生すると、TurboFan は最適化コードを破棄し、インタープリタ実行にフォールバックする:

| トリガー | リスク | moment2 |
|---------|--------|---------|
| **Shape 変化** | オブジェクトに新しいプロパティが追加される | `_cold` 削減でリスク低減。ただし `_cold` 生成時（エラーMoment作成時）に Shape が変わる → その時だけ Deopt |
| **型の変化** | Smi が HeapNumber に変わる | `$y` に 2^30 以上の年が入ると Deopt（非現実的） |
| **配列インデックス範囲逸脱** | `PAD2[100]` など | `$H` 等は 0-59 で範囲確定のため発生しない |
| **try/catch 到達** | 最適化コードが例外ハンドラを必要とする | ロケールフォールバックで稀に発生 |
| **インラインキャッシュ限界** | IC が 4 種類以上の Shape を観測 | `_cold` 内アクセスで発生するがエラー時のみ |

**moment2 の方針**: 正常系のホットパスでは一切 Deopt しないことを設計目標としている。`_cold` 削減、Shape 固定、型の一貫性（全ての `$` フィールドは Smi 範囲）により、安定した最適化コードを維持する。

### 24d. フィードバックベクターの蓄積

V8 は各関数呼び出しサイトにフィードバックベクター（型情報のログ）を関連付ける:

```typescript
// 呼び出しサイト形式:
function year() {
  return this._isValid ? this.$y : NaN;
}
// feedback vector:
//   [0] this: Shape(Moment)  ← Monomorphic
//   [1] this._isValid: Boolean
//   [2] this.$y: Smi
```

TurboFan はこのフィードバックに基づいて型特化コードを生成する。1000回 Monomorphic だった Shape が突然変化すると **Deopt + 再最適化** が発生する。

moment2 の戦略:
- **正常 Moment は全く同じ Shape** → feedback が 100% Monomorphic
- エラー Moment は別 Shape → 正常系の feedback を汚染しない
- エラー Moment で Deopt しても、その後の正常 Moment で再最適化される（ペナルティはエラー1回のみ）

## 25. Cold Start / Warm-up 特性

### 25a. 初回呼び出しの内訳

```typescript
// 初回 moment() 呼び出しで発生する処理:
import moment2 from "moment2";         // Module linking (同期的)
//   ↓
moment2();                               // 初回実行
//   ├── getCurrentLocale()              // locale.ts: 初回は "en" 確定
//   ├── new Moment({ _t: Date.now() })  // constructor (lazy init: _refreshFields 呼ばない)
//   ├── Moment クラスの定義評価          // モジュール評価時に実施済み
//   └── Shape の初期化                  // V8 が初回インスタンス作成時に Shape を生成
```

初回特有のコスト:

| 処理 | 初回 | 2回目以降 | 備考 |
|------|------|----------|------|
| Module 評価 | 数ms | 0 | 依存関係の解決＋コード評価 |
| Shape 生成 | 数μs | 0 | 初めての Moment 生成時に V8 が Shape を作成 |
| Regex JIT コンパイル | ~500μs | 0 | `EXTENDED_ISO_REGEX` 等が初回 exec 時に JIT される |
| Locale 初期化 | ~200μs | 0 | `en` locale の初回読み込み |
| TurboFan 最適化 | 関数ごとに ~1ms | 関数ごとに1回 | 1000回呼び出し後、最適化コンパイルが非同期で走る |

### 25b. モジュール評価のタイムライン

```
import moment2 from "moment2"
  ├── src/index.ts の評価 (.mjs→.ts→.js 変換は Bun が事前に実施)
  │   ├── import "./moment2"         → Moment クラス定義
  │   ├── import "./format"           → formatMoment 関数
  │   ├── import "./parse"            → parseString, parseCommonISO
  │   ├── import "./units"            → DAYS_IN_MONTH, isLeapYear 等
  │   ├── import "./utils"            → LruMap, ユーティリティ
  │   ├── import "./locale"           → _localeCache, getLocale
  │   └── import "./duration_fixed"   → Duration クラス
  └── export default moment 関数
```

**ツリーシェイク効果**: `src/index.ts` は全モジュールを import するが、実際に評価されるのは moment2 のエントリポイントからの依存のみ。使われないロケール（`src/locale/en.ts` 以外の 138 ファイル）は `import()` で遅延ロードされるため、初回評価には影響しない。

### 25c. 初回パースの正規表現 JIT

```typescript
const EXTENDED_ISO_REGEX = /^\s*((?:[+-]\d{6}|\d{4})-(?:\d\d-\d\d|W\d\d-\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?::\d\d(?::\d\d(?:[.,]\d+)?)?)?)([+-]\d\d(?::?\d\d)?|\s*Z)?)?$/;
```

V8 の irregexp エンジンはこの正規表現を初回 `exec()` 時にバックグラウンド JIT コンパイルする（約 100μs-1ms）。2回目以降はコンパイル済みネイティブコードが実行される。

**moment2 の対策**: `parseCommonISO` は正規表現を使わないため、このコストは発生しない。`parseISOWithTable` でのみ EXTENDED_ISO_REGEX / BASIC_ISO_REGEX が使われるが、ISO 文字列の大部分は `parseCommonISO` で先に処理されるため、ISO テーブルパスの regex JIT はウォームアップに影響しない。

### 25d. Warm-up に要する反復回数

| フェーズ | 必要呼び出し回数 | 何が起きるか |
|---------|----------------|-------------|
| **Ignition 実行** | 1-10回 | インタープリタ実行。フィードバックベクター収集開始 |
| **TurboFan キュー登録** | ~1000回 | 関数がホットと判定され、最適化コンパイルが予約される |
| **TurboFan 最適化完了** | 1001-2000回 | 最適化コードに切り替わり、以降はネイティブ実行 |
| **IC 安定化** | 4-10回 | Monomorphic IC が確立。以降 Shape が変わらない限り安定 |

**moment2 の到達時間**:
- benchmark (5000回): TurboFan 最適化 + Monomorphic IC 確立 → 測定は安定領域で行われる
- 実アプリ (1-10回): Ignition 実行。`_dirty` 遅延初期化が効く（不要な `_refreshFields` を回避）
- SSR (1回): 冷えた状態で1回だけ。モジュール評価と JIT コストが支配的

**温まっていない状態での注意点**:
- `parseWithFormat` の `tokenizeCache` が空 → 初回はトークン化コストがかかる
- ロケールキャッシュ (`_localeCache`, `_monthsCache` 等) が空 → 初回ロケールアクセスが遅い
- Shape 未確定 → フィードバックベクターが未収集
- `LruMap` の Map オブジェクトは空 → キャッシュミス連発

→ これらはいずれも「1回だけ」のコスト。SSR では許容範囲内。

### 25e. moment2 と date-fns のコールドスタート比較

| 指標 | moment2 | date-fns | 備考 |
|------|---------|----------|------|
| モジュールサイズ (bundle) | 82KB | 114KB (date-fns v4) | moment2 の方が軽い |
| 初回 `parseISO` レイテンシ | ~500ns (lazy) | ~1μs | 初回でも moment2 が速い |
| 初回 `format` | ~35ns (fast path) | ~1μs | locale 依存なし |
| 全機能ロード | 同期的（EIM） | 同期的（EIM） | 両者同じ |
| デッドコード除去 | ツリーシェイク対応 | 名前付きエクスポート | 両者ツリーシェイクされやすい |

date-fns は関数単位の import のため、使わない関数を import しなければ bundle サイズが小さくなる。moment2 は 1 つのエントリポイントに全機能が含まれるが、実使用に必要な機能（parse, format, add, diff）だけが使われる場合、TurboFan が未使用コードをデッドコード除去する機会は少ない（モジュール評価時に定義されるため）。ただしツリーシェイキングによりモジュール全体が除去されることはない。

実際の計測では moment2 はコールドスタートでも date-fns と同等以上に速い（parse ISO string: 328ns vs 950ns, format: 38ns vs 1.13μs）。

## 26. 他ライブラリとの比較（参考）

**dayjs**: moment2 と同じフィールドキャッシュ方式。
- 内部で `$y, $M, $D, $H, $m, $s, $ms` を持ち getter は直読
- Locale の遅延ロード（import()）
- moment2 と設計思想が非常に近い。速度も同等と推定される。
- ただし moment.js 互換性は限定的。

**luxon**: `DateTime` クラス。Intl.DateTimeFormat に依存。
- パースに `Intl.DateTimeFormat` を使うためブラウザ依存
- 初回パースが遅い（Intl オブジェクトの生成コスト）
- 2回目以降はキャッシュされる
- moment2 より総じて遅いが、ロケール対応の正確性では優位

**date-fns**: 関数型、ネイティブ Date を直接操作。
- ラッパーなし（new Date() を返すだけ）
- 単一操作の毎回 Date API を呼ぶ → キャッシュなし
- moment2 に比べて getter が遅い（Date API 呼び出し）
- ラッパーなしのため `moment()` 相当の操作（現在時刻取得）は最速

```
        速度比較（直感）:
         moment2  ≒  dayjs  >  date-fns  >  luxon  >>  moment.js
getter:  🏆 10ns    10ns      200ns       500ns      250ns
format:  🏆 35ns    50ns      1.1μs      1.5μs      350ns
parse:   🏆 330ns   500ns     1.0μs      2.0μs      5.0μs
create:      60ns    80ns     🏆 35ns     80ns      280ns
```

（数値は概算。dayjs/luxon は未測定の推定値を含む。）

## 27. 総括: 「勝ちパターン」と「負けパターン」

### 勝ち: date-fns より速いケース

**Getter / フィールドアクセス**: キャッシュフィールドが決定的。date-fns 都度 Date API を叩くのに対して、moment2 は `$y` プロパティ読み取りだけで完了。**Shape 固定＋Own Property による IC 最適化**の勝利。

**フォーマット**: `formatCommonEn` の switch fast path が激速。テンプレートリテラル＋PAD2 テーブルで `padStart` 不要。**Monomorphic Property Access + 事前計算テーブル**の勝利。

**Diff / Compare**: `_t` 同士の減算のみ。**Date の valueOf を経由しない**ことで V8 のネイティブコードを直接実行。

### 負け: date-fns より遅いケース

**`moment()` / `new Date()`**: ラッパーオブジェクトのプロパティ初期化（12+ プロパティ代入）が避けられない。date-fns の `new Date()` は V8 のネイティブ実装で 30ns。

**`add(1, 'day')`**: date-fns は `addDays(date, 1)` で内部では `new Date(date.getTime() + 86400000)` を返すだけ。moment2 は `_getD()` → `setFullYear()` → 8 フィールド更新 → `_t` 更新 → `_updateOffset` とやることが多い。ラッパー構造の本質的なコスト。

**課題**: これらの負けは Moment 互換 API を保つ限り原理的に解消できない。「作って捨てる」ユースケース（benchmark）が不利なだけで、実アプリでは Moment を保持して使い回すケースが多いので実害は少ない。
