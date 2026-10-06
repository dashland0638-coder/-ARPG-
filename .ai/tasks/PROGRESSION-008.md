# PROGRESSION-008

Status: DONE

Analysis: .ai/reports/PROGRESSION-008-analysis.md（branch `claude/progression-008-chapter1-no-anomaly` @ `795fa97d27b1e62cd25a6efbcebfd1f7796402e2`、blob `0eb8120aadbfda09ea8c58a6b1dc3a859d7e1d57`）

## Approval
- [x] Approved
- Approval type: Agent Approval（`../AGENTS.md` §6.1。仕様は Human Decision 2026-10-05「第一章では異空間を全面廃止」）
- Escalation Check: None（E-1: Human Decision どおり / E-2: 第一章の判定は既存の `legacyGrowth()` で決まる / E-3: 第二章以降の仕様は決めない / E-4: セーブに異空間の状態は無い / E-6・E-7・E-9: 該当なし）
- Approved by / date / where: Planner (Agent) / 2026-10-05 / branch `claude/progression-008-chapter1-no-anomaly`
- Scope of approval: 下の Files To Change
- Persistence: 許可（branch: `claude/progression-008-chapter1-no-anomaly`、根拠: Human の指示（最新 main から新しい branch・新しい PR））

Implementation: ALLOWED

## Goal

第一章（本編）には異空間そのものが存在しない状態にする。異空間の本体は第二章以降のために残し、テストモードの挙動は変えない。

## Rule

| | 第一章（本編、新規・旧セーブ） | テストモード（第一章後の基盤） |
| --- | --- | --- |
| 40% の出現判定・裂け目の生成・ミニマップの点 | 起きない（乱数も引かない） | 既存どおり |
| 入口・異空間の部屋・敵・クリア・報酬・ログ・帰還 | 起きない（裂け目が無い。入口の処理も同じ判定で止める） | 既存どおり |

## Implementation Plan

| Step | ファイル | 変更 |
| --- | --- | --- |
| 1 | `tests/unit/chapter1-no-anomaly.test.js`（新規） | 実物の `spawnAnomalyRiftForWorld` / `enterAnomalyRoom` を stub 付きで実行。変更前の src で FAIL を確認 |
| 2 | `src/legacy/parts/02-world-common.js` | `spawnAnomalyRiftForWorld` と `enterAnomalyRoom` の冒頭に `if(!legacyGrowth()) return;` |
| 3 | 記録 | Decision Record、`docs/PROGRESSION.md`、`core/chapter1-rules.js` のコメント |

## Files Not To Change
異空間の本体（`buildRift` / `buildAnomalyRoom` / `updateAnomalyRifts` / `grantAnomalyReward` / `exitAnomalyRoom`）、`ANOMALY_SPAWN_CHANCE`、`ANOMALY_RIFT_SPOTS`、洋館の「歪んだ洋館」区画（`core/mansion-anomaly.js` ほか。別の仕組み）、セーブ、`basefile.html`

## Test Plan
- 新規 unit を実装前に追加し、変更前の src で FAIL を確認（3 件 FAIL を確認済み）
- build / unit / `ai-protocol` / 関連 E2E（洋館・幽霊船・第一章）/ E2E 全体（2 CPU）/ GitHub Actions
- 裂け目の E2E は作らない: 出現が 40% の乱数で、食堂は CI 環境で歩いて到達できない（PROGRESSION-006 と同じ判断）

## Acceptance Criteria
- AC-N1 第一章で裂け目が生成されない（乱数に関係なく）
- AC-N2 第一章で異空間へ入る処理が動かない（部屋・敵・報酬・ログ・帰還が起きない）
- AC-N3 テストモードは既存どおり
- AC-N4 異空間の本体・出現率・場所は残る
- AC-N5 通常の第一章のダンジョン攻略に影響しない

## Agent Decisions
| # | 決定 | 根拠ソース（AGENTS.md §17.2） | 代替案 |
| --- | --- | --- | --- |
| N-1 | 第一章の判定は既存の `legacyGrowth()` | `core/chapter1-rules.js` の定義（本編 = 第一章 / 第一章後の仕組みはテストモードだけ）。PROGRESSION-001〜007 と同じ | 章の判定を新設（Human の指示で禁止） |
| N-2 | 出現（乱数より前）と入口の 2 か所で止める | 異空間の経路はすべて裂け目から始まる。入口にも置くのは処理側の二重の安全策 | 報酬・ログ・帰還の各所に判定を散らす |
| N-3 | PROGRESSION-006 の報酬ゲートは残す | Human の指示。第二章以降の安全策 | 削除 |

## Implementation Result

### Changed Files
- `src/legacy/parts/02-world-common.js`（`spawnAnomalyRiftForWorld` / `enterAnomalyRoom` の冒頭に第一章の判定）
- `src/core/chapter1-rules.js`（冒頭の一覧に「異空間 … なし」）
- `tests/unit/chapter1-no-anomaly.test.js`（新規 5 件）
- 記録: `.ai/decisions/UI-002-human-decisions.md`、`docs/PROGRESSION.md`

### Test Report
| テスト | 結果 | メモ |
| --- | --- | --- |
| Build | PASS | |
| Unit | PASS | 1633 件中 1632 PASS / 0 FAIL / 1 SKIP（既存）。新規 5 件は変更前の src で 3 件 FAIL |
| Protocol | PASS | 16 / 16 |
| 新規 E2E | なし | 裂け目は 40% の乱数で、食堂は CI 環境で歩いて到達できない（Test Plan） |
| E2E 全体（2 CPU） | 236 passed / 1 failed | FAIL は `mansion-enemies:220`（テストモードのトレーニング空間。本変更の経路外）。単独で再実行して PASS |
| GitHub Actions（`a87d0ce`） | **success** | |

## Status History
| Date | From → To | By | Note |
| --- | --- | --- | --- |
| 2026-10-05 | （新規）→ PLANNED → IMPLEMENTING | Orchestrator / Analyzer / Planner | Analysis `795fa97`、Plan + 回帰テスト `fe164df`（Agent Approval） |
| 2026-10-05 | IMPLEMENTING → TESTING → REVIEWING | Implementer / Tester | 実装 `d268059`、記録 `a87d0ce`、PR #35 |
| 2026-10-05 | REVIEWING（Reviewer PASS） | Reviewer | Round 1/3 PASS |
| 2026-10-05 | REVIEWING → DONE | Orchestrator（Completion commit） | Merge required: Human approval |

### Autonomy Metrics（PROGRESSION-008）
- Human Escalation Count: 0
- Human Decision Count: 1（この Task の起点の Human Decision）
- Auto Fix Count: 1（新規 unit の stub の調整）
- Reviewer Round Count: 1
- Test Retry Count: 1（`mansion-enemies:220` の切り分けの単独再実行）
- PR Created: Yes (#35)
