# ROAD-VISUAL-003 — 第一章の最終シナリオ「道 — その先へ」全面リニューアル

Status: IN PROGRESS（R3-0）

設計: `.ai/reports/ROAD-VISUAL-003-design.md`（APPROVED）。Human Decision: `.ai/decisions/DEC-025-road-renewal.md`（E-1〜E-6 すべて A）。
ブランチ: 段ごとに新しい作業ブランチ（Human 2026-11-14）。R3-0 = `claude/road-visual-003-r3-0`（PR #125 のブランチの上）。main へは Human の明示の承認なしにマージしない。

## Approval
- [x] Human Approval — 設計の承認と E-1〜E-6（2026-11-14）
- Escalation Check（R3-0）: None。本編の道・第一章の進行・セーブ・共通システムに触れない（テストモードの作業中のシナリオだけ）

## Work Items
| 段 | 内容 | 状態 |
| --- | --- | --- |
| R3-0 | 地図のデータ・仮の地形・エリアごとの描画・テストモードの「道（新）」 | DONE（この PR） |
| R3-1 | AREA 1 宿場（戦闘・会話・壁の影）と歩きながらの掛け合い | 未着手 |
| R3-2 | AREA 2 原野（段差の高台を含む） | 未着手 |
| R3-3 | AREA 3 水鏡の谷（水面の演出・淵の大鰻） | 未着手 |
| R3-4 | AREA 4 山道（出会いと加入・遺構・地下・古き守り手） | 未着手 |
| R3-5 | AREA 5 と最終戦（高原の大角・結果画面を後に回す処理） | 未着手 |
| R3-6 | エンディング・最後の酒場・野営地の支援の選択・到達の保存・固定の報酬表 | 未着手 |
| R3-7 | 本編の切り替え・旧道の削除・試験の置き換え・文書 | 未着手 |

## R3-0 の範囲
- Files To Change
  - 新規 `src/core/road-map.js`（エリア・野営地・通り道・ランドマーク・帯のデータ）
  - 新規 `src/legacy/parts/14-dungeon-road2.js`（仮の地形とエリアごとの描画）
  - 登録: `concat-plugin.js`（import）・`02`（WORLD_DEFS・WORLD_MOOD）・`06`（worldBounds・worldKeyForPos）・`12`（SCENARIO_DEFS・出撃位置）・`03`（環境音）・`14-hud-boot`（場所の名前・更新の呼び出し）・`audio/procedural-bgm.js`・`core/test-scenario-select.js`（作業中のシナリオ）・`core/scenario-waypoints.js`
  - 試験: 新規 `tests/unit/road-map.test.js`・`tests/road2.spec.js`。期待値の更新: `tests/unit/test-scenario-select.test.js`（SCENARIO_DEFS の写しに road2）・`tests/chapter-select-testmode.spec.js`（チャプターが 3 つ）
- Files Not To Change: `14-dungeon-road.js`（本編の道）・`core/chapter1-progress.js`・セーブ・`07-ai-combat.js`・`08-loot-equipment.js`

## R3-0 の結果（2026-11-14、この環境・844×390）
| エリア | 景色の描画回数 | フレーム全体 |
| --- | --- | --- |
| 旅人の宿場 | 12 | 322 |
| 風渡る原野 | 13 | 323 |
| 水鏡の谷 | 16 | 326 |
| 忘れられた山道 | 12 | 322 |
| 道の果て | 10 | 320 |
- 点光源は足していない（帰還の門の共通の灯りだけ）
- エリアごとの小物は、今いるエリアと隣のエリアだけ描く

## Agent Decisions
- ワールドのキーは作業中は `road2`、場所は x 1000〜1200（旧道と並んで存在するため）。本編の切り替え（R3-7）で `road` に戻す
- テストモードのチャプター表に「作業中のシナリオ」（`wip`）を足し、そこにだけ載せる。本編の出撃の一覧（`offeredScenarios`）は第一章の進行から作られるので、`road2` は出ない
- エリアの外は、外枠（worldBounds）のすき間を当たりの長方形で塞ぐ（見た目は境の低い石）
- 地面と通り道はいつも描き、エリアの小物（境の石・木立・崖・野営地・ランドマーク）はエリアの Group で切り替える
