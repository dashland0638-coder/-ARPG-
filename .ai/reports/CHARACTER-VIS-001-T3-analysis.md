# CHARACTER-VIS-001 Analysis — T-3 関節の接続

## Task
- Task ID: CHARACTER-VIS-001
- Work Item: **T-3**（Work Items 表: 「関節の接続（関節キャップ球と断面の整合、骨盤の扱い）」、APPROVED `[x]`、依存 DECISION D-6）
- Analyzer の目的: 承認済み計画の T-3 の定義・前後関係を確定し、T-1 / T-2 で確定した内容を前提に、T-3 が対象とする既存コード・再利用できる仕組み・T-4 との境界・Human が決めるべき事項を整理する。**実装仕様は確定しない**（Planner / Human の範囲）
- 調査基準: `claude/character-vis-001-t2-v3-impl` @ `bc1d0e48f5255af8c55f1be804ba9fa782a0f244`（T-2 DONE の Reviewer commit。T-2 の実装 `fa34364` を含む）。行番号はこの SHA のもの
- Analyzer はゲームコード・Task file を変更していない

## Summary
- **T-3 の定義（FACT、Task file）**: 膝・肘の関節キャップ球と断面の整合（Step 1）、肩の Pauldron のスケール（Step 2）、骨盤の waist への付け替え（Step 3、D-6 の条件付き）、プレイヤー専用の断面比率の微調整（Step 4、必要な場合のみ）。AC は「膝・肘・肩・骨盤の接続が目視 V-1 で Human が許容」
- **T-2 第3版後の状態（FACT、算出）**: 関節球・Pauldron・手は `B.calf` / `B.forearm` / `B.upper` の比で作られているため、T-2 の細身化で**比率を保ったまま縮んだ**。膝球・肘球の断面からのはみ出し量の比は T-2 前と同じ。骨盤と胴の上下の間隔（約 0.10〜0.12 m）、骨盤が waist に追従しない構造も T-2 前と同じ
- **承認済み T-3 計画は T-2 第3版より前の前提で書かれている**（「T-2 の肩位置に合わせたスケール調整」は第1版の T-2 を指す）。値・範囲の読み替えが要る（DECISION）
- **origin/main に T-2 が無い**（`origin/main` = `f3f9bd5`、T-2 は `claude/character-vis-001-t2-v3-impl` のみ）。T-3 の実装起点に関わる（DECISION）
- 新しいシステムは不要。既存の関節球・Loft 断面比率・`limbGeo` の Pauldron / Cuff・waist 付け替えループ・BUILD の拡張で扱える（判定 A）

## FACT

### 1. T-3 の定義と前後関係（`.ai/tasks/CHARACTER-VIS-001.md`）
| 項目 | 内容 |
| --- | --- |
| Work Items 表 | T-3「関節の接続（関節キャップ球と断面の整合、骨盤の扱い）」、Status APPROVED、Approval `[x]`、依存 D-6 |
| T-3 Human Approval | 範囲: Implementation Plan Step 1 / 2 / 4、Files To Change #4（プレイヤー専用の断面比率のみ）/ #5（`buildPlayer()` の関節球・Pauldron・骨盤）。Step 3 は D-6 の条件を満たした場合だけ。**T-2 が DONE になってから着手**。Persistence 空欄 |
| Implementation Plan（T-3） | Step 1 膝球・肘球の半径を断面端に揃える / Step 2 Pauldron を「T-2 の肩位置に合わせた」スケールへ / Step 3（D-6 = (a) の場合）骨盤を waist 配下へ付け替え / Step 4（必要な場合のみ）プレイヤー専用の `*_SECTION_RATIOS` の微調整（ボス用 Lathe 表には触れない） |
| D-6 | 「(b) を先に適用（骨盤は root のまま Y だけ HIP_Y 由来）。実機で分離が目立つ場合だけ (a)」。T-3 Step 3 は V-1 で Human が「分離が目立つ」と判断した場合だけ行う（AI は判断しない） |
| AC（T-3） | 膝・肘・肩・骨盤の接続が目視 V-1 で Human が許容（数値化できない部分は目視） |
| 実施順 | T-1 → T-2 → T-3 → T-4 → T-5、並行禁止。T-3 は T-2 DONE 後 |
| Test Plan（T-3 関連） | E2E 既存 `character-motion.spec.js`・`weapon-stow.spec.js`・`battle-knight-visual.spec.js`（T-1〜T-4）。目視 V-1 |
| 第3版 V-1 の関節関連項目 | V-1g「肩・上腕・前腕、太腿・ふくらはぎが細く、関節で急に太くならない（関節球・Pauldron の本格調整は T-3）」、V-1h「胴・骨盤・脚が前後に途切れず繋がる」 |
| 第3版 Risks | P-R13「細身化で関節球・Pauldron（`B.upper` / `B.forearm` 比で縮む）と断面の見え方が変わる。本格調整は T-3」 |

### 2. T-1 / T-2 で確定した前提（T-3 はこれを変えない）
| 項目 | 確定内容 | 出典 |
| --- | --- | --- |
| T-1 | 非戦闘の移動は休め姿勢基準（`locomotionArmBase` / `relaxCombatBlend`）。脚の swing・歩調 2.7・移動速度・inputMag は不変 | T-1 Review PASS |
| T-2 頭身 | 4キャラクターとも 5.0頭身（stature / 2·headR） | T-2 Review、Human Decision |
| T-2 BUILD | 4系列（warrior / mage / archer / rogue）の絶対値。値は第3版の表 | `05:1925-1966` |
| T-2 継承 | 上位職は系列の BUILD、影の旅人は剣士 | `06:531` |
| T-2 収納 | 盗賊 x ±0.172、バーサーカー x ±0.222 のみ補正。剣士 / 戦騎士の大剣、弓師 / 鷹の目の弓は未変更（目視確認事項） | T-2 Implementation Result / Review N-2 |
| T-2 V-1 Human 確認 | 5.0頭身は維持。弓師・盗賊の BUILD は T-2 で戻さない。キャラクター性の不足は T-4 | Task file「Human Decision（V-1 確認後）」 |
| T-4 引き継ぎ | 頭部・髪・被り物のキャラクター性、無機質な頭部シルエット、**弓師・盗賊の身体シルエット / メリハリ**、職業固有のシルエット強化、5.0頭身で可愛さ、頭部装飾のずれ、盗賊の腰装飾・魔法使いのローブ裾 | Task file |

### 3. 関節の現在の実装（`bc1d0e4`）
| 部位 | 実装 | 根拠 |
| --- | --- | --- |
| 階層 | root ─ legL / legR（股関節ピボット `HIP_Y + 0.03`）─ thigh / knee ─ shin・膝球・脛当て・ブーツ。root ─ pelvis（root 直下）。root ─ waist（`HIP_Y`、ベルトより上の全メッシュを後から付け替え、脚と骨盤は除外） | `06:595-630, 664-667, 1702-1710` |
| 膝 | `SphereGeometry(B.calf*0.98)`、`scale(1, 0.72, 0.92)`、trimMat | `06:614-616` |
| 肘 | `SphereGeometry(B.forearm*1.06)`、clothMat | `06:1552` |
| 手 | `SphereGeometry(B.forearm*1.12)`、`scale(1, 1.12, 0.82)` | `06:1538-1540` |
| 肩 | Pauldron `limbGeo(PAULDRON_PROFILE, B.upper*1.52*s, B.upper*2.1*s)`、盗賊は s = 0.6、y −0.02。戦騎士は転身時に非表示にして別の肩鎧へ（`applyJobPromotionVisual`） | `06:1587-1597, 2031-2032` |
| 籠手 / 脛当て | `limbGeo(CUFF_PROFILE, B.forearm*1.2, 0.11)` / `limbGeo(CUFF_PROFILE, B.calf*1.25, 0.13)`。長さ 0.11 / 0.13 は直値。盗賊は省略 | `06:1559, 622` |
| 骨盤 | `makeCharacterPelvis({width:B.hipR, depth:B.hipR, height:B.pelvisH})`、Y = `HIP_Y − B.pelvisDrop`、root 直下 | `06:664-667` |
| 断面比率 | Thigh 下端 widthMul 0.70 / Calf 上端 0.90 / UpperArm 下端 0.82 / Forearm 上端 1.00 / Forearm 下端（手首）0.68 / Torso 下端 0.62・肩 1.15 / Pelvis 上端 0.85・hip 1.10 | `05:319-324, 388-392, 429-433, 480-484, 529-533, 581-585` |
| 歩行中の waist | twist `−s·swing·0.30·shoulderRoll`、hip sway `−s·swing·0.055·hipSway`（`position.x`）。骨盤は追従しない | `13:1242, 1262-1270` |

### 4. T-2 第3版の値での算出（FACT: コードの式と BUILD の値から計算）
| 項目 | 式 | 剣士 | 魔法使い | 弓師 | 盗賊 | 参考: T-2 前 male |
| --- | --- | --- | --- | --- | --- | --- |
| 太腿下端（膝側）半幅 | thigh·0.70 | 0.067 | 0.060 | 0.062 | 0.060 | 0.092 |
| ふくらはぎ上端半幅 | calf·0.90 | 0.068 | 0.059 | 0.061 | 0.059 | 0.095 |
| 膝球の半径（x） | calf·0.98 | 0.074 | 0.065 | 0.067 | 0.065 | 0.104 |
| 膝球のはみ出し比 | 膝球 / max(両断面) | 1.09 | 1.09 | 1.09 | 1.09 | 1.09 |
| 上腕下端（肘側）半幅 | upper·0.82 | 0.057 | 0.048 | 0.049 | 0.049 | 0.080 |
| 前腕上端半幅 | forearm·1.00 | 0.058 | 0.050 | 0.052 | 0.052 | 0.083 |
| 肘球の半径 | forearm·1.06 | 0.061 | 0.053 | 0.055 | 0.055 | 0.088 |
| 手首の半幅 / 手の半径 | forearm·0.68 / ·1.12 | 0.039 / 0.065 | 0.034 / 0.056 | 0.035 / 0.058 | 0.035 / 0.058 | 0.056 / 0.093 |
| 肩ピボット x | chest + shoulderOut | 0.300 | 0.245 | 0.260 | 0.260 | 0.450 |
| 胴の肩断面の半幅 | chest·1.15 | 0.276 | 0.230 | 0.242 | 0.247 | 0.397 |
| Pauldron の半径 / 高さ | upper·1.52·s / upper·2.1·s | 0.106 / 0.147 | 0.088 / 0.122 | 0.091 / 0.126 | 0.055 / 0.076（s 0.6） | 0.149 / 0.206 |
| 肩の外幅（Pauldron 込み）/ 全高 | 2·(肩ピボット + Pauldron 半径) / stature | 0.32 | 0.28 | 0.29 | 0.26 | 0.47 |
| 骨盤の上端 | HIP_Y − pelvisDrop + pelvisH/2 | 1.080 | 1.035 | 1.065 | 1.030 | 0.970 |
| 胴の下端（ベルト線） | HIP_Y | 1.200 | 1.140 | 1.170 | 1.140 | 1.100 |
| 骨盤上端〜胴下端の間隔 | | 0.120 | 0.105 | 0.105 | 0.110 | 0.130 |
| 股関節ピボット（太腿の上端） | HIP_Y + 0.03 | 1.230 | 1.170 | 1.200 | 1.170 | 1.130 |
| 太腿上端の外縁 | stanceW + thigh·1.10 | 0.215 | 0.189 | 0.197 | 0.194 | 0.295 |
| 骨盤 hip 断面の半幅 | hipR·1.10 | 0.220 | 0.209 | 0.209 | 0.2035 | 0.2915 |
| 胴の下端の半幅 / 骨盤上端の半幅 | chest·0.62 / hipR·0.85 | 0.149 / 0.170 | 0.124 / 0.162 | 0.130 / 0.162 | 0.133 / 0.157 | 0.214 / 0.225 |
| 歩行時の hip sway 振幅（通常速度の swing 概算 0.42〜0.62） | swing·0.055·hipSway | 約 0.013〜0.019 | 約 0.031〜0.049 | 約 0.031〜0.049 | 約 0.013〜0.019 | 0.013〜0.019（male） |
| 歩行時の waist twist 振幅 | swing·0.30·shoulderRoll | 約 0.14〜0.21 rad | 約 0.10〜0.15 rad | 約 0.10〜0.15 rad | 約 0.14〜0.21 rad | 同 |

- 関節球・Pauldron・手の「断面に対する大きさの比」は T-2 前と同じ（すべて BUILD の太さ比で作られているため）
- 骨盤の上端と胴の下端の間（約 0.10〜0.12 m）は、太腿の上端（股関節ピボットが胴の下端より 0.03 上）とベルト（トーラスの太さ 0.05）が覆う位置関係
- 骨盤の hip 断面の半幅は太腿の外縁とほぼ同じ（差 0.005〜0.02）。骨盤は横からはほとんど太腿に隠れる
- 胴の下端（ベルト側）は骨盤の上端より細い（剣士 0.149 < 0.170、魔法使い 0.124 < 0.162）
- 魔法使い・弓師（旧 female の動きの係数 hipSway 1.45）は hip sway が剣士・盗賊の約 2.6 倍。この横移動に骨盤は追従しない

### 5. 既存テスト（関節関連）
| テスト | 内容 |
| --- | --- |
| `tests/unit/lowpoly-primitives.test.js` | Torso / Pelvis / Thigh / Calf / UpperArm / Forearm の `*_SECTION_RATIOS` を**テスト側に複製**して Loft の形を検査（`:212-`、`:295-`、`:375-` のコメント「比率を変えたら同期」）。膝球との段差のオーダー検査は **旧 male の直値**（`kneeCapR = 0.106*0.98`、`:444`）。05 の比率を変えても自動では失敗しないが、複製が古くなる |
| `tests/character-motion.spec.js` | Motion Panel・状態遷移・T-1 E-1・T-2 E-2（体格の比）。関節の位置の数値検査は無い |
| `tests/weapon-stow.spec.js` | 収納・抜刀の tipY / 手への収まり |
| `tests/battle-knight-visual.spec.js` | 戦騎士の構築（Pauldron を隠して肩鎧へ差し替える経路を通る） |
| スクリーンショット比較 | 無し（Task 全体 analysis R-12） |

## Existing System First 調査
| 検索語 | 範囲 | 結果 |
| --- | --- | --- |
| `SphereGeometry(B.calf` / `SphereGeometry(B.forearm` | `src/legacy/parts/06-player-enemy.js` | 膝球 `:614`、肘球 `:1552`、手 `:1538-1539` |
| `PAULDRON_PROFILE` / `limbGeo(` | `05`, `06` | 表 `05:1890`、`limbGeo` `05:242`。プレイヤーの Pauldron `06:1591`、ボス `06:4941`（**共有の表**） |
| `CUFF_PROFILE` | `05`, `06` | 籠手 `06:1559`、脛当て `06:622` |
| `_SECTION_RATIOS` | `05` | Torso / Pelvis / Thigh / Calf / UpperArm / Forearm / Head。**プレイヤー専用**（`makeCharacter*()` だけが使う。ボスは `LIMB_PROFILE` / `TORSO_PROFILE` / `HEAD_PROFILE`） |
| `waist.add` / 付け替え | `06:1702-1710` | ベルトより上を waist へ移すループ。除外は `legL, legR, pelvis` |
| `pelvis` | `05`, `06`, `13` | 参照は `buildPlayer()` の生成と配置だけ。`13` に骨盤を動かす処理は無い |
| skinning / bone / SkinnedMesh | `src/` | プレイヤーのリグは Group 階層のみ（skinning 無し）。関節の繋ぎ目は球・Pauldron・Cuff で覆う方式 |

- **新しいシステムは不要**（INFERENCE ではなく計画上の要件: 承認済み T-3 の Step 1〜4 はすべて既存の球・Pauldron・比率表・付け替えループの値 / 条件の変更）
- skinning などの新方式は Existing System First と T-3 の範囲の外（既存の Group 階層 + 覆い物の方式で扱える）

## 対象ファイル（候補。確定は Planner）
| ファイル | 対象 | 承認済み T-3 との関係 |
| --- | --- | --- |
| `src/legacy/parts/06-player-enemy.js` | `buildPlayer()` の膝球（`:614-616`）・肘球（`:1552`）・Pauldron（`:1587-1597`）・骨盤（`:664-667`）・waist 付け替え（`:1702-1710`） | Files To Change #5 |
| `src/legacy/parts/05-rendering-rig.js` | プレイヤー専用の `*_SECTION_RATIOS`（Step 4、必要な場合のみ） | Files To Change #4 |
| `tests/unit/lowpoly-primitives.test.js` | 比率の複製・膝球の直値（Step 4 を行う場合） | **承認済み T-3 の Files To Change に無い**（DECISION） |
| `src/core/motion-preview.js` / `tests/*` | 関節の位置を Panel で読む場合 | 承認済み T-3 に無い（DECISION） |

## 現在の実装から見た T-3 の変更候補（Planner への入力。仕様は確定しない）
| # | 候補 | 根拠（FACT） | 補足（INFERENCE） |
| --- | --- | --- | --- |
| C-1 | 膝球・肘球の大きさを、隣り合う断面端に揃える係数へ（Step 1） | 膝球は断面の 1.09 倍、肘球は 1.06 倍（前腕上端比）。「玉が挟まった」見え方の原因候補（Task 全体 analysis Root Cause (c)） | 細身化で絶対量は小さくなったが比は同じ。細い手足では球の出っ張りが相対的に目立つ可能性。実機 V-1 で判断 |
| C-2 | Pauldron の半径・高さ（Step 2） | Pauldron 込みの肩の外幅 / 全高は 0.26〜0.32（Pauldron 無しの体の外幅は 0.25〜0.29） | 「華奢」との両立。盗賊は既に 0.6 倍 |
| C-3 | 骨盤を waist 配下へ付け替え（Step 3） | 骨盤は root 直下で、歩行中の waist の sway / twist に追従しない。魔法使い・弓師は sway が大きい | **D-6 の条件（Human が V-1 で「分離が目立つ」と判断）が未成立**。T-2 の V-1 で骨盤と胴の分離についての Human 判断は記録されていない |
| C-4 | プレイヤー専用の断面比率（Step 4） | 胴の下端（ベルト側）が骨盤の上端より細い。手首 0.68 → 手 1.12 の差 | 「必要な場合のみ」。比率を変えると `lowpoly-primitives.test.js` の複製が古くなる。**弓師・盗賊の「メリハリ」と重なる領域**（T-4 引き継ぎ）との境界が要る |
| C-5 | 籠手・脛当ての長さ 0.11 / 0.13（直値） | 腕・脚は T-2 で長く・細くなったが、長さは直値のまま | 承認済み T-3 の Step に無い。含めるかは DECISION |

## 既存システム再利用案
- 関節の覆い: 既存の膝球・肘球・Pauldron・Cuff をそのまま使い、半径・スケールの係数だけを変える
- 断面: `makeCharacter*()` と `*_SECTION_RATIOS`（プレイヤー専用）を使う。ボスが使う `LIMB_PROFILE` / `TORSO_PROFILE` / `HEAD_PROFILE` と、ボスと共有の `PAULDRON_PROFILE` の表そのものは変えない（係数は呼び出し側で）
- 骨盤の追従: 既存の waist 付け替えループの除外リストから `pelvis` を外すだけで waist 配下になる（Y は `HIP_Y` 分の補正が要る。ループが `position.y -= HIP_Y` を行う）
- 確認: T-2 で追加した Motion Panel の読み取り（`motionBodySnapshot()` / `motionDebugLines()`）と E2E の作法、V-1 用の撮影方法（向きを変えて正面・斜め45°・側面相当）

## 新規システムの要否
- 不要。上記の既存要素の係数・条件の変更で T-3 の Step 1〜4 を満たせる
- skinning・新しいリグ・新しい関節メッシュ方式は範囲外（必要と判明したら別 Task として Analyzer から）

## T-4 との境界
| 観点 | T-3 | T-4 | 境界が曖昧な点 |
| --- | --- | --- | --- |
| キャラクター形状 | 関節の繋ぎ目（膝・肘・肩・骨盤）の見え方 | 頭部・髪・被り物、職業固有のシルエット、弓師・盗賊の身体のメリハリ、可愛さ | **断面比率（C-4）と「身体のメリハリ」**。どちらで扱うか DECISION |
| モーション | 変えない（骨盤の付け替え C-3 は親の変更で、歩行の式は変えない） | 変えない | C-3 を行うと、歩行中に骨盤が waist の sway / twist で動くようになる（見え方の変化） |
| 頭部 | 触れない | 担当 | ― |
| 武器 | 触れない（Pauldron の大きさが構えの見え方に影響する可能性のみ） | ― | 背中の武器の収納位置の浮き（T-2 N-2）は T-3 / T-4 のどちらにも無い（DEC-T2-11 の範囲で別途） |
| マテリアル | 触れない（膝球は trimMat、肘球は clothMat のまま） | ― | T-5 |
| 上位職の装飾 | 基礎の Pauldron（`pauldronL/R`）まで | 戦騎士の肩鎧・バーサーカーの毛皮の肩など `applyJobPromotionVisual()` の装飾 | 戦騎士は基礎の Pauldron を隠すので T-3 の Pauldron 変更の影響を受けない |
| 支援AI | 触れない（D-5） | 触れない | ― |
| UI | 必要なら Motion Panel の読み取り行のみ | ― | 承認済み T-3 に無い |

## Risks
| # | リスク |
| --- | --- |
| R-T3-1 | 承認済み T-3 計画が T-2 第3版より前の前提（例: Step 2「T-2 の肩位置」）。第3版の細身の体に合わせた再計画が要る可能性 |
| R-T3-2 | `origin/main` に T-2 が無い。main 起点で T-3 を始めると T-2 と衝突・欠落する |
| R-T3-3 | Step 4（断面比率）を変えると `lowpoly-primitives.test.js` の複製が古くなる（自動では失敗しない）。膝球の検査も旧 male の直値 |
| R-T3-4 | Step 3（骨盤の付け替え）は歩行中の骨盤の動きを変える。戦闘ポーズ・回避（waist を直接回す）でも骨盤が一緒に回る |
| R-T3-5 | 関節の見え方は数値で判定しにくい（AC は目視）。見下ろし固定カメラで側面の水平視点が取れない |
| R-T3-6 | 断面比率・Pauldron の変更が T-4 の「メリハリ」「職業固有のシルエット」と重なる |
| R-T3-7 | 標準の Playwright 設定は Chromium revision 不一致で実行できない環境（T-1 / T-2 と同じ。リポジトリ外の回避策） |

## テスト影響
- 変更しない限り既存テストは影響を受けない
- Step 1 / 2: 関節球・Pauldron の値の変更。既存 E2E（`character-motion` / `weapon-stow` / `battle-knight-visual`）は構築の回帰として通る見込み（INFERENCE）。数値で確かめるなら Panel の読み取り行の追加が要る（DECISION）
- Step 3: waist の付け替えの変更。E2E は構築・状態遷移の回帰として通る見込み（INFERENCE）。骨盤が waist に付いたことを確かめるテストは無い
- Step 4: 05 の比率の変更で `lowpoly-primitives.test.js` の複製との乖離（R-T3-3）
- 目視 V-1: 膝・肘・肩・骨盤の接続（停止・歩行・戦闘態勢、正面・斜め45°・側面相当）

## Human Decision Required
| # | 論点 | 選択肢 |
| --- | --- | --- |
| DEC-T3-1 | T-3 の実装起点 | (a) T-2（`claude/character-vis-001-t2-v3-impl` `bc1d0e4`）を main へ統合してから、main 起点 / (b) T-2 ブランチから派生 |
| DEC-T3-2 | 承認済み T-3 計画の扱い | (a) T-2 第3版の体に合わせて Planner が T-3 を再計画し、再承認 / (b) 承認済みの Step をそのまま実装（値は実装時に V-1 で Human 確認） |
| DEC-T3-3 | D-6（骨盤を waist へ付け替えるか）の判断の材料 | Human が歩行中の骨盤と胴の分離を V-1（非戦闘の移動、魔法使い・弓師を含む）で見て判断する。そのための撮影を T-3 の最初に行うか |
| DEC-T3-4 | 断面比率（Step 4）と「身体のメリハリ」（T-4 引き継ぎ）の境界 | (a) T-3 は関節の繋ぎ目の比率（膝・肘・手首・ベルト側）だけ / (b) メリハリも T-3 で扱う（T-2 V-1 の Human Decision「T-4 で扱う」の変更になる） / (c) 断面比率は T-4 へ |
| DEC-T3-5 | Pauldron の方針 | 「華奢」を優先して小さくするか、肩の接続を覆う現在の比（upper × 1.52）を保つか。職業ごとに変えるか |
| DEC-T3-6 | テストの範囲 | Step 4 を行う場合の `lowpoly-primitives.test.js` の複製の同期（Files To Change への追加）、関節の Panel 読み取り行（Files To Change への追加）の要否 |
| DEC-T3-7 | 籠手・脛当ての長さの直値（C-5） | T-3 に含める / 含めない |

- T-2 で Human が確定した判断（5.0頭身の維持、弓師・盗賊の BUILD を戻さない、キャラクター性は T-4）は本 analysis では再判断していない。DEC-T3-4 (b) を選ぶ場合だけ、その判断の変更になる

## Unknowns
- 実機での関節の見え方（本 analysis ではスクリーンショットによる新たな確認をしていない。visual confirmation unavailable）
- 骨盤と胴の分離が歩行中に目立つか（D-6 の条件）
- T-2 の V-1 スクリーンショット（リポジトリ外）で関節がどう見えていたかの Human 所見（記録されているのはキャラクター性・棒状の所見のみ）

## Recommended Next Step（Planner への引き継ぎ。仕様の確定ではない）
1. Human が本 report を remote へ Persistence し、Artifact Handoff（Kind `analysis`、`CHARACTER-VIS-001 / T-3`）を Planner へ渡す
2. DEC-T3-1（起点）と DEC-T3-2（再計画の要否）を先に決める
3. Planner は D-6 の判断材料（歩行中の骨盤と胴の V-1）を得る手順と、DEC-T3-4〜7 を含む T-3 の計画を作り、Human Approval を取る

## 判定
**A**（既存の関節球・Pauldron・Loft 断面比率・waist 付け替えループの係数 / 条件の変更で対応可能。新規システム不要）
