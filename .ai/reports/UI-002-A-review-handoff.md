# UI-002-A Review Handoff（WI-A1〜WI-A5）

作成: Implementer / 2026-09-27 / Claude Code セッション（UI-001 以降と同一セッション。Reviewer の独立性は AGENTS.md §5 に従い Review 側で明記すること）

本書は AGENTS.md §5.1 の Review Handoff に、Human の指示（2026-09-27）による Test Report の引き継ぎ事項を加えたもの。**Reviewer の判定はまだ行っていない。**

## 1. Review Handoff（AGENTS.md §5.1）

| 項目 | 値 |
| --- | --- |
| Task ID | UI-002-A / WI-A1, WI-A2, WI-A3, WI-A4, WI-A5 |
| Branch | `claude/ui-002-a-impl` |
| Implementation SHA | `aa29d4c9c8d137b92423b9099ba3f525aaa2e7c4`（**レビュー対象の固定実装**。これ以降の commit は本 Handoff 文書・Task file の Status 更新のみ） |
| Diff range | `7d4afa79864fbc3be55b47e7c3df8bace6c83b56..aa29d4c9c8d137b92423b9099ba3f525aaa2e7c4`（1 commit。起点 `7d4afa7` = 承認・Persistence 記録済みの Task file を含む `claude/ui-002-a-task-update` の先端） |
| Task file | `.ai/tasks/UI-002-A.md`（Implementation SHA 時点の版を読むこと） |

Implementer 側で確認した前提（Reviewer は自身で再検証すること）:

| # | 確認 | Implementer の確認結果 |
| --- | --- | --- |
| V-1 | Branch が remote にあり Implementation SHA に到達可能 | `git merge-base --is-ancestor aa29d4c origin/claude/ui-002-a-impl` 成功 |
| V-2 | Implementation SHA から Task file へ到達可能 | `git cat-file -e aa29d4c:.ai/tasks/UI-002-A.md` 成功。Plan Handoff（Kind `plan`）は受けていない（Task file の承認は同一ブランチ系列の記録） |
| V-3 | Plan が存在 | Task file（Work Items・各 WI の Approval）。参照: `.ai/reports/UI-002-A-plan-v2.md` |
| V-4 | Analyzer report | `Analysis:` 新形式。V-4a: `git rev-parse aa29d4c:.ai/reports/UI-002-A-analysis.md` = `583bd83e937b748fb5a17e330591f49897aeb8dd`（一致）。V-4b: `99f1fbd` は `origin/claude/ui-002-a-analysis` から到達可能 |
| V-5 | Implementation Result | Task file 末尾の「Implementation Result（WI-A1〜WI-A5）」 |
| V-6 | Diff range が空でなく終点が Implementation SHA | 10 files changed（`7d4afa7..aa29d4c`） |

Diff range に含まれるファイル: `index.html`、`src/legacy/parts/08-loot-equipment.js`、`10-input.js`、`11-combat-actions.js`、`12-progression-ui.js`、`14-hud-boot.js`、`tests/chapter1-legacy-ui.spec.js`（新規）、`.ai/tasks/UI-002-A.md`（Implementation Result・Status）、`.ai/reports/UI-002-A-analysis.md` / `.ai/reports/UI-002-A-plan-v2.md`（Artifact Handoff I-1 による同梱。blob 一致、内容変更なし）。

## 2. Test Report（引き継ぎ。PASS / FLAKY / FAIL / NOT_RUN を区別する）

### 2.1 集計

| 区分 | 件数 / 結果 |
| --- | --- |
| Build（`npm run build`） | PASS |
| Unit（`npm run test:unit`） | 1527 PASS / 0 FAIL |
| E2E（`npm test`、全 159 件、1 worker） | PASS 156 / FAIL 1 / FLAKY 2 |

- E2E の PASS 156 件には、新規の UI-002-A E2E 3 件（`tests/chapter1-legacy-ui.spec.js`: 本編新規 / 本編旧セーブ / テストモード）を含む。新規 3 件は変更前コードでは 3 件とも失敗することを確認済み。
- Playwright の全体実行の出力は「156 passed / 3 failed」。3 failed のうち 2 件は単独再実行で PASS したため FLAKY、1 件は既存 FAIL として下記に分けている。**FLAKY・既存 FAIL を PASS として数えていない。**

### 2.2 既存 FAIL（未解消。PASS ではない）

| 項目 | 内容 |
| --- | --- |
| テスト | `tests/mansion-escort.spec.js`「非戦闘・停止中は Relaxed Stance がリグに効いている(仕様 13)」 |
| 実装後 | FAIL |
| 再実行 | FAIL（`--repeat-each=3` で 3 回とも FAIL） |
| 実装前コード | 同じ失敗を確認（`git stash` で変更前に戻して実行。5 回中 4 回、同じ値 0.88 で FAIL） |
| 失敗内容 | 「立ち止まっても休めの姿勢へ戻らない」: `again.relax` = 0.88、期待値は 0.9 超 |
| テストの性質 | テストモードでの時間依存の姿勢判定（歩行後 2.5 秒待って relax を読む） |
| 判断 | UI-002-A の WI-A1〜A5 の変更とは無関係と判断（本編 UI の表示・入力の抑制のみで、テストモードの挙動・モーションは変更していない） |
| Human Decision（2026-09-27） | 本 FAIL は UI-002-A 実装とは無関係な既存問題として扱い、WI-A1〜A5 の Review を進めることを承認。**ただし PASS と扱わず、既存 FAIL として Reviewer に引き継ぐ** |
| 扱い | 今回の実装による回帰 FAIL とは扱わない。**FAIL 自体は未解消**。UI-002-A では修正しない（スコープ外） |

### 2.3 FLAKY（PASS ではない）

| テスト | 初回（全体実行） | 再実行 | 対象変更との関係 |
| --- | --- | --- | --- |
| `tests/execution-break.spec.js`「通常敵: 体幹を削る → Break → EXECUTE → フィニッシャー → 通常戦闘へ復帰」 | FAIL（「Execution で通常攻撃の型が再生されている」） | 単独再実行で PASS | テストモードの戦闘タイミング。本変更はテストモードの挙動を変えない（INFERENCE: 無関係）。変更前コードでの比較は未実施 |
| `tests/job-traits.spec.js`「Predictive Aim / Turn Assist: 鷹の目が回避直後に予兆中の敵へ向きを寄せる」 | FAIL（spec 内の自動リトライ 3 回とも「回避直後の攻撃でTURN ASSISTが発火すること」） | 単独再実行で PASS | テストモードのタイミング依存（INFERENCE: 無関係）。変更前コードでの比較は未実施 |

### 2.4 NOT_RUN（PASS ではない）

| 対象 | 状態 | 理由 |
| --- | --- | --- |
| 撤退ボーナス（撃破後の撤退確認・トースト）の実画面 | コード分岐のみ確認（`10-input.js` の `menu-town`、`12-progression-ui.js` の `performRetreat()`） | この環境の描画速度（SwiftShader）ではダンジョンを最後まで進行できず、実画面確認ができなかった |
| ボス撃破の結果画面（💎 報酬行・加算）の実画面 | コード分岐のみ確認（`showBossResultScreen()`、`addItem()`） | 同上 |
| 宝箱の中身（💎 / 🔩 の抽選・トースト）の実画面 | コード分岐のみ確認（`rollCommonChestLoot()`、`grantItem()`） | 同上 |

### 2.5 Playwright 実行環境

- リポジトリ標準の Playwright（`@playwright/test` ^1.56）が要求する headless shell ブラウザがこの環境に存在しなかった。
- そのため **リポジトリ外**（セッションの scratchpad）に、`playwright.config.js` を読み込んで `use.launchOptions.executablePath` を `/opt/pw-browsers/chromium` に、`outputDir` をリポジトリ外に差し替えるだけの設定ファイルを置き、`npx playwright test --config <その設定>` で実行した。
- **`playwright.config.js` 自体は変更していない**（Diff range に含まれない）。

## 3. Reviewer への確認依頼（WI ごとに独立して確認）

| WI | 確認項目 |
| --- | --- |
| WI-A1 | Chapter 1 の XP UI が除去されている / 撤退報酬に XP が残っていない / Level・XP の内部 state・save data を変更していない / Test Mode を変更していない |
| WI-A2 | Chapter 1 で Skill 3 が表示・入力・activation のいずれも使用できない（U / 十字キー左 / タップを含む）/ Skill 3 関連 Toast・warning が出ない / 旧セーブの Skill 3 state を破壊していない / Test Mode を変更していない |
| WI-A3 | Chapter 1 の一括鑑定・個別鑑定操作が利用できない / 未鑑定品のデータを破壊していない / 未鑑定品の表示行を変更していない / 「鑑定所」という画面名を変更していない / 鍛冶士画面の構成を変更していない |
| WI-A4 | 「鑑定ボタン」「出撃ボタン」等の誤った説明が修正されている / Skill 1・Skill 2 は説明文だけを修正し機能を変更していない / 「チャージ攻撃」を復活させていない / Ult の「リチャージ制」が修正されている / 新しい操作体系を追加していない |
| WI-A5 | Chapter 1 の 💎 / 🔩 表示が抑制されている / 新規取得されない / 強化導線が出ない / 既存セーブの所持数を破壊していない / 実際に付与されない 💎 / 🔩 報酬行が結果画面に表示されない / 報酬の自動置換をしていない / ボス固有報酬名を変更していない / Test Mode を変更していない |

Implementer からの注記（Reviewer の判断材料。判定ではない）:

- WI-A3: 未鑑定品の行のうち、名前「未鑑定の装備」と説明「鑑定するまで効果は分からない」は維持し、行内の「鑑定 🪙n」ボタンだけを Chapter 1 で出さないようにした（鑑定操作へ直接進む導線と判断）。行のボタン欄は空になる。この扱いが「未鑑定品の表示行を変更しない」に適合するかは Reviewer の確認対象。
- WI-A4: 旧文言「溜めボタン(長押し・鑑定所でタイプ変更可)」は行ごと「スキル1: L / Y・△ / スキルボタン」に置き換えたため、「鑑定所でタイプ変更可」の記述も無くなっている（Skill 1 の付け替え自体は UI-002-F の範囲で、機能は変更していない）。
- WI-A5: 💎 / 🔩 の加算停止は `grantItem()` / `addItem()` の共通入口で行っており、宝箱・ボス報酬に加えてミミック撃破・異空間報酬の経路も Chapter 1 では加算しない。
- `.menu-controls` と `#hud-hint` の固定文言について: `#hud-hint` の Skill 3 部分は Chapter 1 のみ非表示（テストモードでは表示）。`.menu-controls` は両モード共通の文言を修正している（テストモードの挙動は変更していない）。

## 4. 禁止事項（Reviewer / 以降の工程）

- main への merge / push をしない
- Implementation SHA を変更しない（レビュー対象は `aa29d4c`）
- 既存 FAIL を修正するためのスコープ外変更をしない
- FLAKY / NOT_RUN を PASS に変更しない
- WI-A1〜A5 の承認範囲を変更しない
