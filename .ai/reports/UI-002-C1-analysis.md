# UI-002-C1 Analyzer Report

- Role: Analyzer（READ ONLY。変更したのは本ファイルのみ）
- Task: `.ai/tasks/UI-002-C1.md`（Status: DRAFT。変更していない）
- Date: 2026-09-27
- Session: UI-001 以降と同一の Claude Code セッション（独立性なし）

表記: **FACT** = コード・実行結果で確認した事実 / **OBSERVATION** = 画面・集計から読み取れる傾向（評価を含まない）/ **INFERENCE** = 推測 / **HUMAN DECISION** = Human（V を含む）が決める事項。
本レポートは色・サイズ・書体・形の「正解」を決めない（HD-5: 見た目の決定は UI-002-V）。§16 は Planner / Human の判断材料であり決定ではない。

---

## 1. Baseline

| 項目 | 値 |
| --- | --- |
| Baseline | `origin/main` @ `63235ce34edcd1c42787f114d0e4ac43f300ad10`（UI-002-A / UI-002-B merge 後） |
| Branch | `claude/ui-002-c1-analysis`（上記から作成） |
| 対象 | `index.html`（479 行）、`src/styles/main.css`（1294 行）、`src/legacy/parts/*.js`、`src/core/*.js`、`src/render/player-palette.js` |
| 画面確認 | dev サーバ（Vite）+ Chromium headless（SwiftShader）。1280×800（非タッチ）/ 844×390（`hasTouch` + `isMobile`）。通常 URL と `?dev=1` |
| 制約 | Google Fonts への接続はこの環境で拒否されるため、撮影は **Web フォント未読み込み（フォールバック書体）** で行った。computed style の `font-family` 名は CSS の指定値であり、実描画の書体ではない |

## 2. Source / Commit

| Artifact | 参照 |
| --- | --- |
| UI-001 Analyzer report | `claude/ui-001-analysis-380kl5` @ `4830a3804ea0874ae803b951c01dabaad68cfe88`、blob `c976f1c3b3e0a0b089e6b7eacde2b39f6f07b10a`（main には無い。ブランチから読んだ） |
| UI-002 Planner report | `claude/ui-002-planner` @ `eadb5e3cac983cf90911610d6da3deadc0af34a5`、blob `a23563e8c481e97c9b01fd063407c357c8c7668e`（同上） |
| Decision record | `.ai/decisions/UI-002-human-decisions.md`（main @ `63235ce`） |
| UI-001 との差 | UI-001 は UI-002-A / B より前の baseline。本レポートの数値は `63235ce` で取り直した（CSS の集計値は UI-001 とほぼ同じ。差は §13 に記載） |

集計方法（FACT の前提）: `main.css` からコメントを除き、正規表現で宣言値を集計（Python）。「使用中」判定は `index.html` + `src/legacy/parts/*.js` + `src/core/*.js` に名前の文字列一致があるか。動的に組み立てた class 名は取りこぼす可能性がある（該当は §7.3 に注記）。

---

## 3. CSS Token Inventory

### 3.1 `:root` 変数（`main.css:3-14`）

| 変数 | 値 | `var()` 使用数 |
| --- | --- | --- |
| `--ember-bright` | `#f0a05c` | 79 |
| `--panel-line` | `#3a2f4a` | 59 |
| `--text-dim` | `#a99fb0` | 57 |
| `--text` | `#e9e1d6` | 33 |
| `--ember` | `#c9793f` | 12 |
| `--mp` | `#2d6f8e` | 6 |
| `--panel` | `#15111c` | 4 |
| `--gold` | `#c9a24b` | 4 |
| `--hp` | `#a4293d` | 3 |
| `--bg` | `#0c0a10` | 1 |
| （`--cd-pct`） | JS から設定（クールダウンリング） | 1 |

- 色以外（size / radius / spacing / shadow / z-index / font）の変数は **0**。

### 3.2 値の分布（`main.css`、distinct / 出現数）

| 種類 | distinct | 出現 | 主な値（出現数） |
| --- | --- | --- | --- |
| hex 色 | 99 | 186 | §4 |
| rgb/rgba | 97 | 122 | — |
| font-size | 23 | 163 | 13px(19) 11px(17) 12px(17) 9.5px(15) 11.5px(14) 10px(12) 10.5px(11) … |
| font-family | 10 | 32 | §5 |
| font-weight | 4 | 36 | 700(32) 400(2) 600(1) normal(1) |
| border-radius | 13 | 97 | 6px(25) 4px(15) 50%(13) 8px(12) 10px(6) 2px(5) 5px(5) 16px(5) 20px(4) 3px(3) 7px(2) 12px(1) 14px(1) |
| border（shorthand / 各辺） | 27 | 92 | §6 |
| box-shadow | 23 | 24 | §6 |
| text-shadow | 9 | 9 | 各 1 回 |
| opacity | 11 | 64 | 1(25) 0(15) 0.4(6) 0.55(5) 0.35(5) 0.9(2) 0.3(2) 0.72 0.8 0.85 0.45 |
| z-index | 19 | 45 | §3.3 |
| padding | 60 | 79 | ほぼ selector ごとに固有 |
| gap | 12 | 50 | 10px(10) 8px(9) 6px(9) 4px(6) 14px(4) 5px(4) 12px(3) … |
| margin | 7 | 7 | — |
| letter-spacing | 13 | 26 | 1px(5) 0.02em(3) 0.05em(3) 0.1em(3) …（`0.08em` と `.08em` の表記揺れあり） |
| line-height | 9 | 16 | 1 / 1.3 / 1.4 / 1.45 / 1.5 / 1.55 / 1.7 / 1.85 / 1.9 |
| gradient | 3 種 | 46 | linear 37 / radial 8 / conic 1 |
| backdrop-filter | 3 | 5 | blur(4px)×2（`.hud-topleft` `.hud-loot`）/ blur(3px)×2（`#menu-overlay` `.event-overlay`）/ blur(2px)×1（`#confirm-overlay`） |
| filter | 5 | 7 | `#canvas-wrap.victory-blur` の blur(9px) ほか brightness |
| @media | 1 | 1 | `(max-width:640px){ .class-grid{…2列} }` のみ |
| @keyframes | 13 | 13 | うち `diceShake` `diceSettle` `yakuPulse` は未使用 UI（§7.3）用 |
| transition / animation | 23 / 14 | 33 / 14 | — |

### 3.3 z-index（selector 別、FACT）

| 値 | selector |
| --- | --- |
| -1 / 2 / 3 / 5 | リング疑似要素 / 奥義の環ノード / 必殺・スキルボタン / `.joy-zone` |
| 14 | `#minimap-wrap` `#minimap-label` |
| 15 / 16 | `#touch-controls` / `#hud` `#combo-indicator` ほか未使用 touch ボタン 4 種 |
| 20 | `#title-screen` `#testmode-screen` |
| 21–25 | `#msg-log`(21) `#interact-btn`(22) `#execute-prompt`(23) `#screen-flash` `#loot-*-btn`(25) |
| 30 | `.hud-topleft` `.hud-loot` `.mob-hp` `.mob-posture` `#menu-overlay` `#debug-badge` `#perf-panel` `#motion-panel` |
| 31 | Arena 4 要素（toggle / panel / feedback / enemy-info） |
| 35 | `.event-overlay`（結果・戦闘不能・鑑定所・出撃）`#dialogue-overlay` |
| 39 / 40 | `#scenario-timer` / `#boss-bar-wrap` `#boot-msg` |
| 60 | `#screen-fade` `#rotate-overlay` |
| 120 | `#confirm-overlay` |

### 3.4 inline style / JS 由来のスタイル（FACT）

- `index.html` の `style="…"` 28 箇所。表示切替（`display:none` 13）以外に、見た目を持つもの: 縦持ち案内（`font-size:18px` / `12px; color:var(--text-dim)`）、戦闘不能タイトル `color:#c9576a`、ペナルティ行 `color:#e0a04a`、メニュー操作説明の注記 `color:var(--ember-bright); font-size:10.5px`。
- `src/legacy/parts` の HTML テンプレート内 `style="…"` は `12-progression-ui.js` の 7 箇所のみ（配置値・`cursor:default`・`color:#ffd27a`）。
- `.style.X =` の代入: display 38 / opacity 10 / width 9 / left 6 / color 6 / top 6 / transform 3 / fontSize 2 / animation 2。見た目の値を持つもの: トースト既定色 `#e9e1d6`・`fontSize 15px`（11:2239-2240）、報酬ポップ `#ffd580`・`18px`（12:1983-1984）、味方ダメージ `#9fe8ff`（11:2170）、ドロップ色（`LOOT_TABLE.color` の数値 → hex、11:2199）、ステ振り差分 `#ffd27a`（12:2560）。
- トーストの色引数（`spawnToast(text, color)` 192 呼び出し中、hex 直書き 10 箇所: `#c9b6e8` `#c25a6b` `#6adfc0` `#ffe6a0` `#ffd27a` `#ffcf6a` `#7ecbe8`）。
- ミニマップは Canvas 描画（`drawMinimap()`、14-hud-boot.js:529）で、CSS 変数を参照しない（`fillStyle` / `strokeStyle` に rgba・hex 直書き）。

---

## 4. Color Inventory

### 4.1 用途別（FACT、`63235ce`）

| 用途 | 色 | 出所 |
| --- | --- | --- |
| 背景 | `--bg #0c0a10`、タイトル / テストモードの `linear-gradient(#0c0a10 → #0a0810)` + radial（タイトル=ember 系 `rgba(201,121,63,.10)`、テストモード=MP 系 `rgba(45,111,142,.12)`） | main.css:30-35, 588-595 |
| パネル | `linear-gradient(var(--panel), #100d16)` + 1px `--panel-line`（`.cc-frame` `.menu-box` `.event-box` `.appraisal-box`）、HUD 系は `rgba(12,10,16,.55)` + blur | 各 selector に個別記述 |
| 主ボタン | 橙グラデ `var(--ember) → #9c5e2c`、文字 `#1a1108`（`#cc-start-btn` `.menu-btn.primary` `.ap-tab.active` `.skill-subtab.active` ほか） | — |
| 確認ボタン | 明るい金グラデ（`.confirm-btn`）、枠 `rgba(255,180,90,.32)`、角丸 12px | main.css:358-379 |
| HP / MP / スタミナ / XP | `#7a1c2c→--hp` / `#1c4a5f→--mp` / `#5a6a1c→#c9d94b` / `#5a3d8a→#a05fe0` | main.css:661-665 |
| ボス HP / 雑魚 HP / 体幹 / 崩し目前 | 赤橙グラデ / `#e2534a→#ffa257` / 青 / `#ffb347→#ffe0a0` | main.css:300, 327-351 |
| ダメージ | 与ダメ（既定）/ 会心 `#ff5a5a` / 被ダメ `#ff8a4a` / 被会心 `#ff2a2a` / 味方 `#9fe8ff`（JS） | main.css:841-855, 11:2170 |
| 装備比較 | ↑ `#7ad08a` / ↓ `#c05a5a` | main.css:1112-1113 |
| 選択（本編） | `--ember-bright` 枠 + 橙の薄い塗り / 橙グラデ塗り | `.class-card.selected` `.ap-charge-card.active` `.ap-tab.active` |
| 選択（テストモード） | `--mp`（青）枠 + 青グラデ | `.testmode-job-card.selected`（main.css:610） |
| 選択済み（3 択報酬） | `#5a8a4a` 枠 + `#182418` 塗り（緑） | main.css:1174 |
| パッドのフォーカス | `box-shadow:0 0 10px var(--ember-bright) !important`（`.gp-focused`） | main.css:1276 |
| 戦闘不能見出し / ペナルティ | `#c9576a` / `#e0a04a`（index.html inline） | index.html:380, 382 |
| ドロップ | 金貨 `0xdfc255` / 欠片 `0xb0a08a` / 魔宝石 `0x6fd1e6` / 薬草 `0x6ec96e` / 魔力の雫 `0x6f9fd1`（`LOOT_TABLE.color`、3D と共用） | 08-loot-equipment.js:8-12 |
| 開発用 | DEBUG バッジ 赤 `rgba(200,40,60,.85)` / PERF 緑系文字 / Motion 紫系文字 / Arena 紫（`#8a5ac0` 系） | main.css:418-500 |

### 4.2 色系統の意味の重なり（FACT: 同じ系統が複数の意味で使われている箇所）

| 系統 | 使われている意味 |
| --- | --- |
| 赤 | 自分の HP、ボス HP（赤橙）、雑魚 HP、会心、被会心、DEBUG バッジ、装備比較↓、戦闘不能見出し、凡例「Lv不足」（テストモードのみ表示） |
| 橙（ember） | 押せる（主ボタン）、選択中（タブ・カード）、フォーカス（`.gp-focused`）、ポートレート枠、必殺ゲージ、被ダメージ、雑魚 HP の明部、崩し目前、特殊装備 |
| 金 | 確認ボタン、つづきから（`--gold`）、崩し目前の明部、ドロップ（金貨）、`--gold` の 4 箇所 |
| 青 | MP、体幹、テストモードの選択色、魔力の雫、味方ダメージ（水色） |
| 緑 | スタミナ（黄緑）、装備比較↑、3 択の選択済み、奥義の環の解放済み、薬草、PERF パネル文字 |
| 紫 | XP（テストモードのみ）、レア装備、Arena（開発用）、Motion Preview（開発用）、トースト `#c9b6e8` |

### 4.3 Character palette（FACT）

- 職業の色は 2 か所: `CLASSES[*].color / trim`（01-character-creation.js:22-168、THREE 用の数値）と `src/render/player-palette.js`（`PLAYER_FINISH` / `WEAPON_FINISH` / `resolvePalette`）。
- どちらも **3D の材質・テクスチャ生成（06-player-enemy.js `hexStr()` → `makeLeatherTexture` / `makeMetalTexture`）にだけ使われ、DOM / CSS からは参照されていない**（`toString(16)` を DOM に使うのはドロップ色 11:2199 のみ）。
- HUD のポートレート枠は全職 `--ember-bright`（`.hud-portrait`、main.css:643-647）。

---

## 5. Typography Inventory

### 5.1 font-family（FACT）

| 指定 | 出現 | 主な用途 |
| --- | --- | --- |
| `'Noto Sans JP', sans-serif`（`html,body` 既定を含む 5） | 5 | 本文既定 |
| `'Cinzel','Noto Serif JP',serif`（空白違いを含む 10） | 10 | `.display`（タイトル・画面見出し・話者名）、ダメージ数値 |
| `'Noto Serif JP',serif`（9） | 9 | 主ボタン・カード名 |
| `'Cinzel',serif` | 2 | — |
| `ui-monospace,SFMono-Regular,Menlo,monospace` | 2 | PERF / Motion Preview |
| `'JetBrains Mono', ui-monospace, monospace` | 1 | 制限時間（JetBrains Mono は読み込み指定なし） |
| `inherit` | 3 | `.confirm-btn` / `.menu-setting-btn` 系 / ほか 1 |

- Web フォントは `main.css:1` の Google Fonts `@import`（Cinzel 500/700、Noto Serif JP 500/700、Noto Sans JP 400/500/700）。
- **`<button>` 要素は `font-family` を継承しない**（ブラウザ既定）。明示指定の無い button はブラウザ既定書体で描画される。実測（computed style）: Arena パネル 21 要素、テストモードの鑑定所画面 31 要素が `Arial`（Chromium 既定）。button の総数は `index.html` 51、JS テンプレート 16 + `createElement('button')` 1。

### 5.2 font-size（FACT）

- 23 種: 8.5 / 9 / 9.5 / 10 / 10.5 / 11 / 11.5 / 12 / 12.5 / 13 / 13.5 / 14 / 14.5 / 15 / 16 / 17 / 18 / 19 / 20 / 24 / 26 / 42px / `clamp(26px,4vw,38px)`。
- 役割ごとの主な値: 画面見出し 20px（メニュー）/ タイトル clamp（1280 幅で 38px、844 幅で 33.76px を実測）/ 本文 11〜13px / ボタン 12〜16px / HUD ラベル 8.5px / ダメージ 20px・会心 26px / 操作ヒント 11〜12px / 開発用パネル 10〜11px（monospace）。

### 5.3 10px 未満（FACT、CSS 上 23 箇所）

| 値 | selector（行） | 画面で実際に表示されるか（§8 の撮影で確認） |
| --- | --- | --- |
| 8.5px | `.bar-label`（666）HUD の HP / MP / スタミナ | **表示される**（本編・テストモード、両サイズ） |
| 8.5px | `.boss-choice-desc`（1172）3 択報酬の説明 | ボス撃破後のみ（未撮影） |
| 9px | `.gear-slot-weapontype`（1134）`.gear-item-weapontype`（1138） | **表示される**（鑑定所「装備品」、テストモードで撮影） |
| 9px | `.boss-ability-slots`（1147）`.sphere-points-note`（1182）`.sphere-zoom-pct`（1198）`.sphere-detail-status`（1234） | テストモードの画面のみ（本編はタブ非表示） |
| 9.5px | `.weapon-badge`（649） | **表示される**（HUD、両サイズ） |
| 9.5px | `.gear-slot-label` `.gear-slot-stat` `.gear-item-stat`（1084-1100） | **表示される**（鑑定所「装備品」） |
| 9.5px | `.gear-item-special` `.gear-slot-special` `.gear-item-btn.sell` `.gear-item-compare`（1094-1111） | 条件付き（特殊装備・売却・比較時） |
| 9.5px | `.hud-floor`（658） | ダンジョン内のみ（未撮影） |
| 9.5px | `.ap-charge-desc`（1077） | 鑑定所「スキル」 |
| 9.5px | `.boss-ability-desc` `.boss-ability-toggle`（1157-1158）`.sphere-respec-btn`（1183） | テストモードの画面のみ |
| 9.5px | `.personality-desc`（95）`.dice-history-cap`（181） | **未使用 selector**（§7.3） |

---

## 6. Radius / Border / Shadow Inventory

### 6.1 border-radius（FACT）

| 値 | 出現 | 主な使用箇所 |
| --- | --- | --- |
| 6px | 25 | パネル（`.cc-frame` `.menu-box` `.event-box` `.appraisal-box` `.hud-topleft`）、設定ボタン |
| 4px | 15 | 主ボタン（`#cc-start-btn` `.menu-btn` `.ap-tab`）、カード（`.class-card`） |
| 50% | 13 | アクションボタン、ポートレート、ミニマップ、pip、ノード |
| 8px | 12 | 会話ボックス、各種行 |
| 10px | 6 | Arena パネル ほか |
| 16px / 20px | 5 / 4 | pill 形ボタン（`.event-btn` 出撃・結果・購入・反映） |
| 2px / 3px / 5px / 7px | 5 / 3 / 5 / 2 | バー、凡例、小要素 |
| 12px / 14px | 1 / 1 | 確認ダイアログ / 1 箇所 |

区別（OBSERVATION。統合するかは決めない）:
- 同じ「役割」で値がそろっている群: パネル 6px（4 系統）、アクション・丸アイコン 50%。
- 同じ「役割」で値が分かれている群: 主ボタン（4px 長方形 / 16–20px pill / 確認 12px 系）、ダイアログ系パネル（6px / 8px 会話 / 12px 確認 / 10px Arena）。
- 形そのものに意味がある値: 50%（円形の操作ボタン・ゲージ）、pill（現状は「確定・進行」系ボタンに多い）。

### 6.2 border（FACT）

- 27 種。太さ 1px が大半、1.5px / 2px が一部。線種 solid / dashed（`1px dashed var(--panel-line)` はメニュー行・区切り）。色は `--panel-line`（59 回の大半）、`--ember-bright`（選択・強調）、`--mp`（テストモード選択）、rgba の金（確認）、紫（Arena）。

### 6.3 shadow（FACT）

| 種類 | 値 | 使用箇所 |
| --- | --- | --- |
| パネル外影 | `0 18〜30px 50〜80px rgba(0,0,0,.6〜.65)`（5 種） | `.cc-frame` `#confirm-box` `.menu-box` `.event-box` `.dialogue-box` `.appraisal-box` |
| 内側の選択線 | `0 0 0 1px/2px var(--ember-bright)` | `.class-card.selected` `.sphere-node.selected` |
| glow（常時） | `.combo-pip.current` `#boss-bar-fill`（`0 0 12px rgba(255,90,50,.7)`）`#execute-prompt`（`0 0 18px rgba(255,170,80,.35)`） | 表示中は常時 |
| glow（アニメーション） | `ultReady`（必殺準備完了）、`execPulse`（処刑プロンプト） | 状態の間ずっと脈動 |
| glow（状態） | `.gp-focused`（`0 0 10px var(--ember-bright) !important`） | パッド操作中のフォーカス |
| 内影 | `#boss-bar-track` `#minimap-wrap` `.die` | — |
| text-shadow | 9 種（各 1 回）: ミニマップ・ボス名・ダメージ・ヒント等の縁取り、`rgba(120,60,180,.9)`（紫の縁）ほか | — |

---

## 7. Component Inventory

### 7.1 実装箇所（FACT。「表示」列は §8 の撮影で確認したもの）

| 部品 | 主な実装（DOM / CSS） | 生成 | 表示確認 |
| --- | --- | --- | --- |
| panel | `.cc-frame`（タイトル・テストモード）/ `.menu-box` / `.event-box`（結果・戦闘不能・鑑定所・出撃は `.appraisal-box` 等）/ `.dialogue-box` / `#confirm-box` / `.hud-topleft` / `.arena-panel` | 静的（index.html）+ 中身は JS | タイトル・会話・メニュー・確認・鑑定所・Arena |
| button | `#cc-start-btn` `#cc-continue-btn` `.menu-btn(.primary)` `.menu-setting-btn` `.confirm-btn(.ghost)` `.event-btn` `.ap-tab` `.skill-subtab` `.gear-item-btn` `.gear-tool-btn` `.ap-equip-btn/.ap-skill-btn/.ap-apply-btn` `.ap-rank-btn` `.sphere-*-btn` `.scenario-sortie-btn` `.action-btn` `#loot-menu-btn` `#loot-potion-btn` `#btn-cam-left/right` `.testmode-link-btn` `#testmode-start-btn` Arena の `button` | 静的 + JS テンプレート | 各画面 |
| tab | `.ap-tab`（鑑定所）/ `.skill-subtab`（スキル内）/ Arena は無し | JS（12-progression-ui.js） | 鑑定所 |
| header | `.display` クラス + 画面ごとの `*-title`（`.menu-title` `.event-title` `.cc-title` `.cc-eyebrow` `.cc-section-label`） | 静的 | タイトル・メニュー・確認・鑑定所 |
| status display | `.hud-topleft`（名前行・`.bar-*`・ポートレート・`.weapon-badge`）/ `.menu-stat-line` / 鑑定所ヘッダの所持金 | 静的 + `updateHUD()` 等 | HUD・メニュー・鑑定所 |
| badge | `.weapon-badge` / `#debug-badge` / `.sc-next`「▶ 次はここ」/ 装備の武器種チップ | 静的 / JS | HUD・DEBUG・鑑定所 |
| notification / toast | `.item-pop`（中央トースト、`spawnToast()` 192 呼び出し）/ `#msg-log .msg-log-line`（左下ログ）/ `.dmg-pop` / `#arena-feedback-log`（開発用） | JS 生成 | DEBUG ON トースト・ログ |
| dialog / confirmation | `#confirm-overlay #confirm-box`（`askConfirm()`、12:2517） | 静的 + JS | 確認（両サイズ） |
| menu | `#menu-overlay .menu-box`（`toggleMenu()`、10:198） | 静的 | メニュー（両サイズ） |
| list / row | `.menu-stat-line` `.menu-setting-row` `.gear-item-row` `.ap-skill-row` `.scenario-card` `.boss-ability-*` | 静的 / JS | メニュー・鑑定所 |
| card | `.class-card` `.testmode-job-card` `.ap-charge-card` `.boss-choice-card` `.scenario-card` `.gear-slot` | JS | テストモード・鑑定所 |
| input | `#testmode-level`（range）のみ。テキスト入力は無し（`.name-input` は未使用） | 静的 | テストモード |
| progress bar | `.bar-track/.bar-fill`（HP/MP/スタミナ/XP）/ `#boss-bar-*` / `.mob-hp` `.mob-posture` / クールダウンリング（`conic-gradient` + `--cd-pct`）/ `.combo-pips` | 静的 + JS | HUD |
| icon | emoji・Unicode 記号のテキスト（定義オブジェクトの `icon:`）、CSS 疑似要素（`#interact-btn::before` 等）、Canvas（ミニマップ）。画像・SVG アイコンは無し | 各所 | 全画面 |
| tooltip / hint | `#hud-hint`（1 行ヒント、非タッチのみ表示）/ `.menu-controls`（メニュー内の操作説明）/ `.dialogue-next`「クリックして続ける ▼」/ `title=` 属性（奥義の環ノード） | 静的 | HUD（1280）・メニュー・会話 |
| overlay | `#menu-overlay` / `.event-overlay`（4 種）/ `#dialogue-overlay` / `#confirm-overlay` / `#screen-fade` / `#screen-flash` / `#rotate-overlay` / `#title-screen` `#testmode-screen` | 静的 | 各画面 |

### 7.2 状態クラス（FACT）

| 状態 | 使われている表現 |
| --- | --- |
| 表示 | `.active`（overlay・touch）/ `.show`（debug・arena・perf・motion）/ `style.display` 直接操作 38 箇所 |
| 選択 | `.selected`（class-card / testmode-job-card / sphere-node）/ `.active`（ap-tab / skill-subtab / ap-charge-card）/ `.picked`（3 択）/ `.equipped` 系 |
| 無効 | `opacity` 0.35 / 0.4 / 0.45 / 0.55、`:disabled`、`.locked`（アクションボタンは `display:none`）、`.resolved` |
| フォーカス | `.gp-focused`（パッド）。`:focus` / `:focus-visible` の規則は無し |
| 押下 | `:active` の `transform`（scale / translateY）、`.pressed`（アクションボタン） |
| hover | 一部カード・ボタンのみ（`.class-card:hover` `#cc-start-btn:hover` ほか） |

### 7.3 CSS にのみ存在する selector（FACT）

342 個の class / id selector のうち **40 個** は `index.html` / `src/legacy/parts` / `src/core` に名前の文字列が無い:
`#btn-appraisal-touch #btn-menu-touch #btn-sortie-touch #dice-roll-btn #gate-prompt .alloc-derived .alloc-preview .ap-add .ap-base .ap-k .cam-btn .cc-start-hint .dice-history .dice-history-cap .dice-history-entry .dice-panel .dice-row .dice-stage .dice-total .dice-yaku .die .gender-grid .name-input .name-random-btn .name-row .perf-warn .personality-desc .rolling .settled .sc-clears .sc-max .sc-stars .scenario-card-level .scenario-card-stars .special-hint .stat-alloc .stat-bar-mini .stat-row .town-prompt .wild`
- 多くはキャラメイク廃止（#41）の残り（dice / gender / name / alloc / personality）と、使われなくなった touch ボタン。
- 動的な class 名の組み立て（`'sc-'+x` 等）は grep で見つからなかったが、全件の実行時確認はしていない（UNCONFIRMED）。

---

## 8. Responsive Inventory

### 8.1 仕組み（FACT）

- CSS の `@media` は **1 件のみ**（`max-width:640px` の `.class-grid` 2 列化 = テストモードの職業グリッド）。
- 画面サイズへの追従は `min()` / `clamp()` / `vw` / `vh` / `vmin`（例: パネル幅 `min(420px,90vw)`、`max-height:88vh`、タイトル `clamp(26px,4vw,38px)`、ミニマップ `clamp(104px,14vmin,200px)`）と `env(safe-area-inset-*)`（top 14 / bottom 12 / right 2）。
- **PC 向け / タッチ向けの切替はビューポートではなく入力で決まる**: `isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0`（10-input.js:7）。
  - タッチ: `#touch-controls.active`（スティック・JUMP・回避・カメラ回転ボタン）、`#hud-hint` を非表示（14-hud-boot.js:1804）。
  - 非タッチ: `#touch-controls.gamepad-min`（攻撃・スキル・必殺のみ、`pointer-events:none`）、`#hud-hint` 表示。
  - 縦持ち: タッチ端末で縦長のとき `#rotate-overlay`（10-input.js:38-45）。

### 8.2 撮影結果（FACT。1280×800 = 非タッチ、844×390 = タッチ、Web フォント未読み込み）

| 画面 | 1280×800 | 844×390 |
| --- | --- | --- |
| タイトル | カード中央、タイトル 38px | 同構成、タイトル 33.76px（clamp）、カードが縦幅の大半 |
| 会話 | 下寄せ `min(640px,92vw)` | 同じ部品。HUD 右下のボタン群・スティックの上に重なる |
| 酒場 HUD | 左上パネル・所持品チップ・ミニマップ・右下 3 ボタン（`gamepad-min`）・下中央の 1 行ヒント | 左上・ミニマップは同じ位置・同じ大きさ。右下は 攻撃 / JUMP / 回避 / スキル / 必殺、左下スティック、下中央にカメラ回転 2 ボタン。ヒントなし |
| メニュー | `min(420px,90vw)`、`max-height:88vh` でスクロール | 同じ部品。高さ 343px 相当で、ステータス行の途中までが 1 画面 |
| 確認 | 中央 `min(380px,84vw)` | 同じ（撮影済み） |
| 鑑定所（テストモードで撮影） | 中央 `min(520px,92vw)` | 同じ部品。タブ 5 つが横並びで「ステータス配分」が 2 行に折り返す。1 画面に入るのは上部のみ |
| テストモード画面 | `.cc-frame` 内をスクロール | 職業カードまでで 1 画面が埋まる |
| Arena（開発用） | 左上パネル下に縦長パネル | 同じ大きさで画面の左半分を覆う。メニューを開いても Arena パネル（z-index 31）がメニュー（30）の上に残る |

- 同じ部品を layout ごとに作り変えている箇所は無い（位置・大きさは `min()` 等の比率で縮むだけ）。
- 1280 幅・非タッチの `#hud-hint` は 1 行（撮影からの目測で約 790px 幅）。844 幅・**非タッチ**（PC ブラウザを狭めた場合）は撮影していない（NOT_CAPTURED）。

### 8.3 撮影の再現性（FACT、Task の Analyzer requirements「見た目不変の検証手段」）

同じ手順を 2 回実行し、PNG の SHA-1 を比較:

| 対象 | 2 回の一致 |
| --- | --- |
| タイトル（全画面） | 一致 |
| タイトルの `.cc-frame`（要素） | 一致 |
| 酒場 HUD（全画面） | 不一致 |
| `.hud-topleft`（要素） | 不一致 |
| `.menu-box`（要素） | 不一致 |

- 3D シーンの上に重なる要素（半透明背景・`backdrop-filter` を持つ HUD / メニュー）はピクセル比較が安定しない。3D を持たない画面（タイトル）は安定。
- 既存 E2E に `toHaveScreenshot` の使用は 0 件。`page.screenshot` は 4 spec（撮影用途）。

---

## 9. Semantic Color / Character Palette Separation

- FACT: UI の意味色と 3D キャラの配色は **コード上分離されている**（§4.3。UI は `CLASSES.trim` / `player-palette.js` を参照しない）。
- FACT: 一方で UI の意味色の内部では、1 系統が複数の意味を持つ（§4.2）。特に ember（橙）が「押せる」「選択中」「フォーカス」「被ダメージ」を兼ね、赤が「自分の HP」「敵 HP」「会心」「DEBUG」を兼ねる。
- FACT: ドロップの色（`LOOT_TABLE.color`）は 3D の拾得物とトースト文字色の両方に同じ値で使われる（11:2199）。
- FACT: テストモードは選択色に `--mp`（MP の意味色）を使う。
- 関連する既存資料（参照のみ。Human Decision ではない）: UI-002 Planner report P-9「キャラクター identity と UI semantic を分ける」、§11.1〜11.3（UI semantic / Character identity / Dev color の 3 分類、`player-palette.js` を UI に流用しない）。Decision record には色の分離方針の記載は無い（`63235ce` 時点、FACT）。

---

## 10. Production UI vs Dev UI

### 10.1 前提（FACT、UI-002-B）

- 通常 URL ではテストモード入口・デバッグモードに到達できず、`?dev=1` の時だけ有効（`src/core/dev-ui.js`、UI-002-B DONE）。
- 開発用 UI の DOM・CSS は本番と **同じ `index.html` / `main.css` に同居** し、表示は `state.testMode` / `state.debugMode` / `.show` で切り替わる。

### 10.2 token・部品の共有状況（FACT、`main.css` の selector 群ごとの集計）

| 群 | rule 数 | `var()` | hex | rgba |
| --- | --- | --- | --- | --- |
| Arena | 14 | 1 | 10 | 6 |
| DEBUG / PERF / Motion | 7 | 0 | 4 | 3 |
| テストモード画面 | 16 | 10 | 5 | 3 |
| タイトル | 23 | 17 | 8 | 5 |
| HUD | 130 | 55 | 50 | 57 |
| メニュー | 18 | 16 | 5 | 6 |
| 会話 | 7 | 4 | 0 | 4 |
| 結果・戦闘不能 | 18 | 12 | 8 | 2 |
| 確認 | 9 | 3 | 5 | 6 |
| 鑑定所系 | 123 | 89 | 57 | 7 |
| 出撃 | 12 | 7 | 4 | 1 |

- Arena・DEBUG・PERF・Motion は `:root` 変数をほぼ使わず独自色（紫・赤・緑・monospace）。テストモード画面は本編の `.cc-frame` / `.class-card` を共有し、選択色だけ `--mp`。
- 鑑定所（`toggleAppraisal()`）はテストモードでも同じ部品（Arena の「スキル / スフィア盤」から開く）。本編では一部タブが非表示（UI-002-A）。
- Arena のボタンは `button` 要素で書体指定が無く、ブラウザ既定書体になる（§5.1）。

### 10.3 C1 に含めるかの判断材料（決定ではない）

- 本番と共有している部品: テストモード画面（`.cc-frame` / `.class-card`）、鑑定所、メニュー、確認、HUD 全般。
- 開発専用の部品: Arena、DEBUG バッジ、PERF、Motion Preview、`#arena-feedback-log`、`#arena-enemy-info`、`.testmode-job-card`。
- UI-002 Planner report §11.1 は「Dev color を本番の色と重ねない」を提案している（PROPOSAL）。

---

## 11. Legacy / Architecture Dependencies

| 層 | UI に関わる内容（FACT） |
| --- | --- |
| `index.html` | HUD・オーバーレイ・メニュー・開発用パネルの静的骨格（id 多数）、inline style 28 |
| `src/styles/main.css` | 全 UI の CSS（1 ファイル、486 rule）。先頭で Google Fonts を `@import` |
| `src/legacy/parts/*.js` | 1 スコープに連結（`concat-plugin.js`）。画面の中身を HTML 文字列で生成（主に `12-progression-ui.js`）、`.style.*` 直接操作、トースト・ダメージ表示・ミニマップ Canvas |
| `src/core/*.js` | UI の判定・文字列（`chapter1-rules.js` の `hudLabel()` 等、`dev-ui.js`、`motion-preview.js`）。DOM・CSS には触れない |
| `src/render/player-palette.js` | 3D 配色のみ |

注意点（FACT）:
- CSS の値は JS からも直接書かれている（§3.4）。CSS 変数化だけでは JS 側の色・サイズは変わらない。
- E2E は class 名に依存: `toHaveClass(/active/)` 77、`/show/` 28、`/locked/` 6、`/selected/` 3。class selector では `.testmode-job-card` 42、`.class-card` 38、`.scenario-sortie-btn` 10、`.dmg-pop` 9、`.ap-tab` 5、`.item-pop` 4、`.ap-charge-card` 4。`getComputedStyle` 1（`chapter1-legacy-ui.spec.js`、表示判定）、`boundingBox` 2（Arena ボタンとメニューボタンの重なり）。
- 状態 class（`.active` / `.show`）は表示制御とテストの両方に使われている。
- `.gp-focused` は `!important` を持つ（パッド操作のフォーカス表示）。
- `@import` の Web フォントはネットワーク依存（この環境では読み込めない）。

---

## 12. Existing Problems / Risks

（事実の列挙。優先度・対策は決めない）

1. token は色 10 個のみで、他の値は直書き（§3）。
2. 同じ役割の部品が複数の見た目を持つ（主ボタン、選択、無効、ダイアログ角丸）（§6.1、§7.2）。
3. 色系統の意味の重なり（§4.2）。
4. 10px 未満の文字が本編の HUD（8.5px / 9.5px）と鑑定所に表示される（§5.3）。
5. `<button>` の書体が既定書体になる箇所がある（§5.1）。
6. `backdrop-filter: blur` が 5 箇所、常時 glow が 3 箇所（§3.2、§6.3）。UI-002 Planner report P-5 の提案（blur・常時 glow を使わない）と現状は異なる（提案であり決定ではない）。
7. レスポンシブは入力判定と比率縮小のみで、844×390 ではメニュー・鑑定所・テストモード画面の多くがスクロール前提（§8.2）。
8. 開発用 Arena パネルがメニューより前面に出る（z-index 31 > 30）（§8.2、`?dev=1` のみ）。
9. 見た目不変の検証で、3D の上の要素はピクセル比較が安定しない（§8.3）。
10. CSS のみの selector 40 個（§7.3）。
11. JS 直書きのスタイル値（§3.4）は CSS 変数の対象外。

---

## 13. FACT

| # | 内容 |
| --- | --- |
| F-01 | baseline は `63235ce`（UI-002-A / B merge 後） |
| F-02 | `:root` 変数は色 10 個のみ。size / radius / spacing / shadow / z-index / font の変数は無い |
| F-03 | `main.css` の hex 99 種 / 186 回、rgba 97 種 / 122 回（UI-001 と同数） |
| F-04 | font-size 23 種（`clamp()` を含む。UI-001 の記載は 22 種で、差が集計方法によるものか変更によるものかは未確認）。10px 未満は CSS 上 23 箇所 |
| F-05 | font-weight は 700 が 32/36 |
| F-06 | border-radius 13 種（6px 25、4px 15、50% 13、8px 12 …） |
| F-07 | z-index 19 種、最大 120（確認ダイアログ） |
| F-08 | `backdrop-filter: blur` 5 箇所、`filter: blur` 1 箇所（勝利演出） |
| F-09 | `@media` は 1 件のみ |
| F-10 | PC / タッチの UI 切替は `isTouchDevice`（入力）で決まり、ビューポート幅では決まらない |
| F-11 | `<button>` の一部はブラウザ既定書体で描画される（Arena 21、鑑定所 31 要素を実測） |
| F-12 | 本編 HUD で 8.5px（`.bar-label`）と 9.5px（`.weapon-badge`）が常時表示される |
| F-13 | 鑑定所「装備品」で 9px / 9.5px が表示される |
| F-14 | 3D キャラ配色（`CLASSES.trim`、`player-palette.js`）は DOM / CSS から参照されない |
| F-15 | テストモードの選択色は `--mp` |
| F-16 | ドロップ色は 3D とトーストで同じ値を使う |
| F-17 | CSS にのみ存在する selector が 40 個 |
| F-18 | inline style は `index.html` 28、JS テンプレート 7、`.style.*` 代入の見た目値あり（トースト・報酬ポップ等） |
| F-19 | トーストの色は `spawnToast()` の引数で hex 直書き（10 箇所） |
| F-20 | ミニマップは Canvas 描画で CSS 変数を参照しない |
| F-21 | 開発用パネル（Arena / DEBUG / PERF / Motion）は `:root` 変数をほぼ使わない（var() 計 1） |
| F-22 | Arena パネル（z 31）はメニュー（z 30）より前面 |
| F-23 | タイトル画面のスクリーンショットは 2 回の実行で完全一致、HUD / メニューは不一致 |
| F-24 | 既存 E2E に `toHaveScreenshot` は無い。`toHaveClass` 116 回（`active` 77、`show` 28） |
| F-25 | E2E は `.testmode-job-card`（42）・`.class-card`（38）等の class selector に依存 |
| F-26 | Web フォントは Google Fonts の `@import`。この環境では読み込めない |
| F-27 | Decision record（`63235ce`）に、色の分離・blur / glow・token 命名に関する Human Decision は無い。関連する確定事項は HD-4（確認サイズ）と HD-5（C1 → V → 本格 visual の順、V の判断対象） |

FACT 数: **27**

## 14. OBSERVATION

| # | 内容 |
| --- | --- |
| O-01 | 本編の基調（暗い紫黒パネル・細い紫灰の枠・橙アクセント・セリフ見出し）は UI-001 O-01 から変わっていない |
| O-02 | パネルは 4 系統とも同じ構成（縦グラデ + 1px 枠 + 6px + 外影）だが、各 selector に個別に書かれている |
| O-03 | 主ボタンの形は 3 系統（4px 長方形 / pill / 確認ダイアログの 12px 系）が並存する |
| O-04 | 「選択中」は橙塗り・橙枠・青枠・緑枠の 4 通り |
| O-05 | 「無効」は opacity 4 値・非表示・🔒 の併用 |
| O-06 | 844×390 では同じ部品が比率で縮むだけで、配置の組み替えは無い |
| O-07 | 844×390 のメニュー・鑑定所・テストモード画面は 1 画面に収まらずスクロールが前提 |
| O-08 | 開発用 UI は本番 UI と異なる配色系統（紫・赤・monospace）で、英語ラベル |
| O-09 | 開発用 Arena パネルは 844×390 で画面左半分を覆い、メニューを開いても残る |
| O-10 | 3D の上の半透明 UI（blur 付き）は、背景の 3D の状態によって見え方が変わる |
| O-11 | 画面の「見出し」は `.display`（Cinzel + Noto Serif JP）で統一されているが、ボタンの書体は Noto Serif JP / Cinzel / 既定書体 / inherit が混在する |
| O-12 | 10px 未満の文字は「ラベル」「補足数値」「武器種チップ」に集中している |
| O-13 | 同じ色系統の意味の重なり（§4.2）は、赤・橙で特に多い |

OBSERVATION 数: **13**

## 15. INFERENCE

| # | 内容 |
| --- | --- |
| I-01 | 現行値をそのまま CSS 変数へ置き換える作業（値を変えない token 化）は、CSS の宣言単位で行えば見た目を変えずにできる可能性が高い。ただし JS 直書きの値（§3.4）と Canvas（ミニマップ）は CSS 変数化の対象外になる |
| I-02 | 「見た目不変」の判定は、全画面のピクセル比較だけでは 3D の上の要素で誤検知が出る。タイトル等の 3D を持たない画面のピクセル比較と、主要要素の computed style（色・サイズ・角丸・影）の比較を併用する方法が現環境で実行可能と考えられる |
| I-03 | Web フォントが読み込めない環境での撮影は、書体に関する見た目判断（V）には使えない。書体の判断には Web フォントが読み込める環境（実機・GitHub Pages）が必要 |
| I-04 | `<button>` の既定書体（F-11）は、共通の button 基盤を入れると変わる可能性が高い（「見た目を変えない」C1 の制約と衝突しうる） |
| I-05 | 状態 class（`.active` / `.show` / `.selected`）の名前を変えると E2E（F-24、F-25）に影響する。部品 class を「追加」する方式なら影響は小さい |
| I-06 | CSS のみの selector（F-17）は削除しても表示は変わらない可能性が高いが、動的 class 生成の全件確認はしていない |
| I-07 | 1 系統の色が多数の意味を持つ現状（§4.2）では、「値を変えずに意味の名前を付ける」token 化で、同じ値に複数の意味名が付く |
| I-08 | 入力（タッチ / 非タッチ）で切り替わる現行方式と、UI-002 Planner report §9.2 が提案する「高さと pointer による layout 属性」は、判定の基準が異なる |
| I-09 | 開発用 UI を共通基盤に含めない場合、開発用 UI は現状の独自色のまま残る。含める場合、`?dev=1` の画面だけに影響する変更を C1 に含めることになる |

INFERENCE 数: **9**

---

## 16. Candidate Design-System Requirements

（判断材料として並べるもの。**決定ではない**。値は現行値の棚卸しであり、正解の提示ではない）

| # | 候補要件 | 根拠 |
| --- | --- | --- |
| R-1 | C1 の token は現行値の別名から始める（値を変えない） | Task の Planner requirements、F-02 |
| R-2 | token の対象範囲を「色」「font-size」「radius」「shadow」「z-index」「spacing」のどこまでにするかを決める | §3.2 |
| R-3 | 同じ値に複数の意味がある場合の命名方法（primitive 名にとどめるか、意味名を複数付けるか） | I-07、UI-002 Planner report §8.1（PROPOSAL） |
| R-4 | 見た目不変の判定方法（ピクセル比較の対象画面と、computed style 比較の対象要素） | §8.3、I-02 |
| R-5 | JS 直書きのスタイル値・Canvas 色を C1 の対象にするか | §3.4、F-19、F-20 |
| R-6 | 共通部品 class を既存 class に「追加」する方式にするか（既存 class・id を維持） | I-05、F-24、F-25 |
| R-7 | `<button>` の書体の扱い（現状維持を「見た目不変」とみなすか） | F-11、I-04 |
| R-8 | 開発用 UI を C1 の対象に含めるか | §10.3、I-09 |
| R-9 | CSS のみの selector の扱い（C1 で触らない / 別 Task） | F-17 |
| R-10 | layout の切替基準（入力 / ビューポート）を C1 で扱うか、D 以降にするか | F-10、I-08 |

---

## 17. Open Questions for Planner / Human

| # | 質問 | 決める人 |
| --- | --- | --- |
| Q-01 | C1 で token 化する値の種類（色のみ / 色+サイズ+角丸+影+z-index / spacing まで）はどこまでか | Planner 提案 → Human |
| Q-02 | token の命名・階層（primitive / semantic / component の 3 層にするか等） | Planner 提案 → Human（Task の Unknowns） |
| Q-03 | 同じ値が複数の意味を持つ場合、C1 で意味名を付けるか、V の後に回すか | Planner 提案 → Human |
| Q-04 | 「見た目不変」の判定基準（ピクセル比較の対象・許容差、computed style 比較の対象要素） | Planner 提案 → Human（Task の Unknowns） |
| Q-05 | JS 直書きのスタイル値（トースト色・報酬ポップ等）と Canvas（ミニマップ）を C1 の範囲に含めるか | Planner 提案 → Human |
| Q-06 | `<button>` の既定書体を「現状の見た目」として維持するか（共通 button 基盤を入れる時に変わりうる） | Human |
| Q-07 | 開発用 UI（Arena / DEBUG / PERF / Motion / テストモード専用カード）を C1 の共通基盤に含めるか | Human |
| Q-08 | CSS にのみ存在する 40 selector を C1 で扱うか（削除は見た目不変でも範囲外とするか） | Human |
| Q-09 | layout 切替（入力判定 / ビューポート）を C1 で扱うか、UI-002-D 以降にするか | Planner 提案 → Human |
| Q-10 | Web フォントが読み込めない環境の撮影を、C1 の見た目不変の比較に使ってよいか（比較は同条件なので可能だが、V の判断には使えない） | Human |
| Q-11 | 新しいファイル（例: token 専用 CSS）を置くか、`main.css` 内に置くか | Planner 提案 → Human（Task の Out of Scope: module 構造の決定は Planner 提案・Human 判断） |

Open Questions 数: **11**

---

## 18. Scope Boundary

- 本 Analyzer で変更したファイル: `.ai/reports/UI-002-C1-analysis.md`（新規）のみ。
- 変更していない: source、CSS、tests、Task file（`.ai/tasks/UI-002-C1.md` は DRAFT のまま）、Decision record、UI-002-A / UI-002-B の実装、他の Task。
- 決めていない: 色・サイズ・書体・角丸・影の値、token 名、Work Item、Planner の内容、Human Decision。
- テスト: build / unit / E2E は実行していない（NOT_RUN）。調査のために dev サーバと Chromium headless で画面撮影・computed style の取得・撮影の再現性確認を行った（リポジトリ外の一時スクリプト、結果は本レポートに記載。画像はリポジトリに含めていない）。
- 既存 FAIL（mansion-escort / execution-break）・FLAKY 記録（job-traits）・NOT_RUN（GitHub Pages 実機確認）は変更していない。
- 未撮影（NOT_CAPTURED）: 出撃画面、結果画面・戦闘不能画面、ダンジョン内 HUD（ボスバー・雑魚 HP・コンボ・制限時間）、844 幅の非タッチ表示、Web フォント読み込み済みの表示。
