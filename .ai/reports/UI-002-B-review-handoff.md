# UI-002-B Review Handoff（WI-B1〜WI-B4）

作成: Implementer / 2026-09-27 / Claude Code セッション（UI-001 以降と同一セッション）。**Reviewer の判定はまだ行っていない。**

## 1. Review Handoff（AGENTS.md §5.1）

| 項目 | 値 |
| --- | --- |
| Task ID | UI-002-B / WI-B1, WI-B2, WI-B3, WI-B4 |
| Branch | `claude/ui-002-b-impl` |
| Implementation SHA | `714fdc748c86bac3f530ab7a7d1f2f2026e5f21e`（**レビュー対象の固定実装**。以降の commit は `.ai/` の文書のみ） |
| Diff range | `520429026e9096cd84fca18a5661d2351ee34aaa..714fdc748c86bac3f530ab7a7d1f2f2026e5f21e`（起点 = Human Approval 記録 commit） |
| Task file | `.ai/tasks/UI-002-B.md`（承認内容は Implementation SHA 時点、Implementation Result は `cfa41ac` 以降の版） |
| Analysis | `.ai/reports/UI-002-B-analysis.md`（`claude/ui-002-b-analysis` @ `7595db4b04de8c4df13e908e6a5ec74fac545ce2`、blob `7dbd9e719647abed190b2190dbee884f019037d3`。`714fdc7` 時点の blob も同一） |
| Plan | `.ai/reports/UI-002-B-plan.md`（`claude/ui-002-b-planner` @ `88fe3ef760b7ba662904616bf13555441d6c1369`、`714fdc7` 時点の blob `e63aeac894387e9b7cf403cdabdd2f84126dc24b`） |
| Decision record | `.ai/decisions/UI-002-human-decisions.md`（HD-3、HD-4、UI-002-B D-1〜D-7・追加方針、Planner 承認、テスト結果の扱い） |
| main | `origin/main` = `eadf993e9e6c972a53823030c96da207d56f1344`（未変更） |

Implementer 側の前提確認（Reviewer は再検証すること）: `7595db4` / `88fe3ef` は `714fdc7` の祖先 / `714fdc7` は `origin/claude/ui-002-b-impl` から到達可能 / Diff range は非空（10 files）。

## 2. Work Items と承認内容

| WI | 内容 | Approval |
| --- | --- | --- |
| WI-B1 | `?dev=1` 判定（`src/core/dev-ui.js`、起動時 1 回） | APPROVED |
| WI-B2 | タイトルのテストモード入口を `?dev=1` 時のみ表示・有効 | APPROVED |
| WI-B3 | デバッグモード入口（`` ` `` / バージョン 5 連打）を `?dev=1` 時のみ有効 | APPROVED |
| WI-B4 | E2E の入口を `?dev=1` に、分離の検証テスト追加 | APPROVED |

AP-B1〜AP-B7（Human Approval 2026-09-27、全承認）:

- AP-B1: `src/core/dev-ui.js` を新規作成し、`?dev=1` の判定を独立関数として実装。unit test 可能。`concat-plugin.js` の import 追加 1 行を許可。
- AP-B2: `dev=1` の完全一致のみ有効。`?dev=true`、`?dev=01`、その他の値は無効。
- AP-B3: タイトルの「🛠 テストモード」ボタンは HTML で初期非表示。`?dev=1` の場合だけ表示。起動時の一瞬表示も避ける。
- AP-B4: `toggleDebugMode()` を門番とし、関数先頭で `?dev=1` でなければ何もしない。`` ` `` とバージョン 5 連打の呼び出し側は変更しない。
- AP-B5: 既存 E2E の開発モード起動は共通の `openGame()` の変更で一括して `/?dev=1` にする。個々の spec を不必要に変更しない。
- AP-B6: `tests/dev-ui-gate.spec.js` を新規追加し、通常 URL では開発用入口が利用できず、`?dev=1` では従来どおり到達できることを検証。DOM の存在だけを見るテストにしない。
- AP-B7: 実装ブランチ `claude/ui-002-b-impl`。commit / push 許可。

## 3. 変更ファイル（`5204290..714fdc7`）

| ファイル | 区分 | WI | 内容 |
| --- | --- | --- | --- |
| `src/core/dev-ui.js`（新規） | source | B1 | `devUiEnabled(search)` = `new URLSearchParams(search \|\| '').get('dev') === '1'` |
| `src/legacy/concat-plugin.js` | source | B1 | HEADER に `import { devUiEnabled } from '../core/dev-ui.js';` 1 行 |
| `src/legacy/parts/01-character-creation.js` | source | B1 / B2 | `const DEV_UI = devUiEnabled(location.search);`、`setupTestModeScreen()` で `DEV_UI` 時のみ `.testmode-link-row.hidden = false`、`#open-testmode-btn` click 先頭 `if(!DEV_UI) return;` |
| `src/legacy/parts/02-world-common.js` | source | B3 | `toggleDebugMode()` 先頭 `if(!DEV_UI) return;` |
| `index.html` | source | B2 | `<div class="testmode-link-row" hidden>` |
| `tests/unit/dev-ui.test.js`（新規） | test | B1 | 3 テスト |
| `tests/helpers.js` | test | B4 | `openGame(page, { dev = true } = {})`、`page.goto(dev ? '/?dev=1' : '/')`、説明コメント |
| `tests/character-motion.spec.js` | test | B4 | `page.goto('/')` → `page.goto('/?dev=1')`（1 行、Plan §3 WI-B4 記載） |
| `tests/dev-ui-gate.spec.js`（新規） | test | B4 | 4 テスト |
| `.ai/tasks/UI-002-B.md` | 文書 | — | Status / Status History |

Source scope: 上記 source 5 ファイルのみ。変更していないもの: `09-save-load.js`（`` ` `` 呼び出し側・`saveGame()`・設定保存）、`14-hud-boot.js`（バージョン 5 連打・`beginTestMode()`・`finishEnteringGame()`・PERF / Motion Preview）、`14-training-ground.js`（Arena）、`05-rendering-rig.js`（Visual Freeze）、`10-input.js`、`13-update-loop.js`、UI-002-A で変更したコード、`src/styles/main.css`、`public/manifest.webmanifest`、`vite.config.js`、`playwright.config.js`、`.github/workflows/*`、上記以外の spec。

補足: `openGame()` に `{ dev }` 引数（既定 true）を追加したのは、新規 gate spec が同じ helper で通常 URL を開くため。既存の呼び出し（引数なし）は `/?dev=1` を開き、既存 spec の検証内容・期待値は変更していない。

## 4. Test Report（PASS / 既存 FAIL / FLAKY / NOT_RUN を区別）

| 区分 | 結果 |
| --- | --- |
| Build（`npm run build`） | **PASS**（`dist/index.html` に `class="testmode-link-row" hidden`） |
| Unit（`npm run test:unit`） | **1530 PASS / 0 FAIL**（新規 `dev-ui.test.js` 3 件を含む） |
| E2E 全件（163 件、1 worker、1.7h） | **163 total / 161 PASS / 2 FAIL** |
| 新規 `tests/dev-ui-gate.spec.js` | **4 PASS**（変更前コードでは 4 件中 3 件 FAIL、`?dev=1` の 1 件は PASS — 既存の開発用 UI の挙動確認） |

FAIL 2 件（PASS として数えない）:

| テスト | 結果 | 扱い |
| --- | --- | --- |
| `mansion-escort.spec.js`「非戦闘・停止中は Relaxed Stance」 | 全件 FAIL / 単独再実行 FAIL（relax 0.88、期待 > 0.9） | **既存 FAIL**（UI-002-A で変更前コードでも再現を確認済み。未解消） |
| `execution-break.spec.js`「通常敵: 体幹を削る → Break → EXECUTE …」 | 全件 FAIL / 単独再実行 FAIL（「Execution で通常攻撃の型が再生されている」）。変更前 `eadf993` でも `--repeat-each=3` で 3/3 同じ理由で FAIL | **既存 FAIL**（Human Decision 2026-09-27。PASS / FLAKY に戻さない。修正は範囲外・別 Task 候補） |

- `job-traits.spec.js` 鷹の目 Turn Assist: 今回の全件実行では PASS。**過去の FLAKY 記録は保持**する。
- NOT_RUN: **GitHub Pages 本番 URL での実機確認**（通常 URL / `?dev=1`）。この環境では実施できない。main 反映後に Human が確認する（D-2）。

スクリーンショット（HD-4、タイトル画面、dev サーバ、Chromium headless）:

| サイズ | 通常 URL | `?dev=1` |
| --- | --- | --- |
| 1280×800 | 取得。テストモード入口なし（`isVisible` = false） | 取得。入口あり（`isVisible` = true、従来と同じ見た目・位置） |
| 844×390 | 取得。入口なし（false） | 取得。入口あり（true） |

- 観察: 通常 URL では入口の行が無くなる分タイトルのカードの高さが縮み、中央寄せのため少し下に表示される。CSS は変更していない（D-7 の非表示に伴う結果）。
- 画像はリポジトリに含めていない（セッションの scratchpad に保存し、Human へ送付済み）。

Playwright 実行環境: リポジトリ外の設定でブラウザ実行パス（と出力先）のみ差し替え。`playwright.config.js` は未変更。

## 5. 状態

- Working tree: clean（本 Handoff の commit 後）
- main: 未変更（`eadf993`）。main への merge / push は行っていない

## 6. Reviewer への確認依頼（Human 指定）

| # | 確認 |
| --- | --- |
| V-1 | Implementation SHA が `714fdc748c86bac3f530ab7a7d1f2f2026e5f21e` と一致すること |
| V-2 | WI-B1〜B4 が承認済み範囲内で実装されていること |
| V-3 | 通常 URL から 3 つの開発入口（タイトルの「🛠 テストモード」/ `` ` `` キー / バージョン表記 5 回連打）が閉じていること |
| V-4 | `?dev=1` では従来どおり開発 UI へ到達できること |
| V-5 | `?dev=1` の状態を localStorage 等へ永続保存していないこと |
| V-6 | UI-002-A、Test Mode 本体、Arena、PERF、Motion Preview、DEBUG バッジ、CSS、セーブ / 設定仕様など承認範囲外に変更がないこと |
| V-7 | `dev=1` 判定が完全一致であること |
| V-8 | E2E の `openGame()` 変更が Planner 承認範囲内であり、既存テストの意味を不必要に変更していないこと |

## 7. 禁止事項（以降の工程）

- main への merge / push をしない
- Implementation SHA `714fdc7` を変更しない
- 既存 FAIL（mansion-escort / execution-break）を PASS / FLAKY 扱いしない
- GitHub Pages 実機確認を NOT_RUN 以外にしない
