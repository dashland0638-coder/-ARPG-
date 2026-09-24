# Tasks

AI 開発タスクを管理する。運用ルール（状態遷移・Approval Gate・Scope）は
[`../AGENTS.md`](../AGENTS.md) §6 / §7 / §10 が正本。ここは命名とテンプレートだけを持つ。

## Naming

`TASK-ID.md`（例: `COMBAT-001.md` / `MAGE-003.md` / `UI-012.md`）

## Task Template

```markdown
# <ID>

Status: DRAFT

Analysis: ../reports/<ID>-analysis.md

## Human Approval
- [ ] Approved
- Approved by / date / where:
- Scope of approval:

Implementation: BLOCKED until approval

## Request

## Goal

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

## Unknowns / Decisions Required

## Status History
| Date | From → To | By | Note |
| --- | --- | --- | --- |
```

Task は「何を達成するか」を中心に書き、実装方法を決め打ちしすぎない
（具体的な手順は Planner が Implementation Plan に書く）。

`Status:` の値は AGENTS.md §7 の状態名だけを使う。
承認後は `Status: APPROVED`、Approval 欄をチェックし、`Implementation:` 行を `ALLOWED` に変える。
