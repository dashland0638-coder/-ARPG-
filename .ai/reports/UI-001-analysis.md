# UI-001 Analysis

Analysis: Analyzer（READ ONLY。source・tests・docs・Task file・package・Playwright 設定を変更していない）/ 2026-09-26 / Claude Code セッション

## Task

UI-001 / 現在の ARPG に存在する UI を全面的に棚卸しし、今後の UI リメイク設計のための事実ベースの基礎資料を作る。
実装・修正・デザイン変更は行わない。

分類ラベル（本レポート全体で使用）:

| ラベル | 意味 |
| --- | --- |
| **FACT** | コード・実画面で確認した事実（根拠 `path:line` または撮影 ID） |
| **OBSERVATION** | 複数 UI を比較して確認できる特徴 |
| **UNCONFIRMED** | 実際に確認できなかったもの |
| **POSSIBLE ISSUE** | UI リメイク時に検討する価値がある問題候補（「修正すべき」とは断定しない） |
| **NOT IMPLEMENTED** | 現在存在しない機能 |
| **DO NOT CHANGE** | 今回変更しなかったもの |

---

## 1. Baseline

| 項目 | 値 |
| --- | --- |
| 対象 | `origin/main` |
| main HEAD（origin/main） | `70b6ee36859b049d3749766dcefed73bedff06f2`（`CHARACTER-VIS-001: record Human Decision on the combat visual analysis (keep as is)`） |
| 作業ブランチの起点 | 作業ブランチ HEAD = `70b6ee3…`（origin/main と一致） |
| ローカル `main` ref | `2831bbd5…`（origin/main より古い。**変更・fast-forward していない**。解析は origin/main と同一の作業ツリーで実施） |
| git status（解析開始時） | clean（`nothing to commit, working tree clean`） |
| 解析用ブランチ | `claude/ui-001-analysis-380kl5`（本セッションの実行環境が割り当てた push 先。依頼文の `claude/ui-001-analysis` とは名前が異なる → §15） |

---

## 2. UI 一覧

「存在」= DOM / Canvas / 3D のいずれかで実際に生成されるもの。「本編」= Chapter 1 通常プレイ（`state.testMode === false`）。

| # | UI | 存在 | 本編で表示 | 実画面確認 |
| --- | --- | --- | --- | --- |
| U-01 | 起動メッセージ `#boot-msg` | あり | 起動直後のみ | UNCONFIRMED（一瞬で消える） |
| U-02 | タイトル `#title-screen`（はじめる / つづきから / テストモード入口） | あり | ○ | ✅ S01 / S08 / P01 |
| U-03 | つづきからバナー `.continue-banner` | あり | セーブがある時 | ✅ S08 |
| U-04 | テストモード画面 `#testmode-screen` | あり | ×（開発用、ただしタイトルから常に到達可能） | ✅ S02 / S02b |
| U-05 | 戦闘 HUD 左上（ポートレート・名前・HP/MP/スタミナ/XP バー） `.hud-topleft` | あり | ○ | ✅ S04 ほか |
| U-06 | 武器バッジ `#weapon-badge` | あり | ○（ただし隠れて見えない → §11） | ✅（被覆を確認） |
| U-07 | 階層ラベル `#hud-floor` | あり | 洋館のみ | UNCONFIRMED |
| U-08 | 所持品チップ（☰メニュー / 🧪 / 🔷） `.hud-loot` | あり | ○ | ✅ S04 |
| U-09 | 操作ヒント帯 `#hud-hint` | あり | PC のみ（タッチ端末では非表示） | ✅ S04 / P04 で非表示を確認 |
| U-10 | ゲームパッド接続バッジ `#gamepad-badge` | あり | 接続時 | UNCONFIRMED |
| U-11 | アクションボタン群（攻撃 / スキル1 / スキル2 / スキル3 / 必殺 / 回避 / JUMP） `#touch-controls` | あり | ○（PC でも一部表示） | ✅ S04 / P04 |
| U-12 | 仮想スティック `.joy-zone` | あり | タッチ端末のみ | ✅ P04 |
| U-13 | カメラ回転ボタン `#btn-cam-left/right` | あり | タッチ端末のみ | ✅ P04 |
| U-14 | 必殺技ゲージ％表示 `#ult-btn-cd` / クールダウンリング | あり | ○ | ✅ S04 / S17 |
| U-15 | コンボ表示 `#combo-indicator` | あり | 攻撃中 | ✅ S17 / P17 |
| U-16 | ミニマップ `#minimap`（Canvas 2D） + エリア名 `#minimap-label` | あり | ○ | ✅ S04 / S23 / S27 |
| U-17 | ネームド方向表示 `#minimap-named` | あり | 条件付き | UNCONFIRMED |
| U-18 | ボス HP / 体幹 / 形態バー `#boss-bar-wrap` | あり | ボス戦 | UNCONFIRMED |
| U-19 | 雑魚 HP バー `.mob-hp` / 体幹バー `.mob-posture` | あり | 被弾後 | UNCONFIRMED（S17 では描画を確認できず） |
| U-20 | ダメージ数値 `.dmg-pop` | あり | ○ | UNCONFIRMED（撮影タイミングで未捕捉） |
| U-21 | 周回制限時間 `#scenario-timer` | あり | 周回（★2〜）のみ | UNCONFIRMED |
| U-22 | インタラクトプロンプト `#interact-btn` | あり | 近接時 | ✅（S13 / S11 の背景に写り込み） |
| U-23 | 処刑プロンプト `#execute-prompt` | あり | 崩し後の窓 | UNCONFIRMED |
| U-24 | 会話 / 手記 / 演出台詞 `#dialogue-overlay` | あり | ○ | ✅ S03 / S14 / P03 |
| U-25 | メニュー（ステータス・所持素材・設定・操作説明・ボタン） `#menu-overlay` | あり | ○ | ✅ S05 / S05b / P05 |
| U-26 | 確認ダイアログ `#confirm-overlay` | あり | ○ | ✅ S07 |
| U-27 | トースト（中央） `.item-pop`（spawnToast） | あり | ○ | UNCONFIRMED（1.7 秒で消えるため未捕捉） |
| U-28 | メッセージログ（左下） `#msg-log` | あり | ○ | ✅ S06 |
| U-29 | 取得ポップアップ / レベルアップポップアップ `.item-pop` | あり | 取得時 / レベルアップは本編で発生しない | UNCONFIRMED |
| U-30 | 画面フラッシュ / 画面暗転 `#screen-flash` `#screen-fade` | あり | ○ | UNCONFIRMED |
| U-31 | 縦持ち警告 `#rotate-overlay` | あり | タッチ端末の縦画面 | UNCONFIRMED（横長 viewport のみ撮影） |
| U-32 | 鑑定所（装備品 / ステータス配分 / スキル / 奥義の環 / 商店） `#appraisal-overlay` | あり | ○（本編は 3 タブ） | ✅ S10〜S12（本編）/ S18〜S21（テストモード） |
| U-33 | 出撃（シナリオ選択） `#scenario-overlay` | あり | ○ | ✅ S13 |
| U-34 | クリア結果（VICTORY・戦利品・3択報酬・ステ振り） `#clear-overlay` | あり | ボス撃破時 | UNCONFIRMED |
| U-35 | 戦闘不能 `#down-overlay` | あり | 全滅時 | UNCONFIRMED |
| U-36 | デバッグバッジ `#debug-badge` | あり | デバッグモード | ✅ S22 / P22 |
| U-37 | 計測パネル `#perf-panel` | あり | デバッグモード | ✅ S22 / P22 |
| U-38 | Motion Preview パネル `#motion-panel` | あり | デバッグモード | ✅ S22 / P22 |
| U-39 | Combat Test Arena（トグル / パネル / フィードバック / 敵情報） | あり | テストモードのみ | ✅ S15〜S17 / P16 / P17 |
| U-40 | ゲームパッド用フォーカス枠 `.gp-focused` | あり | パッド操作時 | UNCONFIRMED |
| U-41 | 3D ワールド内 UI（分岐の看板スプライト・階段テクスチャ・足元リング・必殺照準マーカー） | あり | ○ | 一部 ✅（足元リング S04 ほか）/ 他 UNCONFIRMED |
| U-42 | PWA アイコン / manifest（`public/icons/*.png`） | あり | ホーム画面追加時 | UNCONFIRMED（画像は開いていない） |

調査した UI 数: **42 項目**（うち実画面で確認 **26 項目**、UNCONFIRMED **16 項目**）。

依頼の 18 分類との対応:

| 依頼の分類 | 該当 | 状態 |
| --- | --- | --- |
| 1 戦闘 HUD | U-05〜U-23 | 実装あり |
| 2 メインメニュー | U-25（ポーズメニュー）。独立した「メインメニュー」画面は無く、タイトル U-02 がその役割 | 実装あり |
| 3 キャラクター情報 | U-25 の上部 7 行（名前・職業・HP・MP・攻撃力・移動速度・必殺技）、HUD 名前行 | 実装あり（専用画面は **NOT IMPLEMENTED**） |
| 4 ステータス | U-25 / 鑑定所「ステータス配分」タブ（テストモードのみ） / クリア画面のステ振り（本編では出ない） | 部分的 |
| 5 装備 | 鑑定所「装備品」タブ | 実装あり |
| 6 スキル | 鑑定所「スキル」タブ（サブタブ）、HUD アクションボタン | 実装あり |
| 7 アイテム | HUD 🧪/🔷、メニュー「所持素材」、鑑定所「商店」 | 実装あり（インベントリ一覧画面は **NOT IMPLEMENTED**） |
| 8 酒場 | 酒場は 3D ワールド。UI としては U-22（店主・鍛冶士・影の旅人への声かけ）→ U-33 / U-32 / U-24 | 実装あり |
| 9 シナリオ進行表示 | U-33「▶ 次はここ」、U-16 エリア名、U-07 階層、U-21 制限時間 | 部分的（章・進捗の常設表示は **NOT IMPLEMENTED**） |
| 10 セーブ / ロード | U-25「💾 セーブ」、U-03 つづきから、自動セーブ | 実装あり（スロット選択は **NOT IMPLEMENTED**） |
| 11 ポップアップ | U-26 / U-34 / U-35 / U-24 | 実装あり |
| 12 通知 | U-27 / U-28 / U-29 / U-36 | 実装あり |
| 13 操作ガイド | U-09 / U-25 下部の操作説明テキスト | 実装あり |
| 14 チュートリアル | 専用 UI は **NOT IMPLEMENTED**（§12） | — |
| 15 キャラクター切替関連 UI | 専用 UI は無い。酒場で会話（U-24）＋トースト（U-27）で交代を演出。HUD 名前行に「主人公 ｜ 支援: ○○」 | 部分的 |
| 16 デバッグ UI | U-36 / U-37 / U-38、当たり判定の 3D 表示 | 実装あり |
| 17 テスト専用 UI | U-04 / U-39 | 実装あり |
| 18 Motion Preview 等の開発用 UI | U-38（`core/motion-preview.js` が行を生成） | 実装あり |

---

## 3. UI architecture map

### 3.1 全体構造

```
index.html（静的 DOM: 全オーバーレイ・HUD・ボタンの骨格）
  └ <script type=module src=/src/main.js>
       └ import 'virtual:legacy-core'
            = src/legacy/parts/*.js をファイル名順に連結した 1 つのスコープ
              （src/legacy/concat-plugin.js。ES module ではない）
src/styles/main.css（全 UI の CSS。1 ファイル 1294 行）
src/core/*.js（純粋関数。UI の DOM には触れない。一部が表示用の文字列・判定を返す）
src/core/state.js（唯一の可変ゲーム状態 `state`）
```

- **FACT**: UI の DOM 生成・更新はすべて `src/legacy/parts/*.js` にある。`src/core/` と `src/render/` は DOM を触らない（`grep getElementById` の該当ファイルは legacy/parts の 11 ファイルのみ）。
- **FACT**: UI に文字列・判定を供給する「新しい src 構造」側のモジュール:
  - `src/core/chapter1-rules.js` … `legacyGrowthEnabled()`（旧成長 UI の表示可否の唯一の判定）、`hudLabel()`（HUD 名前行の文字列）、`joinSceneReady()`（交代会話を開くタイミング）
  - `src/core/chapter1-progress.js` … `offeredScenarios()` / `chapter1Complete()`（出撃画面の候補）
  - `src/core/chapter1-skills.js` … `hasSkill2()`（スキル2ボタンの表示可否）
  - `src/core/motion-preview.js` … `motionDebugLines()`（Motion Preview パネルの行）
  - `src/core/scenario-timer.js` … `timeLimitForStars()`（制限時間）
- **FACT**: 描画方式は 4 種が混在する。

| 方式 | 使っている UI |
| --- | --- |
| 静的 DOM（index.html）＋ class 切替 | HUD 骨格、各オーバーレイ、アクションボタン |
| JS による innerHTML 組み立て | 鑑定所の各パネル、出撃リスト、テストモードのカード、クリア画面の戦利品・3択 |
| JS による createElement（毎回 / プール） | ダメージ数値（プール最大 40）、トースト、ログ、雑魚 HP バー、Arena ボタン |
| Canvas 2D | ミニマップ（`drawMinimap()`） |
| SVG（innerHTML 内） | 奥義の環の結線（`.sphere-svg`） |
| Three.js 3D オブジェクト / CanvasTexture / Sprite | 分岐看板（`makeRouteTagTexture` 03:200 / Sprite 03:229）、階段テクスチャ（02:1855）、足元リング、必殺照準マーカー（`ensureUltMarker` 11:1579）、デバッグ用当たり判定表示 |
| 3D→2D 投影した DOM | ダメージ数値、取得ポップ、雑魚 HP バー（`Vector3.project(camera)`） |

### 3.2 状態の持ち方

| 状態 | 場所 | 用途 |
| --- | --- | --- |
| `state.activeOverlay`（'none' / 'menu' / 'appraisal' / 'scenario'） | `core/state.js` | メニュー・鑑定所・出撃の排他制御（`setOverlay()` 10-input.js:167） |
| `state.paused` | 同上 | `activeOverlay !== 'none'` と連動 |
| `state.dialogueActive` / `dialogueKind` / `dialogueLines` / `dialogueIndex` | 同上 | 会話・手記・演出台詞 |
| `state.started` | 同上 | タッチ UI の表示判定（`refreshTouchControls()` 10-input.js:23） |
| `state.debugMode` | 同上 | デバッグ UI 全般 |
| `state.testMode` | 同上（`finishEnteringGame()` 14-hud-boot.js:1735 が唯一の書き換え） | 旧成長 UI・Arena の表示 |
| `state.comboStage` / `comboLen` / `comboWindowT` | 同上 | コンボ表示 |
| `state.ultGauge` / `skillCD` / `skill2CD` / `bossSkill3CD` | 同上 | ボタンのリング・％ |
| `state.scenarioTimeLeft` | 同上 | 制限時間表示 |
| `.classList`（`active` / `show`） | DOM そのもの | `clear-overlay` / `down-overlay` / `confirm-overlay` / `dialogue-overlay` は `state.activeOverlay` の管理外で、DOM の class が状態を持つ |
| モジュール内 `let`（`confirmPending`、`skillSubTab`、`sphereZoom`、`gpNavIndex`、`comboIndicatorShownFor`、`executePromptShown`、`motionPanelShown` 等） | legacy/parts の共有スコープ | 各 UI の一時状態 |
| `localStorage` `soulforge_settings_v1` | `saveSettings()` 09-save-load.js:249 | 設定メニューの値 |

- **OBSERVATION**: オーバーレイの状態管理は二系統ある。`state.activeOverlay` で管理される 3 つ（menu / appraisal / scenario）と、DOM の `active` class だけで管理される 4 つ（dialogue / clear / down / confirm）。`gpNavContext()`（10-input.js:222）は後者を DOM の class から直接読む。

### 3.3 毎フレーム更新の入口

- **FACT**: `animate()`（14-hud-boot.js:1082）から `updateHUD()`（:362）、`updateMobBars()`、`updateBossBar()`、`updateComboIndicator()`、`updateExecutePrompt()`、`drawMinimap()`、`updatePerfPanel()`、`updateMotionPanel()`、`updateInteractPrompt()`（02:2364）等が呼ばれる。`updateHUD()` は HP/MP/スタミナ/XP の幅・武器バッジ・階層・必殺・クールダウンリングを毎回書き換える。

---

## 4. 各 UI の生成・更新箇所

（行番号は baseline 時点。`02` = `src/legacy/parts/02-world-common.js` のように略記）

### 4.1 タイトル / テストモード

| 項目 | 内容 |
| --- | --- |
| 生成 | `index.html` `#title-screen` / `#testmode-screen`。テストモードのカード（職業・転身・ゲスト・シナリオ・開始地点）は `01-character-creation.js`（`buildScenarioGrid()` :477、`renderWaypointGrid()` :533、`renderJobGrid()` :581、:443〜:610 の createElement） |
| 更新 | `refreshContinueBanner()` 01:381、`showContinueError()` 01:396、`refreshStartLabel()` 01:564 |
| 入力 | `#cc-start-btn`（01:359。セーブがあれば `askConfirm` で上書き確認）、`#cc-continue-btn` → `continueGame()` 14:1295、`#open-testmode-btn`、`#testmode-start-btn` → `beginTestMode()` 14:1326 |
| 表示条件 | 起動完了で `display:flex`（14:1852）。`finishEnteringGame()` で `none`、`returnToTitle()` 10:367 で再表示 |
| CSS | main.css `#title-screen` `.cc-frame` `.cc-eyebrow` `.cc-title` `.cc-sub` `.continue-banner` `#cc-start-btn` `#cc-continue-btn` `#testmode-screen` `.testmode-*` `.class-card` |

### 4.2 戦闘 HUD

| UI | 生成 | 更新関数 | 読む state | CSS |
| --- | --- | --- | --- | --- |
| 左上パネル | index.html `.hud-topleft` | `updateHUD()` 14:362 | hp/maxHp, mp/maxMp, stamina, xp/xpToNext | `.hud-topleft` `.bar-*` |
| 名前行 | index.html `#hud-name` | `refreshHudName()` 12:1846（`hudLabel()` core/chapter1-rules.js） | classDef, guestClassKey, level（テストモードのみ） | `.hud-name` |
| ポートレート | index.html `#hud-portrait-icon` | `recomputeStats()` 12:1830 | classDef.icon | `.hud-portrait` |
| MP ラベル | `#mp-label` | 12:1833（弓師は `SP`） | classDef.resourceLabel | `.bar-label` |
| 武器バッジ | `#weapon-badge` | `updateWeaponBadge()` 14:353 | usingAltWeapon | `.weapon-badge` |
| 階層 | `#hud-floor` | `updateFloorLabel()` 14:344（`FLOOR_LABELS.mansion` のみ） | scenarioKey, routeNode | `.hud-floor` |
| 所持品 | `.hud-loot` | `finishEnteringGame()` 14:1753、`refreshAppraisal()` | inventory.potion / mppotion | `.hud-loot` `.loot-chip` |
| アクションボタン | index.html `#touch-controls` | `refreshTouchControls()` 10:23、`updateCooldownRings()` 14:720、`updateUltHUD()` 14:804、`updateSkillButtonIcon()` 12:2471 | started, gpIndex, skillCD, skill2CD, ultGauge, equippedBossActiveSkill, learnedSkill2 | `.action-btn` `.has-cd-ring` `#btn-*` |
| コンボ | `#combo-indicator`（pip は 14:784 で createElement） | `updateComboIndicator()` 14:770 | comboStage, comboLen, comboWindowT | `#combo-indicator` `.combo-pip` |
| ミニマップ | `#minimap`（canvas 248×248） | `drawMinimap()` 14:529、`updateMinimapLabel()` 14:480、`updateNamedBearing()` 14:504 | pos, camYaw, enemies, doors, stairs, chests… | `#minimap-wrap` `#minimap-label` |
| ボスバー | `#boss-bar-wrap` | `updateBossBar()` 14:104 | enemies（isBoss & triggered）, activeOverlay | `#boss-bar-*` |
| 雑魚バー | `mobBarFor()` 14:13 / `mobPostureBarFor()` 14:28 で body 直下へ createElement | `updateMobBars()` 14:40 | en.barT, en.hp, debugMode（全表示） | `.mob-hp` `.mob-posture` |
| ダメージ数値 | `spawnDamagePopup()` 11:2154（`#hud` 配下、プール） | 同左 | — | `.dmg-pop` |
| 制限時間 | `#scenario-timer` | `refreshScenarioTimerHUD()` 12:1594 | scenarioTimeLeft | `#scenario-timer` |
| インタラクト | `#interact-btn` | `updateInteractPrompt()` 02:2364 | nearby*（ローカル変数） | `#interact-btn` `.branch-warn` `.branch-locked` |
| 処刑 | `#execute-prompt` | `updateExecutePrompt()` 14:759 | `currentExecutionTarget()` | `#execute-prompt` |
| 操作ヒント | `#hud-hint`（固定文言） | タッチ端末なら 14:1802 で非表示 | — | `.hud-hint` |

入力（キーボード）: 09-save-load.js:310〜356 の keydown/keyup。`Space` ジャンプ、`J` 攻撃、`K` 必殺、`L` スキル1、`O` スキル2、`U` スキル3、`Shift` 回避、`R` インタラクト、`E` 処刑、`V` 薬草、`I` 鑑定所、`F` 出撃、`Esc/Tab` メニュー、`` ` `` デバッグ、`P` Motion Freeze。
入力（タッチ）: `bindTouchButton` / `bindHoldButton` 10:100〜133。
入力（パッド）: `pollGamepad()` 10:410、メニュー内は `updateGamepadMenuNav()` 10:322。

### 4.3 オーバーレイ

| UI | 生成 | 開く | 閉じる | 中身の更新 |
| --- | --- | --- | --- | --- |
| メニュー | index.html | `toggleMenu()` 10:198（Esc / ☰） | Esc / 背景クリック / 「冒険に戻る」 | `refreshMenuStats()` 10:347、設定は `bindSettings()` 14:224 / `refreshSettingLabels()` 14:173 |
| 鑑定所 | index.html（ステ配分の行は静的、他は JS） | `toggleAppraisal()` 12:2482（本編は鍛冶士から 3m 以内の酒場でのみ。テストモードはどこでも） | 同キー / 閉じる / 背景 | `refreshAppraisal()` 12:2546 → `renderGearPanel()` 12:2657 / `renderSkillPanel()` 12:3081 / `renderSpherePanel()` 12:2939 / `renderShopPanel()` 12:3372、タブ可視は `syncApTabsVisibility()` 12:2536 |
| 出撃 | index.html | `toggleScenarioSelect()` 12:2501（店主から 3m 以内、未出撃時） | 同上 | `renderScenarioList()` 12:1531 |
| 会話 | index.html | `startScenarioTavernDialogue()` 12:299、`startBossDialogue()` 12:336、`readLore()` 02:2350、`cutsceneLine()` 02:1419、`triggerTownIntroEvent()` 14:1828、`playChapter1JoinScene()` 14:1650、`talkToShadowGuide()` 12:281 | クリック / A で `advanceDialogue()` 12:371 | `renderDialogueLine()` 12:362 |
| 確認 | index.html | `askConfirm()` 12:2515 | `closeConfirm()` 12:2524 | 同左（innerHTML） |
| クリア結果 | index.html＋JS | `showBossResultScreen()` 12:1040 | `#clear-return-btn` / `#clear-continue-btn` | `renderBossChoicePanel()` 12:945、`refreshResultStatPanel()` 12:1147 |
| 戦闘不能 | index.html | `triggerPlayerDown()` 12:1162 | `#down-return-btn` | 同左 |

### 4.4 通知

| UI | 関数 | 位置 | 寿命 |
| --- | --- | --- | --- |
| トースト | `spawnToast()` 11:2231 | 画面中央 top 30%、複数は上へ 25px ずつ積む（`layoutToasts()` 11:2204） | 1.7 秒 |
| ログ | `pushMsgLog()` 11:2215（トーストと同時に積む） | 左下 `bottom:84px`、最大 6 行 | 6.5 秒 |
| 取得ポップ | `spawnPickupPopup()` 11:2187 | プレイヤー頭上 | 1.15 秒 |
| レベルアップ | `spawnLevelUpPopup()` 12:1973 | プレイヤー頭上＋画面フラッシュ | 1.4 秒 |

### 4.5 デバッグ / テスト / 開発用

| UI | 生成 | 表示条件 | 更新 |
| --- | --- | --- | --- |
| デバッグバッジ | index.html | `toggleDebugMode()` 02:1609（`` ` `` キー、またはメニュー下端 `ver` を 1.5 秒以内に 5 回タップ `bindVersionTap()` 14:314） | 同左 |
| 計測パネル | index.html | debugMode | `updatePerfPanel()` 14:886（0.5 秒毎） |
| Motion Preview | index.html | debugMode | `updateMotionPanel()` 14:1055（行は `core/motion-preview.js` の `motionDebugLines()`） |
| 当たり判定表示 | 3D | debugMode | `showDebugColliders()` 02:1623 |
| Arena | index.html＋`buildArenaUiOnce()` 14-training-ground.js:77 | testMode | `updateArenaPanel()` :257、`updateArenaEnemyInfo()` :136、`emitArenaFeedback()` :122 |
| テストモード画面 | U-04 | タイトルから常時到達可 | 4.1 |

---

## 5. 実画面確認結果

撮影 ID と内容（撮影条件は §15）。画像はリポジトリに追加していない（asset 追加禁止のため）。

| ID | viewport | 画面 | 確認できたこと |
| --- | --- | --- | --- |
| S01 | 1280×800 | タイトル（セーブなし） | 中央パネル・「はじめる」（オレンジのグラデ）・破線枠の「🛠 テストモード(上位職デバッグ用)」 |
| S02 / S02b | 1280×800 | テストモード | 職業カード 4 枚（⚔ 🗡 ✦ ➶）、ゲスト・シナリオ・開始地点の 2 列グリッド、選択色は青（`--mp`）、レベルスライダー、青い開始ボタン |
| S03 | 1280×800 | 新規開始直後の酒場 | 会話ボックス（下部中央）が HUD ボタン群と操作ヒント帯の上に重なる。背後の HUD（左上・右下ボタン）は表示されたまま |
| S04 | 1280×800 | 酒場 HUD（剣士） | 左上パネル上に所持品チップが重なり MP バー下部・スタミナラベル・ポートレート下半分を覆う。右下に 👑（半透明）/ 0% / ⬇️ / 攻撃 の 4 ボタン。PC でも表示。ミニマップ右上＋「港町の酒場」 |
| S05 / S05b | 1280×800 | メニュー | 7 行のステータス、所持素材 🪙💎🔩、設定 11 行（オレンジ枠ボタン）、操作説明テキスト 13 行、橙文字の注記、4 ボタン、`ver 0.1.0` |
| S06 | 1280×800 | セーブ後 | 左下ログに「💾 セーブしました」（中央トーストは撮影時点で消滅） |
| S07 | 1280×800 | 確認ダイアログ | 角丸 12px、明るい金色グラデの OK、ゴーストのキャンセル |
| S08 | 1280×800 | タイトル（セーブあり） | 金枠のつづきからバナー「⚔ 剣士 ｜ 剣士」 |
| S09 | 1280×800 | 酒場（剣士、テスト用セーブ） | S04 と同じ構成 |
| S10 | 1280×800 | 鑑定所・装備品（本編） | タブ 3 つ（装備品 / スキル / 商店）、装備スロット 3 枚、ツールボタン 3 色（橙 2・緑 1）、凡例「装備可 / Lv不足 / 装備中」、一覧行 |
| S11 | 1280×800 | 鑑定所・スキル（本編） | サブタブ「スキル1 / スキル2 / 必殺技」、スキルカード 4 枚（⚡ ⬇️ 🌀 🛡️） |
| S12 | 1280×800 | 鑑定所・商店（本編） | 3 行（🧪 🔷 🛏️）、橙の丸ボタン |
| S13 | 1280×800 | 出撃（魔法使い＋剣士） | カード 1 枚「🏮 宵待ちの村 ▶ 次はここ」＋出撃する＋閉じる。タイトル「出撃 - 次の行き先」 |
| S14 | 1280×800 | 出撃後の酒場会話 | 話者「酒場の主人」、HUD 名前「魔法使い ｜ 支援: 剣士」、ボタンに 🔍 🛡️ |
| S15 | 1280×800 | トレーニング（テストモード） | 名前行に「Lv.50」、所持品の下に紫の「⚔️ Arena」 |
| S16 | 1280×800 | Arena パネル | 18 ボタン＋3 ボタン、紫系配色、英語ラベル＋emoji |
| S17 | 1280×800 | トレーニング戦闘 | 画面下中央のコンボ pip（橙、最終段はひし形）、左下の敵情報パネル、足元の扇形・円の 3D テレグラフ、必殺 8% |
| S18〜S21 | 1280×800 | 鑑定所（テストモード） | タブ 5 つ（2 行折返しの「ステータス配分」）、ステ振り（±丸ボタン）、スキルのサブタブ 5 つ＋「🔒 戦闘中は組み替えられない」、奥義の環（網目盤・emoji ノード・ズーム） |
| S22 | 1280×800 | デバッグモード | 上部中央の赤バッジ、右側に Motion Preview（画面縦幅の大半）と PERF パネル、ミニマップを覆う |
| S23〜S25 | 1280×800 | 洋館（テストモード） | 名前行「剣士 Lv.50」、ミニマップ下「囚われの洋館 / 古い森道」 |
| S26 / S27 | 1280×800 | 宵待ちの村（テストモード） | 「宵待ちの村 / 湖畔の森道」、魔法使いのボタン 🔍 🛡️ |
| P01〜P08 | 844×390（タッチ） | タイトル〜メニュー | 仮想スティック（橙のノブ）、回避・JUMP・カメラ回転ボタン表示、`#hud-hint` 非表示。メニューは縦スクロール。会話ボックスがボタン群・スティックを覆う |
| P15〜P22 | 844×390（タッチ） | トレーニング | Arena パネルが画面左半分を覆う。Arena 敵情報パネルが仮想スティックと重なる。デバッグ時は Motion Preview と PERF が画面の約 2/3 を覆う |

撮影できなかったもの（UNCONFIRMED）: ボスバー、雑魚 HP バー、ダメージ数値、処刑プロンプト、制限時間、クリア結果、戦闘不能、トースト（中央）、取得 / レベルアップポップ、縦持ち警告、ネームド表示、階層ラベル、パッド接続バッジ・フォーカス枠、交代の一幕（`playChapter1JoinScene`）、手記、画面フラッシュ / 暗転、PWA アイコン。

---

## 6. UI design inventory

### 6.1 Layout（FACT）

| 領域 | 位置 | サイズ | 備考 |
| --- | --- | --- | --- |
| HUD 左上パネル | top:16 left:16 | バー min-width 170px、パネル実測 約 254×140px | `backdrop-filter:blur(4px)` |
| 所持品チップ | top:16+78px left:16 | 約 125〜140×32px | 左上パネルの内側に重なる（S04） |
| Arena トグル | top:136 left:16 | — | 左上パネル下端と接する |
| ミニマップ | top:8 right:16 | `clamp(104px,14vmin,200px)` 円形 | ラベルはその直下 |
| 操作ヒント | bottom:14 中央 | 1 行、`white-space:nowrap` | 1280px 幅で約 850px |
| アクションボタン | 右下 | 攻撃 82 / JUMP 64 / 回避 58 / 必殺 52 / スキル3 46 / スキル1 44 / スキル2 42 px（円） | `right` / `bottom` を px で個別指定 |
| 仮想スティック | left:56 bottom:56 | 112px（ノブ 50px） | 左下 48%×46% がタッチ領域 |
| コンボ | bottom:15% 中央 | pip 10px | — |
| インタラクト | bottom:22% 中央 | pill 形 | 処刑は bottom:28% |
| ボスバー | top:14 中央 | `min(520px,78vw)` | 制限時間はその下 top:64 |
| メニュー | 画面中央 | `min(420px,90vw)`、max-height 88vh、縦スクロール | — |
| 鑑定所 / 出撃 | 画面中央 | `min(520px,92vw)` | — |
| 会話 | 下寄せ（padding-bottom 8vh） | `min(640px,92vw)` | — |
| クリア / 戦闘不能 | 画面中央 | `min(440px,90vw)` | — |
| タイトル / テストモード | 画面中央 | `min(920px,94vw)` | — |
| 確認 | 画面中央 | `min(380px,84vw)` | — |

- **FACT**: z-index は -1〜120 まで 19 種類の値（main.css `z-index:` の出現を集計）。主な層: タッチ 15 / HUD 16 / 左上パネル 30 / メニュー 30 / Arena 31 / 会話・結果 35 / 制限時間 39 / ボスバー 40 / 暗転・縦持ち 60 / 確認 120。
- **FACT**: `env(safe-area-inset-*)` はミニマップ・所持品・右下ボタン・スティック・デバッグ系に使われるが、`.hud-topleft`（top:16px 固定）と `.hud-hint`（bottom:14px 固定）には使われていない。

### 6.2 Typography（FACT）

| 用途 | font | size / weight |
| --- | --- | --- |
| 本文既定 | `Noto Sans JP` | — |
| 見出し（`.display`、タイトル・メニュー・会話の話者名等） | `Cinzel`, `Noto Serif JP` | タイトル clamp(26〜38px)、メニュー 20px |
| ボタン（主要） | `Noto Serif JP` 700 または `Cinzel` 700 | 12〜16px |
| ダメージ数値 | `Cinzel` 700 | 20px（会心 26px） |
| 制限時間 | `JetBrains Mono`（読み込み指定なし）→ `ui-monospace` | 15px |
| デバッグ | `ui-monospace, SFMono-Regular, Menlo` | 10px |

- **FACT**: フォントは Google Fonts の `@import`（main.css:1）で Cinzel / Noto Serif JP / Noto Sans JP を読み込む。`JetBrains Mono` は読み込まれていない。
- **FACT**: CSS 内の font-size は 8.5px〜42px の **22 種類**（px 指定の出現を集計）。10px 未満が 23 箇所（8.5 / 9 / 9.5px）。
- **FACT**: HUD のバーラベルは 8.5px、スキルカード説明・装備行の数値は 9.5px、奥義の環の詳細 9〜10px、3択報酬の説明 8.5px。

### 6.3 Color（FACT）

design token（`:root`）: `--bg #0c0a10` / `--panel #15111c` / `--panel-line #3a2f4a` / `--ember #c9793f` / `--ember-bright #f0a05c` / `--hp #a4293d` / `--mp #2d6f8e` / `--gold #c9a24b` / `--text #e9e1d6` / `--text-dim #a99fb0`。

- **FACT**: main.css の hex カラーは **99 種類**（重複除外）。var() 使用回数: `--ember-bright` 79 / `--panel-line` 59 / `--text-dim` 57 / `--text` 33 / `--ember` 12 / `--mp` 6 / `--panel` 4 / `--gold` 4 / `--hp` 3 / `--bg` 1。
- 用途別の色:

| 意味 | 色 |
| --- | --- |
| 背景 / パネル | `#0c0a10` / `linear-gradient(var(--panel), #100d16)`、HUD 系は `rgba(12,10,16,0.55)` |
| アクセント / 選択 | `--ember-bright`（橙）。テストモードの選択だけは `--mp`（青） |
| 主要ボタン | 橙グラデ `var(--ember)→#9c5e2c`（文字 `#1a1108`）。確認ダイアログの OK は明るい金 `#ffd08a→#e2a24a`。つづきからは `--gold` グラデ |
| HP | `#7a1c2c→--hp`（赤） |
| MP | `#1c4a5f→--mp`（青） |
| スタミナ | `#5a6a1c→#c9d94b`（黄緑） |
| XP | `#5a3d8a→#a05fe0`（紫） |
| ボス HP | `#ff4d3a→#ff8a4a`（赤橙）、雑魚 HP `#e2534a→#ffa257` |
| 体幹 | `#5a86ff→#8ab4ff`（青）、崩し目前 `#ffb347→#ffe0a0` |
| ダメージ | 与ダメ `#ffd580`、会心 `#ff5a5a`、被ダメ `#ff8a4a`、被会心 `#ff2a2a`、味方 `#9fe8ff` |
| 装備 | レア `#b08aff`、特殊 `#ff9a4a`、比較 ↑ `#7ad08a` / ↓ `#c05a5a`、装備中 `#e0b050`、売却 `#7ad08a` |
| 奥義の環 | 解放済み 緑 `#5a8a4a`、解放可能 橙、未解放 opacity .45 |
| デバッグ | バッジ 赤 `rgba(200,40,60,.85)`、PERF 緑 `#b8ffd0`、Motion 紫 `#d7c4ff`、Arena 紫 `#8a5ac0` |
| ミニマップ（Canvas） | 敵 `#e0574a`、ボス `#ff5a4a`、扉 `#e0b050`、階段 `#7ec8ff`、宝箱 `#ffd24a`、回復 `#7fe8b8`、支援 AI `#ffd27a`、仲間 `#8ae0c0`、北 `#ff8a6a` |

### 6.4 Shape（FACT）

- border-radius の値は **13 種類**（2 / 3 / 4 / 5 / 6 / 7 / 8 / 10 / 12 / 14 / 16 / 20px / 50%）。多い順に 6px（25）、4px（15）、50%（13）、8px（12）。
- パネル: 1px `--panel-line` 枠＋角丸 6px が主流。確認ダイアログは 12px、Arena は 10px、会話は 8px。
- ボタン: 主要ボタンは角丸 4px（はじめる・メニュー・タブ）と 16〜20px の pill（出撃する・結果画面・鑑定所の購入・ステ反映）が混在。設定ボタンは 6px。アクションボタンは円。ステ振りの ± は円（26px）。
- 区切り: `1px dashed var(--panel-line)`（メニュー・ステ振り・戦利品）、`.cc-section-label::after` の 1px 実線、メニューボタン行上の余白。

### 6.5 Icon（FACT）

| 種類 | 例 | 実装 |
| --- | --- | --- |
| カラー emoji | 🧪 🔷 💥 🌀 👑 ⬇️ ⚡ 🛡️ 🔍 👣 🪙 💎 🔩 💾 🗺️ 🔨 🧰 🏕️ 🏮 🏚 👻 💧 🏛️ 🕰️ 🌿 🌅 🔒 🐛 🎮 📱 ⏱️ 🧹 🎛 🏅 ⭐ 🛏️ 👹 💨 👤 🕯️ 🪄 🏹 🔱 🪓 等 | テキストとして DOM に入れる |
| 単色 Unicode 記号 | ⚔ 🗡 ✦ ➶ ◐（職業アイコン）、☰ ⟲ ⟳ ⏵ ▶ ▼ ✦ ✋ ★☆ − ＋ | テキスト、CSS `::before` / `::after`（`#interact-btn::before '✋ '`、`#execute-prompt::before '✦ '`、`.dialogue-next::after '▼'`） |
| 文字 | 「攻撃」「回避」「JUMP」「M」（武器バッジの初期値） | テキスト |
| Canvas 描画 | ミニマップの記号（四角・ひし形・宝箱形・方位文字 N/E/S/W） | `drawMinimap()` |
| CSS 図形 | コンボ pip（円・ひし形）、クールダウンリング（`conic-gradient`＋mask） | CSS |
| 画像 | PWA アイコン `public/icons/icon-192.png` / `icon-512.png` のみ。UI 内で画像ファイル・SVG アイコンは使われていない | — |

- **FACT**: 同じ emoji が別の意味で再利用されている: 👑（スキル3の空き枠・剣士スキル「覇道の一薙ぎ」・ボス能力見出し・Arena「Boss Test」）、🌀（盗賊の必殺「影閃乱舞」・剣士スキル「回転斬り」）、🗡️（大剣・双剣・魔法の剣の武器種アイコン）、✦（魔法使いの職業アイコン・処刑プロンプトの接頭）。
- **FACT**: 大剣の武器種アイコンは 🗡️（11-combat-actions.js:106）で、剣士の職業アイコンは ⚔（01:17）。

### 6.6 Material / Texture（FACT）

- flat color: HUD バー背景、ボタン背景（`#150f1c` など）
- gradient: パネル（縦 2 色）、主要ボタン（橙・金・青）、HP/MP 等のバー、タイトル背景の radial
- transparency: HUD 系（0.5〜0.62）、オーバーレイ背景（0.35〜0.8）
- blur: `backdrop-filter` を HUD 左上・所持品（4px）、メニュー・イベント（3px）、確認（2px）で使用。勝利時は canvas に `filter:blur(9px) saturate(1.5)`（`.victory-blur`）
- shadow: パネル外影（`0 20〜30px 60〜80px rgba(0,0,0,.6)`）、テキスト影（ミニマップ・ボス名・ダメージ）
- glow: 必殺準備完了の脈動（`ultReady`）、処刑プロンプトの脈動（`execPulse`）、ボスバーの発光、`.gp-focused` の外光、コンボ current
- texture: UI には画像テクスチャ無し。3D 側の看板のみ CanvasTexture

---

## 7. Design token inventory

| 分類 | 状態 | 場所 / 内容 |
| --- | --- | --- |
| 共通カラー | **あり（部分的）** | `:root` 10 変数（main.css:3〜13）。ただし hex 直書きが 99 種類併存 |
| 共通 border | **明示的なトークンなし**（`--panel-line` 色のみ共通） | 太さ・線種は各所で直書き（1px / 1.5px / 2px、solid / dashed） |
| 共通 radius | **明示的なトークンなし** | 13 種類の直書き |
| 共通 font | **明示的なトークンなし**（`.display` クラスのみ共通化） | font-family を各セレクタで直書き |
| 共通 font-size | **明示的なトークンなし** | 22 種類の直書き |
| 共通 icon | **明示的なトークンなし** | 各定義オブジェクトの `icon:` 文字列（`CLASSES`、`WEAPON_TYPES`、`CHARGE_VARIANTS_BY_CLASS`、`SKILL2_BY_CLASS`、`BOSS_*`、`ABILITY_DEFS`、`SCENARIO_DEFS`、loot）に散在 |
| 共通 button | **部分的** | `.event-btn`（pill・橙）、`.menu-btn`、`.confirm-btn`、`.ap-equip-btn, .ap-skill-btn, .ap-apply-btn`（共通化済み）、`.gear-item-btn`、`.gear-tool-btn`、`.menu-setting-btn`、`.ap-rank-btn`、`.sphere-*-btn`、`.action-btn`、`#cc-start-btn`、`#cc-continue-btn`、`#testmode-start-btn`、`#dice-roll-btn`（未使用） ― 14 系統 |
| 共通 panel | **部分的** | `.cc-frame` / `.menu-box` / `.event-box` / `.appraisal-box` は同じ「パネルグラデ＋`--panel-line` 枠＋6px」パターンを各セレクタで個別に記述 |
| common spacing | **明示的なトークンなし** | padding / gap を直書き |
| selected | **部分的** | `.selected` / `.active` / `.equipped` / `.lv-eq` / `.filled` / `.pressed` / `.gp-focused` が別々のスタイル |
| hover | **部分的** | PC 向けの `:hover` が一部カードのみ |
| disabled | **部分的** | `opacity:0.35` / `0.4` / `0.5` / `0.55`、`.locked` は `display:none`（アクションボタン）と `opacity:.55`（シナリオカード） |
| 3D 側のキャラクター配色 | **あり** | `src/render/player-palette.js`（PLAYER_ROLES / PLAYER_FINISH / WEAPON_FINISH）。UI からは参照されていない |

**結論（FACT）**: `:root` のカラー 10 変数以外に明示的な design token は無い。

---

## 8. FACT（主要なもの）

- F-01: UI の DOM は `index.html` の静的骨格＋`src/legacy/parts/` の JS 生成で作られ、CSS は `src/styles/main.css` 1 ファイル。新しい `src/core/` は UI の文字列・判定のみ供給する（§3.1）。
- F-02: 本編（Chapter 1）とテストモードの UI 差分は `legacyGrowthEnabled(state.testMode)`（core/chapter1-rules.js）1 箇所で決まる。旧成長 UI の非表示は `LEGACY_AP_TABS = ['stat','sphere']`（12:2534）、`LEGACY_SKILL_SUBTABS = ['passive','skill3']`（12:3078）、名前行・メニューのレベル / XP 行、出撃画面の「現在 Lv.」。
- F-03: PC（非タッチ）でもアクションボタン群（攻撃・スキル1・スキル3・必殺・（習得後）スキル2）は `gamepad-min` として表示され、`pointer-events:none`・opacity .9（10:23、main.css `#touch-controls.gamepad-min`）。実画面 S04 で確認。
- F-04: スキル2ボタンは未習得の間 `display:none`（`.action-btn.locked`、14:733）。スキル3ボタンは本編でも常に表示され、未装着時は opacity .4 の 👑（S04）。
- F-05: HUD 左上パネル（高さ約 140px）の上に所持品チップ（top 94px）が重なり、MP バー下部・スタミナラベル・ポートレート下半分・武器バッジを覆う（S04 / P04）。
- F-06: 本編 HUD にも XP バー（4px の紫）が表示される（S04。幅 0%）。Chapter 1 にレベル・XP は無い（docs/PROGRESSION.md「決定（WORK 12.1）」）。
- F-07: `#hud-hint` の文言は固定で「U スキル3」「Q・E カメラ回転」を含む。`KeyE` は処刑にも割り当てられている（09:330）。
- F-08: メニューの操作説明に「溜め攻撃: L(長押し)… 鑑定所でタイプ変更可」「鑑定所(街の近くで): I / 十字キー下 / 鑑定ボタン」「出撃メニュー(街で): F / 十字キー上 / 出撃ボタン」とある。「鑑定ボタン」「出撃ボタン」の DOM は存在しない（`btn-appraisal-touch` / `btn-sortie-touch` は CSS のみ、index.html・JS に無い）。
- F-09: CSS にのみ存在し DOM / JS に無いセレクタ: `#btn-menu-touch`、`#btn-appraisal-touch`、`#btn-sortie-touch`、`.town-prompt`、`#gate-prompt`、`.dice-*` / `.die` / `.pip`、`#dice-roll-btn`、`.gender-*`、`.personality-desc`、`.name-*`、`.alloc-preview`（キャラメイク廃止 #41 の残り）。
- F-10: 本編の鑑定所「装備品」タブには「🔍 一括鑑定」と凡例「Lv不足」が表示される（S10）。Chapter 1 本編にはランダム装備・未鑑定装備・レベルが無い（docs/PROGRESSION.md）。
- F-11: 本編の鑑定所「スキル」タブにはスキル2サブタブが常に並ぶ（S11。スキル2未習得のセーブで確認）。
- F-12: 奥義の環（スフィア盤）はテストモードでのみ表示（S21）。docs/PROGRESSION.md の「実装との差異（D-02、常時開放）」の記述は現在の実装（WORK 12.1 以降の非表示）と一致しない。
- F-13: 「はじめる」はセーブがある場合 `askConfirm` で上書き確認を出す（01:362）。セーブは 1 スロット（`soulforge_save_v1`）。
- F-14: 主人公交代は酒場に戻った時に自動で行われ、会話（`CHAPTER1_JOIN_LINES`）＋トースト「○○が酒場にいる」で示される（14:1650）。メニューからの選択 UI は作らない方針がコードコメントに明記（14:1448）。
- F-15: HUD 名前行は「主人公 ｜ 支援: ○○」（`hudLabel()`）。支援 AI の HP 等の表示は無い。
- F-16: パーティは主人公 1 人＋支援 AI 1 人（`CHAPTER_CAST` の classKey / guestClassKey）。3 人を同時に表示する UI は無い。
- F-17: テストモード入口はタイトル画面に常時表示（S01）。デバッグモードはメニュー下端の `ver` 5 連打で本番ビルドでも切替可能（14:314）。
- F-18: Combat Test Arena のラベルは英語（`Combat Test Arena`、`Dummy`、`Clear All`、`Debug Info: OFF`）、本編 UI は日本語。
- F-19: デバッグモード時、Motion Preview パネルは 1280×800 で画面右側の縦幅の大半を、844×390 で画面の約 2/3 を覆う（S22 / P22）。
- F-20: 844×390（タッチ）で Arena 敵情報パネル（左下）が仮想スティックと重なる（P17）。
- F-21: 会話ボックスは HUD・アクションボタンを消さずに上へ重ねる（S03 / P03）。背景の暗幕は `rgba(4,3,6,0.35)`。
- F-22: 通知は「中央トースト（1.7 秒）」と「左下ログ（6.5 秒）」が常に同時に出る（11:2231）。
- F-23: UI のアイコンはすべてテキスト（emoji / Unicode 記号）・CSS 図形・Canvas 描画で、画像・SVG アイコンは無い（§6.5）。
- F-24: `:root` の 10 色以外に design token は無い（§7）。
- F-25: 見出しフォント Cinzel はラテン文字専用で、日本語見出しは Noto Serif JP にフォールバックする構成（font-family の並び）。

## 9. OBSERVATION

- O-01: 本編 UI の基調は「暗い紫がかった黒のパネル＋細い紫灰の枠＋橙（ember）のアクセント＋セリフ体見出し」でほぼ統一されている（タイトル・メニュー・鑑定所・出撃・会話・結果）。
- O-02: 例外的な配色系統が 4 つある: テストモード（青 `--mp` を選択色に使う）、Arena（紫）、デバッグ（赤バッジ・緑/紫の等幅文字）、確認ダイアログ（明るい金の OK・角丸 12px）。
- O-03: 「主要ボタン」の見た目が画面ごとに異なる: 角丸 4px の長方形（はじめる・メニュー・タブ）、pill（出撃する・結果・購入・反映）、明るい金の角丸 8px（確認）、橙枠の透明ボタン（設定・ツール）。
- O-04: 「選択中」の表現が画面ごとに異なる: 橙グラデの塗り（鑑定所タブ・サブタブ）、橙枠＋薄い塗り（スキルカード・職業カード）、青枠＋青グラデ（テストモード）、黄土色枠（装備中の行）、緑枠（奥義の環の解放済み・3択の選択後）。
- O-05: 「無効」の表現が画面ごとに異なる: opacity 0.35 / 0.4 / 0.5 / 0.55、`display:none`、`🔒` テキスト、破線枠の「近日追加予定」。
- O-06: 同じ意味の数値が複数の形式で出る: HP はバー（HUD）と「152 / 152」（メニュー）、必殺ゲージはリング（ボタン外周）と「0%」（ボタン内）、所持金は 🪙 付き数値（メニュー・鑑定所ヘッダ・商店ボタン）。
- O-07: 色の意味が重なる箇所がある: 赤系は HP・ボス HP・被ダメージ・会心・デバッグバッジ・Lv不足・比較↓で使われ、橙系はアクセント・選択・与ダメージ・雑魚 HP・崩し目前・特殊装備で使われる。
- O-08: 職業を表すアイコンが 2 系統ある: 単色 Unicode（⚔ 🗡 ✦ ➶ ◐、ポートレート・テストモード・つづきから）と、カラー emoji（武器種 🗡️ 🪄 🏹、必殺 💥 🌀 ☄️ 🏹、スキル）。
- O-09: 画面上の文字サイズは 10px 未満が多い（HUD ラベル 8.5px、装備・スキルの説明 9.5px 等）。
- O-10: HUD の左上・右上・右下・下中央の 4 隅＋中央下にそれぞれ常設要素があり、酒場（S04）では操作ヒント帯（約 850px 幅）と右下ボタンが画面下部に並ぶ。
- O-11: UI は「本編」「テストモード」「デバッグ」の 3 層が同じ DOM・同じ CSS ファイルに同居し、表示条件（state.testMode / state.debugMode）で切り替わる。
- O-12: 3D 側のキャラクター配色（`player-palette.js`）と UI の色は独立しており、HUD のポートレート枠・足元以外の UI は職業によって色が変わらない（ポートレートは全職 ember 枠）。
- O-13: 操作ガイドは常設の 1 行ヒント（PC のみ）とメニュー内の長文の 2 箇所にあり、内容の粒度が異なる（ヒントは PC キーのみ、メニューは PC / パッド / タッチを列挙）。

## 10. UNCONFIRMED

- U-a: §5 末尾の「撮影できなかったもの」一覧（ボスバー、雑魚 HP バー、ダメージ数値、処刑プロンプト、制限時間、クリア結果、戦闘不能、中央トースト、取得 / レベルアップポップ、縦持ち警告、ネームド、階層、パッド関連、交代の一幕、手記、フラッシュ / 暗転、PWA アイコン）。
- U-b: 実 iPhone（Safari、ノッチ・safe-area・実フォント）での見え方。撮影は Chromium のタッチエミュレーション＋844×390 のみ。
- U-c: Google Fonts（Cinzel / Noto Serif JP / Noto Sans JP）読み込み時の見え方。撮影環境ではフォント CSS を空応答にしたため、全撮影がフォールバックフォント（§15）。
- U-d: 実 GPU での HUD と 3D の重なり方・発光の見え方（撮影は SwiftShader、FPS 4〜9）。
- U-e: ゲームパッド接続時の `gamepad-min` 表示とフォーカス枠。
- U-f: 本編でクリア結果画面の「3択報酬」「ステ振り」がどう出るか（コード上 `legacyGrowth()` による分岐の有無を全ては追っていない）。
- U-g: `12b` 撮影では離れた位置で撮ったためインタラクトプロンプト単体の見た目は背景写り込みのみでの確認。

## 11. POSSIBLE ISSUE

（すべて候補。修正の要否は判断しない）

| # | 分類（依頼 §問題候補） | 内容 | 根拠 |
| --- | --- | --- | --- |
| PI-01 | 1 画面を隠す / 3 形式違い | 所持品チップが HUD 左上パネルの MP・スタミナ・ポートレート・武器バッジを覆う | F-05、S04 |
| PI-02 | 1 画面を隠す | 会話ボックス・Arena パネル・デバッグパネルが HUD / 仮想スティック / ミニマップの上に重なる | F-19〜F-21、S03 / S22 / P17 / P22 |
| PI-03 | 1 画面を隠す | 戦闘中も操作ヒント帯（約 850px）が画面下に常時表示（PC） | S04 / S17 |
| PI-04 | 2 情報の重複 | トーストとログが同じ文を同時に出す。必殺はリングと％を同時に出す | F-22、O-06 |
| PI-05 | 3 表示形式の不一致 | 主要ボタン・選択・無効の見た目が画面ごとに違う | O-03〜O-05 |
| PI-06 | 4 icon style | 単色 Unicode とカラー emoji が混在、同じ emoji が別の意味で再利用 | §6.5、O-08 |
| PI-07 | 5 emoji の UI icon 使用 | HUD ボタン・タブ・カード・通知・ミニマップ以外のほぼ全 UI で emoji をアイコンとして使用。OS / フォントで見た目が変わる可能性 | F-23 |
| PI-08 | 6 色の意味 | 赤・橙がそれぞれ複数の意味を持つ | O-07 |
| PI-09 | 7 selected / disabled | 状態クラスとスタイルが画面ごとに別 | O-04 / O-05、§7 |
| PI-10 | 8 button / panel 形状 | radius 13 種、ボタン 14 系統、パネル 4 系統の個別記述 | §6.4、§7 |
| PI-11 | 9 PC 前提 | `#hud-hint` がキーボード前提、`:hover` 依存の表現、メニュー操作説明の「鑑定ボタン」「出撃ボタン」が存在しない | F-07 / F-08 |
| PI-12 | 10 狭い画面 | 10px 未満の文字が多い、HUD 左上の固定 px 配置と safe-area 未対応、メニュー・鑑定所は 390px 高で大半がスクロール領域、タブ「ステータス配分」が 2 行折返し | O-09、§6.1、P05 / P21 |
| PI-13 | 11 debug / production 混在 | テストモード入口がタイトルに常時表示、`ver` 5 連打でデバッグ切替、Arena の英語ラベル、同一 CSS / DOM に同居 | F-17 / F-18、O-11 |
| PI-14 | 12 仕様との食い違い | 本編 HUD の XP バー、本編スキル3ボタン（👑）、本編の「一括鑑定」「Lv不足」表示、スキル2サブタブの常時表示、`#hud-hint` の「U スキル3」 | F-04 / F-06 / F-07 / F-10 / F-11 |
| PI-15 | 12 仕様との食い違い | docs/PROGRESSION.md の D-02 記述（奥義の環は常時開放）が実装と一致しない | F-12 |
| PI-16 | 保守 | CSS の未使用セレクタ（キャラメイク時代・タッチ補助ボタン）が残存 | F-09 |
| PI-17 | 保守 | `JetBrains Mono` 指定が読み込まれていない | §6.2 |
| PI-18 | 2 / 12 | 3 人パーティ（将来）に対し、支援 AI の状態を示す UI が無い（名前のみ） | F-15 / F-16 |

## 12. NOT IMPLEMENTED

「存在しない」ことの確認方法を併記する（AGENTS.md §3 の記録義務）。

| 機能 | 確認 |
| --- | --- |
| チュートリアル専用 UI（ステップ表示・ハイライト等） | `tutorial` / `チュートリアル` を `src/` `index.html` で検索 → コメント 3 件のみ（07:194、12:225、core/punish-window.js:1）。影の旅人の案内会話と洋館の体幹練習は既存の会話 / 敵配置で表現 |
| キャラクター詳細画面（専用） | `index.html` に該当 overlay 無し。メニュー上部の 7 行のみ |
| インベントリ一覧画面 | 同上。アイテムは 🧪 🔷 の 2 種の個数表示のみ |
| セーブスロット選択 / 手動ロード画面 | `SAVE_KEY` は 1 つ（09-save-load.js）。ロードはタイトルの「つづきから」のみ |
| キャラクター切替メニュー | 方針として作らない（F-14、docs/SCENARIOS.md）。クリア後の自由選択 UI も未実装（docs/PROGRESSION.md「未確定」） |
| 3 人パーティ表示 / 支援 AI の HP 表示 | F-15 / F-16 |
| 章・シナリオ進捗の常設表示（Chapter 番号・現在の目的） | HUD に該当要素無し。タイトル `Chapter I` の固定文言と出撃画面の「▶ 次はここ」のみ |
| クエストログ / 目的表示 | 該当要素無し |
| 育成施設 UI / エンドダンジョン UI | `index.html`・`src/` に該当無し。出撃画面の「🧭 この先の旅 🔒 準備中」カードのみ（12:1549） |
| スフィア盤の本編解放（クリア後） | 盤 UI はあるがテストモードのみ。クリア後に解放する処理は無い（`legacyGrowthEnabled` は testMode のみを見る） |
| 設定画面（独立） | メニュー内に同居 |
| 画像 / SVG のアイコンセット | §6.5 |
| design token（色以外） | §7 |
| ゲームパッドのボタン表記の切替（Xbox / PS 表記の出し分け） | 操作説明は両表記の併記固定文言 |
| 縦画面レイアウト | `#rotate-overlay` で横画面を要求するのみ |

## 13. ゲームデザインとの関係

| 設計要素（docs） | 現在の UI | 分類 |
| --- | --- | --- |
| 3 人パーティ設計 | Chapter 2 以降の仕様は未確定（docs/GAME_DESIGN.md）。現 UI は主人公 1＋支援 AI 1 を名前行に文字で出すだけ | FACT / NOT IMPLEMENTED |
| 酒場中心のキャラクター切替 | 酒場帰還時の自動交代＋会話＋トースト。専用 UI なし | FACT |
| Skill 1 / Skill 2 / Ult | HUD ボタン: スキル1（`btn-charge`）、スキル2（閃くまで非表示）、必殺（ゲージ）。加えて本編でも **スキル3（`btn-skill3`）が表示** される。鑑定所のスキルタブで Skill 1 を付け替え可能（S11） | FACT（スキル3は PI-14） |
| Chapter 1 の簡略化成長 | 鑑定所の「ステータス配分」「奥義の環」、スキルの「パッシブ」「スキル3」サブタブ、レベル表示は本編で非表示。XP バー、「一括鑑定」「Lv不足」は本編でも表示 | FACT |
| メインシナリオ | 出撃画面は「次の行き先」1 件だけを出す一本道 UI（`offeredScenarios()`）。Chapter 1 完了後は「この先の旅 🔒 準備中」 | FACT |
| 装備 | 鑑定所「装備品」タブ（武器 / 上半身 / 下半身の 3 スロット） | FACT |
| 後半解放予定の Sphere Board | 盤 UI はテストモードのみ。本編での解放経路は未実装 | NOT IMPLEMENTED |
| 後半解放予定の facilities / end dungeon | UI なし | NOT IMPLEMENTED |

## 14. 将来の Human 方針との分離

以下は依頼文に記載された **将来設計の参考情報** であり、現在の UI がそうなっているという事実ではない。本レポートの §1〜§13 はこの方針で現状を評価していない。

- 既定コンセプト: 「中世ファンタジー × トゥーン × マット × シンプル」
- emoji をそのまま UI icon として使わない
- ゲーム専用の統一されたピクトグラムを検討
- キャラクター palette との視覚的整合
- 戦闘中はキャラクターと敵を主役にする
- UI を必要以上に画面へ被せない

参考として、上記方針と関係する現状の事実の所在だけを示す（評価はしない）:
emoji 使用 → §6.5 / PI-07、パレット → O-12 / `src/render/player-palette.js`、画面被覆 → PI-01〜PI-03、質感（マット / グロー / グラデ） → §6.6。

## 15. scope 外 / 撮影条件 / 制約

### Scope 外

- UI 仕様設計、Planner、Implementer、修正、CSS 変更、icon 制作、Task 起票
- 3D キャラクター・敵・VFX の見た目（CHARACTER-VIS-001 / ENEMY-ATTACK-VIS-001 の範囲）
- サウンド UI
- `basefile.html`（移行前の単一ファイル版）

### DO NOT CHANGE（今回変更しなかったもの）

- source（`src/`）、`index.html`、`src/styles/main.css`
- tests、`playwright.config.js`、`package.json` / `package-lock.json`
- docs（`docs/` とルート直下の *.md。PI-15 の記述差異も含め変更していない）
- `.ai/tasks/`、`.ai/decisions/`、他の report
- ローカル `main` ref（origin/main より古いが触っていない）
- 変更したファイルは `.ai/reports/UI-001-analysis.md` の 1 件のみ

### 撮影条件

| 項目 | 値 |
| --- | --- |
| サーバ | `npx vite --port=5173 --strictPort`（`npm ci` で node_modules を作成。lockfile は変更していない） |
| ブラウザ | `/opt/pw-browsers/chromium`（Playwright `chromium.launch`、`--use-gl=swiftshader --enable-webgl --ignore-gpu-blocklist`） |
| viewport | PC: 1280×800 / 狭い画面: 844×390（`hasTouch:true` で `isTouchDevice` が真になる構成。iPhone 横持ち相当の寸法） |
| フォント | Google Fonts は空の CSS で応答（tests/helpers.js の `openGame` と同じ扱い）→ **全撮影がフォールバックフォント** |
| 進行状態 | 新規開始 / localStorage に最小セーブを注入して「つづきから」（tests/chapter1-progression.spec.js と同形）/ テストモード（Lv.50、トレーニング・洋館・宵待ちの村） |
| 撮影スクリプト | セッションの scratchpad に置き、リポジトリには追加していない |
| 画像 | リポジトリに追加していない（asset 追加禁止） |

### 制約

- 実機 iPhone・実 GPU・パッドは使用できない（U-b / U-d / U-e）
- SwiftShader のため FPS 4〜9。アニメーション中の UI（トースト・ダメージ・フラッシュ）は捕捉できなかった
- ボス戦・クリア・全滅の画面は到達手順が長いため撮影していない（U-a）
- 解析用ブランチは依頼文の `claude/ui-001-analysis` ではなく、本セッションの実行環境が指定した `claude/ui-001-analysis-380kl5` を使用

---

## 16. UI リメイク設計に必要な未決事項（質問形式）

1. リメイクの対象範囲は「本編（Chapter 1）UI」だけか。テストモード・Arena・デバッグ UI も同じ design language に揃えるのか、開発用として別扱いにするのか。
2. テストモード入口（タイトル）と `ver` 5 連打のデバッグ切替は、本番ビルドでも残すのか。
3. 本編 HUD に表示されている XP バー・スキル3ボタン・「一括鑑定」「Lv不足」は、Chapter 1 の UI として残すのか、Chapter 2 まで隠すのか。
4. 3 人パーティ（Chapter 2 以降）の HUD で、支援 AI の HP・状態・スキルをどこまで表示するのか。現状の「名前だけ」を維持するのか。
5. 対象プラットフォームの優先順位は iPhone 横持ち・PC・パッドのどれか。縦画面は引き続き非対応でよいか。
6. 最小文字サイズを何 px にするか（現状 8.5px〜）。
7. emoji を置き換えるピクトグラムの形式（SVG / 画像スプライト / アイコンフォント / Canvas）と、対象範囲（HUD のみ / 全 UI / ミニマップ含む）。
8. 職業アイコン・スキルアイコン・武器種アイコンの意味の重複（👑 🌀 🗡️ ✦）をどう切り分けるか。
9. キャラクター palette（`player-palette.js`）を UI 色へ持ち込むのか（例: HUD・ポートレート・スキルボタンを職業色にするか）。
10. 色の意味（赤 = HP / 被ダメ / 警告、橙 = 選択 / 与ダメ / 雑魚 HP 等）を再定義するか。
11. 「選択中」「無効」「押下」「フォーカス（パッド）」の状態を 1 つの規則に揃えるか。
12. 戦闘中の常設 UI（操作ヒント帯・ミニマップ・所持品・左上パネル）をどれだけ残すか。自動非表示・フェードの方針は。
13. トーストとログの二重通知、必殺のリングと％の二重表示は、どちらかに寄せるのか。
14. 会話・演出中に HUD / ボタンを残すのか、隠すのか。
15. design token を CSS 変数で導入する場合、既存の `:root` 10 変数を起点にするのか、新しく定義し直すのか。
16. フォント（Cinzel / Noto Serif JP / Noto Sans JP）を維持するか。Google Fonts 依存（オフライン時）をどう扱うか。
17. 未使用 CSS（キャラメイク時代・存在しないタッチ補助ボタン）とメニュー操作説明の存在しない「鑑定ボタン」「出撃ボタン」の扱いは、UI リメイクの範囲に含めるか。
18. docs/PROGRESSION.md の D-02 記述と実装の差異（PI-15）を、UI リメイクの前に docs 側で整理するか。
19. 後半解放予定のスフィア盤・育成施設・エンドダンジョンの UI を、今回のリメイク設計で先に枠だけ決めておくのか。
20. 章・目的の常設表示（現在の行き先・同行者）を新設するか。
