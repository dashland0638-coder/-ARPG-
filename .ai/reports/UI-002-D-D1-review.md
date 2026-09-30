# UI-002-D WI-D1 Review

## Review Target
| 項目 | 値 |
| --- | --- |
| Task ID | UI-002-D / WI-D1 |
| Branch | `claude/ui-002-d-impl` |
| Reviewed SHA | `504a10280166aaee97f02c9d4381e7c2adaaa21b`（Task metadata commit。実装 commit `bf9c680a3afc1a1b355f64dd72dfa0ddb828de7b` を含む） |
| Diff range | `b6fd9300e6c920486f0fa5480ca7a52544ac6f96..504a10280166aaee97f02c9d4381e7c2adaaa21b`（2 commit・7 ファイル） |
| Handoff Verification | V-1〜V-6 すべて確認。V-2a: Minor / non-blocking（下記） |
| Analysis Source | `.ai/reports/UI-002-D-analysis.md`（branch `claude/ui-002-d-planner-persistence` @ `03d165fac705c14887438256f7ceda9568062d73`、blob `ecb000a07cfce52ff836414ccc88ff353ea7f27b`） |
| Plan Source | `.ai/tasks/UI-002-D.md`（branch `claude/ui-002-d-planner-persistence` @ `58061e5a55592de338839313df8647a9b94bde18`、blob `62e60fea79b2d5373b275a9ee4994bbb61d4e497`） |

## Result
PASS

- Critical: 0 / Major: 0 / Minor: 4（M-1〜M-4）/ Nit: 3（N-1〜N-3）。Minor・Nit はいずれも D1 の再修正条件にしない
- Human Final Confirmation: APPROVED（2026-09-30、本セッションの会話）

## Independence
同一セッションで兼務（Implementer と同じセッション）。AGENTS.md §5 に従い、Human による差分確認を推奨事項とする（Human Final Confirmation で確認済み）。

## Handoff Verification
| # | 結果 |
| --- | --- |
| V-1 | remote `claude/ui-002-d-impl` の先端 = `504a102`。Reviewed SHA に到達可能 |
| V-2 | `504a102` 時点で `.ai/tasks/UI-002-D.md` を読める |
| V-2a | 承認済み Task（`58061e5`）からの変更は、Work Items 表の WI-D1 の行（APPROVED → REVIEWING）、Status History への 1 行追加、Implementation Result 節だけ。Work Items 表の書き換えは V-2a の文言（Status 行・Status History・Implementation Result）と形式上一致しないが、AGENTS.md §7.2 で Work Item の Status の正本は Work Items 表であり、必要な更新。承認範囲・AC・旧 Approval record は変わっていない → **Minor / non-blocking**（M-4） |
| V-3 | Plan（Task の計画本文と `.ai/reports/UI-002-D-plan.md`）が存在する |
| V-4 | V-4a: `git rev-parse 504a102:.ai/reports/UI-002-D-analysis.md` = `ecb000a0…`。V-4b: `03d165f` は `claude/ui-002-d-planner-persistence` から到達可能 |
| V-5 | Implementation Result（Test Report・Changed Files）を Task で確認 |
| V-6 | Diff range は空でなく（`bf9c680`・`504a102`）、終点が Reviewed SHA |

## Checklist
| # | 項目 | 結果 | 根拠 |
| --- | --- | --- | --- |
| 1 | Specification compliance | PASS | WI-D1 の承認済み範囲（表示条件の純粋関数化、Chapter 1 の XP / Skill 3 / 未習得 Skill 2、導入会話中の表示、PC 操作ヒント 5 秒・セッション内保持、スタミナ HD-D25、ミニマップ・PC タッチボタンの条件の関数化、常時表示、Weapon Badge の初期同期、主人公交代時の同期、E との整合）を満たす |
| 2 | Scope compliance | PASS | 変更は 6 ファイル + Task。D2〜D6・MP・C2 / V・E の範囲に差分なし |
| 3 | Regression | PASS | 下記テスト。既存の表示結果（ミニマップ・タッチ操作パッド・E の glyph・本編 / テストモードの旧成長系）を維持 |
| 4 | Build | PASS | Reviewer が `504a102` の export で実行 |
| 5 | Unit tests | PASS | 1572 件中 1571 PASS / 0 FAIL / 1 SKIP |
| 6 | E2E tests | PASS（Targeted） | 新規 FAIL なし。BASELINE FAIL 1 件・FLAKY 1 件は下記 |
| 7 | Save/Load integrity | PASS | セーブ形式に変更なし。ヒントの表示済み状態はセーブに入らない（E2E） |
| 8 | Existing behavior | PASS | `index.html`・CSS・入力の結び付けに変更なし |
| 9 | Code duplication | PASS | 既存の `legacyGrowthEnabled` / `hasSkill2` を再利用。M-1 の呼び出し重複のみ |
| 10 | Unnecessary architecture changes | PASS | concat 構造を維持（HEADER の import 追加のみ）。legacy parts の ES Module 化なし |

## Code Review

### Critical
None

### Major
None

### Minor（いずれも D1 の再修正条件にしない）
- **M-1**: `src/legacy/parts/14-hud-boot.js` の `finishEnteringGame` で、`applyLegacyHudVisibility()` の直後に同じ処理を含む `syncHudDisplay()` を呼んでいる（重複。害はない）
- **M-2**: PC 操作ヒントの「表示済み」記録がテストモードと本編で共有される。同一セッション内で先にテストモードを使うと、後の本編で Skill 2 を覚えてもヒントが出ない端ケースがある（HD-D23 の「セッション内で保持」の範囲内）
- **M-3**: 通常プレイ中の会話で HUD の更新が止まる間は、PC 操作ヒントの 5 秒のカウントも止まる（表示中に会話が始まると、会話が終わるまで残る。Implementation Result に既知の制限として記録済み）
- **M-4**: Task の Work Items 表の WI-D1 の Status 変更について、V-2a の文言との形式上のずれ（上記 V-2a）

### Nit
- **N-1**: スタミナの見出しを「`#sta-fill` の親要素の直前の要素」として隠しており、DOM の並び順に依存している
- **N-2**: `alwaysOnHudVisible` / `touchActionButtonsVisible` は D1 では関数と unit test のみで、ゲーム本体からは呼ばれない（HD-D22 と承認範囲どおり。実際の非表示化は D3）
- **N-3**: E2E のセーブ検証が、セーブ JSON に文字列 `hint` を含まないことで判定している

## Tests

| テスト | Implementer の記録 | Reviewer の再実行 |
| --- | --- | --- |
| Build | PASS | PASS（`504a102` の export） |
| Unit | 1572 件中 1571 PASS / 0 FAIL / 1 SKIP（SKIP は既存の catalog 照合テスト） | 同じ |
| 関連 E2E（19 spec・88 件） | 初回 PASS 86 / FAIL 2 | 対象を絞って再実行（下記） |
| `tests/combat-hud-display-conditions.spec.js`（新規 5 件） | PASS | PASS |
| `tests/ui-production-glyphs.spec.js`（5 件） | PASS | PASS |
| `tests/chapter1-legacy-ui.spec.js`（3 件） | PASS | PASS |
| `tests/mansion-scenario.spec.js:70` | FLAKY（初回タイムアウト、再実行 PASS、変更前 main でも PASS） | PASS。FLAKY の分類を維持（PASS として数えない） |
| `tests/ui-proto-gate.spec.js:92`（C2） | BASELINE FAIL | `504a102` で FAIL。**変更前の main `b6fd930` でも FAIL**。BASELINE FAIL を確認。D1 の新規 FAIL ではない。C2 側の既存問題として記録し、D1 では修正しない |

- 既存の分類（変更しない。今回は未実行）: FAIL = mansion-escort、execution-break / FLAKY = job-traits
- NOT_RUN: 通常の `npm test`（Chromium revision mismatch）、E2E 全体、iPhone 実機。PASS として数えない
- 実行環境: E2E はリポジトリ外（scratchpad）の Playwright 設定で `executablePath: /opt/pw-browsers/chromium` だけを指定して実行。リポジトリの設定は変更していない

## Acceptance Criteria
| AC | 結果 |
| --- | --- |
| 表示条件が 1 つの純粋関数モジュールにあり、unit test で検証される（本編 / テストモードを区別） | PASS |
| 本編で XP / Skill 3 / Lv が出ない | PASS |
| 導入会話中に未習得 Skill 2・本編の Skill 3 が出ない | PASS |
| Weapon Badge が初期表示で「M」にならない（1280×800 / 844×390） | PASS |
| Weapon Badge が現在の weapon / 主人公 / job と一致し、剣士 + 大剣で `weapon.greatsword`、名称は「大剣」 | PASS |
| 影の旅人・上位職等に剣士の glyph を誤適用しない | PASS |
| 主人公交代後に前の状態を引きずらない | PASS |
| E の glyph 子要素 / `data-glyph` / SVG を壊さない。Attack / Skill の icon を直接書き換えない | PASS |
| 新しい semantic glyph を追加しない。E の glyph 仕様を変更しない | PASS |
| PC 操作ヒントが 5 秒表示され、表示済み状態をセーブしない | PASS（M-2 / M-3 は Minor） |
| スタミナの表示条件（HD-D25） | PASS |
| ミニマップ / PC タッチボタンの表示結果が現行と同じ | PASS |
| 常時表示要素（名前・肖像・HP・武器バッジ） | PASS |
| E2E を弱めていない。既存 FAIL / FLAKY / NOT_RUN の分類を変えていない | PASS |
| 実機（iPhone safe-area 等） | NOT_RUN（D1 の AC 外。D2 以降） |

## Changed Files
- `bf9c680`: `src/core/combat-hud-visibility.js`（新規）、`src/legacy/concat-plugin.js`、`src/legacy/parts/14-hud-boot.js`、`src/legacy/parts/10-input.js`、`tests/unit/combat-hud-visibility.test.js`（新規）、`tests/combat-hud-display-conditions.spec.js`（新規）
- `504a102`: `.ai/tasks/UI-002-D.md`（Implementation Result・WI-D1 REVIEWING）
- 変更なしを確認: `index.html`、`src/styles/`、`basefile.html`、`src/core/ui-icons.js`（`setGlyphOrText` を含む E の実装）、C2 / V / E の Task、Decision record、Analyzer report、`package.json`、`playwright.config.js`、MP・スタミナ・戦闘・セーブのロジック

## Out of Scope Changes
None（D2〜D6 変更なし / MP 変更なし / C2 / V 変更なし / E 変更なし / 新しい semantic glyph なし）

## Risks
- 同一セッションで兼務のレビュー（Human 差分確認で補完）
- E2E は Targeted。通常の `npm test`・E2E 全体・iPhone 実機は NOT_RUN
- `tests/ui-proto-gate.spec.js:92` の BASELINE FAIL は C2 側の既存問題として未解決（D1 の範囲外）
- Minor M-1〜M-3・Nit N-1〜N-3 は未修正（D1 の再修正条件にしない）

## Required Changes
None
