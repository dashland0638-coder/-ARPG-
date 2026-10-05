# Decision

## ID

DEC-003

## Date

2026-10-01

## Source

Human の指示（Claude Code セッション、2026-10-01「Agent Protocol 2.0 への移行」）。
前提とした実績: UI-002-D の WI-D2 / WI-D3 / WI-D4 を Human Escalation 0・Human Decision 0 で完遂（`.ai/tasks/UI-002-D.md` の Autonomy Metrics）。

## Decision

DEC-002 の Autonomous Execution + Human Escalation を、一時的な運用ではなく正式な開発プロトコル **Agent Protocol 2.0** とする。

1. Agent の Definition of Done を「Reviewer PASS まで」から「Human の Goal を完遂し、Commit / Push / PR 作成まで行う」へ拡張する（13 項目。`.ai/AGENTS.md` §20）
2. PR 作成まで完了した時点で Agent 側の Work Item を DONE とする。**`main` への merge は DONE に含めず、Human の明示的な判断とする**。Agent は merge しない
3. 責任境界: Agent = Goal → Context Loading → Analyzer → Planner → Implementer → Tester → Reviewer →（自動修正）→ PASS → Commit → Push → PR 作成 → 完了報告 / Human = PR 確認 → merge 判断
4. Human は Goal・ゲーム仕様と大きな設計方針・Escalation への回答・PR 確認・merge 判断だけを担う。各工程の開始・計画の承認・テスト・レビュー・FAIL への修正・Commit・Push・PR 作成を逐次指示しない
5. PR は Reviewer PASS と必要なテストの後に Orchestrator が作成し、本文に Goal / Summary / Changed files / Agent decisions / Tests / Reviewer result / Auto-fix count / Human Escalation count / Related Work Item / Known limitations / Human review points と `Merge required: Human approval` を書く（§21）
6. Work Item ごとに Autonomy Metrics（Human Escalation / Human Decision / Auto Fix / Reviewer Round / Test Retry / PR Created）を実測値で記録する。評価スコアではなく Protocol 改善のための運用メトリクスとする（§22）
7. Commit / Push は既存の規則（作業ブランチのみ、`main` への push・force push 禁止）を維持し、責任は Orchestrator が持つ。読み取り専用の役割の権限は変えない
8. Human Escalation Policy（§17）は維持する。Escalation に当たらない判断で Human に確認を返さない
9. PR 作成だけが失敗した場合は実装を巻き戻さず、権限内で回復する。GitHub の権限・認証・障害など権限外の場合だけ Escalation する
10. Task State の状態名は増やさない（Reviewer PASS 後、PR 作成までは `REVIEWING`）

## Reason

WI-D2〜D4 で、Human Escalation なしに Goal を完遂し、Reviewer FAIL からの自動修正・再テスト・再レビュー、Decision Record の再利用、複数 Work Item の連続完遂ができることが実証されたため（Human の説明による）。

## Alternatives Considered

- DoD を Reviewer PASS のまま（Commit / Push / PR を Human が指示）: Human の作業が残るため不採用（Human の指示）
- Agent が merge まで行う: Human の指示により採用しない（merge は Human の責任）

## Consequences

- `.ai/AGENTS.md` §0 / §4 / §5 / §6.1 / §7 / §7.3 / §17 / §19 を更新し、§20（DoD と責任境界）・§21（Pull Request）・§22（Autonomy Metrics）を追加
- `.ai/agents/orchestrator.md`（完了処理・PR 本文・Autonomy Metrics・最終報告のテンプレート）、`reviewer.md`、`.ai/tasks/README.md`、`CLAUDE.md` を更新
- DEC-003 より前に DONE となった Work Item は書き換えない。同じブランチの PR を作成した時点で PR 番号と Autonomy Metrics を追記する

## Related Tasks

- AGENT-PROTOCOL-2
- UI-002-D（WI-D2 / WI-D3 / WI-D4）
