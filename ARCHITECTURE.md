# アーキテクチャ

このプロジェクトは `basefile.html` 1ファイルから、Vite製の通常のWebアプリ構成へ移行した。理由は将来的な拡張性(音楽/SE/テクスチャの外部ファイル化、機能単位での分割)を優先したため。

## 現在の構成

```
index.html                  Viteのエントリーポイント(旧basefile.htmlの<body>相当)
src/
  main.js                    エントリースクリプト。'virtual:legacy-core' を import するだけ
  styles/main.css             旧basefile.htmlの<style>をそのまま移した全UIのCSS
  core/state.js               ゲーム進行状況(state)。他のどのファイルからも読み書きされる
  core/damage-math.js          与/被ダメージ倍率の純粋計算(性格・装備特殊効果)。state依存なし
  core/loot-math.js            ドロップ抽選・装備ステータス乱数の純粋計算。state依存なし
  core/route-combos.js         分岐ルートの組み合わせ計算(直積・進捗・未踏破の提案)。state依存なし
  core/scenario-timer.js       周回制限時間の★シュリンク計算(基準タイム→星ごとの短縮後タイム)。state依存なし
  audio/audio.js               SE合成・BGM再生(WebAudio)。state.sfxVolume/bgmVolume以外への依存なし
  audio/procedural-bgm.js      ワールドごとの生成音楽(ドローン+疎らな旋律+簡易リバーブ)。実ファイル未登録時のBGM
  textures/textures.js         手続きテクスチャ/バンプマップ生成。state依存なし
  render/lowpoly-primitives.js Low Polyキャラクター用の追加ジオメトリ生成
                                (TrapezoidBox/Wedge/Plate/Prism)。three.js標準に
                                無い「回転体では作れない自由な輪郭」だけを補う
                                純粋関数。state依存なし(グラフィック刷新、#42系)
  core/character-motion-state.js プレイヤーの姿勢/武器状態の状態機械
                                (SOCIAL / EXPLORATION / DRAWING / COMBAT /
                                POST_COMBAT / SHEATHING と、それとは別軸の
                                武器状態)。three.js にも state にも依存しない
  core/combat-stances.js       4職の戦闘の構えとサブ武器の構え、武器の握り
                                オフセット。全攻撃クリップの最初と最後の
                                フレームでもある(純粋データ)
  core/motion-poses.js         酒場/探索の立ち姿と、抜刀・戦闘終了の余韻・
                                納刀のクリップ(純粋データ)
  core/pose-geometry.js        構えの順運動学と幾何チェック(刃が頭/胴を
                                貫通していないか、肘が逆に折れていないか)。
                                武器の収納位置(背中・腰)もここが骨格寸法から
                                導く ―― テスト専用ではなく、ゲーム側も同じ
                                座標を使う
  core/head-rig.js             視線。体 → 腰 → 首 → 目 が順に「まだ向けていない
                                残り」を受け持つ角度計算と、それぞれの可動域。
                                見た目にしか使わない(state.facing には触れない)
  core/combat-idle.js          立ち姿の上に足すごく小さな揺れ(戦闘中の
                                Combat Idle / 酒場・探索の重心の移り /
                                攻撃・回避のあとの収まり)
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
| `03-dungeons-mansion-temple.js` | 酒場・森・洋館(最初のメインシナリオ。間取りは`MANSION_ROOMS`の表が唯一の情報源、詳細は`MANSION_SCENARIO.md`)・時計塔・温室・神殿 |
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

## キャラクターモーション(姿勢と武器状態)

「酒場では人物、ダンジョンでは冒険者、戦闘では職業を持つ戦士」に見せるための層。実装前は、姿勢はクラスごとの`STANCE`1種類だけで、酒場でもダンジョンでも敵の目の前でもまったく同じ構えのまま立ち、武器は最初から最後まで手の中にあった(抜く/しまうという段階が存在しなかった)。

構造は3層に分かれている。

| 層 | 置き場所 | 役割 |
|---|---|---|
| 状態 | `core/character-motion-state.js` | 状態機械そのもの。three.js にも`state`にも触らないので、ゲームを起動せずに全遷移を単体テストできる |
| データ | `core/combat-stances.js` / `core/motion-poses.js` | 構えとクリップ。同じく純粋データなので、`core/pose-geometry.js`で幾何チェックを掛けられる |
| 描画 | `legacy/parts/05-rendering-rig.js` の CHARACTER MOTION 節 | 状態を毎フレームの立ち姿へ翻訳し、リグへ書き込む |
| 視線 | `core/head-rig.js` + 同ファイルの HEAD RIG 節 | 頭の向き。腰の捻りを打ち消す形で計算する |

キャラクター状態と武器状態は同一視しない ―― 「戦闘は終わったが武器はまだ手にある」(`POST_COMBAT` + `DRAWN`)は正しい一時状態で、そこから納刀へ入る。

ポーズは次の順に重なる。攻撃が終われば必ず戦闘の構えへ戻るのは、この順序と、`COMBAT_STANCES`が同時に全攻撃クリップの最初と最後のフレームであることの結果で、攻撃側には何も足していない。

```
立ち姿(updateCharacterMotion) → 歩幅・腕振り(updateLocomotion) → 攻撃/回避のクリップ(applyCombatPose)
```

武器の位置は「手」と「収納位置」の間の連続値(`holsterBlend`)で決まる。0と1の間を必ず連続的に動き、さらに1秒あたりの変化量に上限があるので、背中から手へ武器が瞬間移動することがない。収納位置(背中・左右の腰)は`core/pose-geometry.js`が骨格寸法から導くので、体型を変えても背中に浮いた剣にならない。

構えの調整は、以前は「実機で見て角度を少し直す」の繰り返しだった(`combat-stances.js`の剣士のコメント参照)。原因は腕や刃がどこへ行くのかを**測る手段が無かった**ことで、`core/pose-geometry.js`がその手段。`tests/unit/stance-geometry.test.js`・`tests/unit/motion-poses.test.js`が4職の構えとクリップ全域に対して、さらに首を可動域いっぱいに振った状態も含めてこれを掛けている。

### 視線(Head Rig)

頭・髪・帽子・目は `buildPlayer()` が作る `HeadPivot`(首の付け根寄り)の子で、頭を向けるのはこのピボットを回すだけ。襟・毛皮のラフ・マント・矢筒は入っていない ―― 肩や背に付くもので、頭が向いても動いてはいけないため。上位職の装飾も、首から上に付いたものは同じピボットへ移す(ただし毎フレーム `position` を書き換えるもの ―― 浮遊石・魔法陣・オーラ・肩の鷹 ―― は `waist` 直下に残す。親が回ると書き込む座標系ごと回ってしまう)。

目は `HeadPivot` の中の `EyePivot`(頭の中心を軸)の子。頭の中心で回すのは眼球が眼窩の中で回るのと同じ関係になるためで、顔の表面に貼った板を平行移動させると少し動かしただけで目が顔からはみ出す。

視線は4段で分担する。それぞれが**手前の段がまだ向けていない残り**だけを受け持つので、二重補正が起きようがない。

| 段 | 可動域 | 追従 | 役割 |
|---|---|---|---|
| 体(`visualFacing`) | — | ゲーム側 | 大きな方向転換。**視線のために動かすことはしない** |
| 腰(Visual Look Offset) | ±12.6°×職業係数 | 遅い | 首を振り切っても届かない時だけ、わずかに捻る |
| 首(`HeadPivot`) | ±34° | 7/秒 | 顔を対象へ向ける |
| 目(`EyePivot`) | ±10° | 16/秒 | 最後の微調整 |

腰の追従は既存の腰バイアスへ**足す**だけで(上書きしない)、首はそのあとで実際に適用された最終の腰の角度から残りを計算する ―― 同じ補正を引く場所が1箇所しかないので、二重にはならない。受け持つ量は「体の正面からの角度」ではなく「構えの捻りを差し引いてもなお首に残る量」で決める(弓師は半身に24度捻れているので、正面の敵を見るだけでも首はその分を戻さねばならない)。

目が首より速く、かつ「首がまだ向けていない残り」を担当する、という2つの帰結として **認識 → 目 → 首 → 腰** の順に見える。戻りは逆で、見失っても目だけが 0.45 秒 は的を追い続けるので **体 → 腰 → 首 → 目** の順に解ける。弓師の残心(弓を収め終えても体は半身のまま、視線だけ敵へ)は、この構造から専用の分岐を1つも書かずに出ている。

### 立ち姿の上に足す揺れ

構えは1枚の静止ポーズなので、そのままでは置き物に見える。`core/combat-idle.js` がその上に足す小さな揺れを持つ。振幅はすべて 0.03rad 以下で、上下動(bob、`updateLocomotion` の呼吸)には触らない ―― 跳ね続けるアイドルにしないため。職業の個性は振幅の大小ではなく「何を動かすか」で出している(剣士=肩と重心、盗賊=膝、魔法使い=左手の肘、弓師=引き手と弦)。

武器の揺れだけは「向きの目標」へ足してあり、実際の武器は職業ごとの追従速度(`WEAPON_FOLLOW_RATE`)を通って遅れて付いてくる。攻撃・回避の直後にはこれを一時的に強めた減衰振動が乗るので、`斬撃 → 肩・腕が戻る → 大剣が追って収まる` の順に見える。

`core/damage-math.js`・`core/loot-math.js`・`core/route-combos.js` は同じ考え方をさらに絞ったケース: 関数全体を切り出すのではなく、`state`・敵オブジェクト・3D座標などへの依存を一切持たない「計算の核」だけを抜き出し、`state`の読み書きは元の関数(`parts/`側)に薄いラッパーとして残してある。たとえば`applyOutgoingDamageMods(amount, en)`は`state.hp`や`en.group.position`を読んでから`core/damage-math.js`の`applyOutgoingDamage()`へ純粋な数値だけを渡す、という形。これにより該当ロジックは`tests/unit/`で(ゲームを起動せず)単体テストできる一方、90個の共有変数問題には一切触れずに済んでいる。

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
