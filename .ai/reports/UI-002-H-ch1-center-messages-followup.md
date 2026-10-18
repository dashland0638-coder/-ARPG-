# UI-002-H 追補 2 — 中央メッセージが実機で消えない問題の調査

Role: Analyzer → Planner → Implementer → Tester（このファイル）/ Reviewer（`UI-002-H-ch1-center-messages-followup-review.md`）
Base: `origin/main` `3d3f83e9ae5d622816747417806b9e21ce2d6b89`（PR #89 の squash merge）
Branch: `claude/chapter-1-comprehensive-audit-6cul2d`（PR #89 の merge 後に `origin/main` から作り直した）
依頼: Human「UI-002-H フォローアップ：中央メッセージが実機で消えない問題の根本調査」（2026-10-18）

## 1. 観測（Human の iPhone）

- 剣士、本編の「囚われの洋館・書斎」。
- 中央に「⤵️ 急降下!」と「💥 急降下斬り!」が出ている（落下攻撃の開始と着地のトースト）。
- 画面は Safari のアドレスバーが無い全画面。ホーム画面に追加したアプリ（`manifest.webmanifest` の `display: fullscreen`）として開いていると見られる（INFERENCE）。

## 2. 調査（FACT）

### 2.1 main のコードに、出ていた文言を出す経路が残っていないか

| 確認 | 結果 |
| --- | --- |
| リポジトリ全体の「急降下斬り」（`node_modules`・`.git` を除く） | 次の 4 ファイルだけ。どれも build に入らない<br>・`basefile.html`（凍結した移行前の単一ファイル版。build に入らない。§2.3）<br>・`.ai/` の記録 2 件<br>・unit テスト |
| 中央トーストの DOM（`.item-pop`）を作る関数 | 次の 2 つだけ。ほかに中央へ出す経路は無い<br>・`spawnToast`（`11-combat-actions.js`）<br>・拾得表示 `spawnPickupPopup`（`11` / `12`） |
| 連結の対象 | `concat-plugin.js` は `src/legacy/parts/*.js` だけを連結する。生成済みのファイルや別のコピーを読む経路は無い |
| 起動 | `index.html` → `src/main.js` → `virtual:legacy-core`（連結した parts） |
| 廃止した 16 件の呼び出し元 | PR #89 の差分で、呼び出しの行ごと消えている<br>・`tryUppercut` / `tryJumpAttack` / `landJumpAttack` / `groundFlyingEnemy` / 回避攻撃 / `swingOnce` / `triggerEnemyStep` / `applyStaggerResult` / `triggerKnockdown` / 処刑<br>・文言を ID やキーで引く通知キューは無い（`spawnToast(text)` へ文字列を直接渡す） |

**結論（FACT）**: main（`3d3f83e`）のソースには、「急降下!」「急降下斬り!」を出す経路が無い。

### 2.2 公開用のビルドに文言が残っていないか

- この環境で `3d3f83e` を `npm run build` した `dist/assets/index-*.js` に、「急降下斬り」「急降下!」は **0 件**。
- 残す通知（ジャストドッジ・パリィ成功・空中ではスキルを使えない等）は含まれていた。
- 比較のため `412ba03`（PR #89 の前）を同じ手順で build すると、「急降下斬り」が **1 件** 入っていた。
- 新しいテストで、同じ判定を自動化した（§4）。
  - 公開用のビルドを配信して実際に切り上げると、`412ba03` では中央に「🗡️ 切り上げ!」が出て FAIL する。
  - `3d3f83e` 以降では出ずに PASS する。

### 2.3 公開先

| 確認 | 結果 |
| --- | --- |
| `deploy.yml` | `main` への push で `npm ci` → `npm run build` → `dist` を Pages へ |
| PR #89 の後の deploy | run 184（id 39139420587）、`head_sha` `3d3f83e`、success（2026-10-18 15:12〜15:13 UTC）。成果物 `github-pages`（445,501 bytes） |
| 公開中のサイトの中身 | **未確認**。この環境のネットワークの設定で、次の 2 つに接続できない<br>・`dashland0638-coder.github.io`<br>・成果物のダウンロード先 |
| `basefile.html` | build の入口ではない（`vite.config.js` の入口は `index.html`）。Pages にも出ない（`dist` だけを上げる） |

### 2.4 PR #89 のテストの穴

- E2E は全件 `playwright.config.js` の webServer `npm run dev`（開発サーバー）で動いていた。
  - parts をその場で連結するので、ソースの変更は確かめていた。
  - 公開用のビルド（`npm run build` の minify 済み `dist`、`/-ARPG-/`）を開くテストは 1 件も無かった。
- unit はソースの文字列を見るだけで、成果物は見ていなかった。
- **実機で動いているビルドを見分ける手段が無かった。**
  - メニューの「ver」は `package.json` の `0.1.0` のまま、どのビルドでも同じ。
  - 古いビルドが動いていても、画面からは分からない。

### 2.5 原因の分類

| 候補 | 判定 | 根拠 |
| --- | --- | --- |
| 別の通知経路が残っている | 該当しない | §2.1。中央トーストの生成元は `spawnToast` だけで、16 件の呼び出しは消えている |
| 実行順・状態遷移で再生成 | 該当しない | 文言は呼び出し元に直接書かれていた。キューや再送の仕組みは無い |
| build・concat の対象外や順序 | 該当しない | §2.1 / §2.2。parts 以外の入口は無い。`3d3f83e` の build に文言が無い |
| 公開先が違う | 該当しない（ただし中身は未確認） | §2.3。deploy は `3d3f83e` を build して成功。公開中のファイルそのものは、ネットワークの制限で読めない |
| **実機が古いビルドを使い続けている** | **最も可能性が高い（INFERENCE）** | 次の 3 点から。ただし実機のキャッシュを直接は確認できない<br>・ソースにも成果物にも文言が無い<br>・実機の画面はホーム画面アプリの全画面<br>・実機で動いているビルドを見分ける手段が無かった（§2.4） |

- 仕組み（INFERENCE）:
  - iOS のホーム画面アプリ（standalone）は、アプリを完全に終了しない限り、前に読み込んだページ（`index.html` と、その中で指定された JS）を使い続ける。
  - `index.html` を読み直しても、HTTP キャッシュ（GitHub Pages は `Cache-Control: max-age=600`）の内側なら古いものが返る。
- Service Worker は無い（`serviceWorker` / `workbox` の登録は 0 件）。
- 「キャッシュだけが原因」とは断定しない。
  - 実機で動いているビルドを、§3 の build 表示で確かめるまでは未確認とする。

## 3. 対策（Planner / Implementer）

| WI | 内容 | ファイル |
| --- | --- | --- |
| F1 | 公開用のビルドを検証する E2E を追加する<br>・Playwright の webServer に `npm run build && vite preview --base /-ARPG-/`（ポート 4173）を足す<br>・`tests/production-build.spec.js` は `dist` を開き、次を確かめる<br>　- 実際の技（切り上げ・落下攻撃）と Break から、中央トーストまでの経路<br>　- 処刑ボタンの切り替え<br>　- 残す通知 | `playwright.config.js`、`tests/production-build.spec.js`、`tests/helpers.js`（`openGame` に `base`） |
| F2 | 成果物に廃止した文言が無く、残す文言があることを unit で見る<br>・CI は unit の前に build するので、必ず `dist` を見る<br>・手元で `dist` が無い時だけ skip する | `tests/unit/production-bundle.test.js` |
| F3 | 動いているビルドを見分けられるようにする<br>・build 時の commit（`GITHUB_SHA` の先頭 7 文字。手元では `git rev-parse`）を JS に埋め込む<br>・メニューの表記を `ver 0.1.0 (3d3f83e)` にする<br>・`dist/version.json` に同じ値を出す | `vite.config.js`、`src/core/build-check.js`、`14-hud-boot.js`、`concat-plugin.js`（import 1 行） |
| F4 | 古いビルドを検知したら読み直す<br>・起動時に `version.json` をキャッシュを使わずに読む<br>・JS の build と違えば、タイトル画面のうちに 1 回だけ `location.reload()` する<br>・同じ build への読み直しは 1 セッションに 1 回（`sessionStorage`。セーブには入らない）<br>・プレイ中・開発サーバー・読めない時は何もしない | 同上 |

- 変えていないもの:
  - 戦闘・通知の処理（PR #89 のまま）
  - 処刑の条件・ダメージ・Break
  - 残す通知
  - セーブの形式
  - `basefile.html`
  - `deploy.yml`（設定は変えていない）
- 処刑ボタン（処刑できる間は「処刑」、閉じたら「攻撃」、押しっぱなしからは処刑しない）は PR #89 のまま。公開用のビルドでも E2E で確かめた（§4）。

## 4. テスト結果

| 種類 | 結果 |
| --- | --- |
| build | 成功。`dist/version.json` = `{"build":"<commit>"}` |
| unit（`npm run test:unit`） | 1873 件: pass 1872 / fail 0 / skipped 1（既存） |
| 新規 E2E `production-build.spec.js`（公開用のビルド） | 4 / 4 passed（1.2 分） |
| 同じ E2E を修正前のビルド（`412ba03`）に向けた | **FAIL**（中央に「🗡️ 切り上げ!」）。テストが修正前の表示を検出できることの確認 |
| E2E 全件 | §4.1 |

### 4.1 E2E 全件

（実行後に記入）

## 5. Human に実機で確かめてほしいこと（HUMAN DEVICE CHECK REQUIRED・未確認）

1. この PR を merge して deploy が終わってから、iPhone のホーム画面アプリを完全に終了する（アプリ切り替え画面で上へスワイプ）。それから開き直す。
   - Safari で開いている場合は、タブを閉じて開き直す。
2. メニュー（☰）の下端の版の表記が `ver 0.1.0 (xxxxxxx)` で、括弧の中が GitHub の main の最新 commit の先頭 7 文字と同じことを確かめる。
   - 括弧が無い、または違う commit なら、古いビルドが動いている。
3. 戦闘で、落下攻撃・切り上げ・回避攻撃・敵を踏む・敵を崩す・処刑をする。中央に技名・ダウン・処刑の技名が出ないことを確かめる。
4. 敵を崩すと攻撃ボタンが「処刑」に変わり、窓が閉じると「攻撃」に戻ることを確かめる。
5. ボスの段階変化・大技の予兆・状態異常・パリィ・ジャストドッジの通知は、今までどおり中央に出ることを確かめる。
6. 次の更新の後は、アプリを開き直すだけで（タイトル画面で 1 回読み直されて）新しいビルドになることを確かめる。

## 6. 廃止・維持の一覧

PR #89 の `UI-002-H-ch1-center-messages.md` §2.2 から変更なし（廃止 16 件・維持の分類とも同じ）。
