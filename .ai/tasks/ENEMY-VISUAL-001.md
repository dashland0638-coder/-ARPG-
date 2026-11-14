# ENEMY-VISUAL-001 — 幽霊船・時計塔 敵キャラクター全面刷新

Status: DONE（Agent 側）／ HUMAN DEVICE CHECK REQUIRED（iPhone 実機は未確認）

基準: `main` @ `873d3db`（PR #121 のマージ後）。ブランチ: `claude/dazzling-maxwell-y3msf3`（main から作り直し）。main へはマージしない。
調査・設計: `.ai/reports/ENEMY-VISUAL-001-analysis.md` / 試験: `-test-report.md` / レビュー: `-review.md`
仕様: `docs/ENEMIES.md`。Human Decision: `.ai/decisions/DEC-020-sea-clock-foes.md`

## Approval
- [x] Approved — Human Request（2026-11-13「ENEMY-VISUAL-001：幽霊船・時計塔 敵キャラクター全面刷新」）
- Escalation Check: None

## Work Items

| Phase | 内容 | 状態 |
| --- | --- | --- |
| A | 両ダンジョンの敵一覧・現状評価（見た目・モーション・攻撃・役割・問題点・再利用） | DONE |
| B | 代表敵 2 体（亡霊船員・歯車機兵）を先に作り、シルエット・予兆・攻撃の循環・負荷をブラウザで確認 | DONE |
| C | 残りの通常種・強化種・変異種（計 12 種） | DONE |
| D | ボスの見た目（船長・止刻の残響）。攻撃・段の仕組みは既存 | DONE |
| E | 配置（組み合わせ）・予兆と隙の数値 | DONE |
| F | Build / Unit / E2E / 独立レビュー / 文書 / PR | DONE |
| — | iPhone 実機 | **未確認（Human）** |

## Agent Decisions
- 近接の敵は既存の状態機械（洋館の使用人と同じ）と器に乗せる。器へ足したのは lunge / followUp / telegraphReach / telegraphAll だけ（既存の敵には効かない）
- 固有の AI は二つだけ（深海の異形・時間の残響）
- 数値（HP・攻撃力・経験値・金）は配置の既存の値のまま。難易度は予兆と隙で作る
- 第一章の幽霊船の「骨・腐敗・流血は無い」方針（GHOSTSHIP-REBUILD-002）は、依頼の「溺死・異形」に合わせて「流血・骨は無い、腐敗の色と海の生物は使う」へ
- 新しいパーツは `16-foes-sea-clock.js`（各パーツが末尾の開いたコメントで次のパーツへ繋がっているため、最後に置く）
