# Decision

## ID

DEC-005（HD-CR02-1）

## Date

2026-10-08

## Decision

**a**: 影の旅人（加入後）の通常攻撃・Skill の斬撃エフェクトの色を、必殺技「影送り」と同じ影の紫 `0x8a5ad6` に統一する。

- 変更は `CLASSES.wanderer.atkColorHex` の表示だけ（斬撃・軌跡・着地の光）
- モーション、攻撃判定、ダメージ、Skill 構成、戦闘バランスは変更しない（剣士の kit のまま）
- 素手専用モーションと本格的な「影による攻撃」は、別 Work Item として保留（影の旅人の戦闘スタイルの決定後）

## Reason

- 「影を利用した攻撃表現」に、未決定の戦闘スタイルを決めずに一番近い（既存の必殺技の色に揃えるだけ）
- 表示のみで、Chapter 1 System Freeze（Skill のルール・数値）に触れない

## Alternatives Considered

1. **b**（現状のまま、剣士の赤い斬撃）— 不採用
2. **c**（CR-02 で素手モーションと影の攻撃 VFX を作る）— 不採用。新しい戦闘表現の設計が必要で、Freeze に近い

## Consequences

- CR-02-07 で実装（`01-character-creation.js`、`tests/unit/wanderer-attack-color.test.js`）
- `docs/CHARACTERS.md` の「影の旅人の武器」に記載
- 素手モーション・影の攻撃は未着手の別 Work Item

## Related Tasks

- `.ai/reports/CR-02-analysis.md` §9
- `.ai/tasks/CR-02.md` CR-02-07
