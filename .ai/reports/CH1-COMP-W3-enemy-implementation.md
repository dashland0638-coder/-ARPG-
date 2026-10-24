# CH1-COMP W3-E — 宵待ちの村の敵の作り直し(Implementer 報告)

ブランチ: `claude/ch1-comp-dusk-enemies`(基準 `d5ea23b`)。決定: `DEC-008` §3。調査: `CH1-COMP-W3-village-enemy-analysis.md`。

Status: CONTENT READY = HUMAN DEVICE CHECK REQUIRED(実機での見え方・色・暗さは Human が目で確かめる)

## 0. 要約

- 村の 5 種は、以前は全部が同じ姿(浮く毛玉 + 頭巾 = 汎用の 'wraith')だった。ボス「村の残響」は汎用の人型ボスで、動かなかった。この 6 つの姿を作り直した。
  作り方は洋館の敵と同じで、buildEnemy の独自の胴の約束に従う(胴の geometry を差し替え、胴の material は個体ごとに持つ)。
- 印は `M.villageKind`。`M.mansionKind` は使わない。姿勢は `updateVillageMobExtras`(14-dungeon-duskvillage.js)が付けるが、
  **既存の AI の状態を読むだけ**。AI のほうは姿勢の存在を知らない。
- 予兆の輪を足した対象: 水鏡の影(分身・ボスの分身を含む)、泡沫(触れる距離)、ボスの近接、ボスの段階 3 の残響。
  半径はどれも**判定の定数そのもの**で、AI と輪が `src/core/dusk-enemies.js` の同じ定数を読む。
- **敵の攻撃の数値は変えていない**。HP・攻撃力・攻撃の判定の半径・溜め・クールダウン・速さ・ダメージ倍率はどれも変更なし(判定に使う数字を定数へ移しただけ)。
  **例外: 村の雑魚の hitRadius(プレイヤーの攻撃が届く敵の表面)を体格に合わせた(D6、DEC-008 §3 の Agent Decision)。ボスの分身はボスの体 2.0(Human の決定、AD-2)。**
  光源も足していない。ボスの分身からは、複製で付いてきた光を外したので、光源はむしろ減る。

## 1. 敵ごとの前後

| 敵 | 前(姿 / 予兆) | 後(姿) | 後(何を見ればよいか・予兆) |
| --- | --- | --- | --- |
| 水鏡の影 (+分身) | 汎用の毛玉。色 0x2a3b4a は剣士の紺に近い。溜めは胴の伸縮だけで、輪なし | 水面に映った村人。灰紫の衣 0x857590、薔薇色の肩掛けと頭巾 0xc4a0b0、顔は暗い水面。裾は滴になって、足元の暗い映り込みへ溶ける。浮く。本体と分身は**同じ作り** | 溜めで両腕を後ろへ引き、上体を反らす。引きの深さは既存の depth(本体 1 / 分身 0.45)。そのあと前へ振り抜く。足元には**半径 2.4・全周**の薔薇色の輪が出る。輪は溜め(本体 0.72 / 分身 0.34 秒)のあいだに満ちていく。一撃の窓(0.22 秒)のあいだは、まだ当たっていなければ満ちたまま残り、当たると消える。本体と分身の差は時刻だけで、これは意図した手がかり |
| 泡沫 | 汎用の毛玉を ×0.62。色 0x7fb8c8 は魔法使いの水色に近い。予兆なし | 白緑 0xb8c9a8 の泡 4 個の塊で、芯の粒は 0x9cb88a。頭も手足もない。浮く | 増える直前に泡が 1 つ膨らむ(既存の foamGrowT)。弾けた直後、次に当たれるようになるまで(foamAtkCD)は縮む。敵対中は足元に**半径 1.5**(触れる距離)の淡い琥珀の輪が出る。溜めが無いので輪は満ちず、時刻は示さない |
| 写し身 | 汎用の毛玉、0x4a6478。写しの溜めは胴の膨らみだけ | 色を抜かれた長い外套 0x7b7568(共有の材質)と、肩掛け(これが胴)。つばの広い帽子と帯 0xc8bfa8、顔は暗い水 0x1d2629。浮く | 写しの溜め(1.25 秒。灯りで伸びる長さは今のまま)のあいだだけ右腕を上げる。手元には弾と同じ色 0x9fd8ff の光が育つ(MeshBasic で、光源はない)。弾の色と時刻は今のまま |
| 記憶漁師 | 汎用の毛玉、0x3d5260 | 背を丸めた漁師。つばの広い帽子は後ろが垂れる。油引きの外套 0x7f7a48、背中に網の束と負い紐 0xc8a07a、地面へ届く長い腕、長靴。歩く | 網の溜めで右腕を後ろへ振りかぶり、投げた瞬間に前へ振り抜く。近接では、溜めで両腕を広げて上体をひねり戻し、当たった直後に一回転する(既存の 2.3 の輪と同じ全周の形)。網、近接の輪、Debug Info、E2E の約束は今のまま。網は geometry だけを共有にした |
| 水門守の残響 | 汎用の毛玉を ×1.18、0x46606f | 肩幅の広い門番(×1.18 は今のまま)。錆びた革 0x9a6a5a と暗い前掛け、肩から腰へ斜めに掛けた鎖、平たい帽子。右手に巻き上げの把手、左手に鉤。重く歩く | 予備動作で両腕を上げて鎖を掴む。引く動作の 45% の時点、つまり**当たる瞬間に引き下ろしきる**。既存の赤橙の輪と同じ時刻 |
| 残響(水門守・ボス) | 円錐 + 球、0x7fb0c4。演出の幽霊と同じ形・同じ色だった | 水門守と同じ骨格の低ポリの写し(geometry は共有)。色は琥珀 0xe0b090 | 当たる「引いた」残響は、両腕を上げたまま現れる(予備動作が無いのが本体との差)。当たる瞬間に引ききる。不透明度 0.46 で濃い。当たらない「歩いた跡」は腕がなく、低く沈み、不透明度 0.2 で薄い。輪は今のまま黄色。演出の幽霊(spawnApparition と水門守の登場)は変えていない |
| ボス「村の残響」 | 汎用の人型ボス(角・鎧・革)で、動かなかった(parts 無し)。近接の予兆は胴の伸縮だけ。分身はオーラの PointLight ごと複製されていて、当たりは 0.34 | 半透明の暗い水の裾から起き上がる、村の記憶が重なった姿。セピアの胴 0xa39278、前掛け 0xd8b88a。半歩ずれて、もう一つの胴が半透明で重なる。肩から門番の鎖、頭には漁師のつばの広い帽子。顔は暗い水だが、目の光は今のまま。右手に鉤、左手に網の束。足元の水の輪はゆっくり広がり、待機中も体が揺れる | 近接では、振りかぶりで両腕を頭上へ上げて反り、叩き下ろす。足元には**半径 2.6**(atkReach 2.2 + 0.4、全周)の輪が出る。輪は振りかぶり(0.55 秒、段階 3 では 0.4 秒)のあいだに満ち、当たる瞬間に消える。輪の色は分身の輪(水鏡の影と同じ)とそろえた。色で本体が分からないようにするため。段階 3 の残響にも**半径 3.6(2.4 × 1.5)**の黄色い輪を出す(DEC-008 §3)。分身は、複製から光源を外し、当たりの半径をボスの体(2.0)に合わせた(Human の決定)。分身は影を落とさず、足元の水の輪も無い(見分けの手がかり。DEC-008 §3)。部品を名前で拾い直して、本体と同じ動きを付けている |

## 2. 決めたこと(Decision)

- **D1 印**: `M.villageKind` を使い、`updateMobAnim` から `updateVillageMobExtras` を呼ぶ。洋館の `M.mansionKind` を使うと、`updateMansionMeleeTelegraph` が `en.meleeTelegraphMesh` を隠してしまうため。
- **D2 色の基準**: 敵の主な色(main)と差し色(accent)は、次の色から **CIE76 ΔE ≥ 15** 離す。味方(PLAYER_PALETTE 全行の main/sub/accent/hat、CLASSES と上位職の color/trim/capeColor)、演出の幽霊 0x7fb0c4、写し身の弾 0x9fd8ff。
  敵どうしの main は **ΔE ≥ 12** 離す。剣士の紺と魔法使いの青からは ΔE ≥ 20。
  暗色(L* < 35 の影・下地・水)は検査から外した。面積が小さく「暗い所」として読まれるうえ、味方どうしでも暗色は互いに近いため。
  全体は「褪せた記憶」をイメージした中間の明るさ(セピア・灰紫・オリーブ・錆・白緑)にそろえた(`tests/unit/dusk-enemies.test.js` で検査)。
- **D3 マット**: 布は roughness 0.92・metalness 0。鎖と鉤も 0.8 / 0 で、艶を出さない。胴の自発光は 0.04 で、これが強調表示の基準値になる。
- **D4 輪の色**: 水鏡の影・分身・ボスの近接は 0xff5c8a(薔薇色)。漁師の橙、水門守の赤橙、残響の黄、爆発の橙とは色相が分かれる。
  ボスの近接を分身と同じ色にしたのは、色で本体が分かると「挙動の差で見分ける」遊びが崩れるため。泡沫は 0xffc27a(淡い琥珀、不透明度 0.34、満ちない)。
- **D5 水鏡の輪が消える時刻**: 判定は「一撃の窓 0.22 秒のあいだに、初めて距離 2.4 以内に入ったフレーム」で起きる。窓の始めで輪を消すと、窓の途中で踏み込んだときに輪が無いのに当たってしまう。
  そこで、**窓のあいだはまだ当たっていなければ満ちたまま残し、当たったとき、または窓が閉じたときに消す**。ボスの近接は判定が 1 フレーム(振りかぶりの終わり)だけなので、その瞬間に消える。
- **D6 当たりの半径(hitRadius = プレイヤーの攻撃が届く「敵の表面」)**: 胴の外接球(measureHitRadius)は背丈に引っ張られて横に広くなりすぎる。そのため、見た目の足元の広がり × group の拡大を使う(`VILLAGE_PROPORTIONS.footprint`)。
  以前は全種が汎用の毛玉の 0.34 だった。変更後の値: 水鏡の影・写し身・漁師は 0.34 → 0.40、水門守は 0.34 → 0.54(×1.18 込み)、泡沫は 0.43 → 0.34(塊 0.54 × 0.62。指示どおり。以前の 0.43 は拡大を無視した球の値)、ボスの分身は 0.34 → 2.0(ボスの体。Human の決定 2026-10-23。独立レビュー M1 の後いったん保留していた)。
  **敵の数値ではないが、プレイヤーの近接の届き方は少し変わる**(R1)。
- **D7 共有と個体ごと**: 胴の material は個体ごとに持つ(被弾の白と強調表示が書き換えるため)。それ以外の部品は、書き換えないものに限って、種類ごとに geometry と material を 1 つずつ共有する。
  共有の geometry は `villageGeoCache` に入れて `sharedGeometries()`(02)に登録した。敵の group は世界の破棄で dispose 候補になるため。
  既存の共有キャッシュ(足元の輪の `groundTelegraphGeoCache`、網の `memoryNetGeoCache`)も合わせて登録した。
- **D8 網**: 網の geometry を半径ごとに共有にした。以前は投げるたびに new していて、外すだけで dispose していなかった。材質は網ごとのまま(網ごとに不透明度を変えるので共有できない)。
  `n.ring` / `n.radius` / `n.ring.scale` の意味と Debug Info は今のまま。
- **D9 写し身の胴**: 外套全体を胴にすると、交戦中の強調(既存の threatHighlight、赤 0xff6a4a)で全身が赤く染まった(1 回目の撮影で確認)。そこで胴は肩掛けにし、外套は共有の材質にした。
  既存の処理には、溜めで胴を縦に伸ばす変形がある。これを肩掛けにそのまま掛けると帽子を突き抜けるので、姿勢側で横幅 +5% だけに抑えた(見た目だけの変更)。
- **D10 Arena の Clear**: Arena で出した本体が出した分身と、泡沫が増えた分にも `arenaSpawned` を引き継ぐようにした。以前は Clear の後もこれらが残り、足元の輪も残っていた。影響はテストモードだけ。
- **D11 ボスの体の色**: `bodyColor` と `en.baseColor` をセピア 0xa39278 にした。被弾の白から戻す色を胴の色と同じにしないと、1 回殴った後に色が変わってしまうため。
  この値は段階移行の爆発の VFX 色(既存の `vfxColor: en.baseColor`)にも使われるので、爆発で広がる光の色が青灰からセピアに変わる。爆発の予兆の輪(0xff7a4a)、半径、ダメージ、時刻は変わらない。

## 3. 数値(変えていないことの確認)

- 判定の数字は定数へ移しただけで、値は同じ: 水鏡の一撃 2.4・窓 0.22、泡沫 1.5、ボス `(atkReach || 2.2) + 0.4`、ボスの残響の拡大 1.5(半径 3.6)、泡沫 ×0.62、水門守 ×1.18。
- 次も変更なし: HP、攻撃力、速さ、溜め(0.72 / 0.34 / 1.25 / 0.5 / 0.55 / 0.55・0.4)、クールダウン、ダメージ倍率(残響 ×0.6、分身 ×0.55 / ×0.5)。W2-D の溜めの延長は入れていない。湧き直しと水門守の体幹 55 は範囲外のまま。
- `tests/unit/dusk-enemies.test.js` が、AI の式(`distToPlayer < MIRROR_STRIKE_RADIUS` など)と値を固定している。

## 4. 仕様の変更(テストの更新)

- `tests/unit/warden-echo.test.js`: 以前は「他のボスの残響には輪が出ない」を固定していた。DEC-008 §3 に合わせて、次の内容に変えた。
  ボス(印 `duskEcho` = `BOSS_ECHO_SOURCE`)の「引いた」残響には輪が出る(半径 3.6、時刻は水門守の残響と同じ)。印の無い残響、知らない印の残響、歩いた跡には出ない。
  理由はテストのコメントに書いた。ほかの既存のアサーションは弱めていない。

## 5. ファイル

- `src/core/dusk-enemies.js`(新規): 配色、材質、体つき、泡沫の塊、判定の半径の定数、輪の色と太さ。輪の出し入れ(`mirrorRingProgress` / `foamRingVisible` / `bossMeleeRingProgress`)、姿勢(`mirrorPose` / `keeperPose` / `echoPose` / `copyMimicProgress`)、ΔE の計算
- `src/core/warden-echo.js`: `BOSS_ECHO_SOURCE` と `TELEGRAPHED_ECHO_SOURCES` を追加。`echoHasTelegraph` がボスの残響も対象にする
- `src/legacy/concat-plugin.js`: HEADER に import を足しただけ
- `src/legacy/parts/02-world-common.js`: `sharedGeometries()` に共有キャッシュ 3 つを登録
- `src/legacy/parts/06-player-enemy.js`: `dressEnemy` に 'village' の入口、輪郭線の対象に `userData.villageOutline`、`M.hitRadius` の受け口、`buildBoss` に `duskEcho` の分岐
- `src/legacy/parts/07-ai-combat.js`: 判定の数字を定数へ移した。`updateVillageTelegraphs` を追加。分身・泡沫の作りを村の作りに変更し、分身の後始末に輪を含めた。ボスの分身(光源を外す・当たり 2.0・影と足元の水の輪を切る・動き)、残響の姿、網の geometry の共有、`updateMobAnim` / `updateBossAnim` の入口、ボスの残響の印
- `src/legacy/parts/14-dungeon-duskvillage.js`: 敵の builder 5 つとボスの色、`dressVillageEnemy` と 5 種の作り、`updateVillageMobExtras` と姿勢、残響の姿 `buildEchoFigure`、ボスの姿 `buildDuskEchoBody` と姿勢。地図と建物の部分には触れていない
- `src/legacy/parts/14-training-ground.js`: Debug Info に `Mirror Ring` / `Foam Ring` / `Boss Ring` / `Boss Echo Rings` / `Echo Tell` / `Echo Clones` / `Village Kind` / `Player Dist` を追加(テストモードだけ)。分身が散った時のテストモードの記録 `CLONE — DISPELLED`(07)
- `tests/unit/dusk-enemies.test.js`(新規)、`tests/unit/warden-echo.test.js`(仕様の変更)、`tests/dusk-enemy-design.spec.js`(新規)

## 6. 試験

- `npm run build`: 成功
- `npm run test:unit`: tests 1988 / pass 1987 / fail 0 / skipped 1(skip は既存のもの: SVG catalog がこの checkout に無い)
- (W3-E 実装時点の記録。ボスの分身の追加修正の後の結果は `CH1-COMP-W3-report.md` §10。dusk-enemy-design は 5 件になった)
- Playwright(作業ツリー用のローカル設定。dev サーバーは 5291 番): **17 passed / 0 failed**(11.4 分)
  - `dusk-enemy-design.spec.js` 4/4: Arena での 5 種、水鏡の輪(2.40 = 2.40、中心 0、溜め・一撃の間だけ、満ちていく)、泡沫の輪(1.50 = 1.50、満ちない)、泡沫の当たり 0.34、Clear の後の Ground Rings 0、写し身の写し(魔法使い)、ボスの輪(2.60 = 2.60、中心 0、WINDUP の間だけ)、目視用の画面。コンソールエラーなし
  - `dusk-keeper-telegraph` 1/1、`dusk-fisher-telegraph` 2/2、`dusk-boss-phase-burst` 1/1、`combat-test-arena` 1/1、`duskvillage` 4/4、`chapter1-dusk-basics` 4/4

## 7. 画面(test-results/。Human の目視用で、合否には使わない)

- `dusk-enemy-closeup-{mirror,foam,copy,fisher,warden}.png` / `dusk-enemy-lineup.png`(描画の解像度 1 で、敵の周りを切り出したもの)
- `dusk-enemy-mirror.png` / `dusk-enemy-mirror-windup.png`(溜めの輪)/ `dusk-enemy-foam.png` / `dusk-enemy-copy.png` / `dusk-enemy-fisher.png` / `dusk-enemy-warden.png`
- `dusk-enemy-copy-mimic.png`(写しの溜め)
- `dusk-enemy-boss-intro.png` / `dusk-enemy-boss-windup.png`(近接の輪)/ `dusk-enemy-boss.png`
- 既存の spec の画面: `dusk-keeper-telegraph-{body,echo}.png`、`dusk-phase-burst-telegraph-{1,2}.png`

## 8. 残るリスク・Human の実機確認

- **R1 当たりの半径**(D6): プレイヤーの近接は、人型の敵には少し遠くから届くようになり(水門守は +0.2)、泡沫には少し近づく必要がある。届き方が変わったと感じたら、footprint を下げればよい(表の 1 か所)。
- **R2 夜の村での見え方**: 撮影できたのは明るいトレーニング空間だけ。夜の青い光の下でセピア・灰紫・オリーブが沈みすぎないか、実機で確認が要る。
  交戦中の赤い強調(既存の threatHighlight。洋館の敵にも同じく掛かる)が胴の色を上書きしすぎないかも合わせて確認したい。
- **R3 輪の数**: 泡沫は敵対中ずっと淡い輪を出す(最大 7 体)。商店街の複合戦闘で床がうるさくならないか。
- **R4 写し身の姿勢・漁師の一回転**: 腕の向きや回転の速さは Debug Info では読めない。実機で「何をしてくるか」が読めるかを確認する。
- **R5 ボスの段階 3 の残響の輪**: unit テスト(印、半径 3.6、時刻)と Debug Info(`Boss Echo Rings`)の確認口はある。ただし E2E がこの輪を見るのは、ボスの試験中に残響が出たときだけで、出なければ検査は空になる。段階 3 は実機で確認したい。
- **R6 性能**: 1 体あたりのメッシュ数(輪郭の殻を除く)は、水鏡 14 / 泡沫 6 / 写し身 13 / 漁師 17 / 水門守 26 / ボス 約 22。洋館の敵(約 25〜35)以下で、部品の geometry と material は種類ごとに共有している。
  商店街の最大 8 体での実機の fps は、CV-01 と同じ手順で確認が要る。
- 範囲外のまま: 湧き直し、水門守の体幹 55、W2-D の時刻の延長。地図(W3-M)は別の担当。

## 9. Autonomy Metrics

- Human への質問: 0(Escalation なし)。Human Decision: None
- 作業中に見つけて自分で直したもの: Debug Info のプローブ(fixed 要素は offsetParent が null になり、記録されていなかった)、写し身の胴(D9)、輪の高さ(+0.08)
