# CLOCKTOWER-003 — リフト誘導改善・管理人と娘の影の表示修正

Status: DONE（Agent 側）／ HUMAN DEVICE CHECK REQUIRED（iPhone 実機は未確認）

基準: `main` @ `fb0a043`（PR #123 のマージ後）。ブランチ: `claude/clocktower-003`（最新 main から新規。PR #123 のブランチは変えていない）。main へはマージしない。
調査: `.ai/reports/CLOCKTOWER-003-analysis.md` / 試験: `-test-report.md` / レビュー: `-review.md`

## 作業開始条件
- PR #123 は依頼時点で未マージ（CI 実行中）。同じ塔のコード（03）を変え、WI-2 の見え方の確認は PR #123 の外壁の内側の面・カメラの留めに左右されるため依存ありと判断し、調査（読むだけ）だけ先に行い実装は待った
- 2026-11-14 05:27 に PR #123 がマージされたのを確認し、最新 main から新しいブランチで実装を始めた

## Approval
- [x] Approved — Human Request（2026-11-14「CLOCKTOWER-003」）
- Escalation Check: None（鐘のイベントの意味「鐘の振動で昇降台の留め金が外れる」・台詞・発生順は変えない）

## Work Items
| # | 内容 | 状態 |
| --- | --- | --- |
| WI-1 | 鐘の後の昇降台: 留め金が外れる所を映す・乗り場で待つ・灯りと枠・乗ると上がる・乗り遅れても戻る・上の口から呼べる | DONE |
| WI-2 | 管理人と娘の影: 演出の間も濃さを進める（時計塔だけ）・淡い色・縦穴の縁の管理人の位置と大きさ | DONE |
| — | iPhone 実機 | **未確認（Human）** |
