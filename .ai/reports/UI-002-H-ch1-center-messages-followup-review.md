# UI-002-H 追補 2 — Reviewer レポート（Round 1）

Role: Reviewer（独立）
Branch: `claude/chapter-1-comprehensive-audit-6cul2d`
Base: `origin/main` `3d3f83e9ae5d622816747417806b9e21ce2d6b89`
Head（検証済み・`git rev-parse HEAD`）: `fd1b59b2abc832a96655dedcfdcb30747495c3d5`
対象: `git diff 3d3f83e..HEAD`（12 ファイル）。記録: `.ai/reports/UI-002-H-ch1-center-messages-followup.md`、`.ai/tasks/UI-002-H.md`（追補 2）

## 判定: **CHANGES REQUIRED**

blocking 2 件（#1 読み直しの無限ループ、#2 `scripts/ui-screens` の設定が壊れる）。どちらも修正は小さい。原因の調査と分類は概ね誠実で、再発防止の方向性（公開用ビルドの E2E・dist の unit・build 表示）は妥当。

## Reviewer が自分で確かめたこと

| 確認 | 結果 |
| --- | --- |
| `npm run build` | 成功。`dist/` = `assets/`・`icons/`・`index.html`・`manifest.webmanifest`・`version.json`（`{"build":"fd1b59b"}`）。`basefile.html` は dist に無い |
| `npm run test:unit` | 1873 件: pass 1872 / fail 0 / skipped 1（既存の SVG catalog の skip）。新規 `production-bundle` / `build-check` は pass |
| dist の文言（廃止 16 件 + `⤵`） | 「急降下」「急所突き」「落下呪撃」「撃ち落とした」「エネミーステップ」「瞬閃」「疾風・三ノ矢」「影踏み突き」「体勢を崩した」「畳み掛けろ」「ダウン!」「⤵」すべて 0 件 |
| dist に残る近い語 | 「切り上げ」（撤退ダイアログの「探索を切り上げて」・テストモード専用のデバッグ表示）、「回避攻撃」「フィニッシュ」（装備・スキルの説明文）、「百矢の雨」（技名定義）、「断ち斬り」（`execution.js` の label → `emitArenaFeedback` だけ。`state.testMode` 以外では何も出さない）。中央トーストへ渡る経路は無い |
| ソースの残り | 「急降下」等は `11-combat-actions.js` / `07-ai-combat.js` / `core/uppercut.js` のコメントだけ |
| 中央に出る DOM | `spawnToast`（`.item-pop.is-toast`）、`spawnPickupPopup`、`spawnLevelUpPopup`（`12-progression-ui.js:2011`。Lv アップのみ）。`emitArenaFeedback` はテストモード専用のログ |
| Service Worker | 登録 0 件。`public/` は `icons/` と `manifest.webmanifest`（`start_url: ./`、`scope: ./`）だけ |
| deploy | `deploy.yml` は `npm run build` → `upload-pages-artifact path: dist`。dist 以外は公開されない |
| `index.html` | build 後は `/-ARPG-/assets/index-*.js` 1 本だけを読む。ほかの JS を参照しない |
| `openGame` 既存呼び出し | 既定 `base='/'` で `'/?dev=1'` / `'/'` と従来と同一。`{dev:false}` の 6 箇所も同じ URL |
| `#menu-version` を見る既存 E2E | すべて開発サーバー（build `'dev'`）なので表記は `ver 0.1.0` のまま変わらない |

結論: 現行ソース・dist に廃止したトーストを出す経路は無い（Implementer の FACT 主張を独立に再現）。本編（洋館）専用の別経路、`basefile.html` の公開、`public/` 由来のファイルも該当しない。

## 指摘

### #1【blocking】sessionStorage が使えない環境で、タイトル画面の読み直しが無限ループする

- 場所: `src/legacy/parts/14-hud-boot.js:328-332`
- `getItem` / `setItem` の例外を握りつぶしたまま `location.reload()` する。sessionStorage が例外を投げる環境（Safari の「すべての Cookie をブロック」、一部のプライベート・埋め込み WebView）では、`reloadedFor` が毎回 `null` になる。
- シナリオ: そうした端末で、`version.json` は新しいのに、読み直しても古い `index.html` / JS が返る（この PR が想定する原因そのもの。Pages の `max-age=600` や CDN の反映遅れ）。起動のたびに build が違う → reload → 同じ … と、少なくともキャッシュが切れるまでタイトルで読み直し続け、遊べなくなる。
- セーブ（`09-save-load.js`）は localStorage の例外を try/catch で受けて動き続けるので、「storage が使えない端末ではそもそも起動しない」とは言えない。
- 修正案: `setItem` の後に `getItem` で書けたことを確かめ、書けなければ読み直さない（`buildCheckAction` に `canRemember` 等を渡して unit で固定する）。または URL のクエリ（例 `?b=<remote>`）に読み直し済みを載せる。

### #2【blocking】`scripts/ui-screens/playwright.config.mjs` の webServer が壊れる

- 場所: `scripts/ui-screens/playwright.config.mjs:20`（`webServer: { ...base.webServer, cwd: '../..' }`）
- `base.webServer` が配列になったので、オブジェクトへ展開すると `{0:{…},1:{…},cwd}` になり、`command` が無い。UI 撮影ツール（`UI_SCREENS_LABEL=… npx playwright test -c scripts/ui-screens/playwright.config.mjs`）が起動できない。
- `tools/baseline/playwright.config.js` は `[].concat(base.webServer)[0]` で直したが、同じ形のもう 1 つが漏れている。CI では使わないが、この PR による退行。
- 修正案: baseline と同じく `{ ...[].concat(base.webServer)[0], cwd: '../..' }`。

### #3【non-blocking】起動時しか確かめないので、iOS standalone の「再開」では効かない

- 場所: `14-hud-boot.js:296`（`bindSettings` 内で 1 回だけ）
- レポート §2.5 は「standalone はアプリを完全に終了しない限り前のページを使い続ける」と書く。それなら、バックグラウンドからの復帰では `checkForNewerBuild` は走らない。
- §5 手順 6 の「アプリを開き直すだけで（タイトル画面で 1 回読み直されて）新しいビルドになる」は、「完全に終了してから開き直す」場合に限られる。表現を直す。必要なら、タイトル表示中の `visibilitychange`（visible）でも確認する案がある。
- `location.reload()` が standalone で `index.html` をネットワークから取り直すかは未検証。#1 の歯止めがあれば害は無いが、効くかどうかは HUMAN DEVICE CHECK の対象として明記する。

### #4【non-blocking】レポートの小さな不正確さ・未記入

- §2.1「`.item-pop` を作る関数は `spawnToast` と `spawnPickupPopup` の 2 つだけ」は誤り。`spawnLevelUpPopup`（`12-progression-ui.js:2011`）もある。結論は変わらないが、事実の表なので直す。
- §4.1「（実行後に記入）」が未記入。PR 作成前に、E2E 全件の結果（件数・所要・flaky）を記入する。
- 原因の候補に「deploy の完了前（run 184 は 15:12〜15:13 UTC）、または完了後 10 分以内（`max-age=600`）に見た」の時間の可能性も INFERENCE として並べるとよい。観測時刻が分からないので、どちらも「古い build が動いていた」の一種ではある。

### #5【non-blocking】build id の形式と、手元の preview の再利用

- `vite.config.js:10`: `git rev-parse --short=7` は、短縮が曖昧なとき 8 文字以上を返す。`production-bundle.test.js` と `production-build.spec.js` の `/^[0-9a-f]{7}$/` が手元でまれに落ちる。`.slice(0,7)` で揃えるか、正規表現を `{7,}` にする。
- `playwright.config.js` の 2 つ目の webServer は、CI 以外では `reuseExistingServer: true`。4173 で古い `vite preview` が残っていると、古い dist を検証してしまう（今回の問題と同じ型）。コメントで注意を書くか、手元でも再利用しない設定にする。CI（`CI=true`）では毎回 build するので問題ない。
- `test.yml` は unit の前に build し、E2E の webServer でもう一度 build する（+10 秒程度）。許容範囲。
- PR の CI では `GITHUB_SHA` が merge commit になり、表記は head と一致しない。version.json と JS は同じ値なのでテストは通る。記録に一言あるとよい。

## 観点別の所見

1. **経路の独立検証**: 上表のとおり、Implementer の主張を再現した。本編・洋館だけの経路、`basefile.html`、`public/`、`index.html` の別参照は該当しない。deploy は dist だけを公開する。
2. **FACT / INFERENCE の区別**: 概ね誠実。公開中のサイトと成果物が未確認なこと、キャッシュの仕組みが INFERENCE なことを明記し、「キャッシュだけが原因とは断定しない」としている。過大な主張は #4 の表の誤り程度。
3. **初回修正が漏れた理由**: 「コードの削除は正しかったが、検証が開発サーバーだけで、公開物と実機の build を見る手段が無かった」という分析は妥当。再発防止は次のとおり。
   - 公開用ビルドの E2E（412ba03 で FAIL を確認済み）と dist の unit スキャンは、「公開物に残っている」型の再発を CI で止められる。十分。
   - build 表示は、実機の切り分けに有効。十分。
   - version 確認の読み直しは、プレイ中は読み直さない（`state.started`）、開発サーバーでは動かない（`'dev'`）、`version.json` の相対パス（`/-ARPG-/` 配下で正しく解決）、`no-store` + クエリと、安全側に作られている。ただし #1 の歯止めの穴と、#3 の効く範囲の限定がある。
   - セーブ消失の心配: 読み直しはタイトル画面でだけ行い、セーブは localStorage のままなので失わない。`sessionStorage` のキーはセーブに入らない。
4. **ゲーム挙動の不変**: 戦闘・通知・残す通知の一覧・処刑ボタン・セーブ形式・`basefile.html` は差分に無い。変わったのはメニューのバージョン表記（build 版だけ）と起動時の確認だけ。`helpers.js` の `openGame` 変更は既存の呼び出しと互換。
5. **記録**: 実機確認は「HUMAN DEVICE CHECK REQUIRED・未確認」と明記しており、実施済みとは書いていない。task 表の状態 `IMPLEMENTED` も妥当。#3・#4 の修正だけ必要。

## Implementer への差し戻し（Round 2 で確かめること）

- [ ] #1: storage に書けないときは読み直さない（unit で固定）
- [ ] #2: `scripts/ui-screens/playwright.config.mjs` の webServer を 1 つ目の要素にする
- [ ] #3・#4: レポート §2.1・§4.1・§5 手順 6 の修正（visibilitychange の追加は任意）
- [ ] #5: 任意

---

# Round 2

Head（検証済み・`git rev-parse HEAD`）: `a47ac5b175337fa1ad62b8fc8ae39f53440cf49b`
対象: `git diff fd1b59b..a47ac5b`（9 ファイル）

## 判定: **PASS WITH NOTES**

Round 1 の blocking 2 件は解消した。新しい blocking は無い。

## Reviewer が自分で確かめたこと

| 確認 | 結果 |
| --- | --- |
| `npm run test:unit` | pass 1874 / fail 0 / skipped 1（既存） |
| `npm run build` | 成功。`dist/version.json` = `{"build":"a47ac5b"}`（7 文字） |
| Playwright | 実行していない（全件の実行中のため。指示どおり） |

## Round 1 の指摘の確認

| # | 判定 | 確認した内容 |
| --- | --- | --- |
| 1 | 解消 | 読み直しの印を URL の `?build=<remote>` に移した（`build-check.js` の `reloadMarker` / `reloadUrl`、`14-hud-boot.js` の `location.replace`）。storage を使わないので、sessionStorage が例外を投げても 2 回目の起動で `reloadedFor === remote` になって止まる。<br>・unit で固定した: 印の往復、`?dev=1` と `#` を残す、古い印の上書き<br>・E2E: sessionStorage の getter が例外を投げる状態で、遷移はちょうど 2 回、2 回目が `?build=fffffff`。Implementer の報告では pass。私は実行していない<br>・印付きの URL は HTTP キャッシュのキーも別になるので、古い `index.html` が返る心配も減る<br>・ほかの検索条件の読み手（`dev-ui.js` の `dev` / `uiproto`）は `build` を見ないので影響しない |
| 2 | 解消 | `scripts/ui-screens/playwright.config.mjs:20` が `[].concat(base.webServer)[0]` になった |
| 3 | 解消 | タイトル画面（`!state.started`）で `visibilitychange` → visible の時も確かめる。30 秒に 1 回まで。開発サーバー（`'dev'`）では先頭で戻る。§5 手順 6 を書き直し、standalone で新しい `index.html` を取りに行くかは未確認と明記した |
| 4 | 解消（§4.1 は全件の実行後に記入予定） | §2.1 に `spawnLevelUpPopup` を足した。INFERENCE 2 件（deploy の前、キャッシュの内側）を足した。§4.0 を足した |
| 5 | 解消 | `git rev-parse HEAD` の先頭 7 文字（`.slice(0,7)`）にした。4173 の再利用と `GITHUB_SHA` の注記は §4.0 にある |

## 注記（non-blocking）

- N1: `returnToTitle`（`10-input.js:421`）は `state.started = false` にする。なので、プレイ後にタイトルへ戻り、アプリを切り替えて戻ると、新しい build があれば読み直す。タイトルではプレイ中の状態は残っておらず、セーブ（localStorage）は消えないので、害は無い。変化があるのは、タイトルのサブ画面（設定・テストモードの職業選択など）の開閉状態が戻ることだけ。
- N2: Safari のタブで印付きの URL（`?build=X`）をブックマークした場合、`X` と同じ build が公開されている間は読み直さない。動いている build も `X` のはずなので実害は無い。違う build が出れば印と一致しないので、また 1 回読み直す。
- N3: §4.1（E2E 全件）は、PR 作成までに記入すること。記入した件数と、ほかの run の結果に矛盾が無いかは Orchestrator が確かめる。
- N4: 実機確認（§5）は未実施のまま。記録の書き方（HUMAN DEVICE CHECK REQUIRED・未確認）は正確。
