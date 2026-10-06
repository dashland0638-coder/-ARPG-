# PROGRESSION-006

Status: DONE

Analysis: .ai/reports/PROGRESSION-006-analysis.md（branch `claude/progression-006-anomaly-reward` @ `0ca114fe4e01f514d999c63ebc2cd13e773096d4`、blob `18b4cc2e90c299cba4d41cfa5c50e6726899c839`）

## Approval
- [x] Approved
- Approval type: Agent Approval（`../AGENTS.md` §6.1。仕様は Human Decision「第一章の装備は固定・少数、ランダム装備は第一章クリア後」）
- Escalation Check: None（E-1: Human Decision どおり / E-2: 矛盾なし / E-3: 代替報酬を新しく決めない。残る報酬（金貨）は第一章に既にある報酬 / E-4: セーブは消さない・変換しない / E-6・E-7・E-9: 該当なし）
- Approved by / date / where: Planner (Agent) / 2026-10-05 / branch `claude/progression-006-anomaly-reward`
- Scope of approval: 下の Files To Change
- Persistence: 許可（branch: `claude/progression-006-anomaly-reward`、根拠: Human の指示（PR #32 は merge 済み。最新 main から新しい branch・新しい PR））

Implementation: ALLOWED

## Goal

第一章の本編では、異空間をクリアしてもランダム装備を付与しない。異空間そのもの（出現・入口・敵・クリア・帰還・出現率 40%）は変えない。テストモード（= 旧システム / Chapter 2 の基盤）の報酬は変えない。

## Chapter 1 Reward Rule（実装する規則）

| | 本編（第一章、新規・旧セーブとも） | テストモード |
| --- | --- | --- |
| 装備 | 付与しない | 変更前どおり 1 つ確定（レア率 40%、10% で特殊武器） |
| 💎 / 🔩 | 付与しない（既存の WI-A5） | 変更前どおり 2〜4 |
| 金貨 | 変更前どおり 20〜39 | 変更前どおり 20〜39 |
| 演出（ログ・効果音） | 変更前どおり | 変更前どおり |

## Implementation Plan

| Step | ファイル | 変更 |
| --- | --- | --- |
| 1 | `tests/unit/anomaly-reward.test.js`（新規） | `grantAnomalyReward` の実物のソースを stub 付きで実行: 本編（新規・旧セーブ）で装備が増えない・既存の装備が残る・金貨は入る、テストモードで装備が 1 つ増える。構造: 装備は `maybeGrantEquipmentInstant` を通る・`addEquipmentItem` を直接呼ばない・`ANOMALY_SPAWN_CHANCE = 0.4`・呼び出し元は 1 か所。実装前に FAIL を確認 |
| 2 | `src/legacy/parts/02-world-common.js` `grantAnomalyReward` | `addEquipmentItem(rollDropEquipment(0.4))` → `maybeGrantEquipmentInstant(1.0, 0.4)`（既存の本編ゲート付きの入口） |

## Files To Change
上の表のファイルと `.ai/` の記録（本 Task file、review report）

## Files Not To Change
異空間の出現・入口・敵・クリア判定・帰還（`spawnAnomalyRiftForWorld` / `enterAnomalyRoom` / `buildAnomalyRoom` / `updateAnomalyRifts` / `exitAnomalyRoom`）、`ANOMALY_SPAWN_CHANCE`、`ANOMALY_RIFT_SPOTS`、ランダム装備の生成（`rollDropEquipment` / `rollEquipment` / `rollSpecialWeapon`）、`maybeGrantEquipmentInstant`、`addItem` / `grantGold`、セーブの読み書き、`core/chapter1-rules.js`、`basefile.html`

## Test Plan
- 新規 unit を実装前に追加し、変更前の src で FAIL を確認
- build / unit / `ai-protocol` / 関連 E2E（洋館・旧セーブ・宝箱・施設）/ E2E 全体（2 CPU）/ GitHub Actions
- 異空間の E2E は作らない: 出現が 40% の乱数で、食堂は本 CI 環境（software rendering）では歩いて到達できない（既存の `mansion-scenario` / `mansion-escort` のメモと同じ判断）。代わりに実物の関数を unit で実行する

## Acceptance Criteria
- AC-A1 本編（新規・旧セーブ）で異空間の報酬が装備を付与しない
- AC-A2 旧セーブの既存の装備は消えない・変わらない
- AC-A3 本編の異空間報酬に残るのは既存の金貨と演出（新しい報酬なし）
- AC-A4 テストモードは変更前どおり装備を 1 つ付与する
- AC-A5 異空間の出現率・入口・敵・クリア・帰還は変えない

## Agent Decisions
| # | 決定 | 根拠ソース（AGENTS.md §17.2） | 代替案 |
| --- | --- | --- | --- |
| R-1 | 本編の判定は既存の `legacyGrowth()`（`maybeGrantEquipmentInstant` の中のゲート） | `legacyGrowthEnabled(testMode)` は旧セーブ判定ではなく本編/テストモードの判定（新規プレイでも本編は false）。敵ドロップ・宝箱と同じ入口（WORK 12.1） | 章を見る新しい判定を作る（判定の乱立、Chapter 2 の仕様を先取り） |
| R-2 | 代替報酬は足さない。本編に残るのは変更前からある金貨 | 金貨は第一章の本編の既存報酬（宝箱・敵）。WI-A5「別の報酬には置き換えない」と同じ方針 | 金貨の増額・回復薬の追加（新しい報酬の設計 → Human Decision が必要） |
| R-3 | 回帰テストは実物の関数を unit で実行 | 異空間は乱数かつ CI で到達不能。関数の実物を動かせば本編/テストモードの付与を直接確かめられる | 乱数を差し替えて洋館を歩く E2E（既存の判断で到達不能） |

## Implementation Result

### Chapter 1 / Test Mode の挙動
| | 本編（第一章、新規・旧セーブ） | テストモード |
| --- | --- | --- |
| 異空間の出現・入口・敵・クリア・帰還 | 変更なし（出現率 40%） | 変更なし |
| 報酬の装備 | 付与しない | 変更前どおり 1 つ |
| 💎 / 🔩 | 付与しない（既存の WI-A5） | 変更前どおり |
| 金貨 20〜39・ログ・効果音 | 変更なし | 変更なし |
| 旧セーブの装備 | 読みも書きもしない | — |

### Changed Files
- `src/legacy/parts/02-world-common.js`（`grantAnomalyReward` の装備付与を `maybeGrantEquipmentInstant(1.0, 0.4)` へ）
- `tests/unit/anomaly-reward.test.js`（新規、6 件）

### Test Report
| テスト | 結果 | メモ |
| --- | --- | --- |
| Build | PASS | |
| Unit | PASS | 1634 件中 1633 PASS / 0 FAIL / 1 SKIP（既存）。新規 6 件は変更前の src で 3 件 FAIL（本編の新規・旧セーブ、構造） |
| Protocol | PASS | 16 / 16 |
| 新規 E2E | なし | 異空間は 40% の乱数で、食堂は CI 環境で歩いて到達できない（Test Plan）。実物の関数を unit で実行 |
| 関連 E2E | 42 / 42 PASS | `mansion-scenario`・`mansion-escort`・`mansion-enemies`・`chapter1-old-save-growth`・`chapter1-legacy-ui`・`chapter1-facility-access`・`save-load`・`scenario-test-mode`（最初の単独実行は 19 / 19 の時点で実行時間の上限で停止。全体の実行で 42 / 42） |
| E2E 全体（2 CPU） | **237 passed** | |
| GitHub Actions（`4728635`） | 236 passed / 1 failed | `base-class-identity:413`（テストモードの Arena の spec、本変更の経路外。PR #32 でも同じ失敗、W-4）。PR にコメントし再実行 1 回。最終 head の run で確認 |

## Status History
| Date | From → To | By | Note |
| --- | --- | --- | --- |
| 2026-10-05 | （新規）→ PLANNED → IMPLEMENTING | Orchestrator / Analyzer / Planner | Analysis `0ca114f`、Plan + 回帰テスト `0a61063`（Agent Approval） |
| 2026-10-05 | IMPLEMENTING → TESTING → REVIEWING | Implementer / Tester | Implementation `4728635`、PR #33 |
| 2026-10-05 | REVIEWING（Reviewer PASS） | Reviewer | Round 1/3 PASS |
| 2026-10-05 | REVIEWING → DONE | Orchestrator（Completion commit） | Merge required: Human approval |

### Autonomy Metrics（PROGRESSION-006）
- Human Escalation Count: 0（代替報酬は不要: 残る金貨は第一章の既存報酬）
- Human Decision Count: 1（この Task の起点の Human Decision）
- Auto Fix Count: 0
- Reviewer Round Count: 1
- Test Retry Count: 1（GitHub Actions の失敗した job の再実行 1 回）
- PR Created: Yes (#33)
