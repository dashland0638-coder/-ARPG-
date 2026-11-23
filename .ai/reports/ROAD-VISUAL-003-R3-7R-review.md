# ROAD-VISUAL-003 / R3-7R Review

## Round 1/3

## Review Target
| 項目 | 値 |
| --- | --- |
| Task ID | ROAD-VISUAL-003 / R3-7R |
| Branch | `claude/wanderer-renewal-001-nhlxns`（PR base 予定 `claude/road-visual-003-r3-7`、先端 `cbbece8`） |
| Reviewed SHA | `a493f2b2068daef04a7855b05b87d937cc3172bf` |
| Diff range | `c243b1f8f7325ce32edf090886dca62037501dc9..a493f2b2068daef04a7855b05b87d937cc3172bf` |
| Handoff Verification | V-1 OK（remote の先端 = `a493f2b`）/ V-2 OK（Task file 到達可）/ V-2a OK（`c243b1f:` と `a493f2b:` の Task file の差分は `Status:` 行・Status History 1 行追加・Implementation Result 節だけ。Plan blob `749ceb0` 一致）/ V-3 OK（Implementation Plan 節）/ V-4 OK / V-4a OK（`a493f2b:.ai/reports/ROAD-VISUAL-003-R3-7R-analysis.md` = `e7119ec…`）/ V-4b OK（`fa251ff` は Source Branch から到達可）/ V-5 OK（Test Report・Changed Files あり）/ V-6 OK（4 files、終点 = Implementation SHA）。`cbbece8` は `a493f2b` の祖先 |
| Analysis Source | `.ai/reports/ROAD-VISUAL-003-R3-7R-analysis.md`（`claude/wanderer-renewal-001-nhlxns` @ `fa251ff384ce10a77a5c5654c48dc79dfb3386b0`、blob `e7119ece6b57b2f619fda1ac9aa4a32d676831c0`） |
| Plan Source | `.ai/tasks/ROAD-VISUAL-003-R3-7R.md`（`claude/wanderer-renewal-001-nhlxns` @ `c243b1f8f7325ce32edf090886dca62037501dc9`、blob `749ceb0cbb63faddf0e25413c29afe14286897c7`） |

## Result
PASS

## Independence
別 Agent・別セッション（separate-context subagent）。Implementer の判断過程は入力にしていない。

## 独立した追跡（`roadArea`）
`grep -rn roadArea src/` の書き込みは次の 6 か所だけ:

| 場所 | 内容 | 判定 |
| --- | --- | --- |
| `src/core/state.js:86` | 初期値 0 | — |
| `14-hud-boot.js:1600` / `:1710` | 新しい冒険 / テストモード開始で 0 | — |
| `09-save-load.js:218` | 読み込み `sanitizeRoadArea(data.roadArea)`（無い旧セーブ・壊れた値は 0） | 互換 OK |
| `14-dungeon-road2.js:954` `road2Join` | `recordRoadArea(…, 4, true)`（大きい方を取る） | 下記 (1) |
| `14-dungeon-road2.js:997-998` `road2RecordReach` | 野営地から 8 以内で到達を記録（毎フレーム、`updateRoad2` 2253） | 下記 (1) |
| `14-dungeon-road2.js:1994` `road2FinishRoad` | **0 に戻す**（呼び出しは `road2BeginEnding` の最後の暗転 1962 だけ） | 本件 |

1. **リセットのタイミングと再上昇の有無**
   - 流れ: 高原の大角 → `road2BeginEnding`（石環の北の端 `ringNorth` z 728 へ移し、北へ歩く）→ 暗転 → `road2FinishRoad`: `roadArea=0` → `roadPendingFinale=true` → `dialogueActive=true` → `showBossResultScreen`（`scenarioClears.road += 1`、`bossClears`）→「戻る」（`ROAD2_RESULT_BOSS` に `endsRun:false` が無いので「探索を続ける」は出ない、`BOSS_ENDING_LINES` にも無いので直に `returnToTown(false)`）→ `returnToTownNow`: `buildWorld('tavern')` → `advanceChapter1Cast` → `saveGame()`（到達 0 とクリア 1 が同じ保存に入る）→ `consumeChapter1Finale()` で最後の酒場。
   - `road2RecordReach` は `dialogueActive` で止まらないが、結末の位置（z 728〜約 733）とエリア 5 の野営地（z 648）は約 80 離れており 8 以内に入らない。結果画面の後は `buildWorld('tavern')` で `currentWorldKey !== 'road2'` になり `updateRoad2` が早期 return する。→ 再上昇しない。
   - `road2Join` は `road2Joined` が既に true なので結末後は何もしない。再出撃時の `road2EnterCast` は `road2StartPos` の **後** に呼ばれる（`12-progression-ui.js:1797`→`1800`）ので、影の旅人で入り直しても開始は入口。そもそも本編では道のクリア後 `offeredScenarios` が空（`chapter1-progress.js:76`）で、道へは出撃できない。
2. **クリア演出・再出撃**: `src/` 変更なし。結果画面が例外を出しても `catch` で `dialogueActive=false; returnToTown(false)`（到達 0 のまま）。途中の撤退・全滅は `road2FinishRoad` を通らず到達を保持し、再出撃は `roadStartCamp`（野営地）と `roadDaylightStart(roadArea)`（時間帯）から復元。
3. **保存と復元の整合**: 新しい保存項目なし（`roadArea` は R3-4 の既存項目）。結果画面の間に閉じた場合、`beforeunload` / `visibilitychange` の `saveGame` は「到達 0・クリア 1」を一緒に書く（両方とも結果画面の時点で既に state にある）ので矛盾しない。失われるのは保存しない `roadPendingFinale`（最後の酒場の一幕）だけで、これは R3-6 の既存の設計（保存はしない／クリア無し・到達 0 を残さない）の範囲。結末の暗転より前に閉じた場合は「到達 5・クリア無し」で、野営地 5 からやり直し（既存挙動、矛盾なし）。
4. **他シナリオへの副作用**: `roadArea` を読むのは道（新）と保存・読み込みだけ。`showBossResultScreen` / `returnToTownNow` は無変更。
5. **試験の実効性**
   - unit: `road2FinishRoad` / `road2RecordReach` の **実ソース** を切り出して stub で実行。リセット行を消せば 1 件目（到達 0、結果画面時点の `roadArea=0`）が失敗する。結末位置で到達が戻らないことも実座標（`ROAD2_FINALE` / `ROAD2_CAMPS`）で確認。
   - E2E A: テストモードではなく本編のセーブ（`testMode false` を確認）から実際に出撃・撃破・結果画面・酒場まで通し、`localStorage` の実セーブで到達 0・`scenarioClears.road` 1 を確認、さらに再読込で確認。リセットを消せば `s.roadArea` / `saved.roadArea` の検査で失敗する。B は撤退で到達が戻らないことの対照。
   - 結論: 「コード変更不要」は正しい。クリア → 再出撃の遷移に実害のある不具合は見つからなかった。

## Checklist
| # | 項目 | 結果 | 根拠 |
| --- | --- | --- | --- |
| 1 | Specification compliance | OK | AC 3 件を上の追跡と試験で確認。DEC-028 / R3-6 の「道を終えたら到達を 0」と一致 |
| 2 | Scope compliance | OK | Files To Change の 3 ファイル（＋ Task file の Implementation Result）だけ。`src/` 無変更 |
| 3 | Regression | OK | ゲームコード無変更。既存の道・セーブ系 E2E は Implementer の Test Report で PASS（Reviewer は Playwright 未実行） |
| 4 | Build | OK | `npm run build` PASS（Reviewer 実行） |
| 5 | Unit tests | OK | `npm run test:unit` tests 2338 / pass 2337 / fail 0（Reviewer 実行。1 件は既存の skip） |
| 6 | E2E tests | OK（未再実行） | 指示により Playwright は実行していない。spec の内容をレビューし、本編セーブ・実フローであることを確認。Implementer 報告 38 件 PASS、全 E2E は CI |
| 7 | Save/Load integrity | OK | 新項目なし。`sanitizeRoadArea` で旧セーブ互換。結果画面中の終了でも矛盾なし |
| 8 | Existing behavior | OK | 撤退・全滅・エリア移動で到達保持、再出撃の野営地・時間帯の復元を維持 |
| 9 | Code duplication | OK | 試験だけの追加 |
| 10 | Unnecessary architecture changes | OK | なし |

## Changed Files
- `tests/unit/road2-clear-reset.test.js`（新規）
- `tests/road2-clear-reset.spec.js`（新規）
- `.ai/tasks/ROAD-VISUAL-003.md`（R3-7 行を DONE）
- `.ai/tasks/ROAD-VISUAL-003-R3-7R.md`（Status / Status History / Implementation Result）

## Out of Scope Changes
None

## Risks
- unit の「`state.roadArea = 0` を書くのは 3 か所だけ」の検査は意図的に厳しく、正当なリセット箇所を足すと失敗する（仕様の固定としては妥当。その時は試験も更新する）。
- E2E A の「結果画面の間はまだ保存していない（`rawSave.roadArea === 5`）」は、結果画面中に保存が走らないことに依存する。将来結果画面中に保存を足しても状態は矛盾しない（到達 0・クリア 1）が、この行は更新が必要になる。
- 結果画面の間にアプリを閉じると最後の酒場の一幕は出ない（`roadPendingFinale` は保存しない）。R3-6 からの既存の設計で、本件の範囲外。
- E2E は Reviewer 環境で再実行していない（CI の結果を PR で確認すること）。

## Required Changes
None
