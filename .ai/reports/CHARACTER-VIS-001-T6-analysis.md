# CHARACTER-VIS-001 / T-6 候補の Analysis（T-1〜T-5 完了後の現状と Gap）

Analysis: Analyzer（READ ONLY。source・tests・Task file・docs を変更していない）/ 2026-09-26 / Claude Code セッション

表記: **FACT** = コード・git・既存の撮影画像で確認した事実 / **INFERENCE** = FACT からの推測 / **RECOMMENDATION** = Analyzer の提案（決定ではない）。見た目の良し悪しの評価はしない。

---

## 1. Baseline
| 項目 | 値 |
| --- | --- |
| 基準 | `main` = `origin/main` = `7bce8db4fd32618d439119bde907408359ce3b2f`（T-5 DONE の Persistence commit を fast-forward 統合） |
| 作業ツリー | clean（本 report の作成のみ未追跡として増える） |
| 撮影の根拠 | T-5 V-1 用に撮影済みの画像（scratchpad、`7bce8db` と同一コードの `c762a4a` 以降で撮影。トレーニング空間 8職: 停止 4方向 / 歩行 / 攻撃入力 1.2 秒後、酒場: 影の旅人）。本 Analyzer では新規撮影をしていない |
| 注意（FACT） | Task file の Work Item **`T-6` は既に「支援AI（ゲスト仲間・デコイ）の見た目の寄せ」として登録され、Human 判断で取り下げ済み**（D-5 = 除外、2026-09-25）。AGENTS.md §7.2 により ID と履歴は残す。次の Work Item の ID は Human 判断（§19 HD-1） |

## 2. T-1〜T-5 Completion State（FACT: Task file の Work Items 表）
| ID | 内容 | Status |
| --- | --- | --- |
| T-1 | 非戦闘移動の腕の基準姿勢と上半身の歩き寄り化 | DONE |
| T-2 | 体格の再設計（キャラクター別の絶対値 BUILD・約5頭身・細身化、第3版） | DONE |
| T-3 | 関節の接続（関節キャップ球と断面の整合、骨盤） | DONE |
| T-4 | キャラクター性の再設計（頭部・顔・髪・被り物・服装 Geometry・シルエット・上位職の形状） | DONE（Review PASS、N-1〜N-8） |
| T-5 | 配色・Material・質感（再計画版） | DONE（Review PASS、Findings 0、R-1〜R-12、AC-3 部分確認） |
| T-6 | 支援AI の見た目の寄せ | **取り下げ**（D-5 = 除外） |
- D-4（決定済み）: 「今回はマット化まで。セル調・段階的陰影は別 Task」

## 3. Current Implementation Overview（FACT）
| 領域 | 実装箇所 |
| --- | --- |
| プレイヤーの構築 | `06-player-enemy.js` `buildPlayer()`（`:535-`）。体格 `BUILD`（`05`）、衣服 `makeGarmentLoft` / `makeOpenGarmentLoft`（`05`）、配色 `src/render/player-palette.js` + `applyPlayerPalette()`（`06`） |
| 上位職 | `applyJobPromotionVisual()` / `clearJobPromotionVisual()`（`06`）。呼び出し: `12-progression-ui.js:1967-1968`（転身の瞬間、その場で装飾を足す）、`14-hud-boot.js:1590-1591 / 1793-1794`（再生成） |
| 武器 | `buildWeaponMesh()`（`06:96-`）、`WEAPON_TYPES`（`11-combat-actions.js:104-`、職ごとに native / alt）、`WEAPON_SOCKET`（`05`、収納位置）、`swapPlayerWeaponVisual()`（`06`） |
| モーション | `STANCE` / `STANCE_ALT` / `CLIPS`（`05`）、`13-update-loop.js`（歩行・攻撃の更新） |
| 攻撃 VFX | `spawnMeleeSwingVFX(range, angle, colorHex, style)`（`10-input.js:543`）。色は `state.classDef.trim`（`11:558 / 627 / 739`）、魔導士の魔法陣 `spawnMagicCircleVFX(state.classDef.trim)`（`11:774`）、投射物 `11:1433` |
| 足元リング | `06:2030`（MeshBasic、`classDef.trim`）、毎フレーム `13:815` が `state.classDef.trim` を書く |
| 輪郭線 | `addOutline()`（`05:2129`）。呼び出しは `06:2053`（プレイヤー、`{always:true}`）、`06:4101`（一部の敵、`{rim:false}`）、`06:4809`（ボス）の3箇所のみ |
| ライティング | `02-world-common.js:55-92`: ACESFilmic、exposure 0.78、Hemisphere 0.42、Sun 1.1、Rim 0.16 |
| カメラ | `core/battle-camera.js`: 探索 `{dist 7.0, height 8.6}`、戦闘 `{dist 6.0, height 8.0}`（距離 10.0m、俯角 53.1°）、FOV 50（`02:38`）、高さのユーザー設定 5段階（`14-hud-boot.js:160`） |
| 支援AI | `buildGuestCompanion()`（`08-loot-equipment.js:1020-`）: 円柱の胴 + 球の頭、`cdef.color` / `cdef.trim` |
| NPC | 街道 `14-dungeon-road.js:261-279`（`cdef.color`）、酒場の影の案内人 `03-dungeons-mansion-temple.js` `buildTavern()`（円柱 + 球、外套 0x0c0a10） |
| テスト | `character-clothing` / `character-palette` / `character-motion` / `weapon-stow` / `battle-knight-visual` / `base-class-identity` 等、unit `lowpoly-primitives` / `motion-preview` / `player-palette` |

## 4. Basic Character Geometry（FACT）
- 頭身・体格: `BUILD` のキャラクター別絶対値（T-2 第3版、T-4 で不変）。`motionBodySnapshot` の HEADS 行で頭身を表示。T-3 の関節球・Pauldron、T-4 の顔（目の大きさ・間隔・黒目・縦横比）、影の旅人の平たい毛束は `7bce8db` でも T-4 / T-5 時点から差分なし（`git diff 2a9674b 7bce8db -- src` は Material とデバッグ表示のみ）
- 眉・口は無い（HDR-T4、追加しない決定）
- 手: 球（`SphereGeometry(B.forearm*1.12)`）+ 指（`fingerGeo`）
- **Gap 候補なし**。T-1〜T-5 の確定内容は維持されている（G-C）

## 5. Clothing（FACT、9キャラクター）
| キャラクター | 形状（T-4） | 色（T-5） | 形状で解決すべき点 / 色で解決すべき点 |
| --- | --- | --- | --- |
| 剣士 | キャップ・ゲイター・背中のフード・膝丈パーカー・すね丈パンツ・短いブーツ | 済 | パーカーが膝まで覆い、パンツ（sub）は画面上ほぼ見えない（FACT: T-5 V-1 画像）。sub の色は識別に寄与していない（INFERENCE） |
| 戦騎士 | 剣士 + 白系ジャケット・強化肩・ハーネス | 済 | 上位職の装飾メッシュに**輪郭線が無い**（§9 FACT） |
| 魔法使い | キャスケット・タートルネック・ロングコート・ワイドパンツ | 済 | ― |
| 魔導士 | 魔法使い + 上掛け・袖口・白いドレス・房飾り・銀髪 | 済 | 上位職の装飾に輪郭線が無い |
| 弓師 | 帽子・毛皮の襟・短丈上着・袖・ワイドパンツ | 済 | ― |
| 鷹の目 | 弓師 + 背中のフード・白いベスト・肩の鷹 | 済 | 弓師との差はベスト・フード・鷹・大弓（§10） |
| 盗賊 | パーカーのフード・帽子・パーカー・オーバーオール | 済（パーカー #526A78） | ― |
| バーサーカー | 盗賊 + 大きい白フード・白い半袖上着・オーラ | 済 | 白い層が上半身の大半を覆う（FACT: 画像）。上位職の装飾に輪郭線が無い |
| 影の旅人 | 毛束の髪・マフラー・背中のフード・ショートコート・白シャツ・長いパンツ | 済（マフラー #A3B1BF） | コートの前開きが狭く、白シャツは画面上ほとんど見えない（FACT: 酒場画像）。酒場の照明で全体が暗い（Human は A を選択済み） |
- 形状の不具合（貫通・破綻）は、既存の撮影画像の範囲（停止・歩行・攻撃入力 1.2 秒後）では確認されていない。攻撃のピーク・回避・被弾の瞬間の撮影は無い（§7）
- 残っている旧定義（T-4 N-8、FACT）: `makeWarriorBaseHelm` / `makeRogueHood` / `makeMageHatBrim` / `makeRogueMask` の実呼び出しは無い（関数定義とコメント・unit の複製のみ）。`WARRIOR_HELM_*` 定数、`MAGE_CONE_HEIGHT_ABS`、`06:1127` の `furMat`（生成のみで未使用）

## 6. Weapons（FACT）
| 系統 | native / alt（`WEAPON_TYPES`） | 上位職での変化（`buildWeaponMesh`） | 装飾 Material |
| --- | --- | --- | --- |
| 剣士 / 戦騎士 | 大剣 / 槍 | 戦騎士: 細く長い装飾剣 | 鍔・柄金具・柄頭 = 固定 `goldTrim` 0xc9a227、ジェム 0x2a6fd6 |
| 盗賊 / バーサーカー | 双剣 / 刀 | バーサーカー: 両手斧 | 刀身・鍔が `goldTrim`、ジェム 0x2a8f9e / 0xc0392b |
| 魔法使い / 魔導士 | 杖 / 魔法の剣 | 魔導士: 大きいジェム（紫 0x8a3fd4）と爪 | 環・爪・帯 = `goldTrim` |
| 弓師 / 鷹の目 | 小弓 / ボウガン | 鷹の目: 非対称の大弓 | 木部 + 金属部 |
| 影の旅人 | 剣士の kit（大剣） | ― | `weapon.visible = false`（見た目だけ非表示、T-4 Human Decision） |
- **P-D9 との差（FACT）**: T-5 P-D9「武器装飾は配色表の accent / trim 系に統一」に対し、`buildWeaponMesh` に渡される role trim（`trimMat`）を使うのは**槍（翼・柄）と刀（鍔）だけ**。native 武器（大剣・双剣・杖・弓）の装飾はコメントに記された設計（「8職業 武器設定画」準拠の全職共通ゴールド）どおり固定の `goldTrim` のまま。T-5 Review（§4 P-D9 = PASS）はこの点を検出していない
- **質感（FACT）**: 武器の `steel` 0.3 / 0.7、`darkSteel` 0.4 / 0.6、`goldTrim` 0.35 / 0.55、ジェム emissive 0.4。T-5 の matte 範囲（HDR-T5-9）の外。武器本体の質感変更は T-5 の範囲外（武器 = 変更禁止）として扱われていた
- **輪郭線（FACT）**: 生成時の武器は `buildPlayer` の `addOutline(group)` より前に追加されるため輪郭線が付く。`swapPlayerWeaponVisual()`（転身の瞬間・酒場での武器種の持ち替え）で作り直した武器には `addOutline` が呼ばれない → 輪郭線なし
- 収納: `WEAPON_SOCKET`（T-4 で剣士・戦騎士の刃を下向きに修正）。`weapon-stow.spec.js` PASS（T-5 Reviewer 再実行）
- 画面上（FACT: 攻撃入力 1.2 秒後の画像）: 杖は手元に短く見え、盗賊の双剣とバーサーカーの斧は前方へ突き出た細い金色の形として見える。弓・鷹の目の大弓・戦騎士の長剣は輪郭が大きい
- 影の旅人: 武器非表示のまま剣士の攻撃モーション・スイング VFX が出る（T-4 N-6、`docs/CHARACTERS.md` 記載どおり、素手の演出は未実装）

## 7. Combat Presentation（FACT / INFERENCE）
- モーション: `CLIPS` / `STANCE` は T-1〜T-5 で変更なし（T-1 は非戦闘の腕、T-2〜T-5 は変更禁止）。衣服は既存の可動部（胴・股関節・膝・肩・肘）に付いているため、攻撃・回避で一緒に動く（FACT: 構造）
- 攻撃 VFX の色（FACT）: `spawnMeleeSwingVFX` / 魔法陣 / 投射物 / 足元リングは `state.classDef.trim`（= `CLASSES` の基礎職の trim。`recomputeStats` は上位職でも key・trim を基礎職のまま）を使う
  | 系統 | VFX・リングの色（CLASSES.trim） | T-5 の服の配色 |
  | --- | --- | --- |
  | 剣士 / 戦騎士 | 0xc99c47（金） | trim #C49A4A（ほぼ同じ） |
  | 魔法使い / 魔導士 | 0x8260ab（紫） | Light Blue / Deep Blue + Muted Gold（紫の要素は魔導士の sub・帽子 Indigo のみ） |
  | 弓師 / 鷹の目 | 0x78512d（茶） | Forest Green / Blue Gray / Muted Gold / Off White |
  | 盗賊 / バーサーカー | 0x60496c（紫） | 盗賊 Deep Green / Dusty Blue / Warm Yellow、バーサーカー Charcoal / Deep Red（紫の要素なし） |
  | 影の旅人 | 0x8a5ad6（紫） | 服の紫と分離（HDR-T5-6、意図どおり） |
  - T-5 は HDR-T5-2 で `CLASSES` を変えない（支援AI・VFX・リングへ波及させない）と決めたため、**服の配色と VFX・リングの色が別系統になった**（意図された結果。ただし系統間の対応は未検討）
- 撮影の範囲（FACT）: 既存画像の「戦闘」は攻撃入力 1.2 秒後の1枚で、スイングのピーク・コンボ・Lunge・Hit Stop・回避・被弾・Perfect Brace・スキル・必殺技・支援AI 時の撮影は無い。**戦闘中の見た目（衣服の貫通、武器の見え方、VFX と服の関係）は未確認**（Gap の根拠不足。§13 GAP-05）
- 攻撃入力 1.2 秒後の画像（FACT）: 全職とも腕を前へ出した構えで、体は正面を向いたまま。戦騎士の画像に赤い半透明の範囲表示が写っている

## 8. Camera / Scale（FACT / INFERENCE）
- 探索: 距離 √(7.0²+8.6²) ≈ 11.1m、俯角 ≈ 50.9°。戦闘: 10.0m、53.1°。FOV 50
- 画面占有（FACT: 2560×1600 の全体画像、酒場の剣士）: キャラクターの縦は画面の約 23%。顔は帽子のつばの下で数十ピクセル
- 5.0頭身の見え方: 俯角 50° 以上の見下ろしでは頭部が手前に大きく見え、脚が短縮される（INFERENCE: 透視の性質）。頭身の数値（BUILD）と画面上の見かけの頭身は一致しない。Human は T-2〜T-5 の V-1 をこのカメラで確認している
- 高さのユーザー設定（低め −3 〜 高め +3）で見え方が変わる。V-1 は「標準」のみ
- **Gap 候補**: 「5.0頭身が画面上で成立しているか」の数値的な検証（画面上の頭 / 全高の比）は存在しない（G-D、Human 判断）

## 9. Material / Lighting（FACT）
- T-5 後: 服 0.85 / 0、trim 0.6 / 0.25 e0.04、ブーツ 0.75 / 0.08。肌・髪・目・武器本体・結晶は対象外
- 輪郭線: プレイヤーは dark 0.032（常時）+ rim 0.014（常時、クリーム色 0xdcd0b0）。**上位職の装飾メッシュ（戦騎士の肩・ハーネス、魔導士の上掛け・ドレス、鷹の目のベスト・フード・鷹、バーサーカーの上着・袖）と、`swapPlayerWeaponVisual` の武器には輪郭線が無い**（`addOutline` の呼び出しが `buildPlayer` 末尾のみのため）。基礎職の衣服とは線の有無が違う
- ライティングは場所ごと（`02:226 / 240` で exposure をシーン別に設定）。酒場は暖色・暗め、トレーニング空間は明るい寒色（FACT: 画像）。T-5 V-1 で、影の旅人の承認値は酒場で「ほぼ黒」と報告済み（Human は A を選択）
- 配色表の HEX と画面の見え方の差: 暗い色（影の旅人のコート #30323A、剣士のパーカー #263A55、盗賊のオーバーオール #304D45）は酒場の照明で黒寄りに見える（FACT: 画像）。T-5 の配色自体は確定済みのため変更案は出さない（G-D の観察事項）

## 10. 9-character Differentiation（FACT: T-5 V-1 画像 + 構造）
| キャラクター | 識別の手がかり | 分類 |
| --- | --- | --- |
| 剣士 | キャップ（耳状の突起）、膝丈パーカー、背中の大剣、Navy | 1. 十分に識別できる |
| 戦騎士 | 剣士の形 + 強化肩・長い装飾剣・Cool Gray のジャケット | 2. 似ているが形状差で識別できる（剣士と同色系） |
| 魔法使い | キャスケット、ロングコート、杖、Light Blue | 1 |
| 魔導士 | 魔法使いの形 + 房飾り・銀髪・魔法石・Deep Blue / Indigo | 2 |
| 弓師 | 帽子（つば広）、襟、背中の弓・矢筒、Forest Green | 1 |
| 鷹の目 | 弓師の形 + 白いベスト・背中のフード・肩の鷹・大弓。**帽子・上着・パンツの色は弓師と同じ** | 2（形状差は装飾・武器に依存。INFERENCE: 見下ろしで鷹・ベストが小さく見える距離では弓師と近い。Human 判断） |
| 盗賊 | 黄色の帽子、フード、オーバーオール、双剣 | 1 |
| バーサーカー | 大きい白フード、白い上着、赤、両手斧、赤いオーラ | 1 |
| 影の旅人 | 被り物なし・毛束の髪・暗い全身・マフラー | 1（ただしトレーニング空間に出せず、他8人と同一条件で比較していない） |
- 3（色に依存）/ 4（識別性に問題の可能性）に明確に該当するものは無い。鷹の目は Human 判断（G-D）

## 11. NPC / Enemy Consistency（FACT）
| 対象 | 頭身・形 | 色 | 輪郭線 | 質感 |
| --- | --- | --- | --- | --- |
| プレイヤー | 5.0頭身、Loft の衣服 | 配色表 | dark + rim 常時 | T-5 matte |
| 支援AI（`buildGuestCompanion`） | 円柱の胴 + 球の頭（頭身・衣服なし） | `cdef.color` / `trim`（T-5 前の職色: 弓師は青 0x3f6080、盗賊は緑 + 紫） | 未確認（`addOutline` 呼び出し無し） | 0.8 / 0、trim 0.5 / 0.2 |
| 街道の NPC（`14:261-279`） | 簡易形状 | `cdef.color` | ― | ― |
| 酒場の NPC・影の案内人 | 円柱 + 球（FACT: 酒場画像）。影の案内人は外套 0x0c0a10（黒） | 直値 | ― | ― |
| 通常の敵 | 独自の低ポリ | 独自 | `{rim:false}` の一部のみ、ドットモード時のみ表示 | 未調査 |
| ボス | 独自 | 独自 | `addOutline(g)`（dark はドットモード時、rim 常時） | 未調査 |
- **差分**: プレイヤーだけが 5.0頭身・衣服・T-5 配色・常時輪郭線を持つ。支援AI・NPC は簡易形状で、支援AI は T-5 前の職色のまま（例: 弓師のプレイヤーは緑、弓師のゲストは青）。影の案内人（酒場の NPC）は黒い外套で、プレイヤーとしての影の旅人（Charcoal / Dark Purple / シルバーブルー）と見た目が違う
- 支援AI の見た目の統一は T-6（取り下げ、D-5 = 除外）で Human が範囲外と決めている

## 12. T-4 / T-5 Record-only Notes の分類
| Note | 内容 | 分類 | 根拠 |
| --- | --- | --- | --- |
| T-4 N-1 / N-2 / N-7 | Task file の運用（承認欄の書き換え、Status の据え置き、同梱 commit） | 記録だけでよい | コード・見た目に影響なし。完了済み |
| T-4 N-3 | 承認済み計画からの変更が多い | 記録だけでよい | すべて Human Decision で記録済み |
| T-4 N-4 / T-5 R-12 | FLAKY（`job-traits:97` / `:162`、`base-class-identity:413`、`air-actions:128`）、baseline failure（`execution-break:99`、`mansion-escort:126`） | **別 Task** | キャラクターの見た目と無関係の戦闘・モーション判定。main でも再現 |
| T-4 N-5 / T-5 §11 | 標準 `npm test` NOT_RUN（Chromium revision 不一致） | 別 Task（環境） | Playwright 設定を変えない制約。実行環境側の問題 |
| T-4 N-6 | 影の旅人の武器（見た目だけ非表示）と `docs/CHARACTERS.md` の設定の食い違い | **別 Task**（Human の設定判断が先） | 武器システム・設定（素手か否か）の決定が必要。見た目だけの Task ではない |
| T-4 N-8 / T-5 §8 | 旧定義（兜・マスク・三角帽子）・`furMat` の残存 | 別 Task（小さな整理） | 動作に影響しないが unit の複製がある。削除は unit の変更を伴う |
| T-5 R-1 / R-2 / R-3 | 同一セッション兼務、Plan Handoff 無し、Task 行の列更新 | 記録だけでよい | 運用上の記録 |
| T-5 R-4 | 古いコメント（`06:1311-1321`、palette の「候補値」表記） | 次 Task で対応してよい（触る場合のみ） | 誤解を招くが動作に影響なし |
| T-5 R-5 | タートルネックの陰影、帽子の DoubleSide | 記録だけでよい | V-1 で Human OK |
| T-5 R-6 | E2E が `userData.paletteHex` を読む（描画色ではない） | 記録だけでよい | 描画は V-1 で確認済み |
| T-5 R-7 | 鷹の目の sub / cape | 記録だけでよい | Human OK |
| T-5 R-8 | 魔導士の髪色の直接書き換え | 記録だけでよい（解除経路が生まれたら要対応） | P-D4、現状は実害なし |
| T-5 R-9 | 武器差し替え時の武器装飾の作り方・dispose | **次 Task の検討材料**（§6 の輪郭線・goldTrim とまとめて） | 武器の見た目の一貫性に関係 |
| T-5 R-10 | Reviewer が全 E2E を再実行していない | 記録だけでよい | コード差分なしを確認済み |
| T-5 R-11 | 9キャラクターを同一場所で撮れない | **別 Task 候補（テスト・撮影の仕組み）** | 上位職はトレーニング空間のみ、影の旅人は本編のみ。今後の V-1 でも同じ制約が出る |
| T-5 AC-3 | 転身解除の実機確認不能 | 記録だけでよい | ゲームに解除経路が無い |

## 13. Gap Inventory
| # | 領域 | Gap（FACT） |
| --- | --- | --- |
| GAP-01 | 武器 | native 武器の装飾が固定 `goldTrim`（P-D9 の「配色表の trim 系に統一」と不一致。T-5 Review で未検出） |
| GAP-02 | 武器・Material | 武器本体（steel / darkSteel / goldTrim / ジェム）の質感が T-5 の matte 方針の外（metalness 0.55〜0.7） |
| GAP-03 | 輪郭線 | 上位職の装飾メッシュと、差し替え後の武器に輪郭線が無い |
| GAP-04 | VFX・リング | 攻撃 VFX・魔法陣・投射物・足元リングの色（`CLASSES.trim`）と T-5 の服の配色が別系統。上位職は基礎職の trim を使う |
| GAP-05 | 戦闘中の見た目 | 攻撃のピーク・コンボ・回避・被弾・スキル・必殺技・支援AI 時の撮影・確認が存在しない（問題の有無自体が未確認） |
| GAP-06 | 影の旅人 | 武器非表示のまま剣士の攻撃モーション・VFX。設定（素手）と未整合（T-4 N-6） |
| GAP-07 | 影の旅人 | 酒場の NPC（影の案内人、黒い外套の円柱）とプレイヤーの影の旅人の見た目が違う |
| GAP-08 | 支援AI・NPC | 支援AI・街道 NPC が T-5 前の職色（`CLASSES`）と簡易形状のまま。プレイヤーとの差が T-5 で拡大（弓師: プレイヤー緑 / ゲスト青 など） |
| GAP-09 | カメラ | 5.0頭身・顔の見え方の画面上での数値的な確認手段が無い。V-1 は標準のカメラ高さのみ |
| GAP-10 | 識別性 | 鷹の目は服の色が弓師と同じで、差は装飾・武器（Human 判断） |
| GAP-11 | ライティング | 暗い配色が酒場の照明で黒寄りに見える（配色は確定済み。照明側の検討は未実施） |
| GAP-12 | テスト・撮影 | 9キャラクターを同一条件で撮る手段が無い（上位職 = トレーニング空間のみ、影の旅人 = 本編のみ、酒場の主人公は章で固定） |
| GAP-13 | コード整理 | 旧定義・`furMat`・古いコメントの残存 |
| GAP-14 | テスト基盤 | baseline failure 2件・FLAKY 4件・標準 `npm test` NOT_RUN |
| GAP-15 | 衣服 | 剣士の sub（パンツ）・影の旅人の白シャツが画面上ほとんど見えない（形状の被りによる。色では解決しない） |

## 14. G-A（T-6 として優先検討する価値があるもの）
| 項目 | GAP-01 + GAP-02 + GAP-03（武器・装飾の見た目の一貫性） |
| --- | --- |
| 対象 | `buildWeaponMesh()`（8系統の武器）、`swapPlayerWeaponVisual()`、`applyJobPromotionVisual()` の装飾メッシュ |
| 現状 | native 武器の装飾は固定ゴールド、武器本体は高 metalness、差し替え後の武器・上位職の装飾に輪郭線なし |
| 問題 / Gap | T-5 の承認事項（P-D9）との不一致、T-5 の matte 方針との質感差、輪郭線の有無の不統一 |
| 根拠 | §6・§9 の FACT（`06:96-` の `goldTrim`、`addOutline` 呼び出し3箇所） |
| 影響範囲 | プレイヤーの武器（8系統 + alt）と上位職装飾。敵・ボス・支援AI には影響しない |
| Geometry 変更 | 不要 |
| Material 変更 | 必要（武器装飾の色の出どころ、武器の質感） |
| Code 変更 | 必要（`06` の武器構築・差し替え・上位職装飾の輪郭線付与） |
| 他 Task との依存 | T-5（配色表）に依存。「8職業 武器設定画」準拠の全職共通ゴールドを維持するか（P-D9 の解釈）の Human 判断が先（HD-3） |
| 推奨粒度 | 1 Work Item（武器・装飾の Material と輪郭線）。武器の形状・位置は含めない |

| 項目 | GAP-05（戦闘中の見た目の確認） |
| --- | --- |
| 対象 | 8職 + 影の旅人の攻撃（コンボ各段のピーク）・回避・被弾・スキル・必殺技 |
| 現状 | 撮影・確認が無い。モーションは T-1〜T-5 で変更されていないが、衣服（T-4）と配色（T-5）は変わった |
| 問題 / Gap | 「立ち姿は改善されたが戦闘中に崩れる」問題の有無が不明（貫通・武器の見え方・VFX と服の関係） |
| 根拠 | §7 FACT（既存画像は攻撃入力 1.2 秒後のみ） |
| 影響範囲 | 調査のみなら無し。問題が見つかった場合は CLIPS・衣服・VFX に波及しうる |
| Geometry / Material / Code | 調査段階では不要（撮影用の一時 spec のみ） |
| 他 Task との依存 | GAP-12（撮影手段）と関連。GAP-04 の判断材料になる |
| 推奨粒度 | 先に「戦闘中の見た目の Analyzer（撮影 + 事実の記録）」を1段挟み、その結果で Work Item を決める |

## 15. G-B（別 Task として切り出した方がよいもの）
| 候補 | 対象 / 現状 / Gap | 根拠 | Geometry / Material / Code | 依存 | 推奨粒度 |
| --- | --- | --- | --- | --- | --- |
| GAP-06 影の旅人の武器・素手 | 武器非表示のまま剣士の kit。設定は素手 | T-4 N-6、`docs/CHARACTERS.md` | Code（攻撃・モーション・VFX）、場合により Geometry | Human の設定判断（HD-4）。戦闘システムに及ぶため見た目の Task ではない | 独立 Task（戦闘 + 見た目） |
| GAP-07 影の案内人 NPC と影の旅人 | 酒場 NPC は黒い外套の円柱 | `03` `buildTavern` | Geometry / Material / Code | GAP-06・設定判断 | GAP-06 と同じ Task か、NPC の Task |
| GAP-08 支援AI・NPC の見た目 | 簡易形状・T-5 前の職色 | `08:1020-`、`14:261-279` | Geometry / Material / Code | T-6 取り下げ（D-5）の再判断が必要 | 支援AI の Task（再起票は Human 判断） |
| GAP-12 撮影・V-1 の手段 | 9人を同一条件で撮れない | T-5 R-11、`14-hud-boot.js:1621` | Code（テストモード / デバッグの入口） | V-1 を伴う全 Task | テスト基盤の小 Task |
| GAP-13 旧定義・コメント整理 | 未使用の関数・定数・`furMat`・古いコメント | T-4 N-8、T-5 R-4 | Code（削除）+ unit の複製の整理 | なし | 小 Task（リファクタ） |
| GAP-14 FLAKY / baseline / NOT_RUN | 戦闘・モーション判定の不安定、環境 | T-4 N-4・N-5、T-5 R-12 | Code（テスト or ゲームロジック）/ 環境 | なし | テストの Debugger Task |

## 16. G-C（現状維持で問題ないもの）
| 項目 | 根拠 |
| --- | --- |
| 体格・頭身の定義（BUILD）、関節、顔、目、肌色、髪（影の旅人の毛束を含む） | T-2〜T-5 で Human 確定、`7bce8db` で維持（§4） |
| 衣服の形状（9キャラクター） | T-4 V-1 で Human OK、構築 E2E PASS |
| 服の配色・質感（T-5） | T-5 V-1 3段階で Human OK、Review PASS |
| 上位職の色の切り替え方式 | T-5 で全 role 上書きに整理、Review PASS（AC-3 部分確認は記録済み） |
| 武器の収納位置 | T-4 で修正済み、`weapon-stow` PASS |

## 17. G-D（Human の Visual 判断が必要なもの）
| 候補 | 現状（FACT） | 判断が必要な点 |
| --- | --- | --- |
| GAP-04 VFX・リングの色と服の配色 | VFX・リングは `CLASSES.trim`（魔法使い・盗賊は紫、弓師は茶）、服は T-5 の配色 | 服と揃えるか、VFX は別系統のままにするか（揃える場合は `CLASSES` / VFX 側の変更で、支援AI・NPC にも波及しうる。HDR-T5-2 の再判断） |
| GAP-09 カメラ・画面上の頭身 | 探索 11.1m / 51°、戦闘 10.0m / 53°、キャラクターは画面の約 23% | 画面上の見え方が「5.0頭身」の意図どおりか。カメラを変えるかどうか（カメラは戦闘設計 = 仕様 14〜19 に関わる） |
| GAP-10 鷹の目と弓師 | 服の色が同じ、差は装飾・武器 | 識別が十分か |
| GAP-11 暗い配色と照明 | 酒場で黒寄り | 照明（場所ごとの exposure）で扱うか、現状維持か。配色は確定済み |
| GAP-15 見えない sub / シャツ | 剣士のパンツ・影の旅人のシャツが隠れる | 形状（T-4 確定）を変えるか、現状維持か |

## 18. Technical Constraints（FACT）
- 上位職はテストモード（トレーニング空間）でのみ有効（`14-hud-boot.js:1621` `if(!legacyGrowth()) state.job = null;`）。影の旅人はテストモードの一覧に出ない（`hidden`）。酒場に入る主人公は章の進行で決まる
- 転身解除の経路はゲームに無い（`clearJobPromotionVisual` の呼び出し元は `applyJobPromotionVisual` のみ）
- `CLASSES` の color / trim は支援AI・NPC・VFX・足元リングが共有（HDR-T5-2 で不変と決定）
- 輪郭線は `addOutline()` をメッシュ構築後に1回だけ呼ぶ方式（後から足したメッシュには付かない）
- 武器の上位職分岐は `buildWeaponMesh` 内で `state.job` を見る（転身時は `swapPlayerWeaponVisual` で作り直す）
- repo の Playwright 設定は変更禁止。Chromium revision 不一致のため標準 `npm test` は NOT_RUN、E2E は scratchpad の設定で実行
- 全 E2E は約 1.5 時間。E2E 実行中にソースを編集すると dev server が差分を拾う

## 19. Human Decisions Required
| # | 論点 |
| --- | --- |
| HD-1 | 次の Work Item の ID（`T-6` は取り下げ済みの支援AI の Task として履歴に残っている。`T-7` とするか、別の扱いにするか） |
| HD-2 | 次に着手する領域（G-A の「武器・装飾の一貫性」か、「戦闘中の見た目の Analyzer」か、G-B / G-D のいずれか） |
| HD-3 | P-D9（武器装飾 = 配色表の trim）の解釈: native 武器の全職共通ゴールド（武器設定画準拠）を維持するか、配色表の trim へ揃えるか |
| HD-4 | 影の旅人の武器（素手にするか、非表示のまま剣士の kit を使うか）と設定の整理 |
| HD-5 | VFX・足元リングの色を服の配色と揃えるか（HDR-T5-2 の再判断を含む） |
| HD-6 | 支援AI の見た目（D-5 = 除外）を再検討するか |
| HD-7 | カメラ・照明（GAP-09 / GAP-11）を見た目の Task の範囲に入れるか |

## 20. Suggested Next-step Candidates（RECOMMENDATION。順位は付けない）
- **候補 1: 武器・装飾の Material と輪郭線の一貫性**（GAP-01 / 02 / 03、G-A）。Geometry 変更なし、`06` の武器構築と上位職装飾に閉じる。HD-3 が前提
- **候補 2: 戦闘中の見た目の Analyzer**（GAP-05、G-A）。READ ONLY の撮影と事実記録。結果次第で「戦闘中の衣服・武器・VFX」の Work Item を切る
- **候補 3: 影の旅人の武器・設定・NPC の整理**（GAP-06 / 07、G-B）。HD-4 が前提。戦闘システムに及ぶ
- **候補 4: VFX・足元リングの色**（GAP-04、G-D）。HD-5 が前提
- **候補 5: 撮影・V-1 の手段の整備**（GAP-12、G-B）。今後の全ての見た目の Task の V-1 に効く
- **候補 6: 小さな整理**（GAP-13 / GAP-14、G-B）
