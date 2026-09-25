# CHARACTER-VIS-001 Analysis — T-7（仮）サポートキャラ存在時のプレイヤーの向き

## Task
- 報告された問題: サポートキャラ（支援AI）がいると、プレイヤーキャラが常にサポートキャラの方を向いてしまい、姿勢が不自然になる
- 位置付け: CHARACTER-VIS-001 の新規 Work Item として独立に解析する（Human 指示）。**Work Item ID `T-7` は仮**。Work Item の追加と ID は Planner の提案と Human の判断で決まる（AGENTS.md §7.2）。別 Task にする場合は report の名前を付け直す（DECISION DEC-T7-4）
- T-2 とは混ぜない。T-6（支援AIの見た目の寄せ、取り下げ済み）とも別物: 本件は支援AIのモデルではなく、**プレイヤー側の向き制御**の問題
- 調査基準: `claude/character-vis-001-t1-impl` @ `84c52e5c65e4c3a82c1fd682ebd588bae6282cbf`。対象の関数（`findLookTarget` / `updateLookRig`、`13-update-loop.js`）は T-1 で変わっていない（T-1 の差分は `updateLocomotion()` のみ）
- Analyzer はゲームコードを変更していない

## Summary
- **原因（FACT）**: Look Rig の注視先を決める `findLookTarget()`（`13-update-loop.js:1410-1427`）が、戦闘態勢でないとき、**7 m 以内に仲間（`companion` または `guestCompanion`）がいれば常にその位置を注視先にする**。ゲスト仲間はプレイヤーの**斜め後ろ 2.4 m** に追従する（`08-loot-equipment.js:1051-1056`）ので、非戦闘中はほぼ常に条件を満たし、かつ注視方向は背後側になる
- その結果、`distributeLook()`（`core/look-rig.js:112-`）が体幹・頭・目の可動域を**上限まで**使い続ける。剣士で約 148° 後方を見る場合: 体幹 8.8°・頭 38°・目 10°（すべて上限）+ 見下ろし約 14°。これが「常にサポートキャラの方を向いた不自然な姿勢」の正体
- **体の向き（`player.rotation.y` / `state.facing`）は仲間に向いていない**（FACT）。回っているのは腰（waist）・頭・目のピボット
- 最小修正は既存の `findLookTarget()` の仲間の条件を絞ること（新しい仕組みは不要）。案は下記 DECISION

## Existing System Search
| 検索語 | 範囲 | 結果 |
| --- | --- | --- |
| `guestCompanion\|companion` | `src/legacy/parts/13-update-loop.js` | 参照は `findLookTarget()` の `:1424` の1箇所のみ |
| `state.facing *=` / `visualFacing *=` | `src/legacy/parts/*.js` | 仲間を参照する代入は無い。代入元は入力（`13:594-599`）、ソフトロック（`13:617`）、スキル・カットシーン・シナリオ演出（`02:1386,1974`、`03`、`11`、`14`）。いずれも仲間の位置を使わない |
| `lookAt\|LOOK_` | `13` | `LOOK_TARGET_RANGE = 22`、`LOOK_COMPANION_RANGE = 7`（`:1404-1405`） |
| `distributeLook\|waistLookYaw\|HEAD_YAW_LIMIT` | `src/core/look-rig.js` | 可動域と配分の純粋関数（unit test あり: `tests/unit/look-rig.test.js`） |
| `guestFollowPoint\|GUEST_FOLLOW` | `08-loot-equipment.js` | `GUEST_FOLLOW_DIST = 2.4`、`GUEST_FOLLOW_SIDE = 0.55`、追従点は `facing + π − 0.55` 方向（`:1051-1056`） |
| 使い魔の追従 | `08:983-986` | `facing + 0.9` の逆方向へ 1.6 m（これもプレイヤーの後方） |
| 仲間を参照するイベント・演出 | `08`（合流待ち `waitAt`、`:1063-1072`）、`12:3356`（使い魔の再生成） | プレイヤーの向きを変える処理は無い |
| 既存テスト | `tests/unit/look-rig.test.js`、`tests/guest-companion.spec.js`、`tests/character-motion.spec.js` | `findLookTarget()` の仲間の分岐を検査するテストは無い（`companion` / `LOOK_COMPANION` の検索でヒットなし） |
| 仕様 | `docs/`、ルートの `*.md`、`.ai/` | 「探索中に仲間へ視線を向ける」を定める記述は見当たらない（検索語 `LOOK_COMPANION\|仲間へ視線\|仲間を見\|ゲスト.*視線`、ヒットなし）。導入コミットは `96549ad`「Eye Rig / Visual Look Offset を実装(優先度A-7)」 |

## Current Behavior（FACT）

### 1. 注視先の決定（`13-update-loop.js:1410-1427`）
```
if (combatStanceT > 0 || swinging) → 22 m 以内で最も近い「見えている」生存敵
（敵が見つからなければ下へ落ちる）
mate = companion || guestCompanion
if (mate && 距離 < 7 m) → mate.pos
else → null（見回し scan）
```
- 仲間の条件は**距離だけ**。プレイヤーの向きに対する角度、停止/移動、見続けた時間は見ていない
- 戦闘態勢中でも、見えている敵が 22 m 以内にいなければ仲間を見る

### 2. 角度の配分（`13:1447-1490`、`core/look-rig.js:32-152`）
- `desiredYaw = atan2(仲間 − プレイヤー)`、`desiredPitch = atan2((仲間.y + 0.9) − 1.5, 水平距離)`
- 可動域: 目 ±10° / ±7°、頭 ±38° / ±20°、体幹は dead zone 24° を超えた分の 45%、上限 12.6° × 職係数（剣士 0.70 / 盗賊 0.60 / 弓師 0.80 / 魔法使い 1.00）
- 仲間を見ている間 `weight = 1`（`:1471`）。linger も scan も使われない
- 書き込み: `waist.rotation.y += waistYaw`、頭・目のピボットへ代入（`:1485-1490`）

### 3. 仲間の位置
| 仲間 | 追従点 | プレイヤーの向きから見た方向 | 高さ |
| --- | --- | --- | --- |
| ゲスト（`guestCompanion`、2部制） | 距離 2.4 m、`facing + π − 0.55`（`08:1053-1056`） | 約 148°（背後やや横） | `pos` の y = 0（group は `0 + bob`、`08:1126`） |
| 使い魔（`companion`） | 距離 1.6 m、`facing + 0.9` の逆（`08:983-986`） | 約 129°（背後やや横） | 0.75 + bob（group）。`pos.y` は 0 |

### 4. 算出（剣士、ゲスト追従点で静止）
- dYaw ≈ 148° → 体幹 = min(0.45 × (148 − 24), 12.6 × 0.70) = **8.8°（上限）**、残り 139° → 目 10°（上限）、頭 38°（上限）
- pitch = atan2(0 + 0.9 − 1.5, 2.4) ≈ **−14°** → 体幹 pitch 上限 3.5°、目 −7°（上限）、頭 −3.5°
- つまり非戦闘中は常に「腰をひねり、首を限界まで後ろへ回し、下を向いた」姿勢になる。移動中も追従点が後方にあるため同じ

### 5. 待機・移動・戦闘での違い
| 状況 | 注視先 | 結果 |
| --- | --- | --- |
| 非戦闘・待機 | 仲間（7 m 以内） | 上記の後方ひねり |
| 非戦闘・移動 | 仲間（追従で 7 m 以内に留まる） | 同上。進行方向と逆を見ながら歩く |
| 戦闘態勢・見えている敵あり | 最寄りの敵 | 正常 |
| 戦闘態勢・見えている敵なし（22 m 外 / hidden のみ） | 仲間 | 上記の後方ひねり |
| 仲間なし | scan（進行方向 ± 9°） | 正常 |

### 6. 既存の Motion Panel
- `LOOK` ブロックに `TARGET`（`enemy/ally` / `linger` / `scan`）、`WAIST` / `HEAD` / `EYES` の角度が出る（`13:1496-1503`、`core/motion-preview.js`）。**仲間と敵は同じ `enemy/ally` 表示**で区別できない

## Expected Behavior
- 非戦闘の待機・移動で、仲間がいても体幹と首が常に後ろへねじれない
- 敵を見る（戦闘態勢）挙動・視線の可動域・配分式は変えない
- 支援AIの見た目・追従位置は変えない（D-5 の「支援AIは現在の簡易モデルを維持」と整合）

## Differences
| # | 差分 |
| --- | --- |
| G-1 | 仲間が視界の外（背後）でも注視先にする（角度の条件が無い） |
| G-2 | 仲間を見続ける（時間の条件が無い。weight 1 のまま） |
| G-3 | 仲間の高さを `pos.y`（= 0）で扱い、見下ろしになる |
| G-4 | 戦闘態勢中に敵が見つからないと仲間へ落ちる |

## Root Cause
- **FACT**: `findLookTarget()` の仲間の条件が距離（7 m）だけで、ゲスト・使い魔の追従点がプレイヤーの後方（約 129〜148°）にあるため、非戦闘中は常に後方の仲間が注視先になり、`distributeLook()` が体幹・頭・目を可動域の上限まで使い続ける
- **FACT**: 見下ろしは、仲間の `pos.y`（0）+ 0.9 を目の高さ 1.5 と比べているため
- **INFERENCE**: 導入時（`96549ad`）は仲間が前方や横にいる場面を想定しており、追従点が後方である組み合わせを考慮していなかった

## 最小修正案（提案。実装しない。すべて `findLookTarget()` の中で完結）
| 案 | 内容 | メリット | デメリット |
| --- | --- | --- | --- |
| (a) 前方の扇の中の仲間だけ見る | `normalizeAngle(atan2(仲間) − visualFacing)` が閾値（例: 頭の可動域 38° + 目 10° 程度）以内のときだけ注視先にする。`normalizeAngle` は `core/look-rig.js` の既存関数 | 1条件の追加。背後の仲間を見なくなる。前や横にいるときの「仲間を見る」演出は残る | 閾値の値決めが要る |
| (b) 仲間を見るのをやめる | 仲間の分岐を削る | 最小 | 仲間を見る演出が無くなる |
| (c) (a) + 時間制限（ちらっと見る） | 既存の `lookLingerT` / `stepLookLinger` を使い、一定時間ごとにだけ見る | 自然さが上がる | 状態が増える。最小ではない |
| (d) 見下ろしの補正 | 仲間の高さを `pos.y + 0.9` ではなく頭の高さ相当で扱う | 下を向く問題を解消 | 単独では後方ひねりは直らない。(a) と併用 |
| (e) 戦闘態勢中は仲間へ落とさない | 戦闘態勢で敵が見つからないときは null（scan / linger） | G-4 の解消 | 挙動の範囲が戦闘側へ広がる |

- Analyzer としての推奨の起点（提案）: **(a)**。必要なら (d) を加える。(b) / (c) / (e) は Human 判断
- 変更範囲（提案）: `src/legacy/parts/13-update-loop.js` の `findLookTarget()` のみ。角度の判定を純粋関数にしてテストするなら `src/core/look-rig.js` に1関数（+ `tests/unit/look-rig.test.js`）。その場合は concat-plugin の import 追加も要る（T-1 の N-1 と同じ）
- 変更しない: `distributeLook()` の可動域・配分式、`updateLocomotion()`（T-1 の範囲）、支援AIの追従・見た目（`08`）、`state.facing` / `visualFacing` の制御

## DECISION（Human が決める）
| # | 論点 | 選択肢 |
| --- | --- | --- |
| DEC-T7-1 | 修正の方針 | (a) / (b) / (c) / (a)+(d) / (a)+(e) |
| DEC-T7-2 | (a) の閾値 | 例: 48°（頭 38° + 目 10°）/ 60° / 90° |
| DEC-T7-3 | 使い魔（`companion`）も同じ扱いにするか | 同じ（関数1箇所なので自然に同じ）/ ゲストだけ |
| DEC-T7-4 | Work Item の置き場所 | CHARACTER-VIS-001 の T-7 として追加 / 別 Task（例: 視線・向きの Task）。T-2〜T-5 と並行させるか（現計画は並行禁止） |
| DEC-T7-5 | Motion Panel の TARGET で仲間と敵を分けて出すか（E2E で確認するため） | 分ける（`ally` / `enemy`）/ 現状のまま |

## Reusable Systems
- `findLookTarget()` / `updateLookRig()`（`13:1404-1505`）
- `core/look-rig.js` の `normalizeAngle` / `stepLookLinger` / `scanYaw` / `distributeLook`（unit test 済み）
- Motion Panel の LOOK ブロック（`motionDebugLook`、`core/motion-preview.js`）と `character-motion.spec.js` の `panelValue` 方式
- `tests/guest-companion.spec.js`（ゲストの生成・戦闘の回帰）

## Risks
| # | リスク |
| --- | --- |
| R-T7-1 | (a) で閾値付近を仲間が行き来すると、注視先が切り替わって頭が振れる（既存の linger 0.45 秒が緩和する。INFERENCE） |
| R-T7-2 | シナリオ演出で仲間を見る絵が必要な場面があれば失われる（該当する既存の演出は検索で見つからない。FACT） |
| R-T7-3 | `13-update-loop.js` は T-1 の変更ファイル。関数は別（`updateLocomotion` と `findLookTarget`）だが、T-2 以降と同じファイルになる場合は実施順・並行の扱いを Planner が決める |
| R-T7-4 | 実機確認は T-1 と同じく Playwright の Chromium revision 不一致の環境制約あり |

## Unknowns
- 「探索中に仲間へ視線を向ける」を仕様として残したいか（Human の意図）
- 実機での見え方（本解析は実画面での確認をしていない。visual confirmation unavailable）

## Recommended Next Step
- Human がこの report を remote へ Persistence し、Artifact Handoff（Kind `analysis`）を Planner へ渡す
- Planner は H-1〜H-8 を検証し、DEC-T7-1〜5 を Human に提示して計画を作る

## 判定
**A**（既存の `findLookTarget()` の条件修正で対応可能。新規システム不要）
