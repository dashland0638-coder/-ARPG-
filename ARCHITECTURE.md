# アーキテクチャ

このプロジェクトは `basefile.html` 1ファイルから、Vite製の通常のWebアプリ構成へ移行中。理由は将来的な拡張性(音楽/SE/テクスチャの外部ファイル化、機能単位での分割)を優先したため。

## 現在の構成

```
index.html              Viteのエントリーポイント(旧basefile.htmlの<body>相当)
src/
  main.js                エントリースクリプト。legacy-core.js を import するだけ
  styles/main.css         旧basefile.htmlの<style>をそのまま移した全UIのCSS
  core/state.js           ゲーム進行状況(state)。他のどのファイルからも読み書きされる
  audio/audio.js           SE合成(WebAudio)。state.sfxVolume以外への依存なし
  textures/textures.js     手続きテクスチャ/バンプマップ生成。state依存なし
  legacy/legacy-core.js   まだ切り出されていない残り(約15,900行)。ダンジョン構築・
                          戦闘・UI・入力・カメラ等はここに残っている
public/
  manifest.webmanifest    PWA用マニフェスト(iPhoneのホーム画面に追加してフルスクリーン起動できる)
  icons/                  PWAアイコン(プレースホルダー。差し替え歓迎)
basefile.html            移行前の単一ファイル版。凍結スナップショットとして残置(下記参照)
```

`npm run dev` で開発サーバ、`npm run build` で `dist/` に静的ファイル一式を生成する。Three.jsは(CDNではなく)npm経由のバンドルになった。

## `basefile.html` の扱い

移行前の状態を凍結したスナップショットとして残してある。**今後の変更はすべて `src/` 側に対して行い、`basefile.html` はもう更新しない。** 何か問題が起きた際の切り戻し用参照、あるいは「サーバー無しでとにかく1ファイルで動かしたい」という場面での非常用に置いてあるだけで、いずれ削除して構わない。

## `legacy-core.js` の中身と、今後の分割方針

`legacy-core.js` は移行の第一段階として「動くことを最優先に、中身は変えずファイルだけ移した」状態から始まった。`state` / オーディオ / テクスチャ生成の3つは既に切り出し済み(下表チェック済み)。残りはまだ1ファイルに入ったまま。今後、自然な単位で切り出していく想定:

| 分割候補 | 現状の目印 | 状態 |
|---|---|---|
| ゲーム状態 | `state` オブジェクト | ✅ `src/core/state.js` |
| オーディオ(SE合成) | `initAudio` / `tone` / `noise` / `sfx` 一帯 | ✅ `src/audio/audio.js` |
| 手続きテクスチャ生成 | `makePlankTexture` / `makeStoneTileTexture` / `makeGrassTexture` 等 | ✅ `src/textures/textures.js` |
| ダンジョン構築 | `buildForest` / `buildMansion` / `buildGhostShip` / `buildWaterway...` 等、ダンジョンごとに1関数 | 未着手 |
| プレイヤー/敵のリグ・アニメーション | `buildPlayer` / `buildEnemy` / `updateMobAnim` 一帯 | 未着手 |
| 戦闘・ドロップ・装備 | `dealDamageToEnemy` / `pickLoot` / `rollEquipment` 一帯 | 未着手 |
| UI(HUD・メニュー・鑑定所・会話) | `updateHUD` / `renderGearPanel` / `advanceDialogue` 一帯 | 未着手 |
| セーブ/ロード | `buildSaveData` / `applySaveData` / `saveGame` 一帯 | 未着手(既に比較的まとまっている) |
| Three.js初期化・ワールド共通処理 | `initThree` / `buildWorld` / `disposeWorld` 一帯 | 未着手(下記の共有変数集約が前提) |

### 分割時の注意(ここが一番の落とし穴)

このコードは `state`(ゲーム進行状況)以外にも、`scene` / `camera` / `renderer` / `player` / `companion` / `currentWorldKey` / `walls` / `doors` / `enemies` / `chests` / `projectiles` など、**多数の共有可変変数**を素の `let` として保持し、あちこちの関数から直接**再代入**している(例: `currentWorldKey = 'tavern'`)。

ESモジュールは `import` した変数への**再代入を許さない**(参照先オブジェクトのプロパティを書き換えるのは問題ないが、束縛そのものの差し替えはできない)。そのため、こうした共有可変変数を別ファイルへ分割する際は:

- 素の `let currentWorldKey` のような形を複数ファイルに股がらせない
- 代わりに、1つの共有オブジェクト(例: `export const world = { currentWorldKey: null, walls: [], doors: [], enemies: [], player: null, ... }`)にまとめ、他ファイルからは `world.currentWorldKey = 'tavern'` のようにプロパティ経由で書き換える

`state` オブジェクト(キャラの進行状況)は既にこの形で `src/core/state.js` に切り出し済みなので、どのファイルからでも `state.foo = ...` で安全に読み書きできる。`scene`/`camera`/`renderer` や `walls`/`doors`/`enemies`/`player` 等、今も `legacy-core.js` 内で素の `let` になっている残りの共有変数を、同様に1つの `world`(または `three`)オブジェクトへ集約するのが、次の分割作業(ダンジョン構築・戦闘・UI等)に着手する前の最初の一手になる。

オーディオとテクスチャ生成は、`state` 以外の共有可変変数への依存がほぼ無かったため、この集約作業をしなくても安全に切り出せた(実施済み)。

## 外部アセット(音楽・SE・グラフィック)の追加方針

- 画像・音声ファイルは `public/` 配下に置けば `/foo.png` のような絶対パスでそのまま参照できる(Viteがそのままコピーする)
- 音楽/SEを追加する場合: `src/audio/audio.js` の `sfx()` に、ファイルが指定されていれば `Audio`/Web Audio で再生し、無ければ今の手続き合成にフォールバックする分岐を足すのが自然(モジュールは既に切り出し済み)
- テクスチャ画像を追加する場合も同様に、`src/textures/textures.js` の各 `make*Texture()` に「画像ファイルがあれば読み込み、無ければ今の手続き生成」という分岐を足せばよい

## デプロイ(GitHub Pages)

`main` への push で `.github/workflows/deploy.yml` が `npm run build` を実行し、`dist/` を GitHub Pages に公開する。`vite.config.js` の `base` はリポジトリ名(`-ARPG-`)に合わせて `/-ARPG-/` を使っている。カスタムドメインを使う場合はここを `/` に変更すること。

ローカルのVite開発サーバは `host:true` にしてあるので、同じWi-Fi内であれば `http://<このマシンのLAN IP>:5173` をiPhoneのSafariで開いて実機確認できる。
