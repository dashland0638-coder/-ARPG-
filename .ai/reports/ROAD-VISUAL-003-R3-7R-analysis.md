# ROAD-VISUAL-003 Analysis（R3-7R: 道のクリア時の roadArea リセットの確認と固め）

## Task
ROAD-VISUAL-003 / R3-7R。R3-7 の必須作業「道のクリアで `state.roadArea` を 0 に戻す」（`.ai/reports/ROAD-VISUAL-003-R3-4-plan.md` §R3-7 の必須作業）を確認し、クリアから再出撃までの状態遷移を安定させる（Human 依頼 2026-11-23）。

## 作業開始時の状態（FACT）
- `claude/road-visual-003-r3-7` の先端は `cbbece8`（PR #145 の merge）。main は `209be5c`（PR #144 = R3-7 本体の merge）で、r3-7 は main より 20 commit 先
- R3-7 用の open PR は無い（open は #72 のみ）。R3-7 本体は PR #142（→ r3-7）/ #144（→ main）で merge 済み
- `.ai/tasks/ROAD-VISUAL-003.md` の Work Items 表は R3-7 を「未着手」のまま（R3-7 の計画 `.ai/reports/ROAD-VISUAL-003-R3-7-plan.md` は「実装（2026-11-22）」）→ 表の更新漏れ

## Existing System Search（roadArea を全て追跡。検索語 `roadArea` / `src` `tests`）
| 場所 | 役割 |
| --- | --- |
| `core/state.js:86` | 初期値 0 |
| `core/road-party.js` | `sanitizeRoadArea`（0〜5 に丸める）、`recordRoadArea`（大きい方。未加入は 3 で止める）、`roadJoinedFromArea`（4 以上 = 加入済み）、`roadStartCamp`（2 以上で野営地から） |
| `09-save-load.js:87 / :218` | 保存 `sanitizeRoadArea(state.roadArea)`、読み込み（無い旧セーブは 0） |
| `14-hud-boot.js:1600 / :1710` | 新しい冒険・テストモード開始で 0 |
| `14-dungeon-road2.js:185` | 出撃時の一日の旅路の始まり（`roadDaylightStart(roadArea)`）。時間は一方向にだけ進む（ROAD-VISUAL-004） |
| `14-dungeon-road2.js:954` | 正式な加入で 4 を記録（`road2Join`） |
| `14-dungeon-road2.js:977 / :980 / :985` | 再出撃: 4 以上なら一幕なしで加入、野営地から始める、羅針盤を出しておく |
| `14-dungeon-road2.js:997` | 野営地に着いたら到達を記録（`road2RecordReach`。野営地から 8 以内だけ） |
| `14-dungeon-road2.js:1994` | **道のクリア: `road2FinishRoad` で 0 に戻す**（R3-6、DEC-028）→ 直後に結果画面 |

## クリアの流れ（FACT）
高原の大角を倒す（`road2OnFinaleDefeated`）→ R5-03 → `road2BeginEnding`（A-9・盗「帰ろう…」・暗転）→ `road2FinishRoad`: `roadArea = 0`・`roadPendingFinale = true`・結果画面（`showBossResultScreen` が `scenarioClears.road` を 1 つ数える）→「戻る」→ `returnToTownNow` が `saveGame()`（到達 0 とクリアを同時に保存）→ 最後の酒場
- クリア時に保存はしない（結果画面で閉じても「クリア無し・到達 0」を残さない）。保存は酒場へ戻る時の 1 回
- 結末の場所（石環の北 z ≥ 728）はエリア 5 の野営地（z 648）から 8 より遠い → リセット後に `road2RecordReach` が到達を戻すことは無い
- 道の途中で倒れた・撤退した時は `road2FinishRoad` を通らない → 到達はそのまま保存され、再出撃は到達した野営地から（一日の旅路もそのエリアの時間帯から）
- 第一章クリア後、本編では道へ再出撃できない（`offeredScenarios` は空。再訪なし）

## 確認できていないこと（テストの穴）
- `road2-ending.spec.js` はテストモード（通常のセーブへ書かない）で `roadArea === 0` を見ているだけ。**本編のセーブに「到達 0・クリア 1」が書かれること**と、**道の途中の撤退でリセットされないこと**を確かめるテストが無い
- `road2FinishRoad` のリセットと結果画面の順序を直接検査する unit テストが無い

## 結論
- FACT: クリア時のリセットは R3-6 で実装済みで、流れ上も正しい（クリアと同時の保存・他のシナリオは `road2FinishRoad` を通らない・新しいセーブ項目なし）。**コードの修正は不要**
- 必要なのは検証の補強: unit（リセット・保存しない・結果画面・失敗時の退避）と、本編のセーブを使った E2E（クリア → 保存 → 読み直し、途中の撤退 → 到達が残る → 再出撃で野営地と時間帯が戻る）
- `.ai/tasks/ROAD-VISUAL-003.md` の R3-7 行を実態（DONE）へ直す

## Risks
- E2E は本編のセーブから入るため時間がかかる（道の読み込み 1〜3 分）→ 1 spec にまとめる

## Unknowns
ESCALATION 候補なし。
