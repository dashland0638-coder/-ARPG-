# ENEMY-ATTACK-VIS-001 Analysis

## Task

- Task ID: ENEMY-ATTACK-VIS-001
- 依頼: 敵の攻撃モーション・攻撃範囲が分かりにくい。第1段階 W1 として「敵攻撃の視認性改善」の候補範囲を調べる
- Analyzer role: Analyzer / **READ ONLY**（AGENTS.md §5）。`src/` `tests/` `.ai/tasks/` は変更していない。書いたのは本 report だけ
- 基準: `main` @ `6edbe10c42fe1ed2d90d222cdaf91870b99bf4c9`（P-10 統合済み）。Analyzer branch `claude/enemy-attack-vis-001-analysis-7y2loi` は同 SHA から開始
- Task file `.ai/tasks/ENEMY-ATTACK-VIS-001.md` は存在しない（FACT: `ls .ai/tasks/`）。作成は Planner の担当
- 旧 report は remote に無い（FACT: `.ai/reports/P-10-artifact-handoff-analysis.md` F-14、AGENTS.md §5.2 適用範囲）。本 report は P-10 後の再実行版

## Scope

| 区分 | 内容 |
| --- | --- |
| W1 候補（依頼） | Forest Mansion の通常近接敵3種（使用人 `servant` / 番人 `warden` / 執事 `butler`）の攻撃前 telegraph、攻撃範囲の視覚表示、判定形状と表示形状の一致 |
| 対象外（依頼） | 攻撃力・攻撃判定・AI・難易度・telegraph 時間・設定値の変更、Boss、charge lane、projectile、weapon trail、攻撃モーション刷新、他ダンジョン、新しい独立した攻撃システム |

## Summary

- **FACT**: 3種は1つの近接状態機械 `updateShadowServantAI`（`07-ai-combat.js:2082`）と1つの攻撃表の器（`core/enemy-profiles.js`）を共有している。判定は「敵原点からの水平距離 ≤ `reach`」かつ「windup 開始時に固定した向きとの角度差 ≤ `halfAngle`」の**扇形1種類だけ**（`07-ai-combat.js:2183-2187`）
- **FACT**: この3種に地面の範囲表示は存在しない。予兆は (a) 身体のポーズ（`poseShadowServant` / `poseKeyringWarden` / `poseBlackButler`）と (b) 胴の emissive ハイライト（`threatHighlight`）だけ
- **FACT**: 地面へ扇を描く既存実装は2つある（ボスの `startArcSweep`、プレイヤーの `spawnSweepVFX`）。どちらも**メッシュの向きの式が判定の向き規約（`atan2(x, z)`、0 = +Z）と前後反転している**（下の F-20。three@0.154.0 で同じ変換を再計算して確認。実機画面では未確認）
- **INFERENCE**: W1 は既存システムの拡張で対応できる。必要なデータ（`reach` / `halfAngle` / 向き / 進行度 / 状態）はすべて既存の state と純粋関数から読める。新しい攻撃システム・新しい判定・新しい state は不要
- **DECISION（人間）**: 表示方式、`startArcSweep` の向きの不一致の扱い、guard break 時の進行度、E2E で何を観測可能にするか（下の DECISION 表）

---

## Existing System First 調査結果

AGENTS.md §3 の手順どおり、検索語と範囲を記録する。

| # | 探したもの | 検索語 / 範囲 | 結果 |
| --- | --- | --- | --- |
| S-1 | 地面の円形 telegraph | `telegraphDisc` / `src tests` | **あり** `07-ai-combat.js:3383`。呼び出しは `startEruption` のみ（`:3405`）。ボス専用 |
| S-2 | 地面の扇形 telegraph | `startArcSweep` / `src tests` | **あり** `07-ai-combat.js:3452`。呼び出しは templeGuardian の1箇所のみ（`:3770`） |
| S-3 | 扇形の床 VFX（プレイヤー側） | `RingGeometry\|CircleGeometry` / `src/legacy/parts` | **あり** `spawnSweepVFX`（`11-combat-actions.js:1246`、崩し斬り。判定と同じ角度・射程の弧） |
| S-4 | 輪の着弾予告 | `RingGeometry` / 同上 | **あり** `throwMemoryNet` の落ち先リング（`07-ai-combat.js:2864`、宵待ちの村） |
| S-5 | 予兆中の身体ハイライト | `threatHighlight` / `src` | **あり** `core/enemy-visibility.js:83`、適用 `07-ai-combat.js:4181` |
| S-6 | 予兆状態の単一定義 | `punishWindowState` / `isProfileMeleeWindup` | **あり** `core/punish-window.js:46`、`core/enemy-profiles.js:205`（`servantState === 'windup'`） |
| S-7 | 予兆の進行度 | `meleeWindupProgress` | **あり** `core/enemy-profiles.js:137`（`hold` 込みの 0→1） |
| S-8 | 通常敵用の地面範囲表示 | `telegraphMesh\|windupMesh\|attackIndicator\|dangerZone\|hitIndicator\|rangeIndicator\|attackRange\w*Mesh` / `src tests`（`*.js`） | **無いことを確認** |
| S-9 | 敵 telegraph の専用関数名 | `enemyTelegraph\|mobTelegraph\|servantTelegraph\|meleeTelegraph` / `src tests` | **無いことを確認** |
| S-10 | 敵の weapon tip / weapon node | `tipNode\|weaponTip` / `06-player-enemy.js` `07-ai-combat.js` | tip はプレイヤーだけ（`06-player-enemy.js:1645-1648` / `:1844-1847`）。敵側の tip は**無いことを確認**。敵の武器相当ノードは `M.shadowArm`（3種）、`M.keyring`（番人 `:3888`）、`M.candle`（執事 `:4024`）、`M.armR` / `M.foreR` |
| S-11 | charge lane | `chargeLane` / `src` | 参照は `07-ai-combat.js:3377,3538-3547`、`12-progression-ui.js:465,1212` だけ。**代入（生成）箇所は無いことを確認**（残骸コード。対象外） |
| S-12 | 状態機械の他の利用者 | `atkType:\s*'servant'\|defineMeleeProfile(\|meleeKind:` / `src` | `servant` / `warden` / `butler`（`core/mansion-enemies.js:336,344,354,571,626,649`）だけ。**他ダンジョンの利用は無い** |
| S-13 | 既存テストで床 telegraph を見ているもの | `arcSweep\|telegraphDisc\|startEruption\|spawnSweepVFX` / `tests` | **無いことを確認** |
| S-14 | E2E から敵内部を読む口 | `window\.[A-Za-z_]+\s*=` / `src`、`window\.` / `tests/*.spec.js` | 敵を公開するグローバルは**無いことを確認**（テストが使うのは `window.__dmg` 等の自前フックだけ）。敵状態は Arena の `#arena-enemy-info`（`14-training-ground.js:137-245`）の DOM から読む |
| S-15 | 仕様上の制約 | `予兆\|telegraph\|攻撃範囲\|UI` / `docs/ COMBAT_DESIGN.md MANSION_SCENARIO.md ARCHITECTURE.md` | 通常敵の地面表示を**禁止する記述は無いことを確認**。関連方針: 「予兆はまずモーションで見せる」（`07-ai-combat.js:1230` コメント）、「VFX は判定と同じ角度・同じ射程」（`MANSION_SCENARIO.md:355-359`、崩し斬り） |

---

## 対象ファイル（Relevant Files）

| path | reason |
| --- | --- |
| `src/core/mansion-enemies.js` | 3種の攻撃表 `SERVANT_ATTACKS`（`:83`）/ `WARDEN_ATTACKS`（`:160`）/ `BUTLER_ATTACKS`（`:241`）、プロファイル登録（`:336-367`）、敵定義（`:565-663`） |
| `src/core/enemy-profiles.js` | 器: `meleeAttackPlan`（`:103`、phase 差分）、`meleeAttackChoice`（`:123`）、`meleeWindupProgress`（`:137`）、`isProfileMeleeWindup`（`:205`） |
| `src/legacy/parts/07-ai-combat.js` | 状態機械 `updateShadowServantAI`（`:2082-2284`）、ポーズ `updateMansionMobExtras`（`:1244`）/ `poseShadowServant`（`:1285`）/ `poseKeyringWarden`（`:1390`）/ `poseBlackButler`（`:1483`）、ハイライト（`:4166-4199`）、ボス VFX `bossVfx` / `clearBossVfx` / `telegraphDisc` / `startArcSweep` / `updateArcSweep`（`:3370-3499`）、windup の中断経路（`:854,947,4775,5244,5259`）、死亡 `finishEnemyDeath`（`:5279`）、Arena（`:715-812`） |
| `src/legacy/parts/06-player-enemy.js` | 3種の見た目ノード（`:3512-4065`）、`servantState` 等の初期化（`:4369-4384`）、スケール（`:4248-4249`） |
| `src/legacy/parts/11-combat-actions.js` | `spawnSweepVFX`（`:1246`、扇 VFX の寿命管理の先例） |
| `src/core/enemy-visibility.js` | `threatHighlight`（`:83`） |
| `src/core/punish-window.js` | `punishWindowState`（`:46`） |
| `src/core/enemy-facing.js` | `angleDiff`（`:29`） |
| `src/legacy/parts/14-training-ground.js` | 敵情報パネル（`AI State` 行 `:167-168`） |
| `tests/unit/mansion-enemies.test.js` / `mansion-warden.test.js` / `mansion-butler.test.js` / `enemy-profiles.test.js` / `punish-window.test.js` / `enemy-visibility.test.js` | 数値・予兆・ハイライトの unit |
| `tests/mansion-enemies.spec.js` / `mansion-warden.spec.js` / `mansion-butler.spec.js` / `tests/helpers.js` | E2E（Arena 経由） |
| `MANSION_SCENARIO.md:86-180` | 3種の予兆・射程・半扇角・隙の表（仕様の出典） |

---

## FACT

| # | 事実 | 根拠 |
| --- | --- | --- |
| F-1 | 3種は `atkType:'servant'` を共有し、`meleeKind` で攻撃表だけを切り替える | `core/mansion-enemies.js:571,626-627,649-650`、`06-player-enemy.js:4369,4375` |
| F-2 | 状態は `idle → windup → strike → recover`。執事だけ `shift` / `fade` / `emerge` を持つ | `07-ai-combat.js:2111-2224` |
| F-3 | windup 開始時に向き `en.servantFacing` を固定し、windup 中は `group.rotation.y` をその向きに合わせ続ける | `07-ai-combat.js:2262-2263`（通常）、`:2153-2161`（執事の emerge）、`:2172` |
| F-4 | 判定: strike 中に1回だけ、`dist <= plan.reach` かつ `abs(angleDiff(facing, bearing)) <= plan.halfAngle`。`dist` は敵原点→プレイヤー原点の水平距離で、プレイヤーの半径は足していない | `07-ai-combat.js:2097-2098,2183-2187` |
| F-5 | `plan` は `meleeAttackPlan(kind, en.servantAttack, phase)`。執事は `phase = en.butlerPhase` で `lash` が差し替わる | `07-ai-combat.js:2089,2182`、`core/enemy-profiles.js:103-108`、`core/mansion-enemies.js:257` |
| F-6 | 攻撃表（reach / halfAngle rad / telegraph s）: 使用人 strike 2.05 / 1.00 / 0.34、sweep 3.30 / 1.60 / 0.84。番人 slam 2.95 / 1.05 / 0.78、sweep 3.90 / 1.85 / 0.95。執事 candle 2.55 / 1.00 / 0.62、lash P1 3.60 / 1.25 / 0.72、P2 4.60 / 1.35 / 0.66 | `core/mansion-enemies.js:85-90,164-170,245-257` |
| F-7 | guard break（番人のみ）は heavy（sweep）の plan で振り、windup 長だけ `guardBreakPlan().telegraphSec`（1.15 s）で上書きする。`reach` / `halfAngle` は sweep のまま | `07-ai-combat.js:2256-2273`、`MANSION_SCENARIO.md:139` |
| F-8 | `meleeWindupProgress` は `plan.telegraph` を分母にする。guard break の windup（`servantT` 初期値 1.15 > 0.95）では、残りが 0.95 を切るまで進行度 0 のまま | `core/enemy-profiles.js:137-145`、F-7 |
| F-9 | windup を途中で抜ける経路が5つある: 大怯み中断（→ recover）`:4775`、guard break 潰し `:5244`、ダウン `:5259`、起き上がり `:947`、湧き直し `:854` | `07-ai-combat.js` 各行 |
| F-10 | 死亡時 `finishEnemyDeath` は `servantState` を戻さない。死亡後は AI と `updateMobAnim` が呼ばれない（`updateDeathFall` だけ） | `07-ai-combat.js:5279-`、`:837-841` |
| F-11 | プレイヤーから 100 超の敵は update 自体を飛ばす。浮き（`liftPeak`）・硬直（`stunT`）中は AI を止めて `updateMobAnim` だけを呼ぶ | `07-ai-combat.js:829,1015-1037` |
| F-12 | 3種の予兆表示は身体のポーズだけ。`updateMobAnim` → `updateMansionMobExtras` → kind 別の pose 関数が `servantState` / `servantAttack` / `servantT` を読むだけで、AI 側は見た目の存在を知らない | `07-ai-combat.js:1221,1244-1283,1285-1343` |
| F-13 | `threatHighlight` は windup 中 0.75、交戦中 0.18、処刑可能 0.60。適用先は `en.body.material` の emissive（色 `0xff6a4a`）だけ。3種では `body` は胴の台形ボックス | `core/enemy-visibility.js:83-91`、`07-ai-combat.js:4178-4191`、`06-player-enemy.js:3526-3528` |
| F-14 | 番人の盾（`shieldGroup`）は guard break windup 中に白熱する別表示を持つ | `07-ai-combat.js:973-987` |
| F-15 | 敵の見た目は `g.scale` で拡大される: 執事 1.7、番人 1.5（「hitbox には影響しない」とコメント）。判定の `reach` はスケールを掛けない | `06-player-enemy.js:4248-4249`、F-4 |
| F-16 | 影腕の見た目の長さ（肩→爪、local）: 使用人 1.03、番人 1.27、執事 1.14。strike 中の最大 `stretch`: 使用人 1.85、番人 1.86、執事 P1 1.82 / P2 2.17 | `06-player-enemy.js:3596,3903,4040`、`07-ai-combat.js:1317,1426,1524` |
| F-17 | 敵に weapon tip ノードは無い（F-10 の S-10） | S-10 |
| F-18 | `telegraphDisc` / `startArcSweep` は `bossVfx` で `en.vfx` へ積み、`clearBossVfx` で消す。`clearBossVfx` は `en.special = null` も行う。世界切り替え時の一括削除は `isBoss` の敵だけ | `07-ai-combat.js:3370-3380`、`02-world-common.js:383` |
| F-19 | `startArcSweep` は表示と判定を1つの流れで持つ: 開始時に `en.special='arc'` と向き（`state.pos` 方向）を決め、`updateArcSweep` が同じ向きで判定・ダメージ・揺れ・効果音を出す | `07-ai-combat.js:3452-3499` |
| F-20 | `startArcSweep` の扇（`CircleGeometry(r, 24, 0, 2h)`、`rotation.x=-π/2`、`rotation.z = -f - h + π/2`）と `spawnSweepVFX` の弧（`RingGeometry(.., π/2-h, 2h)`、`rotation.z = -f`）は、どちらも中心が方位 `π - f` を向く。判定の向きは `f`（`atan2(x, z)`、0 = +Z。`core/crush-slash.js:127`）。一致するのは `f = ±π/2` のときだけ | 手計算（Rx(-π/2)·Rz(ρ) で中心 (0, r) → (r sin f, 0, -r cos f)）と、scratchpad に three@0.154.0 を入れて同じ変換の頂点重心を出したスクリプト（facing 0 → 3.14、0.70 → 2.44、1.57 → 1.57、2.50 → 0.64、-1.20 → -1.94）。**実機の画面では確認していない** |
| F-21 | 床の高さは `groundSlabs.length ? groundYAt(x, z, en.group.position.y) : 0` から取る | `07-ai-combat.js:3388,3462` |
| F-22 | Arena clear は `scene.remove(en.group)` と `enemies.splice` だけで、敵に付いた別メッシュは消さない | `07-ai-combat.js:798-806` |
| F-23 | Arena に3種がある: `Manor Servant` / `Manor Warden` / `Manor Butler` | `07-ai-combat.js:729,739,745` |
| F-24 | E2E は Playwright（`webServer` で Vite 起動、swiftshader の headless Chromium、workers 1）。敵状態は `#arena-enemy-info` の `AI State: WINDUP (sweep)` などを DOM から読む | `playwright.config.js`、`tests/mansion-enemies.spec.js:24-120`、`14-training-ground.js:167-168` |
| F-25 | unit は `node --test`。攻撃表の数値関係（reach 比、telegraph 下限、halfAngle 関係）と `meleeWindupProgress` は unit で固定済み。床 telegraph を見るテストは無い | `tests/unit/mansion-enemies.test.js:92-135`、`tests/unit/mansion-warden.test.js:218-239`、S-13 |
| F-26 | 仕様書の3種の表は F-6 と一致する | `MANSION_SCENARIO.md:92-95,135-139,170-174` |

## INFERENCE

| # | 推測 | 基づく FACT |
| --- | --- | --- |
| I-1 | 「攻撃範囲が分かりにくい」の主因の1つは、判定の扇（F-4 / F-6）がどこにも描かれていないこと（F-12、S-8） | F-4, F-6, F-12, S-8 |
| I-2 | 見た目のリーチと判定のリーチがずれている。strike 最大時の影腕の概算: 使用人 sweep 約 1.9（判定 3.30）、番人 sweep 約 3.5（3.90）、執事 lash P1 約 3.5（3.60）/ P2 約 4.2（4.60）。使用人の影腕薙ぎのずれがいちばん大きい。pitch・爪形状・肩のオフセットは入れていない概算 | F-15, F-16, F-6 |
| I-3 | `threatHighlight` の windup 表示は胴だけが光るので、「何が・どこまで来るか」は伝わらない。「今から来る」だけが伝わる | F-13 |
| I-4 | 表示に必要な値はすべて既存の state と純粋関数から読める: 形は `meleeAttackPlan(kind, servantAttack, butlerPhase)` の `reach` / `halfAngle`、向きは `servantFacing`、原点は `group.position`、進行度は `servantT` と `meleeWindupProgress`（guard break は F-8 の補正が必要）、表示の有無は `servantState === 'windup'`（`isProfileMeleeWindup`） | F-3, F-5, F-7, F-8, S-6, S-7 |
| I-5 | 状態を読んで毎フレーム描く方式（pose 関数と同じ読み方。F-12）なら、F-9 の5経路を個別に処理しなくても、状態が windup でなくなった時点で表示が消える | F-9, F-12 |
| I-6 | `startArcSweep` は表示と判定・ダメージ・`en.special` が結合している（F-19）ので、関数ごと3種へ流用すると判定を二重に持つことになり、「判定を変えない」制約に反する。流用できるのはメッシュの作り方（扇形ジオメトリ、床の高さ、透明マテリアル）だけ | F-18, F-19 |
| I-7 | `startArcSweep` / `spawnSweepVFX` の向きの式をそのまま使うと、表示が判定と前後反転する（F-20）。W1 の目的「判定形状と表示形状を一致させる」に直接かかわる | F-20 |
| I-8 | 表示メッシュを `en.group` の子にすると、番人 1.5・執事 1.7 のスケール（F-15）が掛かり、`reach` と表示がずれる。`scene` 直下に置くなら、死亡（F-10）・Arena clear（F-22）・世界切り替え（F-18）で消す処理が必要 | F-10, F-15, F-18, F-22 |
| I-9 | 判定はプレイヤー原点で測る（F-4）ので、表示の外周 = `reach` にすると、プレイヤーの身体が外周にかかっていても当たらないことがある。表示を正確にするか、身体の半径ぶんの見え方をどう扱うかは表現の判断 | F-4 |
| I-10 | 3種は1つの状態機械を共有し、他ダンジョンに利用者がいない（S-12）ので、状態機械を読む表示を1か所に足せば3種へ同時に効き、他ダンジョンへは波及しない | F-1, S-12 |
| I-11 | 執事の `fade` / `emerge` は windup ではないので、windup 基準の表示なら影移動中は出ない。emerge 直後の windup（F-3 `:2153-2161`）は通常どおり出る | F-2, F-3 |
| I-12 | 浮き・硬直中は AI が止まるので（F-11）、windup のまま止まった場合は表示も止まる。現状のポーズも同じ挙動 | F-11, F-12 |

## DECISION（人間が決める事項）

AI は決めない。選択肢と影響だけを書く。

| # | 決めること | 選択肢 | 影響 |
| --- | --- | --- | --- |
| D-1 | 範囲の見せ方 | (a) 塗りの扇 (b) 外周の弧だけ（崩し斬りと同じ「絵の線 = 当たる外周」の方針。`MANSION_SCENARIO.md:355-359`） (c) 扇 + 進行度で満ちる表示 | (a) 情報量は最大だが床の暗い洋館で目立ちすぎるおそれ。(b) 既存方針と揃う。(c) 進行度の表示に F-8 の扱いが必要 |
| D-2 | 対象の攻撃 | (a) 3種の light / heavy の全部 (b) heavy（sweep / lash）と guard break だけ | (a) 使用人 strike（0.34 s、2.05）にも表示が出る。(b) 「強い攻撃ほど読める」（`MANSION_SCENARIO.md:141`）と揃う |
| D-3 | 表示を判定のどこに合わせるか | (a) 外周 = `reach` ちょうど (b) プレイヤー半径ぶんを考慮した見え方 | (a) 判定と数値が完全に一致。(b) 見た目の当たり感は近づくが、表示の値が判定とずれる（I-9） |
| D-4 | 既存 `startArcSweep` / `spawnSweepVFX` の向きの不一致（F-20） | (a) W1 では触らず、別 Task として記録 (b) W1 の共通化に含めて直す (c) 実機で再現を確認してから決める | (a) ボス・プレイヤー側は対象外（Scope）に合う。(b) Boss・プレイヤー VFX への変更になり Scope を越える。(c) 先に確認手段（実機・E2E 画面）が要る |
| D-5 | ボス telegraph と共通化するか | (a) 3種用の表示だけを作り、ボスは触らない (b) 床の扇メッシュを作る部分だけを共通関数にして、ボスも使う | (a) Boss 対象外に合う。(b) ボスのコードに差分が出る（Scope 外）。D-4 と連動する |
| D-6 | guard break の windup の進行度（F-8） | (a) `GUARD_BREAK_TELEGRAPH_SEC` を分母にする（盾の白熱表示 `:980-982` と同じ扱い） (b) 進行度を表示しない | (a) 既存の盾表示と一致 |
| D-7 | E2E で何を検証するか | (a) Arena のテスト専用パネルに 1 行足して表示状態を読む (b) スクリーンショット比較 (c) unit のみ（純粋関数に切り出した形・向きの計算） | (a) 既存の観測方法（F-24）に沿う。(b) swiftshader の画面比較は不安定になりうる。(c) 実機の表示は検証されない |
| D-8 | 使用人 sweep の見た目のリーチのずれ（I-2） | (a) 床表示だけで補う (b) ポーズの `stretch` を合わせる | (b) は「攻撃モーション刷新」に近く、Scope 外の可能性 |

---

## 既存 telegraph の実装状況

| 種類 | 実装 | 使う敵 | 判定との関係 | 3種で使っているか |
| --- | --- | --- | --- | --- |
| 地面の円（`telegraphDisc`） | `07-ai-combat.js:3383` | templeGuardian / conservatoryBloom の eruption | 判定は `eruptR + 0.4`（`:3425`）。表示の円より 0.4 広い | いいえ |
| 地面の扇（`startArcSweep`） | `07-ai-combat.js:3452` | templeGuardian | 同じ `arcR` / `arcHalf` / `arcFacing`。ただしメッシュの向きは F-20 | いいえ |
| 床の弧（`spawnSweepVFX`） | `11-combat-actions.js:1246` | プレイヤーの崩し斬り（事後 VFX） | 同じ `range` / `arc`。向きは F-20 | いいえ |
| 着弾リング | `07-ai-combat.js:2864` | 宵待ちの村の漁師 | 同じ `plan.radius` | いいえ |
| 身体のポーズ | `07-ai-combat.js:1285-1600` 付近 | 3種（kind 別） | 状態だけを読む。形は判定と無関係 | **はい** |
| 胴の発光（`threatHighlight`） | `enemy-visibility.js:83`、`07-ai-combat.js:4181` | windup 状態を持つ全敵 | 状態だけ | **はい** |
| 盾の白熱 | `07-ai-combat.js:973-987` | guard break の予兆（番人） | 状態だけ | **はい**（番人） |
| ボス共通の振りかぶり | `07-ai-combat.js:4580-4586` | 汎用ボス | 床表示なし | 対象外 |
| 館の主 | `07-ai-combat.js:4328-` | Boss | 床表示なし（同じ扇判定 `:4365`） | 対象外 |

## Mansion 通常敵3種の攻撃構造

```
buildEnemy(mansionEnemyVariant(key))      06-player-enemy.js  servantState='idle', meleeKind
  └ updateEnemies → updateShadowServantAI  07-ai-combat.js:2082
      idle    : 索敵 → meleeAttackChoice(kind, dist, heavyCD, atkCD, phase) で light/heavy を選ぶ
      windup  : servantFacing 固定、servantT = plan.telegraph（guard break は 1.15）
      strike  : plan.active の間に扇判定 1 回（reach / halfAngle / servantFacing）
      recover : plan.recovery（guard break は override）、postAtkRecoveryT
      [執事] shift / fade / emerge
  └ updateMobAnim → updateMansionMobExtras → poseShadowServant / poseKeyringWarden / poseBlackButler
  └ threatHighlight(windup = punishWindowState(en).midWindup)
```

| 敵 | light | heavy | 固有 |
| --- | --- | --- | --- |
| 使用人 | strike（右腕） | sweep（影腕） | 大怯みで windup が潰れる |
| 番人 | slam（鍵束 `M.keyring`） | sweep（巨大影腕） | Super Armor、正面耐性、guard break、旋回 2.6 rad/s、スケール 1.5 |
| 執事 | candle（燭台 `M.candle`） | lash（影腕。P2 で reach 4.60） | 2 フェーズ、影移動、スケール 1.7 |

## 攻撃判定と表示の関係

- **判定の形は3種とも「原点中心・半径 `reach`・`servantFacing` を中心に ±`halfAngle` の扇」1つだけ**（F-4）。長方形・円・複数段は無い
- 判定の向きは windup 開始時に固定され、strike が終わるまで変わらない（F-3）。windup 中に描いた扇は、そのまま strike の判定と同じ位置になる
- 見た目（ポーズ・ハイライト）は状態だけを読み、`reach` / `halfAngle` を一切使っていない（F-12, F-13）。**現状、表示と判定は数値として結合していない**
- ボス側の `startArcSweep` は表示と判定が同じ値を使う点では結合しているが、メッシュの向きの式が判定と前後反転している（F-20）

## 再利用可能な既存システム

| 既存 | 再利用のしかた | 備考 |
| --- | --- | --- |
| `meleeAttackPlan`（phase 差分込み） | 表示の形（`reach` / `halfAngle`）の唯一の出所にする | 判定と同じ関数を読むので一致が保証される |
| `isProfileMeleeWindup` / `punishWindowState` | 表示の ON/OFF | 予兆の定義を増やさない |
| `meleeWindupProgress` | 表示の進行度 | guard break は D-6 |
| `en.servantFacing` / `en.group.position` | 向きと原点 | 判定と同じ値 |
| `updateMansionMobExtras`（状態を読んで描く枠） | 表示を置く場所の候補 | AI 側を変えない既存方針と揃う（I-5） |
| `startArcSweep` のメッシュ部分（扇ジオメトリ・透明マテリアル・`groundYAt` の床高さ） | 作り方の先例 | 向きの式は流用しない（I-7） |
| `spawnSweepVFX` の「外周の弧」方針 | D-1 (b) の先例 | 同上 |
| `threatHighlight` | 既存のまま併用 | 変更不要 |
| Arena（`Manor Servant` / `Warden` / `Butler`）と `#arena-enemy-info` | E2E の観測点 | F-23, F-24 |

## 新規システムが必要かどうか

**結論（INFERENCE）: 新しい攻撃システム・判定・AI・state は不要。既存システムの拡張で対応できる。**

根拠:

1. 判定形状は1種類の扇で、その値は `meleeAttackPlan` から読める（F-4, F-5）
2. 表示の ON/OFF・進行度・向き・原点はすべて既存の state と純粋関数にある（I-4）
3. 3種は1つの状態機械と1つの見た目の枠（`updateMansionMobExtras`）を共有する（F-1, F-12）
4. 地面に扇を描くメッシュの作り方は既存にある（S-2, S-3）

新しく書く必要が出るのは、3種の windup 状態を読んで床に扇（または弧）を描く**表示だけの小さな部品**（と、その向き計算）である。既存をそのまま呼べない理由:

| 既存 | そのまま呼べない理由 |
| --- | --- |
| `startArcSweep` / `updateArcSweep` | 判定・ダメージ・`en.special` と一体（F-19）。呼べば判定を二重に持つ。向きの式が判定と反転（F-20） |
| `telegraphDisc` | 円のみ。扇にならない。`bossVfx` 経由でボス前提の後始末（F-18） |
| `spawnSweepVFX` | 自前 rAF の事後フェード（220 ms）で、windup の間ずっと出す用途ではない。位置が `state.pos`（プレイヤー）固定。向きの式が反転（F-20） |
| `threatHighlight` | 強さ（0..1）を返すだけで形を持たない |

## W1 候補

提案（Planner が計画する。AI は決めない）:

| # | 候補 | 範囲 |
| --- | --- | --- |
| W1-a | 3種の windup 中に、判定と同じ `reach` / `halfAngle` / `servantFacing` の扇（または弧）を床に描く表示 | `07-ai-combat.js`（表示だけ）、必要なら `src/core/` に向き・形の純粋関数 |
| W1-b | 形・向きの計算を純粋関数にして unit で固定（`meleeAttackPlan` と同じ値になること、向きが `atan2(x, z)` 規約と一致すること、phase 2 の執事 lash） | `src/core/`、`tests/unit/` |
| W1-c | 表示の後始末（死亡・Arena clear・世界切り替え・中断5経路）の確認 | I-5 / I-8 |
| W1-d | E2E: Arena で3種を出し、windup 中に表示が出て、windup を抜けると消えることを確認（D-7） | `tests/mansion-*.spec.js` |

W1 で変えないもの: `SERVANT_ATTACKS` / `WARDEN_ATTACKS` / `BUTLER_ATTACKS` の数値、`updateShadowServantAI` の分岐と判定、`threatHighlight`、ポーズ関数。

## Out of Scope

- 攻撃力・判定・AI・難易度・telegraph 時間・設定値の変更
- Boss（館の主 `manorLord`、templeGuardian などの `startArcSweep` / `telegraphDisc`）
- `startArcSweep` / `spawnSweepVFX` の向きの修正（F-20。D-4 で別 Task にするかを決める）
- charge lane（生成箇所の無い残骸。S-11）
- projectile（侍女の影弾）、猟犬の突進、weapon trail
- 攻撃モーション刷新（D-8 の `stretch` 調整を含む）
- 他ダンジョン
- `basefile.html`（凍結。AGENTS.md §13）

## リスク

| # | リスク | 根拠 |
| --- | --- | --- |
| R-1 | 既存の扇メッシュの式を流用すると、表示が判定と前後反転する | F-20 / I-7 |
| R-2 | `en.group` の子にすると番人 1.5・執事 1.7 のスケールで表示が判定より大きくなる | F-15 / I-8 |
| R-3 | `scene` 直下のメッシュは、死亡・Arena clear・世界切り替えで残る | F-10, F-18, F-22 |
| R-4 | guard break の進行度が最初の 0.2 秒ほど 0 のまま（F-8） | F-7, F-8 |
| R-5 | 洋館は複数階（3F〜5F）。床の高さを 0 固定にすると上階で表示が埋まる／浮く | F-21 |
| R-6 | `src/legacy/parts/` は共有スコープの連結。関数名の衝突・共有変数の変更に注意 | AGENTS.md §13 |
| R-7 | E2E は swiftshader で実時間より遅い。windup（最短 0.34 s）をポーリングで捕まえにくい。既存 spec も観測を貯める方式（`tests/mansion-enemies.spec.js:73-89`） | F-24 |
| R-8 | 表示の外周 = `reach` でも、プレイヤー原点基準の判定のため「身体がかかっているのに当たらない」見え方は残る | I-9 |
| R-9 | 暗い洋館で透明の床表示がどれだけ見えるかは実機でしか判断できない | 未確認 |
| R-10 | 同じ部屋に3〜4体いると表示が重なる（戦闘③④） | `07-ai-combat.js:136-196` の配置 |

## Unknowns

**調査で確認できなかった事項**

- U-1: F-20 の前後反転が実機の画面でどう見えるか（templeGuardian の薙ぎ払い、崩し斬りの弧）。本 Analyzer は E2E・実機を実行していない
- U-2: 旧 Analyzer report（P-10 以前）の内容。remote に無い（P-10 F-14）ため比較していない
- U-3: 3種の影腕の見た目のリーチの正確な値（I-2 は概算）

**人間が決める事項**: 上の DECISION 表 D-1〜D-8

## 推奨する次工程

1. 人間: 本 report を Persistence（Artifact 1ファイルだけの commit、amend / force push しない。AGENTS.md §5.2）し、Source SHA / Blob SHA を埋めた Artifact Handoff を Planner へ渡す
2. Planner: H-1〜H-8 を検証してから `.ai/tasks/ENEMY-ATTACK-VIS-001.md` を作り、`Analysis:` 行を新形式で記録する
3. Planner: D-1〜D-8 のうち W1 の実装に必要なものを人間に確認し、W1 の Files To Change / Acceptance Criteria / Test Plan を書く。特に D-4（F-20 の扱い）は W1 の Scope と直接かかわる
4. 必要なら、実装前に U-1（F-20 の実機確認）を Debugger または人間が行う

---

## Artifact Handoff

AGENTS.md §5.2 / `.ai/agents/analyzer.md` の書式。

- 本節は依頼により report 末尾へ記録した。`.ai/agents/analyzer.md` のテンプレートは「report には書かない（会話などで渡す）」としている（手順書との差分として記録する）
- Source SHA / Blob SHA は、この report 自身を含む commit と、その commit の blob から決まる。ファイルの中に自分の Blob SHA を書くと内容が変わって Blob SHA も変わるため、**この節には原理的に書けない**。`.ai/agents/analyzer.md` の手順どおり空欄（= Handoff 未成立）とし、Persistence 後に人間が会話・Task file（Planner の `Analysis:` 行）側で埋める

```text
Artifact Handoff
- Task ID: ENEMY-ATTACK-VIS-001
- Kind: analysis
- Source Branch: claude/enemy-attack-vis-001-analysis-7y2loi
- Source SHA: （Persistence 前のため空欄 = Handoff 未成立。人間の commit 後に 40 桁で記入）
- Path: .ai/reports/ENEMY-ATTACK-VIS-001-analysis.md
- Blob SHA: （同上。git rev-parse <Source SHA>:.ai/reports/ENEMY-ATTACK-VIS-001-analysis.md の 40 桁）
- Persisted by: Human
```

Status: READY FOR HUMAN PERSISTENCE
