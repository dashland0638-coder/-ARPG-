# ENEMY-ATTACK-VIS-001 Analysis

## Task

ENEMY-ATTACK-VIS-001（仮ID）: 敵攻撃の視認性改善

Analyzer / READ ONLY。このレポート以外のファイル（ゲームコード・テスト・Protocol 文書）は変更していない。commit / push もしていない。

## Objective

実機レビューで出た次の3点を調べる。

- 敵の攻撃モーションが単調
- 攻撃範囲が分かりづらい
- 攻撃の軌跡や予告エフェクトがあるとよい

問い: **敵攻撃の予告・攻撃範囲・攻撃軌跡を、既存システムを使って改善できる構造になっているか。**

## Scope（調査範囲）

- 対象: Chapter 1-①「囚われの洋館」（`mansion`）で出る敵。実際に開始できるのは第一章だけ（docs/SCENARIOS.md「実装事実」）
  - 通常敵: 影に侵された使用人 / 顔のない侍女 / 館の猟犬 / 幽霊（戦闘③。汎用 `ghost`）
  - 強敵: 鍵束の番人（ELITE）
  - 中ボス: 黒衣の執事（NAMED）
  - ボス: 館の主（`mansionBoss`）
- 比較対象: 他ダンジョンのボス（templeGuardian / conservatoryBloom / waterwayTurtle）がすでに持っている床の予告表示
- 対象外: 宵待ちの村の怪異（`mirror` / `copy` / `fisher` / `keeper` / `foam`）。共通基盤の比較で触れる程度にとどめた

---

## Summary

- **FACT**: 洋館の敵は、攻撃範囲を描くのに必要なデータ（予兆秒数・射程・扇の半角・向き・振り抜き時間・硬直）を**純粋モジュールのデータ表**としてすでに持っている（`src/core/mansion-enemies.js`）。近接攻撃の向きは予兆の開始時に固定される。
- **FACT**: 床に予告を描く部品は既存。ボス用の `telegraphDisc`（円）と `startArcSweep`（扇）で、どちらも予兆のあいだ不透明度を上げていく。ただし**洋館の敵は1体も使っていない**。
- **FACT**: 判定と同じ形を描く扇のメッシュ（`swingGeometryFor`）と刃の軌跡リボン（`updateBladeTrail`）はあるが、どちらも**プレイヤー専用**。
- **FACT**: 洋館の敵の予告は、方針として「まずモーションで見せる。新しい UI もエフェクト基盤も足さない」とコードコメントに書かれている（`07-ai-combat.js:1230-1232`）。館の主は、以前あった「突進レーン＋予告トースト」を、この方針に合わないとして削除した跡が残っている（`07-ai-combat.js:3680-3686`）。
- **結論（INFERENCE）**: 予告・範囲・軌跡の**データと描画部品はほぼ揃っている**ので、目的は既存システムの拡張で達成できそうに見える。ただし、表示するかどうか自体が既存の設計方針とぶつかるため、Human の判断が先に必要。

---

## Existing System Search（Rule 0 の記録）

| 探したもの | 検索語 / 範囲 | 結果 |
| --- | --- | --- |
| 敵AIの振り分け | `atkType===` / `07-ai-combat.js` | あり: `updateEnemies` `07-ai-combat.js:1044-1057`（atkType ごとに分岐） |
| 敵の予兆状態 | `windup\|telegraph` / `src/legacy/parts/07-ai-combat.js` | あり: `chargeState==='telegraph'`、`servantState==='windup'`、`lordState==='windup'`、`fireCharging`、`ghostState==='phaseIn'` |
| 予兆の共通判定 | `punishWindowState` / `src/core/` | あり: `core/punish-window.js:46`（全タイプの「振りかぶり中」を1関数で返す） |
| 攻撃データ（射程・角度・秒数） | `reach\|halfAngle\|telegraph` / `src/core/mansion-enemies.js` | あり: `SERVANT_ATTACKS`:83 / `WARDEN_ATTACKS`:160 / `BUTLER_ATTACKS`:241 / `LORD_ATTACKS`:429 / `LORD_ECHO`:474 |
| 攻撃データの器 | `defineMeleeProfile\|meleeWindupProgress` / `src/core/enemy-profiles.js` | あり: ダンジョンに依存しない器（:78-205） |
| 床の予告（円） | `telegraphDisc` / `src/legacy/parts/` | あり: `07-ai-combat.js:3383`（ボス専用。`bossVfx` に登録） |
| 床の予告（扇） | `startArcSweep` / 同上 | あり: `07-ai-combat.js:3452`（ボス専用） |
| 床の予告（直線レーン） | `chargeLane` / `src/` | **生成コードなし**（確認済み）。`en.chargeLane` の参照・削除コードだけが残る（`07:3377,3538-3547`、`12-progression-ui.js:465,1212`）。`special='charge'` の代入もないので、この分岐は実行されない |
| 衝撃波リング | `shockRing` / `07-ai-combat.js` | あり: `:3741-3748`（waterwayTurtle 専用） |
| 判定と同じ形の扇メッシュ | `swingGeometryFor\|spawnMeleeSwingVFX` / `10-input.js` | あり: `:516` / `:543`（プレイヤー専用。`player.add`） |
| 判定の外周に引く弧 | `spawnSweepVFX` / `11-combat-actions.js` | あり: `:1246`（プレイヤーのスキル専用。「判定と同じ角度・射程」が方針） |
| 刃の軌跡 | `trail\|updateBladeTrail` / `src/legacy/parts/` | あり: `13-update-loop.js:963`（`playerMixerParts.weaponTip` 前提。プレイヤー専用） |
| 床デカール | `spawnScorch\|decals` / `13-update-loop.js` | あり: `:1971`（焼け跡。寿命・プール上限つき） |
| パーティクル | `spawnHitSpark\|sparkPool` / `13-update-loop.js` | あり: `:2034`（ヒット時の火花。メッシュ・ライトのプール） |
| 予兆中の発光 | `threatHighlight` / `src/core/enemy-visibility.js` | あり: `:83`。予兆中は `windup:0.75` で胴体の emissive が赤くなる（`07-ai-combat.js:4180-4194`） |
| 盾の予兆発光 | `shieldMat.emissive` / `07-ai-combat.js` | あり: `:970-990`（`guardBreak` の予兆で白く光る） |
| 敵の武器先端ノード | `weaponTip` / `src/legacy/parts/` | **敵側にはない**（確認済み）。`weaponTip` はプレイヤー（`06-player-enemy.js:1648,1847`）だけ |
| 敵攻撃の予告テキスト | `spawnToast(` / `07-ai-combat.js` | 一部あり: 幽霊 `'👻 背後に気配が!'`（:2348）、盾持ちのガードブレイク（:1712）、waterwayTurtle。洋館専用の敵にはない |
| 予兆のSE | `sfx(` / 洋館AI | 番人のガードブレイク開始 `'anvil'`（:2271）と執事の影移動 `'cast'`（:2252） だけ。通常の予兆**開始**時の SE はなし。振り抜き時には `plan.sfx` が鳴る |
| 視認性まわりの設定 | `Idx` / `src/core/state.js` | エフェクト量や予告表示の設定項目は**ない**（確認済み）。あるのは `sfxIdx, bgmIdx, shakeIdx, brightIdx, qualityIdx, hitStopIdx, dotIdx, shadowOn`（`state.js:252`） |
| テスト用の敵出現 | `ARENA_ROSTER` / `07-ai-combat.js` | あり: `:696-765`（Manor Servant / Maid / Hound / Warden / Butler / Manor Lord） |
| 敵の状態表示（テスト用） | `updateArenaEnemyInfo` / `14-training-ground.js` | あり: `:136`（AI State / Punish / Facing ほか） |

---

## Enemy Attack Architecture

### 全体の流れ（FACT）

```
updateEnemies(dt)                           07-ai-combat.js:816
  ├ updateEnemyVisibility(en)               視界 + 予兆ハイライト(threatHighlight)
  ├ ダウン / 浮き / 大怯み中は AI を止める
  ├ isBoss → updateBossAnim + updateBossAI
  │           └ key==='mansionBoss' → updateMansionLordAI   :4473
  └ atkType で分岐                            :1044-1057
      charge  → updateChargerAI      (猟犬)
      kite    → updateKiteAI         (侍女)
      ghost   → updateGhostAI        (幽霊)
      servant → updateShadowServantAI(使用人 / 番人 / 執事 共通)
  → updateMobAnim(en) → updateMansionMobExtras → pose*()  :1244
```

- AI（状態を進める側）と見た目（pose 関数）は分かれている。pose 関数は AI の状態を読むだけ（`07-ai-combat.js:1228-1241` のコメントと実装）。
- 数値は `core/mansion-enemies.js`（純粋関数・state 非依存）、判断の器は `core/enemy-profiles.js` にある。

### 敵ごとの攻撃方式と判定（FACT）

| 敵 | Tier | AI / 状態機械 | 攻撃 | 判定の形 | 判定の実体 |
| --- | --- | --- | --- | --- | --- |
| 使用人 | NORMAL | `servant`: idle→windup→strike→recover | strike（予兆0.34 / 射程2.05 / 半角1.00）<br>sweep（0.84 / 3.30 / 1.60） | **扇**（向き固定） | `07:2179-2217`。`dist<=reach && |angleDiff|<=halfAngle`。strike 中は毎フレーム判定（1回だけ当たる） |
| 侍女 | NORMAL | `kite`: 溜め→射撃→足止め | 影弾（溜め0.75 / 速度10 / 寿命3 / 当たり半径0.75） | **直線の弾** | `spawnEnemyFireball` `07:1820`、弾の判定は `13-update-loop.js:1566-1586`。**向きは発射した瞬間**に決まる |
| 猟犬 | NORMAL | `charge`: idle→telegraph→dash→cooldown | 突進（溜め0.85 / 0.4秒 × 速度11 ≒ 4.4 / 半径1.15） | **直線の突進**（向き固定） | `07:1680-1785`。`chargeDir` は溜め開始時に固定 |
| 幽霊 | NORMAL | `ghost`: approach→phaseOut→phaseIn→lunge | 背後からの咬みつき（phaseIn 0.35 / 0.3秒 × 速度9 / 半径1.1） | **短い直線の突進** | `07:2306-2379`。向きは phaseIn の終わりに決まる。トーストで予告する |
| 鍵束の番人 | ELITE | `servant`（`meleeKind:'warden'`） | slam（0.78 / 2.95 / 1.05）<br>sweep（0.95 / 3.90 / 1.85）<br>ガードブレイク（予兆1.15 / sweep の差し替え） | 扇 | 使用人と同じ経路 |
| 黒衣の執事 | NAMED | `servant`（`meleeKind:'butler'`）+ fade / emerge / shift | candle（0.62 / 2.55 / 1.00）<br>lash（0.72 / 3.60 / 1.25、P2: 0.66 / 4.60 / 1.35）<br>影移動（P2） | 扇 + 転移 | 使用人と同じ経路。転移先 `butlerStepTo` はフェード開始時に決まる |
| 館の主 | BOSS | 専用: idle→windup→strike→recover + split / merge | cane（0.70 / 3.60 / 1.05）<br>lash（0.80 / 5.40 / 1.25）<br>bolt（弾、0.85）<br>sweep（0.85 / 5.00 / 1.70）<br>rush（0.80 / 13×0.45 ≒ 5.85 / 半径1.9）<br>echo（本体の振りの0.42秒後 / 5.20 / 1.55） | 扇 / 弾 / 直線の突進 / 遅れて来る扇 | `07:4259-4439`。`lordFacing` は予兆開始時に固定。echo の向きは `lordEchoDir` |

### 範囲を描くのに必要な情報がコードにあるか（FACT）

| 情報 | 近接（使用人・番人・執事） | 館の主 | 猟犬 | 侍女 | 幽霊 |
| --- | --- | --- | --- | --- | --- |
| 射程 | `plan.reach` | `plan.reach` | 速度×時間（定数 11 / 0.4） | 速度×寿命 | 定数 9 / 0.3 |
| 角度・幅 | `plan.halfAngle` | `plan.halfAngle` / `hitRadius` | `chargeHitRadius(en,1.15)` | 当たり半径 0.75（定数） | 1.1（定数） |
| 向き | `en.servantFacing`（予兆開始で固定） | `en.lordFacing`（固定） | `en.chargeDir`（固定） | **発射時まで決まらない** | lunge 開始時に決まる |
| 予兆の進み具合 | `meleeWindupProgress(kind, attack, remainT, phase)`（0→1。`hold` の間は1のまま） | `en.lordT / plan.telegraph` | `en.chargeT / en.chargeTelegraphDur` | `en.fireChargeT / en.shotWindupSec` | `en.ghostT / 0.35` |
| 当たっている時間 | `plan.active` | `plan.active` | 0.4（定数） | 弾の寿命 | 0.3（定数） |
| 硬直 | `plan.recovery` + `POST_ATTACK_RECOVERY_SEC` | 同左 | `chargeCooldownOverride` | `shotRootSec` | 2.4 |
| 予兆中かどうか | `punishWindowState(en).midWindup`（全タイプ共通） | 同左（`atkWindup`） | 同左 | 同左 | 同左 |

- 近接攻撃と館の主は、**判定に使う値と同じ値**（reach / halfAngle / facing）が予兆の開始時点で確定している。
- 猟犬・幽霊・侍女の弾は、射程や速度が **AI 関数の中の直書き定数**になっていて、プロファイルの表にはない（`07:1759, 1744, 1839, 2352, 2356` など）。

---

## Attack Motion

### 近接の状態機械（使用人・番人・執事で共有。FACT）

| 段階 | 状態 | 向き | 見た目（pose） |
| --- | --- | --- | --- |
| 攻撃開始 | idle→windup（`07:2253-2272`） | `servantFacing` を固定 | — |
| 予備動作 | windup（`07:2166-2176`） | 固定 | 使用人: sweep は影腕を引いてひねる / strike は右腕を短く引く（`07:1293-1308`）<br>番人: 鍵束を振り上げる / 影腕を引く（`07:1400-`）<br>執事: 燭台を掲げる / 影腕（`07:1497-`） |
| 溜めの静止 | windup の最後の `hold` の割合 | 固定 | `meleeWindupProgress` が 1 のまま止まる |
| 攻撃発生 | strike（`plan.active` 秒） | 固定 | 使用人 sweep: 腕が横へ薙ぎ、振り抜く間だけ伸びる（`stretch`） |
| 攻撃終了 | recover | — | 腕がゆっくり戻る |

### 館の主（FACT）

- `updateBossAnim` の `P.kind==='lord'`（`07:3950-`）が cane / lash / bolt の予兆と振り抜きの姿勢を持つ。宝玉の発光（`gem`）が予兆に合わせて強くなる。
- Phase 3 の追撃 echo は `lordEchoFlash` で影の腕が伸びる（`07:4033`）。

### 猟犬・侍女・幽霊（FACT）

- 猟犬: 溜めで身を低くし（`poseManorHound` `07:1640`）、汎用の突進で体が膨らむ（`07:1723-1733`）。
- 侍女: 腕を上げ、手元に影が集まる（`handShadow`）。撃ったあと腕が落ちる（`poseFacelessMaid`）。
- 幽霊: 半透明になって消え、背後に現れる（`setEnemyOpacity`）。専用の姿勢はない。

### 手ごたえ（FACT）

- 被弾したとき: `spawnDamagePopup` + `flashScreen` + `sfx('hurt')` + `addShake`。敵の攻撃に合わせた火花や軌跡は出ない（`07:2196-2201`、`lordHitPlayer` `07:4442`）。

### 見立て（INFERENCE）

- 近接3種と館の主は、予備動作・静止・振り抜き・硬直の**段階がすでにそれぞれの状態として分かれている**。予告や軌跡を足すときは、既存の状態をきっかけにでき、**モーションそのものを作り直さなくても載せられる**構造。
- 「単調」の中身は、次のどれかだと考えられる（どれかは未確定）:
  1. 使用人の strike の予兆が 0.34 秒と短く、右腕を引くだけで動きが小さい
  2. 突進・弾・咬みつき系は「膨らむ／脈打つ／消える」という汎用の予兆で、胴体の変化が中心
  3. 当たる瞬間の軌跡・残像がなく、振り抜きが目に残らない
  4. 振り抜きの SE はあるが、予兆の開始に SE がない
  - 1・2 はモーション（D）、3 は軌跡（C）、4 は予告（A）の話で、どれが原因かで担当範囲が変わる。実機レビューでどの敵・どの攻撃を見たかの記録はない（**OPEN QUESTION**）。

---

## Hit / Range Detection

### 判定の形（FACT）

| 形 | 使っている敵 | 実装 |
| --- | --- | --- |
| 単体（点） | — | 敵の判定はすべてプレイヤーの**中心点**に対するもので、プレイヤー側の半径は見ていない |
| 円形 | 他ダンジョンのボスの eruption（洋館にはない） | `updateEruption` `07:3408` |
| 扇形 | 使用人 / 番人 / 執事 / 館の主（cane・lash・sweep・echo） | `dist<=reach && |angleDiff(facing,bearing)|<=halfAngle` |
| 直線（突進） | 猟犬 / 館の主 rush / 幽霊 | 毎フレーム「移動中の敵とプレイヤーの距離 < 半径」 |
| 直線（弾） | 侍女 / 館の主 bolt | 弾とプレイヤーの水平距離 < 0.75 |
| 武器の近接範囲 | — | 敵の武器メッシュ自体は判定に使っていない。扇は**敵の原点**から測る |
| 特殊 | 執事の影移動（転移。ダメージなし） / 館の主の echo（遅れて来る扇） | 前述 |

### 判定と見えているものの比較

| 攻撃 | 実際の判定 | いまプレイヤーが見られる情報 | 一致しているか |
| --- | --- | --- | --- |
| 使用人 strike | 扇 r2.05 / 半角1.00（約±57°） | 右腕を短く引く / 胴が赤く光る | 範囲は描かれていない。予兆 0.34 秒（FACT） |
| 使用人 sweep | 扇 r3.30 / 半角1.60（約±92° ＝ 前方の半円より広い） | 影腕を引く → 薙ぐ間だけ腕が伸びる | 腕の長さ（`stretch` 最大 1.85 倍）が射程 3.30 と合っているかは未検証（**OPEN**） |
| 番人 sweep | 扇 r3.90 / 半角1.85（約±106°） | 影腕 | 同上 |
| 館の主 lash | 扇 r5.40 / 半角1.25 | 左腕を上げる、宝玉がわずかに光る | 射程 5.4 は洋館の近接で最長。描かれていない |
| 館の主 echo | 本体の振りから0.42秒後に 扇 r5.20 / 半角1.55 | 影の腕が伸びる（`lordEchoFlash`）。**判定と同じフレーム**に光る | 前もって知らせる表示はない（FACT）。「影も見ていれば避けられる」という設計（`mansion-enemies.js:470-474`） |
| 猟犬の突進 | 直線 ≒4.4 / 半径1.15 | 身を低くする、体が膨らむ | 突進の方向は溜めの開始で固定されるが、表示はない |
| 館の主 rush | 直線 ≒5.85 / 半径1.9 | 本体の予兆 | 同上 |
| 侍女・館の主の弾 | 発射時にプレイヤーの方向へ飛ぶ直線 | 手元に影が集まる | 方向は発射まで決まらないので、予兆中に線は引けない |
| 幽霊 | 背後に現れて約2.7の突進 | トースト「背後に気配が!」 + 半透明 | 位置は phaseOut の終わりに決まる |

- **INFERENCE**: 扇の半角が 1.60〜1.85 rad（92〜106°）ある sweep 系は、「正面だけに当たる攻撃」ではなく**横や斜め後ろまで届く**。モーション（腕を横へ振る）からはこの広さが読み取りにくく、「攻撃範囲が分かりづらい」の有力な候補。
- **FACT**: プレイヤー側の攻撃は、実機レビューで「派手さで判定の位置をごまかしている」と指摘され、**判定と同じ角度・射程**に揃えた経緯がある（`11-combat-actions.js:1240-1262` のコメント）。敵側にはこの対応がない。

---

## Existing VFX

| システム | 場所 | 用途 | 敵の攻撃に使えるか（INFERENCE） |
| --- | --- | --- | --- |
| `telegraphDisc(en,x,z,r,color)` | `07:3383` | ボスの eruption の予告円。予兆の進みに合わせて不透明度 0.12→0.57 | 円の予告にそのまま使える形。`bossVfx` / `clearBossVfx` に登録されるので後片付けもある。ただし `en.vfx` の名前・掃除の流れはボス向け |
| `startArcSweep` / `updateArcSweep` | `07:3452-3502` | 扇の予告 + 判定 + フェードを1つにまとめたもの | **形は近接の扇と同じ**（`CircleGeometry(r, seg, start, halfAngle*2)`）。ただし判定まで持っているので、既存の近接判定と二重になる。描画部分だけを取り出す必要がありそう |
| `chargeLane`（残骸） | `07:3538-3547` | 以前の突進レーン | 生成コードがない。**再利用はできない**（FACT）。「以前あって、方針により消した」という経緯として重要 |
| `shockRing` | `07:3741` | 広がる輪 | 用途が違う |
| `swingGeometryFor` + `spawnMeleeSwingVFX` | `10-input.js:516,543` | プレイヤーの判定と同じ扇。キャッシュ + プール | 扇の形とプールの仕組みは流用できそう。ただし `player.add` 固定・`activeSwings` はプレイヤー用 |
| `spawnSweepVFX` | `11-combat-actions.js:1246` | 判定の外周の弧（自前の rAF で寿命管理） | 「判定の外周だけ描く」表現の前例 |
| `updateBladeTrail` | `13-update-loop.js:963` | 刃の軌跡リボン（16区間の BufferGeometry） | プレイヤー1人分の単一メッシュで、`weaponTip` が前提。敵には先端ノードがない（FACT）→ **敵の軌跡は、この仕組みをそのまま呼ぶだけでは作れない** |
| `spawnScorch` / `decals` | `13-update-loop.js:1971` | 床の焼け跡 | 痕跡には向くが、予告（時間とともに強まる表示）には向かない |
| `spawnHitSpark` | `13-update-loop.js:2034` | ヒット時の火花 | 敵攻撃が当たったときの手ごたえに使える |
| `threatHighlight` | `core/enemy-visibility.js:83` | 予兆中の胴体の赤い発光 | すでに全敵に効いている「予告」。胴の材質だけで、影腕（`mansionShadowMat`）は光らない |
| 盾の予兆発光 / 宝玉 `gem` / 燭台の炎 | `07:970-990`、`07:3959-`、執事の pose | 敵ごとのパーツ発光 | 敵固有の予告として使われている |
| `takeLight` / `tryTakeLight` | `13-update-loop.js:1828` | ライトのプール | 予告に光を足すなら、プールの上限を考える必要がある |

### 新しいシステムが要るか（INFERENCE）

- **予告（A）/ 範囲（B）**: 床の円・扇・後片付け・不透明度の変化はすでにある。足りないのは「**ボス以外の敵から呼べること**」「**判定と切り離した表示だけの版**」「**直線（レーン）の形**」の3点。まったく新しいシステムではなく、既存部品を**一般化・拡張**する規模に見える。
- **軌跡（C）**: 敵には `weaponTip` がなく、`updateBladeTrail` はプレイヤー1人分の単一メッシュ。敵の軌跡を出すには、次のどちらかが要る:
  - 軌跡の仕組みを複数の持ち主に対応させ、敵の武器に先端ノードを足す
  - 判定の形（扇・弧）から描く `spawnSweepVFX` 型の表示に寄せる

  前者は**既存の仕組みを大きく広げる**、後者は**既存の表現を流用する**ことになる。どちらにするかは Planner / Human の判断。
- **表示の ON/OFF を設定にする**なら、設定項目・セーブ（`09-save-load.js`）・設定 UI への追加が必要。これは既存の設定の仕組みの拡張にあたる（`state.js:252`）。

---

## Existing Tests

### Unit（`node --test`。純粋関数）

| ファイル | 固定しているもの |
| --- | --- |
| `tests/unit/mansion-enemies.test.js`（16） | 使用人の予兆・射程・隙の差、sweep の `hold`、侍女の足止め、猟犬の溜め |
| `tests/unit/mansion-warden.test.js`（22） | 番人の攻撃表、ガードブレイク |
| `tests/unit/mansion-butler.test.js`（18） | 執事の攻撃表、フェーズ、影移動の行き先 |
| `tests/unit/mansion-lord.test.js`（20） | 館の主の攻撃表、「見てから反応できる予兆」、echo の遅れ、移行演出は「止まる」ことで見せる |
| `tests/unit/enemy-profiles.test.js`（16） | 攻撃表の器、`meleeWindupProgress` |
| `tests/unit/punish-window.test.js`（14） | 予兆中かどうかの共通判定 |
| `tests/unit/enemy-visibility.test.js`（19） | `threatHighlight`（予兆中の発光の強さ） |
| `tests/unit/mansion-combat-curve.test.js`（19） | 「読んで避けるのが最速」の難易度曲線 |
| `tests/unit/melee-hit.test.js` / `predictive-aim.test.js` / `guardian-break.test.js` / `enemy-facing.test.js` | 判定・予兆の読み取り・正面判定・旋回 |

### E2E（Playwright。Combat Test Arena 経由）

| ファイル | 固定しているもの |
| --- | --- |
| `tests/mansion-enemies.spec.js` | 使用人 WINDUP → パニッシュ窓 → Break → Execution / 侍女 CHARGING→SHOT_ROOT / 猟犬 TELEGRAPH→DASH / 洋館で3種が出る |
| `tests/mansion-warden.spec.js` | 攻撃2種の予兆 → 振り抜き → 硬直 → ガードブレイク |
| `tests/mansion-butler.spec.js` | 執事の予兆 → 振り抜き → 硬直、フェーズ移行 |
| `tests/mansion-lord.spec.js` | 館の主の各フェーズの攻撃 |
| `tests/combat-test-arena.spec.js` | Arena の Spawn / Clear |
| `tests/execution-break.spec.js` / `tests/mansion-scenario.spec.js` / `tests/chapter1-progression.spec.js` | 周辺の回帰 |

- 状態は `#arena-enemy-info`（`14-training-ground.js:136`）から読む。**予告メッシュや軌跡の有無を読める項目はない**（FACT）。

### 拡張できそうか（INFERENCE）

- 予告・範囲の形を**純粋関数**（例: 攻撃表から描画パラメータを返す関数）に切り出せば、既存の unit と同じ方式で「判定と表示が一致する」ことを固定できる。これは `spawnSweepVFX` の「判定と同じ角度・射程」の方針をテストで保証することにあたる。
- E2E は Arena で状態を読む既存の方式（`info(page,'AI State')`）に、項目を1行足せば広げられる。ただし headless は実時間よりかなり遅いと既存テストのコメントにあり、「一瞬しか出ない表示」をフレーム単位で捕まえるのは不安定になりやすい。
- 「予兆の開始で表示が出る」「当たる瞬間に消える／確定する」「ダウンや撃破で残らない」は、状態機械の遷移と同じ粒度で確認できる。

---

## Reusable Systems（まとめ）

| 用途 | そのまま使えそう | 拡張が要りそう | 作り直しが要りそう |
| --- | --- | --- | --- |
| いつ予告を出すか | `punishWindowState().midWindup`、各状態機械の windup への遷移 | — | — |
| 範囲のデータ | `SERVANT/WARDEN/BUTLER/LORD_ATTACKS`、`LORD_ECHO`、`meleeAttackPlan`、`meleeWindupProgress` | 猟犬・幽霊・弾の直書き定数（表にない） | — |
| 床の扇・円 | `telegraphDisc`、`startArcSweep` の描画部分、`swingGeometryFor` | ボス以外から呼べるように / 判定と切り離す | — |
| 直線レーン | — | `chargeLane` の考え方（コードは消えている） | 生成部分 |
| 後片付け | `bossVfx` / `clearBossVfx`、`clearSwingVFX` | 雑魚にも使えるように（死亡・ダウン・リスポーン・ワールド切替） | — |
| 軌跡 | `updateBladeTrail` のリボン生成 | 持ち主を複数にする | 敵の武器の先端ノード |
| 胴・パーツの発光 | `threatHighlight`、盾・宝玉・燭台 | 影腕の材質 | — |
| 手ごたえ | `spawnHitSpark`、`addShake`、`flashScreen` | — | — |
| 検証 | Arena、`#arena-enemy-info` | 予告の有無を表示する項目 | — |

---

## New System が必要かどうか

- **A 予告 / B 範囲表示**: **新しいシステムは不要そう**（INFERENCE）。既存の床表示（ボス用）と攻撃表のデータを一般化すれば足りる見込み。**一般化が要る理由**（既存のままでは足りない点）:
  - `telegraphDisc` / `startArcSweep` は `bossVfx`（`en.vfx`）に登録する前提で、雑魚には後片付けの経路がない。雑魚は `updateEnemies` のリスポーン処理で `servantEnterIdle` などを呼ぶだけで、VFX を掃除していない（`07:842-873`）
  - `startArcSweep` は判定も持っているので、そのまま呼ぶと近接判定と二重になる
  - 直線レーンの生成コードがない
- **C 軌跡**: 手段によっては**既存システムを大きく広げる**必要がある（INFERENCE）。理由: 軌跡の仕組みはプレイヤー1人分・単一メッシュで、敵には `weaponTip` がない。
- **D モーション刷新**: 新しいシステムは不要。既存の pose 関数を調整する作業になる（INFERENCE）。ただし数値を変えるとテストが固定している予兆秒数・難易度曲線に響くので、**見た目だけに限るのか、秒数まで変えるのか**を分けて決める必要がある。

---

## FACT

1. 洋館の近接3種と館の主の攻撃は、予兆・振り抜き・硬直の秒数、射程、扇の半角をデータ表で持つ（`core/mansion-enemies.js:83,160,241,429,474`）。
2. 近接の判定は「敵の原点からの距離 ≤ reach」かつ「固定した向きからの角度差 ≤ halfAngle」。プレイヤーの半径は考慮していない（`07:2184-2187`、`07:4362-4366`）。
3. 近接の向きは予兆の開始時に固定され、予兆中は変わらない（`07:2263`・`07:2168`、`07:4404`）。
4. 猟犬の突進方向も溜めの開始時に固定される（`07:1717`）。弾の方向は発射時に決まる（`07:1826`）。
5. 予兆中かどうかは `punishWindowState` がすべての敵タイプで判定する（`core/punish-window.js:46-56`）。
6. 予兆中は胴体が赤く光る（`threatHighlight` windup 0.75、`07:4180-4194`）。
7. 床の予告（円・扇）はボスの special だけが使う（`07:3383,3452`。呼び出しは templeGuardian / conservatoryBloom）。
8. 突進レーン `chargeLane` は生成コードがなく、参照と削除だけが残る（grep `chargeLane` の結果）。
9. 館の主では「突進レーン＋薙ぎ払い＋身構え」と予告トーストをやめ、専用の予兆モーションに置き換えた。理由は「攻撃の内容を文字で説明してしまい、画面上の変化だけで伝える方針と合わない」（`07:3680-3686`）。
10. 洋館の敵の見た目の方針は「予兆はまずモーションで見せる。新しい UI も、新しいエフェクト基盤も、敵固有の説明テキストも足していない」（`07:1230-1232`）。
11. プレイヤーの攻撃表示は「判定と同じ角度・射程」に揃える方針で、実機レビューの指摘を受けて直した経緯がある（`11-combat-actions.js:1240-1262`）。
12. 刃の軌跡はプレイヤー専用で、`weaponTip` を前提にしている（`13-update-loop.js:963-967`）。敵に `weaponTip` はない。
13. 予兆の**開始**時に SE が鳴るのは、番人のガードブレイクと執事の影移動だけ（`07:2271`、`07:2252`）。
14. エフェクト量や予告表示の設定項目はない（`state.js:252`）。
15. docs/ に敵の攻撃予告・範囲表示の仕様はない（`docs/*.md` を `予兆|telegraph|攻撃範囲|床` で検索）。仕様にあたる記述は `MANSION_SCENARIO.md` と `COMBAT_DESIGN.md`、コードコメント（「仕様17/28」など）にある。「仕様17/28」の原典は、リポジトリ内では見つからない（`仕様17|仕様28` で検索。ヒットはコードコメントだけ）。
16. `MANSION_SCENARIO.md:178` は「フェーズ変更を UI テキストで説明しない」と明記している。
17. 5戦の敵の体数・HP・攻撃力は「上の表から変えない」ことになっている（`MANSION_SCENARIO.md`「この5戦は戦闘チュートリアルを兼ねている」の段落）。
18. Arena に洋館の全敵（Servant / Maid / Hound / Warden / Butler / Manor Lord）が並んでいて、E2E はそこから出して状態を読む。

## INFERENCE

1. 範囲を描くためのデータ（射程・角度・向き・予兆の進み具合）は、近接と館の主については**判定と同じ値がすでにある**。表示と判定を一致させられる構造になっている（FACT 1〜3 から）。
2. sweep 系の半角は 92〜106° あり、モーションから読み取れる範囲より広い可能性が高い。「範囲が分かりづらい」の有力な原因（FACT 1・2 から。実機での確認はしていない）。
3. 予告と範囲表示は、既存の床表示を一般化すれば作れる規模に見える（FACT 7・10 と Existing VFX から）。
4. 軌跡は、敵の武器の先端ノードがないので、プレイヤーの軌跡の仕組みをそのまま使うことはできない（FACT 12）。
5. 床に範囲を描くことは、洋館の「まずモーションで見せる」「文字で説明しない」方針と**ぶつかる可能性がある**。ただし FACT 9 で否定されたのは主に「文字」とボスの専用 special。床の図形そのものが否定されたのかは、コードからは断定できない。
6. 表示を足しても、予兆・射程などの**数値を変えなければ**、既存の unit / E2E（秒数・射程・難易度曲線を固定しているもの）は壊れない見込み。
7. 弾（侍女・館の主 bolt）は予兆中に方向が決まっていないので、弾道の予告線を出すには、**方向を予兆の開始で固定するという挙動の変更**が要る。これは視認性ではなく**ゲーム性の変更**にあたる。
8. 館の主の echo は、「影を見ていれば避けられる」ことが読み合いの核なので、予告を足すと難易度が変わる可能性がある。

## OPEN QUESTIONS（Planner / Human Approval で決めること）

| # | 決めること | 選択肢と影響 |
| --- | --- | --- |
| Q1 | 洋館の「まずモーションで見せる／新しいエフェクト基盤を足さない」方針（FACT 10）を、今回変えるか | (a) 方針を保ち、モーション・発光・SE だけで改善する → 範囲表示（B）はやらない<br>(b) 床表示などの**非テキスト**の予告を認める → 方針の更新を `.ai/decisions/` に残す<br>(c) Chapter 1 の最初の数戦だけ（チュートリアルとして）認める |
| Q2 | 館の主から消した突進レーン（FACT 8・9）を戻すことになってもよいか | 戻すなら、過去の判断を覆すことになるので記録が必要 |
| Q3 | 実機レビューで「単調」「範囲が分かりづらい」と感じたのは、どの敵のどの攻撃か | 使用人 strike（0.34 秒）なのか、sweep の広さなのか、猟犬・幽霊なのか、館の主なのかで、担当範囲（A/B/C/D）が変わる |
| Q4 | 見た目（色・形・不透明度・外周だけ／塗りつぶし・出すタイミング） | **Analyzer は決めない**。前例: プレイヤー側は「判定の外周だけ・判定と同じ形」（FACT 11） |
| Q5 | 表示は判定と**完全に一致**させるか、目安でよいか | 一致させるなら、判定がプレイヤーの中心点で行われることを踏まえた表示の定義（外周の意味）が要る |
| Q6 | 弾の予告線のために、弾の方向を予兆の開始で固定するか（INFERENCE 7） | 固定する → 避けやすくなる（ゲーム性の変更）<br>固定しない → 予告は「溜めている」ことだけになる |
| Q7 | 館の主の echo に予告を足すか（INFERENCE 8） | 足すと「影を見る」読み合いが弱まる |
| Q8 | 表示を設定で ON/OFF できるようにするか | するなら設定・セーブ・UI に手が入る（範囲が広がる） |
| Q9 | 予兆の秒数・射程を変えることを今回許すか | 許さないなら、見た目だけの改善に限る（テストへの影響なし）。許すなら `mansion-combat-curve` などの再検証が必要 |
| Q10 | 軌跡（C）の手段: 武器の先端から描くか、判定の形から描くか | 前者は既存の仕組みを大きく広げる／後者は `spawnSweepVFX` の流用に近い |
| Q11 | 汎用の突進（`charge`）・幽霊（`ghost`）を直すと、他ダンジョンの同じタイプにも効く。今回の範囲に含めるか | 洋館専用のフラグで分けるか、全体に効かせるか |

---

## Scope Recommendation（範囲の分け方の提案。確定ではない）

| 区分 | 実機レビューから自然に導けるか | 提案 |
| --- | --- | --- |
| A. 攻撃予告 | ○（「予告エフェクトがあるとよい」） | 今回の中心候補。既存の状態遷移をきっかけにできる |
| B. 攻撃範囲表示 | ○（「攻撃範囲が分かりづらい」） | 今回の中心候補。ただし Q1 / Q2 の判断が前提 |
| C. 攻撃軌跡 | ○（「軌跡があるとよい」） | 手段（Q10）が決まるまで **別 Work Item に分ける**のが安全。一般化の規模が A/B と違う |
| D. モーション刷新 | △（「単調」） | 見た目だけの調整と、秒数を変える調整を分ける。秒数を変えるなら**別 Task**（難易度曲線とテストに響く） |
| E. 全敵への展開 | ×（レビューは Chapter 1 の実機） | **別 Task**。まず洋館の近接3種（＋館の主）で確かめる。汎用 AI（charge / ghost / kite）に手を入れると他ダンジョンに波及する（Q11） |
| F. ボス専用演出 | △ | 館の主は過去の削除判断（FACT 9）とぶつかるので、**Q2 が決まるまで別扱い** |

最初の単位として自然なのは、次の範囲（提案）:

- 洋館の近接の状態機械（使用人・番人・執事）の **A + B**
- 表示は判定データ（`meleeAttackPlan`）から作り、判定には触らない
- 数値（秒数・射程・HP）は変えない

---

## Related Files

| パス | 理由 |
| --- | --- |
| `src/legacy/parts/07-ai-combat.js` | 敵AIすべて（:816 updateEnemies / :1228-1662 洋館の pose / :1680 突進 / :1851 引き撃ち / :2082 近接の状態機械 / :2306 幽霊 / :3364-3502 ボスの床予告 / :3897 ボスの見た目 / :4132 視界と予兆発光 / :4198-4455 館の主 / :696 Arena） |
| `src/core/mansion-enemies.js` | 洋館の攻撃表・フェーズ・プロファイル |
| `src/core/enemy-profiles.js` | 攻撃表の器、`meleeWindupProgress`、`isProfileMeleeWindup` |
| `src/core/punish-window.js` | 予兆中の共通判定 |
| `src/core/enemy-visibility.js` | `threatHighlight` |
| `src/core/guardian-break.js` | ガードブレイクの予兆 |
| `src/core/melee-hit.js` | プレイヤー側の判定（比較用） |
| `src/legacy/parts/06-player-enemy.js` | 敵の見た目の構築（`dressEnemy` :3392、洋館の各敵 :3512-4070、`buildEnemy` :4083、`buildBoss` :4398） |
| `src/legacy/parts/10-input.js` | `swingGeometryFor` / `spawnMeleeSwingVFX` |
| `src/legacy/parts/11-combat-actions.js` | `spawnSweepVFX`、`flashScreen`、`spawnDamagePopup` |
| `src/legacy/parts/13-update-loop.js` | 刃の軌跡・デカール・火花・ライトのプール・弾の判定 |
| `src/legacy/parts/12-progression-ui.js` | ボスの VFX 後片付け（:465, :1212） |
| `src/legacy/parts/14-training-ground.js` | Arena の敵情報パネル |
| `src/core/state.js` / `src/legacy/parts/09-save-load.js` | 設定項目（Q8 の場合） |
| `MANSION_SCENARIO.md` | 洋館の敵・予兆・射程の一次資料、「UI テキストで説明しない」 |
| `COMBAT_DESIGN.md` | パニッシュ窓（9-2）、予兆の設計の経緯 |
| `docs/COMBAT.md` / `docs/SCENARIOS.md` | Enemy Behavior / Chapter 1 の敵構成 |

## Related Tests

- Unit: `tests/unit/mansion-enemies.test.js`、`mansion-warden.test.js`、`mansion-butler.test.js`、`mansion-lord.test.js`、`enemy-profiles.test.js`、`punish-window.test.js`、`enemy-visibility.test.js`、`mansion-combat-curve.test.js`、`melee-hit.test.js`、`guardian-break.test.js`、`enemy-facing.test.js`、`predictive-aim.test.js`
- E2E: `tests/mansion-enemies.spec.js`、`mansion-warden.spec.js`、`mansion-butler.spec.js`、`mansion-lord.spec.js`、`combat-test-arena.spec.js`、`execution-break.spec.js`、`mansion-scenario.spec.js`、`chapter1-progression.spec.js`
- テストは実行していない（READ ONLY の調査のため）。

---

## Conclusion

**既存システムの拡張で実現できそうか: できそう（条件つき）。**

- **予告（A）と攻撃範囲（B）**: 判定と同じデータ（射程・角度・固定された向き・予兆の進み具合）と、床に円・扇を描いてフェードさせる部品が、すでにコード上にある。足りないのは、ボス以外から呼べるようにすることと、判定と切り離すことで、**新しいシステムは要らない見込み**。
- **軌跡（C）**: プレイヤー専用の仕組みしかなく、敵には武器の先端ノードがない。**既存の仕組みを大きく広げるか、判定の形から描く表現に寄せる**必要がある。
- **モーション（D）**: 状態ごとの pose がすでに分かれているので調整はできる。ただし秒数を変えると難易度とテストに響く。
- **最大の前提条件は技術ではなく方針**。洋館では「予兆はモーションで見せる」「新しいエフェクト基盤を足さない」を掲げ、館の主の突進レーンと予告トーストを意図して消している。この方針を今回どこまで変えるか（Q1 / Q2）を Human が決めるまで、実装方法は確定できない。

## Recommended Next Step

1. Human が Q1・Q2・Q3 を決める（方針をどうするか、館の主の扱い、どの攻撃が問題だったか）
2. Planner がその判断を受けて、A+B（洋館の近接3種）を最初の Work Item、C・D・E・F を別 Work Item／別 Task に分けて計画する
3. 見た目（Q4）は Planner が複数案を出し、Human が選ぶ
