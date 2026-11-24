# CHARACTER-VIS-002 Plan Review（Analyzer / Planner 成果物の独立レビュー）

## Review Target
- Branch: `claude/wanderer-renewal-001-nhlxns` @ `4a3aa48974f64d90ddb7ee5a127de31c6f602f7c`
- Base: `claude/road-visual-003-r3-7` @ `3b168a2`
- Files:
  - `.ai/reports/CHARACTER-VIS-002-analysis.md`（commit `51ed36a`、blob `3fd9a39c…`）
  - `.ai/tasks/CHARACTER-VIS-002.md`（commit `4a3aa48`）
  - `.ai/reports/CHARACTER-VIS-002-assets/*.jpg`（commit `f2806b7`。`current-front.jpg` / `current-face.jpg` を目視）
- Kind: docs-only（Analyzer + Planner。実装は Human が禁止）

## Independence
Reviewer は Analyzer / Planner とは別のコンテキストで実行した。成果物の記述を前提にせず、コード・Decision Record・git を直接読んで確認した。

## Checks Performed

### 1. Diff の範囲（`git diff --stat 3b168a2..HEAD`）
- 変更は `.ai/reports/CHARACTER-VIS-002-analysis.md`、`.ai/reports/CHARACTER-VIS-002-assets/` の6画像、`.ai/tasks/CHARACTER-VIS-002.md` の8ファイルのみ。**ソース・テストの差分なし** — PASS

### 2. Artifact Handoff H-1〜H-8（再計算）
| # | 結果 |
| --- | --- |
| H-1 | `51ed36a` は HEAD と `origin/claude/wanderer-renewal-001-nhlxns`（= `4a3aa48`）の祖先 — PASS |
| H-2 | `git cat-file -e 51ed36a:<Path>` — PASS |
| H-3 | `git diff --name-only 51ed36a^ 51ed36a` = analysis の1件のみ — PASS |
| H-4 | 1行目 `# CHARACTER-VIS-002 Analysis` — PASS |
| H-5 | Kind `analysis` — PASS |
| H-6 | `git rev-parse 51ed36a:<Path>` = `3fd9a39c31e926de017909dc1e58c1faa3affd38`（HEAD の blob も同一）— PASS |
| H-7 | 基準 `3b168a2` の Task file は DRAFT 登録のみで Analysis 行なし — PASS |
| H-8 | `git show` で読める — PASS |

### 3. FACT / path:line の照合（16件）
| # | 主張 | 確認 | 結果 |
| --- | --- | --- | --- |
| 1 | BUILD `05:2018`、剣士 2.54 / 0.254、魔法使い・弓師 2.40 / 0.240、盗賊 2.42 / 0.242 | `05:2018-2051` | 一致 |
| 2 | `HEAD_SECTION_RATIOS` `05:738-745`、0.38 / 0.72 / 1.06 / 0.92 / 0.60、奥行き ×0.80 | `05:737-745` | 一致 |
| 3 | `HEAD_DEPTH_MUL` 0.85 | `05:899` | 一致 |
| 4 | 目の板 白目 8 / 瞳 6 / ハイライト 4 点 `05:1954-1975` | `05:1965-1974` | 一致 |
| 5 | 目の確定値 0.72 / 0.095 / 0.046 / 1.28、`06:869-893` | `06:869-891`、CHARACTER-VIS-001 `:1766`（Human 確定） | 一致 |
| 6 | 肌色 `06:566`（Human 確定値） | `06:566`、CHARACTER-VIS-001 `:128` / `:1765` | 一致 |
| 7 | `isWanderer` が剣士分岐の中 `06:1175`、BUILD は剣士 | `06:1143` 内の `06:1175`、`06:552 BUILD[classDef.key]`（BUILD に `wanderer` キーなし）、`01:109 kit:'warrior'` | 一致 |
| 8 | 古い鎧: 脛当て `06:667`・足首の帯 `06:690`・胸当て `06:732`・籠手 `06:1740`・肩当て `06:1777` | 各行 | 一致（ただし「膝の球」は別物。S-5） |
| 9 | `xrayMat` `GreaterDepth` `05:2262`、`addXrayShell` `05:2270` | 同 | 一致 |
| 10 | `addOutline` `05:2133-2150` が部品ごとに2枚 | `05:2129-2153` | 内容一致、行は数行ずれ（N-1） |
| 11 | STANCE / STANCE_ALT / STANCE_RELAXED / WEAPON_SOCKET / CLIPS `05:2324/2389/2479/2562/2672` | 同 | 一致 |
| 12 | `buildPlayer` `06:546`、分岐 `06:1143/1298/1456/1553`、`applyJobPromotionVisual` `06:2303`、`clearJobPromotionVisual` `06:2265` | 同 | 一致 |
| 13 | `makeGarmentLoft` `05:617` / `makeOpenGarmentLoft` `05:635`、`buildWandererHoodParts` `17:67`、`06:1234`・`14:104` | 同 | 一致 |
| 14 | D-1（5.0 第一候補、4.5〜5.0 で Human が決める） | CHARACTER-VIS-001 `:168` / `:1258` | 一致 |
| 15 | DEC-T2-9（華奢・縦長、盗賊 2.42）、T-2 V-1「5.0頭身維持、キャラクター性は T-4」 | `:181` / `:673-679` / `:1293` | 一致 |
| 16 | HDR-T4-4 = S-a（BUILD・断面比率を変えない）、HDR-T4-15 = 眉・口を追加しない、HDR-T4-13 = `off` のみ、P-a / W-a、魔法使いの長い髪は未実装 | `:1018` / `:1028` / `:1026` / `:1021` / `:1663` | 一致 |
| 17 | `JOB_IDLE_MUL` `src/core/combat-stance.js:82` | 同 | 一致 |
| 18 | 髪の関数 `makeCharacterHairShell` / `makeHairBang` が `06:916-1100` | 定義は `05:1881` / `05:1923`、`06:948-1081` は呼び出し側 | ずれ（N-1） |
| 19 | C-7「Canvas 試作の記録 `06:799-812`」 | 実際は `06:774-782`（`799-812` は目を球から板へ置き換えた記録） | 誤り（N-1） |

撮影画像（`current-front.jpg` / `current-face.jpg`）は O-1〜O-3・O-6・O-7 の記述（顎の尖った頭、六角形の瞳、弓師・鷹の目のつば、剣士のゲイター）と一致。

### 4. Human の必須項目の網羅
| 項目 | 結果 |
| --- | --- |
| GitHub の状態 / 調査 A〜E | analysis §1 / §5〜§9 にあり |
| 全体設計・共通基盤・職ごと・上位職 | 計画「全体設計」、T-1、T-2〜T-5、T-6 にあり |
| **Material 計画** | **独立した節が無い**（Constraints・C-2・analysis §6 に散らばっている）→ S-6 |
| 実施順と依存・変更ファイル・テスト計画・iPhone 確認項目・リスクとロールバック | あり |
| 反対意見と代替案・優先度 | C-1〜C-10、優先度表にあり |
| Human の判断事項の明示 | E-1〜E-4 にあり（妥当性は下の S-1 / S-2） |

### 5. プロトコル
- FACT / INFERENCE のラベルは概ね適切（O-9 のゲーム画面での発生、Root Cause の可愛さの要因などは INFERENCE と明記されている）
- §17.4 の形式（Trigger / Facts / Why / Options / Recommendation / Minimal answer）は E-1〜E-4 のすべてにそろっている
- Escalation の妥当性: E-1 は妥当（D-1 で最終値を Human が決めると定められており、E-9 に当たる）。E-3 は境界上だが許容できる。E-2 と E-4 は既存の Decision と依頼文から決められる → S-1 / S-2
- T-0 / T-7 の Agent Approval → S-3

### 6. 既存の Human Decision・影の旅人との整合
- CHARACTER-VIS-001 の決定（D-1・DEC-T2-9・HDR-T4-4・HDR-T4-15・確定値・P-D）と直接矛盾する計画は無い。T8 report の PF-1〜6（現状維持）とも衝突しない
- **影の旅人の保護に穴がある** → M-1

## Findings

### M-1（must-fix）加入前の影の旅人と DEC-034 の共有部品が、切り離しの対象から漏れている
- 場所: analysis §9 R-1、計画 T-0 Step 1、T-1 Step 1 / 4、共通化の表（「衣服の Loft の断面の品質」）、Files Not To Change（`14-dungeon-road.js`・`17-wanderer-style.js`）、iPhone の確認項目 7
- 問題: T-0 の固定（`BUILD.wanderer`・`WANDERER_BODY_FREEZE`）は `buildPlayer()` の中だけを対象にしている。ところが加入前の影の旅人 `buildRoadTravelerFigure()`（`14-dungeon-road.js:46`）は `BUILD.warrior` を直接読み（`:48`）、グローバルの `HEAD_SECTION_RATIOS` / `HEAD_DEPTH_MUL` を使う `makeCharacterHead(HEAD_DIMS)`（`:109-110`）・`makeCharacterHairShell`（`:111`）・`makeGarmentLoft`（`:83-95`）を使う。`17-wanderer-style.js` もフード外套と影の手（`:151` palm、`:156` arm）を `makeGarmentLoft` で作っている（8か所）。このため T-1 の `HEAD_SECTION_RATIOS` 変更、E-1 = A の場合の BUILD 4系列（剣士を含む）の変更、T-3 の髪の殻の変更、共通の衣服 Loft の断面の改善は、加入前の影の旅人と DEC-034 の影の手・フードを変えてしまう。そのうえ `14` / `17` は Files Not To Change に入っているので、計画のとおりに進めると「変えない」と「切り離す」が両立しない。依頼の絶対条件（影の旅人を壊さない）に関わる。
- 修正案: (1) analysis R-1 に `14:48`・`14:109-111`・`17` の `makeGarmentLoft` の共有を FACT として追加する。(2) T-0 で、共有関数（`makeCharacterHead` / `makeCharacterHairShell` / `makeGarmentLoft` / `makeEye*`）の既定の挙動を現状のまま固定し、改善は職ごとの呼び出しが新しい引数・新しい表を明示して選ぶ方式にする（または `14` の `BUILD.warrior` を `BUILD.wanderer` へ替える最小の変更を T-0 の Files To Change に入れる）。(3) 影の旅人の不変の検査に加入前の姿（`buildRoadTravelerFigure` のメッシュ数・頂点数の記録、`road-stranger` unit など）と影の手・フードの形を加える。

### S-1（should-fix）E-4 は AD-3 と同じ内容で、Escalation にする必要がない
- 場所: 計画 AD-3、Escalation E-4、T-1 の依存「E-4」
- 問題: 依頼文（影の旅人は対象外・壊さない）と DEC-034 から A（固定）が決まる（§17.2 の 3 と依頼文）。計画自身も AD-3 で A を決めている。B は対象外のキャラクターを変える案で、今回の依頼の範囲外。T-1 が E-4 の回答待ちになり、不要な待ちを生んでいる（CLAUDE.md / §17.1「判断できることを質問しない」）。
- 修正案: E-4 を Escalation から外し、AD-3 だけを残す。B は「次の Task 候補」として記録する。T-1 の依存から E-4 を外す。

### S-2（should-fix）E-2 の推奨は既存の Decision そのもので、目の点数は Human の決定ではない
- 場所: Escalation E-2（あわせて E-1 の Trigger）
- 問題: 眉・口を追加しないことは HDR-T4-15 で決まっている（推奨 A = 既存の決定）。目の点数については、「点数・輪郭・3層構造は不変」は T-4 の Agent が候補値を変えたときのコメント（`06:866-868`）で、Human が確定したのは4つの値だけ（analysis も同じ FACT を書いている）。点数の変更は §17.1 の実装の品質の判断で、T-1 の V-1 で Human が見る。E-1 の Trigger に E-2 が挙がっているが、推奨 A は D-1 の範囲内なので、該当するのは E-9 だけ。
- 修正案: E-2 を Agent Decision に変える（HDR-T4-15 を守り、目の板の滑らかさは T-1 の V-1 で確認する）。または、Escalation として残すなら、§17.3 のどのトリガーに当たるかを具体的に書く。E-1 の Trigger は E-9 だけにする。

### S-3（should-fix）T-0 / T-7 が APPROVED のままだと、Human の「実装は次の指示から」が機械的に守られない
- 場所: Work Items 表、Approval の T-0 / T-7
- 問題: §6.1 の最後の項目は「APPROVED の Work Item は実装してよい」としている。§6 の表では、Human が段階承認を求めた Task は Human Approval になる。今は自由記述の「着手は Human の次の指示から」だけが歯止めで、後続のセッションが Status だけを見て実装に進むおそれがある。
- 修正案: Status を `PLANNED`（Escalation Check: None、Human の着手指示を受けたら Agent Approval）にする。または Status の欄に「Human の着手指示待ち」をはっきり書き、Status History に理由を残す。

### S-4（should-fix）T-7 の部品の統合が、既存の `weldGeometries` を使っていない（§3 Existing System First）
- 場所: 計画 T-7 Step 1（`BufferGeometryUtils.mergeGeometries`）
- 問題: `02-world-common.js` の STATIC GEOMETRY BATCHING（`:495-515` の `weldGeometries`）が、同じ目的（メッシュの統合で描画回数を減らす）を手書きで実装している。コメントには、BufferGeometryUtils は core のビルドに含まれないので使わない、という理由も書いてある。計画は既存の仕組みを検索した記録も、使わない理由も残していない。
- 修正案: `weldGeometries` を再利用・拡張する案を第一にし、使えない場合だけ理由を書く。

### S-5（should-fix）「膝の球」は古い鎧ではなく、T-3 の関節キャップである
- 場所: analysis §2「古い鎧の部品」、計画 Current Implementation、T-0 Step 3
- 問題: 膝の球は `06:658-662`（`kneeCapR = jointCapRadius(...)`、コメント「T-3」）で、CHARACTER-VIS-001 T-3（DEC-T3、関節の接続）で整えた部品。古い鎧の部品と同じ扱いで「作らない」とすると、T-3 の Human 判断の結果を消すおそれがある。肩当ては `playerMixerParts.pauldronL/R`（`06:1784`）として上位職の切り替え（`06:2274-2275` / `06:2375-2376`）から参照されている（`if(P.pauldronL)` で守られてはいる）。
- 修正案: 膝の球を古い鎧の一覧から外し、関節キャップとして扱う（見えないなら別の理由で整理する）。T-0 Step 3 に、肩当ての参照と上位職の切り替えを確認する手順を加える。

### S-6（should-fix）Material 計画の節が無い（Human の必須項目）
- 場所: 計画全体
- 問題: Human が求めた「Material 計画」が独立した節になっていない（Constraints・C-2・T-7 に散らばっている）。
- 修正案: 短い節を追加する。内容: role は増やさない（P-D3 の7つ）、新しい部品の Material（魔法使いの長い髪 = `hairMat`、影の旅人の固定で Material を複製しない）、role の外の小物の Material の扱い、T-7 の統合での共有 Material の dispose 除外の維持、影の旅人の Material を変えないこと。

### S-7（should-fix）T-7 の X 線の修正は、見た目の変化と発生の確認が不足している
- 場所: 計画 T-7 Step 2、AD-6、Acceptance の T-7
- 問題: O-9 は固定カメラの背面の撮影で確認したもので、ゲーム画面で起こるかは未確認（INFERENCE）。analysis U-2 は「見た目は Human の V-1」としているのに、T-7 の Acceptance には V-1 も、壁の向こうのシルエット（X 線の本来の機能）が保たれることの確認も無い。
- 修正案: Step 0 としてゲームカメラでの再現を確認する。Acceptance に「壁に隠れたときの X 線のシルエットは従来どおり出る」を加える。自己遮蔽が消えたことは比較画像で Human に示す。

### N-1（note）path:line の小さなずれ
- 髪の関数の定義は `05:1881` / `05:1923`（`06:916-1100` は呼び出し側）。`addOutline` は `05:2129` から。C-7 の Canvas 試作の記録は `06:774-782`（`06:799-812` ではない）。

### N-2（note）撮影の視点の記述と画像が一致しない
- analysis §3 は「斜め45°」を撮影したと書いているが、assets に45°の画像は無い。

### N-3（note）E-3 は境界上
- 依頼文（個性を維持する）から推奨 A が強く導けるが、Task 名は「デザイン更新」で、承認済みの形をどこまで変えるかには解釈の幅がある。Escalation のままでも許容できる。

## Verdict
**CHANGES_REQUIRED**（must-fix 1件: M-1。should-fix 7件、note 3件）
