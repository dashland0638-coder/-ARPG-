# UI-002-C1 Review Handoff（WI-C1-1〜WI-C1-3）

作成: Implementer / 2026-09-27 / Claude Code セッション（UI-001 以降と同一セッション）。**Reviewer の判定はまだ行っていない。**

## 1. Review Handoff（AGENTS.md §5.1）

| 項目 | 値 |
| --- | --- |
| Task ID | UI-002-C1 / WI-C1-1, WI-C1-2, WI-C1-3（WI-C1-4 は不採用） |
| Branch | `claude/ui-002-c1-impl` |
| Implementation SHA | `96db0fa4d869b5412a6048be5cba551d475b533d`（**レビュー対象の固定実装**。以降の commit は `.ai/` の文書のみ） |
| Diff range | `a6b96a1c803c8e52f9618a9cc1cbb11910b5f14f..96db0fa4d869b5412a6048be5cba551d475b533d`（起点 = Human Approval 記録 commit） |
| Task file | `.ai/tasks/UI-002-C1.md`（承認内容は Implementation SHA 時点、Implementation Result は後続の文書 commit） |
| Analysis | `.ai/reports/UI-002-C1-analysis.md`（`claude/ui-002-c1-analysis` @ `e8724a52221c4f0f0ade50624dfcea03c0ff9c7c`、blob `13b6d2e4132fcf41503cd9f008a20f96e79545c8`） |
| Plan | `.ai/reports/UI-002-C1-plan.md`（`claude/ui-002-c1-planner` @ `e1c3b1cf08410a56d4af74992a3fb042ff931dce`、blob `2690646e4ddd9b923af161906208139391dfea7f`） |
| Decision record | `.ai/decisions/UI-002-human-decisions.md`（HD-4、HD-5、UI-002-C1 Planner 承認） |
| main | `63235ce34edcd1c42787f114d0e4ac43f300ad10`（未変更） |

## 2. 承認内容（要約。正本は Task file「Human Approval 内容」）

- WI-C1-1 Token foundation / WI-C1-2 Panel component pilot / WI-C1-3 Icon registry を承認。WI-C1-4（layout 属性）は不採用。
- AP-C1-01〜12: 既存値のみ（新しい色・サイズ・形・装飾値を追加しない）/ 3 層命名、semantic は 1 値 1 意味のみ / CSS 側で共通化・DOM に class を追加しない / typography は現行値の整理のみ / button の既定書体は変更しない / JS・Canvas の色は無理に対象にしない / icon 表は「意味名 → 現在のグリフ」のみ・表示は置換しない / dev UI の CSS は対象外 / token ファイル配置は Planner 推奨 / 検証は computed style 比較・3D 無し画面の画像比較・両サイズ・E2E 全件・build / unit / 実装ブランチ `claude/ui-002-c1-impl`。
- **最重要条件: 見た目が変わっていないこと。意図しない見た目変更は FAIL。**

## 3. 変更ファイル（`a6b96a1..96db0fa`）

| ファイル | 区分 | 内容 |
| --- | --- | --- |
| `src/styles/tokens.css`（新規） | source | 現行値の別名 token（semantic 色 13 / font-family 4 / font-weight 2 / font-size role 3 / radius 4 / shadow 5 / z-index 24 / panel 3）。既存 10 変数は参照のみ |
| `src/styles/main.css` | source | `@import './tokens.css';` 1 行（+ コメント 1 行）、値が完全一致する宣言の token 参照化（z-index 34 / border-radius 50 / font-family 21 / font-weight 23 / font-size 3 / box-shadow 6 / background 6）、Panel グループ selector（4 selector × 背景・枠・角丸を移動） |
| `src/core/ui-icons.js`（新規） | source | 意味名 → 現在の emoji / 記号（21 件）。どこからも import していない（表示は不変） |
| `tests/unit/ui-icons.test.js`（新規） | test | 5 テスト |
| `tests/ui-foundation.spec.js`（新規） | test | 2 テスト（AP-C1-11） |
| `.ai/tasks/UI-002-C1.md` | 文書 | Status / Status History |

変更していないもの: `index.html`、`src/legacy/parts/*`、`src/legacy/concat-plugin.js`、`basefile.html`、既存 spec / helpers、dev UI の CSS（arena / debug-badge / perf / motion / testmode の selector は 1 行も変わっていない）、CSS にのみ存在する 40 selector、既存 `:root` 10 変数。

Implementer 側の置換方法: `main.css` を rule 単位で読み、dev / 未使用 selector を除いた rule の宣言のうち、値が token の値と完全一致するものだけを置換（z-index と box-shadow は selector ごとの期待値を assert してから置換）。Panel は 3 宣言の値を assert してから削除し、グループ rule を `.cc-frame` の直前に置いた。

## 4. Test Report（PASS / 既存 FAIL / FLAKY / NOT_RUN を区別）

| 区分 | 結果 |
| --- | --- |
| Build | **PASS** |
| Unit | **1535 PASS / 0 FAIL** |
| E2E 全件 | **165 total / 165 PASS / 0 FAIL**（新規 2 件を含む） |
| computed style 比較（dev サーバ） | 20 画面 × 8,366 要素 × 41 プロパティ（`::before` / `::after` 含む）で **差分 0** |
| computed style 比較（本番ビルド `/-ARPG-/`） | 20 画面 × 8,346 要素で **差分 0** |
| 比較手段のノイズ | 変更前コードの 2 回の記録で差分 0 |
| 画像比較（3D 無し） | タイトル（通常 / `?dev=1`）・テストモード画面・職業選択 × 1280×800 / 844×390 = 8 枚 **完全一致** |
| 画像（3D 有り） | 会話・酒場 HUD・メニュー・確認・Arena・鑑定所 × 2 サイズ = 12 枚。変更前同士でも一致しないため判定に使わない。目視で差なし |

1280×800 は非タッチ、844×390 は `hasTouch` + `isMobile`（タッチ UI）で確認。Web フォントは両方とも未読み込み（この環境の制約。変更前後で同条件）。

既存テストの分類（**変更しない**）:

| テスト | 今回 | 分類 |
| --- | --- | --- |
| `mansion-escort` Relaxed Stance | PASS | **既存 FAIL**（分類を維持。PASS として数え直さない） |
| `execution-break` 通常敵 Break → EXECUTE | PASS | **既存 FAIL**（Human Decision。PASS / FLAKY に戻さない） |
| `job-traits` 鷹の目 Turn Assist | PASS | FLAKY 記録を保持 |

NOT_RUN: GitHub Pages 本番 URL での実機確認、Web フォント読み込み済みでの撮影、ダンジョン内 HUD・出撃画面・結果画面の撮影（これらの要素も DOM 上にあり computed style 比較の対象には含まれる）。

Playwright: リポジトリ外の設定でブラウザ実行パスのみ差し替え（`playwright.config.js` 未変更）。

## 5. 状態

- Working tree: clean（本 Handoff の commit 後）
- main: 未変更（`63235ce`）。main への merge / push は行っていない

## 6. Reviewer への確認依頼

| # | 確認 |
| --- | --- |
| V-1 | Implementation SHA が `96db0fa4d869b5412a6048be5cba551d475b533d` と一致し、`a6b96a1..96db0fa` の変更ファイルが §3 の範囲に収まること |
| V-2 | 見た目が変わっていないこと（token の値が置換前の値と一致すること、computed style 比較・画像比較の再実行） |
| V-3 | 新しい色・サイズ・形・装飾値が追加されていないこと（`tokens.css` の全値が変更前の `main.css` に存在すること） |
| V-4 | semantic token が 1 値 1 意味に限られ、複数の意味で共有されている色（ember 等）に意味名が付いていないこと |
| V-5 | DOM id / class・`.active` / `.show` が変わっていないこと（`index.html` / `src/legacy/parts` の差分なし） |
| V-6 | dev UI の CSS、Character palette、button の既定書体、JS / Canvas の色に変更がないこと |
| V-7 | `ui-icons.js` が「意味名 → 現在のグリフ」だけで、表示を置き換えていないこと |
| V-8 | `tokens.css` の読み込みが dev / 本番ビルドの両方で機能し、legacy runtime（concat-plugin）と互換であること |
| V-9 | 新規テストが承認範囲内であり、既存テストの意味を変えていないこと |

## 7. 禁止事項（以降の工程）

- main への merge / push をしない
- Implementation SHA `96db0fa` を変更しない
- 既存 FAIL（mansion-escort / execution-break）を今回の PASS を理由に PASS / FLAKY へ変更しない
- GitHub Pages 実機確認を NOT_RUN 以外にしない
