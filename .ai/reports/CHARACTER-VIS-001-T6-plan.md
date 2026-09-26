# CHARACTER-VIS-001 / T-6 Planner（次の Work Item の範囲設計）

Planner / 2026-09-26 / Claude Code セッション / READ ONLY（source・tests・Task file・docs・Analyzer report を変更していない。commit / push なし）

表記: **FACT**（コード・git・既存画像で確認）/ **INFERENCE** / **RECOMMENDATION**。最終決定は Human。

---

## 1. Baseline
| 項目 | 値 |
| --- | --- |
| 基準 | `main` `7bce8db4fd32618d439119bde907408359ce3b2f`（T-5 DONE） |
| Planner branch | `claude/character-vis-001-t6-planner`（`a5d7b10` = Analyzer report の保存のみ） |
| ID の注意（FACT） | Task file の `T-6` は「支援AI の見た目の寄せ」として登録済み・**取り下げ済み**（D-5 = 除外）。本 report は Human の呼称に合わせて「T-6」と書くが、Task file 上の ID は Human 判断（P-D0） |

## 2. Analyzer Input
- `.ai/reports/CHARACTER-VIS-001-T6-analysis.md`（`a5d7b10`）
- G-A-1 = GAP-01（native 武器の装飾が固定 `goldTrim`、P-D9 と不一致）+ GAP-02（武器本体の質感が matte 方針の外）+ GAP-03（上位職の装飾メッシュと差し替え後の武器に輪郭線なし）
- G-A-2 = GAP-05（戦闘中の見た目の撮影・確認が存在しない）
- 関連: GAP-04（VFX・リングの色、G-D）、GAP-06 / 07（影の旅人の武器・NPC、G-B）、GAP-12（同一条件の撮影手段、G-B）、T-5 R-9（武器差し替え時の dispose）

## 3. T-6 Objective
T-1〜T-5 で確定したキャラクター本体（体格・顔・髪・衣服形状・配色・Material 分離・matte）を**変えずに**、Analyzer が G-A とした2件の Task 境界を決め、T-6 として実施する範囲・変更・検証・V-1 を定める。

## 4. G-A-1 Analysis（武器・装飾の Material と輪郭線）

### 4-1. 現状（FACT、`7bce8db`）
| 項目 | 実装 |
| --- | --- |
| weapon Material | `buildWeaponMesh()`（`06:96-`）内で毎回生成: `steel` 0xd8dce0（0.3 / 0.7）、`darkSteel` 0x9aa4ae（0.4 / 0.6）、`woodMat` 0x3a2818、`goldTrim` 0xc9a227（0.35 / 0.55）、ジェム（emissive 0.4、職ごとの色） |
| weapon decoration | native 武器（大剣・双剣 / 斧・杖・弓）の鍔・柄金具・環・爪・刀身の一部は `goldTrim`。**コメント上の設計意図**: 「8職業 武器設定画」準拠で全職共通のゴールド、ジェムの色だけ職ごと（`06:101-110`） |
| trim（role） | `buildWeaponMesh` の引数 `trimMat` を使うのは alt 武器の槍（翼・柄）と刀（鍔）だけ |
| shared Material | 生成時の武器は本体の role trim（`trimMat`）を共有（槍・刀）。`swapPlayerWeaponVisual()` は新しい単色の trim を作る（T-5 P-D9 で色は配色表の trim） |
| class-specific | ジェムの色、上位職の武器形状（`state.job` で分岐: 戦騎士の装飾剣、バーサーカーの両手斧、魔導士の大ジェム、鷹の目の大弓） |
| visual switching | `swapPlayerWeaponVisual()`: 転身の瞬間（`12:1967`）と酒場の武器種の持ち替え。旧武器を `traverse` で `geometry.dispose()` / `material.dispose()` |
| upper-class transformation | `applyJobPromotionVisual()` が装飾メッシュを `P.waist` / 腕 / 頭ピボットへ直接追加。`clearJobPromotionVisual()` が `traverse` で破棄（role Material は T-5 で除外済み） |
| outline | `addOutline()` は `buildPlayer()` 末尾の1回だけ（`06:2053`、`{always:true}`）。**差し替え後の武器・上位職の装飾には付かない**。`addXrayShell()`（壁越しの表示）も同じく末尾の1回だけ |
| support AI | `buildGuestCompanion()` は武器なし（円柱 + 球 + 棒状の accent）。T-6（旧）取り下げで範囲外 |
| noncombat display | `WEAPON_SOCKET`（`05`）で背中等へ収納。`weapon-stow.spec.js` で確認 |
| combat display | 手に持ち替え（`aimWeapon` 等）。戦闘中の撮影は無い（G-A-2） |

### 4-2. 分類
| 問題 | 解決手段 | 形状変更 |
| --- | --- | --- |
| 武器装飾の色の出どころ（固定ゴールド vs 配色表の trim） | Material のみ | 不要 |
| 武器本体の質感（metalness 0.55〜0.7、ジェム emissive 0.4） | Material のみ | 不要 |
| 差し替え後の武器・上位職装飾の輪郭線 | `addOutline` の呼び出し追加（Code） | 不要 |
| 差し替え時に共有 Material（本体の role trim、輪郭線の共有 ShaderMaterial）を `dispose` する既存処理（T-5 R-9） | Code（破棄対象の除外） | 不要 |
| 杖が画面上で小さく見える、双剣・斧が細い金色に見える（Analyzer §6 の画像の観察） | **形状（サイズ・太さ）** | **必要** |
- **INFERENCE**: 武器の形状・サイズ・位置は T-4 / T-5 で変更禁止とされ、Human が別途「武器」を設計対象として扱った記録は無い。形状の見え方は戦闘中の撮影（G-A-2）が無いと問題かどうか判断できない → **武器形状は T-6 に含めず、G-A-2 の結果で判断する別 Task**（P-D2）

## 5. G-A-2 Analysis（戦闘中のキャラクターの見た目）

### 5-1. 関係の整理（FACT）
| 要素 | 実装 | 分類 |
| --- | --- | --- |
| normal attack / auto combo | `CLIPS`（`05`）、`13-update-loop.js`、`core/swing-timing.js` | 戦闘システム / モーション |
| attack lunge | `core/attack-lunge.js` | 戦闘システム |
| dodge / hit stop | `13` / `11` | 戦闘システム |
| skill / ultimate | `11-combat-actions.js` | 戦闘システム / VFX |
| support AI | `08`（ゲスト）/ `07`（AI） | 支援AI（D-5 除外） |
| attack VFX | `spawnMeleeSwingVFX`（`10-input.js:543`）、魔法陣・投射物（`11`）。色は `CLASSES.trim` | VFX |
| weapon visibility | 武器メッシュ・収納・輪郭線 | **キャラクターの見た目**（G-A-1 と重なる） |
| clothing visibility | 衣服は可動部に付いて一緒に動く（T-4） | **キャラクターの見た目** |
| camera | `core/battle-camera.js`（戦闘 10.0m / 53°） | カメラ（仕様 14〜19） |
| outline | `addOutline` | **キャラクターの見た目**（G-A-1 と重なる） |
| readability | 上記の合成 | 評価項目 |

### 5-2. 判断
- **FACT**: 戦闘中の撮影・確認が存在しないため、戦闘中の見た目に「問題があるか」自体が未確認（Analyzer GAP-05）
- **INFERENCE**: 問題が見つかった場合、その多くは CLIPS（モーション）・VFX・カメラ・`13-update-loop.js` の変更を伴う。これらは T-1〜T-5 の変更禁止範囲で、戦闘システムの Task に属する。キャラクター本体側（衣服の貫通など）で直す場合も、原因の切り分け（モーション側か衣服側か）が先に要る
- **RECOMMENDATION**: G-A-2 は**実装 Task ではなく、まず「戦闘中の見た目の Analyzer（撮影 + 事実の記録）」**として扱う。実装の Work Item はその結果で切る

## 6. Candidate A（G-A-1 と G-A-2 を1つの T-6 に）
| 観点 | 内容 |
| --- | --- |
| scope | 武器・装飾の Material / 輪郭線 + 戦闘中の撮影と、見つかった問題の修正 |
| changed files | `06`、`player-palette.js`（または新モジュール）+ 見つかった問題次第で `05`（CLIPS）/ `10` / `11` / `13` / `core/*` |
| dependency | G-A-2 の修正範囲が撮影結果まで決まらない |
| risk | 範囲が開いたまま承認することになる。戦闘システム（`13` は T-1〜T-5 で変更禁止）を巻き込む可能性 |
| test complexity | 高（Material・輪郭線の unit / E2E + 戦闘系 E2E 全般。baseline failure・FLAKY が戦闘系に集中している） |
| V-1 難易度 | 高（停止・非戦闘・戦闘の各段を全職で） |
| rollback | 難（Material・輪郭線と戦闘側の変更が混ざる） |
| 既存システムへの影響 | 大（戦闘の判定・タイミングに触れる可能性） |

## 7. Candidate B（T-6 = 武器・装飾の Visual、戦闘中の見た目は後続へ分離）
| 観点 | 内容 |
| --- | --- |
| scope | G-A-1（武器装飾の色の出どころ、武器の質感、差し替え後の武器・上位職装飾の輪郭線、差し替え時の共有 Material の破棄）。形状・位置・モーション・VFX は含めない |
| changed files | `06-player-enemy.js`、`src/render/player-palette.js`（武器の質感表を足す場合）、unit、E2E（新規）、必要なら `motion-preview.js` + `05` の snapshot（輪郭線の数の表示） |
| dependency | T-5（配色表・role Material）。P-D1（武器装飾の色の出どころ）が前提 |
| risk | 低〜中（輪郭線の追加で破棄処理を誤ると共有の輪郭線 Material を dispose する。§18） |
| test complexity | 中（unit のソース検査 + 輪郭線の数の E2E + 既存の `weapon-stow` / `battle-knight-visual` / `character-clothing` / `character-palette`） |
| V-1 難易度 | 中（8職の武器の停止・収納・手持ちと、上位職の装飾の輪郭線） |
| rollback | 易（`06` の武器・装飾と表に閉じる） |
| 既存システムへの影響 | 小（戦闘の判定・モーションに触れない） |

## 8. Candidate C（T-6 = 戦闘中の Visual、武器・装飾は別 Task）
| 観点 | 内容 |
| --- | --- |
| scope | 戦闘中の撮影と、見つかった問題の修正 |
| changed files | 撮影結果次第（`05` / `10` / `11` / `13` / `core/*` / `06`） |
| dependency | 撮影の手段（GAP-12: 9人を同一条件で撮れない）。武器の輪郭線が無いまま戦闘中を評価すると、G-A-1 の問題と戦闘の問題が混ざる |
| risk | 中〜高（範囲が撮影結果で決まる。戦闘システムに触れる） |
| test complexity | 高（戦闘系 E2E。baseline failure `execution-break:99`・FLAKY `job-traits:162` / `base-class-identity:413` / `air-actions:128` が同じ領域） |
| V-1 難易度 | 高（攻撃のピーク・コンボ・回避の瞬間の撮影） |
| rollback | 中〜難 |
| 既存システムへの影響 | 中〜大 |

## 9. Recommended Task Boundary（RECOMMENDATION）
**案 B を推奨**: 「T-6 = 武器・装飾の Material と輪郭線の一貫性（G-A-1）」、戦闘中の見た目（G-A-2）は **T-6 完了後に READ ONLY の Analyzer（撮影 + 事実の記録）→ その結果で後続 Work Item**。

理由:
1. G-A-1 は根拠が FACT で揃っており（`goldTrim`・質感値・`addOutline` の呼び出し箇所）、変更が `06` の武器・装飾と表に閉じる。G-A-2 は問題の有無自体が未確認で、承認時点で範囲を閉じられない
2. G-A-2 の撮影は、武器・装飾の輪郭線と質感が整ってから行う方が、「武器の見た目の問題」と「戦闘・モーションの問題」を切り分けやすい（依存: B → G-A-2）
3. 戦闘系のテストには既知の baseline failure / FLAKY が集中しており、Material と輪郭線の変更と同じ Task にすると FAIL の帰属が曖昧になる
4. T-1〜T-5 と同じく「キャラクターの見た目」の Task として、戦闘システム（`13` 等）の変更禁止を維持できる

## 10. Scope（案 B）
| # | 内容 | 種別 |
| --- | --- | --- |
| S-1 | 武器装飾（native 武器の `goldTrim` 部位）の色の出どころを P-D1 の決定に揃える（(a) 全職共通ゴールドを維持し、値を表へ移すだけ / (b) 配色表の trim にする / (c) 配色表に武器装飾専用の色 `weaponTrim` を足す） | Material |
| S-2 | 武器本体の質感（`steel` / `darkSteel` / `goldTrim` / `woodMat` / ジェムの emissive）を表から読む形にし、matte 方針に寄せた値にする（具体値は §12、最終は V-1） | Material |
| S-3 | `swapPlayerWeaponVisual()` で作り直した武器（オフハンド含む）に輪郭線（と X 線シェル。P-D4）を付ける | Code（輪郭線） |
| S-4 | `applyJobPromotionVisual()` の装飾メッシュ（戦騎士・魔導士・鷹の目・バーサーカー）に輪郭線（と X 線シェル。P-D4）を付ける。解除時に一緒に外れる | Code（輪郭線） |
| S-5 | 破棄処理（`swapPlayerWeaponVisual` の旧武器、`clearJobPromotionVisual` の装飾）で、共有 Material（本体の role Material、輪郭線の共有 ShaderMaterial、X 線 Material）を `dispose` しない（T-5 R-9） | Code |
| S-6 | 生成時と差し替え時で武器の Material の作り方を揃える（差し替え時の単色 trim → 生成時と同じ作り方） | Material / Code |

## 11. Out of Scope（案 B）
- 武器の形状・サイズ・位置・収納位置（`WEAPON_SOCKET`）・持ち方（P-D2 で別 Task 化を推奨）
- キャラクター本体（BUILD・頭身・顔・髪・衣服形状・T-5 の配色・role Material の値）
- モーション（STANCE / CLIPS / 歩行 / 攻撃 / 回避）、Hit Stop、Lunge、カメラ、`13-update-loop.js`
- 攻撃 VFX・魔法陣・投射物・足元リングの色（GAP-04、P-D5）
- `CLASSES.color` / `trim`、`UPPER_JOBS` の trim / capeColor
- 支援AI・NPC・敵・ボス（輪郭線を含む）
- 影の旅人の武器・素手・設定（P-D6）
- 輪郭線そのものの太さ・色・方式（`outlineMats` / `makeOutlineMat`）
- Playwright 設定、`textures.js`

## 12. Material Architecture（案 B）
| 層 | 責務 | 置き場所 |
| --- | --- | --- |
| 服（T-5） | role Material の色と質感 | `player-palette.js` の `PLAYER_PALETTE` / `PLAYER_FINISH`（**変えない**） |
| 武器の質感 | `steel` / `darkSteel` / `goldTrim` / `wood` / ジェムの emissive の値 | **案**: `player-palette.js` に別 export `WEAPON_FINISH`（プレイヤーの見た目の表を1か所に保つ）。代案: 新規 `src/render/weapon-materials.js`（P-D3） |
| 武器装飾の色 | P-D1 (a) なら `WEAPON_FINISH` の固定色、(b) なら `resolvePalette(key).trim`、(c) なら配色表の行に `weaponTrim` | P-D1 に従う |
| ジェムの色 | 職ごと（`buildWeaponMesh` の直値） | 変えない（形状と同じく武器設定画の要素） |
| 輪郭線 | `outlineMats()` の共有 ShaderMaterial（dark / rim） | 変えない（呼び出し箇所を増やすだけ） |
| `CLASSES.color` / `trim` | 支援AI・NPC・VFX・リング | 変えない |
- 質感の候補（RECOMMENDATION、V-1 で確認）: `steel` 0.3 / 0.7 → 0.45〜0.55 / 0.45〜0.55、`darkSteel` 0.4 / 0.6 → 0.55 / 0.45、`goldTrim` 0.35 / 0.55 → 0.55 / 0.35（T-5 の上位職 trim・戦騎士 gold と同程度）、ジェム emissive 0.4 → 0.2〜0.4（職の識別に使われているため下げ過ぎない）。刃物の金属感をどこまで残すかは Human 判断（P-D1 と同時に V-1）
- 武器 Material は武器ごとに生成し、本体の role Material と共有しない（S-6）。例外として P-D1 (b) の場合も色だけ配色表から取り、オブジェクトは別にする（差し替え時の dispose で本体を巻き込まないため）

## 13. Outline Strategy（案 B）
- 方式: 既存の `addOutline(root, {always:true})` と `addXrayShell(root)` を、新しく追加するメッシュの root（差し替え後の武器グループ・オフハンド、上位職の装飾メッシュ）に対して呼ぶ。輪郭線の見た目（太さ・色・rim）は既存の共有 Material のまま
- 二重付与の防止: `addOutline` は `userData.isOutline` / `noOutline` を除外する。既に輪郭線の付いたメッシュに再度呼ばない（装飾は毎回新規なので問題ない）。`noOutline` の既存指定（足元リング・オーラ等の効果）は尊重する
- 破棄: 装飾・旧武器の `traverse` 破棄で、`userData.isOutline` / `isXray` のメッシュは geometry を共有しているため geometry の二重 dispose は無害、**Material は共有なので dispose しない**（S-5）
- 対象外: 魔法エフェクト系のメッシュ（魔導士の結晶・魔法陣、バーサーカーのオーラ）は輪郭線を付けない（`noOutline` か filter で除外）。鷹・羽は装飾として付ける（P-D4 で確認）

## 14. Shadow Traveler Handling（FACT と方針）
| 項目 | 現在（FACT） | 仕様 / 設定 | T-6（案 B）での扱い |
| --- | --- | --- | --- |
| weapon visual | 剣士の kit の大剣を生成し `visible = false` | `docs/CHARACTERS.md`: 最終的に素手の想定、素手の演出は未実装 | **変えない**。非表示の武器には輪郭線の追加も不要（`swapPlayerWeaponVisual` で作り直した場合も `visible = false` を維持することだけ確認） |
| 武器を持たない設定 | 設定は素手、実装は剣士の攻撃・判定・モーション | T-4 N-6 | 範囲外（P-D6、別 Task） |
| barehanded shadow attack | 未実装 | ― | 範囲外 |
| clothing | T-4 / T-5 で確定（Charcoal / Dark Purple / シルバーブルー / Off White） | ― | 変えない |
| shadow VFX | 攻撃 VFX・足元リングは `CLASSES.wanderer.trim` 0x8a5ad6 | 服の紫と別（HDR-T5-6） | 変えない |
| outline | 本体は `buildPlayer` の常時輪郭線 | ― | 変えない（影の旅人は上位職の装飾を持たない） |
- 注意（FACT）: 影の旅人は `classDef.key = 'warrior'` のため、`swapPlayerWeaponVisual` や武器の分岐は剣士として動く。現在 `visible = false` は `buildPlayer` 側で設定されている。差し替え経路でも非表示が保たれるかは実装時に確認（Acceptance に含める）

## 15. File Changes（案 B）
| ファイル | 変更 | 必須 |
| --- | --- | --- |
| `src/legacy/parts/06-player-enemy.js` | `buildWeaponMesh` の Material を表から、`swapPlayerWeaponVisual` の輪郭線・X 線・破棄、`applyJobPromotionVisual` の装飾への輪郭線・X 線、`clearJobPromotionVisual` の破棄 | 必須 |
| `src/render/player-palette.js`（または新規 `src/render/weapon-materials.js`、P-D3） | `WEAPON_FINISH`（と P-D1 (c) の場合 `weaponTrim`） | 必須 |
| `src/legacy/concat-plugin.js` | 新規モジュールにする場合のみ import 1行 | 条件付き |
| `tests/unit/player-palette.test.js`（または新規 unit） | 武器の質感表の範囲、`buildWeaponMesh` が固定値でなく表を読むことのソース検査、破棄処理が共有 Material を除外することのソース検査 | 必須 |
| `tests/character-weapon-visual.spec.js`（新規） | 8職 + 影の旅人: 輪郭線の無い表示メッシュが 0（上位職の装飾・武器を含む）、影の旅人の武器が非表示 | 必須 |
| `src/core/motion-preview.js` + `tests/unit/motion-preview.test.js` + `05` の snapshot | E2E 用に「輪郭線の無い表示メッシュの数」を出す行（`CLOTH` / `PAL` 行と同じ方式） | 条件付き（P-D7） |
| `docs/CHARACTERS.md` | 外見の節に武器の質感・輪郭線の記述（V-1 OK 後） | 必須（最後） |
| **変更しない** | `01`、`05` の Geometry・STANCE・CLIPS・`WEAPON_SOCKET`・`outlineMats`、`08`、`10`、`11`、`12`、`13`、`14`、`textures.js`、`playwright.config.js` | ― |

## 16. Test Strategy
| 種別 | 案 A | 案 B（推奨） | 案 C |
| --- | --- | --- | --- |
| unit | B の unit + 戦闘系の修正に応じた unit | 武器の質感表（範囲・キー）、`buildWeaponMesh` のソース検査（固定の質感値が残っていない）、破棄処理のソース検査（`isOutline` / `isXray` / role Material を dispose しない）、P-D1 に応じた色の出どころ | 修正次第 |
| character visual E2E | `character-clothing` / `character-palette`（不変の確認） | 同左（Geometry・配色が変わらないことの回帰） | 同左 |
| weapon E2E | 新規 + `weapon-stow` | **新規 `character-weapon-visual`**: 8職（トレーニング空間、転身済みを含む）+ 影の旅人（continue セーブ）で「輪郭線の無い表示メッシュ = 0」、影の旅人の武器 = 非表示。既存 `weapon-stow`（収納・抜刀）・`battle-knight-visual` | ― |
| combat E2E | 戦闘系全般 | **変更しない領域の回帰として全 E2E を1回**（判定・モーションに触れないため） | 戦闘系全般 + 新規 |
| screenshot / V-1 | 停止・非戦闘・戦闘 | §17 | 戦闘の瞬間 |
| existing regression | 全 E2E | 全 E2E（scratchpad の設定、約 1.5 時間） | 全 E2E |
- **baseline failure / FLAKY と T-6 の FAIL を分ける手順**（全案共通）:
  1. 全 E2E の FAIL / FLAKY が既知リスト（baseline: `execution-break.spec.js:99`・`mansion-escort.spec.js:126`、FLAKY: `job-traits.spec.js:162`・`base-class-identity.spec.js:413`・`air-actions.spec.js:128`）に含まれるかを照合
  2. 既知リストに無い FAIL は T-6 の FAIL 候補として、単独再実行 + `main` `7bce8db` での同じテストの実行で帰属を決める
  3. 既知リストの FAIL も PASS に数えない（Test Report に baseline / FLAKY として別記）
- 標準 `npm test` は Chromium revision 不一致で NOT_RUN（Playwright 設定は変えない）。E2E は scratchpad の設定（`executablePath` のみ差し替え）で実行

## 17. V-1 Strategy（案 B）
| 項目 | 内容 |
| --- | --- |
| 対象 | 8職（剣士・戦騎士・魔法使い・魔導士・弓師・鷹の目・盗賊・バーサーカー）。影の旅人は武器非表示のため「武器が見えないこと」の確認のみ |
| 撮影場所 | トレーニング空間（8職を同一カメラ・同一照明で撮れる唯一の場所。T-5 R-11 / Analyzer GAP-12）。酒場は武器の持ち替え（差し替え経路）の確認に使う場合のみ（主人公が章で固定されるため剣士のみ） |
| カメラ | 標準のカメラ高さ（T-2〜T-5 の V-1 と同じ）+ 武器の質感確認用に低いカメラ（`#set-camheight` で低め、T-4 の顔の撮影と同じ手順）を補助で |
| 撮影内容 | 停止（正面 / 斜め45°、武器を収納）、攻撃入力直後（武器を手に持った状態）、T-5 最終との並べ比較（武器の質感・装飾色の差）、上位職の装飾の輪郭線（戦騎士の肩、魔導士の上掛け・ドレス、鷹の目のベスト・フード・鷹、バーサーカーの上着） |
| Human が判断すること | (1) 武器装飾の色（P-D1 の選択肢を並べて比較）、(2) 武器の質感（金属感の残し方）、(3) 輪郭線が付いた上位職の装飾・武器の見え方（線がうるさくないか）、(4) 武器形状を別 Task で扱う必要があるか（P-D2 の判断材料） |
| 段階 | V-1a: 武器（8職、装飾色の候補を並べて）→ Human OK → V-1b: 上位職の装飾の輪郭線 → Human OK。各段階で OK を得るまで次へ進まない（T-5 の運用と同じ） |
| 撮影できないもの | 9人を同一場所に揃えること（影の旅人はトレーニング空間に出せない）。Human に報告済みの制約として扱う |

## 18. Risks
| # | リスク | 対策 |
| --- | --- | --- |
| R-1 | 破棄処理で共有の輪郭線 ShaderMaterial / X 線 Material / 本体の role Material を dispose し、次フレームで再コンパイル・表示の乱れ | S-5 と unit のソース検査。E2E で転身後に輪郭線が残ることを確認 |
| R-2 | 輪郭線の追加で描画コストが増える（装飾・武器 1 メッシュにつき shell 2〜3 枚） | 対象は数十メッシュ程度（INFERENCE）。既存のプレイヤー本体と同じ方式 |
| R-3 | 魔法エフェクト系（結晶・魔法陣・オーラ）に輪郭線が付くと見た目が変わる | `noOutline` / filter で除外。unit で検査 |
| R-4 | 武器の質感を下げると「金属らしさ」が減り、武器設定画との差が出る | P-D1 / V-1 で Human 判断。値は表に集約して戻しやすくする |
| R-5 | 影の旅人の非表示武器が差し替え経路で表示される | Acceptance に含め E2E で確認 |
| R-6 | 既知の baseline failure / FLAKY と T-6 の FAIL の混同 | §16 の手順 |
| R-7 | 輪郭線の有無を数える E2E 用の表示（P-D7）がデバッグパネルを増やす | T-4 の CLOTH / T-5 の PAL と同じ方式。本番の表示には影響しない |

## 19. Rollback
- 段階ごとに commit: (C1) 武器の質感表の追加（値は現状を再現）+ unit、(C2) `buildWeaponMesh` を表から読む形へ（見た目不変）、(C3) 質感・装飾色の変更（V-1a の対象）、(C4) 破棄処理の修正（S-5）、(C5) 輪郭線の追加（S-3 / S-4、V-1b の対象）、(C6) E2E・docs
- C2 までは見た目が変わらないため、C3（色・質感）と C5（輪郭線）を個別に revert できる
- main への統合は Human の指示でのみ

## 20. Acceptance Criteria（案 B）
1. 武器装飾の色が P-D1 の決定どおり（unit のソース検査 + V-1a）
2. 武器本体の質感が表から読まれ、V-1a で Human が承認した値（unit）
3. 差し替え後の武器（オフハンド含む）と上位職の装飾メッシュに輪郭線がある。魔法エフェクト系には無い（E2E: 輪郭線の無い表示メッシュ = 0、unit）
4. 転身・武器の差し替えの前後で、本体の role Material・輪郭線・X 線の共有 Material が dispose されない（unit のソース検査 + E2E で転身後も本体の輪郭線が残る）
5. 影の旅人の武器は非表示のまま（E2E）
6. キャラクター本体（Geometry・BUILD・配色・role Material の値）、武器の形状・位置・収納、モーション、VFX、`CLASSES` が不変（`character-clothing` / `character-palette` / `weapon-stow` PASS、差分検査）
7. build・unit PASS、全 E2E は既知の baseline failure / FLAKY 以外 PASS（FLAKY は PASS に数えない）
8. V-1a・V-1b の Human OK

## 21. Human Decisions Required
| # | 論点 | Planner の推奨 |
| --- | --- | --- |
| P-D0 | Task file 上の ID（`T-6` は取り下げ済みの支援AI の Task として履歴に残る） | `T-7` として起票し、会話上の「T-6」との対応を Task file に記録（ID の再利用は §7.2 に反する） |
| P-D1 | 武器装飾（native 武器の `goldTrim` 部位）の色: (a) 全職共通ゴールドを維持（武器設定画準拠、値を表へ）/ (b) 配色表の trim / (c) 配色表に武器装飾専用の色 | V-1a で (a)(b) を並べて Human が選ぶ。T-5 P-D9 の文言との関係もここで確定 |
| P-D2 | 武器の形状・サイズ（杖が小さい・双剣 / 斧が細い等）を T-6 に含めるか | 含めない。G-A-2 の撮影結果で別 Task を判断 |
| P-D3 | 武器の質感表の置き場所（`player-palette.js` の別 export か、新規 `weapon-materials.js`） | `player-palette.js` の別 export（プレイヤーの見た目の表を1か所に。新規モジュールなら `concat-plugin.js` の変更が増える） |
| P-D4 | 輪郭線を付ける範囲（上位職の装飾・差し替え武器に付けるか、X 線シェルも付けるか、鷹・羽を含めるか） | 付ける。X 線シェルも本体と揃える。魔法エフェクト系は除外 |
| P-D5 | 攻撃 VFX・足元リングの色（GAP-04）を扱うか | T-6 には含めない（HDR-T5-2 の再判断が必要なため別 Task） |
| P-D6 | 影の旅人の武器・素手・設定を別 Task にするか | 別 Task（戦闘システムに及ぶ） |
| P-D7 | E2E 用に Motion Preview へ「輪郭線の無い表示メッシュ数」の行を足すか | 足す（CLOTH / PAL と同じ方式） |
| P-D8 | 戦闘中の見た目（G-A-2）の扱い: T-6 完了後に READ ONLY の Analyzer を行うか | 行う（撮影 + 事実の記録。実装 Task はその結果で） |
| P-D9 | motion 変更を含めるか | 含めない |
| P-D10 | Persistence（T-6 の実装ブランチ名） | 候補 `claude/character-vis-001-t6-impl`（未作成） |
