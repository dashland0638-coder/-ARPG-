# WANDERER-RENEWAL-001 — 影の旅人の全面刷新（バトルデザイン・戦闘モーション・外見/造形）

Status: DRAFT（未着手。残件として登録）
**優先度: 最優先**（プレイヤーキャラクター全体の更新 CHARACTER-VIS-002 に先行する独立タスク）

## Goal
5 人目の主人公「影の旅人」（`CLASSES.wanderer`、`CHAPTER_CAST[5]`）を全面的に刷新する。
- バトルデザイン（今は剣士の kit を借りている: `CLASSES.wanderer.kit = 'warrior'`。Skill 1 / Skill 2 の中身は暫定、Skill 2 の閃きは未実装 — docs/CHARACTERS.md・docs/SCENARIOS.md）
- 戦闘モーション
- 外見・造形（加入前の姿 `buildRoadTravelerFigure` と加入後のリグ）

## Constraints（既存の承認済み設計）
- 正体は第一章では明かさない。加入前は名前を出さない（DEC-004 N-4）。加入前の遅れる影 0.45 秒（DEC-030 / DEC-031）
- 斬撃の色は影の紫（HD-CR02-1 = a）。CHARACTER-VIS-001 P-D8（衣服と影エフェクトの紫は別 Material・別色）

## Out of Scope
他のプレイヤーキャラクター（CHARACTER-VIS-002）

## Approval
- [ ] Approved
- Approval type: Human Approval（未着手。着手は Human の指示を待つ）
- Escalation Check: 着手時に Analyzer が判断

Implementation: BLOCKED until approval

## Status History
| Date | Target | From → To | By | Note |
| --- | --- | --- | --- | --- |
| 2026-11-22 | Task | — → DRAFT | Agent | WI「第一章・移動中会話システムの横展開」の §8 残件として登録（Human の指示） |
