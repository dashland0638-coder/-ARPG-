# Architecture Rules (for AI implementation)

AIがゲーム実装を変更するときに参照する、実装上の重要事項とルール。

## Relationship With Root ARCHITECTURE.md

| ファイル | 役割 |
| --- | --- |
| ルート [`../ARCHITECTURE.md`](../ARCHITECTURE.md) | **現在の技術アーキテクチャの詳細資料**。ディレクトリ構成、各ファイルの責務、連結の経緯と理由 |
| `docs/ARCHITECTURE.md`（本ファイル） | **AIが実装変更時に守るべきアーキテクチャルール**。要点と禁止事項 |

本ファイルはルート `ARCHITECTURE.md` を要約・参照するもので、置き換えない。
細部で食い違いを見つけた場合は、ルート `ARCHITECTURE.md` と実装を正とし、
差異を docs/README.md の Known Implementation Differences に記録する。

## Stack

- **Vite** — 開発サーバ／ビルド。`npm run dev` / `npm run build`（出力は `dist/`）
- **Three.js** — 描画。CDNではなく npm 経由でバンドルし、バージョンは `package.json` に固定
- **GitHub Pages** — `main` への push で `.github/workflows/deploy.yml` が公開。
  `vite.config.js` の `base` は `/-ARPG-/`

## Frozen File

**`basefile.html` は凍結。変更禁止。**

移行前の単一ファイル版のスナップショットとして残してあるだけで、もう更新しない。
今後の変更はすべて `src/` 側に対して行う。

## Development Target

開発対象は `src/`。

| パス | 内容 |
| --- | --- |
| `src/main.js` | エントリ。`virtual:legacy-core` を import するだけ |
| `src/core/` | `state` と、state非依存の「計算の核」。真のESモジュール。単体テスト対象 |
| `src/audio/` | SE合成・BGM再生・生成音楽。真のESモジュール |
| `src/textures/` | 手続きテクスチャ／バンプマップ生成。真のESモジュール |
| `src/render/` | Low Polyキャラクター用の追加ジオメトリ（純粋関数） |
| `src/legacy/parts/` | まだモジュール化されていない本体（機能単位の14ファイル）。**下記の制約あり** |
| `src/legacy/concat-plugin.js` | parts を1つの仮想モジュールへ連結する Vite プラグイン |
| `src/styles/` | 全UIのCSS |

## Legacy Rule（最重要）

`src/legacy/parts/01〜14-*.js` は **互いに `import`/`export` を一切使わない**。
`concat-plugin.js` がビルド／開発サーバ起動のたびにファイル名順で1つの文字列へ
連結し、`virtual:legacy-core` という1つの仮想モジュールとして返す。
実行時には、これらは **1つの共有スコープ** として動く。

守ること:

- **legacy コードを勝手にES Module化しない。**
  `state` 以外にも `scene` / `camera` / `renderer` / `player` / `companion` /
  `currentWorldKey` / `walls` / `doors` / `enemies` / `chests` / `projectiles` など
  **約90個の共有可変変数**が素の `let` で保持され、500近い関数から直接再代入されている。
  ESモジュールは import した束縛への再代入を許さないため、一括変換は
  テストで拾いきれない取りこぼしのリスクが高い（実際に過去、
  `applySurfaceDetail()` の切り出しで `renderer` / `qualityIdx` への依存を見落とし、
  `buildWorld()` の例外処理に静かに飲み込まれた事故がある）
- parts 内の各ファイルを **独立したモジュールとして動く前提で書かない**。
  変数は他の part ファイルで宣言されているかもしれない
- 新しい関数・変数は、ルート `ARCHITECTURE.md` の分類表に従って置く。
  既存の分割点（各ファイル冒頭のコメント）をまたいで関数を分割しない
- 個々の part ファイルを単体で `node --check` するとエラーになる（import も export も
  無い断片のため）。構文チェックは連結後に対して行う（`npm run build` / `npm run dev`）
- module化が必要になった場合は、**別タスクとして分析・計画を立てる**
  （手順はルート `ARCHITECTURE.md`「真のESモジュールへ格上げする場合」）

### 新しいロジックを書くときの定石

`core/` へ置けるのは「`state`・敵オブジェクト・3D座標に依存しない計算の核」だけ。
`state` の読み書きは parts 側に薄いラッパーとして残す。
この形にしておくと、ゲームを起動せずに `tests/unit/` で単体テストできる一方、
90個の共有変数問題には触れずに済む。

例: `applyOutgoingDamageMods(amount, en)` は parts 側で `state.hp` や
`en.group.position` を読み、純粋な数値だけを `core/damage-math.js` へ渡す。

## Minimal Change Rule

- 既存コードを理解してから変更する
- 目的達成に必要な最小変更だけを行う
- 「ついでの改善」はしない。不要なリファクタリングは禁止
- 原因不明の問題に対して推測で大規模変更をしない
- 既存の戦闘基盤（体幹／パニッシュ窓／Super Armor／Guardian／Guard Break／
  Break／Execution／ボスのフェーズ管理）は **使うだけで触らない**

## Testing Rule

変更後は可能な範囲で次を実行する。

```sh
npm run build      # 連結後の構文チェックを兼ねる
npm run test:unit  # node:test（tests/unit/*.test.js）
npm test           # Playwright E2E（tests/*.spec.js）
```

- E2E の初回は `npx playwright install chromium` が必要
- Playwright は `playwright.config.js` の `webServer` 設定で `npm run dev` を自動起動する。
  `tests/unit/` は `testIgnore` で Playwright の収集対象から除外済み
- テストは `console.error` も監視する（`tests/helpers.js` の `watchErrors`）。
  過去の「例外処理に静かに飲み込まれる」事故への対策なので、無効化しない
- テストできない場合は理由を明記する

## Assets

- 画像・音声は `public/` に置けば絶対パスで参照できるが、GitHub Pages は
  サブパス（`/-ARPG-/`）配信のため、コード内で直接パスを fetch すると本番だけ404になる。
  `audio.js` / `textures.js` の `resolveAssetUrl()` が `import.meta.env.BASE_URL` で吸収する
- BGM/SE は `src/audio/asset-manifest.js`、テクスチャ画像は
  `src/textures/texture-manifest.js` に登録する。未登録・読み込み失敗時は
  手続き生成へ自動フォールバックする
- 詳細は [`../ASSETS.md`](../ASSETS.md)

## Reference Documents

| ファイル | 内容 |
| --- | --- |
| [`../ARCHITECTURE.md`](../ARCHITECTURE.md) | 技術アーキテクチャの詳細 |
| [`../ARPG_INTEGRATION.md`](../ARPG_INTEGRATION.md) | 探索・視界・カメラ・処刑を含む統合方針 |
| [`../COMBAT_DESIGN.md`](../COMBAT_DESIGN.md) | 戦闘・職業システムの設計経緯と数値の根拠 |
| [`../MANSION_SCENARIO.md`](../MANSION_SCENARIO.md) | 森の洋館シナリオの設計（間取り・敵・演出） |
| [`../ASSETS.md`](../ASSETS.md) | アセット追加ガイド |
| [`../tests/README.md`](../tests/README.md) | テストの種類と実行方法 |
| [`../.ai/AGENTS.md`](../.ai/AGENTS.md) | AIエージェントの運用ルール |
