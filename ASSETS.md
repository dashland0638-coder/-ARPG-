# アセット追加ガイド

音楽・効果音・テクスチャ画像はすべて「任意登録・フォールバック付き」という同じ考え方で実装してある。ファイルを1つも用意しなくてもゲームは今まで通り動く(音は合成、絵は`<canvas>`手続き生成)。用意した分だけ、対応するマニフェストに1行パスを書けば実ファイルに差し替わる。

置き場所はすべて `public/` 配下。Viteがビルド時にそのままコピーし、`/foo.png` のようなサイト直下パスで配信される(GitHub Pagesのサブパス変換は各モジュールの`resolveAssetUrl()`が自動で吸収するので、マニフェストには常に`/`始まりの絶対パスを書けばよい)。

---

## 1. 音楽 (BGM)

7つのワールドキーそれぞれに1曲まで登録できる(`src/audio/asset-manifest.js`の`BGM_TRACKS`)。未登録のワールドは無音ではなく、`src/audio/procedural-bgm.js`がそのワールド用に生成した環境音楽(ドローン和音+疎らな旋律、簡易リバーブ付き)が流れる ─ 実ファイルを登録すればそちらへ即座に差し替わる。

| キー | ワールド | Lv目安 |
|---|---|---|
| `tavern` | 拠点の酒場 | - |
| `mansion` | 🏚️ 囚われの洋館 | 1〜5 |
| `ghostship` | 👻 幽霊船 | 6〜12 |
| `temple` | 🏛️ 古代神殿 | 10〜20 |
| `clocktower` | 🕰️ 狂いの時計塔 | 11〜16 |
| `waterway` | 💧 埠頭の地下水路 | 18〜25 |
| `conservatory` | 🌿 硝子の温室 | 22〜28 |

**ファイル仕様**
- 形式: **mp3**推奨(対応ブラウザが最も広い。オフラインで曲を持たない`ogg`でも動くがiOS Safari対応が不安なので避ける)
- 尺: 制限なし。ワールド滞在中ずっとループ再生されるので1〜3分程度あれば十分
- ループ: `<audio loop>`でそのまま繋げて再生するだけ(クロスフェード処理は無い)。**曲の頭と末尾が違和感なく繋がるように書き出す**こと(無音の余白を残さない、フェードアウトで終わらせない等)
- 音量: 全曲共通の音量スライダー1本(合成SEとは独立)なので、曲間で極端にラウドネスが違わないよう正規化しておく
- 容量目安: 1曲あたり2〜4MB程度(128〜192kbps)。ストリーミング再生なので全体を先読みはしないが、iPhone回線での初回読み込みを考えて絞り気味に

**登録**
```
public/audio/bgm/mansion.mp3 を置いて…

// src/audio/asset-manifest.js
export const BGM_TRACKS = {
  tavern: null,
  mansion: '/audio/bgm/mansion.mp3',   // ← これだけ
  ...
};
```

---

## 2. 効果音 (SE)

合成SEは全37種あり、**どれも既に音が鳴っている**。実ファイルはその中から差し替えたいものだけ選んで登録すればよい(全部揃える必要はない)。

<details>
<summary>全キュー一覧(クリックで展開)</summary>

| 分類 | キュー名 | 用途 |
|---|---|---|
| 攻撃 | `swing` `slashLight` `slashHeavy` `slashOverhead` `slashDraw` `slashSpin` `knifeThrow` `groundBurst` | 近接攻撃・投擲・地面叩きつけ |
| 魔法 | `cast` `castBig` `castAim` `meteor` | 詠唱・大魔法・照準・隕石 |
| 弓 | `bowDraw` `bowRelease` `bowVolley` | 弓の引き・発射・連射 |
| 被弾/被ダメ | `hit` `bigHit` `hurt` `death` `bossWake` | ヒット・大ヒット・被弾・死亡・ボス覚醒 |
| 移動 | `jump` `land` `dodge` | ジャンプ・着地・回避 |
| 環境ギミック | `thorn` `spore` `door` `seal` | 罠・胞子・扉・封印 |
| アイテム | `chest` `pickup` `potion` | 宝箱・拾得・ポーション |
| システム | `levelUp` `ultimate` `ui` `chime` `tick` `deny` | レベルアップ・アルティメット・UI操作音・鐘・カウント・拒否音 |

</details>

優先して用意する価値が高いのは体感的インパクトの大きいもの ─ `levelUp`(ファンファーレ)、`chest`(宝箱)、`ui`(操作音)、`bossWake`辺りから始めるのがおすすめ。

**ファイル仕様**
- 形式: **wav または mp3**。読み込み時に全体をメモリへデコードする方式なので、**必ず短く**(目安1秒未満、長くても2秒程度)
- 容量目安: 数十KB〜100KB程度。長い/大きいファイルを登録すると初回操作時(タイトル→キャラ作成後の最初のキー入力)にまとめて読み込まれ、そこで詰まる

**登録**
```
public/audio/sfx/levelup.wav を置いて…

// src/audio/asset-manifest.js
export const SFX_FILES = {
  levelUp: '/audio/sfx/levelup.wav',   // ← キュー名をそのままキーにする
};
```

---

## 3. テクスチャ画像

こちらは音声と違って**現状ではまだどの面にも差し替え枠が仕込まれていない** ─ 対応できる仕組みはあるが、実際に「この床/壁を差し替え可能にする」という配線を面ごとに追加する必要がある。

**対応している生成関数(この5つだけ)**
- `makePlankTexture`(板張り: 床・甲板)
- `makeMasonryTexture`(石積み: 壁)
- `makeCobbleTexture`(石畳)
- `makeWallpaperTexture`(壁紙)
- `makeStoneTileTexture`(タイル張り)

**まだ対応していない関数** ─ `makeNoiseTexture`(単純な砂目)・`makeTileTexture`(浴室風タイル)・`makeGrassTexture`(芝生)。たとえば酒場(タバーン)の床は`makePlankTexture`(対応済み)だが壁は`makeNoiseTexture`(未対応)、というように面ごとに使っている関数が違う。差し替えたい面が未対応の関数を使っている場合は先にそちらへも対応を追加する。

**画像仕様**
- 正方形・**シームレスタイリング可能**なもの(128×128の繰り返しパターンをそのまま置き換えるので、継ぎ目のある画像だと敷き詰めた時に境界線が見えてしまう)
- 解像度: 512×512あれば十分。今の見た目はローファイなスタイルなので1024×1024超は容量の無駄
- 形式: jpg(写真素材)またはpng(透過が要らなければjpgの方が軽い)
- 容量目安: 1枚あたり300KB〜700KB程度。1画面に複数面が同時に映るので合計容量が効いてくる
- 差し替えると自動的にバンプマップ(procedural凹凸)は外れる(写真の陰影と噛み合わないため)ので、質感の凹凸は画像側に焼き込んでおく

**登録(2ステップ)**
```
public/textures/overrides/tavern-floor.jpg を置いて…

// src/textures/texture-manifest.js
export const TEXTURE_OVERRIDES = {
  tavern_floor: '/textures/overrides/tavern-floor.jpg',
};
```
```js
// 該当の make*Texture() 呼び出しに name を追加(例: 酒場の床)
// src/legacy/parts/03-dungeons-mansion-temple.js の buildTavern() 内
const floorTex = makePlankTexture('#8a6440', 6, 3, 3, { name: 'tavern_floor' });
```
2つ目の「どの呼び出しに`name`を足すか」は、差し替えたい面を教えてもらえればこちらで配線する。「酒場の床を差し替えたい」でも「ダンジョン共通の石壁を差し替えたい」でも、具体的な面を指定してもらえれば対応する。

---

## 4. 素材を用意する際の注意

- 自作、もしくはライセンス上ゲームへの組み込み・再配布(GitHub Pagesでの公開)が許可されている素材(CC0、royalty-free、購入した商用利用可ライセンス等)を使うこと。配布元の利用規約でクレジット表記が必要な場合は`README.md`に追記する
- ファイルは`public/`配下に置くだけでは自動コミットされない(git管理下なので通常のファイルと同様`git add`が必要) ─ 用意できたら教えてもらえればコミット・プッシュまで対応する
