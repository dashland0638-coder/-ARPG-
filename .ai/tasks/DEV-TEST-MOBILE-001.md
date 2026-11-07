# DEV-TEST-MOBILE-001 — iPhone プレビュー用テストモードの調査・導入

Status: DONE（Agent 側。PR 作成済み）／ HUMAN DEVICE CHECK REQUIRED（iPhone 実機での操作は未確認）

基準: PR #116（`claude/ghostship-rebuild-004` @ `7993885`）。作業ブランチ: `claude/dev-test-mobile-001`
調査・設計: `.ai/reports/DEV-TEST-MOBILE-001-analysis.md` / レビュー: `.ai/reports/DEV-TEST-MOBILE-001-review.md`

## Approval
- [x] Approved — Human Request（2026-11-07 の依頼文）
- Escalation Check: None（既存のテストモードを使う。通常プレイ・セーブ・入口の判定は変えない）

## Work Items

| WI | 内容 | 状態 | 確認 |
| --- | --- | --- | --- |
| P1 | 既存のテストモード・プレビュー・セーブの調査 | DONE | 調査報告 |
| P2 | 方法の決定（優先案 A: 既存の `?dev=1` を使う。新しい入口は作らない） | DONE | 調査報告 §3 |
| P3 | 幽霊船の検証地点を 3 つ足す（食堂の手前・鎖を辿る道の始まり・点呼の廊下の手前） | DONE | unit `ghostship-runtime`、E2E（iPhone の横画面・タッチ） |
| P4 | 試験・独立レビュー・PR | DONE | レビュー |
| P5 | iPhone 実機での操作 | **未確認（Human）** | PR 本文の手順 |
