# lite public surface draft

2026-05-10 draft.

## 目的

`@compat/moment2/lite` は互換最優先 SKU ではなく、size-first SKU とする。

目標:

- browser bundle `16KB-18KB gzip`
- ISO-centric app の実運用を成立させる
- `full` と `base` の置き換えではなく、別用途の入口にする

## 想定ユースケース

- API / DB から ISO 8601 文字列を受ける
- 英語固定、または locale は後から plugin/import で足す
- `YYYY-MM-DD` や `YYYY-MM-DD HH:mm:ss` で表示する
- 少数の日時演算だけ行う

非ターゲット:

- legacy moment 互換を広く前提にした app
- custom format parse 必須の app
- locale-aware display を最初から前提にした app

## import 形

```ts
import moment from "@compat/moment2/lite";
```

plugin:

```ts
import "@compat/moment2/plugin/format-parse";
import "@compat/moment2/plugin/duration";
import "@compat/moment2/plugin/display-extra";
import "@compat/moment2/plugin/utc";
import "@compat/moment2/plugin/struct-input";
import "@compat/moment2/locale/ja";
```

## constructor 入力

`lite` 本体で保証するもの:

- `moment()`
- `moment(Date)`
- `moment(number)` (`ms since epoch`)
- `moment(momentInstance)` clone
- `moment(string)` where `string` is strict ISO 8601

`lite` 本体で保証しないもの:

- `moment(string)` with RFC 2822
- `moment(string)` browser `Date` fallback
- `moment(string, format)`
- `moment(string, [formats])`
- `moment(array)`
- `moment(object)`
- clone-like plain object (`_isAMomentObject`)

## static API

`lite` 本体で含める:

- `moment()`
- `moment.version`
- `moment.fn`
- `moment.prototype`
- `moment.now`
- `moment.isMoment`
- `moment.unix`
- `moment.invalid`

`lite` 本体で含めない:

- `moment.utc`
- `moment.parseZone`
- `moment.duration`
- `moment.isDuration`
- `moment.min`
- `moment.max`
- `moment.normalizeUnits`
- `moment.HTML5_FMT`
- `moment.relativeTimeRounding`
- `moment.relativeTimeThreshold`
- `moment.calendarFormat`
- `moment.locale`
- `moment.defineLocale`
- `moment.updateLocale`

## instance API

`lite` 本体で含める最小集合:

- validity / cloning
  - `isValid`
  - `clone`
  - `valueOf`
  - `unix`
  - `toDate`
  - `toISOString`
  - `toJSON`
- field getters/setters
  - `year`
  - `month`
  - `date`
  - `hour`
  - `minute`
  - `second`
  - `millisecond`
- comparisons
  - `isBefore`
  - `isAfter`
  - `isSame`
- arithmetic
  - `add`
  - `subtract`
  - `diff`
- boundaries
  - `startOf`
  - `endOf`
- formatting
  - `format`

`lite` 本体で含めない:

- `utc`
- `local`
- `parseZone`
- `from`
- `fromNow`
- `to`
- `toNow`
- `calendar`
- locale mutation / query helpers

## format 範囲

`lite` の `format()` は basic token 中心に限定する。

保証する token:

- `YYYY`
- `MM`
- `DD`
- `HH`
- `mm`
- `ss`
- `SSS`

必要なら後で足せる token:

- `YY`
- `M`
- `D`
- `H`
- `m`
- `s`
- `Z`
- `ZZ`
- `Q`
- `X`
- `x`

`[` `]` literal escaping も `lite` 本体では保証しない。

`lite` 本体で含めない token:

- `MMM`
- `MMMM`
- `ddd`
- `dddd`
- `dd`
- `A`
- `a`
- `LT`
- `LTS`
- `L`
- `LL`
- `LLL`
- `LLLL`

## plugin への委譲

### `plugin/format-parse`

- `moment(str, format)`
- `moment(str, [formats])`
- strict / lenient token parser

### `plugin/duration`

- `moment.duration`
- `moment.isDuration`

### `plugin/display-extra`

- `fromNow`
- `calendar`
- relative time threshold / rounding

### `plugin/utc`

- `moment.utc`
- instance `utc` / `local`
- zone-related statics that are not required by `lite`

### `plugin/struct-input`

- `moment(array)`
- `moment(object)`
- clone-like plain object compatibility

### `locale/*`

- locale data
- locale registry/runtime
- localized format/display helpers

## 互換方針

`lite` は full moment 互換を目指さない。

文書化の仕方は次の通りにする。

- `full`: compatibility-first
- `base`: reduced but familiar
- `lite`: size-first

`lite` で invalid になる入力は「バグ」ではなく、仕様とする。

## acceptance

最低条件:

- `moment2 lite` が `base` より明確に小さい
- `moment2 lite + format-parse + ja` が `base + format-parse + ja` より still smaller
- ISO parse / basic format / add-subtract-diff の bench が `base` 比で劣化しない

理想:

- `lite` 単体で `20KB 台前半 gzip`
- 後続の prototype 分割後に `16KB-18KB gzip`

## 判断

この surface で重要なのは、

- `string` は strict ISO のみ
- locale は本体に入れない
- format は basic token のみ
- duration / utc / struct-input は plugin

という 4 点である。

ここを曖昧にすると `lite` はすぐ `base` に近づき、size-first SKU として意味を失う。
