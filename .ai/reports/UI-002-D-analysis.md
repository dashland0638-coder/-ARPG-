# UI-002-D Analysis

- Role: Analyzer（READ ONLY。書いたのは本ファイルのみ）
- Task: `.ai/tasks/UI-002-D.md`（Status: DRAFT。変更していない）
- Date: 2026-09-28
- Session: UI-001 以降と同一の Claude Code セッション（独立性なし）
- 表記: **FACT**（`path:line` で確認）/ **OBSERVATION**（画面・集計から読み取れる傾向）/ **INFERENCE**（推測。根拠の FACT を示す）/ **RISK** / **HUMAN DECISION REQUIRED**（Human が決める。AI は決めない）
- 本レポートは配置・情報量・見た目の「正解」を決めない（HD-5: 見た目は UI-002-V）。

---

## 1. Baseline

| 項目 | 値 |
| --- | --- |
| Baseline main | `40644f3ab3589fc2d73cd4d62bc3f60c9ab867d4`（PR #31 merge commit。UI-002-A / B / C1 DONE） |
| 読んだ内容 | 作業ツリーは PR #31 の head `02ba8db0f5b3f677c4c074bb73fea1c67733bae2`。`40644f3` は `63235ce` と `02ba8db` の merge commit で、`63235ce` は `02ba8db` の祖先のため、main の tree は `02ba8db` と同一（INFERENCE。git での照合は §15 の制約により NOT_RUN） |
| 調査方法 | `Read` / `Grep` による静的解析。実画面の DOM bounding box 計測は NOT_RUN（§15） |

## 2. 対象ファイル

| ファイル | HUD に関わる内容 |
| --- | --- |
| `index.html:83-199` | HUD の静的 DOM（`#hud`、`#combo-indicator`、`#scenario-timer`、`#boss-bar-wrap`、`#screen-flash`、`#interact-btn`、`#execute-prompt`、`#btn-cam-left/right`、`#touch-controls`、`#screen-fade`、`#minimap-wrap`、`#minimap-label`） |
| `src/styles/main.css` | HUD の配置・表示状態（§4） |
| `src/styles/tokens.css` | UI-002-C1 の token（§9） |
| `src/legacy/parts/14-hud-boot.js` | `updateHUD` / `updateMobBars` / `updateBossBar` / `updateCooldownRings` / `updateExecutePrompt` / `updateComboIndicator` / `updateUltHUD` / `updateWeaponBadge` / `updateFloorLabel` / `drawMinimap` / `finishEnteringGame` / メインループ |
| `src/legacy/parts/11-combat-actions.js:2141-2251` | `flashScreen` / `spawnDamagePopup` / `spawnPickupPopup` / `pushMsgLog` / `spawnToast` |
| `src/legacy/parts/12-progression-ui.js:1596-1620, 1825-1854` | `refreshScenarioTimerHUD` / `updateScenarioTimer` / 職業切替時の HUD 更新 / `refreshHudName` |
| `src/legacy/parts/10-input.js:7-45, 391-412` | `isTouchDevice` / `refreshTouchControls` / `checkOrientation` / ゲームパッド接続バッジ |
| `src/legacy/parts/02-world-common.js:2366-2396` | `updateInteractPrompt`（インタラクト表示の文言） |
| `src/core/chapter1-rules.js` | `hudLabel()`・`legacyGrowthEnabled()` |
| `src/core/ui-icons.js` | UI-002-C1 の icon 対応表（未使用） |

## 3. 現在の HUD 構造（DOM）

### 3.1 静的 DOM（FACT: `index.html`）

```
#hud (position:fixed; inset:0; pointer-events:none)            index.html:84
├ .hud-topleft                                                   :85
│ ├ #hud-portrait > #hud-portrait-icon(⚔) + #weapon-badge(M)     :86
│ └ .hud-bars
│   ├ #hud-name / #hud-floor(display:none)                      :88-89
│   ├ .bar-label HP  + #hp-fill                                  :90-91
│   ├ #mp-label MP   + #mp-fill                                  :92-93
│   ├ .bar-label スタミナ + #sta-fill                              :94-95
│   └ .bar-track.xp > #xp-fill                                   :96
├ #hud-loot > #loot-menu-btn(☰) #loot-potion-btn(🧪) #loot-mppotion-btn(🔷)   :99-103
├ #gamepad-badge                                                  :104
└ #hud-hint(1行の操作ヒント) > #hud-hint-skill3                      :105
#combo-indicator > #combo-pips + #combo-window-fill               :107-110
#scenario-timer                                                   :111
#boss-bar-wrap > #boss-bar-name / track(chip, fill, notch×2) / posture / #boss-bar-phase   :112-124
#screen-flash                                                     :135
#interact-btn / #execute-prompt / #btn-cam-left / #btn-cam-right  :166-169
#touch-controls                                                   :172
├ .joy-zone > .joy-base > .joy-knob
└ .action-zone > #btn-ult(#btn-ult-icon, #ult-btn-cd) #btn-charge #btn-skill2 #btn-skill3 #btn-jump #btn-dodge #btn-attack
#screen-fade / #minimap-wrap > canvas#minimap / #minimap-label    :197-199
```

### 3.2 JS で生成される要素（FACT）

| 要素 | 生成 | 追加先 | 根拠 |
| --- | --- | --- | --- |
| `.mob-hp` / `.mob-posture`（雑魚の HP・体幹） | 敵ごとに 1 回 | `document.body` | `14-hud-boot.js:13-36` |
| `.dmg-pop`（ダメージ数値） | プール（最大 40） | `#hud` | `11-combat-actions.js:2158-2189` |
| `.item-pop`（拾得ポップ・中央トースト） | 都度生成 | `#hud` | `11-combat-actions.js:2191-2251` |
| `#msg-log` / `.msg-log-line`（左下ログ） | 初回に生成 | `#hud` | `11-combat-actions.js:2219-2234` |
| `.combo-pip` | 段数が変わった時 | `#combo-pips` | `14-hud-boot.js:772-804` |

## 4. HUD 各要素の表示条件（FACT）

| 要素 | 位置（CSS） | 表示条件 | 更新関数 | 根拠 |
| --- | --- | --- | --- | --- |
| `#hud` 全体 | fixed / inset 0 | `finishEnteringGame()` で `.active` | — | `14-hud-boot.js:1799`、`main.css:637-638` |
| `.hud-topleft`（名前・HP/MP/スタミナ・肖像） | top 16 / left 16（safe-area 無し） | `#hud` と同じ（常時） | `updateHUD()` 毎フレーム | `main.css:640-645`、`14-hud-boot.js:362-372` |
| `#hud-name` | 同上 | 常時。本編は `hudLabel()`（主人公 ｜ 支援）、テストモードは `Lv.` 付き | `refreshHudName()` | `12-progression-ui.js:1848-1854` |
| `#hud-floor` | 同上 | 洋館等のシナリオで部屋名がある時だけ | `updateFloorLabel()` | `14-hud-boot.js:344-351` |
| `#weapon-badge` | 肖像の右下 | 常時。`updateHUD()` 初回までは初期文字「M」 | `updateWeaponBadge()` | `index.html:86`、`14-hud-boot.js:353-360` |
| XP バー | `.hud-bars` 内 | 本編は非表示（`legacyGrowth()`）、テストモードのみ表示 | 値は `updateHUD()` が毎フレーム更新 | `14-hud-boot.js:368, 1808-1809` |
| `.hud-loot`（☰・🧪・🔷） | top 16+78 / left 16 | 常時 | — | `main.css:671-678` |
| `#gamepad-badge` | top 16 / right 64 | パッド接続中 | `10-input.js:404,411` | `main.css:734-740` |
| `#hud-hint` | bottom 14 / 中央 | 非タッチのみ（タッチでは `display:none`） | 固定文言 | `14-hud-boot.js:1804`、`index.html:105` |
| `#hud-hint-skill3` | ヒント内 | 本編非表示・テストモード表示 | `finishEnteringGame()` | `14-hud-boot.js:1810-1811` |
| `#combo-indicator` | bottom 15% / 中央 | `state.comboStage > 0` の間 `.show` | `updateComboIndicator()` | `14-hud-boot.js:772-804`、`main.css:259-265` |
| `#execute-prompt` | bottom 28% / 中央 | 処刑対象がある時 `.show` | `updateExecutePrompt()` | `14-hud-boot.js:761-770`、`main.css:531-545` |
| `#interact-btn` | bottom 22% / 中央 | 扉・階段・鍵・手記・宝箱・店主・鍛冶士等が近い時 `.show` | `updateInteractPrompt()` | `02-world-common.js:2366-2396`、`main.css:508-517` |
| `#boss-bar-wrap` | top 14 / 中央、幅 `min(520px,78vw)` | 起動済みボスがいて、ポーズ・オーバーレイ中でない時 `.show` | `updateBossBar()` | `14-hud-boot.js:104-129`、`main.css:283-288` |
| `#scenario-timer` | top 64 / 中央 | 周回の制限時間がある時（初回は無し） | `refreshScenarioTimerHUD()` | `12-progression-ui.js:1596-1612`、`main.css:238-246` |
| `.mob-hp` / `.mob-posture` | 敵の頭上（ワールド座標を投影） | 最近被弾した雑魚（`barT>0`）で HP が減っている時。体幹は guardian / 強敵のみ | `updateMobBars()` | `14-hud-boot.js:40-81` |
| `.dmg-pop` | 被弾位置の頭上 | 被弾時 0.8 秒 | `spawnDamagePopup()` | `11-combat-actions.js:2158-2189` |
| 中央トースト（`.item-pop`） | 左右中央、top 30% から上へ積む | 1.7 秒 | `spawnToast()`（192 呼び出し） | `11-combat-actions.js:2205-2251` |
| `#msg-log` | left 12 / bottom 84、最大幅 64vw、最大 6 行 | トーストと同時に 6.5 秒 | `pushMsgLog()` | `11-combat-actions.js:2219-2234`、`main.css:716-733` |
| `#screen-flash` | 全画面 | 0.4 秒のアニメーション | `flashScreen()` | `11-combat-actions.js:2141-2146` |
| `#minimap-wrap` / `#minimap-label` | top 8 / right 16、`clamp(104px,14vmin,200px)` | 開始済み・非ポーズ・非会話・オーバーレイ無しの時 `.show` | `drawMinimap()` | `14-hud-boot.js:529-538`、`main.css:386-392, 815-823` |
| `#touch-controls` | 全画面 | タッチ端末かつパッド未接続は `.active`（全ボタン＋スティック）。それ以外は `.gamepad-min`（攻撃・スキル・必殺のみ、操作不可） | `refreshTouchControls()` | `10-input.js:23-35`、`main.css:749-758` |
| `#btn-attack` / `#btn-jump` / `#btn-dodge` | 右下 | `.active` 時。`.gamepad-min` ではジャンプ・回避を非表示 | — | `main.css:796-798` |
| `#btn-charge`（Skill 1） | 右下 | 常時 | `updateCooldownRings()` | `14-hud-boot.js:721-722` |
| `#btn-skill2` | 右下 | 閃くまで `.locked`（`display:none`） | `updateCooldownRings()` | `14-hud-boot.js:729-730`、`main.css:808` |
| `#btn-ult` | 右下 | 常時。ゲージ充填中は `#ult-btn-cd` に％、満タンで `.ready`（脈動） | `updateUltHUD()` / `updateCooldownRings()` | `14-hud-boot.js:731-734, 806-815` |
| `#btn-skill3` | 右下 | 本編は `.locked`（非表示）、テストモードのみ | `updateCooldownRings()` | `14-hud-boot.js:735-744`（UI-002-A WI-A2） |
| `#btn-cam-left/right` | 下中央 | タッチ操作時のみ `.active` | `refreshTouchControls()` | `main.css:1000-1008` |
| スティック `.joy-zone` / `.joy-base` | 左下 48%×46% / 112px | `.active` 時 | — | `main.css:759-775` |

- 毎フレームの更新は `animate()` の通常プレイ分岐（`state.started && !paused && !dialogueActive`）でだけ行われる（`14-hud-boot.js:1105-1164`）。会話中・カットシーン中は `hideMobBars()` でボスバー・雑魚バー・ミニマップラベルを隠す（`14-hud-boot.js:1173, 1207`、`:87-94`）。

## 5. UI-002-A で外した旧成長要素の残存確認（FACT）

| 要素 | 本編（Chapter 1）の戦闘 HUD | 根拠 |
| --- | --- | --- |
| Level 表示 | 出ない（`refreshHudName()` は本編では `Lv.` を付けない） | `12-progression-ui.js:1853` |
| XP バー | 出ない（親要素を `display:none`）。値は `updateHUD()` で毎フレーム計算され続ける（表示のみ抑制） | `14-hud-boot.js:368, 1808-1809` |
| Skill 3 ボタン | 出ない（`.locked`）。ヒントの Skill 3 も非表示 | `14-hud-boot.js:737, 1810-1811` |
| 鑑定関連 | 戦闘 HUD には無い。酒場の `#interact-btn` の文言に「🔨 鍛冶士と話す(鑑定・強化)」「🧰 仮設の作業台(鑑定・強化)」が残る（酒場。戦闘中ではない） | `02-world-common.js:2394` |
| 💎 / 🔩（素材） | 戦闘 HUD には無い（`.hud-loot` は ☰・🧪 薬草・🔷 魔力の雫のみ） | `index.html:99-103` |

- 検索: `Lv\.|xp|skill3|鑑定|💎|🔩|gem|shard` を `index.html` の HUD 範囲と `14-hud-boot.js` / `12-progression-ui.js` の HUD 更新関数で確認し、上記以外の戦闘 HUD 表示は見つからなかった。

## 6. DOM / class / ID 依存

- 状態 class: `.active`（`#hud`、`#touch-controls`、`#btn-cam-*`）、`.show`（ボスバー・コンボ・処刑・インタラクト・ミニマップ・ゲームパッドバッジ）、`.locked`（Skill 2 / 3）、`.unequipped`（Skill 3）、`.ready` / `.pressed`（必殺・ボタン）、`.gamepad-min`、`.brk`（体幹）、`.timer-urgent`、`.flash`（FACT: §4 の各行）。
- 表示の切替は class と `style.display` の直接操作が混在（`#hud-hint`、XP バー、`#hud-floor`、`#scenario-timer`、`#ult-btn-cd` は `style.display`。FACT: §4）。
- `#hud` の子として JS がトースト・ダメージ数値・ログを追加する。雑魚バーは `body` 直下（FACT: §3.2）。`#hud` の構造を変えると、これらの追加先にも影響する。
- CSS にのみ存在する HUD 系 selector: `#btn-menu-touch`、`#btn-appraisal-touch`、`#btn-sortie-touch`、`.cam-btn`（UI-002-C1 Analyzer §7.3）。

## 7. JS 更新経路と変更の境界

| 区分 | 内容 | 根拠 |
| --- | --- | --- |
| **UI だけで済む** | 位置・大きさ・余白（CSS）、`#hud-hint` の文言、`.hud-loot` の並び、ミニマップの位置、トースト / ログの位置（CSS の `top` / `left` は一部 JS） | `main.css`、`11-combat-actions.js:2208-2213`（トーストの `top` は JS の `layoutToasts()` が書く） |
| **UI の JS に触れる** | 表示条件の変更（常時 → 条件付き等）は `updateHUD` / `updateCooldownRings` / `drawMinimap` / `refreshTouchControls` / `finishEnteringGame` の分岐を変える | §4 |
| **combat / state / input に触れる** | ボタンを消す・統合する場合は入力（タップ・キー）の経路、`state.comboStage` / `state.ultGauge` / `currentExecutionTarget()` 等の表示元、`updateInteractPrompt` が `interact()` と同じ近接判定を共有している点 | `02-world-common.js:2367, 2398-2405`、`14-hud-boot.js:761-815` |
| **位置が 3D 座標で決まる** | 雑魚バー・ダメージ数値・拾得ポップ（カメラ投影） | `14-hud-boot.js:53-66`、`11-combat-actions.js:2159-2163, 2192-2195` |

INFERENCE: 配置の変更は CSS 中心で済むが、「条件付き表示にする」「統合する」「消す」は JS の表示条件や入力経路に及ぶ。

## 8. 画面サイズ別の配置（CSS から計算。実測は NOT_RUN）

> 2026-09-28 追記: WI-D0 の実測結果は **§15.2** に記録した。本節の値は CSS からの計算値（INFERENCE・参考値）のまま残し、実測値で書き換えていない。

### 8.1 中央 60%×60% 領域

| サイズ | 中央領域 |
| --- | --- |
| 1280×800 | x 256〜1024 / y 160〜640 |
| 844×390 | x 169〜675 / y 78〜312 |

### 8.2 要素ごとの推定矩形と中央領域への重なり（INFERENCE: `main.css` の値から計算。高さ・幅が内容で決まる要素は UI-001 / UI-002-C1 の撮影からの目測）

| 要素 | 1280×800（非タッチ） | 844×390（タッチ） |
| --- | --- | --- |
| `.hud-topleft`（約 254×140、UI-001 実測） | x16-270 / y16-156：**外**（上端に接する） | 同寸法：**x169-270 / y78-156 が中央領域に入る** |
| `.hud-loot` | x16-約156 / y94-126：外。**`.hud-topleft` の下部に重なる**（UI-001 F-05） | 同左。重なりも同じ |
| ミニマップ | 112px（14vmin）x1152-1264 / y8-120：外 | 104px（下限）x724-828 / y8-112：外 |
| `#gamepad-badge` | right 64 → **ミニマップ（right 16、幅 112）と横位置が重なる**（パッド接続時のみ） | 同様 |
| ボスバー | 幅 520、x380-900 / y14-約70：外 | 幅 520、x162-682 / y14-約70：外（中央領域の上端 y78 に近い） |
| 制限時間 | y64-約90：外 | **y64-約90 が中央領域上端（y78）にかかる** |
| 中央トースト | top 30%＝y240 から上へ積む：**中** | top 30%＝y117：**中** |
| `#interact-btn` | bottom 22% → y約594-624：**中** | bottom 22% → y約274-304：**中** |
| `#execute-prompt` | bottom 28% → y約546-576：**中** | bottom 28% → y約245-281：**中** |
| コンボ | bottom 15% → y約660-680：外 | bottom 15% → y約300-332：**中央領域の下端にかかる** |
| `#hud-hint`（非タッチのみ） | 約 790 幅、y752-786：外 | 表示されない |
| `#msg-log`（最大 6 行） | left 12、下端 y716：外（6 行で上端 y約560 → **左端で中央領域の下部に入る**） | 下端 y306、6 行で上端 y約150：**中央領域に入り、スティック（x56-168 / y222-334）の上部と重なる** |
| 必殺 `#btn-ult` | x1022-1074 / y616-668：ほぼ外（角が接する） | x586-638 / y206-258：**中** |
| Skill 2 `#btn-skill2`（習得後） | x1086-1128 / y630-672：外 | x650-692 / y220-262：**一部中** |
| Skill 1 `#btn-charge` | x1140-1184 / y644-688：外 | x704-748：外 |
| 攻撃 `#btn-attack` | x1094-1176 / y700-782：外 | x658-740 / y290-372：**角が中** |
| JUMP / 回避 | 非表示（`.gamepad-min`） | 右端：外 |
| スティック `.joy-base` | 非表示 | x56-168 / y222-334：外（左端に接する） |
| スティック操作域 `.joy-zone`（透明） | 非表示 | 左下 48%×46%＝x0-405 / y210-390：**中央領域の左下と重なる**（見えない） |
| カメラ回転ボタン | 非表示 | 下中央 y342-376：外 |
| 雑魚バー・ダメージ数値 | 3D 座標に追従（中央に出うる） | 同左 |

OBSERVATION（UI-002-C1 の撮影 `1280x800-03-tavern-hud` / `844x390-03-tavern-hud`、`844x390-02-dialogue`）:
- 844×390 では左上パネル・右下のボタン群・スティックが画面の大部分の周縁を占め、会話ボックスがスティックと右下ボタンの上に重なる。
- 1280×800 では右下はボタン 3 つ（攻撃・Skill 1・必殺）、下中央に 1 行ヒント。

## 9. UI-002-C1 との接続点（FACT）

| C1 の基盤 | D で使えるもの |
| --- | --- |
| `tokens.css` の z-index（`--ui-z-hud` 16、`--ui-z-hud-panel` 30、`--ui-z-hud-button` 25、`--ui-z-touch` 15、`--ui-z-minimap` 14、`--ui-z-interact` 22、`--ui-z-execute` 23、`--ui-z-msg-log` 21、`--ui-z-boss-bar` 40、`--ui-z-timer` 39、`--ui-z-flash` 25 等） | 重なり順の名前。HUD の層の整理にそのまま使える |
| 色（`--ui-hp-*` / `--ui-mp-*` / `--ui-stamina-*` / `--ui-surface-hud`） | HP / MP / スタミナのバーと HUD 面の現行値 |
| 文字サイズ（`--ui-fs-hud-label` 8.5px / `--ui-fs-hud-badge` 9.5px） | HUD の最小文字（最小可読サイズは V で決める） |
| `ui-icons.js`（hp / mp / stamina / attack は glyph なし、skill 💢 / ultimate 💥 / item・potion 🧪 / mppotion 🔷 / menu ☰ / interact ✋ / execute ✦ / cameraLeft・Right） | HUD のアイコンの意味名。置き換えは E |
| `tests/ui-foundation.spec.js` | `.hud-topleft` の背景・角丸・z-index、`.bar-fill.*` の背景、`.bar-label` / `.weapon-badge` の文字サイズを現行値で固定。**D で位置だけを変える場合は影響しない。これらの値を変える場合は期待値の更新（Human 承認）が要る** |

- C1 では「新しい色・サイズ・形を足さない」ことを確定している（Decision record: UI-002-C1 Planner 承認）。D でも見た目は現行のまま（Task の Implementer constraints）。

## 10. E2E / unit の依存（FACT: `tests/` を検索）

| 依存先 | 件数・主な spec | 性質 |
| --- | --- | --- |
| `#hud`（`toHaveClass(/active/)` 等） | 29 spec | ゲーム開始の待機に使う |
| `#hud-name` の文言 | save-load / chapter1-progression（「魔法使い ｜ 支援: 剣士」等を完全一致）/ road / character-* / chapter1-dusk-basics | **文言・`hudLabel()` の形式に依存** |
| ミニマップ系（`#minimap-area` 等） | mansion-* / duskvillage / road / chapter1-* / scenario-* | 場所名の文言で進行を判定 |
| `#msg-log` / `.msg-log-line` / `.item-pop` | air-actions / base-class-* / job-traits / combat-test-arena / chapter1-legacy-ui / chapter1-dusk-basics / mansion-scenario / character-weapon-visual / dev-ui-gate | トースト・ログの文言で判定 |
| `.dmg-pop` | auto-combo / base-class-* / guest-companion / character-motion / execution-break | 数・値で攻撃の成立を判定 |
| `.mob-hp` | base-class-identity | 幅で HP 減少を判定 |
| `#execute-prompt` | execution-break / mansion-butler / mansion-enemies / mansion-warden / mansion-lord | 表示（`.show`）で判定 |
| `#boss-bar-wrap` / `#boss-bar-fill` | execution-break | 表示と幅 |
| `#interact-btn` | tavern-smith-greeting / shadow-guide | 文言・表示 |
| `#scenario-timer` | scenario-timer | 表示・文言 |
| `#btn-charge` / `#btn-skill2` / `#btn-ult` | chapter1-skill2 / chapter1-progression / chapter1-dusk-basics / auto-combo | `.locked` 等の class |
| `#sta-fill` / `#mp-fill` | auto-combo | 幅（資源の減少） |
| `xp-fill` / `btn-skill3` / `hud-hint-skill3` | chapter1-legacy-ui（本編で非表示・テストモードで表示） | computed style |
| `.hud-topleft` / `.bar-fill.*` / `.bar-label` / `.weapon-badge` | ui-foundation | computed style（§9） |
| `#loot-menu-btn` | combat-test-arena（Arena ボタンとの **boundingBox 重なり**） | 位置 |

- unit test は HUD の DOM に依存していない（`tests/unit/` は `src/core/` の純関数のみ）。`hudLabel()` は `tests/unit/chapter1-rules.test.js` で文言を検査（FACT: `tests/unit/chapter1-rules.test.js:5`）。
- CI では E2E が不安定（PR #30 / #31 で 15〜16 件がタイムアウト等で失敗。UI-002-C1 PR #31 のコメント参照）。D の検証で CI の結果を判定に使う場合は注意が要る。

## 11. D と V の境界

| 区分 | 内容 |
| --- | --- |
| **D（情報設計・配置）** | 各要素の 4 分類（常時 / 条件 / 一時 / 非表示）と表示条件、配置（ゾーン）、重なりの解消、中央 60%×60% 方針の検証、1280×800 / 844×390 の配置差。**見た目（色・書体・形・アイコン）は現行のまま**（Task の Implementer constraints） |
| **V（Human Visual Decision）** | HP / MP / スタミナの見せ方（フラスコ等）、ボタンの形・大きさの見た目、パネルの質感、アイコンの絵柄、最小文字サイズ、トゥーン / マット表現 |
| 境界が曖昧なもの | ボタンの**大きさ**（配置の問題でもあり見た目の問題でもある）、HP 等の**表示形式**（バー / 数値 / アイコン）、情報量（何を常時出すか） → §13 で Human Decision 候補として挙げる |

## 12. FACT / OBSERVATION / INFERENCE / RISK

### FACT

| # | 内容 |
| --- | --- |
| F-01 | HUD の常時表示は、左上パネル（名前・肖像・武器バッジ・HP/MP/スタミナ）、所持品チップ（☰🧪🔷）、ミニマップと地名、右下のボタン（PC: 攻撃・Skill 1・必殺、タッチ: ＋JUMP・回避・スティック・カメラ回転）、PC の 1 行ヒント（§4） |
| F-02 | 条件付き表示は、Skill 2（習得後）、ボスバー、制限時間、雑魚 HP / 体幹、コンボ、処刑、インタラクト、ゲームパッドバッジ、階層表示（§4） |
| F-03 | 一時表示は、ダメージ数値 0.8 秒、中央トースト 1.7 秒、左下ログ 6.5 秒、画面フラッシュ 0.4 秒（§4） |
| F-04 | 本編の戦闘 HUD に Level / XP / Skill 3 / 鑑定 / 💎🔩 は出ない（§5） |
| F-05 | PC / タッチの切替は `isTouchDevice`（入力）で決まる。PC でも攻撃・Skill 1・必殺のボタンは `.gamepad-min` で表示され、押せない（`pointer-events:none`）（`10-input.js:23-35`、`main.css:753-758`） |
| F-06 | `.hud-topleft` は `top:16px` 固定で `env(safe-area-inset-top)` を使わず、`.hud-loot` は safe-area 付きで `margin-top:78px` のため左上パネルの下部に重なる（`main.css:640-678`） |
| F-07 | 中央トースト（top 30%）、インタラクト（bottom 22%）、処刑（bottom 28%）は両サイズとも中央 60%×60% 領域に入る（§8.2。CSS 値からの計算） |
| F-08 | 左下ログは最大 6 行・64vw で、タッチ時のスティック位置（`.joy-base` left 56 / bottom 56）と縦方向の範囲が重なる（`main.css:716-720, 763-769`） |
| F-09 | 武器バッジは `updateHUD()` が走るまで初期文字「M」を表示する（`index.html:86`。UI-002-C1 の撮影で会話中に「M」を確認） |
| F-10 | 雑魚バーは `document.body` 直下、トースト・ダメージ数値・ログは `#hud` 直下に JS が追加する（§3.2） |
| F-11 | HUD の毎フレーム更新は通常プレイ分岐のみ。会話・カットシーン中はボスバー・雑魚バー・ミニマップを隠す（§4） |
| F-12 | `#hud-name` の文言は E2E で完全一致検査されている（§10） |
| F-13 | `ui-foundation.spec.js` が HUD の見た目の値（背景・角丸・z-index・文字サイズ）を固定している（§9） |
| F-14 | Decision record の Undecided に「支援 AI の HP 表示」「目的表示」「3 人パーティ HUD」「影の旅人専用 HUD」「実機 iPhone での最終調整」「パッド表記」がある（`.ai/decisions/UI-002-human-decisions.md` Undecided） |

### OBSERVATION

| # | 内容 |
| --- | --- |
| O-01 | 844×390 では、左上パネル・右下のボタン群・スティックで画面の周縁の多くを占め、3D が見える範囲は中央から右上に偏る（UI-002-C1 撮影） |
| O-02 | 通知は中央トーストと左下ログが同時に出る（同じ文言が 2 か所） |
| O-03 | 1280×800 の PC 表示では、押せないボタン（攻撃・Skill 1・必殺）が右下に常時出ている（クールダウン表示の役割） |
| O-04 | 必殺ボタンは 844×390 で右下の群の中で最も内側（画面中央寄り）にある |
| O-05 | インタラクトと処刑は同じ下中央の縦列に並ぶ（重ならない位置に分けてある） |

### INFERENCE

| # | 内容 | 根拠 |
| --- | --- | --- |
| I-01 | 「中央 60%×60% に常時 UI を置かない」方針は、1280×800 では現状ほぼ満たしており、844×390 では左上パネルと右下のボタン（必殺・Skill 2・攻撃）が中央領域に入るため満たしていない | F-07、§8.2 |
| I-02 | 条件付き・一時表示（トースト・インタラクト・処刑）は中央領域に入っており、方針の対象を「常時 UI」に限るかどうかで判定が変わる | F-07 |
| I-03 | 844×390 では、ボタンの位置を右下に寄せるほど親指の届く範囲に近づくが、中央領域から外すにはボタン群の大きさ・間隔の見直しが要る（見た目の判断を含む） | §8.2 |
| I-04 | PC の押せないボタン表示をやめる場合、クールダウン・必殺ゲージの表示場所を別に用意する必要がある | F-05、O-03 |
| I-05 | `#hud` の子構造やゾーン容器を変えると、JS がトースト等を追加する先（`#hud`）と E2E の `#hud .item-pop` 等の selector に影響する | F-10、§10 |

### RISK

| # | 内容 |
| --- | --- |
| R-01 | 表示条件の変更で、E2E が参照する要素（`#execute-prompt`、`#boss-bar-wrap`、`.dmg-pop`、`#msg-log`、ミニマップ文言、`#hud-name`）が非表示・移動になり、判定が壊れる |
| R-02 | 844×390 でボタン位置を変えると、タップ操作（`.joy-zone` 48%×46% の当たり判定を含む）と干渉する |
| R-03 | 見た目の値（文字サイズ・z-index 等）を変えると `ui-foundation.spec.js` が失敗する（意図した変更なら期待値更新が要る） |
| R-04 | CI の E2E が不安定なため、D の回帰確認を CI だけで判断できない |
| R-05 | 実機（iPhone のノッチ・safe-area）では `.hud-topleft` が safe-area を考慮していない（F-06）。この環境では実機確認ができない |
| R-06 | 実画面の bounding box 計測を本 Analyzer で実行できていない（§15）。§8.2 の値は CSS からの計算と過去の撮影に基づく |

## 13. Human Decision Required（候補。AI は決めていない）

| # | 論点 | 関連 |
| --- | --- | --- |
| HDR-01 | 中央 60%×60% 方針の採否と、対象を「常時 UI」に限るか（条件付き・一時表示を含めるか） | Task Unknowns、I-01、I-02 |
| HDR-02 | HUD の配置（ゾーン）: 左上パネル・所持品チップ・ミニマップ・ボタン群・通知の置き場所 | §8 |
| HDR-03 | 情報量: 常時表示にするもの（名前・肖像・武器バッジ・HP/MP/スタミナ・所持品・ミニマップ・地名） | F-01 |
| HDR-04 | HP / MP / スタミナの見せ方（バーのまま配置だけ変えるか、表示形式も変えるか。形式は V） | §11 |
| HDR-05 | Skill ボタン（Skill 1 / Skill 2 / 必殺）の大きさ・位置（844×390 で中央領域に入る件） | I-03 |
| HDR-06 | 必殺の表示（ボタン内の％・リング・準備完了の脈動）をどこに出すか | §4 |
| HDR-07 | 処刑プロンプト・インタラクトの位置（中央領域内の現状を維持するか） | F-07 |
| HDR-08 | コンボ表示の位置（844×390 で中央領域の下端にかかる） | §8.2 |
| HDR-09 | 操作ヒント: PC の 1 行ヒントを常時出すか（表示条件・場所） | §4 |
| HDR-10 | 通知の二重表示（中央トースト＋左下ログ）を維持するか | O-02 |
| HDR-11 | スティック・右下ボタンと、左下ログ・会話ボックスの共存 | F-08、O-01 |
| HDR-12 | PC で押せないボタン（クールダウン表示）を出し続けるか | F-05、I-04 |
| HDR-13 | 武器バッジを Chapter 1 本編で出すか（UI-002 Planner report の A の案に含まれていたが、UI-002-A の承認範囲には入っていない） | F-09、UI-002-A |
| HDR-14 | Undecided（支援 AI の HP 表示・目的表示・3 人パーティ HUD・影の旅人専用 HUD・パッド表記）のうち、D で判断が必要なもの | F-14 |
| HDR-15 | 1280×800 と 844×390 で配置をどこまで変えるか（同じ部品で位置だけ変える / 表示要素も変える）。判定基準（入力 / ビューポート）は C1 で WI-C1-4 が不採用になり、未決定 | UI-002-C1 AP-C1-09 |
| HDR-16 | D の見た目変更の禁止範囲（位置・表示条件だけか、大きさを含むか） | §11 |

## 14. Scope Boundary / Out of Scope Found

- D の範囲外で見つかったもの（修正しない）:
  - 酒場のインタラクト文言に「鑑定・強化」が残る（G の範囲。UI-002-A で「鑑定所」の名称は変えない決定あり）
  - CSS にのみ存在する touch ボタン系 selector（C1 で別 Task 候補として記録済み）
  - CI の E2E 不安定（UI-002-C1 で別 Task 候補として記録済み）
- 開発用 UI（Arena・DEBUG・PERF・Motion）は対象外（Task の Out of Scope。UI-002-B）。

## 15. 実行できなかったこと（NOT_RUN）

- 本 Analyzer の実行中、Bash の実行前の安全チェックが繰り返し応答しなかったため、次を実行できなかった:
  - `git` による baseline（`40644f3`）と作業ツリーの照合、Analyzer 用ブランチの作成
  - dev サーバと Playwright による戦闘画面（ダンジョン・ボス戦・処刑・コンボ・制限時間）の撮影と DOM bounding box の計測（Task の Analyzer requirements「UI-001 で UNCONFIRMED だった戦闘 UI の実画面確認」「常時表示 UI の面積・位置の計測」）
- 代替: CSS の値からの計算（§8.2）と、UI-002-C1 Analyzer の撮影（酒場 HUD・会話・メニュー、1280×800 / 844×390）を使った。**実測は Planner 着手前に行うことを推奨する**。
- テスト（build / unit / E2E）は実行していない。

### 15.1 追加実測の試行（2026-09-28、Human の指示による再実行）

Human の指示で、git の確認と戦闘画面の実測を再度試みた。Bash の実行前の安全チェックが応答せず（2 回試行、いずれも verdict なし）、**すべて実行できなかった**。推測で埋めず、次のとおり NOT_RUN とする。

| 項目 | 結果 |
| --- | --- |
| `git status`（本レポート以外の変更の有無） | NOT_RUN |
| main `40644f3` と作業ツリーの差分 | NOT_RUN |
| 1280×800 / 844×390 × 通常戦闘 | NOT_RUN |
| 同 × ボス戦 | NOT_RUN |
| 同 × 処刑表示 | NOT_RUN |
| 同 × コンボ表示 | NOT_RUN |
| 同 × 制限時間表示 | NOT_RUN |
| 同 × 中央トースト | NOT_RUN |
| 同 × インタラクト表示 | NOT_RUN |
| bounding box / 中央 60%×60% への侵入 / スティックとの重なり / safe-area / 他 UI との重なり（実測） | NOT_RUN（§8.2 は CSS の値からの計算のまま） |

- §8.2 の値は実測で置き換えていない。§12 の F-07 / F-08 は CSS の値を根拠とする FACT、I-01 / I-02 は INFERENCE のまま。

### 15.2 WI-D0 実測（2026-09-28、WI-D0 Human Approval に基づく）

WI-D0（実装前実測・確認ゲート）の承認範囲で実施した。目的は新しい Combat HUD を設計するための現状把握で、既存 UI を維持するためのものではない。ソース・HTML・CSS・JS・テストは変更していない。

#### 15.2.1 実施条件（FACT）

| 項目 | 値 |
| --- | --- |
| git HEAD（開始時） | `02ba8db0f5b3f677c4c074bb73fea1c67733bae2`（branch `claude/ui-002-c1-impl`） |
| main との一致 | `origin/main` = `40644f3ab3589fc2d73cd4d62bc3f60c9ab867d4`。`git diff --quiet origin/main HEAD` 差分なし。tree SHA は両方 `1de76cbc59954a66f01efd544f2dd7e412c7a3d3`（§1 の INFERENCE を FACT で確認） |
| git status（開始時） | ` M .ai/decisions/UI-002-human-decisions.md` / ` M .ai/tasks/UI-002-D.md` / `?? .ai/reports/UI-002-D-analysis.md` / `?? .ai/reports/UI-002-D-plan.md`（ソースの変更なし） |
| 実行環境 | Vite dev server（`localhost:5173`）+ Playwright の headless Chromium（`/opt/pw-browsers/chromium`、SwiftShader）。deviceScaleFactor 1。計測スクリプトはリポジトリ外（スクラッチ領域） |
| 1280×800 | `hasTouch: false`（非タッチ。`#touch-controls` は `.gamepad-min`） |
| 844×390 | `hasTouch: true`（タッチ。`#touch-controls.active`、スティック表示）。`isMobile: false` |
| 計測値 | 描画後の DOM の `getBoundingClientRect()`（px、小数は四捨五入）。表示判定は `checkVisibility({opacityProperty, visibilityProperty})`・幅高さ > 0・opacity > 0.02 |
| 短時間表示の取得 | トースト・処刑・インタラクト・ボスバーは、ページ内の MutationObserver で表示された瞬間（2 フレーム後）の矩形を記録した（計測用の一時的な監視。ソースは変更していない） |
| 中央 60%×60% | 1280×800: x256〜1024 / y160〜640（面積 368,640 px²）。844×390: x169〜675 / y78〜312（面積 118,404 px²） |

計測した場面と入り方（**本編** = 通常 URL `/` の Chapter 1、**TM** = `/?dev=1` のテストモード）:

| 場面 | 入り方 | 自然発生か |
| --- | --- | --- |
| Chapter 1 開始直後（導入会話中 / 会話後） | 本編「はじめる」 | 自然 |
| 通常戦闘・コンボ・ダメージ数値・雑魚 HP・中央トースト・ログ・処刑表示 | TM 訓練場（剣士）+ Arena「Basic Melee」+ 前進と攻撃の連打 | 自然（処刑は体勢崩しの後に自然に出た） |
| ボス戦（ボスバー） | TM 訓練場 + Arena「Boss Test」／TM 宵待ちの村 開始地点「水鏡の跡」（魔法使い＋支援 剣士） | 自然 |
| インタラクト表示 | 本編 Chapter 1 酒場で店主まで歩く（`🗺️ 店主と話す(出撃)`） | 自然 |
| 制限時間表示 | DOM 操作で `display:block` と仮の文言 `⏱ 12:34` を設定 | **強制表示（参考値）**。自然発生ではない |

- TM の HUD は本編と次の点が違う（FACT: 計測値）: `#hud-name` に `Lv.50` が付き `.hud-topleft` の高さが 130 → 141、`#btn-skill3` が表示、開発用 `#arena-toggle-btn`（16,136,82×32）が表示。TM 固有の要素は本編の判断に使わない。

#### 15.2.2 1280×800（非タッチ）の実測値

| 要素 | x, y, w×h | 中央 60% への侵入 | 備考 |
| --- | --- | --- | --- |
| `.hud-topleft` | 16,16, 254×130（TM 254×141） | なし | 常時 |
| `#hud-portrait` | 27,59, 44×44（TM 27,65） | なし | |
| `#weapon-badge` | 56,88, 18×18（TM 56,94） | なし | 導入会話中は文言 `M`、会話後は `🗡️`（TM 魔法使い `🪄`） |
| `#hp-fill` / `#mp-fill` / `#sta-fill` | 84,67 / 84,96 / 84,127（各 幅 168・高さ 7） | なし | |
| `#hud-loot`（☰ 🧪 🔷） | 16,94, 125×33（TM 139×33） | なし | |
| `#hud-hint` | 246,757, 789×29（TM 216,757, 849×29） | なし | 非タッチで常時 |
| `#btn-ult` | 1022,616, 52×52 | **48 px²（要素の 2%）** | 常時。チャージ ％ を表示 |
| `#btn-skill2` | 1086,630, 42×42 | なし | 習得後（TM では表示） |
| `#btn-charge`（Skill 1） | 1140,644, 44×44 | なし | |
| `#btn-attack` | 1094,700, 82×82 | なし | |
| `#btn-skill3` | 950,608, 46×46 | **1,472 px²（70%）** | TM のみ。本編では導入会話中だけ表示された（15.2.6） |
| `#minimap-wrap` | 1152,8, 112×112 | なし | |
| `#minimap-label` | 1152,125, 112×16（2 行時 112×30） | なし | 訓練場では文言なし（高さ 1） |
| `#boss-bar-wrap` | 380,14, 520×63 | なし | 自然 |
| `#combo-indicator` | 608,662, 64×18 | なし | 自然 |
| `#execute-prompt` | 573,540, 135×36 | **100%（4,844 px²）** | 自然。一時表示 |
| `#interact-btn` | 554,589, 173×35（文言 `🗺️ 店主と話す(出撃)`） | **100%（6,040 px²）** | 自然。一時表示。幅は文言で変わる |
| 中央トースト（`.item-pop`） | 例 573,236, 135×15 / 589,236, 102×16 / 積み上げ時 y211 | **100%** | 自然。一時表示（1.7 秒） |
| `#msg-log` | 1 行 12,691, 113×25 ～ 6 行 12,546, 113×170 | なし | 自然 |
| `.dmg-pop` / `.mob-hp` | 敵の頭上（例 627,300, 27×23 / 593,367, 46×5） | 中央に出る | 自然。3D 座標に追従 |
| `#scenario-timer` | 591,64, 99×28 | なし | **強制表示（参考値）** |

- 常時表示 UI の中央 60% への侵入（本編・会話後）は `#btn-ult` の 48 px²（中央の面積の 0.01%）だけ。

#### 15.2.3 844×390（タッチ）の実測値

| 要素 | x, y, w×h | 中央 60% への侵入 | 備考 |
| --- | --- | --- | --- |
| `.hud-topleft` | 16,16, 254×130（TM 254×141） | **6,882 px²（要素の 21%。x169〜270 / y78〜146）**（TM 7,995 px²・22%） | 常時 |
| `#weapon-badge` / `#hud-portrait` / `#hud-loot` | 1280×800 と同じ座標 | なし | |
| `#mp-label` | 83,80, 170×10 | 842 px²（`.hud-topleft` の内側） | |
| `#btn-ult` | 586,206, 52×52 | **2,704 px²（100%）** | 常時 |
| `#btn-attack` | 658,290, 82×82 | **378 px²（6%）** | 常時 |
| `#btn-skill2` | 650,220, 42×42 | **1,058 px²（60%）** | 習得後 |
| `#btn-charge` | 704,234, 44×44 | なし | |
| `#btn-dodge` / `#btn-jump` | 756,222, 58×58 / 758,300, 64×64 | なし | タッチのみ |
| `#btn-skill3` | 514,198, 46×46 | **2,116 px²（100%）** | TM のみ。本編では導入会話中だけ表示された |
| `.joy-base`（スティック） | 56,222, 112×112 | なし | |
| `.joy-zone`（透明の操作域） | 0,211, 405×179 | 23,960 px²（中央の面積の 20%） | 見えない |
| `#btn-cam-left` / `#btn-cam-right` | 380,342 / 430,342（各 34×34） | なし | `#btn-cam-left` は `.joy-zone` と重なる |
| `#minimap-wrap` | 724,8, 104×104 | なし | |
| `#minimap-label` | 724,117, 104×16（2 行時 104×30） | なし | |
| `#boss-bar-wrap` | 162,14, 520×63 | なし（下端 y77、中央上端 y78 の 1px 手前） | 自然 |
| `#combo-indicator` | 390,314, 64×18 | なし（上端 y314、中央下端 y312 の 2px 外） | 自然。`.joy-zone` と重なる |
| `#execute-prompt` | 355,245, 135×36 | **100%（4,844 px²）** | 自然。一時表示。`.joy-zone` と x355〜405 で重なる |
| `#interact-btn` | 336,269, 173×35 | **100%（6,040 px²）** | 自然。一時表示。`.joy-zone` と x336〜405 で重なる |
| 中央トースト | 例 355,113, 135×15 / 323,93, 197×19 | **100%** | 自然。一時表示 |
| `#msg-log` | 1 行 12,282, 138×24 ～ 2 行 12,252, 113×54（最大で確認できたのは 2 行） | 文言が長いと一部侵入（例 173 幅で 415 px²・10%） | 自然。`.joy-zone` と重なる |
| `.dmg-pop` / `.mob-hp` | 敵の頭上（例 448,169 / 456,184） | 中央に出る | 自然 |
| `#scenario-timer` | 373,64, 99×28 | **1,384 px²（50%）** | **強制表示（参考値）** |

**844×390 で常時表示 UI が中央 60%×60% に侵入している量**（本編・会話後、HD-D02 の判定対象）:

| UI | 侵入面積 | 要素に占める割合 |
| --- | --- | --- |
| `.hud-topleft` | 6,882 px² | 21% |
| `#btn-ult` | 2,704 px² | 100% |
| `#btn-attack` | 378 px² | 6% |
| 小計（Skill 2 未習得） | 9,964 px²（中央の面積の 8.4%） | — |
| `#btn-skill2`（習得後に加わる） | 1,058 px² | 60% |
| 小計（Skill 2 習得後） | 11,022 px²（中央の面積の 9.3%） | — |
| 参考: `.joy-zone`（見えない操作域） | 23,960 px² | — |

- 1280×800 では常時表示 UI の侵入は `#btn-ult` の 48 px² だけ。844×390 では左上パネル・必殺・攻撃（習得後は Skill 2 も）が侵入する。

#### 15.2.4 UI 同士の重なり（FACT: 実測矩形の交差。包含関係は除く）

| 重なり | 1280×800 | 844×390 |
| --- | --- | --- |
| `#hud-portrait` × `#weapon-badge` | 15×15（肖像の右下に重ねる設計） | 同じ |
| `#weapon-badge` × `#hud-loot` | 18×12（本編。TM は `#loot-potion-btn` と 7×11） | 同じ |
| `#hud-portrait` × `#hud-loot` | 44×9（TM 44×15） | 同じ |
| `#mp-fill` × `#hud-loot` | 57×7（TM 71×7） | 同じ |
| `.hud-topleft` × `#arena-toggle-btn` | 82×21（TM のみ・開発用） | 同じ |
| 一時表示 × `.joy-zone` | — | `#execute-prompt`（x355〜405）、`#interact-btn`（x336〜405）、`#combo-indicator`、`#msg-log`、`#btn-cam-left` |

- OBSERVATION（撮影 `phone-ch1-interact` / `phone-ch1-start-dialogue`）: `#hud-loot` が `#weapon-badge` の大部分と MP バーの左側を覆い、武器バッジは画面上ほぼ見えない（UI-001 F-05 と同じ現象を実画面で確認）。
- ヒットテスト（844×390、`document.elementFromPoint`）: `#execute-prompt` 表示中、`.joy-zone` と重なる (370,263) で `#execute-prompt` がタップを受け取る（FACT）。z-index は `#execute-prompt` 23、`#interact-btn` 22、`#touch-controls` 15。`#interact-btn` は `.show` 中 `pointer-events:auto`（CSS `main.css:517`）のため、重なる部分では同じくスティックより優先されると推測（INFERENCE。表示中のヒットテストは未実施）。`#combo-indicator` / `#msg-log` / `.hud-topleft` は `pointer-events:none`（FACT）。

#### 15.2.5 iPhone safe-area

| 項目 | 結果 |
| --- | --- |
| iPhone 実機 | **NOT_RUN**（この環境に実機なし） |
| 既定（inset なし） | `env(safe-area-inset-*)` はすべて 0px（FACT） |
| CDP `Emulation.setSafeAreaInsetsOverride`（左 47・右 47・下 21・上 0。横向き iPhone を想定した仮の値で、特定機種の実測値ではない） | 適用できた。`env()` が 47/47/21/0 を返すことを確認（FACT） |

エミュレーション下の 844×390（本編・会話後。FACT: 実測）:

- 下 inset に追従して動いたもの: `#btn-ult` / `#btn-charge` / `#btn-attack` / `#btn-jump` / `#btn-dodge` / `.joy-base` / `#btn-cam-*`（いずれも y が -21）。左右の inset には追従しない（x 変化なし）。
- 左 inset（x < 47）に入るもの: `.hud-topleft`（31px）、`#hud-portrait`（20px）、`#hud-loot`（31px）、`#loot-menu-btn`（18px）。
- 右 inset（x > 797）に入るもの: `#minimap-wrap` / `#minimap-label`（31px）、`#btn-jump`（25px）、`#btn-dodge`（17px）。
- 下 inset 移動の結果、`#btn-attack` の中央侵入は 378 → 740 px²（6% → 11%）に増えた。
- 実機のノッチ・角丸・ホームインジケータとの実際の干渉は UNCONFIRMED。

#### 15.2.6 自然表示で確認した事実（FACT）

- 本編 Chapter 1 の導入会話中（`animate()` の通常プレイ分岐が動く前）は、両サイズで `#weapon-badge` の文言が `M` で、`#btn-skill2`（🌀）と `#btn-skill3`（👑）が表示状態だった。会話後の通常プレイでは `#weapon-badge` は `🗡️`、`#btn-skill2` / `#btn-skill3` は非表示。844×390 の撮影では `#btn-skill3` が会話ボックスの上端から見えている（`14-hud-boot.js:1105-1164` の更新が会話中に走らないことと一致）。
- 本編・会話後に表示される常時 UI: `.hud-topleft`（名前・HP・MP・スタミナ・肖像・武器バッジ）、`#hud-loot`、`#btn-ult`、`#btn-charge`、`#btn-attack`、ミニマップとラベル、非タッチでは `#hud-hint`、タッチではスティック・`#btn-jump`・`#btn-dodge`・カメラ回転ボタン。
- 通常戦闘では中央トーストと `#msg-log` に同じ文言が出た（例 `✨ フィニッシュ!`、`💫 体勢を崩した!`、`💥 ダウン!`。HD-D17 の重複表示を実画面で確認）。1280×800 の 90 秒の連打でトーストは 37 件。
- ボスバーはボス出現後に `.show` になり、1280×800 では x380〜900、844×390 では x162〜682 の同じ 520×63。

#### 15.2.7 ミニマップ

- FACT: 表示条件は `state.started && !state.paused && !state.dialogueActive && state.activeOverlay==='none'`（`14-hud-boot.js:534`）で、戦闘の有無・場所による条件は無い。酒場・訓練場・シナリオのいずれでも表示された（実測）。
- FACT: 描くもの（`14-hud-boot.js:541` 以降）は壁、扉・階段・手記・宝箱・回復結晶・異常の裂け目の印、近接イベントの「!」、敵。ラベルは `AREA_NAMES[currentWorldKey]` と部屋名（`updateMinimapLabel()`、`:480-494`）。訓練場ではラベルが空（高さ 1px）。
- 「必要な状態 / 不要な状態」を判断する事実は、上の描画内容以上には無い。**未確定**（WI-D1 の表示条件表で Human が決める。HD-D11 の「必要時」）。
- E2E: `#minimap` を 11 spec と unit 1 件が参照する（`chapter1-dusk-basics` はキャンバスの画素色を読む）。表示条件を変えると、これらの前提（表示中であること）に影響しうる。

#### 15.2.8 E2E が依存する HUD の ID・class・文言のうち、実測上変更が必要になりそうなもの（記録のみ。変更していない）

| 対象 | 参照している spec | 実測との関係 |
| --- | --- | --- |
| `.hud-topleft` / `#weapon-badge` | `ui-foundation`（C1 の見た目の値） | 844×390 で中央に 21% 侵入、`#hud-loot` と重なる。位置・構成を変えると C1 の期待値の見直しが必要になりうる |
| `#btn-ult` / `#btn-charge` / `#btn-skill2` | `chapter1-legacy-ui`・`chapter1-skill2`・`chapter1-progression`・`chapter1-dusk-basics`・`auto-combo` | 844×390 で中央侵入（必殺 100%、Skill 2 60%）。HD-D08 の PC 非表示・HD-D14 の再配置で class・可視性の判定に影響しうる |
| `#mp-fill` / `#sta-fill` | `auto-combo` | HD-D10 / D11 で MP 表示の削除・スタミナの条件表示を行うと影響 |
| `#hud-name` | 7 spec（完全一致） | 位置の変更だけなら文言には影響しない |
| `#hud-hint` | `chapter1-legacy-ui` | HD-D07 の短時間表示で常時表示でなくなる |
| `#msg-log` / `.msg-log-line`・`.item-pop` | `#msg-log` 8 spec、`.item-pop` 4 spec | トーストとログの重複（15.2.6）を HD-D17 で統合すると読み先の変更が必要 |
| `#execute-prompt`（`.show`） | 5 spec | 両サイズで中央 100%（一時表示のため HD-D02 では許容）。HD-D16 の分離で位置を変えても `.show` の判定は保てる |
| `#interact-btn`（文言） | `shadow-guide`・`tavern-smith-greeting` | 同上。文言は変えない前提 |
| `#scenario-timer` | 4 spec + unit | 位置のみ（自然表示は未確認） |
| `#boss-bar-*` | `execution-break` | 中央外。変更の必要は実測上なし |
| `#combo-indicator` / `#hud-loot` / `#loot-potion-btn` / `.joy-*` / `#btn-attack` | 参照なし（`tests/` を検索） | — |

#### 15.2.9 実測できなかった項目（NOT_RUN / UNCONFIRMED）

| 項目 | 結果 | 理由 |
| --- | --- | --- |
| iPhone 実機（safe-area・ノッチ・親指の届く範囲） | NOT_RUN | 実機なし。CDP エミュレーションの値は仮の inset |
| 制限時間の自然表示 | NOT_RUN | Chapter 1 には制限時間のある出撃が無い（FACT: `tests/scenario-timer.spec.js:47, 72`）。値は強制表示の参考値のみ |
| 本編 Chapter 1 のボス戦・処刑・通常戦闘 | NOT_RUN | TM（Arena / 開始地点）で計測した。DOM・CSS が同じため位置は同じと推測（INFERENCE） |
| 844×390 の `#msg-log` 3〜6 行 | UNCONFIRMED | 自然に出たのは 2 行まで。1280×800 の 6 行（高さ 170）から、844×390 では上端 y約 136 まで伸び中央とスティックに重なると推測（INFERENCE） |
| `#interact-btn` 表示中のヒットテスト | UNCONFIRMED | 上の INFERENCE（15.2.4） |
| `#hud-floor`（部屋名） | UNCONFIRMED | 洋館入口では表示されなかった |
| `.mob-posture`（guardian / 強敵の体幹） | NOT_RUN | 対象の敵を出していない |
| `#gamepad-badge`・パッド接続時の `.gamepad-min` | NOT_RUN | パッド未接続 |
| ボスの体幹・フェーズ表示の内訳、長い文言・`branch-warn` のインタラクト | UNCONFIRMED | 1 種類の文言だけ計測 |
| 戦闘中の撮影 | 一部 NOT_RUN | 連打中は `page.screenshot` がタイムアウトしたため省略（矩形の計測は取得済み） |
| build / unit / E2E | NOT_RUN | WI-D0 の範囲外（テストは実行していない） |

- 既存 FAIL（mansion-escort Relaxed Stance、execution-break）・FLAKY 記録（job-traits）の分類は変更していない。
- §8.2 の CSS 計算値は参考値のまま残した。主な差: `.hud-topleft` の高さは実測 130（§8.2 は約 140）、844×390 の `#msg-log` 6 行・`#scenario-timer` は実測できていない。

## 16. 変更したファイル

- `.ai/reports/UI-002-D-analysis.md`（新規）のみ。commit / push はしていない。
- 2026-09-28 WI-D0: 本ファイルに §15.2 を追記し、§8 冒頭に参照の注記を 1 行加えた。ソース・テスト・Task・Decision record は変更していない。commit / push はしていない。
