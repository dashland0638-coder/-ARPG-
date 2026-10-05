# UI-002-D-D6 Analysis

## Task
UI-002-D / WI-D6 戦闘中の状態表示（インタラクト・処刑・コンボ・制限時間・ボスバー）（Human Goal 2026-10-02「WI-D6 を完遂」。Agent Protocol 2.0）

## Summary
- FACT: インタラクト `#interact-btn`（bottom 22%）・処刑 `#execute-prompt`（bottom 28%）・コンボ `#combo-indicator`（bottom 15%）は、いずれも `left:50%` の画面下中央の 1 列（`main.css`）。HD-D16 の「下中央単一列から分離」が未実施
- FACT: 制限時間 `#scenario-timer`（top 64px 中央）・ボスバー `#boss-bar-wrap`（top 14px、`width:min(520px,78vw)` 中央）は 1280×800 では他と重ならないが、844×390 ではボスバー（x 162–682）が Character Zone（WI-D4 後 x 16–364、safe-area 左 47 で x 63–411）と重なる（WI-D4 Known Limitation、WI-D6 へ引き継ぎ）。制限時間（x 約 380–460、y 64–90）も safe-area ありで Character Zone の右端と重なる
- FACT（WI-D5 Known Limitation、A-3 で「WI-D6 の配置と合わせて扱う」）: 844×390 で左下ログ `#msg-log`（left 12・bottom 84・最大 6 行・64vw）がスティックの領域（`.joy-zone` 左 48%・下 46%）と縦に重なる（HDR-11）

## Cross-WI constraints（WI-D2〜D5 の記録から）
| 制約 | 出典 | D6 での扱い |
| --- | --- | --- |
| 常時表示は中央 60%×60% に入らない。一時・条件付き表示（処刑・インタラクト・トースト）は中央可 | HD-D02 / HD-D30 | 処刑・インタラクトは中央可、ボスバー・制限時間は条件表示（中央可だが上の帯を優先） |
| 位置・寸法・viewport ごとの配置・safe-area は D、見た目は V / C2 | HD-D28 | 位置だけを変える。大きさ・色・文言は変えない |
| 844×390 は `@media (max-height: 500px)`、body 属性なし | HD-D34 / HD-D04 | 同じ条件を使う |
| safe-area はエミュレーション値（上 0 / 左 47 / 下 21 / 右 47）で検証 | HD-D35 | 同じ値で検証 |
| 左上 Character Zone: 844×390 で 16,8 348×66（上の帯）、所持品 y 79 | WI-D4 実測 | ボスバー・制限時間を重ねない |
| 右上 Mini-map Zone: 右 inset の内側、`20vw` 幅の帯 | WI-D2 | ボスバーを右の帯（x ≥ 80vw）へ伸ばさない |
| Action Zone: 844×390 タッチは右の帯（攻撃・JUMP・回避）と下の帯（Ult・Skill 1・Skill 2・回復・Skill 3）、PC は右下の列（下端 48px）。Action ボタンはタップを受け取る | WI-D3 | 処刑・インタラクトがボタンを覆わない。コンボは Action Zone の近く |
| PC 操作ヒント（下中央、5 秒） | HD-D24 / WI-D3 R2 | コンボ・処刑・インタラクトを重ねない |
| 通知: 中央トースト（top 30% から上へ）・左下ログ | WI-D5 | 処刑・インタラクトとトーストは共に一時表示 |
| Arena（テストモード）: 左上ゾーンの末尾 | WI-D2 | ログを上へ動かす場合はテストモードでの重なりを記録 |

## Existing System Search
| 探したもの | 検索語 / 範囲 | 結果 |
| --- | --- | --- |
| 処刑の対象 | `currentExecutionTarget` | `11-combat-actions.js`（敵 `en.group.position`）。表示は `14-hud-boot.js` `updateExecutePrompt()`（`.show` のみ） |
| インタラクトの対象 | `updateInteractPrompt` | `02-world-common.js`。対象は `nearbyShadowGuide / Door / Stairs / Key / Lore / Chest / StallTrigger / Bartender / Smith / Checkpoint`。位置はいずれも `.pos`（Vector3）か定数（`BARTENDER_POS` / `SMITH_POS` / `SHADOW_GUIDE_POS`） |
| 画面への投影 | `project(camera)` | `spawnDamagePopup` / `spawnPickupPopup`（`11-combat-actions.js`）が `Vector3.project(camera)` で画面座標にしている（既存の方法） |
| コンボ | `updateComboIndicator` | `14-hud-boot.js`（段数と猶予バー、`.show`） |
| 中央侵入の計測 | `centralIntrusion` | `tests/helpers.js` |
| 処刑・インタラクトを見る E2E | `execute-prompt\|interact-btn` | `.show` の判定（execution-break ほか）、`#interact-btn` のクリック・文言 |

## Root Cause
FACT: 3 つの一時表示が CSS の固定値（`left:50%` / `bottom:%`）で画面下中央に並ぶ。対象の位置を使っていない。ボスバー・制限時間・ログは 844×390 用の配置を持たない。

## Constraints
- Forbidden（Task）: 判定ロジック（`currentExecutionTarget()` / `updateInteractPrompt()` の判定）、入力（R キー・タップ）、`.show` の意味、文言、具体的なサイズ・デザイン
- 1280×800 のボスバー・制限時間は他と重ならない（変えない）

## Scope of Change
`src/styles/main.css`、表示位置の計算（`src/core/` の純粋関数 + `14-hud-boot.js` / `02-world-common.js` の位置の書き込みのみ）、`src/legacy/concat-plugin.js`（import）、unit / E2E

## Unknowns
- ESCALATION 候補: なし（位置は HD-D28 で D の責務。HD-D16 が役割ごとの配置の方針を決めている）

## Recommended Next Step
Planner: 処刑・インタラクトは対象の上に追従（中央の領域に収める）、コンボは Action Zone の近く、ボスバー・制限時間は 844×390 で Character Zone と Mini-map Zone の間、ログは 844×390 でスティックの上へ。
