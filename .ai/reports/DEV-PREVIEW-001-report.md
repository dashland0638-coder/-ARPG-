# DEV-PREVIEW-001 — PR ごとの実機確認プレビュー

**状態: IMPLEMENTED（main への merge で有効になる）**。main への merge は Human の判断。

## 1. 現状の調査（Analyzer）

| 項目 | 現状（main `eb3084b`） |
| --- | --- |
| 公開 | `.github/workflows/deploy.yml`: main への push で `npm run build` → `upload-pages-artifact` → `deploy-pages`（Pages の公開元は「GitHub Actions」）。**公開のたびにサイト全体を置き換える** |
| 公開の URL | `https://dashland0638-coder.github.io/-ARPG-/`（プロジェクトサイト。origin は `dashland0638-coder.github.io`） |
| テスト | `.github/workflows/test.yml`: `pull_request` でビルド・unit・E2E（権限は読むだけ）。失敗時だけ結果を 7 日保存 |
| Vite | `base` は build の時だけ `/-ARPG-/`（`vite.config.js`）。アセットは絶対パス `/-ARPG-/assets/...`。版表記と `version.json` に commit の 7 桁（起動時に `version.json` を見て古ければ 1 回だけ読み直す） |
| クエリ | `?dev=1` がテストモードの入口の門番（`core/dev-ui.js`）。`?dev=1&app=test` はテスト専用アプリ |
| 保存 | `localStorage` のキーは 2 つだけ（`soulforge_save_v1`・`soulforge_settings_v1`、`09-save-load.js`）。Service Worker・IndexedDB は無い |
| リポジトリ | public。fork からの PR があり得る。secrets は使っていない |
| 規約 | `.ai/AGENTS.md` §20・§21: Agent は main へ merge しない。PR 本文の必須項目はあるが、実機確認の入口は無かった |

**問題**: 公開版は main だけ。PR のコードを実機で開く手段が無く、公開版（main）と PR のコードを取り違えやすい（TEST-MODE-CURRENT-002 の調査で実際に起きた可能性が高い）。

## 2. 方式の選択（Planner）

| 案 | 判断 |
| --- | --- |
| **A. GitHub Pages の同じサイトの下に PR ごとのプレビュー（`/-ARPG-/pr/<N>/`）** | **採用**。外部サービス・secrets が要らない。iPhone のブラウザでそのまま開ける。Pages はサイト全体を置き換えるので、main と開いている PR のプレビューを毎回まとめて公開する。PR のコードは PR 側のワークフロー（読むだけ）で組み、公開側は成果物をデータとして載せる |
| B. Actions の成果物（zip） | 代わりの手段として併用（PR Preview の成果物 `preview-pr-<N>`）。iPhone では zip を開いてもブラウザで動かせないので主にはしない |
| C. 別のリポジトリの Pages | token（secrets）と新しいリポジトリが要る。origin も同じ（`<owner>.github.io`）で分離にならない |
| D. 外部サービス（Netlify 等） | アカウント・token・課金の判断が要る（Human の判断）。今回は使わない |

## 3. 実装（Implementer）

独立レビュー Round 1（§7）の指摘で、**PR のコードを組む所と公開する所を別のワークフローに分けた**（Round 1 の時点では 1 つの `pull_request_target` のワークフローの中で PR のコードを組んでいた）。

### 組む（`.github/workflows/preview.yml`「PR Preview」、新規）
- きっかけ: `pull_request`（opened・reopened・synchronize）。PR のコードを**読むだけの権限・secrets 無し**で動かす（`test.yml` と同じ扱い）。fork の PR は組まない
- PR の最新 commit を取り出し、`vite build --base /-ARPG-/pr/<N>/`（`PREVIEW_PR`・`PREVIEW_SHA` を埋め込む）→ 検査（`verify-preview-site.mjs --preview`）→ 同じコードで main 相当も組んで Pages と同じ形のサイトにして検査 → 成果物 `preview-pr-<N>`（30 日保存）
- 同じ PR へ続けて push したら古い実行は取り消す（`concurrency: preview-<N>`）
- `pull_request` は PR と main を合わせたワークフローで動くので、この仕組みより前に作ったブランチでも動く。最初の手順「Requires main」でそのブランチのコードにプレビューの仕組み（`dev-preview.js`・セーブのキー分け）があるかを見て、無ければ止める → 公開側は「main を取り込んでください」のページ（状態 `none`）

### 公開（`.github/workflows/deploy.yml` を書き換え）
- きっかけ: main への push（今まで通り）／PR Preview の完了（`workflow_run`）／PR を閉じた（`pull_request_target` の closed）／手動。**どれも PR のコードを動かさない**
- `assemble`（`contents`・`actions`・`pull-requests` を読むだけ）:
  1. main（既定のブランチ）を取り出して組む（版表記は取り出した commit）
  2. `scripts/collect-previews.cjs`（github-script）: 開いている**同じリポジトリの** PR の一覧と最新 commit を API から取り、**その最新 commit で走った PR Preview の実行**だけを見る（同じリポジトリから・`pull_request`・その PR の実行）。状態を `ok`（成果物あり）／`building`（組んでいる最中）／`failed`（失敗・成果物なし・期限切れ・大きすぎる）／`none`（PR Preview が走っていない、または「Requires main」で止まった＝main を取り込んでいない）に分け、`ok` の成果物の zip を取る。新しい順に最大 20 件（きっかけの PR は必ず入れる）。**この手順が失敗しても main の公開は続ける**（`continue-on-error`）
  3. `scripts/assemble-pages.mjs`: 成果物を**データとして**展開（Python の zipfile。`..`・絶対パスは取り除き、リンクは作らない。展開後 1 つ 100MB・合計 500MB を超えるものは展開しない）→ 検査（アセットが `/-ARPG-/pr/<N>/` を指す・ファイルがある・PR の commit とセーブのキー分けが入っている・リンクが無い）→ 通ったものだけを `pr/<N>/` に置く。それ以外は理由のページ（古いプレビューは残さない）。`pr/<N>/preview.json`（commit・状態・理由・実行結果）と一覧 `pr/index.html`。ジョブの Summary に表
- `deploy`（`pages: write`・`id-token: write` はここだけ。checkout・run 無し）: `deploy-pages`
- `comment`（`pull-requests: write`・main の `scripts` だけを取り出す）: `scripts/preview-comments.cjs`。**公開したすべての PR** に「🔍 テスト版を開く」のコメントを 1 つずつ置いて今の状態に合わせる（待っている間に置き換わった実行のきっかけの PR にも届く。状態＝commit・状態・公開の確認が同じなら書き換えない。仕組みの無いブランチには新しく書かない。Bot のコメントだけを探す）。URL は公開した `page_url` から作り、**公開された `preview.json` の commit が一致するかを確かめて**書く（まとめて最大 90 秒。一致しなければ「まだ反映を確かめられていません」）。使えない時は理由（組んでいる最中・失敗・main の取り込み・公開の失敗）。きっかけの PR はイベントから直接取る（成果物を集める手順が失敗しても知らせる）。PR を閉じたら「外しました」に書き換える
- 順番: `concurrency: pages`・**`cancel-in-progress: false`**（走っている公開は取り消さない。待っている実行は GitHub が最新の 1 つだけ残す）。どの実行もその時点のすべての PR の最新の状態を組むので、古い状態で上書きしない。fork の PR がきっかけの実行は別の group にして何もしない（待っている公開を押し出さない）

### 確認（`test.yml`）
- 変更なし（Round 1 で足した `preview-site` は `preview.yml` へ移した）

### アプリ（プレビューのビルドだけ）
- `vite.config.js`: `PAGES_BASE`（base）・`PREVIEW_PR`・`PREVIEW_SHA`（`__PREVIEW__` として埋め込む。版表記・`version.json` はプレビューの commit）。渡されなければ今まで通り
- `src/preview-banner.js`: 画面の上端に「🔍 PR #N プレビュー ・ 7 桁 ・ main の公開版ではありません」の帯（押せない）、題名に `[PR #N]`
- `09-save-load.js`: セーブ・設定のキーに `preview-prN:` を付ける（同じ origin で公開版のセーブを読み書きしない）

### 規約（`.ai/AGENTS.md` §21.1・§21.2、`.github/pull_request_template.md`）
- PR 本文の先頭に必須 7 項目: テスト版を開く／対象コミット／CI 結果／iPhone 実機確認項目／確認状況／main との差分／マージ前の注意事項。URL は公開されたもの（コメントのもの）だけを書く
- マージ判定: CI と実機確認は別の項目。実機確認が要る PR は Human が確かめるまで `CONTENT READY = HUMAN DEVICE CHECK REQUIRED` を外さない。Agent は許可なく merge しない

## 4. 安全性

| 観点 | 対策 |
| --- | --- |
| PR のコードを書き込みの権限で動かす（`pull_request_target`・`workflow_run` の典型的な危険） | PR のコードを動かすのは `preview.yml`（`pull_request`・`contents: read`・secrets 無し）だけ。`deploy.yml` は PR のコードを取り出さず・動かさない（checkout は既定のブランチだけ、`persist-credentials: false`、キャッシュ無し）。unit で確かめる |
| PR のコードが公開版の成果物を差し替える（Round 1 の M3: 同じ実行の中の `ACTIONS_RUNTIME_TOKEN`） | PR のコードは公開の実行と別の実行で動く。公開側は自分の実行の中で main を組み、PR の成果物は **PR の最新 commit の PR Preview の実行**からだけ取る |
| キャッシュの汚染 | `deploy.yml` はキャッシュを使わない。`preview.yml` の `cache: npm` は `pull_request` の範囲（PR の merge ref）にしか書けず、main 側のキャッシュを汚さない（`test.yml` と同じ） |
| 成果物の中身（PR を書いた人が自由に作れる） | データとして扱う: 置き場所・番号・commit は API の値。展開は `..`・絶対パスを取り除き、リンクは作らない。大きさの上限（zip 200MB、展開後 1 つ 100MB・合計 500MB）。検査（base・commit・セーブのキー分け）に通らなければ載せない。中身は `pr/<N>/` の下にしか置かない |
| 古いプレビューを最新と取り違える | 載せるのは PR の**最新 commit**の実行の成果物だけ。最新 commit がまだ組めていなければ「組んでいる最中」のページ。帯・題名・`preview.json` に commit。コメントは公開された commit を確かめてから書く |
| fork の PR | 組まない（`preview.yml` のジョブが動かない）・載せない（公開側は同じリポジトリの PR・実行だけ）・コメントしない。fork がきっかけの公開の実行は何もしない |
| main の公開が止まる（Round 1 の M2） | 走っている公開を取り消さない。PR のプレビューが取れなくても main は公開する |
| 同じ origin | Pages は `<owner>.github.io` が同じ origin。プレビューのセーブ・設定はキーを分けた。**ただし PR のコード自体は公開版と同じ origin で動く**（同じ `localStorage` を読める）。載るのは同じリポジトリに push できる人の PR だけ。Service Worker は使っておらず、使っても `/-ARPG-/pr/<N>/` の外は制御できない。秘密の情報は `localStorage` に無い（セーブと設定だけ） |
| 外部からの見え方 | public リポジトリの Pages なので、プレビューの URL は誰でも開ける（main の公開版と同じ扱い）。秘密の情報は含まない |
| secrets・外部サービス | 追加していない（`GITHUB_TOKEN` だけ） |

## 5. テスト（Tester）

- `npm run build` 成功、`npm run test:unit`（§7 に件数）
- unit `tests/unit/dev-preview.test.js`（19 件）: 帯・キー・URL・base／サイトの組み立て（状態ごとのページ・古いプレビューを残さない・題名のエスケープ・おかしな入力で前のサイトを消さない）／プレビュー 1 つの検査（別の番号・別の commit・main を取り込んでいないコード・`..`・リンク・テスト専用アプリの参照を落とす）／成果物の集め方（偽の API で: 最新 commit の実行だけ・fork の実行を数えない・building／failed／none／期限切れ／名前違い／大きすぎる・「Requires main」で止まった実行は none・API の失敗は 1 件だけ failed・きっかけの PR を必ず入れる）／PR のコメント（公開したすべての PR に届く・同じ状態なら書かない・人のコメントに触らない・反映を確かめられない時・公開の失敗・閉じた PR）／zip 爆弾を展開しない／展開と検査（`..`・絶対パスが外へ出ない、検査に通らない成果物は載せない、github.com 以外のリンクを使わない）／ワークフローの約束（`preview.yml` は `pull_request`・読むだけ・fork を組まない、`deploy.yml` は PR のコードを取り出さない・権限の分け方・順番待ち・fork の実行・タイムアウト・公開の確認）／`localStorage` のキーが 2 つだけ
- E2E `tests/dev-preview.spec.js`（4 件）: Pages と同じ形のサイトを手元で組んで `/-ARPG-/` の下で配り、main に帯が無くプレビューに PR 番号と commit の帯・題名、アセットはプレビューの base から 404 なし、`?dev=1` の入口、セーブのキーが分かれる、一覧
- 公開側の流れを手元で再現: プレビューを組む → zip（成果物と同じ形）→ `assemble-pages.mjs`（展開・検査・組み立て）→ `verify-preview-site.mjs` が通る。テスト専用アプリ（`test/index.html`）のアセットも `/-ARPG-/pr/<N>/` を指す
- 回帰・独立レビュー: §7

## 6. merge 前に分かっていること・Human が知っておくこと

- **公開側（`deploy.yml` の `workflow_run`・`pull_request_target`）は main にあるファイルで動く**。PR のプレビューの公開は、この PR を main へ merge した後から有効になる（この PR 自身のプレビューの URL は無い）。この PR で確かめられるのは、この PR のブランチで動く `preview.yml`（組める・検査が通る・成果物 `preview-pr-<N>`）まで
- merge 直後: main への push で新しい `deploy.yml` が動き、main の公開版は今まで通りの URL。そのとき開いている PR のうち、main を取り込んだブランチだけにプレビューが載る。ほかの PR は「main を取り込むと作られます」のページ（次の push で PR Preview が「Requires main」で止まり、その旨のコメントが付く）
- `github-pages` 環境の「デプロイできるブランチ」: `workflow_run`・`pull_request_target` の実行は既定のブランチ（main）の ref で動くので、既定の設定（main）のままで通る見込み。もし公開が「環境の保護」で止まったら、Settings → Environments → github-pages で main からの公開を許可する
- **PR のコードは公開版と同じ origin で動く**（§4）。載るのは同じリポジトリに push できる人の PR だけ（今は Human だけ）。push できる人を増やす時は、この点を思い出す
- 成果物は 30 日で消える。30 日以上 push の無い PR は「成果物の期限が切れました」のページになる（Actions で PR Preview を再実行するか、push すれば戻る）

## 7. 回帰・独立レビュー

### 独立レビュー（Reviewer、3 Round）
| Round | 対象 | 判定 | 指摘と対応 |
| --- | --- | --- | --- |
| 1 | `d598533` | CHANGES REQUESTED（MAJOR 3） | M1 古いブランチのプレビューが公開版のセーブを使い main の commit を出す／M2 main の公開がすべての PR のビルドに依存し、PR の更新が続くと取り消され続ける／M3 同じ実行の中で PR のコードが成果物を差し替え・キャッシュを汚せる → **組む所（`preview.yml`）と公開する所（`deploy.yml`）を分けた**（`cf4dc16`）。ほか MINOR（fork の実行の順番待ち・上限・page_url・版表記・Bot のコメント・Summary・検査の範囲）も対応 |
| 2 | `cf4dc16` | CHANGES REQUESTED（MAJOR 1） | R2-M1 コメントがきっかけの PR にしか付かない（待っている実行が置き換わると届かない）→ 公開したすべての PR に付ける・状態が同じなら書かない（`preview-comments.cjs`）／m1 古いブランチでも `preview.yml` が動き「失敗」と出る → 「Requires main」の手順で止めて「main を取り込んでください」／m2 成果物を集める手順の失敗でコメントが消える → きっかけの PR はイベントから／m3 zip 爆弾・合計の大きさ → 上限（`ce3965c`） |
| 3 | `ce3965c` | **PASS** | NIT のみ（公開に失敗した時は、前に動いていたプレビューの PR も「公開に失敗」と出る。保守的なので許容） |

### 回帰
- `npm run test:unit`: 2062 件中 2061 件 pass・fail 0（skip 1 は既存）
- E2E（手元、Chromium）: `dev-preview`・`production-build`・`pwa-test-entry`・`save-load`・`settings`・`chapter-select-testmode`・`ui-proto-gate`・`perf-diagnostic`・`testmode-current` の 46 件 pass。最終の commit で `dev-preview`・`production-build` の 9 件 pass
- CI（PR #102）: Test・PR Preview の結果は PR 本文に記録

### merge 前に確かめられないこと
- `workflow_run` で `deploy.yml` が動くこと・`github-pages` 環境の保護を通ること・実際の `page_url`・コメントが付くこと（main にあるファイルで動くため）。merge 後の最初の PR で確かめる
