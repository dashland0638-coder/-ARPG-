# CHARACTER-VIS-002 — プレイヤーキャラクターのデザイン更新

Status: IMPLEMENTING（Work Item ごとの状態は下の表。2026-11-24 Human Decision DEC-035: E-1 = A・E-2 = A、T-0 の着手指示）
優先度: 通常。WANDERER-RENEWAL-001（影の旅人の全面刷新）の後に行う（完了済み: PR #145 / #146 merge）

Analysis: .ai/reports/CHARACTER-VIS-002-analysis.md（branch `claude/wanderer-renewal-001-nhlxns` @ `7caabaf1ef5381d71e8b97db5dceedef47e87c11`、blob `6eb47b9f987ccccbc7363e90d84f6b7f9d6260e5`。初版 `51ed36a` / blob `3fd9a39c` を Review Round 1 の指摘で改訂した新版）

- Kind: `analysis` / Persisted by: `Agent`
- Plan baseline: `claude/road-visual-003-r3-7` @ `3b168a227b577b136286cfedfe78626e620266f5`（PR #145・#146 を含む最新の積み上げ先）。`path:line` はこの版の行番号
- Analyzer report の既知の記述のずれ（Review Round 2 R2-2、本 Task file を正とする）: report §5 の表の「眉・口は Escalation」は AD-10（HDR-T4-15 に従い追加しない）に、Summary の5番（加入後の影の旅人だけ）は report §9 R-1 と本 Task の T-0（加入前の姿・フード・影の手を含む）に読み替える
- 比較資料（現状の撮影）: `.ai/reports/CHARACTER-VIS-002-assets/`（commit `f2806b7`、斜め45°を Round 1 で追加）

## Artifact Handoff 検証（H-1〜H-8、AGENTS.md §5.2）
| # | 確認 | 結果 |
| --- | --- | --- |
| H-1 | `git merge-base --is-ancestor 7caabaf… origin/claude/wanderer-renewal-001-nhlxns` | PASS |
| H-2 | `git cat-file -e 7caabaf…:.ai/reports/CHARACTER-VIS-002-analysis.md` | PASS |
| H-3 | `git diff --name-only 7caabaf…^ 7caabaf…` → analysis の1件のみ | PASS |
| H-4 | Path と1行目 `# CHARACTER-VIS-002 Analysis` | PASS |
| H-5 | Kind `analysis` | PASS |
| H-6 | `git rev-parse 7caabaf…:<Path>` = `6eb47b9f987ccccbc7363e90d84f6b7f9d6260e5` | PASS |
| H-7 | 同じ `(Task ID, Kind)` の記録は初版（`51ed36a`）のみ。Review Round 1 の指摘による新版として差し替え（初版の記録は Status History に残す） | PASS |
| H-8 | `git show 7caabaf…:<Path>` で読んだ | PASS |

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
| 影の旅人 | 加入後は剣士の分岐で作られ、BUILD・頭・目・腕・脚などの共通部品を共有。加入前の姿（`buildRoadTravelerFigure`）も `BUILD.warrior`・`makeCharacterHead`（グローバルの頭の比率）・`makeCharacterHairShell`・`makeGarmentLoft` を使い、フード外套と影の手も `makeGarmentLoft` | report §9 R-1、`06:1175`、`14-dungeon-road.js:46-111`、`17-wanderer-style.js:151-156` |
| 古い鎧の部品 | 胸当て・脛当て・足首の帯・籠手・肩当てが共通の体に残る（多くは衣服の下）。肩当ては転身の表示切り替えが参照。膝の球は T-3 の関節キャップで鎧ではない | `06:664-690`、`06:732`、`06:1740`、`06:1777`、`06:2274-2275`・`06:2375-2376` |
| セーブ | 外見はセーブに無い | report §2 |

## 全体設計（Planner）
**方針: 「デザインを作り直す」のではなく「承認済みのデザインを、可愛く・読みやすく作り直す」**（Escalation E-2 の推奨案 A）。
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
| T-0 | 基準づくり: 影の旅人（加入前後・影の手）の切り離し、外見の計測行、見えない古い鎧の部品の調査 | DONE（Reviewer PASS、下の Implementation Result（T-0））| [x] | なし | **なし**（形のシグネチャの一致で確認）|
| T-1 | 共通の顔・頭（頭身の確定、頭の下半分の丸み、目の板の滑らかさ、首と襟）と共通の接合部（joint analysis の J-1・J-2・J-4・J-7・J-8、J-9 の方針）| WAITING_APPROVAL（**Human の頭身の選択待ち**: 比較画像 `CHARACTER-VIS-002-assets/head-ratio-compare.jpg`）| [ ] | T-0、頭身の選択 | あり（4職）|
| T-2 | 剣士（パイロット）: パーカー・ゲイター・袖・裾・ブーツの量感と接続。戦騎士への継承の確認 | PLANNED | [ ] | T-1 | あり |
| T-3 | 魔法使い: 長く広がった髪（承認済み設計の実装）、コートの前開き・袖、キャスケットの丸み、横の髪の浮き（J-3）・箱型の袖（J-5）| PLANNED | [ ] | T-2 | あり |
| T-4 | 弓師: 帽子の位置とつば（目を出す）、毛皮の襟（J-6）、短丈上着の裾 | PLANNED | [ ] | T-2 | あり |
| T-5 | 盗賊: フードの丸み、帽子の位置、オーバーオールの胸当て・パーカーとの重なり（J-10）| PLANNED | [ ] | T-2 | あり |
| T-6 | 上位職の仕上げ: 魔導士の銀髪・バーサーカーのフード・戦騎士 / 鷹の目の継承の調整 | PLANNED | [ ] | T-2〜T-5 | あり |
| T-7 | 描画回数の削減（見た目を変えない統合）と X 線シェルの自己遮蔽の修正 | PLANNED（Escalation Check: None。Agent Approval は Human の着手指示で記入）| [ ] | T-0（T-1〜T-6 と並行しない）| 自己遮蔽の光る手が消える以外はなし |
| T-8 | 全体統合・品質確認: 9人の同一条件の V-1、`docs/CHARACTERS.md`、全 E2E、iPhone 実機 | PLANNED | [ ] | T-1〜T-7 | なし（確認のみ）|

- **実施順（推奨）**: T-0 → T-1 → T-2（パイロット）→ T-3 → T-4 → T-5 → T-6 → T-7 → T-8。並行実装はしない（前の Work Item の Review PASS と、見た目の変化がある Work Item は Human の V-1 OK の後に次へ）
- T-3〜T-5 の順番は入れ替え可（互いに依存しない）。T-7 は T-0 の後ならいつでも入れられるが、見た目を変える Work Item と同時には行わない（差分の切り分けのため）
- 2026-11-24: Human が E-1 = A・E-2 = A を確定し、T-0 の実施を指示（DEC-035）。T-0 は Agent Approval で実施。T-1 は頭身の比較画像を Human が選ぶまで頭部寸法の変更に進まない（DEC-035）
- ポリゴン接合の調査（DEC-035 の追加要求）は `.ai/reports/CHARACTER-VIS-002-joint-analysis.md`。共通の J-1・J-2・J-4・J-7・J-8 は T-1、職ごとの J-3・J-5・J-6・J-10 は T-3〜T-5
- モーションの刷新（DEC-035 の追加要求）は独立 Task `CHARACTER-MOTION-RENEWAL`（`.ai/tasks/CHARACTER-MOTION-RENEWAL.md`）。本 Task と並行実装しない

## Implementation Plan

### T-0 基準づくり（見た目を変えない）
| Step | ファイル / 関数 | 変更内容 | 理由 |
| --- | --- | --- | --- |
| 1 | `05` BUILD、`06` `buildPlayer()`、`14-dungeon-road.js` `buildRoadTravelerFigure` | `BUILD.wanderer` を剣士の現在値の複製として追加し、加入後（charKey）と加入前の姿（現在 `BUILD.warrior` を直接読む `14:48`）の両方がそれを使う（14 の変更はこの参照の差し替え1か所だけで、見た目は不変）| R-1(a)(b)。剣士の BUILD の変更が影の旅人へ波及しないように |
| 1b | `05` 共通の生成関数 | **共通の関数の既定値は変えない方針を固定する**: `makeCharacterHead`（`HEAD_SECTION_RATIOS` / `HEAD_DEPTH_MUL`）・`makeCharacterHairShell`・`makeGarmentLoft` / `makeOpenGarmentLoft`・目の生成関数に、T-1 以降の改善は**オプション引数（例: 頭の比率の表・断面の丸みの段数）で4職が明示的に選ぶ**形で入れる。既定の呼び出し（影の旅人の加入前後・フード外套・影の手・敵や NPC が使う箇所）は今の結果のまま | R-1(b)(c)。グローバルの定数を書き換えると、加入前の姿・フード・影の手まで変わる |
| 1c | `tests/unit/` | 影の旅人の不変の unit: 既定の呼び出しの `makeCharacterHead(HEAD_DIMS)`・`makeCharacterHairShell({classKey:'wanderer'})`・`buildWandererHoodParts` の部品・影の手の Geometry（`17` の `shadowHandGeo`）の頂点数と外接箱が T-0 の記録値と一致 | 1 / 1b の担保（加入前の姿は E2E で撮れる場面が限られるため unit で固定）|
| 2 | `05` `motionBodySnapshot()`、`src/core/motion-preview.js` | RIG ブロックに ` MESH  本体 / 合計  TRI n  MAT n` の1行（検証用。CLOTH / PAL / OUTL と同じ作法、本番 UI は不変）| 描画回数の予算を E2E で見張る（R-7）|
| 3 | `06` 共通の体 | 衣服の下で外から見えない古い鎧の部品（候補: 胸当て・脛当て・籠手・足首の帯。職ごとに見えているかを撮影で判定）を作らない。見えている部品は残す。肩当ては転身の表示切り替え（`06:1784`・`06:2274-2275`・`06:2375-2376`）が参照するため、作らない場合は参照側も合わせる（隠す処理を残すだけでも可）。膝の球は T-3 の関節キャップなので対象外 | 描画回数の無駄（1部品 = 4メッシュ）。承認済みの見た目を変えない |
| 4 | `tests/` | 影の旅人（加入後）の外見の不変の検査（E2E: MESH 行・PAL 行が T-0 の記録値と一致）、加入前の姿の構築（既存の `road-stranger` unit と道の E2E）、描画回数の上限（各職の T-0 後の値 + 余裕 0）| 以降の Work Item の回帰の土台 |
| 5 | リポジトリ外（scratchpad） | 撮影手順（テストモード + 固定カメラ: 正面・斜め45°・側面・背面・顔・見下ろし・ゲーム画面 844×390、塗りつぶしシルエット）。T-0 の前後で画素の差分が無いことを確認 | V-1 の比較の土台。撮影比較テストの基盤はリポジトリに入れない（CHARACTER-VIS-001 Out of Scope を踏襲）|

### T-1 共通の顔・頭（Escalation E-1 の回答で頭身を確定）
| Step | ファイル / 関数 | 変更内容 | 理由 |
| --- | --- | --- | --- |
| 1 | `05` `makeCharacterHead` のオプション、`06` 4職の頭 | 頭の下半分を丸く（顎・顎線の widthMul を上げ、頬の最大幅の位置を下げる。候補値は撮影で3案作る）。新しい比率の表を4職の呼び出しだけが渡す（T-0 Step 1b。グローバルの `HEAD_SECTION_RATIOS` は変えない）| O-1。顎の尖りが大人びた印象の主因（INFERENCE）|
| 2 | `05` `makeEyeSclera/Pupil/Highlight` のオプション | 板の点数を増やして角を取る（白目 8 → 12〜14、瞳 6 → 10〜12、ハイライト 4 → 6〜8）。**大きさ・間隔・瞳・縦横比の4つの確定値は変えない**。眉・口は追加しない（HDR-T4-15）。影の旅人は今の点数のまま（AD-3）| O-2。AD-10 |
| 3 | `06` 首・襟 | 首の長さと襟（ゲイター・タートルネック等）の重なり。顔の下半分が隠れない高さへ | O-1（剣士のゲイター）。各職の襟は T-2〜T-5 で調整 |
| 4 | `05` BUILD（E-1 = A の場合のみ） | 全高を維持したまま headR を 5.0 / 4.75 / 4.5 頭身の3案で比較撮影し、Human が選んだ値を4系列（warrior / mage / archer / rogue）へ。`BUILD.wanderer` は変えない（T-0）。胴・脚は BUILD の絶対値で引き直し、`checkBuild` の整合を保つ | G-1。D-1 の範囲内の微調整（最終値は Human）|
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
| 魔法使い | 緑の目、水色のロングコート、キャスケット（候補 B の深さ）、杖、細く縦長の体格 | 長く広がった髪（承認済み設計の未実装分。房の円錐ではなく、帯状の板を重ねる影の旅人の髪の方式を参考。髪の殻の既定の結果は変えず、魔法使いの呼び出しだけが新しい髪を足す = T-0 Step 1b）、コートの前開きの縁・襟を形で見せる、箱型の袖を細く、キャスケットの角を取る |
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
| 1 | 同じ可動部（親）・同じ Material で、転身・差し替えで表示を切り替えない部品を、組み立ての最後に1つのメッシュへまとめる。統合には既存の `weldGeometries`（`02-world-common.js:495-515`。壁・柱の統合用に手書きされた関数。BufferGeometryUtils はコアのビルドに無い）を使い、部品の位置・回転を親の座標へ焼き込む処理だけ足す（§3）。切り替える部品（`warriorBaseDecor`・肩当て等）と武器はまとめない | 描画回数の主因（部品 × 4）。輪郭線・X 線はまとめた後のメッシュに付くので見た目は同じ |
| 2a | X 線シェルの自己遮蔽の再現: ゲームカメラでカメラから離れる向きに歩く・攻撃する場面を撮影し、手などが胴越しに光るかを確認（report O-9 はキャラクター用の固定カメラでの FACT、ゲーム画面は INFERENCE）。再現しなければ Step 2b は行わず記録だけ残す | AD-6 |
| 2b | 再現した場合だけ直す。方式は Implementer が選ぶ（例: X 線シェルの描画をプレイヤー本体の深度で隠さない順序にする / 対象を外形の大きい部品に限る）。**壁・柱に隠れたときの X 線の表示は今までどおり出ること**を撮影と Human の目視で確認し（主な確認。OUTL 行の X 線シェルの数は構造の補助で、描画されることの証明にはならない）、変更前後の画像を Human へ（V-1）| report O-9（既存の不具合）|
| 3 | 計測: T-0 の MESH 行で減少を確認し、E2E の上限を新しい値へ下げる | 回帰の防止 |

### T-8 全体統合・品質確認
- 9人を同一条件で撮影（基礎4職・上位4職はトレーニング空間、影の旅人は酒場。9人を1か所に揃えられないのは既知の制約）
- `docs/CHARACTERS.md` 「外見」節の更新（実装の事実だけ）
- 全 E2E、iPhone 実機の確認項目（下）
- CHARACTER-VIS-001 の Task Level の Status（全 Work Item DONE / 取り下げなのに PLANNED）を DONE へ直す記録の整合（本 Task の Status History に理由を残す）

## Files To Change（予定。承認された Work Item の行だけが有効）
| ファイル | Work Item | 内容 |
| --- | --- | --- |
| `src/legacy/parts/05-rendering-rig.js` | T-0 / T-1 / T-3〜T-7 | BUILD（`wanderer` の追加、4系列の頭身の値）、`makeCharacterHead`・目の生成関数・髪・`makeGarmentLoft` へのオプション引数の追加（4職が新しい頭の比率の表・目の板の点数・断面の丸みを渡す。グローバルの `HEAD_SECTION_RATIOS` と各関数の既定の結果は変えない = T-0 Step 1b）、被り物・髪の定数と Coverage（4職の分だけ）、`motionBodySnapshot`、`addXrayShell` / 輪郭線の付け方、`WEAPON_SOCKET` の収納 `off`（必要な職だけ）|
| `src/legacy/parts/06-player-enemy.js` | T-0〜T-7 | `buildPlayer()`（共通の体・各職の被り物・衣服・髪・影の旅人の固定）、`applyJobPromotionVisual()`、部品の統合 |
| `src/core/motion-preview.js` | T-0 | RIG ブロックの MESH 行 |
| `src/legacy/parts/14-dungeon-road.js` | T-0 | `buildRoadTravelerFigure` の `BUILD.warrior` → `BUILD.wanderer` の参照の差し替え1か所のみ（見た目は不変）|
| `tests/unit/wanderer-visual-freeze.test.js`（新規）| T-0 | 共通の生成関数の既定の結果・フード外套・影の手の Geometry の不変 |
| `tests/unit/lowpoly-primitives.test.js` | T-1〜T-6 | 複製値の同期、新しい構築の検査（assert を弱めない）|
| `tests/unit/motion-preview.test.js` | T-0 | MESH 行 |
| `tests/character-visual-budget.spec.js`（新規）| T-0 / T-7 | 9人の描画メッシュの上限、影の旅人の MESH / PAL の不変 |
| `tests/character-clothing.spec.js` | T-2〜T-6 | 衣服の数の下限が変わる場合だけ（下限を下げて通すことはしない。部品の統合で数が変わる場合は数え方を合わせる）|
| `docs/CHARACTERS.md` | T-8 | 外見の節 |
| 本 Task file | 全 | Implementation Result・Status・Status History |

## Files Not To Change
`src/legacy/parts/13-update-loop.js`、`src/legacy/parts/17-wanderer-style.js`、`14-dungeon-road.js`（T-0 の参照の差し替え1か所を除く）、`src/core/wanderer-style.js`、`src/core/combat-stance.js`、STANCE / STANCE_ALT / STANCE_RELAXED / CLIPS、`10-input.js`、`11-combat-actions.js`（攻撃・判定）、`src/render/player-palette.js` の色の値（`PLAYER_PALETTE`）と `WEAPON_FINISH`、`01-character-creation.js` の `CLASSES` の color / trim / 数値・`CHAPTER_CAST`、`09-save-load.js`、支援AI（`buildGuestCompanion` / `buildCompanion` / `spawnPhantomDecoy`）、NPC・敵・ボス、`playwright.config.js`、`basefile.html`

## Test Plan
| 区分 | 対象 | 確認 | 時期 |
| --- | --- | --- | --- |
| Build / Unit | `npm run build`、`npm run test:unit`（`ai-protocol.test.js` を含む）| PASS | 各 Work Item |
| E2E 対象 | `character-clothing`・`character-palette`・`character-weapon-visual`・`character-motion`・`weapon-stow`・`battle-knight-visual`・`base-class-identity`・`base-class-comparison`・`job-traits`・`wanderer-renewal`・`chapter1-progression`・`character-visual-budget`（新規）| PASS（FLAKY は PASS に数えない。§14）| 各 Work Item |
| 影の旅人の不変 | `character-visual-budget` の影の旅人の行、`wanderer-visual-freeze`（unit、新規）、`wanderer-renewal`、`road2-join`、`road-stranger`（unit）、`wanderer-style`（unit）| 加入前後・フード・影の手が T-0 の記録値と一致 | 各 Work Item |
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
- T-0 / T-7: 撮影の画素差分なし（T-7 の自己遮蔽を除く）、影の旅人（加入前後・フード・影の手）の不変 PASS、T-7 は壁越しの X 線が引き続き出ること・自己遮蔽の修正を Human が V-1 で確認、描画メッシュが T-0 の値以下（T-7 は減少）、build / unit / 対象 E2E / 全 E2E PASS
- T-1〜T-6: Human の V-1 OK（評価基準の表）、各職の「残す特徴」が残る、配色表の色・`CLASSES`・モーション・武器の形・セーブに差分なし、影の旅人の不変 PASS、描画メッシュが予算内、build / unit / 対象 E2E PASS
- T-8: 9人の同一条件の V-1 OK、iPhone 実機の確認項目、全 E2E PASS、`docs/CHARACTERS.md` が実装と一致

## Risks
| # | リスク | 対応 |
| --- | --- | --- |
| P-R1 | 影の旅人への波及（report R-1。加入後・加入前の姿・フード外套・影の手）| T-0 で BUILD を分け、共通の関数は既定値を変えずオプションで4職だけが選ぶ。以降は毎回不変の検査（unit + E2E）|
| P-R2 | 承認済みデザインの退行（「整えたら可愛くなくなった」の再発、R-10）| 職ごとに「残す特徴」を Acceptance に入れ、変更前後を同じ条件で並べて Human が判断。1 Work Item = 1職 |
| P-R3 | 頭身の変更による武器・手・衣服のずれ（R-3 / R-4）| E-1 の回答が出るまで BUILD を変えない。変える場合は T-1 で `weapon-stow`・`character-motion` E-2 を含めて確認 |
| P-R4 | 衣服の量感と腕・脚・武器の貫通（P-R25〜R28）| 停止・歩行・構え・攻撃・回避の撮影。収納の補正は `off` のみ |
| P-R5 | 描画回数の増加（R-7）| 予算の E2E。部品を足す変更は同じ親・同じ Material へまとめる前提 |
| P-R6 | 部品の統合で転身の表示切り替えが壊れる（T-7）| 切り替える部品（`warriorBaseDecor`・肩当て等）・武器はまとめない。上位4職の生成と `clearJobPromotionVisual` の E2E / unit |
| P-R9 | X 線の修正で壁越しの表示が出なくなる（T-7）| 2a で再現を先に確認。壁越しの表示を撮影と OUTL 行で確認し、Human の V-1 |
| P-R7 | ソース検査の unit の大量の同期（R-8）| assert を弱めず、新しい構築を検査する形へ置き換える（前例どおり）|
| P-R8 | 「可愛さ」の判定が往復する | パイロット（剣士）で方向を固めてから他職へ。比較画像は3案までに絞る |

## Rollback
- 各 Work Item は独立した commit 群・PR にする。戻すときはその Work Item の commit を revert する（セーブ・仕様に影響しないので、データの移行は不要）
- T-0 の切り離しは他の Work Item の前提なので、T-0 を戻す場合は後続をすべて戻す
- T-7 の統合は組み立ての最後の1か所に閉じ、無効化（統合しない）で元の構成に戻せる形にする

## Out of Scope
- モーション（待機の立ち姿が全員同じ問題 = report O-5 / G-6 を含む）→ 独立 Task `CHARACTER-MOTION-RENEWAL`（DEC-035）
- 配色の変更、武器の形・大きさ・持ち方、攻撃 VFX・魔法陣・足元リング
- 支援AI（D-5）、NPC・敵・ボス。加入前の影の旅人はデザイン変更の対象外（T-0 の `BUILD.wanderer` への参照の差し替え1か所だけ行う）
- セルシェーディング・新しい Material 基盤、撮影比較テストの基盤
- 新しい職業・装備の着せ替え・キャラクターメイクの拡張

### 次の Task 候補
- 職ごとの待機の立ち姿（`STANCE_RELAXED`）は DEC-035 で `CHARACTER-MOTION-RENEWAL` に含めた（起票済み）

## 反対意見と代替案（Planner の検討）
| # | 反対意見 | 検討 | 結論 |
| --- | --- | --- | --- |
| C-1 | 共通造形を統一しすぎると個性が失われる | 共通化するのは「作り方と品質」だけで、形の値（BUILD・被り物・衣服）は職ごと。頭の Loft は全員共通だが、頭の大きさ・被り物・髪・目の色・肌色で分かれる | 採用（共通化の範囲を表で固定）|
| C-2 | Material を細分化すると描画負荷が増える | 描画回数は Material 数ではなく部品数で決まる（report §6）。role の追加はしない（P-D3 の7つのまま）| Material は増やさない。負荷は T-7 の部品統合で下げる |
| C-3 | 髪・衣装を作り込むと小さい画面で読みにくくなる | 作り込みは「角を取る・量感を足す・位置を直す」に限定し、細かい部品（ポケット・紐・留め具）は増やさない。見下ろしの 844×390 と塗りつぶしシルエットで判定 | 採用（小物の追加をしない）|
| C-4 | 上位職を別モデルにすると保守コストが増える | 上位職は今の「基礎職を継承して差し替える」方式（P-a）を維持。別モデルにしない | 別モデル案は不採用 |
| C-5 | 既存の魅力を残すため、変えない方がよい部分がある | 変えない: 配色・衣服の種類・剣士のキャップの耳・盗賊の黄色の帽子とオーバーオール・魔法使いの緑の目・弓師の肌色・上位職の白いレイヤー・目の4つの確定値・影の旅人。職ごとの「残す特徴」を Acceptance に入れる | 採用 |
| C-6 | 頭身を下げれば一気に可愛くなる（最も効果が大きい）| 効果は大きいが、Human が T-2 で選んだ「華奢で縦にスッとした」目的（DEC-T2-9）と衝突し、武器・手・衣服の位置も動く。D-1 の範囲（4.5〜5.0）なら Human の微調整として扱える | E-1 で Human に提示（推奨: D-1 の範囲内で比較）|
| C-7 | 眉・口を足せば表情が読める | 見下ろしのゲームカメラでは顔の面が浅い角度になり、描いた絵や小さな部品は読めない（Canvas 試作の記録 `06:774-782`）。HDR-T4-15（追加しない）がある | 足さない（AD-10。HDR-T4-15 に従う）|
| C-11 | 部品の統合に three の BufferGeometryUtils を使う | コアのビルドに無く、既存の `weldGeometries` が同じ目的で手書きされている（§3）| 不採用（`weldGeometries` を使う）|
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
| AD-3 | 影の旅人（加入後・加入前の姿・フード外套・影の手）は T-0 で現状の値に固定し、共通基盤の改善に追従させない。共通の関数は既定値を変えず、改善は4職がオプションで選ぶ | 3（DEC-034）、依頼文 §5-3「他職業の変更によって影の旅人の完成済みデザインを壊さない」| 顔・目・手だけ追従（DEC-034 の見た目が変わる。必要になれば別途 Human が判断）|
| AD-4 | パイロットは剣士 | 4・6（上の C-9）| 弓師（T-4 のパイロットの前例）|
| AD-5 | 描画回数は「増やさない」を全 Work Item の不変条件にし、削減は独立の T-7 | 1（report §4 の計測）、5 | 各職の Work Item の中で削減（差分の切り分けができないため不採用）|
| AD-6 | X 線シェルの自己遮蔽は、ゲーム画面で再現した場合に既存の不具合として T-7 で直す（§17.1 のバグ修正。見た目の変化は Human の V-1）| 1（report O-9）| 直さない |
| AD-7 | 撮影比較はリポジトリ外（scratchpad）で行い、比較テストの基盤は入れない。代わりに数値（MESH / CLOTH / PAL / OUTL）を E2E で見る | 4（CHARACTER-VIS-001 Out of Scope と T-4〜T-7 の前例）| スクリーンショット比較テストの導入 |
| AD-8 | 職ごとの髪の作り分けは本 Task の目的（依頼文 §5-1「頭部・髪型に明確な個性」）に含める。魔法使いの長い髪は承認済み設計の未実装分 | 2〜4（依頼文、CHARACTER-VIS-001 魔法使い C の記録）| 髪は変えない |
| AD-9 | 待機の立ち姿（モーション）は本 Task に入れず、次の Task 候補として記録する | 依頼文 §2（モーションを変えない）| 本 Task に含める |
| AD-10 | 顔: 眉・口は追加しない（HDR-T4-15）。目の板の点数は増やしてよい（4つの確定値は不変。「点数・輪郭は不変」は T-4 実装時のコードのコメント `06:866-868` で Human の決定ではない）。見た目は T-1 の V-1 で Human が確認 | 3（HDR-T4-15）、4（CHARACTER-VIS-001 の目の Human Decision）| 眉・口の試作（HDR-T4-15 に反する）|
| AD-11 | T-0 / T-7 は Escalation に当たらないが、Human の「実装は次の指示から」に従い PLANNED に留め、着手指示の時点で Agent Approval を記入する | 依頼文 §2、AGENTS.md §6.1 | 今 Agent Approval（APPROVED）にする |
| AD-12 | T-7 の統合は既存の `weldGeometries` を使う | 5（§3、`02:495-515`）| BufferGeometryUtils |
| AD-13 | T-0 の影の旅人の不変は、unit ではソース（BUILD.wanderer の値・参照・共通関数の既定値）を、E2E では実際のゲームで作った形のシグネチャ（加入後・加入前の立ち / 座り・影の手）を固定する。連結スコープの関数は node の unit から直接呼べないため（Step 1c の「unit で頂点数・外接箱」を E2E へ移した）| 1・5（既存の unit はソース検査、E2E は probe の前例 `road2-clear-reset.spec.js`）| 連結スクリプトを node で評価する unit（THREE の依存が重い）|
| AD-14 | 共通関数のオプション引数は、使う Work Item（T-1 以降）で足す。T-0 では先回りの引数を足さず、既定値の固定をテスト（AD-13）で担保する | 5（§10 Scope、使われないコードを足さない）| T-0 で引数だけ先に足す |
| AD-15 | 古い鎧の部品は T-0 で削除しない。同じフレームで表示 / 非表示の画素を比べ、胸当て・脛当て・足首の帯・籠手・肩当てのすべてが画面に写ることを確認したため（削除は見た目の変化）。扱いは T-1（J-4 籠手）以降で Human の V-1 とともに | 1（T-0 の画素の計測）、DEC-035「T-0 では見た目を変えない」| 見えにくい部品を削除 |

## マテリアル構成の改善方針（依頼文 §7-5）
| 方針 | 内容 | 根拠 |
| --- | --- | --- |
| M-1 role を増やさない | 役割は7つ（main / sub / accent / layer / hat / trim / boot）のまま。新しい部品（髪・襟の作り直し等）は既存の role の Material を使う | P-D3、report §6 |
| M-2 配色の値を変えない | `PLAYER_PALETTE` の色・`PLAYER_FINISH` / `WEAPON_FINISH` の質感は Human 承認の値のまま | T-5 / T-7 の V-1 |
| M-3 色の波及を起こさない | 部品の作り直しで共有 Material を直接書き換えない。上位職の色は `applyPlayerPalette()` の role の上書きだけで行う。dispose の除外（輪郭線・X 線・role Material）を保つ | T-5 / T-7 の構造 |
| M-4 影の旅人の Material を分ける | 影の旅人の衣服の紫と影の手・輪郭の紫（#8A5AD6）は別 Material・別色のまま（DEC-034 / P-D8）。共通の改善で影の旅人の Material を共有・統合しない | DEC-034 |
| M-5 flat の双子の整理は描画回数の観点で | flat の双子（clothMatFlat 等）は描画回数にほぼ影響しない（Material 数ではなく部品数で決まる）。T-7 で統合するときは「同じ Material の部品」をまとめる単位として扱うだけで、双子を減らす変更はしない | report §6 |
| M-6 職の小物の Material | 矢筒・投げナイフ・毛皮の襟など role の外の Material は、作り直す職の Work Item で role へ寄せられるか確認する（色の値は今の見た目を保つ。寄せると色が変わるものは寄せない）| report §6 |
| M-7 計測 | 固有 Material 数を MESH 行に出し（T-0）、Work Item ごとに増えていないことを見る | report §4 |

## Escalation
**回答済み（2026-11-24、DEC-035）: E-1 = A（5.0 / 4.75 / 4.5 の比較画像を Human に提示し、選択を受けるまで確定しない。4.5 未満は対象外）、E-2 = A（承認済みの衣服・被り物・配色・コンセプトを維持し、造形品質・接合品質・見栄え・既存モーション品質を改善）。** 以下は回答前の記録。

T-1〜T-6 は下の E-1・E-2 の回答待ち（`WAITING_APPROVAL`）。T-0 / T-7 / T-8 の計画は E-1・E-2 に依存しない。顔の眉・口（HDR-T4-15 に従い追加しない = AD-10）と影の旅人の固定（DEC-034 と依頼文 = AD-3）は既存の決定から導けるため Escalation にしない（Review Round 1 の指摘で Escalation から Agent Decision へ移した）。

## Escalation E-1: 頭身を変えるか（可愛らしさのためのデフォルメ）
- Trigger: E-9（D-1「5.0頭身を第一候補、4.5〜5.0 の範囲で Human が実機確認後に微調整」= 最終値は Human が決める）。C を選ぶ場合は E-2（DEC-T2-9「華奢で縦にスッとしたシルエット」の変更）にも当たる
- Facts: 現在は全員 5.0頭身（`05:2018`）。T-2 前は約 3.4頭身。可愛らしさを下げている候補要因の一つが頭の小ささ（report Root Cause、INFERENCE）。頭身を変えると手の高さ・武器・衣服の位置が動く（report §7）
- Why Agent cannot decide: 最終値は Human が決めると D-1 に書かれている。4.5 未満は D-1 の範囲外で DEC-T2-9 の目的とも衝突する
- Options:
  - A（推奨）: T-1 で全高を維持したまま 5.0 / 4.75 / 4.5 頭身の比較画像を作り、Human が選ぶ（D-1 の範囲内）— 影響: 頭が少し大きくなり親しみやすくなる。胴・脚が少し短くなる。武器・衣服の調整が T-1 に入る。戻しやすい（BUILD の値）
  - B: 5.0頭身のまま（顔・頭の丸みと目だけで改善）— 影響: 変更が最小。デフォルメの効果は小さい
  - C: 4.5 未満（例 4.0）も比較に含める（D-1・DEC-T2-9 の変更）— 影響: 最も可愛く寄るが、「華奢で縦長」の目的を変える。衣服・武器・モーションの見え方の調整が大きい
- Recommendation: A。理由: Human の既存の決定（D-1）の範囲内で、可愛さに最も効く手段を試せる。範囲外（C）は A の比較を見てから判断できる
- Minimal answer: 「A」/「B」/「C」

## Escalation E-2: 改善の範囲（承認済みデザインを維持した品質の底上げか、デザインの再検討か）
- Trigger: E-3（T-4 / T-5 / T-7 の衣服・配色は Human が V-1 で承認。依頼文は「個性を維持しながら完成度を引き上げる」）
- Facts: 衣服の種類（剣士 = 膝丈マウンテンパーカー、魔法使い = ロングコート、弓師 = 短丈上着、盗賊 = オーバーオール）と配色は Human の V-1 承認済み。撮影で見えた問題は面の硬さ・量感・被り物の位置・髪で、衣服の種類ではない（report §3）
- Why Agent cannot decide: 承認済みの形をどこまで変えてよいかは、ゲームデザイン上の意味が大きく異なり、既存の記録からは決まらない
- Options:
  - A（推奨）: 衣服の種類・被り物の種類・配色は維持し、造形の品質（丸み・量感・位置・接続・髪）だけを改善する — 影響: 承認済みの印象を保つ。各職の変更は見た目の「整い」中心
  - B: 職ごとにデザインの再検討まで含める（Human が新しい参考画像・デザイン案を出す）— 影響: 変化が大きい。V-1 の往復が増える。配色の再調整が要る可能性
- Recommendation: A。理由: 依頼文の「個性・可愛らしさを維持しながら」と、過去の退行（整えたら可愛くなくなった）を避ける方針に合う
- Minimal answer: 「A」/「B」

## Approval
### T-0
- [x] Approved
- Approval type: Agent Approval（AGENTS.md §6.1）。Escalation Check: None（見た目を変えない基準づくり。E-1〜E-7 / E-9 に当たらない）
- Approved by / date / where: Planner (Agent) / 2026-11-24 / `claude/wanderer-renewal-001-nhlxns`（Human の T-0 着手指示、DEC-035）
- Scope of approval: T-0 の Step 1〜5、Files To Change の T-0 の行（`tests/unit/road-stranger.test.js` の代役の更新を追加。下の Implementation Result）
- Persistence: 許可（branch: `claude/wanderer-renewal-001-nhlxns`、根拠: このセッションの割当ブランチ・PR #147 の head。base `claude/road-visual-003-r3-7` を Human が指定）

### T-7
- [ ] Approved
- Approval type: Agent Approval を予定（Escalation Check: None）。実施順は T-6 の後（AD-11）

### T-1〜T-6
- [ ] Approved
- Approval type: Agent Approval（E-1・E-2 は回答済み）。T-1 は **Human の頭身の選択**（比較画像）を受けてから。各 Work Item の主 Acceptance は Human の V-1、各段で独立 Reviewer の PASS（DEC-035）
- Implementation: BLOCKED（T-1 は頭身の選択待ち。T-2 以降は前の Work Item の完了待ち）

### T-8
- [ ] Approved（T-1〜T-7 の完了後に計画を確定する）

## Autonomy Metrics（Analyzer / Planner の段）
- Human Escalation Count: 1（E-1・E-2 を1回の Escalation にまとめて送る）
- Human Decision Count: 0
- Auto Fix Count: 1（Review Round 1 の指摘への修正）
- Reviewer Round Count: 2（Round 1 = CHANGES_REQUIRED、Round 2 = PASS）
- Test Retry Count: 0
- PR Created: Yes（#147、文書のみ、base `claude/road-visual-003-r3-7`）

## Implementation Result（T-0）

### Changed Files
| ファイル | 変更 |
| --- | --- |
| `src/legacy/parts/05-rendering-rig.js` | `BUILD.wanderer`（剣士の行の 2026-11-24 時点の値の写しを、独立の行として直書き）。`motionBodySnapshot()` に `mesh`（見えている本体メッシュ / 全メッシュ・三角形・本体の固有 Material）|
| `src/legacy/parts/06-player-enemy.js` | `buildPlayer()`: 影の旅人（charKey）は `BUILD.wanderer`、`checkBuild` のキーも同じ |
| `src/legacy/parts/14-dungeon-road.js` | `buildRoadTravelerFigure`: `BUILD.warrior` → `BUILD.wanderer`（参照の1か所のみ）|
| `src/core/motion-preview.js` | RIG ブロックに ` MESH   本体/全体  TRI n  MAT n` の1行（デバッグの Motion Preview だけ。本番 UI は不変）|
| `tests/unit/motion-preview.test.js` | MESH 行の unit |
| `tests/unit/wanderer-visual-freeze.test.js`（新規）| BUILD.wanderer の値・独立性、加入前後の参照、共通関数の既定値（頭の断面の比率・奥行き・目の板の点数）|
| `tests/unit/road-stranger.test.js` | 加入前の姿を動かす unit の代役の BUILD を `wanderer` の行へ（加入前の姿が参照する行が変わったため。値は同じ。assert は変えていない）|
| `tests/character-visual-budget.spec.js`（新規）| 4基礎職・上位4職の描画の量の上限（T-0 の記録値）、影の旅人の形のシグネチャ（加入後のリグ・加入前の立ち / 座りは probe の中で組み立て直して変形込み、影の手は Geometry と Material）と描画の量の一致。期待値は `3b168a2`（変更前）の worktree でも同じ値になることを確認 |

変えていない: 見た目（形・配色・Material の値）、モーション、`17-wanderer-style.js`、`13-update-loop.js`、セーブ、戦闘

### 見た目が変わっていないことの検証
| 検証 | 方法 | 結果 |
| --- | --- | --- |
| 9キャラクターのリグの形 | probe で、木の形・各メッシュのジオメトリ（種類・頂点数・インデックス数・外接箱・頂点座標のチェックサム）・Material（種類・色・発光・質感・透過・flatShading・面・テクスチャの有無）・表示フラグからハッシュを作り、変更前（`3b168a2`）と変更後で比較 | **9キャラクターとも一致**（変更前は2回取得して再現性を確認）|
| 加入前の影の旅人（立ち・酒場の座り）| 同上（組み立て直後の変形も含める）| **一致** |
| 影の手の形 | 影の手の Geometry と Material | **一致** |
| 検査が変化を検出できること | 共通の頭の断面（顎の幅）を一時的に変える / 影の旅人を剣士の行に戻して剣士の頭を大きくする / 首の位置だけを約 7 cm 下げる（`06` の `neck.position.y` の `bodyH*0.99` → `0.90`。Review R-1 の指摘を受け、加入後のリグを probe の中で組み立て直して変形も比べる方式に変えた後）| **3つとも失敗として検出**（変更は元に戻した）|

### 描画回数（変更前後、同じ条件）
条件: Playwright（Chromium・ソフトウェア描画）、1280×800、テストモードのトレーニング空間（旧既定のルール、Lv 50、敵なし）、待機の立ち姿で約1.2秒後。影の旅人は第一章を終えたセーブの酒場。「画面」は `renderer.info.render.calls`（シーン全体の1フレーム）。

| キャラクター | 本体メッシュ | 全メッシュ（= プレイヤーの描画回数）| 三角形 | 本体の固有 Material | 画面の描画回数 |
| --- | --- | --- | --- | --- | --- |
| 剣士 | 82 → 82 | 325 → 325 | 15,744 → 15,744 | 20 → 20 | 340 → 340 |
| 戦騎士 | 91 → 91 | 361 → 361 | 17,320 → 17,320 | 23 → 23 | 376 → 376 |
| 魔法使い | 72 → 72 | 285 → 285 | 15,384 → 15,384 | 19 → 19 | 300 → 300 |
| 魔導士 | 87 → 87 | 345 → 345 | 16,792 → 16,792 | 21 → 21 | 366 → 366 |
| 弓師 | 76 → 76 | 301 → 301 | 15,532 → 15,532 | 22 → 22 | 316 → 316 |
| 鷹の目 | 86 → 86 | 341 → 341 | 17,356 → 17,356 | 26 → 26 | 356 → 356 |
| 盗賊 | 78 → 78 | 309 → 309 | 14,768 → 14,768 | 23 → 23 | 324 → 324 |
| バーサーカー | 83 → 83 | 329 → 329 | 15,544 → 15,544 | 25 → 25 | 346 → 346 |
| 影の旅人 | 82 → 82 | 322 → 322 | 15,508 → 15,508 | 16 → 16 | 406 → 406（酒場）|

- T-0 は描画回数を変えていない（古い鎧の部品は画面に写るため削除しなかった = AD-15）。減らすのは T-1（J-1・J-4・J-6・J-8）と T-7
- iPhone 実機の FPS は未計測（T-8 と各段の PR の実機確認項目）

### 古い鎧の部品の調査（Step 3）
同じフレームで部品を表示 / 非表示にして描き比べ、変わった画素の数（8視点: ゲームカメラ・正面・斜め45°・側面・背面・斜め後ろ・見下ろし・低い位置、× 待機・歩行・攻撃2回）。

| 部品 | 結果 |
| --- | --- |
| 胸当て | 全職で写る（最大 0〜173 画素。鷹の目の待機など一部の場面だけ 0）|
| 脛当て（盗賊・バーサーカー以外）| 全職で写る（最大 21〜869 画素）|
| 足首の帯 | 全職で写る（最大 190〜938 画素）|
| 籠手（盗賊・バーサーカー以外）| 全職で写る（最大 201〜926 画素）|
| 肩当て（戦騎士は転身で非表示）| 全職で写る（魔導士・バーサーカーは 2〜8 画素、他は 20〜610 画素）|

→ **見えない部品は無かった**。T-0 では削除しない（AD-15）。籠手は手袋の縁のように見える（joint analysis J-4）ため、T-1 で Human の V-1 とともに扱う

### 頭身の比較画像（DEC-035、Human の選択待ち）
- 画像: `.ai/reports/CHARACTER-VIS-002-assets/head-ratio-compare.jpg`（行 = 5.0（現行・変更前）/ 4.75 / 4.5 頭身、列 = 正面・斜め前・横・顔の拡大・ゲームカメラ）
- 作り方: 実際のゲームの剣士モデル。撮影のときだけ BUILD.warrior の値を書き換えてリグを組み直した（リポジトリのコードは変えていない）。同じカメラ・照明・待機の姿勢・衣服・武器
- 値（全高 2.54 は同じ。頭を大きくした分 = 頭の半径の増分 × 2 を、脚 6 割・胴 4 割で短くする。首の見える長さは同じ）:

| 頭身 | 頭の半径 headR | 頭の中心までの首 headGap | 胴 height | 太腿 / すね | ベルト hipY |
| --- | --- | --- | --- | --- | --- |
| 5.0（現行）| 0.254 | 0.290 | 0.796 | 0.615 / 0.585 | 1.200 |
| 4.75 | 0.267 | 0.303 | 0.785 | 0.607 / 0.577 | 1.184 |
| 4.5 | 0.282 | 0.318 | 0.773 | 0.598 / 0.568 | 1.166 |

- 比べられるのは頭の大きさと全身の比率だけ。頭の形（顎の丸み）・目・衣服の量感・肩幅は3案とも同じ（T-1 で変える）。肩幅・胴・脚の長さの違いは表の値のとおり
- 選んだ頭身は4系列（剣士・魔法使い・弓師・盗賊）に同じ考え方で入れる。影の旅人は変えない

### Test Report（T-0）
| テスト | 結果 |
| --- | --- |
| `npm run build` | PASS |
| `npm run test:unit` | PASS（2341。`wanderer-visual-freeze` 3件・MESH 行1件を追加）|
| 関連 E2E 67件（`character-visual-budget`〔新規 9〕・`character-clothing`・`character-palette`・`character-weapon-visual`・`character-motion`・`weapon-stow`・`battle-knight-visual`・`wanderer-renewal`・`road2-join`）| **67 PASS**（FLAKY・FAIL なし）|
| 全 E2E | CI で実行（PR #147）|

## Status History
| Date | Target | From → To | By | Note |
| --- | --- | --- | --- | --- |
| 2026-11-22 | Task | — → DRAFT | Agent | WI「第一章・移動中会話システムの横展開」の §8 残件として登録（Human の指示） |
| 2026-11-24 | Task | DRAFT → ANALYZING | Analyzer | Human の着手指示（Analyzer / Planner のみ）。基準 `claude/road-visual-003-r3-7` @ `3b168a2` |
| 2026-11-24 | Task | ANALYZING → PLANNED | Planner | Artifact Handoff（Kind `analysis`、`51ed36a`、blob `3fd9a39c`）H-1〜H-8 PASS。T-0〜T-8 を計画。T-0 / T-7 は Agent Approval（着手は Human の指示待ち）、T-1〜T-6 は E-1〜E-4 の回答待ち（WAITING_APPROVAL）。初版の計画 commit `4a3aa48` |
| 2026-11-24 | Task | PLANNED（変更なし）| Reviewer | `.ai/reports/CHARACTER-VIS-002-plan-review.md` Round 1 = CHANGES_REQUIRED（M-1: 加入前の影の旅人・フード・影の手が共通の関数と BUILD.warrior を使う。S-1〜S-7、N-1〜N-3）|
| 2026-11-24 | Task | PLANNED（変更なし）| Planner | Round 1 の指摘を反映: Analyzer report の新版（`7caabaf`、blob `6eb47b9f`）で Handoff をやり直し H-1〜H-8 PASS。T-0 に共通関数の既定値の固定（オプションで4職が選ぶ）と影の旅人の不変の unit を追加、E-2（顔）・E-4（影の旅人）を Agent Decision（AD-10 / AD-3）へ、旧 E-3 を E-2 に、T-0 / T-7 を PLANNED（AD-11）、T-7 は `weldGeometries`（AD-12）と X 線の再現・壁越しの確認、マテリアル構成の節を追加 |
| 2026-11-24 | Task | PLANNED（変更なし）| Reviewer | Round 2 = **PASS**（Reviewed SHA `031150c`、別コンテキストの Reviewer）。R2-1（should-fix）、R2-2〜R2-4（note）|
| 2026-11-24 | Task | PLANNED（変更なし）| Planner | R2-1・R2-3・R2-4 を本文へ反映、R2-2 は report を改訂せず本 Task の読み替えとして記録（Handoff の版を増やさないため）|
| 2026-11-24 | Task | PLANNED → IMPLEMENTING | Human / Planner | Human Decision DEC-035（E-1 = A、E-2 = A、ポリゴン接合とモーション刷新の追加、T-0 の着手）。T-0 Agent Approval。T-1〜T-6 の E-1・E-2 依存を解除（T-1 は頭身の選択待ち）|
| 2026-11-24 | T-0 | APPROVED → IMPLEMENTING → TESTING | Implementer | 下の Implementation Result（T-0）。見た目の不変を形のシグネチャで確認 |
| 2026-11-24 | T-0 | TESTING → REVIEWING | Implementer | build / unit / 関連 E2E PASS。独立 Reviewer へ |
| 2026-11-24 | T-0 | REVIEWING（変更なし）| Reviewer | `.ai/reports/CHARACTER-VIS-002-T0-review.md` **PASS**（Reviewed SHA `cc1b8f1`、別コンテキストの Reviewer、Round 1/3）。should-fix R-1（加入後のリグのシグネチャが変形を含まない）、note R-2〜R-6 |
| 2026-11-24 | T-0 | REVIEWING → DONE | Implementer / Orchestrator | R-1 を反映（加入後のリグを probe の中で組み立て直し変形込みで比較。首の位置だけの変更を検出することを確認、期待値は変更前 `3b168a2` でも一致）。R-3 / R-4 の記録を更新。R-2（デバッグ表示の毎フレームの走査）は許容範囲として記録のみ。R-5: 比較画像は本 Task file の値の表とあわせて Human へ提示 |
