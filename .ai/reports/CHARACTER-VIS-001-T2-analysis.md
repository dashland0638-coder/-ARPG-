# CHARACTER-VIS-001 Analysis — T-2 体格パラメータ（5.0 頭身）

## Task
- Task: CHARACTER-VIS-001 / Work Item **T-2**（体格パラメータ: BUILD の頭身・脚胴比、腕長の BUILD 化、骨盤 Y の HIP_Y 由来化）
- 親 Task file: `.ai/tasks/CHARACTER-VIS-001.md`（承認済み版 blob `59b180881c86e990135706bae77610868fbcaece`）。T-2 の Human Approval は記入済み（`[x]`、Persistence 空欄）
- 本 report の目的: T-1 DONE 後の再調査。承認済み T-2 方針（D-1 / D-2 / D-2' / D-7、Files To Change #3 / #4 / #5 / #9 / #10）の範囲で、5.0 頭身化の影響を FACT / INFERENCE / DECISION に分ける。**方針の変更は提案しない**
- 調査基準: `claude/character-vis-001-t1-impl` @ `84c52e5c65e4c3a82c1fd682ebd588bae6282cbf`（T-1 実装 + review）。`src/legacy/parts/06-player-enemy.js` / `05-rendering-rig.js` の BUILD・buildPlayer 部は `origin/main` `26f1b52` から T-1 で変わっていない（05 の差分は `motionRigSnapshot()` の2行のみ）ので、行番号は Task 全体 analysis と同じ
- Analyzer はゲームコードを変更していない

## Summary
- 頭身のレバーは `BUILD.headR`（と `hairR`）。**身長維持（D-2）で 5.0 頭身にすると、male は headR 0.3705 → 0.2541、胴・脚・首へ +0.1165 m の再配分が要る**（female 0.3515 → 0.2402、+0.1114 m）。
- 再配分の制約（FACT）: `hipY = thighLen + calfLen`（male 1.10 = 0.56 + 0.54、female 1.05 = 0.535 + 0.515）。ブーツは `kneeWorldY` 由来で床に合わせる式なので、脚の按分はこの等式を保てば接地は崩れない。
- 体の部位のうち **直値で残っているのは 腕長（0.32 / 0.30 とその配置 -0.16 / -0.32 / -0.15 / -0.27 / 手・指）と骨盤 Y（0.80）** の2群。胸当て・首・ベルト・肩・胴は `HIP_Y` / `bodyH` 由来で自動追従する。
- 武器・弾・近接判定は自動追従または非依存（FACT）。**頭部周りの直値（兜飾り・帽子等）と職別の腰装飾は T-2 単独ではずれる**（INFERENCE）が、承認済み計画では T-4 の範囲。
- 支援AI（ゲスト仲間・デコイ）は T-2 の対象外（D-5 / T-6 取り下げ）。`buildPlayer()` のみが BUILD を使う。

## Existing System Search
| 検索語 | 範囲 | 結果 |
| --- | --- | --- |
| `const BUILD` / `B\.(headR\|hipY\|height\|headGap\|thighLen\|calfLen)` | `src/legacy/parts/` | BUILD は `05:1903-1933` の1表。使用は `06` の `buildPlayer()` と `applyJobPromotionVisual()` 系（`06:1814, 1934-2800`） |
| `buildPlayer(` | `src/legacy/parts/` | 定義 `06:510` のみ（他はコメント）。支援AIは `buildGuestCompanion()` / `buildCompanion()` で BUILD 不使用 |
| `function makeCharacter` | `05` | Torso `:335` / Pelvis `:401` / Thigh `:446` / Calf `:497` / UpperArm `:548` / Forearm `:598` / Head `:776` / HairShell `:1788`。すべて width/depth/height 引数の Loft。**新規関数は不要**（FACT） |
| `height:0.32` / `height:0.30` | `06` | 上腕 `06:1505`、前腕 `06:1512` の直値 |
| `pelvis.position.y` | `06` | `06:648` `= 0.80`（男女共通の直値） |
| `projectileOrigin` | `11:980-1002` | 弓 `P.weapon`、杖 `P.weaponTip` のワールド座標 + 前方 0.18。収納中は `pos.y + 1.1` 直値 |
| `meleeHitTest` | `src/core/melee-hit.js:49` | 距離・半径・角度のみ（メッシュ非依存） |
| `WEAPON_SOCKET` | `05:2434-2476` | 各職の収納位置は `torso` / `waist` ノード相対の `off` |
| 職ごとの装飾 | `06:1105-1465`（基礎職）、`06:1934-2800`（上位職） | `headR` 比の式と直値が混在（Task 全体 analysis R-1 / R-2） |

## Current Behavior（FACT）

### 1. 縦方向の寸法（`05:1903-1933`、`06:510-735`）
| 部位 | 式 | male | female |
| --- | --- | --- | --- |
| ベルト線（胴下端）`HIP_Y` | `B.hipY` | 1.10 | 1.05 |
| 脚 | `thighLen + calfLen` | 0.56 + 0.54 = 1.10 | 0.535 + 0.515 = 1.05 |
| 胴 | `B.height`（胴中心 `HIP_Y + h/2`、`06:660`） | 0.80 | 0.74 |
| 襟（胴上端） | `HIP_Y + h` | 1.90 | 1.79 |
| 首 | `HIP_Y + h*0.99`、高さ `h*0.13`（`06:672-675`） | 自動追従 | 自動追従 |
| 頭の中心 | `HIP_Y + h + headGap`（`06:725`） | 2.17 | 2.05 |
| 頭頂 | 中心 + `headR` | 2.5405 | 2.4015 |
| 頭身 | 頭頂 / (2·headR) | **3.43** | **3.42** |
| 顎 − 襟 | `headGap − headR` | −0.1005（埋没） | −0.0915 |
| 髪 | `hairR = headR × 1.076`（male 1.0769 / female 1.0757） | 0.399 | 0.3781 |

### 2. 5.0 頭身・身長維持（D-1 / D-2）の算出
`headR = 頭頂 / 10`。頭頂を維持するため `hipY + height + headGap` を `頭頂 − headR` に合わせる。

| 目標 | male headR | male 再配分 | male 顎−襟（headGap 維持時） | female headR | female 再配分 | female 顎−襟 |
| --- | --- | --- | --- | --- | --- | --- |
| 5.0（第一候補） | 0.2541 | +0.1165 | +0.016 | 0.2402 | +0.1114 | +0.020 |
| 4.5（D-1 の微調整下限） | 0.2823 | +0.0882 | −0.012 | 0.2668 | +0.0847 | −0.007 |

- 算出: 5.0 では headGap を現状（0.27 / 0.26）のままにすると顎が襟の上に出る（首が見える）。4.5 では headGap 現状のままだと顎はわずかに襟の下
- 算出: 目・髪・兜の headR 比の部分は 5.0 で現状の約 68.6%（male 0.2541/0.3705）に縮む

### 3. 腕（`06:1505-1575`）
- 肩 `shoulderY = HIP_Y + h*0.90`、上腕メッシュ高さ 0.32（中心 -0.16）、肘 -0.32、前腕 0.30（中心 -0.15）、籠手 -0.27、手 -0.32、指 `-0.32 - forearm*0.55`、親指 `-0.32 - forearm*0.15`
- 手の中心の高さ（腕を下ろした場合）= `shoulderY − 0.64`: male 1.18（ベルト 1.10 より 0.08 上）、female 1.076（ベルト 1.05 より 0.026 上）
- 腕の太さ `B.upper` / `B.forearm` は既に BUILD 由来（男女別）。長さだけが男女共通の直値

### 4. 骨盤（`06:636-650`）
- `pelvisH = isFemale ? 0.30 : 0.34`、中心 Y 0.80（直値、group 直下）。Loft は中心基準（`05:401-412`、`y: -hh + h*yFrac`）
- male: 0.63〜0.97、female: 0.65〜0.95。ベルト線（1.10 / 1.05）との差 = male 0.30 / female 0.25（現状の見た目の基準）

### 5. 武器・弾・近接判定
| 項目 | FACT | T-2 の影響 |
| --- | --- | --- |
| 武器の位置 | `updateGrip()`（`13:880-`）が毎フレーム手のワールド座標から算出。両手持ち（`BOTH`）は両手の中点 | 腕長・肩位置に自動追従（コード変更不要） |
| 武器の先端 | `tipNode.position.y = st.tip`（武器ローカル、`06:1646`） | 変化なし |
| 収納位置 | `WEAPON_SOCKET` の `off` は `torso` / `waist` ノード相対（`05:2439-2471`） | 胴の中心が上がれば一緒に上がる。胴に対する相対位置は不変 |
| 弾の発射位置 | `projectileOrigin()` = 弓/杖ノードのワールド座標 + 前方 0.18（`11:993-999`） | 手の高さに追従して数 cm 動く |
| 弾の命中判定 | 水平距離 + `|dy| < 1.8`（対プレイヤー）/ `< 2.2`・`< 1.8`（対敵）（`13:1603, 1619-1621, 1637-1641`） | 数 cm の高さ変化では判定は変わらない |
| 近接判定 | `meleeHitTest()` は距離・角度のみ（`core/melee-hit.js:49`） | 影響なし |
| 収納中の発射位置 | `pos.y + 1.1` 直値（`11:991, 1001`） | 胸の高さ付近のまま（身長維持のため） |

### 6. 頭部・職別モデル
- 頭・髪・目・兜の多くは `B.headR` / `headYLocal = bodyH + B.headGap` 由来で追従（`06:705-873, 1934-2800`）
- ただし直値が残る（Task 全体 analysis R-1: 29 行）。例: 剣士の兜飾り `crest.position.set(0, hY+0.28, …)`（`06:1146`）。5.0 頭身の headR 0.254 では、頭の中心から 0.28 上は頭頂より 0.026 上になる
- 上位職: 戦騎士 `headLookPivot.scale 0.86`（`06:1990`）ほか直値（R-2）
- 腰まわりの職別装飾の直値: 盗賊のナイフ鞘 `0.72` / ナイフ `0.86` / ポーチ `0.70`（`06:1290-1297`）、魔法使いのローブ裾 `robe.position.y = 0.42`・高さ 0.62（`06:1365-1366`、裾下端 y ≈ 0.11）
- 影の旅人（`wanderer`、`kit:'warrior'`、hidden）も `buildPlayer()` を通る（`01:107`）

### 7. T-1 との関係
- T-1 は `13-update-loop.js` の `updateLocomotion()`（腕の基準の角度・係数）と Motion Panel の WALK 行。**腕の長さ・体の寸法には触れていない**（FACT: `git diff 26f1b52..8f4566c`）
- T-2 は角度を変えないので、T-1 の補間（構え ↔ 休め）はそのまま使える。腕が長くなると同じ角度で手の軌跡が大きくなる（INFERENCE）

### 8. 既存テスト
| テスト | 体格への依存 |
| --- | --- |
| `tests/unit/lowpoly-primitives.test.js` | BUILD を import せず、`BUILD.male相当` のリテラルで Loft を検査（`:249-764`）。T-2 では失敗しない（FACT） |
| `tests/weapon-stow.spec.js` | 収納中 `tipY` が 0.15〜3.6、抜刀中 > −0.2（`:121-134`）。範囲は広い |
| `tests/character-motion.spec.js` | Motion Panel の読み取り。頭身の行はまだ無い |
| `tests/battle-knight-visual.spec.js` / `base-class-*.spec.js` / `combat-test-arena.spec.js` | 構築・弾の命中の回帰 |
| 体格の数値アサーション | なし（Task 全体 analysis §10） |

## Expected Behavior（承認済み T-2 方針、Task file の Decision Record / T-2 Plan）
- 5.0 頭身（D-1。最終値は V-1 を見て Human が 4.5〜5.0 で決める）
- 頭頂 Y を維持（±2%、D-2）
- 縮んだ分を脚と胴へ按分、headGap は現状維持寄り（D-2'、比は実機で確定）
- 腕長を BUILD 化、男女共通（D-7）。手の Y がベルト線以下（AC）
- 骨盤は root 直下のまま Y だけ HIP_Y 由来（D-6 = (b)）

## Differences
| # | 差分 | 種別 |
| --- | --- | --- |
| G-1 | headR 0.3705 / 0.3515 → 5.0 頭身の値 | FACT（算出） |
| G-2 | hipY / thighLen / calfLen / height へ +0.1165 / +0.1114 の再配分が無い | FACT |
| G-3 | 腕長が直値。手がベルト線より上 | FACT |
| G-4 | 骨盤 Y が直値 0.80 で hipY が変わると置き去りになる | FACT |
| G-5 | Motion Panel に頭身・手の Y の行が無い（E-2 で読めない） | FACT |

## Root Cause
- 頭身が低いのは `BUILD.headR` を参考画像に合わせて引き上げた設計（`05:1911-1921` のコメント）（FACT）
- 腕長・骨盤 Y が BUILD の外の直値なので、BUILD を変えても追従しない（FACT）

## 5.0 頭身化で影響する箇所（FACT / INFERENCE / DECISION）

### FACT（コードから確定）
| # | 箇所 | 影響 |
| --- | --- | --- |
| F-1 | `BUILD.male/female` の `headR` / `hairR` / `hipY` / `thighLen` / `calfLen` / `height` / `headGap`（`05:1903-1933`） | 変更対象そのもの |
| F-2 | 胴・胸当て・首・ベルト・肩・脚・ブーツ（`06:576-735`） | `HIP_Y` / `bodyH` / `B.*` 由来で自動追従 |
| F-3 | 上腕・前腕・肘・籠手・手・指・親指の直値（`06:1505-1555`） | BUILD 化しないと長さが変わらない |
| F-4 | 骨盤 `pelvis.position.y = 0.80`（`06:648`） | HIP_Y 由来化しないとベルト線から離れる |
| F-5 | 武器（`updateGrip`）・弾の発射位置（`projectileOrigin`）・収納位置（`WEAPON_SOCKET`） | 手・胴のノードに自動追従。コード変更は不要 |
| F-6 | 近接判定（`melee-hit.js`）、弾の命中判定（高さ許容 1.8〜2.2 m） | 影響なし |
| F-7 | カメラ・当たり判定・`07/10/11` の高さ直値（Task 全体 analysis R-6） | 身長維持なので変更不要 |
| F-8 | 頭部周りの直値（R-1）・上位職の直値（R-2）・腰まわりの職別装飾の直値（盗賊 `0.72/0.86/0.70`、魔法使いのローブ `0.42`） | T-2 では変えない（承認済み計画では T-4） |
| F-9 | `tests/unit/lowpoly-primitives.test.js` | BUILD 非依存。失敗しない |
| F-10 | 支援AI・デコイ（`08` / `11`） | BUILD 非依存。T-2 の対象外（D-5） |

### INFERENCE（実機確認が必要）
| # | 内容 | 根拠 |
| --- | --- | --- |
| I-1 | T-2 完了から T-4 完了までの間、頭部の直値の装飾がずれて見える（例: 兜飾りが頭頂から浮く） | F-8 の算出（`hY+0.28` > headR 0.254） |
| I-2 | 脚を伸ばすと、盗賊の腰装飾（0.70〜0.86）が脚に対して相対的に高く、魔法使いのローブ裾の見え方が変わる | F-8 の直値が group 基準 |
| I-3 | 腕が長くなると、戦闘の構え（STANCE / CLIPS の角度は不変）で手・武器の軌跡が大きくなり、両手持ちの剣士・弓の引き・杖の位置の見え方が変わる | F-5 は位置を追従させるが、角度は腕長を前提に調整されている |
| I-4 | 目の実寸が約 69% になり、見下ろしで表情が読みにくくなる可能性 | F-1 の算出。Task 全体 analysis の D-1 実機確認事項 |
| I-5 | 胴を伸ばすと `WEAPON_SOCKET` の背中収納が胴に対して相対的に下がる/上がる見え方の変化（off は胴中心基準のため） | F-5 |
| I-6 | `weapon-stow.spec.js` の tipY 範囲（0.15〜3.6）は広く、身長維持なら範囲外にはならない | F-7・既存範囲 |

### DECISION（Human が決める。いずれも承認済み方針の範囲内の値決め）
| # | 論点 | 選択肢 / 算出 | 承認済み方針との関係 |
| --- | --- | --- | --- |
| DEC-T2-1 | 脚と胴の按分比（D-2'） | 例: 1:1 なら male hipY +0.058（thigh/calf を比例配分）、height +0.058。female hipY +0.056、height +0.056。脚寄り・胴寄りも可 | D-2' の「比は実機で確定」。V-1 で Human が決める |
| DEC-T2-2 | headGap | 維持（5.0 で顎−襟 +0.016 / +0.020）/ 微増 | D-2'「現状維持寄り」 |
| DEC-T2-3 | 腕長の値（男女共通） | 手の中心 ≤ ベルト線には `上腕+前腕の到達長 ≥ 0.9 × 新 height`。按分 1:1 の male では ≥ 0.772 m（現状 0.64） | D-7 / AC「手の Y がベルト線以下」。値は V-1 で確認 |
| DEC-T2-4 | 骨盤 Y の式 | 現状の見た目を保つ `HIP_Y − (male 0.30 / female 0.25)`（現 BUILD で 0.80 に一致）/ `pelvisH` 比 | D-6 = (b)「Y だけ HIP_Y 由来」 |
| DEC-T2-5 | T-2 のベースブランチ | `origin/main` に T-1 と Task file が未統合（下記）。T-1 を main へ統合してから分岐 / T-1 ブランチから分岐 | Protocol・計画に定めなし |
| DEC-T2-6 | T-2 から T-4 までの間の見た目のずれ（I-1 / I-2）を許容するか | 計画どおり T-4 で直す / 一部を T-2 へ前倒し（Files To Change の変更 = 再承認が必要） | 承認済みの実施順（T-2 → T-3 → T-4） |

## Reusable Systems
- `BUILD`（値の変更と項目追加 `upperLen` / `foreLen`、必要なら骨盤のオフセット）
- `makeCharacterUpperArm` / `makeCharacterForearm` の `height` 引数（関数本体は変更不要）
- `playerMixerParts.build` と `motionRigSnapshot()` / `motionDebugLines()`（頭身・手の Y の読み取り行、T-1 の WALK 行と同じ作法）
- `updateGrip()` / `projectileOrigin()` / `WEAPON_SOCKET`（自動追従、変更不要）

## Risks
| # | リスク |
| --- | --- |
| R-T2-1 | I-1 / I-2 の一時的な見た目のずれ（T-4 まで） |
| R-T2-2 | I-3 の構えの見え方（戦闘モーションは変えない前提のため、角度の調整は範囲外） |
| R-T2-3 | 5.0 が実機で合わない場合の 4.5〜5.0 の調整（範囲外が要るなら実装せず Human へ） |
| R-T2-4 | `origin/main` に T-1 と Task file が無い（DEC-T2-5）。main から分岐すると T-1 の実装と Task file が無い状態になる |
| R-T2-5 | 標準の Playwright 設定は Chromium revision の不一致で実行できない環境（T-1 と同じ。リポジトリ外の回避策が必要） |

## Unknowns
- 実機の見え方全般（目の視認性、女性体型、上位職4種、見下ろし視点）
- 影の旅人（wanderer）の実機確認の要否
- `WEAPON_SOCKET` コメントの「頭頂 約2.9m」の出所（Task 全体 analysis から継続）

## Recommended Next Step
- Human がこの report を remote へ Persistence し、Artifact Handoff（Kind `analysis`、Work Item `T-2`）を Planner へ渡す
- Planner は H-1〜H-8 を検証してから、T-2 の計画（`.ai/tasks/CHARACTER-VIS-001-T2.md`、または親 Task の T-2 計画の新版）を作る。承認済み T-2 の範囲を変える場合は §5.2「新版」/ §6 に従い Human Approval を取り直す
- DEC-T2-5（ベースブランチ）を先に決める

## 判定
**A**（既存システムの値変更と BUILD 項目の追加で対応可能。新規システム不要）

## 補足: origin/main の状態（FACT）
- `origin/main` = `26f1b52`。`.ai/tasks/CHARACTER-VIS-001.md`・`.ai/reports/CHARACTER-VIS-001-analysis.md`・T-1 の実装・T-1 review はいずれも main に無く、`origin/claude/character-vis-001-t1-impl`（`84c52e5`）にだけある
- T-1 は Task file 上 DONE（`84c52e5`）。Task Level は PLANNED
