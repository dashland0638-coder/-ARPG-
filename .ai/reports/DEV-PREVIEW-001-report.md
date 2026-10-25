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
| **A. GitHub Pages の同じサイトの下に PR ごとのプレビュー（`/-ARPG-/pr/<N>/`）** | **採用**。外部サービス・secrets が要らない。iPhone のブラウザでそのまま開ける。Pages はサイト全体を置き換えるので、main と開いている PR のプレビューを毎回まとめて組んで公開する |
| B. Actions の成果物（zip） | 代わりの手段として併用（`test.yml` の `preview-site`）。iPhone では zip を開いてもブラウザで動かせないので主にはしない |
| C. 別のリポジトリの Pages | token（secrets）と新しいリポジトリが要る。origin も同じ（`<owner>.github.io`）で分離にならない |
| D. 外部サービス（Netlify 等） | アカウント・token・課金の判断が要る（Human の判断）。今回は使わない |

## 3. 実装（Implementer）

### 公開（`.github/workflows/deploy.yml` を書き換え）
- きっかけ: main への push（今まで通り）／`pull_request_target`（opened・reopened・synchronize・closed）／手動
- ジョブ:
  - `main-build`（読むだけ）: 既定のブランチ（main）を組む → 公開版は必ず main のコードから
  - `preview-build`（読むだけ・PR の一覧を読む）: 開いている PR のうち **同じリポジトリのものだけ**（fork は組まない）。PR ごとに commit を `git worktree` に取り出し、`npm ci --ignore-scripts` → `vite build --base /-ARPG-/pr/<N>/`（`scripts/build-previews.mjs`）。PR のコードへ渡す環境からトークン類を消す。キャッシュは使わない。新しい順に最大 10 件
  - `assemble`（読むだけ）: main を根元、プレビューを `pr/<N>/` に置き、一覧 `pr/index.html`、各プレビューに `preview.json`（commit・成否・時刻・実行結果）。**PR の一覧（番号・commit・題名）は PR のコードを動かす前に API から取った値だけを使い、置き場所は番号から決める**（`scripts/assemble-pages.mjs`）。ビルドに失敗した PR は古いプレビューを残さず「失敗しました」のページ
  - `deploy`（公開の権限はここだけ。PR のコードは動かさない）: `deploy-pages`
  - `comment`（PR に書く権限だけ）: PR に「🔍 テスト版を開く」のコメントを 1 つだけ置いて書き換える（URL・テストモードの URL・対象コミット・実行結果。失敗時は「まだ使えません」と理由）
- 古いプレビューを防ぐ: `concurrency: pages`・`cancel-in-progress`。新しい実行は毎回すべての PR の最新 commit を組み直すので、古い実行の結果が後から上書きすることはない。取り消された実行はコメントしない（`!cancelled()`）
- 閉じた PR: `closed` でも組み直す（開いている PR だけを組む）→ そのプレビューは消える

### アプリ（プレビューのビルドだけ）
- `vite.config.js`: `PAGES_BASE`（base）・`PREVIEW_PR`・`PREVIEW_SHA`（`__PREVIEW__` として埋め込む。版表記・`version.json` はプレビューの commit）。渡されなければ今まで通り
- `src/preview-banner.js`: 画面の上端に「🔍 PR #N プレビュー ・ 7 桁 ・ main の公開版ではありません」の帯（押せない）、題名に `[PR #N]`
- `09-save-load.js`: セーブ・設定のキーに `preview-prN:` を付ける（同じ origin で公開版のセーブを読み書きしない）

### CI での確認（`.github/workflows/test.yml` の `preview-site`、読むだけ）
- PR の head を組んで main 相当と合わせたサイトを作り、`scripts/verify-preview-site.mjs` で確かめる（アセットの base・ファイルの有無・commit の埋め込み・`preview.json`）。サイト一式を成果物 `pages-site-pr-<N>` として 3 日保存（代わりの手段）

### 規約（`.ai/AGENTS.md` §21.1・§21.2、`.github/pull_request_template.md`）
- PR 本文の先頭に必須 7 項目: テスト版を開く／対象コミット／CI 結果／iPhone 実機確認項目／確認状況／main との差分／マージ前の注意事項。URL は公開されたもの（コメントのもの）だけを書く
- マージ判定: CI と実機確認は別の項目。実機確認が要る PR は Human が確かめるまで `CONTENT READY = HUMAN DEVICE CHECK REQUIRED` を外さない。Agent は許可なく merge しない

## 4. 安全性

| 観点 | 対策 |
| --- | --- |
| PR のコードを書き込みの権限で動かす（`pull_request_target` の典型的な危険） | PR のコードを動かすのは `preview-build` だけで、そのジョブの権限は `contents: read`・`pull-requests: read`。`checkout` は `persist-credentials: false`、PR のコードへ渡す環境からトークン類を消す |
| fork の PR | 組まない（head のリポジトリがこのリポジトリと同じ PR だけ）。コメントもしない。fork の PR でも実行は走るが、組むのは main と同じリポジトリの PR だけ |
| キャッシュの汚染 | このワークフローではキャッシュを使わない |
| ジョブ間の受け渡し | `assemble` は PR のコードが書いたファイルの中の値（パス・番号・成否）を使わない。番号・commit は API の値、置き場所は番号から |
| 公開版を PR のコードで置き換える | 公開版（根元）は `main-build`（main のコード）だけ。PR のコードは `pr/<N>/` の下にしか置かない |
| 同じ origin | Pages はプロジェクトサイトでも `<owner>.github.io` が同じ origin。プレビューのセーブ・設定はキーを分けた。ただし PR のコード自体は同じ origin で動く（同じリポジトリの、書き込める人の PR だけなので許容。§6） |
| 外部からの見え方 | public リポジトリの Pages なので、プレビューの URL は誰でも開ける（main の公開版と同じ扱い）。秘密の情報は含まない |
| secrets・外部サービス | 追加していない |

## 5. テスト（Tester）

- `npm run build` 成功、`npm run test:unit` 2059 件（fail 0。skip 1 は既存）
- unit `tests/unit/dev-preview.test.js`: 帯・キー・URL・base／サイトの組み立て（失敗のページ・古いプレビューを残さない・題名のエスケープ・おかしな入力で前のサイトを消さない）／プレビューの選び方／検査が main のアセットを指すプレビューを落とす／assemble が API の値だけを使う／ワークフローの約束（権限・fork・キャッシュ・資格情報・公開ジョブが PR のコードを動かさない・取り消し時にコメントしない）／`localStorage` のキーが 2 つだけ
- E2E `tests/dev-preview.spec.js`（4 件 pass）: Pages と同じ形のサイトを手元で組んで `/-ARPG-/` の下で配り、main に帯が無くプレビューに PR 番号と commit の帯・題名、アセットはプレビューの base から 404 なし、`?dev=1` の入口、セーブのキーが分かれる、一覧
- `scripts/build-previews.mjs` を実際に動かし、この仕組みより前のブランチ（PR #101 の head `da4ffaf`）を `/-ARPG-/pr/101/` で組めることを確かめた（`--base` を CLI で渡すので古い `vite.config.js` でもアセットの URL が合う）
- 回帰・独立レビュー: §7

## 6. merge 前に分かっていること・Human が知っておくこと

- **`pull_request_target` は main 側のワークフローで動く**。PR プレビューの公開は、この PR を main へ merge した後の PR から有効になる（この PR 自身のプレビューは公開されない）。この PR で確かめられるのは `test.yml` の `preview-site`（組める・検査が通る・成果物）まで
- merge 後の最初の main への push で、`deploy.yml` の新しい形が動く。main の公開版は今まで通りの URL。`github-pages` 環境の「デプロイできるブランチ」は、`pull_request_target` の実行が base（main）の ref で動くので、既定の設定（main）のままで通る見込み。もし公開が「環境の保護」で止まったら、Settings → Environments → github-pages で main からの公開を許可する（変更は不要の見込み）
- PR のコードは公開版と同じ origin で動く（キーを分けたので公開版のセーブには触れない。同じリポジトリに書ける人の PR だけ）

## 7. 回帰・独立レビュー

（下に記録）
