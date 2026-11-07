# GHOSTSHIP-REBUILD-004 — 幽霊船の最終視認性改善・全ダンジョン共通描画ルール整備

Status: DONE（Agent 側。PR 作成済み）／ CONTENT READY = HUMAN DEVICE CHECK REQUIRED（iPhone 実機は未確認）

基準: PR #115（`claude/ghostship-rebuild-003` @ `b16100b`、未マージ）。作業ブランチ: `claude/ghostship-rebuild-004`（PR の base = `claude/ghostship-rebuild-003`）
調査: `.ai/reports/GHOSTSHIP-REBUILD-004-analysis.md` / 実装: `-implementation.md` / 試験: `-test-report.md` / レビュー: `-review.md`
共通方針: `docs/DUNGEON_RENDERING.md`

## Approval
- [x] Approved
- Approval type: Human Request（2026-11-07 の依頼文と追加指示）
- Escalation Check: None（物語・マップの構造・イベントの進行・ボス・セーブ形式は変えない）
- Persistence: 許可（branch: `claude/ghostship-rebuild-004`、`main` へはマージしない）

## Work Items

| WI | 内容 | 状態 | 確認 |
| --- | --- | --- | --- |
| A-1 | 共通の描画・カメラ方針の文書化（`docs/DUNGEON_RENDERING.md`） | DONE | unit `dungeon-rendering` |
| B-1 | 点呼の廊下の影の視認性 | DONE | 画面写真、unit |
| B-2 | 船の外側を黒く（海を船内から見せない） | DONE | 画面写真（上から・実際のカメラ）、unit |
| B-3 | 隣の部屋の先行表示の抑制（部屋ごとの区画） | DONE | unit `ghostship-runtime`（見せる部屋）、画面写真 |
| B-4 | 錨の鎖の視認性（辿る段階から） | DONE | unit（後から足した鎖も光る）、画面写真 |
| B-5 | 船底の穴を塞いだ板の色調 | DONE | unit、画面写真 |
| C-1 | 森の洋館の描画欠落の原因調査と修正 | DONE | 修正前後の画面写真、unit、E2E（洋館） |
| C-2 | 他のダンジョンの同種の問題の確認 | 一部 | 宵待ちの村は問題なし。時計塔・神殿・水路・温室・道は **未確認** |
| D-1 | 試験・独立レビュー・報告・PR | DONE | 試験報告・レビュー |

## 残件（今回は実装しない。完了扱いにしない）
- `.ai/tasks/CAMERA-MANSION-001.md` — 森の洋館の「見せてから話す」カメラ（**TODO**）
- `.ai/tasks/CAMERA-DUSKVILLAGE-001.md` — 宵待ちの村の「見せてから話す」カメラ（**TODO**）
- 時計塔・神殿・水路・温室・道の描画確認（**未確認**）
