# Quality Uplift Plan (短期)

現状の品質基盤を短期間で底上げするための段階的プラン。

## 現状サマリ

| カテゴリ | 内訳 |
|----------|------|
| moment.js 互換テスト | 52 files |
| moment2 固有テスト | 167 lines, 1 file |
| ロケールテスト | 138 files |
| プロパティベーステスト | 4 files |
| ファズハーネス | 9個 |
| ミューテーション | 12 operators, `moment2.ts` のみ |
| クラッシュファイル | 22個 (未トリアージ) |
| SBST | 2 files (POC) |
| カバレッジ | 未導入 |

## Phase 1: クラッシュ整理

- 22個の `crash-*` ファイルをハーネスごとに分別
- 現在のビルドで再現するか確認
- 固定済みは削除、未解決は `test/regression/` に回帰テスト化
- ddmin で最小化してから登録

## Phase 2: ミューテーション拡充

- 対象ファイル拡大: `parse.ts`, `duration.ts`, `format.ts`, `parse-format.ts`, `locale.ts`
- operator 追加: 境界値オフバイワン, nullチェック削除, 早期return削除, 条件反転
- survival rate 自動集計

## Phase 3: ファズ corpus & 辞書

- `test/fuzz/corpus/{parse,operations,...}/` 作成
- moment.js テストケース等を seed として配置
- `.dict` ファイル導入 (ISO 8601 tokens, 月名, format tokens)
- corpus を git 管理

## Phase 4: カバレッジ計測

- `bun test --coverage` または c8 で行カバレッジ取得
- CI で閾値 (80%) 設定
- 低カバレッジ箇所に mutation / プロパティテストを優先追加

## Phase 5: 差分ファジング多様化

- date-fns, luxon, dayjs との比較ハーネス追加
- `test:hard` のみで実行

## Phase 6: TZ バリエーション

- ファズハーネスにランダム TZ 切り替え
- `TZ=UTC` / `TZ=Asia/Tokyo` 両方でファズ実行

## Phase 7: SBST 本格化

- カバレッジガイド付き weighted arbitrary
- 既存プロパティテストに SBST モード追加
- adversarial testing (NaN, overflow, 極値)
