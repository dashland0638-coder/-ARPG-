# CHARACTER-VIS-001 / T-1 Review

## Review Target
| 項目 | 値 |
| --- | --- |
| Task ID | CHARACTER-VIS-001 / T-1（非戦闘歩行） |
| Branch | `claude/character-vis-001-t1-impl` |
| Reviewed SHA | `8f4566c2a17558b5b7e2310fe05b5735b4173470` |
| Diff range | `26f1b52bde9319711685fac51b4b174af321bc48..8f4566c2a17558b5b7e2310fe05b5735b4173470`（1コミット。`8f4566c^` = `26f1b52`） |
| Handoff Verification | V-1〜V-6（V-2a / V-4a / V-4b）すべて PASS（下表） |
| Analysis Source | `.ai/reports/CHARACTER-VIS-001-analysis.md`（branch `claude/character-vis-001-analysis-g029kj` @ `25b13a17f7b2f3ec9d61df8657b3c8f03ec5d054`、blob `cd6828266e4d29dffe3bc296ea210dd50d12472e`） |
| Plan Source | `.ai/tasks/CHARACTER-VIS-001.md`（branch `claude/character-vis-001-planner-kzh5di` @ `06990ef513fef9b271beb871c7791277c41f53a8`、blob `59b180881c86e990135706bae77610868fbcaece`） |
| Date | 2026-09-25 |

## Result
**PASS**（Blocking findings なし。Non-blocking findings N-1〜N-4 を記録）

## Independence
**同一セッションで兼務**（Implementer と同じ Claude Code セッション）。Implementer の自己評価は入力にせず、Reviewed SHA 時点の Task / Plan / `git diff` / 再実行したテスト結果で判定した。
**推奨: 人間による差分確認**（AGENTS.md §5）。

## Handoff Verification（git から再計算）
| # | 確認 | 結果 | 判定 |
| --- | --- | --- | --- |
| V-1 | Branch が remote に存在し Reviewed SHA へ到達可能 | `origin/claude/character-vis-001-t1-impl` 先端 = `8f4566c2…`、`merge-base --is-ancestor` 真 | PASS |
| V-2 | Task file へ到達できる | `git show 8f4566c:.ai/tasks/CHARACTER-VIS-001.md` 1行目 `# CHARACTER-VIS-001` | PASS |
| V-2a | `git diff 06990ef:<Task> 8f4566c:<Task>` | 削除行は1行のみ（Work Items 表 T-1 の Status `APPROVED` → `REVIEWING`）。他は Status History 3行追加と Implementation Result 節の追加。Approval 欄・計画本文に差分なし。Work Item を持つ Task では「Task の Status」は Work Item の Status（§7.2 読み替え）なので I-3 の範囲内 | PASS |
| V-3 | Plan が存在 | `git rev-parse 06990ef:<Task>` = `59b18088…`（Handoff と一致）。`06990ef` は `origin/claude/character-vis-001-planner-kzh5di` から到達可能。`git diff --name-only 06990ef^ 06990ef` = Task file のみ。T-1 Approval `[x]` | PASS |
| V-4 / V-4a | Analyzer report / blob 一致 | `git rev-parse 8f4566c:<Analysis>` = `cd682826…`（一致） | PASS |
| V-4b | Source SHA の到達性 | `25b13a1` は `origin/claude/character-vis-001-analysis-g029kj` から到達可能。`git diff --name-only 25b13a1^ 25b13a1` = Analysis のみ | PASS |
| V-5 | Implementation Result（Test Report・Changed Files） | Task file 末尾に存在 | PASS |
| V-6 | Diff range が空でなく終点 = Reviewed SHA | 10 files / +1089 −14、終点一致 | PASS |

Task file は承認済み版（blob `59b18088…`）から V-2a の差分だけで、承認済み版と一致する。

## Checklist
| # | 項目 | 結果 | 根拠 |
| --- | --- | --- | --- |
| 1 | Specification compliance | PASS | 下記「Implementation scope」 |
| 2 | Scope compliance | PASS（例外1件、承認記録あり） | Files To Change #1/#2/#3/#4/#8/#9/#10 + `concat-plugin.js`（N-1） |
| 3 | Regression | PASS | 既存 E2E 28件 PASS（報告）。walkW=1 で従来の基準・係数と一致（コード・U-1） |
| 4 | Build | PASS | Reviewer 再実行 `npm run build` ✓ |
| 5 | Unit tests | PASS | Reviewer 再実行 `npm run test:unit` 1506/1506 |
| 6 | E2E tests | PASS（repo 標準設定は NOT_RUN） | 下記「Tests」 |
| 7 | Save/Load integrity | PASS | セーブ形式・`09-save-load.js` 差分なし。`save-load.spec.js` 6件 PASS（報告） |
| 8 | Existing behavior | PASS | 戦闘態勢中は構え（STANCE）基準に戻る（E-1 WALK 1.00） |
| 9 | Code duplication | PASS | 補間は既存 `blendPose` を再利用。休め姿勢は既存 `activeRelaxedStance()`、ウェイトは既存 `relaxCombatBlend` |
| 10 | Unnecessary architecture changes | PASS | 新しい歩行システム・状態機械なし。フレーム順（`stepRelaxedBlends` の位置）不変 |

## Implementation scope（diff と実装コードで独立確認）
| 確認事項 | 根拠（FACT (code)、`8f4566c`） | 判定 |
| --- | --- | --- |
| 非戦闘移動時の腕の基準が STANCE_RELAXED 側 | `13-update-loop.js` `updateLocomotion()`: `armBase = locomotionArmBase(<armLBase 等>, activeRelaxedStance(cls, alt, job), walkW)`、`walkW = relaxCombatBlend`。`locomotionArmBase` は `blendPose(relaxed, combat, w)` で w=0 → 休め。腕の書き込み（通常・滞空）とも `armBase` を使用 | PASS |
| relaxCombatBlend / blendPose を既存機構として利用 | `relaxCombatBlend` は既存変数を読むのみ（`05` の更新式・位置に差分なし）。`blendPose` は `core/combat-stance.js` から import（同ファイル差分なし） | PASS |
| 戦闘時は従来の STANCE へ戻る | combat 側入力は `P.armLBase` 等（`buildPlayer()` が `activeStance()` から複製した従来値）。w=1 で完全一致（U-1）。腕振り係数・run 倍率も `locomotionMix(…, 1, 1)` = 従来値 | PASS |
| 脚の振り不変 | `legL/legR/kneeL/kneeR` の書き込み行・`swing` 式は diff の文脈行のみで変更なし | PASS |
| 歩調係数 2.7 不変 | `strideT += moveSpeed * dt * 2.7` に差分なし | PASS |
| アナログ入力の倒し量不変 | `inputMag` に差分なし（`13` の diff に該当なし） | PASS |
| 移動速度不変 | `speed = classDef.spd` 周辺・`01-character-creation.js` に差分なし | PASS |
| STANCE / CLIPS 不変 | `05-rendering-rig.js` の差分は `motionRigSnapshot()` の読み取り2行のみ | PASS |
| T-2 以降（体格・頭身・関節・マテリアル）なし | `BUILD`・`06-player-enemy.js`・`WEAPON_SOCKET` に差分なし | PASS |
| 上半身の run 由来項（D-3 (a) Step 4） | 腰 pitch・bob は `runUpper = run * locomotionMix(0.35, 1, walkW)`、前傾は `* locomotionMix(0.5, 1, walkW)`。足音 `playFootstep(run)`・土煙は元の `run` のまま | PASS |
| Files Not To Change | `08-loot-equipment.js` / `11-combat-actions.js` / `melee-hit.js` / `combat-stance.js` / `basefile.html` / `playwright.config.js` / `package.json` に差分なし | PASS |

## Scope 例外: `src/legacy/concat-plugin.js`
- 差分は relaxed-idle.js の import 一覧への4識別子追加1行のみ（FACT）
- 必要性: `src/legacy/parts/*.js` に `import` 文を持つファイルは0件（`grep -lE "^\s*import " src/legacy/parts/*.js` ヒットなし）。legacy parts は concat-plugin の HEADER の import でしか `src/core/` を参照できない（ARCHITECTURE.md「互いに import/export を一切使わない」）。Step 1（core の純粋関数）を Step 2（`13` の `updateLocomotion`）で使うには HEADER への追加が構造上必須（FACT）
- 最小性: 追加した4識別子はすべて `13-update-loop.js` で使用されている（FACT）。他の変更なし
- 承認: Implementation Result に Human の承認（2026-09-25、Implementer セッションの質問への回答）と根拠が記録されている
- 判定: **T-1 実装に必要な最小変更。許容**（N-1: 計画の Files To Change 漏れとして記録）

## Persistence 例外（確認事項）
- FACT: 承認済み版の T-1 Approval 欄 `Persistence:` は空欄（「空欄 = 未許可」）。Reviewed SHA でも空欄のまま（V-2a で差分なし）
- FACT: Implementation Result に、ユーザー（人間）が 2026-09-25 に Implementer セッションの会話で「Implementation Persistence: Branch: claude/character-vis-001-t1-impl. Persistence is permitted for T-1 only.」と明示した旨と、Approval 欄を I-3 のため書き換えていない旨が記録されている
- Protocol 上の判断:
  - §6 の文言（「Approval 欄の `Persistence` が `許可` で、対象ブランチ名が書かれている場合に限り」）は**字義どおりには満たしていない**
  - 一方、§5.2 / §7.3 I-3 は Plan Handoff で pin した承認済み版の Approval 欄を Implementer が変更することを禁じており、pin 後に人間が Persistence を与えた場合の記録先を Protocol が定めていない（Protocol の欠落）
  - §6 の実質要件（人間の明示的な指示・対象ブランチ・誰/いつ/どこの根拠の記録、AI が自分で許可にしない）は満たされている。push 先は指示されたブランチのみで、`main` への push・force push はない
  - **判定: 実装内容の不備ではなく Protocol の記録先の欠落として扱い、Blocking にしない（N-2）**。Task file は書き換えて整合させない（指示どおり）。人間による確認と Protocol 側の手当て（pin 後の Persistence の記録先の規定）を推奨する

## Tests
| テスト | 報告 | Reviewer 再確認 | 判定 |
| --- | --- | --- | --- |
| `npm run test:unit` | 1506/1506 PASS | 再実行 1506/1506 PASS | PASS |
| `npm run build` | PASS | 再実行 PASS | PASS |
| E-1（`character-motion.spec.js:394`） | 修正後2回連続 PASS | scratchpad 設定で再実行 PASS（43.9s） | PASS |
| 関連 E2E 既存28件 | PASS | 再実行していない（報告のみ。E2E ログはリポジトリ外で、ログ上 28 passed / E-1 初回 1 failed を確認） | PASS（報告） |
| repo 標準設定の E2E | NOT_RUN（Chromium revision mismatch） | 再現: `Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1234/...` | NOT_RUN（実行環境） |
| repo の Playwright 設定変更 | なし | `playwright.config.js` / `package.json` 差分なし | PASS |

- E-1 の初回失敗（テストの読み取りタイミング）の後、テスト側の待ち方のみ修正されている。実装コードとの関係: 失敗時スナップショットのパネルは `WALK 1.00` で期待値どおり（FACT、Implementation Result 記載と整合）。修正はコミット前で Reviewed SHA に含まれており、Reviewed SHA のテストは PASS
- NOT_RUN の回避策はリポジトリ外（§14「実行環境の問題」の規定どおり）

## Visual（V-1）
- `test-results/motion-warrior-walk-combat.png`（Reviewer の E-1 再実行で生成）を確認: 戦闘態勢移動中、パネル `WALK 1.00`、大剣を両手で構えた腕（`EL.L -104.0 / EL.R -124.3`）
- `test-results/motion-warrior-walk-exploration.png` を確認: 非戦闘移動中、パネル `WALK 0.00`、武器は背中に収納、腕は下りている（`EL.L -30.0 / EL.R -17.3`）
- 確認は剣士・見下ろし視点の静止画のみ。**他職（盗賊・魔法使い・弓師・上位職）、正面視点、歩行の動き（腕振りの振幅・上半身の落ち着き）は visual confirmation unavailable**。これらは Test Plan V-1 どおり Human 確認事項
- スクリーンショットはリポジトリに含めていない

## Changed Files
`src/core/relaxed-idle.js`、`src/legacy/parts/13-update-loop.js`、`src/legacy/parts/05-rendering-rig.js`（読み取りのみ）、`src/core/motion-preview.js`、`src/legacy/concat-plugin.js`（例外、上記）、`tests/unit/relaxed-idle.test.js`、`tests/unit/motion-preview.test.js`、`tests/character-motion.spec.js`、`.ai/tasks/CHARACTER-VIS-001.md`（V-2a）、`.ai/reports/CHARACTER-VIS-001-analysis.md`（V-4a）

## Out of Scope Changes
None（`concat-plugin.js` は Human 承認済みの例外。N-1）

## Non-blocking Findings
| # | 内容 | 扱い |
| --- | --- | --- |
| N-1 | 計画の Files To Change に `src/legacy/concat-plugin.js` が無かった（legacy から core を使う計画では常に必要）。今回は Human 承認で追加 | 今後の Planner は legacy から新しい core 関数を使う場合に concat-plugin を Files To Change に含める |
| N-2 | T-1 Approval 欄の Persistence が空欄のまま push（会話上の Human 許可を Implementation Result に記録）。Protocol に pin 後の Persistence の記録先が無い | Human 確認と Protocol の手当てを推奨。本 Review の Reviewer Persistence も同じ Human 許可と本 Review 依頼の指示に依る |
| N-3 | 腕の書き込みが `rotation.x` のみから `rotation.set(x, y, z)` になった（基準の y/z も休め側へ寄せるため）。戦闘側（walkW=1）では y/z も構えの値になり、従来は他の書き手（applyPose）の値が残っていた。直後の `applyCombatIdlePose` が同じ構えへ寄せるため実害は確認されない（E2E PASS） | V-1 で Human が戦闘態勢移動の見え方を確認 |
| N-4 | `05` の `applyRelaxedIdlePose()` 前のコメント「停止中の出力は実質いつもクラスの構え」が T-1 後の非戦闘時と合わない（Implementer も Out of Scope Found に記録）。05 は読み取り追加のみ承認のため未変更 | 別途コメント更新（T-1 の承認範囲外） |

## Risks
- P-R1（1フレーム前の `relaxCombatBlend`）: 戦闘突入の1フレームだけ休め寄り。攻撃中は `busy` で腕を書かないため影響は小さい（INFERENCE）。E-1 で遷移を確認
- P-R2 / N-3: 戦闘態勢の立ち上がり・移動中の見え方は目視 V-1 に依存
- repo 標準設定の E2E は Chromium revision mismatch で実行できない環境（NOT_RUN）。CI 等の標準環境での確認は未実施

## DONE 判定（§7.3）
- Result PASS: 満たす
- Reviewed SHA = T-1 の最新 Implementation SHA（`8f4566c` 以降に Files To Change を変更するコミットなし）: 満たす
- review report が remote の Branch に存在: 本 report の push で満たす
- → T-1 は `REVIEWING → DONE`。Task Level の Status は T-2〜T-5 が未完了のため `PLANNED` のまま（§7.1）

## Required Changes
None
