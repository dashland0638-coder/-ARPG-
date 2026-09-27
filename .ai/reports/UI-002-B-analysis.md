# UI-002-B Analyzer Report（開発用 UI の分離）

- Role: Analyzer（READ ONLY。本ファイル以外は変更していない）
- Date: 2026-09-27
- Branch: `claude/ui-002-b-analysis`（`origin/main` @ `eadf993e9e6c972a53823030c96da207d56f1344` から作成）
- Task: `.ai/tasks/UI-002-B.md`（Status: DRAFT、最終変更 commit `589d28b`）
- Session: UI-001 以降と同一の Claude Code セッション（独立性なし）

## Artifact identity

| Artifact | 参照 |
| --- | --- |
| 解析対象コード | `eadf993`（main。UI-002-A merge 後） |
| UI-001 Analyzer report | `claude/ui-001-analysis-380kl5` @ `4830a38`（Task file 記載どおり） |
| UI-002 Planner report | `claude/ui-002-planner` @ `eadb5e3`（Task file 記載どおり） |
| Decision record | `.ai/decisions/UI-002-human-decisions.md`（HD-3 / HD-4） |

表記: **FACT** = コード・設定・テストで確認した事実 / **INFERENCE** = 推測 / **HUMAN DECISION** = Human が決める事項（AI は決めない）

---

## 1. 開発用 UI への入口（すべて）

### 1.1 入口一覧（FACT）

| # | 入口 | 種類 | 本番の通常画面から到達可能か | 開くもの | ガード | 場所 |
| --- | --- | --- | --- | --- | --- | --- |
| E-1 | タイトル画面「🛠 テストモード(上位職デバッグ用)」`#open-testmode-btn` | ボタン（常時表示） | **可能**（タイトルの「はじめる」の直下） | `#testmode-screen`（職業・転身・ゲスト・シナリオ・開始地点・レベル 1〜99） | なし | `index.html:42-44`、`01-character-creation.js:424` |
| E-2 | `#testmode-start-btn`「🛠 トレーニング開始」 | ボタン | E-1 経由 | `beginTestMode()` → `finishEnteringGame({world:'training'})`（シナリオ指定時はその後 `launchScenario()`） | 職業未選択時 disabled | `index.html:78`、`01-character-creation.js:634`、`14-hud-boot.js:1328` |
| E-3 | `#arena-toggle-btn`「⚔️ Arena」 | HUD ボタン | テストモード中のみ表示 | `#arena-panel`（ロスター spawn / Clear All / Debug Info / スキル・スフィア盤） | `updateArenaPanel()` が毎フレーム `state.testMode` で `.show` を切替。`toggleArenaPanel()` も `!state.testMode` で return | `index.html:150-164`、`14-training-ground.js:77-106, 256-265` |
| E-4 | `#arena-loadout-btn`「🎛 スキル / スフィア盤」 | ボタン | E-3 経由 | `toggleAppraisal()`（テストモードでは場所制限なし） | E-3 と同じ | `14-training-ground.js:92` |
| E-5 | ゲームパッド 十字キー右（button 15） | パッド | 本編でも押せる | `arenaCycleSpawn()` | `!state.testMode \|\| currentWorldKey!=='training'` で return（本編では何も起きない） | `13-update-loop.js:58`、`14-training-ground.js:110` |
| E-6 | キーボード Backquote（`` ` ``） | キー | **可能**（本編・テストモードとも） | `toggleDebugMode()`: 被ダメージ0・当たり判定表示・`#debug-badge`・`#perf-panel`・`#motion-panel`・全敵 HP バー表示 | なし | `09-save-load.js:335`、`02-world-common.js:1609` |
| E-7 | メニュー下端 `#menu-version` を 1.5 秒以内に 5 回タップ | タップ | **可能**（本編のメニュー画面） | E-6 と同じ `toggleDebugMode()` | なし（コメント: iPhone 実機テスト用） | `index.html:300`、`14-hud-boot.js:298-327` |
| E-8 | キーボード KeyP | キー | 本編でも押せる | `toggleMotionFreeze()`（Visual Freeze） | `!state.debugMode` で return（デバッグモード時のみ有効） | `09-save-load.js:338`、`05-rendering-rig.js:3961` |
| E-9 | `#perf-panel` | 表示パネル | E-6/E-7 経由 | FPS・フレーム時間 | `updatePerfPanel()` が `state.debugMode` で表示 | `index.html:140`、`14-hud-boot.js:888` |
| E-10 | `#motion-panel`（Debug Motion Preview） | 表示パネル | E-6/E-7 経由 | 姿勢・局面 | `updateMotionPanel()` が `state.debugMode && state.started` で表示 | `index.html:145`、`14-hud-boot.js:1057` |
| E-11 | `#debug-badge`「🐛 DEBUG MODE — 被ダメージ0」 | 表示 | E-6/E-7 経由 | — | `toggleDebugMode()` が `.show` 切替 | `index.html:136` |
| E-12 | `#arena-feedback-log` / `#arena-enemy-info` | 表示 | テストモードのみ | 戦闘判定ログ・敵情報 | `emitArenaFeedback()` は `!state.testMode` で return | `14-training-ground.js:121-140` |

- URL パラメータ・環境変数による入口: **なし**。`location.search` / `URLSearchParams` / `location.hash` の使用はコード中に 0 件。`import.meta.env` は `BASE_URL` のみ（`src/audio/audio.js:21`、`src/textures/textures.js:12`）。`import.meta.env.DEV` / `PROD` / `MODE` の使用は 0 件（FACT）。
- `window.__*` 等のテスト用グローバルフックはアプリ側に無い（テスト側が `page.evaluate` で `window.__dmg` 等を自前で作るのみ）（FACT）。
- タイトルへ戻る時（`10-input.js:383`）はデバッグモードを必ず OFF にする（FACT）。

### 1.2 本番ユーザーが到達できる開発用機能（FACT + INFERENCE）

| 入口 | 本番で起きること | 安全性の観点 |
| --- | --- | --- |
| E-1/E-2 | 誰でもタイトルからテストモードへ入れる。レベル 99・上位職・全シナリオ・途中地点から開始可能 | セーブは変わらない（§4）。ただし第一章の境界（Level / 転身 / スキル等を出さない）を越えた内容を本番ユーザーが見られる（INFERENCE: 本編の体験・ネタバレの問題） |
| E-6 | PC のキーボードで `` ` `` を押すと本編で被ダメージ0 になる | **本編のセーブは継続して書かれる**（`saveGame()` は `debugMode` を見ない）。無敵状態で進めた進行がそのまま保存される（FACT: `saveGame()` のガードは `state.testMode` のみ）。`debugMode` 自体はセーブされない（`09-save-load.js` に保存項目なし） |
| E-7 | iPhone 等でもメニューのバージョン表記を 5 連打で同上 | 同上。偶然 5 回連打する可能性は低いが 0 ではない（INFERENCE） |
| E-8〜E-11 | E-6/E-7 の後だけ | 同上 |
| E-3〜E-5、E-12 | テストモード内のみ | 本編からは表示されない（E-5 は本編で無反応） |

---

## 2. 既存 E2E / helpers の依存

### 2.1 件数（FACT: `tests/*.js` の文字列出現数 / ファイル数。spec 総数 34）

| 対象 | 出現数 | ファイル数 |
| --- | --- | --- |
| `#open-testmode-btn` | 22 | 22 |
| `#testmode-start-btn` | 23 | 21 |
| `#testmode-job-grid` | 27 | 18 |
| `#testmode-scenario-grid` | 5 | 3 |
| `#testmode-level` | 3 | 2 |
| `#testmode-class-grid` | 2 | 2 |
| `startTestMode(`（helpers） | 16 | 5 |
| `#arena-toggle-btn` | 60 | 13 |
| `arena-panel`（`arena-panel-*` を含む） | 14 | 6 |
| `#arena-roster` | 14 | 11 |
| `#arena-info-toggle-btn` | 13 | 7 |
| `#arena-enemy-info` | 13 | 7 |
| `#arena-feedback-log` | 7 | 3 |
| `#arena-clear-btn` | 6 | 5 |
| `#arena-loadout-btn` | 3 | 3 |
| Backquote（キー押下） | 13 | 8 |
| `#motion-panel` | 15 | 7 |
| `#debug-badge` | 6 | 3 |
| `#perf-panel` | 3 | 1 |
| `#menu-version` | 3 | 1 |
| KeyP | 3 | 1 |

- テストモード入口（`#open-testmode-btn` または `startTestMode`）を使う spec: **25 / 34**（`tests/helpers.js` を含まない数）。使わない spec: audio / chapter1-progression / chapter1-skill2 / mansion-scenario / perf-diagnostic / save-load / scenario-timer / settings / shadow-guide / tavern-smith-greeting。
  - 注: `tests/chapter1-legacy-ui.spec.js`（UI-002-A）はテストモードを使う側に含まれる。
- Backquote を使う spec（8）: character-clothing / character-motion / character-palette / character-weapon-visual / execution-break / mansion-escort / perf-diagnostic / weapon-stow。
- `perf-diagnostic.spec.js` は **本編（`#cc-start-btn` で開始）でデバッグモードを Backquote と `#menu-version` 5 連打の両方で有効化** して検証している（`:18-58, 87-121`）。
- KeyP（Visual Freeze）を使う spec は `character-motion.spec.js` の 1 ファイル。
- `mansion-escort.spec.js` はテストモード中に Backquote を押す（既存 FAIL の spec。UI-002-A Review 参照）。

### 2.2 入口の操作（FACT）

- ページ遷移はすべて `page.goto('/')`。`tests/helpers.js:38`（`openGame()`）と `tests/character-motion.spec.js:215` の 2 箇所のみ。クエリ付き URL の使用は 0 件。
- `startTestMode()`（`tests/helpers.js:132-156`）: `#open-testmode-btn` クリック → `.class-card` → `#testmode-job-grid` 待ち →（任意）guest / scenario / waypoint / level → `#testmode-start-btn`。
- 多くの spec（例: `combat-test-arena.spec.js:24-27`）は helpers を使わず `#open-testmode-btn` を直接クリックしている。
- Playwright は dev サーバ（`npm run dev -- --port=5173`、base `/`）に対して実行（`playwright.config.js` webServer）。本番ビルド（`dist`、base `/-ARPG-/`）は E2E の対象外。

### 2.3 INFERENCE

- 入口（`#open-testmode-btn` / Backquote / `#menu-version`）の DOM・キーを残したまま「表示・有効化の条件」だけを変える方式なら、E2E の変更は `page.goto('/')` 2 箇所（URL・前準備）に集約できる可能性が高い。
- 入口の DOM を削除・改名する方式は、上表の 22〜25 ファイルに変更が及ぶ。

---

## 3. 本番ビルド（GitHub Pages）と dev サーバの差、実機確認

### 3.1 FACT

| 項目 | dev サーバ（`npm run dev`） | 本番（GitHub Pages） |
| --- | --- | --- |
| 起動 | `vite`（`server.host: true` で LAN 公開。コメント: iPhone から `http://<LAN-IP>:5173`） | `.github/workflows/deploy.yml`: main への push / 手動で `npm ci` → `npm run build` → `dist` を Pages へ |
| base | `/` | `/-ARPG-/`（`NODE_ENV==='production'`） |
| `__APP_VERSION__` | package.json `version`（`0.1.0`） | 同じ |
| 開発用 UI | すべて有効 | **すべて有効（dev と同一）**。ビルド時に開発用 UI を切り替える仕組みは無い |
| E2E | `test.yml`（PR / 手動）→ `npm run build`、`npm run test:unit`、`npm test`（dev サーバに対して） | E2E なし |
| PWA | — | `public/manifest.webmanifest`: `start_url: "./"`、`display: fullscreen`。Service Worker の登録は無い |

- 実機での開発確認の手順（コード・コメントから読み取れるもの）:
  1. 同一 Wi-Fi の iPhone から dev サーバ（`http://<LAN-IP>:5173`）を開く、または GitHub Pages の本番 URL を開く。
  2. テストモードはタイトルのボタン（E-1）から。
  3. デバッグモード（PERF / Motion Preview / 当たり判定）はメニューのバージョン表記 5 連打（E-7）から（キーボードが無いため）。
- 手順を記したドキュメントは確認できなかった（INFERENCE: `bindVersionTap()` のコメントが実質の手順記録）。

### 3.2 INFERENCE

- 実機確認が「本番 URL（GitHub Pages）で行われている」のか「dev サーバで行われている」のかはコードから判別できない。ビルド時に開発用 UI を除外する方式を選ぶと、本番 URL での実機確認ができなくなる。→ HUMAN DECISION（§6 D-2）。
- PWA としてホーム画面に追加した場合、起動 URL は `start_url: "./"` 固定のため、URL パラメータ（`?dev=1`）は付かない。ホーム画面起動で開発用 UI を使うには、パラメータを一度読んで保存する等の追加の仕組みが必要になる（Safari で URL を直接開く場合は影響なし）。

---

## 4. テストモードがセーブを変更しない仕組み（FACT）

1. `saveGame()`（`09-save-load.js:93-94`）の先頭で `if(state.testMode) return false;`。自動セーブ・酒場・メニューのセーブはすべてこの関数を経由する（同コメント）。
2. `state.testMode` の書き換えは `finishEnteringGame()`（`14-hud-boot.js:1737`）の `state.testMode = (world==='training')` の 1 行のみ。`beginGame()` / `continueGame()`（`world==='tavern'`）で必ず false に戻る。
3. `beginTestMode()` は `deleteSaveGame()` を呼ばない（`14-hud-boot.js:1321` コメント）。`deleteSaveGame()` の呼び出しは新規ゲーム開始（`:1291`）のみ。
4. Scenario Test Mode は必ず training で入場した後に `launchScenario()` する（`:1405-1420` コメント）。シナリオの world で直接入場すると `testMode` が false になり本セーブを上書きするため。
5. テストモードの別の保護: 戦闘不能にならない（HP1 で生存、`12-progression-ui.js:1169`）、章進行に触らない（`14-hud-boot.js:1470`）。
6. **例外**: 設定（`saveSettings()`、`09-save-load.js:249-256`、SETTINGS_KEY）は `state.testMode` を見ずに保存される。テストモード中に設定を変えると本番の設定にも残る（セーブデータ SAVE_KEY は変わらない）。
7. デバッグモード（E-6/E-7）にはセーブ保護が無い（§1.2）。

---

## 5. 候補方式の比較材料（判定ではない）

| 方式 | 概要 | 本番ユーザーの誤進入 | E2E への影響（INFERENCE） | 実機確認 | 注意点 |
| --- | --- | --- | --- | --- | --- |
| M-0 現状維持 | 変更なし | E-1（常時表示）/ E-6 / E-7 で到達可能 | なし | 現状どおり | HD-3 を満たさない |
| M-1 `?dev=1`（URL で入口を表示・有効化） | URL に `dev=1` がある時だけ E-1・E-6・E-7 を有効化 | URL を知らなければ到達不可。知っていれば誰でも入れる（秘匿ではない） | `page.goto('/')` 2 箇所を `/?dev=1` に変えれば他の spec はそのまま動く見込み。`perf-diagnostic` の本編デバッグ（Backquote / 5 連打）も同じ扱いにするかで範囲が変わる | 本番 URL・dev サーバの両方で可（URL を手入力）。PWA のホーム画面起動では付かない（§3.2） | URL 解析は現在どこにも無い（新規の読み取り 1 箇所が必要） |
| M-1b `?dev=1` + 記憶（localStorage 等） | 一度 `?dev=1` で開くと以後も有効 | M-1 より残りやすい。解除手段が必要 | M-1 と同じ。テスト間の状態持ち越しに注意（Playwright はテストごとに新しいコンテキスト） | PWA でも使える | 新しい保存キーが増える（既存セーブ形式は変えない） |
| M-2 ビルド時除外（`import.meta.env.DEV` / Vite define） | 本番ビルドから開発用入口を外す | 本番では不可能 | E2E は dev サーバで走るため影響小。ただし `test.yml` の build 検証と挙動が分かれる | **本番 URL では不可**。実機は dev サーバ（LAN）限定 | 本番でテストモードを使う運用があるなら不可。コード中に env 分岐が現在 0 件 |
| M-3 M-1 と M-2 の組み合わせ | dev サーバは常時有効、本番は `?dev=1` 時のみ等 | M-1 と同程度 | M-1 と同程度または小 | 両方可 | 条件が 2 系統になる |
| M-4 隠し操作（長押し・連打等） | タイトル等の隠し操作で表示 | 偶然の到達があり得る（E-7 と同様） | spec の入口操作を置き換える必要あり（22 ファイル規模の可能性） | 可 | 現行 E-7 と同じ性質 |

共通の FACT:
- 入口の門番は既に集約されている: Arena は `state.testMode`、PERF / Motion / Freeze / バッジは `state.debugMode`。したがって分離が必要な「入口」は E-1（テストモード画面のボタン）と E-6 / E-7（`toggleDebugMode()` の呼び出し 2 箇所）の 3 点に絞られる。
- E-3〜E-5・E-8〜E-12 は本編で表示・動作しない（テストモード / デバッグモード内に閉じている）。

---

## 6. HUMAN DECISION（Planner / Human が決める事項。AI は決めていない）

| # | 論点 |
| --- | --- |
| D-1 | 分離方式（M-1 / M-1b / M-2 / M-3 / M-4 / 他）。HD-3 は `?dev=1` を候補としている |
| D-2 | 本番 URL（GitHub Pages）で実機確認を続ける必要があるか（M-2 の可否に直結） |
| D-3 | デバッグモード（E-6 Backquote / E-7 バージョン 5 連打）を分離対象に含めるか。本編で被ダメージ0 のままセーブされる点をどう扱うか（本 Task は入口の分離まで。挙動変更は範囲外の可能性） |
| D-4 | PWA（ホーム画面起動）で開発用 UI を使う必要があるか（M-1 と M-1b の差） |
| D-5 | E2E の入口変更範囲（`helpers.js` の `openGame()` と `character-motion.spec.js:215` の URL のみか、spec の個別変更を許可するか）。tests 変更は Human Approval の対象 |
| D-6 | テストモード中の設定保存（§4-6）を現状のままとするか（本 Task の範囲外として記録のみでよいか） |
| D-7 | タイトルのテストモードボタン（E-1）を非表示にすることは「本番 UI の変更」に当たるか（HD-3: 本番 UI 変更と同時実施しない、との関係） |

## 7. 既存テスト状態（引き継ぎ。本 Analyzer では再実行していない）

- 既存 FAIL: `mansion-escort.spec.js`「非戦闘・停止中は Relaxed Stance」（未解消）
- FLAKY: `execution-break.spec.js` 通常敵 Break → EXECUTE、`job-traits.spec.js` 鷹の目 Turn Assist
- 本 Analyzer ではテストを実行していない（NOT_RUN）。いずれも PASS として数えない。

## 8. 変更したファイル

- `.ai/reports/UI-002-B-analysis.md`（本ファイル、新規）のみ。source / tests / docs / config / Task file / Decision record は変更していない。
