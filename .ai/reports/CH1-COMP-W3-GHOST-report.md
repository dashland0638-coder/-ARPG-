# CH1-COMP-W3-GHOST — 宵待ちの村の怪異デザイン統一(実装・試験・レビュー)

Status: CONTENT READY = HUMAN DEVICE CHECK REQUIRED(実機での見え方は Human が確かめる)

調査: `.ai/reports/CH1-COMP-W3-GHOST-analysis.md`。Work Item: `.ai/tasks/CH1-COMP-W3-GHOST.md`(親 `CH1-COMP-W3`)。

## 1. 変更(見た目だけ)

| 敵 | 修正 | 理由 |
| --- | --- | --- |
| 記憶漁師 | 脚(長靴)を透ける影に(既存の shade 色、不透明度 0.42)。外套の裾から透ける薄布(0.36)。足元に霧の映り込み(水鏡の影と同じ水の色、0.42) | 不透明な脚で歩く姿が、生身の人間・背を丸めた屍鬼に読めた。背の丸み・長い腕・網・帽子・姿勢・歩き方は個性として残す |
| 水門守の残響 | 太い脚を透ける影に。前掛けの下から薄布、足元に霧の映り込み | 生身の門番に読めた。重さは肩幅・腕・鎖・重い歩き・鎖を引き下ろす動作で残す |
| 泡沫 | 泡から半身を起こす透ける人影(頭と肩、shade 色、0.5)。泡の呼吸と少しずれて揺れ、弾けた直後は泡へ沈む | 人影を感じさせる要素が無かった。塊の広がりの内側(0.22 < 0.54)で、当たり 0.337 は変えない |
| 水鏡の影・写し身・ボス・分身・残響・演出の幽霊 | 変更なし | 方針を満たしていた(調査 §1) |

- 定数: `src/core/dusk-enemies.js` の `VILLAGE_GHOST`・`FOAM_FIGURE`。部品の geometry・material は種類ごとに共有(`villageGeoCache` → `sharedGeometries()`)、自発光なし・光源なし・新しい色なし
- 変えていないもの: HP・攻撃力・溜め・判定の半径・速さ・AI・予兆の輪・当たりの半径・配色の表・洋館・他のシナリオ・味方・セーブ・進行・テストモード・Arena の仕組み

## 2. 試験

- `npm run build` 成功。`npm run test:unit` 2066 pass / fail 0(skip 1 は既存)。新規 `tests/unit/dusk-ghost-design.test.js`(透ける脚・薄布・映り込み・人影が塊の内側・発光と光源なし・既存の色だけ・数値と当たりが今のまま・ゾンビ／骨の造形が無い)
- E2E(手元): 35 件 pass(§5)

## 3. 独立レビュー

- Round 1: **PASS**(MAJOR なし)。MINOR: 残るリスクを記録すること(§4)、透ける脚も影は不透明に落ちる(§4)。NIT: 人影の広がりの計算が箱の角と揺れを含まない(余裕が大きく影響なし)、泡沫の人影の材質を共通の関数にそろえる、足元の映り込みは当たりより広い(水鏡の影と同じ扱い)

## 4. 残るリスク・iPhone での確認

- **R1 泡沫の人影の見えやすさ**: 泡沫は小さい(×0.62)。人影の頭は世界で半径 0.07 ほど。増える直前に上の泡が膨らむと頭が一部隠れ、肩は胴の泡にほぼ埋まる。実機で「泡の中に人の頭」が読めるか
- **R2 夜の村での脚**: 暗い透ける脚は夜の青い光で見えにくくなる(意図: 幽霊らしさ)。歩いていることが読めるか。漁師の足元にも水鏡の影と同じ色の映り込みが付くので、漁師と水鏡の影の見分けは帽子・網・背の丸み・色で行う
- **R3 影**: 透ける脚も影は不透明に落ちる(地面に立つ重さの手がかりとして残した)
- **R4 足元の映り込み**: 映り込みは当たりの半径より広い(漁師 約 0.56、水門守 約 0.73〜0.82)。予兆の輪ではない暗い円として読まれるか。浮き上がる・倒れる時は体と一緒に動く(水鏡の影と同じ)
- 確認手順(iPhone、横 844×390): テストモード(`?dev=1`)→ Arena → Memory Fisher / Warden Echo / Foam Swarm を 1 体ずつ出し、①脚が透けて足元に霧の映り込みがある ②泡沫の上に人の頭と肩が見える ③水門守が鎖を引き下ろす動作・漁師の網の振りかぶりと一回転が今まで通り ④予兆の輪が今まで通り。本編では第一章の宵待ちの村(夜の光の下)で同じ点

## 5. 回帰(E2E)

手元(Chromium)、commit `2d72a3c`: **35 passed / 0 failed**(17.5 分)。
`dusk-enemy-design`(5 種の作り・水鏡と泡沫の輪 = 判定・写し身・ボスの輪・ボスの分身・目視用の画面)、`dusk-keeper-telegraph`、`dusk-fisher-telegraph`、`dusk-boss-phase-burst`、`dusk-boss-clone-check`、`duskvillage`、`chapter1-dusk-basics`、`dusk-village-route`、`save-load`、`combat-test-arena`、`production-build`。
目視用の画面: `test-results/dusk-enemy-closeup-*.png`・`dusk-enemy-lineup.png`(Arena の明るい床。夜の村での見え方は実機で確認)

## 6. Autonomy Metrics

Human Escalation: 0 / Human Decision: 0 / Auto Fix: 0 / Reviewer Rounds: 1 / PR: (PR 本文に記載)
