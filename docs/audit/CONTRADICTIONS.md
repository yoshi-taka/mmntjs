# ドキュメント・サイト・実装・テスト間の矛盾一覧

> 最終更新: 2026-05-20 (item 13 追記)  
> ✅ = 修正済み
> 出典: spec.md / README.md / AGENTS.md / site/* / docs/* / src/* / package.json / 実際のテスト結果・ビルド出力

---

## 凡例

| 区分 | 意味 |
|------|------|
| 🔴 High | ユーザーに誤った情報を伝える、または動作に影響する可能性大 |
| 🟡 Medium | 情報が古い／不正確だが動作には直結しない |
| 🔵 Low | 軽微な表記揺れ・内部ドキュメント間の不一致 |

---

## 目次

1. [テスト件数](#1-テスト件数)
2. [Node.js バージョン要件](#2-nodejs-バージョン要件)
3. [Proxy アーキテクチャ](#3-proxy-アーキテクチャ)
4. [パッケージバージョン](#4-パッケージバージョン)
5. [sideEffects 宣言](#5-sideeffects-宣言)
6. [ESM 拡張子](#6-esm-拡張子)
7. [Temporal API の形状](#7-temporal-api-の形状)
8. [バンドルサイズ](#8-バンドルサイズ)
9. [Lite エントリの UTC 対応](#9-lite-エントリの-utc-対応)
10. [Changelog とナビゲーション](#10-changelog-とナビゲーション)
11. [CLI の過剰仕様](#11-cli-の過剰仕様)
12. [STRATEGY.md 日英間の不一致](#12-strategymd-日英間の不一致)
13. [parseTwoDigitYear 実装の重複](#13-parsetwodigityear-実装の重複) ✅
14. [Timezone Arch 文書の古い記述](#14-timezone-arch-文書の古い記述)
15. [CI ジョブと CI Matrix の不一致](#15-ci-ジョブと-ci-matrix-の不一致)

---

## 1. テスト件数

**🔴 High — ユーザーに嘘の互換性保証を伝える**

### 各出典の主張

| 出典 | 主張 | ファイル:行 |
|------|------|------------|
| README | **678/678** pass | `README.md:158` |
| AGENTS.md | **678 tests** | `AGENTS.md:41` |
| STRATEGY.md | **678/678** | `docs/testing/STRATEGY.md:9` |
| STRATEGY.ja.md | **678/678** | `docs/testing/STRATEGY.ja.md:9` |
| site/src/content/site.ts | **630/630** | `site/src/content/site.ts:227` |
| site quality page | **630/630** | `site/src/pages/quality/index.astro:14` |
| 実際のテスト実行 | **630 pass** | `bun test ./test/moment/*.js` |

### 不一致の内容

- `README.md`, `AGENTS.md`, `docs/testing/STRATEGY.md`（日英とも）は **678** と主張
- サイト（`site.ts`）は **630** と主張 ← こちらが正しい（実測値）
- 678 の出典は moment.js 側の total assertion 数や QUnit 版のテスト数などと混同した可能性

### 影響

- README を読んだユーザーは「678 tests passing」を信頼の根拠にするが、実際のカバレッジは 630/630
- サイトと README で数字が異なり、どちらを信じればいいかわからない

### 修正方針

README, AGENTS.md, STRATEGY.md（日英）の 678 → 630 に修正。

✅ 2026-05-20 修正済み

---

## 2. Node.js バージョン要件

**🔴 High — サポート範囲の公式見解が割れている**

### 各出典の主張

| 出典 | 主張 | ファイル:行 |
|------|------|------------|
| spec.md | **>= 14** | `spec.md:71` |
| spec.md CI Matrix | **14, 16, 18, 20, 22** | `spec.md:843` |
| spec.md CI 互換性チェック | **node-version >= 14** | `spec.md:917` |
| package.json | **>=16** | `package.json:7` |
| README | **16+** | `README.md:133,169` |
| 実際の CI (publish.yml) | **24 のみ** | `.github/workflows/publish.yml:27` |

### 不一致の内容

- spec.md は Node 14 以上・CI Matrix に 14,16,18,20,22 を謳う
- package.json の `engines.node` は >=16
- README は 16+
- 実際の CI ワークフローは Node 24 のみテスト

### 影響

- Node 14 で使おうとしたユーザーが動かない（package.json が >=16 のため）
- CI Matrix が存在せず、複数バージョンでの互換性が検証されていない
- プロジェクトの公式見解が統一されていない

### 修正方針

- 実態に合わせて 3 者を統一（推奨: >=16）
- CI Matrix を実装するか、spec.md の記述を実態に合わせる

> spec.md は初期設計案であり実装との乖離は許容。package.json (`>=16`) と README (`16+`) は既に実態に合っている。CI マルチバージョンテストは優先度低。
>
> ✅ 2026-05-20 対応不要 (specは初期案、runtime互換性は確保済み)

---

## 3. Proxy アーキテクチャ

**🔵 Low → ✅ private field 移行で解決（2026-05-20）**

### 各出典の主張

| 出典 | 主張 | ファイル:行 |
|------|------|------------|
| spec.md | "Mutability emulated via Proxy" | `spec.md:47` |
| spec.md | Proxy セクション（freeze/seal/preventExtensions の処理） | `spec.md:222-226, 346-377` |
| 実装 (before) | `src/` に Proxy は一切存在しない | `grep -r "new Proxy" src/` |
| 実装 (after) | `#s` private field + getter/setter で freeze 互換 | `src/moment-class.ts`, `src/moment-lite.ts` |

### 不一致の内容（改）

- spec.md は Proxy ベースのミュータビリティ制御を記述していたが、実装は通常のクラスプロパティ操作だった
- しかし実測の結果、**spec.md の前提（「moment.js は freeze 後に mutation を無視する」）自体が moment.js の実挙動と異なる**ことが判明
  - moment.js: `Object.freeze(m); m.add(1, 'day')` → **成功する**（内部 Date がネストオブジェクトのため）
  - mmntjs (before): 同操作 → `TypeError`（内部状態が own data property のため）
  - → spec.md が想定した freeze 挙動は moment.js と逆だった

### 解決策: Proxy 非導入, private field + getter/setter で対応

2026-05-20、以下の方針で修正:

1. Proxy は導入しない（spec.md の前提が誤っていたため不要）
2. 代わりに `_t`, `_d`, `_dirty`, `$y`, `$M`, `$D`, `$W`, `$H`, `$m`, `$s`, `$ms` を **own data property** から **`#s` private field + prototype getter/setter** に移行

**なぜこれで freeze 互換になるか:**
- `Object.freeze(m)` は own data property のみを凍結する
- `#s` は private field（internal slot）であり、`Object.freeze` の影響を受けない
- prototype 上の getter/setter は freeze 後も動作する
- `m._t = newValue` → prototype setter → `this.#s.t = newValue` → 書き換え成功

### 結果

```ts
const m = mmntjs('2024-01-01');
Object.freeze(m);
m.add(1, 'day'); // ✅ 成功（moment.js と同じ挙動）
```

### 影響

- **ユーザー影響ゼロ** → API, 動作, バンドルサイズ (+~0.13%), 性能 (+~1-2%) いずれも実質変化なし
- **spec.md は Proxy 非使用に修正が必要**（後述）

### 修正内容

- `src/moment-class.ts`: `#s` private field + 11個の getter/setter に移行、`createSimpleMoment()` → `new Moment()`
- `src/moment-lite.ts`: 同様
- `src/core/factory-shared.ts`, `src/core/factory-lite-impl.ts`: 全 `Object.create(Moment.prototype)` → `new Moment()` / `new MomentLite()` に変更

---

## 4. パッケージバージョン

**🔴 High — spec の npm alias 例がすべて間違っている**

### 各出典の主張

| 出典 | 主張 | ファイル:行 |
|------|------|------------|
| spec.md | "Starts at **1.0.0**" | `spec.md:835` |
| spec.md npm alias 例 | `"moment": "npm:mmntjs@^1.0.0"` | `spec.md:256,275,628,1064` |
| package.json | **0.0.3** | `package.json:3` |

### 不一致の内容

- spec.md は 1.0.0 と規定している
- 実際のバージョンは 0.0.3（開発中 / プレリリース）
- spec 内の全 npm alias 例（4箇所）が `^1.0.0` を参照しており、実際に npm publish された場合に解決できない

### 影響

- spec.md のコピペでセットアップすると壊れる
- 0.0.3 というバージョン番号が「プロダクション未対応」という印象を与える

### 修正方針

- spec.md のバージョンを `0.0.3` に合わせるか、1.0.0 に上げるかを決める
- 決まらない限り、spec.md は `^0.0.x` などに暫定修正

---

## 5. sideEffects 宣言

**🔴 High — バンドラーの tree-shaking を破壊する**

### 各出典の主張

| 出典 | 主張 | ファイル:行 |
|------|------|------------|
| package.json (before) | sideEffects: `locale-auto/*` と `plugin/*` のみ | `package.json:64-69` |
| README (before) | "Core entries and `locale/*` remain tree-shakeable" | `README.md:127` |
| `src/entry/full.ts:12` | モジュールレベルで `initializeFullEntry()` を呼ぶ | 実装コード |
| `src/entry/lite.ts:17` | モジュールレベルで `registerLiteCoreApi()` を呼ぶ | 実装コード |

### 不一致の内容

- package.json は `./dist/index.js` / `./dist/lite.js` / `./dist/full.js` を副作用なしと宣言していた
- しかし両エントリともモジュール評価時に **関数呼び出し** を行っている（明確な副作用）
- バンドラー（webpack, Rollup, esbuild）はこの宣言を信じて tree-shake し、結果的に空のバンドルを出力する可能性があった

### 影響

- 本番ビルドで mmntjs が空になって "moment is not a function" エラー
- 特に webpack + sideEffects: true 設定のプロジェクトで発生しうる

### 修正内容

✅ 2026-05-20 修正済み:

- `package.json` の `sideEffects` に `./dist/index.js`, `./dist/index.cjs`, `./dist/lite.js`, `./dist/lite.cjs`, `./dist/full.js`, `./dist/full.cjs` を追加
- `test/tree-shaking.test.ts` と `test/bundle-smoke.test.ts` の期待値を同様に更新
- `README.md` の tree-shaking 記述を修正（initialize が常に走ることを明記）
- `docs/arch/BUNDLE_SIZE.md` の tree-shaking 保証を実態に合わせて修正

---

## 6. ESM 拡張子

**🔵 Low — 軽微な表記間違い**

| 出典 | 主張 | ファイル:行 |
|------|------|------------|
| spec.md | `dist/index.mjs` | `spec.md:58` |
| package.json | `./dist/index.js` | `package.json:17` |

### 不一致の内容

spec.md は `.mjs` 拡張子を謳うが、実際の出力と package.json の exports は `.js`。

修正: spec.md を実態に合わせて `dist/index.js` に修正。

✅ 2026-05-20 修正済み

## 7. Temporal API の形状

**🟡 Medium — spec と README/実装で API シグネチャが異なる**

| 出典 | 主張 | ファイル:行 |
|------|------|------------|
| spec.md | `Moment.toTemporal()` インスタンスメソッド、`MomentStatic.fromTemporal()` スタティックメソッド | `spec.md:104-113` |
| README | `toTemporal(m)`, `fromTemporal(t)` スタンドアロン関数 | `README.md:116` |
| 実装 | スタンドアロン関数: `export { toTemporal, fromTemporal }` | `src/entry/temporal.ts:1` |

### 不一致の内容

- spec.md の TypeScript interface 定義は `m.toTemporal()` 形式
- 実装は `import { toTemporal, fromTemporal } from "mmntjs/temporal"` で使うスタンドアロン関数
- README は実装に合わせて記述されている

### 対応

spec.md は初期設計案であり実装との乖離は許容。動作に影響しないため現状維持。

---

## 8. バンドルサイズ

**🔴 High — README / サイト / 実測値の3者がすべて異なる**

### 原因

- **raw vs gzip の混在**: site は raw、README は gzip 主体で、比較不能
- **bundled vs dist の混在**: Bun.build した結果と tsup の生出力はサイズが倍違う
- **timezone の測定対象がバラバラ**: `logic`, `1970-2030`, `full` の3種類があり、どれを指すか明示されていない
- **site.ts の 141 KB**: 過去のビルドの raw bundled 値。ビルドごとに微妙に変わる

### 修正内容

✅ 2026-05-20 修正済み:

- `docs/arch/BUNDLE_SIZE.md` を正準データに制定。`bun run size` の出力をベースにする
- 測定値の定義: raw = Bun.build raw, gzip = Bun.build gzip, dist = tsup 出力。すべて明示
- timezone は3種を併記（logic / 1970-2030 / full）。README の「75 KB」は full を指す
- site の全数値: 141→150 KB (full), 42→44 KB (lite), 316→449 KB (timezone)
- README Pillar 2: ~55 KB / 15.6 KB → 39 KB / 12 KB (entry table に統一)

---

## 9. Lite エントリの UTC 対応

**🟡 Medium — README の表が誤り**

| 出典 | 主張 | ファイル:行 |
|------|------|------------|
| README 機能表 | UTC mode: "via plugin" | `README.md:110` |
| `src/plugins/core-lite.ts:111-118` | `moment.utc()` ビルトイン実装 | 実装コード |
| `src/entry/lite.ts:6,22` | `momentUTC` を依存として渡す | 実装コード |
| BUNDLE_SIZE.md | "UTC mode via `moment.utc()` (built-in)" | `docs/arch/BUNDLE_SIZE.md:46` |

### 不一致の内容

README の機能一覧表は UTC モードを「プラグインが必要」としているが、lite エントリは標準で `moment.utc()` を実装している。BUNDLE_SIZE.md は正しく「built-in」と記述している。

### 修正方針

README.md:110 の "via plugin" → ✅（チェックマーク、built-in）に修正。

✅ 2026-05-20 修正済み

---

## 10. Changelog とナビゲーション

**🟡 Medium — 設計文書と実装でまったく異なる構成**

| 出典 | 主張 | ファイル:行 |
|------|------|------------|
| WEBSITE_IA.md | Changelog は **トップレベル必須** | `docs/site/WEBSITE_IA.md:23-30` |
| WEBSITE_IA.md | `/changelog` ページ | `docs/site/WEBSITE_IA.md:702` |
| 実際のサイト nav | "Package Size" が存在、Changelog なし | `site/src/content/site.ts:27-37` |
| ファイルシステム | `site/src/pages/changelog` は存在しない | glob確認 |

### 不一致の内容

- WEBSITE_IA.md は Changelog を「compatibility-sensitive adopters にとって機能以上に重要」としてトップレベルに推奨
- 実際のサイトには Changelog が一切存在しない
- 代わりに WEBSITE_IA.md に記載のない「Package Size」がトップレベルナビゲーションに存在する

### 修正方針

- WEBSITE_IA.md を実態に合わせて更新する
- または Changelog ページを作成し、ナビゲーションに追加する

> WEBSITE_IA.md は開発初期の設計案であり、実装との乖離は許容範囲。Changelog ページは現時点では不要と判断。
>
> ✅ 2026-05-20 対応不要 (when-proposal)

---

## 11. CLI の過剰仕様

**🟡 Medium — spec.md に書かれている機能の多くが未実装**

### spec.md に書かれているが未実装のもの

| spec.md の主張 | ファイル:行 | 現実 |
|---------------|------------|------|
| "AI-powered static analysis" での audit | `spec.md:1005` | 実装は単純な正規表現キーワードマッチ (`src/bin/audit.ts:274-321`) |
| `init` が git checkpoint, テスト実行, インストール自動検出 | `spec.md:1061-1067` | 実装は package.json の修正のみ (`src/bin/init.ts:4-35`) |
| `--mode=alias` / `--mode=rewrite` オプション | `spec.md:299-303` | CLI は `--check`, `--apply`, `--fns`, `--dry` のみ |
| パッケージマネージャ自動検出（bun/yarn/pnpm/npm） | `spec.md:932-936` | 未実装 |
| AMD / Require.js パターン対応 | `spec.md:636-688` | 未実装 |
| System.js パターン対応 | `spec.md:663-688` | 未実装 |
| Bower 対応 | `spec.md:614-631` | 未実装 |
| ESLint plugin | `spec.md:1178` | Out of scope だが spec 内に言及あり |

### 影響

- spec.md だけを読んだ開発者が CLI の過度な期待を持ち、`npx mmntjs audit` が AI 解析しないことに失望する
- spec.md と実装のギャップがマーケティング・資料作成の妨げになる

### 対応

spec.md は初期設計案であり実装との乖離は許容。ただし `--mode=alias` は実用的と判断し実装:

✅ 2026-05-20: `mmntjs migrate --mode=alias [dir]` を実装。
   - `runCheck`（解析表示）+ `runInit`（package.json に npm alias 追加）を順次実行
   - npm/bun 専用（pnpm/yarn は非対応と警告）
   - package.json は指定 dir から上方探索（どこにあっても大丈夫）
   - dependencies / devDependencies / peerDependencies 全 field 対応
   - `mmntjs init` コマンドは削除（`--mode=alias` に統一）
   - `--check` 実行後にも branch + test を促すメッセージを追加
   残りの未実装項目（AI audit, AMD/System.js/Bower, ESLint plugin）は不要と判断。

---

## 12. STRATEGY.md 日英間の不一致

**🔵 Low — 内部文書間の表記ゆれ**

| 出典 | 総テスト数 | ファイル:行 |
|------|-----------|------------|
| STRATEGY.md（英語） | ~4203/4203 | `docs/testing/STRATEGY.md:20` |
| STRATEGY.ja.md（日本語） | ~4122/4122 | `docs/testing/STRATEGY.ja.md:17` |

### 不一致の内容

日英のテスト戦略ドキュメントで total テスト数が 81 件異なる。どちらも実際のテスト実行数（`bun run test:hard` の 4642 tests など）と合致しない。

修正: 実測値に合わせて統一。

✅ 2026-05-20 修正済み

---

## 13. parseTwoDigitYear 実装の重複

**🔵 Low → ✅ 2026-05-20 共通ユーティリティに抽出**

同一の `parseTwoDigitYear()` 関数が 4 箇所に独立して存在していた:

| ファイル | 行（before） |
|----------|-------------|
| `src/parse-lite.ts` | 661 |
| `src/parse-lite-strict.ts` | 479 |
| `src/parse.ts` | 3744 |
| `src/parse-format.ts` | 3464 |

修正内容:
1. `src/utils.ts` に `parseTwoDigitYear` を追加
2. 4 ファイルの実装を `export { parseTwoDigitYear } from "./utils"` に置き換え

✅ 全テスト通過（630 tests）。lint 通過。

---

## 14. Timezone Arch 文書の古い記述

**🟡 Medium — 実装はパック形式に移行済みだが文書が古い**

`docs/arch/MMNTJS_TIMEZONE_COMPAT_ARCH.md` の「Current Architecture Risks」セクション（行 5-10）:

```
- The current packages/timezone implementation is Intl-backed
- moment.tz.add() is currently a no-op
- countries() / zonesForCountry() are currently empty
```

これらは **パック形式移行前の古い状態** を記述している。`AGENTS.md:66-67` によりパック形式移行は完了済み。

### 修正方針

Arch 文書を現状（パック形式・unpack 遅延デコード）に合わせて書き直す。

✅ 2026-05-20 修正済み

---

## 15. CI ジョブと CI Matrix の不一致

**🟡 Medium — spec と実際の CI 設定が乖離**

| 出典 | 主張 | ファイル:行 |
|------|------|------------|
| spec.md CI Matrix | "Node versions: 14, 16, 18, 20, 22" | `spec.md:843` |
| `.github/workflows/publish.yml` | Node 24 で1ジョブのみ | `.github/workflows/publish.yml:27` |
| `.github/workflows/ci.yml` | 存在しない | glob確認 |

### 不一致の内容

- spec.md は 5 バージョンでの CI 実行を謳う
- 実際の CI 設定ファイルは publish 用ワークフローのみ（Node 24）
- `ci.yml` が存在しない（`package.json` の "ci" スクリプトはあるが、GitHub Actions 側の設定がない）
- lint / test / build を CI で自動実行する仕組みがない

### 修正方針

- `.github/workflows/ci.yml` を作成（lint → test → build）
- Matrix の Node バージョンを実態に合わせて決定（例: 18, 20, 22）
- spec.md の CI Matrix 記述を実態に合わせる

---

## 付録: 検証コマンド

```sh
# テスト数確認
bun test ./test/moment/*.js

# バンドルサイズ確認
ls -lh dist/*.js
gzip -c dist/index.js | wc -c
gzip -c dist/lite.js | wc -c

# Node engines 確認
cat package.json | grep '"node"'

# Proxy 使用確認
grep -rn "new Proxy" src/

# sideEffects 確認
grep -A5 '"sideEffects"' package.json

# バージョン確認
cat package.json | grep '"version"'

# Temporal エントリ確認
cat src/entry/temporal.ts
```
