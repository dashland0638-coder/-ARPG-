# CH1-COMP W3 — 宵待ちの村の敵の調査（Analyzer）

基準: `origin/main` `5887772`。読み取りのみ。P06 = `06-player-enemy.js`、P07 = `07-ai-combat.js`、P14 = `14-dungeon-duskvillage.js`、C = `src/core/`。

## 0. 主な発見（FACT）

1. **村の通常敵 5 種は同じ模型**: 水鏡の影・泡沫・写し身・記憶漁師・水門守の残響は、すべて `buildEnemy()` の 'wraith'（P06:3327-3341）＝汎用の獣の胴（球）＋**残ったままの鼻先**＋円錐の頭巾＋ランダムな円錐の布 5 枚、脚なし。高さ ≈1.0（洋館の使用人は ≈1.8）。違いは胴の色と group の拡大だけ。胴の材質は roughness 0.55・emissive あり（マットではない）。手足・装備・攻撃の姿勢が無く、溜めは胴の伸縮だけ
2. **ボス「村の残響」は汎用の人型ボス**（角・鎧・革の質感、P06:4815-4866）。`parts` が無く `updateBossAnim` がすぐ return → 動かない。近接の床の予兆が無い
3. **味方と色が近い**: 水鏡の影 0x2a3b4a ≈ 剣士 0x263a55 / 0x35455e、泡沫 0x7fb8c8 ≈ 魔法使い 0x8fb9d6 / #7ec8ff。村の敵の色は全部が青灰の同じ帯（青い夜の床の上）
4. **当たる残響と、当たらない演出の幽霊が同じ見た目**: 水門守の残響（円錐＋球、0x7fb0c4）と演出の幽霊（`spawnApparition`、同じ形・同じ色）。歩いた跡と引いた残響も同じ模型。ボスの段階 3 の残響（scale 1.5、半径 3.6、攻撃力 × 0.6）には輪が無い
5. **予兆が無い攻撃**: 泡沫（触れた瞬間に当たる）、水鏡の影と分身（胴の伸縮だけ）、写し身（胴の膨らみだけ）、ボスの近接（胴の伸縮だけ）
6. **ボスの分身**: `boss.group.clone(true)` がボスのオーラの PointLight も複製（光源が増える）。当たり判定は 0.342 のまま
7. **Arena では別の模型**: buildEnemy は `MOB_THEME[world]` を見るので、トレーニング空間では村の敵が「脚のある獣」で出る（洋館は theme を明示している）

## 1. 一覧

| 敵 | 作り | AI と攻撃 | 階級 |
| --- | --- | --- | --- |
| 水鏡の影 | P14:1565 hp260 atk30 | 追って 1.9 まで寄る。溜め 本体 0.72 秒 / 分身 0.34 秒、全周 2.4、CD 2.0。HP 0.62 で 2 体の分身に分かれる | NORMAL |
| 泡沫 | P14:1580 hp56 atk16、×0.62 | 6.5 秒ごとに増える（上限 7、ほかの怪異がいると 4）。1.5 以内で溜め無しに当たる、CD 1.6 | NORMAL |
| 写し身 | P14:1593 hp230 atk26 | 3.6〜6.5 を保つ。プレイヤーの魔法弾を 1.25 秒遅れで写して撃つ（魔法使い以外には無害） | NORMAL |
| 記憶漁師 | P14:1550 hp520 atk34 | 網（溜め 0.5、0.8 秒前の位置、r2.7）と近接（溜め 0.5、r2.3、輪あり。W2-MB1） | NORMAL |
| 水門守の残響 | P14:1388 hp900 atk36、×1.18 | 歩く→溜め 0.55→引く 1.5（45% で r2.4）。残響（輪あり。W2-MB2） | NAMED |
| 村の残響（ボス） | P14:1266 duskEcho hp760 atk30 | 汎用のボス AI（溜め 0.55 / 段階 3 で 0.4、全周 reach 2.2+0.4）。段階移行の爆発（輪あり。W2-4a）。分身・泡沫・写し身・残響を呼ぶ | BOSS |

## 2. 洋館の品質の基準と再利用できる部品

- 形で読ませる（胴の台形・肩幅・腕の長さ・脚の太さ・持ち物）。マットな布（roughness 0.74〜0.98、metalness 0）。攻撃の姿勢（`updateMansionMobExtras` → kind ごとの pose 関数が AI の状態を読む）。床の予兆 = 当たる形（`updateMansionMeleeTelegraph`）
- 部品: `makeTrapezoidBox` / `makeLoft` / `makeWedge` / `makePlate` / `makePrism`（`src/render/lowpoly-primitives.js`）、`mansionLimb`、`mansionGroundShadow` / `mansionShadowMat`（P06）、`makeGroundTelegraph` / `placeGroundTelegraph`（P07、W2-MB2）
- buildEnemy の独自の胴の約束: `dressEnemy` で `body.geometry` を差し替えて `body.material` は残す（被弾の白・強調が乗る）、`M.legs` / `M.snout` を隠す、`M.limbs`
- 敵の材質・ジオメトリのキャッシュは無い（洋館も個体ごと）。`disposeWorld` はジオメトリだけ捨て、材質は捨てない

## 3. 制約

胴の材質は個体ごと（被弾の白・強調が書き換える）。`en.baseColor` = 胴の色。光源を増やさない（`village-load.test.js`）。予兆の時刻・大きさ = 判定の時刻・大きさ（時刻・半径を変えるのは数値の変更）。W2-D の設計（溜めの延長など）は Human の承認待ち。ARENA_ROSTER のキー・表示名、`en.meleeTelegraphMesh`、Arena の記録の文字列、`memoryNets` / `keeperEchoes` の欄、Debug Info の Ground Rings を保つ。

## 4. 範囲外として記録するもの（別の判断が要る）

- 通常敵が 20 秒で湧き直す（商店街の波・動的な泡沫・水門守を含む。roomTag が無い）
- 水門守の体幹 55（`strongMob` を作った後に立てるので自動の 130 にならない）
- W2-D の溜めの延長（分身 0.34 → 0.5、泡沫に 0.4 の溜め、ボスの扇形）
