# WORK 0 — 宵待ちの村 実装前現状調査と実装計画

Analyzer + Planner / READ ONLY。ゲームコードは変更していない。commit も行っていない。

対象: Chapter 1 → 魔法使い主役パート → 宵待ちの村 → `duskvillage`

---

## 0. 最重要の発見（先に読むこと）

**`duskvillage` は既に実装済みである。ただし、今回提示された設計とは別物である。**

| | 既存実装（`14-dungeon-duskvillage.js`、350行） | 今回の設計 |
| --- | --- | --- |
| テーマ | 「灯りが怪異をこちらの世界へ引き出す」 | **「忘れられること」** |
| 構造 | 蜘蛛の巣状の細い桟橋（幅4）＋小さなハブ。広い場所は商店街広場のみ | 森 → 村入口 → 中央広場 → 魚屋/住宅/船小屋/商店街 → 水門前 → 水門 → 村の奥 |
| 中核ギミック | ランタン点灯 → 眠っている敵が目覚める / ボスは光を当てないと無敵 | 観察・見分け・誘導 |
| 通常敵 | 濡れた村人（`charge`）、影の子供（`ghost`、dormant） | 水鏡の影 / 泡沫の群れ / 写し身 |
| 強敵 | なし | **記憶漁師** |
| 中ボス | なし | **水門守の残響** |
| ボス | 宵影の群れ `duskCollective`（光ギミック） | **村の残響** |
| 水門 | なし | 中核導線 |
| 昼夜 | z進行で夕暮れ→夜（`DUSK_BANDS`、実装済み） | 夜明けで締める |

したがって WORK 1 以降は「新規実装」ではなく **既存ステージの作り替え** になる。
どこまで壊してよいかは仕様判断であり、AIが決めてはならない（→ §5 R1、§7 WORK 0-D）。

既存実装で `duskCollective` に紐づいているもの（作り替える場合の影響範囲）:

- `12-progression-ui.js`: `BOSS_ENDING_LINES.duskCollective`（4行）、ボスbark（hi/lo）
- `08-loot-equipment.js`: `duskCollective` のドロップ接頭辞（`宵影の群れの`、atk/hp ×1.75）
- `06-player-enemy.js:5111`: ボス見た目の分岐
- `07-ai-combat.js:561`: `_spawnWorldKey==='duskvillage'` の敵配置
- `tests/duskvillage.spec.js`: マップ刷新の回帰テスト（`DUSK_ROOMS` 前提）

既存の未整備箇所（本タスクでは修正しない、事実の記録）:

- `BOSS_ABILITIES` に `duskCollective` のエントリが無い → このボスを倒してもボス能力を得られない
- `SCENARIO_TIME_LIMIT_BASE` に `duskvillage` が無い → 周回しても制限時間が付かない
  （`timeLimitForStars()` は base が falsy なら `null` を返すので、バグではなく未設定）

---

## 1. Current State

### 1-1. リポジトリ

| 項目 | 値 |
| --- | --- |
| branch | `claude/ai-agent-foundation-3hqxv0` |
| HEAD | `4e56fc6 docs(ai): add Chapter structure analysis and Scenario Test Mode design` |
| working tree | clean（本レポート追加前） |
| ビルド | Vite 5 / Three.js 0.154（npm バンドル） |
| テスト | `npm run build` / `npm run test:unit`（node:test、1241件）/ `npm test`（Playwright E2E、30 spec） |
| CI | `.github/workflows/test.yml`（PR時に build → unit → E2E） |

### 1-2. シナリオ／ワールド基盤

| 対象 | 場所 | 状態 |
| --- | --- | --- |
| `SCENARIO_DEFS` | `12-progression-ui.js:~300` | 9エントリ。`duskvillage` は `minLevel:26`、`unlocked:true` |
| `launchScenario(key)` | `12-progression-ui.js:1552` | `fadeTransition()` で包むだけ |
| `launchScenarioNow(key)` | 同1556 | `scenarioKey` 設定 → `routeReset()` → `buildWorld(key)` → key別の入場座標・カメラ向き・`repositionAlliesToPlayer()` → 周回制限時間。**レベル制限のチェックを持たない** |
| `buildWorld(key)` | `02-world-common.js:401` | `WORLD_DEFS[key].build()` → 表面処理 → `spawnEnemiesForWorld` / `spawnChestsForWorld` / BGM。失敗時は tavern へフォールバック |
| `WORLD_DEFS` | 同129 | 11キー（tavern / mansion / ghostship / waterway / temple / conservatory / clocktower / duskvillage / training ほか） |
| `DUSKVILLAGE_ENTRY` | `14-dungeon-duskvillage.js:35` | `(0,0,300)`。村は z=284〜536、x=-34〜34 の帯を占有 |

### 1-3. Test Mode

| 対象 | 場所 | 状態 |
| --- | --- | --- |
| 入口 | `index.html` `#open-testmode-btn` → `#testmode-screen` | 職業 / 転身 / レベル / 同行ゲスト を選べる |
| `setupTestModeScreen()` | `01-character-creation.js:366` | 選択UIの組み立てのみ |
| `beginTestMode(classKey, jobKey, level, guestKey)` | `14-hud-boot.js:1280` | 状態リセット・派生スキル全解放・`spherePoints:999`・スターター装備 → `finishEnteringGame({showIntro:false, world:'training'})` |
| `finishEnteringGame(opts)` | 同1376 | **`state.testMode = (world==='training')` の唯一の書き換え箇所** |
| セーブ保護 | `09-save-load.js:93` | `saveGame()` は `state.testMode` で即 return |
| Combat Test Arena | `14-training-ground.js` / `07-ai-combat.js` | testMode 限定の敵スポーンUI（`ARENA_ROSTER` 7種） |

### 1-4. Chapter / Character Arc

- **`state.chapter` は存在しない。** 章の進行を記録・参照するコードも無い（新設しない）
- `CHAPTER_CAST`（`01-character-creation.js:230`）は Chapter 1 の主役順の表。
  index 2 = `{classKey:'mage', guestClassKey:'warrior', dungeonKey:'duskvillage'}` ＝ **今回の対象と一致**
- `applyChapterCast(n)` の呼び出しは `applyChapterCast(1)` の1箇所のみ。Arc 2 へ進む経路は無い

### 1-5. 同行AI（Support AI）

| 対象 | 場所 | 状態 |
| --- | --- | --- |
| `buildGuestCompanion(classKey)` | `08-loot-equipment.js:990` | `CLASSES[].color/trim` を纏った人型NPC。**実装済み** |
| ゲストAI | 同 | 追従・索敵・攻撃。ダメージは `state.classDef.atk` に比例 |
| `syncAlliesToState()` | 同1103 | `state.guestClassKey` を見て生成・破棄 → `repositionAlliesToPlayer()` |
| `state.guestClassKey` | セーブ対象 | 書き換え経路は **テストモードの「同行ゲスト」だけ** |
| 敵対制御 | `core/enemy-aggro.js` | ゲストは `en.triggered` の敵だけを攻撃（非敵対の強モブを勝手に起こさない） |
| 非戦闘同行 | `03-dungeons-mansion-temple.js` `updateManorSmith` / `core/mansion-anomaly.js` `escortFollowStep` | 鍛冶屋の同行。戦闘に関与しない追従だけを持つ別系統 |

### 1-6. イベント・演出基盤

| 対象 | 場所 | できること |
| --- | --- | --- |
| `registerProximityEvent(pos, r, name, lines, opts)` | `02-world-common.js:2124` | 円形トリガ。`condition` / `onEnter` / `area` / `kind` |
| `registerRoomEvent(room, ...)` | 同2135 | 部屋形トリガ（回り込みで踏み外せない） |
| `playCutscene(steps)` | 同1247 | `{t, run}` の時系列キュー。入力を奪い、ヒットストップ・ポーズに追従 |
| `cutsceneTurnTo(yaw, dur, camYaw)` | 同 | 振り向き＋**カメラ同時回転**（smoothstep補間） |
| `state.walkTo` | `updateCutscenePhysics` | 演出中の徒歩（速度指定、停止はステップの責任） |
| `state.launch` | 同 | 演出中の放物線移動 |
| `spawnApparition(pos, opts)` | 同2065 | 半透明の人影。フェードイン → 保持 → 近づくと消える。**「誰もいないはずなのに人影」専用に作られた汎用機能** |
| `buildLoreNote()` | 同2040付近 | 読み物（看板/書物） |
| `spawnToast(text, color)` | `11-combat-actions.js:2093` | 短い通知 |
| `fadeTransition(fn)` | `12-progression-ui.js` | 暗転を挟んだ切り替え |
| `buildDoor` / `buildStairs` / `buildTownReturnPortal` | 各所 | 扉（ボス扉含む）・階段（`auto` で自動移動）・帰還 |

### 1-7. 敵AI

| atkType | 関数 | 特徴 |
| --- | --- | --- |
| `charge` | `updateChargerAI` | 予兆 → 突進 → 硬直。ガードブレイク対応 |
| `fire` | `updateFireEnemyAI` | 遠距離弾 |
| `kite` | `updateKiteAI` | 距離を取る |
| `turret` | `updateTurretAI` | 固定砲台 |
| `jumper` | `updateJumperAI` | 跳躍 |
| `ghost` | `updateGhostAI` | 近づいて透明化 → 背後へ回り込み → 実体化。`setEnemyOpacity()` を持つ |
| `servant`系 | `updateShadowServantAI` | `core/enemy-profiles.js` の近接プロファイル基盤（攻撃表・予兆・フェーズ） |
| ボス | `updateBossAI` / `updateMansionLordAI` | 特殊技は `en.special` 文字列で分岐 |

既存の特殊挙動で今回に効くもの:

- **`grab`**（温室ボス、`07-ai-combat.js:2572`）: 蔓が伸びる → 掴む → `pushPlayer()` で引き寄せ → 命中。**記憶漁師の網にそのまま使える形**
- **召喚**（`ghostCaptain`、同2668）: `alive < 4` の上限つきで雑魚を生成。**泡沫の群れの増殖に使える形**
- **分離/融合**（館の主 Phase 2/3）: 本体を `en.lordAnchor` に固定し、影が動く。`lordEchoT` で「本体の攻撃を影が遅れて追撃」。**遅延攻撃・本体見分けの前例**
- **`state.paralyzed` / `paralyzeInvulnT`**: 拘束の既存経路
- `core/enemy-tier.js` / `guardian-break.js`: 強モブの Super Armor / Guardian
- `core/predictive-aim.js`: 予兆中の敵を「読む」仕組み（鷹の目用）

### 1-8. 魔法使い / Skill 基盤

（詳細は `MAGE-001-analysis.md`。要点のみ）

- Skill 1 = `CHARGE_VARIANTS_BY_CLASS.mage` の6択（`state.skillChoice`）→ `executeVariant()` が `variant.mode` で分岐
- Skill 2 = `SKILL2_BY_CLASS.mage`（護りの魔球）。`state.mageOrbs` 配列＋毎フレーム更新＋掃除＋身代わり消費
- ステップ移動 = `variant.movement` → `state.skillAnim`（`retreat`/`dash`/`spin`）
- **属性システムはコード上に存在しない**（属性を追加しない方針と整合）
- 魔法弾は `spawnProjectile` / `spawnChargeOrb`、拡散は `fan5`、貫通は `line`、連鎖は `chain` mode が既にある

### 1-9. カメラ / 武器状態 / 戦闘状態

| 対象 | 挙動 |
| --- | --- |
| `core/battle-camera.js` | 探索は約1m引いて俯角を寝かせ、戦闘で現行値へ戻す。距離と高さのみ扱い `camYaw` は触らない |
| `camAutoOn` | 移動方向へカメラが自動追従（設定でOFF可、`camAutoResumeT` で手動操作後1.4秒は割り込まない、ボスロック中は無効） |
| `core/weapon-state.js` | 非戦闘で武器を収納、戦闘で抜刀。`combatStanceT > 0 → wantsArmed` の1本結合。HOLD 2.6秒 |
| `gateOnWeaponDrawn(kind)` | 抜刀待ちの間は攻撃・スキルを弾く |
| `core/combat-stance.js` | `state.combatStanceT` が「戦闘中か」の唯一の判定。スキル組み替えの可否もこれを見る |

---

## 2. Reusable Systems（そのまま使える）

| # | 基盤 | 用途 |
| --- | --- | --- |
| S1 | `launchScenario(key)` / `launchScenarioNow(key)` | シナリオ起動の唯一の入口。Test Mode からも直接呼べる |
| S2 | `finishEnteringGame({world:'training'})` → `launchScenario(key)` | **testMode を保ったままシナリオへ入れる**（§6-1） |
| S3 | `buildGuestCompanion` / `syncAlliesToState` / `guestClassKey` | 剣士の同行AI。追加実装不要 |
| S4 | `playCutscene` / `cutsceneTurnTo` / `state.walkTo` / `state.launch` | セミシームレス演出の全部品 |
| S5 | `registerProximityEvent` / `registerRoomEvent` | 導線上のビート。`condition` で進行段階に応じて出し分け |
| S6 | `spawnApparition` | 「誰もいない村で人影が見える」。**今回のテーマに直撃する既存機能** |
| S7 | `DUSK_ROOMS` + `buildWalls` + `addFloorWithHoles` + `addLowRailBox` | 村の authoring パターン（他ダンジョン共通） |
| S8 | `DUSK_BANDS` + `updateDuskVillage()` の色補間 | 夕暮れ→夜→**夜明け**の進行。バンドを足すだけ |
| S9 | `updateDuskVillage(dt)` のフック | 毎フレームの村固有処理の置き場。main loop に既に接続済み |
| S10 | `grab` の引き寄せ（`pushPlayer`）/ `state.paralyzed` | 記憶漁師の網 |
| S11 | 召喚の上限管理（`summonedBy` + `alive < N`） | 泡沫の群れの増殖上限 |
| S12 | 分離・影・`lordEchoT` の遅延追撃 | 水鏡の影 / 水門守の残響 / 遅延攻撃 |
| S13 | `setEnemyOpacity` / `takeLight`・`giveLight` / `spawnUltimateVFX` / `spawnScorch` / `spawnSweepVFX` | VFX 一式。新規プール不要 |
| S14 | `buildDoor`（ボス扉）/ `buildStairs`（`auto`）/ `buildTownReturnPortal` | 水門の開閉・区画移動・帰還 |
| S15 | `core/enemy-profiles.js` の `defineMeleeProfile` / `defineEnemyProfiles` | 敵の攻撃表・予兆・フェーズをダンジョン側から登録する汎用の器 |
| S16 | `core/enemy-aggro.js` / `enemy-tier.js` / `stagger-math.js` / `execution.js` | 体幹・強モブ・処刑。**使うだけで触らない** |
| S17 | `buildLoreNote` / `spawnToast` / BGM（`asset-manifest.js`） | 環境ストーリーテリング |

## 3. Extension Required（小規模な拡張）

| # | 対象 | 拡張内容 | 規模 |
| --- | --- | --- | --- |
| E1 | `beginTestMode()` | 引数 `scenarioKey` を1つ追加し、`finishEnteringGame` の**後**に `launchScenario()` を呼ぶ | 数行 |
| E2 | `setupTestModeScreen()` / `index.html` | シナリオ選択UIを1セクション追加（`SCENARIO_DEFS` から生成） | 小 |
| E3 | `DUSK_ROOMS` | 新導線（中央広場・魚屋・船小屋・水門前・水門・村の奥）へ差し替え／追記 | 中 |
| E4 | `DUSK_BANDS` | 「夜明け」バンドを末尾に追加 | 小 |
| E5 | `updateDuskVillage(dt)` | 環境アニメーション（水面・舟・ロープ・洗濯物・ランタン揺れ）の毎フレーム更新を追加 | 小〜中 |
| E6 | `spawnEnemies()` の `duskvillage` 分岐 | 新しい敵の配置へ差し替え | 小 |
| E7 | `CHARGE_VARIANTS_BY_CLASS.mage` | 幻影歩法（`mode:'decoy'`）を追加 → MAGE-001 と同一。**重複実装しない** | 小 |
| E8 | `SKILL2_BY_CLASS.mage` または新 variant | 観測の灯の接続先（§6-4で選択肢を提示） | 小 |
| E9 | `BOSS_ABILITIES` / `SCENARIO_TIME_LIMIT_BASE` | duskvillage 用エントリの追加（現在欠けている） | 小・**要仕様決定** |

## 4. New Systems Required（本当に新規）

| # | 新規 | 理由 | 規模 |
| --- | --- | --- | --- |
| N1 | **プレイヤー位置履歴バッファ** | 「過去位置への遅延攻撃」（記憶漁師）に必要。既存に位置履歴は無い | 小（リングバッファ1本） |
| N2 | **分身／本体の管理** | 水鏡の影・水門守の残響の「見分け」。館の主の分離は1体内のフェーズ処理で、複数分身の管理は無い | 中 |
| N3 | **直前の攻撃の記録と再生** | 写し身のコピー。プレイヤーの直前の攻撃種別を保持し、敵側から同等の攻撃を出す仕組みは無い | 中 |
| N4 | **観測の灯の情報表示レイヤー** | 「本体/残像/コピー/予兆を強調」。`enemy-visibility.js` のハイライトは3段階の可視性で、状態種別の強調ではない | 中 |
| N5 | **幻影デコイ＋敵の参照点の間接化** | MAGE-001 の核（`aggroPos(en)`）。**MAGE-001 と同一のものなので二重に作らない** | 中 |
| N6 | **水門ギミック** | 開閉で導線が変わる仕掛け。`buildDoor` の開閉はあるが、水位・経路変化は無い | 中・**要仕様決定** |
| N7 | **環境アニメーションの最小基盤** | 水面のうねり・舟の揺れ等。現状 duskvillage の水面は静止した一枚板 | 小（§6-5の方針なら） |

## 5. Risk

| # | リスク | 深刻度 | 緩和 |
| --- | --- | --- | --- |
| R1 | **既存 duskvillage を壊す。** 既存ボス `duskCollective`・ランタンギミック・`tests/duskvillage.spec.js` が今の `DUSK_ROOMS` 前提 | **高** | 作り替え方針を人間が決めるまで着手しない（WORK 0-D）。決めた後も既存テストは一度に壊さず、WORK 2 で新レイアウトに合わせて更新する |
| R2 | `finishEnteringGame({world:'duskvillage'})` を直接呼ぶと `state.testMode` が false になり、**テスト中にセーブが上書きされる** | **高** | 必ず `world:'training'` で入ってから `launchScenario()` |
| R3 | 座標帯の衝突。duskvillage は z=284〜536 を占有し、他ダンジョンは別帯を使う取り決め | 中 | 新導線も既存帯の内側に収める。`worldKeyForPos()` / `setWorldBounds()` の帯を変えない |
| R4 | `spawnEnemies()` は `buildWorld` 内で `enemies` を作り直すため、`build()` 側で `enemies.push` しても消える | 中 | 既存コメントどおり、敵の生成は必ず `spawnEnemies()` 側で行う |
| R5 | 光源の作り過ぎでシェーダ再コンパイルのスタッター（`mageOrbs` が踏んだ問題） | 中 | `takeLight`/`giveLight` プールを必ず使い、必ず返す |
| R6 | 分身・泡沫・召喚で `enemies` が膨張し、E2E（SwiftShader）がタイムアウト | 中 | 同時存在数の上限を必ず持つ。E2E は Scenario Test Mode で短縮する |
| R7 | カメラ自動追従（`camAutoOn`）が演出と競合 | 低 | 演出中は `playCutscene` が入力を奪うので原則衝突しない。`cutsceneTurnTo` の camYaw 指定を使う |
| R8 | 武器の抜刀待ち（`gateOnWeaponDrawn`）で演出直後の操作が弾かれる | 低 | 演出の終わりで `combatStanceT` を意図した値にしてから返す（洋館の前例に倣う） |
| R9 | 魔法使いは本編で操作できないため、退行が通常プレイのテストに現れない | 中 | WORK 1 を最初に置く理由がこれ |
| R10 | `duskvillage` の `minLevel:26` のまま Arc 2 の体験を作ると、本編導入時にレベル前提が噛み合わない | 中 | 本タスクでは変更しない。仕様判断として残す |

## 6. Recommended Architecture

### 6-1. Scenario Test Mode（本編非干渉）

```
beginTestMode(classKey, jobKey, level, guestKey, scenarioKey)
  ├ 既存の状態リセット（そのまま）
  ├ finishEnteringGame({showIntro:false, world:'training'})   ← state.testMode = true
  └ if(scenarioKey) launchScenario(scenarioKey)               ← testMode を保ったまま
```

`finishEnteringGame()` に **シナリオ固有の分岐を足さない**。
`state.testMode` の書き換え箇所は1行のまま増やさない。save/load への新規依存も作らない。

### 6-2. 村の構造

既存の authoring パターン（`DUSK_ROOMS` の表 + `buildWalls()` + `addFloorWithHoles()`）を維持し、
**表の中身だけ**を新導線へ書き換える。ロジックは触らない。

```
森（既存 entry 手前）→ 村入口 → 中央広場 → 魚屋 / 住宅 / 船小屋 / 商店街
→ 水門前 → 水門 → 村の奥 → 村の残響（ボス）→ 夜明け → 酒場
```

- 中央広場を「戻ってくる場所」にし、魚屋・住宅・船小屋・商店街を広場からの枝にする
  （既存のハブ＋枝の作りをそのまま活かせる）
- 水門は `buildDoor` の開閉＋`buildStairs`（`auto`）で「区画が切り替わる」形にするのが最小
- 「夜明け」は `DUSK_BANDS` に明るいバンドを1つ足すだけで色が繋がる

### 6-3. 敵

| 敵 | 実装の足場 | 新規 |
| --- | --- | --- |
| 水鏡の影 | `ghost` の透過 + 分身の配列管理 | N2 |
| 泡沫の群れ | 召喚の上限管理（`summonedBy` + `alive < N`） | 上限値のみ |
| 写し身 | 直前の攻撃の記録 → 既存の敵攻撃へマップ | N3 |
| 記憶漁師 | `grab`（蔓）の引き寄せ + `state.paralyzed` + 位置履歴 | N1 |
| 水門守の残響 | 分身管理（N2）+ `core/enemy-profiles.js` の攻撃表 | N2 の再利用 |
| 村の残響（ボス） | 上記の組み合わせ。**新しい基本ギミックを足さない** | なし |

数値（HP・攻撃力・予兆秒数・分身数・上限）は **すべて未確定**。
`core/crush-slash.js` に倣い `PROVISIONAL_*` として置く。

### 6-4. 魔法使いのスキル

- **Skill 1「幻影歩法」= MAGE-001 と同一。** 二重に実装しない。
  `CHARGE_VARIANTS_BY_CLASS.mage` に `mode:'decoy'` + `movement:'retreat'` を1エントリ足し、
  `executeVariant()` に分岐を1本、敵AIの参照点を `aggroPos(en)` へ1段間接化する
  （接近・向き・攻撃開始距離だけ。**命中判定は `state.pos` のまま**）
- **Skill 2「観測の灯」** の接続先は2案。**未確定**
  - 案A: `SKILL2_BY_CLASS.mage`（護りの魔球）を置き換える → Chapter 1 の「閃き」に乗る
  - 案B: Skill 1 の variant として足す → 既存のスキル2を残せるが、幻影歩法と枠を奪い合う
  - どちらでも「答えを表示しない」方針は、`core/enemy-visibility.js` のハイライト強度を
    一時的に上げる形（情報の追加ではなく、既にある情報を見やすくする）で守れる

### 6-5. 環境アニメーション

**汎用システムを作らない。** `updateDuskVillage(dt)` の中で、
生成時に配列へ積んだオブジェクトを `Math.sin(t)` で揺らすだけの最小実装から始める。

```
duskProps = [{mesh, kind:'water'|'boat'|'rope'|'laundry'|'lantern', phase, amp}]
```

動かすものが増えて配列が肥大し、種類ごとの挙動差が耐えられなくなった時点で、
初めて共通化を検討する（WORK 8 で判断）。

### 6-6. 演出

「立ち止まって会話するだけ」を避ける手順は既に全部ある。

```
registerRoomEvent(部屋, …, {onEnter: ()=> playCutscene([
  {t:0.0, run:()=> cutsceneTurnTo(水門の方角, 0.7, カメラも同じ方角)},
  {t:0.8, run:()=> state.walkTo = {vx, vz}},            // 数歩あるく
  {t:1.6, run:()=> { state.walkTo = null; spawnApparition(…); }},
  {t:2.2, run:()=> 会話1行},
])})
```

剣士（同行AI）を演出に参加させる場合、戦闘AIの `guestCompanion` を止めずに位置だけ
動かすと不自然になる。洋館の鍛冶屋（`manorSmithWalk`）と同じく
**演出用の行き先を持たせて歩かせる**のが既存の作法。

---

## 7. Implementation Work Plan

### WORK 0-D（先行・人間の決定）

実装を始める前に、次を決める必要がある。AIが決めてはならない。

1. 既存 duskvillage（灯りギミック＋宵影の群れ）を **置き換えるのか、残して別区画を足すのか**
2. 既存ボス `duskCollective` を「村の残響」へ作り替えるのか、別ボスとして併存させるのか
3. 既存のランタン点灯ギミックを新設計へ引き継ぐか
4. `minLevel:26` を Arc 2 の位置づけに合わせて見直すか
5. 「観測の灯」を Skill 2 にするか Skill 1 variant にするか（§6-4）
6. 水門ギミックの具体仕様（開閉で何が変わるか）
7. `BOSS_ABILITIES` / `SCENARIO_TIME_LIMIT_BASE` の duskvillage エントリ

---

### WORK 1 — Scenario Test Mode

**目的**: 本編を最初からプレイせずに duskvillage を魔法使い＋剣士同行で直接起動できるようにする。
以降の全 WORK の検証コストを下げる前提工事。

**対象ファイル**
- `index.html`（`#testmode-screen` にシナリオ選択セクションを追加）
- `src/legacy/parts/01-character-creation.js`（`setupTestModeScreen()`）
- `src/legacy/parts/14-hud-boot.js`（`beginTestMode()`）
- `src/styles/main.css`（既存 `.testmode-job-card` を流用できるなら不要）
- `tests/helpers.js`（**追加のみ**）、`tests/scenario-test-mode.spec.js`（新規）

**実装内容**
1. `SCENARIO_DEFS` の `unlocked:true` のみからシナリオカードを生成（`pyramid`/`volcano` は出さない）
2. 選択値を `beginTestMode()` の第5引数として渡す。未選択なら従来どおり training
3. `beginTestMode()` は既存処理と `finishEnteringGame({world:'training'})` をそのまま実行し、
   **その後に** `launchScenario(scenarioKey)` を呼ぶ
4. シナリオを選んだとき、`CHAPTER_CAST` から導いた既定ゲストを提示（任意・未確定）

**既存コードへの影響**: `finishEnteringGame` / `launchScenarioNow` / `applyChapterCast` /
`startScenarioTavernDialogue` は変更しない。本編の開始経路に差分が出ない。

**テスト**
- `mansion` / `duskvillage` を直接起動し `currentWorldKey` が一致する
- 魔法使い＋ゲスト剣士を指定して `state.classDef.key==='mage'` / `state.guestClassKey==='warrior'`
- 既存セーブがテスト前後で**一切変化しない**
- シナリオ未選択時は従来どおり training（Arena パネルが出る）
- 既存 E2E（`save-load` / `combat-test-arena` / `duskvillage`）が通る

**実機確認**: タイトル → テストモード → 宵待ちの村 → 魔法使い → 剣士同行 → 起動。
入場位置・カメラ・同行AIの出現・`console.error` なし。

**完了条件**: 上記テストが全て通り、`state.testMode` が起動中 true のままであること。

---

### WORK 2 — 村マップ + 環境

**目的**: 新導線（森〜夜明けまで）の箱を通しで歩けるようにする。敵は置かない。

**対象**: `14-dungeon-duskvillage.js`（`DUSK_ROOMS` / `DUSK_BANDS` / `buildDuskVillage` /
`updateDuskVillage`）、`tests/duskvillage.spec.js`（新レイアウトへ更新）

**実装内容**
1. `DUSK_ROOMS` を新導線へ書き換え（中央広場を軸に、魚屋・住宅・船小屋・商店街を枝に）
2. `DUSK_BANDS` に「夜明け」バンドを追加
3. 水面・舟・ロープ・洗濯物・ランタンの揺れを `duskProps` 配列＋`updateDuskVillage` で最小実装
4. 帰還ポータル・ロアノートの再配置

**既存コードへの影響**: 既存レイアウト前提の `spawnEnemies()` の配置座標と
`tests/duskvillage.spec.js` が必ず壊れる（WORK 0-D の決定に従う）。

**テスト**: 全部屋の gap が `buildWalls()` の規約と整合すること（単体で検証可能な表の検査）、
world が `console.error` なく構築されること。

**実機確認**: 入口から広場まで歩き通せる／桟橋から落ちない／夕暮れ→夜→夜明けの色が繋がる／
環境の揺れが酔わない程度であること。

**完了条件**: 敵ゼロの状態で入口からボス部屋前まで到達でき、E2E がグリーン。

---

### WORK 3 — 村入口〜魚屋

**目的**: 導入の体験（村に入る・誰もいない・でも世界は動いている）と最初の戦闘を成立させる。

**対象**: `14-dungeon-duskvillage.js`、`07-ai-combat.js`（`duskvillage` の敵配置と新AI）、
必要なら `src/core/dusk-*.js`（純粋ロジック）

**実装内容**
1. 村入口の導入イベント（`registerRoomEvent` + `playCutscene` + `spawnApparition`）
2. 水鏡の影（分身と本体、N2）の初出。**1体だけ**で「見分ける」を教える
3. 魚屋の環境ストーリーテリング（ロア＋人影）

**既存コードへの影響**: 新AIは既存 `updateXxxAI` を変更せず、新しい `atkType` として追加する。
体幹・パニッシュ窓・処刑の基盤は使うだけ。

**テスト**: 分身の選定・寿命の純粋ロジックを `tests/unit/` で固定。E2E は WORK 1 経由で起動し、
最初の戦闘まで到達して `console.error` なし。

**実機確認**: 本体を見分けられるか／分身が多すぎないか／導入演出が止まって見えないか。

**完了条件**: 魚屋まで到達でき、水鏡の影の「見分け」が成立する。

---

### WORK 4 — 住宅〜船小屋

**目的**: 泡沫の群れ（増殖）と写し身（コピー）を導入する。

**対象**: `07-ai-combat.js`（召喚上限・写し身）、`11-combat-actions.js`（直前の攻撃の記録）、
`14-dungeon-duskvillage.js`（配置・イベント）

**実装内容**
1. 泡沫の群れ: `summonedBy` + 上限つき増殖（`ghostCaptain` の形を流用）
2. 写し身: プレイヤーの直前の攻撃種別を1つだけ保持し、対応する既存の敵攻撃を出す（N3）
3. 船小屋の演出（舟・ロープが揺れている中に誰もいない）

**既存コードへの影響**: 「直前の攻撃の記録」は `tryAttack` / `executeVariant` / `castSkill2` の
末尾に1行ずつ足す形にとどめ、攻撃処理そのものは変更しない。

**テスト**: 増殖上限・コピー対象の選定を単体テストで固定。E2E で `enemies.length` が上限を超えない。

**実機確認**: 増殖で処理落ちしないか／写し身のコピーが理不尽でないか。

**完了条件**: 3種の通常敵が揃い、同時出現しても安定して動く。

---

### WORK 5 — 商店街〜水門前

**目的**: 強敵「記憶漁師」と、水門前までの導線を成立させる。

**対象**: `07-ai-combat.js`（網＝`grab` の流用、位置履歴＝N1）、`14-dungeon-duskvillage.js`

**実装内容**
1. 記憶漁師: 網による拘束／引き寄せ（`pushPlayer` + `state.paralyzed`）
2. 過去位置への遅延攻撃（プレイヤー位置履歴のリングバッファ、N1）
3. 強モブとしての扱い（`core/enemy-tier.js` の Super Armor / Guardian を**使うだけ**）
4. 商店街の演出（「忘れられること」のテーマを最も強く出す区画）

**テスト**: 位置履歴と遅延参照の純粋ロジックを単体テストで固定。

**実機確認**: 拘束が長すぎないか／遅延攻撃が「読める」か／強モブの体幹が段差として機能するか。

**完了条件**: 記憶漁師を倒して水門前に到達できる。

---

### WORK 6 — 水門〜村の奥

**目的**: 水門ギミックと中ボス「水門守の残響」。

**対象**: `14-dungeon-duskvillage.js`（水門）、`07-ai-combat.js`（中ボスAI）、
`src/core/` に中ボスの攻撃表（`defineMeleeProfile` の形）

**実装内容**
1. 水門の開閉（`buildDoor` + `buildStairs(auto)` の組み合わせを基本とする。仕様は WORK 0-D 待ち）
2. 水門守の残響: 複数の残像＋本体。WORK 3 の分身管理（N2）を再利用する
3. 村の奥の導線と演出

**既存コードへの影響**: 中ボスは `core/enemy-profiles.js` の器に**登録する側**として書き、
器（`enemy-profiles.js`）自体は変更しない（洋館の `mansion-enemies.js` と同じ作法）。

**テスト**: 攻撃表・フェーズ判定を単体テストで固定（`tests/unit/mansion-warden.test.js` の形）。

**実機確認**: 本体の見極めが観察で成立するか／水門の開閉で迷わないか。

**完了条件**: 中ボスを倒して村の奥へ抜けられる。

---

### WORK 7 — ボス〜夜明け

**目的**: ボス「村の残響」と、締めの夜明け演出。

**対象**: `14-dungeon-duskvillage.js`（ボス生成・夜明け）、`07-ai-combat.js`（ボスAI）、
`12-progression-ui.js`（クリア演出・ボス台詞）、`08-loot-equipment.js`（ドロップ接頭辞）

**実装内容**
1. 村の残響: 水鏡・泡沫・写し身・記憶/遅延攻撃を段階的に組み合わせる。
   **新しい基本ギミックを追加しない**
2. 夜明け演出（`DUSK_BANDS` の新バンドへ遷移 + `playCutscene`）
3. 酒場への帰還

**既存コードへの影響**: 既存 `duskCollective` の台詞・ドロップ・見た目分岐の扱いが
WORK 0-D の決定次第で変わる。`BOSS_ABILITIES` への追加も仕様判断。

**テスト**: ボスのフェーズ遷移を単体テストで固定。E2E はボス部屋到達まで（SwiftShader では
ボス撃破までの通しは現実的でない。既存テストも同じ判断をしている）。

**実機確認**: フェーズが「積み上がる」と読めるか／初見で理不尽でないか／夜明けが締まるか。

**完了条件**: ボスを倒して酒場へ戻れる。通しで 30〜40 分に収まる。

---

### WORK 8 — 全体演出 / バランス / 実機調整

**目的**: 通しプレイでの手触りを整える。

**対象**: 主に `14-dungeon-duskvillage.js` の数値と演出、必要なら各敵の `PROVISIONAL_*`

**実装内容**: 所要時間（初回探索15〜25分）・敵密度・体幹の段差・環境アニメーションの量・
BGM/SE（`asset-manifest.js`）・`SCENARIO_TIME_LIMIT_BASE` の設定（仕様決定後）

**テスト**: 既存テスト全通過。パフォーマンス（`updatePerfPanel`）で描画コールが増え過ぎていないこと。

**実機確認**: 実機（iPhone Safari 含む）での処理落ち・酔い・視認性。

**完了条件**: 通しプレイが想定時間に収まり、E2E と単体テストが全てグリーン。

---

### WORK 9 — Chapter 1 回帰

**目的**: 既存本編（特に森の洋館＝Arc 1）が一切壊れていないことを確認する。

**対象**: 変更なし（確認のみ）。問題が出た場合のみ最小修正

**実装内容**
1. `npm run build` / `npm run test:unit` / `npm test` の全通過
2. 新規ゲーム（剣士・単独・`mansion`）が従来どおり開始・クリアできる
3. セーブ/ロードの互換（旧セーブが読める。新フィールドを増やしていないこと）
4. 他ダンジョン（幽霊船・神殿・時計塔・温室・地下水路）の起動確認
5. `state.chapter` を追加していないこと、`applyChapterCast` に差分が無いことの確認

**完了条件**: Arc 1 の体験に差分が無く、全テストがグリーン。

---

## 8. 次に Claude Code へ渡す WORK 1 の指示に必要な材料（揃っている）

| 項目 | 値 |
| --- | --- |
| 入口 | `index.html` `#testmode-screen`（`#testmode-guest-grid` の後ろ） |
| UI組み立て | `01-character-creation.js` `setupTestModeScreen()`（ゲスト選択と同じ作法） |
| 一覧の情報源 | `SCENARIO_DEFS`（`unlocked:true` のみ） |
| 起動関数 | `beginTestMode(classKey, jobKey, level, guestKey)` → 第5引数を追加 |
| 起動順序 | `finishEnteringGame({showIntro:false, world:'training'})` → `launchScenario(scenarioKey)` |
| 禁止 | `finishEnteringGame()` にシナリオ分岐を足すこと／`state.testMode` の書き換え箇所を増やすこと／save/load への新規依存 |
| テスト経路 | `#open-testmode-btn` → `.class-card[data-key="mage"]` → ゲスト → シナリオ → `#testmode-start-btn` |
| 検証 | `currentWorldKey` / `state.classDef.key` / `state.guestClassKey` / `localStorage` 不変 |

---

## 9. Unknowns（人間の決定が必要）

1. 既存 duskvillage の扱い（置換 / 併存 / 部分流用）と既存ボスの扱い
2. ランタンギミックを新設計へ引き継ぐか
3. 水門ギミックの具体仕様
4. 「観測の灯」の接続先（Skill 2 置換 / Skill 1 variant）
5. 全敵の数値（HP・攻撃力・予兆秒・分身数・増殖上限・拘束時間・遅延秒数）
6. `minLevel:26` の見直し
7. `BOSS_ABILITIES` / `SCENARIO_TIME_LIMIT_BASE` への duskvillage 追加
8. 幻影歩法の数値（MAGE-001 の Unknowns と同一。重複して決めない）

---

## 10. 確認事項

- ゲームコードは変更していない
- commit していない
- Chapter 管理システムの新設・`state.chapter` の追加・Chapter 2 実装・3人パーティ・
  Sphere Board・新しいセーブ構造・属性魔法・魔法使い専用の必須探索ゲート・
  既存本編進行の変更は、いずれも計画に含めていない
