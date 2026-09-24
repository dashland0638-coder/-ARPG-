# Tasks

AI 開発タスクを管理する。運用ルール（状態遷移・Approval Gate・Task Level / Work Item Level・Scope）は
[`../AGENTS.md`](../AGENTS.md) §6 / §7 / §10 が正本。ここは命名とテンプレートだけを持つ。

## Naming

`TASK-ID.md`（例: `COMBAT-001.md` / `MAGE-003.md` / `UI-012.md`）

Work Item の計画: `TASK-ID-<ITEM>.md`（例: `CHAPTER-STRUCTURE-T1.md`）。独立した Task ではなく親 Task の一部（規則は `../AGENTS.md` §7.2）。

## Task Template

```markdown
# <ID>

Status: DRAFT

Analysis: ../reports/<ID>-analysis.md

## Human Approval
- [ ] Approved
- Approved by / date / where:
- Scope of approval:
- Persistence:（空欄 = 未許可。人間の明示的な指示があった場合だけ `許可（branch: <name>）` と根拠を書く。許可は Implementer の commit・push と、Reviewer の §7.3 の commit・push（review report・Status 更新・Status History 1行のみ）を含む）

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
| Date | Target | From → To | By | Note |
| --- | --- | --- | --- | --- |
```

Target は `Task` または Work Item の ID（`T-1` など）。
既存 Task の4列の Status History（Target 列なし）は書き換えず、そのまま残す。以後の行から5列で追記してよい。

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

### T-1 Human Approval
- [ ] Approved
- Approved by / date / where:
- Scope of approval:（この Work Item の Files To Change の範囲）
- Persistence:（空欄 = 未許可。許可は Implementer と Reviewer（§7.3 の範囲のみ）の commit・push を含む。規則は ../AGENTS.md §6）

Implementation (T-1): BLOCKED until approval
```

- Human Approval 欄は Work Item ごとに1つ。チェックと記入は人間の GO を受けて行い、AI は自分で承認しない
- 表の `Status` / `Approval` と、Work Item ごとの Approval 欄は常に一致させる
- 計画（Implementation Plan / Files To Change / Test Plan / Acceptance Criteria / Unknowns）は、
  どの Work Item のものかが分かるように Work Item ID を付けて書く

Task は「何を達成するか」を中心に書き、実装方法を決め打ちしすぎない
（具体的な手順は Planner が Implementation Plan に書く）。

`Status:` の値は AGENTS.md §7 の状態名だけを使う。
承認後は承認単位（Task または Work Item）の Status を `APPROVED` にし、その Approval 欄をチェックし、
対応する `Implementation:` 行を `ALLOWED` に変える。
