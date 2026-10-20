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

## Round 2/3

### Review Target

| 項目 | 値 |
| --- | --- |
| Task | `.ai/tasks/CH1-COMP-W24a.md`（CH1-COMP W2-4a、Round 1 Fix を含む） |
| Branch | `claude/ch1-comp-w2-4a-phase-burst-telegraph` |
| Reviewed SHA | `669fe35`（base `origin/main` `29c94da`） |
| Result | **PASS** |
| Independence | 別 Agent・同一セッションの Orchestrator が起動。Round 1 の指摘の確認だけで終えず、`git diff origin/main...HEAD` 全体・元のコード・止まる経路を改めて自分で確認した（§9.1） |

### Checklist

| # | 項目 | 結果 | メモ |
| --- | --- | --- | --- |
| 1 | 依頼（Work A）の範囲に合っている | OK | `phaseBurstTelegraphed` は `['duskEcho']` だけ。他のボスは `detonateBossPhaseBurst` を即時に呼ぶ（従来どおり） |
| 2 | 爆発のダメージ・範囲・判定が変わっていない | OK | `origin/main` の 4653-4678 と再比較。違いは `burstRadius = PHASE_BURST_RADIUS`（4.5）と末尾の `return d < burstRadius`（記録用）だけ（V1） |
| 3 | 他のボス・道中の敵・支援 AI・HP・セーブ・進行へ広がっていない | OK | 段階の判定（07:4550-4551、65% / 30%）は無変更。`basefile.html` の差分 0、削除行は `const burstRadius = 4.5;` の 1 行だけ |
| 4 | 予兆 → 爆発の時刻・二重表示なし | OK | 1 体 1 エントリ、予兆は同時に 1 つ、爆発のフレームで表示を外してから判定（V2・V4） |
| 5 | 後始末（撃破・戦闘不能・場所の移動・地点ジャンプ） | OK | R1 解消。`onBossDefeated` と `triggerPlayerDown` が `cancelBossPhaseBurstFor` を呼ぶ（V3） |
| 6 | 発光の書き戻しの順序 | OK | `triggerPlayerDown` は取り消し（発光を予兆前の値へ戻す）→ `emissiveIntensity = 0.22` の順。0.22 が上書きされない |
| 7 | 連結スコープの名前衝突・TDZ | OK | 新しい名前は他の parts・HEADER の import と衝突なし（grep）。`PHASE_BURST_RADIUS` の移動後も、使うのは起動後のフレームの関数内だけ |
| 8 | テスト（build / unit / E2E） | OK | 自分で実行して PASS（V5）。テストの弱めなし（Round 1 Fix でテストは未変更） |
| 9 | 範囲（`git diff --stat`） | OK | 12 ファイル（計画の 10 ＋ review / task の記録）。Round 1 Fix のコミットは 3 ファイルだけ |
| 10 | 記録（FACT / INFERENCE・実機確認の正直さ） | OK | 撃破中の取り消しは E2E なし・コードで確認と明記。段階 2 予兆中の段階 3 は unit のみと明記（O2 反映）。通常プレイのボス戦・iPhone は NOT_RUN / 実機で確かめることのまま |

### Verification Details

**V1 爆発の処理** — 距離、`!state.invulnerable && state.paralyzeInvulnT<=0`、`tryConsumeOrbShield`、`applyIncomingDamageMul(state.debugMode ? 0 : Math.round(en.atk*0.9))`、雷の麻痺 1.0 / 1.7、`triggerPlayerDown`、`else if` のジャストドッジ、`sfx('ultimate')`・`addShake(0.22)`・`spawnUltimateVFX` まで同一。トースト・`flashScreen`・発光 +0.25・`applyBossPhaseVisual`・段階の切り替えは即時のまま。

**V2 待ち行列** — `queueBossPhaseBurst` → `enqueuePhaseBurst` が `start` の時だけ `beginPhaseBurstTelegraph`。`beginPhaseBurstTelegraph` は最初に `removePhaseBurstMeshes` を呼ぶので輪が二重にならない。ジオメトリ・マテリアルは外すたびに `dispose`。

**V3 止まる経路（全部を確認）**
- 撃破: `finishEnemyDeath`（07:5457 で `en.dead = true`）→ `onBossDefeated`（12:478）が `dialogueActive = true` の直後、`shockRing` / `chargeLane` の隣で `cancelBossPhaseBurstFor(boss)`。宵待ちの村のエピローグの間に輪は残らない。段階の判定はボスの AI（07:4550）にあり、`en.dead` が立った後に新しい予兆は積まれない。
- 戦闘不能（通常プレイ）: `triggerPlayerDown`（12:1191）でボスを戻す前に取り消す。テストモードは HP1 で踏み止まり、取り消しは不要（予兆は続き、爆発も従来どおり起きる）。
- 場所の移動・街へ戻る・撤退: `disposeWorld`（02:379）の `clearBossPhaseBursts`。
- テストモード地点ジャンプ: `teleportTestModeTo`（14-hud-boot:2191）。
- 会話・ポーズ（戦闘中の近接イベントの会話など）: `updateEnemies` ごと止まり、円と爆発が一緒に止まり、再開後に一緒に進む。表示と爆発の時刻はずれない（残る輪は「止まっている」だけで、他の予兆・網・残響と同じ扱い）。
- 戦闘の離脱（`triggered = false`）: 止まらない経路なので `updateBossPhaseBursts` の `!en.triggered` で次のフレームに捨てる。
- `resetDungeon`（12:1232）: 呼び出し元が無い（grep で定義のみ）。対象外。

**V4 E2E を自分で 1 回実行**（scratchpad の設定、5173 は空き）: PASS（46.2s）。段階 2 トースト 6.912 → TELEGRAPH 6.912 → DETONATE (in range) 7.712 → 30 が 7.762 / 段階 3 トースト 7.912 → TELEGRAPH 7.912 → DETONATE 8.712 → 30 が 8.762。予兆 0.8 秒、ダメージ 30 は爆発の時だけ。Round 1 の実行と同じ傾向。

**V5 build / unit** — `npm run build`: PASS（chunk size の警告のみ）。`npm run test:unit`: tests 1893 / pass 1892 / fail 0 / skipped 1。

### Risks

- 予兆の爆発そのものでプレイヤーが戦闘不能になり（通常プレイ）、かつ段階 3 が待っていた場合、`updateBossPhaseBursts` の中で `triggerPlayerDown` → `cancelBossPhaseBurstFor` がエントリを外した後に、ループ側が `r.started` で `beginPhaseBurstTelegraph(b)` を呼ぶ。直後の `!b.queue.active` で同じフレームのうちに外されるので輪は描かれず、発光も 0.22 のまま（INFERENCE (code)）。残るのは戦闘不能の画面の瞬間に `sfx('castAim')` が 1 回鳴ることだけ。続く `bossPhaseBursts.splice(i, 1)` は予兆を出すボスが 1 体（`duskEcho`）なので空の配列への no-op（Optional O1）。
- 段階 2 の予兆中に段階 3、撃破中の取り消しはゲーム内の E2E では未観測（unit とコードで確認、記録に明記済み）。
- 爆発が 0.8 秒遅れることは依頼の予兆そのものに伴う変化で、解析の「変わること」に記録済み。

### Required Changes

None

### Optional

- O1: `updateBossPhaseBursts` で爆発の後に `if(bossPhaseBursts[i] !== b) continue;`（爆発の中で取り消された場合）を入れると、上の Risks の再入（戦闘不能の瞬間の `castAim` 1 回、別エントリを `splice` しうる形）が無くなる。現状の対象は 1 体なので見た目・判定への影響はない。
- O2: 段階 3 の発光 +0.25 が段階 2 の爆発の書き戻しで失われる点（Round 1 Risks）は見た目だけで、そのまま。

## Round 3/3

### Review Target

- Branch: `claude/ch1-comp-w2-4a-phase-burst-telegraph`
- Reviewed SHA: `d0b101e`（base `origin/main` `29c94da`）
- 重点: `git diff 669fe35..d0b101e`（Round 2 PASS の後の 2 件の修正）。`git diff origin/main...HEAD` 全体も見直した。

### Result

**CHANGES_REQUIRED**

### Independence

Implementer の説明（タスクファイルの「Round 2 の後の修正」）を前提にせず、呼び出し順・早期 return・`hlOn` の書き込み元をコードから自分で追った。ソースは変更していない。

### Checklist

| # | 項目 | 結果 |
| --- | --- | --- |
| 1 | 爆発の処理（半径 4.5・ダメージ `atk*0.9`・判定・VFX）が旧コードと同じ | OK（`detonateBossPhaseBurst`、`burstRadius = 4.5` を定数へ移しただけ） |
| 2 | 予兆は `duskEcho` だけ。他のボス・雑魚・支援 AI・保存・進行に触れていない | OK |
| 3 | 撃破・戦闘不能・場所の移動・地点ジャンプ・離脱で予兆を捨てる | OK（Round 2 と同じ。`d0b101e` で変わっていない） |
| 4 | 爆発の後の `if(bossPhaseBursts[i] !== b) continue;` | OK（下記 V2） |
| 5 | 予兆中のボスの発光の脈動が実際に出る | **NG**（下記 V1。`d0b101e` で脈動が一切出なくなった） |
| 6 | 発光が溜まらない・取り消し/爆発の後に光ったまま残らない | 結果として OK（足す処理が一度も走らないため） |
| 7 | 「段階移行の +0.25 はもともとハイライトが毎フレーム上書きしていた」という記録 | **NG**（ボスにはハイライトが走らない。下記 V1） |
| 8 | build / unit | OK |
| 9 | 新しい E2E | OK（PASS。ただし発光は検証していない） |
| 10 | タスクファイルの記録が正確・実機の主張に誤りが無い | **NG**（7 と同じ誤記。実機の新しい主張は無い） |

### 検証

**V1 発光（`placePhaseBurstMeshes`、P07:4740-4745）** — `updateEnemyVisibility`（P07:4198）の先頭は
`if(en.isBoss){ en.visLevel = 'visible'; en.visAlpha = 1; return; }` で、ボスは戦闘時ハイライト（P07:4234-4261）まで到達しない。村の残響は `buildBoss`（14-dungeon-duskvillage:1267 → 06-player-enemy:4886 `isBoss:true`）で作られる。`en.hlOn` を書くのはこのハイライトだけ（`grep hlOn src` で 4254/4259 のみ）なので、ボスの `hlOn` は常に `undefined`。
したがって `if(mat && b.en.hlOn) mat.emissiveIntensity += …` は村の残響では一度も実行されず、**予兆中の発光の脈動が消えている**（`669fe35` では基準値を覚えて絶対値で書き、外す時に戻す方式で出ていた）。タスクファイル（§3 の作業 3、上部コメント「その間ボスは光を脈打たせる」）が予兆の要素として挙げている脈動が失われた回帰。
呼び出し順そのもの（敵ループ内 P07:887 の `updateEnemyVisibility` → 最後 P07:1080 の `updateBossPhaseBursts`）は主張どおりだが、ボスでは前段が何もしないので前提が成り立たない。
同じ理由で「段階移行の +0.25（P07:4660）はもともとハイライトが毎フレーム上書きしていた」も誤り。ボスの発光を毎フレーム書き直す処理は無く、+0.25 は残る（戦闘不能で 0.22 に戻すまで）。
溜まり・光り残りについては、足す処理が走らないので結果的に起きない（安全側の不具合）。

**V2 `bossPhaseBursts[i] !== b` ガード** — 爆発の中の `triggerPlayerDown` → `cancelBossPhaseBurstFor(boss)` は同じ `en` のエントリだけを `splice` する。`i` のエントリが外れると `bossPhaseBursts[i]` は元の `i+1`（逆順ループで処理済み）か `undefined` になり、`!== b` で `continue`。添字 `< i` のエントリは位置が変わらないので、他のボスのエントリを飛ばすことも二重に処理することも無い。`r.started` での作り直しと `castAim` の再生（Round 2 O1）は無くなった。`clearBossPhaseBursts`（配列の差し替え）は爆発から呼ばれる経路が無い（`disposeWorld` / `teleportTestModeTo` のみ）。OK。

**V3 その他** — `d0b101e` で変わったのは発光の 2 箇所とガードのみ。`removePhaseBurstMeshes` から発光の戻しを外したことも V1 の前提に依存しているが、足していないので戻す必要も実際には無い。爆発・取り消しの経路は Round 2 の確認のまま。

**V4 実行**
- `npm run build`: PASS（chunk size の警告のみ）
- `npm run test:unit`: tests 1893 / pass 1892 / fail 0 / skipped 1
- E2E `tests/dusk-boss-phase-burst.spec.js`（scratchpad の設定、5173 は空き。`ss` が無いので `/proc/net/tcp` で確認）: 1 passed（45.3s）。段階 2 TELEGRAPH 6.825 → DETONATE (in range) 7.625 → 30 が 7.675 / 段階 3 TELEGRAPH 7.825 → DETONATE 8.625 → 30 が 8.675。E2E は発光を見ていないので V1 は検出されない。

### Risks

- 予兆の見た目は足元の輪・満ちる円・音で成立しており、判定・ダメージ・時刻は正しい。失われたのは「ボスが脈打つ」という補助の合図だけ（見た目のみ）。
- 発光について E2E・unit のどちらも見ておらず、今回のような回帰が自動では検出されない。

### Required Changes

- R1: 村の残響（`isBoss`）で予兆中の発光の脈動が出るように戻す。ボスの発光は毎フレーム書き直されないので、「足すだけ」の方式は使えない。`669fe35` の方式（開始時の値を覚えて絶対値で書き、`removePhaseBurstMeshes` で戻す）へ戻すのが最小（`d0b101e` のガードは残す）。
- R2: `.ai/tasks/CH1-COMP-W24a.md`「Round 2 の後の修正」1 の記述（ハイライトが毎フレーム書き直す／+0.25 はもともと上書きされていた）を、ボスはハイライトの対象外（P07:4199 の早期 return）という事実に合わせて直す。P07:4740-4743 のコメントも同様。

### Optional

- O1: 予兆中にボスの `body.material.emissiveIntensity` が上がり、爆発・取り消しの後に元へ戻ることを E2E で 1 点だけ確かめると、この種の回帰を拾える。
- O2: R1 で `669fe35` 方式に戻す場合、予兆中に次の段階の +0.25 が来ると書き戻しで失われる（Round 1 Risks / Round 2 O2）。気になるなら `triggerBossPhaseSkill` で予兆中のエントリの基準値にも +0.25 を反映する。

### 備考

Round 3/3（最終 Round）で CHANGES_REQUIRED。§9.1 の上限に達したため、続きの扱いは Orchestrator の判断（修正後の再レビューか Escalation）とする。
