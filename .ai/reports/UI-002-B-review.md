# UI-002-B Review（WI-B1〜WI-B4）

## 1. Reviewer / 対象

| 項目 | 値 |
| --- | --- |
| Reviewer | Claude Code セッション（Reviewer 役） |
| 独立性 | **同一セッションで兼務**（Analyzer / Planner / Implementer と同じセッション。AGENTS.md §5）。判断は下記 SHA 時点の Task / Plan / Decision record / diff と、Reviewer 自身の再実行結果に基づく |
| 推奨 | 兼務のため、**人間による差分確認を推奨**する（source 差分は 5 ファイル・約 25 行） |
| 日付 | 2026-09-27 |
| Implementation SHA（固定） | `714fdc748c86bac3f530ab7a7d1f2f2026e5f21e` |
| Handoff | `.ai/reports/UI-002-B-review-handoff.md`（`705f949`） |
| Branch | `claude/ui-002-b-impl` |
| main | `origin/main` = `eadf993e9e6c972a53823030c96da207d56f1344`（未変更を確認） |

検証は `714fdc7` を別 worktree（リポジトリ外）にチェックアウトして行い、終了後に削除した。

## 2. Handoff 検証（AGENTS.md §5.1）

| # | 結果 |
| --- | --- |
| V-1 | OK: `714fdc7` は `origin/claude/ui-002-b-impl` から到達可能 |
| V-2 | OK: `714fdc7:.ai/tasks/UI-002-B.md` あり（WI-B1〜B4 APPROVED、AP-B1〜B7、Persistence `claude/ui-002-b-impl`） |
| V-3 | OK: Plan `.ai/reports/UI-002-B-plan.md`（`88fe3ef` は `714fdc7` の祖先） |
| V-4 | OK: `714fdc7:.ai/reports/UI-002-B-analysis.md` の blob = `7dbd9e719647abed190b2190dbee884f019037d3`（Task file の `Analysis:` 行と一致）。`7595db4` は祖先 |
| V-5 | OK: Implementation Result は後続 commit `cfa41ac`（文書のみ） |
| V-6 | OK: `5204290..714fdc7` は非空（10 files）、終点 = Implementation SHA |

## 3. Human 指定の確認事項

### V-1 Implementation SHA

- `git rev-parse` で worktree の HEAD = `714fdc748c86bac3f530ab7a7d1f2f2026e5f21e`。Handoff・Task file の記載と一致。**OK**

### V-2 WI-B1〜B4 が承認範囲内

`git diff --name-status 5204290 714fdc7` の結果は Plan §4 Files To Change の 9 ファイル + Task file（Status のみ）に一致。範囲外ファイルなし。

| WI | 確認 | 判定 |
| --- | --- | --- |
| WI-B1 | `src/core/dev-ui.js` に純関数 `devUiEnabled(search)`（state / DOM 非依存）。`concat-plugin.js` は import 1 行のみ。`01` で `const DEV_UI = devUiEnabled(location.search)` を 1 回評価。unit test 3 件 | OK（AP-B1） |
| WI-B2 | `index.html` の `.testmode-link-row` に `hidden`。`setupTestModeScreen()` で `DEV_UI` 時のみ `hidden = false`。`#open-testmode-btn` の click 先頭で `!DEV_UI` なら return。ボタンの文言・クラス・CSS は未変更 | OK（AP-B3） |
| WI-B3 | `toggleDebugMode()` 先頭に `if(!DEV_UI) return;` のみ。呼び出し側（`09-save-load.js:335`、`14-hud-boot.js:324`）は未変更 | OK（AP-B4） |
| WI-B4 | `openGame()` の既定を `/?dev=1` に、`character-motion.spec.js:215` の `goto` を `/?dev=1` に、`dev-ui-gate.spec.js` 新規 | OK（AP-B5 / AP-B6。V-8 参照） |

### V-3 通常 URL で 3 入口が閉じている

コード上の根拠:
- `state.testMode` の書き換えは `finishEnteringGame()` の 1 行のみで、`world:'training'` を渡すのは `beginTestMode()`（`14-hud-boot.js:1404`）だけ。`beginTestMode()` の呼び出しは `#testmode-start-btn`（テストモード画面内、`01:642`）だけ。テストモード画面を `flex` にするのは `#open-testmode-btn` の click（`01:582`）だけで、そこに `DEV_UI` ガードがある。
- `state.debugMode` を true にするのは `toggleDebugMode()` だけ（初期値 false、`state.js:186`。他は false にする経路のみ）。`toggleDebugMode()` の呼び出しは `` ` `` と 5 連打の 2 箇所で、関数先頭でガードされる。
- 非表示ボタンは CSS で `display` が上書きされない（`.testmode-link-row` は `text-align` / `margin-top` のみ、`[hidden]` の上書き規則なし）。ゲームパッドのメニュー移動は `offsetParent !== null` で非表示要素を除外する（`10-input.js:234`）。
- URL / 保存域以外の入口: `location.*` の使用は `devUiEnabled(location.search)` のみ。

Reviewer の再実行（本番ビルド `npm run build` → `vite preview`、base `/-ARPG-/`＝GitHub Pages と同じパス構成。Handoff の E2E とは別の Reviewer 自作スクリプト）:

| URL | 入口表示 | 直接 click で画面が開く | `` ` `` | 5 連打 | PERF / Motion | P（Visual Freeze） |
| --- | --- | --- | --- | --- | --- | --- |
| 通常（クエリなし） | なし | 開かない | 無反応 | 無反応 | 出ない | 無反応 |
| `?dev=true` / `?dev=01` / `?dev=0` / `?dev` | なし | 開かない | 無反応 | 無反応 | 出ない | 無反応（`?dev=true` で確認） |

（`` ` `` は導入の会話を閉じた後に確認。会話中にキーが無効なのは従来仕様 — `09-save-load.js:316` の `state.dialogueActive` ガード。）
**OK**

### V-4 `?dev=1` で従来どおり到達できる

- 上記スクリプト: `?dev=1` と `?x=1&dev=1` で入口表示・テストモード画面が開く・5 連打でデバッグモード ON。`?dev=1`（844×390）で `` ` `` → DEBUG バッジ / PERF / Motion Preview 表示、P で Visual Freeze ON。
- E2E（Reviewer 再実行、dev サーバ）: `dev-ui-gate.spec.js` の `?dev=1` テストで Arena ボタン表示・パネルが開く。既存の `combat-test-arena` 相当の経路は Implementer の全件実行で PASS。
**OK**

### V-5 永続保存していない

- 差分に `localStorage` / `sessionStorage` / cookie への書き込み追加なし（`localStorage.setItem` は既存の `SAVE_KEY` / `SETTINGS_KEY` の 2 箇所のみ）。
- スクリプト: 全 URL で localStorage のキーは `soulforge_save_v1, soulforge_settings_v1`（既存）のみ、sessionStorage は 0 件。同一コンテキストで `?dev=1` → 通常 URL と開き直すと入口は非表示。
**OK**

### V-6 承認範囲外の変更なし

- 差分に含まれない: UI-002-A で変更したコード（`08` / `10` / `11` / `12` / `14-hud-boot.js` の該当箇所）、`beginTestMode()` / `finishEnteringGame()` / `saveGame()` / `saveSettings()`、`14-training-ground.js`（Arena）、`updatePerfPanel()` / `updateMotionPanel()`、`#debug-badge` の制御、`05-rendering-rig.js`（Visual Freeze）、`src/styles/main.css`、manifest、vite / playwright 設定、workflows。
- `index.html` の差分は `hidden` 属性 1 箇所のみ。
- UI-002-A の E2E（`chapter1-legacy-ui.spec.js` 3 件）を `714fdc7` で再実行し PASS。
**OK**

### V-7 完全一致

- `new URLSearchParams(search || '').get('dev') === '1'`。unit test（Reviewer 再実行 PASS）で `dev=true` / `dev=01` / `dev=` / `dev` / `DEV=1` / `devx=1` / `dev=1 ` / `%201` / `#dev=1` が無効、`?x=2&dev=1` が有効。
- 同名キーが複数ある場合は最初の値で判定（`?dev=1&dev=0` → 有効）。コメントに明記されており、値そのものは `1` の完全一致のみで AP-B2 に反しない。
**OK**

### V-8 `openGame()` の変更

- 変更は URL の切り替えと `{ dev = true } = {}` 引数の追加のみ。既定値により既存の呼び出し（引数なし）は `/?dev=1` を開く。`{ dev:false }` を渡すのは新規 `dev-ui-gate.spec.js` だけ（`git grep` で確認）。
- 既存 spec の変更は `character-motion.spec.js` の `goto` 1 行のみ（Plan §3 WI-B4 に記載、`openGame()` を使わない唯一の遷移）。期待値・手順・検証内容の変更なし。
- 既存 spec のうち通常 URL での挙動に依存していたものは無い（開発用 UI を使わない spec も `?dev=1` 下で同じ動作。Reviewer 再実行で `save-load` 6 件・`settings` 1 件 PASS）。
- 引数の追加は Plan 本文（「URL を変える」）より一段広いが、AP-B5「`openGame()` の変更で一括して」の範囲内で、新規 spec が同じ helper で通常 URL を開くための最小の形と判断する。
**OK**

## 4. Reviewer の再実行（`714fdc7`、リポジトリ外 worktree）

| 対象 | 結果 |
| --- | --- |
| `npm run build` | PASS（`dist/index.html` に `class="testmode-link-row" hidden`） |
| `npm run test:unit` | 1530 PASS / 0 FAIL |
| E2E（Targeted 31 件）: `dev-ui-gate`(4) / `perf-diagnostic`(3) / `chapter1-legacy-ui`(3) / `character-motion`(14) / `save-load`(6) / `settings`(1) | **31 / 31 PASS** |
| 本番ビルド（`vite preview`、`/-ARPG-/`）での入口確認 | §3 V-3〜V-5 のとおり |
| E2E 全件 | 未実行（Implementer の全件結果 163 / 161 PASS / 2 FAIL を引き継ぐ） |

Playwright はリポジトリ外の設定でブラウザ実行パスのみ差し替え（`playwright.config.js` 未変更）。

## 5. テスト状態（WI 判定とは別。PASS として数えないもの）

| 区分 | 対象 | 扱い |
| --- | --- | --- |
| 既存 FAIL | `mansion-escort.spec.js`「非戦闘・停止中は Relaxed Stance」 | FAIL のまま（未解消、本変更の回帰ではない）。本レビューでは再実行していない |
| 既存 FAIL | `execution-break.spec.js`「通常敵: 体幹を削る → Break → EXECUTE …」 | FAIL のまま（Human Decision 2026-09-27 で既存 FAIL。変更前 `eadf993` でも 3/3 同じ理由で FAIL）。PASS / FLAKY に戻さない。本レビューでは再実行していない |
| FLAKY 記録 | `job-traits.spec.js` 鷹の目 Turn Assist | 今回の全件実行では PASS。過去の FLAKY 記録は保持 |
| NOT_RUN | GitHub Pages 本番 URL での実機確認（通常 URL / `?dev=1`） | **NOT_RUN のまま**。本レビューの `vite preview` による確認は本番ビルド・同じパス構成での代替確認であり、実機確認の代わりにはしない |
| NOT_RUN | 実ゲームパッドでの非表示ボタンへの到達不可 | コード（`gpNavItems()`）でのみ確認 |

## 6. 指摘事項

| # | 区分 | 内容 |
| --- | --- | --- |
| R-1 | 情報 | 通常 URL ではタイトルのカードの高さが縮み、中央寄せのため少し下に表示される（1280×800 / 844×390 のスクリーンショットで確認）。D-7 の非表示に伴う結果で CSS 変更はない。見た目の扱いは Human の確認対象 |
| R-2 | 情報 | `openGame()` の `{ dev }` 引数追加（§3 V-8）。承認範囲内と判断 |
| R-3 | 情報 | `?dev=1&dev=0` は有効（最初の値で判定）。AP-B2 には反しない |
| R-4 | 情報（範囲外） | `execution-break` の既存 FAIL。別 Task 候補（Task file の Out of Scope Found に記録済み） |
| 要修正 | — | なし |

## 7. 判定

| WI | 判定 |
| --- | --- |
| WI-B1 | **PASS** |
| WI-B2 | **PASS** |
| WI-B3 | **PASS** |
| WI-B4 | **PASS** |

**最終 Reviewer 判定: PASS**（Implementation SHA `714fdc748c86bac3f530ab7a7d1f2f2026e5f21e`）

- テスト状態: 既存 FAIL 2（mansion-escort / execution-break）、FLAKY 記録 1（job-traits、今回 PASS）、NOT_RUN（GitHub Pages 実機確認、実ゲームパッド）。いずれも PASS として数えていない。
- main への merge / push は行っていない。Implementation SHA は書き換えていない。
- Task file の Status は本レビューでは変更していない（`REVIEWING → DONE` と main への統合は Human の判断を待つ）。
- 同一セッション兼務のため、人間による差分確認を推奨する。
