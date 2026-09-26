# CHARACTER-VIS-001 / T-5 Review

## 1. Review Target
| 項目 | 値 |
| --- | --- |
| Task ID | CHARACTER-VIS-001 / T-5（配色・Material・質感。再計画版） |
| Branch | `claude/character-vis-001-t5-impl` |
| Date | 2026-09-26 |
| Analysis Source | `.ai/reports/CHARACTER-VIS-001-T5-analysis.md`（blob `1654611cfcf3bc1f36a0caf250aedb1f294b6058`。Planner branch `claude/character-vis-001-t5-planner` @ `7ea0170` の blob と一致） |
| Plan Source | `.ai/reports/CHARACTER-VIS-001-T5-plan.md`（blob `c1acdb81aaf38d7c1be4511a33df60b9671a1e15`。`7ea0170` の blob と一致）+ Human Decisions HDR-T5-1〜12 / P-D0〜P-D11（Task file の「T-5 Human Approval（再計画版）」と会話） |
| Task file | `.ai/tasks/CHARACTER-VIS-001.md`（HEAD blob `ecb1d19f6d68f7e1dccff7e334e44854f43714fd`） |

## 2. Reviewed Commit
| 項目 | 値 |
| --- | --- |
| Reviewed SHA | `257e8ffbc75aba288fe41c0abc8b598dfabdf1c1`（`origin/claude/character-vis-001-t5-impl` 先端と一致） |
| Baseline | `main` `2a9674bf7269bf86d32778978d628c64fa04e412`（HEAD の祖先であることを確認） |
| Diff range | `2a9674b..257e8ff`（10 commits: `7ea0170` reports / `0e0c82a` 承認記録 / `067c1fd` 実装 / `a27ee9a` Test Report / `3decb05` 盗賊 #526A78 / `4e0ea77` 上位職・影の旅人 / `c762a4a` マフラー #A3B1BF / `2164949` 記録 / `5e29eb2` Test Report / `257e8ff` docs・REVIEWING） |
| 変更ファイル | 12 files（+1053 / −200）: reports 2、Task file、`docs/CHARACTERS.md`、`src/core/motion-preview.js`、`src/legacy/concat-plugin.js`、`src/legacy/parts/05-rendering-rig.js`、`src/legacy/parts/06-player-enemy.js`、`src/render/player-palette.js`（新規）、`tests/character-palette.spec.js`（新規）、`tests/unit/motion-preview.test.js`、`tests/unit/player-palette.test.js`（新規） |
| Independence | **同一セッションで兼務**（Implementer と同じ Claude Code セッション。Human は「Reviewer が実装者と兼任する形にしない」＝修正を行わないことを指示。本 Review では修正・commit・push を一切行わず、判定は Reviewed SHA の diff・ソース・Reviewer 自身のテスト再実行を根拠とした）。独立性の制約として R-1 に記録 |

## 3. Approved Scope
- HDR-T5-1: 職業別配色 / プレイヤー専用配色 Material の整理 / 必要最小限の Material 分離 / 共有による意図しない色波及の解消 / matte・semi-matte 化 / 上位職の Material 切り替え整理 / 影の旅人の衣服色と影 VFX 色の分離
- 変更禁止: BUILD / 5.0頭身 / Geometry / 衣服形状・配置 / シルエット / 顔 / 目 / 髪 / STANCE / CLIPS / 歩行 / 戦闘モーション / 武器形状・位置 / 影の旅人の武器システム / 敵 / ボス / 支援AI / `13-update-loop.js` / Playwright 設定 / `CLASSES.color` / `CLASSES.trim`（+ Planner report §1: `outlineMats` / `addOutline` / `textures.js` / レンダラ設定 / 肌色）
- Planner report §13 の変更予定ファイル: 必須 `player-palette.js`（新規）/ `concat-plugin.js` / `06` / unit / E2E / docs、条件付き `motion-preview.js` + test / `05`（P-D10 の PAL 行）→ **実際の変更ファイルはこの範囲内**

## 4. Human Decisions Verification
| # | 決定 | 実装（Reviewed SHA） | 判定 |
| --- | --- | --- | --- |
| P-D0 | 肌色 T-4 最終値 | `06` `SKIN_COLOR` 行は `2a9674b` から差分なし（`{ warrior:0xffe6d2, mage:0xffeee5, rogue:0xffe7d4, archer:0xe8bd98, wanderer:0xe8dce0 }`）。unit でも文字列一致を検査 | PASS |
| P-D2 | `src/render/player-palette.js` | 新規。THREE・共有変数に非依存の純粋データ + 関数。`concat-plugin.js` HEADER に import 1行 | PASS |
| P-D3 | 役割7つ + subMat / subMatFlat / layerMat | `PLAYER_ROLES = ['main','sub','accent','layer','hat','trim','boot']`。`06` で `subMat` / `subMatFlat` / `layerMat` を新設、`hatMat` は既存の帽子 Material（剣士キャップ・盗賊帽子・魔法使いキャスケット）を1つに統合（新設ではなく置き換え） | PASS |
| P-D4 | 魔導士の髪の直接書き換えは変えない | `P.hairMat.color.set(0xcac6d2)`・`archHairMat` は差分なし | PASS |
| P-D5 | 弓師 main #315C50 / sub #617A82 / accent #B99652 / trim #E6E4DD | 配色表 `archer` 一致（main は V-1 で変更指示なし） | PASS |
| P-D6 | 魔法使い帽子 #6F8CA3 | `mage.hat = 0x6f8ca3`、キャスケット（`hatMatCone` / `hatMatBrim`）= `hatMat` | PASS |
| P-D7 | 戦騎士 #9AA5B1 / 鷹の目 #E5E1D9 | `battleKnight.layer = 0x9aa5b1`、`hawkEye.layer = 0xe5e1d9`。上位職の白いレイヤーは `P.roleMats.layer` | PASS |
| P-D8 | 影の旅人: 全身黒回避、服の紫と影 VFX の紫は別 Material・別色 | 服は役割別 Material（`clothMat` 系 / `clothAcc` / `layerMat`）、影 VFX・足元リングは `CLASSES.wanderer.trim` 0x8a5ad6 を読む別オブジェクト（`11` / `13` / `06:2030` の ring）。値も別（§8） | PASS |
| P-D9 | 武器装飾 = 配色表の trim、投げナイフ 0.75 / 0.45 | 生成時の武器は role trim（`trimMat`）、`swapPlayerWeaponVisual()` は `paletteKeyFor(classDef.key, state.job, charKey)` の trim。`metalMat` = `PLAYER_FINISH.knife` {0.75, 0.45} | PASS（R-9） |
| P-D10 | Planner 案（Motion Preview の PAL 行）、Playwright 設定不変 | `motion-preview.js` PAL 行、`05` `motionBodySnapshot.pal`。`playwright.config.js` 差分なし | PASS（R-6） |
| P-D11 | V-1 3段階 | Task file に第1〜第3段階の Human OK を記録。撮影条件の制約は R-11 | PASS（記録） |
| V-1 最終指定 | 盗賊パーカー #526A78 / 影の旅人マフラー #A3B1BF | §7 のとおり palette / 実装 / unit / E2E / docs / Task file で一致 | PASS |
| HDR-T5-2 | `CLASSES` 不変 | §10 | PASS |
| HDR-T5-8 | バーサーカー独立 | `berserker` 行に `inherit` なし、全 role を独自に定義（unit で検査） | PASS |
| HDR-T5-10 | 基本 Material の直接書き換え廃止 | §9 | PASS（検証範囲は §14 AC-3） |

## 5. Implementation Verification（`06-player-enemy.js`、コードのみの差分を全行確認）
- `buildPlayer()`: 色の出どころを `paletteKeyFor(classDef.key, null, classDef.charKey)` → `resolvePalette()` に変更。`clothMat` / `trimMat` / `subMat` / `bootMat` / `clothAcc` / `hatMat` / `layerMat` を配色表・`PLAYER_FINISH` から生成し、最後に `playerMixerParts.roleMats` を公開して `applyPlayerPalette(playerMixerParts, palKey)` を呼ぶ。`basePaletteKey` を保存
- 衣服メッシュの変更は **`new THREE.Mesh(geo, <Material>)` の第2引数の差し替えのみ**（剣士・影の旅人パンツ `clothMatFlat` → `subMatFlat`、魔法使いパンツ → `subMatFlat`、弓師パンツ `clothMat` → `subMat`、弓師の袖 → `subMatFlat`、魔法使いタートルネック → `layerMat`、影の旅人のコート・フード・袖 `wandererCoatMat || clothMat` → `clothMat`、シャツ → `layerMat`）。ジオメトリ引数・position・scale・rotation・parent の差分なし
- `applyPlayerPalette(P, key)`: 全 role（main / mainFlat / sub / subFlat / accent / layer / hat / trim / trimFlat / belt / boot）へ色と質感を毎回上書き。leather / metal は `map` を再生成（`textures.js` のキャッシュ経由、`textures.js` 自体は不変）し `applyBump` を付け直す。`userData.paletteHex` に書いた値を記録
- `swapPlayerWeaponVisual()`: 武器装飾の色を配色表の trim に（`state.job` から行を決める）

## 6. Material Architecture Verification
| Role | Material | 使用部品（コードで確認） | 判定 |
| --- | --- | --- | --- |
| main | `clothMat` / `clothMatFlat` | 素体（四肢・胴・骨盤）、剣士パーカー・背中のフード・ポケット・袖、影の旅人のコート・フード・袖、魔法使いコート・袖、弓師の上着・帽子、盗賊オーバーオール、魔導士の上掛け（`archCoatMat = P.clothMat`） | PASS |
| sub | `subMat` / `subMatFlat`（新設） | 剣士・影の旅人・魔法使い・弓師のパンツ、弓師の袖 | PASS |
| accent | `clothAcc` | 剣士ゲイター / 影の旅人マフラー、盗賊パーカー（フード・胴・袖）、弓師の矢羽 | PASS |
| layer | `layerMat`（新設） | 魔法使いタートルネック、影の旅人シャツ、上位職の白いレイヤー（戦騎士ジャケット・袖、魔導士ドレス、鷹の目ベスト・ポケット、バーサーカーのフード・上着・袖） | PASS |
| hat | `hatMat` | 剣士キャップ（つば・耳含む）、盗賊の帽子、魔法使いキャスケット | PASS |
| trim | `trimMat` / `trimMatFlat` / `beltMat` | 膝球・胸当て・脛当て・ブーツのストラップ・籠手・Pauldron・ベルト・武器装飾 | PASS |
| boot | `bootMat` | ブーツ・つま先・剣士のブーツの胴 | PASS |
- **色の漏れ**: 各 role Material はその role の部品だけに割り当てられている。`skinMat` / `hairMat` / 目 / `darkMat` / 矢筒 / `archerFurMat` / ポーチ / `longHairMat` / 足元リングは role に含まれず、`applyPlayerPalette` の対象外（差分なし）。素体と main 衣服の共有は Planner report §8 で「維持」と承認済み
- 役割別 Material は `clearJobPromotionVisual()` で破棄しない（`roleMatSet` で除外）。上位職の装飾が layer / main を共有しても本体側の Material は残る

## 7. Palette Verification（9キャラクター）
配色表（`resolvePalette` の展開結果）・`docs/CHARACTERS.md` の配色表・unit の期待値・E2E（`resolvePalette` と PAL 行の一致）・Human 決定を照合した。

| キャラクター | 配色表（main / sub / accent / layer / hat / trim / boot / 追加） | docs | Human / unit | 判定 |
| --- | --- | --- | --- | --- |
| 剣士 | 263A55 / 52657A / E6E4DD / E6E4DD / 52657A / C49A4A / 2A2018 | 一致 | 配色体系・unit main | PASS |
| 戦騎士 | 剣士継承 + layer 9AA5B1、steel C8CDD2、gold C49A4A | 一致 | P-D7・unit | PASS |
| 魔法使い | 8FB9D6 / B7C7D2 / E7E8E5 / E7E8E5 / 6F8CA3 / C7A45A / 2A2018 | 一致 | P-D6・unit | PASS |
| 魔導士 | 334A72 / 514B86 / (E7E8E5) / E4E6E3 / 514B86 / C7A45A / 2A2018 | 一致 | 配色体系・unit | PASS |
| 弓師 | 315C50 / 617A82 / B99652 / E6E4DD / 315C50 / E6E4DD / 2A2018 | 一致 | P-D5・unit | PASS |
| 鷹の目 | 弓師継承 + layer E5E1D9、cape 24463E | 一致 | P-D7・unit | PASS（R-7） |
| 盗賊 | 304D45 / 304D45 / **526A78** / E6E4DD / D2A83E / 263449 / 263449 | 一致（**#526A78**） | V-1 第1段階 Human 指定・unit | PASS |
| バーサーカー | 45484D / 45484D / 8A3438 / E5E1D9 / 59483D / 59483D / 59483D（継承なし） | 一致 | HDR-T5-8・unit | PASS |
| 影の旅人 | 30323A / 403454 / **A3B1BF** / D8D4D0 / (30323A) / 654F86 / 2A2018 | 一致（**#A3B1BF**） | V-1 第2段階 Human 指定・unit | PASS |
- E2E `character-palette.spec.js` は9キャラクターすべてで PAL 行のキーと7色が `resolvePalette(key)` と一致することを検査（Reviewer 再実行で 9 / 9 PASS）

## 8. Shadow Traveler Verification
| 項目 | 確認 | 判定 |
| --- | --- | --- |
| 服と影 VFX の紫が別 Material | 服 = `clothMat` 系 / `clothAcc` / `layerMat`（`buildPlayer` 内の役割別）。影 VFX（`11-combat-actions.js` の `state.classDef.trim`）・足元リング（`06:2030` の MeshBasic、`13:815` が毎フレーム `state.classDef.trim` を書く）は別オブジェクト | PASS |
| 服が影 VFX の色変更に引きずられない | 服の色は配色表からのみ（`classDef.trim` を読まない。unit のソース検査 + diff で確認）。`13` は ring の Material だけを書く | PASS |
| 値の分離 | 服の role に 0x8a5ad6 無し（unit で main / sub / accent / layer / trim を検査、E2E で PAL 行に `8a5ad6` 無し） | PASS |
| 全身黒の回避 | main 0x30323a の相対輝度は T-4 の 0x1a1622 の2倍超（unit）、Off White のシャツ #D8D4D0。Human は酒場の比較で A（承認値）を選択（P-D8 は「必要に応じて明るくしてよい」で、明るくしない判断も Human） | PASS |
| マフラー #A3B1BF | 配色表・unit・docs・Task file 一致 | PASS |
| charKey / classDef.key | `paletteKeyFor` は `charKey === 'wanderer'` を最優先（kit が剣士でも剣士の色にならない）。転身中でも wanderer の行（unit で検査）。肌色も `charKey` 判定（T-4 から不変） | PASS |

## 9. Upper-class Switching Verification
- **FACT（ソース）**: `applyJobPromotionVisual()` は冒頭で `clearJobPromotionVisual()`（→ `applyPlayerPalette(P, P.basePaletteKey)`）を呼び、有効な上位職のときだけ `applyPlayerPalette(P, upPalKey)` を呼ぶ。`applyPlayerPalette` は全 role を上書きするため、結果は最後に渡したキーだけで決まる
- **削除された直接書き換え（diff で確認）**: 魔導士 `matchRobeLook()`（`P.clothMat` / `clothMatFlat` / `trimMat` / `trimMatFlat` / 帽子 / `beltMat.map` / `clothAcc.color`）、鷹の目 `HAWKEYE_BODY`（`P.clothMat` / `clothMatFlat` の map）、バーサーカー `P.rogueHood.material.color.set(uj.capeColor)`。unit のソース検査でも `applyJobPromotionVisual` 本体にこれらが無いことを確認
- **残る直接書き換え**: 魔導士の `P.hairMat.color.set(0xcac6d2)`（P-D4 で範囲外として承認済み。解除時に戻らない。R-8）、バーサーカーのフード `P.rogueParkaHood.material = layerWhite`（解除時に `rogueParkaHoodBaseMat` へ戻す既存の仕組み）
- 戦騎士: 強化肩 `knightSteel`（steel C8CDD2）・`knightGold`（gold C49A4A）は `jobDecorMeshes` 内の専用 Material で、解除時に破棄
- **経路**: (a) 転身の瞬間 `12-progression-ui.js:1967-1968`（`swapPlayerWeaponVisual` → `applyJobPromotionVisual`）、(b) 再生成 `14-hud-boot.js:1590-1591 / 1793-1794`（`buildPlayer` → `applyJobPromotionVisual`）。(b) は新しい Material を作るので残留は原理的に起きない。(a) は上記の全 role 上書き。**ゲーム内に「転身を解除する」操作は無い**（`clearJobPromotionVisual` の呼び出し元は `applyJobPromotionVisual` のみ）

## 10. Scope Deviation Check（`git diff 2a9674b..257e8ff`）
| 対象 | 結果 |
| --- | --- |
| `01-character-creation.js`（`CLASSES` / `UPPER_JOBS` の color / trim / capeColor） | 差分なし（unit でも9行の値を検査） |
| `08` / `11` / `12` / `13` / `14` / `src/textures/` / `playwright.config.js` | 差分なし |
| `05-rendering-rig.js` | `motionBodySnapshot()` に `pal` を追加（読み取りのみ、P-D10 の条件付き変更）。BUILD・Geometry・STANCE・CLIPS・`WEAPON_SOCKET` の差分なし |
| `06` の Geometry・配置・顔・目・髪・武器形状 / 位置 / 影の旅人の武器表示 | 差分なし（Material 引数と Material の生成・色・質感のみ） |
| 敵・ボスの Material（`06` の `buildEnemy` 系） | 差分なし（`06:4400` 以降の `trimMat` 等は未変更） |
| `outlineMats` / `addOutline` | 差分なし |
| 衣服数 | `character-clothing.spec.js` 9 / 9 PASS（Reviewer 再実行） |
- 範囲外の変更は検出されなかった（Record-only の注記は §16）

## 11. Test Results（Reviewer 再実行、Reviewed SHA `257e8ff`）
| テスト | 結果 | メモ |
| --- | --- | --- |
| `npm run build` | PASS | |
| `npm run test:unit` | PASS | 1521 / 1521 |
| T-5 関連 E2E（scratchpad 設定）: `character-palette`（9）・`character-clothing`（9）・`battle-knight-visual`・`weapon-stow`・`base-class-identity` | 37 PASS / 1 FAIL | FAIL は `base-class-identity.spec.js:413`（§13 FLAKY） |
| repo 標準設定の E2E（`npm test`） | **NOT_RUN** | Chromium revision 不一致（要求 1234 / 導入済み 1194、実行環境）。Playwright 設定は変更していない |
| 全 E2E 146件 | Reviewer は再実行していない | Implementer の Test Report（`c762a4a` の内容で 143 PASS / 2 FAIL / 1 FLAKY）。`c762a4a..257e8ff` の差分は Task file と docs のみ（コード差分なし）を確認 |

## 12. Baseline Failures（T-5 起因ではない。PASS には数えない）
| テスト | 内容 | 根拠 |
| --- | --- | --- |
| `execution-break.spec.js:99` | 「Execution で通常攻撃の型が再生されている」Received "basic" | Implementer 記録: HEAD 単独3回 FAIL、`main` `2a9674b` 単独3回 FAIL。T-5 の差分は Material・色のみで Execution の判定経路に触れない（Reviewer がソースで確認） |
| `mansion-escort.spec.js:126` | Relaxed Stance relax 0.84〜0.89（期待 > 0.9） | Implementer 記録: `main` `2a9674b` でも2回 FAIL。T-5 の差分はモーションに触れない |

## 13. FLAKY（PASS に数えない）
| テスト | 内容 | 根拠 |
| --- | --- | --- |
| `job-traits.spec.js:162` | 鷹の目 Turn Assist | 全体実行で spec 内蔵リトライにより PASS、単独 PASS（Implementer 記録、2回の全体実行で同じ）。T-5 起因の根拠なし |
| `base-class-identity.spec.js:413`（**Reviewer が新たに検出**） | 盗賊 Back Attack「正面から攻撃しても Bonus は発生しない」 | Reviewer 再実行: HEAD 単独3回中1回 FAIL、**`main` `2a9674b` 単独3回中1回 FAIL**。Implementer の全体実行2回では PASS。変更前から不安定。T-5 起因ではない |
| `air-actions.spec.js:128` | Enemy Step | 第1段階の全体実行で FAIL → 単独 PASS（Implementer 記録）。第2段階の全体実行では PASS |

## 14. Acceptance Criteria（Planner report §16）
| # | 基準 | 判定 | 確認方法 |
| --- | --- | --- | --- |
| AC-1 | `CLASSES` / `UPPER_JOBS` の color / trim / capeColor 不変 | PASS | **source inspection**（`git diff` 空）+ **unit** |
| AC-2 | 9キャラクターの role Material の色が配色表どおり | PASS | **E2E 直接**（9 / 9、Reviewer 再実行）。ただし E2E が読むのは `applyPlayerPalette` が書いた `userData.paletteHex` であり、描画されたテクスチャの色そのものではない（R-6）。描画結果は V-1 で Human が確認 |
| AC-3 | 転身 → 解除 → 基礎職の配色へ完全に戻る。魔導士 / 鷹の目の基本 Material に上位職の色が残らない | **部分確認（直接確認不能な部分あり）** | **E2E 直接**: 上位4職の生成で PAL 行が上位職の行と一致（生成 = `buildPlayer` → `applyJobPromotionVisual`）。**unit / source inspection**: `applyJobPromotionVisual` に基本 Material の直接書き換えが無いこと、`clearJobPromotionVisual` が `applyPlayerPalette(P, P.basePaletteKey)` を呼ぶこと、`applyPlayerPalette` が全 role を上書きすること。**直接確認不能**: 「解除」経路はゲーム内に存在せず（§9）、解除後の色を実機で観測していない。上位職 → 別職への切り替えも実機経路なし。例外として魔導士の髪色は P-D4 により残る設計（R-8） |
| AC-4 | 影の旅人: 服の紫 ≠ 影の紫、全身黒でない | PASS | **unit**（値・輝度）+ **E2E 直接**（PAL に 8a5ad6 なし）+ **Human V-1**（酒場） |
| AC-5 | バーサーカーが盗賊を継承しない | PASS | **unit** + source inspection |
| AC-6 | 質感が HDR-T5-9 の範囲、肌・髪・目・結晶・魔法陣・オーラ不変 | PASS | **unit**（範囲）+ **source inspection**（§15 の表、対象外 Material の差分なし） |
| AC-7 | Geometry / BUILD / 衣服数 / STANCE / CLIPS / 武器形状・位置不変 | PASS | **E2E 直接**（`character-clothing` 9 / 9、`weapon-stow`・`battle-knight-visual` PASS）+ **source inspection**（diff） |
| AC-8 | build・unit・E2E | PASS（条件付き記録） | build PASS、unit 1521 / 1521。E2E は baseline failure 2件（§12）と FLAKY（§13）を除き PASS。標準 `npm test` は NOT_RUN |
| AC-9 | V-1 第1〜第3段階の Human OK | PASS（記録） | Task file の Human Decision 記録（会話）。Reviewer は画像の良し悪しを判定しない |
| AC-10 | 形状・衣服・色の組み合わせで職業が識別できる | PASS（記録） | Human V-1 第3段階 OK。撮影条件の制約は R-11 |

### 質感の確認（HDR-T5-9、source inspection）
| 対象 | 現在値（Reviewed SHA） | HDR-T5-9 候補 | 判定 |
| --- | --- | --- | --- |
| 衣服（main / sub / accent / layer） | 0.85 / 0 | 0.8〜0.9 / 0 | PASS |
| 帽子（剣士キャップ含む） | 0.80 / 0 | 布扱い | PASS |
| trim（基礎職） | 0.60 / 0.25、emissive 0.04 | 0.55〜0.7 / 0.2〜0.3 | PASS |
| 上位職 trim（魔導士の帽子の房） | 0.55 / 0.30、emissive 0.08 | Planner 候補どおり | PASS |
| ブーツ | 0.75 / 0.08 | metalness 0.05〜0.1 | PASS |
| 戦騎士 steel / gold / dark | 0.5/0.35 ・ 0.5/0.35 e0.05 ・ 0.7/0.2 | metalness 0.3〜0.4 | PASS |
| 投げナイフ | 0.75 / 0.45 | P-D9 | PASS |
| 肌 / 髪 / 目 / 魔導士の結晶（`uj.trim` e0.9）/ 魔法陣 / バーサーカーのオーラ / 鷹・くちばし / 武器本体の steel | 差分なし | 対象外 | PASS |

## 15. Findings
**なし（Blocking / Non-blocking の Finding 0件）**。承認範囲・Human Decision・配色の最終値・Scope のいずれにも逸脱は見つからなかった。

## 16. Record-only Notes
| # | 内容 |
| --- | --- |
| R-1 | **独立性**: Reviewer は Implementer と同一セッション（T-1〜T-4 と同じ運用）。修正は行っていない |
| R-2 | **プロセス**: 承認済みの計画は Task file ではなく Planner report（Human 指示で Planner 時点は Task file 変更禁止）。T-5 Human Approval（再計画版）と Persistence は Implementer が Task file に「人間の指示による」と記入（`0e0c82a`）。AGENTS.md §5.2 の Plan Handoff（Kind `plan`）の記録は無い |
| R-3 | **Task file**: Work Items 表の T-5 行は Status 列以外（Summary・Approval・依存・Analysis 列）も更新されている（再計画版の内容を反映。旧版の承認記録は別節に残っている） |
| R-4 | **古いコメント**: `06:1311-1321` に `P.rogueHood.material.color.set(uj.capeColor)` と「clothAcc = classDef.trim」の旧説明が残る（コードは削除済み）。`player-palette.js` 冒頭の「色の値は…候補値。最終値は V-1 で Human が決める」と、影の旅人の行のコメント「Shadow Purple のマフラー・金具」「値 #A3B1BF は Implementer の候補」は V-1 確定後の状態と食い違う（値自体は正しい） |
| R-5 | **陰影**: 魔法使いのタートルネックは `clothMatFlat`（flat）→ `layerMat`（smooth）になり陰影の付き方が変わった（Planner R-5 で想定、V-1 で Human OK）。剣士キャップ・魔法使いキャスケットは `hatMat`（DoubleSide）になった（旧 FrontSide / clothMat） |
| R-6 | **E2E の検証範囲**: PAL 行は `userData.paletteHex`（`applyPlayerPalette` が書いた値）を読む。map の差し替え漏れなど「記録と描画の不一致」は E2E では検出できない。描画は V-1 の目視のみ |
| R-7 | **鷹の目の役割**: Planner report §5 は「sub = ケープ Deep Green」としていたが、実装は sub を弓師から継承（#617A82、パンツ・袖）し、背中のフードは役割外の `cape` キー（#24463E）。Human の配色体系（Deep Green を含む）とは一致し、V-1 で Human OK |
| R-8 | **魔導士の髪**: `P.hairMat.color.set(0xcac6d2)` は解除時に戻らない直接書き換えとして残る（P-D4 で範囲外として承認）。解除経路がゲームに無いため現状の実害なし |
| R-9 | **武器装飾**: `swapPlayerWeaponVisual()` の武器装飾は map 無しの単色 Material（生成時の武器は metal map 付きの `trimMat`）。色は同じ配色表の trim。質感の作り方の違いは T-5 以前から（旧 `classDef.trim` の単色）。また武器差し替え時に旧武器の Material を dispose する既存処理が、生成時の武器が共有する `trimMat`（本体の trim role）も dispose する（T-5 以前から同じ。three.js は次の描画で再初期化する） |
| R-10 | **テスト**: 全 E2E（146件）は Reviewer が再実行していない（Implementer の結果を採用。`c762a4a` 以降はコード差分なしを確認）。Reviewer の再実行は T-5 関連 E2E 38件 |
| R-11 | **撮影条件の制約（P-D11）**: 上位職はトレーニング空間（テストモード）でしか有効にならず（`14-hud-boot.js:1621`）、影の旅人は本編（酒場）でしか出せず、空のクリア状況のセーブで酒場に入ると主人公が剣士に固定される。9キャラクターを同一場所・同一照明で揃えられなかった。Human に報告済みで、第2段階で「上位職の酒場撮影は不要」、第3段階で OK を取得。T-5 の実装不備ではない |
| R-12 | **baseline failure / FLAKY の追跡**: `execution-break.spec.js:99`・`mansion-escort.spec.js:126`（main でも FAIL）、`base-class-identity.spec.js:413`・`job-traits.spec.js:162`・`air-actions.spec.js:128`（FLAKY）は T-5 と無関係だが未調査。別 Task 候補 |

## 17. Final Review Conclusion
**PASS**（Findings 0件、Record-only notes 12件）。

- 実装は承認範囲（HDR-T5-1、Planner report §13 の変更予定ファイル）内で、Human Decisions（P-D0〜P-D11）と V-1 の最終指定（盗賊パーカー #526A78、影の旅人マフラー #A3B1BF）が配色表・実装・unit・E2E・docs・Task file で一致している
- `CLASSES` / `UPPER_JOBS`、Geometry、BUILD、モーション、武器形状・位置、敵・ボス・支援AI、`13`、`textures.js`、Playwright 設定に変更は無い
- AC-3（転身解除で基礎職の色へ戻る）は、上位職の生成は E2E、解除側は unit / source inspection での確認に留まり、ゲーム内に解除経路が無いため実機では直接確認できていない（§14）
- テストは build PASS、unit 1521 / 1521 PASS、T-5 関連 E2E 37 PASS / 1 FLAKY（main でも再現）、baseline failure 2件、標準 `npm test` NOT_RUN

本 Review では source・Task file・docs・palette・テスト・Playwright 設定を変更しておらず、commit / push も行っていない。Status の更新（REVIEWING → DONE）は Human の指示を待つ。
