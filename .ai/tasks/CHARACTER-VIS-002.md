# CHARACTER-VIS-002 — プレイヤーキャラクターのデザイン更新

Status: PLANNED（Work Item ごとの状態は下の表。今回の依頼は Analyzer / Planner まで。実装は Human の次の指示から）
優先度: 通常。WANDERER-RENEWAL-001（影の旅人の全面刷新）の後に行う（完了済み: PR #145 / #146 merge）

Analysis: .ai/reports/CHARACTER-VIS-002-analysis.md（branch `claude/wanderer-renewal-001-nhlxns` @ `51ed36ab32ccec5bb8f80181403016ec78156cc4`、blob `3fd9a39c31e926de017909dc1e58c1faa3affd38`）

- Kind: `analysis` / Persisted by: `Agent`
- Plan baseline: `claude/road-visual-003-r3-7` @ `3b168a227b577b136286cfedfe78626e620266f5`（PR #145・#146 を含む最新の積み上げ先）。`path:line` はこの版の行番号
- 比較資料（現状の撮影）: `.ai/reports/CHARACTER-VIS-002-assets/`（commit `f2806b7`）

## Artifact Handoff 検証（H-1〜H-8、AGENTS.md §5.2）
| # | 確認 | 結果 |
| --- | --- | --- |
| H-1 | `git merge-base --is-ancestor 51ed36a… origin/claude/wanderer-renewal-001-nhlxns` | PASS |
| H-2 | `git cat-file -e 51ed36a…:.ai/reports/CHARACTER-VIS-002-analysis.md` | PASS |
| H-3 | `git diff --name-only 51ed36a…^ 51ed36a…` → analysis の1件のみ | PASS |
| H-4 | Path と1行目 `# CHARACTER-VIS-002 Analysis` | PASS |
| H-5 | Kind `analysis` | PASS |
| H-6 | `git rev-parse 51ed36a…:<Path>` = `3fd9a39c31e926de017909dc1e58c1faa3affd38` | PASS |
| H-7 | 同じ `(Task ID, Kind)` の既存記録なし（本 Task file は DRAFT の登録だけで Analysis 行は無かった） | PASS |
| H-8 | `git show 51ed36a…:<Path>` で読んだ | PASS |

## Goal
Human の着手指示（2026-11-24）: 剣士・魔法使い・弓師・盗賊と各上位職について、各職業の個性・可愛らしさ・シルエット・装備・動作の特徴を維持しながら、キャラクター全体の完成度を引き上げる。単に見た目を変えるのではない。リアル化・ポリゴン数の増加を品質向上とみなさない。影の旅人は改修対象外（品質・造形・モーション設計の参考基準）。

## Request（今回の依頼の範囲）
- 今回は Analyzer / Planner のみ。ゲームコード・モデル・マテリアル・配色・モーション・仕様を変えない。成果物は調査レポートと本計画（と比較資料）
- PR は文書のみ。base は正しい積み上げ先（`claude/road-visual-003-r3-7`）。main への merge・本 PR の merge はしない

## Constraints
- AGENTS.md §3 / §10 / §13。新しいキャラクター生成システム・衣服システム・リグを作らない（既存の `buildPlayer()`・BUILD・Loft・可動部への取り付け・配色表を拡張する）
- CHARACTER-VIS-001 の Human Decision を守る（D-1・DEC-T2-9・HDR-T4-2・HDR-T4-4・HDR-T4-5 と各職のデザイン変更記録・HDR-T4-15・目と肌色の確定値・P-D0〜P-D11・T-7 P-D0〜P-D11）。変える必要がある箇所は下の Escalation
- 配色表の色（Human が V-1 で決めた値）を変えない。共有 Material の色の波及が起きない構造（T-5 の役割 Material・`applyPlayerPalette`・T-7 の dispose 除外）を保つ
- 影の旅人（DEC-034 / DEC-005 / DEC-030 / DEC-031）の見た目を変えない
- モーション（STANCE / STANCE_ALT / STANCE_RELAXED / CLIPS / 歩行 / `13-update-loop.js`）を変えない
- `CLASSES` の color / trim / 数値、セーブ形式、支援AI（D-5）、NPC・敵・ボス、Playwright 設定を変えない

## Current Implementation（FACT。出典は Analyzer report）
| 領域 | FACT | 出典 |
| --- | --- | --- |
| 組み立て | `buildPlayer()` 1つで全員の体を共通に作り、職ごとの分岐が被り物・衣服・小物を足す。上位職は `applyJobPromotionVisual()` で差し替え | report §2、`06:546` / `06:1143-1690` / `06:2303` |
| 体格 | BUILD の絶対値、全員 5.0頭身（DEC-T2-9） | `05:2018` |
| 顔 | 頭は顎の細い5段の Loft（顎 0.38 / 頬 1.06）。目は 8 / 6 / 4 点の板、眉・口なし | `05:738-745`、`05:1954-1975`、`06:869-893` |
| 髪 | 全職共通の殻 + 円錐の房。魔法使いの「長く広がった髪」は未実装 | `06:916-1100`、CHARACTER-VIS-001 T-4 記録 |
| 撮影の所見 | 顔が大人びる / 目の角 / つばで目が隠れる（弓師・鷹の目・盗賊・バーサーカー）/ 体が四角い筒 / 待機姿勢が同じ / 髪の作り分けなし / X 線シェルの自己遮蔽 | report §3 O-1〜O-10 |
| 負荷 | 1人で表示メッシュ 285〜361、描画回数 300〜376（部品 × 4: 本体・輪郭線2枚・X 線） | report §4 |
| 影の旅人 | 剣士の分岐で作られ、BUILD・頭・目・腕・脚などの共通部品を共有 | report §9 R-1、`06:1175` |
| 古い鎧の部品 | 胸当て・膝の球・脛当て・足首の帯・籠手・肩当てが共通の体に残る（多くは衣服の下） | `06:664-690`、`06:732`、`06:1740`、`06:1777` |
| セーブ | 外見はセーブに無い | report §2 |

## 全体設計（Planner）
**方針: 「デザインを作り直す」のではなく「承認済みのデザインを、可愛く・読みやすく作り直す」**（Escalation E-3 の推奨案 A）。
過去の改修で可愛さが失われた原因（report Root Cause の INFERENCE: 頭が小さい・顎が細い・角の立った目・平らな筒）を、
衣服の種類や配色に手を付けずに、**顔・頭・目・面の丸み・量感・被り物の位置・髪**で直す。

### 共通化するもの / 職ごとに残すもの
| 共通化する（基盤の品質） | 職ごとに残す・強める（個性） |
| --- | --- |
| 頭身と体格の作り方（BUILD の算出式・`checkBuild`）。値は系列ごと | 体格の値（剣士がしっかり、魔法使いが細く縦長、盗賊が小柄）|
| 頭の Loft の作り方（下半分の丸み） | 被り物・髪型・顔の印象（目の色・肌色）|
| 目の3層の品質（板の滑らかさ）。4つの確定値は全員共通のまま | 衣装のシルエット（剣士の膝丈パーカー、魔法使いのロングコート、弓師の短丈上着、盗賊のオーバーオール）|
| 衣服の Loft の断面の品質（角の取り方・段数の基準） | 配色（配色表の行）|
| 関節・接続（首と襟、袖と手首、裾とブーツ） | 武器の持ち方・構え・動作（モーションは変えない）|
| Material の管理（7 role + 配色表）・輪郭線の方式・描画回数の予算 | 上位職の差し替え部品（白いレイヤー・ハーネス・銀髪・大弓・白いフード）|

**全員を同じ顔・同じ体型・同じ衣装構造に寄せない**: 共通化は「作り方と品質の基準」だけで、形の値（BUILD・被り物・衣服の寸法）は職ごとに持つ。

### 評価基準（各 Work Item の V-1 で使う。依頼文 §8）
| 評価項目 | 何を見るか（Human の目視。Agent は数値を合格の代わりにしない）|
| --- | --- |
| 可愛らしさ | 親しみやすいか。変更前の画像と並べて「硬く・大人びて」なっていないか |
| 職業の識別性 | ゲームカメラ（844×390）・武器収納状態で4職が分かるか |
| シルエット | 黒く塗りつぶした影でも職が分かるか（Agent が撮影で塗りつぶし画像を作る）|
| 造形品質 | 部位のつながり（首・手首・裾）、面の丸み、角の不自然さ |
| 統一感 | 9人を並べて同じゲームのキャラクターか |
| 独自性 | 変更前の魅力（各職の「残す特徴」）が残っているか |
| モーション適合 | 停止・歩行・構え・攻撃・回避で貫通・破綻が無いか |
| 技術品質 | 描画回数・三角形・Material 数が予算内、build / unit / E2E PASS |

## Work Items
| ID | Summary | Status | Approval | 依存 | 見た目の変化 |
| --- | --- | --- | --- | --- | --- |
| T-0 | 基準づくり: 影の旅人の切り離し、外見の計測行、見えない古い鎧の部品の整理 | APPROVED（Agent Approval）| [x] | なし | **なし**（変化しないことを撮影の差分で確認）|
| T-1 | 共通の顔・頭（頭の下半分の丸み、目の板の滑らかさ、首と襟の接続）と頭身の比較 | WAITING_APPROVAL | [ ] | T-0、E-1・E-2・E-4 | あり（全員）|
| T-2 | 剣士（パイロット）: パーカー・ゲイター・袖・裾・ブーツの量感と接続。戦騎士への継承の確認 | WAITING_APPROVAL | [ ] | T-1、E-3 | あり |
| T-3 | 魔法使い: 長く広がった髪（承認済み設計の実装）、コートの前開き・袖、キャスケットの丸み | WAITING_APPROVAL | [ ] | T-2、E-3 | あり |
| T-4 | 弓師: 帽子の位置とつば（目を出す）、毛皮の襟、短丈上着の裾 | WAITING_APPROVAL | [ ] | T-2、E-3 | あり |
| T-5 | 盗賊: フードの丸み、帽子の位置、オーバーオールの胸当て | WAITING_APPROVAL | [ ] | T-2、E-3 | あり |
| T-6 | 上位職の仕上げ: 魔導士の銀髪・バーサーカーのフード・戦騎士 / 鷹の目の継承の調整 | WAITING_APPROVAL | [ ] | T-2〜T-5、E-3 | あり |
| T-7 | 描画回数の削減（見た目を変えない統合）と X 線シェルの自己遮蔽の修正 | APPROVED（Agent Approval）| [x] | T-0（T-1〜T-6 と並行しない）| 自己遮蔽の光る手が消える以外はなし |
| T-8 | 全体統合・品質確認: 9人の同一条件の V-1、`docs/CHARACTERS.md`、全 E2E、iPhone 実機 | PLANNED | [ ] | T-1〜T-7 | なし（確認のみ）|

- **実施順（推奨）**: T-0 → T-1 → T-2（パイロット）→ T-3 → T-4 → T-5 → T-6 → T-7 → T-8。並行実装はしない（前の Work Item の Review PASS と、見た目の変化がある Work Item は Human の V-1 OK の後に次へ）
- T-3〜T-5 の順番は入れ替え可（互いに依存しない）。T-7 は T-0 の後ならいつでも入れられるが、見た目を変える Work Item と同時には行わない（差分の切り分けのため）
- **本依頼では実装しない**。APPROVED の T-0 / T-7 も、実装の着手は Human の次の指示から

## Implementation Plan

### T-0 基準づくり（見た目を変えない）
| Step | ファイル / 関数 | 変更内容 | 理由 |
| --- | --- | --- | --- |
| 1 | `05` BUILD、`06` `buildPlayer()` | `BUILD.wanderer` を剣士の現在値の複製として追加し、影の旅人（charKey）はそれを使う。共通部（頭の Loft・目・手・脚）で T-1 以降に変える値は、影の旅人では現在値を使う分岐を用意する（値の表を `WANDERER_BODY_FREEZE` 等の1か所にまとめる）| R-1。共通基盤・剣士の改善が DEC-034 の見た目へ波及しないようにする（E-4 の推奨 A を先取りした「現状維持」なので、見た目は変わらない）|
| 2 | `05` `motionBodySnapshot()`、`src/core/motion-preview.js` | RIG ブロックに ` MESH  本体 / 合計  TRI n  MAT n` の1行（検証用。CLOTH / PAL / OUTL と同じ作法、本番 UI は不変）| 描画回数の予算を E2E で見張る（R-7）|
| 3 | `06` 共通の体 | 衣服の下で外から見えない古い鎧の部品（候補: 胸当て・脛当て・籠手・肩当て・足首の帯・膝の球。職ごとに見えているかを撮影で判定）を作らない。見えている部品は残す | 描画回数の無駄（1部品 = 4メッシュ）。承認済みの見た目を変えない |
| 4 | `tests/` | 影の旅人の外見の不変の検査（E2E: MESH 行・PAL 行が T-0 の記録値と一致）、描画回数の上限（各職の T-0 後の値 + 余裕 0）| 以降の Work Item の回帰の土台 |
| 5 | リポジトリ外（scratchpad） | 撮影手順（テストモード + 固定カメラ: 正面・斜め45°・側面・背面・顔・見下ろし・ゲーム画面 844×390、塗りつぶしシルエット）。T-0 の前後で画素の差分が無いことを確認 | V-1 の比較の土台。撮影比較テストの基盤はリポジトリに入れない（CHARACTER-VIS-001 Out of Scope を踏襲）|

### T-1 共通の顔・頭（Escalation E-1 / E-2 / E-4 の回答で確定）
| Step | ファイル / 関数 | 変更内容 | 理由 |
| --- | --- | --- | --- |
| 1 | `05` `HEAD_SECTION_RATIOS` | 頭の下半分を丸く（顎・顎線の widthMul を上げ、頬の最大幅の位置を下げる。候補値は撮影で3案作る）| O-1。顎の尖りが大人びた印象の主因（INFERENCE）|
| 2 | `05` `makeEyeSclera/Pupil/Highlight` | 板の点数を増やして角を取る（白目 8 → 12〜14、瞳 6 → 10〜12、ハイライト 4 → 6〜8）。**大きさ・間隔・瞳・縦横比の4つの確定値は変えない** | O-2。E-2 の推奨 A |
| 3 | `06` 首・襟 | 首の長さと襟（ゲイター・タートルネック等）の重なり。顔の下半分が隠れない高さへ | O-1（剣士のゲイター）。各職の襟は T-2〜T-5 で調整 |
| 4 | `05` BUILD（E-1 = A の場合のみ） | 全高を維持したまま headR を 5.0 / 4.75 / 4.5 頭身の3案で比較撮影し、Human が選んだ値を4系列へ。胴・脚は BUILD の絶対値で引き直し、`checkBuild` の整合を保つ | G-1。D-1 の範囲内の微調整（最終値は Human）|
| 5 | 被り物・髪の追従 | 被り物・髪・Coverage は headR 比なので自動で追従する。ずれた箇所だけ直す | H-a（HDR-T4-3）の作り方を維持 |
| 6 | `tests/unit/lowpoly-primitives.test.js` ほか | 目・頭の複製値の同期（assert を弱めない。CHARACTER-VIS-001 Human Decision 2 の前例）| R-8 |

### T-2 剣士（パイロット）
| Step | 対象 | 変更内容 |
| --- | --- | --- |
| 1 | ネックゲイター | 低く薄く。顎と口元の位置を出す（白い塊を小さく）|
| 2 | マウンテンパーカー | 肩の丸み、胸から裾への A ラインの広がり、前開きの縁・ポケットの厚み（平らな板をやめる）。丈・ポケットの数・フードは維持 |
| 3 | 袖・手首 | 袖口の段差、手首と手の球の接続 |
| 4 | パンツ・ブーツ | すね丈の裾とブーツの胴のつながり、ブーツのつま先の丸み |
| 5 | キャップ | 耳の突起は維持。つばの厚み・丸み |
| 6 | 戦騎士 | 剣士の改善が継承された上で、白いジャケット・ハーネス・強化肩が浮かない / 埋もれないかを確認し、ずれだけ直す |
| 7 | 影の旅人 | T-0 の不変の検査が PASS（剣士の変更が波及していない）|

### T-3 魔法使い / T-4 弓師 / T-5 盗賊（同じ手順を各職へ）
| 職 | 残す特徴（変えない）| 改善する造形 |
| --- | --- | --- |
| 魔法使い | 緑の目、水色のロングコート、キャスケット（候補 B の深さ）、杖、細く縦長の体格 | 長く広がった髪（承認済み設計の未実装分。房の円錐ではなく、帯状の板を重ねる影の旅人の髪の方式を参考）、コートの前開きの縁・襟を形で見せる、箱型の袖を細く、キャスケットの角を取る |
| 弓師 | 緑の帽子とつば、毛皮の襟、矢筒、日焼けした肌、身軽な体格 | 帽子を浅く・つばを短く（見下ろしで目が出る位置へ）、襟を細く（浮き輪に見えない太さ）、短丈上着の裾と袖 |
| 盗賊 | 黄色の帽子入りのパーカーのフード、オーバーオール、小柄な体格、腰の双剣 | フードの六角形の角を取る（Loft の点数・丸み）、帽子を目の上へ、胸当てに厚み、裾を軽く絞った形は維持 |

各職とも: 武器収納の干渉（P-R28）を確認し、必要なら `WEAPON_SOCKET` の収納の `off` だけ補正（HDR-T4-13 の範囲）。上位職（魔導士・鷹の目・バーサーカー）で継承の破綻が無いことを確認（直すのは T-6）。

### T-6 上位職の仕上げ
| 上位職 | 改善 |
| --- | --- |
| 戦騎士 | T-2 の確認で残った浮き・埋もれ |
| 魔導士 | 長い銀髪の板（扇状に開く）を T-3 の髪の方式へ寄せる。房飾り・結晶・上掛け・白いドレスは維持 |
| 鷹の目 | T-4 の帽子の改善の継承、背中のフード・ベストの浮き |
| バーサーカー | 白い大きなフードの角張り（T-5 のフードの丸みを継承）、半袖の上着 |

### T-7 描画回数の削減（見た目を変えない）
| Step | 内容 | 理由 |
| --- | --- | --- |
| 1 | 同じ可動部（親）・同じ Material で、転身・差し替えで表示を切り替えない部品を、組み立ての最後に1つのメッシュへまとめる（three の `BufferGeometryUtils.mergeGeometries`。three に同梱で依存の追加なし）。切り替える部品（`warriorBaseDecor` 等）と武器はまとめない | 描画回数の主因（部品 × 4）。輪郭線・X 線はまとめた後のメッシュに付くので見た目は同じ |
| 2 | X 線シェルの自己遮蔽（体の前の手が胴越しに光る）を直す。方式は Implementer が選ぶ（例: X 線シェルの描画をプレイヤー本体の深度で隠さない順序にする / 対象を外形の大きい部品に限る）| report O-9（既存の不具合）|
| 3 | 計測: T-0 の MESH 行で減少を確認し、E2E の上限を新しい値へ下げる | 回帰の防止 |

### T-8 全体統合・品質確認
- 9人を同一条件で撮影（基礎4職・上位4職はトレーニング空間、影の旅人は酒場。9人を1か所に揃えられないのは既知の制約）
- `docs/CHARACTERS.md` 「外見」節の更新（実装の事実だけ）
- 全 E2E、iPhone 実機の確認項目（下）
- CHARACTER-VIS-001 の Task Level の Status（全 Work Item DONE / 取り下げなのに PLANNED）を DONE へ直す記録の整合（本 Task の Status History に理由を残す）

## Files To Change（予定。承認された Work Item の行だけが有効）
| ファイル | Work Item | 内容 |
| --- | --- | --- |
| `src/legacy/parts/05-rendering-rig.js` | T-0 / T-1 / T-3〜T-7 | BUILD（`wanderer` の追加、頭身の値）、`HEAD_SECTION_RATIOS`、目の板の点数、被り物・髪の定数と Coverage、`motionBodySnapshot`、`addXrayShell` / 輪郭線の付け方、`WEAPON_SOCKET` の収納 `off`（必要な職だけ）|
| `src/legacy/parts/06-player-enemy.js` | T-0〜T-7 | `buildPlayer()`（共通の体・各職の被り物・衣服・髪・影の旅人の固定）、`applyJobPromotionVisual()`、部品の統合 |
| `src/core/motion-preview.js` | T-0 | RIG ブロックの MESH 行 |
| `tests/unit/lowpoly-primitives.test.js` | T-1〜T-6 | 複製値の同期、新しい構築の検査（assert を弱めない）|
| `tests/unit/motion-preview.test.js` | T-0 | MESH 行 |
| `tests/character-visual-budget.spec.js`（新規）| T-0 / T-7 | 9人の描画メッシュの上限、影の旅人の MESH / PAL の不変 |
| `tests/character-clothing.spec.js` | T-2〜T-6 | 衣服の数の下限が変わる場合だけ（下限を下げて通すことはしない。部品の統合で数が変わる場合は数え方を合わせる）|
| `docs/CHARACTERS.md` | T-8 | 外見の節 |
| 本 Task file | 全 | Implementation Result・Status・Status History |

## Files Not To Change
`src/legacy/parts/13-update-loop.js`、`src/legacy/parts/17-wanderer-style.js`、`src/core/wanderer-style.js`、`src/core/combat-stance.js`、STANCE / STANCE_ALT / STANCE_RELAXED / CLIPS、`10-input.js`、`11-combat-actions.js`（攻撃・判定）、`src/render/player-palette.js` の色の値（`PLAYER_PALETTE`）と `WEAPON_FINISH`、`01-character-creation.js` の `CLASSES` の color / trim / 数値・`CHAPTER_CAST`、`09-save-load.js`、支援AI（`buildGuestCompanion` / `buildCompanion` / `spawnPhantomDecoy`）、`14-dungeon-road.js` の加入前の影の旅人、NPC・敵・ボス、`playwright.config.js`、`basefile.html`

## Test Plan
| 区分 | 対象 | 確認 | 時期 |
| --- | --- | --- | --- |
| Build / Unit | `npm run build`、`npm run test:unit`（`ai-protocol.test.js` を含む）| PASS | 各 Work Item |
| E2E 対象 | `character-clothing`・`character-palette`・`character-weapon-visual`・`character-motion`・`weapon-stow`・`battle-knight-visual`・`base-class-identity`・`base-class-comparison`・`job-traits`・`wanderer-renewal`・`chapter1-progression`・`character-visual-budget`（新規）| PASS（FLAKY は PASS に数えない。§14）| 各 Work Item |
| 影の旅人の不変 | `character-visual-budget` の影の旅人の行、`wanderer-renewal`、`road-stranger`（unit）| T-0 の記録値と一致 | 各 Work Item |
| 描画の予算 | MESH 行（本体 / 合計）| T-0 の値を超えない（T-7 後は下げた値）| 各 Work Item |
| 撮影の差分 | scratchpad の撮影手順 | T-0 / T-7: 画素の差分なし（T-7 は自己遮蔽の箇所を除く）。T-1〜T-6: 変更前後の比較画像を Human へ | 各 Work Item |
| Full Regression | 全 E2E（CI）| PASS | T-0・T-2・T-7・T-8、および Review の前 |
| 目視 V-1 | 評価基準の表 | **Human OK**（見た目の変化がある Work Item の主 Acceptance）| T-1〜T-6・T-8 |

### iPhone 実機での確認項目（T-8、各 Work Item の PR でも該当分）
1. ゲーム画面（横向き）で4職と上位職が武器収納状態で見分けられる
2. 顔（目）が見下ろしのカメラで見える（弓師・鷹の目・盗賊・バーサーカーを重点）
3. 可愛らしさ: 変更前より硬く・大人びて見えない
4. 歩行・攻撃・回避で衣服・髪の貫通が目立たない
5. 酒場・トレーニング空間・道・時計塔で FPS の低下を感じない（戦闘中の敵が多い場面を含む）
6. 背中を向けて歩くときに手が光って見えない（T-7 後）
7. 影の旅人の見た目が変わっていない（加入前・加入後）

## Acceptance Criteria
- T-0 / T-7: 撮影の画素差分なし（T-7 の自己遮蔽を除く）、影の旅人の不変 PASS、描画メッシュが T-0 の値以下（T-7 は減少）、build / unit / 対象 E2E / 全 E2E PASS
- T-1〜T-6: Human の V-1 OK（評価基準の表）、各職の「残す特徴」が残る、配色表の色・`CLASSES`・モーション・武器の形・セーブに差分なし、影の旅人の不変 PASS、描画メッシュが予算内、build / unit / 対象 E2E PASS
- T-8: 9人の同一条件の V-1 OK、iPhone 実機の確認項目、全 E2E PASS、`docs/CHARACTERS.md` が実装と一致

## Risks
| # | リスク | 対応 |
| --- | --- | --- |
| P-R1 | 影の旅人への波及（report R-1）| T-0 で切り離し、以降は毎回不変の検査 |
| P-R2 | 承認済みデザインの退行（「整えたら可愛くなくなった」の再発、R-10）| 職ごとに「残す特徴」を Acceptance に入れ、変更前後を同じ条件で並べて Human が判断。1 Work Item = 1職 |
| P-R3 | 頭身の変更による武器・手・衣服のずれ（R-3 / R-4）| E-1 の回答が出るまで BUILD を変えない。変える場合は T-1 で `weapon-stow`・`character-motion` E-2 を含めて確認 |
| P-R4 | 衣服の量感と腕・脚・武器の貫通（P-R25〜R28）| 停止・歩行・構え・攻撃・回避の撮影。収納の補正は `off` のみ |
| P-R5 | 描画回数の増加（R-7）| 予算の E2E。部品を足す変更は同じ親・同じ Material へまとめる前提 |
| P-R6 | 部品の統合で転身の表示切り替えが壊れる（T-7）| 切り替える部品・武器はまとめない。上位4職の生成と `clearJobPromotionVisual` の E2E / unit |
| P-R7 | ソース検査の unit の大量の同期（R-8）| assert を弱めず、新しい構築を検査する形へ置き換える（前例どおり）|
| P-R8 | 「可愛さ」の判定が往復する | パイロット（剣士）で方向を固めてから他職へ。比較画像は3案までに絞る |

## Rollback
- 各 Work Item は独立した commit 群・PR にする。戻すときはその Work Item の commit を revert する（セーブ・仕様に影響しないので、データの移行は不要）
- T-0 の切り離しは他の Work Item の前提なので、T-0 を戻す場合は後続をすべて戻す
- T-7 の統合は組み立ての最後の1か所に閉じ、無効化（統合しない）で元の構成に戻せる形にする

## Out of Scope
- モーション（待機の立ち姿が全員同じ問題 = report O-5 / G-6 を含む）。必要なら別 Task（下の「次の Task 候補」）
- 配色の変更、武器の形・大きさ・持ち方、攻撃 VFX・魔法陣・足元リング
- 支援AI（D-5）、NPC・敵・ボス、加入前の影の旅人
- セルシェーディング・新しい Material 基盤、撮影比較テストの基盤
- 新しい職業・装備の着せ替え・キャラクターメイクの拡張

### 次の Task 候補（記録のみ。起票しない）
- 職ごとの待機の立ち姿（`STANCE_RELAXED`。手を前で組む姿勢が全員同じ）: 影の旅人の「腕を下ろした静かな立ち姿」と同様に、職の性格を立ち姿で出す。モーションの改修になるため、本 Task の後に Human が判断する

## 反対意見と代替案（Planner の検討）
| # | 反対意見 | 検討 | 結論 |
| --- | --- | --- | --- |
| C-1 | 共通造形を統一しすぎると個性が失われる | 共通化するのは「作り方と品質」だけで、形の値（BUILD・被り物・衣服）は職ごと。頭の Loft は全員共通だが、頭の大きさ・被り物・髪・目の色・肌色で分かれる | 採用（共通化の範囲を表で固定）|
| C-2 | Material を細分化すると描画負荷が増える | 描画回数は Material 数ではなく部品数で決まる（report §6）。role の追加はしない（P-D3 の7つのまま）| Material は増やさない。負荷は T-7 の部品統合で下げる |
| C-3 | 髪・衣装を作り込むと小さい画面で読みにくくなる | 作り込みは「角を取る・量感を足す・位置を直す」に限定し、細かい部品（ポケット・紐・留め具）は増やさない。見下ろしの 844×390 と塗りつぶしシルエットで判定 | 採用（小物の追加をしない）|
| C-4 | 上位職を別モデルにすると保守コストが増える | 上位職は今の「基礎職を継承して差し替える」方式（P-a）を維持。別モデルにしない | 別モデル案は不採用 |
| C-5 | 既存の魅力を残すため、変えない方がよい部分がある | 変えない: 配色・衣服の種類・剣士のキャップの耳・盗賊の黄色の帽子とオーバーオール・魔法使いの緑の目・弓師の肌色・上位職の白いレイヤー・目の4つの確定値・影の旅人。職ごとの「残す特徴」を Acceptance に入れる | 採用 |
| C-6 | 頭身を下げれば一気に可愛くなる（最も効果が大きい）| 効果は大きいが、Human が T-2 で選んだ「華奢で縦にスッとした」目的（DEC-T2-9）と衝突し、武器・手・衣服の位置も動く。D-1 の範囲（4.5〜5.0）なら Human の微調整として扱える | E-1 で Human に提示（推奨: D-1 の範囲内で比較）|
| C-7 | 眉・口を足せば表情が読める | 見下ろしのゲームカメラでは顔の面が浅い角度になり、描いた絵や小さな部品は読めない（CHARACTER-VIS-001 以前の Canvas 試作の記録 `06:799-812`）。HDR-T4-15 とも衝突 | E-2 で Human に提示（推奨: 足さない）|
| C-8 | 描画回数の削減を最初にやるべき | 統合は部品の作り直しの後の方が二度手間にならない。一方で予算の見張りは最初に要る | T-0 で計測と予算、T-7 で削減（順序の採否）|
| C-9 | 弓師を先にやるべき（顔が隠れる問題が最大）| 弓師は CHARACTER-VIS-001 T-4 のパイロットで、問題は帽子の位置に限られる。剣士は第一章の主人公で画面に出る時間が最長、戦騎士の土台で、影の旅人との共有が最も多い（T-0 の切り離しの検証になる）| 剣士をパイロットに採用 |
| C-10 | 体の筒（胴・腕・脚）の断面比率を職ごとに変える（S-b）| HDR-T4-4 で Human が S-a（衣服の量感）を選び、S-b / S-c は不実施と決めている | 不採用（S-a の範囲で行う）|

### 優先度（必要性・効果・リスク）
| 改善 | 必要性 | 効果 | リスク | 優先 |
| --- | --- | --- | --- | --- |
| 影の旅人の切り離し（T-0）| 高（壊さない条件）| ― | 低 | 1 |
| 顔・頭の丸み、目の滑らかさ（T-1）| 高（可愛さの主因）| 高 | 中（全員に効く）| 2 |
| 被り物の位置で目を出す（T-4 / T-5）| 高（顔が消える）| 高 | 低 | 3 |
| 衣服の量感・接続（T-2〜T-5）| 中 | 中〜高 | 中（貫通）| 4 |
| 髪の作り分け（T-3 ほか）| 中 | 中 | 中（Look Rig・衣服と干渉）| 5 |
| 描画回数の削減（T-7）| 中（iPhone の実測なし）| 中 | 中（転身の切り替え）| 6 |
| 頭身（T-1 Step 4）| Human 判断 | 高 | 高（全体に波及）| E-1 次第 |

## Agent Decisions
| # | 決定 | 根拠ソース（AGENTS.md §17.2） | 代替案 |
| --- | --- | --- | --- |
| AD-1 | 作業基準は `claude/road-visual-003-r3-7` @ `3b168a2`、文書 PR の base も同じ | 4（PR #145・#146 の積み上げ先）、依頼文 §3 | main 基準（PR #145・#146 を含まないため不採用）|
| AD-2 | CHARACTER-VIS-001 の残りの段は無い（全 Work Item DONE / 取り下げ）ので、本 Task は CHARACTER-VIS-001 の続きではなく、その成果の上の品質改善として扱う | 4（CHARACTER-VIS-001 Status History）| ― |
| AD-3 | 影の旅人は T-0 で現状の値に固定し、共通基盤の改善に追従させない（E-4 の回答が B なら T-1 で追従分だけ外す）| 3（DEC-034）、依頼文 §5-3 | 共通基盤に追従（DEC-034 の完成済みの見た目が変わるため既定にしない）|
| AD-4 | パイロットは剣士 | 4・6（上の C-9）| 弓師（T-4 のパイロットの前例）|
| AD-5 | 描画回数は「増やさない」を全 Work Item の不変条件にし、削減は独立の T-7 | 1（report §4 の計測）、5 | 各職の Work Item の中で削減（差分の切り分けができないため不採用）|
| AD-6 | X 線シェルの自己遮蔽は既存の不具合として T-7 で直す（§17.1 のバグ修正）| 1（report O-9）| 直さない |
| AD-7 | 撮影比較はリポジトリ外（scratchpad）で行い、比較テストの基盤は入れない。代わりに数値（MESH / CLOTH / PAL / OUTL）を E2E で見る | 4（CHARACTER-VIS-001 Out of Scope と T-4〜T-7 の前例）| スクリーンショット比較テストの導入 |
| AD-8 | 職ごとの髪の作り分けは本 Task の目的（依頼文 §5-1「頭部・髪型に明確な個性」）に含める。魔法使いの長い髪は承認済み設計の未実装分 | 2〜4（依頼文、CHARACTER-VIS-001 魔法使い C の記録）| 髪は変えない |
| AD-9 | 待機の立ち姿（モーション）は本 Task に入れず、次の Task 候補として記録する | 依頼文 §2（モーションを変えない）| 本 Task に含める |

## Escalation
本計画の Work Item のうち、T-1〜T-6 は下の E-1〜E-4 の回答待ち（`WAITING_APPROVAL`）。T-0 / T-7 / T-8 の計画は E-1〜E-4 に依存しない。

## Escalation E-1: 頭身を変えるか（可愛らしさのためのデフォルメ）
- Trigger: E-2 / E-9（D-1「5.0頭身を第一候補、4.5〜5.0 の範囲で Human が実機確認後に微調整」、DEC-T2-9「華奢で縦にスッとしたシルエット」）
- Facts: 現在は全員 5.0頭身（`05:2018`）。T-2 前は約 3.4頭身。可愛らしさを下げている候補要因の一つが頭の小ささ（report Root Cause、INFERENCE）。頭身を変えると手の高さ・武器・衣服の位置が動く（report §7）
- Why Agent cannot decide: 最終値は Human が決めると D-1 に書かれている。4.5 未満は D-1 の範囲外で DEC-T2-9 の目的とも衝突する
- Options:
  - A（推奨）: T-1 で全高を維持したまま 5.0 / 4.75 / 4.5 頭身の比較画像を作り、Human が選ぶ（D-1 の範囲内）— 影響: 頭が少し大きくなり親しみやすくなる。胴・脚が少し短くなる。武器・衣服の調整が T-1 に入る。戻しやすい（BUILD の値）
  - B: 5.0頭身のまま（顔・頭の丸みと目だけで改善）— 影響: 変更が最小。デフォルメの効果は小さい
  - C: 4.5 未満（例 4.0）も比較に含める（D-1・DEC-T2-9 の変更）— 影響: 最も可愛く寄るが、「華奢で縦長」の目的を変える。衣服・武器・モーションの見え方の調整が大きい
- Recommendation: A。理由: Human の既存の決定（D-1）の範囲内で、可愛さに最も効く手段を試せる。範囲外（C）は A の比較を見てから判断できる
- Minimal answer: 「A」/「B」/「C」

## Escalation E-2: 顔の造形（眉・口の追加と、目の板の点数）
- Trigger: E-2（HDR-T4-15「眉・口などの新しい顔の造形は追加しない」、T-4 の記録「目の点数・輪郭・3層構造は不変」）
- Facts: 目は 8 / 6 / 4 点の板で角が見える（report O-2）。Human が確定したのは大きさ・間隔・瞳・縦横比の4つの値で、点数を Human が選んだ記録は無い。見下ろしのカメラでは顔の面に描いたものは読めない（`06` の頭の組み立てのコメント、Canvas の試作の記録）
- Why Agent cannot decide: 眉・口は HDR-T4-15 と矛盾する。点数の変更は T-4 の記録で「不変」とされた項目に当たる
- Options:
  - A（推奨）: 眉・口は追加しない。目の板の点数だけ増やして角を取る（4つの確定値は変えない）— 影響: 目が柔らかく見える。顔の印象は保たれる。三角形の増加はごくわずか
  - B: A に加えて、小さな口（または眉）を1案試作し、V-1 で有無を比較する — 影響: 表情が読める可能性。カメラ距離では効果が小さい見込み。HDR-T4-15 の変更
  - C: 目も含めて現状維持 — 影響: 顔の硬さが残る
- Recommendation: A。理由: 確定値を守ったまま、撮影で確認できた硬さ（角）だけを取れる。B は A の結果を見てからでも試せる
- Minimal answer: 「A」/「B」/「C」

## Escalation E-3: 改善の範囲（承認済みデザインを維持した品質の底上げか、デザインの再検討か）
- Trigger: E-3（T-4 / T-5 / T-7 の衣服・配色は Human が V-1 で承認。依頼文は「個性を維持しながら完成度を引き上げる」）
- Facts: 衣服の種類（剣士 = 膝丈マウンテンパーカー、魔法使い = ロングコート、弓師 = 短丈上着、盗賊 = オーバーオール）と配色は Human の V-1 承認済み。撮影で見えた問題は面の硬さ・量感・被り物の位置・髪で、衣服の種類ではない（report §3）
- Why Agent cannot decide: 承認済みの形をどこまで変えてよいかは、ゲームデザイン上の意味が大きく異なり、既存の記録からは決まらない
- Options:
  - A（推奨）: 衣服の種類・被り物の種類・配色は維持し、造形の品質（丸み・量感・位置・接続・髪）だけを改善する — 影響: 承認済みの印象を保つ。各職の変更は見た目の「整い」中心
  - B: 職ごとにデザインの再検討まで含める（Human が新しい参考画像・デザイン案を出す）— 影響: 変化が大きい。V-1 の往復が増える。配色の再調整が要る可能性
- Recommendation: A。理由: 依頼文の「個性・可愛らしさを維持しながら」と、過去の退行（整えたら可愛くなくなった）を避ける方針に合う
- Minimal answer: 「A」/「B」

## Escalation E-4: 影の旅人を共通基盤の改善に追従させるか
- Trigger: E-2 / E-9（DEC-034、依頼文「他職業の変更によって影の旅人の完成済みデザインを壊さない」）
- Facts: 影の旅人は剣士の分岐で作られ、頭・目・手・脚などの共通部品を共有している（report R-1）。T-1 の顔・頭・目の改善は、そのままだと影の旅人にも効く
- Why Agent cannot decide: 影の旅人の外見は DEC-034 で完成済み。共通の顔の改善を影の旅人にも入れるかは、DEC-034 の見た目を変えるかどうかの判断
- Options:
  - A（推奨）: 影の旅人は現状で固定（T-0 で切り離し、共通基盤の改善を追従させない）— 影響: DEC-034 の見た目を確実に守る。将来、顔の品質に差が出る可能性
  - B: 顔・目・手の共通改善だけ影の旅人にも追従させる（フード外套・配色・体型・影の手は不変）。T-8 の V-1 で影の旅人も確認 — 影響: 9人の顔の品質がそろう。DEC-034 の見た目が少し変わる
- Recommendation: A。理由: 依頼文の「影の旅人を壊さない」が最優先。B は T-1 の結果を見てから別に判断できる
- Minimal answer: 「A」/「B」

## Approval
### T-0 Agent Approval
- [x] Approved
- Approval type: Agent Approval（AGENTS.md §6.1）
- Escalation Check: None（見た目を変えない。E-1〜E-7 / E-9 に当たらない: 影の旅人は現状維持、仕様・Decision Record の変更なし、新しいゲームシステムなし）
- Approved by / date / where: Planner (Agent) / 2026-11-24 / `claude/wanderer-renewal-001-nhlxns`
- Scope of approval: T-0 の Step 1〜5、Files To Change の T-0 の行
- Persistence: 実装の作業ブランチは Human の着手指示で決める（本依頼は計画まで）
- Implementation: 着手は Human の次の指示から

### T-7 Agent Approval
- [x] Approved
- Approval type: Agent Approval（AGENTS.md §6.1）
- Escalation Check: None（見た目を変えない部品の統合と、既存の不具合の修正。§17.1）
- Approved by / date / where: Planner (Agent) / 2026-11-24 / `claude/wanderer-renewal-001-nhlxns`
- Scope of approval: T-7 の Step 1〜3、Files To Change の T-7 の行
- Persistence: 同上
- Implementation: 着手は Human の次の指示から（T-0 の後。見た目を変える Work Item と同時に行わない）

### T-1〜T-6 Human Approval
- [ ] Approved
- Approval type: Human Approval 待ち（E-1〜E-4 の回答。各 Work Item の主 Acceptance は Human の V-1）
- Implementation: BLOCKED until approval

### T-8
- [ ] Approved（T-1〜T-7 の完了後に計画を確定する）

## Autonomy Metrics（Analyzer / Planner の段）
- Human Escalation Count: 1（E-1〜E-4 を1回の Escalation にまとめて送る）
- Human Decision Count: 0
- Auto Fix Count: 0
- Reviewer Round Count:（下の Status History）
- Test Retry Count: 0
- PR Created:（下の Status History）

## Status History
| Date | Target | From → To | By | Note |
| --- | --- | --- | --- | --- |
| 2026-11-22 | Task | — → DRAFT | Agent | WI「第一章・移動中会話システムの横展開」の §8 残件として登録（Human の指示） |
| 2026-11-24 | Task | DRAFT → ANALYZING | Analyzer | Human の着手指示（Analyzer / Planner のみ）。基準 `claude/road-visual-003-r3-7` @ `3b168a2` |
| 2026-11-24 | Task | ANALYZING → PLANNED | Planner | Artifact Handoff（Kind `analysis`、`51ed36a`、blob `3fd9a39c`）H-1〜H-8 PASS。T-0〜T-8 を計画。T-0 / T-7 は Agent Approval（着手は Human の指示待ち）、T-1〜T-6 は E-1〜E-4 の回答待ち（WAITING_APPROVAL）|
