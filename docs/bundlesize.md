# Bundle Size Optimization: Moment Timezone Data

mmntjs-timezone のデータ圧縮テクニックまとめ。
全手法とも **lossless**（パブリックAPI非変更、全テスト通過、全zone exact再現）。

## 最終サイズ

| 対象 | 元 | 最適化後 | 削減 |
|------|----|---------|------|
| `builtin-data.generated.ts` raw | 711 KB | 293 KB | **-59%** |
| `dist/index.js` raw | 621 KB | 316 KB | **-49%** |
| `dist/index.js` gzip | 40.7 KB | 38.1 KB | **-6.2%** |
| `dist/index.js` brotli | 27.9 KB | 30.2 KB | +8%（後述） |

## 各テクニック

### 1. Name Dictionary Encoding (コミット `44d8f761`)

**ファイル**: `scripts/generate-timezone-data.ts`
**手法**: zone名を2文字の base-60 数値IDに置換

- ゾーン名（`America/New_York` など14文字）→ `2O`（2文字）
- namesBlob（`N`）に `index→name` マッピングを格納
- zonesBlob, linksBlob, countriesBlob の全zone名が対象
- runtime の `ensureIndexBuilt()` でID→名前に逆変換してから materialize

### 2. Permutation-Group Index Codec (コミット `9f949083`)

**ファイル**: `scripts/tz-codec.ts`, `install-core.ts`, `install.ts`
**手法**: transition state 列（indices）を permutation orbit として run-length 圧縮

zone の indices フィールド（例: `0121212121...`）は大半が DST の交互パターン。
これを以下の run に分解:

| Run種別 | 制御文字 | フォーマット | 例 |
|---------|---------|------------|-----|
| pair-repeat | `^` | `^abN` | 12 を62回繰り返し = 4byte |
| single-repeat | `~` | `~aN` | 状態0を10回 = 3byte |
| increment | `@` | `@aN` | 0,1,2,3,... = 3byte |

- 制御文字は base-62 非含の `^ ~ @` を使用（曖昧性回避）
- カウントは single base-62 char (0-61 = 1-62回)、超える場合は chain
- 符号化が元より大きくなるzoneは plain format 維持
- **効果**: indices 119KB → 7KB (**94.1%削減**)
- **デコード速度**: ~5ns/index, ~2μs/zone
- warm path はキャッシュ後、従来の typed array 参照のみ

### 3. Delta Frequency Dictionary (コミット `db67beab`)

**ファイル**: `scripts/tz-dual-codec.ts`, `install-core.ts`, `install.ts`
**手法**: 全zoneのdelta値をグローバル頻度辞書で token ID 化

- zones blob 1行目に `!D|{base60_val1} {base60_val2} ...` として辞書を格納
- 各zoneの deltas フィールドを辞書ID（base-60数値）に置換
- 頻出deltaほど短いID（最頻 `342660` = ID `0`）
- 辞書エントリ数: 1744（119K transitions のユニーク値）
- runtime の `ensureIndexBuilt()` で `!D|` ヘッダ行を検出、`_deltaDict` に parse
- `unpack()` 内で辞書引きを1回行うだけ
- **効果**: deltas 562KB → 256KB (**54.4%削減**)

### 4. Zone Sorting (コミット `db67beab` 内)

**ファイル**: `scripts/generate-timezone-data.ts`
**手法**: zone を地域→offset schema でソートして compressibility 向上

- 1次キー: region（`America/`, `Europe/` など）
- 2次キー: offset文字列（DSTパターンの代理指標）
- gzipが cross-zone パターンを検出しやすくなる
- **効果**: +gzip ~~2.5%改善~~、brotli ~~0.9%改善~~

## 総合効果チャート

```
original: ━━━━━━━━━━━━━━━━━━━━━━━━ 711KB
+name dict:━━━━━━━━━━━━━━━━━━━━━━ 711KB（namesはblob外へ）
+index codec:━━━━━━━━━━━━━━━━━━━━ 599KB (-16%)
+delta dict: ━━━━━━━━━━━━━━━━     293KB (-59%)
+sorted:     ━━━━━━━━━━━━━━━━     293KB (gzipのみ改善)
```

gzip:
```
original: ━━━━━━━━━━━━━━━━━━━━━━ 34.8KB
+all:     ━━━━━━━━━━━━━━━━━━━━   31.8KB (-8.6%)
```

## アーキテクチャの決定

### なぜ zone 行単位を維持したか
- `materializeZone()` が blob から zone 行を slice して処理
- zone 行フォーマットを維持することでインデックス構造がそのまま使える
- カラム型への完全移行は `ensureIndexBuilt` の rewrite が必要でトレードオフに見合わず

### なぜ delta dictionary だけか
- deltas が zone blob の **96.2%** を占める（562KB/584KB）
- abbrs+offsets の辞書化は高々 ~6KB の節約に複雑さが釣り合わない
- abbr検出のヒューリスティックが fragile だったため断念

### brotli が増えた理由
- 元の base-60 delta 値（`1zb0 Op0 1zb0 Op0 ...`）は英字混じりで brotli の文脈モデルに適合しやすい
- 辞書ID化後（`0 1 0 1 ...`）は数値のみで文脈多様性が減り、brotli の圧縮効率が低下
- gzip は逆に単純なパターンを良く圧縮するため改善
- **トレードオフ**: gzip +6.2% 改善 vs brotli +8% 増加、かつ raw -59%のメリットを優先

## ファイル構成

| ファイル | 役割 |
|---------|------|
| `scripts/tz-codec.ts` | Permutation-group index codec の encoder/decoder |
| `scripts/tz-dual-codec.ts` | Delta dictionary の build/encode/decode |
| `scripts/generate-timezone-data.ts` | Build pipeline — 全codecを直列適用 |
| `packages/timezone/src/install-core.ts` | Runtime decoder（full bundle） |
| `packages/timezone/src/install.ts` | Runtime decoder（logic bundle） |

## 実行方法

```sh
# データ再生成（codec + dict + sort を適用）
bun run scripts/generate-timezone-data.ts

# ビルド
cd packages/timezone && bun run build

# テスト
TZ=UTC bun run test
TZ=Asia/Tokyo bun run test
```
