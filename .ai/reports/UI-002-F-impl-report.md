# UI-002-F Implementation Report — Menu / Character UI（F0〜F5・F7）

| 項目 | 内容 |
| --- | --- |
| Work Item ID | UI-002-F（F0〜F5・F7。F6 は保留） |
| 目的 | メニューと鍛冶屋を、HUD と同じ視覚言語（C2 のプレート）にそろえ、844×390 で読みやすく操作しやすくする。仕様・表示条件は変えない |
| 承認 | Human 2026-10-09（`.ai/tasks/UI-002-F.md` Human Approval、F-D1〜F-D10） |
| ブランチ | `claude/ui-002-f-impl`（`main` `9e30e64` から。`main` への merge は禁止） |
| 分析 / 計画 | `.ai/reports/UI-002-F-analysis.md` / `.ai/reports/UI-002-F-plan.md`（`ui-002-f-analysis` @ `3bd4b90` を引き継ぎ） |

## 実施内容

| WI | 内容 | 主な変更 |
| --- | --- | --- |
| F0 | 撮影スクリプト（CI の `npm test` に含めない） | `scripts/ui-screens/playwright.config.mjs` / `screens.spec.js`。出力は repo の外（OS の一時ディレクトリ、`UI_SCREENS_OUT` で変更可） |
| F1 | プレート / 本の component token（色は既存 token の参照だけ。新規の寸法は F-D3 の 760px・12px・11px・36px） | `src/styles/tokens.css` |
| F2 | パネル（単色の面・3px の輪郭・2px の内縁・角丸 8px・落ち影 1 種）、碑文の見出し（金の文字＋罫＋小さな菱形）、しおりタブ、プレートのボタン、ぼかし・グラデーション・発光の除去、パッドのフォーカスは 3px の輪郭だけ | `src/styles/main.css`（`#menu-overlay` / `#appraisal-overlay` に限定。`.gp-focused` は全画面共通） |
| F3 | メニューを「冒険」「設定」「操作」の 3 タブに。「冒険」は 2 列（キャラクター情報｜冒険に戻る・セーブ・街に戻る・タイトルへ）。開いた時は常に「冒険」。「所持素材」→「所持金」 | `index.html`（既存 id はすべて維持）、`10-input.js` `setMenuTab` |
| F4 | 鍛冶屋: 装備枠を横長の行に、スクロールは所持品の一覧だけ（`.gear-item-list`）。背の低い画面では余白を詰める | `main.css`、`12-progression-ui.js`（一覧の入れ物・`外す` の inline style 削除・タブの表示を `''` に戻す） |
| F5 | 文字 11px 以上・押せるもの 36px 以上、状態は意味色＋形（装備中 = 菱形＋左のしおり、装備可 = 丸、できない = 斜線）。パッド: スキルのサブタブを順次ナビゲーションの対象に | `main.css`、`10-input.js` `GP_NAV_SELECTOR` |
| F7 | テスト | 新規 `tests/menu-character-layout.spec.js`、`tests/ui-foundation.spec.js`（メニュー・鍛冶屋の期待値の更新＋出撃・結果画面の固定を追加）、`tests/helpers.js` / `tests/settings.spec.js`（「設定」タブへの遷移を 1 行） |
| F6 | **保留**（アイコン置換。UI-002-E の後に別途判断）。新しい Emoji は追加していない | — |

## 変更ファイル

`src/styles/tokens.css`、`src/styles/main.css`、`index.html`、`src/legacy/parts/10-input.js`、`src/legacy/parts/12-progression-ui.js`、`tests/ui-foundation.spec.js`、`tests/helpers.js`、`tests/settings.spec.js`、新規 `tests/menu-character-layout.spec.js`、新規 `scripts/ui-screens/*`、`.ai/tasks/UI-002-F.md`、`.ai/decisions/UI-002-human-decisions.md`、`.ai/reports/UI-002-F-*.md`。
Plan §4 の一覧と一致（`scripts/ui-screens/` は Plan の「撮影スクリプト」）。**変更していない**: `basefile.html`、セーブ、ゲームロジック、HUD、会話・結果画面、酒場・出撃画面、ゲームの定義（Emoji を含む）。

## 撮影結果（1280×800 / 844×390、本編の加入後のセーブ）

| 画面 | 変更前 | 変更後 |
| --- | --- | --- |
| メニュー 1280×800 | 420×704、中身 1204px（約 1.7 画面のスクロール） | 760 幅、「冒険」はスクロールなし |
| メニュー 844×390 | 420×343、中身 1204px（**約 3.5 画面**）。開いた直後はキャラクター情報だけ | 「冒険」はスクロールなし。キャラクター情報と 4 つのボタンが 1 画面に。「設定」も 1 画面（3 列）|
| 鍛冶屋・装備品 844×390 | 中身 606px（約 1.8 画面）、全体がスクロール | 見出し・タブ・装備枠・道具・閉じるは固定、一覧だけがスクロール |
| 補助の文字 | 9〜9.5px が多い | 11px 以上（E2E で確認） |
| 背景 | ぼかし | 単色の暗幕 |

- 画像は commit していない（F-D9）。この環境では PR に画像を添付する手段が無いため **未添付**。生成場所: このセッションの scratchpad（`ui-screens/after/`、変更前は Analyzer の `uif/`）。手元で同じ画像を作るには `UI_SCREENS_LABEL=after npx playwright test -c scripts/ui-screens/playwright.config.mjs`（変更前は `main` で同じコマンド）
- **書体**: この環境では Google Fonts が読み込めず（`document.fonts` に読み込み済み 0）、OS の代替フォントで撮影・計測している。Cinzel / Noto Serif JP / Noto Sans JP での見え方は未確認

## テスト

| 確認 | 結果 |
| --- | --- |
| `npm run build` | PASS |
| `npm run test:unit` | 1709 pass / 0 fail / 1 skip（既存） |
| 新規 `menu-character-layout`（5 件: メニュー × 2 サイズ・鍛冶屋 × 2 サイズ・パッド） | **5 passed** |
| `ui-foundation` / `settings` | PASS |
| `npm test`（ローカル。2 コアで 2 時間の上限に達したため 2 回に分けた） | 1〜199 件目まで実行（上限で打ち切り）: 失敗 2 件（下記）、それ以外は PASS。200〜246 件目（`menu-character-layout` 以降の 14 ファイル）: **52 passed** |
| ローカルの失敗 2 件（無関係） | ① `chapter1-tower-to-road.spec.js:111`: 交代の一幕の後にメニューが開かない（`helpers.js:107` の待ち。今回の変更より前の行）。**変更前の `main`（`9e30e64`）でも同じ場所で同じ失敗を再現**（この環境の低 fps で一幕が 5 秒の待ちより長い。TF-04 の系統）。② `job-traits.spec.js:97`（既存の自動リトライ付きの不安定なテスト）|
| CI（GitHub Actions の全体） | PR で実行 |

## Reviewer（独立。Agent Protocol 2.0）
- Round 1: **CHANGES_REQUIRED** — `ui-foundation` の期待値で `#menu-overlay` のキーが重複し、既存の `z-index: 30` の固定が上書きで消えていた（検証の弱化）。→ 1 つのキーに統合（`4306cdd`）。非 blocking: パッドのフォーカス確認が `.gp-focused` を自分で付けていた → 実際にフォーカスされた要素を読むよう修正
- Round 2: **PASS**（重複キー 0。範囲・id・文言・CSS の範囲・第一章 / Test Mode の条件・テストの意味を確認）
- 記録された非 blocking の注記: `.gp-focused`（発光の除去）は全画面共通（承認済みの対象）。「装備できない」の斜線は状態を形で示すための模様で、C2 の見本と同じ手法

## 既知の制約・Human 実機確認が必要な事項
1. 実機（iPhone 横持ち・PC のブラウザ）で、正式な書体での見え方・文字の読みやすさ・タップのしやすさ
2. 844×390 の鍛冶屋で、所持品の一覧が 2 行前後しか見えない（スクロールは一覧だけ）。実機で十分か
3. Safe area（ノッチ）のある実機でのパネルの位置
4. パッドの実機操作（順次ナビゲーションでサブタブまで届くこと。E2E は仮のパッドで確認）
5. F6（Emoji の置換）は未着手。メニュー・鍛冶屋の Emoji は残っている
6. メニューの「MP」の行は残っている（MP 廃止は別 Task、HD-D29）

## Autonomy Metrics
- Human Escalation Count: 0 / Human Decision Count: 0（承認済みの F-D1〜F-D10 の範囲）
- Auto Fix Count: 3（撮影スクリプトの順序、短い画面の一覧の高さ、Reviewer R1 の重複キー）
- Reviewer Rounds: 2 / Test Retries: 0（失敗の切り分けに `main` で 1 回再現）
