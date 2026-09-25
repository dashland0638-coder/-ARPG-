# ENEMY-ATTACK-VIS-001

敵攻撃の視認性改善 W1（Forest Mansion 通常近接敵3種の予兆中の床扇表示）

Status: REVIEWING

Persistence state: PENDING PERSISTENCE（Human による承認済み Task file の commit / push 待ち。§7 の Status 値ではないため `Status:` 行とは分けて記録する）

Analysis: .ai/reports/ENEMY-ATTACK-VIS-001-analysis.md（branch `claude/enemy-attack-vis-001-analysis-7y2loi` @ `b9470260fe8ed34c9ee2eb413c0afbb7d4f23862`、blob `487e8d4bb9cf21574602ad08baca77bf5fdf48c0`）

- Analysis Artifact: `.ai/reports/ENEMY-ATTACK-VIS-001-analysis.md`
- Analysis Source Branch: `claude/enemy-attack-vis-001-analysis-7y2loi`
- Analysis Source SHA: `b9470260fe8ed34c9ee2eb413c0afbb7d4f23862`
- Analysis Blob SHA: `487e8d4bb9cf21574602ad08baca77bf5fdf48c0`
- Kind: `analysis` / Persisted by: `Human`
- Plan baseline: `main` @ `6edbe10c42fe1ed2d90d222cdaf91870b99bf4c9`（Analyzer の基準と同じ。本計画の `path:line` はすべてこの時点）

本 Task は §7.2 の Work Item（`T-n`、個別の Status・Approval 欄を持つもの）を持たない Task。承認単位は Task 全体。
下の「Work Items」節の `WI-n` は計画上の作業項目の番号であり、§7.2 の Work Item ではない（P-10 と同じ扱い）。

## Artifact Handoff 検証（H-1〜H-8、AGENTS.md §5.2）

Planner が Handoff の記載を信用せず git から再計算した結果。

| # | 確認 | 実行 | 結果 |
| --- | --- | --- | --- |
| H-1 | Source Branch が remote に存在し、Source SHA が到達可能 | `git fetch origin claude/enemy-attack-vis-001-analysis-7y2loi` → 取得成功。`git merge-base --is-ancestor b947026… origin/claude/enemy-attack-vis-001-analysis-7y2loi` → 真（ブランチ先端 = `b9470260fe8ed34c9ee2eb413c0afbb7d4f23862`） | PASS |
| H-2 | Source SHA 時点に Path が存在 | `git cat-file -e b947026…:.ai/reports/ENEMY-ATTACK-VIS-001-analysis.md` → 成功 | PASS |
| H-3 | Source commit の変更が Path の1件だけ | `git diff --name-only b947026…^ b947026…` → `.ai/reports/ENEMY-ATTACK-VIS-001-analysis.md` のみ | PASS |
| H-4 | Path・1行目が Task ID から組み立てた期待値と一致 | Path = `.ai/reports/ENEMY-ATTACK-VIS-001-analysis.md`、1行目 = `# ENEMY-ATTACK-VIS-001 Analysis` | PASS |
| H-5 | Kind が `analysis` で Path が期待 Path | Kind `analysis`、命名例外の適用なし | PASS |
| H-6 | Blob SHA が一致 | `git rev-parse b947026…:.ai/reports/ENEMY-ATTACK-VIS-001-analysis.md` → `487e8d4bb9cf21574602ad08baca77bf5fdf48c0`（Handoff 記載と一致） | PASS |
| H-7 | 同じ `(Task ID, Kind)` の既存記録 | `.ai/tasks/ENEMY-ATTACK-VIS-001.md` は存在しなかった（新規）。二重 Handoff・新版の扱いは発生しない | PASS |
| H-8 | Source SHA の内容だけを読む | `git show b947026…:.ai/reports/ENEMY-ATTACK-VIS-001-analysis.md` で読んだ。ブランチ先端・working tree の同名ファイルは読んでいない | PASS |

Handoff の成立は「どの版を読むか」の確定であり、Analyzer report の内容の承認ではない（§5.2）。

## Human Approval
- [x] Approved
- Approved by / date / where: ユーザー（人間）/ 2026-09-25 / Claude Code の Planner セッション（branch `claude/enemy-attack-vis-001-planner-12pg60`）の会話で「上記Decisionを反映したTask Planを確認し、ENEMY-ATTACK-VIS-001をHuman Approvedとしてください。Approval: [x] Approved」と指示
- Scope of approval: Task 全体（§7.2 の Work Item なし）。WI-1〜WI-6、Files To Change #1〜#7 の範囲（#6 / #7 は D-7 = (a) により含む）。D-4 = Option A により WI-7・Files To Change #8 は含まない。Decisions: D-1 = (b)、D-2 = (b)、D-3 = (a)、D-4 = Option A、D-5 = (a)、D-6 = (b)、D-7 = (a)、D-9 = 壁越し非表示（下の「Decision Record」）
- Persistence: 許可 — 対象ブランチ `claude/enemy-attack-vis-001-impl-jx30t9`（Implementer の commit / push。承認範囲 = Files To Change #1〜#7・#9 と、Human Approval 時点の Analyzer report / Task file）。根拠: ユーザー（人間）/ 2026-09-25 / Implementer セッションの会話で「ENEMY-ATTACK-VIS-001 の Implementer Persistence を正式に許可します。対象branch：claude/enemy-attack-vis-001-impl-jx30t9」と明示。記入: Implementer（人間の指示による）。旧記載: 「未許可（Human による Task file の commit / push 待ち。人間の指示は「HumanによるTask fileのcommit/push待ち」。AI（Planner / Implementer）への commit / push の許可ではない）」

Implementation: BLOCKED — 承認済み版の Human Persistence と Plan Handoff（Kind `plan`、§5.2）が未了。§6 の開始条件「実装に必要な DECISION は決定済み」は 2026-09-25 の決定（D-1〜D-7、D-9）で充足（D-8 は確認のみで本 Task の対象外）。人間の指示により、現時点では実装しない

### Decision Record

| # | 決定 | 決定者 / 日付 / 場所 | 本計画への反映 |
| --- | --- | --- | --- |
| D-4 | **Option A — 別 Task にする**。W1 は Mansion 通常近接敵3種の新規床扇表示だけを対象とする。既存の Boss `startArcSweep` およびプレイヤー崩し斬り（`spawnSweepVFX`）の扇表示方向の問題は今回修正しない。必要なら別 Task として扱う | ユーザー（人間）/ 2026-09-25 / Planner セッションの会話 | WI-7 不採用。Files To Change #8 削除。Out of Scope に追記。Acceptance Criteria 更新 |
| D-9 | **壁の向こうにいてプレイヤーから視認できない敵については、床扇 telegraph を表示しない** | 同上 | WI-3 の表示条件に `en.visLevel === 'visible'` を追加（下の注）。Test Plan / Acceptance Criteria に追加 |
| D-1 | **(b) 外周の弧だけ** | ユーザー（人間）/ 2026-09-25 / Planner セッションの会話（「D-1 = (b) … でHuman Decisionを確定」） | WI-3 のメッシュは `RingGeometry` の弧（外周 = D-3）。塗りの扇・進行度で満ちる表示は作らない |
| D-2 | **(b) heavy（sweep / lash）と guard break だけ** | 同上 | WI-1 `meleeTelegraphShape` は light（使用人 strike / 番人 slam / 執事 candle）で `null`。guard break は heavy（sweep）の plan で振る（F-7）ので sweep と同じ形で表示される。unit U-3 を実施 |
| D-3 | **(a) 外周 = `reach` ちょうど** | 同上 | 弧の外周半径 = `meleeAttackPlan` の `reach`。プレイヤー半径は足さない（R-8 の見え方は残る） |
| D-5 | **(a) 3種用の表示だけを作り、ボスは触らない** | 同上 | 計画どおり。ボス側（`bossVfx` / `telegraphDisc` / `startArcSweep`）に差分を出さない |
| D-6 | **(b) 進行度を表示しない** | 同上 | WI-1 の進行度の小関数は追加しない。unit U-6 は実施しない。弧の不透明度は windup 中一定（R-4 は該当しなくなる） |
| D-7 | **(a) Arena のテスト専用パネルに1行足して表示状態を読む** | 同上 | Files To Change #6 / #7 を含む。E2E E-1〜E-5 を実施 |
| D-8 | 未確認 | － | (b) は Out of Scope（攻撃モーション）。確認のみ |

D-9 の注（Planner による対応付け。人間の文言の解釈を含む）:
FACT: 敵の視界段階は `core/enemy-visibility.js` の `'visible'`（遮蔽なし・索敵距離内）/ `'sensed'`（壁越しで気配だけ分かる。交戦中は壁越しでも `'sensed'` 以上）/ `'hidden'`（壁の向こうで認識もしていない）の3つ（`enemy-visibility.js:8-11,54-65`）。
「壁の向こうにいてプレイヤーから視認できない」には `'sensed'`（壁越し）と `'hidden'` の両方が当たると解釈し、床扇は `en.visLevel === 'visible'` の場合だけ表示する。
Analyzer 選択肢の (b)（`hidden` だけ非表示）より広い。2026-09-25、人間が「現在のPlanでは en.visLevel === 'visible' のみ表示」を確定済み事項として示した（Planner セッションの会話）。

## Objective

Forest Mansion の通常近接敵3種（使用人 `servant` / 番人 `warden` / 執事 `butler`）が攻撃の予兆（windup）に入っている間、
**判定と同じ形（`reach` / `halfAngle`）・同じ向き（`servantFacing`）・同じ原点（`group.position`）の扇を床に描く「見た目だけの表示」** を追加し、
「何が・どこまで・どの向きに来るか」をプレイヤーが読めるようにする。

攻撃判定・AI・state・数値は一切変えない。既存システム（`meleeAttackPlan`、`isProfileMeleeWindup`、`meleeWindupProgress`、`servantFacing`、
`updateMansionMobExtras`、床メッシュの作り方の先例）を読むだけの拡張で行う。

## Request

- 敵の攻撃モーション・攻撃範囲が分かりにくい。第1段階 W1 として「敵攻撃の視認性改善」を行う
- 新しい攻撃システム・新しい攻撃判定は作らない。AI 変更なし。state 変更なし。既存システムを拡張する
- W1 対象は Mansion 通常近接敵3種。予兆中の床扇表示を追加する
- 表示と攻撃判定を分離する。`startArcSweep` はそのまま攻撃処理として流用しない
- 既存表示の向きの問題（Analyzer D-4）は人間判断に委ねる

## Constraints

- `src/core/` は state・THREE・scene に依存しない純粋関数（AGENTS.md §13、`ARCHITECTURE.md`）
- `src/legacy/parts/` は共有スコープの連結。module 化しない。関数名の衝突に注意（Analyzer R-6）
- `core` の関数を legacy から使うには `src/legacy/concat-plugin.js` の import 行へ名前を足す必要がある（FACT: `concat-plugin.js:209` が `core/enemy-profiles.js` を import している）
- `basefile.html` は凍結
- 表示は判定を **読むだけ**。判定・ダメージ・`en.special`・AI 分岐へ書き込まない

## Current Implementation（FACT、Analyzer report 参照）

| 項目 | 現状 | 出典 |
| --- | --- | --- |
| 状態機械 | 3種共通 `updateShadowServantAI`（`07-ai-combat.js:2082-2284`）。`idle → windup → strike → recover`、執事は `shift/fade/emerge` も持つ | F-1, F-2 |
| 判定 | strike 中に1回、`dist <= plan.reach` かつ `abs(angleDiff(servantFacing, bearing)) <= plan.halfAngle`。扇1種類だけ | F-4（`07-ai-combat.js:2183-2187`） |
| 形の出所 | `meleeAttackPlan(kind, en.servantAttack, phase)`（`core/enemy-profiles.js:103`）。執事は `en.butlerPhase` で lash が差し替わる | F-5 |
| 向き | windup 開始時に `en.servantFacing` を固定。規約は `atan2(x, z)`、0 = +Z | F-3, F-20 |
| 予兆状態 | `isProfileMeleeWindup(en)`（`core/enemy-profiles.js:205`、`servantState === 'windup'`）、`punishWindowState`（`core/punish-window.js:46`） | S-6 |
| 進行度 | `meleeWindupProgress`（`core/enemy-profiles.js:137`）。guard break は分母がずれる | F-7, F-8 |
| 3種の予兆表示 | 身体のポーズ（`updateMansionMobExtras` `07-ai-combat.js:1244` → pose 関数）と胴の emissive（`threatHighlight`、`07-ai-combat.js:4178-4191`）だけ。**床の範囲表示は無い** | F-12, F-13, S-8 |
| 床扇の既存先例 | `startArcSweep`（`07-ai-combat.js:3452`、ボス。表示と判定・ダメージ・`en.special` が一体）、`spawnSweepVFX`（`11-combat-actions.js:1246`、プレイヤー事後 VFX）。**どちらもメッシュの向きが判定規約と前後反転**（手計算・three@0.154.0 で確認、実機未確認） | F-19, F-20 |
| 床の高さ | `groundSlabs.length ? groundYAt(x, z, en.group.position.y) : 0` | F-21 |
| 後始末 | 死亡 `finishEnemyDeath`（`:5279`）は `servantState` を戻さず、死亡後は `updateMobAnim` が呼ばれない。Arena clear（`:798-806`）は `scene.remove(en.group)` だけ。世界切り替え（`02-world-common.js:347`）は `en.shockRing` / `en.chargeLane` / `en.group` を remove | F-10, F-22、Planner 確認 |
| スケール | 番人 1.5・執事 1.7 は `g.scale`。判定 `reach` はスケールを掛けない | F-15 |

## Scope

- 対象敵3種: `servant` / `warden` / `butler`（`atkType:'servant'` を共有。他ダンジョンの利用者は無い。S-12）
- 対象状態: `servantState === 'windup'` の間だけ（`isProfileMeleeWindup`）
- 床扇の「見た目だけの表示」の追加（外周の弧（D-1 (b)）・向き・原点・床高さ・後始末。進行度は表示しない（D-6 (b)））
- 形・向きの計算の純粋関数化と unit テスト
- 既存 `threatHighlight`・盾の白熱・ポーズとの共存（既存側は変更しない）
- E2E（D-7 (a): Arena テスト専用パネルの1行で観測）
- 既存2表示（`startArcSweep` / `spawnSweepVFX`）の向きの修正は含まない（D-4 = Option A。WI-7 不採用）

## Out of Scope

- 攻撃力
- 攻撃判定仕様変更（`reach` / `halfAngle` / 判定式 / strike のタイミング）
- AI（`updateShadowServantAI` の分岐・状態遷移）
- 難易度
- telegraph 秒数調整（`SERVANT_ATTACKS` / `WARDEN_ATTACKS` / `BUTLER_ATTACKS` / `GUARD_BREAK_TELEGRAPH_SEC` の数値）
- Boss（館の主 `manorLord`、templeGuardian の `startArcSweep` / `telegraphDisc` の利用側）
- 既存の Boss `startArcSweep` とプレイヤー崩し斬り `spawnSweepVFX` の扇表示方向の問題（F-20）。D-4 = Option A により今回修正しない。必要なら別 Task として扱う
- charge lane（生成箇所の無い残骸。S-11）
- projectile（侍女の影弾など）
- weapon trail
- 攻撃モーション（ポーズ関数・`stretch`。Analyzer D-8 (b) を含む）
- 他ダンジョン
- UI 全体改修（D-7 (a) による Arena テスト専用パネル1行は除く）
- キャラクター歩行モーション
- 武器モデル刷新
- 新しい攻撃システム・新しい判定・新しい AI state・新しい state フィールドのセーブ対象化
- `basefile.html`

## 「見た目だけの表示」と「攻撃判定そのもの」の分離

| 区分 | 何か | 本 Task での扱い |
| --- | --- | --- |
| **攻撃判定（変更しない）** | `updateShadowServantAI` の strike 分岐（`07-ai-combat.js:2182-2187`）の距離・角度判定、ダメージ、`plan` の選択、`servantFacing` の決定（`:2262-2263`、`:2153-2161`）、`servantT` の設定 | 差分を出さない。行の追加・削除もしない |
| **見た目だけの表示（追加する）** | 床扇メッシュ。上の判定が使う値（`meleeAttackPlan` の `reach` / `halfAngle`、`servantFacing`、`group.position`、`servantState`、`servantT`）を **読むだけ** | 判定・ダメージ・`en.special`・`servantState`・`servantT`・`servantFacing` へ書き込まない。表示が無くても（生成失敗・非表示でも）判定の結果は同じ |

一致の保証: 表示の形・向きは判定と **同じ関数・同じフィールド** から取る（値のコピーや別定義を作らない）。
一致の検証: 向きの変換（`servantFacing` → メッシュの回転）を純粋関数にし、unit で「扇の中心方位が `atan2(x, z)` 規約で `servantFacing` と一致する」ことを固定する（WI-1）。

`startArcSweep` / `updateArcSweep` は呼ばない（F-19 / I-6: 判定・ダメージ・`en.special` と一体で、呼べば判定を二重に持つ）。
流用するのは作り方の先例（扇ジオメトリ・透明マテリアル・`depthWrite:false`・`groundYAt` の床高さ）だけで、向きの式は流用しない（F-20 / I-7）。

## Work Items

計画上の作業項目。承認単位は Task 全体（上記）。

### WI-1 形・向きの純粋関数（`src/core/`）

- 対象ファイル: `src/core/enemy-profiles.js`（既存）
- 対象関数: 追加 `meleeTelegraphShape(kind, attack, phase)`（仮名）、`groundFanRotationZ(facing, halfAngle)`（仮名）
- 変更内容:
  - `meleeTelegraphShape`: `meleeAttackPlan(kind, attack, phase)` の `reach` / `halfAngle` をそのまま返す（値を別定義しない）。D-2 = (b) により light（使用人 `strike` / 番人 `slam` / 執事 `candle`）は `null` を返し、heavy（使用人・番人 `sweep`、執事 `lash`）だけ形を返す
  - `groundFanRotationZ`: `rotation.x = -π/2` の `CircleGeometry(r, seg, 0, 2h)` / `RingGeometry(.., 0, 2h)` の中心が `atan2(x, z)` 規約の `facing` を向く `rotation.z` を返す数値関数（THREE 非依存）
    - INFERENCE（Planner の手計算。Rx(-π/2)·Rz(ρ) で局所角 θ の点は方位 `atan2(cos(θ+ρ), -sin(θ+ρ))` へ写る）: 中心が `facing` を向く条件は `ρ = facing - halfAngle - π/2`。既存 `startArcSweep` の `-facing - halfAngle + π/2` とは符号が異なり、F-20 の「中心が `π - f` を向く」と整合する。**実装時に unit で確定させる**（WI-6）
  - 進行度: D-6 = (b) により **追加しない**（進行度を表示しない）
- 理由: 判定の出所（`meleeAttackPlan`）と同じファイルに置き、形の一致を関数1つで保証する。新規ファイルにしないのは、既存の `enemy-profiles.js` が既に「見た目側が使う予兆の進行度」（`meleeWindupProgress`）を持ち、同じ責務の置き場所として再利用できるため
- 変更しないもの: `meleeAttackPlan` / `meleeAttackChoice` / `meleeWindupProgress` / `isProfileMeleeWindup` / 攻撃表

### WI-2 legacy への import 追加

- 対象ファイル: `src/legacy/concat-plugin.js`
- 変更内容: `:209` 付近の `core/enemy-profiles.js` の import 列に WI-1 の関数名を足す（`GUARD_BREAK_TELEGRAPH_SEC` は既に `:50` で import 済み）
- 理由: legacy の共有スコープから core を使う既存の経路。新しい経路は作らない

### WI-3 床扇の表示（見た目だけ）

- 対象ファイル: `src/legacy/parts/07-ai-combat.js`
- 対象関数: 既存 `updateMansionMobExtras`（`:1244`）の末尾（pose 関数の呼び出しの後）から、追加する `updateMansionMeleeTelegraph(en, M, dt)`（仮名）を呼ぶ
- 変更内容:
  - 表示条件: `isProfileMeleeWindup(en)` かつ `M.mansionKind` が `servant` / `warden` / `butler` かつ `meleeTelegraphShape(...)` が `null` でない（D-2）かつ `en.visLevel === 'visible'`（D-9。壁越しで視認できない敵には出さない。`en.visLevel` は既存 `updateEnemyVisibility`（`07-ai-combat.js:4132`）が同じフレームの AI より前（`:875`）に更新する既存フィールドで、読むだけ）
  - 形: `meleeTelegraphShape(M.mansionKind または en.meleeKind, en.servantAttack, en.butlerPhase)`。判定と同じ `phase` の渡し方（`07-ai-combat.js:2089,2182` と同じ式）を使う
  - 向き: `en.servantFacing` を `groundFanRotationZ` に渡す。`en.group.rotation.y` からは取らない（判定の値を直接読む）
  - 原点・高さ: `en.group.position` の x/z、y は `groundYAt`（F-21 の式。上階で埋まる／浮くのを防ぐ。R-5）
  - メッシュ: D-1 = (b) により外周の弧だけ（`RingGeometry(inner, reach, seg, 0, 2*halfAngle)`、`spawnSweepVFX` の「絵の線 = 当たる外周」の先例。弧の幅（inner）は見た目の値で、判定には使わない）。`MeshBasicMaterial({transparent:true, depthWrite:false, side:DoubleSide})`（`telegraphDisc` / `startArcSweep` と同じ作り方）。外周の半径は D-3 = (a) により `reach` ちょうど。不透明度は D-6 = (b) により windup 中一定
  - 配置: `scene` 直下に置き、個体ごとに1つを `en.meleeTelegraphMesh`（仮名）で持って使い回す（毎 windup で生成しない）。`en.group` の子にしない（番人 1.5・執事 1.7 のスケールが掛かり `reach` とずれる。F-15 / I-8 / R-2）
  - 表示の ON/OFF は毎フレーム状態を読んで `visible` を切り替える（I-5）。これにより windup の中断5経路（F-9: `:4775,5244,5259,947,854`）は個別の処理なしで消える
- 理由: `updateMansionMobExtras` は「AI 状態を読んで見た目を置く、AI 側はこの関数を知らない」既存の枠（`07-ai-combat.js:1229-1233` のコメント）で、3種に同時に効き他ダンジョンへ波及しない（I-10）。AI を変えずに済む
- 既存を再利用できない理由（新しい関数を1つ足す理由）: Analyzer「新規システムが必要かどうか」の表のとおり、`startArcSweep`（判定一体・向き反転）、`telegraphDisc`（円のみ・`bossVfx` 前提、`clearBossVfx` が `en.special=null` を行う）、`spawnSweepVFX`（220 ms の事後フェード・位置が `state.pos` 固定・向き反転）、`threatHighlight`（形を持たない）はどれもそのまま呼べない
- `bossVfx` / `clearBossVfx` は使わない（`en.special` を触る・世界切り替えの一括削除が `isBoss` 限定。F-18）

### WI-4 後始末

`scene` 直下のメッシュなので、状態読み取りで消えない経路だけ明示的に処理する（R-3）。

| 経路 | 対象 | 変更内容 |
| --- | --- | --- |
| 死亡 | `07-ai-combat.js` `finishEnemyDeath`（`:5279`） | `en.meleeTelegraphMesh` があれば非表示（または remove）。死亡後は `updateMobAnim` が呼ばれず windup の表示が残るため（F-10） |
| Arena clear | `07-ai-combat.js` `arenaClear`（`:798-806`） | `scene.remove(en.group)` の隣で `en.meleeTelegraphMesh` も remove（F-22） |
| 世界切り替え | `02-world-common.js:347` | 既存の `en.shockRing` / `en.chargeLane` と同じ並びで `en.meleeTelegraphMesh` も remove |
| 100 超の遠方スキップ | `07-ai-combat.js:829` | 変更しない。遠方で windup のまま止まった表示は、プレイヤーが近づけば状態読み取りで更新される。100 超は画面外（INFERENCE） |
| 浮き・硬直中 | `07-ai-combat.js:1015-1037` | 変更しない。`updateMobAnim` は呼ばれるので表示は状態どおり（I-12。ポーズと同じ挙動） |
| 執事 `fade` / `emerge` | － | 変更しない。windup ではないので出ない（I-11） |

- 理由: 既存の後始末の並び（world switch の `shockRing` / `chargeLane`）に1行ずつ足す最小変更。新しい後始末の仕組みは作らない

### WI-5 既存 `threatHighlight` ・盾の白熱・ポーズとの共存

- 対象ファイル: なし（変更しない）
- 内容: `threatHighlight`（`core/enemy-visibility.js:83`、適用 `07-ai-combat.js:4178-4191`）、番人の盾の白熱（`:973-987`）、pose 関数は **変更しない**。床扇は別メッシュで、胴の emissive・盾のマテリアル・身体ノードに触れない
- 確認: 床扇の追加後も `threatHighlight` の windup 値（0.75）が同じ条件で出ること、盾の白熱が同じ条件で出ることを E2E / 目視で確認（WI-6）
- 役割分担（INFERENCE、I-3）: 胴の発光 =「今から来る」、床扇 =「どこまで・どの向きに来る」

### WI-6 テスト

下の Test Plan。

### WI-7（不採用 — D-4 = Option A）既存2表示の向きの修正

**D-4 = Option A により本 Task では実施しない。** 以下は計画時の記録として残す。必要なら別 Task として扱う。


- 対象: `07-ai-combat.js` `startArcSweep` の `m.rotation.z`（`:3467` の1行）、`11-combat-actions.js` `spawnSweepVFX` の `rotation.z`（`:1246` 付近）
- 変更内容: WI-1 の `groundFanRotationZ` を使う式へ置き換える（`RingGeometry` の `thetaStart = π/2 - h` の扱いは合わせて調整）。判定・ダメージ・`en.special`・タイミングは変えない
- Option A が選ばれた場合、WI-7 は本 Task に含めず、別 Task として記録するだけ
- 詳細な影響は下の「Human Decisions」D-4

## Files To Change

| # | ファイル | 関数 / 箇所 | WI | 条件 |
| --- | --- | --- | --- | --- |
| 1 | `src/core/enemy-profiles.js` | 関数追加（`meleeTelegraphShape` / `groundFanRotationZ`。進行度の小関数は追加しない（D-6 (b)）） | WI-1 | 常に |
| 2 | `src/legacy/concat-plugin.js` | `core/enemy-profiles.js` の import 列 | WI-2 | 常に |
| 3 | `src/legacy/parts/07-ai-combat.js` | `updateMansionMobExtras` から呼ぶ表示関数の追加、`finishEnemyDeath`、`arenaClear` | WI-3, WI-4 | 常に |
| 4 | `src/legacy/parts/02-world-common.js` | `:347` の世界切り替え時の remove | WI-4 | 常に |
| 5 | `tests/unit/enemy-profiles.test.js` | WI-1 の unit 追加 | WI-6 | 常に |
| 6 | `tests/mansion-enemies.spec.js` / `tests/mansion-warden.spec.js` / `tests/mansion-butler.spec.js` | 床扇の表示の E2E 追加 | WI-6 | 常に（D-7 = (a)） |
| 7 | `src/legacy/parts/14-training-ground.js` | Arena テスト専用パネル（`:167-168` 付近）に床扇の表示状態を1行 | WI-6 | 常に（D-7 = (a)） |
| 8 | ~~`startArcSweep` / `spawnSweepVFX` の向きの式~~ | － | WI-7 | **対象外**（D-4 = Option A） |
| 9 | `.ai/tasks/ENEMY-ATTACK-VIS-001.md` | Implementation Result・Status・Status History | － | Implementer |

`docs/`（`MANSION_SCENARIO.md` 等）の更新は、D-1〜D-3 の結論が仕様の追記を要すると人間が判断した場合だけ Scope に加える（AGENTS.md §13）。2026-09-25 の決定では追記の指示は無く、現計画では含めない。

## Files Not To Change

- `src/core/mansion-enemies.js`（攻撃表 `SERVANT_ATTACKS` / `WARDEN_ATTACKS` / `BUTLER_ATTACKS`、プロファイル登録、敵定義）
- `src/core/enemy-profiles.js` の既存関数（`meleeAttackPlan` / `meleeHeavyCooldown` / `meleeAttackChoice` / `meleeWindupProgress` / `isProfileMeleeWindup`）
- `src/core/enemy-visibility.js`（`threatHighlight`）
- `src/core/punish-window.js`、`src/core/enemy-facing.js`、`src/core/guardian-break.js`、`src/core/crush-slash.js`
- `src/legacy/parts/07-ai-combat.js` の `updateShadowServantAI`（`:2082-2284`）、pose 関数（`poseShadowServant` / `poseKeyringWarden` / `poseBlackButler`）、盾の白熱（`:973-987`）、ハイライト（`:4166-4199`）、`bossVfx` / `clearBossVfx` / `telegraphDisc` / `startEruption` / `updateArcSweep`、館の主
- `startArcSweep`・`spawnSweepVFX`（D-4 = Option A）
- `src/legacy/parts/11-combat-actions.js`
- `src/core/enemy-visibility.js` の `stepVisibility`（D-9 は既存の `en.visLevel` を読むだけ）
- `src/legacy/parts/06-player-enemy.js`（見た目ノード・state 初期化・スケール）
- `basefile.html`
- Analyzer report（`.ai/reports/ENEMY-ATTACK-VIS-001-analysis.md`）

## Human Decisions

AI（Planner）は決めない。実装前に人間の決定が必要（AGENTS.md §6 の開始条件）。D-1〜D-8 は Analyzer report の DECISION 表、D-9 は Planner が追加した事項。

### D-4: Human Decision Required

**既存2つの床扇表示（ボスの `startArcSweep`、プレイヤー崩し斬りの `spawnSweepVFX`）の向きのずれ（F-20）を、W1 で修正するか、別 Task にするか。**

前提（FACT / INFERENCE）:
- 両者とも扇の中心が方位 `π - f` を向き、判定の向き `f`（`atan2(x, z)`）と一致するのは `f = ±π/2` のときだけ（F-20。手計算と three@0.154.0 のスクリプトで確認、**実機画面では未確認**。U-1）
- W1 で新しく作る3種の床扇は、どちらの Option でも **判定と一致する正しい向き** で作る（WI-1 / WI-3）。D-4 が決めるのは既存2表示の扱いだけ

| | Option A: W1 では触らず、別 Task として記録（Analyzer D-4 (a)） | Option B: W1 に含めて直す（Analyzer D-4 (b)） |
| --- | --- | --- |
| 変更範囲 | Files To Change #1〜#7 のみ。WI-7 なし | #1〜#7 に加え #8（`startArcSweep` 1行、`spawnSweepVFX` の回転と `thetaStart`） |
| Scope との関係 | 依頼の Out of Scope（Boss）とそのまま整合 | Boss（templeGuardian）の表示とプレイヤー崩し斬りの VFX に差分が出る。依頼の Out of Scope「Boss」への **例外を人間が明示する必要がある** |
| 判定・ダメージへの影響 | なし | なし（メッシュの回転だけ。`updateArcSweep` の判定・`crushSlashHit` は変えない） |
| 見た目の整合 | ゲーム内で「正しい向きの扇（3種）」と「前後反転しうる扇（ボス・崩し斬り）」が並存する。プレイヤーが既存の扇で覚えた読み方と、W1 の扇の読み方が食い違う可能性（INFERENCE） | 床扇の向きの規約がゲーム全体で1つに揃う |
| テスト | 既存の床 telegraph を見るテストは無い（S-13）。追加不要 | ボス・崩し斬りの向きを確かめるテストが新たに要る（unit で式、E2E / 目視で実機）。templeGuardian は Arena に無い場合、E2E の出し方の調査が追加で要る（未調査） |
| リスク | 別 Task が起票されず放置されるリスク。U-1 未確認のまま | U-1（実機でどう見えるか）未確認のまま Boss の見た目を変える。崩し斬りは `MANSION_SCENARIO.md:355-359` の「VFX は判定と同じ角度・同じ射程」方針にかかわる |
| レビュー | W1 の差分が3種の表示に閉じ、Reviewer の Scope 確認が単純 | 差分が3種以外（Boss・プレイヤー）に及び、Scope compliance（§12 #2）の確認対象が増える |
| 連動する決定 | D-5 は (a) と整合 | D-5 (b)（共通関数化）と組み合わせやすいが、D-5 (b) もボス側の差分になる |

補足: Analyzer の D-4 には (c)「実機で再現を確認してから決める」もある（先に U-1 の確認手段が要る）。(c) を選ぶ場合、W1 は Option A と同じ範囲で進められるかどうかも人間が決める。

Planner はどちらも推奨として確定しない。

**Decision（人間、2026-09-25）: Option A — 別 Task にする。** 上の「Decision Record」。

### その他の Human Decisions

| # | 決めること | 選択肢（Analyzer） | 影響 / 本計画への反映 | 実装前に必須か |
| --- | --- | --- | --- | --- |
| D-1 | 範囲の見せ方 | (a) 塗りの扇 (b) 外周の弧だけ (c) 扇＋進行度で満ちる表示 | WI-3 のジオメトリ（`CircleGeometry` / `RingGeometry`）と不透明度の扱いが決まる。(c) は D-6 が必須 | **決定済み: (b)** |
| D-2 | 対象の攻撃 | (a) 3種の light / heavy 全部 (b) heavy（sweep / lash）と guard break だけ | WI-1 `meleeTelegraphShape` が `null` を返す攻撃が決まる。(a) なら使用人 strike（0.34 s、2.05）にも出る | **決定済み: (b)** |
| D-3 | 表示の外周 | (a) 外周 = `reach` ちょうど (b) プレイヤー半径ぶんを考慮 | (a) 判定と数値が完全一致。(b) 表示の値が判定とずれる（I-9 / R-8）。Acceptance Criteria の「形状一致」の定義が変わる | **決定済み: (a)** |
| D-4 | 既存2表示の向き | 上記 Option A / Option B（(c) 補足） | WI-7 の有無、Files To Change #8、Out of Scope の例外 | **決定済み: Option A** |
| D-5 | ボス telegraph と共通化するか | (a) 3種用だけ (b) 床扇メッシュ生成を共通関数にしボスも使う | 本計画は (a) を前提に書いている。(b) を選ぶとボス側差分（Out of Scope「Boss」の例外が必要）。D-4 と連動 | **決定済み: (a)** |
| D-6 | guard break の進行度（F-8） | (a) `GUARD_BREAK_TELEGRAPH_SEC` を分母にする（盾の白熱と同じ） (b) 進行度を表示しない | WI-1 の進行度関数の有無。D-1 が (a) / (b) で進行度を使わず、D-2 で guard break を含めても進行度表示が無いなら不要 | **決定済み: (b)** |
| D-7 | E2E で何を検証するか | (a) Arena のテスト専用パネルに1行足して表示状態を読む (b) スクリーンショット比較 (c) unit のみ | Files To Change #6 / #7 の有無。(a) は既存の観測方法（`#arena-enemy-info`、F-24）に沿う | **決定済み: (a)** |
| D-8 | 使用人 sweep の見た目のリーチのずれ（I-2） | (a) 床表示だけで補う (b) ポーズの `stretch` を合わせる | 依頼の Out of Scope「攻撃モーション」により (b) は本 Task に含めない。人間の確認のみ | 確認のみ |
| D-9 | 視界 `hidden`（LoS で完全に隠れた敵）の床扇（Planner 追加）。**決定: 壁越しで視認できない敵には表示しない（`en.visLevel === 'visible'` のみ表示）** | (a) 視界に関係なく windup 中は出す (b) `en.visLevel` が `hidden` なら出さない（`threatHighlight` と同じ扱い） | FACT: `threatHighlight` は `vis.level` を入力に持ち（`07-ai-combat.js:4181-4184`）、`xrayShells` は `hidden` で消える（`:4155-4158`）。(a) は壁越しの敵の位置が床扇で分かる（探索の「気配」方針とかかわる）。(b) は既存の視界方針と揃う | **決定済み** |

## Test Plan

AGENTS.md §14。Test Scope は **Targeted**（変更の影響経路の unit と Mansion 3種の E2E）を基本とし、実行しなかったものは理由を書く。可能なら Full Regression も実行する。

### build

- `npm run build` が通る（`concat-plugin.js` の import 追加・legacy の関数名衝突が無い。R-6）

### unit（`npm run test:unit`、`tests/unit/enemy-profiles.test.js` に追加）

| # | 確かめること |
| --- | --- |
| U-1 | `meleeTelegraphShape` の `reach` / `halfAngle` が `meleeAttackPlan` と一致する（3種 × light / heavy。F-6 の値: 使用人 2.05/1.00・3.30/1.60、番人 2.95/1.05・3.90/1.85、執事 2.55/1.00・3.60/1.25） |
| U-2 | 執事 phase 2 の lash が 4.60 / 1.35 になる（`meleeAttackPlan` の phase 差分と一致） |
| U-3 | light（使用人 `strike` / 番人 `slam` / 執事 `candle`）は `null`、heavy（`sweep` / `lash`、執事 phase 2 を含む）は形を返す（D-2 = (b)） |
| U-4 | `groundFanRotationZ(f, h)` で回した扇の中心方位（Rx(-π/2)·Rz(ρ) を数値で適用して `atan2(x, z)`）が `f` と一致する。`f` = 0, π/2, -π/2, π, 0.70, 2.50, -1.20（Analyzer F-20 のサンプルを含む） |
| U-5 | 扇の両端の方位が `f ± h` になる |
| U-6 | （実施しない。D-6 = (b) により進行度の関数を追加しないため） |
| U-7 | 既存 unit（`mansion-enemies` / `mansion-warden` / `mansion-butler` / `enemy-profiles` / `punish-window` / `enemy-visibility`）が変わらず通る（数値・判定・ハイライトに差分が無いことの回帰） |

### E2E（`npm test`、Arena の `Manor Servant` / `Manor Warden` / `Manor Butler`。F-23 / F-24）

D-7 = (a)（Arena テスト専用パネルの1行で表示状態を読む）:

| # | 確かめること |
| --- | --- |
| E-1 | 3種それぞれ、heavy の `AI State: WINDUP (sweep / lash)`（番人の guard break を含む）の間に床扇の表示状態が ON で、形（reach / halfAngle）がその攻撃の値になる。light の `WINDUP (strike / slam / candle)` の間は OFF（D-2 = (b)） |
| E-2 | windup を抜けた後（STRIKE / RECOVER / IDLE）は OFF |
| E-3 | 敵の撃破後に OFF、Arena clear 後にメッシュが残らない |
| E-4 | 壁越しで視認できない（`visLevel` が `visible` でない）敵は windup 中でも床扇が OFF（D-9）。Arena で遮蔽を作れない場合は unit / 目視で代替し、Test Report に記録 |
| E-5 | 既存 spec（`mansion-enemies.spec.js` / `mansion-warden.spec.js` / `mansion-butler.spec.js`）が変わらず通る（ダメージ・予兆・ハイライトの回帰） |

- windup（最短 0.34 s）は swiftshader で捕まえにくいので、既存 spec と同じ「観測を貯める」方式（`tests/mansion-enemies.spec.js:73-89`）で書く（R-7）

### 目視（実機、自動化しない）

- 暗い洋館で床扇が見えるか（R-9）、3〜4体が重なる部屋で読めるか（R-10）、上階で床に埋まらない／浮かないか（R-5）
- 番人（1.5）・執事（1.7）で表示の外周が判定の `reach` と一致する（スケールが掛かっていない。R-2）
- 結果は Test Report に記録。実行できなければ NOT_RUN と理由

## Acceptance Criteria

- [ ] 3種の heavy（`sweep` / `lash`。guard break を含む）の windup 中だけ床扇（外周の弧）が表示される。light の windup では表示されない。windup 以外の状態・他の敵・他ダンジョンでは表示されない
- [ ] 表示の形は `meleeAttackPlan`（執事は phase 込み）の `reach` / `halfAngle`、向きは `servantFacing`、原点は `group.position` から取っている（別定義・コピーが無い）
- [ ] 表示の中心方位が判定の向き規約（`atan2(x, z)`、0 = +Z）で `servantFacing` と一致することが unit で固定されている
- [ ] 弧の外周が `reach` ちょうど（D-3 = (a)）で、番人・執事のスケールが掛かっていない
- [ ] windup の中断5経路・死亡・Arena clear・世界切り替えで表示が残らない
- [ ] `updateShadowServantAI`・攻撃表・`threatHighlight`・pose 関数・盾の白熱に差分が無い（判定・AI・state・数値・既存の予兆表示が不変）
- [ ] `startArcSweep` / `updateArcSweep` / `bossVfx` / `clearBossVfx` を3種の表示から呼んでいない
- [ ] `startArcSweep` / `spawnSweepVFX`（`11-combat-actions.js` を含む）に差分が無い（D-4 = Option A）
- [ ] 壁越しで視認できない敵（`en.visLevel !== 'visible'`）には床扇を表示しない（D-9）。`stepVisibility` / `threatHighlight` に差分が無い
- [ ] ボス側（`bossVfx` / `clearBossVfx` / `telegraphDisc` / `startArcSweep`）に差分が無い（D-5 = (a)）
- [ ] 進行度の表示・進行度の関数が無く、弧の不透明度は windup 中一定（D-6 = (b)）
- [ ] build / unit / E2E（D-7 = (a) の Arena パネル経由）が PASS。FLAKY / NOT_RUN は §14 どおり記録

## Risks

| # | リスク | 対策 |
| --- | --- | --- |
| R-1 | 既存の扇の向きの式を流用すると判定と前後反転する（F-20） | WI-1 の純粋関数と U-4 で固定。既存の式はコピーしない |
| R-2 | `en.group` の子にするとスケールで表示が大きくなる（F-15） | `scene` 直下に置く（WI-3） |
| R-3 | `scene` 直下のメッシュが死亡・Arena clear・世界切り替えで残る | WI-4 の3箇所 |
| R-4 | guard break の進行度が最初 0 のまま（F-8） | D-6 = (b) により進行度を表示しないため該当しない |
| R-5 | 上階で床に埋まる／浮く | `groundYAt`（F-21） |
| R-6 | legacy の関数名衝突 | 固有の接頭辞（`mansionMelee…` 等）。build で確認 |
| R-7 | E2E で windup を捕まえにくい | 観測を貯める方式 |
| R-8 | 外周 = `reach` でも「身体がかかっているのに当たらない」見え方が残る（I-9） | D-3 |
| R-9 | 暗い洋館での視認性（外周の弧だけ = D-1 (b) は塗りより情報量が少ない） | 目視 |
| R-10 | 複数体で表示が重なる | 目視 |
| R-11 | 毎 windup のメッシュ生成でジオメトリが増える（Planner 追加、INFERENCE） | 個体ごとに1つを使い回す。形が変わるとき（攻撃・phase の切り替え）だけジオメトリを作り直し、古いものは `dispose` する |
| R-12 | 既存扇（ボス・崩し斬り）と新規扇の向きの読み方が食い違う（D-4 = Option A の帰結） | 別 Task として扱う（人間の判断で起票） |
| R-13 | `en.visLevel` は LoS 判定の間隔・予算（`07-ai-combat.js:4136-4148`）で更新が遅れうるため、遮蔽に出入りした直後は床扇の ON/OFF が数フレーム遅れる（INFERENCE） | 既存 `threatHighlight` と同じ遅れ。目視で確認 |

## Rollback

- 追加は表示だけで、判定・AI・state・セーブ形式に差分が無い。Files To Change #1〜#7 の差分を revert すれば元の挙動に戻る
- 表示関数の呼び出し（`updateMansionMobExtras` 末尾の1行）を外すだけでも無効化できる

## Unknowns

- U-1（Analyzer）: F-20 の前後反転が実機の画面でどう見えるか。未確認。D-4 にかかわる
- U-3（Analyzer）: 影腕の見た目のリーチの正確な値（I-2 は概算）。D-8 は本 Task では扱わない
- P-U1（Planner）: `groundFanRotationZ` の式（`facing - halfAngle - π/2`）は Planner の手計算と scratch の数値確認（node、7方位で誤差 0）による INFERENCE。three の実メッシュ・実機では未確認。WI-6 の U-4 で確定させる
- P-U2（Planner）: templeGuardian を E2E で出す手段。D-4 = Option A により本 Task では不要

## Next

1. （完了）人間: D-1〜D-7・D-9 を決定（2026-09-25）
2. 人間: 承認済み版の Task file を Persistence（Task file 1ファイルだけの commit、amend / force push しない）し、Plan Handoff（Kind `plan`）を Implementer へ渡す（AGENTS.md §5.2）
3. Implementer: H-1〜H-8 を検証してから WI-1〜WI-6 を実装する（WI-7 は D-4 = Option A により実施しない）

## Status History
| Date | Target | From → To | By | Note |
| --- | --- | --- | --- | --- |
| 2026-09-25 | Task | (new) → PLANNED | Planner | Artifact Handoff H-1〜H-8 PASS（analysis `b9470260fe8ed34c9ee2eb413c0afbb7d4f23862` / blob `487e8d4bb9cf21574602ad08baca77bf5fdf48c0`）。計画作成 |
| 2026-09-25 | Task | PLANNED → WAITING_APPROVAL | Planner | D-1〜D-9 を Human Decisions として列挙（D-4 は Human Decision Required）。Human Approval 未記入・Persistence 未承認。commit / push なし |
| 2026-09-25 | Task | WAITING_APPROVAL → APPROVED | Human（記入: Planner） | Human Approval（Planner セッションの会話）。Decisions: D-4 = Option A（別 Task）、D-9 = 壁越し非表示。Persistence: PENDING（Human による Task file の commit / push 待ち）。未決定: D-1 / D-2 / D-3 / D-5 / D-7（D-6 条件付き）。実装・commit・push なし |
| 2026-09-25 | Task | APPROVED → APPROVED（Status 変更なし） | Human（記入: Planner） | Human Decision 確定: D-1 = (b)、D-2 = (b)、D-3 = (a)、D-5 = (a)、D-6 = (b)、D-7 = (a)。承認範囲（WI-1〜WI-6、Files To Change #1〜#7）内の条件の確定で、範囲の拡大なし。Persistence: PENDING。実装・commit・push なし |
| 2026-09-25 | Task | APPROVED → IMPLEMENTING | Implementer | Plan Handoff（Kind `plan`、`47785709da12ce0ceab028235b0310a74327f654` / blob `987a90611efe90b0a0ec8e6cbc3a6303202704eb`）H-1〜H-8 PASS。作業ブランチ `claude/enemy-attack-vis-001-impl-jx30t9`（base `main` @ `6edbe10c42fe1ed2d90d222cdaf91870b99bf4c9`） |
| 2026-09-25 | Task | IMPLEMENTING → TESTING | Implementer | WI-1〜WI-6 実装完了。build PASS / unit PASS / E2E NOT_RUN（Playwright browser revision mismatch）。Persistence 未許可のため commit / push なし・`REVIEWING` にしない（§7.3）。Branch: `claude/enemy-attack-vis-001-impl-jx30t9`（未 push） |
| 2026-09-25 | Task | TESTING → REVIEWING | Implementer | Human による Persistence 許可（Implementer セッションの会話、対象ブランチ `claude/enemy-attack-vis-001-impl-jx30t9`）。Approval 欄の Persistence を許可へ更新（人間の指示）。実装一式を1コミットで commit・push。Branch: `claude/enemy-attack-vis-001-impl-jx30t9`。E2E は NOT_RUN（Chromium revision mismatch）のまま |

## Implementation Result

### Artifact Handoff
| Kind | Path | Source（branch @ SHA） | Blob SHA | 確認（I-1 / H-1〜H-8） |
| --- | --- | --- | --- | --- |
| plan | `.ai/tasks/ENEMY-ATTACK-VIS-001.md` | `claude/enemy-attack-vis-001-planner-12pg60` @ `47785709da12ce0ceab028235b0310a74327f654` | `987a90611efe90b0a0ec8e6cbc3a6303202704eb` | H-1: `git fetch` 成功、ブランチ先端 = Source SHA。H-2: Path 存在。H-3: `git diff --name-only 4778570^ 4778570` = Task file のみ。H-4: 1行目 `# ENEMY-ATTACK-VIS-001`。H-5: Kind `plan`。H-6: `git rev-parse` = Blob SHA 一致。H-7: 既存 Implementation Result なし。H-8: `git show <Source SHA>:<Path>` のみ読んだ。`Status: APPROVED`・`[x] Approved` 確認。I-1: `git show` で復元し `git hash-object` = `987a9061…` 一致（編集前）。I-3: 変更は `Status:` 行・Status History 行追加・本節のみ。すべて PASS |
| analysis | `.ai/reports/ENEMY-ATTACK-VIS-001-analysis.md` | `claude/enemy-attack-vis-001-analysis-7y2loi` @ `b9470260fe8ed34c9ee2eb413c0afbb7d4f23862` | `487e8d4bb9cf21574602ad08baca77bf5fdf48c0` | I-1: `git show` で復元し `git hash-object` = Blob SHA 一致（working tree に配置。未 commit） |

### Changed Files
| ファイル | 変更 |
| --- | --- |
| `src/core/enemy-profiles.js` | 追加 `meleeTelegraphShape(kind, attack, phase)`（`meleeAttackPlan` の `reach` / `halfAngle` をそのまま返す。heavy 以外は `null`）、`groundFanRotationZ(facing, halfAngle)`（`facing - halfAngle - π/2`）。既存関数は無変更。進行度関数は追加しない（D-6） |
| `src/legacy/concat-plugin.js` | `core/enemy-profiles.js` の import 列に `meleeTelegraphShape`, `groundFanRotationZ`, `isProfileMeleeWindup` を追加 |
| `src/legacy/parts/07-ai-combat.js` | `updateMansionMobExtras` 末尾から新規 `updateMansionMeleeTelegraph(en, M)` を呼ぶ（servant / warden / butler、`isProfileMeleeWindup`、`en.visLevel === 'visible'`、heavy のみ）。`RingGeometry(reach-0.14, reach, 32, 1, 0, 2h)` の弧、`MeshBasicMaterial(transparent, opacity 0.55 一定, depthWrite:false, DoubleSide)`、scene 直下・個体ごと1つを `en.meleeTelegraphMesh` で使い回し、形が変わる時だけ geometry を作り直して旧 geometry を `dispose`。`arenaClear` で remove、`finishEnemyDeath` で非表示 |
| `src/legacy/parts/02-world-common.js` | 世界切り替え（`:347`）で `en.meleeTelegraphMesh` を remove |
| `src/legacy/parts/14-training-ground.js` | Arena 敵情報パネルに1行 `Floor Arc: ON reach <r> half <h>` / `OFF`（`atkType === 'servant'` の敵のみ） |
| `tests/unit/enemy-profiles.test.js` | U-1〜U-5 を追加 |
| `tests/mansion-enemies.spec.js` / `tests/mansion-warden.spec.js` / `tests/mansion-butler.spec.js` | E-1 / E-2（各1テスト。AI State と Floor Arc を同じ1回の読み取りで組にして貯める方式） |
| `.ai/tasks/ENEMY-ATTACK-VIS-001.md` | `Status:` 行・Status History 行追加・本節 |

### Test Report
- Scope: Targeted（unit は全件実行 = `npm run test:unit`）
- Executed: `npm run build`、`npm run test:unit`、`npx playwright test tests/mansion-warden.spec.js -g "強モブとして認識"`（環境確認）、`npx playwright test --list`（3 spec の構文確認。17 tests 列挙、追加3件を含む）、補助: three@0.154.0（`node_modules`）の `RingGeometry` + `rotation.x=-π/2` + `rotation.z=groundFanRotationZ(f,h)` の実メッシュで中心方位を 21 通り（h 3種 × f 7種）計算し最大誤差 2.2e-16（scratchpad のスクリプト、リポジトリ外）
- Why this scope: 変更は Mansion 近接3種の表示と core の純粋関数2つ。unit は回帰を含め全件。E2E は対象3 spec
- Not run: E2E 全件（E-1〜E-5）— Playwright の既知の browser revision mismatch（`Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1234/...`）。指示によりコード・設定を変更せず NOT_RUN。E-3（撃破後 / Arena clear 後）・E-4（壁越し）は Arena パネルが死亡した敵・遮蔽を扱えないため E2E を書いていない（FACT (code) で代替。下の AC 表）。目視（R-2 / R-5 / R-9 / R-10 / R-13）NOT_RUN（実機なし）
- Environment: 回避策なし

| テスト | 結果（PASS / FAIL / FLAKY / NOT_RUN） | メモ |
| --- | --- | --- |
| build（`npm run build`） | PASS | 既存の chunk size 警告のみ |
| unit（`npm run test:unit`） | PASS | 1495 / 1495。U-1〜U-5 追加分、U-7 既存回帰を含む |
| E2E E-1 / E-2（追加3テスト） | NOT_RUN | browser revision mismatch。`--list` で読み込みのみ確認 |
| E2E E-3 | NOT_RUN | パネルが死亡した敵を表示しないため E2E 化せず。FACT (code) |
| E2E E-4 | NOT_RUN | Arena で遮蔽を作れない。FACT (code) |
| E2E E-5（既存 spec 回帰） | NOT_RUN | browser revision mismatch |
| 目視 | NOT_RUN | 実機なし |

### Acceptance Criteria
| AC | 確認方法（VERIFIED / FACT (code)） | 根拠 |
| --- | --- | --- |
| heavy（guard break 含む）の windup 中だけ弧、light・他状態・他敵では出ない | VERIFIED（unit U-3）/ FACT (code) | `meleeTelegraphShape` が light で `null`（U-3）。表示条件は `MANSION_MELEE_TELEGRAPH_KINDS[M.mansionKind]` かつ `isProfileMeleeWindup`。guard break は `servantAttack = prof.heavy`（`07-ai-combat.js` の既存 `pick`）。E2E は NOT_RUN |
| 形・向き・原点を判定と同じ出所から取る | FACT (code) | 形 = `meleeTelegraphShape`→`meleeAttackPlan`（`en.meleeKind \|\| 'servant'`、`en.butlerPhase \|\| 1` = 判定と同じ式）、向き = `en.servantFacing`、原点 = `en.group.position` |
| 中心方位が `servantFacing` と一致（unit で固定） | VERIFIED | U-4 / U-5、three@0.154 実メッシュでも一致 |
| 外周 = `reach`、スケール非適用 | VERIFIED（U-1 / U-2）/ FACT (code) | `RingGeometry(..., reach, ...)`、`scene.add`（`en.group` の子にしない） |
| 中断5経路・死亡・Arena clear・世界切り替えで残らない | FACT (code) | 毎フレーム状態読み取りで `visible` 切替。`finishEnemyDeath` で非表示、`arenaClear` / 世界切り替えで remove |
| `updateShadowServantAI`・攻撃表・`threatHighlight`・pose・盾の白熱に差分なし | FACT (code) | `git diff` の hunk は上記 Changed Files の箇所のみ |
| `startArcSweep` / `updateArcSweep` / `bossVfx` / `clearBossVfx` を呼ばない | FACT (code) | `updateMansionMeleeTelegraph` 内に呼び出しなし |
| `startArcSweep` / `spawnSweepVFX`・`11-combat-actions.js` に差分なし | FACT (code) | `git diff --stat` に含まれない |
| `visLevel !== 'visible'` に出さない、`stepVisibility` / `threatHighlight` 差分なし | FACT (code) | 表示条件 `en.visLevel === 'visible'`。`src/core/enemy-visibility.js` 差分なし |
| ボス側差分なし | FACT (code) | 同上 |
| 進行度表示・関数なし、不透明度一定 | FACT (code) | opacity 0.55 固定、進行度関数の追加なし |
| build / unit / E2E PASS | 一部 | build / unit PASS、E2E NOT_RUN（環境） |

### Out of Scope Found
- なし
