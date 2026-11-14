# CLOCKTOWER-MAP-001 — 時計塔の壁・街並みの視界遮蔽改善

Status: DONE（Agent 側）／ HUMAN DEVICE CHECK REQUIRED（iPhone 実機は未確認）

基準: `main` @ `0d7b7df`（PR #122 のマージ後）。ブランチ: `claude/dazzling-maxwell-y3msf3`（main から作り直し）。main へはマージしない。
調査・設計: `.ai/reports/CLOCKTOWER-MAP-001-analysis.md` / 試験: `-test-report.md` / レビュー: `-review.md`
Human Decision: `.ai/decisions/DEC-023-clocktower-view.md`

## Approval
- [x] Approved — Human Request（2026-11-14「CLOCKTOWER-MAP-001」）
- Escalation: E-3 / E-5「街が開ける階（鐘楼か屋上か）」→ Human の回答「鐘楼から開く」（2026-11-14）。解決済み

## Work Items
| # | 内容 | 状態 |
| --- | --- | --- |
| 1 | 原因の調査（壁の高さ・描画の層・外観・カメラ） | DONE |
| 2 | 画素で数える視界の試験（直す前に漏れを再現） | DONE |
| 3 | 外壁の内側の面・カメラを外壁の内側に留める | DONE |
| 4 | Build / Unit / E2E / 独立レビュー / 文書 / PR | DONE |
| — | iPhone 実機 | **未確認（Human）** |
