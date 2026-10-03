# UI-002-D-D4 Analysis

## Task
UI-002-D / WI-D4 Character Zone（Human Goal 2026-10-01「WI-D4 を完遂」。Autonomous Execution、DEC-002）

## Summary
- Character Zone（左上パネル `.hud-topleft`: 肖像・武器バッジ・名前・HP / MP / スタミナ・XP）は D2 で左上ゾーンに入ったが、大きさは 254×130（テストモード 254×141）で 1280×800 と 844×390 で同じ
- 1280×800 では中央 60%×60%（x 256–1024, y 160–640）に入らない。844×390（中央 x 168.8–675.2, y 78–312）では x 16–270・y 16–146 で中央に入る（D2 実測 6,882 px²、safe-area 左 47 で 10,078 px²。D2 から D4 への引き継ぎ）
- 常時表示（HD-D09）・スタミナの必要時表示（HD-D25）・本編で XP を出さないこと（HD-1）は D1 で表示条件として実装済み。MP は HD-D29 で D の対象外
- 残る D4 の作業は、844×390 で Character Zone を中央の外へ収める配置（HD-D02 / D28 / D30 / D34）

## Existing System Search
| 探したもの | 検索語 / 範囲 | 結果 |
| --- | --- | --- |
| Character Zone の DOM | `hud-topleft` / `index.html` | あり: `#hud-zone-tl > .hud-topleft`（肖像 `#hud-portrait`・`#weapon-badge`・`.hud-bars`） |
| 表示条件 | `staminaVisible\|legacyHudVisible` / `src/core/combat-hud-visibility.js`・`14-hud-boot.js` | あり（D1）。スタミナは `#sta-fill` の親（トラック）と直前の見出しを `visibility` で隠す（並びを保つ） |
| 844×390 の CSS 条件 | `max-height: 500px` / `main.css` | あり（D2 の `@media (max-height: 500px)`。D2 のコメント「D3 / D4 はこの条件で 844×390 用の配置を切り替える」） |
| 上端の余白 | `--hud-edge` / `main.css` | 左上ゾーンは 16px、右上ゾーン（ミニマップ）は 8px |
| 中央侵入の計測 | `centralIntrusion` / `tests/helpers.js` | あり（D2） |
| 上中央の表示 | `boss-bar-wrap\|scenario-timer\|debug-badge` / `main.css` | ボスバー `top:14px; width:min(520px,78vw)` 中央寄せ（844×390 で x 162–682）、制限時間 `top:64px` 中央、デバッグ表示 `top:16px` 中央。いずれも条件表示（D6 の範囲） |

## Current Behavior（FACT。実測 `ec564a6` 以降の main と同じ、2026-10-01 計測）
| 要素 | 1280×800 | 844×390 |
| --- | --- | --- |
| `.hud-topleft` | 16,16 254×130（テスト 141） | 同じ（中央へ侵入） |
| `.hud-bars` | 83,27 170×108 | 同じ |
| 肖像 | 44×44 | 同じ |
| 所持品 `#hud-loot` | 16,151 90×33 | 同じ |
| 844×390 で既に重なっているもの | — | `.hud-topleft`（x 16–270）とボスバー（x 162–682, y 14–約 50）がボス戦中に重なる |

## Expected Behavior（出典）
- HD-D09: 常時表示は 名前・肖像・HP・武器バッジ。HD-D11 / D25: スタミナは必要時
- HD-D02 / HD-D30: 常時表示 UI は中央 60%×60% に入らない（左上パネルの侵入は D4 の責務）
- HD-D04 / HD-D34: 同じコンポーネントを `@media (max-height: 500px)` で配置替え。body 属性なし
- HD-D28: 位置・寸法・viewport ごとのレイアウトは D、見た目（色・書体・形）は C2 / V を再決定しない
- HD-D29 / D33: MP の表示・ロジックは変えない
- Task: `#hud-name` の文言形式を変えない、Weapon Badge の 18px を変える場合は `ui-production-glyphs` への影響を明示

## Root Cause
FACT: `.hud-bars` は縦 1 列（名前・HP・MP・スタミナを縦に積む、`min-width:170px`）で、パネルの高さ 130px が 844×390 の上の帯（高さ 78px）にも、幅 254px が左の帯（幅 168.8px、左 inset 47 では 105.8px）にも収まらない。
INFERENCE: 左の帯は safe-area ありで 105.8px しかなく、肖像 44px と 3 本のバーを縦に収められない。上の帯（高さ 78px）へ、バーを横に並べる配置なら収まる（肖像 44 + 余白 20 + 枠 2 = 66px。上端を右上ゾーンと同じ 8px にすれば下端 74px）

## Constraints
- 1280×800 の配置・見た目は変えない（`ui-foundation.spec.js` の computed style は 1280×800）
- 肖像 44px・武器バッジ 18px・文字の大きさ・色・パネルの余白は変えない（見た目は V / C2）
- `#hud-name`・`#mp-label`・各 id、スタミナの「トラックの直前が見出し」の兄弟関係（`updateHudVisibility`）を保つ
- 844×390 のボスバーとの重なりは現状でもある（D6 の範囲）。D4 で悪化させる量は記録する

## Scope of Change
`src/styles/main.css`（844×390 の Character Zone の配置）、`index.html`（バーの見出し・トラックの組を CSS で並べるためのクラスの付与のみ。id・中身は変えない）、`tests/hud-zones-layout.spec.js`（D2 の「844×390 の左上パネルは中央へはみ出す（D4 への引き継ぎ）」の assert を D4 の結果へ）、新規 E2E

## Unknowns
- ESCALATION 候補: なし（配置は D の責務。見た目の値は流用）

## Recommended Next Step
Planner: 844×390 の media 条件の中だけで `.hud-bars` を 3 列（HP / MP / スタミナ）に並べる計画を作る。
