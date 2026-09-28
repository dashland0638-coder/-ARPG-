# UI-002-C1 Review（WI-C1-1〜WI-C1-3）

## 1. Reviewer / 対象

| 項目 | 値 |
| --- | --- |
| Reviewer | Claude Code セッション（Reviewer 役） |
| 独立性 | **同一セッションで兼務**（Analyzer / Planner / Implementer と同じセッション。AGENTS.md §5）。検証は Implementer の比較スクリプト・比較結果を使わず、Reviewer 用に別のスクリプトを書いて再計測した |
| 推奨 | 兼務のため、**人間による差分確認を推奨**する（source 差分: `tokens.css` 新規 99 行、`main.css` 138 行の置換、`ui-icons.js` 新規 46 行） |
| 日付 | 2026-09-28 |
| Implementation SHA（固定） | `96db0fa4d869b5412a6048be5cba551d475b533d` |
| latest commit | `7408477204aabacf17dbb4aff0221feb6b259a21`（`96db0fa..7408477` は `.ai/` の文書のみ） |
| Handoff | `.ai/reports/UI-002-C1-review-handoff.md`（本レビューで書き換えていない） |
| main baseline | `63235ce34edcd1c42787f114d0e4ac43f300ad10`（未変更を確認） |

検証はリポジトリ外の worktree（`63235ce` と `96db0fa` の 2 つ）で行い、終了後に削除した。

## 2. Handoff 検証（AGENTS.md §5.1）

| # | 結果 |
| --- | --- |
| V-1 | OK: `96db0fa` は `origin/claude/ui-002-c1-impl` から到達可能 |
| V-2 | OK: `96db0fa:.ai/tasks/UI-002-C1.md` あり（WI-C1-1〜3 APPROVED、WI-C1-4 REJECTED、AP-C1-01〜12、Persistence `claude/ui-002-c1-impl`） |
| V-3 | OK: Plan `96db0fa:.ai/reports/UI-002-C1-plan.md` の blob = `2690646e4ddd9b923af161906208139391dfea7f`（Handoff 記載と一致） |
| V-4 | OK: Analysis の blob = `13b6d2e4132fcf41503cd9f008a20f96e79545c8`（Task file の `Analysis:` 行と一致） |
| V-5 | OK: Implementation Result は後続の文書 commit（`7408477`） |
| V-6 | OK: `a6b96a1..96db0fa` は非空（6 files）、`a6b96a1` は `96db0fa` の祖先 |

## 3. 必須確認

| # | 確認 | 結果 | 根拠 |
| --- | --- | --- | --- |
| 1 | WI-C1-1〜3 のみ実装 | **OK** | `a6b96a1..96db0fa` の変更は `tokens.css`（新規）/ `main.css` / `ui-icons.js`（新規）/ `tests/unit/ui-icons.test.js`（新規）/ `tests/ui-foundation.spec.js`（新規）/ Task file（Status のみ）。Plan §14 の Files To Change と AP-C1-11 の範囲内 |
| 2 | WI-C1-4 が未実装 | **OK** | `index.html` / `src/legacy/parts` に差分なし。`data-ui-input` / `data-ui-viewport` の文字列は `96db0fa` の src に存在しない（Plan / Task の記述のみ） |
| 3 | `tokens.css` は既存値のみ | **OK** | 58 token。semantic 色 13・shadow 5・radius 4・font-family 4 の値は、`var(--ui-*)` を展開した上で `63235ce:main.css` にすべて文字列として存在（Reviewer の静的比較で欠落 0）。z-index 24 値はすべて既存の 19 値の範囲内、font-size 3（8.5 / 9.5 / 20px）・font-weight 2（400 / 700）も既存値。職業名・キャラ配色を含む token なし |
| 3' | 新しい意味を追加していない | **OK** | semantic 色は text / text-muted / line / surface（bg・panel 上下・HUD 面）/ HP・MP・スタミナのグラデ端点のみ。ember・赤・金など複数の意味で共有されている色に意味名は付いていない（AP-C1-02） |
| 4 | `main.css` の置換が既存値と完全に対応 | **OK** | Reviewer の静的比較: 両版の `main.css` を rule 単位に展開し、実装版は `var(--ui-*)` を `tokens.css` の値で再帰的に置換、Panel のグループ selector を 4 selector に展開して比較 → **452 selector、宣言の差 0**。rule の並び（グループ rule を除く）と `@keyframes` も同一 |
| 5 | Panel 共通化は CSS 側のみ | **OK** | `.cc-frame, .menu-box, .event-box, .appraisal-box{ background; border; border-radius }` を `.cc-frame` の直前に追加し、4 selector から同じ 3 宣言を削除。DOM・id・class の変更なし（`index.html` / JS 差分なし） |
| 6 | `.active` / `.show` の挙動 | **OK** | 状態 class を持つ rule（`#menu-overlay.active` 等）は `display` の値を含め差分なし（静的比較）。E2E（`toHaveClass(/active/)` 77 箇所・`/show/` 28 箇所）を含む全件が PASS（Handoff、Reviewer の targeted 再実行も PASS） |
| 7 | `ui-icons.js` は対応表のみ | **OK** | 21 件（glyph null 6）。`96db0fa` の `src` / `index.html` で `ui-icons` を import・参照している箇所は 0（`git grep`）。表示に影響しない。unit test は glyph が現在の出所に実在することを検査 |
| 8 | dev UI CSS 不変 | **OK** | `63235ce..96db0fa` の `main.css` 差分行のうち arena / debug-badge / perf / motion / testmode を含む行は 0 |
| 9 | legacy 構造・`basefile.html`・`src/legacy/parts/` 不変 | **OK** | `src/legacy/`（`concat-plugin.js` を含む）・`basefile.html`・`index.html` の差分 0 |
| 10 | 既存 `:root` 10 変数・JS / ミニマップの色・button 既定書体 | **OK** | `--bg` 〜 `--text-dim` の定義行に差分なし（computed 値も一致）。JS の差分なし。`font-family:inherit` 等の追加なし |
| 11 | computed style 比較 0 差分 | **OK** | §4 |
| 12 | タイトル / テストモードの画像一致 | **OK** | §4 |
| 13 | 3D 画面に visual regression なし | **OK** | §4（完全一致は要求せず、目視で差なし） |
| 14 | Build / Unit / E2E の照合 | **OK** | §5 |
| 15 | NOT_RUN を PASS に置き換えていない | **OK** | §6 |
| 16 | 既存 FAIL / FLAKY と C1 PASS を混同していない | **OK** | §6 |

## 4. 見た目の比較（Reviewer の再計測）

方法: `63235ce`（変更前）と `96db0fa`（実装）をそれぞれ Vite dev サーバで起動し、Reviewer 用のスクリプトで **全要素（`::before` / `::after` を含む）の computed style の全プロパティ** を取得（レイアウト寸法系 = width / height / top / left / transform 等のみ除外）。画面: 1280×800（非タッチ）/ 844×390（`hasTouch` + `isMobile`）× 通常 URL（タイトル・会話・酒場 HUD・メニュー・確認）/ `?dev=1`（テストモード画面・魔法使い選択・Arena・鑑定所「装備品」・鑑定所「スキル」）= 20 画面。Web フォントは両方とも未読み込み（同条件）。

| 比較 | 要素 | 値の数 | 差分 |
| --- | --- | --- | --- |
| 変更前 1 回目 vs 変更前 2 回目（比較手段のノイズ） | 9,024 | 3,474,500 | **0** |
| 変更前 vs 実装（`--ui-*` カスタムプロパティを除く） | 9,024 | 3,474,500 | **0** |

- 除いた `--ui-*` は新しく定義した 58 token そのもの（カスタムプロパティは全要素に継承されるため差として現れる）。既存 10 変数（`--bg` 等）は比較対象に含めており、差分 0。
- 画像（3D を含まない画面）: タイトル・テストモード画面・魔法使い選択 × 2 サイズ = **6 枚すべて SHA-1 一致**（変更前 2 回・実装の 3 者で一致）。
- 画像（3D を含む画面）: 会話・酒場 HUD・メニュー・確認・Arena・鑑定所 2 画面 × 2 サイズ = 14 枚は変更前同士でも一致しないため判定に使わない。844×390 メニュー、1280×800 鑑定所「スキル」ほかを変更前と並べて目視し、差は確認できなかった。

## 5. Build / Unit / E2E

| 区分 | Handoff の記載 | Reviewer の確認 |
| --- | --- | --- |
| Build | PASS | **PASS**（`96db0fa` worktree で再実行。`dist` の CSS に token が展開され、残る `@import` は Google Fonts のみ） |
| Unit | 1535 PASS / 0 FAIL | **1535 PASS / 0 FAIL**（再実行） |
| E2E 全件 | 165 / 165 PASS | **Implementer の実行ログで照合**: 末尾「165 passed (1.8h)」、✓ 165・✘ 0。Reviewer は全件を再実行していない |
| E2E（Reviewer targeted） | — | **11 / 11 PASS**: `ui-foundation`(2)・`dev-ui-gate`(4)・`chapter1-legacy-ui`(3)・`combat-test-arena`(1)・`settings`(1) |

Playwright はリポジトリ外の設定でブラウザ実行パスのみ差し替え（`playwright.config.js` 未変更）。

## 6. テスト状態の扱い（PASS として数えないもの）

| 区分 | 対象 | 扱い |
| --- | --- | --- |
| 既存 FAIL | `mansion-escort` Relaxed Stance | Implementer の全件実行では PASS だったが、**分類は既存 FAIL のまま**（C1 の PASS と混同しない） |
| 既存 FAIL | `execution-break` 通常敵 Break → EXECUTE | 同上。Human Decision により PASS / FLAKY に戻さない |
| FLAKY 記録 | `job-traits` 鷹の目 Turn Assist | 今回 PASS、FLAKY 記録は保持 |
| NOT_RUN | GitHub Pages 本番 URL での実機確認 | NOT_RUN のまま |
| NOT_RUN | Web フォント読み込み済みの表示 | NOT_RUN のまま（この環境では Google Fonts を取得できない。比較は変更前後とも同条件） |
| NOT_RUN | ダンジョン内 HUD（ボスバー・雑魚 HP・制限時間）・出撃画面・結果画面の撮影 | NOT_RUN のまま。これらの要素も DOM 上にあるため computed style 比較の対象には含まれる（非表示状態の値として差分 0） |

## 7. 指摘事項

| # | 区分 | 内容 |
| --- | --- | --- |
| R-1 | 情報 | `--ui-text` / `--ui-text-muted` / `--ui-surface-bg` は定義のみで `main.css` から未参照（既存の `--text` 等の参照を置き換えていない）。Plan §4.2 の semantic 一覧どおりで、Plan §12.2（既存変数と並存）とも整合。見た目に影響なし |
| R-2 | 情報 | `tests/ui-foundation.spec.js` の期待値は変更前の computed style を固定したもの。UI-002-V / C2 で値を意図して変える時は、Human の Visual Decision に基づいて期待値を更新する必要がある（spec のコメントに明記済み） |
| R-3 | 情報 | E2E 全件は Reviewer が再実行しておらず、Implementer の実行ログで照合した（CSS の値が完全に同一であることを静的・実行時の両方で確認済みのため） |
| 要修正 | — | なし |

## 8. 判定

| WI | 判定 |
| --- | --- |
| WI-C1-1 Token foundation | **PASS** |
| WI-C1-2 Panel component pilot | **PASS** |
| WI-C1-3 Icon registry | **PASS** |
| WI-C1-4 | 不採用（未実装を確認） |

**最終 Reviewer 判定: PASS**（Implementation SHA `96db0fa4d869b5412a6048be5cba551d475b533d`）

- main への merge / push は行っていない。Implementation SHA は書き換えていない。Handoff は書き換えていない。
- Task file の Status は **REVIEWING のまま**（Human の差分確認待ち）。
- 同一セッション兼務のため、人間による差分確認を推奨する。
