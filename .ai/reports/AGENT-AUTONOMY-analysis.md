# AGENT-AUTONOMY Analysis

## Task
AGENT-AUTONOMY / Human Decision 中心の運用から「Agent Autonomous Execution + Human Escalation」型への移行（Human 指示 2026-10-01）

## Summary

- FACT: AI エージェント基盤はコードではなく文書プロトコル（`.ai/AGENTS.md` が正本、`.ai/agents/*.md` がテンプレート）で、実行時の自動化コードは存在しない（`grep -rn "AGENTS.md\|\.ai/" src tests` → 該当はゲームコード内のコメントのみ。プロトコルを読む/強制するコードなし）
- FACT: Human を待つ箇所は §2 / §4 / §5 / §5.1 / §5.2 / §6 / §7 / §7.3 / §8 / §9 / §10 / §13 / §14 と `tasks/README.md` / `decisions/README.md` / `agents/planner.md` 等に分散している（下表）
- FACT: 直近 Task（UI-002-D）は HD-D01〜HD-D29 の 29 件の Human Decision と、各 Work Item の承認・Persistence・Artifact pin を Human 操作で行っており、ラリーが長い（`.ai/tasks/UI-002-D.md` 冒頭、`.ai/decisions/UI-002-human-decisions.md`）
- 結論: 役割と成果物・Handoff 検証・Reviewer 独立性・Status 体系は維持し、「誰が GO を出すか」「誰が persist するか」「不明点をどう解くか」「Review FAIL 後どう回すか」だけを変更すれば移行できる

## Existing System Search

| 探したもの | 検索語 / 範囲 | 結果 |
| --- | --- | --- |
| Orchestrator / Entry Point | `Orchestrator\|Director\|Entry` / `.ai/` | `AGENTS.md` §4・§5 の `Director / Human` のみ（Human の役割）。Agent 側の entry 役は無い |
| Tester 役 | `Tester\|Test Report` / `.ai/` | 専任役なし。§14 と `implementer.md` の Test Report で Implementer が兼務 |
| Escalation 規則 | `エスカレーション\|Escalat` / `.ai/AGENTS.md` | §9（Debugger 3 サイクル超過時）だけ |
| Review FAIL 後のループ | `CHANGES_REQUIRED` / `.ai/AGENTS.md` | §4・§7 に遷移はあるが回数上限なし（上限は §9 の Debugger のみ） |
| Agent 判断の記録先 | `decisions/README.md` | 「AI は決定を記録するだけで、自分で決めない」。Agent Decision の枠なし |
| 自動テスト | `tests/unit/*.test.js` | プロトコル文書を検証するテストなし |
| Claude Code の起動時指示 | `CLAUDE.md`、`.claude/` | どちらも無い（ルートを `ls` で確認） |

## Human Decision Points（現状）と分類

分類: **自動決定** = 規則で機械的に決まる / **Agent 裁量** = Agent が根拠つきで選び記録する / **Escalation** = Human へ上げる（§17 のトリガーに当たる場合のみ）

| # | 現状の箇所 | 現状の Human 依存 | 分類 | 移行後 |
| --- | --- | --- | --- | --- |
| P-01 | §4 / §6 Human Approval Gate | 承認単位ごとに Human の GO が必須。Planner は `WAITING_APPROVAL` で停止 | Agent 裁量（例外 Escalation） | Planner が Escalation Check を行い、トリガーなしなら Agent Approval で `APPROVED` |
| P-02 | §6 Persistence | commit / push は Human の明示的許可が必須 | 自動決定 | Human が割り当てた作業ブランチ（セッション割当・依頼文の指定）を許可とみなす。`main` / force push 禁止は維持 |
| P-03 | §5.2 Artifact Persistence | Analyzer report / 承認済み Task file の push は Human（`Persisted by: Human`） | 自動決定 | Agent が単独 commit で persist（`Persisted by: Agent`）。H-1〜H-8 は維持 |
| P-04 | §5 / `planner.md` DECISION 提示 | 不明点はすべて DECISION として Human へ | Agent 裁量 | Resolution Order で調査し Agent Decision として記録。Escalation トリガーだけ Human |
| P-05 | §8 DECISION の定義 | 「人間が決める必要があること。AI は決めない」 | 再定義 | `AGENT DECISION`（Agent が決める）と `ESCALATION`（Human）に分割 |
| P-06 | §2 矛盾の扱い | 「矛盾を発見したら報告する（自分で解消しない）」 | Agent 裁量 / Escalation | 実装と docs のずれ等、上位ソースで解ける矛盾は Agent が解消。仕様同士の矛盾は Escalation |
| P-07 | §5.1 Review Handoff 不備 | BLOCKED → Human へ報告して停止 | 自動決定 | Orchestrator が Implementer に Handoff を出し直させる（不備は実装指摘として扱わない点は維持）。2 回失敗で Escalation |
| P-08 | §5.2 Artifact Handoff 不備 | BLOCKED → Human | 自動決定 | Agent 生成 Artifact は再 persist（新版）。Human が persist した Artifact の不一致・消失だけ Escalation |
| P-09 | §5.2 承認後の新版 | BLOCKED、Human Approval 取り直し | Agent 裁量 | Planner が計画を見直し Agent Approval を取り直す（Escalation Check 再実施） |
| P-10 | §6 承認範囲・Files To Change の変更 | Human Approval 取り直し | Agent 裁量 | Goal の範囲内なら Planner が計画更新・再承認。ゲーム仕様変更を伴うなら Escalation |
| P-11 | §7.2 Work Item の追加・分割・取り下げ | Planner 提案 + Human 判断 | Agent 裁量 | Goal を変えない範囲で Agent が決め Status History に記録 |
| P-12 | §7.3 Reviewer の push 先 | Handoff Branch へ push できなければ Human の承認待ち | 自動決定 | Handoff Branch（＝作業ブランチ）へ push。書き込み可能なブランチが無い場合だけ Escalation |
| P-13 | §7.3 Implementer の Persistence 不在 | `TESTING` で停止して Human へ | 自動決定 | P-02 により通常発生しない |
| P-14 | §9 Debugger 3 サイクル | 超過で Human | Escalation（維持） | 維持。Review Fix Loop にも同じ上限を導入 |
| P-15 | §4 / §7 Review 指摘後 | Implementer へ戻す（上限・自動化なし） | 自動決定 | Review Fix Loop（最大 3 回）で自動差し戻し・再テスト・再レビュー |
| P-16 | §9 テスト期待値の書き換え | 「仕様変更として人間の判断が要る」 | Agent 裁量 / Escalation | Goal / 計画が意図して変える挙動の期待値更新は Agent 裁量（記録）。skip・無効化は禁止のまま。仕様を変えて通すのは Escalation |
| P-17 | §10 OUT OF SCOPE | 記録して別 Task（Human 判断） | Agent 裁量 | Goal 達成に必要で仕様を変えない最小変更は計画に含める。それ以外は Final Report の Follow-ups に列挙（質問しない） |
| P-18 | §13 仕様変更と docs | docs 更新は承認が必要 | Escalation / Agent 裁量 | ゲーム仕様の変更は Escalation。実装に合わせた docs の整合修正は Agent 裁量 |
| P-19 | §14 実行環境の問題 | 回避できなければ BLOCKED → Human | 自動決定（維持） | リポジトリ外の回避策を Agent が試す。不能なら NOT_RUN と理由を記録して進め、Final Report に記載。必須テストが 1 件も実行できない場合だけ Escalation |
| P-20 | §5 Reviewer 独立性（兼務時） | 人間の差分確認を推奨 | 自動決定 | 可能ならサブエージェント（別コンテキスト）で Reviewer を実行。推奨事項は残すが DONE を止めない（従来どおり） |
| P-21 | `decisions/README.md` | 「AI は自分で決めない」 | 再定義 | Agent Decision の記録先を追加（重要なものだけ） |
| P-22 | `tasks/README.md` Approval 欄 | 「AI は自分で承認しない」 | 再定義 | Approval 欄に Agent Approval（Escalation Check 結果つき）を許可 |
| P-23 | 運用（UI-002-D 等） | Analyzer / Planner の各段で Human が確認・pin・承認を手動指示 | 自動決定 | Orchestrator が Analyzer → … → Reviewer を連続実行 |

## Constraints（維持するもの）

- FACT: 役割・成果物・テンプレート（`.ai/agents/*.md`）、Status 名（§7）、Review Handoff V-1〜V-6、Artifact Handoff H-1〜H-8、Reviewer READ ONLY と独立性、§3 Existing System First、§10 最小変更、§13 Repository Constraints、§14 テスト結果区分
- FACT: §7.3「Status は増やさない」方針 → 新しい Status は追加しない
- FACT: 既存 Task・report・Approval 欄・旧形式は書き換えない方針（§5.2 / §7.3 適用範囲）→ 本移行も既存記録を書き換えない

## Risks

- INFERENCE: Agent Approval により、Human が見ないままゲーム体験を変える変更が入る → Escalation トリガー（ゲーム仕様変更・新システム採用・意味の大きく異なる設計選択）と Final Report の「主な判断」で緩和
- INFERENCE: 同一セッション兼務の Reviewer は自己追認バイアス → サブエージェント推奨・Independence 明記を維持
- INFERENCE: 過去 Task の Human Decision（例: UI-002-D HD-D19「report の push は Human」）が新規則と衝突 → プロセス手順に関する過去 HD は DEC-002 で置き換え、ゲーム仕様に関する HD は拘束力を維持

## Escalation

None（Human が移行方針と要件を明示済み）

## Recommended Next Step

Planner: `.ai/AGENTS.md` に §17〜§19 を追加し、関連節・テンプレートを最小差分で更新する。
