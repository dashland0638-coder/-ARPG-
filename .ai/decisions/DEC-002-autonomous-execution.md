# Decision

## ID

DEC-002

## Date

2026-10-01

## Source

Human の指示（Claude Code セッション、2026-10-01「Agent Autonomous Execution + Human Escalation 型へ移行」）。
調査結果: `.ai/reports/AGENT-AUTONOMY-analysis.md`、Task: `.ai/tasks/AGENT-AUTONOMY.md`。

## Decision

AI エージェント運用を Human Decision 中心から **Agent Autonomous Execution + Human Escalation** へ移行する。

1. Human は WHAT / Goal を与える。Agent は HOW を決める
2. 既存仕様・Decision Record・Policy から判断できる事項を Human に質問しない。実装詳細の選択肢を Human に選ばせない
3. 不明点はまず Repository・仕様・Decision Record・過去の Work Item・関連コード・テストを調査して Agent が判断する。判断不能な場合だけ Escalation する
4. Agent の重要な判断は Decision Record または Work Item に記録し、同じ問題で再び Human に質問しない（細かい実装判断は記録しない）
5. Reviewer が問題を見つけたら Implementer へ自動で差し戻し、修正・再テスト・再レビューする（最大3 Round。超えたら Escalation）
6. Human への報告は、完成後の要約と、実際に判断が必要だった事項だけ。不要なら `Human Decision: None` と明記する
7. 目的は「完全自律」ではなく、Human とのラリーを減らし Agent が判断できる範囲を最大化すること。Human は Goal 定義・大きな仕様とゲームデザインの決定・判断不能な例外・最終確認に集中する
8. 既存の役割（Analyzer / Planner / Implementer / Reviewer / Debugger）、Reviewer の独立性、Work Item、Decision Record、Persistence、Task State は維持する。Orchestrator（Entry Point）と Tester を役割として加える

Escalation の対象（Human が判断する事項）は Human の指示どおり `.ai/AGENTS.md` §17.3 に定める:
ゲーム仕様の変更 / 既存 Decision Record との明確な矛盾 / ゲームデザイン上の意味が大きく異なり既存仕様から判断できない複数案 /
新しいゲームシステムの採用・不採用 / 既存仕様同士の矛盾 / データ破壊など重大な不可逆変更 / 重大なセキュリティ判断 /
自動修正ループの上限超過 / Human が明示的に判断を求めた事項。

## Reason

Analyzer・Planner の後に Human の逐次判断を求める運用（例: UI-002-D の HD-D01〜HD-D29、各 Work Item の承認・Persistence・Artifact pin の手動指示）では、
AI エージェントを導入しても Human とのラリーが長く、作業負荷が十分に減らなかったため（Human の説明による）。

## Alternatives Considered

- 現行の Human Approval Gate を維持: ラリーが減らないため不採用（Human の指示）
- 完全自律（Escalation なし）: Human の指示により目的としない

## Consequences

- `.ai/AGENTS.md` に §0（Operating Mode）/ §6.1 Agent Approval / §9.1 Review Fix Loop / §17 Escalation Policy / §18 Decision Record as Agent Knowledge / §19 Final Report を追加。§6 の旧 Human Approval Gate は §6.2（例外）として残す
- 作業ブランチ（Human が依頼文・セッション設定で割り当てたブランチ）への commit / push は許可済みとして扱う。`main` への push・force push は従来どおり行わない
- 過去の Human Decision のうち **プロセス手順だけを定めたもの**（承認待ち・report の commit / push を Human が行う等。例: UI-002-D の HD-D19、HD-D27 の「実装承認ではない」部分）は、本決定の統合後の遷移から本決定に置き換わる。
  ブランチ名の指定（例: HD-D20）・ゲーム仕様・ゲームデザインの Human Decision と、「AI が決定してはいけない」と明示された事項（例: HD-D21）は引き続き拘束力を持つ（`.ai/AGENTS.md` §17.3 E-2 / E-9）
- 既存の Task・report・Approval 欄は書き換えない

## Related Tasks

- AGENT-AUTONOMY
