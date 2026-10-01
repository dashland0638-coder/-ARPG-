# AGENT-AUTONOMY

Status: REVIEWING

Analysis: .ai/reports/AGENT-AUTONOMY-analysis.md（branch `claude/agent-autonomous-execution-ewtk87` @ `159351b330d64d19b8d77a1d33a5f70d4fa9c924`、blob `74cd637d46552a821734f081dfcbb435bbbb85b9`）

## Approval
- [x] Approved
- Approval type: Human Approval（Goal とプロトコル要件を Human が明示し、承認を待たずに進めるよう指示。DEC-002 の Source）
- Escalation Check: None
- Approved by / date / where: Human / 2026-10-01 / Claude Code セッションの依頼文
- Scope of approval: 下記 Files To Change
- Persistence: 許可（branch: `claude/agent-autonomous-execution-ewtk87`、根拠: 依頼文とセッション設定で割り当てられた開発ブランチ）

Implementation: ALLOWED

## Goal

Analyzer / Planner / Implementer / Reviewer の役割を維持したまま、Human Decision 中心の運用から「Agent Autonomous Execution + Human Escalation」型へ移行する。
通常ケースでは、Human が「○○を改善して」と言えば Agent が調査・分析・計画・実装・テスト・レビュー・自動修正まで完遂し、Human は最終確認だけを行う。

## Constraints

- 既存の役割・成果物・Handoff 検証（V-1〜V-6 / H-1〜H-8）・Reviewer 独立性・Status 名・Decision Record を壊さない（analysis Constraints）
- 既存の Task・report・Approval 欄を書き換えない
- ゲームコード（`src/`）・既存テスト・`docs/` のゲーム仕様を変えない

## Current Implementation

analysis の「Human Decision Points」表（P-01〜P-23）を参照。

## Implementation Plan

| Step | ファイル | 変更 | 対応 |
| --- | --- | --- | --- |
| 1 | `.ai/AGENTS.md` | §0 Operating Mode を追加 | 移行の宣言・読み替え規則 |
| 2 | `.ai/AGENTS.md` §2 / §4 / §5 | 新フロー（Orchestrator / Context Loader / Tester）、役割表、禁止事項、Handoff 不備時の自動回復 | P-04 / P-06 / P-07 / P-08 / P-20 / P-23 |
| 3 | `.ai/AGENTS.md` §6 | Approval Gate を Agent Approval（§6.1・標準）と Human Approval（§6.2・例外）に分割、作業ブランチの Persistence | P-01 / P-02 / P-03 / P-10 |
| 4 | `.ai/AGENTS.md` §7 / §7.3 | 状態表の担当・遷移条件、push 不能時の扱い | P-11 / P-12 / P-13 |
| 5 | `.ai/AGENTS.md` §8 / §9 / §9.1 / §10 / §13 / §14 | AGENT DECISION / ESCALATION、Review Fix Loop（3 Round）、OUT OF SCOPE と docs 整合、実行環境 | P-05 / P-14 / P-15 / P-16 / P-17 / P-18 / P-19 |
| 6 | `.ai/AGENTS.md` §17 / §18 / §19 | Escalation Policy・Resolution Order・形式、Decision Record as Agent Knowledge、Final Report | 新規 |
| 7 | `.ai/agents/orchestrator.md` `tester.md` | 新しい役割のテンプレート | 新規 |
| 8 | `.ai/agents/{analyzer,planner,implementer,reviewer,debugger}.md` | 停止・Human 待ちの手順を自律実行に置き換え、テンプレートに Constraints / Scope of Change / Agent Decisions / Escalation / Required Changes 表を追加 | P-04 / P-15 |
| 9 | `.ai/tasks/README.md` `decisions/README.md` `reports/README.md` | Approval 欄・Agent Decisions・Escalation 節、Decision の種類 | P-21 / P-22 |
| 10 | `.ai/decisions/DEC-002-autonomous-execution.md` `AGENT-DECISIONS.md` | Human 指示の記録、Agent Decision ログ | §18 |
| 11 | `CLAUDE.md` | Claude Code の起動時に Orchestrator として動く入口 | P-23 |
| 12 | `tests/unit/ai-protocol.test.js` | 必須節・トリガー・ループ上限・§参照整合の検証 | 回帰防止 |

## Files To Change

`.ai/AGENTS.md`、`.ai/agents/*.md`（orchestrator / tester は新規）、`.ai/tasks/README.md`、`.ai/tasks/AGENT-AUTONOMY.md`、`.ai/decisions/README.md`、`.ai/decisions/DEC-002-autonomous-execution.md`、`.ai/decisions/AGENT-DECISIONS.md`、`.ai/reports/README.md`、`.ai/reports/AGENT-AUTONOMY-*.md`、`CLAUDE.md`、`tests/unit/ai-protocol.test.js`

## Files Not To Change

`src/`、`index.html`、`basefile.html`、`docs/`、既存の `tests/*.spec.js` / `tests/unit/*`、既存の Task・report・decision の本文

## Test Plan

- Targeted: `npm run build` / `npm run test:unit`（新規 `ai-protocol.test.js` を含む）
- E2E: ゲームコードを変更しないため影響経路なし。Tester 手順の回避策を実証するスモークとして `ui-foundation` / `dev-ui-gate` を実行

## Acceptance Criteria

- AC-1: 標準フローが Orchestrator → Context Loader → Analyzer → Planner → Implementer → Tester → Reviewer で、途中に Human Approval の GATE が無い
- AC-2: Escalation トリガーと Agent 裁量の範囲、Escalation の形式（推奨案・最小回答）が定義されている
- AC-3: Reviewer → Implementer の自動差し戻しループ（上限 3 Round、超過で Escalation）が定義されている
- AC-4: Decision Record が Agent の知識として扱われ、Agent Decision の記録先と粒度が定義されている
- AC-5: Final Report のテンプレートに `Human Decision: None` がある
- AC-6: 既存の Handoff 検証・Reviewer 独立性・Status 名・既存記録が維持されている
- AC-7: build / unit が PASS

## Risks

- 同一セッション兼務のレビュー（Reviewer 独立性 §5）。Human による差分確認を推奨
- 移行前に始まった Task（UI-002-D）の再開時は AD-002 の読み替えが必要

## Rollback

本 Task のコミットを revert する（`.ai/` と `CLAUDE.md`、1 unit test のみ。ゲームコードへの影響なし）。

## Out of Scope

- 自動化スクリプト（エージェントを起動する実行基盤）の実装: 本リポジトリの基盤は文書プロトコルで、実行は Claude Code セッションが担う
- UI-002-D WI-D2（REVIEWING、review FAIL）の続行: 本移行後に Goal として依頼されれば Orchestrator が Review Fix Loop で続行する

## Agent Decisions

| # | 決定 | 根拠ソース（AGENTS.md §17.2） | 代替案 |
| --- | --- | --- | --- |
| A-1 | 新しい Status を追加せず、Escalation は既存の `WAITING_APPROVAL`（計画段階）/ `BLOCKED`（実行中）で表す | §7.3「Status は増やさない」 | `ESCALATED` 状態の新設（既存規則と矛盾） |
| A-2 | 旧 Human Approval Gate は削除せず §6.2 として残し、依頼文で段階承認を求められた Task に使う | 依頼文「既存機能を不用意に削除・置換しない」 | 全廃 |
| A-3 | Analyzer / Planner の READ ONLY は維持し、Artifact の persist は Orchestrator の操作とする | §5 役割表、§5.2 H-3 | Analyzer / Planner に push 権限を付与 |
| A-4 | Review Fix Loop は Debugger サイクルと別に数え、上限は各 3 | §9 の既存上限、依頼文「最大3回程度」 | 両者通算 3 |
| A-5 | Task を越えて効く Agent Decision は追記型の1ファイル `AGENT-DECISIONS.md` にまとめる | 依頼文「Repository を肥大化させない」 | DEC ファイルを判断ごとに作る |
| A-6 | プロトコルの構造を unit test で検証する | §14、既存 unit が文書・データを読む先例（`ui-glyphs.test.js`） | テストなし |

## Escalation

None

## Status History
| Date | Target | From → To | By | Note |
| --- | --- | --- | --- | --- |
| 2026-10-01 | Task | DRAFT → ANALYZING | Orchestrator | branch `claude/agent-autonomous-execution-ewtk87` |
| 2026-10-01 | Task | ANALYZING → PLANNED | Analyzer / Planner | analysis persisted @ `159351b` |
| 2026-10-01 | Task | PLANNED → APPROVED | Human（依頼文） | Escalation Check: None |
| 2026-10-01 | Task | APPROVED → IMPLEMENTING → TESTING → REVIEWING | Implementer / Tester | branch `claude/agent-autonomous-execution-ewtk87` |

## Implementation Result

### Artifact Handoff
| Kind | Path | Source（branch @ SHA） | Blob SHA | 確認（I-1 / H-1〜H-8） |
| --- | --- | --- | --- | --- |
| analysis | `.ai/reports/AGENT-AUTONOMY-analysis.md` | `claude/agent-autonomous-execution-ewtk87` @ `159351b330d64d19b8d77a1d33a5f70d4fa9c924` | `74cd637d46552a821734f081dfcbb435bbbb85b9` | 同一ブランチ・単独 commit。H-1〜H-8 OK |
| plan | `.ai/tasks/AGENT-AUTONOMY.md` | `claude/agent-autonomous-execution-ewtk87` @ `ba6054bad33e86a1fe33293bf19f6b0a963505ca` | `29640f144a8b672eb3aaa9fe212a9369606ad652` | 同一ブランチ・単独 commit。I-3: 以後の変更は Status 行・Status History 追記・本節のみ |

### Changed Files
| ファイル | 変更 |
| --- | --- |
| `.ai/AGENTS.md` | §0 追加、§2 / §4 / §5 / §5.1 / §5.2 / §6（§6.1 / §6.2）/ §7 / §7.3 / §8 / §9（§9.1）/ §10 / §13 / §14 / §16 更新、§17 / §18 / §19 追加 |
| `.ai/agents/orchestrator.md` / `tester.md` | 新規 |
| `.ai/agents/analyzer.md` / `planner.md` / `implementer.md` / `reviewer.md` / `debugger.md` | Human 待ちの手順を自律実行・Escalation に置換、テンプレート更新 |
| `.ai/tasks/README.md` / `.ai/decisions/README.md` / `.ai/reports/README.md` | Approval 欄・Agent Decisions・Escalation 節、Decision の種類 |
| `.ai/decisions/DEC-002-autonomous-execution.md` / `AGENT-DECISIONS.md` | 新規 |
| `CLAUDE.md` | 新規（Orchestrator の入口） |
| `tests/unit/ai-protocol.test.js` | 新規（8 tests） |

### Test Report
- Scope: Targeted
- Executed: `npm ci`、`npm run build`、`npm run test:unit`、`npx playwright test -c <scratchpad>/pw.config.mjs tests/ui-foundation.spec.js tests/dev-ui-gate.spec.js`
- Why this scope: 変更は `.ai/`・`CLAUDE.md`・unit test 1件のみで、ゲームの実行経路を通らない。E2E は Tester 手順（AD-001 の回避策）の実証スモーク
- Not run: E2E 全体（ゲームコード無変更のため影響経路なし）
- Environment: Playwright の Chromium revision 不一致のため、リポジトリ外（scratchpad）の設定で `executablePath: /opt/pw-browsers/chromium`・`webServer.cwd` だけを上書き。リポジトリの設定は無変更

| テスト | 結果 | メモ |
| --- | --- | --- |
| Build | PASS | 既存の chunk サイズ警告のみ |
| Unit | PASS | 1580 件中 1579 PASS / 0 FAIL / 1 SKIP（既存の SKIP）。新規 `ai-protocol.test.js` 8 件 PASS |
| E2E スモーク（2 spec・6 件） | PASS | `ui-foundation` / `dev-ui-gate` |
| E2E 全体 | NOT_RUN | 上記理由 |

### Acceptance Criteria
| AC | 確認方法 | 根拠 |
| --- | --- | --- |
| AC-1 | VERIFIED | `ai-protocol.test.js`「標準フローは … GATE を挟まない」 |
| AC-2 | VERIFIED | 同「Escalation トリガー E-1〜E-10 と回答形式」、§17.1 は FACT (code) |
| AC-3 | VERIFIED | 同「Review Fix Loop は自動差し戻しで上限 3 Round」 |
| AC-4 | FACT (code) | AGENTS.md §18、`decisions/README.md`、`AGENT-DECISIONS.md` |
| AC-5 | VERIFIED | 同「Final Report は Human Decision: None を明示する」 |
| AC-6 | FACT (code) | V-1〜V-6 / H-1〜H-8 の表は無変更（差分は BLOCKED 時の戻し先と Persisted by のみ）、§7 の Status 名は無変更 |
| AC-7 | VERIFIED | Test Report |

### Out of Scope Found
- `docs/README.md` の `.ai/` 説明は AGENTS.md を参照しているだけで更新不要
