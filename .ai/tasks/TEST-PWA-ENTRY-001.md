# TEST-PWA-ENTRY-001 — iPhone ホーム画面のテスト専用アイコン

Status: DONE（PR 作成済み。main への merge は Human の判断）

Analysis: `.ai/reports/TEST-PWA-ENTRY-001-analysis.md`

## Approval
- [x] Approved
- Approval type: Agent Approval（`../AGENTS.md` §6.1）
- Escalation Check: None（通常版のマニフェスト・アイコン・通常プレイの開始・セーブの形式は変えない。テスト版の入口と、`?dev=1&app=test` の時のタイトルだけ）
- Approved by / date: Planner (Agent) / 2026-10-22
- Persistence: branch `claude/test-pwa-entry-001`

## Goal（Human、2026-10-22）

通常プレイ用のアイコンは今までどおり通常プレイを起動し、テスト専用のアイコンから iPhone のホーム画面で直接テストモードを起動できるようにする。GitHub Pages のサブパス（/-ARPG-/）に対応し、通常セーブの保護を保つ。

## 変更

| ファイル | 内容 |
| --- | --- |
| `public/manifest-test.webmanifest`（新規） | テスト版のマニフェスト（起動 `./?dev=1&app=test`、scope `./`、id、名前、テスト版のアイコン） |
| `public/icons/test-icon-180/192/512.png`（新規） | テスト版のアイコン |
| `tools/icons/make-test-icons.py`（新規） | アイコンを作るスクリプト |
| `test/index.html`（新規） | 入口ページ（案内・追加の手順・テストモードを開く。ホーム画面から起動されたらゲームへ移る） |
| `src/pwa-test-entry.js`（新規） | 入口ページの動き |
| `src/core/pwa-entry.js`（新規） | `isTestApp`・`testAppGameUrl`・`launchedFromHomeScreen` |
| `vite.config.js` | ページを 2 つに（`index` と `testapp`） |
| `index.html`・`src/styles/main.css` | テスト版のタイトルの注記 |
| `src/legacy/parts/01-character-creation.js`・`concat-plugin.js` | テスト版では「はじめる」「つづきから」を出さない（押されても何もしない） |
| `tests/unit/pwa-entry.test.js`（新規）・`tests/pwa-test-entry.spec.js`（新規） | unit・E2E |

変えていない: `public/manifest.webmanifest`、通常版のアイコン、`basefile.html`、legacy の連結構成、セーブの形式、テストモードのセーブ保護（PR #97）。

## Test Report（2026-10-22）

| 項目 | 結果 |
| --- | --- |
| `npm run build` | 成功。dist に `index.html`・`test/index.html`・`manifest.webmanifest`（変更なし）・`manifest-test.webmanifest`・`icons/test-icon-180/192/512.png`。参照は `/-ARPG-/…` |
| `npm run test:unit` | 1952 pass / 0 fail（1 skip は既存）。`pwa-entry.test.js` は通常版のマニフェストが今の内容と完全に同じことも固定する |
| E2E `pwa-test-entry`（新規 5 本、公開用のビルド `http://localhost:4173/-ARPG-/`） | 5 passed |
| E2E 回帰（`pwa-test-entry`・`chapter-select-testmode`・`scenario-test-mode`・`dev-ui-gate`・`production-build`・`save-load`・`chapter1-progression`・`combat-test-arena`・`notifications`） | 45 passed |
| PR の CI（E2E 全件） | PR 作成後 |

## Reviewer

Round 1 **PASS**（Required なし）。任意の指摘のうち、末尾の `/` が無い入口の URL と、`?app=test` だけの時の注記の非表示の assert を反映。残りは analysis §6 に記録。

## 自動テストで確かめたこと / 実機で確かめること

自動テスト（Playwright の Chromium、iOS ではない）: dist のマニフェスト・アイコン・入口ページがサブパスで取得でき、参照が `/-ARPG-/` に解決する。入口の「テストモードを開く」と、`navigator.standalone` を真にした起動で `?dev=1&app=test` へ移る。テスト版のタイトルでテストモードの入口が出て「はじめる」「つづきから」が出ない。通常 URL では入口が出ない。`?dev=1` だけは今までどおり。テスト版でシナリオを選んで始め、戻り、読み直しても通常のセーブは 1 文字も変わらず、通常 URL で「つづきから」再開できる。

HUMAN DEVICE CHECK REQUIRED（iPhone）: 「ホーム画面に追加」でテスト版の名前・アイコンになるか / テスト版のアイコンからテストモードで開くか（ブラウザの枠が出ないか）/ 通常版のアイコンは今までどおりか / 2 つのアイコンが並んで別々に開くか / テストの後に通常版で「つづきから」が続くか（ストレージが共有か別かも）。

### Autonomy Metrics

Human Escalation: 0 / Human Decision: 0 / Auto Fix: 1（unit の glob に合うファイル名の修正）/ Reviewer Rounds: 1 / Test Retry: 0
