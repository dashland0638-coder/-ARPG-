# DUSK-RING-FLOOR-001 — 宵待ちの村の予兆の輪が床の下に隠れる不具合

親 Task: [`CH1-DUSK-IMMERSION.md`](CH1-DUSK-IMMERSION.md)(そこで見つけた範囲外の不具合。Human Decision 2026-10-27「別 PR で修正」)

Status: IMPLEMENTING(CONTENT READY = HUMAN DEVICE CHECK REQUIRED)

## Approval
- [x] Approved(Human 2026-10-27「攻撃予告の輪が床に隠れる不具合は別PRで修正してください」)

## 調査(Analyzer)
- 村の部屋の床は `addFloorWithHoles(..., 0.08)` の不透明な面。村は `groundSlabs` を登録しないので、`placeGroundTelegraph` は床の高さを 0 とみなし、輪を **0.06(床の下)** に置いていた
- 隠れていた輪: 記憶漁師の近接(`placeFisherMeleeTelegraph`)、網の落ち先(`ring.position.set(plan.x, 0.06, plan.z)`)、水門守の残響(`placeKeeperTelegraph`)、残響(水門守・ボスの段階 3。`spawnKeeperEcho` / `updateKeeperEchoes`)
- 見えていた輪: 村の怪異の輪(水鏡の影・泡沫・ボスの近接。`placeVillageRing` が +0.08 して 0.14)、ボスの段階移行の爆発(0.15〜0.16)
- `placeGroundTelegraph` を使うのは村の仕組み(と Arena)だけ。洋館の近接の予兆は別の関数
- 手元の画面(本編の村・水門前・夜): 記憶漁師が近接の溜め(Debug の FISHER MELEE — WINDUP)に入っても橙の輪が出ない

## 計画(Planner)
- `telegraphFloorY(x, z, yRef)`: 村(`currentWorldKey === 'duskvillage'`)の部屋の中は村の床の表(`duskFloorYAt` = 0.08)、それ以外は今まで通り(groundSlabs か 0)
- `placeGroundTelegraph` と網の落ち先の輪はこれ + 0.06(村の部屋の中で 0.14)
- `placeVillageRing` の「+0.08」は「最低 0.14」に置き換える(村・Arena とも今まで通り 0.14。二重に上がらない)
- `DUSK_FLOOR_Y` / `duskFloorYAt` は PR #104(CH1-DUSK-IMMERSION)と同じ定義・同じ場所(どちらが先に merge されても衝突しない)
- 変えない: 判定・時刻・半径・色・進み具合・呼ぶ側、洋館・他のシナリオ、Arena での高さ

## Files To Change
- `src/legacy/parts/07-ai-combat.js`、`src/core/dusk-village-map.js`、`src/core/dusk-enemies.js`(`VILLAGE_RING_MIN_Y`)、`src/legacy/parts/14-dungeon-duskvillage.js`(床を定数で作る)、`src/legacy/concat-plugin.js`(import)
- 新規 `tests/unit/dusk-ring-floor.test.js`、`.ai/reports/DUSK-RING-FLOOR-001-report.md`

## 受け入れ条件
- 村の部屋の中で、記憶漁師の近接・網の落ち先・水門守・残響の輪が床の上(0.14)に見える
- 村の怪異の輪は今まで通り 0.14。Arena・他のシナリオの輪の高さは変わらない
- 判定・時刻・半径は不変。build・unit・関連 E2E・CI・独立 Reviewer PASS

## Result

- Reviewer PASS(Round 1)。CONTENT READY = HUMAN DEVICE CHECK REQUIRED。報告: `.ai/reports/DUSK-RING-FLOOR-001-report.md`
