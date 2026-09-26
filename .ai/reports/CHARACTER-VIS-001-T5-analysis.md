# CHARACTER-VIS-001 / T-5 Analysis（配色・Material・質感）

Analysis: Analyzer（READ ONLY。ソース・Task file は変更していない）/ 2026-09-26 / Claude Code セッション

## 1. Baseline
| 項目 | 値 |
| --- | --- |
| 基準 | `main` = `origin/main` = `2a9674bf7269bf86d32778978d628c64fa04e412`（T-4 DONE / main 統合済み） |
| 作業ツリー | 開始時 clean（本 report の作成のみ未追跡ファイルとして増える） |
| 承認済み T-5（Task file の Identity Source） | Work Items「T-5 プレイヤー用マテリアル値の統一（マット化）」APPROVED `[x]`。Scope: Step 1（`buildPlayer()` 基本マテリアルの roughness / metalness / emissive / `applyBump` を「プレイヤー用マテリアル値の表」から読む）、Step 2（職別装飾・`applyJobPromotionVisual()` の光沢系の外れ値を表の値へ。共有 Material は直接変えず必要なら分離）。「**T-4 が DONE になってから着手**」。`Persistence:` 空欄。「T-4/T-5 の境界」（HDR-T4-8）に「T-5 は T-4 で追加された衣服も対象に含めるよう、将来の T-5 Planner で対象範囲を更新する」 |
| Human 入力（本 Analyzer の前提資料） | 「T-5 配色デザイン案（元の配色 × 新案のミックス）」の画像と、職ごとのメイン / サブ / アクセント / 補助の色コード（Human の T-5 実装指示・Analyzer 指示の本文） |

## 2. Current Material Inventory
**FACT**: プレイヤーの Material はすべて `buildPlayer()`（`06-player-enemy.js:535-`）と `applyJobPromotionVisual()`（`:2186-`）の **呼び出しのたびに新しく作られる**。職をまたいで同じ Material オブジェクトを共有することはない（プレイヤーは1体、`buildPlayer` を使うのはプレイヤー本体だけ: `14-hud-boot.js:1590 / 1793`。同行ゲストは `buildGuestCompanion`〔`08-loot-equipment.js:1020-`〕で別に作る）。色の出どころは `CLASSES[key]`（`01-character-creation.js`）の `color` / `trim` / `hairColor` / `eyeColor` と、上位職の `upperJob.trim` / `capeColor`、およびコード内の直値。

### 2-1. 全職共通（`buildPlayer`）
| Material | 定義 | 色 | roughness / metalness / その他 | 主な使用パーツ |
| --- | --- | --- | --- | --- |
| `skinMat` | `:557` | `SKIN_COLOR[職]`（T-4 Human 確定） | 0.8 / 0 | 頭・首・手・指 |
| `clothMat` | `:562` | `makeLeatherTexture(classDef.color)` の map + `applyBump` | 0.6 / 0.15 | 太腿・すね・上腕・前腕・肘球（素体）＋ 職ごとの衣服（下表） |
| `clothMatFlat` | `:584`（clothMat の clone + flatShading） | 同上 | 同上 | 骨盤・胴（素体）＋ 職ごとの衣服 |
| `trimMat` | `:564` | `makeMetalTexture(classDef.trim)` + emissive `classDef.trim` 0.12 | 0.4 / 0.3 | 膝球・胸当て（chestPlate）・武器の装飾（呼び出し側で渡す） |
| `trimMatFlat` | `:585`（clone + flat） | 同上 | 同上 | 脛当て・ブーツのストラップ・籠手・Pauldron |
| `beltMat` | `:731`（trimMat の clone） | 同上 | 同上 | ベルト |
| `bootMat` | `:607` | 0x2a2018 | 0.6 / 0.2 | ブーツ・つま先、剣士のブーツの胴 |
| `scleraMat` / `pupilMat` / `highlightMat` | `:791-795`（MeshBasic） | 0xfaf6ee / eyeColor or 0x241a14 / 0xffffff | ― | 目 |
| `hairMat` | `:893` | hairColor or 性別の黒〜茶 | 0.7 / 0 | 髪の殻・前髪・横・後ろ、影の旅人の毛束 |
| `metalMat` | `:1096` | 0x9aa0a8 | 0.35 / **0.7** | 盗賊の投げナイフ |
| `darkMat` | `:1097` | 0x2a2420 | 0.7 / 0 | 盗賊のナイフ入れ、弓師の矢柄 |
| `clothAcc` | `:1098` | `classDef.trim`（値のコピー。オブジェクトは衣服専用） | 0.85 / 0、DoubleSide | 下表 |
| `furMat` | `:1113` | 0xe6dcc6 | 0.9 / 0 | （剣士の旧毛皮用。T-4 後は未使用の可能性。Planner で要確認） |
| 足元リング | `:2022`（MeshBasic、transparent 0.5） | `classDef.trim`。毎フレーム `13-update-loop.js:815` が `state.classDef.trim` を書き込む | ― | 足元リング |

### 2-2. 職ごと（`buildPlayer`）
| 職 | Material | 色 | 質感 | 使用パーツ（T-4） |
| --- | --- | --- | --- | --- |
| 剣士（影の旅人も同じ分岐） | `warriorHelmMat` `:1136` | 0x9aa0a8 | 0.55 / 0.12 | キャップ・つば・耳 |
| 〃 | `clothAcc` | 剣士 trim 0xc99c47（金） / 影の旅人 0x8a5ad6（紫） | 0.85 / 0 | ネックゲイター / マフラー |
| 〃 | `clothMat` | classDef.color | 0.6 / 0.15 | パーカー・背中のフード・ポケット・袖（剣士） |
| 〃 | `clothMatFlat` | 〃 | 〃 | パンツ（剣士・影の旅人） |
| 影の旅人のみ | `wandererCoatMat` `:1154` | 0x5e5a6c | 0.8 / 0 | ショートコート・背中のフード・袖（T-4 Human Decision で先行） |
| 〃 | `wandererWhite` `:1206` | 0xe6e2da | 0.85 / 0 | 白いシャツ（T-4 先行） |
| 盗賊 | `clothAcc` | trim 0x60496c（紫） | 0.85 / 0 | パーカーのフード・パーカーの胴・長袖（`hoodieMat = clothAcc`） |
| 〃 | `rogueHoodMat` `:1313` | 0xc9a83a（黄） | 0.85 / 0 | 帽子（頭頂・つば）。`P.rogueHood` はこの帽子を指す |
| 〃 | `clothMatFlat` | color 0x3d5350（緑） | 0.6 / 0.15 | 胸当て・腰まわり・肩ベルト |
| 〃 | `clothMat` | 〃 | 〃 | オーバーオールのパンツ |
| 〃 | `longHairMat` / pouch | 直値 | 0.7 / 0.85 | ポニーテール・ポーチ |
| 魔法使い | `hatMatCone` / `hatMatBrim` `:1456-1459` | hatColor 未指定のため **`clothMat` そのもの** | ― | キャスケット・つば |
| 〃 | `clothMatFlat` | color 0x6cc4e8（水色） | 0.6 / 0.15 | タートルネック・パンツ |
| 〃 | `clothMat` | 〃 | 〃 | ロングコート・袖（既存の円筒） |
| 弓師 | `clothMat` | color 0x3f6080（青） | 0.6 / 0.15 | 帽子・天板・つば・パンツ・袖 |
| 〃 | `clothMatFlat` | 〃 | 〃 | 短丈上着 |
| 〃 | `clothAcc` | trim 0x78512d（茶） | 0.85 / 0 | 矢羽 |
| 〃 | quiver `:1619` / `archerFurMat` `:1634` | 0x5a4028 / 0xa89068 | 0.85 / 0.9 | 矢筒 / 襟 |

### 2-3. 上位職（`applyJobPromotionVisual`、転身中のみ）
| 職 | 新しく作る Material | 既存 Material の上書き（FACT） |
| --- | --- | --- |
| 共通 | `trimMat`（uj.trim、emissive 0.35）、`layerWhite` 0xe8e6df（T-4 先行） | 武器の scale のみ |
| 戦騎士 | `knightSteel` / `knightGold` / `knightDark`（metal texture、metalness 0.3〜0.55、Gold は emissive） | なし（肩当ては visible=false） |
| バーサーカー | aura ring（MeshBasic） | `P.rogueHood`（帽子）の color を capeColor に上書き、フードの material を `layerWhite` に差し替え（解除時に戻す） |
| 魔導士 | `robeTex`、`crystalMat`（emissive 0.9）、`circleMat`、`archHairMat` | **`matchRobeLook` で `P.clothMat` / `clothMatFlat` / `trimMat` / `trimMatFlat` / 帽子 / `beltMat` / `clothAcc` / `hairMat` を上書き**（ARCHMAGE_NAVY 等） |
| 鷹の目 | `hoodMat`（capeColor）、`featherMat`、beak | **`P.clothMat` / `clothMatFlat` の map を HAWKEYE_BODY に上書き** |

**FACT**: `clearJobPromotionVisual()` は `jobDecorMeshes` の破棄・可視性・scale・盗賊フードの material は戻すが、魔導士・鷹の目が上書きした基本 Material の色は戻さない（転身解除は `buildPlayer` の再構築に依存。`12-progression-ui.js:1968` 付近）。

### 2-4. Material の総数（概数）
- 全職共通: 約 15（skin / cloth / clothFlat / trim / trimFlat / belt / boot / 目 3 / hair / metal / dark / clothAcc / fur）+ 足元リング 1
- 職ごと: 剣士 1 / 影の旅人 3（helm + coat + white）/ 盗賊 3〜4 / 魔法使い 0〜2（hatColor 未指定なら 0）/ 弓師 2
- 上位職: 戦騎士 4〜5、バーサーカー 2、魔導士 4〜5、鷹の目 3〜4（いずれも共通の trimMat・layerWhite を含む）
- → 1キャラクターあたり **約 17〜25 個**

## 3. Material Sharing Map（副作用）
| 共有 | FACT | 副作用（INFERENCE） |
| --- | --- | --- |
| `CLASSES[key].color` / `.trim`（値） | プレイヤー（`buildPlayer`）に加え、同行ゲスト（`08-loot-equipment.js:1024-1025`、支援AI）、街道の NPC（`14-dungeon-road.js:264 / 271 / 279`）、剣の振りの VFX（`11-combat-actions.js:558 / 627 / 739`）、魔導士の魔法陣（`:774`）、投射物の色（`:1433`）、足元リング（`13-update-loop.js:815`）が読む | **`CLASSES` の color / trim を変えると、支援AI の見た目・攻撃 VFX・足元リングまで変わる**（T-5 の変更禁止範囲に波及）。→ T-5 の配色は `CLASSES` を変えずに、プレイヤー専用の値で行う必要がある |
| `clothAcc`（オブジェクト） | 値は `classDef.trim` のコピーだが、オブジェクトは `buildPlayer` 内の衣服・装飾専用（足元リング・VFX とは別オブジェクト） | `clothAcc.color` を変えても足元リング・VFX は変わらない。ただし 1キャラクター内で「剣士のゲイター＝影の旅人のマフラー＝盗賊のパーカー＝弓師の矢羽」のように **役割の違う部品を1つの Material が担っている** |
| `clothMat` / `clothMatFlat`（1キャラクター内） | 素体（胴・骨盤・四肢）と、T-4 の衣服（上着・パンツ・コート・オーバーオール等）が同じ Material | 「上着はネイビー、パンツはブルーグレー」のような **レイヤーごとの色分けは、今の Material のままではできない** |
| 魔法使いの帽子 | `hatMatCone = hatMatBrim = clothMat`（hatColor 未指定） | 帽子だけ濃くするには帽子用の分離が必要 |
| 盗賊の帽子 | `rogueHoodMat`（帽子専用）。バーサーカーが color を上書き | 帽子の色は独立して変えられる |
| 上位職の上書き | 魔導士・鷹の目が基本 Material を上書き | 基礎職の配色を役割別 Material に分けると、上位職の上書き先も合わせて直す必要がある |

## 4. T-4 で先行した色の変更
| 変更 | 場所 | 分類の候補（RECOMMENDATION、決定は Human） |
| --- | --- | --- |
| 職ごとの肌色（Human 確定値） | `SKIN_COLOR` | **T-4 の値を維持**（Human が「目と肌色これでOK」と確定。T-5 の範囲外として扱う案） |
| 目（大きさ・間隔・黒目・縦横比） | 数値のみ（Material 不変） | **維持**（形状側の確定値。T-5 の対象外） |
| 上位職の白いレイヤー（`layerWhite` 0xe8e6df） | 戦騎士の白いジャケット・袖、鷹の目のベスト、バーサーカーのフード・上着、魔導士の白いドレス | **T-5 の新配色に統合**（配色案の Off White 系や各職のサブ / アクセントの役割に置き換える。V-1 で「白いレイヤーが分かりやすい」と承認済みなので、役割は残す） |
| 影の旅人のコート・フード・袖（`wandererCoatMat` 0x5e5a6c）と白シャツ（`wandererWhite` 0xe6e2da） | 影の旅人 | **T-5 で正式に再設計**（配色案 Charcoal #30323A / Dark Purple #403454 / Shadow Purple #654F86 / Off White #D8D4D0 へ） |
| 影の旅人の武器の非表示 | `weapon.visible=false` | Material ではない。T-5 の対象外（別 Task） |

## 5. Proposed T-5 Palette Mapping（配色案 → 今の部品）
**INFERENCE**: 配色案の「メイン / サブ / アクセント / 補助」を、T-4 の衣服レイヤーへ次のように当てると、ほぼすべて **Material の値の変更と、役割別 Material の分離だけで実現できる**（Geometry 変更は不要。§9）。

| 職 | メイン | サブ | アクセント | 補助 / その他 | 今の色との距離（FACT） |
| --- | --- | --- | --- | --- | --- |
| 剣士 | パーカー・フード・パンツ → Deep Navy #263A55 | 袖・ポケット → Blue Gray #52657A | ベルト・留め具 → Warm Gold #C49A4A | ゲイター → Off White #E6E4DD、キャップ → Blue Gray / Navy | 今 color 0x35455e（近い）、trim 0xc99c47（ほぼ同じ） |
| 戦騎士 | 剣士を継承 | 白いジャケット → Cool Gray #9AA5B1 | 強化肩 → Muted Silver #C8CDD2 | ハーネス・ベルト → Warm Gold / Dark | 今は白（layerWhite）＋ steel |
| 魔法使い | コート → Light Blue #8FB9D6 | タートルネック → Off White #E7E8E5 | 杖 → Muted Gold #C7A45A | パンツ → Pale Blue Gray #B7C7D2、キャスケットは少し濃い Blue Gray | 今 color 0x6cc4e8（明るい水色、彩度高め） |
| 魔導士 | Deep Blue #334A72 | 上掛け / 袖口 → Indigo Purple #514B86 | Muted Gold | 白いドレス → Off White #E4E6E3 | 今 ARCHMAGE_NAVY 0x1c2440（濃い） |
| 弓師 | 上着・パンツ → Forest Green #315C50 | Blue Gray 系（**色コード未指定**） | Muted Gold 系（**未指定**） | 帽子・矢筒・襟は既存の茶系 | **今 color 0x3f6080（青）→ 緑へ大きく変わる** |
| 鷹の目 | Forest Green #315C50 | Deep Green #24463E | Muted Gold #B99652 | ベスト → Blue Gray #617A82 or Off White | 今 HAWKEYE_BODY 0x1c8c66（明るい青緑） |
| 盗賊 | パーカー → Muted Purple #5B4B78 | オーバーオール → Deep Green #304D45 | 帽子 → Warm Yellow #D2A83E | ブーツ・小物 → Dark Navy #263449 | 今 clothAcc 0x60496c（紫）・color 0x3d5350（緑）・帽子 0xc9a83a（黄）→ **ほぼ同じ構成** |
| バーサーカー | Charcoal Gray #45484D | Deep Red #8A3438 | Off White #E5E1D9 | Dark Brown #59483D | 今 フード・上着 白、帽子 capeColor 0x3a0a10 |
| 影の旅人 | コート → Charcoal #30323A | レイヤー / パンツ → Dark Purple #403454 | マフラー等 → Shadow Purple #654F86 | シャツ → Off White #D8D4D0 | 今 コート 0x5e5a6c、パンツ・素体 0x1a1622、マフラー 0x8a5ad6（= 影 VFX / 足元リングの trim と同じ値） |

## 6. Material 分離が必要な箇所
| # | 箇所 | 理由（FACT） | 最小案（RECOMMENDATION） |
| --- | --- | --- | --- |
| 1 | 全職の `clothMat` / `clothMatFlat` と衣服 | 素体と衣服が同じ Material で、衣服レイヤーごとに色を分けられない | **役割別の衣服 Material を1キャラクターあたり 2〜4 個**（例: outer / inner / bottom / accent）。各職の分岐で、衣服の割り当てだけを差し替える（Geometry・配置は不変） |
| 2 | 全職の配色の出どころ | `CLASSES.color / trim` は支援AI・VFX・リングと共有 | **`CLASSES` を変えず、プレイヤー専用の配色表（職 → 役割 → 色）を新設**（承認済み T-5 の「プレイヤー用マテリアル値の表」と同じ場所に置く案） |
| 3 | `clothAcc` の役割の混在 | 剣士のゲイター / 影の旅人のマフラー / 盗賊のパーカー / 弓師の矢羽が同じ Material | 役割別 Material（#1）へ移し、`clothAcc` は矢羽などの小物に残す |
| 4 | 魔法使いの帽子 | `hatMatCone = hatMatBrim = clothMat` | 帽子用の役割を配色表に持たせ、`hatColor` 経由か帽子専用の Material にする |
| 5 | 上位職の上書き | 魔導士・鷹の目が基本 Material を上書き、`clearJobPromotionVisual` で戻らない | 上位職も配色表の「上位職の役割色」を使う形へ（上書きの対象を役割別 Material に限定し、解除時に戻す） |
| 6 | 影の旅人のマフラーと影の紫 | マフラー（clothAcc）= trim 0x8a5ad6 = 足元リング・VFX の色 | マフラーを Shadow Purple #654F86 の衣服専用 Material に（影 VFX の trim は変えない） |

## 7. Matte / Semi-matte 変更候補（現在値 → 推奨候補 → Human 確認ポイント）
| Material | 現在値 | 推奨候補（INFERENCE） | Human 確認ポイント |
| --- | --- | --- | --- |
| 衣服（clothMat 系・役割別） | roughness 0.6 / metalness 0.15 / leather map + bump | 0.8〜0.9 / 0（map・bump は維持して色だけ変える） | 布らしさ・色の読みやすさ |
| trimMat 系（胸当て・膝球・脛当て・籠手・Pauldron） | 0.4 / 0.3 / emissive 0.12 | 0.55〜0.7 / 0.2〜0.3 / emissive 0〜0.05 | 金属の見え方、発光しすぎないか |
| `metalMat`（投げナイフ） | 0.35 / 0.7 | 0.45〜0.55 / 0.4〜0.5 | 武器の見え方（武器系は変えない選択肢も） |
| `warriorHelmMat`（キャップ） | 0.55 / 0.12 | 0.8 / 0（布のキャップとして） | キャップが金属に見えないか |
| `bootMat` | 0.6 / 0.2 | 0.7〜0.8 / 0.05〜0.1 | 革らしさ |
| 戦騎士 knightSteel / Gold | metalness 0.55 / 0.5、Gold emissive 0.16 | metalness 0.3〜0.4、emissive 0〜0.08 | 「重装一色にしない」方針との両立 |
| 魔導士 crystalMat（emissive 0.9）・circleMat | 発光 | **維持**（魔法エフェクト） | ― |
| skin / hair / 目 | 0.8 / 0.7 / Basic | 維持 | ― |

## 8. T-5 Scope Risk
| # | リスク | 内容 |
| --- | --- | --- |
| R-1 | **承認範囲** | 承認済み T-5 は「マット化（値の表）」。配色・役割別 Material・配色表は含まれない → §6 の承認の取り直しが必要 |
| R-2 | `CLASSES` の共有 | `CLASSES.color / trim` を変えると支援AI（変更禁止）・VFX・足元リングが変わる |
| R-3 | 上位職の上書きの戻し漏れ | 魔導士・鷹の目の基本 Material の上書きは、転身解除（再構築しない経路）で残る可能性（既存の挙動。T-5 で上書き先を変えると顕在化しうる） |
| R-4 | 弓師の色の大転換 | 今の弓師は青（0x3f6080）。配色案は Forest Green。「元の配色」との連続性をどこまで残すか |
| R-5 | バーサーカーの系統 | Human の T-5 実装指示では「盗賊系ではなく独立した荒々しい上位職」、Analyzer 指示では「盗賊 → バーサーカー」の継承。どちらを採るか |
| R-6 | 影の紫の重複 | 影の旅人のマフラーの色が影 VFX / 足元リングの trim と同じ値 |
| R-7 | 実際の見え方 | 見下ろし・暖色 / 寒色の照明・outline・bump で、色コードと画面の色が違う（例: 影の旅人のコートは酒場で黒く見えた） |
| R-8 | テスト | 色に依存するテストは無い（FACT: tests に class color の参照なし）。V-1 は目視 |

## 9. T-4 Scope Boundary
- **FACT**: §5 の配色は、既存メッシュの Material の割り当てと値の変更だけで実現できる。**Geometry・position・scale・rotation・parent の変更が必要な箇所は見つからなかった**
- **INFERENCE**: 役割別 Material の分離は「各衣服メッシュを作る行の第2引数（Material）を差し替える」だけで、形状・配置は変わらない
- 範囲外の可能性（Planner で明示）: 盗賊バーサーカーの「上半身レイヤー」の色分けを細かく（例: 上着の縁取り）したい場合は、縁取りの部品が無いため形状の追加が必要（T-5 の範囲外）

## 10. Planner への Input
1. 基準: `main` `2a9674b`（T-4 DONE、形状・頭身・シルエット・衣服構築は固定）
2. Human の配色案（上記 §5、画像「T-5 配色デザイン案（元の配色 × 新案のミックス）」）
3. 基礎職 → 上位職の色の継承方針（上位職は系統を引き継ぎ、サブ・アクセントの比率と明暗を変える。単純な色違いにしない）
4. 影の旅人: Charcoal × Dark Purple × Shadow Purple × Off White、全身黒にしない、影 VFX の紫と衣服の紫を分ける
5. Material 構造: `CLASSES` を変えないプレイヤー専用の配色表 + 役割別の衣服 Material（§6）
6. 承認済み T-5 のマット化（値の表）との統合（§7）
7. T-4 先行色の扱い（§4）
8. 上位職の上書きの整理（R-3）
9. 変更予定ファイルの候補: `src/legacy/parts/06-player-enemy.js`（必須）、`src/legacy/parts/05-rendering-rig.js`（配色表・値の表を BUILD 近傍に置く場合）、unit テスト（配色表の整合を確かめる場合、新規または既存）。**`01-character-creation.js` の `CLASSES` は変えない案**
10. V-1: T-4 と同じカメラ・照明・撮影セット（停止 4 方向・歩行・戦闘、影の旅人は酒場）で 8職 + 影の旅人を比較
11. T-5 用ブランチ（Persistence）の指定

## 11. 未解決事項
- 弓師のサブ / アクセントの色コード（「Blue Gray 系」「Muted Gold 系」のみ）
- バーサーカーを盗賊系として扱うか独立系統として扱うか（R-5）
- `furMat` など T-4 後に使われていない可能性がある Material の扱い（削除は T-5 の範囲か）
- 魔法使いのキャスケットの色（「Light Blue 主体に少し濃い Blue Gray」）の具体値
- 盗賊の小物「Warm Yellow / Dark Brown」の割り当て先

## 12. Human Decision が必要な事項
| # | 論点 | 選択肢（例） |
| --- | --- | --- |
| HDR-T5-1 | T-5 の範囲 | 承認済みのマット化に、配色（職・役割別の色）と役割別 Material の分離を加える（§6 の承認の取り直し） |
| HDR-T5-2 | 配色の出どころ | (a) `CLASSES` を変えず、プレイヤー専用の配色表を新設（推奨） / (b) `CLASSES` を変える（支援AI・VFX・リングも変わる） |
| HDR-T5-3 | 配色表の置き場所 | `05` の BUILD 近傍（承認済み T-5 の案） / `06` 冒頭 |
| HDR-T5-4 | T-4 先行色 | 肌色・目は維持 / 上位職の白いレイヤーは配色案へ統合 / 影の旅人は配色案で再設計（§4） |
| HDR-T5-5 | 弓師の色 | 配色案どおり緑へ（元の青から大きく変わる） / 青の要素をサブに残す |
| HDR-T5-6 | バーサーカーの系統 | 盗賊系を残す / 独立（Charcoal + Deep Red） |
| HDR-T5-7 | 質感の目標値 | §7 の候補から Human が選ぶ（武器・魔法エフェクトは変えない案） |
| HDR-T5-8 | 上位職の上書きの整理 | 上書き先を役割別 Material に限定し、解除時に戻す / 既存のまま |
| HDR-T5-9 | Persistence | T-5 用ブランチ名 |
| HDR-T5-10 | V-1 の手順 | 基礎4職 → 上位4職 → 影の旅人の段階ごとに V-1 するか、まとめて V-1 するか |
