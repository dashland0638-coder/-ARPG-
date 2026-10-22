# TEST-PWA-ENTRY-001 — 調査（Analyzer）

基準: `origin/main` `458781c`（PR #97 の merge 後）。

## 1. 今の起動の経路（FACT）

| 項目 | 内容 | 場所 |
| --- | --- | --- |
| 通常版のマニフェスト | `start_url:"./"`・`scope:"./"`・`display:"fullscreen"`・アイコン `icons/icon-192/512.png`。マニフェストの場所（公開では `/-ARPG-/manifest.webmanifest`）から相対で解決する | `public/manifest.webmanifest` |
| ゲームのページ | `<link rel="manifest" href="/manifest.webmanifest">`・`apple-touch-icon` `/icons/icon-192.png`・`apple-mobile-web-app-capable`。Vite がビルド時に `/-ARPG-/…` へ書き換える（dist で確認） | `index.html` |
| 公開のサブパス | `base: production ? '/-ARPG-/' : '/'`（`vite build` は production） | `vite.config.js` |
| 開発用 UI の判定 | URL の `dev=1`（完全一致・最初の値・保存しない） | `src/core/dev-ui.js`、`01-character-creation.js` `DEV_UI` |
| Service Worker | **無い**（`serviceWorker`・`sw.js` の参照なし） | ― |
| キャッシュ対策 | 起動時に `version.json` を読み、新しい build なら 1 回だけ `?build=` を付けて読み直す。他の検索条件（`?dev=1` 等）は残す | `src/core/build-check.js`、`14-hud-boot.js` |
| 公開 | `main` への push で `npm run build` → `dist` を Pages へ | `.github/workflows/deploy.yml` |

## 2. 原因

ホーム画面のアプリは、通常版のマニフェストの `start_url`（`./` = `/-ARPG-/`）で起動する。`?dev=1` が無いので `DEV_UI` が false になり、テストモードの入口が出ない（INFERENCE: iOS が start_url ではなく追加した時のページの URL を使う版でも、`?dev=1` のページから追加しない限り同じ）。通常版のマニフェストに `?dev=1` を足すと通常版がテストモードになるので、足さない。

## 3. 方針（Planner）

1. テスト版のマニフェスト `public/manifest-test.webmanifest`: `start_url:"./?dev=1&app=test"`・`scope:"./"`（ゲームの公開範囲）・`id:"./?app=test"`・別の名前（「ソウルフォージ テスト版」「SFテスト」）・テスト版のアイコン。すべて相対（`/` から始めない）
2. テスト版のアイコン `public/icons/test-icon-180/192/512.png`（`tools/icons/make-test-icons.py` で作る。通常版と同じ作りで、円を青緑にし「TEST」の帯）。通常版のアイコンは変えない
3. 入口ページ `test/index.html`（Vite の 2 つ目のページ。参照はサブパスへ書き換わる）: テスト版のマニフェスト・`apple-touch-icon`・`apple-mobile-web-app-title`、iPhone での追加の手順、「テストモードを開く」。**ホーム画面から起動された時（`navigator.standalone` / display-mode）は、すぐにゲームの `?dev=1&app=test` へ移る** ―― iOS がマニフェストの `start_url` を使わずにページの URL で起動した場合でも、テストモードで開くため
4. URL の印 `app=test`（`src/core/pwa-entry.js`）: `dev=1` と一緒の時だけ効く。ゲームのタイトルで「はじめる」（通常のセーブを消して始める）と「つづきから」を出さず、注記を出す ―― テスト用のアイコンから通常のセーブを触らない。保存はしない
5. URL は `URL` / `URLSearchParams` で組み立てる（入口に他の検索条件があっても残す。`build` の印と `#` は落とす）
6. Service Worker は足さない（無いので）

## 4. iOS の扱い（INFERENCE。実機で確かめる）

- iOS の「ホーム画面に追加」は、ページの `apple-touch-icon` と `apple-mobile-web-app-title`（無ければマニフェストの名前）を使う。起動 URL は、iOS の版によってマニフェストの `start_url` か、追加した時のページの URL。どちらでもテストモードで開くように、入口ページは起動されたらゲームへ移る
- 同じオリジンのホーム画面アプリが 2 つ並ぶ時、iOS は別のアプリとして扱う（別の URL のブックマーク）。ただし、通常版とテスト版でストレージ（localStorage）が分かれるか・共有されるかは iOS の版による。どちらでも通常のセーブは守られる（テストモードは書かない。テスト版では「はじめる」を出さない）
- `scope` が `/-ARPG-/` なので、入口ページ（`/-ARPG-/test/`）からゲーム（`/-ARPG-/`）へ移ってもアプリの中に留まる見込み。iOS が scope を入口ページの階層（`/-ARPG-/test/`）にした場合、ゲームへ移る時にブラウザの枠が出る可能性がある
- 既に追加済みのアイコンの起動設定は、iOS が追加した時点のものを持ち続ける。公開の後に通常版を追加し直す必要は無い（通常版のマニフェストは変えていない）

## 5. キャッシュ

- Service Worker が無いので、キャッシュの衝突は HTTP キャッシュだけ。テスト版は `?dev=1&app=test` の別 URL、入口ページは別のパス、マニフェスト・アイコンは別ファイル名なので、通常版のキャッシュと重ならない
- `build-check` の読み直しは `?dev=1&app=test` を残す（`reloadUrl` は他の検索条件を保つ）
