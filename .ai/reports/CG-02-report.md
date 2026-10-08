# CG-02 Report — 幽霊船の物語(前半)

| 項目 | 内容 |
| --- | --- |
| Work Item ID | CG-02 |
| Goal | §4-1 の出発の3行と §4-2 前半(晩餐の間・船長室・甲板)を本編の幽霊船に置く |
| 変更ファイル | `src/legacy/parts/04-dungeons-ship-waterway.js`(`ghostShipChapter1` / `buildGhostShipChapter1Story` を追加、`buildGhostShip` の末尾で呼ぶ)、`src/legacy/parts/14-hud-boot.js`(`CHAPTER1_JOIN_LINES.archer` に3行)、`tests/unit/ghostship-story.test.js`(新規 7件) |

## 配置

| 場所 | 発火 | 話者 |
| --- | --- | --- |
| 晩餐の間を出た廊下 | 範囲 x -8..-2, z 72.4..76(messDoor の北) | 魔法使い→弓師→魔法使い→弓師 |
| 船長室 | 手記「止まった船の時計」(4,89)。範囲 x ±7.6, z 85..94.6 で弓師が七時十三分に気づく | 弓師→魔法使い→弓師 |
| 甲板(影を見た) | 既存の影(-5,105 r7)が出た直後 | 弓師→魔法使い |
| 甲板(影を見ていない) | 階段(6,108)の手前 x 2..7.6, z 103..110。上と排他 | 弓師→魔法使い |
| 酒場(幽霊船へ) | 既存4行の後に3行 | 弓師・魔法使い・剣士 |

CG-01 の調査どおり、晩餐の間と船長室は桟橋からの本筋上にある。甲板の影は西寄りにあり、cabinDoor→階段の直線では半径の外を通ることがあるため、甲板の一言だけ2通りにした(意味は §4-2 のまま)。

## テスト
- `node --test tests/unit/ghostship-story.test.js`: 7/7 pass(本物の registerProximityEvent / updateProximityEvents / buildGhostShipChapter1Story を stub 付きで動かし、本筋の座標を歩かせる)
- 変異確認: 本編条件の削除、船長室の範囲の縮小、甲板の排他条件の削除 → それぞれ失敗することを確認して戻した
- `npm run test:unit`: 全件 pass
- E2E: chapter1-progression / character-clothing / character-palette / character-weapon-visual / ui-production-glyphs: 45 passed

## Reviewer
- PASS(Round 1)。System Freeze に触れない(敵・扉・階段・ボス・セーブ項目は不変)。加入前の5人目には触れない。最初の行は全て文字列。Decision Record 不要(DEC-004 の範囲内)

## Status
- IMPLEMENTED / PLAYABLE(本筋上)/ VERIFIED(自動テスト)。実機の通しは CG-05 → Human(HE-2)
