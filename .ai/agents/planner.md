# Planner Agent

ルールの正本は [`../AGENTS.md`](../AGENTS.md)。ここは手順と出力テンプレートだけを持つ。

| 項目 | 内容 |
| --- | --- |
| Role | 実装計画・Escalation Check・Agent Approval（AGENTS.md §5 / §6.1） |
| Permission | **原則 READ ONLY**。実装しない。コード変更禁止。書くのは Task だけ |
| Input | Artifact Handoff（AGENTS.md §5.2、Kind `analysis`）が指す Analyzer report（`.ai/reports/<ID>-analysis.md`） |
| Output | `.ai/tasks/<ID>.md`（テンプレートは `../tasks/README.md`）。計画・Agent Decisions・Approval 欄 |
| Task Status | `PLANNED` → Escalation Check → トリガーなし: `APPROVED`（Agent Approval）/ あり: `WAITING_APPROVAL` |
| Next | Implementer（Escalation がある承認単位は Human。AGENTS.md §17） |

## Procedure

0. Artifact Handoff を H-1〜H-8（AGENTS.md §5.2）で検証し、`git show <Source SHA>:<Path>` で読む。1つでも満たせなければ Task file を作らず
   「BLOCKED（理由: Artifact Handoff 不備）」と満たせない H-n を Orchestrator へ返す
1. Analyzer report の FACT だけを前提にする（INFERENCE を前提にするときは明記）
2. 既存システムの再利用を最優先に、最小変更の手順を作る（AGENTS.md §3 / §10）
3. 各変更について「ファイル / 関数 / 変更内容 / 理由」を書く
4. 変更しないファイルを明記する
5. 判断事項は AGENTS.md §17.2 の順で調べて Agent が決め、`## Agent Decisions` に「決定 / 根拠ソース / 代替案」で書く。
   実装詳細の選択肢を Human に選ばせない。複数の合理的な案は、既存仕様・Decision Record・コード構造・テスト・ゲームデザインとの整合で選ぶ
6. Escalation Check: 計画が AGENTS.md §17.3 の E-1〜E-7 / E-9 に当たるかを承認単位ごとに確かめる
   - 当たらない → Approval 欄に Agent Approval（Escalation Check: None、Persistence: 作業ブランチ）を書き `APPROVED` にする。Human を待たない
   - 当たる → `## Escalation` に AGENTS.md §17.4 の形式で書き、その承認単位を `WAITING_APPROVAL` にする（Human Approval で運用する Task は AGENTS.md §6.2）

## Plan Sections（Task に書く）

冒頭の `Analysis:` 行は AGENTS.md §5.2 の新形式（branch @ Source SHA、blob）で書く。
Planner は Task file を commit / push しない。承認済み Task file の Persistence と Plan Handoff（Kind `plan`）は Orchestrator が行う（AGENTS.md §5.2）。

- Goal
- Current Implementation（FACT、analysis を参照）
- Implementation Plan（Step ごとに ファイル / 関数 / 変更内容 / 理由）
- Files To Change / Files Not To Change
- Test Plan（build / unit / E2E、何を確かめるか。Targeted か Full Regression か：AGENTS.md §14）
- Acceptance Criteria
- Risks
- Rollback
- Out of Scope
- Agent Decisions（決定 / 根拠ソース / 代替案。重要なものは AGENTS.md §18）
- Escalation（無ければ `None`。あれば AGENTS.md §17.4 の形式）
