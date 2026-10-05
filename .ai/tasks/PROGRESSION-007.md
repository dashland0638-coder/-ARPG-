# PROGRESSION-007

Status: DONE

Analysis: .ai/reports/PROGRESSION-007-analysis.md（branch `claude/chapter1-smith-shop-hd2-hd3` @ `3595b00d2d8e1bc25738adeabe8d4d369e9a058b`、blob `cc1f3a5a0b35e131c7f90143d18cfab74cfa0434`）

## Approval
- [x] Approved
- Approval type: Agent Approval（`../AGENTS.md` §6.1。仕様は Human Decision HD-2 / HD-3、2026-10-05）
- Escalation Check: None（E-1: HD-2 / HD-3 どおり / E-2: 既存実装と矛盾なし / E-3: 第一章後の仕様は決めない / E-4: セーブは消さない・変換しない / E-6・E-7・E-9: 該当なし）
- Approved by / date / where: Planner (Agent) / 2026-10-05 / branch `claude/chapter1-smith-shop-hd2-hd3`
- Scope of approval: 下の Files To Change
- Persistence: 許可（branch: `claude/chapter1-smith-shop-hd2-hd3`、根拠: Human の指示（最新 main から新しい branch・新しい PR））

Implementation: ALLOWED

## Goal

HD-2（第一章の鍛冶屋は装備管理・確認施設）と HD-3（第一章ではショップで買えない）を、既存実装（PROGRESSION-004 / 005 / 006）と矛盾しない形でコード・テスト・記録へ反映する。

## Chapter 1 Facility Rule（実装する規則）

| 機能 | 本編・加入前 | 本編・加入後（第一章） | テストモード（第一章後の基盤） |
| --- | --- | --- | --- |
| 施設そのもの | なし（PROGRESSION-004） | あり（見出し「鍛冶屋」、インタラクト「装備の管理」） | あり（見出し「鑑定所」） |
| 装備する / 外す / 性能を見る / 売却 | — | 可 | 可 |
| スキルの習得状況・説明を見る | — | 可（Skill 1 固定・Skill 2 固定・必殺技固定） | 付け替え可 |
| 鑑定・強化・ステータス配分・スフィア盤・スキル3・パッシブ | — | 不可（既存） | 可 |
| 鍛造・クラフト | — | 不可（処理なし） | 処理なし |
| ショップでの購入 | — | **不可（HD-3、今回）** | 可 |

## Implementation Plan

| Step | ファイル | 変更 |
| --- | --- | --- |
| 1 | `tests/unit/chapter1-smith-shop.test.js`（新規）、`tests/chapter1-smith-shop.spec.js`（新規） | 実装前に追加し、変更前の src で FAIL を確認 |
| 2 | `src/legacy/parts/12-progression-ui.js` | `LEGACY_AP_TABS` に `shop`。`renderShopPanel` は本編で購入ボタンを作らず、クリック処理も `apTabAvailable('shop')` で止める。見出しは本編「鍛冶屋」/ テストモード「鑑定所」 |
| 3 | `src/legacy/parts/02-world-common.js` | インタラクト: 本編の加入後「🔨 鍛冶士と話す(装備の管理)」。テストモードは従来どおり |
| 4 | `index.html` | メニューの操作説明「鑑定所(鍛冶士の前で)」→「鍛冶屋(鍛冶士の前で)」 |
| 5 | `src/core/chapter1-rules.js` | 施設の中身（HD-2 / HD-3）と「Skill 1 の固定は第一章だけ」をコメントに明記（ロジックは変えない） |
| 6 | 記録 | `.ai/decisions/UI-002-human-decisions.md`、`.ai/reports/UI-002-F-re-audit.md`、`docs/PROGRESSION.md` |

## Files Not To Change
`basefile.html`、装備・売却・スキル画面の処理、`smithFacilityAvailable` の条件、Skill 1 / 2 / Ult の判定、セーブの読み書き、異空間の報酬（PR #33）、第一章後（Chapter 2）の仕様

## Test Plan
- 新規 unit / E2E を実装前に追加し、変更前の src で FAIL を確認
- build / unit / `ai-protocol` / 関連 E2E / E2E 全体（2 CPU）/ GitHub Actions

## Acceptance Criteria
- AC-H1 本編の加入後: 装備する・外す・性能・売却・スキルの確認ができる
- AC-H2 本編: Skill 1 / Skill 2 / 必殺技は付け替えられない、スキル3・パッシブ・スフィア盤・ステータス配分・鑑定が出ない
- AC-H3 本編: 商店タブが出ず、購入処理も動かない
- AC-H4 本編: 施設の表示に「鑑定」「強化」が出ない（見出し「鍛冶屋」、インタラクト「装備の管理」）
- AC-H5 加入前の施設封鎖（PROGRESSION-004）は変わらない
- AC-H6 テストモード: 商店・鑑定所の見出し・インタラクトの文言は従来どおり

## Agent Decisions
| # | 決定 | 根拠ソース（AGENTS.md §17.2） | 代替案 |
| --- | --- | --- | --- |
| S-1 | 商店は `LEGACY_AP_TABS` に入れ、`renderShopPanel` のボタン生成とクリック処理も同じ `apTabAvailable('shop')` で止める | ステータス配分・スフィア盤と同じ既存の仕組み。条件を 1 か所に置く。処理側でも止める（Human の指示） | 新しい「ショップ可否」関数を作る（判定の乱立） |
| S-2 | 第一章の判定は `legacyGrowth()` | 既存の第一章判定（PROGRESSION-001〜006 と同じ）。Test Mode 判定そのもの（`state.testMode`）を各所で直接見ない | 章の判定を新設 |
| S-3 | 文言は本編「鍛冶屋」「装備の管理」、テストモードは従来どおり | HD-2「装備を管理する場所」、docs/SCENARIOS.md「鍛冶屋が加入」。テストモードには鑑定・強化が実在する | テストモードも変える（実在する機能を隠す） |
| S-4 | 装備・売却・スキル画面は変更しない | 調査で HD-2 の許可・禁止を既に満たしている（Analysis §2） | 画面を作り直す（Human の指示で不要） |

## Implementation Result

### Changed Files
- `src/legacy/parts/12-progression-ui.js`（`LEGACY_AP_TABS` に `shop`、`renderShopPanel` の処理側ゲート、見出し）
- `src/legacy/parts/02-world-common.js`（加入後のインタラクトの文言）、`index.html`（メニューの操作説明）
- `src/core/chapter1-rules.js`（コメントのみ: HD-2 / HD-3、Skill 1 固定は第一章だけ）
- tests: `tests/unit/chapter1-smith-shop.test.js`（新規 6 件）、`tests/chapter1-smith-shop.spec.js`（新規 2 件）
- 記録: `.ai/decisions/UI-002-human-decisions.md`、`.ai/reports/UI-002-F-re-audit.md`（§12）、`docs/PROGRESSION.md`

### Test Report
| テスト | 結果 | メモ |
| --- | --- | --- |
| Build | PASS | |
| Unit | PASS | 1634 件中 1633 PASS / 0 FAIL / 1 SKIP（既存）。新規 6 件は変更前の src で 3 件 FAIL |
| Protocol | PASS | 16 / 16 |
| 新規 E2E | 2 / 2 PASS | 本編の 1 件は変更前の src で FAIL（見出し「鑑定所」・商店タブ）。テストモードの 1 件は回帰の確認 |
| 関連 E2E | 6 / 6 PASS | `chapter1-facility-access`（PROGRESSION-004）+ 新規 |
| E2E 全体（2 CPU） | **238 passed / 1 flaky** | flaky は `job-traits:162`（既存の retries、テストモード、本変更の経路外） |
| GitHub Actions（`ffea540`） | **success** | |

## Status History
| Date | From → To | By | Note |
| --- | --- | --- | --- |
| 2026-10-05 | （新規）→ PLANNED → IMPLEMENTING | Orchestrator / Analyzer / Planner | Analysis `3595b00`、Plan + 回帰テスト `ce313e2`（Agent Approval。仕様は HD-2 / HD-3） |
| 2026-10-05 | IMPLEMENTING → TESTING → REVIEWING | Implementer / Tester | 実装 `bccc6bb`、記録 `ffea540`、PR #34 |
| 2026-10-05 | REVIEWING（Reviewer PASS） | Reviewer | Round 1/3 PASS |
| 2026-10-05 | REVIEWING → DONE | Orchestrator（Completion commit） | Merge required: Human approval |

### Autonomy Metrics（PROGRESSION-007）
- Human Escalation Count: 0
- Human Decision Count: 1（この Task の起点の HD-2 / HD-3）
- Auto Fix Count: 1（新規テストのセレクタ: `.appraisal-title` が 2 つあった）
- Reviewer Round Count: 1
- Test Retry Count: 0（E2E 全体の flaky 1 件は Playwright の既存の retries。手動の再実行なし）
- PR Created: Yes (#34)
