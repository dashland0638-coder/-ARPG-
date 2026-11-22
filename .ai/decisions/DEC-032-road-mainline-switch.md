# DEC-032 — 第一章の「道」を「道 — その先へ」に切り替え、旧道を消す

Status: Accepted（Human の依頼「ROAD-VISUAL-003 / 004 完成プロジェクト」Phase H、2026-11-21。実装 R3-7、2026-11-22）

## Decision（Human の依頼）
- 本編の出撃先を新しい道へ切り替える。旧道は削除または整理する。テスト専用の足場を片づける
- 保存・進行・クリアの扱いをそろえる。章のつながりと保存の互換を確かめる。他の第一章のシナリオを不要に変えない

## 実装仕様（Agent）
| 項目 | 決めたこと |
| --- | --- |
| シナリオの鍵 | `road` のまま（`CHAPTER1_ORDER` の 5 段目、`scenarioClears.road`、`MET_INSIDE`、出撃の一覧・会話・初制覇の印） |
| ワールドの鍵 | `road2` のまま。`src/core/scenario-world.js` `scenarioWorldKey('road') === 'road2'` を `launchScenarioNow` が通す（関数名 `road2*` の付け替えはしない） |
| 旧道 | ワールド（`buildRoad`・境界・湧き・`WORLD_MOOD.road`・`AREA_NAMES.road`・`worldKeyForPos` の x>600）、一幕（道標・橋・休憩所・丘）、旧道の敵、旧の最後の酒場の台詞を消す |
| 残す共有物 | `14-dungeon-road.js`: 話者名・加入前の姿と遅れる影・仲間の立ち姿・酒場の隅の卓・`buildRoadInstances`・最後の酒場（一行全員の台詞だけ） |
| テストモード | 「作業中のシナリオ」の組と `road2` の出撃を消す。道の途中の地点（原野・谷・山道・加入後・道の果て）は `road` の地点 |
| 保存の互換 | 旧道を終えた保存（`scenarioClears.road ≥ 1`）は第一章クリアのまま。道の途中の保存は `roadArea` だけ（旧道には途中の保存が無かった）。保存の形は変えない |

## 関連
- 計画: `.ai/reports/ROAD-VISUAL-003-R3-7-plan.md`、完成計画 `.ai/reports/ROAD-VISUAL-COMPLETE-plan.md`
- DEC-025（道の全面リニューアル）、DEC-028（一日の旅路）
