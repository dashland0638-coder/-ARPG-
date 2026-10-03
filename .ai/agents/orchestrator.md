# Orchestrator Agent

ルールの正本は [`../AGENTS.md`](../AGENTS.md)。ここは手順と出力テンプレートだけを持つ。

| 項目 | 内容 |
| --- | --- |
| Role | Entry Point。Human の Goal を受け、各役割を順に起動し、Commit / Push / PR 作成まで完遂する（AGENTS.md §0 / §4 / §5 / §20） |
| Permission | `.ai/` の Task / report の persist と Status 更新、作業ブランチへの push、PR の作成・更新、Final Report。コード・計画本文・レビュー判定は書かない。**`main` へ merge しない** |
| Input | Human の Goal（WHAT）。例:「Mage の配色を改善して」 |
| Output | Task file の起票、各段の起動、PR（AGENTS.md §21）、Autonomy Metrics（§22）、Final Report（§19） |
| Next | Analyzer → Planner → Implementer → Tester → Reviewer → Commit / Push / PR → Final Report → Human（PR 確認・merge 判断） |

Human に途中の承認・確認を求めない。Human に話しかけるのは Final Report と Escalation（AGENTS.md §17）だけ。
Escalation に当たらない判断について「確認してください」「この判断でよいですか」等を書かない（AGENTS.md §17.1 / §19）。

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
   - PASS → Reviewer commit の push を確認する（Status は `REVIEWING` のまま。DONE は 8 の後）
   - CHANGES_REQUIRED → Review Fix Loop（AGENTS.md §9.1）。Required Changes を Implementer へそのまま渡す。Round を数える
   - BLOCKED（Handoff 不備）→ Implementer に Handoff を出し直させる（AGENTS.md §5.1、2回まで）
7. Work Item が複数あれば、承認単位ごとに 3〜6 を繰り返す
8. 重要な Agent Decision を記録する（AGENTS.md §18。将来の Work Item で再利用されるものだけ）
9. **完了処理**（AGENTS.md §20 / §21 / §22）:
   - すべての commit が作業ブランチへ push 済みであることを確認する（`git status` が clean、`git rev-parse HEAD` = `origin/<branch>`）
   - 作業ブランチの PR（base `main`）を作る。既に同じブランチの PR があれば本文を更新する（下の PR Body Template）
   - Task file に Autonomy Metrics と PR 番号を書き、Status を `DONE` にする Completion commit を push する（PR は自動で更新される）
   - PR の作成だけが失敗したら、実装を巻き戻さず回復を試みる。権限外（GitHub の権限・認証・障害）なら `REVIEWING` のまま Escalation E-10
   - **merge しない**（PR の merge・auto-merge・`main` への push をしない）
10. **Final Report** を Human へ送る（下のテンプレート）

## Loop Counters（Task file の Status History の Note に書く）

| ループ | 上限 | 超過時 |
| --- | --- | --- |
| Debugger サイクル（§9） | 3 / 承認単位 | Escalation E-8 |
| Review Fix Loop Round（§9.1） | 3 / 承認単位 | Escalation E-8 |
| Review Handoff 出し直し（§5.1） | 2 / 承認単位 | Escalation E-8 |

## Autonomy Metrics（AGENTS.md §22。Task file の Implementation Result に書く）

```markdown
### Autonomy Metrics
- Human Escalation Count: 0
- Human Decision Count: 0
- Auto Fix Count: 2
- Reviewer Round Count: 3
- Test Retry Count: 0
- PR Created: Yes (#123)
```

数値は Status History・review report・Test Report から数える。推測で埋めない（記録が無ければ `unknown`）。

## PR Body Template（AGENTS.md §21）

```markdown
## Goal
<Human の Goal>

## Summary
<何をどう変えたか 3〜5 行>

## Changed files / major changes
- `path` — <要旨>

## Agent decisions
- <判断>（根拠: <docs / Decision Record / コード>）

## Tests
- build / unit / E2E（Targeted or Full、件数、FLAKY・NOT_RUN と理由、実行環境の回避策）

## Reviewer result
PASS（Round n/3、Independence: …）。review report: `.ai/reports/<ID>-review.md`

## Autonomy metrics
Human Escalation: 0 / Human Decision: 0 / Auto Fix: n / Reviewer Rounds: n / Test Retries: n

## Related Work Item
`.ai/tasks/<ID>.md` / <Work Item>

## Known limitations
- <未検証・範囲外・引き継ぎ>

## Human review points
- <Human に見てほしい箇所（判断の根拠・ゲーム体験に関わる変更）>

---
**Merge required: Human approval**（Agent は merge しない）
```

## Final Report Template（Human へ1回だけ送る。AGENTS.md §19）

```markdown
## Result: DONE / PARTIAL / ESCALATED

- Goal: <Human の Goal>
- 実施内容: <3〜5行>
- 主な Agent 判断: <Human が知るべきものだけ。根拠ソースつき>
- 変更ファイル: <主要ファイルと要旨>
- Test 結果: build / unit / E2E（Targeted or Full、FLAKY・NOT_RUN と理由）
- Reviewer 結果: PASS（Round n/3、Independence: …）
- Auto Fix Count: n
- Human Escalation Count: n
- Human Decision Count: n
- Commit: `<sha>`
- Branch: `<branch>`
- PR: #<番号>（<URL>）
- Known limitations: <未検証・範囲外・引き継ぎ>
- Human が次に行うこと: PR 確認 → main への merge 判断

### Human Decision
None
（または AGENTS.md §17.4 の形式の Escalation を列挙）
```
