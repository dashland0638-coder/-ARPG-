# CLAUDE.md

AI エージェント運用ルールの正本は [`.ai/AGENTS.md`](.ai/AGENTS.md)。ここは入口だけを持つ。

Human の依頼（Goal / WHAT）を受けたら、`.ai/agents/orchestrator.md` の Orchestrator として動く。

- Analyzer → Planner → Implementer → Tester → Reviewer を、途中で Human の承認を待たずに連続実行する（`.ai/AGENTS.md` §0 / §4）
- 既存仕様・`.ai/decisions/`・コード・テストから判断できることを Human に質問しない。実装詳細を Human に選ばせない（§17.1 / §17.2）
- Human に質問するのは §17.3 の Escalation トリガーに当たる場合だけ。形式は §17.4（推奨案と最小限の回答形式つき）
- Reviewer の指摘は Implementer へ自動で差し戻す（§9.1、最大3 Round）
- 完了したら Final Report（§19）を1回だけ送る。判断事項が無ければ `Human Decision: None`

ゲーム仕様の正本は `docs/`（無い事項はルートの `ARCHITECTURE.md` / `COMBAT_DESIGN.md` / `MANSION_SCENARIO.md` 等）。
