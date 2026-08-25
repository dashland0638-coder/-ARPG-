# アーキテクチャ

このプロジェクトは `basefile.html` 1ファイルから、Vite製の通常のWebアプリ構成へ移行した。理由は将来的な拡張性(音楽/SE/テクスチャの外部ファイル化、機能単位での分割)を優先したため。

## 現在の構成

```
index.html                  Viteのエントリーポイント(旧basefile.htmlの<body>相当)
src/
  main.js                    エントリースクリプト。'virtual:legacy-core' を import するだけ
  styles/main.css             旧basefile.htmlの<style>をそのまま移した全UIのCSS
  core/state.js               ゲーム進行状況(state)。他のどのファイルからも読み書きされる
  audio/audio.js               SE合成(WebAudio)。state.sfxVolume以外への依存なし
  textures/textures.js         手続きテクスチャ/バンプマップ生成。state依存なし
  legacy/
    concat-plugin.js           Viteプラグイン。下記parts/を1つの仮想モジュールへ結合する
    parts/01〜14-*.js           まだ独立モジュール化されていない残り(約15,900行)を
                                機能単位で14ファイルに分割したもの。詳細は次の章
public/
  manifest.webmanifest        PWA用マニフェスト(iPhoneのホーム画面に追加してフルスクリーン起動できる)
  icons/                      PWAアイコン(プレースホルダー。差し替え歓迎)
basefile.html                移行前の単一ファイル版。凍結スナップショットとして残置(下記参照)
```

`npm run dev` で開発サーバ、`npm run build` で `dist/` に静的ファイル一式を生成する。Three.jsは(CDNではなく)npm経由のバンドルになった。

## `basefile.html` の扱い

移行前の状態を凍結したスナップショットとして残してある。**今後の変更はすべて `src/` 側に対して行い、`basefile.html` はもう更新しない。** 何か問題が起きた際の切り戻し用参照、あるいは「サーバー無しでとにかく1ファイルで動かしたい」という場面での非常用に置いてあるだけで、いずれ削除して構わない。

## `src/legacy/parts/` はなぜ「連結」なのか(真のESモジュールではない)

`state` / オーディオ / テクスチャ生成の3つは、真のESモジュールとして切り出し済み(`import`/`export`で他ファイルと安全にやり取りできる)。残りは `src/legacy/parts/01〜14-*.js` に、機能単位のファイルへ分割してある:

| ファイル | 内容 |
|---|---|
| `01-character-creation.js` | キャラメイクUI・ダイス割り振り |
| `02-world-common.js` | Three.js初期化・ワールド共通処理(壁/扉/階段/当たり判定/カットシーン) |
| `03-dungeons-mansion-temple.js` | 洋館・時計塔・温室・神殿 |
| `04-dungeons-ship-waterway.js` | 幽霊船・地下水路 |
| `05-rendering-rig.js` | ドット表現・体型・アウトライン・コンボ演出 |
| `06-player-enemy.js` | プレイヤー/敵のリグ構築 |
| `07-ai-combat.js` | 敵AI・ボス攻撃・被ダメ補正 |
| `08-loot-equipment.js` | ドロップ・装備・特殊効果・宝箱・コンパニオン |
| `09-save-load.js` | セーブ/ロード |
| `10-input.js` | タッチ/ゲームパッド入力・オーバーレイ管理 |
| `11-combat-actions.js` | 攻撃・必殺技・武器切替 |
| `12-progression-ui.js` | 会話・ボス撃破演出・スフィア/スキル/ショップUI・撤退 |
| `13-update-loop.js` | メインループ・移動・カメラ演出 |
| `14-hud-boot.js` | HUD・ミニマップ・起動処理 |

**ただし、これらは互いに `import`/`export` を一切使わない。** `src/legacy/concat-plugin.js`(Viteプラグイン)が、ビルド/開発サーバ起動のたびにファイル名順で1つの文字列に連結し、`virtual:legacy-core` という1つの仮想モジュールとして返す。つまり実行時には、旧basefile.htmlの`<script>`の中身がそのまま1つの共有スコープとして動いている。

### なぜ真のESモジュールに分割しなかったか

このコードは `state`(ゲーム進行状況)以外にも、`scene` / `camera` / `renderer` / `player` / `companion` / `currentWorldKey` / `walls` / `doors` / `enemies` / `chests` / `projectiles` など、**約90個の共有可変変数**を素の `let` として保持し、500近い関数のあちこちから直接**再代入**している(例: `currentWorldKey = 'tavern'`)。

ESモジュールは `import` した変数への**再代入を許さない**(参照先オブジェクトのプロパティを書き換えるのは問題ないが、束縛そのものの差し替えはできない)。90個の変数それぞれについて「誰が読み書きするか」を洗い出し、全部を共有オブジェクト経由の書き換えに直す一括変換は、テストで拾いきれない取りこぼしのリスクが実装量に対して高すぎると判断した。実際、`applySurfaceDetail()` を `textures.js` へ切り出した際に `renderer`/`qualityIdx` という2つの外部変数への依存を見落とし、`buildWorld()` 自身の例外処理に静かに飲み込まれて一時的に本番相当のビルドへ入り込んだことがある(該当コミットで修正済み。詳細は該当コミットメッセージと `tests/save-load.spec.js` の `sortie` テストを参照)。この失敗を踏まえ、テストは now `console.error` も監視するようにしてある(`tests/helpers.js` の `watchErrors`)。

ファイルを分けつつ実行時は1つの共有スコープのままにする「連結」は、この作り直しをせずに済ませるための現実的な妥協。**`parts/` 内の各ファイルは、独立したモジュールとして動くことを前提に書かないこと** - 変数は他のpartファイルで宣言されているかもしれない。

### 真のESモジュールへ格上げする場合

ある部分(例: ダンジョン構築)を本当に独立させたくなったら:

1. その部分が触る共有可変変数を洗い出す
2. `state` と同じパターンで、1つの共有オブジェクト(例: `export const world = { currentWorldKey: null, walls: [], doors: [], enemies: [], player: null, ... }`)にまとめる
3. `parts/` 内の全ファイルで、該当する素の `let x` への読み書きを `world.x` に置き換える
4. 対象部分を実際に別ファイル・別importへ切り出す

オーディオとテクスチャ生成は、`state` 以外の共有可変変数への依存がほぼ無かったため、この作業をしなくても安全に真のESモジュールとして切り出せた。

## 外部アセット(音楽・SE・グラフィック)の追加方針

画像・音声ファイルは `public/` 配下に置けば `/foo.png` のような絶対パスでそのまま参照できる(Viteがそのままコピーする)。ただしGitHub Pagesはリポジトリ名のサブパス(`/-ARPG-/`)配信なので、コード内で直接そのパスをfetchすると本番だけ404になる(`manifest.webmanifest`で一度踏んだ問題と同じ)。`audio.js`/`textures.js`双方の`resolveAssetUrl()`が`import.meta.env.BASE_URL`でこれを吸収している。

- **音楽/SE**: `src/audio/asset-manifest.js` にBGM/SFXのファイルパスを登録する。全項目が任意で、未登録またはファイル読み込み失敗時は既存の手続き合成/無音へ自動フォールバックするので、ファイル本体を用意する前に安全にエントリだけ足せる。BGMはワールド突入時(`buildWorld()`)に自動再生、SFXは`sfx()`呼び出し時にプリロード済みのバッファがあればそちらを優先する。
- **テクスチャ画像**: `src/textures/texture-manifest.js` に登録名→画像パスを書き、対応する呼び出し側(`make*Texture()`の`opts`)に`{name: '登録名'}`を足すと、画像が読み込まれ次第そのサーフェスに差し替わる(対応しているのは`makePlankTexture`/`makeMasonryTexture`/`makeCobbleTexture`/`makeWallpaperTexture`/`makeStoneTileTexture`の5つ)。読み込みは非同期なので、画像が届くまでは今まで通り手続き生成された見た目のまま表示される。実写画像を当てる場合、バンプマップ(手続き生成の高さ場)は写真の陰影と噛み合わないため自動的に無効化される。

## デプロイ(GitHub Pages)

`main` への push で `.github/workflows/deploy.yml` が `npm run build` を実行し、`dist/` を GitHub Pages に公開する。`vite.config.js` の `base` はリポジトリ名(`-ARPG-`)に合わせて `/-ARPG-/` を使っている。カスタムドメインを使う場合はここを `/` に変更すること。

ローカルのVite開発サーバは `host:true` にしてあるので、同じWi-Fi内であれば `http://<このマシンのLAN IP>:5173` をiPhoneのSafariで開いて実機確認できる。

## `src/legacy/parts/*.js` を編集する際の注意

- ファイルを編集すると `concat-plugin.js` が変更を検知して開発サーバに反映する(`this.addWatchFile`)。ただし完全なHMR(状態を保ったままの差し替え)ではなく、ページ全体の再読み込みが必要になることがある
- 新しい関数・変数をどのpartファイルに置くかは、上の表の分類に従う。既存の分割点(各ファイル冒頭のコメント)をまたいで関数を分割しないこと
- 個々のpartファイルを単体で `node --check` するとエラーになる(import文もexport文も無い断片のため)。構文チェックは連結後の内容に対して行う必要がある(`npm run build` や `npm run dev` を実際に起動して確認するのが確実)
