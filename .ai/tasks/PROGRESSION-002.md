# PROGRESSION-002

Status: DONE

Analysis: .ai/reports/PROGRESSION-002-analysis.md（branch `claude/agent-autonomous-execution-ewtk87` @ `4c0dc37ff42d93bfa9d3e9cb201e11551416283a`、blob `09dab53a8ff8a4d84f22cbace3ccda864a641e6f`）

## Approval
- [x] Approved
- Approval type: Agent Approval（`../AGENTS.md` §6.1。仕様は Human Decision 済み）
- Escalation Check: None（E-1: Human Decision どおり / E-2: 矛盾なし / E-3: 新しい仕様なし / E-4: セーブは消さない / E-6・E-7・E-9: 該当なし）
- Approved by / date / where: Planner (Agent) / 2026-10-02 / branch `claude/agent-autonomous-execution-ewtk87`
- Scope of approval: 下の Files To Change
- Persistence: 許可（branch: `claude/agent-autonomous-execution-ewtk87`、根拠: セッション割当の開発ブランチ。AD-003）。PR は #32 を更新する（AGENTS.md §21）

Implementation: ALLOWED

## Goal

旧セーブ互換の残課題として、「仲間を雇う」状態が第一章本編へ持ち越される可能性を調査し、既に決定済みの第一章仕様に従って修正する（Human、2026-10-02）。

Human Decision: 第一章本編では、旧セーブに保存されている「仲間を雇う」状態を戦闘・同行へ反映しない。第一章の正式なキャラクター加入・同行進行は既存仕様のまま。

## Implementation Plan

| Step | ファイル | 変更 |
| --- | --- | --- |
| 1 | `src/legacy/parts/08-loot-equipment.js` | `syncAlliesToState()` の雇った仲間の生成条件に `legacyGrowth()` を足す。正式な支援 AI（`guestClassKey`）はそのまま |
| 2 | `tests/unit/chapter1-growth-effects.test.js` | legacy の構造: 雇った仲間の生成が `legacyGrowth()` を通ること・支援 AI の生成が雇用状態に依存しないこと（変更前の src で FAIL） |
| 3 | `tests/chapter1-old-save-growth.spec.js` | 旧セーブ（雇用なし / あり）を本編で続きから始め、ミニマップの雇った仲間の点（`#8ae0c0`）が無いこと・正式な支援 AI の点（`#ffd27a`）は両方で同じこと・セーブし直しても `skills.companion` が残ること（変更前の src で FAIL） |

## Files To Change
上の表のファイルと `.ai/` の記録（本 Task file、review report）

## Files Not To Change
`basefile.html`、セーブの読み書き（`09-save-load.js`）、`buildCompanion` / `updateCompanion`、鑑定所の購入経路（テストモードで使う）、第一章の加入・同行の進行（`chapter1GuestKey`・加入の一幕・道の出会い）、既存の spec・assertion

## Test Plan
- build / unit 全体 / `ai-protocol`
- 新規 unit・E2E が変更前の src で FAIL し、変更後に PASS
- 関連 E2E（2 CPU）: `chapter1-*`、`guest-companion`、`tavern-*`、`shadow-*`、`dusk*`、`mansion-*`、`save-load`、`combat-test-arena`、`look-*` 等の同行者・進行・テストモードを扱う spec（E2E 全体で確認）

## Acceptance Criteria
- AC-Q1 旧セーブに雇用状態なし → 従来どおり（同行者は正式な支援 AI だけ）
- AC-Q2 旧セーブに雇用状態あり → 本編では雇った仲間が同行しない（生成されない）
- AC-Q3 第一章の正式な加入・同行の進行は従来どおり（支援 AI の生成条件は不変）
- AC-Q4 テストモードでは従来どおり（購入すれば同行する）
- AC-Q5 セーブの `skills.companion` は残る

## Risks
- 旧セーブで雇った仲間に慣れたプレイヤーには、本編で仲間がいなくなる（Human Decision どおり）

## Rollback
PROGRESSION-002 の実装 commit を revert する

## Out of Scope
- Chapter 2 での雇った仲間の扱い（未決定。判定は PROGRESSION-001 と同じ `legacyGrowth()`）
- 雇った仲間の購入 UI（本編では既に出ない）

## Agent Decisions
| # | 決定 | 根拠ソース（AGENTS.md §17.2） | 代替案 |
| --- | --- | --- | --- |
| Q-1 | `syncAlliesToState()` の生成条件だけを変える | 同行者の生成はすべてこの関数を通る（開始・再開・加入の一幕・道の出会い）。購入の直後に生成する経路は本編では出ない画面にしか無い | `buildCompanion` や `updateCompanion` で止める（テストモードの購入経路まで影響する） |
| Q-2 | 判定は `legacyGrowth()` | PROGRESSION-001・WORK 12.1 と同じ「本編では旧成長系を使わない」判定 | 別の判定を新設する（Chapter 2 の扱いを先に決めることになる） |
| Q-3 | E2E の観測はミニマップの点の色 | 本編で見える既存の表示。テスト用の hook を足さない | `window` へ同行者を出す（src の変更が増える） |

## Implementation Result

### Changed Files
- `src/legacy/parts/08-loot-equipment.js`（`syncAlliesToState()` の雇った仲間の生成条件に `legacyGrowth()`）
- `tests/unit/chapter1-growth-effects.test.js`（1 件追加）、`tests/chapter1-old-save-growth.spec.js`（3 件追加）

### Test Report
- Scope: Full（E2E 全体を 2 CPU = CI 相当で実行）

| テスト | 結果 | メモ |
| --- | --- | --- |
| Build | PASS | |
| Unit | PASS | 1617 件中 1616 PASS / 0 FAIL / 1 SKIP（既存）。新規 1 件は変更前の src で FAIL |
| Protocol | PASS | 16 / 16 |
| 新規 E2E（変更前の src） | 2 FAIL / 1 PASS（期待どおり） | 雇用状態ありの 2 件で雇った仲間の点が出る。雇用状態なしは従来どおり PASS |
| 新規 E2E（変更後） | 3 / 3 PASS | ケース 1〜3（雇用なし・雇用あり・正式な同行） |
| E2E 全体（2 CPU） | **224 passed / 1 flaky** | flaky は `job-traits:162`（テストモード、既存の `retries: 2`）。今回の変更とは無関係（review report） |
| GitHub Actions（`1a50970`） | **success** | |

### Human 指定のテストケース
| # | ケース | 確認 |
| --- | --- | --- |
| 1 | 旧セーブに雇用状態なし → 従来どおり | E2E「雇用状態なしの旧セーブ」 |
| 2 | 旧セーブに雇用状態あり → 本編では同行しない | E2E「雇用状態ありの旧セーブ」（変更前は FAIL）。セーブの値は残る |
| 3 | 正式な第一章の加入進行 → 従来どおり | E2E「洋館クリア後: 魔法使い＋支援の剣士」（雇用状態あり、変更前は FAIL）、既存の `chapter1-progression` |
| 4 | テストモード等 → Regression なし | unit（条件式）、E2E 全体のテストモードの spec（`combat-test-arena`・`job-traits`・`hud-zones-layout` 等） |

## Status History
| Date | From → To | By | Note |
| --- | --- | --- | --- |
| 2026-10-02 | （新規）→ PLANNED → IMPLEMENTING | Orchestrator / Analyzer / Planner | Analysis `4c0dc37`、Plan `b5a6d5b`（Agent Approval。仕様は Human Decision） |
| 2026-10-03 | IMPLEMENTING → TESTING → REVIEWING | Implementer / Tester | Implementation `1a50970` |
| 2026-10-03 | REVIEWING（Reviewer PASS） | Reviewer | Round 1/3 PASS |
| 2026-10-03 | REVIEWING → DONE | Orchestrator（Completion commit） | PR #32 の本文を更新。Merge required: Human approval |

### Autonomy Metrics（PROGRESSION-002）
- Human Escalation Count: 0
- Human Decision Count: 1（この Task の起点の Human Decision。作業中の確認はなし）
- Auto Fix Count: 0
- Reviewer Round Count: 1
- Test Retry Count: 0（Agent による再実行なし。`job-traits:162` は spec に設定済みの retry で PASS = flaky として記録）
- PR Created: Yes (#32。同じブランチの既存 PR の本文を更新。AGENTS.md §21)

