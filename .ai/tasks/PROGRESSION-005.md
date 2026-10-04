# PROGRESSION-005

Status: DONE

Analysis: .ai/reports/PROGRESSION-005-analysis.md（branch `claude/agent-autonomous-execution-ewtk87` @ `a57f7bd5e59755316927c379da9362cfb2f498b0`、blob `9d4268050555f8fbd45d88e584271f155b490061`）

## Approval
- [x] Approved
- Approval type: Agent Approval（`../AGENTS.md` §6.1。仕様は Human Decision C-1）
- Escalation Check: None（E-1: C-1 どおり / E-2: 矛盾なし / E-3: 新しい仕様なし（各職の技は HD-1 として決めない）/ E-4: セーブは消さない・変換しない / E-6・E-7・E-9: 該当なし）
- Approved by / date / where: Planner (Agent) / 2026-10-04 / branch `claude/agent-autonomous-execution-ewtk87`
- Scope of approval: 下の Files To Change
- Persistence: 許可（branch: `claude/agent-autonomous-execution-ewtk87`、根拠: セッション割当の開発ブランチ。AD-003）。PR は #32 を更新する（AGENTS.md §21）

Implementation: ALLOWED

## Goal

第一章本編では、Skill 1 を職業固有の既定技に固定する（C-1 の実装）。プレイヤーは Skill 1 を付け替えられない。各職の具体的な Skill 1 は HD-1 として未決定で、今回は決めない（Human、2026-10-04）。

## Implementation Plan

| Step | ファイル | 変更 |
| --- | --- | --- |
| 1 | `src/legacy/parts/12-progression-ui.js` `skill1VariantUsable(v)` | 本編（`!legacyGrowth()`）では `v.key === defaultSkill1For(職)` の技だけ使える。テストモードの分岐は変更前と同じ |
| 2 | 同 `renderSkillPanel` のスキル1 サブタブ | 本編ではカードを押せない形（`data-variant` 無し・`cursor:default`。Skill 2・必殺技の「固定」と同じ）、見出し「付け替え可能」→「固定」。テストモードは従来どおり |
| 3 | `tests/unit/chapter1-growth-effects.test.js` | 判定と画面の構造（PROGRESSION-003 の `skill1VariantUsable` の構造の assertion は、本編の固定の分岐を含む形へ更新。テストモードの分岐の確認は残す） |
| 4 | `tests/chapter1-old-save-growth.spec.js` | 本編: 加入後の鑑定所のスキル1 は既定の技 1 枚だけ・押せない・「固定」、保存された基本の技（回転など）が HUD に出ない、`skillChoice` は残る。剣士（加入前の本編、施設なし）でも HUD は既定。交代後も既定。テストモード: 付け替えられる |

## Files To Change
上の表のファイルと `.ai/` の記録（本 Task file、review report）

## Files Not To Change
`core/chapter1-rules.js`（`defaultSkill1For` / `CHAPTER1_SKILL1` に行を足さない = HD-1 を決めない）、Skill 1 の技の定義・性能・名称・アニメーション、セーブの読み書き、主人公の交代、Skill 2・必殺技、施設の進行、テストモード

## Test Plan
- 新規 E2E・unit を実装前に追加し、変更前の src で FAIL を確認
- build / unit / `ai-protocol` / E2E 全体（2 CPU）/ GitHub Actions

## Acceptance Criteria
- AC-S1 本編では Skill 1 が `defaultSkill1For(職)` の技に固定され、保存された別の技（基本の技・新技・上位職の技）は使われない
- AC-S2 本編の鑑定所のスキル1 は既定の技だけを表示し、付け替えの操作が無く、見出しが「固定」
- AC-S3 `skillChoice` などの保存値は書き換えない
- AC-S4 交代後も各主人公の既定の技
- AC-S5 テストモードは従来どおり付け替えられる

## Agent Decisions
| # | 決定 | 根拠ソース（AGENTS.md §17.2） | 代替案 |
| --- | --- | --- | --- |
| S-1 | 固定の判定を `skill1VariantUsable` に入れる | PROGRESSION-003 の「使えない技は既定へ」の仕組みがそのまま使える。戦闘・HUD・鑑定所が同じ判定を通る（条件を散らさない） | ロード時・交代時に `skillChoice` を書き換える（保存値が変わる） |
| S-2 | 既定の技は `defaultSkill1For` | 既存の既定。HD-1 が決まれば `CHAPTER1_SKILL1` を変えるだけで反映される | 新しい表を作る |
| S-3 | サブタブは既存の「固定」の見せ方（Skill 2・必殺技と同じ）を使い、情報の表示は残す | UI を再設計しない（Human の指示）。確認の表示を隠す必要は無い | サブタブを出さない（UI-002-F HD-2 の範囲） |

## Implementation Result

### Chapter 1 / Test Mode の挙動
| | 本編（第一章） | テストモード |
| --- | --- | --- |
| Skill 1 の技 | `defaultSkill1For(職)` に固定（魔法使い = 幻影歩法、剣士・盗賊・弓師 = 既存の既定 `retreat` 系。正式な技は HD-1 で未決定） | 選んだ技（基本の技・解放済みの新技・転身済みの上位職の技） |
| 鑑定所のスキル1 | 既定の技 1 枚、押せない、見出し「固定」 | 従来どおり一覧・付け替え可能 |
| 保存値 | `skillChoice` 等は書き換えない（本編で書き換わるのは既存の交代処理だけ） | テストモードは保存しない（既存） |

### Changed Files
- `src/legacy/parts/12-progression-ui.js`（`skill1VariantUsable` の本編の分岐、スキル1 サブタブ）
- `tests/unit/chapter1-growth-effects.test.js`（1 件追加、PROGRESSION-003 の構造の確認を更新）、`tests/chapter1-old-save-growth.spec.js`（4 件追加）

### Test Report
| テスト | 結果 | メモ |
| --- | --- | --- |
| Build | PASS | |
| Unit | PASS | 1628 件中 1627 PASS / 0 FAIL / 1 SKIP（既存）。変更前の src で 2 件 FAIL |
| Protocol | PASS | 16 / 16 |
| 新規 E2E（変更前の src） | 2 FAIL / 2 PASS（期待どおり） | 本編の 2 件が FAIL（HUD に 🌌、剣士の glyph が無い）。交代・テストモードは回帰の確認 |
| 関連 E2E（変更後） | 26 / 26 PASS | `chapter1-old-save-growth`・`chapter1-facility-access`・`ui-production-glyphs`・`chapter1-skill2` |
| E2E 全体（2 CPU） | **237 passed** | |
| GitHub Actions（`9b75206`） | **success** | |

## Status History
| Date | From → To | By | Note |
| --- | --- | --- | --- |
| 2026-10-04 | （新規）→ PLANNED → IMPLEMENTING | Orchestrator / Analyzer / Planner | Analysis `a57f7bd`、Plan `4bee9dd`（Agent Approval。仕様は Human Decision C-1） |
| 2026-10-04 | IMPLEMENTING → TESTING → REVIEWING | Implementer / Tester | Implementation `9b75206` |
| 2026-10-04 | REVIEWING（Reviewer PASS） | Reviewer | Round 1/3 PASS |
| 2026-10-04 | REVIEWING → DONE | Orchestrator（Completion commit） | PR #32 の本文を更新。Merge required: Human approval |

### Autonomy Metrics（PROGRESSION-005）
- Human Escalation Count: 0
- Human Decision Count: 0（C-1 は既決。新しい決定はなし）
- Auto Fix Count: 0
- Reviewer Round Count: 1
- Test Retry Count: 0
- PR Created: Yes (#32。同じブランチの既存 PR の本文を更新。AGENTS.md §21)

