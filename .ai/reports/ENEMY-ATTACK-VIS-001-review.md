# ENEMY-ATTACK-VIS-001 Review

Result: **PASS**

## Review Target

| 項目 | 値 |
| --- | --- |
| Task ID | ENEMY-ATTACK-VIS-001 |
| Branch | `claude/enemy-attack-vis-001-impl-jx30t9` |
| Implementation SHA（Reviewed SHA） | `e31e7df4a4c5c66b0243e73ce3f5deb398df5408` |
| Diff range | `6edbe10c42fe1ed2d90d222cdaf91870b99bf4c9..e31e7df4a4c5c66b0243e73ce3f5deb398df5408`（注 O-1） |
| Task file | `.ai/tasks/ENEMY-ATTACK-VIS-001.md` |
| Analysis | `.ai/reports/ENEMY-ATTACK-VIS-001-analysis.md` @ `b9470260fe8ed34c9ee2eb413c0afbb7d4f23862` / blob `487e8d4bb9cf21574602ad08baca77bf5fdf48c0` |
| Plan | `.ai/tasks/ENEMY-ATTACK-VIS-001.md` @ `47785709da12ce0ceab028235b0310a74327f654` / blob `987a90611efe90b0a0ec8e6cbc3a6303202704eb` |
| Reviewer | Claude Code（Reviewer セッション、branch `claude/enemy-attack-vis-001-review-gmx2ax`） |
| Date | 2026-09-25 |

Implementation SHA は自己参照になるため Task file には書かれていない（AGENTS.md §5.1「記録の正本は review report の Review Target」）。欠落として扱わない。

## 1. Artifact / Plan Handoff（V-1〜V-6、H 再計算）

すべて git から再計算した。

| # | 確認 | 実行 / 結果 | 判定 |
| --- | --- | --- | --- |
| V-1 | Branch が remote に存在し Implementation SHA が到達可能 | `git fetch` 成功。`origin/claude/enemy-attack-vis-001-impl-jx30t9` 先端 = `e31e7df4…`、`merge-base --is-ancestor` 真 | PASS |
| V-2 | Task file へ到達できる | `git show e31e7df:.ai/tasks/ENEMY-ATTACK-VIS-001.md` 成功。1行目 `# ENEMY-ATTACK-VIS-001` | PASS |
| V-2a | `git diff 4778570:<Task> e31e7df:<Task>` の変更範囲 | 変更は (1) `Status: APPROVED → REVIEWING`、(2) Status History 3行追加、(3) Implementation Result 節追加、(4) **Approval 欄 `Persistence:` 行の書き換え**。(4) は §7.3 I-3 の3区分の外だが、**Human が Implementer セッションで Persistence を明示的に許可した操作に伴う変更**（行内に根拠・旧記載を保存）。Human の明示許可に基づく変更として扱い、範囲外の無断変更とはしない。差分としての存在をここに記録する | PASS（記録あり） |
| V-3 | Plan が存在 | `47785709…` 到達可能（`origin/claude/enemy-attack-vis-001-planner-12pg60` 先端）。`git rev-parse 4778570:<Task>` = `987a90611efe90b0a0ec8e6cbc3a6303202704eb`（Handoff 記載と一致）。`git diff --name-only 4778570^ 4778570` = Task file のみ。Plan 版は `Status: APPROVED`・`[x] Approved` | PASS |
| V-4 | Analyzer report が存在 | 存在 | PASS |
| V-4a | `git rev-parse e31e7df:<Analysis>` = Blob SHA | `487e8d4bb9cf21574602ad08baca77bf5fdf48c0` 一致（Source 版 `b947026:<Analysis>` とも一致、`git hash-object` 再計算も一致） | PASS |
| V-4b | Source SHA が Source Branch から到達可能 | `origin/claude/enemy-attack-vis-001-analysis-7y2loi` 先端 = `b9470260…`。`git diff --name-only b947026^ b947026` = Analysis のみ | PASS |
| V-5 | Implementation Result（Test Report・Changed Files）を確認できる | Task file 末尾に存在 | PASS |
| V-6 | Diff range が空でなく終点 = Implementation SHA | 終点一致。11 files / +1083 −1。始点は注 O-1 | PASS |
| － | Task ID / Human Approval / Status | Task ID 一致。`[x] Approved`（Human、2026-09-25、Planner セッション）。Status `REVIEWING`（remote 上に push 済み） | PASS |

**Artifact verification: PASS**

## 2. Scope

`git diff --stat 6edbe10..e31e7df` の変更ファイル:

| ファイル | Files To Change | 判定 |
| --- | --- | --- |
| `src/core/enemy-profiles.js` | #1（WI-1） | 追加のみ（`-` 行なし）。既存関数無変更 |
| `src/legacy/concat-plugin.js` | #2（WI-2） | import 列に3名追加のみ |
| `src/legacy/parts/07-ai-combat.js` | #3（WI-3 / WI-4） | `updateMansionMobExtras` 末尾の呼び出し、新関数、`arenaClear` 1行、`finishEnemyDeath` 1行 |
| `src/legacy/parts/02-world-common.js` | #4（WI-4） | `:347` に1条件追加 |
| `src/legacy/parts/14-training-ground.js` | #7（D-7） | パネル1行 |
| `tests/unit/enemy-profiles.test.js` | #5 | U-1〜U-5 |
| `tests/mansion-{enemies,warden,butler}.spec.js` | #6 | 各1テスト追加 |
| `.ai/tasks/ENEMY-ATTACK-VIS-001.md` | #9 | V-2a のとおり |
| `.ai/reports/ENEMY-ATTACK-VIS-001-analysis.md` | §7.3（Human Approval 時点の Analyzer report） | blob 一致（V-4a） |

Decision 適合:

| D | 決定 | 確認（コード） | 判定 |
| --- | --- | --- | --- |
| D-1 | 外周の弧のみ / RingGeometry | `new THREE.RingGeometry(max(0, reach-0.14), reach, 32, 1, 0, 2h)`。塗り扇・進行度で満ちる表示なし | PASS |
| D-2 | heavy + guard break のみ | `meleeTelegraphShape` は `plan.key !== prof.heavy` で `null`。guard break は `pick = prof.heavy`（`07-ai-combat.js:2306`）なので同一形 | PASS |
| D-3 | 外周 = reach | 外径 = `shape.reach` = `meleeAttackPlan().reach`。プレイヤー半径加算なし | PASS |
| D-4 | Boss `startArcSweep` / 崩し斬り不変 | `startArcSweep`・`updateArcSweep`・`spawnSweepVFX`・`11-combat-actions.js` に差分なし。新関数から呼び出しなし | PASS |
| D-5 | Mansion 近接3種用のみ | `MANSION_MELEE_TELEGRAPH_KINDS = {servant, warden, butler}`。`bossVfx` / `clearBossVfx` / `telegraphDisc` 差分なし | PASS |
| D-6 | 進行度表示なし | 進行度関数の追加なし。opacity 0.55 固定 | PASS |
| D-7 | Arena パネルで観測 | `Floor Arc: ON reach r half h / OFF`（`atkType==='servant'` のみ） | PASS |
| D-9 | `en.visLevel === 'visible'` のみ | 表示条件に `en.visLevel === 'visible'`。`enemy-visibility.js` / `stepVisibility` 差分なし | PASS |

Scope 外変更の不在（`git diff 6edbe10 e31e7df` で確認）: Boss telegraph、player 崩し斬り、攻撃力、攻撃 hitbox（`reach` / `halfAngle` / 判定式）、AI（`updateShadowServantAI`）、難易度、攻撃タイミング（攻撃表・`GUARD_BREAK_TELEGRAPH_SEC`）、他ダンジョン、weapon trail、攻撃モーション（pose 関数）、`src/core/mansion-enemies.js`、`06-player-enemy.js`、`basefile.html`、`docs/` — いずれも差分なし。

**Scope: PASS**

## 3. Implementation correctness

| 観点 | 確認内容（FACT (code)） | 判定 |
| --- | --- | --- |
| `meleeAttackPlan` | 形は `meleeTelegraphShape(en.meleeKind \|\| 'servant', en.servantAttack, en.butlerPhase \|\| 1)` → `meleeAttackPlan`。判定側（`:2138-2140`, `:2233`）と同じ kind / phase 式。値のコピー・別定義なし | PASS |
| `servantFacing` | `Math.atan2(en.servantFacing.x, en.servantFacing.z)`。判定（`:2235`）と同式。`servantFacing` は `THREE.Vector3`（`:2136,2208,2314`）。`group.rotation.y` からは取らない | PASS |
| `group.position` | 原点 x/z = `en.group.position`、y = `groundYAt(x, z, en.group.position.y)`（F-21 の式）+ 0.14 | PASS |
| `reach` / `halfAngle` | unit U-1 / U-2 で `meleeAttackPlan` と一致（執事 phase 2: 4.60 / 1.35）。E2E で `3.30/1.60`・`3.90/1.85`・`3.60/1.25` を観測 | PASS |
| `groundFanRotationZ` | `facing - halfAngle - π/2`。Reviewer が独立に three r154 実メッシュ（`RingGeometry` + `rotation.x=-π/2`）で 5 halfAngle × 9 facing の中心・両端方位を計算し最大誤差 8.9e-16、y=0（リポジトリ外スクリプト） | PASS |
| telegraph と hit/damage の分離 | 新関数は `en.meleeTelegraphMesh` の生成・更新だけを書く。hit 判定・ダメージ・`en.special`・`servantState` / `servantT` / `servantFacing` / `servantAttack` への書き込みなし。`startArcSweep` / `updateArcSweep` 呼び出しなし | PASS |
| AI/state への不要な書き込み | 敵へ書くのは `en.meleeTelegraphMesh`（表示専用の参照）のみ。セーブ対象外 | PASS |
| visual scale の影響なし | `scene.add(m)`（`en.group` の子にしない）。番人 1.5 / 執事 1.7 のスケールは掛からない | PASS |
| scene 直下配置 | 同上。個体ごと1つを使い回し、形が変わる時だけ geometry を作り直して旧 geometry を `dispose` | PASS |
| 死亡時 cleanup | `finishEnemyDeath` 冒頭で `visible = false`。死亡後は `updateMobAnim` が呼ばれず（`:837-874`）、湧き直しは `servantEnterIdle`（`:855`）後に通常更新 | PASS |
| Arena clear 時 cleanup | `arenaClear` で `scene.remove(en.meleeTelegraphMesh)` | PASS |
| world 切替時 cleanup | `02-world-common.js:347` で `scene.remove` | PASS |
| windup 中断経路 | 毎フレーム状態読み取りで `visible` 切替。ダウン（`:5310` で `servantEnterIdle`）、guard break 潰し（`:5295`）、起き上がり（`:948`）、湧き直し（`:855`）いずれも windup を抜けるので次フレームで OFF | PASS |
| light 攻撃で非表示 | U-3（3種 × phase 1/2 で `null`）、E2E で `WINDUP (strike/slam/candle)` 中 OFF を観測 | PASS |
| heavy / guard break で表示 | E2E で `WINDUP (sweep/lash)` 中 ON。番人 spec で `GUARD BREAK` 中の `WINDUP (sweep)` に `ON reach 3.90 half 1.85` を観測（Reviewer 実行） | PASS |
| visible 以外で非表示 | 表示条件 `en.visLevel === 'visible'`。`visLevel` は同フレームの AI より前（`:876`）に `updateEnemyVisibility` が更新する既存フィールドで、読むだけ | PASS（code） |
| 関数名衝突 | `updateMansionMeleeTelegraph` / `MANSION_MELEE_TELEGRAPH_*` は固有。build PASS | PASS |

他の enemies 除去経路（異界部屋 `rs.mons` = `atkType:'charge'`、鏡の分身 = `atkType:'mirror'`）は対象3種を含まないため該当しない。

**Implementation: PASS**

## 4. Tests

| テスト | Implementer | Reviewer（独立実行 @ `e31e7df`） |
| --- | --- | --- |
| build（`npm run build`） | PASS | PASS（既存の chunk size 警告のみ） |
| unit（`npm run test:unit`） | PASS 1495/1495 | PASS 1495/1495 |
| E2E E-1 / E-2（追加3テスト） | NOT_RUN（Chromium revision mismatch） | **PASS**（3/3） |
| E2E E-5（3 spec の既存テスト回帰） | NOT_RUN | **PASS**（14/14） |
| E2E 3 spec 合計 | NOT_RUN | **PASS 17/17**（21.1 min） |
| E2E E-3 / E-4 | NOT_RUN（E2E 未作成） | NOT_RUN（下の §5） |
| 目視 | NOT_RUN | NOT_RUN（実機なし） |

Reviewer の E2E 実行方法（§14「実行環境の問題」の回避策、**リポジトリ外のみ**）:
- Implementation SHA を scratchpad に `git worktree add --detach` し `npm ci`
- scratchpad に置いた Playwright config で既存 `playwright.config.js` を読み込み、`launchOptions.executablePath: '/opt/pw-browsers/chromium'`（chromium-1194）と `webServer.cwd` だけを上書き
- リポジトリのコード・設定・テストは一切変更していない
- 観測値: 使用人 `{"heavy":15,"light":3,"other":42}`、番人 `{"heavy":14,"light":28,"other":78}`（guard break: `ON reach 3.90 half 1.85`）、執事 `{"heavy":12,"light":3,"other":21}`

E2E NOT_RUN（Implementer）は PASS として数えていない。上の PASS は Reviewer が実行した結果である。
E2E 全件（`npm test`、他 spec）は Targeted の範囲外として実行していない（変更は Mansion 3種の表示と core 純粋関数に閉じる。§7.3 により Full Regression は DONE 条件ではない）。

## 5. E-3 / E-4 の代替検証の評価

| # | Test Plan | 実施 | 評価 |
| --- | --- | --- | --- |
| E-3 | 撃破後 OFF、Arena clear 後にメッシュが残らない（E2E） | E2E なし。Implementer は FACT (code) | Arena パネルは `en.dead` の敵を選ばない（`14-training-ground.js:141`）ため、D-7 = (a) の観測口では撃破後・clear 後の状態は原理的に読めない（FACT (code)、Reviewer 確認）。観測口を増やすのは D-7 の「パネル1行」を超える。後始末は各1行で、Reviewer がコードで確認（§3）。**十分と判断（非ブロッキング）** |
| E-4 | 壁越し（`visLevel !== 'visible'`）で OFF。Arena で遮蔽を作れない場合は unit / 目視で代替し Test Report に記録 | E2E なし、unit なし、目視なし。FACT (code) | Plan 自体が E2E 不能を想定し代替を許容している。表示条件は legacy 内の1条件で、unit 化には core への述語移動が要り Plan 外。目視は実機なしで NOT_RUN と記録済み。Reviewer がコードで条件を確認（§3）。**十分と判断（非ブロッキング）。ただし目視確認は未了として残る（R-1）** |

## 6. Acceptance Criteria

| AC | 判定 | 根拠 |
| --- | --- | --- |
| heavy（guard break 含む）の windup 中だけ弧、light・他状態・他敵・他ダンジョンで出ない | PASS | U-3、E2E E-1/E-2（Reviewer 実行）、`MANSION_MELEE_TELEGRAPH_KINDS` |
| 形・向き・原点の出所 | PASS | §3 |
| 中心方位の unit 固定 | PASS | U-4 / U-5、Reviewer の three 実メッシュ検証 |
| 外周 = reach、スケール非適用 | PASS | U-1/U-2、`scene.add` |
| 中断5経路・死亡・Arena clear・世界切り替えで残らない | PASS（code） | §3、§5 |
| `updateShadowServantAI`・攻撃表・`threatHighlight`・pose・盾の白熱に差分なし | PASS | diff 確認 |
| `startArcSweep` / `updateArcSweep` / `bossVfx` / `clearBossVfx` を呼ばない | PASS | 新関数内に呼び出しなし |
| `startArcSweep` / `spawnSweepVFX` / `11-combat-actions.js` に差分なし | PASS | diff 確認 |
| `visLevel !== 'visible'` に出さない、`stepVisibility` / `threatHighlight` 差分なし | PASS（code） | §3、§5 |
| ボス側差分なし | PASS | diff 確認 |
| 進行度なし、不透明度一定 | PASS | opacity 0.55 固定 |
| build / unit / E2E PASS、FLAKY / NOT_RUN は記録 | PASS | build / unit PASS、E2E 3 spec 17/17 PASS（Reviewer 実行）。E-3 / E-4 / 目視の NOT_RUN は Test Report に記録済み |

## 7. Review Checklist（AGENTS.md §12）

| # | 項目 | 結果 |
| --- | --- | --- |
| 1 | Specification compliance | PASS |
| 2 | Scope compliance | PASS（Persistence 行は Human 明示許可による変更） |
| 3 | Regression | PASS（unit 全件、3 spec 既存 E2E） |
| 4 | Build | PASS |
| 5 | Unit tests | PASS 1495/1495 |
| 6 | E2E tests | Implementer NOT_RUN / Reviewer 3 spec 17/17 PASS |
| 7 | Save/Load integrity | 影響なし（`en.meleeTelegraphMesh` はセーブ対象外、セーブ形式差分なし） |
| 8 | Existing behavior | PASS（パネル行は Arena テストモード専用） |
| 9 | Code duplication | PASS（形は `meleeAttackPlan` を再利用、`startArcSweep` の式は流用せず） |
| 10 | Unnecessary architecture changes | なし |

## Blocking Findings

なし。

## Non-blocking Observations

| # | 内容 |
| --- | --- |
| O-1 | Review Handoff の Diff range 始点 `6edbe10c42fe1ed2d90d222cdaf91870b99bf4c9c4` は42桁で git オブジェクトとして解決できない（末尾 `c4` が余分）。正しい始点は `6edbe10c42fe1ed2d90d222cdaf91870b99bf4c9`（`e31e7df` の親、Task file の Plan baseline と一致）。前方一致で一意に特定でき、V-6（空でない・終点一致）は満たすため BLOCKED にはしない。本 report の Review Target は正しい40桁で記録した |
| O-2 | Task file 冒頭の `Persistence state: PENDING PERSISTENCE…` 行と `Implementation: BLOCKED — …` 行は Plan 時点のまま残っており現状と合わない。I-3 により Implementer は変更できない行であり、指摘対象にはしない（Human / Planner が必要に応じて更新） |
| O-3 | 世界切り替え・Arena clear は `scene.remove` のみで geometry / material を `dispose` しない。既存の `shockRing` / `chargeLane` と同じ扱いで、個体ごと1メッシュのため影響は小さい |
| O-4 | 番人 E2E の guard break 検証は観測できた場合だけ assert する（`if(gbArc !== null)`）。今回の Reviewer 実行では観測・一致した。guard break が heavy の plan で振られることは unit U-3 とコード（`:2306`）で固定されている |
| O-5 | 浮き（`liftPeak`）・大怯み以外の硬直中は AI が止まり windup のまま弧が残る。Plan WI-4（I-12「ポーズと同じ挙動」）で許容済み |

## Risks

| # | リスク |
| --- | --- |
| R-1 | 目視（R-2 / R-5 / R-9 / R-10 / R-13、E-4 の代替としての壁越し確認）は未実施。実機での確認を推奨 |
| R-2 | E-3 / E-4 は E2E で自動化されておらず、将来の回帰はコードレビューに依存する |
| R-3 | E2E は Reviewer 環境で chromium-1194 を明示指定して実行した。既定 config のままでは本環境で起動しない（環境問題。リポジトリ変更なし） |

## Status

Review Result: PASS。

Human が Reviewer Persistence を明示的に許可した（2026-09-25、Reviewer セッションの会話。対象 Handoff Branch `claude/enemy-attack-vis-001-impl-jx30t9`）。
§7.3 の「Reviewer の commit 範囲」に従い、本 report と Task file の Status 更新（`REVIEWING → DONE`）・Status History 1行追加だけを1コミットにまとめ、Handoff Branch へ push する（amend / force push なし）。
Reviewed SHA `e31e7df4a4c5c66b0243e73ce3f5deb398df5408` は review 時点の Handoff Branch 先端であり、その後に Files To Change を変更するコミットは無い。
