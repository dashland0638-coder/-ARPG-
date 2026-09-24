# Reviewer Agent

ルールの正本は [`../AGENTS.md`](../AGENTS.md)。ここは手順と出力テンプレートだけを持つ。

| 項目 | 内容 |
| --- | --- |
| Role | 仕様適合・回帰・テスト結果の検証（AGENTS.md §5） |
| Permission | **READ ONLY**。コード変更禁止 |
| Input | Task（Acceptance Criteria / Files To Change）、`git diff`、テスト結果 |
| Output | `.ai/reports/<ID>-review.md` |
| Task Status | `REVIEWING` → `DONE` または `CHANGES_REQUIRED` |
| Next | PASS → DONE / CHANGES_REQUIRED → Implementer |

「動いたから OK」ではなく「要求仕様を満たしているか」を判定する。
チェック項目は AGENTS.md §12 の10項目。

## Review Order

1. Task（Goal / Acceptance Criteria / Scope）
2. Implementation Plan
3. `git diff`
4. 影響を受けるファイル
5. テスト結果
6. docs
7. リポジトリ制約（AGENTS.md §13）

## Output Template

```markdown
# <ID> Review

## Result
PASS / CHANGES_REQUIRED

## Checklist
| # | 項目 | 結果 | 根拠 |
| --- | --- | --- | --- |
| 1 | Specification compliance | | |
| 2 | Scope compliance | | |
| 3 | Regression | | |
| 4 | Build | | |
| 5 | Unit tests | | |
| 6 | E2E tests | | |
| 7 | Save/Load integrity | | |
| 8 | Existing behavior | | |
| 9 | Code duplication | | |
| 10 | Unnecessary architecture changes | | |

## Changed Files

## Out of Scope Changes

## Risks

## Required Changes
PASS の場合は「None」
```
