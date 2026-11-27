# CHARACTER-VIS-002 — プレイヤーキャラクターのデザイン更新

Status: IMPLEMENTING（Work Item ごとの状態は下の表。DEC-035: E-1 = A・E-2 = A・T-0。DEC-036: 頭身 4.75・T-1。DEC-037: E-3 = B・T-1 の目視確認完了・T-2 の着手。DEC-038: T-2 Human Review の H-1 = O1・H-2 = B・H-3 実装・H-4 実施、T-2R-1〜5）
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
| T-1 | 共通の顔・頭（頭身 4.75、頭の下半分の丸みと前面の奥行き、目の角・輪郭線・向き、首と頭の接合、横の髪）と顔・頭・首・髪の接合の確認。顔のパーツ（口・鼻・眉）と目の部品（瞳孔・まぶた）は E-3 | DONE（下の「T-1 の完了処理」。E-3 = B の口・鼻を実装、Human の iPhone 目視確認完了 = DEC-037、口・鼻の追加分の Reviewer PASS = `.ai/reports/CHARACTER-VIS-002-T1B-T2-review.md`（T-2 のブランチに記録））| [x] | T-0、DEC-036、DEC-037 | あり（4職）|
| T-2 | 剣士（パイロット）: パーカー・ゲイター・袖・裾・ブーツの量感と接続、接合 J-4・J-7・J-8・J-9 の方針決め（AD-19）、帽子の下の髪 J-1。戦騎士への継承の確認 | REVIEWING（Reviewer PASS。**Human Review 2026-11-27 で指摘 A〜D**（`.ai/reports/CHARACTER-VIS-002-T2-human-review.md`）。分析と設計案を提示し Human の判断 H-1〜H-4 待ち。T-2 の承認・T-3 への進行は Human の明示の許可まで保留）| [x] | T-1 | あり |
| T-2R-1 | BGM: 裏に回ったら音を一時停止・戻ったら開始後だけ再開、bfcache、?dev=1 の BGM の数の表示、E2E（DEC-038 H-3）| REVIEWING（Safari は Human 確認で正常。ChatGPT / Claude のアプリ内ブラウザで問題 → 追加調査と修正（`.ai/reports/CHARACTER-VIS-002-T2R1-inapp-browser.md`）。**Human の実機の再確認待ち**、確認まで完了としない）| [x] | T-2 | iPhone |
| T-2R-2 | 顔の確認のプレビュー（?dev=1 の Motion Preview の「顔」カメラ: 正面 / 45° / 横 / 下 / 背面）| PLANNED | [ ] | T-2R-1 | あり |
| T-2R-3 | O1 の共通の頭の拡張（4職のオプション）と髪の貫通の修正（髪の輪・下限・napeSideIn の再評価、貫通の検出テスト）（DEC-038 H-1 / H-4）| PLANNED | [ ] | T-2R-2 | あり |
| T-2R-4 | 職ごとの顔（断面表・口の形・目尻の角度と縦横比 ±10%、値と理由の記録）（DEC-038 H-2）| PLANNED | [ ] | T-2R-3 | あり |
| T-2R-5 | 上位4職への継承の確認と微調整 | PLANNED | [ ] | T-2R-4 | あり |
| T-3 | 魔法使い: 長く広がった髪（承認済み設計の実装）、コートの前開き・袖、キャスケットの丸み、箱型の袖（J-5）、帽子の下の髪 J-1、J-4・J-7・J-8 の展開（J-3 は T-1 で実施済み）| PLANNED | [ ] | T-2 | あり |
| T-4 | 弓師: 帽子の位置とつば（目を出す）、帽子の下の髪 J-1、毛皮の襟（J-6）、短丈上着の裾、J-4・J-7・J-8 の展開 | PLANNED | [ ] | T-2 | あり |
| T-5 | 盗賊: フードの丸み、帽子の位置、オーバーオールの胸当て・パーカーとの重なり（J-10）、J-4・J-7・J-8 の展開 | PLANNED | [ ] | T-2 | あり |
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

### T-2 詳細計画（2026-11-26、Planner。DEC-035〜037 と T-0 / T-1 の成果を引き継ぐ）
- 前提（FACT）: 剣士の衣服は `06` `buildPlayer()` の `classDef.key==='warrior'` の分岐（キャップ・ネックゲイター・背中のフード・膝丈のマウンテンパーカー・ポケット3つ・すね丈のワイドパンツ・ブーツの胴）。影の旅人も同じ分岐で作られ、**パンツとブーツの胴の組み立ては剣士と共有**（`isWanderer` で輪の値だけ分ける）。戦騎士は剣士の部品を着たまま上位職の部品を重ねる（P-a）。籠手（vambrace）は全職共通の腕の組み立て（盗賊だけ作らない）
- 撮影（T-1 の後の状態、`t1-compare-*.jpg` / `joint-*.jpg`）: ネックゲイターが顎と口（E-3 = B で追加）を覆う。パーカーは筒に近い。袖口の籠手が手袋の縁のように見える（J-4）。膝を曲げるとパンツの上下の境目に段差（J-7）。ポケットの縁の輪郭線が継ぎ接ぎに見える（J-8）

| Step | 変更（剣士と戦騎士。影の旅人は条件で除外）| 理由 |
| --- | --- | --- |
| 1 | ネックゲイターの上端を口元の下（headR × 0.55 下）→ 顎の上（× 0.74 下）へ下げ、上端の輪を顎の幅に合わせる（hw 0.80 → 0.82、hd 0.78 → 0.80）。中の輪 × 0.95 → × 1.02 | 顎と口を見せる（T-1 の顔の方向性を活かす）|
| 2 | パーカー: 腰の輪の幅 bodyR × 1.10 → 1.04（くびれ）、裾 × 1.36 → 1.44（A ライン）。丈・前開き・ポケットの数は不変 | 長方形の筒の印象を減らす（E-2 = A の量感の改善）|
| 3 | 籠手（J-4）: 剣士・戦騎士は作らない（長袖のパーカーで袖口から出る部品）| 手首が手袋の縁に見える問題の解消。描画 -8 メッシュ（2本 × 本体 + 輪郭線 2 + X 線）|
| 4 | 膝（J-7）: すね側のパンツの最初の輪を膝より上（太腿の長さ × 0.12）から始め、太さを 1.50 → 1.44 にして太腿側の内側へ差し込む | 膝を曲げても境目が開かない（ポリゴンは増やさず重なりで解決）|
| 5 | ポケット（J-8）: 3つのポケットに輪郭線・X 線シェルを付けない | 外形でない内側の線を減らす。描画 -9 メッシュ |
| 6 | J-9（flatShading）: 剣士では変えない（パンツの flat は布の折り目として読める、ローポリの個性）。方針として記録 | ローポリ調の維持（DEC-035）|
| 7 | J-1（帽子の下の髪）: 剣士の後頭部はうなじに垂れる縦の帯（T-1 の後の状態）。髪の殻の作りの変更が要り、剣士だけで直すと他職と不揃いになるため、T-8 の統合で全職をまとめて扱う（記録）| 範囲の明確化 |
| 8 | 戦騎士の確認: 剣士の変更の上に白いジャケット・強化肩・ハーネスが浮かない / 埋もれないか撮影で確認し、ずれだけ直す | 継承の確認 |

- 変えない: キャップ・フード・パーカーの丈 / 色 / ポケットの数、パンツの丈、武器と収納位置（`WEAPON_SOCKET`）、配色・Material の値、モーション、他の職、影の旅人（形のシグネチャで検査）
- テスト: build / unit / 関連 E2E（`character-visual-budget`〔剣士・戦騎士の上限を下げる〕・`character-clothing`・`character-palette`・`character-weapon-visual`・`character-motion`・`weapon-stow`・`battle-knight-visual`・`base-class-*`・`job-traits`・`wanderer-renewal`・`road2-join`・`chapter1-progression`）、撮影（停止・歩行・攻撃）、独立 Reviewer
- Acceptance: 上の変更どおり、影の旅人・他職に差分なし、描画の量が減る（増えない）、テスト PASS、Reviewer PASS、Human の目視承認（V-1）
- Escalation Check: None（DEC-035 E-2 = A の造形品質・接合の改善、AD-19 で T-2 に割り当て済みの J-4 / J-7 / J-8 / J-9 / J-1。衣服の種類・配色・丈は変えない）
- Agent Approval: Planner (Agent) / 2026-11-26 / `claude/character-vis-002-t2`（DEC-037 の T-2 着手指示）。Persistence: 許可（branch `claude/character-vis-002-t2`、T-1 の先端から。T-1 と同じく別ブランチ・別 PR の運用）

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
| AD-16 | T-1 は PR #147（文書・T-0、未 merge）と目的が異なるため、T-0 の先端 `4e76a69` から別の作業ブランチで実装し、別の PR にする（base は PR #147 の head ブランチ。#147 の merge 後は `claude/road-visual-003-r3-7` へ変更する）| 依頼文「既存 PR の目的と異なる変更を混在させない」「既存の変更を破棄・rebase しない」| PR #147 に積む |
| AD-17 | 4職の頭の改善は、頭の断面の表を `o.sections` で渡す（頭・髪の殻・被り物の隠れ判定・魔導士の髪が同じ表を読む）。目は点の数の引数。首は `softHead` の分岐。共通関数の既定は不変 | 3（DEC-036、AD-3 / AD-14）| グローバルの表の書き換え |
| AD-18 | `character-motion` の T-2 体格テストは、頭身の期待値を 4.75 に、肩の外幅 / 頭の幅の範囲を頭の拡大の比（4.75/5.0）で換算する。肩幅は変えない（DEC-036「肩幅を過度に増やさない」）。換算後の範囲で魔法使い 1.20・盗賊 1.256 は下限付近 → Human の目視確認の項目にする | 3（DEC-036）、1（T-2 V-1a の範囲は 5.0 頭身の頭の幅に対する比）| 魔法使い・盗賊の肩を広げて 1.26 以上を保つ（肩幅の変更）|
| AD-19 | 計画で T-1 に割り当てた接合の項目のうち、J-2（首）は T-1 で実施、J-1（帽子の下の髪）は頭の形の変更で「歯」が縦の帯に変わり、輪の追加は効果が小さく不採用（残りは帽子の深さと合わせて T-2・T-4・T-5）、J-4（籠手）・J-7（膝のパンツ）・J-8（輪郭線の付け方）は胴・腕・脚・全身の部品で DEC-036 の T-1 の範囲（顔・頭・首・髪）の外のため T-2（剣士）で方針を決めて T-3〜T-5 へ展開、J-9（flatShading の方針）は T-2、J-11（ちらつきの動画確認）は T-8 と各段の iPhone 確認。J-3（横の髪）は顔の造形の追加要求で T-1 に前倒し | DEC-036（T-1 の範囲）、Human 追加要求（顔の造形）| T-1 ですべて行う |
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

## Escalation E-3: 顔のパーツ（HDR-T4-15 の再検討）と目の部品
**回答済み（2026-11-26、DEC-037）: B 案**（眉なし、控えめな口 = 小さな微笑みの弧、小さな鼻。既存の目の設計・造形方針は維持 = 瞳孔・上まぶたは足さない）。A / C / D / E は採用しない。以下は回答前の記録。

- Trigger: E-2（HDR-T4-15「眉・口などの新しい顔の造形は追加しない」と、T-4 で Human が承認した目の見た目「目と肌色これでOK」）/ E-9（Human 追加要求「パーツも足りない」が設計案の比較と Human の判断を求めている）
- Facts: 比較資料 `face-design-*.jpg`（実際のゲームモデル）。輪郭・目の輪郭線・向き・横の髪の改善は実装済み。**実装済みの目の変更（輪郭線を外す・外へ 0.28 rad 傾ける・外周の点の数）も T-4 で承認された目の見た目を変えるため、本 Escalation と V-1 の確認対象に含める**（描画上は、瞳の見かけの高さ +15%・ハイライトの面積 +41%・白目どうしの間隔 約 4% 狭い。白目の縦横比 1.28 と左右の瞳の位置は保つ）。口・鼻・眉、瞳孔・上まぶたは撮影のときだけの試作。見下ろしのゲームカメラでは顔が数ピクセルで、パーツの差は主に拡大・会話・低いカメラで効く（`face-design.md` §2）
- Why Agent cannot decide: 既存の Human Decision（HDR-T4-15・T-4 の目の承認）を変える判断
- Options:
  - A: 眉・口なし（HDR-T4-15 のまま）。目に瞳孔と上まぶたの線だけ足す — 影響: 仕様は最小の変更（目の見た目のみ）。拡大で仮面の印象が少し残る
  - B（推奨）: A + 控えめな口（小さな微笑みの弧）と小さな鼻。眉なし — 影響: HDR-T4-15 の「口なし」を変える。拡大・斜めで顔として成立し可愛らしさが出る。部品は小さく見下ろしを崩さない。口・鼻で 1 人 +2 メッシュ（輪郭線なし。左右の目の瞳孔・まぶたを足す場合はさらに +4〜6）
  - C: B + 眉と頬のごく淡い赤み — 影響: HDR-T4-15 の「眉・口なし」を変える。眉は帽子・フードで隠れる職が多い。部品が増え描き込みの印象が強い
  - D: 目の部品も足さない（今の実装のまま。輪郭・目の輪郭線・向きの改善だけ）
  - E: 目の変更をすべて T-4 の見た目へ戻す（輪郭線あり・傾きなし・点の数 8 / 6 / 4）。輪郭の改善だけ残す
- Recommendation: B。理由: Human の「パーツも足りない」に答えつつ、デフォルメとローポリ調を崩さない最小の構成。撮影で正面・斜めの拡大が最も自然
- Minimal answer: 「A」/「B」/「C」/「D」/「E」（瞳孔・上まぶたを外す場合は「B、まぶたなし」のように）

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

### Autonomy Metrics（T-0）
- Human Escalation Count: 0
- Human Decision Count: 1（DEC-035: E-1 = A・E-2 = A・追加要求・T-0 の着手）
- Auto Fix Count: 2（unit の代役の更新 1、Review R-1 の修正 1）
- Reviewer Round Count: 1（PASS）
- Test Retry Count: 0
- PR Created: Yes（#147 を更新）

## Implementation Result（T-1）

### 作業の基準
- 開始時: `main` `209be5c`、`claude/road-visual-003-r3-7` `3b168a2`、PR #147 open（未 merge、head `claude/wanderer-renewal-001-nhlxns` @ `4e76a69`、base `claude/road-visual-003-r3-7`）。PR #144〜#146 は merge 済み
- T-1 は PR #147（文書・T-0）と目的が異なるため混ぜない。T-0 の先端 `4e76a69` から作業ブランチを分けた（AD-16）
- T-0 は DONE（Reviewer PASS、CI 428 passed）。影の旅人の安全性は T-0 の検査（`character-visual-budget`・`wanderer-visual-freeze`）で担保

### Approval（T-1）
- Agent Approval（Escalation Check: None。頭身は Human が DEC-036 で確定、眉・口なしは HDR-T4-15、影の旅人の固定は AD-3）/ Planner (Agent) / 2026-11-25
- Scope: 4職の頭身（BUILD）、頭の下半分の断面、目の外周の点の数、首と頭の接合、顔・頭・首・髪・帽子・フードの接合の確認。衣服・帽子・フード・配色・Material の値・武器・戦闘・モーション・セーブ・影の旅人は変えない

### 頭身（4.75）の計測
定義: 頭身 = stature / (2 × headR)。stature = 足の裏から頭頂（hipY + height + headGap + headR）、被り物・髪・武器を含まない。計測は Motion Preview の `HEADS` 行と同じ式（`motionBodySnapshot`）。

| 系列 | 全高 前 → 後 | headR | headGap | 胴 height | 太腿 / すね | hipY | 頭身 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 剣士・戦騎士 | 2.5400 → 2.5401 | 0.254 → 0.2674 | 0.290 → 0.3034 | 0.796 → 0.7853 | 0.615 / 0.585 → 0.6068 / 0.5772 | 1.200 → 1.1840 | 5.000 → 4.7496 |
| 魔法使い・魔導士 | 2.4000 → 2.3999 | 0.240 → 0.2526 | 0.280 → 0.2926 | 0.740 → 0.7299 | 0.585 / 0.555 → 0.5772 / 0.5476 | 1.140 → 1.1248 | 5.000 → 4.7504 |
| 弓師・鷹の目 | 2.4000 → 2.3999 | 0.240 → 0.2526 | 0.280 → 0.2926 | 0.710 → 0.6999 | 0.600 / 0.570 → 0.5922 / 0.5626 | 1.170 → 1.1548 | 5.000 → 4.7504 |
| 盗賊・バーサーカー | 2.4200 → 2.4200 | 0.242 → 0.2547 | 0.280 → 0.2927 | 0.758 → 0.7478 | 0.585 / 0.555 → 0.5772 / 0.5476 | 1.140 → 1.1248 | 5.000 → 4.7507 |
| 影の旅人（対象外）| 2.54 → 2.54 | 0.254 | 0.290 | 0.796 | 0.615 / 0.585 | 1.200 | 5.000 → 5.000 |

- 作り方（比較画像と同じ）: headR = stature / 9.5。頭の半径の増分 dr の 2 倍（頭 + 首の見える長さを保つため headGap も dr 伸ばす）を脚 6 割・胴 4 割で短くする。hairR は headR と同じ比。肩幅・腰・手足の太さ・動きの係数は不変（「華奢で縦長」の DEC-T2-9 を維持）
- 被り物・衣服・装飾の多くは headR / BUILD 由来の式なので追従する。武器は手の位置から（`updateGrip`）、収納は `WEAPON_SOCKET`（値は不変）

### 変更内容
| ファイル | 変更 |
| --- | --- |
| `src/legacy/parts/05-rendering-rig.js` | BUILD の4系列の頭身の値と頭身の定義のコメント。`HEAD_SECTION_RATIOS_SOFT`（4職の頭の断面: 顎 0.38 → 0.58、顎線 0.72 → 0.88、nosePush 0.08 → 0.07、頬から上は既定と同じ）。`headRatioAt(yFrac, table)`・`headOutlineAt(o)`（`o.sections`）・`makeCharacterHead`・`makeCharacterHairShell` が `o.sections` を読む（省略時は既定の `HEAD_SECTION_RATIOS`）。`makeEyeSclera/Pupil/Highlight` に外周の点の数 `n`（省略時は 8 / 6 / 4）|
| `src/legacy/parts/06-player-enemy.js` | `buildPlayer()`: `softHead`（影の旅人以外）で、頭・`HEAD_DIMS`（髪・被り物の隠れ判定が読む）に `HEAD_SECTION_RATIOS_SOFT`、目の点の数 14 / 12 / 8、首（上端を顎の下面 + 0.05 まで、中心を `HEAD_BACK_Z × 0.5`、上端の太さ `B.neck`）。魔導士の長い銀髪の頭の寸法にも同じ断面 |
| `tests/unit/wanderer-visual-freeze.test.js` | 目の生成関数の既定の点数（`n || 8` 等）、4職だけが改善を選ぶ（`softHead`・`headSections`・`eyePts`）、`headRatioAt` の既定の表 |
| `tests/character-visual-budget.spec.js` | 三角形の上限を +512（目の点の数の分。メッシュ数・Material の数は T-0 のまま）|
| `tests/character-motion.spec.js` | T-2 体格のテストの頭身の期待値 4.75、肩 / 頭の範囲の換算（AD-18）|
| `docs/CHARACTERS.md` | 外見の節: 4.75 頭身、頭身の定義と計測、頭の形、目の点の数 |
| `.ai/decisions/DEC-036-character-vis-002-head-ratio.md` | Human Decision（頭身 4.75）|

変えていない: 衣服・帽子・フードの形、配色・Material の値、武器、モーション、戦闘、セーブ、`17-wanderer-style.js`、`14-dungeon-road.js`、目の大きさ / 間隔 / 瞳 / 縦横比（目は従来どおり headR に比例する `eyeScale`）

### 試して採用しなかったもの
- 被り物の下端の輪（髪の殻に輪を1本足し、後頭部で帽子の下端と殻の交差を消す）: 撮影で効果が小さく（剣士の上端の細い帯だけ）、点の追加に見合わないため戻した。頭の形の変更の後、後頭部のギザギザの「歯」はうなじに垂れる縦の帯に変わっている（joint analysis J-1 の状態の更新）

### 接合部の確認（顔・頭・首・髪・帽子・フード）
| 箇所 | 結果（撮影: 停止・歩行・攻撃、正面・斜め・横・背面・顔・横顔・後頭部）|
| --- | --- |
| 顔と頭部 | 顎の尖りが消え、頬から顎へ丸く繋がる。面の数は同じ（ローポリの面は残る）|
| 頭部と首 | 隙間・段差なし（横・斜め・攻撃中の首振りでも）。魔法使い・盗賊で見えていた細い首の棒が、顎の下に収まった |
| 目 | 外周の角が目立たない丸い目。左右の位置・間隔・向き・瞳の色は同じ |
| 髪と頭部・前髪と顔 | 破綻なし。横の髪の房が頭の横で板に見える（J-3）は残る → T-3 以降 |
| 帽子と髪 | 後頭部のギザギザは縦の帯に変わった。帽子の下の髪の帯は残る（J-1 の残り）→ 職ごとの Work Item で帽子の深さと合わせて扱う |
| フードと頭部 | 盗賊・バーサーカー: 頭の下半分がフードの下で別の塊に見えていたのが、丸い顎で一体に見える |
| ちらつき | 静止画では確認できない（動画での確認は iPhone の実機確認の項目）|

### 後続へ引き継ぐ問題（T-1 の範囲外）
- 帽子のつばで目が隠れる（弓師・鷹の目・盗賊・バーサーカー）→ T-4 / T-5
- 横の髪の房の板（J-3、全職）、籠手（J-4）、魔法使いの袖（J-5）、弓師の襟（J-6）、膝のパンツ（J-7）、部品ごとの輪郭線（J-8）、衣服の重なり（J-10）→ T-2〜T-5
- X 線シェルの自己遮蔽（背面で手が胴越しに光る）→ T-7
- **魔法使いの長い髪（T-3 で実施）**: 承認済みの設計は CHARACTER-VIS-001 の「魔法使い C のデザイン変更（Human Decision 1、2026-09-25）」の「長く広がった髪」。実装されておらず（同記録「髪の新規造形は今回の範囲外として実施していない」）、コードの `06` には旧方針（Phase 8「Mage は長髪キャラクターではない、長髪は魔導士だけ」）のコメントが残っている。後の Human Decision（魔法使い C）が優先し、T-3 で魔法使いに長く広がった髪を実装する（魔導士の銀髪との差は色と長さで付ける。T-3 の計画で確定）

### 比較画像（変更前 = T-0 の状態 `4e76a69`、変更後 = T-1。同じカメラ・照明・姿勢）
- `.ai/reports/CHARACTER-VIS-002-assets/t1-compare-head.jpg`: 顔・横顔・後頭部
- `.ai/reports/CHARACTER-VIS-002-assets/t1-compare-body.jpg`: 正面・斜め45°・横・背面
- `.ai/reports/CHARACTER-VIS-002-assets/t1-compare-poses.jpg`: 歩行・攻撃中の横顔と後頭部
- `.ai/reports/CHARACTER-VIS-002-assets/t1-compare-game-844x390.jpg`: ゲームカメラ（iPhone 横向き相当の 844×390）
- `.ai/reports/CHARACTER-VIS-002-assets/t1-compare-top.jpg`: 見下ろし
- 右端の影の旅人は対象外（変化しないことの確認）。撮影の時刻で待機の姿勢がわずかに違う

### 描画の量
- メッシュ数（描画回数）・固有 Material の数: 9キャラクターとも T-0 と同じ
- 三角形: 4職 +512（約 +3%。目の点の数。輪郭線・X 線シェルの複製を含む）。影の旅人は不変

### T-1 追加: 顔の造形（Human 追加要求 2026-11-25「顔の造形をもっときちんと作って欲しい。目も変だし顔の形も変だし、パーツも足りない」）
- 設計案と比較資料: `.ai/reports/CHARACTER-VIS-002-face-design.md`、画像 `face-design-face.jpg` / `face-design-faceQ.jpg` / `face-design-faceSide.jpg` / `face-design-game-844x390.jpg`（実際のゲームモデル。現状 / 輪郭1 / 輪郭2 / 目の構造 / 案 B / 案 C）
- Human 指示の添付画像（変更前・変更後の正面・側面）はこのセッションに届いていない。照合は手元の比較画像と現行モデルで行った
- 実装した（Human の決定と衝突しない造形の品質改善。4職のみ、影の旅人は既定）:
  | 変更 | 内容 |
  | --- | --- |
  | 前面の奥行き | `HEAD_SECTION_RATIOS_SOFT` の nosePush（既定の `HEAD_SECTION_RATIOS` との比較）: 額 0 → 0.04、頬 0.04 → 0.07、顎線 0.08 → 0.09、顎 0.03 → 0.04（幅は不変。T-1 の最初の版の顎線 0.07 からの変更）|
  | 目の輪郭線 | 目の3枚に `userData.noOutline`（輪郭線・X 線シェルを付けない）。点線の輪の解消。描画 1 人 -18 メッシュ |
  | 目の向き | 左右の目を白目の中心を軸に外へ 0.28 rad（位置の回転 + 板の回転）。回した後に3枚をまとめて横へ戻し、**左右の瞳の位置は回す前と同じ**（間隔 0.095 は瞳の位置として保つ。白目の中心はそれぞれ約 0.004 内側へ寄り、白目どうしの間隔は約 4% 狭い）。大きさ・瞳の半径・縦横比の数値は不変 |
  | 横の髪 | 横の髪の房を太さ 0.62 倍・長さ 0.78 倍、頬の後ろ（headR × 0.16）・上（× 0.10）へ（joint analysis J-3）|
- 描画の量（`character-visual-budget` の上限を更新）: 全メッシュ 1 人 -18（剣士 325 → 307 ほか）、三角形は T-0 より 1 人 -216、本体メッシュ・Material の数は不変
- Review（Round 1、PASS、`.ai/reports/CHARACTER-VIS-002-T1-review.md`）の推奨の指摘への対応:
  | 指摘 | 対応 |
  | --- | --- |
  | S-1 横顔の頬の黒いくさび | 原因は髪の殻（横の髪の房を隠しても残った）。うなじの輪の頬の2点が頭の外（1.09 倍）、顔側の点が内側（0.55 倍）で、その間の面が頬の横へ突き出していた。4職だけ、うなじの輪の頬の2点を頭の面の内側（0.96 倍、`opts.napeSideIn`）へ。撮影でくさびはほぼ消えた（こめかみの小さな影 = 細くした横の髪の房は残る）|
  | S-2 目の描画上の差 | 白目の点の数 14 → 16（真上・真下・真横に頂点 → 描画上の縦横比も 1.28）。回した後に3枚をまとめて横へ戻し、左右の瞳の位置を回す前と同じにした。残る描画上の差（瞳の見かけの高さ +15%: 6 角形 → 12 角形で真上・真下に頂点が来るため、ハイライトの面積 +41%: 4 角形 → 8 角形）は V-1 の確認項目 |
  | S-3 接合の項目の割り当て | AD-19 と Work Items の表に割り当て |
  | S-4 目の変更を E-3 に | E-3 の Facts と E 案（目を T-4 の見た目へ戻す）に追加 |
  | note 魔導士の髪の頭の断面 | `headSections` に変えたところ、転身の関数（`applyJobPromotionVisual`）の中で見えない変数で魔導士の生成が壊れた（`character-visual-budget` の魔導士で検出）。`HEAD_SECTION_RATIOS_SOFT` のまま（魔導士は必ず魔法使い）とし、コメントで理由を残した |
  | note 表記 | 顎線 nosePush の基準、案 B のメッシュ数を統一 |
- 三角形の上限: 白目 16 点の分 1 人 +16（目には輪郭線が無いので複製されない）
- 判断を待つもの（ESCALATION E-3、下）: 目の部品（瞳孔・上まぶた）と顔のパーツ（口・鼻・眉）

### T-1 の完了処理（2026-11-26、DEC-037）
- Human Decision: E-3 = B（DEC-037）。HDR-T4-15 のうち「口」を置き換え（4職）。「眉」は HDR-T4-15 のまま。目の部品（瞳孔・上まぶた）は「既存の目の設計・造形方針は維持」に従い足さない（DEC-037 の「Agent の読み方」）
- 実装（E-3 = B）: `06` `buildPlayer()` の `softHead`（4職）で、頭のメッシュの子に小さな鼻（肌の Material の低い四角錐、headR × 0.06 / 0.10、yFrac 0.40 の前面）と控えめな口（微笑みの弧、幅 headR × 0.26、濃い赤茶 0x6a2e2a、MeshBasic、yFrac 0.27 の前面）。どちらも輪郭線なし。形は Human が判断に使った試作（`face-design-*.jpg` の案 B）と同じ
- 描画: 4職とも本体 +2・全体 +2・三角形 +80・Material +1（`character-visual-budget` の上限を更新）。影の旅人は不変
- `docs/CHARACTERS.md` の外見の節に口と鼻
- **iPhone 実機の目視確認: 完了**（Human、PR #148 のプレビュー `?dev=1`、DEC-037）。確認の対象は口・鼻の追加の前のコード（`3110bfe`）。口・鼻の見た目は Human が判断に使った試作（実際のゲームモデル）と同じ形で入れた
- 比較画像を口・鼻の入った状態で更新（`t1-compare-*.jpg`）
- T-1 の合格条件（Human 追加要求の 1〜10）: 1 完成した顔（輪郭・目・口・鼻）/ 2 正面・斜め・横顔（撮影）/ 3 角・段差なし / 4 目の板の印象の解消（輪郭線なし・外向き）/ 5 立体感（前面の奥行き）/ 6 顔パーツへの回答（E-3 = B）/ 7 可愛らしさ（Human の目視）/ 8 4.75 頭身とのバランス（Human の目視）/ 9 影の旅人に影響なし（形のシグネチャ）/ 10 iPhone（Human の目視完了）→ すべて満たす

### Test Report（T-1）
| テスト | 結果 |
| --- | --- |
| `npm run build` | PASS |
| `npm run test:unit` | PASS（2341）|
| 関連 E2E 93件（`character-visual-budget`・`character-clothing`・`character-palette`・`character-weapon-visual`・`character-motion`・`weapon-stow`・`battle-knight-visual`・`base-class-identity`・`base-class-comparison`・`job-traits`・`wanderer-renewal`・`road2-join`・`chapter1-progression`）| 初回 89 PASS / 4 FAIL → 修正後 93 PASS（FLAKY なし）|
| 初回の FAIL 4件 | `character-motion.spec.js` の T-2 体格（4職）: 頭身の期待値 5.0（DEC-036 で 4.75 に変わった仕様）。期待値を 4.75 へ、肩の外幅 / 頭の幅の範囲（T-2 V-1a の 1.26〜1.46）を頭の拡大の比 4.75/5.0 で換算（1.197〜1.387）した（AD-18）。全高・手とベルト・腰幅の比の assert は変えていない。修正後 4 PASS |
| 関連 E2E 93件（顔の造形の追加・Review の指摘の対応の後、`0923f6d` のコード）| **93 PASS**（FLAKY・FAIL なし）。build PASS、unit 2341 PASS |
| 全 E2E | CI で実行（PR）|

### 影の旅人への非影響
- `character-visual-budget` の影の旅人（加入後のリグ・加入前の立ち / 座り・影の手の形のシグネチャ、描画の量）: PASS（T-0 の値と一致）
- `wanderer-visual-freeze`（unit）: PASS。BUILD.wanderer の値、共通関数の既定値、4職だけが改善を選ぶこと
- 撮影: 影の旅人の頭身 5.0・頭の形・目・首が変更前と同じ

## Implementation Result（T-2）

### 作業の基準
- ブランチ `claude/character-vis-002-t2`（T-1 の先端 `ceaf8a0` から。PR は T-1 のブランチを base にした別 PR）。PR #147・#148 は open（未 merge）
- 計画: 上の「T-2 詳細計画」（Agent Approval）

### 変更内容（剣士と戦騎士だけ。影の旅人は `isWanderer` / `charKey` の条件で除外）
| Step | ファイル | 変更 |
| --- | --- | --- |
| 1 | `06` 剣士の分岐 | ネックゲイターの上端を headR × 0.55 下 → 0.74 下（顎の上）、上端の輪 hw 0.80 → 0.82・hd 0.78 → 0.80、中の輪 0.95 → 1.02 下 |
| 2 | `06` 剣士の分岐 | パーカーの腰の輪 hw bodyR × 1.10 → 1.04、腰の下の輪 1.24 → 1.26、裾 1.36 → 1.44（丈・前開き・ポケットの数は不変）|
| 3 | `06` 腕の組み立て | 籠手（vambrace）を剣士・戦騎士では作らない（`noVambrace`。影の旅人・他職は今のまま）|
| 4 | `06` 剣士の分岐（パンツ）| 剣士のすね側のパンツの最初の輪を膝より上（太腿の長さ × 0.06）へ、太さ 1.50 / 1.40 → 1.44 / 1.24（太腿側の内側へ差し込む。Review S-2 で 0.12 / 1.34 から変更: 膝を 5〜30° 曲げたときに輪の前が太腿側の前面から最大 約 13 mm 突き出していた）。影の旅人のパンツの輪は不変 |
| 5 | `06` 剣士の分岐 | ポケット3つに `noOutline`（輪郭線・X 線シェルなし）|
| 6 | ― | J-9: flatShading は変えない（方針の記録）|
| 7 | ― | J-1: T-8 で全職まとめて（記録）|
| 8 | ― | 戦騎士: 撮影で白いジャケット・強化肩・ハーネスの浮き / 埋もれなし（直す箇所なし）|
| ― | `tests/character-visual-budget.spec.js` | 剣士・戦騎士の上限を下げた（全体 -17、三角形 -692。本体 -2）|

### 描画の量
| | 本体 | 全体（描画回数）| 三角形 | Material |
| --- | --- | --- | --- | --- |
| 剣士 T-1 → T-2 | 84 → 82 | 309 → 292 | 15,608 → 14,916 | 21 → 21 |
| 戦騎士 T-1 → T-2 | 93 → 91 | 345 → 328 | 17,184 → 16,492 | 24 → 24 |
| 他職・影の旅人 | 不変 | 不変 | 不変 | 不変 |

### 比較画像
- `.ai/reports/CHARACTER-VIS-002-assets/t2-compare-warrior.jpg`（剣士・戦騎士・影の旅人 × 前（T-1）/ 後（T-2）× 正面・斜め45°・横・背面・顔・横顔・歩行・攻撃）

### Test Report（T-2）
| テスト | 結果 |
| --- | --- |
| `npm run build` | PASS |
| `npm run test:unit`（`ai-protocol.test.js` を含む）| PASS（2341）|
| 関連 E2E 93件（`character-visual-budget`・`character-clothing`・`character-palette`・`character-weapon-visual`・`character-motion`・`weapon-stow`・`battle-knight-visual`・`base-class-identity`・`base-class-comparison`・`job-traits`・`wanderer-renewal`・`road2-join`・`chapter1-progression`）| **93 PASS**（FLAKY・FAIL なし）|
| 全 E2E | CI で実行（PR）|

### 影の旅人への非影響
- `character-visual-budget` の影の旅人の形のシグネチャ（加入後・加入前の立ち / 座り・影の手）と描画の量: PASS（不変）
- 撮影で変化なし

### Human Review（2026-11-27、PR #149 の iPhone 実機確認）
- 記録と分析: `.ai/reports/CHARACTER-VIS-002-T2-human-review.md`（画像 `t2-review-face-views.jpg` / `t2-review-hair-back.jpg` / `t2-review-hair-vs-head.jpg`）
- A 個性の不足（顔が同じテンプレートの色違い）/ B 顔が平面的・輪郭が不自然（最重要）/ C 後頭部が髪を突き抜ける / D BGM の重複（タイトルで酒場の BGM、開始後に別の音が重なる。iPhone のテスト用ビルド）
- 分析の要点: B は頭の土台（8 点 × 5 段の Loft・奥行き 0.68 倍・前面が平面・目のくぼみ / 耳なし）。C は髪の殻に頭の最大幅の段（0.52）の輪が無いこと・`napeSideIn`・被り物の Coverage が頭の内側まで髪を寄せること。D は Chromium で再現せず、裏のタブ / ホーム画面のアプリの音が止まらないこと（`visibilitychange` / `pagehide` で止めていない）が有力
- 提案: 顔は O1（頭のメッシュの拡張、4職だけのオプション）、職ごとの断面表で作り分け、髪の殻は O1 の中で修正、BGM は裏に回ったら suspend。作業は T-2R-1〜5
- **コードは変えていない**。Human の判断 H-1〜H-4 待ち。顔の大規模な造形変更・T-3 は Human の明示の許可まで着手しない

## Implementation Result（T-2R-1、DEC-038 H-3: BGM の重複対策）

### 作業の基準
- ブランチ `claude/character-vis-002-t2`（PR #149。base / head は変えない）。音響の仕組みは作り直さず、ページのライフサイクルへの対応だけを足す

### Changed Files
| ファイル | 変更 |
| --- | --- |
| `src/audio/audio.js` | `suspendAudio()`（AudioContext を suspend。`closed` 以外は常に送る = resume の途中・iOS の `interrupted` でも止める。`<audio>` の代替は一時停止して、次の `resumeAudio()` で再生）、`bgmDebugInfo()`（音が出うる BGM の数・キー・段・context の状態）。`resumeAudio()` は `interrupted` も再開の対象 |
| `src/legacy/parts/14-hud-boot.js` | `bindAudioLifecycle()`: `visibilitychange` hidden / `pagehide` → `suspendAudio()`。visible / `pageshow`（persisted）/ `pointerdown` → **ゲーム開始後（`state.started`）だけ** `resumeAudio()`。bfcache から戻ったタイトルは `stopBgm()`。`startBgmDebugReadout()`: `?dev=1` の時だけ左下（safe-area の内側）に「BGM n キー/段 context」（2 以上で赤）。`pointer-events:none` |
| `src/legacy/concat-plugin.js` | 2 関数の import |
| `tests/bgm-lifecycle.spec.js`（新規）| タイトル 0・タップでも 0、開始後 1、hidden → suspended（曲は 1 のまま）、visible → running で 1 のまま、戻ってすぐ裏（hidden → visible → hidden を同期で）→ suspended、pagehide → suspended、pageshow persisted → 再開して 1、タイトルへ戻る → 0、タイトルでは裏から戻っても・タップしても suspended / 0、つづきから → running で 1。通常の URL には表示なし |

### 自動テストで確かめる範囲 / iPhone 実機（Human）で確かめる範囲
| 範囲 | 内容 |
| --- | --- |
| 自動（Chromium）| 上の E2E。BGM の数（タイトル 0・開始後 1・増えない）と、裏 / 表で context が止まる・開始後だけ再開すること |
| iPhone 実機（Human）| iOS Safari 固有の挙動（裏のタブ・ホーム画面のアプリの音、bfcache、`interrupted`、裏から戻ったときの resume が拒まれた場合にタップで再開すること）。**実機の確認の前に修正完了とはしない** |

### iPhone での確認の手順（Human）
1. **この修正を含まない古いビルド**（他の Safari タブで開いたままの以前の PR のプレビュー・本番、ホーム画面に追加したアプリ）は、裏で鳴り続けることがある。確認の前に Safari のタブをすべて閉じ、ホーム画面のアプリを上へスワイプして終了する
2. PR #149 のプレビュー `?dev=1` を 1 つのタブだけで開く。左下の表示が「BGM 0」で、タイトルで音が鳴らないこと
3. 開始（つづきから / はじめる）→「BGM 1 tavern/…」で、音が重ならないこと（段の切り替えの 2 秒のクロスフェードの間だけ 2）
4. ホーム画面へ戻る・別のタブへ切り替える → 音が止まること。戻る → 同じ曲が続き、表示は 1 のまま（鳴らなければ画面をタップ）
5. タイトルへ戻る → 0。裏へ回して戻っても、タイトルでは鳴らないこと
6. 本番（main のビルド）で同じことが起きるかは、本番にはこの修正が無いので、手順 1 のあと本番だけを開いて確かめる（任意）

### Test Report（T-2R-1）
| テスト | 結果 |
| --- | --- |
| `npm run build` | PASS |
| `npm run test:unit` | PASS |
| `bgm-lifecycle`・`bgm-regression`・`tavern-bgm`・`audio` | PASS |
| レイアウト系（`action-zone`・`character-zone`・`combat-events-layout`・`hud-zones-layout`・`chapter-select-testmode`、`?dev=1` の表示が常に出るため）| **44 PASS**（最初の実行は開発サーバー 5173 が途中で落ちて 22 件が接続拒否 = 環境の問題。単独で再実行して全件 PASS）|
| 全 E2E | CI（PR #149）|

### Review（T-2R-1）
- Round 1 = CHANGES_REQUIRED（Reviewed SHA `a51c40f`、別コンテキストの Reviewer、`.ai/reports/CHARACTER-VIS-002-T2R1-review.md`）。M-1（resume の途中で裏に回ると suspend が飛ばされる）・M-2（本節が無い）・S-1（safe-area）・S-2（E2E の不足）→ 反映（`f9fc4e5`）
- Round 2 = **PASS**（Reviewed SHA `f9fc4e5`）。M-1 を元に戻すと新しい E2E が落ちることを確認。note R2-N1（Status History の行 → 追加済み）・R2-N2（WebKit の状態の更新が遅いと戻った直後は無音のことがある。タップ等で再開 = iPhone 手順 4）・R2-N3
- **iPhone 実機の確認（Human）待ち。確認の前に修正完了とはしない**

### Human の実機の確認と追加調査（2026-11-27）
- HUMAN: iPhone Safari で直接開くと BGM は正常。**ChatGPT / Claude の iOS アプリの中から開くと BGM の問題が起きる**（詳しい再現条件は未確定）
- 調査と修正: `.ai/reports/CHARACTER-VIS-002-T2R1-inapp-browser.md`。ページの中では BGM は 1 系統でタイトルでは鳴らない（FACT）→ 重なる音は前に開いたページから（INFERENCE: アプリ内ブラウザは閉じても hidden / pagehide を出さずにページが残る）
- 追加の修正: 同じ origin で音の持ち主は 1 ページ（BroadcastChannel の claim）、描画が止まったら一時停止、止めるときにフェード中の音源を切る、`?dev=1` の診断の 2 行目。E2E `bgm-lifecycle` に 2 件（2 つのページ・描画の停止）
- **Safari・ChatGPT・Claude のアプリ内ブラウザでの Human の確認まで T-2R-1 は完了にしない**

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
| 2026-11-25 | T-1 | PLANNED → APPROVED → IMPLEMENTING → TESTING | Planner / Implementer | Human Decision DEC-036（頭身 4.75）。Agent Approval。下の Implementation Result（T-1）|
| 2026-11-25 | T-1 | TESTING → IMPLEMENTING | Implementer | Human 追加要求（顔の造形）。前面の奥行き・目の輪郭線 / 向き・横の髪を実装、顔のパーツ・目の部品は設計案（`CHARACTER-VIS-002-face-design.md`）と E-3 |
| 2026-11-25 | T-1 | IMPLEMENTING（変更なし）| Reviewer / Implementer | Review Round 1 PASS（`7734197` / `c4d66e3`）、推奨の指摘 S-1〜S-4 と note を反映（`0923f6d`）。関連 E2E 93 PASS。E-3 の回答と Human の目視承認を待つ |
| 2026-11-25 | T-1 | IMPLEMENTING（変更なし）| Reviewer | Review Round 2 **PASS**（Reviewed SHA `396c83c`）。S-1〜S-4 解消、回帰なし。note R2-N1（記述の更新、反映済み）・R2-N2（白目の外側の縁と顔の面の隙間 約 0.0006 → iPhone の拡大確認）・R2-N3。PR #148。E-3 の回答と Human の目視承認を待つ |
| 2026-11-26 | T-1 | IMPLEMENTING → REVIEWING → DONE | Planner / Implementer / Reviewer | DEC-037（E-3 = B、iPhone 目視確認完了）。口・鼻を実装（`86c9327`）、関連 E2E 55 + 9 PASS。口・鼻の追加分（`3110bfe..ceaf8a0`）の Reviewer **PASS**（`.ai/reports/CHARACTER-VIS-002-T1B-T2-review.md`、T-2 のブランチ）。目の部品（瞳孔・上まぶた）は DEC-037 の読み方のとおり足していない |
| 2026-11-26 | T-2 | PLANNED → APPROVED → IMPLEMENTING → TESTING | Planner / Implementer | 下の Implementation Result（T-2）|
| 2026-11-26 | T-2 | TESTING → REVIEWING | Reviewer / Implementer | Review **PASS**（`.ai/reports/CHARACTER-VIS-002-T1B-T2-review.md`、Reviewed `ceaf8a0..5d56950`）。S-2（膝の輪の突き出し）を反映: すね側の最初の輪 0.12 → 0.06、奥行き 1.34 → 1.24。S-1 / S-3 は記録を反映、N-2 は docs の白目 16 |
| 2026-11-26 | T-2 | REVIEWING（変更なし）| Reviewer | Review Round 2 **PASS**（Reviewed SHA `4c4d876`）。膝の突き出しは解消（膝 0〜60° ですね側の前面が太腿側の前面より 9.7 mm 以上内側）。note R2-N1: 膝を約 0.5 rad 以上曲げると太腿の裾の下に細い暗い帯（透けない、T-1 の段差より小さい）→ V-1 の確認項目。**Human の目視承認待ち**、承認まで T-3 へ進まない |
| 2026-11-27 | T-2 | REVIEWING（変更なし）| Human / Analyzer / Planner | Human Review（iPhone）で指摘 A〜D。原因の分析と設計案（`.ai/reports/CHARACTER-VIS-002-T2-human-review.md`）。コードの変更なし。Human の判断 H-1〜H-4 待ち、T-2 の承認と T-3 は保留 |
| 2026-11-27 | Task / T-2R-1 | — → IMPLEMENTING → REVIEWING | Human / Planner / Implementer / Reviewer | DEC-038（H-1 = O1・H-2 = B・H-3 実装・H-4 実施、T-2R-1〜5）。T-2R-1 を実装（`a51c40f`）、Review Round 1 CHANGES_REQUIRED → 反映（`f9fc4e5`）→ Round 2 **PASS**。unit 2341・BGM の E2E 16・レイアウト系 44 PASS。iPhone 実機の確認（Human）待ち。T-2R-2 以降は Human の確認の後 |
| 2026-11-27 | T-2R-1 | REVIEWING（変更なし）| Human / Analyzer / Implementer | Human の実機の確認: Safari は正常、ChatGPT / Claude のアプリ内ブラウザで BGM の問題。追加調査と修正（音の持ち主は 1 ページ・描画停止で一時停止・診断の表示）。unit 2341・BGM の E2E 18 PASS。Reviewer へ |
