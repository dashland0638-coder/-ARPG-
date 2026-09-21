# MAGE-001 Analysis

## Task

MAGE-001 ―― 魔法使い Skill 1「ステップ＋幻影デコイ」

Analyzer / READ ONLY。本レポート作成にあたりゲームコードは一切変更していない。

## Goal

魔法使いの戦闘を「距離を取る → ステップ → 幻影デコイを残す → 敵をデコイへ誘導 →
安全な距離から魔法攻撃」という位置取り中心の体験にする。
そのための **実装可能性・既存資産・制約** を明らかにする。

## Relevant Specifications

| 出典 | 内容 |
| --- | --- |
| `docs/COMBAT.md` § Mage | 属性システム禁止。距離／誘導／デコイ／ステップ／魔法弾／位置取りで戦う |
| `docs/COMBAT.md` § Mage Skill 1 | 「ステップ＋幻影デコイ」は **設計確定案**。正式決定ではない。実装にデコイ相当のコードは無いと明記済み |
| `docs/COMBAT.md` § Skill | スキル装備スロットは2。Skill 2 は「閃く」方式で自動装備 |
| `docs/COMBAT.md` § Step | 通常ステップは基本移動・回避。現状の職業差は **モーションのみ**（無敵窓などの時間値は4職共通） |
| `docs/CHARACTERS.md` § 魔法使い | 回避はロールではなく「短い明滅」。`range:'ranged'`、攻撃間隔0.6秒、コンボ2段 |
| `docs/PROGRESSION.md` § Chapter 1 Policy | 過剰な育成システムを持ち込まない |
| `docs/ARCHITECTURE.md` § Legacy Rule | `src/legacy/parts/` は共有スコープ。module化禁止・最小変更 |
| `.ai/AGENTS.md` §4 §5 §10 | 最小変更／legacy不用意変更禁止／必要なファイルだけ読む |

## Current Skill Architecture

**A. 魔法使いのスキル構成（実装事実）**

プレイヤーが持つ能動アクションは4系統。番号と実体の対応は次のとおり。

| 呼称 | 実体 | 定義 | 入力 |
| --- | --- | --- | --- |
| Skill 1 | 武器スキル（バリアント制） | `CHARGE_VARIANTS_BY_CLASS[classKey]` | 専用スキルボタン（押下で溜め開始 → 離して発動） |
| Skill 2 | クラス固有スキル | `SKILL2_BY_CLASS` / `SKILL2_ALT_BY_CLASS` | 専用ボタン2 |
| Skill 3 | ボススキル | `BOSS_ACTIVE_SKILLS` | 専用ボタン3（装着制） |
| 必殺技 | ult | `CLASSES[].ult` / `JOB_ULT_BY_JOB` | 必殺ボタン |

魔法使いの Skill 1 バリアント（`12-progression-ui.js:2061`〜）:

| key | 名称 | mode | movement | 備考 |
| --- | --- | --- | --- | --- |
| `dash` | 巨大魔弾 | `orb` | なし | |
| `retreat` | 退避の魔陣 | `single` | `retreat`（dist 3.4 / 0.24秒） | **既に「魔法を放ち後方へ転移する」＝ステップ系** |
| `spin` | 魔導旋風 | `aoe` | `spin` | |
| `barrier` | 魔導障壁 | `barrier` | なし | 発動中無敵 |
| `chain` | 連鎖雷撃 | `chain` | なし | `unlockKey:'skill1Alt'`（スフィア解放） |
| `nova` | 天の焦土 | `aoe` | なし | `unlockKey:'job'`（魔導士転身で習得） |

**B. スキル定義の管理場所**

- バリアント表: `src/legacy/parts/12-progression-ui.js` の `CHARGE_VARIANTS_BY_CLASS`
- 選択中バリアント: `state.skillChoice`（既定 `'retreat'`）。取得は `getChargeVariants()`
- 解放判定: `unlockKey`（`'skill1Alt'` = `state.unlockedSkill1Alt` / `'job'` = `state.job`）

**C. 入力から処理までの流れ**

```
skillInputDown()            13-update-loop.js:~200
  ├ ガード: started/paused/dialogue/dodging/paralyzed/executeT/blockedInAir/skillCD
  ├ hasRes('skill') → spendRes('skill')      魔法使いは MP 15（RESOURCE_COSTS）
  └ state.skillCharging = true / skillChargeT = 0
       ↓（押している間 updateHoldInputs が skillChargeT を伸ばす）
skillInputUp()              13-update-loop.js:229
  ├ releaseSkill()  → getChargeVariants()[state.skillChoice]
  └ state.skillCD = 1.6 × rankCD('skill') × スフィア補正
       ↓
executeVariant(variant, chargeT, chargeMax, 'skill')   13-update-loop.js:247
  ├ ダメージ算出（baseMult→maxMult をチャージ率で補間、スフィア/ランク倍率）
  ├ state.swinging = true / beginMove(variant.key)
  ├ variant.movement があれば state.skillAnim = {type, t, duration, fwd, dist}
  └ variant.mode で分岐: single / aoe / chain / line / orb / burst3 / barrier / fan5
```

`executeVariant()` は **modeの追加で拡張できる分岐点**。バリアント表に1エントリ足し、
mode分岐を1本足すのが、この設計の「正しい増やし方」（`chain` / `nova` / スキル2の
`mode` 持ちが同じ方法で後付けされている）。

## Current Mage Implementation

**護りの魔球（Skill 2）の構造** ―― デコイに最も近い既存実装。

| 要素 | 実装 |
| --- | --- |
| 生成 | `castOrbGuard()`（`11-combat-actions.js:1327`）。2個を `state.mageOrbs` へ push |
| 実体 | `{mesh, light, side, target, charging}`。`SphereGeometry` + プール光源 `takeLight()` |
| 毎フレーム | `updateMageOrbs(dt)`（同1349）。呼び出しは `13-update-loop.js:61` の1箇所 |
| 消滅 | 自爆命中 / 対象消失 / 身代わり消費。いずれも `scene.remove` + `giveLight()` + `splice` |
| 身代わり | `tryConsumeOrbShield()`（同1396）。敵の被弾処理側が先頭1個を消費して無効化 |
| 後始末 | `disposeWorld()`（`02-world-common.js:367`）、`endCombatPresentation()`（`12-progression-ui.js:1147`） |
| 初期化 | `src/core/state.js:163` の `mageOrbs:[]` |
| セーブ | **保存しない**（出撃中だけの一時状態） |

デコイは「プレイヤーに追随せず、その場に留まり、寿命で消える版の mageOrbs」として
そのまま同じ骨格に乗る。

## Current Step Implementation

**D. 通常ステップ**

- 入力: `tryDodge()`（`src/legacy/parts/10-input.js:448`）
- ガード: started / paused / dialogue / dodging / paralyzed / `executeT>0` / **非接地不可** / `dodgeCD>0` / スタミナ
- 立てる状態: `dodging=true` / `dodgeT=0.2` / `dodgeDir` / `dodgeCD=0.75` / `invulnerable=true` /
  `justDodgedT=1.0` / `dodgeAttackWindowT=0.55×補正` / `hawkAssistT`
- 移動: `updatePlayer()` の `state.dodging` 分岐（`13-update-loop.js:551`）。
  距離はステ振りの影響を受けないよう `baseSpd×3.6` 固定
- 終了: `dodgeT<=0` で `dodging=false`、ボス能力/スフィアがあれば `invulnExtraT` を残す
- 見た目: `DODGE_MOTION[classKey]`（魔法使いは「短い明滅」）

**E. Skill 1 のステップと共通化できる処理**

`executeVariant()` の `variant.movement` → `state.skillAnim` が **既にステップ移動そのもの**。
`updatePlayer()` の `state.skillAnim` 分岐（同565）が `dash`（前方）/`retreat`（後方）/`spin`（その場）を
`dist / duration` で等速移動させる。`retreat` 系はまさに「魔法を撃って後ろへ下がる」挙動。

つまり **新しい移動系を作る必要は無い**。違いは次の2点だけ。

| | 通常ステップ | skillAnim 移動 |
| --- | --- | --- |
| 無敵 | あり（`invulnerable`） | **なし** |
| コスト | スタミナ（魔法使いもスタミナ側） | MP（`spendRes('skill')`） |
| CD | `dodgeCD 0.75` | `skillCD 1.6×補正` |

「通常ステップとSkill 1のステップを使い分ける」という仕様要求は、この差
（無敵の有無・コスト・CD・デコイの有無）で既に表現できる素地がある。

## Enemy Targeting

**G. 敵がプレイヤーを狙う仕組み**

- **敵側にターゲット参照は存在しない。** 各AIが毎フレーム `state.pos` を直接読む
  （`07-ai-combat.js` だけで82箇所）
- `en.triggered` は「パーティへの敵対状態」フラグ（`src/core/enemy-aggro.js`）。
  *誰を* 狙うかではなく *戦闘中か* を表す。leash（解除）も距離と時間だけで判定
- サポートAI（`companion`）は敵のターゲットにならない。敵は常にプレイヤー座標へ寄る
- AI種別は `updateWanderAI` / `updateChargerAI` / `updateFireEnemyAI` / `updateKiteAI` /
  `updateTurretAI` / `updateJumperAI` / `updateShadowServantAI` / `updateGhostAI` /
  `updateMansionLordAI` / `updateBossAI` の10種

**H. デコイを敵のターゲットにできるか**

可能。ただし「ターゲット変数を差し替える」形にはならない。各AIが `state.pos` を
読んでいる箇所を **1つの関数越しに読ませる** のが唯一の現実的な手段。

```js
// 07-ai-combat.js に1関数だけ追加するイメージ（未実装）
function aggroPos(en){ return decoyLureTarget(en) || state.pos; }
```

各AIの中で `state.pos` を読む用途は3系統あり、**置き換えてよいのは①②だけ**。

| 用途 | 置換 | 理由 |
| --- | --- | --- |
| ① 接近・移動・向き（`toPlayer`、`chargeDir`、`rotation.y`） | 置換する | ここが「誘導」の本体 |
| ② 索敵・攻撃開始距離（`distToPlayer < n`、`hasLineOfSight`） | 置換する | デコイの前で攻撃モーションに入らせる |
| ③ 命中判定（`d < hitR`、`state.hp` を削る側） | **置換しない** | `state.pos` のままなら、敵はデコイへ攻撃して **自然に空振りする** |

③を据え置くことで「デコイが攻撃を吸う」処理を新設せずに済む。
これが本タスク最大の設計上の要点。

**I. デコイの寿命**

`state.mageOrbs` と同じく、配列の要素が自分で寿命タイマーを持ち、
`updateMageDecoys(dt)` が減算して 0 で `scene.remove` + `giveLight` + `splice` する形が
既存設計に最も自然。`state` にタイマーを増やさない（配列要素が持つ）。

**J. デコイが攻撃を受けた場合**

- 既定案: **被弾しない**（当たり判定を持たない）。敵は③の判定で空振りする
- 代替案: `tryConsumeOrbShield()` と同型の「1発で壊れる」処理。既存の消費経路
  （`tryConsumeOrbShield` は `updateChargerAI` など複数の被弾箇所から呼ばれている）に
  相乗りできるが、被弾箇所すべてに分岐が増えるため最小変更から外れる
- どちらを採るかは **未確定**（仕様判断が要る）

**K. 複数存在できるか**

配列で持つので技術的には可能。ただし同時存在数は体験・バランスに直結するため **未確定**。

**L. 既存の敵AIを変更する必要があるか**

必要。ただし変更は「`state.pos` → `aggroPos(en)` の読み替え」に限定でき、
AIの状態機械・閾値・タイミングには触れない。
対象は誘導を成立させたいAIのみに絞れる（全10種を一度に触る必要はない）。

`updateMansionLordAI` / `updateBossAI` は独自のフェーズ管理・影分離・アンカー
（`en.lordAnchor`）を持ち、`docs/ARCHITECTURE.md` が「既存の戦闘基盤は使うだけで触らない」と
定めている領域。**ボスを誘導対象にするかどうかは仕様判断（未確定）** で、
初期実装から除外するのが安全側。

## VFX / Rendering

**M. 幻影を表現できるか** ―― 可能。ただし注意点が1つある。

- **`buildPlayer()` を再利用してはいけない。** `player` と `playerMixerParts` は
  `02-world-common.js:9` で宣言された **共有可変変数**（`let player, playerMixerParts = {}`）で、
  `buildPlayer()` は実行時に `playerMixerParts` を書き換える。2回目の呼び出しは
  プレイヤー本体のリグ参照を壊す ―― `docs/ARCHITECTURE.md` が警告する共有スコープ事故そのもの
- 代わりに `buildCompanion()`（`08-loot-equipment.js:902`）と同じ作り方
  ＝ THREE のプリミティブを数個組んだ軽量グループが素直。
  酒場の「影の旅人」の影だまり（`CircleGeometry` + 半透明 `MeshBasicMaterial`）も同系の前例

**N. 再利用できる透明度・VFX**

| 既存資産 | 場所 | 用途 |
| --- | --- | --- |
| `setEnemyOpacity(en, alpha)` | `07-ai-combat.js:2230` | `userData.opacityBase` を保持したまま群を半透明化する定石。同じ書き方をデコイへ流用できる |
| `takeLight()` / `giveLight()` | 光源プール | 生成の度に新規ライトを作ると **シェーダ再コンパイルのスタッター** が出る（mageOrbs のコメントに明記）。必ずプールを使い、必ず返す |
| `spawnUltimateVFX(center, {radius, vfxColor})` | `11-combat-actions.js:1965` | 生成・消滅時の一発演出 |
| `spawnToast(text, color)` | 同2093 | 「魔球が身代わりになった!」と同じ通知 |
| `flashScreen()` | | `executeVariant()` 末尾で既に呼ばれる |
| `DODGE_MOTION.mage`（明滅） | `13-update-loop.js:1016` | 幻影の見た目を魔法使いの回避演出と揃える指針 |

## Relevant Files

- path: `src/legacy/parts/12-progression-ui.js`
  - role: Skill 1 バリアント表・スキル2定義・鑑定所UI
  - symbols: `CHARGE_VARIANTS_BY_CLASS`（2061〜 mage）、`getChargeVariants()`（2325）、
    `SKILL2_BY_CLASS`（2129）、`endCombatPresentation` 周辺の `mageOrbs` 掃除（1147）
  - why: デコイ用バリアントを足すならここが唯一の定義場所

- path: `src/legacy/parts/13-update-loop.js`
  - role: 入力保持・スキル発動・プレイヤー移動・毎フレーム更新
  - symbols: `skillInputDown/Up`（200/229）、`releaseSkill`（242）、`executeVariant`（247）、
    `updatePlayer` の `dodging` 分岐（551）/`skillAnim` 分岐（565）、`updateMageOrbs(dt)` 呼び出し（61）、
    `DODGE_MOTION`（1012）
  - why: 発動経路・ステップ移動・毎フレーム更新の追加点がすべてここ

- path: `src/legacy/parts/11-combat-actions.js`
  - role: 攻撃・スキル2実体・VFX・リソース
  - symbols: `castOrbGuard`（1327）、`updateMageOrbs`（1349）、`tryConsumeOrbShield`（1396）、
    `RESOURCE_COSTS`（mage skill:15）、`spawnUltimateVFX`、`spawnToast`
  - why: デコイの生成・更新・破棄の**実装手本**がそのままここにある

- path: `src/legacy/parts/07-ai-combat.js`
  - role: 敵AI・被ダメージ処理
  - symbols: `updateChargerAI`（1621）、`updateKiteAI`（1792）、`updateTurretAI`（1854）、
    `updateJumperAI`（1885）、`updateShadowServantAI`（2023）、`updateGhostAI`（2247）、
    `updateMansionLordAI`（3239）、`updateBossAI`（3435）、`setEnemyOpacity`（2230）、
    `dealDamageToEnemy`（3950）
  - why: 誘導を成立させる唯一の場所。`state.pos` 直読みが82箇所

- path: `src/legacy/parts/10-input.js`
  - role: 入力。通常ステップ
  - symbols: `tryDodge`（448）、`inputToWorldDir`（442）
  - why: 「通常ステップとの使い分け」を判断する基準。入力方向の取り方も流用できる

- path: `src/legacy/parts/02-world-common.js`
  - role: ワールド構築・破棄、共有変数の宣言
  - symbols: `let player, playerMixerParts = {}`（9）、`disposeWorld()` の `mageOrbs` 掃除（367）
  - why: デコイの後始末を足す場所。`playerMixerParts` 再利用禁止の根拠

- path: `src/core/state.js`
  - role: ゲーム進行状態
  - symbols: `mageOrbs:[]`（163）
  - why: デコイ配列の初期化場所

- path: `src/core/enemy-aggro.js` / `src/core/enemy-tier.js`
  - role: 敵対状態と leash、敵の階層
  - symbols: `isPartyHostile`、`aggroOnDetect`、`aggroOnDamage`、leash 判定
  - why: 「デコイで敵対が切れないか」を確認する必要がある（leash はプレイヤー距離で判定）

- path: `src/core/mage-impact-aoe.js`
  - role: 魔法使い専用の純粋計算
  - why: 「mage 専用の小さな core モジュール＋単体テスト」の前例。デコイの純粋部分を切り出す型

- path: `src/core/combat-cleanup.js`
  - role: 撃破→演出の境界で落とす state キーの表
  - symbols: `PENDING_COMBAT_KEYS`、`ATTACK_ANIM_KEYS`
  - why: デコイ状態をここに載せるべきか判断が要る（載せるなら表と単体テストを更新）

- path: `tests/unit/mage-impact-aoe.test.js` / `tests/unit/enemy-aggro.test.js` / `tests/unit/combat-cleanup.test.js`
  - role: 単体テストの書き方の手本
  - why: 新規 core モジュールのテストをこの形式で書ける

- path: `tests/combat-test-arena.spec.js`
  - role: Test Mode 経由のE2E
  - symbols: `#open-testmode-btn` → `.class-card[data-key="..."]` → `#testmode-start-btn`、`#arena-toggle-btn`
  - why: **魔法使いを実際に操作できる唯一の経路**（本編は第一章＝剣士固定）。E2Eはここに乗せる

## Existing Reusable Systems

1. **バリアント＋`executeVariant()` の mode 分岐** ―― 新スキルの正規の追加手段
2. **`state.skillAnim`** ―― ステップ移動そのもの（`retreat` / `dash` / `spin`）。新設不要
3. **`state.mageOrbs` の骨格** ―― 配列 + 毎フレーム更新 + `disposeWorld`/`endCombatPresentation` 掃除
4. **光源プール `takeLight` / `giveLight`** ―― スタッター回避。必ず返却する
5. **`setEnemyOpacity()` の半透明化パターン** ―― `userData.opacityBase` を保持する書き方
6. **`spawnUltimateVFX` / `spawnToast` / `flashScreen`** ―― 生成・消滅の演出
7. **`RESOURCE_COSTS` / `hasRes` / `spendRes`** ―― MPコスト（mage skill:15）は既に通っている
8. **`en.triggered` + leash（`core/enemy-aggro.js`）** ―― 敵対状態。新概念を作らない
9. **`tryConsumeOrbShield()`** ―― 「身代わりで1発消費」を後から足す場合の既存経路
10. **`core/mage-impact-aoe.js` + 単体テスト** ―― 純粋ロジックの切り出し方の型

## Required New Systems

| # | 新規 | 規模 | 備考 |
| --- | --- | --- | --- |
| 1 | デコイ実体の配列（`state.mageDecoys` 相当）と毎フレーム更新 | 小 | `mageOrbs` の写し |
| 2 | デコイの見た目（軽量プリミティブ群 + 半透明 + プール光源） | 小 | `buildPlayer()` は使えない |
| 3 | 敵AIの参照点の1段間接化（`aggroPos(en)` 相当） | **中** | 本タスクの核。①②のみ置換 |
| 4 | デコイ用バリアント定義（mage の Skill 1 へ1エントリ） | 小 | `mode` と `movement` の組み合わせ |
| 5 | 誘導対象の選定と寿命の純粋ロジック（`core/mage-decoy.js` 相当） | 小 | 単体テスト可能な形で切り出す |
| 6 | 後始末（`disposeWorld` / `endCombatPresentation` / 戦闘不能） | 小 | 光源返却の漏れが事故になる |

## Risks

| # | リスク | 深刻度 | 緩和 |
| --- | --- | --- | --- |
| R1 | `state.pos` 82箇所のうち **命中判定まで置換してしまう** | 高 | ①②のみ置換。③は据え置き。差分レビューで用途を1行ずつ確認 |
| R2 | `buildPlayer()` 再利用で `playerMixerParts` を破壊 | 高 | プリミティブ群で作る。`buildPlayer` を呼ばない |
| R3 | プール光源の返却漏れでライトプールが恒久的に縮む | 中 | 消滅経路すべてで `giveLight()`。`disposeWorld` にも掃除を足す |
| R4 | ボスAI（館の主・フェーズ/影分離）へ波及 | 中 | 初期実装ではボスを誘導対象から除外 |
| R5 | leash がプレイヤー距離で判定されるため、誘導中に敵対が解ける可能性 | 中 | leash 条件は変更せず、実機で挙動を確認してから判断 |
| R6 | 既存 `retreat`（退避の魔陣）と役割が重複し、選択肢が死ぬ | 中 | 別バリアントにするか置き換えるかを人間が決める（未確定） |
| R7 | デコイ生成で処理落ち（mageOrbs が踏んだシェーダ再コンパイル問題） | 中 | 既存のプール／使い回しに必ず乗せる。同時存在数を絞る |
| R8 | 魔法使いは本編で操作できないため、退行が通常プレイのテストに現れない | 中 | Test Mode 経由のE2Eを必ず用意する |

## Specification / Implementation Differences

| # | 仕様 | 実装 | 扱い |
| --- | --- | --- | --- |
| S1 | Skill 1 は「ステップ＋幻影デコイ」（設計確定案） | 該当コード無し。デコイ・幻影の実装はゼロ | 本タスクで実装するかは正式決定待ち |
| S2 | Chapter 1 は「Skill 1 だけを持って出発」 | Skill 1 は鑑定所でいつでも付け替えられる6択（うち2つは解放制） | **未確定**。「Skill 1 = 魔法使いはデコイで固定」なのか「選択肢の1つ」なのかで実装が変わる |
| S3 | ステップの職業差は現状モーションのみ | 同上（仕様どおり） | 差異なし |
| S4 | 「デコイ」は魔法使いの戦い方の構成要素（docs/COMBAT.md） | 既存の最も近い実装は「護りの魔球」＝身代わり・自爆。誘導はしない | 仕様の「デコイ」と実装の「魔球」は別物。混同しない |
| S5 | 属性システム禁止 | 属性の実装は存在しない | 本タスクでも属性を導入しない（遵守） |

新たな **実装差異（docs/README.md 追記候補）は発見されなかった**。
S2 は docs に既に「設計確定案」として記録済みの範囲内。

## Root Cause / Main Constraint

問題は「デコイをどう描くか」でも「どう消すか」でもない。

**この実装には、敵が『誰を狙っているか』という概念が存在しない。**
各AIが毎フレーム `state.pos` を直接読む構造（`07-ai-combat.js` だけで82箇所）であり、
「プレイヤー以外を狙わせる」には、その読み取りを1段間接化する以外の手段がない。

したがって本タスクの成否は、次の一点に集約される。

> `state.pos` の読み取りのうち「接近・向き・攻撃開始距離」だけを
> `aggroPos(en)` へ置き換え、**命中判定は `state.pos` のまま残す**。

これが守られていれば、
「敵がデコイへ寄る」「デコイの前で攻撃する」「プレイヤーには当たらない」
の3つが、新しい当たり判定もダメージ経路も追加せずに同時に成立する。
逆にここを取り違えると、無敵バグか、デコイが機能しないかのどちらかになる。

## Unknowns

**仕様として決まっていないもの（AIが勝手に決めてはならない）**

1. Skill 1 をデコイ固定にするのか、既存6択に1つ足すのか、`retreat` を置き換えるのか（S2/R6）
2. デコイに当たり判定を持たせるか（空振りさせるだけか、1発で壊れる身代わりか）
3. 同時に存在できるデコイの数
4. デコイの寿命（秒）、誘導半径、ステップ距離・時間、MPコスト、クールダウン
5. Skill 1 のステップに無敵を付けるか（通常ステップとの差別化の根幹）
6. ボス・強モブ・ガーディアンを誘導対象に含めるか
7. デコイ中に敵対（leash）が切れてよいか

**調査で確認できなかったもの**

8. 魔法使いを本編で操作する経路（第二章）が未実装のため、実プレイでの検証は
   Test Mode に限られる。本編導入時の挙動は確認できない

## Recommendation

1. **Planner へ進む。** 実装は「既存構造への最小の足し算」で成立する見込みが高い。
   新しい当たり判定・ダメージ経路・AI状態機械は不要
2. 実装前に、上記 Unknowns の 1・2・5 を人間が決める。
   この3つは実装の形そのものを変えるため、推測で進めてはならない
3. 数値（Unknowns 3・4）は `core/crush-slash.js` の `PROVISIONAL_*` と同じ扱いで
   「暫定」と明示して置き、正式決定まで動かせる形にする
4. 誘導対象は初期実装では通常敵のみに絞り、ボス・強モブは別タスクで判断する
5. 純粋ロジック（誘導対象の選定・寿命）は `src/core/mage-decoy.js` 相当へ切り出し、
   `tests/unit/` で縛る（`core/mage-impact-aoe.js` と同じ型）

Analyzer段階ではコードを変更していない。
