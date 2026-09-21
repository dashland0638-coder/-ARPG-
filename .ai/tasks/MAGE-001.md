# MAGE-001

魔法使い Skill 1「ステップ＋幻影デコイ」

Status: **PLANNED**（実装未着手。実装前に Unknowns の決定が必要）

Analysis: [`../reports/MAGE-001-analysis.md`](../reports/MAGE-001-analysis.md)

## Request

魔法使いSkill 1として
ステップ＋幻影デコイを実装する。

## Background

`docs/COMBAT.md` は魔法使いを「属性相性ではなく、距離・誘導・デコイ・ステップ・
魔法弾・位置取りで戦う職業」と定めている。一方で現在の実装にはデコイも幻影も無く、
魔法使いの Skill 1 は6つのバリアントから選ぶ汎用スキル、Skill 2 は「護りの魔球」
（身代わり＋自爆）で、いずれも「敵を誘導する」体験を持たない。

Analyzer の調査により、実装に必要な部品（スキル追加の口、ステップ移動、
配列で持つ一時オブジェクト、半透明表現、光源プール）はすべて既存にあり、
**唯一存在しないのは「敵が誰を狙っているか」という概念** であることが分かった。

## Specification

`docs/COMBAT.md` § Mage Skill 1（**設計確定案 ―― 正式決定ではない**）

- ステップで移動すると同時に幻影デコイを残す
- 敵をデコイへ誘導する
- その後、距離を取って魔法弾などで攻撃する
- 通常ステップとの使い分けを重視する

遵守すべき固定仕様:

- 属性・属性相性を導入しない（`docs/COMBAT.md`）
- スキル装備スロットは最大2（`CHAPTER1_SKILL_SLOTS = 2`）
- Chapter 1 に過剰な育成システムを持ち込まない（`docs/PROGRESSION.md`）
- `src/legacy/parts/` を module 化しない／最小変更（`docs/ARCHITECTURE.md`）

## Current Implementation

| 項目 | 現状 |
| --- | --- |
| Skill 1 | `CHARGE_VARIANTS_BY_CLASS.mage` の6択（dash/retreat/spin/barrier/chain/nova）を `state.skillChoice` で選択 |
| 発動経路 | `skillInputDown` → `skillInputUp` → `releaseSkill` → `executeVariant(variant, …)` |
| ステップ移動 | `variant.movement` → `state.skillAnim = {type,t,duration,fwd,dist}` → `updatePlayer` の skillAnim 分岐 |
| 通常ステップ | `tryDodge()`。無敵あり・スタミナ消費・`dodgeCD 0.75` |
| デコイ | **存在しない** |
| 敵のターゲット | **参照を持たない。** 各AIが毎フレーム `state.pos` を直接読む（`07-ai-combat.js` に82箇所） |
| 最も近い既存実装 | 護りの魔球（`state.mageOrbs`：配列＋毎フレーム更新＋掃除＋身代わり消費） |

## Implementation Plan

最小変更で成立させる。**新しい当たり判定・ダメージ経路・AI状態機械は作らない。**

### Step 1. 誘導の純粋ロジックを切り出す

- 対象ファイル: `src/core/mage-decoy.js`（新規）
- 対象関数: `decoyLureTargetFor(enemyPos, decoys, opts)` / `stepDecoyLife(decoy, dt)` /
  暫定数値定数（`PROVISIONAL_*`）
- 変更内容: 「どのデコイが、どの敵を、どの範囲で引きつけるか」「寿命をどう減らすか」だけを
  `state`・THREE 非依存の純粋関数として持つ
- 目的: `core/mage-impact-aoe.js` と同じ型にして単体テストで縛る。
  数値は `core/crush-slash.js` に倣い `PROVISIONAL_` 接頭辞で暫定と明示する

### Step 2. デコイ実体を保持する配列を用意する

- 対象ファイル: `src/core/state.js`
- 対象関数: state 初期化リテラル（`mageOrbs:[]` の隣）
- 変更内容: `mageDecoys:[]` を1行追加
- 目的: `mageOrbs` と同じ扱いの一時状態として持つ（セーブ対象にしない）

### Step 3. デコイの生成・更新・破棄を実装する

- 対象ファイル: `src/legacy/parts/11-combat-actions.js`
- 対象関数: `spawnMageDecoy(pos)` / `updateMageDecoys(dt)`（新規。`castOrbGuard` /
  `updateMageOrbs` の直後に置く）
- 変更内容:
  - 見た目は `buildCompanion()` と同じ方式の軽量プリミティブ群＋半透明マテリアル
    （`setEnemyOpacity` の `userData.opacityBase` 保持パターンを流用）
  - 光源は `takeLight()` / 破棄時に必ず `giveLight()`
  - 消滅時は `scene.remove` → `giveLight` → `splice`（`updateMageOrbs` と同じ手順）
- 目的: 既存の一時オブジェクト管理の作法にそのまま乗せる
- **禁止**: `buildPlayer()` を呼ばない（`playerMixerParts` は共有可変変数で、
  2回目の呼び出しがプレイヤー本体のリグ参照を壊す）

### Step 4. 毎フレーム更新を1行つなぐ

- 対象ファイル: `src/legacy/parts/13-update-loop.js`
- 対象関数: `updateMageOrbs(dt)` の呼び出し（61行目）の直後
- 変更内容: `updateMageDecoys(dt);` を1行追加
- 目的: 更新経路を既存と同じ1箇所に集約する

### Step 5. スキル定義を追加する

- 対象ファイル: `src/legacy/parts/12-progression-ui.js`
- 対象関数: `CHARGE_VARIANTS_BY_CLASS.mage`
- 変更内容: `mode:'decoy'`（新mode）と `movement:'retreat'`（既存の移動型を流用）を持つ
  バリアントを1エントリ追加する
- 目的: スキルの正規の増やし方（`chain` / `nova` と同じ）に従う
- **決定待ち**: 新バリアントとして足すのか、既存 `retreat`（退避の魔陣）を置き換えるのか、
  魔法使いのSkill 1をデコイ固定にするのかは **未確定**（Unknowns 1）。
  決まるまでこのステップは着手しない

### Step 6. 発動処理を1分岐だけ足す

- 対象ファイル: `src/legacy/parts/13-update-loop.js`
- 対象関数: `executeVariant()`
- 変更内容: `else if(variant.mode==='decoy'){ spawnMageDecoy(発動地点); }` を1本追加。
  移動は既存の `variant.movement` → `state.skillAnim` 経路がそのまま担う
- 目的: 「ステップ」と「デコイ生成」を既存の2経路の組み合わせで成立させ、
  新しい移動処理を作らない

### Step 7. 敵AIの参照点を1段間接化する（本タスクの核）

- 対象ファイル: `src/legacy/parts/07-ai-combat.js`
- 対象関数: `aggroPos(en)`（新規・数行）と、各AIの `state.pos` 読み取り
- 変更内容:
  ```
  function aggroPos(en){ return decoyLureTarget(en) || state.pos; }
  ```
  を追加し、各AIの `state.pos` のうち **①接近・移動・向き** と
  **②索敵・攻撃開始距離** の読み取りだけを `aggroPos(en)` に置き換える
- **③命中判定（`d < hitR` など、`state.hp` を削る側）は `state.pos` のまま据え置く**
- 目的: これにより「敵がデコイへ寄る → デコイの前で攻撃する → プレイヤーには当たらない」が
  新しい当たり判定を作らずに成立する。③を触ると無敵バグかデコイ無効のどちらかになる
- 対象AIの範囲: 初期実装は通常敵のAI（charger / wander / kite / turret / jumper /
  shadowServant / ghost）に限定する。`updateMansionLordAI` / `updateBossAI` は
  フェーズ管理・影分離・アンカーを持つため触らない（Unknowns 6）

### Step 8. 後始末を既存の掃除経路へ足す

- 対象ファイル: `src/legacy/parts/02-world-common.js`（`disposeWorld`、367行目の `mageOrbs` の隣）、
  `src/legacy/parts/12-progression-ui.js`（`endCombatPresentation` 周辺、1147行目の隣）
- 変更内容: デコイの `scene.remove` + `giveLight` + 配列クリアを、`mageOrbs` と同じ場所に追加
- 目的: ワールド切り替え・ボス撃破演出で残留させない。光源プールの返却漏れを防ぐ

### Step 9. テストを追加する

- 対象ファイル: `tests/unit/mage-decoy.test.js`（新規）、`tests/mage-decoy.spec.js`（新規）
- 変更内容: 下記 Test Plan のとおり
- 目的: 既存テストは変更しない（新規追加のみ）

## Files To Change

| ファイル | 変更 |
| --- | --- |
| `src/core/mage-decoy.js` | 新規。誘導対象の選定・寿命の純粋ロジックと暫定定数 |
| `src/core/state.js` | `mageDecoys:[]` を1行追加 |
| `src/legacy/parts/11-combat-actions.js` | デコイの生成・更新・破棄（`mageOrbs` の直後に追記） |
| `src/legacy/parts/12-progression-ui.js` | mage の Skill 1 バリアント1エントリ／`endCombatPresentation` の掃除1箇所 |
| `src/legacy/parts/13-update-loop.js` | 更新呼び出し1行／`executeVariant` に mode 分岐1本 |
| `src/legacy/parts/07-ai-combat.js` | `aggroPos(en)` 追加と、通常敵AIの①②読み替え |
| `src/legacy/parts/02-world-common.js` | `disposeWorld` の掃除1箇所 |
| `tests/unit/mage-decoy.test.js` | 新規 |
| `tests/mage-decoy.spec.js` | 新規 |

## Files Not To Change

| ファイル | 理由 |
| --- | --- |
| `basefile.html` | 凍結 |
| `package.json` / `package-lock.json` / `vite.config.js` / `playwright.config.js` | 依存・設定は変更しない |
| `.github/workflows/*` | CI は本タスクの対象外 |
| `docs/**` | 仕様の正式決定は人間が行う。実装側から書き換えない |
| `src/core/enemy-aggro.js` / `enemy-tier.js` / `guardian-break.js` / `stagger-math.js` / `execution.js` | 既存の戦闘基盤。使うだけで触らない |
| `src/legacy/parts/07-ai-combat.js` の `updateMansionLordAI` / `updateBossAI` | フェーズ管理・影分離・アンカーを持つ。初期実装では対象外 |
| `src/legacy/parts/10-input.js` の `tryDodge()` | 通常ステップの挙動は一切変えない |
| `src/legacy/parts/06-player-enemy.js` の `buildPlayer()` | 呼び出しも変更もしない（`playerMixerParts` 破壊の危険） |
| 既存テスト一式 | 変更しない。新規追加のみ |

## New State Required

| 状態 | 場所 | 内容 | セーブ |
| --- | --- | --- | --- |
| `state.mageDecoys` | `src/core/state.js` | `{mesh, light, pos, lifeT, …}` の配列 | **しない**（出撃中だけの一時状態。`mageOrbs` と同じ扱い） |

敵側に新しいフィールドは追加しない（`en.triggered` / leash はそのまま使う）。
`combat-cleanup.js` の対象キーに含めるかは実装時に判断する（含めるなら表と単体テストも更新）。

## Input Flow

```
スキルボタン押下  skillInputDown()
  ├ 既存ガード（started/paused/dialogue/dodging/paralyzed/executeT/空中/skillCD）
  ├ hasRes('skill') → spendRes('skill')        魔法使いは MP 15
  └ skillCharging = true
        ↓（押している間 skillChargeT が伸びる）
スキルボタン離す  skillInputUp() → releaseSkill()
  ├ getChargeVariants()[state.skillChoice]
  └ skillCD = 1.6 × rankCD('skill') × スフィア補正
        ↓
executeVariant(variant, chargeT, chargeMax, 'skill')
  ├ beginMove(variant.key)                     既存
  ├ state.skillAnim = {type:'retreat', …}      既存（ステップ移動）
  └ mode==='decoy' → spawnMageDecoy(発動地点)   追加する唯一の分岐
```

通常ステップ（`tryDodge`）の経路には一切触れない。

## Gameplay Flow

```
Skill入力（MP消費）
  ↓
ステップ移動（state.skillAnim。無敵の有無は未確定）
  ↓
発動地点に幻影デコイが残る
  ↓
updateMageDecoys(dt) が寿命を減らす
  ↓
誘導半径内の通常敵は aggroPos(en) がデコイ座標を返す
  → 敵はデコイへ寄り、デコイの前で攻撃モーションに入る
  → 命中判定は state.pos のままなので、プレイヤーには当たらない（空振り）
  ↓
寿命切れ／ワールド切り替え／撃破演出で消滅（mesh除去 + giveLight + splice）
  ↓
aggroPos(en) が state.pos を返すようになり、敵は自動的にプレイヤーへ戻る
```

Analyzer の結論により、指示にあった「敵ターゲット変更 → プレイヤー再ターゲット」は
**明示的な切り替え処理を持たず、参照点の間接化だけで自然に成立する**流れを採用する。

## VFX

すべて既存資産の流用。新しい描画系は作らない。

| 目的 | 使うもの |
| --- | --- |
| 幻影の見た目 | `buildCompanion()` と同じ軽量プリミティブ群。`buildPlayer()` は使わない |
| 半透明 | `setEnemyOpacity()` の `userData.opacityBase` 保持パターン |
| 発光 | 光源プール `takeLight()` / `giveLight()`（必ず返す。返却漏れはプール縮小の事故） |
| 生成・消滅の一発演出 | `spawnUltimateVFX(center, {radius, vfxColor})` |
| 通知 | `spawnToast()`（「魔球が身代わりになった!」と同じ経路） |
| 画面演出 | `flashScreen()`（`executeVariant` 末尾で既に呼ばれる） |
| 見た目の方向性 | `DODGE_MOTION.mage` の「短い明滅」と揃える |

色は魔法使いの既存色（`atkColorHex '#7ec8ff'` / trim `0x8260ab`）の範囲で選ぶ。
**具体値は未確定。**

## Enemy Interaction

- 敵に新しい状態・フィールドを追加しない
- `en.triggered`（敵対状態）と leash（`core/enemy-aggro.js`）は変更しない
- 置き換えるのは各AIの `state.pos` 読み取りのうち **①接近・移動・向き／②索敵・攻撃開始距離** のみ
- **③命中判定は `state.pos` のまま**。デコイは当たり判定を持たず、敵は空振りする
- 対象は通常敵のみ。ボス・館の主は初期実装の対象外（未確定）
- 強モブ／ガーディアンを誘導対象に含めるかは未確定
- デコイは `dealDamageToEnemy` を呼ばない（ダメージを与えない）

## Balance Parameters

**すべて未確定。** 実装時は `core/crush-slash.js` に倣い `PROVISIONAL_*` として置き、
正式決定まで動かせる形にする。AIが勝手に決めない。

| パラメータ | 値 |
| --- | --- |
| デコイの寿命（秒） | 未確定 |
| 誘導半径 | 未確定 |
| 同時に存在できるデコイ数 | 未確定 |
| ステップ距離 / 移動時間 | 未確定（既存 `retreat` は dist 3.4 / 0.24秒） |
| MPコスト | 未確定（現行のSkill 1共通値は mage 15） |
| クールダウン | 未確定（現行のSkill 1共通値は 1.6 × 補正） |
| ステップ中の無敵の有無・長さ | 未確定（通常ステップとの差別化の根幹） |
| デコイの被弾仕様（空振り／1発で壊れる） | 未確定 |
| ダメージ | なし（デコイは攻撃しない） |

## Save / Load Impact

- **新しい保存フィールドは無い。** `state.mageDecoys` は `mageOrbs` と同じ一時状態
- 旧セーブとの互換性への影響なし
- ただし Step 5 で **新しいバリアントキーを追加する場合**、`09-save-load.js` の
  `skillChoice` 復元は「クラスの持ち技として実在し、未解放の `unlockKey` でなければ復元」という
  判定なので、`unlockKey` を付けなければ既存セーブでもそのまま選択可能になる。
  逆に既存 `retreat` を置き換える場合は、`retreat` を選んで保存した既存セーブの扱いを
  決める必要がある（**未確定**。復元コードの変更が必要になる可能性あり）

## Test Plan

既存テストは変更しない。新規に2本追加する。

**単体テスト** `tests/unit/mage-decoy.test.js`（`core/mage-decoy.js` に対して）

1. 誘導半径内の敵位置に対してデコイが選ばれる／半径外では選ばれない（境界値含む）
2. デコイが複数ある場合の選定規則（最も近いものなど。規則は実装時に確定）
3. 寿命が dt で減り、0以下で「期限切れ」と判定される
4. デコイが1つも無い場合は「誘導対象なし」を返す（＝呼び出し側が `state.pos` に落ちる）

**E2Eテスト** `tests/mage-decoy.spec.js`（Test Mode 経由。`combat-test-arena.spec.js` の手順を踏襲。
本編は第一章＝剣士固定のため、魔法使いを操作できる唯一の経路）

| # | 確認項目 | 内容 |
| --- | --- | --- |
| 1 | Skill入力 | 魔法使いでスキルボタンを押して離すと発動し、MPが減る |
| 2 | ステップ | 発動でプレイヤー座標が移動する |
| 3 | デコイ生成 | 発動後に `state.mageDecoys.length` が増える |
| 4 | デコイ寿命 | 一定時間後に配列が空になる |
| 5 | 敵ターゲット | 敵がデコイ座標へ接近する（座標の推移で判定） |
| 6 | デコイ消滅 | 消滅後、敵の接近先がプレイヤー座標へ戻る |
| 7 | 既存Skillへの影響 | 他バリアント（巨大魔弾・退避の魔陣・魔導障壁）が従来どおり発動する |
| 8 | 通常ステップへの影響 | `tryDodge` の無敵・クールダウン・回避攻撃窓が従来どおり |
| 9 | 後始末 | ワールド切り替え後にデコイが残らない（`console.error` なし） |

全ケースで `watchErrors`（`tests/helpers.js`）を使い、`console.error` を発生させないこと。

**回帰確認**

```sh
npm run build      # 連結後の構文チェックを兼ねる
npm run test:unit
npm test
```

## Acceptance Criteria

1. 魔法使いでSkill 1を発動すると、ステップ移動と同時に発動地点へ幻影デコイが残る
2. 誘導半径内の **通常敵** が、デコイが存在する間はデコイへ接近し、その前で攻撃を行う
3. その攻撃で **プレイヤーはダメージを受けない**（命中判定は `state.pos` のまま）
4. デコイは寿命で消え、消滅後は敵が自動的にプレイヤーへ戻る（明示的な再ターゲット処理を持たない）
5. ワールド切り替え・ボス撃破演出・戦闘不能でデコイが残らず、光源がプールへ返却される
6. 通常ステップ（`tryDodge`）の挙動が一切変わっていない
7. 他のSkill 1バリアント・Skill 2・必殺技が従来どおり動く
8. `updateMansionLordAI` / `updateBossAI` に差分が無い
9. `buildPlayer()` の呼び出し箇所が増えていない
10. `npm run build` / `npm run test:unit` / `npm test` がすべて通る
11. 属性・属性相性を導入していない
12. Balance Parameters が暫定値として明示されている（`PROVISIONAL_*`）

## Risks

| # | リスク | 緩和 |
| --- | --- | --- |
| R1 | `state.pos` の命中判定まで置換して無敵バグ／デコイ無効になる | 置換箇所を①②に限定し、差分を1行ずつ用途で確認する。Acceptance 3 で縛る |
| R2 | `buildPlayer()` 再利用で `playerMixerParts`（共有可変変数）を破壊 | プリミティブ群で作る。Acceptance 9 で縛る |
| R3 | プール光源の返却漏れでライトプールが恒久的に縮む | 全消滅経路で `giveLight()`。Acceptance 5 で縛る |
| R4 | ボスAIへの波及 | 初期実装から除外。Acceptance 8 で縛る |
| R5 | leash がプレイヤー距離判定のため、誘導中に敵対が切れる | leash 条件は変更しない。実機確認後に人間が判断 |
| R6 | 既存「退避の魔陣」と役割が重複し選択肢が死ぬ | Unknowns 1 を先に決定する |
| R7 | デコイ生成時のシェーダ再コンパイルによる処理落ち | 既存プール／マテリアル使い回しに必ず乗せ、同時存在数を絞る |
| R8 | 魔法使いは本編で操作できず、退行が通常プレイのテストに出ない | Test Mode 経由のE2Eを必須にする |

## Rollback

- 変更はすべて **追加**（新規ファイル2＋既存への追記）で構成し、既存の関数・数値・
  状態機械を書き換えない。したがって該当コミットの revert だけで完全に戻せる
- 部分的に止める場合の切り分け順:
  1. Step 7（AI の読み替え）だけを戻す → デコイは残るが誘導しなくなる（無害）
  2. Step 5/6（バリアントと mode 分岐）を戻す → スキル自体が選択肢から消える
  3. Step 1〜4/8 を戻す → 完全に元の状態
- セーブデータへの影響が無いため、ロールバック時のマイグレーションは不要
  （ただし Step 5 で既存 `retreat` を置き換える方式を選んだ場合はこの限りではない）

## Unknowns（実装前に人間の決定が必要）

1. Skill 1 をデコイ固定にするか／6択に1つ足すか／`retreat` を置き換えるか
2. デコイに当たり判定を持たせるか（空振りのみ／1発で壊れる身代わり）
3. Skill 1 のステップに無敵を付けるか
4. 同時存在数・寿命・誘導半径・ステップ距離・MP・CD の各数値
5. ボス・強モブ・ガーディアンを誘導対象に含めるか
6. 誘導中に leash（敵対解除）が働いてよいか

1・2・3 は実装の形そのものを変えるため、決定前に着手しない。
決定は `.ai/decisions/` に記録し、`docs/COMBAT.md` の「設計確定案」マーカーを
更新するかどうかも併せて判断する。

## Notes

- 本タスクは Analyzer → Planner までで停止している。実装（Claude Code）は未着手
- ゲームコードは一切変更していない
