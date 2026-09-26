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
| T-2 | 体格の再設計（キャラクター別の絶対値 BUILD・約5頭身・細身化。第3版） | DONE | [x]（第3版。旧版・新版（第2版）の承認記録は下に残す） | D-1, D-6 維持。D-2 / D-2' / D-7 は改訂済み（DEC-T2-9）。DEC-T2-8 = (a)、DEC-T2-9〜12 = 決定済み | .ai/reports/CHARACTER-VIS-001-T2-analysis.md（branch `claude/character-vis-001-t2-analysis` @ `f7f246e2909e3dc63f9c2f0d1b122f0b42a576cd`、blob `63abdbe139ad273c449dd694071aa3593dd4690f`）+ Planner のコード再確認（★） |
| T-3 | 関節の接続（関節キャップ球と断面の整合、骨盤の扱い）。T-2 第3版基準で再計画 | DONE | [x]（再計画版。旧版の承認記録は下に残す） | D-6、DEC-T3-1〜7（決定済み。DEC-T3-3 は Step 0 の Human 目視判断で確定） | .ai/reports/CHARACTER-VIS-001-T3-analysis.md（branch `main` @ `b6858b11d0739b16d08faa549b2868b91f233ab8`、blob `d2fdc21d99b475dadfc49e465083f6882d785d71`） |
| T-4 | キャラクター性の再設計（頭部・顔の見せ方・髪・被り物・服装 Geometry・身体シルエット・職業固有シルエット・上位職の形状）。旧スコープ（頭部周りの直値再調整・戦騎士 0.86）を含む再計画版 | DONE | [x]（再計画版。旧版の承認記録は下に残す） | D-1, D-8、HDR-T4-1〜15（決定済み。デザインは初期案、V-1 で形状調整） | .ai/reports/CHARACTER-VIS-001-T4-analysis.md（branch `claude/character-vis-001-t4-analysis` @ `6ea91565d255849aaee1134666da04256543f00c`、blob `f15713384131f85bc9ee57c8219d2e836b24dd0c`） |
| T-5 | プレイヤー用マテリアル値の統一（マット化）。再計画版で配色・Material・質感へ拡大（HDR-T5-1） | IMPLEMENTING | [x]（再計画版 2026-09-26。旧版の承認記録は下に残す） | D-4（決定済み）、HDR-T5-1〜12、P-D0〜11 | `.ai/reports/CHARACTER-VIS-001-T5-analysis.md` |
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
- [x] Approved
- Approved by / date / where: ユーザー（人間）/ 2026-09-25 / Claude Code セッションの会話で「T-2第3版を承認、Persistenceは claude/character-vis-001-t2-v3-impl」と指示。記入: Planner（人間の指示による）
- Scope of approval: 「T-2 詳細計画（第3版）」の Step 1〜9、同節の Files To Change。DEC-T2-9〜12 は決定済み（2026-09-25）
- Persistence: 許可（branch: `claude/character-vis-001-t2-v3-impl`）。根拠: ユーザー（人間）/ 2026-09-25 / 同上の会話

Implementation (T-2, 第3版): BLOCKED — 承認済み Task file の Persistence と Plan Handoff（Kind `plan`）が未了。実装ブランチは `origin/main` `f48247d` 起点（DEC-T2-12）

### T-3 Human Approval
- [x] Approved
- Approved by / date / where: T-1 と同じ
- Scope of approval: T-3 の Implementation Plan Step 1 / 2 / 4、Files To Change #4（プレイヤー専用の断面比率のみ）/ #5（`buildPlayer()` の関節球・Pauldron・骨盤）。Step 3（骨盤の waist 付け替え）は Decision Record の D-6 の条件を満たした場合だけ。**T-2 が DONE になってから着手**
- Persistence:（空欄 = 未許可）

Implementation (T-3): BLOCKED — T-1 と同じ理由に加え、T-2 の DONE 待ち

### T-3 Human Approval（再計画版。2026-09-25 Planner。上の旧版の承認記録は残す）
- [x] Approved
- Approved by / date / where: ユーザー（人間）/ 2026-09-25 / Claude Code セッションの会話で T-3 再計画版の承認と DEC-T3-3〜7 の確定を指示。記入: Planner（人間の指示による）
- Scope of approval: 「T-3 詳細計画（再計画版）」の Step 0〜4、同節の Files To Change。DEC-T3-3〜7 の決定（同節「Human Decision（確定）」）に従う
- Persistence:（空欄 = 未許可。実装用ブランチは未指定）

Implementation (T-3, 再計画版): BLOCKED — Persistence（実装用ブランチ）と、承認済み Task file の Plan Handoff（Kind `plan`）が未了

### T-4 Human Approval
- [x] Approved
- Approved by / date / where: T-1 と同じ
- Scope of approval: T-4 の Implementation Plan Step 1〜3、Files To Change #4（頭部 Coverage / `HEAD_*` 定数）/ #5（`buildPlayer()` の頭部・髪・被り物・目、`applyJobPromotionVisual()`）。Decision Record の D-1 / D-8 に従う。**T-3 が DONE になってから着手**
- Persistence:（空欄 = 未許可）

Implementation (T-4): BLOCKED — T-1 と同じ理由に加え、T-3 の DONE 待ち

### T-4 Human Approval（再計画版。2026-09-25 Planner。上の旧版の承認記録は残す）
- [x] Approved
- Approved by / date / where: ユーザー（人間、Decision Maker: Human）/ 2026-09-25 / Claude Code セッションの会話で「T-4 再計画版を正式に承認します。承認範囲は Task file に記載された T-4 全体」と指示。記入: Planner（人間の指示による）
- Approval 対象: T-4 再計画版。Approved Task Blob: `190976e7f1938799d95ffa6a697600398ca653db`（Persistence commit `672232ffdbdd655cb8efe49343b0e8e53188d457`、branch `claude/character-vis-001-t4-planner`）
- Scope of approval: 「T-4 詳細計画（再計画版）」全体。Step 0〜8（Step 5 は不実施）、同節の Files To Change（確定版）、HDR-T4-1〜15 の Human Decision（T-4 を分割しない、弓師 A を先行パイロット、弓師 A / 剣士 A / 魔法使い C / 盗賊 A、F-b、H-a、S-a、P-a、W-a、武器収納状態の識別を Acceptance に含める、武器収納の補正は収納状態の `off` のみ、衣服構築 E2E を必須、眉・口などの新しい顔の造形を追加しない）、T-4 / T-5 の境界、V-1 をパイロット時と全体完成時の2回、最終的な可愛さ・キャラクター性は Human の目視で判断
- 承認条件（変更禁止）: BUILD の体格値 / T-1 の歩行 / STANCE / CLIPS / T-3 の関節球 / T-3 の Pauldron / 骨盤 / Material の値 / 輪郭線 / 敵 / ボス / 支援AI / 共有の Lathe 表 / `13-update-loop.js`。新しい衣服システムは作らず、既存の Loft と既存の可動部への取り付け方式を使う
- Persistence: 許可（branch: `claude/character-vis-001-t4-impl`）。根拠: ユーザー（人間）/ 2026-09-25 / Claude Code セッションの会話で「T-4 の Implementation Persistence を許可します」と明示（起点 `main` `c17951b978c2d5efb6d715bed7fb73f45f169e53`、Approved Task Blob `3526f842c77b509d8a38c3804ebad727fa38416a` の Task file を実装ブランチへ固定）。記入: Implementer（人間の指示による）

Implementation (T-4, 再計画版): 開始可 — 実施順は Step 0 → 弓師パイロット（Step 1〜4・7）→ build / unit / 関連 E2E → 弓師パイロットの V-1 → **Human 確認**。Human 確認なしに残り3職へ展開しない

### T-5 Human Approval
- [x] Approved
- Approved by / date / where: T-1 と同じ
- Scope of approval: T-5 の Implementation Plan Step 1 / 2（Step 3 = セル調は含まない）、Files To Change #5（`buildPlayer()` / `applyJobPromotionVisual()` のマテリアル値）。マテリアル値表を `05` の BUILD 近傍に置く場合は #4 も含む。Decision Record の D-4 に従う。**T-4 が DONE になってから着手**
- Persistence:（空欄 = 未許可）

Implementation (T-5): BLOCKED — T-1 と同じ理由に加え、T-4 の DONE 待ち

### T-5 Human Approval（再計画版: 配色・Material・質感。2026-09-26。上の旧版の承認記録は残す）
- [x] Approved
- Approved by / date / where: ユーザー（人間、Decision Maker: Human）/ 2026-09-26 / Claude Code セッションの会話で HDR-T5-1〜12 と「CHARACTER-VIS-001 T-5 の Human Approval を確定します」（P-D0〜P-D11）を指示。記入: Implementer（人間の指示による）
- Approval 対象: Planner report `.ai/reports/CHARACTER-VIS-001-T5-plan.md`（Input: `.ai/reports/CHARACTER-VIS-001-T5-analysis.md`）。Persistence commit `7ea0170cda309907b2f5ca83b0eb14d90bffcbb7`（branch `claude/character-vis-001-t5-planner`）
- Scope of approval: HDR-T5-1（範囲拡大: 職業別配色 / プレイヤー専用配色 Material / 最小限の Material 分離 / 共有による色波及の解消 / matte 化 / 上位職の Material 切り替え整理 / 影の旅人の衣服色と影 VFX 色の分離）と Planner report 全体。Planner report と下の P-D が食い違う箇所は **P-D を正**とする
- P-D（Human 確定）:
  - P-D0: 肌色は T-4 最終確定値のまま変えない（剣士 0xffe6d2 / 魔法使い 0xffeee5 / 盗賊 0xffe7d4 / 弓師 0xe8bd98 / 影の旅人 0xe8dce0）。0xf2d6bf 等の途中候補値は採用しない
  - P-D1: Planner 成果物は `claude/character-vis-001-t5-planner`
  - P-D2: 配色表は新規 `src/render/player-palette.js`
  - P-D3: Material 役割は main / sub / accent / layer / hat / trim / boot の7つで固定。新規は subMat / subMatFlat / layerMat の3系統を基本
  - P-D4: 魔導士の髪色の既存直接書き換えは変えない（髪は範囲外）
  - P-D5: 弓師 main Forest Green #315C50 / sub Blue Gray #617A82 / accent Muted Gold #B99652 / trim Off White #E6E4DD
  - P-D6: 魔法使いの帽子 #6F8CA3
  - P-D7: 上位職の白系レイヤー: 戦騎士 Cool Gray #9AA5B1 / 鷹の目 Off White #E5E1D9
  - P-D8: 影の旅人は全身黒に見えないよう必要に応じて明るくしてよい（形状・頭身・衣服構成は変えない）。衣服と影エフェクトの紫は別 Material・別色
  - P-D9: 武器装飾は配色表の accent / trim 系に統一。投げナイフの初期質感 roughness 0.75 / metalness 0.45
  - P-D10: E2E の色検証は Planner 案（Motion Preview の行）。Playwright 設定は変えない
  - P-D11: V-1 は3段階を厳守（1. 基礎4職 → 2. 上位4職 + 影の旅人（酒場で同一条件撮影、必須）→ 3. 9キャラクターを同一条件で並べる）。各段階で Human OK を得るまで次へ進まない
- 承認条件（変更禁止）: BUILD / 5.0頭身 / Geometry / 衣服形状・配置 / シルエット / 顔 / 目 / 髪 / STANCE / CLIPS / 歩行 / 戦闘モーション / 武器形状・位置 / 影の旅人の武器システム / 敵 / ボス / 支援AI / `13-update-loop.js` / Playwright 設定 / `CLASSES.color` / `CLASSES.trim`
- Persistence: 許可（branch: `claude/character-vis-001-t5-impl`）。根拠: ユーザー（人間）/ 2026-09-26 / 会話で「T-5 Implementer branchを作成して実装を開始して」と指示（起点 `7ea0170`）。記入: Implementer（人間の指示による）

Implementation (T-5, 再計画版): 開始可 — 配色表・構造 → 基礎4職 → build / unit / 関連 E2E → V-1 第1段階（基礎4職）→ **Human OK**。Human OK なしに上位職・影の旅人へ進まない

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

**V-1 Visual Character Check（Human 追加、2026-09-25。実装後の Human 目視確認を受けた完成確認基準）**

決定者: ユーザー（人間）/ 2026-09-25 / Claude Code セッションの会話。記入: Implementer（人間の指示による）。承認済み計画の既存項目は書き換えず、本項を追加する。

| # | 基準 |
| --- | --- |
| V-1m | 5.0頭身でもキャラクター性が失われない |
| V-1n | 細身のキャラクターでも棒状・人形状に見えない |
| V-1o | 頭部が単純な無機質な塊に見えない |
| V-1p | 職業ごとのシルエットが明確 |
| V-1q | 実際のゲームカメラ距離でも4職の違いが認識できる |
| V-1r | 装備だけでなく、キャラクターそのものの違いが感じられる |
| V-1s | 「可愛さ」は数値化せず、最終的な Human 目視確認とする |

- 注意: V-1 は T-2 でキャラクターデザインを完成させるという意味ではない。T-2 では 5.0頭身を維持し、残ったキャラクター性の課題は T-4 へ引き継ぐ（下の Human Decision）

**Human Decision（V-1 確認後、2026-09-25、ユーザー（人間）/ Claude Code セッションの会話）**
1. T-2 第3版の 5.0頭身を維持する
2. 弓師・盗賊の体格を T-2 で戻さない（BUILD 値を再変更しない）
3. 可愛さ・キャラクター性の不足は T-4 で扱う（V-1m〜V-1s のうち T-2 で満たしきれない部分は T-4 の確認事項へ引き継ぐ）
4. T-2 第3版を正式な実装候補として Reviewer へ渡す
5. T-4 の実装はまだ開始しない

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

### T-3 詳細計画（再計画版、2026-09-25 Planner。上の T-3 計画を置き換える）

**Human Decision（決定済み、ユーザー（人間）/ 2026-09-25 / Claude Code セッションの会話）**
- DEC-T3-1 = **(a)**: T-2 を main へ統合してから、main を起点に T-3 を実装する（T-2 は `main` `b6858b1` に統合済み）
- DEC-T3-2 = **(a)**: T-2 第3版の細い体格を正式な基準として T-3 を再計画する。承認済みの4つの Step は維持し、範囲は広げない。旧計画に残る T-2 第1版前提の値・表現（例: Step 2「T-2 の肩位置」）を第3版の BUILD 値に合わせて更新する

**入力（Artifact Handoff 検証、AGENTS.md §5.2）** — Planner が git から再計算した結果

| # | 確認 | 実行 | 結果 |
| --- | --- | --- | --- |
| H-1 | Source Branch が remote に存在し Source SHA が到達可能 | `git fetch origin main`、`git merge-base --is-ancestor b6858b1… origin/main` → 真（先端と同 SHA） | PASS |
| H-2 | Source SHA 時点に Path が存在 | `git cat-file -e b6858b1…:.ai/reports/CHARACTER-VIS-001-T3-analysis.md` → 成功 | PASS |
| H-3 | Source commit の変更が Path の1件だけ | `git diff --name-only b6858b1^ b6858b1` → 当該 Path のみ | PASS |
| H-4 | Path・1行目が期待値と一致 | Work Item 専用の期待 Path `.ai/reports/CHARACTER-VIS-001-T3-analysis.md`、1行目は `# CHARACTER-VIS-001 Analysis` で始まる | PASS |
| H-5 | Kind `analysis`、期待 Path | 命名例外の適用なし | PASS |
| H-6 | Blob SHA が一致 | `git rev-parse b6858b1…:<Path>` → `d2fdc21d99b475dadfc49e465083f6882d785d71` | PASS |
| H-7 | 同じ `(Task ID, Kind)` の既存記録 | `(CHARACTER-VIS-001 / T-3, analysis)` の記録は無い（Task 全体の `Analysis:` 行は別キー）。新規 | PASS |
| H-8 | Source SHA の内容だけを読む | `git show b6858b1…:<Path>` で読んだ | PASS |

- 本計画は `origin/main` `b6858b11d0739b16d08faa549b2868b91f233ab8`（T-2 DONE を含む）起点の `claude/character-vis-001-t3-planner` で作成した

#### Objective
T-2 第3版の細い体格を前提に、膝・肘・肩・骨盤の繋ぎ目を既存の覆い物（関節球・Pauldron）と既存の階層（waist 付け替え）・断面比率の範囲で整え、**Human が目視で許容できる接続**にする。キャラクター性・可愛さ・体のメリハリは扱わない（T-4）

#### Scope / Non-Scope
| Scope（承認済みの4 Step を維持） | Non-Scope（T-3 では実装しない） |
| --- | --- |
| Step 1 膝・肘の関節球の大きさを隣接断面に整合 | 頭部・髪・被り物のキャラクター性、無機質な頭部シルエット（T-4） |
| Step 2 Pauldron の大きさ調整（方針は DEC-T3-5） | 弓師・盗賊の身体のメリハリ（T-2 Human Decision で T-4） |
| Step 3 骨盤を waist へ付け替え（条件付き、DEC-T3-3） | 職業固有シルエットのデザイン変更・可愛さ・上位職固有装飾（戦騎士の肩鎧、バーサーカーの毛皮の肩など `applyJobPromotionVisual()`）（T-4） |
| Step 4 プレイヤー専用断面比率の微調整（必要な場合のみ、DEC-T3-4） | モーション（歩行・構え・CLIPS の式）、武器（背中の大剣・弓の浮きを含む）、マテリアル（T-5）、支援AI（D-5）、BUILD の体格値（T-2 で確定） |
| Step 0 V-1 の撮影（判断材料。コード変更なし） | 新しい関節システム・skinning・新しい rig |

#### Preconditions
- T-2 DONE かつ main に統合済み（`b6858b1` に `bc1d0e4` を含む。確認済み）
- 本再計画版の Human Approval、DEC-T3-3〜7 の決定、Persistence 先ブランチ、承認済み Task file の Plan Handoff（Kind `plan`）を H-1〜H-8 で検証
- 実装ブランチは `origin/main` 起点（DEC-T3-1）

#### 現在の値（T-2 第3版、Analyzer report の FACT をコードで再確認 ★）
| 項目 | 式（★コード） | 剣士 | 魔法使い | 弓師 | 盗賊 |
| --- | --- | --- | --- | --- | --- |
| 太腿下端 / ふくらはぎ上端の半幅 | ★thigh·0.70 / calf·0.90（`05:429-433, 480-484`） | 0.0665 / 0.0675 | 0.0595 / 0.0594 | 0.0616 / 0.0612 | 0.0595 / 0.0594 |
| 膝球の半径 | ★`calf·0.98`、scale (1, 0.72, 0.92)（`06:614-616`） | 0.0735 | 0.0647 | 0.0666 | 0.0647 |
| 上腕下端 / 前腕上端の半幅 | ★upper·0.82 / forearm·1.00（`05:529-533, 581-585`） | 0.0574 / 0.058 | 0.0476 / 0.050 | 0.0492 / 0.052 | 0.0492 / 0.052 |
| 肘球の半径 | ★`forearm·1.06`（`06:1552`） | 0.0615 | 0.0530 | 0.0551 | 0.0551 |
| Pauldron 半径 / 高さ | ★`upper·1.52·s` / `upper·2.1·s`、盗賊 s = 0.6（`06:1587-1592`） | 0.106 / 0.147 | 0.088 / 0.122 | 0.091 / 0.126 | 0.055 / 0.076 |
| Pauldron 込みの肩の外幅 / 全高 | 2·(chest + shoulderOut + Pauldron 半径) / stature | 0.32 | 0.28 | 0.29 | 0.26 |
| 骨盤の上端 / 胴の下端（ベルト線） | ★`HIP_Y − pelvisDrop + pelvisH/2` / `HIP_Y`（`06:664-667`） | 1.080 / 1.200 | 1.035 / 1.140 | 1.065 / 1.170 | 1.030 / 1.140 |
| 骨盤の親 | ★root 直下（waist 付け替えループの除外 `06:1705`） | | | | |

- 上表は計算値。**実機での見え方（膝球・肘球の出っ張り、肩の接続、骨盤と胴の分離）は未確認**（Analyzer report でも visual confirmation unavailable）。Step 0 で撮影し Human が見る

#### Implementation Steps
| Step | ファイル / 関数 | 内容 | 条件 |
| --- | --- | --- | --- |
| 0 | V-1 撮影（コード変更なし。リポジトリ外に保存） | 変更前の基準として、4キャラクター（+ 上位職4種・影の旅人は回帰確認用）× 停止・非戦闘移動（歩行中）・戦闘態勢 × 正面・斜め45°・側面相当（T-2 と同じくキャラクターの向きを変えて撮る）。膝・肘・肩・骨盤の拡大も撮る。**骨盤と胴の分離は歩行中（特に hip sway の大きい魔法使い・弓師）で撮る** | 常に行う。DEC-T3-3 の判断材料 |
| 1 | `06` `buildPlayer()` 膝球（`:614-616`）・肘球（`:1552`） | 半径を「隣り合う2つの断面端の大きい方 × k」に置き換える（膝: `max(thigh·0.70, calf·0.90)·k`、肘: `max(upper·0.82, forearm·1.00)·k`）。初期値 **k = 1.02**（現状は膝 1.09、肘 1.06 倍相当）。膝球の scale (1, 0.72, 0.92) と材質は変えない。k の最終値は V-1 で Human が確認 | 常に行う |
| 2 | `06` `buildPlayer()` Pauldron（`:1587-1592`）。(c) の場合は `05` `BUILD` に項目追加 | DEC-T3-5 の決定どおり: (a) 現状維持 / (b) 全職共通の係数へ（案: 半径 upper·1.30、高さ upper·1.80、盗賊の 0.6 は維持）/ (c) キャラクター別の絶対値（`pauldronR` / `pauldronH` を BUILD に追加）。戦騎士は転身時に基礎の Pauldron を隠すので影響しない | DEC-T3-5 |
| 3 | `06` waist 付け替えループ（`:1702-1710`） | 除外リストから `pelvis` を外し、waist 配下にする（ループの `position.y -= HIP_Y` がそのまま効く）。歩行・回避・戦闘の式は変えない | DEC-T3-3 が「付け替える」の場合だけ |
| 4 | `05` プレイヤー専用 `*_SECTION_RATIOS`（`TORSO` / `PELVIS` / `THIGH` / `CALF` / `UPPERARM` / `FOREARM`） | 関節に接する断面の比率だけを微調整（膝: Thigh `knee` / Calf `upperCalf`、肘: UpperArm `elbow` / Forearm `upperForearm`、手首: Forearm `wrist`、ベルト側: Torso `waist` / Pelvis `upperWaist`）。中間断面（`midThigh` / `midCalf` / `chest` など、体のメリハリに当たる部分）は変えない。ボス用 `LIMB/TORSO/HEAD_PROFILE`、共有の `PAULDRON_PROFILE` / `CUFF_PROFILE` の表は変えない | Step 1〜3 の後の V-1 で Human が必要と判断し、かつ DEC-T3-4 が許す範囲だけ |

- すべて既存の覆い物・`limbGeo`・`makeCharacter*()`・比率表・付け替えループの再利用。新しい関節システム・skinning・rig は導入しない

#### Files To Change（再計画版）
| ファイル | 内容 | 条件 |
| --- | --- | --- |
| `src/legacy/parts/06-player-enemy.js` | `buildPlayer()` の膝球・肘球（Step 1）、Pauldron（Step 2）、waist 付け替えの除外（Step 3） | Step 2・3 は DEC 次第 |
| `src/legacy/parts/05-rendering-rig.js` | プレイヤー専用 `*_SECTION_RATIOS`（Step 4）、`BUILD` の Pauldron 項目（DEC-T3-5 = (c) の場合のみ） | 条件付き |
| `tests/unit/lowpoly-primitives.test.js` | Step 4 で比率を変えた場合の複製の同期、膝球の検査値（旧 male の直値）の更新 | DEC-T3-6（**承認済み旧 T-3 の Files To Change に無い**） |
| `src/core/motion-preview.js` / `tests/unit/motion-preview.test.js` / `tests/character-motion.spec.js` | 関節の値の Panel 読み取り行と E2E | DEC-T3-6（**旧 T-3 に無い**） |
| Task file | Implementation Result・Status・Status History | 常に |

変更しない: `13-update-loop.js`（T-1 の歩行の式）、`STANCE` / `STANCE_ALT` / `CLIPS`、`BUILD` の体格値（T-2）、`WEAPON_SOCKET`、`applyJobPromotionVisual()`、マテリアル、頭部・髪・被り物、支援AI（`08` / `11`）、`concat-plugin.js`、`playwright.config.js`

#### Test Plan（再計画版）
| 区分 | 対象 | 確認 |
| --- | --- | --- |
| Build | `npm run build` | 通る |
| Unit | `npm run test:unit` | 全 PASS。Step 4 を行った場合は `lowpoly-primitives.test.js` の比率の複製が 05 と一致していること（DEC-T3-6） |
| E2E 既存 | `character-motion.spec.js`（T-1 E-1、T-2 E-2 を含む）、`weapon-stow.spec.js`、`battle-knight-visual.spec.js`、`base-class-identity.spec.js`、`base-class-comparison.spec.js`、`guest-companion.spec.js` | 構築・状態遷移・T-1 / T-2 の AC の回帰。Step 3 を行った場合も T-2 E-2（頭身・手とベルト・幅の比）が不変 |
| E2E 追加（任意） | 関節の Panel 読み取り（膝球 / 肘球の断面比、骨盤の親） | DEC-T3-6 = 含める場合だけ |
| Full Regression | `npm test` 全体 | 推奨。標準の Playwright 設定は Chromium revision 不一致の環境があり、その場合はリポジトリ外の回避策、不可なら NOT_RUN |
| 目視 V-1（T-3） | 下の V-1 | **Human が確認（Acceptance の中心）** |

**V-1（T-3）**: Step 0 と同じ条件で、実装後に撮り直して変更前と並べる
| # | 確認（Human） |
| --- | --- |
| V-1-T3a | 膝: 太腿とふくらはぎの繋ぎ目に「玉が挟まった」出っ張りが無い（停止・歩行で膝が曲がった時も） |
| V-1-T3b | 肘: 上腕と前腕の繋ぎ目に球の出っ張りが目立たない（構え・腕振り時も） |
| V-1-T3c | 肩: 胴と上腕が Pauldron で自然に繋がり、Pauldron が細い体に対して大きすぎ / 小さすぎに見えない |
| V-1-T3d | 骨盤: 停止・歩行中に骨盤と胴が分離して見えない（魔法使い・弓師の歩行を含む） |
| V-1-T3e | 4キャラクターと上位職で、関節の見え方に破綻が無い（戦騎士は基礎の Pauldron を隠す経路） |
| V-1-T3f | T-2 の V-1（細身・縦長）と T-4 引き継ぎ事項を悪化させていない |

#### Acceptance Criteria（再計画版）
- **主: 膝・肘・肩・骨盤の接続を、Human が V-1（T-3）で目視で許容する**（数値の一致だけでは合格としない）
- 関節球の半径が隣接断面から決まる（Step 1 の式。k は Human 確認値）
- DEC-T3-3〜7 の決定どおりに Step 2〜4 が実施 / 不実施されている
- 既存の unit・build・関連 E2E が PASS（T-1 E-1、T-2 E-2 を含む）。`STANCE` / `CLIPS` / 移動速度 / T-1 の歩行の式 / T-2 の BUILD 体格値に差分なし。Files To Change 以外に差分なし
- T-4 の範囲（頭部・メリハリ・職業固有シルエット・上位職装飾）を実装していない

#### Risks（再計画版）
| # | リスク |
| --- | --- |
| P-R19 | 関節の見え方は数値で決めにくく、Human の目視に依存する（見下ろし固定カメラで真横の水平視点は撮れない） |
| P-R20 | Step 3 で骨盤が waist の twist / sway / 回避の回転に一緒に動くようになる。脚の付け根との見え方が変わる |
| P-R21 | Step 4 と T-4 の「体のメリハリ」の境界（DEC-T3-4）。中間断面に触れると T-4 の範囲に入る |
| P-R22 | Pauldron を小さくすると肩の繋ぎ目（胴の肩断面と上腕の重なり 0.04〜0.05）が見えやすくなる可能性 |
| P-R23 | Step 4 で比率を変えると `lowpoly-primitives.test.js` の複製が古くなる（自動では失敗しない） |
| P-R24 | 共有の `PAULDRON_PROFILE`（ボスも使用）を誤って変えるとボスへ波及。係数は呼び出し側で扱う |

#### Human Decision Required（DEC-T3-3〜7。Planner は決めない）
| # | 論点 | 判断の要否 | 選択肢 | 影響 | Planner の推奨候補（提案） |
| --- | --- | --- | --- | --- | --- |
| DEC-T3-3 | 骨盤を waist 追従へ変更するか（Step 3）。実機確認を条件にするか | **必要**（D-6 で「Human が V-1 で分離が目立つと判断した場合だけ」と既に定めている。現時点で Human の判断は無い） | (a) Step 0 の歩行中の撮影を Human が見て決める（D-6 どおり）/ (b) 撮影なしで付け替える / (c) 付け替えない | (b) は D-6 の条件を満たさない。付け替えると骨盤も腰の動きで揺れる | (a) |
| DEC-T3-4 | Step 4（断面比率）と T-4 の身体のメリハリの境界 | **必要**（T-2 Human Decision で「メリハリは T-4」が確定しており、比率の変更はその境界に触れる） | (a) T-3 は関節に接する断面（膝・肘・手首・ベルト側）だけ、中間断面は T-4 / (b) 断面比率は T-3 で一切触れず T-4 へ / (c) メリハリも T-3 で扱う（T-2 の Human Decision の変更） | (a) Step 4 が残る。(b) Step 4 は不実施になり T-3 は Step 1〜3 のみ。(c) 範囲拡張 | (a)（Step 4 は「必要な場合のみ」のまま） |
| DEC-T3-5 | Pauldron のサイズ（Step 2） | **必要**（承認済み Step 2 の「T-2 の肩位置」は第1版前提で、第3版での方針が未決） | (a) 現状維持（upper·1.52 / 2.1）/ (b) 全職共通の係数で縮小（案 1.30 / 1.80、盗賊 0.6 維持）/ (c) キャラクター別の絶対値を BUILD に追加 | (a) 肩の外幅 / 全高 0.26〜0.32。(b) 0.25〜0.31。(c) BUILD の項目追加（05 の変更範囲が増える） | (b) を初期値とし、V-1 で Human が確認。職業別が必要なら (c) |
| DEC-T3-6 | テストの範囲 | **必要**（旧 T-3 の Files To Change にテストが無い） | (a) Step 4 を行う場合だけ `lowpoly-primitives.test.js` の複製を同期（膝球の検査値も第3版へ）。関節の Panel 読み取りは入れない / (b) (a) + 関節の Panel 読み取り行と E2E / (c) テストは変更しない | (c) は Step 4 実施時に複製が古くなる（P-R23） | (a)（AC は目視が中心のため、Panel の数値検査は必須にしない） |
| DEC-T3-7 | 籠手・脛当ての長さの直値（0.11 / 0.13）を T-3 に含めるか | **必要**（承認済みの4 Step に無い。含めると範囲拡張） | (a) 含めない（T-3 の範囲を維持）/ (b) Step 1 の関節整合に付随して BUILD 由来にする | (b) は範囲拡張 | (a) |

**Human Decision（確定、ユーザー（人間）/ 2026-09-25 / Claude Code セッションの会話。記入: Planner（人間の指示による））**
- DEC-T3-3 = **(a)**: Step 0 の歩行中の画像を Human が確認してから、骨盤を waist 追従へ変更するか決める。**現時点では「追従する」とは決定しない**。Step 0 で骨盤と胴の分離が目立つ → 骨盤を waist 配下へ付け替える（Step 3 実施）／分離が許容範囲 → 現状維持（Step 3 不実施）。判断は Human の目視
- DEC-T3-4 = **(a)**: T-3 は関節に接する断面だけを扱う（膝、肘、手首側、ベルト / 骨盤側など関節の接続に直接関係する断面）。中間断面の体格・メリハリは T-4。T-2 の Human Decision「弓師・盗賊の体のメリハリは T-4 で扱う」は変更しない
- DEC-T3-5 = **(b)**: Pauldron は全職共通の係数で少し縮小する。半径 = upper × 1.30、高さ = upper × 1.80、盗賊の 0.6 倍は維持。Pauldron 込みの肩の外幅は全高比で概ね 0.26〜0.32 → 0.25〜0.31。T-3 の関節接続の調整として扱い、職業ごとのキャラクターデザイン変更にはしない
- DEC-T3-6 = **(a)**: Step 4 を実施する場合のみ、`tests/unit/lowpoly-primitives.test.js` の断面比率の複製を実装値と同期する。関節の値を Motion Panel へ追加する変更は行わない
- DEC-T3-7 = **(a)**: 籠手・脛当ての長さの直値（0.11 / 0.13 等）は T-3 に含めず、変更しない
- **DEC-T3-3 の結果（Step 0 後、ユーザー（人間）/ 2026-09-25 / Claude Code セッションの会話。記入: Implementer（人間の指示による））= B**: 骨盤と胴の分離は許容範囲なので現状維持。骨盤を waist 配下へ付け替えない → **Step 3 は不実施**（付け替えループ・`13-update-loop.js` は変更しない）

これにより Files To Change（再計画版）は次に確定する: `src/legacy/parts/06-player-enemy.js`（Step 1・2、Step 3 は DEC-T3-3 の判断次第）/ `src/legacy/parts/05-rendering-rig.js`（Step 4 を実施する場合のプレイヤー専用 `*_SECTION_RATIOS` のみ。DEC-T3-5 = (b) のため BUILD への項目追加はしない）/ `tests/unit/lowpoly-primitives.test.js`（Step 4 を実施する場合のみ）/ Task file。`src/core/motion-preview.js`・`tests/unit/motion-preview.test.js`・`tests/character-motion.spec.js` は変更しない（DEC-T3-6 = (a)）

#### Artifact Handoff（本計画の引き渡し）
- 本 Task file は Planner ブランチ `claude/character-vis-001-t3-planner`（起点 `origin/main` `b6858b1`）上で未 commit。Planner は commit / push しない
- Human が1ファイル commit で Persistence し、Human Approval（再計画版）と DEC-T3-3〜7 の決定、Persistence 先を記入した承認済み版で Plan Handoff（Kind `plan`、`CHARACTER-VIS-001 / T-3`）を Implementer へ渡す

### T-4 頭部周り・装飾の直値再調整（T-2 完了後、D-1 / D-8）

| Step | ファイル / 関数 | 変更内容 | 理由 |
| --- | --- | --- | --- |
| 1 | `06` `buildPlayer()` 頭部・髪・被り物・目（直値 29 行） | headR 比でない直値（例 `crest.position.set(0, hY+0.28, …)` `:1146`）を headR 比の式へ置き換える、または値を再調整 | R-1 |
| 2 | `05` 頭部 Coverage / `HEAD_*` 定数（`:714-935`） | 兜 Face Opening・Coverage の再調整（必要な場合のみ） | R-11 |
| 3 | `06` `applyJobPromotionVisual()`（`:1926-`） | 上位職装飾の直値、戦騎士 `headLookPivot.scale` 0.86（D-8） | R-2 |

### T-4 詳細計画（再計画版、2026-09-25 Planner。上の T-4 計画（旧スコープ）を含めて置き換える）

**Human Decision（確定、ユーザー（人間）/ 2026-09-25 / Claude Code セッションの会話。記入: Planner（人間の指示による））**
- HDR-T4-1: T-4 を再計画し、キャラクター性・可愛さ・頭部・顔の見せ方・髪・被り物・頭部装飾・弓師 / 盗賊の身体シルエット・職業固有シルエット・中世×現代リバイバルファッション・服装 Geometry・服装によるキャラクター差・上位職の形状デザインまで含める。旧スコープ（頭部周りの直値再調整・戦騎士 0.86）だけに限定しない。**具体的なデザインは確定していない**（Planner が候補を整理し、Human が選ぶ）
- HDR-T4-8: **T-4 = 形状・Geometry・シルエット・配置・デザイン / T-5 = Material・色・質感・マット化・共通 Material 値**。T-4 で Material 値を設計変更しない。T-5 で T-4 の Geometry を再設計しない。上位職装飾の Material 調整は T-5
- 服装の方針: 「中世ファンタジーを、現代風にリメイクしたようなリバイバルファッション」を T-4 の形状デザイン方針として採用。具体的な採用内容（誰に何を）は未決定

**入力（Artifact Handoff 検証、AGENTS.md §5.2）** — Planner が git から再計算した結果

| # | 確認 | 実行 | 結果 |
| --- | --- | --- | --- |
| H-1 | Source Branch / Source SHA | `git fetch`、`git merge-base --is-ancestor 6ea9156… origin/claude/character-vis-001-t4-analysis` → 真（先端と同 SHA） | PASS |
| H-2 | Path の存在 | `git cat-file -e 6ea9156…:.ai/reports/CHARACTER-VIS-001-T4-analysis.md` → 成功 | PASS |
| H-3 | Source commit の変更が Path の1件だけ | `git diff --name-only 6ea9156^ 6ea9156` → 当該 Path のみ。親 = `f0d68ca`（T-3 統合後の `origin/main` と同 SHA） | PASS |
| H-4 | Path・1行目 | Work Item 専用の期待 Path、1行目は `# CHARACTER-VIS-001 Analysis` で始まる | PASS |
| H-5 | Kind / 期待 Path | `analysis`、命名例外なし | PASS |
| H-6 | Blob SHA | `git rev-parse 6ea9156…:<Path>` → `f15713384131f85bc9ee57c8219d2e836b24dd0c` | PASS |
| H-7 | 既存記録 | `(CHARACTER-VIS-001 / T-4, analysis)` の記録なし。新規 | PASS |
| H-8 | Source SHA の内容だけを読む | `git show 6ea9156…:<Path>` で読んだ | PASS |

- 本計画は `origin/main` `f0d68cadf389669759f51be432108a1c867bb0b9`（T-3 DONE 統合後）起点の `claude/character-vis-001-t4-planner` で作成した

#### Objective
T-2 / T-3 で確定した 5.0頭身・体格・関節を土台に、**頭部・顔の見せ方・被り物・服装の形・身体の外形**でキャラクター性を作り、ゲームカメラ距離でも「誰か」「どの職業か」が武器に頼らず読めるようにする。「可愛さ」は Planner が定義・数値化しない。最終判断は Human の目視（V-1）

#### Scope / Non-Scope
| Scope（T-4） | Non-Scope |
| --- | --- |
| 頭部周りの直値・絶対値の比率修正（旧 T-4 Step 1〜2）と戦騎士 0.86 の再調整（D-8、旧 Step 3） | Material・色・質感・マット化（T-5） |
| 顔の見せ方（マスク・面頬の扱い） | BUILD の体格値（T-2）、関節球・Pauldron（T-3）、骨盤構造 |
| 髪・被り物・頭部装飾の形状 | T-1 の歩行、STANCE / STANCE_ALT / CLIPS、移動速度、攻撃・判定 |
| 服装 Geometry（リバイバルファッション候補の形状）と配置 | 武器の形状・寸法・攻撃処理 |
| 弓師・盗賊を中心とした身体の外形（衣服の量感、必要なら中間断面の比率） | 支援AI（D-5）、敵・ボス、共有の Lathe 表（`LIMB/TORSO/HEAD_PROFILE`・`PAULDRON_PROFILE`・`CUFF_PROFILE`） |
| 上位職の形状（`applyJobPromotionVisual()` の Geometry） | 新しいキャラクターシステム・衣服シミュレーション・skinning |
| 影の旅人の形状（HDR-T4-7 次第） | サポートキャラの視線（T-7（仮）） |

#### FACT（T-4 analysis と Planner の再確認 ★）
- 顔: 剣士は面頬付きの兜、盗賊は頭巾 + マスクで目も非表示（★`06:1303-1313`）、弓師は帽子 + 口元マスク。表情の手がかりは目の3メッシュだけ
- 被り物の比率: 魔法使いの帽子の円錐は高さ 0.62 m の絶対値（★`05:1647`、headR 比 約 1.76 → 2.58）。剣士の前立ては `hY + 0.28` の直値（★`06:1177`）
- 服: 胴・腕・脚の Loft がそのまま服。衣服として独立した形は魔法使いのローブ・袖、剣士の短いマント・スカーフのみ。材質の差は色だけ
- 頭部の階層: 頭・髪・被り物は `headLookPivot`（waist の子）に付け替えられ、Look Rig で頭と一緒に回る（★`06:1755-1770`）
- 脚の階層: 太腿は股関節ピボット（`legL/R`）、すね以下は膝ピボット（`kneeL/R`）の子。脚の間隔 `stanceW` は 0.095〜0.11、太腿の半幅は 0.085〜0.095（T-2）
- 上位職: `applyJobPromotionVisual()`（★`06:1967-`）が基礎の装飾を隠して差し替える
- 見下ろし固定カメラで、顔の細部はゲームカメラ距離では読めない（T-2 / T-3 の撮影記録）

#### INFERENCE（キャラクター性が弱く見える構造上の原因。T-4 analysis I-1〜I-6）
- 顔が隠れ、頭部が「被り物の塊」として読まれる
- 被り物の比率が旧頭身前提のまま崩れている
- 服が体の外形そのもので、細身化により「塗り分けた人形」に見える（弓師・盗賊で強い）
- 判別が武器・被り物・色に依存している

#### DESIGN OPTION（候補。採用は Human。既存コードで実現しやすい案を中心に各3案）
**共通の作り方（実現性の根拠）**: 衣服は既存の Loft（`makeLoft` / `makeCharacter*()` と同じ断面方式）で作り、動く部位の子にする。上着・ストールは waist（胴と一緒に動く）、パンツは太腿の部分を股関節ピボット・すねの部分を膝ピボット（膝で曲がる）、フードの頭部側は `headLookPivot`・背中側は waist、ブーツは膝ピボット（接地の式を保つ）

| 職 | 案 A | 案 B | 案 C（控えめ） |
| --- | --- | --- | --- |
| 剣士（4人で最もしっかり。騎士） | 短丈上着（胸〜ベルト上の前開きジャケット形状）+ 中世風ロングブーツ（筒型）+ 既存スカーフを大判ストール化 | レイヤード（胴の外側に膝上丈のサーコート形状）+ 既存兜 | 兜の比率・前立ての修正 + ブーツ形状のみ |
| 魔法使い（縦長。「分かっているつもりだった人」） | ローブを維持し、パーカー的フード（背中に下ろした形）+ 大判ストール | ローブの裾を短くしワイドパンツ + 短丈ケープ（ローブ形状の再構成） | ローブ維持 + 大判ストール + 帽子の比率修正 |
| 弓師（軽快。「どこにも属さなかった人」） | ワイドパンツ + 短丈上着 | ワイドパンツ + 大判ストール | 細身パンツ + レイヤード（丈違いの上着） |
| 盗賊（小柄・身軽。過去を後悔する元盗賊） | パーカー的フード（既存頭巾をフード形状へ、マスク無し）+ 裾を絞ったワイドパンツ | パーカー的フード + 短丈上着 + 細身パンツ | 大判ストール（口元まで覆うスヌード形状でマスクを置き換え）+ ワイドパンツ |
| 共通の小物 | ベルト・ポーチ・留め具を BUILD / HIP_Y 由来の位置で配置（アクセサリー的） | 既存の小物のみ維持 | ― |

- 各案の形状の具体寸法は、Human が案を選んだ後に Implementer が BUILD / headR 由来の式で作り、V-1 で Human が確認する
- 色・素材感はすべて T-5。T-4 の衣服は**既存の Material インスタンス**（`clothMat` / `clothMatFlat` / `trimMat` など）を仮に割り当て、Material の値は変更しない

**顔の見せ方（DESIGN OPTION）**: F-a 現状維持（マスク・面頬を残す）/ F-b 弓師・盗賊のマスクを外して目を見せ、剣士の面頬は維持 / F-c 全員の顔を出す（剣士は開いた兜へ）

**被り物の比率（DESIGN OPTION）**: H-a 絶対値・直値を headR 比へ直し、旧頭身での見た目の比率に戻す（例: 帽子の円錐 高さ = headR × 1.76、前立て = headR 比）/ H-b 5.0頭身での新しい比率を Human が V-1 で決める / H-c 現状の大きさを意図として残す

**身体シルエットの変更方法（DESIGN OPTION）**: S-a 衣服の量感で外形を作る（BUILD と断面比率は変えない）/ S-b キャラクター別の中間断面比率（`*_SECTION_RATIOS` を系列ごとに持たせる。DEC-T3-4 で T-4 へ送った領域）/ S-c 両方

#### 上位職・影の旅人の扱い（DESIGN OPTION）
- 上位職: P-a 基礎職の衣服を継承し、既存の差し替え（戦騎士の兜・肩鎧、バーサーカーの毛皮など）を新しい衣服に合わせて形状調整 / P-b 上位職ごとに衣服の形を変える。戦騎士 0.86（D-8）は新しい頭部に合わせて再調整（旧 T-4 Step 3）
- 影の旅人: W-a 剣士の衣服を使う（色は T-5）/ W-b 独自の形状（`docs/CHARACTERS.md` の「黒ずくめ・影だまり」を形状に反映するが、新しい設定を足すことになる）

#### 武器なしでの識別・ゲームカメラ距離での視認性
- 遠距離で効く要素（INFERENCE）: 頭部の外形（被り物・髪の輪郭）、肩の形（ストール・上着の肩線）、腰〜裾の広がり（上着の丈・パンツ・ローブ）、背中の輪郭（フード・矢筒・大剣）
- 各案は、これらのうち少なくとも「頭部の外形」「腰〜裾」の2つで4人が異なる形になるよう組み合わせる（Human が案を選ぶときの比較軸として提示）

#### 干渉リスク
| # | 干渉 | 内容 | 対応（計画） |
| --- | --- | --- | --- |
| P-R25 | 衣服 × 歩行 | ワイドパンツは左右の脚が近い（`stanceW` 0.095〜0.11 に対し太腿の半幅 0.085〜0.095）ため、内側へ広げると左右の裾が重なる。外側・前後へ広げる非対称の断面が要る | 内側の幅は `stanceW` を超えない制約で形状を作る。V-1 の歩行で確認 |
| P-R26 | 衣服 × 構え・攻撃（CLIPS） | 上着・ストールは waist の子で腕とは別に動く。腕を大きく振るクリップで貫通の可能性 | STANCE / CLIPS は変えない。停止・歩行・構え・攻撃の V-1 で確認し、形状（丈・厚み）で逃がす |
| P-R27 | 衣服 × Look Rig | 頭部側の被り物は頭と一緒に最大 ±38° 回る。背中に垂れるフードを頭の子にすると胴に対して回る | フードは頭部側と背中側を分け、背中側は waist の子にする |
| P-R28 | 衣服 × 武器収納 | 背中の大剣（剣士・戦騎士）・弓（弓師・鷹の目）とフード・ストール・上着、腰の短剣（盗賊・バーサーカー）とワイドパンツ・短丈上着が重なる可能性 | 収納位置の補正が必要になった場合は `WEAPON_SOCKET` の `off` の調整だけを許す（HDR-T4-13）。武器の形状は変えない |
| P-R29 | 衣服 × 上位職の差し替え | 上位職が基礎の装飾を隠す前提（`visible=false`）に、新しい衣服の参照を加える必要 | `applyJobPromotionVisual()` で衣服の表示 / 非表示を明示 |
| P-R30 | 顔を出す変更 | 過去の Head / Helm 調整フェーズの判断（`05:796-935`）を覆す | HDR-T4-2 で Human が決める |
| P-R31 | Material | 新しい衣服に Material が要るが、値は T-5 | 既存インスタンスの流用のみ。値の変更は差分チェックで検出 |

#### Implementation Steps（HDR の選択に従う）
| Step | 内容 | ファイル |
| --- | --- | --- |
| 0 | V-1 の基準撮影（T-3 後の状態。4基本職・上位職4種・影の旅人 × 停止 / 歩行 / 構え / 攻撃 × 正面 / 斜め45° / 側面相当）。コード変更なし | リポジトリ外 |
| 1 | 頭部周りの直値・絶対値の比率修正（HDR-T4-3）と戦騎士 0.86 の再調整（D-8） | `06` 頭部・被り物、`05` 被り物の定数・Coverage |
| 2 | 顔の見せ方（HDR-T4-2）: マスク・面頬・`faceMeshes` の表示 | `06`、`05`（兜の開口を変える場合） |
| 3 | 髪・被り物の形状（選んだ案のフード等） | `06`、`05`（`makeRogueHood` 等の生成関数・定数、髪シェル） |
| 4 | 服装 Geometry（選んだ案の上着・ストール・パンツ・ブーツ・小物）。Loft で作り、上の「共通の作り方」の親へ付ける | `06` `buildPlayer()`、`05`（衣服用の Loft 生成を足す場合） |
| 5 | 身体シルエット（HDR-T4-4 = S-b / S-c の場合のみ、キャラクター別の中間断面比率） | `05` `*_SECTION_RATIOS`、`tests/unit/lowpoly-primitives.test.js`（複製の同期） |
| 6 | 上位職・影の旅人の形状（HDR-T4-7） | `06` `applyJobPromotionVisual()` |
| 7 | 武器収納の干渉があった職だけ `WEAPON_SOCKET` の `off` を補正（HDR-T4-13 が許す場合） | `05` `WEAPON_SOCKET` |
| 8 | V-1（下）。Human の確認で形状を調整 | リポジトリ外 |

- 実施順（提案、HDR-T4-12）: 1 → 2 → 3 を全員で行い、4〜5 は **1キャラクターを先行（パイロット）** して Human が方向性を確認してから残り3人へ広げる

#### Files To Change（再計画版）
| ファイル | 内容 | 条件 |
| --- | --- | --- |
| `src/legacy/parts/06-player-enemy.js` | `buildPlayer()` の頭部・顔・髪・被り物・衣服・小物、`applyJobPromotionVisual()` の形状 | 常に |
| `src/legacy/parts/05-rendering-rig.js` | 被り物の生成関数と定数・`HEAD_*`・Coverage、衣服用の Loft 生成（必要な場合）、キャラクター別の中間断面比率（S-b / S-c の場合）、`WEAPON_SOCKET` の `off`（HDR-T4-13 の場合） | 条件付き |
| `src/legacy/parts/01-character-creation.js` | `classDef` の見た目専用フィールド（形状の選択を持たせる場合のみ。色は T-5） | HDR 次第 |
| `tests/unit/lowpoly-primitives.test.js` | 断面比率を変えた場合の複製の同期 | S-b / S-c の場合 |
| `tests/character-motion.spec.js` | 衣服・被り物の構築の回帰（HDR-T4-14 で追加する場合） | HDR 次第 |
| `docs/CHARACTERS.md` | 外見の仕様の記述（HDR-T4-10） | HDR 次第 |
| Task file | Implementation Result・Status・Status History | 常に |

変更しない: `13-update-loop.js`、STANCE / STANCE_ALT / CLIPS、BUILD の体格値、関節球・Pauldron（T-3）、骨盤構造、Material の値（color / roughness / metalness / emissive / bump、`textures.js`）、`outlineMats()`、敵・ボス・支援AI、共有の Lathe 表、`playwright.config.js`

#### Test Plan（再計画版）
| 区分 | 対象 | 確認 |
| --- | --- | --- |
| Build / Unit | `npm run build`、`npm run test:unit` | PASS。断面比率を変えた場合は複製の同期 |
| E2E 既存 | `character-motion`（T-1 E-1、T-2 E-2 を含む）、`weapon-stow`、`battle-knight-visual`、`base-class-identity` / `comparison`、`combat-test-arena`、`guest-companion`、`save-load` | 回帰。T-2 E-2（頭身・手とベルト・肩 / 腰の幅の比）は BUILD 由来なので衣服で変わらないこと |
| E2E 追加（任意） | 衣服・被り物のメッシュが4人 + 上位職で構築され、コンソールエラーが無い | HDR-T4-14 |
| Material 不変の確認 | `git diff` で Material の値（color / roughness / metalness / emissive / bumpScale）の追加・変更が無いこと | Review の確認項目 |
| Full Regression | `npm test` 全体 | 推奨（Chromium 不一致の環境ではリポジトリ外の回避策、不可なら NOT_RUN） |
| 目視 V-1（T-4） | 下の V-1 | **Human が確認（Acceptance の中心）** |

**V-1（T-4）**: Step 0 と同じセットで変更前後を並べる。加えて HDR-T4-6 が「含める」なら、武器を収納した状態（非戦闘）での識別も確認する
| # | 確認（Human） |
| --- | --- |
| V-1-T4a | 5.0頭身でもキャラクター性が失われていない（T-2 V-1m） |
| V-1-T4b | 細身でも棒状・人形状に見えない（V-1n。弓師・盗賊を中心に） |
| V-1-T4c | 頭部が単純な無機質な塊に見えない（V-1o） |
| V-1-T4d | 職業ごとのシルエットが明確で、ゲームカメラ距離でも4職の違いが認識できる（V-1p / V-1q） |
| V-1-T4e | 装備だけでなくキャラクターそのものの違いが感じられる（V-1r） |
| V-1-T4f | 「可愛さ」は数値化せず Human の目視で判断する（V-1s） |
| V-1-T4g | 歩行・構え・攻撃で衣服が脚・腕・武器と目立って貫通しない（P-R25〜R28） |
| V-1-T4h | 上位職・影の旅人の形状に破綻が無い |

#### Acceptance Criteria（再計画版）
- **主: V-1-T4a〜h を Human が目視で許容する**（数値だけでは合格としない）
- Human が選んだデザイン案（HDR-T4-2〜7・9〜15）どおりに形状が作られている
- Material の値の追加・変更が無い（T-5 の範囲）。新しい衣服は既存の Material インスタンスを流用
- BUILD の体格値・関節球・Pauldron・骨盤・T-1 の歩行・STANCE / CLIPS・移動速度に差分なし
- 既存の unit・build・関連 E2E が PASS（T-1 E-1、T-2 E-2 を含む）。Files To Change 以外に差分なし

#### Human Decision Required（T-4 再計画版。Planner は決めない）
| # | 論点 | 選択肢 | Planner の推奨候補（提案） |
| --- | --- | --- | --- |
| HDR-T4-2 | 顔の見せ方 | F-a / F-b / F-c | F-b（弓師・盗賊の顔を出し、剣士の兜は騎士の記号として残す） |
| HDR-T4-3 | 被り物の比率 | H-a / H-b / H-c | H-a を初期値にして V-1 で調整 |
| HDR-T4-4 | 身体シルエットの手段 | S-a / S-b / S-c | S-a（BUILD と断面比率を変えずに済む）。不足なら S-c |
| HDR-T4-5 | 4職のデザイン案 | 各職 案 A / B / C（上の表） | 剣士 A・魔法使い C・弓師 A・盗賊 A（頭部外形と腰〜裾の2軸で4人が分かれる組み合わせ） |
| HDR-T4-6 | 武器を収納した状態での識別を Acceptance に入れるか | 入れる / 入れない | 入れる（非戦闘の収納状態で確認。装備を外す機能は新規になるため作らない） |
| HDR-T4-7 | 上位職・影の旅人 | P-a / P-b、W-a / W-b | P-a、W-a |
| HDR-T4-9 | デザインの参照 | Human がラフ・参考画像を追加する / 本計画の案から選ぶ | 本計画の案から選び、パイロットの V-1 で調整 |
| HDR-T4-10 | `docs/CHARACTERS.md` の更新（外見の仕様、影の旅人の記述の食い違い） | 本 T-4 で外見の記述を追加 / 別 Task | 外見の記述は T-4 の最後に追加。影の旅人の食い違いは別 Task |
| HDR-T4-11 | T-4 の分割 | 1つの Work Item のまま / 頭部（Step 1〜3）と服装（Step 4〜6）で分ける | 分ける（承認・レビューの単位を小さくする。例: T-4a 頭部、T-4b 服装） |
| HDR-T4-12 | 実施順 | 全員同時 / パイロット（1キャラクター先行） | パイロット（弓師か盗賊。棒状の問題が最も大きい） |
| HDR-T4-13 | 武器収納の補正を T-4 に含めるか | 含める（`off` のみ）/ 含めない | 含める（衣服との干渉の直接の帰結。武器の形状は変えない） |
| HDR-T4-14 | 衣服の構築の E2E を追加するか | 追加 / 追加しない | 追加（構築とコンソールエラーの回帰のみ。見た目は V-1） |
| HDR-T4-15 | 顔の造形の追加（眉・口など） | 追加しない / 追加する | 追加しない（ゲームカメラ距離では効果が小さい。必要なら V-1 後に検討） |

#### Human Decision（確定、デザイン。ユーザー（人間）/ 2026-09-25 / Claude Code セッションの会話。記入: Planner（人間の指示による））
上の「Human Decision Required」表の推奨候補ではなく、**Human が確定した決定**。デザインは T-4 の初期実装案で、V-1 の目視確認による形状調整を許容する。

| # | 決定 |
| --- | --- |
| HDR-T4-2 | **F-b**: 弓師・盗賊は顔を見せる。剣士の兜は残す。顔の造形を新規に足すのではなく、既存の頭部・髪・被り物の形状調整で顔の見え方を改善する |
| HDR-T4-3 | **H-a**: 被り物の比率を headR 比に合わせて修正する（例: 魔法使いの帽子の円錐の高さ、剣士の前立て）。最終判断は V-1 の目視 |
| HDR-T4-4 | **S-a**: 体の外形の改善は衣服の量感を中心に行う。BUILD の体格値は変更しない。S-b / S-c（中間断面比率の変更）は今回行わない → **Step 5 は不実施** |
| HDR-T4-5 | 初期デザイン案: **剣士 A**（短丈上着 + ロングブーツ + スカーフを大判ストール化）/ **魔法使い C**（ローブ + 大判ストール + 帽子の比率修正）/ **弓師 A**（ワイドパンツ + 短丈上着）/ **盗賊 A**（既存の頭巾をパーカー的フードに変更（マスク無し）+ 裾を絞ったワイドパンツ）。V-1 の目視で必要な形状調整を許容 |
| HDR-T4-6 | 武器を収納した状態（非戦闘）でもキャラクター識別性を確認し、Acceptance Criteria に含める |
| HDR-T4-7 | 上位職は **P-a**（基礎職の衣服形状を継承し、既存の上位職差し替え形状を調整。戦騎士の頭 0.86 も再調整）。影の旅人は **W-a**（剣士系の衣服形状を使用。色・Material は T-5）。影の旅人の設定上の食い違いは別 Task |
| HDR-T4-9 | デザイン参照は本 Task file の案を使う。承認した初期案をパイロットで実装し、目視結果に応じて形状を調整する。外部デザイン資料は必須としない |
| HDR-T4-10 | `docs/CHARACTERS.md` の外見の記述は T-4 の最後に追加する。影の旅人の設定上の食い違いは別 Task とし、今回は修正しない |
| HDR-T4-11 | **T-4 は分割しない**。頭部と服装を同一の T-4 Work Item で扱う（理由: 目的は頭部単体ではなく、頭部・服装・腰〜裾のシルエットを含めたキャラクター性の改善で、分けると目視調整の往復が増える） |
| HDR-T4-12 | **弓師を先行パイロット**とする。弓師 A（ワイドパンツ + 短丈上着）を最初に実装し、形状・シルエット・可愛さ・カメラ距離での識別性を Human が確認する。問題がなければ同じ原則を他職へ展開する |
| HDR-T4-13 | 武器収納の補正を含める。ただし非戦闘（収納状態）の収納位置の調整（`WEAPON_SOCKET` の `off`）のみ。武器システムそのもの、攻撃中の武器位置、武器のロジックは変更しない |
| HDR-T4-14 | 衣服が4基礎職と上位職で正常に構築されることを確認する E2E を追加する |
| HDR-T4-15 | 眉・口などの新しい顔の造形は追加しない |

**確定後の実施順**: Step 0（基準撮影）→ **弓師パイロット**（弓師の Step 1〜4・7 → V-1 で Human 確認）→ 残り3職（剣士・魔法使い・盗賊）の Step 1〜4・7 → Step 6（上位職・影の旅人）→ V-1（全体）→ `docs/CHARACTERS.md` の外見記述（最後）。Step 5 は不実施

**Files To Change（確定版）**
| ファイル | 内容 |
| --- | --- |
| `src/legacy/parts/06-player-enemy.js` | `buildPlayer()` の頭部・顔の見え方（マスクの扱い）・髪・被り物・衣服（上着・ストール・パンツ・ブーツ・フード）・小物、`applyJobPromotionVisual()` の形状（戦騎士 0.86 を含む） |
| `src/legacy/parts/05-rendering-rig.js` | 被り物の生成関数と定数（headR 比化）・`HEAD_*`・Coverage、衣服用の Loft 生成（必要な場合）、`WEAPON_SOCKET` の `off`（収納状態の補正のみ） |
| `tests/character-motion.spec.js`（または新しい spec） | 衣服が4基礎職・上位職で構築され、コンソールエラーが無いことの E2E（HDR-T4-14） |
| `docs/CHARACTERS.md` | 外見の記述（T-4 の最後、HDR-T4-10）。影の旅人の食い違いは修正しない |
| Task file | Implementation Result・Status・Status History |

- `src/legacy/parts/01-character-creation.js` は形状の選択を `classDef` に持たせる必要が生じた場合のみ（色は T-5 のため変えない）。`tests/unit/lowpoly-primitives.test.js` は変更しない（S-a のため断面比率を変えない）

**実装上の固定条件（変更禁止）**: BUILD の体格値 / T-1 で確定した歩行・STANCE / CLIPS / T-3 で確定した関節球 / T-3 で確定した Pauldron / 骨盤 / Material の値 / 輪郭線 / 敵 / ボス / 支援AI / 共有の Lathe 表 / `13-update-loop.js`。Existing System First を維持し、新しい衣服システムは作らない。既存の Loft と既存の可動部（waist・肩・股関節・膝・`headLookPivot`）への取り付けで作る

**Test Plan（確定版の差分）**: 上の Test Plan のうち「E2E 追加（任意）」は **必須**（HDR-T4-14）。断面比率の複製の同期は対象外（S-a）。V-1 は弓師パイロットの時点と全体の完了時の2回

**Acceptance Criteria（確定版の差分）**: 上の Acceptance Criteria に次を加える
- 武器を収納した状態（非戦闘）でも4職のキャラクターが識別できることを Human が目視で許容する（HDR-T4-6）
- 衣服の構築 E2E が4基礎職・上位職で PASS（HDR-T4-14）
- 顔の造形（眉・口など）の追加が無い（HDR-T4-15）。弓師・盗賊の顔は既存の頭部・髪・被り物の形状調整で見える（HDR-T4-2）
- 中間断面比率・BUILD の体格値に差分なし（HDR-T4-4）

#### T-5 との境界（HDR-T4-8、確定）
- T-4: 頭部形状・髪・フード・パーカー的形状・大判ストール・ワイドパンツ・短丈上着・ブーツ形状・レイヤード・職業固有の服装形状・上位職の形状
- T-5: 色・Material・マット感・質感・共通 Material 値・上位職装飾の Material 調整
- T-4 は Geometry / 形状 / シルエット / 配置 / 衣服の構築を扱い、Material の値を決めない（新しい衣服は既存の Material インスタンスを流用するだけ）。T-5 は色 / Material / 質感 / マット化 / 共通 Material 値を扱い、T-4 の Geometry を変えない。T-5 は T-4 で追加された衣服も対象に含めるよう、将来の T-5 Planner で対象範囲を更新する

#### Risks（再計画版で追加）
P-R25〜P-R31（上の干渉リスク）に加えて:
- P-R32: 「可愛さ」は Human の目視でしか判定できず、V-1 の往復が増える（パイロットで緩和）
- P-R33: 変更量が大きい（4職 × 頭部・衣服、上位職、影の旅人）。1つの承認単位ではレビューが重い（HDR-T4-11）
- P-R34: 顔を出す場合、被り物の開口・Coverage・髪の干渉の再調整が要る

#### Artifact Handoff（本計画の引き渡し）
- 本 Task file は `claude/character-vis-001-t4-planner`（起点 `origin/main` `f0d68ca`）上で未 commit。Planner は commit / push しない
- Human が Persistence し、再計画版の Human Approval・HDR の選択・Persistence 先を記入した承認済み版で Plan Handoff（Kind `plan`、`CHARACTER-VIS-001 / T-4`）を Implementer へ渡す

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
| 2026-09-25 | T-2 | WAITING_APPROVAL → APPROVED | Planner（人間の指示による記入） | ユーザー（人間）が「T-2第3版を承認、Persistenceは claude/character-vis-001-t2-v3-impl」と指示 |
| 2026-09-25 | T-2 | APPROVED → IMPLEMENTING | Implementer | 第3版。Plan Handoff（Kind `plan`、`f3f9bd5c77ecd906fc82ea5f01de2eba38486bd6`、blob `43826c33…`）確認。起点 `origin/main` `f3f9bd5` |
| 2026-09-25 | T-2 | IMPLEMENTING → TESTING | Implementer | 実装 commit `2044a6e7eadf27f1cbfd4f705e7f0eedc373fc3f`。unit / build / 関連 E2E、V-1 用スクリーンショット |
| 2026-09-25 | T-2 | TESTING → REVIEWING | Implementer | FAIL なし。V-1 Human 確認の Decision（5.0頭身維持、キャラクター性は T-4）。Branch `claude/character-vis-001-t2-v3-impl` |
| 2026-09-25 | T-2 | REVIEWING → DONE | Reviewer | `.ai/reports/CHARACTER-VIS-001-T2-review.md` PASS（Reviewed SHA `fa3436449a863da0bb56c014edbde33b99832e79`、同一セッションで兼務）。Task Level は T-3〜T-5 未完了のため PLANNED のまま |
| 2026-09-25 | T-3 | APPROVED → WAITING_APPROVAL | Planner | T-3 Artifact Handoff（Kind `analysis`、`b6858b11d0739b16d08faa549b2868b91f233ab8`、blob `d2fdc21d…`）H-1〜H-8 PASS。DEC-T3-1 / DEC-T3-2 = (a)（Human）により T-2 第3版基準で再計画。DEC-T3-3〜7 を提示。承認の取り直し（§6）。旧版の承認記録は残す。本ファイルは `origin/main` `b6858b1` 起点の `claude/character-vis-001-t3-planner` 上で未 commit |
| 2026-09-25 | T-3 | WAITING_APPROVAL → APPROVED | Planner（人間の指示による記入） | ユーザー（人間）が T-3 再計画版を承認し、DEC-T3-3〜7 を確定（DEC-T3-3 は Step 0 の Human 目視で Step 3 の実施可否を決める）。実装用 Persistence は未許可 |
| 2026-09-25 | T-3 | APPROVED → IMPLEMENTING | Implementer | Plan Handoff（Kind `plan`、`33a67172ec88d5457e4a4b59a18b7eb318996d7b`、blob `fea9a995…`）H-1〜H-8 PASS。起点 `origin/main` `b6858b1`。Persistence `claude/character-vis-001-t3-impl`（Human 指示） |
| 2026-09-25 | T-3 | IMPLEMENTING → TESTING | Implementer | Step 0 撮影 → DEC-T3-3 = B（Human）。Step 1・2 実装、Step 3 不実施、Step 4 不実施 |
| 2026-09-25 | T-3 | TESTING → REVIEWING | Implementer | FAIL なし。Branch `claude/character-vis-001-t3-impl` |
| 2026-09-25 | T-3 | REVIEWING → DONE | Reviewer | `.ai/reports/CHARACTER-VIS-001-T3-review.md` PASS（Reviewed SHA `1cbf31534d6d3f98026cc7c6f829a70af9096b13`、同一セッションで兼務）。主 Acceptance は Human が変更後の画像で許容・k = 1.02 確定。Task Level は T-4 / T-5 未完了のため PLANNED のまま |
| 2026-09-25 | T-4 | APPROVED → WAITING_APPROVAL | Planner | T-4 Artifact Handoff（Kind `analysis`、`6ea91565d255849aaee1134666da04256543f00c`、blob `f1571338…`）H-1〜H-8 PASS。HDR-T4-1 / HDR-T4-8（Human）により範囲を再計画（キャラクター性・服装・シルエットまで）。デザイン候補と HDR-T4-2〜7・9〜15 を提示。承認の取り直し（§6）。旧版の承認記録は残す。本ファイルは `origin/main` `f0d68ca` 起点の `claude/character-vis-001-t4-planner` 上で未 commit |
| 2026-09-25 | T-4 | WAITING_APPROVAL → APPROVED | Planner（人間の指示による記入） | ユーザー（人間）が T-4 再計画版（Approved Task Blob `190976e7…`）を正式に承認。実装用 Persistence は未許可 |
| 2026-09-25 | T-4 | APPROVED（変更なし） | Implementer（人間の指示による記入） | **Human Decision（弓師パイロットの V-1 Human Acceptance）**: ユーザー（人間）が「弓師とてもよくなった」と判断し、弓師パイロットを承認、残り3職への展開を承認（詳細は Implementation Result（T-4、途中）の「弓師パイロットの V-1 Human Decision」）。T-4 全体の DONE ではない。関連 E2E は `character-motion.spec.js:394` が FLAKY。パイロットのコードは未 commit |
| 2026-09-25 | T-4 | APPROVED（変更なし） | Implementer（人間の指示による記入） | **Human Decision（盗賊 A のデザイン変更）**: ユーザー（人間）が「盗賊Aをオーバーオール案に変更」と指示。HDR-T4-5 の盗賊 A を「パーカー的フード + 裾を絞ったワイドパンツ」から「パーカー的フード + オーバーオール」へ変更（詳細は Implementation Result（T-4、途中）の「盗賊 A のデザイン変更」）。既存の HDR-T4-5 の行は書き換えていない |
| 2026-09-25 | T-4 | APPROVED（変更なし） | Implementer（人間の指示による記入） | **Human Decision（魔法使い C のデザイン変更・unit テスト更新・変更対象ファイル追加）**: 詳細は Implementation Result（T-4、途中）の「魔法使い C のデザイン変更（Human Decision）」。T-4 全体の DONE・V-1 承認ではない |
| 2026-09-25 | T-4 | APPROVED（変更なし） | Implementer（人間の指示による記入） | **Human Decision（剣士 A のデザイン変更・HDR-T4-2 の剣士の変更）**: 詳細は Implementation Result（T-4、途中）の「剣士 A のデザイン変更（Human Decision）」。T-4 全体の DONE・V-1 承認ではない |
| 2026-09-25 | T-4 | APPROVED（変更なし） | Implementer（人間の指示による記入） | **Human Decision（剣士 A の V-1 Human Acceptance）**: ユーザー（人間）が剣士の現代テック系リメイクを「この見た目でokです」と判断。T-4 全体の DONE・全体 V-1 ではない。コードは未 commit |
| 2026-09-25 | T-4 | APPROVED（変更なし） | Implementer（人間の指示による記入） | **Human Decision（Step 6: 上位4職 + 影の旅人のリニューアル、色の T-4 先行、影の旅人の武器の非表示、背中の剣の向き）**: 詳細は Implementation Result（T-4、途中）の「Step 6: 上位4職 + 影の旅人（Human Decision）」。V-1 は未承認 |
| 2026-09-25 | T-4 | APPROVED（変更なし） | Implementer（人間の指示による記入） | **Human Decision（上位4職の V-1 Human Acceptance、影の旅人・全キャラの顔の指摘）**: 詳細は「Step 6: 上位4職 + 影の旅人（Human Decision）」末尾。T-4 全体の DONE ではない |
| 2026-09-25 | T-4 | APPROVED（変更なし） | Implementer（人間の指示による記入） | **Human Decision（影の旅人の髪・目の大きさと間隔の承認、目をより可愛く、職ごとの肌色）**: 詳細は「Step 6: 上位4職 + 影の旅人（Human Decision）」末尾 |
| 2026-09-26 | T-4 | APPROVED（変更なし） | Implementer（人間の指示による記入） | **Human Decision（T-5 より先に T-4 を完了させる、HDR-T4-14 の検証方法と変更対象ファイルの追加）**: 詳細は Implementation Result（T-4、途中）の「T-4 の仕上げ（HDR-T4-14・HDR-T4-10）」 |
| 2026-09-26 | T-4 | APPROVED → IMPLEMENTING | Implementer | 記録: 実装は 2026-09-25 から `claude/character-vis-001-t4-impl`（起点 `e07c6d4`、Implementation Persistence）で実施。Human の指示で、全体完了まで Status を APPROVED のまま据え置いていた（上の各 Human Decision の行を参照）。Plan は承認済み Task file（Approved Task Blob `3526f842…`）|
| 2026-09-26 | T-4 | IMPLEMENTING → TESTING | Implementer | 全職の実装・Step 6・HDR-T4-14・docs 完了、T-4 全体の V-1 を Human が許容（「完了で良いです」）。build / unit / 関連 E2E を実行 |
| 2026-09-26 | T-4 | TESTING → REVIEWING | Implementer | FAIL なし（関連 E2E 60 件 = 59 PASS / 1 FLAKY、unit 1510 / 1510、build PASS。Test Report は Implementation Result（T-4）の「T-4 最終 Test Report」）。Human の指示「E2E完了したらcommit/pushしてREVIEWINGへ進めて」。Branch `claude/character-vis-001-t4-impl` |
| 2026-09-26 | T-4 | REVIEWING → DONE | Reviewer | `.ai/reports/CHARACTER-VIS-001-T4-review.md` PASS（Reviewed SHA `737da5fabecc230fb2dd0ec78274f6756ca12297`、同一セッションで兼務）。主 Acceptance は Human が最終コードの9キャラクターで許容（「完了で良いです」）。Task Level は T-5 未完了のため PLANNED のまま |
| 2026-09-26 | T-5 | APPROVED → IMPLEMENTING | Implementer | 再計画版の Human Approval（HDR-T5-1〜12、P-D0〜11）と Persistence（`claude/character-vis-001-t5-impl`、起点 `7ea0170`）。V-1 第1段階（基礎4職）まで実装 |

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

## Implementation Result（T-2 第3版）

T-2 第3版のみ。第2版の実装（`cde399d`）は採用していない（DEC-T2-12）。T-3 以降・T-7（仮）には着手していない。Implementation SHA は本ファイルに書かない（§5.1）。

### Artifact Handoff
| Kind | Path | Source（branch @ SHA） | Blob SHA | 確認（I-1 / H-1〜H-8） |
| --- | --- | --- | --- | --- |
| `plan` | `.ai/tasks/CHARACTER-VIS-001.md` | `claude/character-vis-001-t2-replan` @ `f3f9bd5c77ecd906fc82ea5f01de2eba38486bd6`（= 実装起点の `origin/main`） | `43826c33db20bd7930e58198bc5cbb619197fe03` | 実装起点で `origin/main` = Source SHA、blob 一致、T-2 = APPROVED、Persistence = `claude/character-vis-001-t2-v3-impl` を確認。本節の追加に伴う変更は T-2 の Status・Status History の行追加・本節、および Human 指示による V-1 Visual Character Check と V-1 確認後の Human Decision の追記（承認済み計画の既存項目は変更していない）。**PASS** |
| `analysis` | `.ai/reports/CHARACTER-VIS-001-T2-analysis.md` | `claude/character-vis-001-t2-analysis` @ `f7f246e2909e3dc63f9c2f0d1b122f0b42a576cd` | `63abdbe139ad273c449dd694071aa3593dd4690f` | main に無いため `git show` で復元し `git hash-object` 一致（I-1）。**PASS** |

- Persistence: Approval 欄（第3版）に `許可（branch: claude/character-vis-001-t2-v3-impl）` と記入済み（T-1・第2版と異なり Approval 欄と一致）
- 実装 commit は `2044a6e7eadf27f1cbfd4f705e7f0eedc373fc3f`（コード・テスト）。本節を含む Task file と analysis report は後続の commit（Implementation SHA）

### Changed Files
| ファイル | 変更 |
| --- | --- |
| `src/legacy/parts/05-rendering-rig.js` | `BUILD` を male / female から4キャラクター系列（`warrior` / `mage` / `archer` / `rogue`）の絶対値の表へ（値は第3版の表どおり。動きの係数は各キャラクターの固定性別の旧値）。`motionRigSnapshot()` に読み取り専用の `motionBodySnapshot()`（頭身・全高・手の Y・ベルト線・肩 / 腰の外幅と全高比・肩幅 / 頭幅）。`WEAPON_SOCKET` は盗賊 x ±0.26 → ±0.172、バーサーカー x ±0.31 → ±0.222 のみ（DEC-T2-11。V-1 の正面で短剣が細い腰から外へ浮いたため。骨盤の表面との位置関係を保つ値。武器・向き・y / z は不変）。旧 `BUILD.male/female` への言及コメントを更新 |
| `src/legacy/parts/06-player-enemy.js` | `buildPlayer()`: `BUILD[classDef.key] \|\| BUILD.warrior`（上位職は系列、影の旅人は剣士）。`checkBuild()`（hipY・全高・首・脚の付け根の整合。外れたら `console.error`、キーごとに1回）。腕長を `B.upperLen` / `B.foreLen`（配置は旧直値と同じ比の式）。骨盤 `B.pelvisH`、Y `HIP_Y − B.pelvisDrop` |
| `src/legacy/parts/13-update-loop.js` | `:1156` の `BUILD.male` → `BUILD.warrior` の1行のみ（T-1 の歩行の式は不変） |
| `src/core/motion-preview.js` | RIG ブロックに `HEADS … STAT …`、`HAND.Y … BELT …`、`SHLD.W … /H … /head …`、`HIP.W … /H …` の4行（欠損は `-`）。T-1 の WALK 行は不変 |
| `tests/unit/motion-preview.test.js` | U-2: 体格の行の整形・欠損時・WALK 行が残ること |
| `tests/character-motion.spec.js` | E-2（第3版）: 4キャラクターで HEADS 5.00 ±0.1、STAT = BUILD の全高 ±0.01、非戦闘の停止で手 ≤ ベルト、肩の外幅 / 全高（剣士 ≤ 0.30、他 ≤ 0.28）、肩幅 / 頭幅 1.26〜1.46、腰の外幅 / 全高 ≤ 0.19、コンソールエラーなし。V-1 用の正面・斜め45°・側面相当のショット（`test-results/`、リポジトリ外） |
| `.ai/tasks/CHARACTER-VIS-001.md` | 上記の Artifact Handoff の範囲 |
| `.ai/reports/CHARACTER-VIS-001-T2-analysis.md` | Source SHA から復元（I-1） |

### Test Report
- Scope: Targeted（Test Plan（第3版）の Unit / E-2 / E2E 既存の行。Full Regression `npm test` 全体は未実行）
- Executed: `npm run test:unit`、`npm run build`、`npx playwright test tests/character-motion.spec.js tests/weapon-stow.spec.js tests/battle-knight-visual.spec.js tests/base-class-identity.spec.js tests/base-class-comparison.spec.js tests/combat-test-arena.spec.js tests/guest-companion.spec.js tests/save-load.spec.js`
- Environment: repo 標準の Playwright 設定は Chromium revision 不一致（要求 1234 / 導入 1194）で起動しない。**リポジトリ外（セッションの scratchpad）** の設定で repo の `playwright.config.js` を読み込み、`executablePath: '/opt/pw-browsers/chromium'` だけ差し替えて実行した。repo の Playwright 設定は変更していない
- Not run: `npm test` 全体（Test Plan では推奨。影響経路の spec は上記で網羅したため Targeted とした）

| テスト | 結果 | メモ |
| --- | --- | --- |
| `npm run test:unit` | PASS | 1507 / 1507 |
| `npm run build` | PASS | 既存の chunk size 警告のみ |
| E-2（第3版、4件） | PASS | 実測: 4人とも HEADS 5.00。剣士 STAT 2.54、手 1.14 / ベルト 1.20、SHLD.W 0.74m /H 0.29 /head 1.46、HIP.W 0.44m /H 0.17（他3人も基準内） |
| 関連 E2E 既存40件 | PASS | character-motion 10（T-1 E-1 を含む）、weapon-stow 10、base-class-identity 9、save-load 6、base-class-comparison 2、battle-knight-visual 1、combat-test-arena 1、guest-companion 1 |
| 合計 E2E | 44 passed | 20.0 分 |
| BUILD の整合検査 | エラーなし | 全 E2E の `watchErrors` で `console.error` 0 件 |

### V-1 Human 確認
- 撮影: 4職 × 非戦闘（収納）/ 武器装備（抜刀・構え）× 正面・斜め45°・側面相当、拡大と実際のゲームカメラ距離（1280×800）。見下ろし固定カメラのため、キャラクターの向きを変えて撮影（リポジトリには含めない）
- Human の結論（2026-09-25）: 5.0頭身は維持。可愛さ・キャラクター性はまだ弱く T-4 で改善する。弓師・盗賊の BUILD 値は T-2 で再変更しない（上の Human Decision）
- Implementer の所見（参考）: 職業は被り物・武器・衣装で判別できる。弓師・盗賊は細い手足で棒状・人形状に近く、被り物（多面体の帽子・頭巾）が無機質な塊に見える懸念。実際のカメラ距離では顔は読めない
- 剣士 / 戦騎士の大剣、弓師 / 鷹の目の背中の武器の収納位置は、画像の解像度では浮きを確認できず変更していない（計算上は体表から 6〜7 cm 離れる見込み。目視確認事項）

### Acceptance Criteria
| AC | 確認方法 | 根拠 |
| --- | --- | --- |
| 4キャラクターとも HEADS 5.0 ±0.1、STAT = stature ±0.01 | VERIFIED | E-2 |
| BUILD が4キャラクターの絶対値の表、整合検査でエラーなし | VERIFIED + FACT (code) | E-2・全 E2E の watchErrors、`05` の表 |
| 非戦闘の停止で手 ≤ ベルト線 | VERIFIED | E-2 |
| 肩 / 腰の外幅の全高比 | VERIFIED | E-2 |
| 骨盤が `B.pelvisH` / `HIP_Y − B.pelvisDrop` 由来 | FACT (code) | `06` |
| 既存 E2E・unit PASS、STANCE / CLIPS / 移動速度 / T-1 の歩行の式に差分なし、Files To Change 以外に差分なし | VERIFIED + FACT (code) | 上表。`git diff f3f9bd5..2044a6e` の変更は Changed Files のみ |
| V-1 Visual Character Check（V-1m〜V-1s） | Human 目視 | 5.0頭身維持を Human が決定。キャラクター性の不足は T-4 へ引き継ぎ（下） |

### T-4 への引き継ぎ（T-2 では実装しない）
- 頭部・髪・被り物のキャラクター性
- 無機質な頭部シルエットの改善
- 弓師・盗賊の身体シルエット / メリハリ
- 各職業固有のシルエット強化
- 5.0頭身を維持したまま可愛さを作る
- 頭部周りの直値の装飾のずれ（例: 剣士の兜飾りが頭頂より上へ出る）
- 盗賊の腰装飾・魔法使いのローブ裾の直値（DEC-T2-8 = (a)）の見た目

### Out of Scope Found
- 上記の T-4 引き継ぎ事項
- 背中の武器の収納位置の浮き（目視確認待ち。必要なら DEC-T2-11 の範囲で別途補正）
- サポートキャラ存在時の視線（T-7（仮））

## Implementation Result（T-3）

T-3（再計画版）のみ。T-4 以降・T-7（仮）には着手していない。Implementation SHA は本ファイルに書かない（§5.1）。

### Artifact Handoff
| Kind | Path | Source（branch @ SHA） | Blob SHA | 確認（I-1 / H-1〜H-8） |
| --- | --- | --- | --- | --- |
| `plan` | `.ai/tasks/CHARACTER-VIS-001.md` | `claude/character-vis-001-t3-planner` @ `33a67172ec88d5457e4a4b59a18b7eb318996d7b` | `fea9a995f479ff385709799e493138c37f56c20f` | H-1 到達可能 / H-2 存在 / H-3 変更は本 Path のみ / H-4 1行目 `# CHARACTER-VIS-001` / H-5 Kind `plan` / H-6 一致 / H-7 T-3 の Kind `plan` の既存記録なし / H-8 `git show` で読んだ。I-1: 実装起点（`origin/main` `b6858b1`）の Task file は旧版だったため、Source SHA から復元し `git hash-object` 一致を確認してから編集。I-3: 変更は T-3 の Status（Work Items 表）・Status History への行追加・本節、および Human 指示による DEC-T3-3 の結果の1行追記（既存の決定行は変更していない）。**PASS** |
| `analysis` | `.ai/reports/CHARACTER-VIS-001-T3-analysis.md` | `main` @ `b6858b11d0739b16d08faa549b2868b91f233ab8` | `d2fdc21d99b475dadfc49e465083f6882d785d71` | 実装起点に既に存在（blob 一致）。**PASS** |

- Persistence: ユーザー（人間）/ 2026-09-25 / Claude Code セッションの会話で「Implementation Branch: claude/character-vis-001-t3-impl」を許可。T-3 Approval 欄（再計画版）の `Persistence:` は I-3 のため空欄のまま（T-1 Review N-2 と同じ扱い）

### Step 0（変更前の撮影）と DEC-T3-3
- 撮影: 剣士・魔法使い・弓師・盗賊・戦騎士・魔導士・鷹の目・バーサーカー・影の旅人 × 停止 / 歩行中 / 戦闘態勢 × 正面 / 斜め45° / 側面相当（キャラクターの向きを変えて撮影、2倍解像度の拡大）。骨盤の確認用に魔法使い・弓師・剣士・盗賊の歩行 3フレーム × 背面 / 斜め45° / 側面相当。画像はリポジトリ外（最初の撮影で右下の壁に隠れたショットは開けた方向で撮り直した。影の旅人の戦闘正面は酒場のカウンターで遮られた）
- **Human 確認結果（2026-09-25）**:
  - 魔法使い・魔導士: ローブにより骨盤自体はほぼ見えない
  - 弓師: ベルトを含む腰回りの接続は自然。歩行3フレームで明確な胴・骨盤の分離は確認されない
  - 剣士: 腰回りの接続は自然
  - 盗賊: 腰装飾は存在するが、骨盤と胴の分離とは見えない
  - 膝・肘: ゲームカメラ距離では球の突出は目立たない
  - 肩: Pauldron は肩の塊として認識できる
  - 戦騎士: 専用の肩鎧のため基礎の Pauldron は視認されない
  - 上位職・影の旅人: 明らかな関節の破綻なし
- DEC-T3-3 = **B**（現状維持）→ **Step 3 不実施**

### Changed Files
| ファイル | 変更 |
| --- | --- |
| `src/legacy/parts/06-player-enemy.js` | Step 1: `JOINT_CAP_K = 1.02` と `jointCapRadius()` を追加。膝球の半径 = `max(thigh·THIGH_SECTION_RATIOS.knee.widthMul, calf·CALF_SECTION_RATIOS.upperCalf.widthMul)·k`（旧 `calf·0.98`）、肘球の半径 = `max(upper·UPPERARM_SECTION_RATIOS.elbow.widthMul, forearm·FOREARM_SECTION_RATIOS.upperForearm.widthMul)·k`（旧 `forearm·1.06`）。比率は 05 の既存の表を参照（値の複製なし）。膝球の scale・材質、肘球の材質は不変。Step 2: Pauldron を `limbGeo(PAULDRON_PROFILE, upper·1.30·s, upper·1.80·s)`（旧 1.52 / 2.1、盗賊 s = 0.6 は維持）。共有の `PAULDRON_PROFILE` の表は不変 |
| `.ai/tasks/CHARACTER-VIS-001.md` | 上記 Artifact Handoff の範囲 |

- Step 3（骨盤の付け替え）: 不実施（DEC-T3-3 = B）。Step 4（断面比率）: 不実施（Step 1・2 後の V-1 で必要性なし。DEC-T3-4 の範囲の変更をしていないため `05-rendering-rig.js`・`tests/unit/lowpoly-primitives.test.js` は変更なし）
- 新しい関節システム・rig・skinning は導入していない

### 値（T-2 第3版の BUILD での算出）
| 項目 | 剣士 | 魔法使い | 弓師 | 盗賊 |
| --- | --- | --- | --- | --- |
| 膝球の半径（旧 → 新） | 0.0735 → 0.0689 | 0.0647 → 0.0607 | 0.0666 → 0.0628 | 0.0647 → 0.0607 |
| 肘球の半径（旧 → 新） | 0.0615 → 0.0592 | 0.0530 → 0.0510 | 0.0551 → 0.0530 | 0.0551 → 0.0530 |
| Pauldron 半径 / 高さ（旧 → 新） | 0.106/0.147 → 0.091/0.126 | 0.088/0.122 → 0.075/0.104 | 0.091/0.126 → 0.078/0.108 | 0.055/0.076 → 0.047/0.065 |
| Pauldron 込みの肩の外幅 / 全高（旧 → 新） | 0.32 → 0.31 | 0.28 → 0.27 | 0.29 → 0.28 | 0.26 → 0.25 |

### Test Report
- Scope: Targeted（Test Plan（再計画版）の Unit / E2E 既存の行。`npm test` 全体は NOT_RUN）
- Executed: `npm run test:unit`、`npm run build`、`npx playwright test tests/character-motion.spec.js tests/weapon-stow.spec.js tests/battle-knight-visual.spec.js tests/base-class-identity.spec.js tests/base-class-comparison.spec.js tests/guest-companion.spec.js`
- Environment: repo 標準の Playwright 設定は Chromium revision 不一致で起動しない。**リポジトリ外（セッションの scratchpad）** の設定で repo の `playwright.config.js` を読み込み `executablePath: '/opt/pw-browsers/chromium'` だけ差し替えて実行。repo の Playwright 設定は変更していない
- Not run: `npm test` 全体（NOT_RUN。所要時間のため。T-3 の影響経路の spec は上記で実行）

| テスト | 結果 | メモ |
| --- | --- | --- |
| `npm run test:unit` | PASS | 1507 / 1507 |
| `npm run build` | PASS | |
| 関連 E2E | 37 passed | character-motion 14（T-1 E-1、T-2 E-2 の4件を含む）、weapon-stow 10、base-class-identity 9、base-class-comparison 2、battle-knight-visual 1、guest-companion 1。16.3 分 |
| `npm test` 全体 | NOT_RUN | 上記 |

### V-1（T-3）
- 変更後の画像を Step 0 と同じ条件（剣士・魔法使い・弓師・盗賊 + 鷹の目・バーサーカー、停止 / 歩行 / 戦闘、正面 / 斜め45° / 側面相当）で撮り、Step 0 と上下に並べた比較をリポジトリ外に用意して Human へ提示した
- Implementer の所見（参考）: 変化は小さく、ゲームカメラ距離で膝・肘・肩の破綻は見当たらない。Pauldron は一回り小さくなった。T-2 の 5.0頭身・体格は E2E（E-2）で不変を確認
- **T-3 の Acceptance（膝・肘・肩・骨盤の接続の Human 目視許容）と最終の k は Human 確認待ち**

### Acceptance Criteria
| AC | 確認方法 | 根拠 |
| --- | --- | --- |
| 膝・肘・肩・骨盤の接続を Human が目視で許容 | Human 目視（待ち） | 比較画像を提示済み |
| 関節球の半径が隣接断面から決まる（k は Human 確認値） | FACT (code) | `jointCapRadius()`、k = 1.02（初期値） |
| DEC-T3-3〜7 のとおりに Step 2〜4 を実施 / 不実施 | FACT (code) | Step 2 実施（1.30 / 1.80、盗賊 0.6）、Step 3 不実施（B）、Step 4 不実施、籠手・脛当て不変 |
| 既存 unit・build・関連 E2E PASS、STANCE / CLIPS / 移動速度 / T-1 の歩行の式 / T-2 の BUILD に差分なし、Files To Change 以外に差分なし | VERIFIED + FACT (code) | 上表。変更は `06-player-enemy.js` と Task file のみ |
| T-4 の範囲を実装していない | FACT (code) | 頭部・髪・被り物・中間断面・上位職装飾・マテリアルに差分なし |

### T-4 への引き継ぎ
- T-2 からの引き継ぎ（頭部・髪・被り物のキャラクター性、無機質な頭部シルエット、弓師・盗賊の身体シルエット / メリハリ、職業固有のシルエット強化、5.0頭身を維持したまま可愛さ、頭部周りの装飾のずれ、盗賊の腰装飾・魔法使いのローブ裾）は継続
- **服装の方針（Human、2026-09-25。T-4 の設計候補。T-3 では実装していない）**: 基本コンセプト「中世ファンタジーを、現代風にリメイクしたようなリバイバルファッション」。現代服をそのまま中世世界へ置くのではなく、中世の素材・構造・シルエットをベースに、現代のカジュアル / ストリートファッション的な感覚を取り入れる。検討例: パーカー的なフード付き衣装、マントとストールの中間のような大判ストール、ワイドパンツ、レイヤード、現代的なシルエットの短丈上着、現代ブーツを想起させる中世風ブーツ、ベルトや小物を現代的なアクセサリー感覚で配置
- T-4 で検討する範囲（Human）: 頭部・髪・被り物、顔周辺のキャラクター性、職業固有シルエット、弓師・盗賊の身体のメリハリ、可愛さ、中世×現代リバイバルファッション、パーカー的フード、大判ストール、ワイドパンツ、レイヤード、装備を外してもキャラクターが判別できる服装。具体的なデザインは T-4 の Analyzer / Planner で改めて整理する

### Out of Scope Found
- 背中の武器（大剣・弓）の収納位置の浮き（T-2 Review N-2、目視確認事項のまま）
- サポートキャラ存在時の視線（T-7（仮））

## Implementation Result（T-4、途中: 弓師パイロットまで）

T-4 は未完了（Status は APPROVED のまま）。本節は弓師パイロットの V-1 Human Decision とテスト結果の記録。Implementation SHA は本ファイルに書かない（§5.1）。

### 状態
| 項目 | 値 |
| --- | --- |
| Implementation branch | `claude/character-vis-001-t4-impl`（remote 先端 `e07c6d4731f71024734116e11ad56f92280aef93` = Implementation Persistence の記録。ローカル HEAD と一致） |
| Persistence | 許可済み（上の T-4 Approval 欄。変更していない） |
| 実施済み | Step 0（基準撮影。T-3 後の撮影をリポジトリ外で再利用）、弓師パイロット（Step 1〜4 の弓師分） |
| 未実施 | Step 7（武器収納の補正）、残り3職（剣士・魔法使い・盗賊）、Step 6（上位職・影の旅人）、HDR-T4-14 の E2E、全体の V-1、`docs/CHARACTERS.md`。Step 5 は不実施（HDR-T4-4） |
| パイロットのコード | 未 commit・未 push（下の Changed Files の2ファイル） |

### 弓師パイロットの変更内容（未 commit）
| ファイル | 内容 |
| --- | --- |
| `src/legacy/parts/05-rendering-rig.js` | 衣服用 Loft 生成 `makeGarmentLoft()` を追加（既存の `makeBodyProfile` / `makeLoft` を使う。共有の表は不変） |
| `src/legacy/parts/06-player-enemy.js` | 弓師のみ: ワイドパンツ（股関節側・膝側の2分割、内側の重なりを避けて外側へずらす。裾は膝から 0.17 下）、短丈上着（胴の上側約4割、waist 配下）、短い袖（肩の可動部、上腕の約6割）、襟の太さを headR 比へ（旧 0.075 → `headR*0.2024`、H-a）、覆面を削除（F-b。顔の造形の追加なし、HDR-T4-15）。Material は既存インスタンスを流用（値の変更なし） |

変更禁止の項目（BUILD の体格値・T-1 の歩行・STANCE / CLIPS・関節球・Pauldron・骨盤・Material の値・輪郭線・敵・ボス・支援AI・共有の Lathe 表・`13-update-loop.js`）に差分なし。

### Test Report（弓師パイロット）
| テスト | 結果（PASS / FAIL / FLAKY / NOT_RUN） | メモ |
| --- | --- | --- |
| `npm run build` | PASS | |
| `npm run test:unit` | PASS | 1507 / 1507 |
| 関連 E2E（`character-motion`・`weapon-stow`・`save-load`・`battle-knight-visual`・`scenario-timer`、29件） | 28 PASS / 1 FLAKY | 下の FLAKY 記録。FLAKY は PASS として数えない（§14） |
| `tests/character-motion.spec.js:394`（剣士(warrior): 非戦闘の移動は休め基準、戦闘態勢の移動は構え基準へ遷移し、態勢が切れると休めへ戻る） | **FLAKY** | 初回 FAIL: `戦闘態勢の移動で WALK が読めない`（`expect(combat).not.toBeNull()`、Received: null、`character-motion.spec.js:431`）。同一テストを1回だけ再実行して PASS。対象変更との関係: FACT (code) パイロットの差分は弓師の分岐（`classDef.key === 'archer'`）と未使用の職には呼ばれないヘルパーのみで、剣士の構築・歩行・STANCE に差分なし。INFERENCE 対象変更とは無関係。**原因は未特定**。変更前コードでの比較は未実施。Review の Risks に残す |
| 撮影用の一時テスト（弓師・鷹の目・剣士・魔法使い・盗賊） | PASS（参考） | V-1 撮影用、コンソールエラーなし。一時 spec は削除済み（リポジトリに残していない） |
| repo 標準設定の E2E | NOT_RUN | 実行環境の問題（Chromium revision 不一致: 要求 1234 / 導入済み 1194）。repo の Playwright 設定は変更していない |
| scratchpad の設定での E2E | 実行 | リポジトリ外の回避策: repo の設定を読み込み `executablePath: '/opt/pw-browsers/chromium'` のみ差し替え（上の E2E はこの方法で実行） |
| HDR-T4-14 の衣服構築 E2E | NOT_RUN | 未追加（残り3職・上位職の実装後に追加する） |
| `npm test` 全体 | NOT_RUN | |

### 弓師パイロットの V-1 Human Decision
**Human Decision（V-1 Human Acceptance、弓師パイロット）**: ユーザー（人間）/ 2026-09-25 / Claude Code セッションの会話で「**弓師とてもよくなった**」。記入: Implementer（人間の指示による）。判断に使った資料: 変更前（Step 0）と変更後の比較画像（弓師・鷹の目 × 停止 / 歩行 / 戦闘 × 正面 / 斜め45° / 側面相当、リポジトリ外）

この判断により、次を承認する（Human の指示どおり）:
| # | 承認内容 |
| --- | --- |
| 1 | ワイドパンツ + 短丈上着のシルエットを弓師 A として承認 |
| 2 | パンツの太さ・裾の高さを現状値で承認 |
| 3 | 上着の丈・袖の長さを現状値で承認 |
| 4 | 覆面の削除と襟の比率変更を承認 |
| 5 | 鷹の目への衣服の継承を現状の方針として承認 |
| 6 | 背中の弓・矢筒と上着の干渉は、現状で大きな問題なしとして承認 |
| 7 | 弓師パイロットの方向性を残り3職（剣士 A・魔法使い C・盗賊 A）へ展開することを承認 |

- これは **弓師パイロットの V-1 承認** であり、T-4 全体の DONE ではない。全体の V-1 は残り3職・Step 6 の後に行う
- 上の T-4 Approval 欄・Human Decision（HDR-T4-2〜15）は変更していない

### 次工程
残り3職（剣士・魔法使い・盗賊）の Step 1〜4・7 へ進める状態。弓師パイロットの変更の commit 時期は Human の指示に従う

### 盗賊 A のデザイン変更（Human Decision）
**Human Decision**: ユーザー（人間）/ 2026-09-25 / Claude Code セッションの会話で「**盗賊Aをオーバーオール案に変更、Human Decisionとして記録して**」。記入: Implementer（人間の指示による）

| 項目 | 旧（HDR-T4-5 の確定時） | 新（本 Human Decision） |
| --- | --- | --- |
| 盗賊 A | パーカー的フード（既存頭巾をフード形状へ、マスク無し）+ 裾を絞ったワイドパンツ | **パーカー的フード（マスク無し）+ オーバーオール** |

新しい盗賊 A の意図（Human の提示）: 顔を見せる / マスク無し / パーカー的フード / 胴から脚まで一体感のあるオーバーオール / ワイド寄りのパンツシルエット / 裾は軽く絞る / 盗賊らしい軽装感を維持 / 武器収納状態でも識別できる / 中世服を現代風にリメイクしたリバイバルファッション / 弓師の「短丈上着 + ワイドパンツ」と明確に差別化する

T-4 の固定条件（Geometry / シルエットのみ、Material の値は変更しない、新しい衣服システムを作らない、`makeGarmentLoft()` と既存の可動部を使う、BUILD・T-1 の歩行・STANCE / CLIPS・関節球・Pauldron・骨盤・共有 Lathe 表・`13-update-loop.js` は変更しない、顔の新規造形なし）は変わらない。

- 上の「Human Decision（確定、デザイン）」表の HDR-T4-5 の行は書き換えていない（本節が変更の記録）
- Implementer の READ ONLY 検討（2026-09-25、会話）での構成案（未確定）: 胸当て（胸の前の薄い板）・腰まわり（胸当ての下〜ベルト下を一周）・前側の肩ベルト2本を waist へ、パンツ（腰〜太もも / 膝下、裾を軽く絞る）を `legL/R` / `kneeL/R` へ。背中の肩ベルト・ポケット・留め具は作らない。寸法は候補値で V-1 の Human 目視で調整

**未決定（Human の判断待ち。本記録では決めていない）**
| # | 論点 |
| --- | --- |
| 1 | 本変更を承認済み計画内のデザイン変更の記録として扱うか、§6 の Human Approval の取り直しとするか（Files To Change 確定版の `06` の「衣服（上着・ストール・パンツ・ブーツ・フード）」にオーバーオールが含まれると読むかを含む） |
| 2 | 未 commit の盗賊実装（マスク削除・背中側のフードの垂れ・裾を絞ったワイドパンツ）の扱い（マスク削除とフードの垂れは継続、パンツはオーバーオールの脚部分へ作り替える想定） |
| 3 | 双剣（`WEAPON_SOCKET.rogue`、waist x ±0.172）との干渉への対応: パンツ上端の横幅を抑えるか、Step 7 で `off` を補正するか（現在のワイドパンツの撮影で、正面から見て右の短剣が太腿の布に埋もれることを確認） |
| 4 | 股の部分の布を作らない（骨盤に触れない）方針でよいか |
| 5 | 肩ベルトを前側だけにする（背中はフードの垂れで隠れる）方針でよいか |

**未決定 1〜5 の確定（Human Decision）**: ユーザー（人間）/ 2026-09-25 / Claude Code セッションの会話で「**未決定1〜5は推奨どおりで確定、オーバーオールを実装して**」。記入: Implementer（人間の指示による）
| # | 確定内容 |
| --- | --- |
| 1 | 承認済み計画内のデザイン変更の記録として扱い、実装する（Human の実装指示による。Implementer の検討は本論点で推奨を明示していなかったため、Human の実装指示をもって確定とした） |
| 2 | マスク削除・背中側のフードの垂れは継続。裾を絞ったワイドパンツはオーバーオールの脚部分へ作り替える |
| 3 | パンツ上端の横幅を抑えて対応する（Step 7 の `off` 補正は実施しない。盗賊 A 実装指示の「Step 7 は今回実施しない」と整合。検討では両案を併記し推奨を明示していなかったため、既存の指示に沿う側を採った） |
| 4 | 股の部分の布は作らない（骨盤に触れない） |
| 5 | 肩ベルトは前側だけ（背中はフードの垂れで隠れる） |

**盗賊 A の修正イメージ（Human Decision）**: ユーザー（人間）/ 2026-09-25 / Claude Code セッションの会話で、修正イメージ画像（「盗賊A：オーバーオール（新デザイン案）フード・頭部・背面・色分け・シルエットの修正イメージ」）を提示し「オーバーオールとカラーの分け方はこのイメージに修正。色はオーバーオールが今の緑系のままで、ベージュのパーカー部は薄紺色、帽子は今の黄色のままでOK」。色の扱いは Implementer の確認に対し「形状は T-4、色は T-5」を選択。記入: Implementer（人間の指示による）
| # | 内容 | 扱い |
| --- | --- | --- |
| 1 | フードは自然な丸み、後ろ側に割れた形状を作らない（うなじの開口なし）、髪と肌が上から突き出さないよう上へ、顔が見える（マスク無し） | T-4（形状）。上の盗賊 A 実装指示の「`makeRogueHood` / `ROGUE_HOOD_*` を原則維持」は本決定で置き換える |
| 2 | フードの背面に同色の別パーツを置かない（自然なパーカーのシルエット）、ポニーテールとの干渉に配慮 | T-4（形状） |
| 3 | パーカー部（フード・袖・胸元の上着部分）とオーバーオール部を別の部品として構成する。フードの中に帽子（つば付き） | T-4（形状） |
| 4 | 色: オーバーオール = 今の緑系のまま / パーカー部 = 薄紺色 / 帽子 = 今の黄色のまま | **T-5 へ記録のみ**（HDR-T4-8。T-4 では Material の値を変えない） |

### 魔法使い C のデザイン変更（Human Decision）
**Human Decision 1〜3**: ユーザー（人間）/ 2026-09-25 / Claude Code セッションの会話。参考画像「E. ロングコート×ワイドパンツ　大人っぽいシルエット」を提示し「このデザインに変更して。色は後で修正する」、続けて Human Decision 1〜3 として確定。記入: Implementer（人間の指示による）

**Human Decision 1（魔法使い C のデザイン変更）**
| 項目 | 旧（HDR-T4-5 の確定時） | 新（本 Human Decision） |
| --- | --- | --- |
| 魔法使い C | ローブ維持 + 大判ストール + 帽子の比率修正（とんがり帽子） | **参考画像 E「ロングコート × ワイドパンツ」をベースとした現代風リメイク** |

- 採用する形状方針: キャスケット / 長く広がった髪 / タートルネック / 前開きロングコート / ワイドパンツ / 既存ブーツ / 既存杖
- 旧ローブ・旧大判ストール・旧とんがり帽子は廃止（魔法使い C の形状から置き換える）
- T-4 の Geometry / Silhouette の範囲で扱う。Material の値は変更しない。色の最終調整は T-5
- 上の「Human Decision（確定、デザイン）」表の HDR-T4-5 の行は書き換えていない（本節が変更の記録）
- 途中経過の記録: 同日、Human の魔法使い C 実装指示（参考画像の新デザインのとんがり帽子案、ドレスは裾があまり広がらないように）で、とんがり帽子の headR 比化・ローブ裾の絞り・ローブ上部・大判ストールを実装したが、本 Human Decision 1 で置き換えた（コードには残っていない）

**Human Decision 2（unit テストの更新と変更対象ファイルの追加）**
- `tests/unit/lowpoly-primitives.test.js:1291` の旧テストは、旧とんがり帽子の実装（`makeMageHatBrim(headR*MAGE_BRIM_RADIUS_BASE_MUL, MAGE_BRIM_THICKNESS)`）の存在を直接要求しており、新仕様と一致しないため FAIL していた。新仕様に合わせた更新を Human が承認（assert を削除して弱くすることは禁止。新しい帽子の構築が存在し、旧帽子実装への依存が無いことを検証するテストへ置き換える）
- **Human Decision による T-4 変更対象ファイルの追加**: `tests/unit/lowpoly-primitives.test.js`（仕様変更に伴うテスト更新）。上の Files To Change（確定版）と Approved Task Blob は書き換えていない（Approved Task identity は保持）

**Human Decision 3（本記録）とテスト結果**
| テスト | 結果 | メモ |
| --- | --- | --- |
| 盗賊 A（修正イメージ版）関連 E2E 39件 | **39 PASS** | `character-motion`・`weapon-stow`・`base-class-identity`・`base-class-comparison`・`job-traits` |
| 魔法使い E 版 関連 E2E 39件 | **37 PASS / 2 FLAKY / 0 FAIL** | FLAKY は PASS として数えない（§14）。下の2件 |
| `base-class-identity.spec.js:376`（盗賊: Back Attack） | FLAKY | 初回 FAIL（「規定回数以内に背後向き(facing≈0)のDummyが出現すること」、Received: null、タイムアウト）。同一テストを1回だけ再実行して PASS。対象変更との関係: FACT (code) 盗賊のコードは直前の 39 PASS の回と同一。INFERENCE 魔法使いの変更とは無関係。原因は未特定。変更前コードでの比較は未実施 |
| `job-traits.spec.js:162`（鷹の目: Predictive Aim / Turn Assist） | FLAKY | 初回 FAIL（「回避直後の攻撃でTURN ASSISTが発火すること」、Received: false）。spec 内蔵の自動リトライ（retry #1）で PASS。鷹の目は対象外。原因は未特定 |
| 途中で停止した E2E | 参考（結果として数えない） | デザイン変更のたびに実行中の E2E を停止した（開発サーバー経由のため途中のコード変更が混ざる）: 盗賊の裾を絞ったワイドパンツ版 20 件 PASS 時点、オーバーオール初版 14 件 PASS 時点、魔法使い とんがり帽子版 12 件 PASS 時点。いずれも置き換え済みのコードに対する途中結果 |
| repo 標準設定の E2E | NOT_RUN | Chromium revision 不一致（実行環境）。上の E2E はすべてリポジトリ外の scratchpad 設定（`executablePath` のみ差し替え）での結果。repo の Playwright 設定は変更していない |

**魔法使い C の V-1 状態**: 未承認（Human 確認待ち）
| # | 確認事項 | 扱い |
| --- | --- | --- |
| 1 | 見下ろしカメラで顔がほぼ隠れる（HDR-T4-2「魔法使いは顔を見せる」との整合） | T-4 Geometry の調整候補 |
| 2 | キャスケットの六角形的な角張り | T-4 Geometry の調整候補 |
| 3 | Material が同色で服の構造が見分けにくい | T-4 の評価対象にしない（T-5 で色分け） |

**キャスケットの形状（Human Decision）**: ユーザー（人間）/ 2026-09-25 / Claude Code セッションの会話で「キャスケットは候補Bで確定」。記入: Implementer（人間の指示による）
- 候補 B（確定）: 後ろへ深くかぶり、つばを短くして額と目を出す形。`MAGE_CAP_RINGS`（headR 比、上から順に y / r / dz）= 1.24 / 0.50 / −0.16、1.06 / 1.02 / −0.14、0.82 / 1.10 / −0.10、0.44 / 1.07 / −0.04。`MAGE_CAP_BRIM` = yTop 0.50 / yBottom 0.45 / hw 0.58 / hd 0.12 / dz 0.92
- 候補 A（不採用）: 1.25 / 0.50 / 0.08、1.05 / 1.05 / 0.06、0.78 / 1.16 / 0.03、0.36 / 1.10 / 0.00、つば yTop 0.41 / yBottom 0.35 / hw 0.62 / hd 0.14 / dz 1.00
- 魔法使い C の V-1 は未承認のまま（上の確認事項 1〜3 は Human 確認待ち）。「長く広がった髪」は未実装（既存の共通の髪のまま。髪の新規造形は今回の範囲外として実施していない）
- 現在のコード（魔法使い E 版・キャスケット候補 B・unit テスト更新後）の関連 E2E 39件（`character-motion`・`weapon-stow`・`base-class-identity`・`base-class-comparison`・`job-traits`）: **39 PASS**（FLAKY 0 / FAIL 0。scratchpad 設定での結果。repo 標準設定は NOT_RUN）。`npm run build` PASS、`npm run test:unit` 1508 / 1508 PASS

### 剣士 A のデザイン変更（Human Decision）
**Human Decision**: ユーザー（人間）/ 2026-09-25 / Claude Code セッションの会話。参考画像（「〜い放浪騎士デザイン」側面図と、マウンテンパーカー・キャップ・ネックゲイターの実写コーディネート）を提示し「ブーツのアイデアもいいけど、剣士も現代風に大幅リメイクする。このデザインをうまく落とし込んで」、続けて本記録を指示。記入: Implementer（人間の指示による）

| 項目 | 従来の剣士 A 案（HDR-T4-5 / HDR-T4-2 の確定時） | 今回の Human による方向変更 |
| --- | --- | --- |
| 上着 | 短丈上着 | テック系ハーフコート / パーカー系上着（ゆったりした現代的シルエット） |
| 首元 | 大判ストール | ハイネック / フード系のレイヤー |
| 頭 | 兜 | 現代的なキャップ系ヘッドウェア |
| 顔 | 見せない | **見せる** |
| 足元 | ロングブーツ | ロングブーツ |
| 武器 | 大剣 | 大剣 |

- **コンセプト**: 「中世ファンタジーの騎士を、現代のテック系ストリート / アウトドアウェアとしてリメイクした放浪騎士」（「現代テックウェアを着た放浪騎士」）
- **デザイン意図**: 鎧を現代服に単純に置き換えるのではなく、騎士のシルエットや装備感をテックウェアの構造へ翻訳する
- **HDR-T4-2 の剣士の変更（Human によるデザイン変更）**: 従来「剣士の兜を残す・顔を見せない」→ 今回「現代的ヘッドウェアへ変更・顔を見せる」。上の「Human Decision（確定、デザイン）」表の HDR-T4-2 / HDR-T4-5 の行は書き換えていない（本節が変更の記録）
- 途中経過の記録: 同日、剣士 A 初版（短丈上着・背中へ流す大判ストール・ロングブーツ・前立ての headR 比化、兜は維持）を実装し関連 E2E 40件 40 PASS だったが、本 Human Decision で置き換えた（コードには残っていない）
- 本記録時点の実装（形状のみ、寸法はすべて候補値、Material は既存インスタンスの流用で値は不変、色は T-5）: キャップ（`WARRIOR_CAP_RINGS` / `WARRIOR_CAP_BRIM` / `WARRIOR_CAP_EAR`、headR 比、頭頂に小さな耳状の突起2つ。髪の隠れ判定 `warriorCapCoverageAt` も同じ表）、ネックゲイター（肩〜口元の下）、背中に下ろしたフード、膝丈のマウンテンパーカー（前は細く開け裾だけ広く開ける、胸と腰左右のポケット、長袖）、すね中ほどで切ったワイドパンツ、既存ブーツ + パンツ裾の内側までのブーツの胴、大剣の収納位置は不変（Step 7 は未実施）。旧 素の剣士の意匠（兜・前立て・眉当て・毛皮・棘・革帯・留め具・腰帯プレート・短いマント）は作らない。新しい部品はすべて `warriorBaseDecor`（戦騎士への転身で隠す対象）に入れた（上位職の調整は Step 6）
- unit テスト: 旧兜の構築（`makeWarriorBaseHelm({...})` の呼び出し）を直接要求するアンカーが `tests/unit/lowpoly-primitives.test.js` に存在したため、魔法使い C の Human Decision 2 と同じ扱いで、新しいキャップの構築を検証するテストへ置き換えた（下の「unit テストの更新（剣士）」）

**unit テストの更新（剣士）**
| 変更 | 内容 |
| --- | --- |
| 置き換え | `checkNear('makeWarriorBaseHelm({width:headR, depth:headR, height:headR*WARRIOR_HELM_HEIGHT_MUL})', 'Warrior Helm')` → キャップの頭頂（`makeGarmentLoft(WARRIOR_CAP_RINGS.map(`）・つば（`headR*WARRIOR_CAP_BRIM.yTop`）・耳状の突起（`headR*e.yTop`）の3箇所で、同じ規則（近傍に `HEAD_BACK_Z`）を確認 |
| 追加 | 「剣士のキャップは headR 比の WARRIOR_CAP_RINGS で構築され、Coverage も同じ表を使い、旧兜の構築に依存しない」: キャップの高さ・半径が headR 比 / 06 に `makeWarriorBaseHelm({` の呼び出しが無い / `WARRIOR_CAP_RINGS` が上から下の順で headR 比として妥当 / `warriorCapCoverageAt` が同じ表で判定し旧兜の定数に依存しない / `getHeadwearCoverage` の剣士がキャップの Coverage へ振り分けられている |
| 削除した assert | なし |

**テスト結果（剣士リメイク版）**
| テスト | 結果 | メモ |
| --- | --- | --- |
| `npm run build` | PASS | |
| `npm run test:unit` | PASS | 1509 / 1509 |
| 関連 E2E 40件（`character-motion`・`weapon-stow`・`base-class-identity`・`base-class-comparison`・`job-traits`・`battle-knight-visual`） | **39 PASS / 1 FLAKY / 0 FAIL** | FLAKY は PASS として数えない（§14） |
| `job-traits.spec.js:97`（戦騎士: Perfect Brace） | FLAKY | 初回 FAIL（「Charge Enemyが交戦(TELEGRAPH/DASH)状態に入ること」、Received: false）。spec 内蔵の自動リトライ（retry #1）で PASS。原因は未特定。剣士の衣服形状との直接的な関係は確認されていない。変更前コードでの比較は未実施 |
| 撮影用の一時テスト（剣士・戦騎士） | PASS（参考） | コンソールエラーなし。一時 spec は削除済み |
| repo 標準設定の E2E | NOT_RUN | Chromium revision 不一致（実行環境）。上の E2E はリポジトリ外の scratchpad 設定（ブラウザの位置 `executablePath` のみ差し替え）での結果。repo の Playwright 設定は変更していない |

**剣士 A の V-1 状態**: **未承認（Human の目視確認待ち）**。重要なのは「現代服として自然」と「放浪騎士として認識できる」の両立。可愛さ・キャラクター性の合否は Human が判断する
| # | 確認項目 |
| --- | --- |
| 1 | キャップの大きさ |
| 2 | キャップの形状 |
| 3 | 耳の突起が不自然でないか |
| 4 | 顔の見え方 |
| 5 | 首元のハイネック / フード |
| 6 | ハーフコートの丈 |
| 7 | 肩・袖のボリューム |
| 8 | パンツのシルエット |
| 9 | パンツ裾とロングブーツの接続（現在の実装は、既存ブーツ + パンツ裾の内側までのブーツの胴） |
| 10 | 大剣と背面衣服の干渉 |
| 11 | 正面シルエット |
| 12 | 側面シルエット |
| 13 | 背面シルエット |
| 14 | 武器収納状態でも剣士と分かるか |
| 15 | 歩行時の衣服破綻 |
| 16 | 戦闘時の衣服破綻 |
| 17 | 「現代テック系の放浪騎士」に見えるか |
| 18 | 既存のファンタジー騎士感を完全に失っていないか |
| 19 | 5.0頭身でも服が大きすぎて身体が埋もれていないか |
| 20 | 4職を並べたときに剣士として識別できるか |

**剣士 A の V-1 Human Decision**: ユーザー（人間）/ 2026-09-25 / Claude Code セッションの会話で「**この見た目でokです**」。判断に使った資料: 剣士の旧デザイン／現在の比較画像と4職比較画像（停止〔武器収納〕の正面・斜め45°・側面相当・背面、歩行、戦闘。リポジトリ外）。記入: Implementer（人間の指示による）
- 上の V-1 確認項目 1〜20 を含め、現在の実装（キャップ・ネックゲイター・背中のフード・膝丈マウンテンパーカー・すね中ほどのワイドパンツ・ブーツの胴・大剣）を剣士 A の形状として承認
- これは **剣士 A の V-1 承認** であり、T-4 全体の DONE・全体 V-1 ではない。残り: Step 6（上位職・影の旅人）、Step 7（必要な職のみ）、HDR-T4-14 の衣服構築 E2E、全体 V-1、`docs/CHARACTERS.md` の外見記述

### Step 6: 上位4職 + 影の旅人（Human Decision）
記入: Implementer（人間の指示による）。いずれもユーザー（人間）/ 2026-09-25 / Claude Code セッションの会話

| # | Human Decision | 内容 |
| --- | --- | --- |
| 1 | 上位4職 + 影の旅人のデザイン案 | 参考画像「上位職4職 デザイン案」「影の旅人 操作時デザイン案」「上位職 4 職 + 影の旅人 デザイン案（現代リメイク × 身軽なファッション）」を提示し「下位職のデザインを生かしたまま、より動きやすく現代的に落とし込んだデザインにリニューアル」。HDR-T4-7（P-a / W-a）の方針で、基礎職の衣服を引き継ぎ、上位職ごとの部品を置き換える |
| 2 | フィードバック | 「上位職は白いレイヤードが強調されるとわかりやすい」「影の旅人も黒すぎる、なんで剣を持ってるかわからん、髪の毛の表現がポリゴンすぎる」「剣士と戦騎士の背中の剣の向き逆、刃が上を向いちゃってる」 |
| 3 | **色の T-4 先行（上位職 + 影の旅人のみ）** | Implementer の確認に対し「上位職 + 影の旅人の色だけ T-4 で先行」を選択。HDR-T4-8（Material は T-5）の例外として、上位職の白いレイヤー用の専用 Material（転身の間だけ作り、解除時に破棄）と、影の旅人の白いシャツ・チャコールのコート用の専用 Material を追加する。**基礎4職の Material の値は変えない（T-5 のまま）** |
| 4 | **影の旅人の武器** | 「見た目だけ剣を非表示」を選択。影の旅人だけ武器メッシュを表示しない。攻撃処理・判定・モーションは剣士の kit のまま（素手の演出・モーションは別 Task） |
| 5 | **背中の剣の向き（Step 7）** | 剣士・戦騎士の `WEAPON_SOCKET` の収納の向きを上下逆に（握りを右肩の後ろ、刃を下 = 左腰の方へ）。HDR-T4-13 は `off` のみの補正だったが、Human の指示により収納時の向き（`wep`）も変える。武器の形状・攻撃中の位置は不変 |

**実装（形状 + 上記3の色、寸法・色は候補値）**
| 対象 | 引き継ぐもの | 足したもの | やめたもの |
| --- | --- | --- | --- |
| 戦騎士 | 剣士のキャップ・ネックゲイター・フード・パーカー・パンツ・ブーツ（顔を見せる、頭の縮小 0.86 → 1.0） | 白いテック系ジャケット（前開き）と白い袖、強化肩パーツ（左大・右小）、胸で交差するハーネス、ベルトと留め金 | 兜・面頬・眉庇・前立て・首の毛皮・胸甲・腰鎧・マント2枚・頭部の非表示 |
| 鷹の目 | 弓師の帽子（隠さない）・短丈上着・ワイドパンツ、肩の鷹 | 背中に下ろしたフード、白いユーティリティベスト（胸ポケット2つ） | 深いフード・眼帯・ひさしの差し替え・マント |
| バーサーカー | 盗賊のパーカー・オーバーオール、足元のオーラ | フードを 1.14 倍・白に（解除時に元へ）、白い半袖の上着 | 逆立つ髪の房・こめかみの球・長髪・髭・素肌の板・肩 / 腰 / 足首の毛皮 |
| 魔導士 | 魔法使いのキャスケット（房飾りを頭頂へ）・コート・ワイドパンツ、長い銀髪、魔法石 | 肩〜胸下の上掛け（二重コート）、手首で広がる袖口、コートの前から見える白いドレス | ローブの前開きの襟（makeClothPanel 2枚） |
| 影の旅人 | 剣士の部品の作り方（charKey で区別。classDef.key は剣士の kit のまま） | キャップ無し（髪と顔を見せる、髪の隠れ判定は被り物なし）、マフラー、背中のフード、腰丈のショートコート（チャコール）、白いシャツ（コートの裾の下まで）、裾まで長いワイドパンツ、頭のまわりの髪の房 9 本、武器の非表示 | 剣士のキャップ、膝丈のパーカー |

- unit テスト: 鷹の目の深いフードの構築（`makeHawkEyeHood({width:B.headR*1.35`）を要求するアンカーを、同じ `makeHawkEyeHood` を頭の被り物に使う盗賊のパーカーのフード（`makeHawkEyeHood({width:headR*ROGUE_PARKA_HOOD_WIDTH_MUL`）へ、同じ規則（近傍に `HEAD_BACK_Z`）で置き換えた（Human Decision 2 と同じ扱い。assert の削除なし）
- 途中で停止した E2E（結果として数えない）: Step 6 初版の関連 E2E を 25 件 PASS の時点で停止（フィードバック反映で置き換えたコード）。Step 6 の最初の調整版（戦騎士の鎧をパーカーに重ねた版）は 51 件 51 PASS だったが、本 Human Decision で置き換えた
- 酒場で会話する影の旅人（フードの深いロングコート）は酒場の NPC 側の見た目で、操作キャラクターの範囲外のため未実施
- **Step 6 の V-1: 未承認（Human 確認待ち）**

**Step 6 の V-1 Human Decision**: ユーザー（人間）/ 2026-09-25 / Claude Code セッションの会話。記入: Implementer（人間の指示による）
- **上位4職（戦騎士・鷹の目・バーサーカー・魔導士）: 「上位職はこの見た目でOK」** → 上位4職の V-1 を承認（白いレイヤー・背中の剣の向き修正を含む現在の実装）
- 影の旅人: 「透け感は良い」。**髪は未承認**（「髪の房が太すぎてドレッドっぽい」「他に表現する方法ある？」）→ 候補として、太い円錐の房（makeHairBang）をやめ、細く平たい尖った毛束（makePlate の板、13 枚）を頭のまわりに重ねる形へ変更（Human 確認待ち）
- 全キャラの顔: 「頭身に対して目が大きすぎるし離れすぎてる。もっと普通に」→ 目の大きさ `eyeSizeMul` 0.85 → 0.72、左右の間隔 0.115 → 0.095（`EYE_SPACING`、eyeScale 倍）へ変更（候補値、Human 確認待ち）。目の点数・輪郭・3層構造は不変、顔の造形の追加なし（HDR-T4-15）。unit テストの複製値（`computeEyeParamsForTest` の eyeSizeMul）も 0.72 に同期（既存の「縮小率 70〜95%」の範囲内）
- テスト（目・髪の候補を入れたコード）: 関連 E2E 51件（`character-motion`・`weapon-stow`・`base-class-identity`・`base-class-comparison`・`job-traits`・`battle-knight-visual`・`chapter1-progression`）= **50 PASS / 1 FAIL**。FAIL は `weapon-stow.spec.js:104`（戦騎士: 非戦闘で収納され、攻撃で抜刀して手に収まる）「切っ先が床を突き抜けている (y=-0.02m)」（期待 > 0.15）。原因: 背中の剣の上下を逆にした際、戦騎士の大剣（×1.32）が長く切っ先が床に届いた（FACT: 剣士は PASS、戦騎士の収納値の変更による）。修正: 戦騎士の収納の `off` を [0.12, 0.34, -0.26] → [0.12, 0.42, -0.26]、`wep` を [-0.260,-0.955,-0.050, 0.955,-0.260,0] → [-0.450,-0.890,-0.050, 0.890,-0.450,0]（握りを少し高く、刃を少し寝かせる）。修正後の再実行: `weapon-stow` 10 PASS、`battle-knight-visual` + `job-traits` 5 PASS、`npm run test:unit` 1509 / 1509 PASS、`npm run build` PASS（scratchpad 設定。repo 標準設定は NOT_RUN）。修正後に 51件全体の再実行はしていない

**髪・目・肌の Human Decision**: ユーザー（人間）/ 2026-09-25 / Claude Code セッションの会話。記入: Implementer（人間の指示による）
- **影の旅人の髪: 「平たい毛束でOK」** → 細く平たい尖った毛束（makePlate の板、13 枚）で確定。これで影の旅人の V-1 の指摘事項（髪）は解消（影の旅人全体の V-1 は全体 V-1 で確認）
- **目: 「普通に見えるのでこれでOK」**（`eyeSizeMul` 0.72、`EYE_SPACING` 0.095 で確定）。「ただしもう少し可愛くできるか？黒目を大きくするか目を縦長にするか」→ 候補として黒目の基準半径 0.038 → 0.046、白目の縦横比 1.15 → 1.28（`EYE_SCLERA_ASPECT`）に変更（目全体の大きさ・間隔は変えない。Human 確認待ち）。unit テストの複製値（`EYE_BASE_R.pupil`、白目の縦横比）も同期
- **肌色: 「肌の色黒くない？各職業で肌色を分けて欲しい」** → HDR-T4-8（Material は T-5）の例外として、Human の指示により T-4 で職ごとの肌色を設定（skinMat の色、候補値）: 剣士（アジア系の色白）0xf2d6bf / 魔法使い（イギリス系の色白）0xf8e3d8 / 盗賊（日本人の色白）0xf5dcc8 / 弓師（日本人の色黒）0xd6a47e。旧: 全職 0xe8b98a。上位職は基礎職の値を継承。影の旅人は classDef.key が剣士（kit）のため剣士の値（Human 未指定。必要なら別の値を指定する）。ゲームカメラでは帽子・フードの陰で顔が実際より暗く見える（照明による。色の値の問題ではない）
- **肌色の値（Human Decision、確定）**: ユーザー（人間）/ 2026-09-25 / 会話で値を指定。剣士 0xffe6d2 / 魔法使い 0xffeee5 / 盗賊 0xffe7d4 / 弓師 0xe8bd98 / **影の旅人 0xe8dce0**（剣士と分ける。やや青白く血色を抑え、服を真っ黒にしなくても「普通の人間とは少し違う」感じ）。方針: 「肌色そのものをリアルにする」より「見下ろしのゲームカメラで自然な肌色に見える値」を優先。顔より手・腕の肌色がキャラクター識別に効く。影の旅人は charKey で判定（classDef.key は剣士の kit）。前の候補値（0xf2d6bf / 0xf8e3d8 / 0xf5dcc8 / 0xd6a47e）で走らせていた関連 E2E は 22 件 PASS の時点で停止（置き換えたコード）
- **目と肌色の Human Decision（確定）**: ユーザー（人間）/ 2026-09-25 / 会話で「目と肌色これでOKです」。目 = `eyeSizeMul` 0.72 / `EYE_SPACING` 0.095 / 黒目の基準半径 0.046 / 白目の縦横比 1.28、肌色 = 上記の Human 指定値で確定
- テスト（目・肌色確定後の現在のコード）: 関連 E2E 51件（`character-motion`・`weapon-stow`・`base-class-identity`・`base-class-comparison`・`job-traits`・`battle-knight-visual`・`chapter1-progression`）= **51 PASS**（FLAKY 0 / FAIL 0、scratchpad 設定。repo 標準設定は NOT_RUN）、`npm run build` PASS、`npm run test:unit` 1509 / 1509 PASS

### T-4 の仕上げ（HDR-T4-14・HDR-T4-10）
記入: Implementer（人間の指示による）

**Human Decision（2026-09-26、Claude Code セッションの会話）**
| # | 論点 | Human の選択 |
| --- | --- | --- |
| 1 | ユーザー（人間）が「T-5 の最終的な衣服 Material・配色調整を開始」と指示。Implementer が (1) 承認済みの実施順（T-1 → T-5、並行禁止、前の WI が DONE）に対し T-4 が未 DONE、(2) 承認済み T-5 計画（マット化）の範囲を配色が超える（§6 の承認取り直し）の2点を提示 | **「T-4 を先に完了させる」**。T-4 を仕上げ（HDR-T4-14 の E2E・docs・全体 V-1）→ commit / push → Review。T-5 は配色の範囲で再計画（Planner）→ 承認 → 実装。T-5 はまだ始めない |
| 2 | HDR-T4-14 の衣服の構築の検証方法 | **「デバッグパネルに衣服数を出す」**。**Human Decision による T-4 変更対象ファイルの追加**: `src/core/motion-preview.js`（RIG ブロックに CLOTH 行）、`tests/unit/motion-preview.test.js`（CLOTH 行の unit テスト）、新しい spec `tests/character-clothing.spec.js`（Files To Change 確定版の「`tests/character-motion.spec.js`（または新しい spec）」の新しい spec）。上の Files To Change（確定版）と Approved Task Blob は書き換えていない |

- 補足: 指示文の肌色の一覧（剣士 0xf2d6bf / 魔法使い 0xf8e3d8 / 盗賊 0xf5dcc8 / 弓師 0xd6a47e / 影の旅人は剣士系）は、その後に Human が指定して確定した値（剣士 0xffe6d2 / 魔法使い 0xffeee5 / 盗賊 0xffe7d4 / 弓師 0xe8bd98 / 影の旅人 0xe8dce0）より前の候補値。コードは確定値のまま（変更していない）

**HDR-T4-14（衣服の構築 E2E）の実装**
| ファイル | 内容 |
| --- | --- |
| `src/legacy/parts/05-rendering-rig.js` | `makeGarmentLoft` / `makeOpenGarmentLoft` の Geometry に `userData.garment = true`。デバッグ用の `motionBodySnapshot` に `cloth`（player の中で見えている衣服メッシュの数、`traverseVisible`）を追加。ゲームの状態・通常の HUD は変えない |
| `src/core/motion-preview.js` | RIG ブロックに ` CLOTH  n` の1行（取れないときは `-`） |
| `tests/unit/motion-preview.test.js` | CLOTH 行の表示（数・`-`・0）の unit テストを1件追加 |
| `tests/character-clothing.spec.js`（新規） | 4基礎職・上位4職（テストモード）と影の旅人（Chapter 1 を終えたセーブから「つづきから」）で、Debug Motion Preview の CLOTH が各キャラクターの下限（5〜6）以上で、コンソールエラーが無いこと。9 件 |

- 実行結果（scratchpad 設定）: `tests/character-clothing.spec.js` 9 件 **9 PASS**、`npm run test:unit` 1510 / 1510 PASS、`npm run build` PASS

**HDR-T4-10（`docs/CHARACTERS.md`）**: 「## 外見（プレイヤーキャラクターの見た目）」の節を「## Party」の前に追加（9キャラクターの頭・上半身・下半身・顔の表、目・肌色・武器の収納・影の旅人の武器）。影の旅人の既存の記述（黒ずくめ・戦闘に関わらない等）とプレイアブル実装の食い違いは直していない（別 Task、節の末尾に明記）

**T-4 全体の V-1 Human Decision**: ユーザー（人間）/ 2026-09-26 / Claude Code セッションの会話で、最終コードの9キャラクター（4基礎職・上位4職・影の旅人、停止〔武器収納〕の正面・斜め45°・側面相当・背面、歩行、戦闘。リポジトリ外の比較画像）を確認し「**完了で良いです**」。記入: Implementer（人間の指示による）。T-4 の主 Acceptance（V-1-T4a〜h、HDR-T4-6 の武器収納状態での識別を含む）を Human が許容。T-4 の DONE は Reviewer の判定による（§7.3）

### T-4 最終 Test Report（REVIEWING 時点）
| テスト | 結果（PASS / FAIL / FLAKY / NOT_RUN） | メモ |
| --- | --- | --- |
| `npm run build` | PASS | |
| `npm run test:unit` | PASS | 1510 / 1510 |
| 関連 E2E 60 件（`character-motion`・`weapon-stow`・`base-class-identity`・`base-class-comparison`・`job-traits`・`battle-knight-visual`・`chapter1-progression`・`character-clothing`〔新規、9件〕） | 59 PASS / **1 FLAKY** / 0 FAIL | FLAKY は PASS として数えない（§14） |
| `job-traits.spec.js:97`（戦騎士: Perfect Brace） | FLAKY | 初回 FAIL「戦騎士のバリアパリィがPerfect Braceとして成立すること」（Received: false）、spec 内蔵の自動リトライ（retry #1）で PASS。同じテストは剣士リメイク版の実行でも FLAKY（そのときは「Charge Enemyが交戦状態に入ること」で失敗）、他の回は PASS。対象変更との関係: INFERENCE タイミング依存のテスト（spec 名のとおり自動リトライ前提）で、衣服の形状との直接の関係は確認されていない。原因は未特定。変更前コードでの比較は未実施。Review の Risks に残す |
| repo 標準設定の E2E | NOT_RUN | Chromium revision 不一致（要求 1234 / 導入済み 1194、実行環境）。repo の Playwright 設定は変更していない |
| scratchpad の設定での E2E | 実行 | リポジトリ外の回避策（repo の設定を読み込み `executablePath: '/opt/pw-browsers/chromium'` のみ差し替え）。上の E2E はすべてこの方法 |
| `npm test` 全体 | NOT_RUN | |

**Changed Files（T-4）**
| ファイル | 内容 |
| --- | --- |
| `src/legacy/parts/05-rendering-rig.js` | `makeGarmentLoft` / `makeOpenGarmentLoft`、盗賊のパーカーのフード（ROGUE_PARKA_HOOD_*）と Coverage、魔法使い・剣士のキャップ（MAGE_CAP_* / WARRIOR_CAP_*）と Coverage（`capRingsCoverageAt`）、剣士・戦騎士の `WEAPON_SOCKET`（背中の剣の向き、Human Decision）、デバッグ用の衣服数（HDR-T4-14） |
| `src/legacy/parts/06-player-enemy.js` | 4基礎職・影の旅人の衣服・頭部・顔、上位4職（`applyJobPromotionVisual`）、目（大きさ・間隔・黒目・縦横比）、職ごとの肌色、影の旅人の武器の非表示（見た目のみ） |
| `src/core/motion-preview.js` | RIG ブロックの CLOTH 行（Human Decision で追加） |
| `tests/unit/lowpoly-primitives.test.js` | 旧帽子・旧兜・鷹の目の深いフードに依存したアンカーの置き換え、剣士・魔法使いのキャップのテスト追加、目の複製値の同期（Human Decision で追加） |
| `tests/unit/motion-preview.test.js` | CLOTH 行のテスト（Human Decision で追加） |
| `tests/character-clothing.spec.js`（新規） | 衣服の構築 E2E（HDR-T4-14） |
| `docs/CHARACTERS.md` | 外見の節（HDR-T4-10） |
| `.ai/tasks/CHARACTER-VIS-001.md` | T-4 の Status・Status History・Implementation Result（Human Decision の記録を含む。既存行は変更なし、Status 列のみ更新） |

変更しないと決めた範囲（BUILD の体格値・T-1 の歩行・STANCE / CLIPS・関節球・Pauldron の形状・骨盤・輪郭線・敵・ボス・支援AI・共有 Lathe 表・`13-update-loop.js`・`playwright.config.js`）に差分なし。Material の値の変更は Human Decision の例外（上位職 + 影の旅人の色、職ごとの肌色）に限る。T-5（配色）は未着手（Human Decision: T-4 を先に完了）

## Implementation Result（T-5 再計画版、途中: V-1 第1段階 = 基礎4職まで）

### 状態
- Status: IMPLEMENTING。V-1 第1段階（基礎4職）の Human 確認待ち。上位4職・影の旅人の配色は未着手（P-D11。影の旅人と上位職は T-4 の見た目を保つ暫定の行）

### 変更内容
| ファイル | 内容 |
| --- | --- |
| `src/render/player-palette.js`（新規） | プレイヤー専用の配色表 `PLAYER_PALETTE`（役割 main / sub / accent / layer / hat / trim / boot、P-D3）と質感表 `PLAYER_FINISH`（HDR-T5-9 の初期候補、投げナイフ 0.75 / 0.45 = P-D9）、`paletteKeyFor` / `resolvePalette`。上位職は `inherit`、バーサーカーは独立（HDR-T5-8） |
| `src/legacy/concat-plugin.js` | HEADER に import 1行（P-D2） |
| `src/legacy/parts/06-player-enemy.js` | `buildPlayer()` の色を `CLASSES.color / trim` から配色表へ。新規 `subMat` / `subMatFlat` / `layerMat` / `hatMat`（帽子は既存の兜・盗賊の帽子・魔法使いの帽子 Material を1つに）。`wandererCoatMat` / `wandererWhite` を role main / layer へ統合。衣服メッシュの Material の割り当てのみ変更（剣士・魔法使い・弓師のパンツ = sub、弓師の袖 = sub、魔法使いのタートルネック = layer）。`applyPlayerPalette(P, key)` が全 role を上書き。`swapPlayerWeaponVisual()` の武器装飾を配色表の trim に（P-D9） |
| `src/legacy/parts/05-rendering-rig.js` / `src/core/motion-preview.js` | `motionBodySnapshot` の `pal`、Motion Preview の PAL 行（P-D10） |
| `tests/unit/player-palette.test.js`（新規）/ `tests/unit/motion-preview.test.js` | 配色表の形・承認色・継承・質感範囲・`CLASSES` の値の不変・肌色の不変、PAL 行 |
| `tests/character-palette.spec.js`（新規） | 基礎4職で役割別 Material の色が配色表どおり（PAL 行） |

変更していない: `01`（CLASSES / UPPER_JOBS）、`08`、`11`、`12`、`13`、`14`、`textures.js`、`playwright.config.js`、BUILD、Geometry（衣服数 E2E 不変）、`applyJobPromotionVisual()`（第2段階）

### Test Report（V-1 第1段階の時点）
| テスト | 結果 | メモ |
| --- | --- | --- |
| `npm run build` | PASS | |
| `npm run test:unit` | PASS | 1518 / 1518 |
| `tests/character-palette.spec.js`（新規 4件）・`tests/character-clothing.spec.js`（9件） | PASS | 13 / 13 |
| 全 E2E 141件（scratchpad の設定） | 138 PASS / 2 FAIL / 1 FLAKY | 下の3件 |
| `air-actions.spec.js:128`（Enemy Step） | FAIL → 単独再実行 PASS | 全体実行で「突進中の敵を空中から踏めること」false。単独では PASS。**FLAKY 扱い（PASS に数えない）** |
| `job-traits.spec.js:162`（鷹の目 Turn Assist） | FLAKY | spec 内蔵のリトライで PASS、単独再実行 PASS |
| `mansion-escort.spec.js:126`（Relaxed Stance、仕様 13） | FAIL（**既存**） | relax 0.89（期待 > 0.9）。**変更前の `main` `2a9674b` でも2回とも FAIL（0.89 / 0.84）**。T-5 の差分（Material のみ）とは無関係。原因は未調査（別 Task 候補） |
| repo 標準設定の E2E | NOT_RUN | Chromium revision 不一致（実行環境）。repo の Playwright 設定は変更していない |

### V-1 第1段階（基礎4職）
- 撮影: T-4 と同じ撮影セット（停止 正面 / 斜め45° / 側面 / 背面、歩行、戦闘）で、T-4 最終と並べて比較
- Human 確認: 未（Human が色を直した場合は配色表の値だけ変え、ここに「候補値 → Human 指定値」で記録する）
- **Human Decision（盗賊のトップス）**: ユーザー（人間）/ 2026-09-26 / 会話で「盗賊の紫は少し浮いて見える。トップスは紫を主役にせず、オーバーオールの緑と帽子の黄色をつなぐ色に」と指摘し、候補 A Dark Navy #263449 / B Deep Teal #28565A / C Warm Brown #665044 / D Dusty Blue #526A78 をゲーム画面で比較のうえ「**D で確定**」。配色表 `rogue.accent`（パーカーのフード・胴・袖）: 候補値 Muted Purple #5B4B78 → **Human 指定値 Dusty Blue #526A78**。他の盗賊の値（オーバーオール #304D45 / 帽子 #D2A83E / ブーツ・金具 #263449）は変更なし。確認: `npm run test:unit` 1518 / 1518 PASS、`npm run build` PASS、`character-palette` + `character-clothing` E2E 13 / 13 PASS（配色表の1値の変更のみのため全 E2E は再実行していない）
