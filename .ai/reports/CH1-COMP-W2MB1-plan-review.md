# CH1-COMP-W2MB1 Plan Review

## Round 1/3

### Review Target

| 項目 | 値 |
| --- | --- |
| Task ID | CH1-COMP W2-MB1（`.ai/tasks/CH1-COMP-W2MB1.md`） |
| Branch | `claude/ch1-comp-w2-mb1-plan` |
| Reviewed SHA | `84fbfba` |
| Diff range | `origin/main...HEAD`（`8fd69cb...84fbfba`） |
| Handoff Verification | 対象 4 ファイル（`.ai/tasks/CH1-COMP-W2MB1.md`・`CH1-COMP.md`・`CH1-COMP-W24a.md`・`CH1-COMP-W2MB.md`）、基準 SHA `8fd69cb`、Human の依頼（計画のみ）を確認 |
| Analysis Source | `.ai/reports/CH1-COMP-W2MB-analysis.md`（`origin/main` に merge 済み） |
| Plan Source | `.ai/tasks/CH1-COMP-W2MB1.md` @ `84fbfba` |

### Result

**CHANGES_REQUIRED**

FACT・数値・行番号はすべてコードと一致し、方針（判定の式・範囲・ダメージ・待ち時間を変えずに溜めを前置きする、網の輪の外周を判定の半径に固定する）も妥当。ただし、実装の可否を判断できる計画としては次の 3 点が未定義で、Implementer に判断が残る（AGENTS.md §17.2 の「実装詳細を後で誰かが選ぶ」状態になる）。

1. 近接の溜めが **中断される場面**（ダウン・大怯み・浮き・撃破・再出現・Arena の Clear）での扱いと、床の予兆のメッシュの **持ち主と後片付けの経路** が決まっていない。
2. **網と近接の優先順** と、**攻撃の後の停止がどこまで効くか**（網の後にも止まるのか、向き直りは止まるのか）が曖昧。
3. E2E が読む「テストモードの記録」を **誰が出すか** が変更ファイルに無い（Debug Info の 1 行だけでは順序と時刻を取れない）。

### Independence

別 Agent・同一セッションの Orchestrator が起動（計画作成者の判断過程は入力にしていない。Human による差分の確認を推奨）。

### Checklist

| # | 項目 | 結果 | 根拠 |
| --- | --- | --- | --- |
| 1 | Specification compliance | NG | Human の要求（近接の予備動作、必要なら足元の予兆、網の輪の縮みの修正、iPhone、数値の不変を示すテスト、計画のみ）は網羅。ただし中断・後片付け・優先順・E2E の観測手段が未定義（Required Changes R1〜R3） |
| 2 | Scope compliance | OK | `git diff --stat origin/main...HEAD` は 4 ファイル（`.ai/tasks/` のみ、169+/5-）。`src/`・`tests/` の変更なし |
| 3 | Regression | N/A | コード変更なし。計画の回帰テストの一覧は妥当（Optional O4） |
| 4 | Build | N/A | 同上 |
| 5 | Unit tests | N/A（計画） | 項目 1〜5 は数値の不変と輪の半径の一致を固定できる。中断の項目が足りない（R1） |
| 6 | E2E tests | NG（計画） | Arena の Memory Fisher で実行可能。ただし観測に使う記録の出し方が無い（R3） |
| 7 | Save/Load integrity | OK | `09-save-load.js` を変えないと明記。追加する状態は敵の一時状態だけ |
| 8 | Existing behavior | OK（開示） | 当たる時刻の +0.5 秒の遅れ、攻撃の後の停止を「意図した変更」としてリスクに記載 |
| 9 | Code duplication / Rule 0 | 概ね OK | 網の溜めの変形・W2-4a の輪＋満ちる円の流用を明記。既存の `en.meleeTelegraphMesh` の後片付け経路の流用に触れていない（R1） |
| 10 | Unnecessary architecture changes | OK | 純粋関数は `core/memory-fisher.js`、表示は P07。既存の作法どおり |
| 11 | CH1-COMP.md の更新 | OK | 4a/4b/4c の Status を merged（DONE）へ、4d 行の追加、History 2 行の追加のみ。削除なし。W24a・W2MB の Status 行も DONE へ 1 行ずつ |
| 12 | 計画のみであること | OK | Status PLANNED、Approval 未チェック、「実装の開始には Human の承認が要る」と明記 |

### FACT verification

| # | 計画の記述 | コード（`8fd69cb`） | 判定 |
| --- | --- | --- | --- |
| F1 | `throwMemoryNet` P07`:2917` | `2917: function throwMemoryNet(en, plan)` | OK |
| F2 | `updateMemoryNets` P07`:2944`、輪を縮める行 `:2963`、発動の判定 `:2967` | `2944` 定義、`2963: n.ring.scale.setScalar(1 - step.progress*0.28)`、`2967: if(netHits(...))` | OK |
| F3 | `updateFisherAI` P07`:2993`、網の溜め `:3013-3032`、近接 `:3048-3060` | `2993` 定義、`3013` `if(en.netWindupT > 0)`〜`3032`、`3048` `meleeCD -= dt`〜`3060` | OK |
| F4 | C`memory-fisher.js` 時間の定数 `:26-31`、`netHits` `:96-100` | 一致 | OK |
| F5 | 近接の範囲 2.3、ダメージ `round(atk×0.7)` | `3049: distToPlayer < 2.3`、`3054: Math.round(en.atk*0.7)` | OK |
| F6 | 攻撃力 37（34 × 1.1） → 26 | `buildDuskFisher` atk 34、`buildEnemy` の `Math.round(variant.atk*_D.atk)`、`COMBAT_REBALANCE.atk 1.10`（★1 で t=0）→ 37、`round(25.9)` = 26 | OK |
| F7 | 近接の待ち時間 2.2、最初の 1 回は即時 | `3050: en.meleeCD = 2.2`。`meleeCD` は未設定で `(en.meleeCD\|\|0) <= 0` が真 | OK |
| F8 | 網の半径 2.7、輪 `scale 1 → 0.72` | `PROVISIONAL_NET_RADIUS = 2.7`、`RingGeometry(r*0.82, r)`、`1 - progress*0.28` | OK |
| F9 | 落ちてから発動まで 0.85 秒 | `PROVISIONAL_NET_ARM_SEC = 0.85`（灯で ×1.45） | OK |
| F10 | `postAtkRecoveryT = 0.45` を立てるが移動を止めない | `3059` で立てる。移動は `3044-3047`（`dist > 2.0`）で無条件。減算は `916` | OK |
| F11 | 網の溜め 0.5 / 灯 0.72、パニッシュ窓に入らない | `3035`。`punishWindowState`（C`punish-window.js:46`）は `netWindupT` を見ない | OK |
| F12 | 大怯みで取り消されない | `stunT` の分岐（P07`:1046-1050`）は AI を止めて return するだけ。`netWindupT` は残る | OK |
| F13 | 網は漁師だけが使う | `throwMemoryNet(` の呼び出しは P07`:3027` のみ | OK |
| F14 | Arena の「Memory Fisher」は同じ AI | P07`:771-772` `arenaThicken(buildDuskFisher(...), 1200)`（HP だけ変更）。training でも ★1 なので攻撃力 37 | OK |
| F15 | Debug Info はテストモードだけ | `14-training-ground.js:299` の `updateArenaEnemyInfo` は Arena のパネル（テストモードの training のみ） | OK |

### Risks（Reviewer の観点）

| リスク | 内容 |
| --- | --- |
| ダウン中に予兆が凍る | 通常敵の `triggerKnockdown`（P07`:5405-5409`）は `chargeState`・`fireCharging`・`postAtkRecoveryT` だけを畳み、AI は `knockedDown` の間 return する（P07`:937-968`）。新しい溜めの時間と床のメッシュをここで畳まないと、3.0 秒のダウンの間ずっと輪が出たままになり、起き上がりの直後に残りの溜めで判定が出る |
| 再出現での持ち越し | 村の通常敵は `respawnT` で再出現する（P07`:853-870`）。リセットの一覧に新しい溜めの状態が無いと、再出現の直後に判定が出る |
| メッシュの後片付け | `en.meleeTelegraphMesh` という名前なら、撃破（P07`:5461`）・Arena の Clear（P07`:815`）・世界の破棄（P02`:348`）で既に片付く。別の名前・別の持ち主にすると、3 か所すべてに追記が要る。計画はどちらにするか書いていない |
| 網の後にも止まる | 網を投げた時も `postAtkRecoveryT` を立てる（P07`:3029`）。「`postAtkRecoveryT` の間は移動を止める」を素直に実装すると、網の後にも 0.45 秒止まる（網の挙動の変更） |
| E2E の時刻 | 推定ゲーム内時間（実時間の 1/4・50ms 頭打ち）での 0.45〜0.6 秒の幅は、HD-MB1-1 で 0.6 秒を選ぶと上限ちょうどになる |

### Required Changes

| # | File | Location | Problem | Expected | How to check |
| --- | --- | --- | --- | --- | --- |
| R1 | `.ai/tasks/CH1-COMP-W2MB1.md` | 実装方針 1、変更するファイル、受け入れ基準 8、unit | 近接の溜めが中断される場面（ダウン `triggerKnockdown` P07`:5394-5410`、大怯み `stunT` P07`:1046`、浮き `liftPeak` P07`:1031`、撃破 `finishEnemyDeath` P07`:5461`、再出現 P07`:853-870`、Arena の Clear P07`:809-817`、世界の破棄 P02`:348`・P14-hud-boot`:2189` 付近）での扱いと、床の予兆のメッシュの持ち主・後片付けの経路が決まっていない | 場面ごとに「取り消す（溜めの時間を 0、待ち時間は？、輪を消す）／止めて再開する」を決めて表に書く（推奨: ダウン・撃破・再出現・Clear・世界の破棄は取り消して輪を消す。大怯み・浮きは今の網の溜めと同じく AI 停止のまま再開でよいが、輪が残ることを明記）。メッシュは既存の `en.meleeTelegraphMesh` の後片付け経路に乗せるか、乗せないなら追記する箇所を列挙する（Rule 0）。受け入れ基準 8 にダウンと再出現を足し、unit に「取り消し後は判定が出ない」を足す | 計画の表と受け入れ基準を読み、上の各場面に答えがあること |
| R2 | `.ai/tasks/CH1-COMP-W2MB1.md` | 実装方針 1（溜めの間・攻撃の後）、リスク「網の溜めとの組み合わせ」 | (a) 網の溜めと近接の溜めの優先順が「網の溜め → 近接の溜め」とだけあり、近接の溜めの最中に網の待ち時間が明けたらどうなるか（網が割り込むか、近接を終えてからか）が無い。(b) 「`postAtkRecoveryT` の間、移動を止める」は網を投げた後（P07`:3029`）にも効くが、それが意図か書いていない。停止の間に網・近接の溜めを始めてよいかも無い。(c) 向きは「プレイヤーへ固定」と「溜めの開始時に固定」が混在し、今のコードは毎フレーム向き直る（P07`:3007-3011`） | (a) 例: 「近接の溜めの間は網を始めない（`netCD` は進むが、溜めの終わりの後に投げる）」のように 1 つに決め、unit で固定する。(b) 停止を近接の後だけにするか網の後にも効かせるかを決める（網の後も止めるなら網の挙動の変更としてリスクに書く）。停止中に溜めを始めるかを決める。(c) 溜めの間の向き直りを止めるかを 1 つの書き方にそろえる（判定は全周なので見た目だけと明記） | 計画の記述が 1 通りに読めること |
| R3 | `.ai/tasks/CH1-COMP-W2MB1.md` | E2E 1〜3、変更するファイル | E2E は「テストモードの記録で溜めの開始 → 判定の順」を読むが、変更ファイルには Debug Info の 1 行（ポーリングでしか読めない）しか無い。今の漁師は `emitArenaFeedback` を出していない | P07 に `emitArenaFeedback`（P14-training-ground`:242`、内部で `state.testMode` を確認済み）の呼び出しを足すと明記する。例: `FISHER MELEE` の `WINDUP 0.50s r2.3` / `HIT (in range)` / `HIT (out of range)` / `CANCEL`、`MEMORY NET` の `THROW` / `ARM r2.7` / `BURST (in/out of range)`。E2E は W2-4a の `tests/dusk-boss-phase-burst.spec.js` と同じく `.arena-feedback-line` とダメージの数字を MutationObserver で読むと書く | 変更するファイルの表と E2E の手順に、記録の出所が書かれていること |

### Optional

- O1: E2E 1 の時刻の幅（0.45〜0.6 秒）は、HD-MB1-1 の決定値 ±余裕（例: 決定値 −0.1〜+0.15 秒）として書くと、0.6 秒を選んだ時に揺れない。
- O2: 「溜めの間に 2.3 の外へ出たら当たらない」場合も待ち時間 2.2 秒は溜めの終わりから数える、と一文で明記すると unit 3 の期待値がはっきりする。
- O3: Arena の E2E で 26 が出る前提（training の ★1、`state.debugMode` が偽）を一行書いておくと、将来の失敗の切り分けが楽になる。
- O4: 回帰に `tests/unit` の `punish-window` / `enemy-tier` 系（HD-MB1-2 の「入れない」を固定する意味で）と `dusk-boss-phase-burst` を足してもよい。
- O5: Rollback の「溜めの時間を 0 にすると今と同じ」は、攻撃の後の停止（実装方針 1）は戻らないので、停止の切り替えも 1 か所に置くと書くと正確。

## Round 2/3

### Review Target

| 項目 | 値 |
| --- | --- |
| Task ID | CH1-COMP W2-MB1（`.ai/tasks/CH1-COMP-W2MB1.md`） |
| Branch | `claude/ch1-comp-w2-mb1-plan` |
| Reviewed SHA | `cd333d0` |
| Diff range | `origin/main...HEAD`（`8fd69cb...cd333d0`） |
| Handoff Verification | `git diff --stat origin/main...HEAD` は 5 ファイル（`.ai/reports/CH1-COMP-W2MB1-plan-review.md`・`.ai/tasks/CH1-COMP-W2MB1.md`・`CH1-COMP.md`・`CH1-COMP-W24a.md`・`CH1-COMP-W2MB.md`）。`git diff origin/main HEAD -- src tests` は空。基準 SHA `8fd69cb` のコードを直接読んで確認した |
| Plan Source | `.ai/tasks/CH1-COMP-W2MB1.md` @ `cd333d0`（§1a〜§1c と Round 1 Fix を追加） |

### Result

**CHANGES_REQUIRED**（1 件）

Round 1 の R1〜R3 は解消されている（中断の表 §1b、優先順 §1a、テストモードの記録 §1c）。FACT・行番号もすべてコードと一致する。ただし、独立に読み直した結果、**近接の足元の輪の「中心」が判定の中心と一致し続けること** が計画に無い。漁師は通常敵なので、溜めの最中にプレイヤーの攻撃が当たると毎回ノックバックで滑る（P07`:5279-5289`、`knockbackVel` 最大 9・0.18 秒。ノックバックは P07`:1008-1017` で AI の前・大怯みの分岐の前に進むので、溜めの間も一時停止の間も位置が動く）。判定は溜めの終わりの漁師の位置から測る（「判定の式は今と同じ」）。輪を溜めの開始時に置いたままにすると、輪と判定の中心がずれる ―― Human の制約「見た目と判定の一致」に直接かかわるので、実装者の判断に残せない（§17.2）。

### Independence

別 Agent・同一セッションの Orchestrator が起動。Round 1 の指摘の確認だけでなく、計画の全節を `8fd69cb` のコードに当てて読み直した（計画作成者の判断過程は入力にしていない。Human による差分の確認を推奨）。

### Checklist

| # | 項目 | 結果 | 根拠 |
| --- | --- | --- | --- |
| 1 | Specification compliance | NG（1 件） | 近接の予備動作・足元の予兆・網の輪の修正・iPhone・数値の不変のテスト・計画のみ、はすべて網羅。足元の輪の中心と判定の中心の一致が未定義（R1） |
| 2 | Scope compliance | OK | 変更は `.ai/` の 5 ファイルのみ。`src/`・`tests/`・`basefile.html` の変更なし |
| 3 | Regression | N/A | コード変更なし。回帰の一覧（unit 全件、`punish-window`・`enemy-tier`、E2E 11 本、CI）は妥当。`tests/unit/punish-window.test.js`・`enemy-tier.test.js`・`tests/dusk-boss-phase-burst.spec.js` は実在 |
| 4 | Build | N/A | 同上 |
| 5 | Unit tests（計画） | OK | 1〜7 で時間・範囲・倍率・1 回だけの判定・輪の半径・優先順・中断を固定できる。中心の一致の項目は R1 で追加 |
| 6 | E2E tests（計画） | OK | `emitArenaFeedback`（P14-training-ground`:242-250`、`state.testMode` で早期 return）を P07 から呼ぶ前例あり（P07`:677`・`:4729`・`:4768`）。W2-4a の spec は MutationObserver で `.arena-feedback-line` と `.dmg-pop.incoming` を読む（`tests/dusk-boss-phase-burst.spec.js:22-34`）ので、同じ方法で観測できる |
| 7 | Save/Load integrity | OK | 追加するのは敵の一時状態だけ。`09-save-load.js` を変えないと明記 |
| 8 | Existing behavior（開示） | OK | 当たる時刻の +0.5 秒の遅れ（§1c 直下とリスク）、近接の後の 0.45 秒の停止（リスク）を意図した変更として記載。網の後の動きは変えないと明記 |
| 9 | Rule 0 | OK | `en.meleeTelegraphMesh` の既存の後片付け（撃破・Clear・世界の破棄）に乗せる。名前を共有しても衝突しない: その名前を書くのは `updateMansionMeleeTelegraph`（P07`:1316-1346`）だけで、呼び出しは洋館の個体の `M.mansionKind` の経路（P07`:1299`）に限られる。Debug Info の参照（P14-training-ground`:360-361`）も `atkType==='servant'` に限られる |
| 10 | Unnecessary architecture changes | OK | 純粋関数は `core/memory-fisher.js`、表示と副作用は P07。`concat-plugin.js` は import の行の追加だけ（既存の作法） |
| 11 | 内部の整合 | 概ね OK | 実装方針・§1a〜§1c・変更ファイル・unit・E2E・受け入れ基準・リスク・HD・Rollback は互いに矛盾しない。言い回しの揺れは Optional（O1・O4） |
| 12 | 計画のみ・誠実さ | OK | Status PLANNED、Approval 未チェック、iPhone は「Human の実機確認（自動テストでは確かめない）」、実装は未着手（src/tests の差分なし） |

### FACT verification（`8fd69cb`）

| # | 計画の記述 | コード | 判定 |
| --- | --- | --- | --- |
| F1 | `throwMemoryNet` P07`:2917`、`updateMemoryNets` `:2944`、輪を縮める `:2963`、発動の判定 `:2967` | 一致 | OK |
| F2 | `updateFisherAI` `:2993`、網の溜め `:3013-3032`、近接 `:3048-3060`、網の後の `postAtkRecoveryT` `:3029` | 一致 | OK |
| F3 | C`memory-fisher.js` 時間の定数 `:26-31`、`netHits` `:96-100`、半径 2.7、網の待ち時間 4.6 | 一致 | OK |
| F4 | §1a: 網の溜めの間は P07`:3013` の分岐の早期 return で近接を始めない | `:3013` `if(en.netWindupT > 0){ … return; }`（`:3031`）。`meleeCD` の減算（`:3048`）もこの return の後 | OK |
| F5 | §1a: 網の待ち時間は近接の溜めの間も減り続ける | `en.netCD -= dt` は `:3005` で分岐より前（毎フレーム）。`canThrow`（C`memory-fisher.js:73-77`）は `cd <= 0 && dist <= range` だけで最小距離が無い ―― 近くに立つと近接の溜めの途中で網の条件が立つので、§1a の「割り込まない」の定義は必要 | OK |
| F6 | §1b: `triggerKnockdown` P07`:5394-5410` の通常敵の分岐 | 関数は `:5394`、通常敵の分岐は `:5405` から（`chargeState`・`fireCharging`・`postAtkRecoveryT` を畳む）。守護型の分岐は `:5416-` で漁師は `guardian` でないので通らない | OK |
| F7 | §1b: ダウン中は AI が止まる | P07`:937-969`（`knockedDown` の間 `updateMobAnim` だけ呼んで return） | OK |
| F8 | §1b: 浮き（AI が呼ばれない状態）が漁師に起きる | 起きる。切り上げは `upliftFor(enemyWeightClass(en))` が正なら `liftPeak` を立てる（P11-combat-actions`:633-637`）。`enemyWeightClass`（C`uppercut.js:42-46`）は `isBoss`・`midbossName`・`strongMob`・`guardian`・`turret` のどれも無ければ `light`。`buildDuskFisher`（P14-dungeon-duskvillage`:1550-1559`）はどれも立てない（コメントの「強モブ扱い」に反して `strongMob` は無い）→ light → 浮く。浮いている約 0.5 秒（C`uppercut.js:69`）は P07`:1031-1039` で return し、`updateFisherAI` は呼ばれない | OK |
| F9 | §1b: 大怯み（0.4 秒の `stunT`）で AI が止まる | 漁師の階層は NORMAL（C`enemy-tier.js:39-45`。`midbossName` を持つのは水門守だけ P14-dungeon-duskvillage`:1397`）なので `applyBigFlinchInterrupt` が `stunT` を立てる（P07`:4974`）。P07`:1046-1050` で return | OK |
| F10 | §1b: HD-MB1-2 を「入れない」なら大怯みで溜めは取り消されない | `bigFlinchInterrupt` の `cancelWindup` は `punishWindowState().midWindup`（C`punish-window.js:46-55`）だけを見る。新しい溜めを窓に入れなければ取り消し対象外 → 一時停止して再開、の記述と一致 | OK |
| F11 | §1b: 撃破 P07`:5461`、Arena の Clear P07`:815`、世界の破棄 P02`:348` で `en.meleeTelegraphMesh` を片付ける | 一致（撃破は `visible = false`、他の 2 か所は `scene.remove`） | OK |
| F12 | §1b: 再出現 P07`:853-870` | `:853` `respawnT -= dt`、リセットの一覧は `:855-` に続く（`:864` `stunT`、`:878` 浮き）。漁師は `isBoss`・`roomTag` なしなので再出現する | OK |
| F13 | §1b: 網は敵とは別に進み、場所の移動で消える | `updateMemoryNets` は敵のループの外（P07`:1073`）。`clearMemoryNets` は P02`:377`・P14-hud-boot`:2189` | OK |
| F14 | §1c: `emitArenaFeedback` はテストモードだけ表示 | P14-training-ground`:242-243` `if(!state.testMode) return;` | OK |
| F15 | §1 攻撃の後: `postAtkRecoveryT` は残し、止まる時間は別に持つ | `postAtkRecoveryT` はパニッシュ窓の「振り抜いた直後」（C`punish-window.js:54`）で、減算は P07`:916`。止まる時間を別にすれば窓の挙動は変わらない | OK |
| F16 | 近接の範囲 2.3・`round(atk×0.7)`=26・待ち時間 2.2・最初は即時 | P07`:3049-3054`。攻撃力 37 は Round 1 の F6 で確認済み | OK |

### Risks（Reviewer の観点）

| リスク | 内容 |
| --- | --- |
| 溜めの最中のノックバック | 上の Result。プレイヤーは溜めの最中の漁師を殴るのが自然なので、ほぼ必ず起きる。大怯みの一時停止の間（「表示はそのまま」）にもノックバックで滑る |
| 停止の時間の持ち越し | 近接の後の専用の停止時間が、ダウン（3.0 秒）・再出現で消されないと、起き上がり・再出現の直後に最大 0.45 秒止まる（実害は小さいが、§1b の表に無い） |
| E2E 2 の回避 | 後ろへの回避は無敵が付くので、2.3 の内側に残っても 26 は出ない（ジャストドッジ）。「範囲の外で外れた」ことの証明にはならない（unit 3 が担う） |

### Required Changes

| # | File | Location | Problem | Expected | How to check |
| --- | --- | --- | --- | --- | --- |
| R1 | `.ai/tasks/CH1-COMP-W2MB1.md` | 実装方針 1（足元の予兆・溜めの間）、§1b（大怯みの行）、受け入れ基準 3、unit | 近接の溜めの間・一時停止の間に漁師がノックバック（P07`:1008-1017`、P07`:5279-5289`）で動くことへの扱いが無く、足元の輪の中心と判定の中心（溜めの終わりの漁師の位置）が一致し続けることが決まっていない。受け入れ基準 3 は半径だけを見ている | どちらか 1 つに決めて書く。(a) 推奨: 輪は毎フレーム `en.group.position` に置き直す（AI が止まる大怯み・浮きの間も含む。例: 洋館の弧と同じく `updateMobAnim` の経路で位置を更新する、または一時停止の分岐でも更新する）。判定は今の式どおり溜めの終わりの漁師の位置から測る。(b) 判定の中心を溜めの開始時の位置に固定し、輪もそこに置く（判定の式の変更になるので、その旨を開示）。受け入れ基準 3 を「外周 = 2.3、中心 = 判定の中心（ノックバックの後も）」にし、unit（純粋関数で中心を受け取る形なら unit、そうでなければコードと E2E）で確かめる方法を書く | 計画を読み、溜めの最中に漁師が動いた場合の輪と判定の中心が 1 通りに決まっていること |

### Optional

- O1: 受け入れ基準 6 は「攻撃の後 0.45 秒は動かない」とあるが、実装方針 1 は「近接の判定の後だけ」。テスターが網の後にも止まることを確かめないよう「近接の後」と書きそろえるとよい。
- O2: §1b の表に、近接の後の専用の停止時間をダウン・再出現で 0 に戻すこと（`postAtkRecoveryT` と同じ扱い）を足すと、Risks の「停止の時間の持ち越し」が閉じる。停止の間に網の溜めを始めてよいか（動かないので実害は無い）も一言あるとよい。
- O3: 浮きでの取り消しは P07`:1031-1039` の分岐で行う（P11-combat-actions は変えない）と行番号を書くと、変更ファイルの表と一致することがはっきりする。大怯みは一時停止なのに浮きは取り消す、という差の理由（浮き = 体ごと持ち上がるので輪を残さない、など）も一言あるとよい。
- O4: E2E 2 は、回避ではなく歩いて 2.3 の外へ出る、または `MISS` の記録に理由（`out of range` / `invulnerable`）を付けて区別すると、「範囲の外なら当たらない」を E2E でも示せる。
- O5: 足元の輪と内側の円を 2 つのメッシュにするなら、`en.meleeTelegraphMesh` を `THREE.Group` にして両方を子にする、と書くと既存の 3 か所の後片付けがそのまま効く。
