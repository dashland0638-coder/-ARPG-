# ROAD-VISUAL-003 R3-7 — 本編統合（道（新）を第一章の「道」にする）

Status: 実装（2026-11-22）。完成計画 Phase H。base `claude/road-visual-004-t7`。

## 1. Analyzer（今の形）
| 項目 | 今 |
| --- | --- |
| 本編の出撃 | シナリオ `road` → ワールド `road`（旧道、`14-dungeon-road.js` の `buildRoad`、x 600〜680） |
| 道（新） | テストモードの「作業中のシナリオ」`road2` だけ（`test-scenario-select.js` の `wip`、`SCENARIOS` の `road2`） |
| 進行 | `scenarioClears.road`（`CHAPTER1_ORDER` の 5 段目）、`MET_INSIDE = ['road']`、加入 `meetChapter1Protagonist(段 5)`。道（新）の加入・結果画面は既にこの形（`state.scenarioKey` で数える） |
| 保存 | 道（新）の到達 `roadArea` は保存済み。旧道は途中の保存なし |
| 旧道だけの物 | `buildRoad`・道標・橋・休憩所の一幕・`roadHandOff`・`playRoadEnding`・`finishRoad`・`updateRoad` の旧道の部分・`ROAD_X/ENTRY/BOUNDS/BEAST/SPITTER`・ワールドの定義（`WORLDS.road`・`WORLD_MOOD.road`・`worldBounds`・`worldKeyForPos` の x>600・`07-ai-combat` の湧き）・旧の最後の酒場の台詞 |
| 共有（残す） | 話者名 `ROAD_THIEF/ARCHER/TRAVELER/STRANGER`、加入前の姿と遅れる影（`buildRoadTravelerFigure`・`trackPreJoinShadow`・`updatePreJoinFigures`・`clearPreJoinFigures`・`PRE_JOIN_SHADOW_LAG`）、`buildCastFigure`、`buildChapter1TavernTrace`、`buildRoadInstances`、`roadPendingFinale`・`consumeChapter1Finale`・`playChapter1Finale` |

## 2. Planner（決めたこと）
- シナリオの鍵は `road` のまま（保存・`scenarioClears.road`・第一章の順番・他のシナリオとの接続を変えない）。ワールドの鍵は `road2` のまま（関数名の付け替えは差分が大きいだけで遊びに効かない）
- `launchScenarioNow('road')` が `road2` のワールドを建てる。出撃の位置・加入の復元は今の `road2` の分岐
- テストモードの `road2` と「作業中のシナリオ」の組を消す。道（新）の経由地は `road` の鍵へ
- 旧道のワールドと旧道だけの物を消す。共有の物は `14-dungeon-road.js` に残す（第一章の終わりの共通部分）
- 最後の酒場は道（新）の台詞だけにする（`road2NewFinale` の分岐を唯一にする）
- 試験: 旧道の試験（`road.spec.js`・`zz-road.spec.js`・`road-visual.spec.js`・`chapter1-tower-to-road.spec.js` の旧道の部分・旧道の単体試験）を道（新）に合わせて置き換える。道（新）の試験はシナリオ `road` で始める
- 保存の互換: 旧道を終えた保存（`scenarioClears.road ≥ 1`）は第一章クリアのまま。途中の保存は `roadArea` だけ（旧道の途中の保存は無い）
- 文書: `docs/SCENARIOS.md`・`docs/CHAPTER1_STORY.md`・`docs/PROGRESSION.md`・`docs/README.md`、決定 DEC-032
