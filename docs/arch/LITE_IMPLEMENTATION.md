# lite 実装メモ

2026-05-10.

## 概要

`mmntjs/lite` は size-first SKU。`Moment` 本体 (2220行, moment_fixed.ts) から
必要なメソッドだけ抽出した `MomentLite` クラス (`moment-lite.ts`) を別途持ち、
bundle graph から moment_fixed を完全に排除する。

## MomentLite 分離クラス

**ファイル:** `src/moment-lite.ts`

- 自己完結型。moment_fixed.ts への参照なし
- moment_fixed.ts の callback 変数 (~85), setter (~16) を一切持たない
- 必要な機能のみ internal 実装
- `isMoment()` 互換のため `_isAMomentObject = true` を維持

## 含める API (lite 本体)

### Static
- `moment()`, `moment(Date)`, `moment(number)`, `moment(string)` (strict ISO)
- `moment.utc()`
- `moment.isMoment()`, `moment.isDate()`
- `moment.unix()`, `moment.invalid()`
- `moment.fn`, `moment.prototype`, `moment.version`, `moment.now`, `moment.ISO_8601`
- `moment.parseTwoDigitYear`

### Instance
- `isValid`, `clone`, `valueOf`, `unix`, `toDate`, `toISOString`, `toJSON`, `toString`
- `year`, `month`, `date`, `hour`, `minute`, `second`, `millisecond`
- `day`, `weekday`, `dayOfYear`, `week`, `isoWeek`, `isoWeekYear`
- `isBefore`, `isAfter`, `isSame`, `isSameOrBefore`, `isSameOrAfter`, `isBetween`
- `add`, `subtract`, `diff` (including YEAR/MONTH/QUARTER)
- `startOf`, `endOf`
- `format` (basic tokens: YYYY/MM/DD/HH/mm/ss/SSS)
- `get(unit)`, `set(unit, value)`
- `isLeapYear`, `daysInMonth`, `quarter`
- `utc`, `local`, `utcOffset`
- Plural aliases (years, months, dates, days, hours, minutes, seconds, milliseconds, quarters)

## 含めない API (plugin 必要)

- `moment.duration()` → `mmntjs/plugin/duration`
- `moment(str, format)` → `mmntjs/plugin/format-parse`
- `moment.utc()` → **lite 本体に内蔵** (旧 plugin)
- `moment.parseZone`, `moment.min`, `moment.max`, `moment.normalizeUnits`, `moment.HTML5_FMT`
- Instance: `fromNow`, `calendar`, `locale`, `localeData`, `creationData`, `parsingFlags`, `toArray`, `toObject`, `inspect`

## ファイル構成

```
src/
  lite.ts                      → entry/lite.ts
  entry/lite.ts                → エントリ (registerLiteCoreApi)
  core/factory-lite.ts         → factory-lite-impl.ts の re-export
  core/factory-lite-impl.ts    → MomentLite を生成する moment() 関数
  moment-lite.ts               → MomentLite クラス
  plugins/core-lite.ts         → lite の static API 登録
  display/format-basic.ts      → 基本トークンのみの format
  locale-lite.ts               → en locale のみの軽量 runtime
  parse-lite-strict.ts         → strict ISO parse
```

## サイズ

| 対象 | gzip |
|------|-----:|
| moment.js (locale 無) | 18,803 B |
| dayjs | 3,041 B |
| **moment2 lite** | **15,574 B** |
| moment2 full | 48,910 B |

moment.js 比: **lite は 17% 削減**。

## エントリ設計

| SKU | 用途 | 含めるもの |
|-----|------|-----------|
| **lite** | size-first、ISO 中心のアプリ | MomentLite, basic parse, basic format, utc, week/isoWeek, toString, dayOfYear |
| **full** | 完全互換 | Moment, 全 parse, 全 format, locale, utc, duration, display-extra, locale registry |

`base` は削除 (lite と full だけに整理)。

## 既存 failure 修正

| テスト | 原因 | 修正 |
|-------|------|------|
| `moment.utc()` treats ISO string without timezone as UTC | `initializeCoreEntry` が `registerUtcApi` 未呼び出し | `src/entry/init.ts` に追加 |
| base entry rejects custom format parsing | 重複した `registerFormatParsePlugin()` 削除で解消 (base 自体も削除済み) |

## full 肥大化の修正

`initializeFullEntry` から不要なものを削除:

- ~~`registerBuiltinTestLocales()`~~ — テスト用架空 locale
- ~~`registerMigrationApi()`~~ — CLI ツールの `moment.config`/`moment.report`
- ~~`registerTemporalBridge()`~~ — `fromTemporal`/`toTemporal`
- ~~`registerFormatParsePlugin()`~~ → `enableCustomFormatParsing()` に置換 (parse-format.ts の重複読み込み回避)

full gzip: 63,909 B → 48,910 B (-24%)

## テスト

- moment.js 互換: 626/626 pass (TZ=UTC, TZ=Asia/Tokyo)
- moment2 固有: 670 tests, 0 fail
