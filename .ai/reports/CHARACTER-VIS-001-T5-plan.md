# CHARACTER-VIS-001 / T-5 Planner（配色・Material・質感）

Planner / 2026-09-26 / Claude Code セッション / READ ONLY（ソース・Task file 未変更、commit / push なし）

- Input: `.ai/reports/CHARACTER-VIS-001-T5-analysis.md`（未追跡。本 Planner の Identity / Input Source）、Human の T-5 Human Decisions（HDR-T5-1〜12）と T-5 配色体系（2026-09-26 の会話）
- Baseline: `main` = `origin/main` = `2a9674bf7269bf86d32778978d628c64fa04e412`
- 注: AGENTS.md §4 の Planner 出力先は Task file。今回は Human 指示で Task file 変更禁止のため、計画を本 report に書く。承認後、Human の指示で Task file の T-5 節へ転記する（§17 P-D1）

---

## 1. T-5 の正式 Scope（HDR-T5-1）

| 範囲内 | 範囲外（変更禁止） |
| --- | --- |
| 職業別配色（基礎4職・上位4職・影の旅人） | BUILD / 5.0頭身 / Geometry / 衣服形状・配置 / シルエット |
| プレイヤー専用配色表の新設（`CLASSES.color` / `trim` は変えない） | 顔 / 目 / 髪（形状・色とも。§17 P-D4） |
| 必要最小限の Material 分離と、衣服メッシュへの Material 割り当て変更（メッシュの第2引数だけ） | STANCE / CLIPS / 歩行 / 戦闘モーション |
| matte / semi-matte 化（roughness / metalness / emissive） | 武器形状・位置・影の旅人の武器システム |
| 上位職の Material 切り替え方式の整理（基本 Material の直接書き換えを廃止） | 敵 / ボス / 支援AI（`08`）/ `13-update-loop.js` / Playwright 設定 |
| 影の旅人の衣服色と影 VFX 色の分離 | `CLASSES`（`01`）、VFX（`11`）、足元リング、酒場の shadowGuide |
| | `outlineMats()` / `addOutline()`、`textures.js`（キャッシュキー含む）、レンダラ設定（D-4 からの継続） |
| | 肌色（T-4 確定値を維持、HDR-T5-4） |

## 2. Material architecture

### 2-1. 方針（「Material を増やせば解決」にしない）
- **FACT（Analyzer §3）**: 色の混線の原因は Material の数ではなく、(1) 色の出どころが `CLASSES` と共有されている、(2) 1つの Material が役割の違う部品を兼ねている、(3) 上位職が基本 Material を直接書き換え、その上書きを戻す手段が無い、の3点
- **設計**: 「部品 → 役割（role）→ 色」の2段にする。部品は role の Material を参照し、role の色は配色表から入る。職ごとの差は配色表の行だけで表し、Material の個数は職によって変えない

### 2-2. Role（固定。職に依存しない）
| Role | Material（buildPlayer 内） | 既存との関係 | 主な部品 |
| --- | --- | --- | --- |
| `main` | `clothMat` / `clothMatFlat` | **既存を流用** | 素体の四肢・胴・骨盤、主な上着 |
| `sub` | `subMat` / `subMatFlat` | **新設（2）** | パンツ・袖など「メインと分けたい層」 |
| `accent` | `clothAcc` | **既存を流用**（役割を「布のアクセント」に限定） | ゲイター / マフラー / 盗賊のパーカー / 矢羽 |
| `layer` | `layerMat` | **新設（1）**。影の旅人の `wandererWhite` と上位職の `layerWhite` を統合 | 白いシャツ・タートルネック・上位職の白いレイヤー |
| `hat` | 既存の帽子 Material（`warriorHelmMat` / `rogueHoodMat` / `hatMatCone`+`hatMatBrim` を1つに） | **既存を流用**。魔法使いの帽子を `clothMat` から独立（`hatColor` 経路と同じ作り方） | 帽子 |
| `trim` | `trimMat` / `trimMatFlat` / `beltMat` | **既存を流用** | 膝球・脛当て・籠手・Pauldron・ベルト・武器装飾 |
| `boot` | `bootMat` | **既存を流用**（色を配色表から） | ブーツ |

- 増える Material: `subMat` / `subMatFlat` / `layerMat` の **3**。減る Material: `wandererCoatMat` / `wandererWhite`（影の旅人）、上位職の `layerWhite`、鷹の目の `hoodMat` の一部（§5）。**1キャラクターあたりの増減はほぼ 0〜+2**
- flat の双子は「現在 flat の Material を使っている部品」を flat のまま保つためだけに作る（T-4 の見た目の陰影を変えない）
- 既存の `playerMixerParts.<名前>` の公開は維持し、`playerMixerParts.roleMats = {main, mainFlat, sub, subFlat, accent, layer, hat, trim, trimFlat, belt, boot}` を追加

### 2-3. 色の反映方式（HDR-T5-10）
- `applyPlayerPalette(P, paletteKey)`（06、新規の小関数）: role Material **すべて**に、配色表の行から色（と leather / metal の map + bump）を書き込む。「差分」ではなく「全 role の上書き」なので、呼ぶ前の状態に依存しない（冪等）
- 呼び出し:
  1. `buildPlayer()` の末尾: `applyPlayerPalette(P, baseKey)`（基礎職 or `wanderer`）
  2. `applyJobPromotionVisual()`: `clearJobPromotionVisual()` の直後に `applyPlayerPalette(P, uj.key)`
  3. `clearJobPromotionVisual()`: `applyPlayerPalette(P, baseKey)` で基礎職の配色へ戻す
- これにより、魔導士の `matchRobeLook()`（`P.clothMat` / `clothMatFlat` / `trimMat` / `trimMatFlat` / 帽子 / `beltMat` / `clothAcc` の書き換え）と、鷹の目の `HAWKEYE_BODY` map 書き換え（`:2655-2660`）、バーサーカーの `P.rogueHood.material.color.set(uj.capeColor)`（`:2332`）を **削除**し、配色表の行に置き換える
- 上位職専用の装飾（戦騎士の肩・ハーネス、魔導士の結晶・魔法陣、鷹の目の羽・くちばし、バーサーカーのオーラ）は今までどおり `jobDecorMeshes` で作って破棄する。ただし白いレイヤー部品は `layerWhite` を作らず `P.roleMats.layer` を使う（色は配色表の upper 行）
- **INFERENCE**: 現状の転身は「生成後にその場で装飾を足す」（`12-progression-ui.js:1967-1968`）。転身時に `buildPlayer` を作り直す方式（再生成）は、`12` / `14` とアニメーション状態に触れるため採らない

## 3. プレイヤー専用配色表の構造（HDR-T5-2 / 3）

### 3-1. 置き場所（Planner 決定）
- **新規 `src/render/player-palette.js`（純粋なデータ + 純粋関数。THREE に依存しない）**、`src/legacy/concat-plugin.js` の HEADER に import を1行追加
- 理由: (1) 既存の legacy は `../core/*.js` / `../render/lowpoly-primitives.js` を HEADER で import する形が確立している（FACT: `concat-plugin.js:30-194`）、(2) node の unit テストで配色表を直接 import して検証できる（06 のソースを正規表現で読む方式より壊れにくい）、(3) `05`（Geometry / リグ）と `06`（Material の生成）の責務を変えない
- 不採用: `05` の BUILD 近傍（BUILD は体格の表で、`checkBuild` の検査対象。色を混ぜると責務が混ざる）/ `06` 冒頭（unit テストで直接検証できない）

### 3-2. 形（案）
```js
// src/render/player-palette.js
export const PLAYER_FINISH = {            // 質感（§9）
  cloth:{roughness:0.85, metalness:0},  trim:{roughness:0.6, metalness:0.25, emissive:0.04},
  boot:{roughness:0.75, metalness:0.08}, hat:{roughness:0.8, metalness:0}, /* ... */
};
export const PLAYER_PALETTE = {          // 配色（§4〜6）。キー = 基礎職 / 上位職 / 'wanderer'
  warrior:{ main:0x263a55, sub:0x52657a, accent:0xe6e4dd, layer:null, hat:0x52657a, trim:0xc49a4a, boot:0x2a2018 },
  battleKnight:{ inherit:'warrior', layer:0x9aa5b1, knightSteel:0xc8cdd2, knightGold:0xc49a4a },
  /* ... */
};
export function paletteKeyFor(classKey, jobKey, charKey){ /* wanderer → 'wanderer'、転身中 → jobKey、他 → classKey */ }
export function resolvePalette(key){ /* inherit を展開した完全な行を返す（全 role が埋まる） */ }
```
- `inherit`: 上位職は基礎職の行を引き継ぎ、差分だけ書く（「上位職は系統を継承」）。**バーサーカーは `inherit` を使わず全 role を独立に書く**（HDR-T5-8）
- `resolvePalette` は全 role が埋まった行を返す → `applyPlayerPalette` が「全 role 上書き」をできる

## 4. 基礎4職の Material mapping（色は Human 承認済みの方向。**具体値は V-1 の候補**）

| 職 | main（clothMat/Flat） | sub（新設） | accent（clothAcc） | layer（新設） | hat | trim | boot |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 剣士 | パーカー・背中のフード・ポケット・袖 = Deep Navy **#263A55** | パンツ = Blue Gray **#52657A** | ネックゲイター = Off White **#E6E4DD** | ―（未使用） | キャップ = Blue Gray #52657A | Warm Gold **#C49A4A**（今 0xc99c47 とほぼ同じ） | 既存 0x2a2018 |
| 魔法使い | ロングコート・袖 = Light Blue **#8FB9D6** | パンツ = Pale Blue Gray **#B7C7D2** | ―（未使用） | タートルネック = Off White **#E7E8E5** | キャスケット = 候補 #6F8CA3（「少し濃い Blue Gray」。P-D6） | Muted Gold **#C7A45A**（今 0x8260ab 紫） | 既存 |
| 弓師 | 短丈上着・帽子 = Forest Green **#315C50** | パンツ・袖 = 候補 Blue Gray #5E7480（P-D5） | 矢羽 = 候補 Muted Gold #B99652（P-D5） | ― | 帽子は main（別 Material にしない） | 候補 茶系を維持 0x78512d（ベルト・籠手は革。P-D5） | 既存 |
| 盗賊 | オーバーオール（胸当て・腰まわり・肩ベルト・パンツ）= Deep Green **#304D45** | ―（未使用） | パーカー（フード・胴・袖）= Muted Purple **#5B4B78** | ― | 帽子 = Warm Yellow **#D2A83E** | 候補 Dark Navy #263449 | Dark Navy **#263449** |

- 割り当ての変更（メッシュの第2引数だけ）: 剣士パンツ `clothMatFlat` → `subMatFlat`（`06:1260 / 1271`）、剣士キャップは `warriorHelmMat` のまま（色・質感だけ）、魔法使いパンツ → `subMatFlat`（`:1531 / 1537`）、タートルネック → `layerMat`（`:1504`、flat → smooth の差は V-1 で確認。気になる場合は `layerMat` を flat で作る）、魔法使いの帽子 → 専用の `hat`（`:1455-1460`）、弓師パンツ / 袖 → `sub`（`:1663 / 1669 / 1802`）
- 盗賊はほぼ現状の構成（緑のオーバーオール・紫のパーカー・黄色の帽子）と同じで、値を配色表へ移すだけ

## 5. 上位4職の Material mapping

| 職 | 継承 | main | sub | accent | layer（白いレイヤー、HDR-T5-5） | 上位職の専用 Material |
| --- | --- | --- | --- | --- | --- | --- |
| 戦騎士 | 剣士 | Deep Navy #263A55 | Blue Gray（剣士と同じ） | Off White（ゲイター） | 白いジャケット・袖 = **Cool Gray #9AA5B1**（「白が目立つ」を保つなら候補 #C8CDD2 と入れ替え。P-D7） | knightSteel（強化肩）= Muted Silver **#C8CDD2**、knightGold（ハーネス・ベルト金具）= Warm Gold #C49A4A、knightDark 維持 |
| 魔導士 | 魔法使い（形） | コート = Deep Blue **#334A72** | パンツ・帽子 = Indigo Purple **#514B86** | ―（`clothAcc` の 0xd8c8f0 上書きを廃止） | 白いドレス = Off White **#E4E6E3** | trim = Muted Gold #C7A45A。`robeTex` / `ARCHMAGE_NAVY` / `matchRobeLook` を廃止。結晶・魔法陣は維持 |
| 鷹の目 | 弓師 | Forest Green #315C50（**HAWKEYE_BODY 0x1c8c66 の書き換えを廃止**） | ケープ（`hoodMat`）= Deep Green **#24463E**（`uj.capeColor` 0x0a3a30 の代わり） | 矢羽 = Muted Gold #B99652 | ベスト = Off White 系（Blue Gray #617A82 はパンツ / sub へ。P-D7） | trim = #B99652。羽・くちばしは維持 |
| バーサーカー | **独立**（盗賊の行を継承しない、HDR-T5-8） | オーバーオール = Charcoal Gray **#45484D** | パーカー（`clothAcc`）= Deep Red **#8A3438** | 帽子 = Dark Brown **#59483D**（`capeColor` 0x3a0a10 の代わり） | フード・半袖の上着 = Off White **#E5E1D9** | オーラ（MeshBasic 0xff3a1a）は魔法エフェクトとして維持。boot = Dark Brown #59483D |

- バーサーカーの「accent」は role 名としては `clothAcc` がパーカーを担うため Deep Red になり、Human の表の「Accent: Off White」は `layer` に当たる（色の役割は Human の表どおり。role 名の違いだけ）
- **INFERENCE**: 形状は盗賊のまま（オーバーオール + パーカー + 帽子）なので、盗賊との「形のつながり」は残り、色で別系統に見える

## 6. 影の旅人の Material mapping（HDR-T5-6）

| 部品 | 今 | T-5 | Role |
| --- | --- | --- | --- |
| ショートコート・背中のフード・袖 | `wandererCoatMat` 0x5e5a6c | Charcoal **#30323A** | main（`clothMat` 系。`wandererCoatMat` を廃止） |
| パンツ・素体 | clothMat 0x1a1622（`CLASSES.wanderer.color`） | Dark Purple **#403454** | sub（パンツ）/ main（素体。コートと同じ） |
| マフラー | `clothAcc` 0x8a5ad6（= 影 VFX・足元リングの trim と同じ値） | Shadow Purple **#654F86** | accent |
| 白いシャツ | `wandererWhite` 0xe6e2da | Off White **#D8D4D0** | layer |
| 髪・目・肌 | 0x0a0810 / 0x8a5ad6 / 0xe8dce0 | **変えない** | ― |

- 影 VFX / 足元リング / 酒場の shadowGuide は `CLASSES.wanderer.trim` 0x8a5ad6 のまま → **衣服の紫（#654F86 / #403454）と影の紫（0x8a5ad6）は別 Material・別の値**
- **リスク（FACT: T-4 V-1）**: 今のコート 0x5e5a6c でも酒場では黒く見えた。#30323A はそれより暗い → 全身黒（禁止）に寄る可能性が高い。V-1 で酒場の照明で確認し、足りなければ明度を上げた候補（#3E404A 等）を Human に出す（P-D8）

## 7. Material 分離対象
| # | 分離 | 理由 |
| --- | --- | --- |
| S-1 | `sub` / `subFlat` を新設し、パンツ・袖を移す | main と層を分けるため（剣士・魔法使い・弓師・影の旅人・鷹の目） |
| S-2 | `layer` を新設（`wandererWhite` と上位職の `layerWhite` を統合） | 白いレイヤーの役割を1つにまとめる |
| S-3 | 魔法使いの帽子を `clothMat` から独立 | 帽子とコートの色を分けるため |
| S-4 | 配色の出どころを `CLASSES` から配色表へ | 支援AI・VFX・リングへの波及を断つ |
| S-5 | `swapPlayerWeaponVisual()` の武器装飾（`:2069` で `classDef.trim` から毎回新しく作る）を `P.roleMats.trim` の色に揃える | 生成時と転身時で武器装飾の色が違う状態を避ける（色・質感だけ。形・位置は変えない。P-D9） |

## 8. 共有を維持する対象
- `clothMat` / `clothMatFlat` を素体と main の衣服で共有（素体はほぼ衣服に隠れる。分けても見た目が変わらない）
- `trimMat` 系を膝球・脛当て・籠手・Pauldron・ベルト・武器装飾で共有（すべて「trim」の役割）
- `clothAcc` の共有（1キャラクター内で使う部品は職ごとに1役割だけになる）
- `skinMat` / `hairMat` / 目 / `darkMat` / 矢筒 / `archerFurMat` / ポーチ / 足元リング（変更しない）
- `metalMat`（投げナイフ）は色を変えず、質感だけ §9（P-D9）
- `furMat`: T-4 後に未使用なら削除候補だが、T-5 では触らない（別 Task。T-4 Review N-系と同じ扱い）

## 9. matte 化の具体値候補（HDR-T5-9。現在 → 候補。最終は V-1）
| 対象 | 現在 | 候補 |
| --- | --- | --- |
| 衣服（main / sub / accent / layer / hat） | 0.6 / 0.15（clothMat）、0.85 / 0（clothAcc）、0.8〜0.85 / 0（wanderer・layerWhite） | **0.85 / 0**（leather map と bump は維持） |
| 剣士キャップ（warriorHelmMat） | 0.55 / 0.12 | 0.8 / 0 |
| trim（基礎職） | 0.4 / 0.3、emissive 0.12 | **0.6 / 0.25、emissive 0.04** |
| trim（上位職、`:2226`） | 0.35 / 0.4、emissive 0.35 | 0.55 / 0.3、emissive 0.08 |
| ブーツ | 0.6 / 0.2 | **0.75 / 0.08** |
| 戦騎士 knightSteel / knightGold / knightDark | 0.4/0.55 ・ 0.35/0.5 e0.16 ・ 0.6/0.3 | **0.5/0.35 ・ 0.5/0.35 e0.05 ・ 0.7/0.2** |
| 投げナイフ（metalMat） | 0.35 / 0.7 | 0.5 / 0.45（P-D9。武器なので据え置きも可） |
| 肌・髪・目・結晶・魔法陣・オーラ | ― | **変更しない** |

## 10. 転身時の Material 切り替え方式
- §2-3 のとおり。要点: 転身・解除・別職への切り替えの結果は `applyPlayerPalette(P, key)` の key だけで決まり、前の状態に依存しない
- 転身専用の Material（knight 系・結晶・魔法陣・羽・オーラ）は `jobDecorMeshes` に閉じ、解除時に破棄（今と同じ）
- バーサーカーのフードの material 差し替え（`rogueParkaHoodBaseMat` で戻す仕組み、`:2338` / clear 側）は、フードを `layer` にする処理として残す（戻す仕組みは既存）
- 魔導士の髪（`P.hairMat.color.set(0xcac6d2)`、`archHairMat`）は「髪 = 範囲外」のため**そのまま残す**。これは解除時に戻らない直接書き換えとして残る（P-D4）

## 11. テスト戦略
| 種別 | 内容 |
| --- | --- |
| unit（新規 `tests/unit/player-palette.test.js`） | (1) 9キーすべてで `resolvePalette` の全 role が有効な色（0〜0xffffff）、(2) バーサーカーが `inherit` を使わない、(3) 影の旅人の衣服の紫（accent / sub）が `CLASSES.wanderer.trim` 0x8a5ad6 と一致しない、(4) 影の旅人の main / sub / accent / layer の相対輝度が下限以上（全身黒の検出。閾値は候補値から決める）、(5) `paletteKeyFor` の分岐（wanderer / 転身中 / 基礎職）、(6) `PLAYER_FINISH` が HDR-T5-9 の範囲内 |
| unit（ソース検査、既存の方式） | `01` の `CLASSES` の color / trim が T-5 前と同じ値（波及防止の回帰）。`applyJobPromotionVisual` 内に `matchRobeLook` / `HAWKEYE_BODY` / `.map = ` による基本 Material の書き換えが無い |
| E2E（新規 `tests/character-palette.spec.js`） | テストモードで 8職 + 影の旅人（continue セーブ）を生成し、role Material の色を読み出して配色表の値と一致すること。**残留の確認**: 基礎職 → 転身 → `clearJobPromotionVisual()` → 基礎職の配色に戻ること、魔導士 / 鷹の目で基本 Material の色が上位職のまま残らないこと。読み出しは既存の Motion Preview パネル（`CLOTH` 行と同じ方式）に `PAL` 行を追加するか、テストモード限定の読み出し口を使う（P-D10） |
| 既存 | `npm run test:unit`、`npm test`（全 E2E）。`tests/character-clothing.spec.js`（衣服の数）が不変であること = Geometry を変えていないことの確認。FLAKY は PASS に数えない（§14）。Chromium 不一致時は標準 NOT_RUN、scratchpad 設定で E2E |
| 差分検査 | `git diff` に `BUILD` / Geometry 生成の引数（第1引数）/ STANCE / CLIPS / 武器の形・位置 / `01` / `08` / `11` / `13` / `textures.js` / Playwright 設定の変更が無いこと |

## 12. V-1 戦略（HDR-T5-11）
1. **V-1a 基礎4職**: 剣士 / 魔法使い / 弓師 / 盗賊。T-4 と同じ撮影セット（停止 4方向・歩行・戦闘、ゲームカメラ + 低いカメラ）、T-4 最終との並べ比較
2. **V-1b 上位4職 + 影の旅人**: 基礎職と並べて「系統が分かるか」、バーサーカーが盗賊の色違いに見えないか、影の旅人を酒場（暗い照明）とフィールドで撮影し全身黒に見えないか
3. **V-1c 全9キャラクター**: 同一条件（同じ場所・時刻・カメラ）で1枚に並べる
- Human が途中で色を直した場合: 配色表の値だけ変更し、Task file の Human Decision に記録（「候補値 → Human 指定値」）。Implementer は最終確定と書かない。確定は Human の「OK」のみ
- 各段階の Human の OK 前に次の段階の実装へ進まない（配色表の値変更は段階をまたいでもよいが、記録する）

## 13. 変更予定ファイル
| ファイル | 変更 | 必須 |
| --- | --- | --- |
| `src/render/player-palette.js`（新規） | 配色表・質感表・`paletteKeyFor` / `resolvePalette` | 必須 |
| `src/legacy/concat-plugin.js` | HEADER に import 1行 | 必須 |
| `src/legacy/parts/06-player-enemy.js` | role Material の作成、`applyPlayerPalette`、衣服メッシュの Material の割り当て、`wandererCoatMat` / `wandererWhite` / `layerWhite` / `matchRobeLook` / `HAWKEYE_BODY` / capeColor の書き換えを置き換え、質感値 | 必須 |
| `tests/unit/player-palette.test.js`（新規） | §11 | 必須 |
| `tests/character-palette.spec.js`（新規） | §11 | 必須 |
| `src/core/motion-preview.js` + `tests/unit/motion-preview.test.js` | `PAL` 行を足す場合のみ（P-D10） | 条件付き |
| `05-rendering-rig.js` | `motionBodySnapshot` に配色キーを足す場合のみ（P-D10） | 条件付き |
| `docs/CHARACTERS.md` | 「外見」節の配色の記述（V-1c の OK 後） | 必須（最後） |
| **変更しない** | `01`（CLASSES / UPPER_JOBS の trim・capeColor）、`08`、`11`、`13`、`14`、`12`、`textures.js`、`playwright.config.js`、BUILD | ― |

- `UPPER_JOBS[*].capeColor` は `06` の Material 以外（`01:176-183` のコメント、他の参照は要確認）でも使われる可能性があるため値は変えず、`06` で読むのをやめるだけにする（INFERENCE。Implementer が grep で確認）

## 14. リスク
| # | リスク | 対策 |
| --- | --- | --- |
| R-1 | 影の旅人 #30323A が暗く、全身黒に見える（T-4 で 0x5e5a6c でも黒く見えた実績） | unit の輝度下限、V-1b で酒場撮影、明度を上げた候補を用意 |
| R-2 | 弓師の青 → 緑で、鷹の目（今の青緑）と基礎職の差が縮む | 鷹の目は Deep Green のケープ + Off White のベストで差を付ける。V-1b |
| R-3 | leather map の色は texture に焼き込まれる（`.color` を変えても効かない。FACT: `:2384` のコメント） | `applyPlayerPalette` は map（cache 済みの `makeLeatherTexture`）と bumpMap を差し替える。`textures.js` は変えない |
| R-4 | テクスチャキャッシュの増加（色ごとに1枚、96px） | 9キャラ × 数色で数十枚。許容範囲（INFERENCE） |
| R-5 | flat → smooth の割り当て変更で陰影が変わる（タートルネック等） | flat 部品は flat の双子へ割り当てる。変える場合は V-1 で確認 |
| R-6 | `swapPlayerWeaponVisual` の trim と `buildPlayer` の trim の不一致 | S-5（P-D9） |
| R-7 | 上位職の `uj.trim`（0xffcf6a 等）を VFX や他所が読んでいるか未確認 | 値は変えず、06 の Material で読むのをやめるだけ。Implementer が grep で確認 |
| R-8 | 魔導士の髪の直接書き換えが残る（範囲外） | P-D4 で Human が判断。今は転身の解除が再生成経路のみのため実害なし（FACT: `14-hud-boot.js:1590 / 1793`、`12-progression-ui.js:1968`） |
| R-9 | FLAKY `job-traits.spec.js:97` の再発 | PASS に数えない。再実行で FAIL なら原因調査（T-5 の差分と無関係でも報告） |
| R-10 | T-4 の衣服数テストが Material 変更で揺れる | Geometry は変えないので数は不変のはず。変わったら Geometry に触れた証拠として FAIL 扱い |

## 15. Rollback strategy
- 実装は Persistence ブランチ上で **段階ごとに1 commit**: (C1) 配色表モジュール + unit、(C2) role Material と `applyPlayerPalette`（色は現状値を再現する「現状の配色表」で入れ、見た目が変わらないことを確認）、(C3) 基礎4職の配色 + 質感、(C4) 上位職の方式変更 + 上位職の配色、(C5) 影の旅人、(C6) E2E / docs
- C2 で「現状値を再現する表」を先に入れるので、構造変更と色変更を分けて戻せる（`git revert <C3〜C5>` で構造を残したまま旧配色へ戻る）
- main へは Human の指示でのみ統合（force push 禁止）

## 16. Acceptance Criteria
1. `CLASSES` / `UPPER_JOBS` の color / trim / capeColor の値が T-5 前と同じ（unit）
2. 9キャラクターの role Material の色が配色表どおり（E2E）
3. 転身 → 解除 → 基礎職の配色へ完全に戻る。魔導士 / 鷹の目の基本 Material に上位職の色が残らない（E2E）。`matchRobeLook` / `HAWKEYE_BODY` による書き換えが無い（unit）
4. 影の旅人: 衣服の紫 ≠ 影の紫（0x8a5ad6）、全身黒でない（unit の輝度 + V-1b）
5. バーサーカーの配色が盗賊の行を継承しない（unit）
6. 質感値が §9 の範囲（unit）。肌・髪・目・結晶・魔法陣・オーラの値が不変（差分検査）
7. Geometry / BUILD / 衣服数 / STANCE / CLIPS / 武器形・位置が不変（`character-clothing.spec.js` PASS、差分検査）
8. `npm run build`・`npm run test:unit`・`npm test` が PASS（FLAKY を PASS に数えない）
9. V-1a / V-1b / V-1c で Human の OK（色の最終値は Human が確定）
10. 「職業ごとに明確なメインカラーを持ち、形状・衣服・色の組み合わせで職業が識別できる」（HDR-T5-12）を V-1c で Human が確認

## 17. Human Decision が必要な残事項
| # | 論点 | Planner 推奨 |
| --- | --- | --- |
| **P-D0** | **HDR-T5-4 の肌色の値の食い違い**: 指示の値（剣士 0xf2d6bf / 魔法使い 0xf8e3d8 / 盗賊 0xf5dcc8 / 弓師 0xd6a47e）は、T-4 で Human が後から確定した値の**前の候補値**（FACT: Task file `:1651-1652 / 1665`）。コードと `docs/CHARACTERS.md` は確定値（0xffe6d2 / 0xffeee5 / 0xffe7d4 / 0xe8bd98、影の旅人 0xe8dce0） | 「T-4 確定値を維持」の趣旨に従い**コードの確定値のまま変えない**。指示の値に変える場合は Human が明示 |
| P-D1 | 本 Planner 案の Task file への転記と、T-5 用ブランチ（Planner / Persistence） | 候補: 計画の保存 `claude/character-vis-001-t5-planner`、実装 `claude/character-vis-001-t5-impl`（どちらも未作成。FACT: `git branch -a` に t5 なし） |
| P-D2 | 配色表の置き場所 = 新規 `src/render/player-palette.js` + `concat-plugin.js` 1行 | この案で承認 |
| P-D3 | role の固定（main / sub / accent / layer / hat / trim / boot）と、新設 3 Material | この案で承認 |
| P-D4 | 魔導士の髪の色の直接書き換え（範囲外の髪）を残すか、`applyPlayerPalette` に髪の色だけ含めるか | 残す（範囲外を守る）。別 Task |
| P-D5 | 弓師のサブ / アクセント / trim の候補（Blue Gray #5E7480 / Muted Gold #B99652 / 茶 0x78512d） | 候補として V-1a で調整 |
| P-D6 | 魔法使いのキャスケットの値（候補 #6F8CA3） | 候補として V-1a で調整 |
| P-D7 | 戦騎士の白いレイヤー（Cool Gray #9AA5B1 と Muted Silver #C8CDD2 のどちらを白い層にするか）、鷹の目のベスト（Off White か Blue Gray #617A82 か） | 「白いレイヤーが目立つ」（HDR-T5-5）を優先し、明るい方を layer |
| P-D8 | 影の旅人のコートが暗く見えた場合、#30323A から明度を上げてよいか | V-1b で候補を並べて Human が選ぶ |
| P-D9 | 武器装飾の trim を配色表に揃えるか（S-5）、投げナイフの質感を変えるか | trim は揃える（色・質感のみ）。ナイフは据え置き |
| P-D10 | E2E の読み出し口（Motion Preview に `PAL` 行を足す / テストモード限定の読み出し口） | Motion Preview に `PAL` 行（T-4 の `CLOTH` 行と同じ方式、実績あり） |
| P-D11 | V-1 の各段階で撮影する場所（酒場を V-1b の必須にするか） | 必須 |

## 18. Analyzer report との整合性
| Analyzer | 本 Planner |
| --- | --- |
| §3 `CLASSES` 共有 → プレイヤー専用配色表 | §3（HDR-T5-2） |
| §6 #1 役割別衣服 Material（2〜4個） | §2-2（新設 3、実質 +0〜2） |
| §6 #3 `clothAcc` の役割の混在 | §2-2（accent に限定。職ごとに1役割） |
| §6 #4 魔法使いの帽子 | §7 S-3 |
| §6 #5 上位職の上書き | §2-3 / §10（全 role 上書きの冪等方式） |
| §6 #6 影の旅人のマフラーと影の紫 | §6 |
| §7 matte 候補 | §9（HDR-T5-9 の範囲で具体化） |
| §9 Geometry 変更不要 | §1 / §16-7 |
| §11 未解決: 弓師の色コード / バーサーカー系統 / furMat / キャスケット | P-D5 / HDR-T5-8 で決着 / §8（触らない）/ P-D6 |
| §12 HDR-T5-1〜10 | Human が HDR-T5-1〜12 として確定済み。肌色の値だけ食い違い（P-D0） |
| 相違点 | Analyzer は配色表の置き場所を `05` BUILD 近傍 / `06` 冒頭と挙げたが、本 Planner は新規 `src/render/player-palette.js` を選んだ（理由 §3-1） |
