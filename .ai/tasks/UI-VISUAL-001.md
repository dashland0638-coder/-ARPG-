# UI-VISUAL-001 — 戦闘メッセージ・通知表示の視認性改善

Status: DONE（Agent 側）／ HUMAN DEVICE CHECK REQUIRED（iPhone 実機は未確認）

基準: ENEMY-VISUAL-002 の上（`c5435c7`）。ブランチ: `claude/dazzling-maxwell-y3msf3`（PR #122 と同じブランチ）。main へはマージしない。
調査・設計: `.ai/reports/UI-VISUAL-001-analysis.md` / 試験: `-test-report.md` / レビュー: `-review.md`
Human Decision: `.ai/decisions/DEC-022-notice-layout.md`

## Approval
- [x] Approved — Human Request（2026-11-13「UI-VISUAL-001：戦闘メッセージ・通知表示の視認性改善」）
- Escalation Check: None（UI-002-H H-D1 の「履歴を追加しない」「優先度を変えない」は、今回の依頼 §6 / §7 が明示的に求めているため DEC-022 で更新）

## Work Items
| Phase | 内容 | 状態 |
| --- | --- | --- |
| A | 表示の棚卸し（全 spawnToast / spawnLog・HUD・ボス戦 UI・会話） | DONE |
| B | iPhone（844×390・タッチ）基準のレイアウト設計 | DONE |
| C | 代表ケース（出現・ボス・警告・戦闘結果・システム）の改修と確認 | DONE |
| D | 全体展開（分類の規則で全部の通知へ） | DONE |
| E | 独立レビュー・テスト | DONE |
| — | iPhone 実機 | **未確認（Human）** |
