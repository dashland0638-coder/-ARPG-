# UI-002-B Planner Report（開発用 UI の分離）

- Role: Planner（READ ONLY。変更するのは本ファイル・Task file・Decision record のみ。source / tests / config は変更しない）
- Date: 2026-09-27
- Branch: `claude/ui-002-b-planner`（`claude/ui-002-b-analysis` @ `7595db4` から作成）
- Session: UI-001 以降と同一の Claude Code セッション（独立性なし）
- 本計画は **提案** であり、Human Approval があるまで実装しない。

## 1. 入力（Artifact identity）

| Artifact | 参照 |
| --- | --- |
| 対象コード | main @ `eadf993e9e6c972a53823030c96da207d56f1344` |
| Analyzer report | `.ai/reports/UI-002-B-analysis.md`（`claude/ui-002-b-analysis` @ `7595db4b04de8c4df13e908e6a5ec74fac545ce2`） |
| Human Decision | `.ai/decisions/UI-002-human-decisions.md` §「UI-002-B: D-1〜D-7 と追加方針」、HD-3、HD-4 |
| Task | `.ai/tasks/UI-002-B.md` |

## 2. 方針（Human Decision からの導出）

- 判定: ページ URL のクエリに `dev=1` がある時だけ「開発用 UI 有効」とする（D-1）。起動時に一度だけ読む。保存しない（D-1 / D-4）。
- 本番ビルドにも開発用コードは残る（D-1: 除去しない）。GitHub Pages の `?dev=1` で実機確認できる（D-2）。
- 分離する入口は Analyzer §5 の結論どおり **3 点** に絞る:
  1. タイトルの `#open-testmode-btn`（E-1）→ 通常 URL では非表示・無効（D-7）
  2. `` ` `` キー（E-6）→ 通常 URL では無効（D-3）
  3. `#menu-version` 5 回連打（E-7）→ 通常 URL では無効（D-3）。バージョン表記の表示自体は変えない
- それ以外（Arena / PERF / Motion Preview / DEBUG バッジ / Visual Freeze / D-pad 右スポーン / Arena ログ）は既存の門番（`state.testMode` / `state.debugMode`）の内側にある（Analyzer §1.1 FACT）。上の 3 点を閉じれば、通常 URL ではこれらの状態に入れないため到達できなくなる。**これらのコードは変更しない。**
- 変更しないもの: テストモードのセーブ保護（`saveGame()` / `finishEnteringGame()`）、設定保存（D-6）、CSS、本編 UI、Chapter 1 仕様、UI-002-A の実装、`manifest.webmanifest`、`vite.config.js`、workflows。

## 3. Work Items

| ID | Summary | 依存 |
| --- | --- | --- |
| WI-B1 | `?dev=1` 判定の追加（純関数 + 起動時の 1 回読み取り） | なし |
| WI-B2 | タイトルのテストモード入口（E-1）を `?dev=1` 時のみ表示・有効 | WI-B1 |
| WI-B3 | デバッグモード入口（E-6 / E-7）を `?dev=1` 時のみ有効 | WI-B1 |
| WI-B4 | E2E の入口変更（`?dev=1` で開く）と分離の検証テスト追加 | WI-B1〜B3 |

WI-B1〜B4 は 1 つの実装ブランチ・1 回の Review でまとめて扱うことを提案する（WI-B1 単独では挙動が変わらず、WI-B2 / B3 だけでは E2E が壊れるため）。承認は WI ごとに行う（UI-002-A と同じ運用）。

### WI-B1 `?dev=1` 判定

- 案: 新規 `src/core/dev-ui.js` に純関数 `devUiEnabled(search)` を置く（`chapter1-rules.js` の `legacyGrowthEnabled()` と同じ作り）。`URLSearchParams(search).get('dev') === '1'` のときだけ true。
- legacy 側は `src/legacy/concat-plugin.js` の HEADER に import を 1 行追加し、`01-character-creation.js` の先頭付近で `const DEV_UI = devUiEnabled(location.search);` を 1 回だけ評価する。
- unit test `tests/unit/dev-ui.test.js`（新規）: `''` / `'?dev=1'` / `'?dev=0'` / `'?dev=true'` / `'?x=1&dev=1'` / `'?dev=1&dev=0'` の判定。
- Files To Change: `src/core/dev-ui.js`（新規）、`src/legacy/concat-plugin.js`（HEADER 1 行）、`src/legacy/parts/01-character-creation.js`（定数 1 行）、`tests/unit/dev-ui.test.js`（新規）

### WI-B2 タイトルのテストモード入口

- `index.html`: `.testmode-link-row` に `hidden` 属性を付け、既定を「非表示」にする（fail-closed。JS が動かない・判定に失敗した場合も出ない）。
- `01-character-creation.js` `setupTestModeScreen()`: `DEV_UI` のときだけ `hidden` を外す。`openBtn` の click でも `!DEV_UI` なら何もしない（二重の門番）。
- FACT（Analyzer 後に確認）: CSS `.testmode-link-row` は `display` を指定していない（`main.css:597`）ため `hidden` がそのまま効く。ゲームパッドのメニュー移動 `gpNavItems()`（`10-input.js:232-234`）は `offsetParent !== null` で非表示要素を除外するので、パッドから非表示ボタンに到達しない。
- `?dev=1` 時の見た目・位置・文言は現状と同一（D-7: デザイン変更ではない）。
- Files To Change: `index.html`（属性 1 箇所）、`src/legacy/parts/01-character-creation.js`

### WI-B3 デバッグモード入口

- 案: `toggleDebugMode()`（`02-world-common.js:1609`）の先頭に `if(!DEV_UI) return;` を 1 行置く。
  - FACT: `toggleDebugMode()` の呼び出しは `09-save-load.js:335`（`` ` ``）と `14-hud-boot.js:324`（バージョン 5 連打）の 2 箇所のみ。1 箇所で両方を閉じられる（`saveGame()` の門番と同じ考え方）。
  - デバッグモードを OFF にする経路（タイトルへ戻る時 `10-input.js:383`）は `toggleDebugMode()` を通らないため影響しない。
- バージョン表記（`bindVersionTap()` の表示部分）は変更しない。
- Files To Change: `src/legacy/parts/02-world-common.js`（1 行）

### WI-B4 E2E

- FACT（Analyzer §2.2）: E2E のページ遷移は `tests/helpers.js:38`（`openGame()`）と `tests/character-motion.spec.js:215` の 2 箇所のみ。`page.reload()`（3 spec）はクエリを保持する。
- 変更:
  1. `tests/helpers.js` `openGame()`: `page.goto('/')` → `page.goto('/?dev=1')`（既存 spec はすべて開発用 URL で従来どおり動く。テストの意味は変えない — D-5）
  2. `tests/character-motion.spec.js:215`: `page.goto('/')` → `page.goto('/?dev=1')`
  3. 新規 `tests/dev-ui-gate.spec.js`（分離の検証。追加方針「別経路が残らないこと」「`?dev=1` で従来どおり」の確認用）:
     - 通常 URL: タイトルで `#open-testmode-btn` が非表示 / 本編開始後に `` ` `` を押しても `#debug-badge` が出ない / メニューのバージョン表記を 5 連打しても出ない / `#arena-toggle-btn` が出ない
     - `?dev=1`: タイトルで `#open-testmode-btn` が表示 / 本編で `` ` `` と 5 連打でデバッグモードが ON になる / テストモードに入ると `#arena-toggle-btn` が出る
- 既存 spec の検証内容・期待値は変更しない。
- Files To Change: `tests/helpers.js`、`tests/character-motion.spec.js`（1 行）、`tests/dev-ui-gate.spec.js`（新規）

## 4. Files To Change（全体）

| ファイル | WI | 内容 |
| --- | --- | --- |
| `src/core/dev-ui.js`（新規） | B1 | `devUiEnabled(search)` |
| `src/legacy/concat-plugin.js` | B1 | HEADER に import 1 行 |
| `src/legacy/parts/01-character-creation.js` | B1 / B2 | `DEV_UI` 定数、テストモード入口の表示・click ガード |
| `src/legacy/parts/02-world-common.js` | B3 | `toggleDebugMode()` 先頭のガード |
| `index.html` | B2 | `.testmode-link-row` に `hidden` |
| `tests/unit/dev-ui.test.js`（新規） | B1 | 判定の unit test |
| `tests/helpers.js` | B4 | `openGame()` の URL |
| `tests/character-motion.spec.js` | B4 | `page.goto` の URL 1 行 |
| `tests/dev-ui-gate.spec.js`（新規） | B4 | 分離の検証 |

変更しない（明示）: `09-save-load.js`、`14-hud-boot.js`、`14-training-ground.js`、`13-update-loop.js`、`10-input.js`、`05-rendering-rig.js`、`src/styles/main.css`、`public/manifest.webmanifest`、`vite.config.js`、`playwright.config.js`、`.github/workflows/*`、その他の spec。

## 5. 到達経路の確認（通常 URL、実装後の想定）

| 入口 | 実装後 | 根拠 |
| --- | --- | --- |
| E-1 / E-2 テストモード | 到達不可 | WI-B2（非表示 + click ガード）。`beginTestMode()` の呼び出しは `#testmode-start-btn` のみ（`01:634`）、`finishEnteringGame({world:'training'})` は `beginTestMode()` 内のみ（`14-hud-boot.js:1404`） |
| E-3 / E-4 / E-5 / E-12 Arena | 到達不可 | `state.testMode` が true にならない |
| E-6 / E-7 デバッグモード | 到達不可 | WI-B3 |
| E-8〜E-11 Freeze / PERF / Motion / バッジ | 到達不可 | `state.debugMode` が true にならない |
| URL 以外の経路（localStorage 等） | なし | D-1 により保存しない。Analyzer §1.1: URL・env 分岐は現在 0 件 |

## 6. テスト計画（AGENTS.md §14）

| 区分 | 内容 |
| --- | --- |
| Build | `npm run build` |
| Unit | `npm run test:unit`（`dev-ui.test.js` を含む） |
| E2E | **Full Regression**（`npm test` 全件。入口に関わるため — Task Test requirements） |
| 撮影（HD-4） | タイトル画面を 1280×800 / 844×390 で、通常 URL と `?dev=1` の両方（計 4 枚）。本編 HUD は変更しないため撮影対象外 |
| 本番 URL 実機確認（D-2） | GitHub Pages への反映は main merge 後のため、この環境では実行できない → **NOT_RUN**（merge 後に Human が通常 URL / `?dev=1` の両方を確認） |

既存の FAIL（mansion-escort Relaxed Stance）/ FLAKY（execution-break、job-traits）は、結果にそのまま記録し PASS として数えない（D-5）。

## 7. Acceptance Criteria（案。Approval で確定）

1. 通常 URL: タイトルに「🛠 テストモード」が表示されない。`` ` `` / バージョン 5 連打でデバッグモードにならない。Arena・PERF・Motion Preview・DEBUG バッジが出ない。
2. `?dev=1`: 上記すべてが従来どおり使える。
3. 既存 E2E が（入口 URL 変更後に）従来と同じ結果（既存 FAIL / FLAKY を除く）。
4. 本編 UI・CSS・Chapter 1 仕様・セーブ形式・設定保存・テストモードのセーブ保護が変わっていない。
5. `?dev=1` の状態がどこにも保存されない（通常 URL で開き直すと本番扱い）。

## 8. Approval Points（Human が決める。AI は決めていない）

| # | 論点 | Planner の推奨（参考） |
| --- | --- | --- |
| AP-B1 | 判定を新規 core モジュールに置くか、legacy part 内に直接書くか | core モジュール（unit test 可能。既存 `chapter1-rules.js` と同じ作り）。ただし `concat-plugin.js` の変更を伴う |
| AP-B2 | 有効とする値を `dev=1` の厳密一致に限るか（`dev=true` 等は無効） | 厳密一致 |
| AP-B3 | テストモード入口の既定を HTML の `hidden`（fail-closed）にするか、JS で隠すか | `hidden`（fail-closed） |
| AP-B4 | デバッグモードの門番を `toggleDebugMode()` 1 箇所にするか、呼び出し 2 箇所にするか | `toggleDebugMode()` 1 箇所 |
| AP-B5 | 既存 E2E を `openGame()` で一括して `?dev=1` にするか（spec 個別の変更をしない） | 一括（D-5 の「必要な範囲」に最小） |
| AP-B6 | 新規 `tests/dev-ui-gate.spec.js` の追加と、上記の検証内容 | 追加する |
| AP-B7 | Persistence（実装ブランチ名・commit / push の許可） | `claude/ui-002-b-impl` |

## 9. Risks

| Risk | 対策 |
| --- | --- |
| `openGame()` を使わない入口が漏れて E2E が通常 URL で動く | FACT: `goto` は 2 箇所のみ。両方変更する |
| iPhone で本番 URL に `?dev=1` を付け忘れる | D-4 どおり明示指定。手順は Review / 実機確認で共有 |
| GitHub Pages の本番確認は merge 後にしかできない | §6 で NOT_RUN と明記し、Human の確認対象とする |
| `DEV_UI` 定数が concat 順より前に参照される | 01 が最初の part（ファイル名順）。`toggleDebugMode()` は実行時に参照するため問題ない（INFERENCE。実装時に build / E2E で確認） |

## 10. 変更したファイル（本 Planner）

- `.ai/reports/UI-002-B-plan.md`（新規）
- `.ai/decisions/UI-002-human-decisions.md`（UI-002-B D-1〜D-7 と追加方針の記録、Decision History 1 行）
- `.ai/tasks/UI-002-B.md`（Analysis 行、Work Items、Approval Points、Status History）
- source / tests / config は変更していない。
