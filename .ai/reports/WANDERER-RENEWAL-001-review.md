# WANDERER-RENEWAL-001 Review

## Round 1/3

## Review Target
| 項目 | 値 |
| --- | --- |
| Task ID | WANDERER-RENEWAL-001 |
| Branch | `claude/wanderer-renewal-001-nhlxns` |
| Reviewed SHA | `8b06133aaee265c350da438202dd16444b703a17` |
| Diff range | `eebf0244c26d80fdf44d7daa86f4989addb414f2..8b06133aaee265c350da438202dd16444b703a17`（1 commit、37 files、+1462 / −135） |
| Handoff Verification | V-1 OK（remote のブランチ先端 = Implementation SHA）/ V-2 OK（Task file 到達可）/ V-2a OK（Plan Source `eebf0244`:Task → Implementation SHA:Task の差分は `Status:` 行と、Status History の行追加 + Implementation Result 節の追加（hunk `@@ -143,0 +144,64 @@`）だけ）/ V-3 OK（Implementation Plan Step 1〜9）/ V-4 OK・V-4a OK（`git rev-parse 8b06133:.ai/reports/WANDERER-RENEWAL-001-analysis.md` = `6f4d955a7aacaa6a7096d3993d13ca0209e5e431` = 記録の Blob SHA）・V-4b OK（`d53532b6` はブランチから到達可能）/ V-5 OK（Implementation Result に Test Report・Changed Files）/ V-6 OK（差分は空でなく、終点 = Implementation SHA） |
| Analysis Source | `.ai/reports/WANDERER-RENEWAL-001-analysis.md`（`claude/wanderer-renewal-001-nhlxns` @ `d53532b6e9573ae683f835e8601698334d851e42`、blob `6f4d955a7aacaa6a7096d3993d13ca0209e5e431`） |
| Plan Source | `.ai/tasks/WANDERER-RENEWAL-001.md`（`claude/wanderer-renewal-001-nhlxns` @ `eebf0244c26d80fdf44d7daa86f4989addb414f2`、blob `452810a63236b23a7999edd03d47f380baf3708f`） |

## Result
CHANGES_REQUIRED

## Independence
別 Agent・別セッション（Orchestrator から起動された、別コンテキストの Reviewer subagent。Implementer の判断過程は入力にしていない）

## Checklist
| # | 項目 | 結果 | 根拠 |
| --- | --- | --- | --- |
| 1 | Specification compliance | **NG（1 件）** | AC「3 段目・Skill 1・Skill 2 の追撃が 0.45 秒後に当たり、残像が見えている。**会話・遷移で落ちる**」のうち「会話で落ちる」が成立していない（Required Change #1）。遷移（`disposeWorld` / 地点移動）・主人公の交代では落ちる。それ以外の AC（影の旅人のクリップ・閃き・影の紫の独立 Material・加入前の姿・他 4 人不変・旧セーブ）はコードと unit で裏づけを確認 |
| 2 | Scope compliance | OK（軽微な記載漏れあり） | Files To Change に無い `src/legacy/parts/02-world-common.js`（遷移で追撃を落とす 1 行）、`10-input.js`（回避の残像 2 行）、`src/core/weapon-state.js`（抜刀時間の表に wanderer 行）が変更されている。いずれも Plan Step 3 / 6 の実施に必要な最小差分で、Implementation Result の Changed Files には記載あり。DEC-034 の代わりに AGENT-DECISIONS.md AD-005 にした変更も理由つきで記録済み。OUT OF SCOPE（他職・マップ・敵・BGM/SE・必殺技の数値）は触っていない |
| 3 | Regression | OK | `rigKeyOf(cdef)` は `wandererRigKey(cdef.key, cdef.charKey)` で、charKey が 'wanderer' 以外なら `classDef.key` をそのまま返す → 4 職・上位職は CLIPS / STANCE / STANCE_RELAXED / GRIP_OFFSET / WEAPON_SOCKET / MOVE_SFX / DODGE・JUMP・LOW_HP_MOTION / COMBO_LENGTH / 抜刀時間の引き当てが従来と同じキー。`rigKeyOf(null)` が 'warrior' を返す点だけ従来（undefined）と違うが、呼び出し箇所は classDef 確定後か、結果が同じになるフォールバック（`ultClipName` / `executionClipName`）だけ。`dealDamageToEnemy` は `opts.fromPos || state.pos` で、opts 省略時は従来どおり（`opts = opts || {}` が先頭にある） |
| 4 | Build | PASS | `npm run build`（Reviewer が再実行、chunk size の既存警告のみ） |
| 5 | Unit tests | PASS | `npm run test:unit`（Reviewer が再実行: 2330 中 pass 2329 / skip 1 / fail 0） |
| 6 | E2E tests | 未実行（Reviewer） | 指示により Playwright は実行していない。Test Report: Targeted 97 件中 96 PASS + 1 FLAKY（auto-combo、再実行で PASS）。新規 `tests/wanderer-renewal.spec.js` は会話中に追撃が落ちることを確認していない（Required Change #1 の確認方法を参照） |
| 7 | Save/Load integrity | OK | 新しいセーブ項目なし（09-save-load.js 不変）。`CHARGE_VARIANTS_BY_CLASS.wanderer.retreat` が増えたため、旧セーブの `skillChoice:'retreat'`（selectedClass 'wanderer'）の復元は従来の「既定へ戻す」から「そのまま復元」になるが、値は同じ 'retreat'。`learnedSkill2` は主人公交代で false に戻る既存の経路（`switchProtagonist`）のまま |
| 8 | Existing behavior | OK（#1 を除く） | 酒場の隅の人物は `buildRoadTravelerFigure(true)` へ統一（旧コードの変数への残参照なし）。`trackPreJoinShadow` が使う `userData.pool` は縮めない直下の子として維持。紫の PointLight は既存の 1 灯のまま（光源は増えていない）。閃きは `selectedClass === ROAD_JOINER && road2Joined` のときだけ、`hasSkill2` で二重習得なし、テストモードでは起こさない。z の帯（エリア 4 = 450〜640、エリア 5 = 640〜）から z ≥ 626 の取りこぼし判定は峠の手前に限られる |
| 9 | Code duplication | OK | 判定は既存の `dealDamageToEnemy` / `guardianAbsorbs` / `isBossAccessible` / `checkMimicRevealInRange` / `executeVariant`（Skill 1 は 'retreat' の variant として既存の汎用経路）に乗せている。追撃の待ち行列は pendingSkill2 と同じ作法。`spawnShadowArcVFX` は `spawnSweepVFX` の原点違いで、理由がコメントにある |
| 10 | Unnecessary architecture changes | OK | 新 part `17-wanderer-style.js` と core `wanderer-style.js` は計画どおり。kit 'warrior' を残し、表引きの鍵だけ足す最小構成（WR-3）。共有スコープの評価順: 14-hud-boot.js の起動（`initThree` → `buildWorld` → `disposeWorld` → `clearWandererEchoes()`）は 17 の評価より前に走るが、参照する `wandererEchoes` / `wandererAfterimages` を `var` にしてあり TDZ にならない（関数宣言は巻き上げ）。起動時に `buildPlayer` は呼ばれず（タイトル表示まで）、`animate()` の同期 1 回目も `state.started` が false なので `STANCE.wanderer` 等の未設定を踏まない |

## Changed Files
- core: `src/core/wanderer-style.js`（新規・純関数）、`src/core/weapon-state.js`（wanderer の抜刀時間）
- legacy: `concat-plugin.js`、`01`、`02`、`03`、`05`、`06`、`07`、`10`、`11`、`12`、`13`、`14-dungeon-road.js`、`14-dungeon-road2.js`、`14-hud-boot.js`、`15`、`17-wanderer-style.js`（新規）
- tests: `tests/unit/wanderer-style.test.js`（新規）、`tests/wanderer-renewal.spec.js`（新規）、`tests/unit/road-stranger.test.js` / `wanderer-attack-color.test.js` / `mansion-insight.test.js`（新仕様への追従。旧仕様の「kit のまま」の検査を、自前の数値 + 剣士/盗賊の間にあることの検査へ置き換え。弱めてはいない）
- docs: `docs/CHARACTERS.md` / `COMBAT.md` / `SCENARIOS.md` / `CHAPTER1_STORY.md` / `GAME_DESIGN.md`、`.ai/decisions/AGENT-DECISIONS.md`（AD-005）
- `.ai/tasks/WANDERER-RENEWAL-001.md`（Status / History / Implementation Result）、`.ai/reports/img/WANDERER-RENEWAL-001/*.jpg`

## Out of Scope Changes
None（Files To Change への記載漏れ 3 件は Checklist #2 のとおり、計画の Step に必要な最小差分）

## Risks
- R-a（INFERENCE）: 残像は `player.clone(true)` でジオメトリを共有する。主人公の作り直し（`buildPlayer`）でリグのジオメトリが dispose された後も残像が残っていると、three.js が再アップロードする。追撃は交代・遷移で落ちるので実害は小さい
- R-b: 追撃の効果音は既存キュー（slashLight）の流用（Out of Scope Found に記載済み）
- R-c: docs/CHARACTERS.md「被弾・ダウン・ジャンプ・歩き/走りは全キャラクター共通の仕組み」と、`JUMP_AIR_MOTION.wanderer`（滞空の型の行を追加）がわずかに食い違う（同じ節の「回避・滞空・低HP の型は剣士の重装の型を使わない」とは整合）。必須ではない
- R-d: auto-combo の FLAKY は変更前コードとの比較なし（Test Report に明記）。影の旅人の経路を通らない spec

## Required Changes
| # | ファイル / 箇所 | 問題（根拠: AC / docs / Decision / テスト） | 期待する状態 | 確認方法 |
| --- | --- | --- | --- | --- |
| 1 | `src/legacy/parts/17-wanderer-style.js:170-175`（`updateWandererEchoes` の打ち切り条件）と、その呼び出し元 `src/legacy/parts/13-update-loop.js:504` / `src/legacy/parts/14-hud-boot.js:1407-1409`（`animate` の `if(state.started && !state.paused && !state.dialogueActive){ ... updatePlayer(dt); ...}`） | AC「追撃…会話・遷移で落ちる」。`updateWandererEchoes` は `updatePlayer` からしか呼ばれず、`updatePlayer` は `state.dialogueActive` の間 `animate` から呼ばれない。`playCutscene`（02-world-common.js:1396）も `dialogueActive = true` にするため、`state.dialogueActive \|\| cutsceneRunning()` の分岐は到達しない。結果、会話・演出の直前に予約された追撃は、会話中ずっと紫の残像（hold）が画面に止まって見え、会話が閉じた次のフレームで解決する（弧の VFX・SE・ダメージ）。具体例: エリア 4「遺構の門」(F4-2) の最後の敵を 3 段目で倒すと、`road2InsightDue()` が次のフレームで閃きの演出を始め、その間残像が残り、演出の後に誰もいない所へ追撃が出る。Implementation Result の AC 表「`updateWandererEchoes` の打ち切り条件」（FACT (code)）もこの点で事実と違う | 会話・演出（`state.dialogueActive` が true になったフレーム）で、待っている追撃と残像がすべて捨てられ（`clearWandererEchoes()`）、会話の後に追撃が解決しない。たとえば `animate` で `state.started && state.dialogueActive` のとき、追撃か残像があれば `clearWandererEchoes()` を呼ぶ（空のときは何もしない）等。方法は Implementer の裁量。他職の pendingSkill2 等の既存の挙動は変えない（範囲外）。Implementation Result の AC 表の根拠も実装に合わせて直す | E2E（`tests/wanderer-renewal.spec.js` に追加）または unit: 影の旅人で 3 段目を出して `echoes().queued === 1` を確認 → 0.45 秒以内に会話を開く（例: `playCutscene` / 既存の会話の開始）→ 1 フレーム後に `echoes()` が `{queued:0, images:0}` → 会話を閉じた後も対象の敵の HP が減らない。既存の `wanderer-renewal.spec` / `shadow-guide.spec` / `road2-fights.spec` が引き続き PASS |

## Notes for Orchestrator
- 本 Reviewer は指示により review report 1 ファイルだけを commit した。Task file の `Status:` を `CHANGES_REQUIRED` にする更新と Status History の行追加（reviewer.md の Task Status 欄）は Orchestrator 側で行うこと
