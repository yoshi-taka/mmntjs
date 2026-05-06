# moment2 アーキテクチャ方針

## 目的

`moment2` は `moment` 互換を最優先に維持しつつ、内部実装と配布形態をモジュラーに寄せる。

ここでいう「モジュラー」は次の 3 つを意味する。

1. 実装上の責務が分かれていること
2. 機能追加が局所的に行えること
3. 将来的に部分 import / tree-shaking に耐えられる構造であること

重要なのは、最初から完全分割を目指して互換性を崩さないこと。  
まずは `moment` として自然に動く単一パッケージを保ち、その上で境界を明確にする。

## 前提

- ユーザー向けの第一提供物は引き続き `@compat/moment2`
- 既存の `moment` API と `moment.fn` 拡張文化を壊さない
- locale と timezone はコアから分離可能な領域として扱う
- 内部では段階的に分割してよいが、公開 API は急に分割しない

## 設計原則

### 1. 互換性をモジュール性より優先する

`moment` は mutable・prototype 拡張・静的メソッド追加を前提に使われることが多い。  
そのため、内部をきれいに分けても、公開面で「別物」に見える設計は採らない。

### 2. 分割単位は「責務」で切る

メソッド 1 個ごとの極端な分割より、まずは以下の責務単位で分ける。

- 生成: `moment()` / `moment.utc()` / parse
- 値オブジェクト: `Moment`, `Duration`
- 演算: add/subtract/startOf/endOf/diff
- 表示: format/calendar/fromNow/toNow
- locale
- timezone
- migration / Temporal bridge

この粒度なら依存関係が読みやすく、後から finer-grained に落とせる。

### 3. prototype 追加は「登録レイヤー」に閉じ込める

各機能の実装本体と、`Moment.prototype` / `moment` への代入を分離する。

- 実装本体: 純粋関数または小さな内部 API
- 登録レイヤー: `moment.fn.foo = ...` や `moment.bar = ...`

これで tree-shaking を考えやすくなり、テストも実装単位で持ちやすい。

### 4. コアは薄く、周辺機能は遅延分離可能にする

常時必要なものだけをコアに置く。

- `Moment`
- `moment()` ファクトリ
- parse の最小核
- units / utils
- 互換維持に必須の静的プロパティ

一方で以下はコア外へ寄せる。

- locale データ
- timezone
- migration 補助
- Temporal bridge の付加 API
- 追加表示系 API

### 5. 実装の再利用単位を先に固定する

API ごとに直接 prototype 実装を書くのではなく、内部で共有する演算 API を先に置く。

例:

- 年月日時の取得・設定
- offset 計算
- locale lookup
- relative time の文字列化
- token format 展開

公開メソッドは、その内部 API を呼ぶ薄い層にする。

## モジュール境界

最終的な整理方針として、ソースは次の責務で分ける。

```text
src/
  core/
    moment.ts        Moment 本体
    duration.ts      Duration 本体
    factory.ts       moment() / moment.utc() / parseZone() の入口
    parse.ts         文字列・配列・object からの生成
    units.ts         unit 正規化と日付計算の基礎
    utils.ts         汎用 helper

  ops/
    manipulate.ts    add/subtract/startOf/endOf
    compare.ts       isBefore/isAfter/isSame/diff/min/max
    query.ts         year/month/date/hour... などの getter/setter
    convert.ts       toDate/valueOf/unix/toJSON/toISOString...

  display/
    format.ts        format token engine
    calendar.ts      calendar 表示
    reltime.ts       from/to/fromNow/toNow

  locale/
    registry.ts      locale 管理 API
    en.ts            デフォルト locale
    *.ts             個別 locale

  plugins/
    core.ts          コア API の prototype/static 登録
    display.ts       表示系 API 登録
    locale.ts        locale API 登録
    duration.ts      duration API 登録
    temporal.ts      Temporal bridge 登録
    migration.ts     report/config など登録

  entry/
    full.ts          従来互換の全部入り
    core.ts          locale を含む軽量入口
    temporal.ts      Temporal bridge を含む入口
```

ファイル名は将来変えてもよいが、境界の考え方は維持する。

## 現在の実装状況

2026-05-06 時点では、設計上の境界のうち entry / plugin / registration 層までは実装済み。

現在の実ファイル配置は次のとおり。

```text
src/
  index.ts            compatibility entry wrapper
  full.ts             full entry wrapper
  core-entry.ts       core entry wrapper
  temporal-entry.ts   temporal helper entry wrapper

  entry/
    index.ts          compatibility entry 実体
    full.ts           full entry 実体
    core.ts           core entry 実体
    temporal.ts       temporal helper 実体
    init.ts           entry 初期化シーケンス
    types.ts          entry 公開型

  core/
    factory.ts        moment() / moment.utc() / parseZone() の入口

  plugins/
    core.ts           コア API 登録
    display.ts        表示系 static API 登録
    locale.ts         locale static API 登録
    temporal.ts       Temporal bridge 登録
    migration.ts      migration API 登録
    test-locales.ts   テスト用 locale 登録
```

この時点での判断は以下。

- `index.ts` 集中は解消済み
- 公開入口と内部 entry 実体は分離済み
- registration は責務ごとに分離済み
- `@compat/moment2/full` / `core` / `temporal` は公開済み
- locale は `@compat/moment2/locale/*` で公開済み

一方で、次はまだ途中または未着手。

- `ops/` / `display/` への実装本体の再配置
- `duration` を plugin/entry 境界で明示する整理
- timezone をこの境界にどう接続するかの整理
- lodash 風の細粒度 export を出すかどうかの判断

## 公開 API の考え方

### 基本

- デフォルト export は引き続き `moment`
- `moment.fn` を維持する
- `moment.duration` などの静的 API も維持する
- locale import 形式は `moment` と同じにする

### 段階的な公開

当面の公開面は 2 段階で考える。

1. 既存互換の単一入口を維持する
2. 内部境界が安定したら、追加のサブパス export を出す

現在はこの段階まで進めている。

- `@compat/moment2` -> compatibility wrapper
- `@compat/moment2/full` -> full runtime
- `@compat/moment2/core` -> 軽量 runtime
- `@compat/moment2/temporal` -> Temporal helper

例:

```text
@compat/moment2
@compat/moment2/full
@compat/moment2/core
@compat/moment2/temporal
@compat/moment2/locale/ja
@compat/moment2-timezone
```

`@compat/moment2/add` のような lodash 風 API は、内部依存整理が終わってから判断する。  
先に公開すると、後で依存の持ち方を変えにくくなる。

## 依存ルール

### 許可する依存方向

```text
core -> ops -> display
core -> locale
entry -> plugins
plugins -> core/ops/display/locale
timezone package -> @compat/moment2 public API
```

### 避けるもの

- `display` から `entry` への逆流
- locale データからコア実装への直接依存
- plugin 同士の循環依存
- 1 メソッド実装の中で parse / format / locale を全部抱えること

## テスト方針

互換性確認は 1 種類のテストに寄せない。

現在の `test/properties/` は次の 3 層で持つ。

1. `moment` オラクル比較
2. `moment2` 単体のメタモルフィック不変条件
3. `moment` と `moment2` の cross-metamorphic 検証

特に変換系 API は、単純な出力一致だけではなく「同じ変換関係が両実装で成立するか」を見る。

対象の中心:

- add / subtract / diff
- utc / local / utcOffset
- parseZone
- startOf / endOf
- comparison APIs
- duration arithmetic

この層は [test/properties/metamorphic.test.ts](/Users/as/var/localrepos/moment2/test/properties/metamorphic.test.ts:1) に集約する。

## plugin レイヤーの責務

plugin は「機能本体」ではなく「公開 API への取り付け」を担当する。

例:

```ts
// 実装
export function addImpl(ctx: Moment, amount: number, unit: string): Moment {
  ...
}

// 登録
moment.fn.add = function(amount, unit) {
  return addImpl(this, amount, unit)
}
```

これにより:

- 実装を純粋にテストできる
- prototype 汚染箇所を追跡しやすい
- 将来の部分 export が作りやすい

## locale 方針

- デフォルトは `en`
- 他 locale は個別 import
- locale データは副作用 import を許容する
- locale registry は 1 箇所に集約する

locale は `moment` 互換上、副作用 import と相性が良い。  
ここは無理に純関数化せず、管理面だけ明確にする。

## timezone 方針

timezone は別パッケージ `@compat/moment2-timezone` を維持する。

理由:

- 依存と責務が明確に分かれる
- Intl 依存の実装差分をコアに持ち込まない
- `moment-timezone` 相当の利用者だけが読み込める

timezone 側は `moment.fn` 拡張を使って統合するが、コアは timezone を知らなくてよい。

## Temporal bridge 方針

`moment2` の価値は単なる互換ではなく、Temporal への移行導線にある。  
ただしこれもコア常設ではなく、責務上は独立機能として扱う。

## 進捗整理

段階ごとの進捗は次のとおり。

### Phase 1: `index.ts` の責務削減

- 完了
- `core/factory.ts` へ生成ロジックを抽出
- Temporal / migration / test locale 登録を分離

### Phase 2: plugin / entry 層の導入

- 完了
- `plugins/core.ts`
- `plugins/display.ts`
- `plugins/locale.ts`
- `plugins/temporal.ts`
- `plugins/migration.ts`
- `plugins/test-locales.ts`
- `entry/full.ts`
- `entry/core.ts`
- `entry/temporal.ts`
- `entry/init.ts`
- `entry/types.ts`

### Phase 3: 公開入口の段階的分離

- 完了
- `@compat/moment2`
- `@compat/moment2/full`
- `@compat/moment2/core`
- `@compat/moment2/temporal`
- `@compat/moment2/locale/*`

### Phase 4: 実装本体の再編

- 未完了
- `ops/` / `display/` / `locale/registry.ts` のような再配置はまだこれから
- この段階に入る前に、`duration` と timezone の境界を先に確定する

- `toTemporal`
- `fromTemporal`
- usage tracking
- migration report

これらは `migration` / `temporal` 系のモジュールに閉じ込める。

## ビルド方針

- 入口は複数持てる設計にする
- locale はサブパス export
- timezone は別 package
- `sideEffects` は locale / registration の実態に合わせて慎重に定義する

特に `sideEffects: false` は、prototype 登録や locale 副作用 import と衝突しやすい。  
公開 entry ごとに「副作用前提かどうか」を明示して扱う。

## 段階的移行プラン

### Phase 1: 境界の明文化

- `core / ops / display / locale / plugins / entry` の責務を固定
- 既存 `src/index.ts` のロジックを責務ごとに再配置
- 挙動は変えない

### Phase 2: 登録レイヤー分離

- 実装本体と `moment.fn` 代入を分離
- 共有ロジックを `ops` / `display` に抽出
- 既存テストを壊さない

### Phase 3: 入口分離

- `full`
- `temporal`
- locale subpath
- timezone package

この段階で初めて、公開 export の粒度を増やせる。

### Phase 4: 必要なら finer-grained plugin 化

`add`, `format`, `year` のような個別入口はこの段階で再評価する。  
互換性・依存・配布サイズの根拠が揃ってから出す。

## 非目標

今すぐやらないこと:

- すべての API を 1 メソッド 1 ファイルにすること
- 最初から lodash 完全互換の import 体系を出すこと
- plugin のために `moment` 互換を壊すこと
- locale / timezone まで含めて完全無副作用化すること

## 要点

`moment2` は「単枚岩を一気に分割する」のではなく、  
「互換 API を保ったまま、内部を責務境界で解いていく」設計を採る。

優先順位は次の通り。

1. `moment` 互換
2. 責務分離
3. 入口分離
4. 必要に応じた細粒度 export

この順番を崩さない限り、`moment` らしさを保ったままモジュラーにできる。
