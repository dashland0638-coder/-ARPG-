# MAGE-001 Reanalysis

魔法使い Skill 1「ステップ＋幻影デコイ」 ―― 現在のコードを正とした再調査

Analyzer / READ ONLY。本レポート作成にあたりゲームコード・テスト・docs・既存 Task は変更していない。

- 過去の成果物（履歴として保持。上書きしない）: [`MAGE-001-analysis.md`](MAGE-001-analysis.md)（`66cb2b6`）、[`../tasks/MAGE-001.md`](../tasks/MAGE-001.md)
- 関連: [`DUSKVILLAGE-WORK4-report.md`](DUSKVILLAGE-WORK4-report.md) §7（幻影歩法の実装報告）、[`../decisions/DEC-001-duskvillage-rebuild.md`](../decisions/DEC-001-duskvillage-rebuild.md)、[`CHAPTER-STRUCTURE-T1-analysis.md`](CHAPTER-STRUCTURE-T1-analysis.md)
- Protocol: [`../AGENTS.md`](../AGENTS.md)
- ファイル名: 過去の `MAGE-001-analysis.md` を上書きしないため `-reanalysis` とした。Task 全体（Work Item 無し）の再分析の命名は `AGENTS.md` §7.2 / `reports/README.md` に定義が無い（→ UNKNOWN U-7）

## Status

**WAITING_APPROVAL**（指示どおりの扱い。ただし承認対象となる最新の計画は無い ―― 下の Implementation Gate を参照）

## Objective

MAGE-001（魔法使い Skill 1「ステップ＋幻影デコイ」）について、過去の分析・計画が現在のコードと一致しているかを確かめ、
「何が既に実装済みで、何が残っているか」を事実として確定する。

## Previous Analysis Summary

過去の `MAGE-001-analysis.md` / `MAGE-001.md`（Status: PLANNED）の主張。**現在の事実としては扱わない。**

| 分類 | 過去の内容 |
| --- | --- |
| 仕様 | `docs/COMBAT.md` §Mage Skill 1（**設計確定案・正式決定ではない**）: ステップ＋幻影デコイ、敵をデコイへ誘導、距離を取って魔法攻撃、通常ステップとの使い分け |
| 実装前提 | Skill 1 は `CHARGE_VARIANTS_BY_CLASS.mage` の6択（dash/retreat/spin/barrier/chain/nova）。デコイ・幻影は **存在しない**。敵は「誰を狙うか」の参照を持たず `state.pos` を直接読む（`07-ai-combat.js` に82箇所） |
| 計画 | 新規 `core/mage-decoy.js`（`decoyLureTargetFor` 等）、`state.mageDecoys`、`spawnMageDecoy` / `updateMageDecoys`、`mode:'decoy'` バリアント、`executeVariant` 分岐、`aggroPos(en)` で①接近・向き②攻撃開始だけ置き換え③命中判定は `state.pos` のまま、`disposeWorld` / `endCombatPresentation` で後始末、テスト追加 |
| 未確定 | ①新バリアントか `retreat` 置き換えか固定か ②同時存在数 ③④数値 ⑤誘導の方式 ⑥ボスを誘導対象にするか ⑧魔法使いを本編で操作する経路が無い |

## Previous Analysis vs Current Code

| 項目 | 過去分析 | 現在のコード | 差分 |
| --- | --- | --- | --- |
| phantom | 存在しない | `CHARGE_VARIANTS_BY_CLASS.mage.phantom`（幻影歩法、`mode:'phantom'`、`movement:'retreat'`、`baseMult:0`）が存在（`12-progression-ui.js:2214-2217`） | **実装済み**（DUSKVILLAGE WORK 4） |
| Mage Skill 1 の選択肢 | 6択 | 7択: dash / retreat / **phantom** / spin / barrier / chain（`skill1Alt`）/ nova（`job`）（`12-progression-ui.js:2196-2245`） | phantom が追加 |
| Mage Skill 1 の既定 | 言及なし（retreat 前提） | `defaultSkill1For('mage') = 'phantom'`（`core/chapter1-rules.js:50-52`）。本編の交代時とテストモードで使用（`14-hud-boot.js:1605` / `:1375`） | 本編で魔法使いの既定は幻影歩法 |
| retreat | 既存 | 残っている（`12-progression-ui.js` の `mage.retreat`）。phantom と並存 | 置き換えではなく追加（過去 Unknown ① は「追加＋既定化」で解決済み） |
| decoy の純粋ロジック | 新規 `core/mage-decoy.js` を計画 | `src/core/decoy.js` が存在（`pickLureTarget` / `aggroTarget` / `stepDecoyLife` / `decoyPullFor`、`PROVISIONAL_PHANTOM_LIFE_SEC = 5.0`、`PROVISIONAL_PHANTOM_LURE_RADIUS = 11.0`、`DECOY_PULL`）。unit `tests/unit/decoy.test.js` | **実装済み**（名前は計画と異なる。魔法使い専用ではなく汎用） |
| decoy の状態 | `state.mageDecoys` を計画 | `state.decoys:[]`（`core/state.js:171`、「保存しない」とコメント） | **実装済み**（名前が異なる） |
| 生成・更新・破棄 | `spawnMageDecoy` / `updateMageDecoys` を計画 | `spawnPhantomDecoy` / `updatePhantomDecoys` / `clearPhantomDecoys`（`11-combat-actions.js:1432-1476`）、毎フレーム更新 `13-update-loop.js:62` | **実装済み** |
| 発動 | `executeVariant` に `mode:'decoy'` 分岐を計画 | `mode==='phantom'` 分岐で `spawnPhantomDecoy(state.pos.x, state.pos.z)`（`13-update-loop.js:369-374`） | **実装済み** |
| enemy target | 概念が無い | 永続的なターゲット参照（`en.target` 等）は依然無い。代わりに毎フレーム計算の `aggroPoint(en)`（`07-ai-combat.js:2407-2410`）が「向かう先」を返す | **部分的に実装**（ターゲット ID ではなく、毎フレームの基準点差し替え） |
| enemy AI の置き換え範囲 | 通常敵7種（charger/wander/kite/turret/jumper/servant/ghost）を計画 | `aggroPoint` を呼ぶのは宵待ちの村の5種だけ: mirror / foam / copy / fisher / keeper（呼び出し6箇所 `:2483/2656/2718/2793/2928/3099`）。計画の7種は **呼んでいない** | **計画と異なる範囲で実装** |
| 命中判定 | `state.pos` のまま据え置く方針 | 方針どおり（例: 水鏡の影 `07-ai-combat.js:2583-2593` は `distToPlayer < 2.4` で判定） | 一致 |
| ボス | 触らない（未確定） | `updateBossAI` / `updateMansionLordAI` は `aggroPoint` を呼ばない。宵待ちの村のボス本体（村の残響）も既存ボス処理（`07-ai-combat.js:3213-`）。ボスが出す分身（mirror 等）は呼ぶ | 過去の方針どおり（ボス本体は対象外） |
| 後始末 | `disposeWorld` と `endCombatPresentation` を計画 | `disposeWorld`（`02-world-common.js:373`）とテストモードの地点移動（`14-hud-boot.js:1695`）で `clearPhantomDecoys()`。`resetDungeon()`（`12-progression-ui.js:1202`）は `mageOrbs` を消すが decoys は消さない | 一部異なる（→ U-4） |
| 魔法使いを本編で操作 | 経路が無い（第二章待ち） | Chapter 1 Arc 2（洋館クリア後）で主人公になる（`core/chapter1-progress.js` / `CHAPTER_CAST[2]`） | **解消** |
| 仕様書 | `docs/COMBAT.md` は「デコイ相当のコードは存在しない」と記載 | コードは存在する | **docs が古い**（`docs/COMBAT.md:191-193`） |

## Search Record

| Search Target | Search Terms | Scope | Result |
| --- | --- | --- | --- |
| phantom | `phantom` / `'phantom'` | `src/` `tests/` | 定義 `12-progression-ui.js:2214`、発動 `13-update-loop.js:369`、生成 `11-combat-actions.js:1418-1476`、既定 `core/chapter1-rules.js:50`、E2E `chapter1-progression.spec.js:197,203` / `scenario-test-mode.spec.js:51`、unit `chapter1-rules.test.js:53-55` |
| phantom 定義の数 | `phantom:` | `12-progression-ui.js` | 1件（`:2214`、mage のみ）。他クラスの技表に phantom は無い |
| decoy | `decoy\|Decoy` | `src/` | `core/decoy.js`、`state.js:171`、`11-combat-actions.js`、`07-ai-combat.js:2401-2409,2626,2959`、`02-world-common.js:373`、`14-hud-boot.js:1695`、`14-dungeon-duskvillage.js`（`en.decoyKind` 6件）、`core/memory-fisher.js:52-63`、`concat-plugin.js:70-72` |
| decoy のテスト | `decoy\|phantom\|幻影` | `tests/` | unit `tests/unit/decoy.test.js`。**E2E で誘導を検査するものは無い** |
| aggroPoint 呼び出し | `aggroPoint(` | `src/legacy/parts/` | 定義 `07-ai-combat.js:2407`、呼び出し6箇所（mirror/foam/copy×2/fisher/keeper） |
| 各 AI の参照点 | 関数範囲内の `state.pos` と `aggroPoint\|state.decoys` の件数 | `07-ai-combat.js` の各 `update*AI` | wander 0/0、charger 4/0、fire 2/0、kite 3/0、turret 2/0、jumper 4/0、servant 7/0、ghost 8/0、mansionLord 3/0、boss 5/0（decoy 参照なし） |
| AI 振り分け | `en.atkType===` | `07-ai-combat.js:1040-1053` | `isBoss` → `updateBossAI`、他は atkType で12種へ、既定は `updateWanderAI` |
| ターゲット参照 | `en\.target\b` / `targetId` | `src/` | **該当なし**（永続的なターゲット参照は無い） |
| aggro / 敵対 | `aggroOnDetect` / `isPartyHostile` / `triggered` | `core/enemy-aggro.js`、`07-ai-combat.js` | 敵対成立は各 AI の `state.pos` 距離＋LoS（例: mirror `:2488-2492`） |
| leash | `leash` / `stepLeash` | `src/` | `07-ai-combat.js:885-900`。距離は `state.pos` と `basePos` で測る（decoy は見ない） |
| lure | `lure` | `src/` | `core/decoy.js` 内のみ（`pickLureTarget`、`LURE_RADIUS`） |
| skillChoice | `skillChoice\s*=` | `src/` | 7件（T-1 分析と同じ。T-1 で `:1375` が `defaultSkill1For` に変わった） |
| defaultSkill1For | `defaultSkill1For` | `src/` `tests/` | 定義 `chapter1-rules.js:51`、呼び出し `14-hud-boot.js:1375 / 1605` |
| CHARGE_VARIANTS_BY_CLASS | `CHARGE_VARIANTS_BY_CLASS` / mage ブロック | `12-progression-ui.js:2196-2245` | mage: dash / retreat / phantom / spin / barrier / chain / nova |
| スキル入力 | `function skillInputDown\|skillInputUp\|releaseSkill\|executeVariant` | `13-update-loop.js` | `:199` / `:233` / `:246` / `:251` |
| skillAnim | `skillAnim` / `anim.type==='retreat'` | `13-update-loop.js` | 生成 `executeVariant` 内、移動 `:576-586`（dash/retreat 共通） |
| mageOrbs | `mageOrbs` | `src/` | 12件。`resetDungeon()` `12-progression-ui.js:1208` で片付け（decoys は同所に無い） |
| setEnemyOpacity | `setEnemyOpacity` | `src/` | 12件。phantom は使っていない（`MeshBasicMaterial` の不透明度を直接変える） |
| updateEnemy / updatePlayer | `updateEnemy\b` / `updatePlayer(` | `src/` | `updateEnemy` は **該当なし**（敵の更新は `updateEnemies` `07-ai-combat.js:816`）。`updatePlayer(` 7件 |
| save/load | `decoy\|phantom` | `09-save-load.js` | **該当なし**（decoys は保存されない。`skillChoice` は保存される `:47`） |
| 仕様書 | `デコイ\|幻影\|Skill 1` | `docs/COMBAT.md` / `docs/CHARACTERS.md` | `COMBAT.md:181-201`（設計確定案、「コードは存在しない」と記載）。CHARACTERS.md に該当なし |
| 決定記録 | `Skill 1\|幻影\|phantom` | `.ai/decisions/DEC-001-*.md` | `:41` 「幻影歩法は MAGE-001 と同一の仕組み。宵待ちの村専用の別実装を作らない。汎用構造を優先」、`:50` 「幻影歩法を使わないと進めない場所を作らない」 |

## FACT

**phantom（幻影歩法）**

- **F-1** 魔法使いの Skill 1 バリアント `phantom`（幻影歩法、👣）が存在する。`baseMult:0`（ダメージ無し）、`mode:'phantom'`、`movement:'retreat'`、`dist:3.6`、`duration:0.26`、`unlockKey` 無し（`12-progression-ui.js:2214-2217`）
- **F-2** 発動すると `executeVariant()` の `mode==='phantom'` 分岐で、**発動前の位置**に `spawnPhantomDecoy(state.pos.x, state.pos.z)` を呼ぶ。ダメージ処理は行わない（`13-update-loop.js:369-374`）。移動は既存の `state.skillAnim`（`movement:'retreat'`）で後方へ下がる
- **F-3** `spawnPhantomDecoy` は半透明（opacity 0.42）の円錐＋球の人影を置き、`state.decoys` に `{x, z, group, mat, life:5.0, maxLife:5.0, kind:'phantom'}` を積む。宵待ちの村では足元に波紋、`sfx('dodge')`（`11-combat-actions.js:1432-1454`）
- **F-4** 幻影は **当たり判定・HP を持たない**。寿命で消える（`updatePhantomDecoys`、残り時間に応じて薄くなる、`:1456-1470`）。同時数の上限は無い（`push` のみ）
- **F-5** phantom の技表は魔法使いにだけある（`phantom:` 定義1件）。ただし `core/decoy.js` と `state.decoys` はクラス非依存の汎用構造
- **F-6** `state.decoys` はセーブされない（`state.js:170` コメント、`09-save-load.js` に該当なし）。`state.skillChoice` はセーブされる
- **F-7** 片付けは `disposeWorld`（`02-world-common.js:373`）とテストモードの地点移動（`14-hud-boot.js:1695`）。`resetDungeon()` は decoys を片付けない

**Skill 1 実行経路**

- **F-8** `skillInputDown()`（`13-update-loop.js:199`）: 開始中・非ポーズ・非会話・非回避・`skillCD<=0` 等を確認し、`hasRes('skill')` → `spendRes('skill')` で押した瞬間に資源（MP）を消費、`skillCharging = true`
- **F-9** `skillInputUp()`（`:233`）: `releaseSkill()` を呼び、`state.skillCD = 1.6 * rankCD('skill') * …`（`:239`）
- **F-10** `releaseSkill()`（`:246`）→ `executeVariant(variant, skillChargeT, skillChargeMax, 'skill')`。`executeVariant` は `state.swinging = true`、`variant.movement` があれば `state.skillAnim = {type, t, duration, fwd, dist}`
- **F-11** `skillAnim` の `retreat` は `updatePlayer` 内で `anim.dist / anim.duration` の速度で後方へ動かす（`13-update-loop.js:576-586`）。この分岐内に無敵の付与は無い（読んだ範囲 `:560-600`）

**敵 AI**

- **F-12** 敵は永続的なターゲット参照を持たない（`en.target` / `targetId` 該当なし）
- **F-13** `aggroPoint(en)`（`07-ai-combat.js:2407`）は `aggroTarget(en位置, state.pos, state.decoys, {pull: decoyPullFor(en.decoyKind || en.atkType)})` を返す。釣られる幻影が引きつけ半径（`11.0 × pull`）内にあればその座標、無ければプレイヤーの座標
- **F-14** `aggroPoint` を呼ぶのは mirror / foam / copy / fisher / keeper の5種の AI だけ（すべて宵待ちの村の敵）。charger / fire / kite / turret / jumper / servant / ghost / wander / ボス / 洋館の主は呼ばない
- **F-15** `aggroPoint` を呼ぶ AI でも、敵対の成立（`aggroOnDetect`、LoS）と命中判定は `state.pos` で行う（例: mirror `:2488-2492` と `:2583-2593`、foam / copy / fisher / keeper も `distToPlayer = state.pos.distanceTo(...)` で索敵）
- **F-16** leash（敵対解除）は `state.pos` と `basePos` の距離だけを見る（`07-ai-combat.js:893-899`）
- **F-17** `DECOY_PULL` には `charge: 0.8` があるが、`updateChargerAI` は `aggroPoint` を呼ばないため、この値を参照する経路は無い
- **F-18** 記憶漁師の網は、狙いが幻影なら過去の足取りを使わず幻影の座標へ投げる（`07-ai-combat.js:2959`、`core/memory-fisher.js:52-63`）
- **F-19** 宵待ちの村のボス（村の残響）本体は既存のボス処理で、`aggroPoint` を呼ばない。ボスが出す分身（atkType `mirror`）は呼ぶ（`07-ai-combat.js:3213-3240`）

**仕様・決定・テスト**

- **F-20** `docs/COMBAT.md:181-201` は Mage Skill 1 を「設計確定案（正式決定ではない）」とし、「デコイ・幻影に相当するコードは存在しない」と書いている（現在のコードと食い違う）
- **F-21** DEC-001 は「幻影歩法は MAGE-001 と同一の仕組み。汎用構造を優先」「幻影歩法を使わないと進めない場所を作らない」と決定している（`DEC-001:41,50`）
- **F-22** テスト: unit `decoy.test.js`（選ばれる/遠すぎる/寿命切れ/pull 0 は見ない/aggroTarget）、E2E はアイコン 👣 と保存値 `phantom` のみ。**敵が幻影へ向かうことを E2E で検査するテストは無い**
- **F-23** 魔法使いは Chapter 1 Arc 2 で本編の主人公になる（`CHAPTER_CAST[2]`、`core/chapter1-progress.js`）。テストモードでも既定 Skill 1 は phantom（T-1）
- **F-24** `MAGE-001.md` は旧形式（`Status: **PLANNED**`、Human Approval 欄・Status History 無し）で、計画（Step 1〜9）は現在のコードでは大部分が別名で実装済み

## INFERENCE

- **I-1**（F-1〜F-4, F-13〜F-15）「phantom が存在する」だけでなく、**宵待ちの村の5種の敵については「phantom が敵を誘導する」ところまで実装されている**。ただし E2E による挙動の検証は無い（F-22）。WORK 4/8 の実機確認の記録はある（`CHAPTER1-WORK12-report.md:181` 「F 幻影歩法 A WORK 4/8 実機」）が、本レポートでは再現していない
- **I-2**（F-14）それ以外の敵（洋館・幽霊船・時計塔などの通常敵、全ボス本体）には **幻影は見た目だけで効果が無い**。`DUSKVILLAGE-WORK8-report.md:403` の「専用処理なしで全敵に通る」、WORK 4 報告の「突進型 0.8」は、現在のコードとは一致しない（F-17）
- **I-3**（F-15）命中判定を `state.pos` のまま据え置く方針は守られており、「敵が幻影へ向かって攻撃し、本物には当たらない」構造になっている。プレイヤーへの攻撃判定そのものは変わっていない
- **I-4**（F-4）同時数に上限が無いため、CD 1.6 秒ごとに置くと最大で約3体が同時に存在しうる（寿命5.0秒 ÷ CD1.6秒）。バランス上の意図かは不明
- **I-5**（F-15, F-16）幻影に釣られていても敵対の成立・解除はプレイヤー基準なので、「幻影だけ見つけて敵対する」「幻影を置いたまま遠ざかると敵対が切れる」といった挙動は起きない
- **I-6**（F-24）MAGE-001 の残作業は「新規実装」ではなく、**「誘導の対象を宵待ちの村以外の敵へ広げるか」「仕様（docs）を実装に合わせて正式化するか」「検証を足すか」** の判断になる可能性が高い

## DECISION

人間が決める事項（AI は決めない）。

| # | 問い | 関係する FACT |
| --- | --- | --- |
| **D-1** | MAGE-001 の範囲を何とするか。A: 現状（宵待ちの村の5種で有効）で完了とする / B: 他ワールドの通常敵へ誘導を広げる / C: ボス本体も含める | F-14, F-19, I-2 |
| **D-2** | 「ステップ＋幻影デコイ」を正式仕様として `docs/COMBAT.md` に確定するか（現在は設計確定案のまま・記述が古い） | F-20, F-21 |
| **D-3** | 幻影の同時数上限を設けるか | F-4, I-4 |
| **D-4** | 敵が幻影へ向かうことを E2E で検査するか（現在は unit のみ） | F-22 |
| **D-5** | `DECOY_PULL.charge`（参照経路が無い値）を残すか | F-17 |
| **D-6** | 旧形式の `MAGE-001.md` を新 Protocol（Status / Human Approval / Status History、必要なら Work Item 化）へ移行するか。移行する場合、過去の計画（Step 1〜9）を「実装済み・別名」として扱うか | F-24 |

## UNKNOWN

- **U-1** 他ワールドの通常敵へ誘導を広げなかった理由（意図的に宵待ちの村に限定したのか、未着手なのか）。コード・報告からは確認できなかった
- **U-2** WORK 4/8 の実機確認の具体的な手順と結果（報告の記載のみ。本レポートでは再現していない）
- **U-3** `PROVISIONAL_PHANTOM_LIFE_SEC = 5.0` / `LURE_RADIUS = 11.0` / 各 `DECOY_PULL` の数値の確定状況（`PROVISIONAL_` = 暫定と明記されている）
- **U-4** `resetDungeon()` が `disposeWorld` を伴わずに呼ばれる経路があるか（あれば幻影が寿命まで残る。最大5秒）
- **U-5** 敵が幻影へ向かっている間の攻撃モーションが、プレイヤーの近くで命中判定に入るケース（幻影がプレイヤーの近くにある場合）の体感。コード上は正しく当たる（F-15）が、実機の見え方は未確認
- **U-6** Mage Skill 1 の意図のうち「その後、距離を取って魔法弾などで攻撃する」「通常ステップとの使い分け」は操作体験の話で、コードからは充足を判定できない
- **U-7** Task 全体の「再分析」レポートの命名規則（Protocol に無い）

## Existing Systems

| 既存 | 場所 | 役割 |
| --- | --- | --- |
| `core/decoy.js` | `src/core/decoy.js` | 幻影を「向かう先」として選ぶ純粋ロジック（汎用） |
| `state.decoys` | `src/core/state.js:171` | 幻影の配列（非保存） |
| `spawnPhantomDecoy` / `updatePhantomDecoys` / `clearPhantomDecoys` | `11-combat-actions.js:1432-1476` | 生成・寿命・片付け |
| `aggroPoint(en)` | `07-ai-combat.js:2407` | 敵ごとの「向かう先」（誘導の唯一の入口） |
| `en.decoyKind` / `DECOY_PULL` | `14-dungeon-duskvillage.js` / `core/decoy.js` | 敵ごとの釣られやすさ |
| `CHARGE_VARIANTS_BY_CLASS.mage.phantom` | `12-progression-ui.js:2214` | Skill 1 の定義 |
| `executeVariant` の `mode:'phantom'` | `13-update-loop.js:369` | 発動 |
| `state.skillAnim`（retreat） | `13-update-loop.js:576` | ステップ移動 |
| `defaultSkill1For` | `core/chapter1-rules.js:51` | 魔法使いの既定 = phantom |
| unit `decoy.test.js` | `tests/unit/` | 選択ロジックの固定 |

## Mage Skill 1 Current Flow

```
Input（スキルボタン押下）
  └ skillInputDown()            13-update-loop.js:199   CD/状態チェック → spendRes('skill')（MP 消費）→ skillCharging
Input（離す）
  └ skillInputUp()              :233                    releaseSkill() → skillCD = 1.6 × rankCD …
     └ releaseSkill()           :246                    variant = 技表[state.skillChoice]（魔法使い既定 = 'phantom'）
        └ executeVariant()      :251                    swinging / movement:'retreat' → state.skillAnim
           └ mode==='phantom'   :369                    spawnPhantomDecoy(発動前の位置)（ダメージ処理なし）
movement
  └ updatePlayer の skillAnim   :576                    後方へ dist 3.6 / 0.26 秒（無敵付与なし）
phantom / VFX
  └ spawnPhantomDecoy           11-combat-actions.js:1432  半透明の人影・村では波紋・sfx('dodge')
enemy interaction
  └ 各 AI の aggroPoint(en)     07-ai-combat.js:2407    宵待ちの村の5種だけ：幻影へ接近・向き直り・攻撃開始
     命中判定                    各 AI                    state.pos 基準 → 幻影へ向けた攻撃は空振り
cleanup
  └ updatePhantomDecoys         :1456                   寿命 5.0 秒で消滅（終盤に薄くなる）
  └ clearPhantomDecoys          disposeWorld / テストモード地点移動
```

長押しの溜め（`chargeRatio`）は `mult` に効くが、phantom は `baseMult:0` / `maxMult:0` でダメージを使わない。

## Phantom Current Behavior

| # | 問い | 答え | 区分 |
| --- | --- | --- | --- |
| 1 | 何を意味するか | 魔法使いの Skill 1「幻影歩法」の技キー（`mode:'phantom'`） | FACT F-1 |
| 2 | Skill 1 との関係 | Skill 1 の7択の1つで、魔法使いの既定 | FACT F-1, Search |
| 3 | 何が生成されるか | 半透明の人影（円錐＋球）1体と `state.decoys` の1エントリ | FACT F-3 |
| 4 | 表示 / VFX か | 表示＋データ。見た目だけではない（`state.decoys` を敵 AI が読む） | FACT F-3, F-13 |
| 5 | 当たり判定を持つか | 持たない | FACT F-4 |
| 6 | 敵 AI から認識されるか | 宵待ちの村の5種の AI だけが `aggroPoint` 経由で読む。敵対の成立には使わない | FACT F-14, F-15 |
| 7 | 敵の移動先を変えられるか | 上記5種で、釣られる距離内なら変わる | FACT F-13, F-14 |
| 8 | 敵の攻撃対象を変えられるか | 攻撃を **始める基準点** は変わる。命中判定はプレイヤー基準のまま | FACT F-15 |
| 9 | 一定時間で消えるか | 5.0 秒（暫定値）で消える | FACT F-3, F-4 |
| 10 | Skill 1 実装だけで完結しているか | 生成・寿命は Skill 1 側で完結。誘導は敵 AI 側（`aggroPoint` を呼ぶ AI）に依存 | FACT F-2, F-14 |
| 11 | Mage 以外で使われているか | 技として持つのは魔法使いだけ。仕組み（`core/decoy.js`）は汎用 | FACT F-5 |
| 12 | save/load との関係 | 幻影は保存しない。Skill 1 の選択（`skillChoice`）は保存する | FACT F-6 |

## Enemy AI Current Behavior

| 観点 | 現在 | 根拠 |
| --- | --- | --- |
| プレイヤーの認識 | 各 AI が毎フレーム `state.pos` との距離・LoS で索敵（`aggroOnDetect` → `en.triggered`） | F-15 |
| `state.pos` の使い方 | 索敵・命中判定・leash は全 AI で `state.pos`。移動・向きの基準は宵待ちの村5種のみ `aggroPoint`、他は `state.pos` | F-14〜F-16, Search |
| ターゲット ID | 無い | F-12 |
| 攻撃対象の保持 | 無い（毎フレーム計算） | F-12, F-13 |
| 移動対象と攻撃対象 | 5種: 移動・攻撃開始 = `aggroPoint`、命中 = `state.pos`（分離）。他: どちらも `state.pos` | F-14, F-15 |
| aggro radius | AI ごとの索敵距離（例: mirror 9、foam 10、copy 11、fisher 14、keeper 16）＋ LoS | Search（各 AI の `distToPlayer <`） |
| leash | `stepLeash`、`state.pos` と `basePos` 基準 | F-16 |
| ボスの特殊処理 | `isBoss` は `updateBossAI`（decoy 参照なし）。洋館の主も同様 | F-14, F-19 |

## Reuse Assessment

INFERENCE。根拠の FACT を併記する。

| 選択肢 | 評価 | 根拠 |
| --- | --- | --- |
| **A. 現在の phantom をそのまま利用できる** | **宵待ちの村の敵に対しては該当**（既に誘導まで動く） | F-2〜F-4, F-13〜F-15 |
| **B. 少し拡張すれば利用できる** | **他ワールドの通常敵へ広げる場合はこれに該当**。仕組み（`aggroPoint` / `core/decoy.js`）は汎用なので、各 AI の移動・向きの基準を `aggroPoint(en)` に変えるのが最小（命中判定は触らない） | F-5, F-13, F-14, DEC-001 |
| C. 見た目だけで、敵 AI 側に新しい仕組みが必要 | **該当しない**。敵 AI 側の仕組みは既に存在する | F-13 |
| D. 完全な新規 decoy system が必要 | **該当しない** | F-3〜F-5, F-13 |

## Potential Change Surface

**Planner の計画ではない。** D-1 の選択によって、現在の構造のまま変更が及びそうな場所。

| 領域 | D-1 = A（現状で完了） | D-1 = B（通常敵へ拡大） | D-1 = C（ボスも） |
| --- | --- | --- | --- |
| Mage Skill 1 側（技表・発動） | 変更なし | 変更なし | 変更なし |
| phantom state / 生成・寿命 | 変更なし（D-3 なら上限の追加） | 同左 | 同左 |
| enemy AI | 変更なし | 対象 AI の移動・向きの `state.pos` を `aggroPoint(en)` へ（`07-ai-combat.js` の `updateChargerAI` 等） | `updateBossAI` / `updateMansionLordAI` にも同様（フェーズ・アンカーあり） |
| target / aggro / leash | 変更なし | 変更しない（`state.pos` のまま） | 同左 |
| hit detection | **変更しない** | **変更しない** | **変更しない** |
| `DECOY_PULL` / `decoyKind` | D-5 次第 | 対象の敵に値を足す | 同左 |
| VFX | 変更なし | 変更なし | 変更なし |
| 後始末 | U-4 次第で `resetDungeon` | 同左 | 同左 |
| tests | D-4 次第 | unit（pull）＋ E2E（D-4） | 同左 |
| docs | D-2 次第（`COMBAT.md` の記述） | 同左 | 同左 |

## Regression Risks

| 対象 | リスク | 根拠 |
| --- | --- | --- |
| Mage Skill 1 の既存挙動 | 現状維持なら無し。拡大しても技側は変えない | F-1〜F-4 |
| 他職の Skill 1 | 技表に phantom は無い。decoys が空なら `aggroPoint` はプレイヤー座標を返す | F-5, F-13 |
| 通常攻撃 / Skill 2 | 経路が別（`executeVariant` の他 mode、観測の灯） | Search |
| Boss / 強敵 | ボス本体を対象にすると、フェーズ・アンカー・特殊行動の基準点がずれる可能性 | F-19（INFERENCE） |
| leash | 移動基準を幻影にしても leash は `state.pos` 基準。幻影へ寄って遠ざかった敵が猶予後に敵対解除される可能性 | F-16（INFERENCE） |
| **hit detection** | **命中判定まで `aggroPoint` に置き換えると、プレイヤーが幻影の位置では無敵・本物の位置では当たらない等の重大な不具合になる**（コードコメント `07-ai-combat.js:2403-2405` が明記） | F-15 |
| damage | 幻影はダメージを受けない・与えない | F-1, F-4 |
| save/load | 幻影は非保存、`skillChoice` の保存は既存どおり | F-6 |
| Test Mode | 地点移動で幻影を片付け済み。既定 Skill 1 は phantom（T-1） | F-7, F-23 |
| Chapter 1 progression | 誘導の有無は進行に影響しない（DEC-001: 必須の攻略法にしない） | F-21 |
| 同時数 | 上限無しのため多数配置が可能 | F-4, I-4 |

## Recommended Next Investigation

Planner へ進む前に、必要なら Analyzer が追加で確かめること（いずれも READ ONLY）:

1. U-1: `git log -S "aggroPoint"` / WORK 4〜8 報告で、宵待ちの村に限定した意図の記述を探す
2. U-4: `resetDungeon()` の呼び出し元を確認し、幻影が残る経路の有無を確定する
3. D-1 = B を検討する場合: 対象 AI ごとに `state.pos` の読み取りを「移動・向き / 攻撃開始 / 命中 / 索敵」に分類する（過去分析の82箇所は現在値と異なる可能性があるので数え直す）
4. U-2 / U-5: テストモード（宵待ちの村・開始地点指定）で幻影の誘導を実機確認する（Analyzer の範囲を超える場合は別途判断）

## Implementation Gate

**WAITING_APPROVAL**（Implementation: **BLOCKED**）

| 開始条件（`../AGENTS.md` §6） | 状態 |
| --- | --- |
| Analyzer report | ✅ 本レポート（過去分析は履歴） |
| Planner task（最新の計画） | ❌ `MAGE-001.md` の計画は現在のコードと食い違う（大部分が別名で実装済み）。再計画が必要 |
| 実装に必要な DECISION の決定 | ❌ D-1〜D-6 が人間の判断待ち。特に D-1（範囲）が決まらないと計画が立たない |
| 実装範囲の明確化 | ❌ D-1 待ち |
| Human Approval | ❌ 未承認 |

Planner へ進むには、まず人間が D-1（MAGE-001 の範囲）と D-6（Task の移行）を決める必要がある。
