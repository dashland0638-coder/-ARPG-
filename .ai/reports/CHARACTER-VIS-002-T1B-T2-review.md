# CHARACTER-VIS-002 Review: T-1 の最後の追加（口・鼻）と T-2（剣士のパイロット）

- Reviewer: 独立 Reviewer（Agent Protocol 2.0、別コンテキスト。ソース・テストは変更していない）
- Date: 2026-11-26
- 検証環境: 分離した git worktree（`5d56950`、detached）。Playwright のポートは 5273 / 4273 に変更（main tree の 5173 / 4173 は使わない）。レビュー後に worktree は削除
- 判定の対象は 2 つ。それぞれ別の判定を出す

---

## 1. T-1 の最後の追加（DEC-037 = E-3 の B 案）

### Review Target
- Branch `claude/character-vis-002-t1`（PR #148）、範囲 `3110bfe..ceaf8a0`（`a9465c8` DEC-037 / `86c9327` 口・鼻 / `ceaf8a0` 記録・比較画像・T-2 計画）
- 変更: `src/legacy/parts/06-player-enemy.js`（`softHead` ブロック +23 行）、`tests/character-visual-budget.spec.js`（4職 × 2 の上限）、`docs/CHARACTERS.md`、`.ai/decisions/DEC-037-*.md`、`.ai/tasks/CHARACTER-VIS-002.md`、`t1-compare-*.jpg`

### Checks
| # | 確認 | 結果 |
| --- | --- | --- |
| 1 | 実装の位置: `headOut` の定義直後、`if(softHead)`（`classDef.charKey !== 'wanderer'`）の中。鼻・口とも `head.add()` で頭のメッシュの子（頭と一緒に動く）| OK |
| 2 | 鼻: `ConeGeometry(headR*0.06, headR*0.10, 4)`、`skinMat`（新しい Material なし）、`rotation.x = 0.45π`（先端が前やや上）、`headOut(0.40).frontZ + headR*0.015`。底面側の半分は頭の中に埋まり、先端だけが約 headR × 0.064 出る | OK |
| 3 | 口: 18 点の微笑みの弧（下の弧 9 点 + 上の弧 9 点、反時計回り）、`makePlate(..., {thickness:0.004})`、`MeshBasicMaterial(0x6a2e2a)`、yFrac 0.27 の前面 + 0.002（板の背面が前面の位置）| OK |
| 4 | 輪郭線なし: 両方 `userData.noOutline = true`（輪郭線・X 線シェルの生成側が除外する。計測で「全体 +2 = 本体 +2」）| OK |
| 5 | 位置・大きさは `headOutlineAt(HEAD_DIMS = HEAD_SECTION_RATIOS_SOFT)` と `headR` から導出（職ごとの頭の大きさに追従）| OK |
| 6 | 試作 B（`face-design-face.jpg` 5 行目）との一致: 鼻 = 頬より下の小さな肌色の点、口 = 細い赤茶の微笑みの弧。`t1-compare-*.jpg` / `t2-compare-warrior.jpg` の顔の列でも同じ見え方 | OK |
| 7 | 三角形 +80 の算術: three r154 の `CylinderGeometry` は radiusTop = 0 でも側面の上の行の退化三角形を残す → 円錐(4) = 側面 4×1×2 = 8 + 底の蓋 4 = **12**。口 = ExtrudeGeometry（段 1・ベベルなし）: 前後の蓋 (18−2)×2 = 32 + 側面 18×2 = 36 = **68**。12 + 68 = **80** | 一致 |
| 8 | 本体 +2 / 全体 +2 / Material +1（口の MeshBasic。鼻は skinMat を共有）| 一致 |
| 9 | 予算テストの計測（`CVB_PRINT`、`5d56950` の T-2 の上で）: 魔法使い・魔導士・弓師・鷹の目・盗賊・バーサーカーは上限値どおりで PASS | PASS |
| 10 | 影の旅人: `softHead` が false のため口・鼻なし。予算テストの形のシグネチャ（加入後・加入前 立ち / 座り・影の手）と描画の量が T-0 の記録値と一致 | PASS |
| 11 | `docs/CHARACTERS.md`: 口と鼻の項（4職、輪郭線なし、眉なし、影の旅人は無し）、目の項の「眉・口は無い」→「眉は無い」| OK（下の N-2 を除く）|
| 12 | `playerMixerParts.faceParts` は代入のみで参照なし（害なし）| note |

### 「瞳孔・上まぶたを足さない」読み方の妥当性
- 設計案（`CHARACTER-VIS-002-face-design.md` §5 表）では **B = 「A + 口 + 鼻」**、A に瞳孔・上まぶたが含まれ、試作 B の画像も瞳孔・上まぶたの付いた目で撮られている。
- 一方、Human の回答（DEC-037）は B の中身を自分の言葉で列挙し（眉なし・控えめな口・小さな鼻）、そこに瞳孔・まぶたを含めず、さらに **「既存の目の設計・造形方針は維持する」** と明記している。
- 明示の文言（列挙と「既存の目を維持」）を画像より優先する読み方は妥当。DEC-037 に「Agent の読み方」として記録され、task file にも書かれている点も良い。ただし Human が見た試作 B の目とは違うため、Final Report / PR 本文で「試作 B の画像の目（瞳孔・上まぶた）は入れていない」ことを一言明示し、Human が違う意図なら訂正できるようにすること（N-1）。

### Findings
- **must-fix**: なし
- **should-fix**
  - **S-1（記録）**: T-1 のブランチ（`ceaf8a0`）の task file は T-1 を「DONE（…Reviewer PASS）」と書いているが、書いた時点では口・鼻の追加分の Reviewer 判定は出ていなかった（先回りの記録）。T-2 のブランチでは「REVIEWING」に直してある。本 Review の PASS を受けて、**PR #148 の task file の T-1 行を本 Review（このファイル）への参照付きで DONE に揃え、Status History に「Reviewer PASS（口・鼻、`ceaf8a0`）」の行を足す**こと。T-2 ブランチ側も同じ内容に揃える（両 PR の記録が食い違ったまま merge されないように）
- **note**
  - **N-1**: 上の「読み方」を Final Report / PR #148 に明示する（Human Decision の追加は不要、訂正の機会を与えるだけ）
  - **N-2（docs、既存の記述）**: `docs/CHARACTERS.md` の目の項が「白目 14・瞳 12・ハイライト 8」のまま。コード（`eyePts = {sclera:16, ...}`）と DEC-037・task file は 16。今回の範囲の変更ではないが、同じ節を触ったので 16 に直すとよい
  - **N-3**: Human の iPhone 目視確認は口・鼻の追加前（`3110bfe`）のコードが対象（task file に正直に記録済み）。口・鼻の実機の見え方は T-2 の目視承認（V-1）の機会に併せて確認してもらうのがよい

### Verdict（T-1 の最後の追加）: **PASS**
（S-1 は記録の整合で、コードの差し戻しは不要。Implementer / Orchestrator が反映する）

---

## 2. T-2（剣士のパイロット、戦騎士が継承）

### Review Target
- Branch `claude/character-vis-002-t2`、範囲 `ceaf8a0..5d56950`（`36cb665` 実装 / `5d56950` 記録・比較画像）
- 計画: `.ai/tasks/CHARACTER-VIS-002.md`「T-2 詳細計画」、結果「Implementation Result（T-2）」
- 変更: `06-player-enemy.js`（ネックゲイター・パーカーの輪・ポケットの `noOutline`・すね側パンツの最初の輪・`noVambrace`）、`tests/character-visual-budget.spec.js`（剣士・戦騎士の上限）、`t2-compare-warrior.jpg`

### Checks
| # | 確認 | 結果 |
| --- | --- | --- |
| 1 | 影の旅人の除外: ゲイター・パーカー・ポケットは `if(!isWanderer){...}` の中（`isWanderer = classDef.charKey === 'wanderer'`）。すね側パンツは `isWanderer ? [影の旅人の輪（不変）] : [剣士の輪]` の剣士側だけを変更（太腿側パンツ・ブーツの胴は不変）。籠手は `noVambrace = classDef.key === 'warrior' && classDef.charKey !== 'wanderer'`（影の旅人は classDef.key が warrior のため charKey の除外が必要 → 正しく入っている）| OK |
| 2 | 他職への波及: 変更はすべて `classDef.key==='warrior'` の分岐の中、または `noVambrace`（warrior かつ非 wanderer）だけ。魔法使い・弓師・盗賊と上位職の予算値は計測で不変 | OK |
| 3 | DEC-035 E-2 = A（種類・配色・丈を変えない）: 衣服の種類（キャップ・ゲイター・フード・パーカー・ポケット 3・パンツ・ブーツ）・Material・パーカーの丈（`parkaHemY`）・パンツの丈（`-B.calfLen*0.58`）は不変。変わるのは幅の比率（腰 1.10→1.04、腰下 1.24→1.26、裾 1.36→1.44）とゲイターの上端の高さ、籠手（全職共通の金属の輪、AD-19 で J-4 として T-2 に割当済み）の省略 | OK（造形品質・接合の範囲。ゲイターの高さと籠手の省略は見た目の変化なので V-1 の目視承認の対象として明示されている）|
| 4 | ゲイター vs 口・顎・首: 上端 hY − headR×0.74（頭の yFrac 0.13）。口の最下点は yFrac ≈ 0.247 → 上端との間に約 headR × 0.23 の余裕。上端の輪 hw 0.82 は yFrac 0.13 の頭の幅（widthMul ≈ 0.76）より広く、顎がゲイターの中に収まる（首の露出・隙間なし）。比較画像の face / faceSide 列で顎と口が見え、首の隙間なし | OK |
| 5 | 籠手の削除: `vambrace` を参照するのはこの生成箇所だけ（`applyJobPromotionVisual`・戦騎士の部品・テストに参照なし。`el.children` の添字参照もなし）。手・指・武器のソケットは別の子なので影響なし | OK |
| 6 | 戦騎士の転身: `warriorBaseDecor` / `warriorKnightHidden` に入る部品の構成は不変（ポケットは `addDecor` 経由で `warriorBaseDecor` のまま、戻り値で `noOutline` を付与）。`battle-knight-visual` PASS、比較画像の戦騎士の行でジャケット・ハーネス・強化肩の浮き / 埋もれなし | OK |
| 7 | 武器の収納・ソケット: `WEAPON_SOCKET` 等は不変。裾を広げた後も背中の剣と干渉なし（比較画像 back 列）。`weapon-stow` PASS | OK |
| 8 | 予算の算術: 籠手 = `LatheGeometry`(CUFF_PROFILE 5 点, 8 分割) = 4×8×2 = **64** 三角形、1 本につき本体 + 輪郭線 2 + X 線 1 = 4 描画 → 2 本で 本体 −2・全体 −8・三角形 −512。ポケット = 6 点 × 2 輪の Loft（側面 12 + 上下の蓋 4+4）= **20** 三角形、輪郭線 2 + X 線 1 = 3 枚 × 3 個 → 全体 −9・三角形 −180。合計 **全体 −17・三角形 −692・本体 −2**。剣士 309→292 / 15,608→14,916 / 84→82、戦騎士 345→328 / 17,184→16,492 / 93→91。Material は不変（21 / 24）| 一致 |
| 9 | 実測（`CVB_PRINT`）: 剣士 `{body:82,total:292,tris:14916,mats:21}`、戦騎士 `{body:91,total:328,tris:16492,mats:24}`（上限と完全一致）| 一致 |
| 10 | 膝の重なり（J-7）: 下の「膝の検証」| 改善。小さな残り（S-2）|
| 11 | 比較画像 `t2-compare-warrior.jpg` と主張: ゲイターが下がり顎・口が見える、袖口の籠手が消えて手が直接出る、パーカーの裾がわずかに広がる、ポケットの縁の黒線が消える、影の旅人の 2 行は同一 — いずれも画像で確認できる | OK |
| 12 | docs: `docs/CHARACTERS.md` の外見の表（剣士: ネックゲイター・膝丈パーカー（ポケット・長袖）・すね丈パンツ）は変更後も正しい。籠手・ゲイターの高さ・輪郭線の対象は docs に書かれていないので更新不要 | OK |

### 膝の検証（独自の撮影と数値）
- 分離 worktree で、組み立て直した剣士のリグに膝の角度 0.05 / 0.2 / 0.35 / 0.7 rad（股関節 −角度×0.5）を与え、膝の高さから横・斜め・正面を撮影（`ceaf8a0` と `5d56950` を同じ条件で比較）。
- **T-1（変更前）**: 0.2 rad 以上で正面の太腿側の裾とすね側の上端の間に段差と隙間が開き、裾の内側（暗い面）が見える。
- **T-2（変更後）**: 隙間はほぼ消え、0.7 rad でも境目は折り目として読める。J-7 の改善として有効。
- **残り**: すね側の最初の輪は膝のピボットより上（+thighLen×0.12 ≈ 0.073）にあるため、膝を曲げるとその前面が前へ振れる。数値（剣士: thigh 0.095・thighLen 0.607、正面は平らな辺）では膝 5°〜28° の範囲ですね側の上端の前面が太腿側の前面を最大約 13 mm 突き抜け、待機（0.05 rad）では余裕が約 0.5 mm しかない。撮影でも 0.2〜0.35 rad の正面で、太腿側の裾の少し上に細い明るい線（すね側の上端の縁）と小さな黒い点（輪郭線）が見える。拡大（膝から 1 m）でやっと見える程度で、ゲームカメラではほぼ見えないが、計画の「膝を曲げても境目が開かない（重なりで解決）」に対して「重なりの縁が前に出る」副作用が残る。
- 内側（股の側）の頂点は太腿側・すね側とも `WARRIOR_PANTS_INNER_LIMIT` に揃うため、内側の 1 本の稜線が一致する（T-1 以前からの性質で、今回はその長さが膝の上へ約 7 cm 伸びた）。内腿でほとんど見えない。

### Findings
- **must-fix**: なし
- **should-fix**
  - **S-2（膝の前面の突き抜け、J-7 の残り）**: すね側の最初の輪の前面が、膝 5°〜28° で太腿側の前面から最大約 13 mm 出る（歩行のたびに通る角度）。待機でも余裕 0.5 mm で、輪郭線が線として出る。対策の例（点・段の数は増やさない）: 最初の輪の hd を下げる（例 1.34 → 1.24 前後。`sqrt(hd² + h²) ≤ 太腿側の裾の hd` が目安）か、最初の輪を低くする（thighLen×0.12 → 0.06 前後）か、両方。Human の V-1 の目視（歩行・攻撃の拡大）で気になると言われる前に調整しておくのが望ましい。直さない場合は task file に既知の残りとして記録し、V-1 の確認項目に入れること
  - **S-3（記録）**: T-2 の Implementation Result に Test Report（実行したテスト・件数・結果）が無い。計画に挙げたテスト（`character-visual-budget`・`character-clothing`・`character-palette`・`character-weapon-visual`・`character-motion`・`weapon-stow`・`battle-knight-visual`・`base-class-*`・`job-traits`・`wanderer-renewal`・`road2-join`・`chapter1-progression`）の結果を表で残すこと。あわせて S-1 と同じく T-1 の行・Status History を本 Review に揃える
- **note**
  - **N-4**: 籠手の省略とゲイターの高さの変更は、承認済みの衣服の「種類」の変更ではなく接合・造形の範囲（J-4 は AD-19 で T-2 に割当済み）と判断する。見た目が変わるので、Human の V-1 の目視承認の項目として Final Report で明示すること（task file では明示済み）
  - **N-5**: J-9（flatShading 維持）・J-1（T-8 で全職）の判断の記録は妥当
  - **N-6（レビューの手順）**: 膝の撮影の 1 回で、worktree の Playwright 設定を一時的に退避した状態（ポート 5173 の既定設定）のまま約 12 秒の読み込み専用のテストが走った。その結果は捨て、5273 の設定に戻して撮り直した。リポジトリ・main tree のファイルは変更していない

### テスト結果（worktree `5d56950`、ポート 5273 / 4273）
| テスト | 結果 |
| --- | --- |
| `npm run build` | PASS |
| `npm run test:unit` | 2342 件: pass 2341 / fail 0 / skipped 1 |
| Playwright: `character-visual-budget`・`character-motion`・`weapon-stow`・`battle-knight-visual`・`wanderer-renewal`・`character-clothing` | **45 passed**（11.1 分）|
| 予算の実測（`CVB_PRINT`）| 剣士 82/292/14916/21、戦騎士 91/328/16492/24（上限と一致）、他 6 キャラクターは上限どおり |
| 膝の撮影（独自、`ceaf8a0` vs `5d56950`）| 隙間は改善、前面の小さな突き抜けが残る（S-2）|

### Verdict（T-2）: **PASS**
（must-fix なし。S-2 は Human の V-1 の前に調整するか、既知の残りとして記録すること。S-3 は記録の補完）
