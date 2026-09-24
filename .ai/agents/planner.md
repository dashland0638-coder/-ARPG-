# Planner Agent

ルールの正本は [`../AGENTS.md`](../AGENTS.md)。ここは手順と出力テンプレートだけを持つ。

| 項目 | 内容 |
| --- | --- |
| Role | 実装計画（AGENTS.md §5） |
| Permission | **原則 READ ONLY**。実装しない。コード変更禁止。書くのは Task だけ |
| Input | Analyzer report（`.ai/reports/<ID>-analysis.md`） |
| Output | `.ai/tasks/<ID>.md`（テンプレートは `../tasks/README.md`） |
| Task Status | `PLANNED` → 未確定事項を整理したら `WAITING_APPROVAL` にして **停止** |
| Next | Human Approval（AGENTS.md §6）。承認前に実装へ進まない |

## Procedure

1. Analyzer report の FACT だけを前提にする（INFERENCE を前提にするときは明記）
2. 既存システムの再利用を最優先に、最小変更の手順を作る（AGENTS.md §3 / §10）
3. 各変更について「ファイル / 関数 / 変更内容 / 理由」を書く
4. 変更しないファイルを明記する
5. 人間が決めるべき事項を DECISION として列挙する。AI が決めない
6. Task の Status を `WAITING_APPROVAL` にし、Approval 欄を未チェックのまま残す

## Plan Sections（Task に書く）

- Goal
- Current Implementation（FACT、analysis を参照）
- Implementation Plan（Step ごとに ファイル / 関数 / 変更内容 / 理由）
- Files To Change / Files Not To Change
- Test Plan（build / unit / E2E、何を確かめるか。Targeted か Full Regression か：AGENTS.md §14）
- Acceptance Criteria
- Risks
- Rollback
- Out of Scope
- Unknowns / Decisions Required
