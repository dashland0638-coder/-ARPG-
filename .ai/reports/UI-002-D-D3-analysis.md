# UI-002-D-D3 Analysis

## Task
UI-002-D / WI-D3 Action Zone の操作 UI（Human Goal 2026-10-01「WI-D3 を完遂」。Autonomous Execution、DEC-002）

## Summary
- Action Zone の DOM（`#touch-controls .action-zone`）と 7 つのボタンは既にあり、位置は固定の `right` / `bottom`。回復は左上の所持品の行（`#loot-potion-btn`）にある
- Ultimate のチャージ表示は `#btn-ult` の `#ult-btn-cd`（％）と `.ready` だけで、他に重複は無い（HD-D15 は構造上満たされている）
- 844×390 では Action ボタン（Skill 1 / 2 / Ult / Skill 3）が中央 60%×60% に入る。safe-area の左右 inset は Action / スティックで未対応（D2 から D3 へ引き継ぎ）
- PC ではタッチ用ボタンが表示専用（`.gamepad-min`）で常に出ており、HD-D08 / HD-D22 の非表示化は未実施

## Existing System Search
| 探したもの | 検索語 / 範囲 | 結果 |
| --- | --- | --- |
| Action Zone | `action-zone` / `index.html`・`main.css` | あり: `index.html` `#touch-controls > .action-zone`、`main.css` `.action-zone` / `.action-btn` / `#btn-*` |
| 回復処理 | `usePotion` / `src/legacy/parts` | あり: `08-loot-equipment.js` `usePotion()`。呼び出し: `#loot-potion-btn` pointerdown（`12-progression-ui.js`）、`KeyV`（`09-save-load.js`）、パッド R1（`13-update-loop.js`） |
| 回復数の表示 | `loot-potion` | `#loot-potion` を `08-loot-equipment.js` / `12-progression-ui.js`（購入）が更新。`ui-proto-gate.spec.js` が textContent を読む |
| Ult のチャージ表示 | `ult-btn-cd\|ultGauge\|ult-fill\|ult-gauge` | `14-hud-boot.js` `updateUltHUD()` が `#btn-ult.ready` と `#ult-btn-cd` だけを更新。別の Ult ゲージは無い |
| タッチ / PC の表示モード | `touchControlsMode\|refreshTouchControls` | `src/core/combat-hud-visibility.js`（D1）、`10-input.js` `refreshTouchControls()` が `.active` / `.gamepad-min` を付ける |
| PC のタッチボタン条件 | `touchActionButtonsVisible` | D1 で条件だけ実装（現行結果のまま。実際の非表示化は D3: HD-D22）。呼び出し元なし（unit test のみ） |
| キー割当 | `e.code===` / `09-save-load.js` | J 攻撃 / L Skill 1 / O Skill 2 / U Skill 3 / K Ult / V 回復 |
| 中央侵入の計測 | `centralIntrusion` / `tests/helpers.js` | あり（D2） |

## Current Behavior（FACT）
- タッチ（`.active`）: スティック（`.joy-zone` 左 48%×下 46%）と 7 ボタン。`.action-zone` は `right:0`（右 inset なし）
- PC / パッド（`.gamepad-min`）: スティック・JUMP・回避を隠し、能力ボタンと攻撃ボタンを表示専用（`pointer-events:none`）で同じ位置に出す
- 中央 60%×60% への侵入（固定値からの計算。INFERENCE: D2 Planner report と一致）: 844×390 で `#btn-ult`（x 586–638, y 206–258）・`#btn-skill2`・`#btn-charge`・`#btn-skill3` が中央に入る。1280×800 では `#btn-ult` が中央下端に僅かに入る
- 回復は左上ゾーンの所持品の行（☰ 🧪 🔷）。HD-D32 により D3 完成まで残す

## Expected Behavior（出典）
- HD-D12: 回復アイテム専用のクイック使用 UI を Action Zone に置く。通常の所持品チップは戦闘 HUD から除外
- HD-D14: Action Zone は 攻撃 / Skill 1 / Skill 2 / Ultimate / 回復。サイズ・形・アイコン・色・階層は V / C2
- HD-D15: Ult のチャージ情報は Action Zone 内に集約、重複表示しない
- HD-D08 / HD-D22: PC ではタッチ用の攻撃・Skill 1・Ultimate ボタンを常時表示しない。戦闘情報は失わない。PC 用の操作表示を D3 で用意してから変更する
- HD-D02 / HD-D30: 常時表示 UI は中央 60%×60% を避ける（Action ボタンの侵入は D3 の責務）
- HD-D04 / HD-D34: 同じコンポーネントを viewport の CSS 条件（`@media (max-height: 500px)`）で配置替え。body 属性なし
- HD-D31: ☰ の最終位置は所持品の行の整理と合わせて決める。HD-D33: 🔷 / MP は変更しない
- WI-D3 の AC（Task）: 5 つの操作が Action Zone にあり Ult のチャージ情報が重複しない。844×390 でスティックと重ならない。既存の操作（タップ・キー・パッド）が従来どおり動く
- WI-D3 の Forbidden: スキル・攻撃・必殺・回復のゲームロジック、ボタン id、具体的なサイズ・形・色・アイコン

## Root Cause / Differences
- 回復が Action Zone に無い（HD-D12 未実施）
- PC のタッチ用ボタンが常時表示（HD-D08 未実施。D1 の条件関数は現行結果のまま）
- 固定座標の Action ボタンが 844×390 の中央に入る、右 inset 未対応

## Constraints
- ボタンの大きさ・形・色・アイコン（V / C2）、id と入力の結び付け（`bindHoldButton` 等）、ゲームロジック、MP（HD-D29 / D33）、パッド表記（HD-D05 Undecided）に触れない
- `ui-production-glyphs.spec.js`（UI-002-E）は PC（非タッチ）で `#btn-attack-glyph svg` の 24×24 を測る。PC で攻撃ボタンを隠すと測れないため、同じ検証をタッチ文脈へ移す必要がある（HD-D28 の「影響を明示する」）
- `chapter1-legacy-ui.spec.js:93-94` は PC で `#btn-charge` / `#btn-ult` の表示を確認する（PC 用の表示として残せば変わらない）

## Scope of Change
`index.html`（回復ボタンを Action Zone へ移す）、`src/styles/main.css`（Action Zone の配置・844×390・PC 表示・safe-area）、`src/core/combat-hud-visibility.js`（Action Zone のレイアウト条件）、`src/legacy/parts/10-input.js`（`refreshTouchControls` のクラス付与）、`tests/unit/combat-hud-visibility.test.js`、`tests/hud-zones-layout.spec.js`（D2 時点の 🧪 の位置の assert）、`tests/ui-production-glyphs.spec.js`（攻撃 glyph の寸法の検証をタッチ文脈へ）、新規 E2E

## Unknowns
- ☰ の最終位置（HD-D31）: 所持品の行に 🔷（HD-D33 で変更不可）が残るため行自体は撤去できない。§17.2 で決められる見込み（現状維持）
- PC 用の操作表示の具体的な見た目: V / C2。D は構造（表示専用・キー表記・配置）だけを扱う
- ESCALATION 候補: なし（PC 表示は HD-D08 / D22 から「情報を失わない PC 用表示」と導ける）

## Recommended Next Step
Planner: 既存要素の移動と CSS の配置替えを中心に、最小の計画を作る。
