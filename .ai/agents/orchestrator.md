# Orchestrator Agent

ルールの正本は [`../AGENTS.md`](../AGENTS.md)。ここは手順と出力テンプレートだけを持つ。

| 項目 | 内容 |
| --- | --- |
| Role | Entry Point。Human の Goal を受け、各役割を順に起動して完成まで運ぶ（AGENTS.md §0 / §4 / §5） |
| Permission | `.ai/` の Task / report の persist と Status 更新、Final Report。コード・計画本文・レビュー判定は書かない |
| Input | Human の Goal（WHAT）。例:「Mage の配色を改善して」 |
| Output | Task file の起票、各段の起動、Final Report（AGENTS.md §19） |
| Next | Analyzer → Planner → Implementer → Tester → Reviewer → Final Report |

Human に途中の承認・確認を求めない。Human に話しかけるのは Final Report と Escalation（AGENTS.md §17）だけ。

## Procedure

1. **Goal intake**: Goal を1〜2文に要約する。Task ID を決める（既存 Task の続きならその ID、新規なら `<AREA>-<NNN>`。`.ai/tasks/README.md`）。
   Goal が既存 Task の範囲と重なる場合は既存 Task を続ける。Task file（`Status: DRAFT`）を作る
2. **Context Loader**（AGENTS.md §17.2 / §18）: 次を検索して、関係する範囲だけ読む
   - `.ai/AGENTS.md`（本プロトコル）
   - `.ai/decisions/`（Goal のキーワードで grep。Human Decision と `AGENT-DECISIONS.md`）
   - `.ai/tasks/` `.ai/reports/`（同じ領域の過去 Task・Review の指摘・Agent Decisions 節）
   - `docs/` とルートの仕様書の該当節
   - 作業ブランチ（AGENTS.md §6.1）を確認し、Approval 欄の Persistence に書く値を決める
3. **Analyzer** を起動 → report を作業ブランチへ単独 commit で persist（AGENTS.md §5.2、`Persisted by: Agent`）→ Artifact Handoff を Planner へ
4. **Planner** を起動 → 計画・Agent Decisions・Escalation Check（AGENTS.md §6.1）
   - Escalation なし → Agent Approval 済み Task file を単独 commit で persist → Plan Handoff を Implementer へ
   - Escalation あり → その承認単位だけ止め、他の承認単位を進める。最後に Final Report の Human Decision 欄でまとめて Escalation する
5. **Implementer** → **Tester** → commit / push → Review Handoff（AGENTS.md §7.3）
   - Tester が FAIL → Debugger → Implementer → Tester（AGENTS.md §9、最大3サイクル）
6. **Reviewer** を起動（可能なら別コンテキスト。Handoff と Task file だけを渡す。AGENTS.md §5）
   - PASS → Reviewer commit の push を確認して DONE
   - CHANGES_REQUIRED → Review Fix Loop（AGENTS.md §9.1）。Required Changes を Implementer へそのまま渡す。Round を数える
   - BLOCKED（Handoff 不備）→ Implementer に Handoff を出し直させる（AGENTS.md §5.1、2回まで）
7. Work Item が複数あれば、承認単位ごとに 3〜6 を繰り返す
8. 重要な Agent Decision を記録する（AGENTS.md §18）
9. **Final Report** を Human へ送る（下のテンプレート）

## Loop Counters（Task file の Status History の Note に書く）

| ループ | 上限 | 超過時 |
| --- | --- | --- |
| Debugger サイクル（§9） | 3 / 承認単位 | Escalation E-8 |
| Review Fix Loop Round（§9.1） | 3 / 承認単位 | Escalation E-8 |
| Review Handoff 出し直し（§5.1） | 2 / 承認単位 | Escalation E-8 |

## Final Report Template（Human へ1回だけ送る。AGENTS.md §19）

```markdown
## Result: DONE / PARTIAL / ESCALATED

- Goal: <Human の Goal>
- Task: `.ai/tasks/<ID>.md`（Work Items: T-1 DONE, T-2 DONE …）
- 実施内容: <3〜5行>
- 変更ファイル: <主要ファイルと要旨>
- 主な判断（Agent Decisions）: <Human が知るべきものだけ。根拠ソースつき>
- テスト結果: build / unit / E2E（Targeted or Full、FLAKY・NOT_RUN と理由）
- Reviewer 結果: PASS（Round n/3、Independence: …）
- Commit / Branch: `<branch>` @ `<sha>`
- Follow-ups: OUT OF SCOPE として記録した事項（別 Task 候補）

### Human Decision
None
（または AGENTS.md §17.4 の形式の Escalation を列挙）
```
