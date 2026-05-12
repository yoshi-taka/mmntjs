# moment2 bundle size proposal

2026-05-10 rewrite.

## 目的

browser bundler 前提で、実運用で意味のある bundle size 改善を行う。

前提:

- 速度の優位は落とさない
- `mmntjs` の互換入口は残す
- 「何でもできる 1 入口」のまま tree-shaking で勝つことは狙わない
- size 目標と互換目標を同じ SKU に背負わせない

## 現状

直近の browser bundle 実測:

| case | raw | gzip |
|---|---:|---:|
| `moment en` | `63,561` | `20,732` |
| `moment + ja` | `65,721` | `21,752` |
| `moment + ja + de` | `67,490` | `22,403` |
| `moment2 base` | `127,354` | `33,244` |
| `moment2 base + fmt` | `127,758` | `33,435` |
| `moment2 base + ja` | `130,284` | `34,554` |
| `moment2 base + ja + de` | `131,617` | `35,094` |

ここまでの改善で、

- `base/full/plugin` 境界
- `format-parse` 分離
- `base` 用 core registration 分離
- `base` 用 factory 分離

は入った。

ただし、それでも `moment2 base` は `moment` より約 `12.5KB gzip` 大きい。

## ここまでの学び

### 効いたもの

- `base` 専用 entry を作る
- `base` 用 core registration を full 用から物理分離する
- `base` 用 factory を full/shared factory から物理分離する
- static API を `base` から外す

これは実際に bundle に効いた。

### あまり効かなかったもの

- `utc` の出し入れ
- `new Date(str)` fallback の削除
- JSON date 互換の削除
- small static API の削減
- runtime gate だけの plugin 化

これは互換整理にはなるが、本命のサイズ差には効きにくい。

### 本質

残っている重量は主に次の 3 つにある。

- `Moment` 本体の monolithic prototype
- no-format string parse
- `format()` を中心とした display/runtime の常設コスト

つまり、もう `base` の小さな API 削減では足りない。

## 目標の再定義

目標は 2 つに分けるべき。

### Goal A: 互換寄り `base` を現実的に縮める

狙い:

- `@compat/moment2/base` を今より軽くする
- ただし日常的な moment 利用感は大きく壊さない

現実的な到達レンジ:

- `30KB 前後 gzip`
- かなりうまくいって `28KB 台`

### Goal B: `moment` より 20% 小さい SKU を作る

目標値:

- `moment` `20,732 gzip`
- その 20% 減で `16,586 gzip`

この目標は、今の `base` の延長では厳しい。

必要なのは:

- `size-first` な別 SKU
- `Moment` prototype の物理分割
- parse と format の責務再設計

## 提案

### 1. SKU を 3 層にする

- `@compat/moment2` = `full`
- `@compat/moment2/base`
- `@compat/moment2/lite`

さらに:

- `@compat/moment2/plugin/format-parse`
- `@compat/moment2/plugin/duration`
- `@compat/moment2/plugin/display-extra`
- `@compat/moment2/plugin/struct-input`
- `@compat/moment2/plugin/utc`
- `@compat/moment2/locale/*`

### 2. `full` の役割

完全互換入口。

```ts
import moment from "@compat/moment2";
```

または:

```ts
import moment from "@compat/moment2/full";
```

これは migration safe default のまま維持する。

### 3. `base` の役割

互換寄りだが、全部は入れない。

`base` は次を目指す:

- `moment()`
- `moment(Date | number | ISO string | RFC2822 string)`
- 基本 getter/setter
- `add/subtract/diff`
- 基本 `format()`
- `duration`
- locale なしでも英語運用できる

外す候補:

- custom format parse
- locale registry 常設
- relative time / calendar
- array/object input
- parseZone
- extra static API

`base` は「互換をかなり残した軽量入口」であり、最終サイズ目標を背負わせない。

### 4. `lite` の役割

目標達成用の size-first SKU。

`lite` は次のようにかなり絞る。

含める:

- `moment()`
- `moment(Date | number | ISO string)`
- moment instance からの clone
- 基本 getter/setter
- `add/subtract/diff`
- numeric/basic token 中心の `format()`
- `isMoment`

含めない:

- custom format parse
- locale registry
- named locale format
- relative time / calendar
- duration
- array/object input
- RFC 2822
- browser `Date` fallback
- parseZone
- `min/max`
- `normalizeUnits`
- `HTML5_FMT`
- broad static helpers

必要なら plugin:

- `plugin/format-parse`
- `plugin/duration`
- `plugin/display-extra`
- `plugin/utc`
- `plugin/struct-input`
- `locale/*`

`lite` は「よくある browser app 用の最小核」と割り切る。

## 実運用から見た SKU の使い分け

### 1. 互換重視の既存 app

```ts
import moment from "@compat/moment2";
```

### 2. 互換をそこそこ残しつつ軽くしたい app

```ts
import moment from "@compat/moment2/base";
```

### 3. API から ISO を受けて整形するだけの app

```ts
import moment from "@compat/moment2/lite";
```

### 4. `YYYY-MM-DD` など format 指定 parse が必要

```ts
import moment from "@compat/moment2/lite";
import "@compat/moment2/plugin/format-parse";
```

### 5. locale を 1-2 個だけ追加

```ts
import moment from "@compat/moment2/lite";
import "@compat/moment2/locale/ja";
```

## 重要な設計変更

### 1. tree-shaking ではなく assembly にする

今までの失敗は、

- 1 つの大きい実装に分岐を残し
- runtime gate で無効化する

という形だった。

今後は逆に、

- `Moment` prototype を責務単位で物理分割し
- SKU ごとに必要なものだけ assemble する

方針へ寄せる。

### 2. `Moment` prototype を分割する

候補:

- `moment-core`
- `moment-calc`
- `moment-format-basic`
- `moment-format-locale`
- `moment-zone`
- `moment-relative`
- `moment-duration`

この分割なしに `lite` を小さくするのは難しい。

### 3. parse を 3 層に分ける

- `parse-iso-basic`
- `parse-rfc`
- `parse-format`

さらに必要なら:

- `parse-struct` (`array/object`)
- `parse-browser-fallback`

`lite` は `parse-iso-basic` 中心。
`base` は `parse-iso-basic + parse-rfc`。
`format-parse` plugin は `parse-format`。

### 4. format も basic / locale に割る

今の `format()` は見た目以上に重い可能性がある。

分け方:

- `format-basic`
  - `YYYY`, `MM`, `DD`, `HH`, `mm`, `ss`, `SSS`, `Z`
- `format-locale`
  - `MMM`, `MMMM`, `ddd`, `dddd`, `LT`, `LL`, `LLLL`

`lite` は `format-basic` を本体に入れる。
`base` と `full` は `format-locale` を追加できる。

## 実装順

### Phase 1: 現行 `base` の改善を続ける

やること:

- `base` から full 用 registration をさらに分離
- `base` から不要 static を外す
- plugin 境界を増やす

狙い:

- `33KB -> 30KB 台`

### Phase 2: `lite` を導入する

やること:

- `src/lite.ts` 新設
- `lite` 用 factory
- `lite` 用 core registration
- `lite` 用 basic format
- `lite` 用 strict string policy
- public surface は [LITE_PUBLIC_SURFACE.md](./LITE_PUBLIC_SURFACE.md) に固定

狙い:

- `24KB〜28KB gzip`

### Phase 3: prototype 分割を入れる

やること:

- `moment_fixed.ts` を責務単位で分割
- `format-basic` / `format-locale` 分離
- `zone`, `duration`, `relative` 分離

狙い:

- `20KB 台前半`

### Phase 4: 目標値を詰める

やること:

- `lite` の parse surface を再精査
- locale runtime を遅延 assembly 化
- `plugin/utc` などの optional 化を比較

狙い:

- `16KB〜18KB gzip`

`16,586 gzip` はここで初めて見えてくる。

## 非目標

次はやらない。

- `base` の小さな API をさらに 1 個ずつ削るだけの作業
- parse の micro-optimization を bundle size の本命とみなすこと
- runtime gate だけで tree-shaking が進むと期待すること
- 互換重視 `base` だけで `moment` より 20% 小さい目標を達成しようとすること

## 判断

現時点の結論は明確。

1. `base/full/plugin` 路線は無駄ではない  
   これは `base` を現実的に軽くするのに効く。

2. ただし、それだけでは目標値に届かない  
   残差の本体は `Moment` monolith と basic parse/format 常設コスト。

3. 目標達成には `lite` と prototype 分割が必要  
   これが抜本案である。

以後の bundle size proposal は、

- `base` を改善する話
- `lite` で目標達成を狙う話

を混ぜずに進める。

## 追加の抜本案

`lite` をさらに縮める場合、`Moment` 共有路線だけでは天井が近い。
より大きく効かせるには、`lite` だけを別 class にする案がある。

### `MomentLite` 別 class 案

発想は単純で、`base/full` が使う `Moment` とは別に、`lite` 専用の `MomentLite` を持つ。
`lite` は `Moment` の一部機能を callback で隠すのではなく、そもそも実装本体を持たない。

`MomentLite` で残す候補:

- `constructor`
- `isValid`
- `clone`
- `valueOf`
- `unix`
- `toDate`
- `toISOString`
- `toJSON`
- 基本 getter/setter
- `isBefore`
- `isAfter`
- `isSame`
- `add`
- `subtract`
- `diff`
- `startOf`
- `endOf`
- `format`

`MomentLite` から外す候補:

- `utc`
- `parseZone`
- `calendar`
- `relative time`
- `week / isoWeek / quarter`
- `array/object` input
- locale registry
- custom format parse
- debug helpers
- broad static helpers

### この案の狙い

今の `lite` は、未使用 method を callback に逃がしても、`Moment` 本体の dispatch と状態を共有している。
そのため bundle graph に重い実装が残りやすい。
`MomentLite` を別 class にすると、`lite` の graph から heavy 実装を物理的に外しやすい。

### 期待値

この案が効くなら、目安は次の範囲。

- `-4KB〜-8KB gzip`
- それ以下なら費用対効果は薄い

### 実装の切り方

1. `src/moment_lite.ts` を新設する
2. `src/core/factory-lite.ts` を `MomentLite` 前提に切り替える
3. `src/lite.ts` を `MomentLite` entry にする
4. `base/full` には触らない
5. bundle を測って、効かなければ戻す

### 判断基準

- `lite` が少なくとも `3KB gzip` 以上縮むなら継続
- `1KB 台` しか動かないなら撤退
- `base/full` に波及するならやらない

これは、今の `base` 改善や `lite` の micro slicing とは別系統の試行である。
`lite` を目標値に近づけるための、より大きい構造変更として扱う。
