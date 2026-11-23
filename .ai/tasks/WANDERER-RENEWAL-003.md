# WANDERER-RENEWAL-003 — 影の旅人の攻撃モーション重量感調整・最終マージ

Status: REVIEWING

Analysis: .ai/reports/WANDERER-RENEWAL-003-analysis.md（branch `claude/wanderer-renewal-001-nhlxns` @ `cc2384cc1b0f18aaf58f3ec24dc67f3e2d58e2b3`、blob `939af04bc76619188795bb2486480b077bc476ba`）

## Approval
- [x] Approved
- Approval type: Human Approval（Human の依頼「WANDERER-RENEWAL-003」2026-11-23。動作の調整方針と、条件を満たした後の PR #145 の merge（base `claude/road-visual-003-r3-7`）を Human が許可）
- Escalation Check: None
- Approved by / date / where: Human（依頼文）/ 2026-11-23 / Claude Code セッション。記入: Planner（Agent）
- Scope of approval: 下の Implementation Plan と、PR #145 の現在の base への merge（main への base 変更・merge は禁止）
- Persistence: 許可（branch: `claude/wanderer-renewal-001-nhlxns`、PR #145 を更新）

Implementation: 開始可

## Goal
影の旅人の攻撃モーションを少し遅くし、巨大な影の手に見合う重量感を与えて完成させる。CI の失敗（glyph のテストの古い期待値）を直す。完了条件を満たしたら PR #145 を現在の base へ merge する。

## Implementation Plan
1. `WANDERER_CLIP_DUR`: 突き上げ 0.40→0.50 / 薙ぎ払い 0.40→0.50 / 握砕 0.62→0.78 / 影残し 0.40→0.48 / 影渡り 0.50→0.60 / 回避攻撃 0.34→0.38 / 切り上げ 0.38→0.44 / 影送り 0.80→0.95。キーフレームの割合は変えない（溜めと余韻が伸びる）。決めの姿勢の実時間を影の手の当たる時刻に重ねる（突き上げ 0.15 / 0.16、薙ぎ払い 0.15 / 0.14、握砕 0.187 / 0.18、握り込み 0.437 / 0.45）
2. 影の手: 当たる時刻・大きさ・形は変えず、当たった後に留まる・沈む時間を少し長く。影送りは倒れ込みを少しゆっくり
3. 回避: 本人の型は変えない（横へ滑る軽快さ）。小さな手の沈みだけ 0.20→0.24 秒
4. `tests/ui-production-glyphs.spec.js`: 影の旅人の Skill 1 / 2 の期待値を 🌘 / 👥（実装・docs のとおり）。剣士の glyph が出ない検査は残す
5. unit に重量感の検査（伸び幅・1 段目と 2 段目のテンポ・決めの姿勢と手の時刻のずれ 0.03 秒以内・攻撃間隔と手の時刻/大きさが不変）
6. build / unit / 影の旅人と glyph の E2E / 全 E2E、別コンテキストの Reviewer、Preview の一致を確認して merge

## Files To Change
`src/core/wanderer-style.js`、`src/legacy/parts/17-wanderer-style.js`、`tests/unit/wanderer-style.test.js`、`tests/ui-production-glyphs.spec.js`

## Files Not To Change
倍率・攻撃間隔・クールダウン・範囲・影の手の大きさと造形・配色・外見・セーブ・閃き・他職・他マップ

## Agent Decisions
| # | 決定 | 根拠 | 代替案 |
| --- | --- | --- | --- |
| WR3-1 | 遅くするのは本人の動作の長さだけ（割合のキーフレームはそのまま）。判定・手の時刻は不変 | 依頼 §1「現在値から少し遅く」§2「時間変更と判定・出現時刻は分けて管理」 | キーフレームを作り直す（大幅な作り直しは不要と指示） |
| WR3-2 | 回避の本人の型は変えない | 依頼 §1「回避は遅くしすぎず、横へ滑る軽快さを維持」 | 回避も遅くする |
| WR3-3 | 武器表示のバッジ（🗡️、kit の大剣の表示）は今回変えない | 依頼 §3（目的外の変更禁止）。glyph テストの他の期待値も変えない | バッジを消す（UI の変更） |

## Escalation
None

## Status History
| Date | Target | From → To | By | Note |
| --- | --- | --- | --- | --- |
| 2026-11-23 | Task | — → ANALYZING → APPROVED | Orchestrator / Planner | Human 依頼。PR #145 head `493c69f` / base `claude/road-visual-003-r3-7`（`f99e346`）を確認。Analyzer report `cc2384c`。H-1〜H-8 確認 |
| 2026-11-23 | Task | APPROVED → IMPLEMENTING → TESTING → REVIEWING | Implementer | Plan Handoff（`9e7af94`、blob `57d0726`）H-1〜H-8 確認。build / unit 2332 / E2E 12 PASS。全 E2E は CI |

## Implementation Result

### Artifact Handoff
| Kind | Path | Source | Blob SHA | 確認 |
| --- | --- | --- | --- | --- |
| analysis | `.ai/reports/WANDERER-RENEWAL-003-analysis.md` | `claude/wanderer-renewal-001-nhlxns` @ `cc2384cc1b0f18aaf58f3ec24dc67f3e2d58e2b3` | `939af04bc76619188795bb2486480b077bc476ba` | H-1〜H-8 OK |
| plan | `.ai/tasks/WANDERER-RENEWAL-003.md` | `claude/wanderer-renewal-001-nhlxns` @ `9e7af94958e4e64b747ade59a9f256801e5b3165` | `57d072666a7000d557181ce64a7ae456b80592b1` | H-1〜H-8 OK |

### Changed Files
| ファイル | 変更 |
| --- | --- |
| `src/core/wanderer-style.js` | `WANDERER_CLIP_DUR` を 1.12〜1.26 倍（下表）。握砕の握り込みのキーフレームの割合を `WANDERER_GRAB_CLOSE_FRAC`（0.56、値は不変）として定数化 |
| `src/legacy/parts/17-wanderer-style.js` | 影の手の当たった後の留まり・沈みを長く（当たる時刻は不変）、影送りの倒れ込みを 0.14 → 0.18 秒、回避の小さな手の沈み 0.20 → 0.24 秒 |
| `tests/unit/wanderer-style.test.js` | 重量感の検査を追加 |
| `tests/ui-production-glyphs.spec.js` | 影の旅人の Skill 1 / 2 の期待値を 🌘 / 👥（実装・docs のとおり。剣士の glyph が出ない検査は維持） |

| 動作 | 変更前 | 変更後 | 決めの姿勢の実時間 / 影の手 |
| --- | --- | --- | --- |
| 突き上げ | 0.40 | 0.50 | 0.150 / 0.16（前 0.120） |
| 薙ぎ払い | 0.40 | 0.50 | 0.150 / 0.14（前 0.120） |
| 握砕 | 0.62 | 0.78 | 腕を広げる 0.187 / 0.18、握り込み 0.437 / 0.45（前 0.149 / 0.347） |
| 影残し | 0.40 | 0.48 | |
| 影渡り | 0.50 | 0.60 | |
| 回避攻撃 | 0.34 | 0.38 | |
| 切り上げ | 0.38 | 0.44 | |
| 影送り | 0.80 | 0.95 | 当たる時刻は上限 0.30 秒のまま（ultClipWarp が見た目を合わせる） |
| 回避（本人） | 共通 0.2 秒 + DODGE_MOTION | 変更なし | 小さな手の沈みだけ 0.20 → 0.24 |

### Test Report
- Scope: Targeted（ローカル）+ Full Regression（CI の Test ワークフロー、最新 head）
- Executed: `npm run build`、`npm run test:unit`（2332）、E2E wanderer-renewal / ui-production-glyphs / auto-combo（12）
- Environment: WANDERER-RENEWAL-001 と同じ

| テスト | 結果 |
| --- | --- |
| build | PASS |
| unit（2332） | PASS |
| E2E 12 件 | PASS |
| 全 E2E | CI で確認（PR 本文と Final Report に記載） |

### Acceptance
- 倍率・攻撃間隔・クールダウン・範囲・影の手の大きさ/造形/時刻・配色・セーブ・閃き・他職: 変更なし（unit で攻撃間隔・手の時刻・大きさを検査）
