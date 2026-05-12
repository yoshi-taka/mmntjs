# moment2 bundle size削減メモ

## 目的

`moment2` の bundle size を、`moment` 互換を壊さない範囲で段階的に削る。

前提:

- 最優先は `moment` 互換
- `dayjs` 級の極小サイズは現実的な目標ではない
- 効くのは micro-optimization より `core` の責務削減

## 現状認識

最近の計測では、だいたい次のサイズ感だった。

| artifact | raw | gzip | 補足 |
|---|---:|---:|---|
| `moment2/core` | 約 `290 KB` | 約 `49 KB` | locale registry なし |
| `moment2/full` | 約 `305 KB` | 約 `55 KB` | 全部入り |
| `moment/min/moment.min.js` | `58,890 B` | `18,892 B` | locale なし |
| `moment/min/moment-with-locales.min.js` | `375,055 B` | `76,950 B` | locale 全部入り |
| `dayjs/dayjs.min.js` | `7,160 B` | `3,041 B` | 比較用 |
| `date-fns/addDays.js` | `1,378 B` | `677 B` | 関数単位 import |
| `date-fns/format.js` | `25,019 B` | `5,452 B` | 関数単位 import |

読み方:

- `moment2/full` は `moment-with-locales.min.js` より小さい
- `moment2/core` は `moment.min.js` よりかなり大きい
- `dayjs` や tree-shake された `date-fns` と比べると重い

これは失敗ではなく、mutable / prototype / static API を含む `moment` 互換のコスト。

## すでに効いた施策

1. locale を個別 import 化した
2. `core` / `full` / `temporal` の入口を分けた
3. `core` から locale registry を外した
4. `core` から Temporal bridge と migration を外した

この方向は正しい。今後も `core` から責務を剥がすのが本筋。

## 優先度つき削減案

### 1. `core` を en runtime だけに寄せる

最優先。

今の `core` は locale registry を外したが、locale runtime との結びつきはまだ強い。`en` を除く locale の知識を `core` からさらに減らせるなら、効果が大きい。

狙い:

- `core` は `en` locale runtime のみ前提
- locale の登録、列挙、更新 API は `full` 側だけ
- `core` では `moment.locale()` の static API を最小化または非対応に寄せる

注意:

- instance 側の `m.locale()` と format は壊さない
- `localeData()` の扱いを雑にすると互換破壊になる

### 2. `duration` の境界を見直す

優先度高。

`moment.duration` は互換上かなり重要だが、`core` に常設すべきかは再検討余地がある。

候補:

- `duration` を `core` に残す
- `duration` 本体は残しつつ周辺 static API を薄くする
- 将来 `full` 側へ寄せるための registration 境界だけ先に作る

注意:

- いきなり外すのは危険
- まずは plugin/entry 境界を明示するところまで

### 3. display 層をさらに薄くする

優先度中。

`format` と `reltime` はすでに `src/display/` へ寄せた。次は dependency を見直す。

候補:

- `format` token engine の遅延ロード
- relative time と calendar をさらに分離
- `format` の common fast path と locale-aware path を分ける

注意:

- 細かく刻みすぎると互換性コストが増える
- ここは大幅削減より整理効果の方が大きい

### 4. parse と format の分離度を上げる

優先度中。

`core` の parse と display の format が暗黙に引き合っている部分を減らす。tree-shaking 上の見通しがよくなる。

候補:

- parse は parse に必要な locale helper だけを見る
- format token 展開は display 側に閉じる
- `Moment` 本体から display helper 直結を減らす

### 5. timezone をコアに近づけない

優先度高。

これは削減案というよりガードレール。

- timezone は別 package のまま維持
- `core` と `full` に timezone data や runtime 依存を持ち込まない

ここを破るとサイズと責務の両方が崩れる。

## やらない方がいい案

1. `moment_fixed.ts` の大分割を先にやる
2. lodash 風の細粒度 export を先に公開する
3. `dayjs` と同じ粒度をそのまま真似る
4. 互換 API を削ってサイズだけ追う
5. timezone を本体に統合する

理由:

- どれも差分の大きさに対してサイズ効果が読みにくい
- 互換破壊のリスクが高い
- 今の段階では `core` の責務削減の方が費用対効果が高い

## 実行順

現実的な順番はこう。

1. `core` の locale runtime 依存を棚卸しする
2. `duration` の registration 境界を作る
3. display の依存を薄くする
4. parse / format の結合を減らす
5. その後に、必要なら `core` 専用の size regression test を追加する

## 判断基準

サイズ削減案は、次の条件を満たすものだけ採用する。

1. `moment` 互換を壊さない
2. `core` と `full` の責務差が明確になる
3. tree-shaking test で差分を検証できる
4. `moment_fixed.ts` の大規模再編を前提にしない

## 補足

現時点の build は、`src/moment_fixed.ts` に混入している別差分の `NUL` バイトで不安定になることがある。bundle size の議論自体は有効だが、正確な再計測はその修正後にやる。
