# AGENT-PROTOCOL-2

Status: APPROVED

Analysis: .ai/reports/AGENT-PROTOCOL-2-analysis.md（branch `claude/agent-autonomous-execution-ewtk87` @ `79a1c31a7bb3a348497625e77ed9f7caa5e00004`、blob `734200d10d48c40eeb1691bea61f95dd4adfee24`）

## Approval
- [x] Approved
- Approval type: Agent Approval（`.ai/AGENTS.md` §6.1。Human は Goal と要件を指示し、追加承認を待たずに進めるよう指示）
- Escalation Check: None（ゲーム仕様・ゲームコードの変更なし。Human が要件を明示）
- Approved by / date / where: Planner (Agent) / 2026-10-01 / branch `claude/agent-autonomous-execution-ewtk87`
- Scope of approval: 下記 Files To Change
- Persistence: 許可（branch: `claude/agent-autonomous-execution-ewtk87`、根拠: セッション割当の開発ブランチ）

Implementation: ALLOWED

## Goal

Agent Autonomous Execution + Human Escalation を正式な開発プロトコル（Agent Protocol 2.0）とし、Agent の Definition of Done を「Goal を完遂し Commit / Push / PR 作成まで」へ拡張する。`main` への merge は Human の責任として残す。

## Implementation Plan

| Step | ファイル | 変更 |
| --- | --- | --- |
| 1 | `.ai/AGENTS.md` | §0 を Agent Protocol 2.0 に、§4 のフローに Commit / Push / PR と Human の merge 判断を追加、§5 の Orchestrator の責務、§6.1 の PR の行、§7 の状態表（REVIEWING / DONE）、§7.3 の DONE 条件に PR と Autonomy Metrics と Completion commit、§17.1 / §19 に「確認を返さない」と最終報告の必須項目、E-10 に PR 作成の権限外障害、新 §20（DoD 13 項目・責任境界・PR 失敗時）・§21（PR）・§22（Autonomy Metrics） |
| 2 | `.ai/agents/orchestrator.md` | 完了処理（push 確認・PR 作成 / 更新・Completion commit・merge しない）、Autonomy Metrics / PR 本文 / 最終報告のテンプレート |
| 3 | `.ai/agents/reviewer.md` | PASS でも Status は `REVIEWING` のまま（DONE は Orchestrator） |
| 4 | `.ai/tasks/README.md` | Task テンプレートに Autonomy Metrics |
| 5 | `CLAUDE.md` | 入口に DoD と merge しないことを追加 |
| 6 | `.ai/decisions/DEC-003-agent-protocol-2.md` | Human の指示の記録 |
| 7 | `tests/unit/ai-protocol.test.js` | 2.0 の検証 6 件（フロー・DoD・Commit / Push の責務・PR 本文・Autonomy Metrics・最終報告と確認を返さないこと）。既存 9 件と重複させない |
| 8 | `.ai/tasks/UI-002-D.md` | 同じブランチで完遂した WI-D2〜D4 の Autonomy Metrics と PR 番号の追記（Completion commit、§20 の適用範囲） |

## Files To Change
上の表のファイル、`.ai/tasks/AGENT-PROTOCOL-2.md`、`.ai/reports/AGENT-PROTOCOL-2-*.md`

## Files Not To Change
ゲームコード（`src/`・`index.html`）、既存の E2E、既存の Decision Record の本文、既存 Task の Approval 欄・Status History の既存行

## Test Plan
- `npm run build` / `npm run test:unit`（`ai-protocol.test.js` を含む）
- `npm test`（E2E 全体。ゲームコードの変更は無いが、このブランチの PR に含まれる WI-D2〜D4 の変更を含めて全体回帰を確認する）

## Acceptance Criteria
- AC-1 標準フローが Goal → … → Reviewer → Commit → Push → PR → DONE、Human は PR 確認 → merge 判断
- AC-2 Reviewer FAIL の自動差し戻し・上限・Escalation 条件は維持（既存テスト）
- AC-3 DoD に PR 作成が含まれ、`main` への merge が含まれない
- AC-4 Commit / Push / PR の責任が Orchestrator、Agent は merge しない
- AC-5 Autonomy Metrics の 6 項目、PR 本文・最終報告の必須項目が定義されている
- AC-6 状態名を増やさない。既存のテストが通る

## Agent Decisions
| # | 決定 | 根拠ソース（AGENTS.md §17.2） | 代替案 |
| --- | --- | --- | --- |
| A-1 | Reviewer PASS 後、PR 作成までは `REVIEWING` のまま。Orchestrator の Completion commit（Status・Status History・Autonomy Metrics・PR 番号だけ）で DONE にする | §7.3「Status は増やさない」、Human の指示「状態名を不用意に増やさない」、WI-D1 の `REVIEWING（Reviewer PASS）` の前例 | `PR_OPEN` 等の新状態（指示に反する）/ Reviewer が DONE にして PR を後付け（DoD と DONE がずれる） |
| A-2 | 作業ブランチ 1 本につき PR 1 つ。同じブランチで続けて完遂した Work Item は既存の PR の本文を更新する | AD-003（セッション割当の 1 ブランチで複数 Work Item を進める運用）、GitHub の PR は head ブランチ単位 | Work Item ごとにブランチを分ける（実行環境の push 制限に反する） |
| A-3 | Human Decision Count は「Work Item の実行中に Human が下した判断」とし、Goal の指示そのものと、移行前に記録済みの Human Decision は数えない | §22 の定義（指示「推測で埋めない」に合わせ、記録から数えられる定義にする） | 過去の HD を含める（Work Item の実行と無関係な判断が混ざる） |

## Escalation
None

## Status History
| Date | Target | From → To | By | Note |
| --- | --- | --- | --- | --- |
| 2026-10-01 | Task | DRAFT → ANALYZING → PLANNED → APPROVED | Orchestrator / Analyzer / Planner (Agent Approval) | Analysis `79a1c31`。Branch `claude/agent-autonomous-execution-ewtk87` |
