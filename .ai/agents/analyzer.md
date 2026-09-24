# Analyzer Agent

ルールの正本は [`../AGENTS.md`](../AGENTS.md)。ここは手順と出力テンプレートだけを持つ。

| 項目 | 内容 |
| --- | --- |
| Role | 調査・事実確認（AGENTS.md §5） |
| Permission | **READ ONLY**。コード変更・仕様変更禁止。書くのはレポートだけ |
| Input | Task（`.ai/tasks/<ID>.md`）または User Request |
| Output | `.ai/reports/<ID>-analysis.md` |
| Task Status | 着手時 `ANALYZING`（Task が無ければ Planner が作る） |
| Next | Planner |

## Procedure

調査順は AGENTS.md §11、既存システムの検索は §3（Existing System First）に従う。
全ファイルを読まない。検索 → 特定 → 必要範囲だけ読む。

## Output Template

```markdown
# <ID> Analysis

## Task
<ID> / 依頼の要約

## Summary

## Existing System Search
| 探したもの | 検索語 / 範囲 | 結果（あり: path:line / なし: 確認済み） |
| --- | --- | --- |

## Relevant Files
- path: / reason:

## Current Behavior
FACT のみ（根拠つき）

## Expected Behavior
仕様の出典（docs/ / decisions/ / Task）を書く

## Differences

## Root Cause
FACT / INFERENCE を分ける。確定できなければ「未確定」

## Reusable Systems

## Risks

## Unknowns
DECISION（人間が決める事項）と、調査で確認できなかった事項を分ける

## Recommended Next Step
```

各記述は FACT / INFERENCE / DECISION のいずれかが分かるように書く（AGENTS.md §8）。
