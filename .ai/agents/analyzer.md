# Analyzer Agent

ルールの正本は [`../AGENTS.md`](../AGENTS.md)。ここは手順と出力テンプレートだけを持つ。

| 項目 | 内容 |
| --- | --- |
| Role | 調査・事実確認（AGENTS.md §5） |
| Permission | **READ ONLY**。コード変更・仕様変更禁止。書くのはレポートだけ |
| Input | Task（`.ai/tasks/<ID>.md`）または User Request |
| Output | `.ai/reports/<ID>-analysis.md`、Artifact Handoff（AGENTS.md §5.2） |
| Task Status | 着手時 `ANALYZING`（Task が無ければ Planner が作る） |
| Next | Planner |

## Procedure

調査順は AGENTS.md §11、既存システムの検索は §3（Existing System First）に従う。
全ファイルを読まない。検索 → 特定 → 必要範囲だけ読む。

report を書き終えたら停止する。report の remote への Persistence は人間が行う（AGENTS.md §5.2 / §6）。
Persistence 前の Handoff は `Source SHA` / `Blob SHA` を空欄にした「Handoff 未成立」として人間へ渡し、人間が push 後に埋めて Planner へ渡す。

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

## Artifact Handoff Template（会話などで次の段へ渡す。report には書かない）

項目の定義と検証（H-1〜H-8）は AGENTS.md §5.2。Kind `plan`（承認済み Task file を Implementer へ渡す）も同じ書式。

```text
Artifact Handoff
- Task ID: <ID>（/ T-n）
- Kind: analysis
- Source Branch: <branch>
- Source SHA: <40桁>（Persistence 前は空欄 = Handoff 未成立）
- Path: .ai/reports/<ID>-analysis.md
- Blob SHA: <git rev-parse <Source SHA>:<Path> の40桁>（同上）
- Persisted by: Human
```
