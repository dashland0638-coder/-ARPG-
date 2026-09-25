# CHARACTER-VIS-001 Analysis

## Task

CHARACTER-VIS-001 / プレイヤーキャラクターのビジュアル統一。
「頭身が低い・関節が不自然・歩行が走り気味」を改善する。優先事項は
(1) 身長・頭身の自然化、(2) 部位比率の整理、(3) 肩・肘・膝の接続改善、
(4) 非戦闘歩行を「腕を上げたジョギング」から自然歩行へ、(5) トゥーン調・マット寄りの質感を標準化、
(6) 既存の職業・武器・戦闘モーション・攻撃システムを維持。
新システムを作らず、既存システムを拡張できるかを最優先で判断する（Existing System First）。

- Role: Analyzer（READ ONLY。コード・テストは変更していない）
- 調査基準: branch `claude/character-vis-001-analysis-g029kj`（HEAD = `e31e7df` の作業ツリー）
- 行番号は上記時点のもの

## Summary

- **FACT**: キャラクターの体格は `BUILD`（`05-rendering-rig.js:1903`）の1テーブルと、`makeCharacter*()` 系 Loft 生成関数（`05-rendering-rig.js:335-785`）で決まる。組み立ては `buildPlayer()`（`06-player-enemy.js:510`）1箇所だけ。
- **FACT**: 現在の頭身は男女とも約 **3.4 頭身**。これは過去にユーザーの参考画像（チビキャラ）に合わせて意図的に `headR 0.290 → 0.39`（約4.7→3.5頭身）へ引き上げた結果（`05-rendering-rig.js:1911-1914` コメント）。今回はその方針の反転になる。
- **FACT**: 非戦闘の**移動中**の腕は、**戦闘の構え**（`STANCE`）を基準姿勢として振られている。休め姿勢（`STANCE_RELAXED`）は**停止中にしか**効かない。これが「腕を上げたジョギング」の直接原因（詳細は Root Cause）。
- **FACT**: 歩行のケイデンス・振幅は通常移動速度（4.4〜7.0 m/s）で既に「sprint 寄り」の値になる式になっている（`13-update-loop.js:1153-1159`）。
- **FACT**: 歩行（`updateLocomotion`）と戦闘モーション（`applyCombatPose`）は**同じリグ（ピボット）に書き込むが、処理は別関数**。戦闘は歩行の後に上書きする順序。
- **FACT**: 近接の当たり判定は**メッシュに依存しない**（距離・角度の純粋関数）。一方、魔法使い・弓師の弾の発射位置は武器ノードのワールド座標に依存する。
- **FACT**: プレイヤーのマテリアルは `buildPlayer()` 内で**毎回 new** しており敵と共有していない。ただしアウトライン用 ShaderMaterial（`outlineMats()`）はプレイヤー・敵・ボス共通。
- **FACT**: 支援AI（ゲスト仲間）は `buildPlayer()` を使わない簡易図形（円柱+球）で、歩行アニメも持たない。今回の変更は波及しない。
- **判定: A（既存システムの拡張で対応可能）**。ただし「トゥーン調」を陰影段階化（セルシェーディング）まで含めるなら、その部分だけ B 相当（→ DECISION D-4）。

## Existing System Search

| 探したもの | 検索語 / 範囲 | 結果 |
| --- | --- | --- |
| キャラクター生成の入口 | `buildPlayer(` / `src/` | あり: `06-player-enemy.js:510`。呼び出しは `14-hud-boot.js:1590, 1793` |
| 体格パラメータ表 | `const BUILD` / `src/` | あり: `05-rendering-rig.js:1903`（male/female）。参照は `06-player-enemy.js:513, 1813, 1933`、`13-update-loop.js:1156` |
| 部位ジオメトリ生成 | `makeCharacterTorso\|Pelvis\|Thigh\|Calf\|UpperArm\|Forearm\|Head` | あり: `05-rendering-rig.js:335, 401, 446, 497, 548, 598, 776`。**使用箇所は `buildPlayer()` のみ** |
| Loft 汎用生成 | `makeLoft` / `src/render/` | あり: `src/render/lowpoly-primitives.js:197`（unit test: `tests/unit/lowpoly-primitives.test.js`） |
| Lathe 生成 | `LatheGeometry`, `limbGeo` / `src/` | あり: `limbGeo()` `05-rendering-rig.js:242`。プレイヤーでは Cuff/Greave/Vambrace/Pauldron のみ（`06-player-enemy.js:603, 1537, 1569`）。本体部位は Loft へ移行済み。`LIMB_PROFILE/TORSO_PROFILE/HEAD_PROFILE` は `buildBoss()`（`06-player-enemy.js:4506-4930`）が使用中 |
| 歩行処理 | `strideAmp\|armSwing\|kneeLift\|strideT` | あり: `updateLocomotion()` `13-update-loop.js:1141`。他に歩行実装は無い（`src/core/` にも該当なし） |
| 非戦闘の立ち姿 | `STANCE_RELAXED`, `applyRelaxedIdlePose` | あり: `05-rendering-rig.js:2370, 3670`。`core/relaxed-idle.js`（unit test あり） |
| 戦闘の構え・クリップ | `STANCE`, `STANCE_ALT`, `CLIPS`, `applyCombatPose` | あり: `05-rendering-rig.js:2203, 2269, 2529〜, 3493` |
| 頭部の縮小スケール機構 | `headLookPivot.scale` | あり: 戦騎士のみ `0.86`（`06-player-enemy.js:2004`）。解除 `:1903` |
| トゥーン系マテリアル | `MeshToonMaterial`, `gradientMap` / `src/` | **なし（確認済み）**。コメント上の言及のみ（`05-rendering-rig.js:11`）。ドットモードの posterize パスが「セル画風近似」を担う（`05-rendering-rig.js:5-30`） |
| マテリアル共通化の仕組み | `function applyBump`, `makeLeatherTexture`, `makeMetalTexture` | あり: `src/textures/textures.js:152, 217, 257`。テクスチャはキー単位でキャッシュ、Material はプレイヤー側で都度生成 |
| アウトライン | `addOutline(` | あり: `05-rendering-rig.js:2009`。使用: プレイヤー `06:1782`（always）、敵 `06:4239`（rim なし）、ボス `06:4947` |
| 支援AIの見た目 | `buildCompanion`, `buildGuestCompanion` | あり: `08-loot-equipment.js:930, 1020`。どちらも `buildPlayer`/`BUILD` 不使用 |
| デコイ（幻影） | `spawnPhantomDecoy` | あり: `11-combat-actions.js:1432`。Cone+Sphere の固定寸法（`body.y 0.80`, `head.y 1.78`）。`buildPlayer` 不使用（理由コメント `:1428-1430`） |
| 体格・頭身の仕様書 | `頭身\|トゥーン\|toon\|マット` / `docs/`, ルート `*.md`, `.ai/decisions/` | **仕様なし（確認済み）**。`ARPG_INTEGRATION.md:407` に戦騎士の頭ピボット 0.86 の記述のみ |
| 体格・歩行の数値テスト | `strideT\|headR\|BUILD\|updateLocomotion\|armSwing` / `tests/` | 直接の数値アサーションは**なし**。スクリーンショットは保存のみで比較なし（`toHaveScreenshot` / `toMatchSnapshot` 0件） |

## Relevant Files

- `src/legacy/parts/05-rendering-rig.js` / BUILD 表・部位 Loft 生成・STANCE/STANCE_RELAXED/WEAPON_SOCKET・CLIPS・applyPose/applyCombatPose/applyRelaxedIdlePose・アウトライン
- `src/legacy/parts/06-player-enemy.js` / `buildPlayer()`（部位配置・関節階層・マテリアル・職別装飾）、`applyJobPromotionVisual()`（上位職）、`swapPlayerWeaponVisual()`、`buildEnemy()`/`buildBoss()`
- `src/legacy/parts/13-update-loop.js` / `updateLocomotion()`（歩行・腕振り・腰・ボブ・傾き）、移動速度
- `src/core/relaxed-idle.js`, `src/core/combat-stance.js`, `src/core/look-rig.js` / 休め・構え・視線の純粋関数（unit test 済み）
- `src/render/lowpoly-primitives.js` / `makeLoft` ほか低ポリ Primitive
- `src/textures/textures.js` / 布・金属テクスチャ、`applyBump`
- `src/legacy/parts/08-loot-equipment.js` / 支援AI
- `src/legacy/parts/11-combat-actions.js` / 弾の発射位置 `projectileOrigin()`、デコイ
- `src/legacy/parts/01-character-creation.js` / `CLASSES`（職ごとの `spd`、色）
- `tests/character-motion.spec.js`, `tests/weapon-stow.spec.js`, `tests/battle-knight-visual.spec.js`, `tests/unit/{relaxed-idle,combat-stance,look-rig,lowpoly-primitives,motion-preview}.test.js`

## Current Behavior

### 1. キャラクター生成（FACT）

- `buildPlayer(classDef, gender)` が全8職（剣士/盗賊/魔法使い/弓師 + 影の旅人は `kit:'warrior'` で剣士の骨格を借用、`12-progression-ui.js:1744`）の唯一の生成関数。上位職4種（戦騎士/バーサーカー/魔導士/鷹の目）は別生成ではなく `applyJobPromotionVisual()`（`06:1926`）が装飾を**上乗せ**する。
- `const B = BUILD[isFemale ? 'female' : 'male']` を読み、`playerMixerParts.build = B` として歩行側（`13:1156`）にも渡す（`06:513-517`）。

### 2. 部位寸法（FACT、`05-rendering-rig.js:1903-1940`、`06-player-enemy.js` の配置から算出）

| 項目 | male | female | 定義元 |
| --- | --- | --- | --- |
| hipY（ベルト線） | 1.10 | 1.05 | BUILD |
| 股関節ピボット Y | 1.13 | 1.08 | `06:576` 付近 `HIP_Y + 0.03` |
| thighLen / calfLen | 0.56 / 0.54 | 0.535 / 0.515 | BUILD |
| torso 高さ（ベルト→襟） | 0.80 | 0.74 | BUILD.height |
| headR / headGap | 0.3705 / 0.27 | 0.3515 / 0.26 | BUILD |
| 頭の高さ（Loft height = 2×headR） | 0.741 | 0.703 | `06:724` |
| 頭中心 Y | 2.17 | 2.05 | `HIP_Y + bodyH + headGap`（`06:725`） |
| 頭頂 Y（≒身長、髪・被り物除く） | 約 2.54 | 約 2.40 | 算出 |
| **頭身（身長 / 頭の高さ）** | **約 3.43** | **約 3.41** | 算出 |
| 上腕長 / 前腕長 | **0.32 / 0.30（男女共通の直値）** | 同左 | `06:1506, 1513`（配置 `06:1522-1560`） |
| 肩ピボット Y | 1.82 | 1.72 | `HIP_Y + bodyH*0.90`（`06:1519`） |
| 手（球）中心 Y（腕を真下に下ろした場合） | 約 1.18 | 約 1.08 | 肩 −0.32 −0.32 |
| 骨盤メッシュ Y 範囲 | **0.63–0.97（中心 0.80 直値）** | 0.65–0.95 | `06:648` `pelvis.position.y = 0.80`、`pelvisH` 0.34/0.30 |
| 首 | 円柱 高さ bodyH×0.13、中心 HIP_Y+bodyH×0.99 | 同式 | `06:673-676` |
| 顎の Y | 約 1.80（胴体上端 1.90 より 0.10 下） | 約 1.70（胴体上端 1.79） | 算出 |

- 各 Loft 生成関数は「`width/depth/height` の基準値 × `*_SECTION_RATIOS` の yFrac/widthMul/depthMul」で断面を組む共通パターン（`05:335-610`）。断面形状は `makeBodyProfile()` の6角形（`05:306`）。
- 頭部は `HEAD_SECTION_RATIOS`（5段）+ `HEAD_HEX_TEMPLATE`/`HEAD_NOSE_TEMPLATE`、奥行き圧縮 `HEAD_DEPTH_MUL=0.85`、後方オフセット `HEAD_BACK_Z=-0.05`（`05:714-790, 796, 850`）。髪・被り物は `headOutlineAt()` / `get*CoverageAt()` で **headR 比**に追従する設計（`05:764` のコメント「Hair/装飾の配置は必ずこれを基準にする」）。

### 3. 関節接続（FACT）

- 階層（`06:568-635, 1506-1575, 1680-1731`）:
  - root(group) ─ legL/legR（股関節ピボット）─ thigh / kneeL/kneeR ─ shin・膝キャップ球・ブーツ・つま先
  - root ─ pelvis（**root 直下、waist にも脚にも属さない**）
  - root ─ waist（Y=HIP_Y。**ベルトより上の全メッシュを後から付け替え**、`06:1680-1688`）
    - torso / chestPlate / neck / belt / armL,armR（肩ピボット）─ upper・pauldron / elbow ─ fore・肘キャップ球・vambrace・hand・指
    - headLookPivot ─ head / 髪 / 被り物、eyePivot ─ 目
    - weapon / offhandWeapon（waist 直下、`updateGrip()` が毎フレーム手の位置から再計算）
- 関節の見た目の接続は **球メッシュで隠す方式**: 膝 `SphereGeometry(B.calf*0.98)`（trimMat、`06:595`）、肘 `SphereGeometry(B.forearm*1.06)`（`06:1530`）、肩は Pauldron（`06:1567-1571`、盗賊は 0.6 倍）。
- 肩ピボットの X は `bodyR + shoulderOut`（male 0.45）。上腕の半幅 0.098 → 内側端 0.352 で、胴体の肩断面（yFrac 0.9 付近で半幅 約0.38）と重なる（算出）。
- 骨盤は Y 0.63–0.97、胴体下端（waist 断面）は Y 1.10、股関節ピボットは Y 1.13（算出）。**骨盤上端と胴体下端の間に約 0.13 の区間があり、ここは太腿上端（半幅 0.145）が見える領域**。
- 骨盤は root 直下、胴体は waist 配下。`updateLocomotion` は waist に `rotation`（twist/pitch/roll）と `position.x`（hip sway）を毎フレーム書く（`13:1222-1256`）→ **骨盤と胴体は歩行中に別々に動く**。

### 4. 通常移動のアニメーション（FACT、`13-update-loop.js:1141-1340`）

- 移動速度: `speed = classDef.spd`（`13:554`）。剣士 5.0 / 盗賊 7.0 / 魔法使い 4.4 / 弓師 5.6 / 影の旅人 5.3 m/s（`01-character-creation.js:24, 37, 63, 80, 113`）。**歩き/走りの区別は無い**（入力の倒し量 `inputMag` で比例するのみ、`13:592`）。
- ストライド位相: `strideT += moveSpeed * dt * 2.7`（`13:1154`）。
  - 剣士 5.0m/s → 13.5 rad/s → 約 2.15 周期/秒 = **約 4.3 歩/秒**（算出）。
- 振幅: `swing = min(0.62, 0.045 + 0.085*moveSpeed) * B.strideAmp`、`run = min(1, swing/0.55)`（`13:1157-1159`。コメント「0 at a walk, 1 at a sprint」）。
  - 剣士 5.0m/s → swing 0.47 / run 0.85、盗賊 7.0 → swing 0.62（上限）/ run 1.0、魔法使い 4.4 → 0.42 / 0.76（算出）。
- 脚: `legL.x = s*swing`、膝 `max(0,±s)*swing*1.55*kneeLift + 0.05 + jobKneeBias`（`13:1189-1205`）。
- 腕: `armL.x = armLBase.x - s*swing*asw`、`asw = P.armSwing(STANCE の armSwing) * 0.62 * B.armSwing`。肘 `elbowLBase.x - max(0,-s)*swing*0.5`（`13:1208-1216`）。**`busy`（攻撃・スキル・溜め・必殺照準）中は腕を書かない**。
- 腰: twist / pitch `0.02 + run*0.11` / roll、hip sway（`13:1222-1256`）。
- 上下動: `bob = |sin(strideT)| * (0.05 + run*0.035) * bobAmp`（`13:1332`）、前傾 `min(0.13, moveSpeed*0.019)`（`13:1303`）。
- **`armLBase` / `armRBase` / `elbowLBase` / `elbowRBase` は `buildPlayer()` で `activeStance()`（= 戦闘の構え）から1回だけ複製**（`06:1609-1615, 1762-1765`）。再代入箇所は他に無い（`armLBase\s*=` 検索、ヒット `06:1762` のみ）。
  - 例: 剣士 `STANCE.warrior` `shL:[-0.34,…]`, `elL:-1.82`, `shR:[0.22,…]`, `elR:-2.16`（`05:2217-2218`）= 両手で大剣を握る構え。盗賊 `elL -1.35 / elR -1.00`、魔法使い `shL.x -0.62 / elL -0.90`、弓師 `shL.x -0.62`（`05:2220-2248`）。
- 休め姿勢の合成（`05:3662-3703`）: `w = relaxStopBlend * (1 - relaxCombatBlend)`。`relaxStopBlend` は **移動中 0 / 停止中 1** に追従（`stepRelaxedBlends`、`05:3664`）→ **移動中は休め姿勢が 0% になる**。
- 非戦闘中、武器は背中/腰のソケットへ収納される（`WEAPON_SOCKET` `05:2434-2476`、杖は収納しない）。つまり**非戦闘の移動中は、手に何も持たないまま戦闘の構えの腕で走っている**。

### 5. 戦闘モーションとの関係（FACT）

- フレーム順: `updateLocomotion`（歩行を書く）→ `applyCombatPose(dt, moving)`（`13:1344`）→ `updateLookRig` → `applyPoseShift` → `updateGrip` → `updateBowDraw`。
- `applyCombatPose`（`05:3493-3577`）の分岐:
  - `state.swinging` → CLIPS をサンプルして `applyPose()`（歩行の値を完全上書き）
  - `ultAiming` / `skillCharging` → hold クリップ
  - `combatStanceT > 0` → `applyCombatIdlePose()`（歩行姿勢→構えへ w でブレンド）+ `applyRelaxedIdlePose()`
  - それ以外 → `applyRelaxedIdlePose()` のみ
- CLIPS の最初と最後のキーフレームは `STANCE`（`05:2201-2203` のコメント、`S = k => STANCE[k]` `05:2528`）。
- **結論（FACT）**: 歩行と戦闘モーションは**関数としては分離**しているが、(a) 同じピボットへ書く、(b) 歩行の腕の基準姿勢が戦闘の構え `STANCE` と**同じ値（armLBase）を共有**している。歩行の腕基準を変えても `STANCE`・`CLIPS` 本体は触らずに済むが、`applyCombatIdlePose` は「今フレームの歩行姿勢」を補間の起点にする（`05:3601-3610`）ため、戦闘態勢中の移動の見え方は歩行側の変更の影響を受ける。

### 6. 武器・判定・エフェクト位置（FACT）

- 武器位置は `updateGrip()` が毎フレーム**手のワールド座標**から再計算（`06:1622-1641` 初期化、WEAPON_SOCKET コメント `05:2403-2410`）。腕の長さ・肩位置が変われば武器の位置も自動的に追従する。
- 収納ソケットは `node:'torso'|'waist'` のワールド座標 + **腰ローカルの直値オフセット**（例 剣士 `off:[0.14,-0.42,-0.26]`、`05:2442`）。
- 近接の当たり判定 `core/melee-hit.js` は「プレイヤー中心→敵原点の距離・角度・敵半径」だけで計算し、**メッシュ・武器位置を参照しない**（`melee-hit.js:1-40`）。
- 弾の発射位置 `projectileOrigin()`（`11-combat-actions.js:980`）: 弓師は `P.weapon`、魔法使いは `P.weaponTip` のワールド座標。収納中・その他は `state.pos + 1.1`（直値）。
- `07/10/11` 番パーツに `state.pos.y + 1.x` 形式などの高さ直値が 16 箇所（`grep -nE "state\.pos\.y *\+ *[0-9]|\.y \+= *1\.[0-9]|y *\+ *1\.[0-9]"`）。個別の中身は未精査（Unknowns 参照）。
- 刀剣の軌跡 `updateBladeTrail` は `weaponTip` を基準（`13:1351`、`05` の `tip` 値）。

### 7. マテリアル・質感（FACT）

- `renderer.toneMapping = ACESFilmic`、exposure 0.78（`02-world-common.js:55, 65`）。
- プレイヤーの基本マテリアルは全て `MeshStandardMaterial` を `buildPlayer()` 内で new（`06:519-546`）:
  - skin `roughness 0.8`、cloth（革テクスチャ + bump）`roughness 0.6, metalness 0.15`、trim（金属テクスチャ + bump）`roughness 0.4, metalness 0.3, emissive 0.12`、boot `0.6 / 0.2`
  - 胴・骨盤・肩当て等は `clothMatFlat` / `trimMatFlat`（`.clone()` + `flatShading`）
- 職別装飾で `buildPlayer()` 範囲内に 25 個、`applyJobPromotionVisual()` 範囲に 18 個の `new THREE.Mesh*Material`（`awk` による行範囲カウント）。
- 過去の質感調整の前例: 「Player Material Calibration Phase A」で剣士兜のみ `warriorHelmMat`（`0.55 / 0.12`）に分離（`06:1075-1095`）。**`metalMat` を直接変えると盗賊の投げナイフへ波及するため分離した**と明記。
- `MeshToonMaterial` / `gradientMap` の使用は **0 件**。トゥーン的表現は (a) アウトライン（反転ハル、`05:1975-2030`）と (b) ドットモードの posterize（`05:5-30`、設定で ON のときだけ）。
- アウトライン ShaderMaterial は `outlineMats()` で**全キャラクター共有**（`05:1986`）。`addOutline()` 呼び出しごとに共有 uniform `uWidth` を書き換える（`05:2017-2018`）。

### 8. 上位職（FACT）

- `applyJobPromotionVisual()`（`06:1926`）: 武器を `scale 1.32`（`:1973-1974`）、戦騎士は `headLookPivot.scale = 0.86`（`:2004`、頭身を詰める目的、`ARPG_INTEGRATION.md:407`）。
- 装飾座標は `bodyH`・`B.headGap`・`B.headR`・`B.thighLen` 等の BUILD 由来値と直値の混在（例 `cape.position.set(s*0.30, bodyH*0.95 - 1.0, -bodyR-0.02)` `06:2207`、`bigCone.position.set(0, bodyH*1.42, …)` `06:2507`）。
- 休め姿勢の職上書き `JOB_RELAXED_STANCE`（`05:2383-2397`）、構えの `JOB_POSTURE_BIAS`（`core/combat-stance.js:211`）あり。

### 9. 支援AI・その他の人型（FACT）

- 浮遊使い魔 `buildCompanion()`：Icosahedron（`08:930`）。
- ゲスト仲間 `buildGuestCompanion()`：円柱(1.1)+球(0.32)+棒の固定寸法、`MeshStandardMaterial` を個別生成、**歩行アニメ無し**（位置と `rotation.y` のみ更新、`08:1020-1120`）。
- 幻影デコイ：Cone+Sphere 固定寸法（`11:1432-1445`）。「大きさはプレイヤーの見た目に寄せる」コメントあり。
- 敵 `buildEnemy()`：球ベース、`makeCharacter*`/`BUILD` 不使用（`06:4083`）。ボス `buildBoss()`：`limbGeo(LIMB_PROFILE/TORSO_PROFILE/HEAD_PROFILE…)` を使用（`06:4506-4930`）。

### 10. 既存テスト（FACT）

- 体格・歩行の数値を検証するテストは無い（上表の検索結果）。
- `tests/weapon-stow.spec.js`: 8職で収納→抜刀→納刀、切っ先の高さ `0.15 < tipY < 3.6`（収納時）、`tipY > -0.2`（抜刀時）、カメラ距離。デバッグ Motion Panel のテキストを正規表現で読む方式（`:60-78`）。
- `tests/character-motion.spec.js`: Motion Preview の表示、Visual Freeze（画素比較で「凍結中は絵が不変」）、Combat Idle プロファイル、状態遷移 EXPLORATION→COMBAT→ATTACK→DODGE→POST_COMBAT→SHEATHING。スクリーンショットは保存のみ（`:74`）。
- `tests/battle-knight-visual.spec.js`: 戦騎士の起動・歩行・攻撃でコンソールエラーが無いこと＋スクリーンショット保存。
- Unit: `relaxed-idle.test.js`, `combat-stance.test.js`, `posture-recovery.test.js`, `mage-lord-idle.test.js`, `look-rig.test.js`, `lowpoly-primitives.test.js`, `motion-preview.test.js`。
- 攻撃系 E2E（`base-class-identity.spec.js`, `base-class-comparison.spec.js` ほか）は命中・ダメージ・弾生成を見る。弾の発射位置が変わっても命中するかはここで間接的に検出される。

## Expected Behavior

- 出典: Task（本依頼文）のみ。`docs/` / `.ai/decisions/` に頭身・質感・歩行様式の仕様は**無い**（Existing System Search 参照）。
- 目標値（何頭身か、歩行の速度感、トゥーンの定義）は未定 → Unknowns の DECISION。

## Differences

| # | 期待 | 現状（FACT） |
| --- | --- | --- |
| 1 | 自然な頭身 | 約 3.4 頭身（過去の意図的なチビ化の結果） |
| 2 | 整理された部位比率 | 腕長が BUILD 外の直値（男女共通 0.32/0.30）。手を下ろすと手首がベルト線より上（male 手中心 Y≈1.18 > hipY 1.10）。骨盤 Y が直値 0.80 で BUILD と連動しない |
| 3 | 自然な関節接続 | 関節は球で隠す方式。骨盤と胴体の間に隙間の区間、骨盤は waist 外で歩行時に胴と別に動く。顎が胴体上端より下で首が埋没 |
| 4 | 非戦闘は自然歩行 | 移動中は休め姿勢 0%、腕の基準は戦闘の構え。ケイデンス約 4.3 歩/秒・run 係数 0.76〜1.0 でスプリント寄り |
| 5 | トゥーン調・マット寄り | 標準 PBR（MeshStandard）。金属・光沢系の値が部位ごとにばらつく。トゥーン系マテリアルは無し |
| 6 | 既存システム維持 | 維持可能（Reusable Systems 参照） |

## Root Cause

### 頭身が低い
- **FACT**: `BUILD.headR`（0.3705/0.3515）が身長に対して大きい。コメントに「headR sets the heads-tall ratio. Stature is fixed by the camera and the collision radius, so this is the only lever on it」（`05:1908-1910`）。
- **FACT**: この値はユーザー提示の参考画像に合わせて引き上げたもの（`05:1911-1914`）。以降の Head/Hair/Headwear の調整フェーズ（`HEAD_DEPTH_MUL`、`WARRIOR_HELM_*`、Coverage 関数群）は **この頭サイズを前提に** 繰り返し調整されている（`05:796-935` のコメント群）。
- **INFERENCE**: 髪・被り物は headR 比に追従する設計なので頭を縮めても大半は追従する。ただし直値オフセット（例 `crest.position.set(0, hY+0.28, …)` `06:1146`、`hY+0.02` のアイ位置）が残っており、縮小時に再調整が必要な箇所が出る（根拠: `buildPlayer` 範囲の `position.set/y=` 69 件中、BUILD/headR 系の変数を含まない直値行が 29 件）。

### 関節が不自然
- **FACT**: 骨盤 Y の直値 0.80 と股関節ピボット 1.13・胴体下端 1.10 の食い違い（Current Behavior 3）。
- **FACT**: 骨盤が root 直下、胴体が waist 配下で、歩行中の waist の回転・横移動に骨盤が追従しない。
- **FACT**: 肘・膝は独立した球、肩は Pauldron で覆う方式。上腕・前腕の断面端（elbow widthMul 0.82 / upperForearm 1.00）と球の半径（forearm×1.06）が別パラメータ。
- **INFERENCE**: 「関節が不自然」の主因は上記の (a) 骨盤の位置ずれと非追従、(b) 腕が短く胴体に対して肩位置が外に出ている比率、(c) 関節球が断面より大きく「玉が挟まった」見え方、の組み合わせと推測する。視覚的な確認（スクリーンショット比較）は今回行っていない。

### 歩行が走り気味・腕を上げたジョギング
- **FACT（直接原因）**: 移動中の腕の基準姿勢 `armLBase` 等が戦闘の構え `STANCE` のコピーで、移動中は `STANCE_RELAXED` の重みが 0 になる（`05:3662-3683`）。武器は収納済みなので「空手で構えのまま腕を振る」絵になる。
- **FACT（走り気味）**: `strideT` の進み（2.7 rad/m）と `swing`/`run`/`bob` の式が、全職の通常速度で run 0.76〜1.0 になる。歩行と走行を区別するパラメータ・状態は無い。
- **FACT**: 腕振り係数は `STANCE.*.armSwing`（戦闘の構え側の値。剣士 0.22 / 盗賊 0.62 / 魔法使い 0.85 / 弓師 0.65）を移動時にも使っている（`06:1751`、`13:1209`）。

### 質感
- **FACT**: 質感は部位ごとに roughness/metalness/emissive/bump が個別指定。トゥーン系のシェーディングは存在しない。
- **INFERENCE**: 「マット寄り」は roughness 上げ・metalness 下げ・emissive/bump 抑制のパラメータ調整で到達できる範囲。「トゥーン調」を陰影の段階化まで求めるなら、新しいマテリアル種別の導入が必要。

## Reusable Systems

| 目的 | 再利用する既存システム | 拡張の形（提案。実装しない） |
| --- | --- | --- |
| 頭身 | `BUILD.headR/hairR/headGap/height/hipY/thighLen/calfLen` | 値の変更。身長をカメラ・衝突に合わせて維持するなら headR 縮小＋脚/胴の再配分 |
| 頭の縮小（代替手段） | `headLookPivot.scale`（戦騎士で使用中） | 全職共通のスケールとして使う案。ただし戦騎士の 0.86 と二重になる点に注意 |
| 部位比率 | `makeCharacter*()` + `*_SECTION_RATIOS` | 引数（width/height）と比率表の調整。関数の新設は不要 |
| 腕の長さ | `makeCharacterUpperArm/Forearm` の `height` 引数 | 直値 0.32/0.30 と配置値（-0.16, -0.32, -0.15, 手 -0.32, 指/親指/vambrace）を BUILD 由来へ（`BUILD.upperLen/foreLen` のような項目追加） |
| 骨盤の接続 | `makeCharacterPelvis` / waist 付け替えループ（`06:1682-1686`） | 骨盤 Y を HIP_Y 由来へ。waist 追従の要否は DECISION |
| 関節の見え方 | 膝/肘キャップ球、Pauldron、Loft 断面比率 | 球の半径・スケールと断面端の太さを揃える |
| 非戦闘歩行の腕 | `STANCE_RELAXED` / `JOB_RELAXED_STANCE` / `activeRelaxedStance()` / `deriveRelaxedStance()` | 移動中の腕振りの基準を「非戦闘なら休め姿勢、戦闘態勢なら構え」へ `relaxCombatBlend` で補間。既存の係数 `relaxCombatBlend` がそのまま使える |
| 歩行の速度感 | `updateLocomotion` の係数、`BUILD.strideAmp/armSwing/bobAmp/kneeLift/hipSway` | ケイデンス（2.7）・swing/run の式・bob の係数を非戦闘時だけ歩行寄りに。全て既存式の係数 |
| 質感 | `buildPlayer()` 内の material 生成（プレイヤー専用インスタンス）、`applyBump` の scale 引数 | roughness/metalness/emissive/bumpScale の調整。共通の「プレイヤー用マテリアル値の表」にまとめる形が既存の BUILD と同じ作法 |
| 検証 | Motion Panel（`14-hud-boot.js:953-1073`）+ `readPanel` 方式、`character-motion.spec.js` のショット関数 | 歩行状態・腕の角度・頭身を Panel に出して E2E で読む（Panel は `core/motion-preview.js` の `motionDebugLines` が整形、unit test あり） |

**Lathe / Loft の再利用可否（FACT + INFERENCE）**:
- Loft（`makeLoft` と `makeCharacter*`）は既に全身の本体部位で使われており、そのまま再利用できる（FACT）。
- `limbGeo`（Lathe）はプレイヤーでは防具のカフ/肩当てのみ。`LIMB_PROFILE`・`TORSO_PROFILE`・`HEAD_PROFILE` は `buildBoss()` が使っているので、**これらの表を書き換えるとボスへ波及する**（FACT）。プレイヤー比率の変更は `*_SECTION_RATIOS` と BUILD で完結させるべき（INFERENCE）。

## Risks

| # | リスク | 根拠 | 影響範囲 |
| --- | --- | --- | --- |
| R-1 | 頭の縮小で髪・被り物・目・職別装飾の直値位置がずれる | 直値 29 行（buildPlayer）、上位職装飾も bodyH/直値混在 | 8職 + 上位職4種の頭部 |
| R-2 | 戦騎士の頭ピボット 0.86 が全体の頭縮小と二重に効く | `06:2004`, `ARPG_INTEGRATION.md:407` | 戦騎士 |
| R-3 | 腕の長さ・肩位置の変更で武器の握り位置・構えの見た目・弓の弦・杖先が動く | `updateGrip`、`GRIP_OFFSET`、`STANCE.*.wep`、`updateBowDraw` | 全職の戦闘見た目。判定は不変 |
| R-4 | 魔法使い・弓師の弾の発射位置が変わる | `projectileOrigin()` が weapon/weaponTip のワールド座標 | 命中率（低い敵・近接距離で空振りの可能性）、`base-class-identity` / `base-class-comparison` E2E |
| R-5 | 収納ソケットの直値オフセットが新しい胴体寸法と合わない（背中に埋まる/浮く） | `WEAPON_SOCKET.*.off` は腰ローカル直値 | 剣士/戦騎士/盗賊/バーサーカー/弓師/鷹の目。`weapon-stow.spec.js` の tipY 範囲 |
| R-6 | 身長を変えるとカメラ・注視点・視線・エフェクトの高さ直値とずれる | `13:1434`（+0.9, 1.5）、`13:2275`（+1.6）、`07/10/11` の高さ直値 16 件、デコイ固定寸法 | カメラ、VFX、デコイ |
| R-7 | 移動中の腕を休め姿勢基準にすると、戦闘態勢中の移動（Combat Idle の起点が歩行姿勢）の見え方も変わる | `05:3601-3610` | 戦闘中移動の見え方。`STANCE`/`CLIPS` 本体は不変 |
| R-8 | 共有アウトライン（`outlineMats`）の変更は敵・ボスへ波及 | `05:1986`, 呼び出し `06:1782, 4239, 4947` | 全キャラクター |
| R-9 | `LIMB_PROFILE/TORSO_PROFILE/HEAD_PROFILE` の変更はボスへ波及 | `06:4506-4930` | ボス |
| R-10 | 共有マテリアル（例 `metalMat`）の直接変更は別装備へ波及 | `06:1082-1085` の前例コメント | 盗賊の投げナイフ等 |
| R-11 | 過去の Head/Helm 調整フェーズの前提（頭のサイズ）が崩れ、兜の Face Opening・Coverage の再調整が必要 | `05:796-935` | 剣士兜、盗賊フード/マスク、弓師帽子、魔法使い帽子 |
| R-12 | 視覚回帰を自動検出できない | スクリーンショット比較テスト 0 件 | 全体（人手の目視確認が必要） |

**マテリアル変更が敵へ波及するか（FACT）**: プレイヤーの skin/cloth/trim/boot・職別装飾の Material は `buildPlayer()`/`applyJobPromotionVisual()` 内で個別生成しており、敵とは共有していない。波及経路は (a) `outlineMats()`、(b) `textures.js` のテクスチャキャッシュ（同一キーのテクスチャ画像を共有。Material の値ではない）、(c) ボスが使う Lathe プロファイル表、の3点に限られる。

## Unknowns

### DECISION（人間が決める事項）

| ID | 論点 | 選択肢と影響 |
| --- | --- | --- |
| D-1 | 目標の頭身 | (a) 約 4.5〜5 頭身（チビ化以前の headR 0.29 相当付近）: 既存の Head/Helm 調整の前提から離れる幅が小さい / (b) 約 6〜6.5 頭身: 自然寄りだが、見下ろしカメラでの顔・目の視認性が下がり（目は headR 比）、R-1/R-11 の再調整量が増える / (c) 7 頭身以上: 本格的なリアル比率。顔パーツの再設計が必要になる可能性。**過去にユーザーが参考画像で 3.5 頭身を指示した経緯があるため、方針転換の確認が必要** |
| D-2 | 身長（頭頂の高さ）を維持するか | (a) 維持（約 2.5）: カメラ・衝突・VFX 直値（R-6）の影響が小さい。頭を縮めて脚・胴を伸ばす / (b) 変更: R-6 の全箇所の確認が必要 |
| D-3 | 歩行と走行を分けるか | (a) 非戦闘は常に歩行の動き（速度はそのまま、アニメだけ歩行寄り）: 足の滑りが見える可能性 / (b) 非戦闘の移動速度も下げる: ゲームプレイ速度・シナリオタイマー等へ影響（本Taskの範囲外の可能性）/ (c) 入力の倒し量で歩行⇔走行をブレンド: 既存の `inputMag` を使える |
| D-4 | 「トゥーン調」の定義 | (a) マット化（roughness↑ metalness↓ emissive/bump↓）＋既存アウトラインの常時化: 既存拡張のみ（A）/ (b) 陰影段階化（`MeshToonMaterial` や gradientMap、または `onBeforeCompile`）: 新しいマテリアル経路（B 相当）。ドットモードの posterize と二重になる点の扱いも要決定 |
| D-5 | 適用範囲 | プレイヤー（8職＋上位職）のみか、ゲスト仲間・デコイも「統一」に含めるか。ゲスト仲間は現状 `buildPlayer` 非使用の簡易図形で、`buildPlayer` は2回呼ぶと `playerMixerParts` を壊す（`11:1428-1430`）ため、仲間に同じ人体を使うなら別途構造の検討が必要（その場合は B/C 寄り） |
| D-6 | 骨盤を waist に追従させるか | (a) 追従: 骨盤と胴の分離は解消するが、腰の twist が脚の付け根にも乗る / (b) root のまま位置だけ補正 |
| D-7 | 男女差の扱い | 腕長を BUILD 化する際、男女で差を付けるか（現状は同一） |
| D-8 | 戦騎士の頭ピボット 0.86 の扱い | 全体を自然頭身にした後も残すか、全体値に吸収するか |

### 調査で確認できなかった事項

- 実機での見え方（スクリーンショット比較・目視）は未実施。関節の不自然さの主因（Root Cause の INFERENCE）は視覚で未検証。
- `07/10/11` 番パーツの高さ直値 16 件が、プレイヤーの体格に依存する用途か（VFX の高さ・敵側の値など）は個別に確認していない。
- `WEAPON_SOCKET` コメントの「頭頂(約2.9m)」（`05:2435-2437`）と、本調査の算出値 約 2.54（髪・被り物を除く）の差の出所（被り物込みの値か、古い値か）は未確認。
- 盗賊・魔法使い・弓師の職別装飾（フード、マスク、帽子、ポニーテール、矢筒など）の個々の直値が、頭縮小時にどの程度ずれるかは未算出。
- 女性体型（female）の各職で装飾の見た目がどうなっているかは個別に確認していない。

## Recommended Next Step

1. 人間が D-1〜D-5 を決める（最低限 D-1 頭身・D-3 歩行方針・D-4 トゥーンの定義）。
2. Planner は下記の単位で Work Item に分けることを推奨（提案。実装しない）:
   - T-1 非戦闘歩行（`updateLocomotion` の腕の基準を休め姿勢へ補間、ケイデンス/振幅の非戦闘係数）: 体格変更と独立して効果が出る。リスク最小
   - T-2 体格パラメータ（BUILD の頭身・脚胴比、腕長の BUILD 化、骨盤 Y の HIP_Y 由来化）
   - T-3 関節の接続（キャップ球と断面の整合、骨盤の追従）
   - T-4 頭部周り（髪・被り物・目・職別/上位職装飾の直値の再調整、戦騎士 0.86）
   - T-5 質感（プレイヤー用マテリアル値の統一。共有アウトラインは変えない）
   - T-6 検証（Motion Panel に歩行/体格の読み出し追加、E2E 追加、8職×男女のスクリーンショット目視）
3. どの Work Item でも `STANCE` / `STANCE_ALT` / `CLIPS` / `core/melee-hit.js` / `LIMB_PROFILE・TORSO_PROFILE・HEAD_PROFILE` / `outlineMats()` は Files Not To Change 候補。

## 判定

**A: 既存システムの拡張で対応可能**

根拠:
1. 体格は `BUILD` 1テーブルと `makeCharacter*()`＋比率表で完結しており、使っているのは `buildPlayer()` だけ。ボス・敵・支援AIとは生成経路が分かれている（FACT）。新しい生成システムは不要。
2. 歩行の問題の直接原因は「移動中の腕の基準が戦闘の構え」であり、それを解消する部品（`STANCE_RELAXED`、`activeRelaxedStance()`、`relaxCombatBlend`、`blendPose()`）が全て既にある（FACT）。`STANCE`・`CLIPS`・攻撃判定を変えずに済む。
3. 武器位置は手の座標から毎フレーム導出されるので体格変更に自動追従し、近接判定はメッシュ非依存（FACT）。影響は弾の発射位置と収納ソケット直値の再調整にとどまる。
4. プレイヤーのマテリアルは個別インスタンスで、マット化は値の調整で済む（FACT）。敵への波及経路は共有アウトライン・ボスの Lathe 表だけで、触らなければ波及しない。
5. 作業量として大きいのは頭部周り・職別装飾の直値の再調整（R-1/R-11）だが、これは既存コードの調整であり構造変更ではない。

判定が変わる条件:
- D-4 で「陰影の段階化（セルシェーディング）」を選ぶ場合、その部分は新しいマテリアル経路になるため **B（一部新規）**。
- D-5 でゲスト仲間にもプレイヤーと同じ人体・歩行を持たせる場合、`buildPlayer()` がシングルトン（`playerMixerParts`）前提のため、リグのインスタンス化が必要になり **B〜C**。
