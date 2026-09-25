# CHARACTER-VIS-001

プレイヤーキャラクターのビジュアル標準の改善（頭身・部位比率・関節・非戦闘歩行・質感）

Status: PLANNED

Analysis: .ai/reports/CHARACTER-VIS-001-analysis.md（branch `claude/character-vis-001-analysis-g029kj` @ `25b13a17f7b2f3ec9d61df8657b3c8f03ec5d054`、blob `cd6828266e4d29dffe3bc296ea210dd50d12472e`）

- Kind: `analysis` / Persisted by: `Human`
- Plan baseline: `main` @ `26f1b52bde9319711685fac51b4b174af321bc48`。
  Analyzer の調査基準 `e31e7df` との `git diff --stat e31e7df 26f1b52 -- src tests` は空（コード・テストの差分なし）。本計画の `path:line` は Analyzer report と同じ行番号で読める
- 本 Task は §7.2 の Work Item（T-1〜T-6）を持つ。承認単位は **各 Work Item**。Task の Status は Task Level の値だけを使う（§7.1）

## Artifact Handoff 検証（H-1〜H-8、AGENTS.md §5.2）

Planner が Handoff の記載を信用せず git から再計算した結果。

| # | 確認 | 実行 | 結果 |
| --- | --- | --- | --- |
| H-1 | Source Branch が remote に存在し、Source SHA が到達可能 | `git fetch origin claude/character-vis-001-analysis-g029kj` → 取得成功。`git merge-base --is-ancestor 25b13a1… origin/claude/character-vis-001-analysis-g029kj` → 真 | PASS |
| H-2 | Source SHA 時点に Path が存在 | `git cat-file -e 25b13a1…:.ai/reports/CHARACTER-VIS-001-analysis.md` → 成功 | PASS |
| H-3 | Source commit の変更が Path の1件だけ | `git diff --name-only 25b13a1…^ 25b13a1…` → `.ai/reports/CHARACTER-VIS-001-analysis.md` のみ | PASS |
| H-4 | Path・1行目が Task ID から組み立てた期待値と一致 | Path = `.ai/reports/CHARACTER-VIS-001-analysis.md`、1行目 = `# CHARACTER-VIS-001 Analysis` | PASS |
| H-5 | Kind が `analysis` で Path が期待 Path | Kind `analysis`、命名例外の適用なし | PASS |
| H-6 | Blob SHA が一致 | `git rev-parse 25b13a1…:.ai/reports/CHARACTER-VIS-001-analysis.md` → `cd6828266e4d29dffe3bc296ea210dd50d12472e`（Handoff 記載と一致） | PASS |
| H-7 | 同じ `(Task ID, Kind)` の既存記録 | `.ai/tasks/CHARACTER-VIS-001.md` は存在しなかった（新規）。新版・二重 Handoff は発生しない | PASS |
| H-8 | Source SHA の内容だけを読む | `git show 25b13a1…:.ai/reports/CHARACTER-VIS-001-analysis.md` で読んだ。working tree の同名ファイルは読んでいない | PASS |

Handoff の成立は「どの版を読むか」の確定であり、Analyzer report の内容の承認ではない（§5.2）。

## Work Items

| ID | Summary | Status | Approval | 依存する DECISION | Analysis |
| --- | --- | --- | --- | --- | --- |
| T-1 | 非戦闘移動の腕の基準姿勢と上半身の歩き寄り化（`updateLocomotion` + `relaxCombatBlend` + `blendPose`） | DONE | [x] | D-3（決定済み） | 上記 `Analysis:` と同じ |
| T-2 | 体格の再設計（キャラクター別の絶対値 BUILD・約5頭身・細身化。第3版） | WAITING_APPROVAL | [ ]（第3版の承認待ち。旧版・新版（第2版）の承認記録は下に残す） | D-1, D-6 維持。D-2 / D-2' / D-7 は改訂済み（DEC-T2-9）。DEC-T2-8 = (a)、DEC-T2-9〜12 = 決定済み | .ai/reports/CHARACTER-VIS-001-T2-analysis.md（branch `claude/character-vis-001-t2-analysis` @ `f7f246e2909e3dc63f9c2f0d1b122f0b42a576cd`、blob `63abdbe139ad273c449dd694071aa3593dd4690f`）+ Planner のコード再確認（★） |
| T-3 | 関節の接続（関節キャップ球と断面の整合、骨盤の扱い） | APPROVED | [x] | D-6（決定済み） | 同上 |
| T-4 | 頭部周り・職別/上位職装飾の直値再調整、戦騎士の頭 0.86 | APPROVED | [x] | D-1, D-8（決定済み） | 同上 |
| T-5 | プレイヤー用マテリアル値の統一（マット化） | APPROVED | [x] | D-4（決定済み） | 同上 |
| T-6 | 支援AI（ゲスト仲間・デコイ）の見た目の寄せ | 取り下げ（Human 判断、2026-09-25。§7.1 / §7.2） | ― | D-5 = 除外 | 同上 |

- T-6 は D-5 に従い人間の判断で取り下げた。§7 に取り下げ用の Status 値は無いため Status 列は「取り下げ」と記す。ID と履歴は残す（§7.2）。§7.1 の Task Level `DONE` 条件では「人間の判断で取り下げ」として扱う
- **実施順（Human 承認済み）: T-1 → T-2 → T-3 → T-4 → T-5。並行実装は禁止**。前の Work Item が `DONE` になるまで次の Work Item の実装に着手しない
- **各 Work Item の完了後に、その Work Item の対象テスト（Test Plan の該当行）を実行する**（Human 指示）
- 各 Work Item の実装開始には、加えて §6 の Persistence と、承認済み Task file の Plan Handoff（Kind `plan`、§5.2）が要る。現時点ではどちらも未了

### T-1 Human Approval
- [x] Approved
- Approved by / date / where: ユーザー（人間）/ 2026-09-25 / Claude Code の Planner セッション（branch `claude/character-vis-001-planner-kzh5di`）の会話で「CHARACTER-VIS-001 のPlanner案をHuman Decisionとして承認します」「T-1 → T-2 → T-3 → T-4 → T-5 の順序を承認」と指示。記入: Planner（人間の指示による）
- Scope of approval: T-1 の Implementation Plan Step 1〜3・Step 4（D-3 = (a)：上半身のみ）・Step 5〜6、Files To Change #1 / #2 / #3 / #4（`motionRigSnapshot()` の読み取り追加のみ）/ #8 / #9 / #10。Decision Record の D-3 に従う
- Persistence:（空欄 = 未許可。承認済み Task file は Human が remote へ push する前提。Implementer の commit / push の許可は別途、人間の明示的な指示が要る）

Implementation (T-1): BLOCKED — 承認済み版の Human Persistence と Plan Handoff（Kind `plan`、§5.2）、および Implementer の Persistence が未了。人間の指示により、現時点では実装しない

### T-2 Human Approval
- [x] Approved
- Approved by / date / where: T-1 と同じ（ユーザー（人間）/ 2026-09-25 / Planner セッションの会話）
- Scope of approval: T-2 の Implementation Plan Step 1〜6、Files To Change #3 / #4（`BUILD`・`WEAPON_SOCKET`・`motionRigSnapshot()`）/ #5（`buildPlayer()` の腕・骨盤）/ #9 / #10。Decision Record の D-1 / D-2 / D-2' / D-7 に従う。**T-1 が DONE になってから着手**
- Persistence:（空欄 = 未許可）

Implementation (T-2): BLOCKED — T-1 と同じ理由に加え、T-1 の DONE 待ち

### T-2 Human Approval（新版の計画。2026-09-25 Planner。上の旧版の承認は記録として残す）
- [x] Approved
- Approved by / date / where: ユーザー（人間）/ 2026-09-25 / Claude Code セッションの会話で「T-2新版を承認、DEC-T2-7は(a)、DEC-T2-8は(a)で確定」と指示。記入: Planner（人間の指示による）
- Scope of approval: 「T-2 詳細計画（新版）」の Step 1〜8、Files To Change #3 / #4（`BUILD`・条件付き `WEAPON_SOCKET`・`motionRigSnapshot()`）/ #5（`buildPlayer()` の腕・骨盤のみ）/ #9 / #10。DEC-T2-7 = (a)、DEC-T2-8 = (a)
- Persistence:（空欄 = 未許可。人間の明示的な指示があった場合だけ `許可（branch: <name>）` と根拠を書く）

Implementation (T-2, 新版): 取り下げ — 第2版の実装 `claude/character-vis-001-t2-impl` @ `cde399d48a0b668e4cb5ac797ea361abff210950`（REVIEWING、main 未統合）は Human の方針変更（2026-09-25）により Review せず、採用しない。第3版で再計画

### T-2 Human Approval（第3版。2026-09-25 Planner。上の2つの承認記録は残す）
- [ ] Approved
- Approved by / date / where:
- Scope of approval:（提案）「T-2 詳細計画（第3版）」の Step 1〜9、同節の Files To Change。DEC-T2-9〜12 は決定済み（2026-09-25）
- Persistence:（空欄 = 未許可）

Implementation (T-2, 第3版): BLOCKED until approval

### T-3 Human Approval
- [x] Approved
- Approved by / date / where: T-1 と同じ
- Scope of approval: T-3 の Implementation Plan Step 1 / 2 / 4、Files To Change #4（プレイヤー専用の断面比率のみ）/ #5（`buildPlayer()` の関節球・Pauldron・骨盤）。Step 3（骨盤の waist 付け替え）は Decision Record の D-6 の条件を満たした場合だけ。**T-2 が DONE になってから着手**
- Persistence:（空欄 = 未許可）

Implementation (T-3): BLOCKED — T-1 と同じ理由に加え、T-2 の DONE 待ち

### T-4 Human Approval
- [x] Approved
- Approved by / date / where: T-1 と同じ
- Scope of approval: T-4 の Implementation Plan Step 1〜3、Files To Change #4（頭部 Coverage / `HEAD_*` 定数）/ #5（`buildPlayer()` の頭部・髪・被り物・目、`applyJobPromotionVisual()`）。Decision Record の D-1 / D-8 に従う。**T-3 が DONE になってから着手**
- Persistence:（空欄 = 未許可）

Implementation (T-4): BLOCKED — T-1 と同じ理由に加え、T-3 の DONE 待ち

### T-5 Human Approval
- [x] Approved
- Approved by / date / where: T-1 と同じ
- Scope of approval: T-5 の Implementation Plan Step 1 / 2（Step 3 = セル調は含まない）、Files To Change #5（`buildPlayer()` / `applyJobPromotionVisual()` のマテリアル値）。マテリアル値表を `05` の BUILD 近傍に置く場合は #4 も含む。Decision Record の D-4 に従う。**T-4 が DONE になってから着手**
- Persistence:（空欄 = 未許可）

Implementation (T-5): BLOCKED — T-1 と同じ理由に加え、T-4 の DONE 待ち

### T-6 Human Approval
- [ ] Approved
- Approved by / date / where: ―
- Scope of approval: ―（取り下げ。ユーザー（人間）/ 2026-09-25 / Planner セッションの会話で「T-6: D-5に従い取り下げる」と指示）
- Persistence: ―

Implementation (T-6): 取り下げ（実装しない）

### Decision Record

決定者はすべてユーザー（人間）/ 2026-09-25 / Claude Code の Planner セッション（branch `claude/character-vis-001-planner-kzh5di`）の会話。

| # | 決定（人間の文言の要約） | 本計画への反映 |
| --- | --- | --- |
| D-1 | **5.0 頭身を第一実装候補とする。身長は維持する。5.0 を最終固定値とはせず、実機確認後に必要なら 4.5〜5.0 付近で微調整する** | T-2 Step 2 は 5.0 頭身の値（表 B：male headR ≈0.254、female ≈0.240）で実装する。Step 1 の「候補比較」は「5.0 頭身での実機確認（V-1）」に読み替える。微調整は 4.5〜5.0 の範囲内に限り、最終値は V-1 を見た Human が決める（AI は決めない）。範囲外が必要と判明した場合は実装せず人間へ戻す |
| D-2 | Planner 案 (a) **身長（頭頂）を維持**（表 B） | 頭頂 Y の変化 ±2% 以内（AC）。R-6 の直値群は触らない |
| D-2' | Planner 案 (ii) **縮んだ分を脚と胴へ按分。headGap は現状維持寄り**。按分の比は実機で確定 | T-2 Step 2。按分比は V-1 で Human が確認する |
| D-3 | **非戦闘時の移動は歩き寄りの姿勢・腕振りへ変更する。走行との完全な速度分離は今回必須としない。移動速度そのものは変更しない。既存の `relaxCombatBlend` / `blendPose` を利用する** | Planner 案の (a) に相当。T-1 Step 1〜4（上半身：腕の基準・腕振り・前傾・bob・腰 pitch）。脚の swing・`strideT` の係数 2.7・`CLASSES.spd`・`inputMag` の扱いは変えない。(a') / (b) / (c) / (d) は本 Task に含めない |
| D-4 | **今回はマット化まで。光沢・金属感を抑えた既存マテリアル拡張を対象とする。セル調・段階的陰影は別 Task** | Planner 案 (a)。T-5 Step 1〜2。`outlineMats()` は変えない（(a+) も含めない） |
| D-5 | **支援AIは統一対象から除外する。現在の簡易モデルを維持する** | Planner 案 (a)。`buildGuestCompanion()` / `buildCompanion()` / `spawnPhantomDecoy()` は変更しない（Files Not To Change へ移す） |
| D-6 | Planner 案 **(b) を先に適用（骨盤は root のまま Y だけ HIP_Y 由来）。実機で分離が目立つ場合だけ (a)** | T-2 Step 4 で (b)。T-3 Step 3（(a) の waist 付け替え）は、V-1 で Human が「分離が目立つ」と判断した場合だけ行う（AI は判断しない） |
| D-7 | Planner 案 (a) **腕長は男女共通のまま BUILD 化** | T-2 Step 2 / 3。`upperLen` / `foreLen` は male / female に同じ値 |
| D-8 | Planner 案 (c) **戦騎士の頭 0.86 は新頭身に合わせて再調整（実機確認）** | T-4 Step 3。値は V-1 で Human が確認する |
| 共通 | **新しい仕様を勝手に追加しない** | Implementer は上表と Implementation Plan に無い変更をしない（§10） |
| D-2（改訂、2026-09-25、DEC-T2-9） | **「全キャラクターで同一の全高を維持する」方針を撤回。キャラクターごとの絶対値 BUILD で基準全高を定義する** | T-2 第3版。旧 D-2 の記載は上に残す |
| D-2'（改訂、2026-09-25、DEC-T2-9） | **「頭を小さくした分を脚と胴へ一定比率で按分する」方針を撤回。頭・脚・胴をキャラクターごとの絶対値として定義し、構造上必要な座標だけを各絶対値から算出する** | T-2 第3版 |
| D-7（改訂、2026-09-25、DEC-T2-9） | **「男女共通の腕長」を撤回。キャラクターごとの固定絶対値として upperLen / foreLen を定義する** | T-2 第3版 |
| 目的（2026-09-25、DEC-T2-9） | **5頭身という数字だけでなく、「華奢で、横幅が狭く、縦にスッとしたシルエット」を実現する** | T-2 第3版の AC・V-1 |

## Request

- 既存のキャラクター生成・姿勢・歩行・マテリアルシステムを拡張し、キャラクターのビジュアル標準を改善する
- Analyzer 判定 A（既存システムの拡張で対応可能）
- 優先: (1) 身長・頭身の自然化 (2) 部位比率の整理 (3) 肩・肘・膝の接続改善 (4) 非戦闘歩行を「腕を上げたジョギング」から自然歩行へ (5) トゥーン調・マット寄りの質感 (6) 既存の職業・武器・戦闘モーション・攻撃システムの維持
- 今回 Planner で特に整理する設計判断: D-1 / D-3 / D-4 / D-5（2026-09-25 に人間が決定。上の Decision Record。下の「Human Decisions Required」節は決定前の選択肢の整理として残す）

## Goal

新しいキャラクター生成システム・新しい歩行システムを作らず、`BUILD` / `makeCharacter*()` / `updateLocomotion()` / `STANCE_RELAXED` + `relaxCombatBlend` + `blendPose()` / `buildPlayer()` 内のマテリアル生成、という既存機構の値と補間の起点だけを変えて、上記 (1)〜(5) を達成する。(6) は `STANCE` / `STANCE_ALT` / `CLIPS` / 近接判定を変更しないことで守る。

## Constraints

- Existing System First（AGENTS.md §3）。新規の生成関数・リグ・歩行ステートマシン・マテリアル基盤を作らない
- `src/legacy/parts/` は連結スコープ。module 分離しない。`src/core/` は純粋関数のみ（§13）
- `basefile.html` は変更しない
- 攻撃判定・ダメージ・AI・移動速度（D-3 で (b) が選ばれない限り）・セーブ形式を変えない

---

## Current Implementation（FACT。出典は Analyzer report。Planner が再確認した箇所は ★）

| 領域 | FACT | 根拠 |
| --- | --- | --- |
| 体格 | `BUILD.male/female` の1テーブル。組み立ては `buildPlayer()` 1箇所 | report §1–2、★`05-rendering-rig.js:1903-1933` |
| 頭身 | male 頭頂 ≈2.5405 / 頭の高さ 0.741 → **約 3.43**、female 2.4015 / 0.703 → **約 3.42** | report §2 の表、★Planner 再計算一致 |
| 頭身の経緯 | 参考画像に合わせ `headR 0.290 → 0.39`（コメント上「約4.7→約3.5頭身」）、その後 Uniform 95% で 0.3705 | ★`05:1911-1921` |
| 顎と襟 | 顎 Y 1.80（male）が胴上端 1.90 より 0.10 下（首が埋没） | report §2 |
| 腕長 | 上腕 0.32 / 前腕 0.30 の直値、男女共通 | report §2、`06:1506,1513` |
| 骨盤 | Y=0.80 直値、root 直下（waist に追従しない） | report §3 |
| 移動中の腕 | `armLBase` 等は `buildPlayer()` で `activeStance()`（戦闘の構え）から1回だけ複製 | ★`06:1609-1615, 1762-1765` |
| 休め姿勢 | `w = relaxStopBlend * (1 - relaxCombatBlend)`。`relaxStopBlend` は移動中 0 → **移動中は休め 0%** | ★`05:3659-3697` |
| blend の更新順 | `stepRelaxedBlends()` は `applyCombatPose()` 内（`05:3511`）で呼ばれ、`updateLocomotion()` より**後** | ★`05:3511`、report §5 のフレーム順 |
| 歩調 | `strideT += moveSpeed*dt*2.7`、`swing = min(0.62, 0.045+0.085*v)*strideAmp`、`run = min(1, swing/0.55)`、bob `(0.05+run*0.035)`、前傾 `min(0.13, v*0.019)` | ★`13-update-loop.js:1153-1159, 1303, 1332` |
| 速度 | `speed = classDef.spd`（4.4〜7.0）×`min(1, inputMag)`。歩き/走りの区別なし。タッチスティックはアナログ、キーボードは実質 1 | ★`13:72-76, 554, 588-592`（キー入力は ±1 に clamp → `min(1,inputMag)` = 1）、`10-input.js:50-80` |
| 足音 | `playFootstep(run)` が `run` を SE に渡す | ★`13:1183`、`02-world-common.js:820` |
| 戦闘との関係 | `applyCombatIdlePose()` は今フレームの歩行姿勢を補間の起点にする | ★`05:3590-3600` |
| 武器・弾 | 武器は `updateGrip()` が手のワールド座標から毎フレーム再計算。弾は `projectileOrigin()` が weapon / weaponTip のワールド座標（収納時は `pos.y+1.1` 直値） | ★`11-combat-actions.js:980-1000` |
| 近接判定 | `core/melee-hit.js` は距離・角度のみ（メッシュ非依存） | report §6 |
| マテリアル | `buildPlayer()` 内で `MeshStandardMaterial` を毎回 new。`MeshToonMaterial`/`gradientMap` 0件。アウトラインは `outlineMats()` 全キャラ共有 | report §7 |
| 支援AI | ゲスト仲間 `buildGuestCompanion()` = 円柱+球の固定寸法・歩行アニメなし。デコイも固定寸法。`buildPlayer()` の2回呼びはリグを壊す | report §9、★`11:1426-1430` |
| テスト | 体格・歩行の数値アサーションなし。スクショ比較 0件。`tests/unit/lowpoly-primitives.test.js` は BUILD を import せず、`BUILD.male相当` の**リテラル値**で Loft 関数を検査 | report §10、★`lowpoly-primitives.test.js:249-764` |

---

## Human Decisions Required（D-1 / D-3 / D-4 / D-5 は本 Planner で重点整理）

> 2026-09-25 決定済み。決定内容の正本は上の「Decision Record」。本節は決定前に人間へ提示した選択肢の記録で、推奨候補は提案のまま残す。

各項目は「Analyzer が確認した現状（FACT）」「選択肢」「メリット/デメリット」「他への影響」「Planner の推奨候補（提案）」で書く。**推奨はあくまで提案で、決定ではない。**

### D-1 目標頭身

**Analyzer が確認した現状（FACT）**
- male 約 3.43 / female 約 3.42 頭身。`headR` が唯一の頭身レバーという設計コメント（`05:1908-1910`）
- 過去にユーザーの参考画像で意図的にチビ化した経緯がある → **今回は方針の反転**。Human の明示的な方針転換確認が必要
- 目・髪・被り物は `headR` 比に追従する設計。直値の位置指定が `buildPlayer` 内に 29 行残る（R-1）

**コード上の寸法から判断できる範囲（Planner の算出。すべて report §2 の式 `頭頂 = hipY + height + headGap + headR`、`頭の高さ = 2×headR` による）**

表 A: **体の他の値を変えず `headR` だけ縮める**場合（身長が下がる）

| 目標 | male headR | male 頭頂 | 身長変化 | male 顎−襟 | female headR | female 頭頂 |
| --- | --- | --- | --- | --- | --- | --- |
| 現状 3.4 | 0.3705 | 2.541 | ― | −0.100（埋没） | 0.3515 | 2.402 |
| 4.0 | 0.310 | 2.480 | −2.4% | −0.040 | 0.293 | 2.343 |
| 4.5 | 0.271 | 2.441 | −3.9% | −0.001 | 0.256 | 2.306 |
| 5.0 | 0.241 | 2.411 | −5.1% | +0.029 | 0.228 | 2.278 |
| 5.5 | 0.217 | 2.387 | −6.0% | +0.053 | 0.205 | 2.255 |
| 6.0 | 0.197 | 2.367 | −6.8% | +0.073 | 0.186 | 2.236 |

表 B: **身長（頭頂）を維持**する場合（D-2 = 維持）。`headR = 頭頂 / (2×N)`、縮んだ分を hipY / 脚長 / 胴 / headGap のどこかへ再配分する

| 目標 | male headR | 再配分が要る量（male） | female headR | 再配分（female） |
| --- | --- | --- | --- | --- |
| 4.0 | 0.318 | +0.053 | 0.300 | +0.051 |
| 4.5 | 0.282 | +0.088 | 0.267 | +0.085 |
| 5.0 | 0.254 | +0.116 | 0.240 | +0.111 |
| 5.5 | 0.231 | +0.140 | 0.218 | +0.133 |
| 6.0 | 0.212 | +0.159 | 0.200 | +0.151 |

コードから言えること（FACT からの算出 / INFERENCE を区別）:
- 算出: 顎が襟より上に出る（首が見える）のは、他を変えない場合 **約 4.5 頭身以上**（`headGap − headR > 0` ⇔ `headR < 0.27`）
- 算出: 現状の脚長（hipY 1.10）/ 身長は約 43%。表 B で再配分を全て脚へ回すと 5.0 頭身で約 48%、6.0 で約 50%
- 算出: 目・髪は `headR` 比なので、5.0 頭身では目の見かけ寸法が現状の約 65%（0.241/0.3705）、6.0 で約 53%
- 算出の食い違い（未解決）: コメントの「headR 0.290 ≈ 4.7 頭身」は、**現在の体寸法**で計算すると約 4.24 頭身になる（`(1.10+0.80+0.27+0.29)/(2×0.29)`）。当時の体寸法が今と違った可能性（INFERENCE）。過去の見た目の記憶を基準に選ぶ場合は注意
- 表 A は身長が下がるため、カメラ注視点・VFX の高さ直値（R-6、`13:1434` の `+0.9 / 1.5`、`13:2275` の `+1.6`、`07/10/11` の直値 16 件）とのずれが 2〜7% 生じる。表 B はこのずれが原理上ない

**実機確認が必要な範囲（コードからは判断できない）**
- 見下ろしカメラでの顔・目の視認性（目の実寸が 53〜79% に縮むことの見え方）
- 見下ろし視点の遠近で頭が相対的に大きく見える効果（INFERENCE: 同じ数値でも正面図より低頭身に見える可能性）
- 「自然」「チビではない」と感じる閾値、職ごとの被り物（兜・フード・帽子）込みのシルエット
- 女性体型・上位職4種での見え方
- Analyzer は実画面比較を行っていない（report Unknowns）

**選択肢**

| 案 | 内容 | メリット | デメリット / 影響 |
| --- | --- | --- | --- |
| (a) 4.0〜4.5 | headR 0.28〜0.32 | 既存の Head/Helm 調整（`05:796-935`）の前提からの乖離が最小。首が「ちょうど見え始める」。R-1/R-11 の再調整量が少ない | 「頭身が低い」の改善幅が小さく、まだデフォルメ寄りに見える可能性 |
| (b) 5.0〜5.5 | headR 0.22〜0.25 | 明確に等身が上がり首・肩が出る。目は 60〜65% で、まだ見下ろしで読める範囲の可能性（要実機） | 兜の Face Opening・Coverage、フード、帽子の直値の再調整（T-4）が中規模。脚胴の再配分（T-2）が必須 |
| (c) 6.0〜6.5 | headR 0.18〜0.21 | 自然寄り | 目が約半分。顔パーツの再設計が必要になる可能性（Loft 頭部の比率表まで変える → T-4 が大きくなる）。デコイ・仲間との差が目立つ |
| (d) 7 以上 | リアル比率 | ― | 本 Task の「既存拡張」の範囲を超える可能性が高い（顔の再設計）。推奨しない |

**他の設計への影響**: D-2（身長維持か）/ D-7（男女差）/ D-8（戦騎士 0.86）/ T-4 の作業量 / R-6（表 A の場合）/ `weapon-stow.spec.js` の tipY 範囲（収納ソケットが胴に依存、R-5）

**Planner の推奨候補（提案）**: **(b) 5.0 頭身前後を第一候補、(a) 4.5 を保守候補**とし、**D-2 は「身長維持（表 B）」**を合わせて推奨。
理由: 首が見える閾値（≈4.5）を確実に越え、かつ顔パーツの再設計（(c) 以上）に入らない範囲で最大の改善が得られる。身長維持なら R-6 の直値群を触らずに済む。

**決め方の提案**（D-1 を一度で確定しにくい場合）: 既存の前例「Head Silhouette Global Redesign Phase：実機 Playwright 比較 Candidate A/B/C」（`05:1915-1921`）に倣い、
Human が **候補を2〜3値に絞って T-2 を承認**し、T-2 の Step 1 で候補ごとの 8職×男女スクリーンショットを作って Human が最終値を選ぶ、という二段階にできる（その場合の T-2 は「候補比較 → 選択 → 本適用」の3 Step。下記 T-2 Plan 参照）。

### D-3 歩行と走行を分けるか

**Analyzer が確認した現状（FACT）**
- 歩き/走りの区別なし。速度は `classDef.spd × min(1,inputMag)`。全職の通常速度で `run` = 0.76〜1.0（sprint 寄り）
- 「腕を上げたジョギング」の**直接原因は腕の基準姿勢**（戦闘の構え `STANCE` のまま、移動中は休め 0%）。歩調の係数は第二の原因

**コード上の寸法から言えること（Planner の算出）**
- 現在の1歩の長さ = π / 2.7 ≈ **1.16 m/歩**（位相 π で1歩）。剣士 5.0 m/s で約 4.3 歩/秒
- 脚長（股関節 1.13）と swing 0.47 rad での幾何学的な歩幅 ≈ 2×1.10×sin(0.47) ≈ 1.0 m → **現状は歩幅と移動量がほぼ一致**している（足が滑りにくい）
- 「歩行らしい振幅」（swing 0.25〜0.30 rad 程度）にすると幾何学的歩幅は約 0.55〜0.65 m。**速度 5.0 m/s のまま足を滑らせないには 約 8 歩/秒** が必要になり、かえってせわしなく見える（INFERENCE）。
  → 速度を変えずに「歩行の脚」にすると、足の滑り（ケイデンスを落とす場合）か早足（ケイデンスを保つ場合）のどちらかが出る。これは (a) の構造的な限界
- 身長 2.54 を人間 1.75 m に換算すると 5.0 m/s は約 3.4 m/s（ジョギング相当）（INFERENCE: 等倍換算）

**選択肢**

| 案 | 内容 | メリット | デメリット / 影響 |
| --- | --- | --- | --- |
| (a) 速度は現状のまま、**非戦闘の上半身だけ**を歩行寄りに | 腕の基準を休め姿勢へ（T-1 の核）、腕振り係数・前傾・bob・腰 pitch の `run` 由来項を非戦闘時だけ抑える。脚の swing/ケイデンスはほぼ維持 | ゲームプレイ・タイマー・E2E の移動時間に影響なし。脚の滑りが出ない。最小変更 | 見た目は「落ち着いた小走り」までで、厳密な「歩き」にはならない |
| (a') (a) + 脚の歩調も歩行寄り | swing を下げ、2.7 を変える | 上半身・脚とも歩行の絵に近づく | 上の算出のとおり、足滑り or 早足が出る（実機確認必須） |
| (b) 非戦闘の移動速度自体を下げる | `speed` に非戦闘係数 | 物理的に正しい歩行になる | **ゲームプレイ変更**。シナリオタイマー（`scenario-timer.spec.js`）、護衛（`mansion-escort.spec.js`）、ゲスト仲間の追従、移動を伴う E2E 全般に影響。本 Task の範囲外の可能性が高く、`docs/` 仕様更新が要る |
| (c) `inputMag` で歩行⇔走行をブレンド | 既存 `inputMag` を歩調・上半身の重みにも使う | 既存の値だけで実装できる。スティックを浅く倒すと歩く | **キーボードは inputMag が実質 1** なので、PC では常に走行側になり「非戦闘の自然歩行」は見えない。タッチ/ゲームパッドのみの改善 |
| (d) 歩行キー（修飾キー）を新設 | 入力追加 | 明示的 | 入力 UI・設定・タッチ UI の追加 = 新機能。本 Task の範囲外 |

**他の設計への影響**: T-1 の範囲、R-7（戦闘態勢中の移動の見え方）、足音 `playFootstep(run)`（`run` を下げると SE が変わる）、土煙 `spawnLandingDust(…, 0.26+run*0.22)`

**Planner の推奨候補（提案）**: **(a)**。必要なら (c) を**上乗せ**（(a)+(c)。キーボードでは (a) の見え方、アナログ入力では浅く倒すと歩調も落ちる）。
理由: 報告された違和感の直接原因（腕の基準）を解消でき、ゲームプレイ速度に触れない。(b)/(d) は別 Task とすべき規模。
(a') は足滑りのリスクがあるため、採る場合は T-1 の中で係数を実機確認してから確定する形を推奨。

### D-4 トゥーン調の範囲

**Analyzer が確認した現状（FACT）**
- 全て `MeshStandardMaterial`（PBR）。ACESFilmic / exposure 0.78（`02-world-common.js:55,65`）
- `MeshToonMaterial` / `gradientMap` は 0件。トゥーン的表現は (1) 反転ハルのアウトライン（`outlineMats()` 全キャラ共有）と (2) ドットモードの posterize（設定 ON 時のみ）
- 過去の前例: 剣士兜だけ `warriorHelmMat` に分離（共有 `metalMat` の変更が投げナイフへ波及するため）（`06:1075-1095`）

**選択肢**

| 案 | 内容 | Analyzer 判定 | メリット | デメリット / 影響 |
| --- | --- | --- | --- | --- |
| (a) マット化のみ | roughness↑ / metalness↓ / emissive↓ / bumpScale↓ の値調整。プレイヤー用マテリアル値を1つの表に集約（BUILD と同じ作法） | A | 既存拡張のみ。敵・ボスへ波及しない（個別インスタンス）。ロールバック容易 | 陰影は連続的なまま。「トゥーン」とまでは見えない可能性 |
| (a+) (a) + アウトラインの扱いの確認 | プレイヤーのアウトラインは既に always（`06:1782`）。太さ・色を変えるなら共有 uniform `uWidth` のため**敵・ボスへ波及**（R-8） | A（ただし共有部に触れる） | 輪郭の強調 | 全キャラクターに影響。本 Task の「プレイヤー」範囲を越える |
| (b) 陰影の段階化 | `MeshToonMaterial` + `gradientMap`、または `onBeforeCompile` で Standard を段階化 | **B（一部新規）** | 本当のセル調 | 新しいマテリアル経路。テクスチャ/bump/emissive との組み合わせの再調整、ドットモード posterize との二重適用の扱い、ライト設定との相性、パフォーマンス確認。職別装飾 43 個の Material も対象にするかの判断が要る |

**他の設計への影響**: T-5 の規模、R-8 / R-10、ドットモード設定、敵とのトーン差（プレイヤーだけマット化すると敵・ボスとの質感差が生じる。INFERENCE）

**Planner の推奨候補（提案）**: **(a)**。アウトライン（共有）は本 Task では変えない。
(b) を望む場合は **別 Task（B 判定の新規マテリアル経路として Analyzer から）** に分けることを推奨。

### D-5 支援AIを統一対象に含めるか

**Analyzer が確認した現状（FACT）**
- ゲスト仲間 `buildGuestCompanion()`（`08-loot-equipment.js:1020`）: 円柱(1.1)+球(0.32)+棒の固定寸法、`MeshStandardMaterial` 個別生成、歩行アニメなし（位置と `rotation.y` のみ）
- 浮遊使い魔 `buildCompanion()`: Icosahedron（人型ではない）
- 幻影デコイ `spawnPhantomDecoy()`: Cone+Sphere 固定寸法（`body.y 0.80`, `head.y 1.78`）、「プレイヤーの見た目に寄せる」コメント
- `buildPlayer()` はシングルトン前提（`playerMixerParts`）。2回呼ぶとプレイヤーのリグを壊す（`11:1426-1430`、ARCHITECTURE.md）
- 既存 E2E: `tests/guest-companion.spec.js`（ゲスト仲間が訓練用ダミーと戦う）

**選択肢**

| 案 | 内容 | 判定 | メリット | デメリット / 影響 |
| --- | --- | --- | --- | --- |
| (a) 含めない | プレイヤー（8職+上位職4種）のみ | A | 範囲が明確。T-6 を取り下げ | プレイヤーと仲間の見た目の差が今より広がる（INFERENCE） |
| (b) 簡易図形のまま寸法・色調だけ寄せる | 仲間/デコイの円柱・球の高さ・頭の比率を新しい頭身・身長に合わせ、マテリアル値を T-5 の表に寄せる | A | 既存関数の値変更のみ。小規模 | 人型の「統一」にはならない（シルエットの寄せのみ） |
| (c) 仲間にもプレイヤーと同じ人体・歩行 | `makeCharacter*()` で人体を組む、歩行を付ける | **B〜C** | 真の統一 | `buildPlayer()`/`playerMixerParts` がシングルトン → リグのインスタンス化（構造変更）が必要。Existing System First に照らして本 Task の範囲外。別 Task で Analyzer から |

**他の設計への影響**: T-6 の有無、`guest-companion.spec.js`、`tests/unit/decoy.test.js`（寸法の検査なし。検索語 `0.80|1.78|head`）

**Planner の推奨候補（提案）**: **(a)**。(b) は D-1 確定後にプレイヤーとの差が気になる場合の追加 Work Item として残す（T-6 を保留）。(c) は別 Task。

### その他の DECISION（Analyzer report の D-2 / D-6 / D-7 / D-8。本 Planner では要点のみ）

| ID | 論点 | 選択肢 | Planner の推奨候補（提案） | 関係 WI |
| --- | --- | --- | --- | --- |
| D-2 | 身長を維持するか | (a) 維持（表 B）/ (b) 変更（表 A、R-6 の全箇所確認） | (a) 維持 | T-2 |
| D-2' | （D-2 = (a) の場合）再配分先 | (i) 脚へ（hipY・thighLen・calfLen）/ (ii) 脚と胴へ按分 / (iii) headGap（首）へ | (ii)。首は headR 縮小だけで自然に出る（上の算出）ため headGap は現状維持寄り。実機で確定 | T-2 |
| D-6 | 骨盤を waist に追従させるか | (a) 追従（腰 twist が脚付け根に乗る）/ (b) root のまま Y だけ HIP_Y 由来に | (b) を先に適用し、実機で分離が目立つ場合だけ (a) | T-3 |
| D-7 | 腕長の男女差 | (a) 共通のまま BUILD 化 / (b) 男女で差を付ける | (a)（BUILD 化で後から変えられる） | T-2 |
| D-8 | 戦騎士の頭 0.86 | (a) 残す / (b) 1.0 に戻す / (c) 新頭身に合わせて再調整 | (c)（全体の頭身が上がった後に 0.86 を掛けると、戦騎士だけ過度に小頭になる可能性。実機確認） | T-4 |

---

## Implementation Plan（Work Item ごと）

すべて提案。承認された Work Item の範囲だけを実装する。

### T-1 非戦闘移動の腕の基準姿勢と歩調

再利用: `STANCE_RELAXED` / `JOB_RELAXED_STANCE` / `activeRelaxedStance()` / `relaxCombatBlend` / `blendPose()`（`core/combat-stance.js:299`）/ `BUILD.armSwing,bobAmp,strideAmp`

| Step | ファイル / 関数 | 変更内容 | 理由 |
| --- | --- | --- | --- |
| 1 | `src/core/relaxed-idle.js`（純粋関数を追加） | `locomotionArmBase(combatStance, relaxedStance, combatW)` 相当: 構えと休めの shL/shR/elL/elR を `combatW`（= relaxCombatBlend）で補間した腕の基準を返す。中身は `blendPose()` の再利用 | 補間の起点を unit test で検査できるようにする（既存 `buildRelaxedIdleTarget` と同じ作法） |
| 2 | `src/legacy/parts/13-update-loop.js` `updateLocomotion()` の腕ブロック（`:1208-1216`） | `P.armLBase` 等の固定値の代わりに、Step 1 の結果を基準にする。`busy` 中は従来どおり書かない | 移動中の腕が「戦闘の構え」基準である直接原因の解消 |
| 3 | 同上 | 腕振り係数を非戦闘時は休め側の値へ寄せる（`P.armSwing`（STANCE 由来）と非戦闘用係数を `combatW` で補間。非戦闘用係数は `CLASS_RELAXED_IDLE` 等の既存表に1項目追加、または BUILD に1項目） | 魔法使い 0.85 等、構え由来の振りが大きい |
| 4（D-3 = (a) で決定） | 同上 | 非戦闘時だけ `run` 由来の上半身項（前傾 `:1303`、bob `:1332`、腰 pitch `0.02+run*0.11`）の係数を下げる（補間は `relaxCombatBlend` 由来の combatW）。脚の swing・`2.7`・`inputMag`・移動速度は変えない | 走り気味の上半身の解消 |
| 5 | `src/legacy/parts/05-rendering-rig.js` | 原則変更なし。`relaxCombatBlend` は `let`（連結スコープ）で `13` から読める。`stepRelaxedBlends()` が `updateLocomotion` の後に走るため**1フレーム前の値**を使う点をコメントで明記（値の更新順は変えない） | 更新順の変更は戦闘ポーズ全体へ波及するため避ける |
| 6 | `src/core/motion-preview.js` `motionDebugLines()`、`05` `motionRigSnapshot()` | Motion Panel に「移動中の腕の基準ウェイト（combatW）」を1行追加（読み取りのみ） | E2E で数値確認するため（既存 `readPanel` 方式） |

変更しない: `STANCE` / `STANCE_ALT` / `CLIPS` / `applyCombatPose` の分岐 / `applyCombatIdlePose` / `applyRelaxedIdlePose` の式 / 移動速度。

### T-2 体格パラメータ（D-1 / D-2 / D-7 確定後）

再利用: `BUILD` / `makeCharacter*()` の width/height 引数 / `playerMixerParts.build`

| Step | ファイル / 関数 | 変更内容 | 理由 |
| --- | --- | --- | --- |
| 1（D-1 決定により読み替え） | Step 2 の後に実施 | 5.0 頭身で 8職×男女のスクリーンショット（正面・見下ろし）を撮り、Human が確認する。Human が微調整を指示した場合だけ 4.5〜5.0 の範囲で BUILD の値を変えて撮り直す（最終値は Human が決める） | 前例 `05:1915-1921`。実機確認が必要な範囲の解消 |
| 2 | `05-rendering-rig.js` `BUILD`（`:1903-1933`） | `headR` / `hairR`（`headR×1.076` の比率維持）を D-1 の値へ。D-2 = 維持なら `hipY` / `thighLen` / `calfLen` / `height` / `headGap` を再配分。`upperLen` / `foreLen` を追加（D-7） | 頭身と部位比率の唯一のレバー |
| 3 | `06-player-enemy.js` `buildPlayer()` 腕部（`:1506-1575`） | 上腕 0.32・前腕 0.30 と配置直値（-0.16, -0.32, -0.15、手・指・親指・vambrace）を `B.upperLen` / `B.foreLen` 由来の式へ | 腕の短さ（手首がベルト線より上）の解消 |
| 4 | 同 骨盤（`:648`） | `pelvis.position.y = 0.80` を HIP_Y・pelvisH 由来の式へ（位置だけ。親は変えない＝D-6 は T-3） | 骨盤と股関節・胴下端の食い違い解消 |
| 5 | `05-rendering-rig.js` `WEAPON_SOCKET`（`:2434-2476`） | 胴・腰の寸法変更で収納位置が胴に埋まる/浮く場合のみ `off` を調整 | R-5 |
| 6 | `motion-preview.js` / `motionRigSnapshot()` | 頭身（頭頂/頭の高さ）と手の Y を Panel に1行（読み取りのみ） | E2E で数値確認 |

変更しない: `makeCharacter*()` の関数本体、`*_SECTION_RATIOS`（T-3 で必要な場合のみ）、`LIMB_PROFILE/TORSO_PROFILE/HEAD_PROFILE`（ボス）、`projectileOrigin()`（武器ノードに自動追従するため）。

### T-2 詳細計画（新版、2026-09-25 Planner。上の T-2 計画を置き換える）

**入力（Artifact Handoff 検証、AGENTS.md §5.2）** — Planner が git から再計算した結果。T-7（仮）の report は同じ手順で検証したが、本計画の入力にしていない

| # | 確認 | 実行 | 結果 |
| --- | --- | --- | --- |
| H-1 | Source Branch が remote に存在し Source SHA が到達可能 | `git fetch origin claude/character-vis-001-t2-analysis`、`git merge-base --is-ancestor f7f246e… origin/claude/character-vis-001-t2-analysis` → 真 | PASS |
| H-2 | Source SHA 時点に Path が存在 | `git cat-file -e f7f246e…:.ai/reports/CHARACTER-VIS-001-T2-analysis.md` → 成功 | PASS |
| H-3 | Source commit の変更が Path の1件だけ | `git diff --name-only f7f246e^ f7f246e` → 当該 Path のみ | PASS |
| H-4 | Path・1行目が期待値と一致 | Work Item 専用の期待 Path `.ai/reports/CHARACTER-VIS-001-T2-analysis.md` と一致。1行目は `# CHARACTER-VIS-001 Analysis` で始まる | PASS |
| H-5 | Kind が `analysis` で Path が期待 Path | 命名例外の適用なし | PASS |
| H-6 | Blob SHA が一致 | `git rev-parse f7f246e…:<Path>` → `63abdbe139ad273c449dd694071aa3593dd4690f`（Handoff と一致） | PASS |
| H-7 | 同じ `(Task ID, Kind)` の既存記録 | `(CHARACTER-VIS-001 / T-2, analysis)` の記録は無い（Task 全体の `Analysis:` 行は別キー）。新規 | PASS |
| H-8 | Source SHA の内容だけを読む | `git show f7f246e…:<Path>` で読んだ | PASS |

**本 Task file の起点**: 本計画は `origin/main`（`0a56e9ce6ebe7e640d970e02be4c95100a5f29b3`）起点の Planner ブランチ `claude/character-vis-001-t2-planner` で作成した（DEC-T2-5 = origin/main、Human 決定 2026-09-25）。`origin/main` には本 Task file が無いため、最新版 `84c52e5c65e4c3a82c1fd682ebd588bae6282cbf:.ai/tasks/CHARACTER-VIS-001.md`（blob `c0ccc243de4646fc61279603a858d3b6de68bab0`、`origin/claude/character-vis-001-t1-impl` から到達可能。承認済み版 `06990ef` からの差分は T-1 の Status・Status History・Implementation Result だけで、T-1 Review の V-2a で確認済み）を `git show` で復元し、`git hash-object` で blob 一致を確かめてから編集した

**FACT（Planner が再確認。出典は T-2 analysis、★は Planner がコードで再確認）**
- ★`origin/main` = `0a56e9c`（`26f1b52` と tree 同一の merge）。**T-1 の実装・review・本 Task file・Task 全体の analysis は main に無い**（`git merge-base --is-ancestor 8f4566c origin/main` → 偽）
- ★T-2 が触る `05` の `motionRigSnapshot()`・`src/core/motion-preview.js`・`tests/unit/motion-preview.test.js`・`tests/character-motion.spec.js` は T-1 も変更したファイル（T-1 の diff `26f1b52..8f4566c`）
- ★身長維持の 5.0 頭身: male headR 0.2541・再配分 +0.1165、female headR 0.2402・再配分 +0.1114（頭頂 2.5405 / 2.4015）
- ★`hipY = thighLen + calfLen`（male 1.10 = 0.56+0.54、female 1.05 = 0.535+0.515）。ブーツは `kneeWorldY` 由来で接地
- ★腕長・配置の直値（`06:1505-1555`）と骨盤 `pelvis.position.y = 0.80`（`06:648`）だけが BUILD に追従しない。胴・首・ベルト・肩・脚は追従
- ★武器（`updateGrip`）・弾の発射位置（`projectileOrigin`）・収納（`WEAPON_SOCKET`）は手・胴ノードに自動追従。近接判定はメッシュ非依存
- ★どの Work Item の計画にも含まれていない直値: 盗賊の腰装飾（`06:1290-1297`、0.72 / 0.86 / 0.70）、魔法使いのローブ（`06:1365-1366`、y 0.42・高さ 0.62）（DEC-T2-8）

**INFERENCE**
- T-2 完了から T-4 完了まで、頭部周りの直値の装飾（例: 兜飾り `hY+0.28`）がずれて見える。承認済みの実施順（T-2 → T-3 → T-4）の帰結で、T-4 で直す
- 腕が長くなると同じ構えの角度で手・武器の軌跡が大きくなる（STANCE / CLIPS は変えない）。V-1 で確認

**Human Decision（新規。Planner は決めない）**

| # | 論点 | 選択肢 | Planner の推奨候補（提案） |
| --- | --- | --- | --- |
| DEC-T2-7 | T-2 Implementer の起点に T-1 が無い（main 未統合） | (a) T-1（`origin/claude/character-vis-001-t1-impl` `84c52e5`）を main へ統合してから、main 起点で T-2 Implementer ブランチを作る / (b) T-1 を含まない main から始める（T-1 と同じファイルを触るため、後で衝突・T-1 の欠落が起きる） | (a)。T-2 の実装開始条件とする |
| DEC-T2-8 | どの Work Item にも無い職別の腰・裾の直値（盗賊 0.72 / 0.86 / 0.70、魔法使いのローブ 0.42） | (a) T-2 では触らず、見た目のずれは V-1 で確認し、必要なら T-4 の範囲拡大として別途承認 / (b) T-2 の Files To Change #5 に含めて HIP_Y 由来にする（T-2 の範囲拡大） / (c) 変えない | (a)。承認済み T-2 の範囲を変えないため |

**決定（ユーザー（人間）/ 2026-09-25 / Claude Code セッションの会話）**: DEC-T2-7 = **(a)**（T-1 は `main` `59f5b643b50680a4eeb2edba02e3bbc622875fcb` で統合済み。T-2 Implementer ブランチは T-1 を含む `main` 起点）、DEC-T2-8 = **(a)**（T-2 では盗賊の腰装飾・魔法使いのローブを変えない。見た目のずれは V-1 で確認し、必要なら T-4 の範囲拡大として別途承認）

D-2' の按分比・腕長の最終値は、承認済みの Decision Record どおり V-1 を見て Human が決める（新規 Decision ではない）。下の値は Implementer が最初に入れる候補

**実装の開始条件**: 新版の Human Approval（上）/ DEC-T2-7・DEC-T2-8 の決定 / Persistence / 本 Task file の Plan Handoff（Kind `plan`）を H-1〜H-8 で検証 / T-1 DONE（済）

| Step | ファイル / 関数 | 変更内容 | 根拠 |
| --- | --- | --- | --- |
| 1 | `05` `BUILD`（`:1903-1933`） | 5.0 頭身・身長維持・按分 1:1・headGap 維持の初期値: **male** `headR 0.2541`, `hairR 0.2736`（×1.0769）, `hipY 1.1582`, `thighLen 0.5896`, `calfLen 0.5686`（hipY を 0.56:0.54 で比例配分）, `height 0.8582`, `headGap 0.27`。**female** `headR 0.2402`, `hairR 0.2584`（×1.0757）, `hipY 1.1057`, `thighLen 0.5634`, `calfLen 0.5423`, `height 0.7957`, `headGap 0.26`。コメントの頭身の経緯を更新 | D-1 / D-2 / D-2'。頭頂 2.5405 / 2.4015 を維持 |
| 2 | 同 | `upperLen` / `foreLen` を male / female に同じ値で追加。初期値 `upperLen 0.40`, `foreLen 0.375`（現状 0.32 / 0.30 の比を保って ×1.25）。手の中心（腕を下ろした場合）は male 1.136（ベルト 1.158 以下）、female 1.027（ベルト 1.106 以下） | D-7 / AC（手の Y ≤ ベルト線）。到達長 `upperLen + foreLen + 0.02 ≥ 0.9 × height`（male 0.772） |
| 3 | 同 | `pelvisDrop` を追加（male 0.30 / female 0.25）。現 BUILD で `HIP_Y − pelvisDrop` = 0.80 / 0.80 となり、現状の見た目と一致する | D-6 = (b) |
| 4 | `06` `buildPlayer()` 腕（`:1505-1555`） | `height:0.32` → `B.upperLen`、`height:0.30` → `B.foreLen`。配置は現状の比で置き換え: 上腕中心 `-upperLen/2`、肘 `-upperLen`、前腕中心 `-foreLen/2`、籠手 `-foreLen*0.9`、手 `-(foreLen+0.02)`、指 `-(foreLen+0.02) - forearm*0.55`、親指 `-(foreLen+0.02) - forearm*0.15`。太さ・肩位置・Pauldron・袖（魔法使い）は変えない | Step 2 を反映。現 BUILD の値では現状と同じ座標になる式にする |
| 5 | `06` `buildPlayer()` 骨盤（`:648`） | `pelvis.position.y = HIP_Y - B.pelvisDrop`。親は root のまま | D-6 = (b) |
| 6 | `05` `motionRigSnapshot()`、`src/core/motion-preview.js` `motionDebugLines()` | 読み取り行を追加: 頭身 `(hipY+height+headGap+headR)/(2·headR)`（`playerMixerParts.build` から）、手の Y（`handL` / `handR` のワールド Y の大きい方 − `player.position.y`）とベルト線 `hipY`。T-1 の WALK 行は変えない | E-2 で数値確認（旧 Step 6） |
| 7 | `05` `WEAPON_SOCKET`（`:2434-2476`） | **条件付き**: E2E の tipY 範囲外、または V-1 で Human が「胴に埋まる/浮く」と判断した職だけ `off` を調整。それ以外は変更しない | R-5（旧 Step 5） |
| 8 | V-1 | 8職×男女 + 上位職4種 + 影の旅人の、正面・見下ろし、停止・非戦闘移動・戦闘態勢移動のスクリーンショットを撮り（リポジトリ外に保存）、Human が 5.0 の見え方・按分・腕長を確認。Human が指示した場合だけ 4.5〜5.0 の範囲で Step 1〜2 の値を変えて撮り直す | D-1（旧 Step 1 の読み替え） |

変更しない（T-2 新版）: `makeCharacter*()` 本体・`*_SECTION_RATIOS`・`LIMB/TORSO/HEAD_PROFILE`、頭部・髪・被り物・目の直値と `applyJobPromotionVisual()`（T-4）、関節球・Pauldron の寸法（T-3）、マテリアル（T-5）、`13-update-loop.js`（T-1 の範囲、移動速度・歩調・脚の swing）、`projectileOrigin()`、`melee-hit.js`、`STANCE` / `STANCE_ALT` / `CLIPS`、支援AI・デコイ（`08` / `11`）、`concat-plugin.js`（本計画は新しい core 関数を legacy から使わないので不要）、`01-character-creation.js`、`basefile.html`

**Files To Change（T-2 新版）**: #3 `src/core/motion-preview.js` / #4 `src/legacy/parts/05-rendering-rig.js`（`BUILD`・`motionRigSnapshot()`・条件付き `WEAPON_SOCKET`）/ #5 `src/legacy/parts/06-player-enemy.js`（`buildPlayer()` の腕・骨盤のみ）/ #9 `tests/unit/motion-preview.test.js` / #10 `tests/character-motion.spec.js` / Task file（Implementation Result・Status・Status History）

**Test Plan（T-2 新版）**

| 区分 | 対象 | 確認 |
| --- | --- | --- |
| Build | `npm run build` | 通る |
| Unit U-2 | `tests/unit/motion-preview.test.js` | 頭身・手の Y・ベルト線の行の整形（欠損時 `-`）。T-1 の WALK 行が不変 |
| Unit 既存 | `npm run test:unit` 全体 | `lowpoly-primitives`（BUILD 非依存）を含め全 PASS |
| E2E E-2 | `tests/character-motion.spec.js`（追加） | 男女それぞれで Panel の頭身が 4.5〜5.0 かつ採用値 ±0.1（初期 5.0）、手の Y ≤ ベルト線（非戦闘の停止） |
| E2E 既存 | `character-motion.spec.js`（E-1 を含む）、`weapon-stow.spec.js`、`battle-knight-visual.spec.js`、`base-class-identity.spec.js`、`base-class-comparison.spec.js`、`combat-test-arena.spec.js`、`guest-companion.spec.js`、`save-load.spec.js` | 収納 tipY・弾の命中・上位職の構築・仲間・セーブの回帰 |
| Full Regression | `npm test` 全体 | 推奨（旧計画どおり。環境の Chromium revision 不一致時はリポジトリ外の回避策で実行し、不可なら NOT_RUN と理由） |
| 目視 V-1 | Step 8 | Human 確認 |

**Acceptance Criteria（T-2 新版）**
- Panel の頭身が 4.5〜5.0 の範囲で Human が決めた値 ±0.1（初期 5.0）。男女とも
- 頭頂 Y（`hipY + height + headGap + headR`）の変化が ±2% 以内
- 腕長が `BUILD.upperLen` / `foreLen` 由来（男女共通）。非戦闘の停止で手の Y ≤ ベルト線
- 骨盤 Y が `HIP_Y − B.pelvisDrop` 由来
- `hipY = thighLen + calfLen` を保つ（接地が崩れない）
- 既存 E2E・unit PASS。`STANCE` / `CLIPS` / 移動速度 / T-1 の変更に差分なし。Files To Change 以外に差分なし

**Risks（T-2 新版で追加）**
- P-R9: T-2 と T-4 の間の頭部装飾のずれ（INFERENCE、実施順の帰結）
- P-R10: DEC-T2-7 = (b) の場合の T-1 との衝突・欠落
- P-R11: 腕長の延長で両手持ち・弓の引き・杖の見え方が変わる（角度は範囲外）。V-1
- P-R12: 標準の Playwright 設定が実行環境の Chromium revision と合わない（T-1 と同じ。リポジトリ外の回避策）

**Rollback**: Step 1〜3 の BUILD 値を旧値（headR 0.3705 / 0.3515、hipY 1.10 / 1.05 ほか、`upperLen 0.32` / `foreLen 0.30`）に戻せば、Step 4〜5 の式は現状と同じ座標になる

### T-2 詳細計画（第3版、2026-09-25 Planner。第2版（上）を置き換える）

**方針（Human 指示 2026-09-25）**: 「華奢で、縦にスッと伸びたシルエット」。頭身だけでなく横方向の厚みを減らし、脚・腕・胴の縦を活かす。体格は male / female の2種ではなく **キャラクター別の固定 BUILD（絶対値）**。上位職は系列の BUILD を使う。makeCharacter*()・Loft・STANCE / STANCE_ALT / CLIPS・攻撃/武器判定・projectileOrigin()・AI・移動速度・セーブ・支援AI・マテリアル・頭部装飾・関節球 / Pauldron の本格調整は変えない（T-3〜T-5 の範囲を維持）

**入力**: Task 全体の analysis（main、blob `cd682826…`）、T-2 analysis（H-1〜H-8 検証済み、上の第2版の表）、第2版実装 `cde399d` の実測値（参考のみ。Task file ではなく `claude/character-vis-001-t2-impl` 上の Implementation Result（T-2））、Planner のコード再確認（★）。本計画は `origin/main` `f48247d23cf5652b87e0ce02d2e8527882981d1f` 起点

#### 現状（FACT）
| 項目 | 根拠 | male（剣士・盗賊・影の旅人） | female（魔法使い・弓師） |
| --- | --- | --- | --- |
| BUILD の選び方 | ★`06:512-513` `BUILD[gender]`。性別は章の固定キャスト（`01:274-282`: 剣士 male / 魔法使い female / 弓師 female / 盗賊 male / 影の旅人 male）。テストモードは常に male（`14:1328`） | | |
| 全高（頭頂） | `hipY + height + headGap + headR` | 2.5405 | 2.4015 |
| 頭身 | 頭頂 / 2·headR | 3.43 | 3.42 |
| 胸（胴の半幅の基準）`chest` | 胴の断面は肩で ×1.15（★`05:319-324`） | 0.345 | 0.295 |
| 肩の張り出し `shoulderOut` | 肩ピボット x = chest + shoulderOut（★`06:1524`） | 0.105 | 0.078 |
| 肩の外幅 ≈ 2·(chest + shoulderOut + upper) | | **1.096（全高の 0.43）** | 0.906（0.38） |
| 腰 `hipR`（骨盤の断面は hip で ×1.10、★`05:388-392`）/ 骨盤高さ | ★`06:645` `pelvisH` は性別の直値 | 0.265 / 0.34 | 0.252 / 0.30 |
| 脚の間隔 `stanceW` / 太腿 `thigh` / ふくらはぎ `calf` | | 0.150 / 0.132 / 0.106 | 0.124 / 0.120 / 0.094 |
| 上腕 `upper` / 前腕 `forearm` / 首 `neck` | 首は `CylinderGeometry(neck*0.92, neck*1.15)`（★`06:674`） | 0.098 / 0.083 / 0.088 | 0.080 / 0.069 / 0.072 |
| 腕長 | ★`06:1506, 1513` の直値（男女共通） | 0.32 / 0.30 | 同 |
| 動きの係数（strideAmp 等） | BUILD 内（T-1 の腕振り `B.armSwing` もここ） | male の値 | female の値 |
| `BUILD.male` の直接参照 | ★`13-update-loop.js:1156` `P.build \|\| BUILD.male` | | |
| 収納ソケット | ★`05:2434-2476` の `off` は絶対値（例: 盗賊 waist x ±0.26、剣士 torso z −0.26） | | |

- ★肩のめり込み量 `0.15·chest + upper − shoulderOut`（胴の肩断面の外縁 + 上腕の太さ − 肩ピボット）: male 0.045 / female 0.046。現状もわずかに重なり、Pauldron が隠している
- 第2版の実測（参考）: 休め姿勢の手の高さは、腕を真下に伸ばした到達点より +0.07（剣士）〜 +0.10（魔法使い）高い

#### BUILD の設計（Step 1〜2）
- `BUILD` をキャラクター系列キーの表にする: `warrior`（剣士）/ `mage` / `archer` / `rogue`。上位職は系列の BUILD をそのまま使う（`battleKnight`→warrior、`archmage`→mage、`hawkEye`→archer、`berserker`→rogue）。上位職別の上書きは今回作らない（必要になったら表に上書きを足せる形にだけしておく）
- 選び方は `buildPlayer()` で `BUILD[classDef.key] || BUILD.warrior`。`gender` 引数は髪色など見た目の既存用途にだけ残す
- 影の旅人（`wanderer`、kit 剣士）: 剣士の BUILD を使う（DEC-T2-10 = (a)）
- 各 BUILD は **絶対値**を直接持つ（相対倍率を最終仕様にしない）: `stature, headR, hairR, headGap, hipY, height(torso), thighLen, calfLen, upperLen, foreLen, chest, shoulderOut, hipR, pelvisH, pelvisDrop, stanceW, thigh, calf, upper, forearm, neck` + 既存の動きの係数（`strideAmp, armSwing, hipSway, shoulderRoll, bobAmp, kneeLift, idleShift`。各キャラクターの固定性別の現在値をそのまま写し、動きは変えない）
- 構造上の派生値は計算してよい。**整合規則**（`buildPlayer()` で検査し、外れたら `console.error`。E2E の `watchErrors` が拾う）:
  - `hipY === thighLen + calfLen`（±0.001）
  - `stature === hipY + height + headGap + headR`（±0.001）
  - 首が見える: `headGap − headR > 0`
  - 脚の付け根が骨盤に収まる: `stanceW + thigh ≤ hipR × 1.10`

#### 各キャラクターの初期寸法案（絶対値。単位 m）
| 値 | 剣士 warrior | 魔法使い mage | 弓師 archer | 盗賊 rogue | 参考: 現 male / female |
| --- | --- | --- | --- | --- | --- |
| stature（全高） | 2.54 | 2.40 | 2.40 | 2.42 | 2.5405 / 2.4015 |
| headR | 0.254 | 0.240 | 0.240 | 0.242 | 0.3705 / 0.3515 |
| hairR | 0.2735 | 0.2585 | 0.2585 | 0.2605 | 0.399 / 0.3781 |
| headGap | 0.29 | 0.28 | 0.28 | 0.28 | 0.27 / 0.26 |
| height（胴、ベルト〜襟） | 0.796 | 0.74 | 0.71 | 0.758 | 0.80 / 0.74 |
| hipY | 1.20 | 1.14 | 1.17 | 1.14 | 1.10 / 1.05 |
| thighLen / calfLen | 0.615 / 0.585 | 0.585 / 0.555 | 0.600 / 0.570 | 0.585 / 0.555 | 0.56/0.54 ・ 0.535/0.515 |
| upperLen / foreLen | 0.42 / 0.40 | 0.41 / 0.38 | 0.41 / 0.38 | 0.40 / 0.38 | 0.32 / 0.30 |
| chest | 0.24 | 0.20 | 0.21 | 0.215 | 0.345 / 0.295 |
| shoulderOut | 0.060 | 0.045 | 0.050 | 0.045 | 0.105 / 0.078 |
| hipR | 0.20 | 0.19 | 0.19 | 0.185 | 0.265 / 0.252 |
| pelvisH / pelvisDrop | 0.30 / 0.27 | 0.27 / 0.24 | 0.27 / 0.24 | 0.28 / 0.25 | 0.34/0.30 ・ 0.30/0.25 |
| stanceW | 0.110 | 0.095 | 0.100 | 0.100 | 0.150 / 0.124 |
| thigh / calf | 0.095 / 0.075 | 0.085 / 0.066 | 0.088 / 0.068 | 0.085 / 0.066 | 0.132/0.106 ・ 0.120/0.094 |
| upper / forearm | 0.070 / 0.058 | 0.058 / 0.050 | 0.060 / 0.052 | 0.060 / 0.052 | 0.098/0.083 ・ 0.080/0.069 |
| neck | 0.065 | 0.056 | 0.056 | 0.058 | 0.088 / 0.072 |
| 動きの係数 | male の現在値 | female の現在値 | female の現在値 | male の現在値 | |

方向性（Human 指示）との対応: 剣士は4人で一番しっかり（胸・肩・腕が最大）/ 魔法使いは肩・胴が最も細く縦長 / 弓師は脚と腕の到達が最も長く肩は控えめ / 盗賊は全高を少し低く（2.42）細身で肩が狭い。これ以外の設定は足していない

#### 算出（初期値での確認値）
| 項目 | 式 | 剣士 | 魔法使い | 弓師 | 盗賊 | 現 male / female |
| --- | --- | --- | --- | --- | --- | --- |
| 頭身 | stature / 2·headR | 5.00 | 5.00 | 5.00 | 5.00 | 3.43 / 3.42 |
| 全高の整合 | hipY + height + headGap + headR | 2.540 | 2.400 | 2.400 | 2.420 | |
| 脚の比 | hipY / stature | 0.472 | 0.475 | 0.488 | 0.471 | 0.433 / 0.437 |
| 首の見え | headGap − headR | +0.036 | +0.040 | +0.040 | +0.038 | −0.10 / −0.09 |
| 肩の外幅 / 全高 | 2·(chest+shoulderOut+upper) / stature | 0.74 → **0.29** | 0.606 → **0.25** | 0.64 → **0.27** | 0.64 → **0.26** | 0.43 / 0.38 |
| 腰の外幅 / 全高 | 2·hipR·1.10 / stature | 0.173 | 0.174 | 0.174 | 0.168 | 0.230 / 0.231 |
| 肩のめり込み | 0.15·chest + upper − shoulderOut | 0.046 | 0.043 | 0.0415 | 0.047 | 0.045 / 0.046 |
| 肩の高さ | hipY + 0.9·height | 1.916 | 1.806 | 1.809 | 1.822 | |
| 腕の到達点（真下） | 肩 − (upperLen + foreLen + 0.02) | 1.076 | 1.016 | 0.999 | 1.022 | |
| 休め姿勢の手の見込み | 到達点 + 0.07〜0.10（第2版の実測） | 1.15〜1.18 | 1.09〜1.12 | 1.07〜1.10 | 1.09〜1.12 | |
| ベルト線 | hipY | 1.20 | 1.14 | 1.17 | 1.14 | |

- 横の厚みは概ね現状の 65〜75% に下げ、縦は脚を長く（脚の比 0.43 → 0.47〜0.49）して寸詰まりを避ける
- 腕は第2版（0.448 / 0.42）より短いが、肩が低く狭くなるため到達点はベルト線より十分下（休め姿勢の見込みでもベルト線以下）

#### Implementation Plan（第3版）
| Step | ファイル / 関数 | 変更内容 |
| --- | --- | --- |
| 1 | `05` `BUILD`（`:1903-1933`） | male / female の表を上の4キャラクターの絶対値の表に置き換える。頭身の経緯コメントを更新。`05:829` の `BUILD.male/female` への言及コメントも更新 |
| 2 | `06` `buildPlayer()`（`:510-517`） | `BUILD[classDef.key] \|\| BUILD.warrior`。影の旅人（`wanderer`）は剣士の BUILD（DEC-T2-10 = (a)。フォールバックで剣士になる）。整合規則の検査（`console.error`） |
| 3 | `06` `buildPlayer()` 腕（`:1506-1557`） | 長さを `B.upperLen` / `B.foreLen` に。配置は旧直値と同じ比の式（上腕中心 −UA/2、肘 −UA、前腕中心 −FA/2、籠手 −FA·0.9、手・指・親指 −(FA+0.02) 基準）。第2版と同じ形 |
| 4 | `06` `buildPlayer()` 骨盤（`:645-648`） | `pelvisH` を `B.pelvisH`、Y を `HIP_Y − B.pelvisDrop`（親は root のまま、D-6） |
| 5 | `13-update-loop.js:1156` | `BUILD.male` → `BUILD.warrior`（フォールバックの参照先の名前だけ。T-1 の歩行の式は変えない） |
| 6 | `05` `motionRigSnapshot()`、`core/motion-preview.js` | 読み取り行: `HEADS`（頭身）、`STAT`（全高）、`HAND.Y … BELT …`、`SHLD.W`（肩の外幅と全高比）、`HIP.W`（腰の外幅と全高比）。T-1 の WALK 行は維持 |
| 7 | `05` `WEAPON_SOCKET`（`:2434-2476`） | 胴・腰が細くなるため、収納位置の `off`（絶対値）が体から浮く職を E2E と V-1 で確認し、該当職だけ `off` を絶対値で補正（DEC-T2-11 = (a)。武器の形状・寸法・デザイン・攻撃処理は変えない） |
| 8 | 構造派生で自動追従するもの（変更しない） | 胸当て・ベルト・首（`B.neck`）・手/指（`B.forearm` 比）・肩当て（`B.upper` 比）・盗賊/弓師の装飾の x（`bodyR` 由来）・魔法使いのローブの半径（`bodyR` 由来）・武器（`updateGrip()` が手に追従） |
| 9 | V-1 | 下の Visual Verification |

**Files To Change（第3版）**: `src/legacy/parts/05-rendering-rig.js`（`BUILD`・`motionRigSnapshot()`・条件付き `WEAPON_SOCKET`・コメント）/ `src/legacy/parts/06-player-enemy.js`（`buildPlayer()` の BUILD 選択・整合検査・腕・骨盤のみ）/ `src/legacy/parts/13-update-loop.js`（`:1156` の1行のみ）/ `src/core/motion-preview.js` / `tests/unit/motion-preview.test.js` / `tests/character-motion.spec.js` / Task file（Implementation Result・Status・Status History）

**変更しない（第3版）**: `makeCharacter*()` 本体・`*_SECTION_RATIOS`・`LIMB/TORSO/HEAD_PROFILE`、`STANCE` / `STANCE_ALT` / `CLIPS`、`melee-hit.js`、`projectileOrigin()`、AI、`CLASSES.spd`・歩調・脚の swing（T-1）、セーブ形式（BUILD は保存されない。★`09-save-load.js` に BUILD の参照なし）、支援AI（`08` / `11`）、マテリアル（T-5）、頭部・髪・被り物・目の直値と `applyJobPromotionVisual()`（T-4）、関節球・Pauldron の寸法（T-3）、盗賊の腰装飾・魔法使いのローブの Y 直値（DEC-T2-8 = (a)）、`concat-plugin.js`、`playwright.config.js`

#### 武器・手の位置への影響
- FACT: 武器は `updateGrip()` が毎フレーム手のワールド座標から置く。腕の長さ・肩の位置・手の大きさ（`B.forearm` 比）が変わっても自動で追従する。両手持ち（剣士）は両手の中点
- FACT: 弾の発射位置（`projectileOrigin()`）は弓/杖ノードのワールド座標に追従。命中判定の高さ許容は 1.8〜2.2 m で、数 cm の変化では変わらない
- FACT: 近接判定はメッシュ非依存
- INFERENCE: 肩幅が狭くなると、構え（角度は不変）で両手・武器が体の中心に寄って見える。剣士の両手持ち・弓の引き・杖の位置は V-1 で確認
- INFERENCE: 収納ソケットの `off` は絶対値なので、細い胴・腰では背中の大剣・弓が体から離れ、盗賊の腰の短剣が外へ浮く可能性が高い（Step 7）

#### 既存テストへの影響
| テスト | 影響 |
| --- | --- |
| `tests/unit/lowpoly-primitives.test.js` | BUILD 非依存のリテラル検査。失敗しない（コメントの「BUILD.male相当」が古くなるのは記録のみ） |
| `tests/unit/motion-preview.test.js` | 新しい行の整形テストを追加（U-2） |
| `tests/character-motion.spec.js` | E-2 を第3版の値で書く（下）。T-1 の E-1 は不変のはず |
| `tests/weapon-stow.spec.js` | 収納 tipY 0.15〜3.6 / 抜刀 > −0.2。全高を大きく変えないため範囲内の見込み。Step 7 の調整後も確認 |
| `battle-knight-visual` / `base-class-identity` / `base-class-comparison` / `combat-test-arena` | 構築・弾の生成と命中の回帰 |
| `guest-companion` / `save-load` | 回帰のみ |

**Test Plan（第3版）**
| 区分 | 対象 | 確認 |
| --- | --- | --- |
| Build | `npm run build` | 通る |
| Unit | `npm run test:unit`（U-2 を含む） | 全 PASS |
| E2E E-2 | `character-motion.spec.js`（テストモードで4キャラクター。BUILD がキャラクター別になるため性別に依らず4人とも入れる） | HEADS 5.00 ±0.1、STAT が BUILD の全高 ±0.01、非戦闘の停止で手 ≤ ベルト、SHLD.W の全高比 ≤ 0.30（剣士）/ ≤ 0.28（他）、HIP.W の全高比 ≤ 0.19、コンソールエラーなし（整合検査） |
| E2E 既存 | 上の表のすべて | 回帰 |
| Full Regression | `npm test` 全体 | 推奨。Chromium revision 不一致の環境ではリポジトリ外の回避策、不可なら NOT_RUN |

#### Visual Verification（V-1、第3版）
対象: 剣士・魔法使い・弓師・盗賊（基礎職）+ 戦騎士・魔導士・鷹の目・バーサーカー（上位職は系列の BUILD）+ 影の旅人。状態: 停止（非戦闘）・非戦闘移動・戦闘態勢。
視点: **正面・斜め45°・側面**（ゲームのカメラは見下ろしの仰角固定なので、Q/E のカメラ旋回で yaw 0° / 45° / 90° を撮る。真横の水平視点は取れない ― 制約として記録）

| # | 視点 | 確認項目（Human が見る） | 数値の手掛かり（Panel） |
| --- | --- | --- | --- |
| V-1a | 正面 | 肩幅が「横に広い」印象にならず、かつ頭に対して狭すぎない（初期値の肩の外幅 / 頭の幅 2·headR: 剣士 1.46・魔法使い 1.26・弓師 1.33・盗賊 1.32。現 male 1.48 は頭が大きいための値で比較不可。全高比 0.43 → 0.25〜0.29 が主指標） | SHLD.W / STAT |
| V-1b | 正面 | 胴が細く、腰・骨盤が胸より細い/同程度で、樽型に見えない | HIP.W / STAT |
| V-1c | 正面 | 首が見え、頭が胴に埋まっていない | HEADS、headGap − headR |
| V-1d | 正面 | 脚が長く見え、股下が全高の半分近い（短足・寸詰まりでない） | BELT / STAT |
| V-1e | 正面 | 腕を下ろした手が腿の付け根〜腿の中ほどにある | HAND.Y / BELT |
| V-1f | 斜め45° | 胸・腰の前後の厚みが薄く、ずんぐりしない | ― |
| V-1g | 斜め45° | 肩・上腕・前腕、太腿・ふくらはぎが細く、関節で急に太くならない（関節球・Pauldron の本格調整は T-3。明らかな破綻だけ記録） | ― |
| V-1h | 側面 | 胴・骨盤・脚が前後に途切れず繋がる（頭・首・胴・骨盤・脚の接続） | ― |
| V-1i | 側面 | 背中の大剣・弓、腰の短剣が体から浮いていない/埋まっていない | STOW の POS / TIP.Y |
| V-1j | 全視点 | 4人の差（剣士がややしっかり、魔法使いが最も縦長、弓師が手足長め、盗賊が小柄で身軽）が読める | ― |
| V-1k | 全視点 | 構え・両手持ち・弓の引き・杖の位置が破綻しない | ― |
| V-1l | 全視点 | 頭部装飾のずれ（T-4 の範囲）を記録する | ― |

最終値（頭身 4.5〜5.0 の範囲を含む各寸法）は V-1 を見て Human が決める。AI は決めない。範囲外が必要なら実装せず Human へ戻す

#### Acceptance Criteria（第3版）
- 4キャラクターとも Panel の HEADS が採用値（初期 5.0）±0.1、STAT が BUILD の stature ±0.01
- BUILD が4キャラクターの絶対値の表で、相対倍率の式を持たない（構造派生の hipY 整合・stature 整合は検査のみ）。整合検査でコンソールエラーなし
- 非戦闘の停止で手の Y ≤ ベルト線（4キャラクター）
- 肩の外幅 / 全高: 剣士 ≤ 0.30、他 ≤ 0.28。腰の外幅 / 全高 ≤ 0.19
- 骨盤が `B.pelvisH` / `HIP_Y − B.pelvisDrop` 由来
- 既存 E2E・unit PASS。STANCE / CLIPS / 移動速度 / T-1 の歩行の式に差分なし。Files To Change 以外に差分なし

#### Human Decision（第3版で新規・改訂。Planner は決めない）
| # | 論点 | 選択肢 | Planner の推奨候補（提案） |
| --- | --- | --- | --- |
| DEC-T2-9 | 既存の Decision Record の改訂: D-2（身長維持）/ D-2'（脚と胴へ按分）/ D-7（腕長は男女共通）が、キャラクター別の絶対値 BUILD で前提から変わる | (a) 第3版の表のとおり改訂（全高は剣士 2.54・魔法使い/弓師 2.40 で現状維持、盗賊だけ 2.42 に下げる。腕長はキャラクター別）/ (b) 盗賊も現状の 2.54 を維持 | (a)（盗賊の「小柄寄り」の指示に沿う。カメラ・当たり判定・高さ直値への影響は全高の −5% 以内） |
| DEC-T2-10 | 影の旅人（`wanderer`、kit 剣士、固定性別 male）の BUILD | (a) 剣士の BUILD を使う / (b) 専用の BUILD を追加 | (a)（新しい設定を足さない） |
| DEC-T2-11 | 収納ソケット `WEAPON_SOCKET` の調整 | (a) 第3版に含め、浮き/埋まりが出た職だけ絶対値で直す / (b) 別 Work Item | (a)（細身化の直接の帰結） |
| DEC-T2-12 | 第2版の実装 `cde399d`（`claude/character-vis-001-t2-impl`、未レビュー・未統合）の扱いと第3版の実装ブランチ | (a) 第2版は採用せず残置。第3版は `origin/main` 起点の新しい実装ブランチ（force push をしないため別名）/ (b) 同じブランチ名で再開（履歴に第2版が残る） | (a) |

**決定（ユーザー（人間）/ 2026-09-25 / Claude Code セッションの会話）**:
- DEC-T2-9 = **(a)**: 第3版の初期寸法表を採用。D-2 / D-2' / D-7 を改訂（Decision Record の改訂行）。目的は「華奢で、横幅が狭く、縦にスッとしたシルエット」
- DEC-T2-10 = **(a)**: 影の旅人は剣士の BUILD を使う。専用 BUILD は作らない
- DEC-T2-11 = **(a)**: 収納位置の調整を T-2 に含める。対象は細身化で身体から浮く既存武器の収納位置（`WEAPON_SOCKET` の `off`）の補正のみ。武器の形状・寸法・デザイン・攻撃処理は変更しない
- DEC-T2-12 = **(a)**: 第2版の実装 `cde399d` は採用しない。第3版は `origin/main` `f48247d23cf5652b87e0ce02d2e8527882981d1f` 起点の新しい実装ブランチで開始する

維持する決定: D-1（約5頭身、最終値は V-1 で Human が 4.5〜5.0 で決める）、D-6（骨盤は root 直下、Y だけ HIP_Y 由来）、DEC-T2-7（T-1 を含む main 起点）、DEC-T2-8 = (a)

#### Risks（第3版）
- P-R13: 細身化で関節球・Pauldron（`B.upper` / `B.forearm` 比で縮む）と断面の見え方が変わる。本格調整は T-3
- P-R14: 頭部の直値の装飾が小さい頭からずれる（T-4、第2版実装の目視で兜飾りの突出を確認済み）
- P-R15: 収納位置の絶対値 `off` が細い体から浮く（Step 7）
- P-R16: 肩が狭くなり、構えで武器・両手が体に近づく（角度は変えないため V-1 で判断）
- P-R17: 見下ろし固定カメラのため、真横・水平の側面は撮れない（V-1 の制約）
- P-R18: 盗賊の全高 −5%（DEC-T2-9）で、カメラ注視点・VFX・弾の高さ直値（Task 全体 analysis R-6）との差がわずかに出る

**Rollback**: `BUILD` の表を旧 male / female に戻し、選び方を性別へ戻せば、Step 3〜4 の式は旧座標に一致する（腕 0.32 / 0.30、骨盤 0.34/0.30・0.80）

### T-3 関節の接続（T-2 完了後、D-6）

| Step | ファイル / 関数 | 変更内容 | 理由 |
| --- | --- | --- | --- |
| 1 | `06` `buildPlayer()` 膝球（`:595`）・肘球（`:1530`） | 半径を断面端（elbow widthMul 0.82 等）に揃える係数へ | 「玉が挟まった」見え方 |
| 2 | 同 Pauldron（`:1567-1571`） | T-2 の肩位置に合わせたスケール調整 | 肩の接続 |
| 3（D-6 = (a) の場合） | 同 waist 付け替えループ（`:1680-1688`） | 骨盤を waist 配下へ付け替え、waist の hip sway / twist で骨盤も動くようにする | 骨盤と胴の分離 |
| 4（必要な場合のみ） | `05` プレイヤー専用の `*_SECTION_RATIOS` | 首・肩・肘・膝の断面比率の微調整 | ボス用 Lathe 表には触れない |

### T-4 頭部周り・装飾の直値再調整（T-2 完了後、D-1 / D-8）

| Step | ファイル / 関数 | 変更内容 | 理由 |
| --- | --- | --- | --- |
| 1 | `06` `buildPlayer()` 頭部・髪・被り物・目（直値 29 行） | headR 比でない直値（例 `crest.position.set(0, hY+0.28, …)` `:1146`）を headR 比の式へ置き換える、または値を再調整 | R-1 |
| 2 | `05` 頭部 Coverage / `HEAD_*` 定数（`:714-935`） | 兜 Face Opening・Coverage の再調整（必要な場合のみ） | R-11 |
| 3 | `06` `applyJobPromotionVisual()`（`:1926-`） | 上位職装飾の直値、戦騎士 `headLookPivot.scale` 0.86（D-8） | R-2 |

### T-5 質感（D-4）

| Step | ファイル / 関数 | 変更内容 | 理由 |
| --- | --- | --- | --- |
| 1 | `06` `buildPlayer()` 基本マテリアル（`:519-546`） | skin/cloth/trim/boot の roughness/metalness/emissive、`applyBump` の scale を「プレイヤー用マテリアル値の表」（`05` の BUILD 近傍に定数表、または `06` 冒頭）から読む形へ | 値の集約とマット化 |
| 2 | 同 職別装飾（25個）・`applyJobPromotionVisual()`（18個） | 光沢系の外れ値のみ表の値へ寄せる。共有 Material（`metalMat` 等）は直接変えず、前例どおり必要なら分離 | R-10 |
| 3（D-4 = (b) の場合） | ― | 本 Work Item では行わない。別 Task | B 判定 |

変更しない: `outlineMats()` / `addOutline()`、`textures.js` のキャッシュキー、敵・ボスのマテリアル、レンダラ設定（toneMapping / exposure）。

### T-6 支援AI（**取り下げ**。D-5 = 除外、2026-09-25。以下は取り下げ前の計画の記録で、実装しない）

| Step | ファイル / 関数 | 変更内容 |
| --- | --- | --- |
| 1 | `08-loot-equipment.js` `buildGuestCompanion()`（`:1020-`） | 円柱・球の寸法を新しい頭身・身長の比率へ、マテリアル値を T-5 の表へ寄せる |
| 2 | `11-combat-actions.js` `spawnPhantomDecoy()`（`:1432-1445`） | `body.y` / `head.y` / 球半径を新しい比率へ |

---

## Files To Change（候補。承認された Work Item の行だけが有効）

| # | WI | ファイル | 対象 |
| --- | --- | --- | --- |
| 1 | T-1 | `src/core/relaxed-idle.js` | 腕の基準補間の純粋関数、非戦闘の腕振り係数 |
| 2 | T-1 | `src/legacy/parts/13-update-loop.js` | `updateLocomotion()` の腕ブロック・上半身の `run` 由来項 |
| 3 | T-1, T-2 | `src/core/motion-preview.js` | `motionDebugLines()` に読み取り行追加 |
| 4 | T-1, T-2 | `src/legacy/parts/05-rendering-rig.js` | `motionRigSnapshot()`（読み取り追加のみ）。T-2 は `BUILD`・`WEAPON_SOCKET`。T-3 はプレイヤー専用断面比率。T-4 は頭部 Coverage/`HEAD_*` |
| 5 | T-2〜T-5 | `src/legacy/parts/06-player-enemy.js` | `buildPlayer()`（腕・骨盤・関節球・頭部直値・マテリアル）、`applyJobPromotionVisual()`（T-4, T-5） |
| 6 | ~~T-6~~ | ~~`src/legacy/parts/08-loot-equipment.js`~~ | 取り下げ（D-5）。変更しない |
| 7 | ~~T-6~~ | ~~`src/legacy/parts/11-combat-actions.js`~~ | 取り下げ（D-5）。変更しない |
| 8 | T-1 | `tests/unit/relaxed-idle.test.js` | Step 1 の関数のテスト追加 |
| 9 | T-1, T-2 | `tests/unit/motion-preview.test.js` | 追加行の整形テスト |
| 10 | T-1, T-2 | `tests/character-motion.spec.js` | 非戦闘移動中の腕ウェイト・頭身の Panel 読み取り E2E 追加 |

## Files Not To Change（全 Work Item 共通）

- `src/legacy/parts/08-loot-equipment.js`（`buildGuestCompanion()` / `buildCompanion()`）、`src/legacy/parts/11-combat-actions.js`（`spawnPhantomDecoy()` を含む全体）— D-5 により支援AI・デコイは現在の簡易モデルを維持
- `src/legacy/parts/13-update-loop.js` の移動速度・`strideT` の係数 2.7・脚の swing・`inputMag` の扱い — D-3

- `STANCE` / `STANCE_ALT` / `CLIPS`（`05:2203-2600` 付近）、`applyCombatPose()` の分岐、`applyCombatIdlePose()`
- `src/core/melee-hit.js`、`src/core/combat-stance.js`（`blendPose` 等は import して使うのみ）
- `LIMB_PROFILE` / `TORSO_PROFILE` / `HEAD_PROFILE`、`buildBoss()`、`buildEnemy()`
- `outlineMats()` / `addOutline()`
- `projectileOrigin()`（武器ノードに自動追従。変更が必要と判明した場合は OUT OF SCOPE として報告）
- `src/textures/textures.js`、`02-world-common.js` のレンダラ設定
- `01-character-creation.js`（`CLASSES.spd`。D-3 = (b) を選ぶ場合は別 Task）
- `basefile.html`
- 既存テストの期待値（`weapon-stow.spec.js` の tipY 範囲など）。範囲外になる場合は書き換えず報告（§9）
- `tests/unit/lowpoly-primitives.test.js`（BUILD を import しないリテラル検査。コメントの「BUILD.male相当」が古くなる点は Risk として記録のみ）
- `.ai/reports/CHARACTER-VIS-001-analysis.md`

## Test Plan

| 区分 | 対象 | WI | 何を確かめるか |
| --- | --- | --- | --- |
| Build | `npm run build` | 全 | ビルドが通る |
| Unit U-1 | `tests/unit/relaxed-idle.test.js`（追加） | T-1 | 腕の基準補間: combatW=0 で休め姿勢と一致、1 で構えと一致、0.5 で中間。`blendPose` と同じ結果 |
| Unit U-2 | `tests/unit/motion-preview.test.js`（追加） | T-1, T-2 | Panel の新しい行の整形 |
| Unit 既存 | `npm run test:unit` 全体 | 全 | `relaxed-idle` / `combat-stance` / `posture-recovery` / `mage-lord-idle` / `look-rig` / `lowpoly-primitives` / `melee-hit` / `decoy` が不変で通る |
| E2E E-1（追加） | `character-motion.spec.js` | T-1 | 非戦闘で移動中、Panel の腕基準ウェイトが休め側（≈0）。攻撃後の戦闘態勢で移動中は構え側（≈1）へ遷移し、`combatStanceT` の減衰で休めへ戻る |
| E2E E-2（追加） | `character-motion.spec.js` | T-2 | Panel の頭身が 4.5〜5.0 の範囲内かつ Human が決めた最終値 ±0.1、頭頂 Y が現状 ±2%、手の Y がベルト線以下 |
| E2E 既存 | `character-motion.spec.js`（状態遷移・Visual Freeze）、`weapon-stow.spec.js`（8職の収納・tipY）、`battle-knight-visual.spec.js` | T-1〜T-4 | 戦闘モーション・収納・上位職の回帰 |
| E2E 既存 | `base-class-identity.spec.js`、`base-class-comparison.spec.js`、`combat-test-arena.spec.js` | T-2〜T-4 | 弓師・魔法使いの弾の発射位置変更後も命中・弾生成が成立（R-4） |
| E2E 既存 | `guest-companion.spec.js` | T-2〜T-5（回帰のみ） | 仲間の生成・戦闘が不変（T-6 は取り下げ） |
| E2E 既存 | `save-load.spec.js`、`scenario-timer.spec.js` | T-1 | セーブ・移動時間系の回帰（D-3 で速度は変えないため、不変の確認） |
| 目視 V-1 | Playwright スクリーンショット（保存のみ）8職×男女 + 上位職4種、正面・見下ろし、停止・非戦闘移動・戦闘態勢移動 | T-1〜T-5 | 自動検出できない見た目（R-12）。**Human が確認** |

- Test Scope: 各 Work Item は **完了後に対象テスト（上表の該当行）を実行する**（Human 指示）。Targeted を基本とし、T-2 と T-4 は影響範囲が広いため **Full Regression（`npm run build` / `npm run test:unit` / `npm test`）を推奨**
- スクリーンショット比較（`toHaveScreenshot`）は導入しない（新しいテスト基盤になるため。必要なら別 Task）

## Acceptance Criteria

- T-1: 非戦闘で移動中、腕の基準が休め姿勢（E-1 の数値）。上半身の `run` 由来項が非戦闘時に抑えられる。戦闘態勢中の移動・攻撃・スキル・回避は従来どおり（既存 E2E PASS）。`STANCE`/`CLIPS` 差分なし。移動速度・脚の swing・`2.7` 不変
- T-2: Panel の頭身が 4.5〜5.0 の範囲内で、Human が V-1 を見て決めた最終値 ±0.1（初期実装は 5.0）。頭頂 Y の変化 ±2% 以内（D-2）。腕長が BUILD 由来。骨盤 Y が HIP_Y 由来。`weapon-stow.spec.js` PASS
- T-3: 膝・肘・肩・骨盤の接続が目視 V-1 で Human が許容（数値化できない部分は目視）
- T-4: 8職×男女 + 上位職4種で髪・被り物・目が頭から外れていない（目視 V-1）。`battle-knight-visual.spec.js` PASS
- T-5: プレイヤーのマテリアル値が1つの表から読まれる。敵・ボスのマテリアルに差分なし。`outlineMats` 差分なし
- T-6: 取り下げ（D-5）。`08-loot-equipment.js` / `11-combat-actions.js` に差分なし
- 全 WI: Files Not To Change に差分なし。`npm run build` / `npm run test:unit` PASS

## Risks

Analyzer report の R-1〜R-12 を前提とし、Planner が追加・具体化したもの:

| # | リスク | 対応 WI | 緩和策（提案） |
| --- | --- | --- | --- |
| P-R1 | T-1 の `relaxCombatBlend` は1フレーム前の値（更新順 FACT）。戦闘突入の瞬間、1フレームだけ腕が休め寄り | T-1 | 攻撃開始は `busy` で腕を書かないため実害は小さい（INFERENCE）。E-1 で遷移を確認 |
| P-R2 | 休め基準の腕 + 構え基準の Combat Idle の補間起点が変わり、戦闘態勢の立ち上がりの見え方が変わる（R-7） | T-1 | `relaxCombatBlend` と `combatStanceWeight` は同じ値を追うため、構え側に寄る速度は同等（INFERENCE）。目視 V-1 |
| P-R3 | （D-3 = (a) の決定により (a') は不採用。脚の歩調を変えないため足滑りは生じない） | T-1 | ― |
| P-R4 | 5.0 頭身が実機で「思ったより小さい/大きい」 | T-2 | D-1 決定どおり、Human が V-1 を見て 4.5〜5.0 で微調整。範囲外が必要なら実装せず人間へ戻す |
| P-R5 | コメント上の「0.290 ≈ 4.7 頭身」と現寸法での 4.24 の食い違い | T-2 | 頭身は Panel の算出値（E-2）を正とする |
| P-R6 | `lowpoly-primitives.test.js` のコメント「BUILD.male相当」が古くなる | T-2 | テストは BUILD を import しないため失敗はしない（FACT）。コメント更新はテスト変更になるため本 Task では行わない |
| P-R7 | プレイヤーだけマット化・高頭身化すると敵・ボス・仲間（簡易モデル維持）とのトーン差・寸法差 | T-2, T-5 | D-5 で仲間は除外と決定済み。差が問題になれば別 Task |
| P-R8 | （D-2 = 身長維持の決定により該当しない。按分後の頭頂 Y は E-2 で確認） | T-2 | ― |

## Rollback

- 各 Work Item は独立したコミット（範囲）で実装し、`git revert` で個別に戻せるようにする
- T-2 / T-5 は値の表（BUILD / マテリアル値表）に集約するため、値を旧値に戻すだけで見た目が戻る
- T-1 は腕の基準の補間ウェイトを常に 1（= 構え）にすれば従来挙動と等価

## Out of Scope

- 新しいキャラクター生成システム・新しい歩行システム・歩行ステートマシン
- `STANCE` / `STANCE_ALT` / `CLIPS` / 攻撃判定 / ダメージ / AI の変更
- 移動速度（`CLASSES.spd`）の変更（D-3 = (b) を選ぶ場合は別 Task、`docs/` 更新込み）
- 歩行キー等の入力追加（D-3 = (d)）
- セルシェーディング / `MeshToonMaterial` / `onBeforeCompile`（D-4 = (b)。別 Task・B 判定）
- 共有アウトライン（`outlineMats`）の変更
- 仲間へのプレイヤー同等の人体・歩行（D-5 = (c)。リグのインスタンス化、別 Task・B〜C 判定）
- 敵・ボスの見た目、ボス用 Lathe 表
- スクリーンショット比較テスト基盤の導入
- `07/10/11` の高さ直値 16 件の整理（D-2 = 維持なら不要。変更が必要と判明した場合は報告）

## Unknowns / Decisions Required

- **決定済み（2026-09-25）**: D-1 / D-2 / D-2' / D-3 / D-4 / D-5 / D-6 / D-7 / D-8、Work Item の分割と実施順（T-1 → T-2 → T-3 → T-4 → T-5、並行禁止、T-6 取り下げ）。正本は Decision Record
- **実装中に Human が決める事項（Decision Record で Human 判断と定めたもの）**: D-1 の最終頭身（4.5〜5.0 の範囲内）、D-2' の按分比、D-6 で (a) へ進むか、D-8 の戦騎士の値。いずれも V-1 を見て Human が決め、AI は決めない
- **Unknown（Analyzer から継続）**: 実機の見え方全般 / `07/10/11` の高さ直値 16 件の用途 / `WEAPON_SOCKET` コメントの「頭頂 約2.9m」の出所 / 盗賊・魔法使い・弓師の装飾直値のずれ量 / 女性体型の各職
- **FACT（Planner）**: `tests/unit/decoy.test.js` はデコイの寸法（`0.80` / `1.78` / head）を検索した結果ヒットなし。T-6 の寸法変更で unit が落ちる経路は確認されない

## Task Plan for Implementer（Human Approval 済み。T-1〜T-5 に有効）

各 WI 共通の開始条件: その WI の Approval 欄が `[x]`（T-1〜T-5 は記入済み）、関係する DECISION が Decision Record に記入済み（記入済み）、承認済み Task file の Plan Handoff（Kind `plan`）を H-1〜H-8 で検証済み、Persistence が記入済み（§6。未記入）、**前の WI が DONE**（並行禁止）。

1. **T-1**: U-1 を先に書く → `relaxed-idle.js` に補間関数 → `updateLocomotion` の腕ブロック差し替え → 上半身の `run` 由来項の非戦闘係数（D-3 = (a)）→ Panel 行 → U-2 / E-1 → 対象テスト → V-1 の非戦闘移動ショットを Human へ
2. **T-2**（T-1 DONE 後）: BUILD を 5.0 頭身・身長維持・脚胴按分で更新 → 腕長 BUILD 化（男女共通）→ 骨盤 Y を HIP_Y 由来に（親は root のまま）→ WEAPON_SOCKET 確認 → Panel 行 → V-1 を Human へ（必要なら Human 指示で 4.5〜5.0 の微調整）→ E-2 → Full Regression
3. **T-3**（T-2 DONE 後）: 関節球・Pauldron → V-1 → （Human が骨盤と胴の分離が目立つと判断した場合だけ）骨盤の waist 付け替え → 対象テスト（`character-motion` / `weapon-stow`）
4. **T-4**（T-3 DONE 後）: 頭部直値 → Coverage → 上位職装飾・戦騎士 0.86 の再調整（値は V-1 で Human 確認）→ Full Regression → V-1（上位職4種を含む）
5. **T-5**（T-4 DONE 後）: マテリアル値表 → 基本マテリアル（マット化）→ 装飾の外れ値 → 対象テスト（build / unit / `battle-knight-visual`）→ V-1
6. **T-6**: 取り下げ（実装しない）

各 WI は完了時に Implementation Result（Test Report・Changed Files）を本 Task file に追記し、§7.3 の手順で Review Handoff を出す。

## Status History
| Date | Target | From → To | By | Note |
| --- | --- | --- | --- | --- |
| 2026-09-25 | Task | DRAFT → PLANNED | Planner | Artifact Handoff（Kind `analysis`）H-1〜H-8 PASS。Analyzer 判定 A。計画作成（branch `claude/character-vis-001-planner-kzh5di`、未 commit） |
| 2026-09-25 | T-1〜T-6 | DRAFT → WAITING_APPROVAL | Planner | 計画作成済み。D-1〜D-8 未決定のため、各 WI は関係 DECISION の決定まで承認不可 |
| 2026-09-25 | T-1〜T-5 | WAITING_APPROVAL → APPROVED | Planner（人間の指示による記入） | ユーザー（人間）が Planner セッションの会話で Human Decision（D-1〜D-8）と実施順 T-1 → T-5（並行禁止）を承認。Persistence は未許可（承認済み Task file は Human が push する前提） |
| 2026-09-25 | T-6 | WAITING_APPROVAL → 取り下げ | Planner（人間の指示による記入） | ユーザー（人間）が「T-6: D-5に従い取り下げる」と指示（§7.1 / §7.2 の人間の判断による取り下げ） |
| 2026-09-25 | T-1 | APPROVED → IMPLEMENTING | Implementer | Plan Handoff（Kind `plan`、`06990ef513fef9b271beb871c7791277c41f53a8`）H-1〜H-8 PASS。Persistence はユーザー（人間）の Implementer セッションでの明示指示（下の Implementation Result） |
| 2026-09-25 | T-1 | IMPLEMENTING → TESTING | Implementer | 実装完了。build / unit / T-1 関連 E2E を実行 |
| 2026-09-25 | T-1 | TESTING → REVIEWING | Implementer | FAIL なし（Test Report）。Branch `claude/character-vis-001-t1-impl` |
| 2026-09-25 | T-1 | REVIEWING → DONE | Reviewer | `.ai/reports/CHARACTER-VIS-001-T1-review.md` PASS（Reviewed SHA `8f4566c2a17558b5b7e2310fe05b5735b4173470`、同一セッションで兼務）。Task Level は T-2〜T-5 未完了のため PLANNED のまま |
| 2026-09-25 | T-2 | APPROVED → WAITING_APPROVAL | Planner | T-2 Artifact Handoff（Kind `analysis`、`f7f246e2909e3dc63f9c2f0d1b122f0b42a576cd`、blob `63abdbe1…`）H-1〜H-8 PASS。詳細計画（新版）を作成し、新規 Human Decision DEC-T2-7 / DEC-T2-8 を提示。承認の取り直し（§6）。旧版の承認記録は残す。本ファイルは `origin/main`（`0a56e9c`）起点の `claude/character-vis-001-t2-planner` 上で未 commit（Persistence は Human） |
| 2026-09-25 | T-2 | WAITING_APPROVAL → APPROVED | Planner（人間の指示による記入） | ユーザー（人間）が「T-2新版を承認、DEC-T2-7は(a)、DEC-T2-8は(a)で確定」と指示。Persistence は未許可 |
| 2026-09-25 | T-2 | APPROVED → BLOCKED | Planner | 記録: 第2版は `claude/character-vis-001-t2-impl` 上で APPROVED → IMPLEMENTING → TESTING → REVIEWING（`cde399d48a0b668e4cb5ac797ea361abff210950`、main 未統合、未レビュー）まで進んだ。Human の方針変更（華奢で縦に伸びたシルエット、キャラクター別の絶対値 BUILD）により Review せず停止（理由: 承認後の計画変更、§6 の承認取り直し） |
| 2026-09-25 | T-2 | BLOCKED → WAITING_APPROVAL | Planner | 第3版の計画を作成。DEC-T2-9〜12 を提示。本ファイルは `origin/main` `f48247d` 起点の `claude/character-vis-001-t2-replan` 上で未 commit（Persistence は Human） |

## Implementation Result

T-1（非戦闘歩行）のみ。T-2〜T-5 には着手していない。Implementation SHA は本ファイルに書かない（§5.1。記録の正本は review report の Review Target）。

### Artifact Handoff
| Kind | Path | Source（branch @ SHA） | Blob SHA | 確認（I-1 / H-1〜H-8） |
| --- | --- | --- | --- | --- |
| `plan` | `.ai/tasks/CHARACTER-VIS-001.md` | `claude/character-vis-001-planner-kzh5di` @ `06990ef513fef9b271beb871c7791277c41f53a8` | `59b180881c86e990135706bae77610868fbcaece` | H-1 `merge-base --is-ancestor` 真 / H-2 `cat-file -e` 成功 / H-3 `diff --name-only 06990ef^ 06990ef` = 本 Path のみ / H-4 1行目 `# CHARACTER-VIS-001` 一致 / H-5 Kind `plan`・期待 Path 一致 / H-6 `rev-parse` 一致 / H-7 既存の Kind `plan` 記録なし（新規）/ H-8 `git show <sha>:<path>` で読んだ。I-1: `git show` で復元し `git hash-object` = Blob SHA 一致。I-3: 変更は T-1 の Status（Work Items 表）・Status History への行追加・本節のみ。**PASS** |
| `analysis` | `.ai/reports/CHARACTER-VIS-001-analysis.md` | `claude/character-vis-001-analysis-g029kj` @ `25b13a17f7b2f3ec9d61df8657b3c8f03ec5d054` | `cd6828266e4d29dffe3bc296ea210dd50d12472e` | I-1: 作業ブランチに無かったため `git show` で復元し `git hash-object` = Blob SHA 一致。**PASS** |

### Persistence / 承認範囲の根拠
- Persistence: ユーザー（人間）/ 2026-09-25 / Claude Code の Implementer セッションの会話で「Implementation Persistence: Branch: claude/character-vis-001-t1-impl. Persistence is permitted for T-1 only.」と明示。上の T-1 Approval 欄の `Persistence:` 行は I-3（承認済み版は Status 行・Status History・本節以外を変更しない）のため空欄のまま。**Approval 欄と会話上の許可の食い違いを Reviewer の確認事項として残す**
- Files To Change の追加: `src/legacy/concat-plugin.js`（import 1行）。legacy parts は concat-plugin の HEADER 経由でしか `src/core/` を import できず（ARCHITECTURE.md）、Step 1 の関数を Step 2 で使うために構造上必須。ユーザー（人間）/ 2026-09-25 / 同セッションの質問への回答で「1行追加を承認」。変更は relaxed-idle.js の import 一覧への4識別子の追加のみ

### Changed Files
| ファイル | 変更 |
| --- | --- |
| `src/core/relaxed-idle.js` | `locomotionArmBase(combatStance, relaxedStance, combatW)`（腕4チャンネルを `blendPose` で補間）、`locomotionMix()`、非戦闘の腕振り係数 `RELAXED_WALK_ARM_SWING`（4職）、上半身の run 由来項の非戦闘倍率 `RELAXED_WALK_UPPER`（run 0.35 / lean 0.5）を追加（Step 1 / 3 / 4） |
| `src/legacy/parts/13-update-loop.js` | `updateLocomotion()`: 腕の基準を `armLBase` 等の固定値から `locomotionArmBase(armLBase 由来の構え, activeRelaxedStance(), relaxCombatBlend)` へ（Step 2。滞空中の腕も同じ基準を使う）。腕振り係数を `STANCE.armSwing` と非戦闘値の補間へ（Step 3）。腰 pitch・bob の `run` を `runUpper` へ、前傾に非戦闘倍率（Step 4）。`relaxCombatBlend` が1フレーム前の値である旨をコメント（Step 5）。脚の swing・`2.7`・移動速度・`inputMag`・足音/土煙の `run` は不変 |
| `src/legacy/parts/05-rendering-rig.js` | `motionRigSnapshot()` に `walkArmW` の読み取りのみ追加（Step 6） |
| `src/core/motion-preview.js` | RIG ブロックに ` WALK` 行（移動中の腕の基準ウェイト、停止中 `-`）（Step 6） |
| `src/legacy/concat-plugin.js` | 上記 import 1行（承認範囲の追加。上記） |
| `tests/unit/relaxed-idle.test.js` | U-1: combatW=0/1/0.5、`blendPose` との一致、腕以外を返さない、範囲外・NaN、係数表 |
| `tests/unit/motion-preview.test.js` | U-2: WALK 行の整形（0.00 / 1.00 / null・undefined → `-`） |
| `tests/character-motion.spec.js` | E-1: 剣士で 非戦闘移動 WALK < 0.05 → 攻撃後の戦闘態勢で移動 WALK > 0.8 → 態勢が切れた後の移動 WALK < 0.2 |
| `.ai/tasks/CHARACTER-VIS-001.md` / `.ai/reports/CHARACTER-VIS-001-analysis.md` | 承認済み版・Analyzer report を Source SHA から復元して同梱（§6 / §7.3）。Task file は T-1 Status・Status History・本節のみ変更 |

### Test Report
- Scope: Targeted
- Executed: `npm run test:unit`（U-1 / U-2 を含む全 unit）、`npm run build`、`npx playwright test tests/character-motion.spec.js tests/weapon-stow.spec.js tests/battle-knight-visual.spec.js tests/save-load.spec.js tests/scenario-timer.spec.js`（リポジトリ外の設定経由。下記 Environment）
- Why this scope: Test Plan の T-1 行（U-1 / U-2 / Unit 既存 / E-1 / E2E 既存 `character-motion`・`weapon-stow`・`battle-knight-visual` / `save-load`・`scenario-timer`）
- Not run: 上記以外の E2E（`npm test` 全体）。T-1 の影響経路（`updateLocomotion` の腕・上半身と Motion Panel）を通らないため。V-1（目視）は Human 確認事項（スクリーンショット `test-results/motion-warrior-walk-exploration.png` / `motion-warrior-walk-combat.png` は保存のみ、リポジトリには含めない）
- Environment: repo の Playwright（1.62.1）が要求する Chromium revision 1234 が未導入で、`npx playwright test` は起動前に `Executable doesn't exist .../chromium_headless_shell-1234` で失敗（実行環境の問題、NOT_RUN 相当）。**リポジトリ外**（セッションの scratchpad）に repo の `playwright.config.js` を import して `use.launchOptions.executablePath: '/opt/pw-browsers/chromium'`（導入済み revision 1194）だけ差し替えた設定を置いて実行した。repo の Playwright 設定・依存は変更していない

| テスト | 結果（PASS / FAIL / FLAKY / NOT_RUN） | メモ |
| --- | --- | --- |
| `npm run test:unit` | PASS | 1506 / 1506（U-1 / U-2 を含む） |
| `npm run build` | PASS | 既存の chunk size 警告のみ |
| E-1 `character-motion.spec.js:394`（新規） | PASS | 一括実行の初回は `戦闘態勢の移動で WALK が読めない`（キー押下中に読んだ時点のパネルが停止中の `-`。失敗時スナップショットのパネルは `WALK 1.00`）。**テスト側の読み取りタイミング**が原因（FACT: パネルは0.5秒ごと更新）で、移動中の値が出るまで待つ形へ修正後、単独で2回連続 PASS。実装コードは修正していない |
| `character-motion.spec.js` 既存 10件 | PASS | 状態遷移・Visual Freeze・魔導士 Combat Idle・魔弾・弓師残心・剣士/盗賊 |
| `weapon-stow.spec.js` 10件 | PASS | 8職の収納/抜刀、弓師、カメラ |
| `battle-knight-visual.spec.js` | PASS | |
| `save-load.spec.js` 6件 | PASS | |
| `scenario-timer.spec.js` 2件 | PASS | 移動速度不変の回帰 |

### Acceptance Criteria
| AC | 確認方法（VERIFIED / FACT (code)） | 根拠 |
| --- | --- | --- |
| 非戦闘で移動中、腕の基準が休め姿勢 | VERIFIED | E-1: WALK < 0.05（実測 0.00） |
| 戦闘態勢中の移動は構え基準、態勢が切れると休めへ戻る | VERIFIED | E-1: WALK > 0.8（実測 1.00）→ SHEATHING / EXPLORATION 後 < 0.2 |
| 上半身の `run` 由来項が非戦闘時に抑えられる | FACT (code) | `13` の腰 pitch・bob は `runUpper = run * locomotionMix(0.35, 1, walkW)`、前傾に `locomotionMix(0.5, 1, walkW)`。U-1 で倍率 < 1 |
| 戦闘態勢中の移動・攻撃・スキル・回避は従来どおり | VERIFIED + FACT (code) | 既存 E2E PASS。walkW = 1 で基準・係数が従来値に一致（U-1） |
| `STANCE` / `CLIPS` 差分なし、移動速度・脚の swing・`2.7` 不変 | FACT (code) | `git diff` で該当行に変更なし |

### Out of Scope Found
- `src/legacy/parts/05-rendering-rig.js` の `applyRelaxedIdlePose()` 前のコメント「停止中の 1. の出力は、実質いつもクラスの構えそのもの」は T-1 後は非戦闘時に当てはまらない（歩行側の基準が休めになったため）。05 は `motionRigSnapshot()` の読み取り追加のみ承認のため変更していない
- 停止中の非戦闘でも歩行側の腕の基準が休めになるため、立ち止まり直後の休め姿勢への寄りが従来より早い（`relaxStopBlend` の途中でも腕は休め側）。見え方は V-1 で Human 確認

