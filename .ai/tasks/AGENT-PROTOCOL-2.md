# AGENT-PROTOCOL-2

Status: REVIEWING

Analysis: .ai/reports/AGENT-PROTOCOL-2-analysis.md（branch `claude/agent-autonomous-execution-ewtk87` @ `79a1c31a7bb3a348497625e77ed9f7caa5e00004`、blob `734200d10d48c40eeb1691bea61f95dd4adfee24`）

## Approval
- [x] Approved
- Approval type: Agent Approval（`.ai/AGENTS.md` §6.1。Human は Goal と要件を指示し、追加承認を待たずに進めるよう指示）
- Escalation Check: None（ゲーム仕様・ゲームコードの変更なし。Human が要件を明示）
- Approved by / date / where: Planner (Agent) / 2026-10-01 / branch `claude/agent-autonomous-execution-ewtk87`
- Scope of approval: 下記 Files To Change
- Persistence: 許可（branch: `claude/agent-autonomous-execution-ewtk87`、根拠: セッション割当の開発ブランチ）

Implementation: ALLOWED

## Goal

Agent Autonomous Execution + Human Escalation を正式な開発プロトコル（Agent Protocol 2.0）とし、Agent の Definition of Done を「Goal を完遂し Commit / Push / PR 作成まで」へ拡張する。`main` への merge は Human の責任として残す。

## Implementation Plan

| Step | ファイル | 変更 |
| --- | --- | --- |
| 1 | `.ai/AGENTS.md` | §0 を Agent Protocol 2.0 に、§4 のフローに Commit / Push / PR と Human の merge 判断を追加、§5 の Orchestrator の責務、§6.1 の PR の行、§7 の状態表（REVIEWING / DONE）、§7.3 の DONE 条件に PR と Autonomy Metrics と Completion commit、§17.1 / §19 に「確認を返さない」と最終報告の必須項目、E-10 に PR 作成の権限外障害、新 §20（DoD 13 項目・責任境界・PR 失敗時）・§21（PR）・§22（Autonomy Metrics） |
| 2 | `.ai/agents/orchestrator.md` | 完了処理（push 確認・PR 作成 / 更新・Completion commit・merge しない）、Autonomy Metrics / PR 本文 / 最終報告のテンプレート |
| 3 | `.ai/agents/reviewer.md` | PASS でも Status は `REVIEWING` のまま（DONE は Orchestrator） |
| 4 | `.ai/tasks/README.md` | Task テンプレートに Autonomy Metrics |
| 5 | `CLAUDE.md` | 入口に DoD と merge しないことを追加 |
| 6 | `.ai/decisions/DEC-003-agent-protocol-2.md` | Human の指示の記録 |
| 7 | `tests/unit/ai-protocol.test.js` | 2.0 の検証 6 件（フロー・DoD・Commit / Push の責務・PR 本文・Autonomy Metrics・最終報告と確認を返さないこと）。既存 9 件と重複させない |
| 8 | `.ai/tasks/UI-002-D.md` | 同じブランチで完遂した WI-D2〜D4 の Autonomy Metrics と PR 番号の追記（Completion commit、§20 の適用範囲） |

## Files To Change
上の表のファイル、`.ai/tasks/AGENT-PROTOCOL-2.md`、`.ai/reports/AGENT-PROTOCOL-2-*.md`

## Files Not To Change
ゲームコード（`src/`・`index.html`）、既存の E2E、既存の Decision Record の本文、既存 Task の Approval 欄・Status History の既存行

## Test Plan
- `npm run build` / `npm run test:unit`（`ai-protocol.test.js` を含む）
- `npm test`（E2E 全体。ゲームコードの変更は無いが、このブランチの PR に含まれる WI-D2〜D4 の変更を含めて全体回帰を確認する）

## Acceptance Criteria
- AC-1 標準フローが Goal → … → Reviewer → Commit → Push → PR → DONE、Human は PR 確認 → merge 判断
- AC-2 Reviewer FAIL の自動差し戻し・上限・Escalation 条件は維持（既存テスト）
- AC-3 DoD に PR 作成が含まれ、`main` への merge が含まれない
- AC-4 Commit / Push / PR の責任が Orchestrator、Agent は merge しない
- AC-5 Autonomy Metrics の 6 項目、PR 本文・最終報告の必須項目が定義されている
- AC-6 状態名を増やさない。既存のテストが通る

## Agent Decisions
| # | 決定 | 根拠ソース（AGENTS.md §17.2） | 代替案 |
| --- | --- | --- | --- |
| A-1 | Reviewer PASS 後、PR 作成までは `REVIEWING` のまま。Orchestrator の Completion commit（Status・Status History・Autonomy Metrics・PR 番号だけ）で DONE にする | §7.3「Status は増やさない」、Human の指示「状態名を不用意に増やさない」、WI-D1 の `REVIEWING（Reviewer PASS）` の前例 | `PR_OPEN` 等の新状態（指示に反する）/ Reviewer が DONE にして PR を後付け（DoD と DONE がずれる） |
| A-2 | 作業ブランチ 1 本につき PR 1 つ。同じブランチで続けて完遂した Work Item は既存の PR の本文を更新する | AD-003（セッション割当の 1 ブランチで複数 Work Item を進める運用）、GitHub の PR は head ブランチ単位 | Work Item ごとにブランチを分ける（実行環境の push 制限に反する） |
| A-3 | Human Decision Count は「Work Item の実行中に Human が下した判断」とし、Goal の指示そのものと、移行前に記録済みの Human Decision は数えない | §22 の定義（指示「推測で埋めない」に合わせ、記録から数えられる定義にする） | 過去の HD を含める（Work Item の実行と無関係な判断が混ざる） |

## Escalation
None

## Status History
| Date | Target | From → To | By | Note |
| --- | --- | --- | --- | --- |
| 2026-10-01 | Task | DRAFT → ANALYZING → PLANNED → APPROVED | Orchestrator / Analyzer / Planner (Agent Approval) | Analysis `79a1c31`。Branch `claude/agent-autonomous-execution-ewtk87` |
| 2026-10-01 | Task | APPROVED → IMPLEMENTING → TESTING → REVIEWING | Implementer / Tester | Branch `claude/agent-autonomous-execution-ewtk87` |
| 2026-10-01 | Task | REVIEWING → CHANGES_REQUIRED | Reviewer | Round 1/3。Reviewed `cfdbd79`。Reviewer が DONE にする旧記述の残り（`AGENT-PROTOCOL-2-review.md`） |
| 2026-10-01 | Task | CHANGES_REQUIRED → IMPLEMENTING → TESTING → REVIEWING | Implementer / Tester | Round 1/3 fix。Branch `claude/agent-autonomous-execution-ewtk87` |
| 2026-10-01 | Task | REVIEWING（Reviewer PASS） | Reviewer | Round 2/3 PASS。Reviewed `039c857`。DONE は PR 作成後に Orchestrator が付ける（§20） |

## Implementation Result

### Changed Files
| ファイル | 変更 |
| --- | --- |
| `.ai/AGENTS.md` | §0 を Agent Protocol 2.0 に。§4 のフローに Commit / Push / PR 作成と Human の merge 判断。§5 の Orchestrator の責務。§6.1 の PR の行（PR 作成は Orchestrator、merge は Human）。§7 の状態表（REVIEWING は PR 作成までを含む、DONE は main への merge を含まない）。§7.3 の Reviewer の commit 範囲と DONE 条件（PR・Autonomy Metrics・Completion commit）。§17.1 / §19（確認を返さない、最終報告の必須項目）。E-10 に PR 作成の権限外障害。新 §20（DoD 13 項目・責任境界・PR 失敗時）・§21（Pull Request）・§22（Autonomy Metrics）。File Map に DEC-003 |
| `.ai/agents/orchestrator.md` | 完了処理（push 確認・PR 作成 / 更新・Completion commit・merge しない・PR 失敗時）、Autonomy Metrics / PR Body / Final Report のテンプレート |
| `.ai/agents/reviewer.md` | PASS でも Status は `REVIEWING`（DONE は Orchestrator） |
| `.ai/tasks/README.md` | Task テンプレートに Autonomy Metrics |
| `CLAUDE.md` | DoD（PR 作成まで）と merge しないこと、Autonomy Metrics |
| `.ai/decisions/DEC-003-agent-protocol-2.md`（新規） | Human の指示の記録 |
| `tests/unit/ai-protocol.test.js` | 2.0 の検証 6 件を追加（計 15 件）。§20〜§22 を必須節に、DEC-003 を § 参照の検査対象に追加 |

### Test Report
- Scope: Full Regression（build / unit / E2E 全体）
- Executed: `npm run build` / `npm run test:unit` / `npx playwright test`（全 42 ファイル・207 件、`--retries=1`）
- Environment: AD-001 の回避策（リポジトリ外の Playwright 設定で `executablePath`・`webServer.cwd` だけを上書き）。描画は約 3.5 fps

| テスト | 結果 | メモ |
| --- | --- | --- |
| Build | PASS | 既存の chunk サイズ警告のみ |
| Unit | PASS | 1588 件中 1587 PASS / 0 FAIL / 1 SKIP（既存）。`ai-protocol.test.js` 15 / 15 |
| E2E 全体 | PASS 205 / FLAKY 2 / FAIL 0 | 1.9 時間 |
| `base-class-identity.spec.js:376`（盗賊 Back Attack） | FLAKY | 初回失敗・1 回の再実行で PASS。戦闘のタイミングを見る test。INFERENCE: このブランチの変更（`.ai/`・HUD の配置・表示条件）は戦闘処理を通らないため無関係。変更前コードでの比較は未実施（Risks） |
| `job-traits.spec.js:162`（鷹の目） | FLAKY | 既存の FLAKY として記録済みの test（UI-002-D の Test Report）。分類は変更しない |
| 既存 FAIL として記録していた `mansion-escort` / `execution-break` | PASS | 今回は通った。分類の見直しは本 Task の範囲外 |

### Acceptance Criteria
| AC | 確認方法 | 根拠 |
| --- | --- | --- |
| AC-1 | VERIFIED | `ai-protocol.test.js`「2.0 標準フロー」・既存の「標準フロー」 |
| AC-2 | VERIFIED | 既存の「Review Fix Loop」「Escalation トリガー」 |
| AC-3 | VERIFIED | 「2.0 Definition of Done」 |
| AC-4 | VERIFIED | 「2.0 Commit / Push の責務」 |
| AC-5 | VERIFIED | 「2.0 PR 本文」「2.0 Autonomy Metrics」「2.0 最終報告」 |
| AC-6 | VERIFIED + FACT (code) | 状態名の追加なし（§7 の遷移図は無変更）。Full Regression PASS |

### Round 1 Fix
- Required #1・#2: `.ai/AGENTS.md` §5 の Reviewer の次工程を「PASS → Orchestrator（Commit / Push / PR → DONE）/ Implementer」に、§7.3「push 前の Status」を「Reviewer の `REVIEWING（Reviewer PASS）` / `CHANGES_REQUIRED`、Orchestrator の Completion commit の `DONE`」に修正
- Required #3: `ai-protocol.test.js` に「Reviewer は DONE にしない」を追加（計 16 件）。修正前の AGENTS.md では FAIL、修正後は PASS
- Re-test: Build PASS / Unit 1589 件中 1588 PASS・0 FAIL・1 SKIP。変更は文書と unit test のみのため E2E は再実行しない（Full Regression は Round 1 前の実装で実施済み、ゲームコードの差分なし）

