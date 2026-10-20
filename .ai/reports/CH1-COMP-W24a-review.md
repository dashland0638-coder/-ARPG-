# CH1-COMP-W24a Review — 村のボスの段階移行の爆発に予兆を付ける

## Round 1/3

### Review Target

| 項目 | 値 |
| --- | --- |
| Task | `.ai/tasks/CH1-COMP-W24a.md`（CH1-COMP W2-4a） |
| Branch | `claude/ch1-comp-w2-4a-phase-burst-telegraph` |
| Reviewed SHA | `704ba06`（base `origin/main` `29c94da`） |
| Result | **CHANGES_REQUIRED** |
| Independence | 別 Agent・同一セッションの Orchestrator が起動（実装者の説明に頼らず、差分・元のコード・テストを自分で確認した） |

### Checklist

| # | 項目 | 結果 | メモ |
| --- | --- | --- | --- |
| 1 | 依頼（Work A）の範囲に合っている | OK | 村の残響（`duskEcho`）の段階移行の爆発だけ。残響の床の円・他のボスは含まない |
| 2 | 爆発のダメージ・範囲・判定が変わっていない | OK | `detonateBossPhaseBurst` は元の後半と論理が同一（下記 V1） |
| 3 | 他のボス・道中の敵へ広がっていない | OK | `phaseBurstTelegraphed` は `['duskEcho']` だけ。他のボスは従来どおり即時に `detonateBossPhaseBurst` |
| 4 | 予兆 → 爆発の時刻が合う・二重に出ない | OK | 1 体 1 つの待ち行列。爆発のフレームで表示を外してから判定。E2E で確認（V4） |
| 5 | 予兆の後始末（撃破・仕切り直し・場所の移動） | **NG** | 撃破の瞬間に予兆の円が消えず、撃破後の演出の間ずっと画面に残る（R1） |
| 6 | 禁止事項（数値・HP・攻撃頻度・支援 AI・セーブ・進行・`basefile.html`・連結構成） | OK | `basefile.html` の差分 0 行。`concat-plugin.js` は import の追加だけ。削除行は `const burstRadius = 4.5;` の 1 行のみ（定数へ置換、値は同じ） |
| 7 | 連結スコープの名前衝突・TDZ | OK | 新しい名前は他の parts・HEADER の import と衝突なし。`let bossPhaseBursts` / `const PHASE_BURST_*` は `memoryNets`・`keeperEchoes` と同じ置き方で、使うのは起動後のフレーム（評価順の問題なし） |
| 8 | テスト（build / unit / E2E） | OK | 自分で実行して PASS（V5）。アサーションの弱めは無い |
| 9 | 範囲（`git diff --stat`） | OK | 計画の 10 ファイルだけ |
| 10 | 記録（FACT / INFERENCE・実機確認の正直さ） | OK | iPhone は「実機で確かめること」として未確認のまま書いている。通常プレイのボス戦の E2E が無いことも NOT_RUN と明記 |

### Verification Details

**V1 爆発の処理（`detonateBossPhaseBurst`）** — `git show origin/main:src/legacy/parts/07-ai-combat.js` の 4653-4678 と比較。距離 `state.pos.distanceTo(en.group.position)`、`d < 4.5 && !state.invulnerable && state.paralyzeInvulnT<=0`、`tryConsumeOrbShield`、`applyIncomingDamageMul(state.debugMode ? 0 : Math.round(en.atk*0.9))`、`spawnDamagePopup`、雷の麻痺（1.0 / 1.7）、`triggerPlayerDown`、`else if` のジャストドッジ、`sfx('ultimate')`・`addShake(0.22)`・`spawnUltimateVFX(半径, baseColor)` まで一字一句同じ。違いは `burstRadius = PHASE_BURST_RADIUS`（4.5）と、末尾の `return d < burstRadius`（Arena の記録用。判定には使わない）だけ。トースト・`flashScreen`・発光 +0.25・`applyBossPhaseVisual` は `triggerBossPhaseSkill` に残り、段階の切り替え（速度・攻撃間隔）は従来どおり即時。

**V2 予兆の流れ** — `queueBossPhaseBurst` は 1 体に 1 エントリ、`enqueuePhaseBurst` が `start` の時だけ表示を作る。段階 2 の予兆中に段階 3 が来たら `pending` に積み、段階 2 の爆発のフレームで表示を外す → 爆発 → 次の予兆を作る（重ならず爆発は 2 回）。`updateBossPhaseBursts` は後ろから回し、`splice` はそのエントリ自身だけなので、爆発の中で `triggerPlayerDown` が呼ばれても配列の走査は壊れない（`triggerPlayerDown` は `bossPhaseBursts` に触らない）。ジオメトリ・マテリアルは外す時に `dispose`。`groundYAt` の使い方は `telegraphDisc`（P07:3454）と同じ。

**V3 時間の扱い** — 予兆は `updateEnemies` の最後で敵の AI とは別に進むので、ボスが Break でダウンして AI が止まっても円と爆発の時刻はずれない（解析の判断 2 のとおり）。hitStop は `dt` が縮むだけで、円と爆発の両方に同じく効く。会話・ポーズ中は `updateEnemies` 自体が呼ばれないので、円も爆発も一緒に止まる。テストモード地点ジャンプ（`14-hud-boot.js teleportTestModeTo`）と場所の移動（`02-world-common.js disposeWorld`）で捨てる。戦闘不能 → 「街へ戻る」は `returnToTown → buildWorld → disposeWorld` で捨てられる。

**V4 E2E を自分で 1 回実行**（scratchpad の設定で `executablePath` と webServer の cwd だけ指定。5173 は空いていた）: PASS（43.2s）。記録: 段階 2 トースト 6.837 → TELEGRAPH 6.837 → DETONATE (in range) 7.637 → 30 が 7.687 / 段階 3 トースト 7.837 → TELEGRAPH 7.837 → DETONATE 8.637 → 30 が 8.687（推定ゲーム内秒）。Test Report の数値（6.99 → 7.79 …）と傾向が一致し、主張はもっともらしい。ダメージ 30 = round(33×0.9) も爆発の時だけ。

**V5 build / unit** — `npm run build`: PASS（chunk size の警告のみ）。`npm run test:unit`: tests 1893 / pass 1892 / fail 0 / skipped 1（Test Report と一致）。新しい unit は対象のボス、1 回だけ・早すぎず遅すぎず、長いフレームでも 1 回、段階 2・3 の連続で同時に 1 つ・爆発 2 回、捨てた後に爆発しない、を見ていて、AC 1・4・5 の core 側に対応している。

**V6 撃破時の後始末（R1 の根拠）** — `finishEnemyDeath`（P07:5443）でボスは `en.dead = true; en.group.visible = false;` の後、同じ処理の中で `onBossDefeated`（P12:478）を呼び、ここで `state.dialogueActive = true`（「freeze gameplay immediately」）になる。以後 `14-hud-boot.js` のループは `updateEnemies` を呼ばないため、`updateBossPhaseBursts` の `en.dead` による取り消しが **撃破後の演出が終わるまで走らない**。宵待ちの村は `defersResultScreen` で `playDuskEpilogue`（記憶が水面へ戻る → 夜明け → 会話）を挟むので、その間ずっと、`scene` に直接足した橙色の輪と円（とボスの発光の値）が予兆の途中の形のまま画面に固まって残る。同じ `onBossDefeated` が `boss.shockRing` / `boss.chargeLane` を明示的に片付けているのは、まさにこの「撃破の境界で予兆が固まって残る」問題への既存の対処で、今回の予兆だけが漏れている。段階 3（HP 30%）から 0.8 秒以内に倒すのは、E2E の Lv30 でも段階 2→3（35% 分）が 1.0 秒だったことから、十分に起こりうる。

### Risks

- 予兆の途中で戦闘不能になった場合（ボスの通常攻撃など）も、`triggerPlayerDown` が `dialogueActive = true` にするので、半透明の戦闘不能の画面の後ろで輪がボスの元の位置に固まって残る。「街へ戻る」で `disposeWorld` が捨てるので残り続けはしない（Optional O1）。
- その `disposeWorld` での取り消しは、`triggerPlayerDown` がボスを `emissiveIntensity = 0.22` に戻した後に、予兆の開始時の発光の値を書き戻す（Optional O1）。
- 段階 2 の予兆中に段階 3 が来た場合、段階 3 の発光 +0.25 は段階 2 の爆発の時の書き戻しで失われる（見た目だけ。ボスの脅威表示 `threatHighlight` も毎フレーム発光を書くので元から不安定）。
- E2E の 2 回の実行とも段階 3 は段階 2 の爆発の後に来ており、「段階 2 の予兆中に段階 3」の流れはゲーム内では未確認（unit で確認済み）。
- 爆発が 0.8 秒遅れることは依頼された予兆そのものに伴う変化で、解析の「変わること」表に記録済み（禁止された数値変更ではない）。撃破時に爆発させないことも同表に記録済み。

### Required Changes

| # | ファイル | 場所 | 問題 | 期待 | 確かめ方 |
| --- | --- | --- | --- | --- | --- |
| R1 | `src/legacy/parts/07-ai-combat.js`（取り消しの関数）と、撃破の経路（`12-progression-ui.js onBossDefeated` の `shockRing` / `chargeLane` の片付けの隣、または `07-ai-combat.js finishEnemyDeath` のボスの分岐） | `updateBossPhaseBursts` の `en.dead` による取り消しだけに頼っている | ボスを予兆の途中で倒すと、`onBossDefeated` がその場でゲームを止めるため取り消しが走らず、輪と円（と脈打つ途中の発光）が撃破後の演出（宵待ちの村の `playDuskEpilogue`）の間ずっと画面に残る | 撃破の瞬間に、そのボスの予兆と待ちを爆発させずに捨て、表示を外す（例: `cancelBossPhaseBurstFor(en)` を足して撃破の経路から呼ぶ）。爆発のダメージ・判定・他のボスには触らない | コードで撃破の経路から呼ばれることを確認。可能なら E2E（テストモードで予兆の開始直後にボスを倒し、`onBossDefeated` の直後に scene に輪が無いこと、または Arena の記録で取り消しが撃破と同じフレームであること）。既存の `dusk-boss-phase-burst`・`duskvillage` の E2E と unit が通ること |

### Optional

- O1: 戦闘不能（`triggerPlayerDown` のボスを元へ戻す処理）でも同じ取り消しを先に呼ぶと、戦闘不能の画面の後ろに輪が残らず、発光の書き戻しが 0.22 を上書きすることも無くなる。R1 の関数をそのまま使える。
- O2: E2E の `t3` の検証は「段階 2 の予兆中に段階 3」の場合も許すように書けているが、実際の実行では起きていない。Test Report の Risks に「連続の経路はゲーム内で未観測（unit で確認）」と一行添えると正直さが増す。
- O3: `const PHASE_BURST_RADIUS = 4.5;` を `detonateBossPhaseBurst` の直後に置いているが、読みやすさのため予兆の定数（`PHASE_BURST_COLOR`）と並べてもよい（動作は同じ）。
