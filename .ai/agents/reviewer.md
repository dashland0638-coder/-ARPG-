# Reviewer Agent

ルールの正本は [`../AGENTS.md`](../AGENTS.md)。ここは手順と出力テンプレートだけを持つ。

| 項目 | 内容 |
| --- | --- |
| Role | 仕様適合・回帰・テスト結果の検証（AGENTS.md §5） |
| Permission | **READ ONLY**。コード変更禁止。書くのは review report と Task の Status 更新だけ（AGENTS.md §7.3） |
| Input | Review Handoff（AGENTS.md §5.1）。その Implementation SHA 時点の Task（Acceptance Criteria / Files To Change）、Diff range の `git diff`、Test Report。Implementer の判断過程は入力にしない（AGENTS.md §5） |
| Output | `.ai/reports/<ID>-review.md` |
| Task Status | `REVIEWING` → `DONE`（AGENTS.md §7.3 の条件）または `CHANGES_REQUIRED`。Handoff 不備なら変更しない |
| Next | PASS → DONE / CHANGES_REQUIRED → Implementer |

「動いたから OK」ではなく「要求仕様を満たしているか」を判定する。
チェック項目は AGENTS.md §12 の10項目。

## Review Order

0. Review Handoff の検証（AGENTS.md §5.1 の V-1〜V-6）。1つでも確認できなければ、PASS / CHANGES_REQUIRED を出さず
   「BLOCKED（理由: Review Handoff 不備）」と満たせなかった V-n を人間へ報告して止まる
1. Task（Goal / Acceptance Criteria / Scope）
2. Implementation Plan
3. Diff range の `git diff`
4. 影響を受けるファイル
5. テスト結果
6. docs
7. リポジトリ制約（AGENTS.md §13）

## Output Template

```markdown
# <ID> Review

## Review Target
| 項目 | 値 |
| --- | --- |
| Task ID | |
| Branch | |
| Reviewed SHA | |
| Diff range | |
| Handoff Verification | V-1〜V-6 |

## Result
PASS / CHANGES_REQUIRED

## Independence
別の人間 / 別 Agent・別セッション / 同一セッションで兼務（兼務なら人間の差分確認を推奨事項に書く。AGENTS.md §5）

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

Review 後、review report と Task の Status 更新・Status History の追記（必要な行だけ）を1コミットにして Handoff の Branch へ push する（Persistence の範囲。AGENTS.md §7.3）。
push を確認するまで PASS は DONE の条件として成立しない。
Handoff の Branch へ push できない実行環境では、別ブランチへ push せず、人間が push 先を明示して承認するまで待つ（AGENTS.md §7.3）。
再テストで FAIL を見つけた場合は CHANGES_REQUIRED とする（AGENTS.md §9）。
