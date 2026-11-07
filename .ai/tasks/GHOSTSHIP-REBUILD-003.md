# GHOSTSHIP-REBUILD-003 — 幽霊船の空間認識・探索体験・演出の改善

Status: DONE（Agent 側。PR 作成済み）／ CONTENT READY = HUMAN DEVICE CHECK REQUIRED（iPhone 実機は未確認）

基準: PR #114（`claude/ghostship-rebuild-002` @ `ec6ae3d`、open・未マージ）
作業ブランチ: `claude/ghostship-rebuild-003`（PR の base = `claude/ghostship-rebuild-002`）
調査: `.ai/reports/GHOSTSHIP-REBUILD-003-analysis.md` / 実装: `-implementation.md` / 試験: `-test-report.md` / レビュー: `-review.md`

## Approval
- [x] Approved
- Approval type: Human Request（2026-11-07 の依頼文。実機の感想に基づく改修の指示）
- Escalation Check: None（物語の核・異常の順番・ループ一度・鎖の一本道・敵とボス・セーブ形式は変えない）
- Persistence: 許可（branch: `claude/ghostship-rebuild-003`、PR #113・#114 はマージしない）

## Goal
実機で「部屋が孤立している・方向と階層が分からない・同じ場所と分からない・矢印が見えない・穴の板が見えない・
食堂の机が見えない・酒場の会話が無い」と感じた点を、既存の幽霊船の仕組みを使い回して直す。

## Work Items

| WI | 内容 | 状態 | 確認 |
| --- | --- | --- | --- |
| P0-1 | 船の形の連続したマップ（階層ごとの一続きの床・開口・階段/梯子/昇降口）。扉 4 つ | DONE | unit `ghostship-map`（到達・開口・扉の数） |
| P0-2 | 船首/船尾/左右舷・階層の表示（部屋名に階層を前置き）・低い壁 | DONE | unit・画面写真 |
| P0-3 | 帰還不能の前後で同じ場所（共通の目印・同じ寸法の写し・食堂 ⇄ 船員室の入れ替え） | DONE | unit `ghostship-map`（写しのずれ）・`ghostship-runtime` |
| P1 | 場面のカメラ（見せてから台詞）、船の向きを保つカメラ（幽霊船だけ） | DONE | unit `ghostship-runtime`（shot → line の順）、E2E |
| P2 | 魔法の印 3 つ（光・輪郭・明滅・近づくと反応） | DONE | unit（印の指す先）・画面写真 |
| P3-1 | 船底の穴: 印が消えた出口を指す・光の輪郭 | DONE | unit・画面写真 |
| P3-2 | 酒場の帰りの会話（本編・テストモード、一度だけ） | DONE | unit `ghostship-story` / `chapter1-mansion-to-village`、E2E `ghostship-chapter1` 4 |
| P4 | 試験・独立レビュー・報告・PR | DONE | 試験報告・レビュー |
| P5 | 実機確認 | **未確認（Human）** | 実装報告の手順 |

## 参考画像
依頼文の画像は会話に届いていない。文章の特徴を基準にした（調査 §冒頭）。届けば配置の照合を追加で行う。
