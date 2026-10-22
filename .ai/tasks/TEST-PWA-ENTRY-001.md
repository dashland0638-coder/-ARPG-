# TEST-PWA-ENTRY-001 — iPhone ホーム画面のテスト専用アイコン

Status: REVIEWING

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
