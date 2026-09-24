# CHAPTER-STRUCTURE-T1 Review

Reviewer / READ ONLY（コード変更なし）。対象: CHAPTER-STRUCTURE / Work Item T-1
Plan: [`../tasks/CHAPTER-STRUCTURE-T1.md`](../tasks/CHAPTER-STRUCTURE-T1.md) / Analysis: [`CHAPTER-STRUCTURE-T1-analysis.md`](CHAPTER-STRUCTURE-T1-analysis.md)

> 注: 本セッションでは Implementer と Reviewer を同じ AI が兼務している（`../AGENTS.md` §5 で許容）。
> 独立したレビューではないため、人間による差分の確認を推奨する。

## Result

**PASS**

## Checklist

| # | 項目 | 結果 | 根拠 |
| --- | --- | --- | --- |
| 1 | Specification compliance | PASS | AC-1: `beginTestMode()` が `defaultSkill1For(classKey)` を使う（`14-hud-boot.js:1375`）。AC-2: E2E で魔法使い（宵待ちの村）の `#btn-charge-icon` = 👣 を確認。トレーニング空間起動も同じ行を通る（`:1375` は `:1402` の `finishEnteringGame` より前で分岐なし）＝コード読みで確認、E2E は未検査。AC-3: 剣士・盗賊・弓師は `defaultSkill1For` が `retreat` を返す（unit `chapter1-rules.test.js:58`）。AC-4: 上位職は基礎クラスキーで決まる（`classKey` を渡している）。上位職の起動 E2E（`job-traits` / `character-motion`）PASS |
| 2 | Scope compliance | PASS | 差分は `src/legacy/parts/14-hud-boot.js` 1行と `tests/scenario-test-mode.spec.js` 1行のみ（Files To Change と一致）。T-2〜T-4・MAGE-001・本編には差分なし |
| 3 | Regression | PASS（flaky 1件は無関係と判断） | 下の Test Result 参照 |
| 4 | Build | PASS | `npm run build` |
| 5 | Unit tests | PASS | `npm run test:unit`: 1490 / 1490 |
| 6 | E2E tests | PASS（対象8ファイル） | 43 passed / 1 flaky。全体 `npm test` は未実行（理由は下記） |
| 7 | Save/Load integrity | PASS | `scenario-test-mode` の実セーブ不変検査、`save-load.spec.js` 全件 PASS。セーブ形式・state フィールドの変更なし |
| 8 | Existing behavior | PASS | `chapter1-progression`（本編の交代と 👣）、`save-load`（新規開始・つづきから）、`auto-combo`（剣士テストモードの既定 `retreat` の挙動）PASS |
| 9 | Code duplication | PASS | 既存の `defaultSkill1For` を再利用。新規関数・定数なし |
| 10 | Unnecessary architecture changes | PASS | なし |

## Changed Files

| ファイル | 差分 |
| --- | --- |
| `src/legacy/parts/14-hud-boot.js` | `:1375` `state.skillChoice = 'retreat';` → `state.skillChoice = defaultSkill1For(classKey);` |
| `tests/scenario-test-mode.spec.js` | 1件目のテストに `#btn-charge-icon` = `👣` の検査を1行追加 |

## Test Result

| 対象 | 結果 |
| --- | --- |
| `npm run build` | PASS |
| `npm run test:unit` | 1490 PASS / 0 fail |
| E2E: `scenario-test-mode` / `auto-combo` / `job-traits` / `chapter1-progression` / `save-load` / `duskvillage` / `road` / `character-motion` | **43 passed, 1 flaky**（29.6 分） |

flaky の1件: `job-traits.spec.js:162`「Predictive Aim / Turn Assist: 鷹の目が回避直後に予兆中の敵へ向きを寄せる」。
初回で `TURN ASSIST が発火すること` が false、spec 自身が持つ自動リトライで PASS。

- FACT: この describe はテスト名に「タイミング依存（自動リトライあり）」と明記されている
- FACT: 対象は弓師の上位職（鷹の目）。弓師の Skill 1 既定は変更前後とも `retreat`（`defaultSkill1For('archer')`）
- FACT: 検査しているのは回避直後の攻撃の向き補正で、Skill 1 は使っていない（同テスト内に `KeyL` / `btn-charge` の操作なし）
- INFERENCE: T-1 の変更とは無関係のタイミング揺れ。変更前コードでの再実行による比較は行っていない（未確認）

`npm test`（全 spec）を実行しなかった理由: 対象8ファイルだけで約30分（SwiftShader 環境）。T-1 の影響経路（テストモード起動時の Skill 1 既定）を通る spec を Plan の Test Plan どおり選んで実行した。

## Environment Note

この環境の Playwright（1.62.1）が要求するブラウザのリビジョン（1234）が未導入で、そのままでは全 E2E が起動前に失敗した。
リポジトリは変更せず、スクラッチパッドに既存ブラウザ（1194）へのシンボリックリンクを置いた `PLAYWRIGHT_BROWSERS_PATH` を指定して実行した。

## Out of Scope Changes

なし。

## Risks

- トレーニング空間起動での 👣 は E2E で検査していない（コード経路で確認のみ）
- flaky 1件の変更前比較は未実施

## Required Changes

None
