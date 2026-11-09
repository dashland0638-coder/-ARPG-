# CLOCKTOWER-001 — 第一章④ 時計塔のシナリオ完成

Status: DONE（Agent 側。PR 作成済み）／ HUMAN DEVICE CHECK REQUIRED（iPhone 実機は未確認）

基準: `main` @ `ddfd2f9`（#120 のマージ後）。ブランチ: `claude/dazzling-maxwell-y3msf3`（main から作り直し。PR の base = main）
調査・計画: `.ai/reports/CLOCKTOWER-001-analysis.md` / 実装: `-implementation.md` / 試験: `-test-report.md` / レビュー: `-review.md`

## Approval
- [x] Approved — Human Request（2026-11-09 の依頼文「CLOCKTOWER-001：第一章④ 時計塔のシナリオ完成」）
- 第一章の凍結（PROGRESSION-010）に対する扱い: 明示的な Human の依頼による変更
- Escalation Check: None（既存の物語・登場順・敵とボスの数値・セーブ形式を変えない。§17.3 に当たる矛盾は無い）

## Goal
時計塔を、洋館・村・幽霊船と同じ水準の第四ステージにする。物語（CT-01〜05）は実装済みだったので、足りない
盗賊の Skill 2 の閃き・今いる空間を中心にした描画・見せてから話す・品質の細部を補う。道には着手しない。

## Work Items

| WI | 内容 | 状態 | 確認 |
| --- | --- | --- | --- |
| A | 盗賊の閃き「三連投げナイフ」（3F 針の回廊を抜けた先の通路） | DONE | unit・E2E・ブラウザでの確認 |
| B | 共通のカメラに床の高さ `y` | DONE | unit |
| C | 謎解きの部屋（2F・3F・4F）の見せてから話す | DONE | unit・ブラウザ |
| D | 塔の区画描画（洋館と同じ部品） | DONE | unit・ブラウザでの画面比較 |
| E | 5F 前室の強モブを着地点から離す（数値は不変） | DONE | unit |
| F | テストモードの開始地点（2F・3F・4F） | DONE | unit・E2E |
| G | テスト・文書・独立レビュー（Round 1 PASS）・PR | DONE | 試験報告・レビュー |
| H | iPhone 実機 | **未確認（Human）** | CHAPTER1_PLAYTEST.md §6 D-09・D-21〜D-24 |

## 既知の制限・残件
- 閃きの場面そのものの E2E は無い（3F は本編を歩き通せない）。unit とブラウザでの確認で代える
- 2F・3F・4F の階段の着地点の近くに既存の敵がいる（5F だけ離した。レビュー指摘 3）
- 見晴台では塔の中の区画を描かない（終幕が自動で始まるため影響は小さい。レビュー指摘 2）
- CT-05 の実機の通し（H-1〜H-12、B-1〜B-5）は引き続き Human 待ち
- 道: 影の旅人の閃き（技の中身が暫定）は Human の判断が要る（調査報告 §7）

## Implementation Result

### Autonomy Metrics
| 項目 | 値 |
| --- | --- |
| Human Escalation Count | 0 |
| Human Decision Count | 0 |
| Auto Fix Count | 3（既存の unit の仕組みに閃きの変数を足す 1・3F のカメラの高さ（雲越し）1・レビュー指摘の文言 1） |
| Reviewer Round Count | 1（PASS） |
| Test Retry Count | 1（`chapter1-late-scenarios` 道の戦闘不能、FLAKY） |
| PR Created | Yes（PR 番号は PR 本文を参照） |
