# STORY-001 — 第一章③ 幽霊船: 弓師の Skill 2 の閃き（スキル習得イベントの補完）

Status: DONE（Agent 側。PR 作成済み）／ HUMAN DEVICE CHECK REQUIRED（iPhone 実機は未確認）

基準: `main` @ `9ac764d`（#119 のマージ後）。ブランチ: `claude/dazzling-maxwell-y3msf3`（main から作り直し。PR の base = main）
調査: `.ai/reports/STORY-001-analysis.md` / 計画・実装: `-implementation.md` / 試験: `-test-report.md` / レビュー: `-review.md`

## Approval
- [x] Approved — Human Request（2026-11-08 の依頼文「第一章：幽霊船・弓師スキルイベント補完（STORY-001）」）
- 第一章の凍結（PROGRESSION-010）に対する扱い: 明示的な Human の依頼による変更
- Escalation Check: None（既存の物語・登場順・弓師の Skill 2 の定義・閃きの仕組みを変えない。§17.3 に当たる矛盾は見つからなかった）

## Goal
幽霊船で弓師が Skill 2 を閃く場面を、洋館（剣士）・宵待ちの村（魔法使い）と同じ型で入れる。
習得 = 自動装備、一度だけ、セーブに残る、閃いた後は実際に撃てる。時計塔・道には着手しない。

## Work Items

| WI | 内容 | 状態 | 確認 |
| --- | --- | --- | --- |
| A | 調査（閃きの仕組み・洋館/村の型・幽霊船の流れ・弓師の Skill 2・未実装の理由） | DONE | 調査報告 |
| B | 設計（置き場所・発生条件・会話・代わりの発生・再発防止） | DONE | 調査報告 §5 |
| C | 実装: 往路の食堂の戦いの後に閃き。食堂を戦わずに抜けた時は通路で。閃きの後に「帰る場所」の会話 | DONE | unit・ブラウザでの確認 |
| D | 習得処理は既存（`grantChapter1Skill2` / `learnSkill2`）。セーブ・ロードは既存の `learnedSkill2` | DONE | unit・E2E |
| E | テスト（unit 5 件・E2E 2 件） | DONE | 試験報告 |
| F | 文書（CHAPTER1_STORY / SCENARIOS / COMBAT / CHAPTER1_PLAYTEST） | DONE | — |
| G | 独立レビュー | DONE | レビュー |
| H | iPhone 実機 | **未確認（Human）** | 試験報告 §4 |

## 既知の制限
- 閃きの場面そのものの E2E は無い（食堂は入口から三部屋先で、この環境の速度では本編を歩き通せない。テストモードは Skill 2 を最初から持つ）。本物のソースを動かす unit と、ブラウザで一時的な確認用の仕組みを使った確認で代える
- 閃いた後に酒場へ戻らず中断すると、セーブされていない（洋館・村と同じ。セーブは酒場へ戻る時など）
- 時計塔（盗賊）・道（影の旅人）の閃きは未実装（次の Work Item。調査報告 §7）

## Implementation Result

### Autonomy Metrics
| 項目 | 値 |
| --- | --- |
| Human Escalation Count | 0 |
| Human Decision Count | 0 |
| Auto Fix Count | 5（unit の準備の誤り 1・unit の数え方 1・E2E のセーブの作り 2・レビュー指摘の修正 1） |
| Reviewer Round Count | 1（PASS） |
| Test Retry Count | 0 |
| PR Created | Yes（PR 番号は PR 本文を参照） |
