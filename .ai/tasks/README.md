# Tasks

AI 開発タスクを管理する。Task は「Human から与えられた Goal を Agent が完遂する単位」であり、
Human が手順を細かく指示するものではない（`../AGENTS.md` §0）。

運用ルール（状態遷移・Approval Gate・Task Level / Work Item Level・Scope）は
[`../AGENTS.md`](../AGENTS.md) §6 / §7 / §10 が正本。ここは命名とテンプレートだけを持つ。

## Naming

`TASK-ID.md`（例: `COMBAT-001.md` / `MAGE-003.md` / `UI-012.md`）

Work Item の計画: `TASK-ID-<ITEM>.md`（例: `CHAPTER-STRUCTURE-T1.md`）。独立した Task ではなく親 Task の一部（規則は `../AGENTS.md` §7.2）。

## Task Template

```markdown
# <ID>

Status: DRAFT

Analysis: .ai/reports/<ID>-analysis.md（branch `<Source Branch>` @ `<Source SHA>`、blob `<Blob SHA>`）

## Approval
- [ ] Approved
- Approval type: Agent Approval / Human Approval（`../AGENTS.md` §6）
- Escalation Check: None（または `E-x: ## Escalation 参照`。§17.3）
- Approved by / date / where:（Agent Approval は `Planner (Agent) / <date> / <session or branch>`）
- Scope of approval:
- Persistence:（Agent Approval は `許可（branch: <作業ブランチ>、根拠: <割当の出所>）`。§6.1。Human Approval は人間の明示的な指示があった場合だけ書く。§6.2）

Implementation: BLOCKED until approval

## Goal
Human の Goal（WHAT）をそのまま書く

## Request

## Constraints

## Current Implementation

## Implementation Plan

## Files To Change

## Files Not To Change

## Test Plan

## Acceptance Criteria

## Risks

## Rollback

## Out of Scope

## Agent Decisions
| # | 決定 | 根拠ソース（AGENTS.md §17.2） | 代替案 |
| --- | --- | --- | --- |

## Escalation
None（あれば `../AGENTS.md` §17.4 の形式）

## Autonomy Metrics
（完了処理で記入。`../AGENTS.md` §22。推測で埋めない）
- Human Escalation Count:
- Human Decision Count:
- Auto Fix Count:
- Reviewer Round Count:
- Test Retry Count:
- PR Created:

## Status History
| Date | Target | From → To | By | Note |
| --- | --- | --- | --- | --- |
```

`Analysis:` 行の書式と検証は `../AGENTS.md` §5.2（Artifact Handoff）。Work Items 表の `Analysis` 列も同じ書式で書いてよい。
blob の無い既存 Task の `Analysis:` 行は旧形式として書き換えない。

Target は `Task` または Work Item の ID（`T-1` など）。
既存 Task の4列の Status History（Target 列なし）は書き換えず、そのまま残す。以後の行から5列で追記してよい。
By 列は役割名（`Orchestrator` / `Planner (Agent Approval)` / `Reviewer` / `Human` 等）。Review Fix Loop・Debugger のループ回数は Note に `Round n/3` / `Cycle n/3` と書く。

既存 Task の `## Human Approval` 欄・`## Unknowns / Decisions Required` 節は書き換えない（旧形式。読み替えは `../AGENTS.md` §0 / §8）。

`Persistence` 行の規則は `../AGENTS.md` §6、`TESTING → REVIEWING` / `REVIEWING → DONE` の条件は §7.3。
Persistence 行が無い既存 Task の Approval 欄は書き換えない（未許可として扱う）。

## Work Items（1つの Task に複数の作業項目がある場合）

Work Item を持つ Task では、上のテンプレートの `Status:` は Task Level の値
（`DRAFT` / `ANALYZING` / `PLANNED` / `DONE` / `BLOCKED`）だけを使い、
冒頭の `## Human Approval` / `Implementation:` の代わりに次の2つを置く。

```markdown
## Work Items

| ID | Summary | Status | Approval | Analysis |
| --- | --- | --- | --- | --- |
| T-1 | … | WAITING_APPROVAL | [ ] | ../reports/<ID>-T1-analysis.md |
| T-2 | … | DRAFT | [ ] | ../reports/<ID>-analysis.md |

### T-1 Approval
- [ ] Approved
- Approval type: Agent Approval / Human Approval
- Escalation Check: None
- Approved by / date / where:
- Scope of approval:（この Work Item の Files To Change の範囲）
- Persistence:（規則は ../AGENTS.md §6.1 / §6.2）

Implementation (T-1): BLOCKED until approval
```

- Approval 欄は Work Item ごとに1つ。Agent Approval は Planner が Escalation Check の結果つきで記入する。Human Approval（§6.2）は人間の GO を受けて記入する
- 表の `Status` / `Approval` と、Work Item ごとの Approval 欄は常に一致させる
- 計画（Implementation Plan / Files To Change / Test Plan / Acceptance Criteria / Agent Decisions / Escalation）は、
  どの Work Item のものかが分かるように Work Item ID を付けて書く

Task は「何を達成するか」を中心に書き、実装方法を決め打ちしすぎない
（具体的な手順は Planner が Implementation Plan に書く）。

`Status:` の値は AGENTS.md §7 の状態名だけを使う。
承認後は承認単位（Task または Work Item）の Status を `APPROVED` にし、その Approval 欄をチェックし、
対応する `Implementation:` 行を `ALLOWED` に変える。
