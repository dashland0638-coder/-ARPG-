# AI Agent Operating Protocol

このファイルは AI エージェント運用ルールの **唯一の正本（Single Source of Truth）** である。
`.ai/agents/*.md` は各役割の入出力テンプレートだけを持ち、ルールはここを参照する。
`.ai/tasks/` `.ai/reports/` `.ai/decisions/` の README は命名とテンプレートだけを持つ。

同じルールを他のファイルへ書き写さない。変更はここで行う。

## 0. Operating Mode: Autonomous Execution + Human Escalation

標準の運用モードは **Autonomous Execution**（DEC-002）。

- **Human は WHAT / Goal を与える。Agent は HOW を決める。**
- Orchestrator（`.ai/agents/orchestrator.md`）が Goal を受け、Analyzer → Planner → Implementer → Tester → Reviewer を **途中の Human 承認なしで** 連続実行し、完成成果物を Human へ報告する（§4）
- Human への質問は通常動作ではなく **Escalation**（§17）。トリガーに当たる場合だけ発生させる
- 既存仕様・Decision Record・コード・テストから判断できることを Human に質問しない。実装詳細の選択肢を Human に選ばせない（§17.1）
- Agent の重要な判断は Agent Decision として記録し、同じ問題で再び質問しない（§18）

`.ai/agents/*.md` や既存の Task・report に残る「Human Approval を待つ」「人間へ報告して止まる」等の記述は、§6.2 で運用する承認単位を除き、**Agent Approval（Escalation Check つき。§6.1）** または **Escalation（§17）** と読み替える。
Human が依頼文で明示的に段階承認（例:「計画を見せてから実装して」）を求めた場合は、その Task に限り従来の Human Approval Gate（§6.2）で運用する。

---

## 1. Purpose

`.ai/` は AI による開発作業の状態・分析・計画・判断記録を管理する。

ゲーム本体の仕様は `docs/` が正とする。`.ai/` はゲーム仕様を置き換えない。
（`docs/` に無い事項は、ルート直下の `ARCHITECTURE.md` / `COMBAT_DESIGN.md` / `MANSION_SCENARIO.md` などを参照する。）

## 2. Source of Truth

優先順位:

1. 現在の実装（コード・テスト）
2. `docs/` の正式仕様
3. `.ai/decisions/` の明示的な決定事項
4. `.ai/tasks/` の作業指示
5. AI 自身の推測

不明点を根拠なしの推測で埋めない。まず §17.2 の Resolution Order で調査し、上位のソースから導ける判断は Agent が行って記録する（§18）。
矛盾は、上位のソースで解消できるもの（実装と古い docs のずれ等）は Agent が解消して記録する。
仕様同士（`docs/` と `.ai/decisions/` 等）が矛盾し、どちらを優先するか上位ソースから判断できない場合だけ Escalation する（§17）。

---

## 3. Rule 0: Existing System First（最重要）

**新しいシステムを作る前に、既存の同等・類似機能を必ず検索・確認する。**

手順（この順番で行う）:

1. 同じ機能が存在しないか検索する
2. 類似機能が存在しないか検索する
3. 既存機能を拡張できないか検討する
4. 既存のデータ構造・state・イベント・UI・テストを確認する
5. 再利用できない理由を明文化する
6. それでも必要な場合のみ新規実装する

優先して検索する対象:

| 分類 | 例 |
| --- | --- |
| state | `src/core/state.js`、`state.*` のフィールド |
| existing systems | `src/core/*.js`、`src/legacy/parts/*.js` の同名・類似関数 |
| event handlers | 近接/部屋イベント、会話、演出（`playCutscene` 等） |
| UI | `index.html`、HUD、オーバーレイ、テストモード画面 |
| scenario flow | `SCENARIO_DEFS`、`launchScenario`、Chapter 1 進行（`core/chapter1-*.js`） |
| test mode | `beginTestMode`、`state.testMode`、`state.debugMode`、Combat Test Arena |
| existing tests | `tests/*.spec.js`、`tests/unit/`、`tests/helpers.js` |
| helper functions | `tests/helpers.js`、`src/core/` の純粋関数 |
| VFX / animation | `src/render/`、`05-rendering-rig.js`、`core/ult-clips.js` 等 |
| AI behavior | `07-ai-combat.js`、`core/enemy-*.js`、ゲスト/仲間AI |
| save/load | `09-save-load.js`（`snapshot` / `applySaveData`） |
| progression | `scenarioClears`、`core/chapter1-progress.js`、スキル習得 |

**記録の義務**: 「存在しないと思う」は不可。Analyzer のレポートには
「〇〇を `検索語` で検索した結果、存在しないことを確認した（対象: パス）」の形で、
検索語と範囲を残す。

## 4. Standard Workflow

```
Human                           … Goal / WHAT だけを示す
  ↓
Orchestrator / Entry Point      … Task 起票・Context Loader・各段の起動とループ制御（§0）
  ↓
Context Loader                  … AGENTS.md・関連 Decision Record・Task・report・docs を読む（§17.2）
  ↓
Analyzer                        … 調査・問題定義（READ ONLY）
  ↓
Planner                         … 実装計画 + Escalation Check → Agent Approval（§6）
  ↓
Implementer                     … 承認済み範囲を実装
  ↓
Tester                          … build / unit / E2E（§14）
  ↓
commit / push → Review Handoff  … 成果物を作業ブランチへ残して渡す（§5.1 / §7.3 / §6.1）
  ↓
Reviewer                        … 独立した検証（READ ONLY）
  ↓
PASS → DONE → Final Report（§19）→ Human は最終確認
  │
  ├─ テスト失敗   → Debugger → Implementer → Tester（§9: 最大3サイクル）
  ├─ Review 指摘  → Implementer → Tester → Reviewer（§9.1 Review Fix Loop: 最大3回、自動）
  └─ 上限超過・Escalation トリガー → Escalation（§17）→ Human
```

各段は成果物（Markdown）を残してから次へ渡す。前の段の成果物が無いまま次の段を始めない。
段と段の間で Human の確認を待たない。Orchestrator が次の段を起動する（`.ai/agents/orchestrator.md`）。

Implementer → Reviewer と Reviewer → DONE の受け渡しでは、「残す」は **作業ブランチへ commit・push し、remote から取得できる状態にすること** を指す（§7.3）。
working tree にだけある成果物は、受け渡し済みとみなさない。

Analyzer → Planner（Analyzer report）と Planner → Implementer（承認済み Task file）の受け渡しでは、
「残す」は **§5.2 の Artifact Handoff が成立していること** を指す。

## 5. Roles and Permissions

| Role | 責務 | 入力 | 出力 | 変更権限 | 次工程 |
| --- | --- | --- | --- | --- | --- |
| Human | Goal 定義・大きな仕様とゲームデザインの決定・Escalation への回答・最終確認 | Final Report / Escalation | Goal、Escalation への回答（`.ai/decisions/` に記録される） | 全権（判断） | Orchestrator |
| Orchestrator | Entry Point。Task 起票、Context Loader、各段の起動、ループ回数の管理、Escalation と Final Report | Human の Goal | Task file の起票・Status 更新、Final Report（§19） | `.ai/` の Task / report の persist と Status 更新のみ（コードは変えない） | Analyzer |
| Analyzer | 調査・問題定義（原因・制約・変更範囲） | Task / Goal | `.ai/reports/<ID>-analysis.md` | **READ ONLY**（書くのはレポートだけ） | Planner |
| Planner | 実装計画・Escalation Check・Agent Approval | Analysis | `.ai/tasks/<ID>.md`（計画・Agent Decisions・Approval） | **原則 READ ONLY**（書くのは Task だけ） | Implementer（Escalation 時は Human） |
| Implementer | 承認済み Task の実装 | APPROVED な Task / Review の Required Changes | コード・テスト・Task の実装結果欄、Review Handoff（§5.1） | Task の Files To Change の範囲のみ | Tester |
| Tester | build / unit / lint / E2E の実行と結果判定（§14） | 実装後の working tree | Implementation Result の Test Report | **READ ONLY**（テストの実行のみ。修正は Implementer） | Reviewer（FAIL → Debugger） |
| Reviewer | 仕様適合・回帰・テストの独立検証 | Review Handoff（§5.1）が指す Task / diff / テスト結果 | `.ai/reports/<ID>-review.md`（CHANGES_REQUIRED なら具体的な Required Changes） | **READ ONLY**（書くのは review report と Task の Status 更新だけ。§7.3） | DONE / Implementer（§9.1） |
| Debugger | 失敗の原因分析と修正案 | 失敗ログ / diff | `.ai/reports/<ID>-debug.md` | 原則 READ ONLY（修正は Implementer が行う。単独運用で兼務する場合も §9 の上限に従う） | Implementer → Tester |

各役割の禁止事項:

- **Orchestrator**: 自分でコード・計画・レビュー判定を書かない。段を飛ばさない。ループ上限（§9 / §9.1）を超えて回さない。
- **Analyzer**: コード変更禁止。仕様変更禁止。FACT と INFERENCE を分離する（§8）。既存情報から判断できる事項を Human に求めない（§17）。
- **Planner**: 実装しない。コード変更禁止。不明点は §17.2 で調査して AGENT DECISION として決める。Escalation トリガー（§17.3）に当たる事項だけ ESCALATION として Human に提示する。実装詳細の選択肢を Human に選ばせない。
- **Tester**: テストを skip・無効化・期待値の書き換えで通さない。結果は §14 の区分で記録する。
- **Implementer**:
  - APPROVED（Agent Approval または Human Approval。§6）の Task だけ実装する
  - Task の範囲を超えて仕様を変えない（§10）
  - 既存システムを優先して再利用する（§3）
  - 不要なリファクタリングをしない
- **Reviewer**: コード変更禁止。指摘は CHANGES_REQUIRED として返す。Review Handoff を検証できない場合は PASS も CHANGES_REQUIRED も出さない（§5.1）。
- **Debugger**: 仕様を変えて通すことをしない。修正後は必ず再テストする。3サイクルで停止する（§9）。

Implementer の手順と出力テンプレートは `.ai/agents/implementer.md`。責務境界は上表と §6・§10 に従う。

1つの AI が複数の役割を兼ねてもよい。ただし **役割ごとの成果物と Gate は省略しない**。

**Reviewer の独立性**: Reviewer は Implementer の判断過程ではなく、Review Handoff（§5.1）が指す Implementation SHA 時点の Task / Plan / `git diff`（Diff range）/ テスト結果だけを入力として検証する。
Review には独立性を1行で明記する（`別の人間` / `別 Agent・別セッション` / `同一セッションで兼務`）。
`同一セッションで兼務` の場合は、人間による差分確認を Review の推奨事項として必ず残す（DONE は止めない）。
サブエージェント等で別コンテキストを起動できる環境では、Reviewer は別コンテキスト（`別 Agent・別セッション`）で実行し、Review Handoff と Task file だけを渡す。
兼務・別セッションのどちらでも、受け渡しの手順（§5.1 / §7.3）は同じ。

### 5.1 Review Handoff

Implementer は `TESTING → REVIEWING` のとき（§7.3）、Reviewer へ次の Review Handoff を渡す。すべて必須。
書式は `.ai/agents/implementer.md`。

| 項目 | 内容 |
| --- | --- |
| Task ID | `<ID>`（Work Item を持つ Task は `<ID> / T-n`） |
| Branch | push 先の作業ブランチ（§6 の Persistence に書かれたブランチ） |
| Implementation SHA | push 済みの最終実装コミット（40桁） |
| Diff range | その承認単位の差分範囲 `<base-sha>..<Implementation SHA>`（1コミットなら `<sha>^..<sha>`） |
| Task file | `.ai/tasks/<ID>.md`（Work Item は計画 `<ID>-<ITEM>.md` も） |

Plan / Analyzer report / Test Report / Changed Files は Handoff に重ねて書かない。Task file から次のとおり辿れる:
Plan は Task file（Work Item は計画ファイル）、Analyzer report は冒頭の `Analysis:` 行、
Test Report と Changed Files は末尾の Implementation Result（`.ai/agents/implementer.md`）。

Implementation SHA は Task file に書かない（自分を含むコミットの SHA は書けない）。記録の正本は review report の Review Target とする。

**Reviewer の Handoff 検証**: レビュー内容に入る前に、Implementation SHA の時点で次をすべて確認する。

| # | 確認 |
| --- | --- |
| V-1 | Branch が remote に存在し、Implementation SHA がそのブランチから到達可能 |
| V-2 | Implementation SHA から Task file へ到達できる。Implementation Result に Plan Handoff（§5.2、Kind `plan`）が記録されていれば次も確認する:<br>**V-2a** `git diff <Plan の Source SHA>:<Path> <Implementation SHA>:<Path>` の変更が、`Status:` 行・Status History への行追加・Implementation Result 節だけ |
| V-3 | Plan が存在する |
| V-4 | Analyzer report（Task file の `Analysis:`）が存在する。`Analysis:` が新形式（§5.2）なら次も確認する:<br>**V-4a** `git rev-parse <Implementation SHA>:<Path>` が Blob SHA と一致する（同一性の正本）<br>**V-4b** Source Branch が remote に残っていれば、Source SHA がそこから到達可能（出所の補助。Source Branch が削除済みなら V-4a だけで判定する） |
| V-5 | Implementation Result（Test Report・Changed Files）を Task file で確認できる |
| V-6 | Diff range が空でなく、終点が Implementation SHA と一致する |

1つでも確認できない場合は **BLOCKED（理由: Review Handoff 不備）** として扱う。

- Reviewer は PASS も CHANGES_REQUIRED も出さず、review report を作らない（受け渡しの不備を実装の指摘として扱わない）
- 満たせなかった V-n を Orchestrator へ返す。Task file の Status は Reviewer が変更しない（対象の Task file が確定しないため）
- Orchestrator は Implementer に Handoff を出し直させる（push 漏れ・SHA 誤記・Implementation Result 欠落の補完）。これは Review Fix Loop（§9.1）の回数に数えない。
  同じ承認単位で2回出し直しても成立しない場合、または原因が Agent の権限外（remote・ブランチの消失等）の場合だけ Escalation（§17）
- Handoff が出し直された時点で、Reviewer は V-1 から検証し直す
- レビューは Implementation SHA の内容に対して行う。ブランチ先端・自分の working tree・未 commit の変更は対象にしない

### 5.2 Artifact Handoff

Analyzer report と承認済み Task file を、別セッション・別ブランチの次の段へ渡すための定義（Pin-by-SHA）。
Artifact は remote のブランチ上の **commit SHA（固定点）と blob SHA（同一性の正本）** で指す。ブランチの到達性は出所の補助情報とする。
書式は `.ai/agents/analyzer.md`（Kind `analysis`）。Kind `plan` も同じ書式を使う。

| 項目 | 内容 |
| --- | --- |
| Task ID | `<ID>`（Work Item 専用は `<ID> / T-n`） |
| Kind | `analysis`（Analyzer report）または `plan`（承認済み Task file） |
| Source Branch | Artifact を push したブランチ |
| Source SHA | Artifact を追加・更新した commit（40桁） |
| Path | Artifact のパス |
| Blob SHA | `git rev-parse <Source SHA>:<Path>`（40桁） |
| Persisted by | `Agent`（Autonomous Execution で Orchestrator が persist した場合）または `Human`（git の author / committer で代替しない。自己申告として記録する） |

すべて必須。短縮 SHA は不可（§5.1 と同じ）。

**Persistence**: Artifact を remote に置くのは Orchestrator（Autonomous Execution。§6.1 の作業ブランチ）または人間。Artifact 1ファイルだけの commit を作り、amend / force push しない。
Analyzer / Planner 自身は commit しない（役割の READ ONLY は維持し、persist は Orchestrator の操作として行う）。

- Kind `analysis`: Analyzer が report を作った後、Orchestrator が作業ブランチへ単独 commit で push し、Handoff を Planner へ渡す
- Kind `plan`: 承認（§6。Agent Approval または Human Approval）を Task file に記入した **承認済み版** を単独 commit で push し、Handoff を Implementer へ渡す。`WAITING_APPROVAL` 版は pin しない

**期待 Path**（ファイル名から Task ID を推定せず、Task ID から組み立てた文字列と一致を見る）:

| Kind | Task 全体 | Work Item 専用 | 1行目 |
| --- | --- | --- | --- |
| `analysis` | `.ai/reports/<ID>-analysis.md` | `.ai/reports/<ID>-<ITEM>-analysis.md` | `# <ID> Analysis` で始まる |
| `plan` | `.ai/tasks/<ID>.md` | `.ai/tasks/<ID>-<ITEM>.md` | `# <ID>` と一致（Work Item 計画は `# <ID>` で始まる） |

命名規則の例外は、P-10 の `.ai/reports/P-10-artifact-handoff-analysis.md`（P10-D9、人間承認済みの一回限り）だけ。他の Task に類推適用しない。

**Handoff 検証（H-1〜H-8）**: 受け取る段（Kind `analysis` は Planner、Kind `plan` は Implementer）は、作業を始める前に Handoff の記載を信用せず git から再計算して、すべて確認する。

| # | 確認 | 手段（すべて read-only） |
| --- | --- | --- |
| H-1 | Source Branch が remote に存在し、Source SHA がそこから到達可能。自分のブランチを Source SHA 起点で作った場合（任意の運用）は `HEAD` から到達可能でもよい | `git fetch origin <branch>`、`git merge-base --is-ancestor <sha> origin/<branch>`（または `HEAD`） |
| H-2 | Source SHA 時点に Path が存在する | `git cat-file -e <sha>:<path>` |
| H-3 | Source commit の変更が Path の1件だけ（Persistence の主体に依らず、Analyzer / Planner が他を変えていない証跡） | `git diff --name-only <sha>^ <sha>` |
| H-4 | Path と1行目が、Task ID から組み立てた期待 Path・見出しと一致する | 文字列一致（上の表） |
| H-5 | Kind が `analysis` / `plan` のどちらかで、Path がその Kind の期待 Path に一致する（上の例外を除く） | 上の表 |
| H-6 | Blob SHA が一致する | `git rev-parse <sha>:<path>` |
| H-7 | 同じ `(Task ID, Kind)` の記録が既にあれば、下の「新版」「二重 Handoff」に従う | Task file の `Analysis:` 行 / Implementation Result |
| H-8 | Source SHA の内容だけを読む（ブランチ先端・working tree の同名ファイルを読まない） | `git show <sha>:<path>` |

1つでも満たせなければ **BLOCKED（理由: Artifact Handoff 不備）** とし、満たせない H-n を Orchestrator へ返す。
Planner は Task file を作らず、Implementer は commit しない。Status は変更しない（§5.1 と同じ扱い）。
Orchestrator は、Agent が persist した Artifact なら作業ブランチへ新版として persist し直して Handoff を出し直す（下の「新版」）。
Human が persist した Artifact の不一致・消失、または出し直しても成立しない場合だけ Escalation（§17）。

Handoff の成立は「どの版を読むか」が確定・検証されたことだけを意味し、**内容の承認ではない**。
AI は検証失敗を承認で上書きせず、blob 不一致を再コピー・書き換えで自分で解消しない。
同一セッションで役割を兼務する場合も H-1〜H-8 を省略しない（§5）。

**Task file への記録**（Planner。Kind `analysis`）:
`Analysis: <Path>（branch \`<Source Branch>\` @ \`<Source SHA>\`、blob \`<Blob SHA>\`）`。
Work Items 表の `Analysis` 列も同じ書式で書いてよい。Kind `plan` は Implementer が Implementation Result に記録する（Task file は自分の blob を書けないため）。
blob の無い `Analysis:` 行（パスのみ、または `branch @ SHA` のみ）は旧形式として扱い、H-n / V-4a / V-4b を要求しない。

**Branch の区別**: Source Branch（Artifact を push したブランチ）と、Persistence の作業ブランチ（§6）は別の概念で、異なってよい。
Source Branch が force push・削除されて H-1 が満たせない場合は BLOCKED として Orchestrator へ戻す（扱いは上の「1つでも満たせなければ」と同じ）。Reviewer の V-4b は Source Branch が残っている場合だけ確認する（§5.1）。

**新版**: 同じ `(Task ID, Kind)` で Blob SHA が異なる Handoff は新版。新版は新しい commit で作る（amend / force push で旧 Source SHA を消さない）。

| 新版を受け取った時点の Status | 扱い |
| --- | --- |
| `WAITING_APPROVAL` より前 | Planner が新版で H-1〜H-8 をやり直し、`Analysis:` 行を更新して計画を見直す |
| `WAITING_APPROVAL` | Planner が H-1〜H-8 をやり直し、`Analysis:` 行を更新し、Status History に1行追記する |
| `APPROVED` 以降 | 旧 Artifact を使い続けない。Planner が新版で計画を見直し、Escalation Check と承認（§6）を取り直す。Human Approval で承認された承認単位は Human Approval を取り直す |
| `DONE` | 既存 Task を変更しない。新しい Task とする |

**二重 Handoff**: 識別キーは `(Task ID, Kind, Blob SHA)`。同じキーの再 Handoff は no-op とし、記録済みの参照（Source SHA を含む）を書き換えない。
異なる Task ID の Artifact を渡された場合は H-4 で BLOCKED。

**適用範囲**: 本節は、本節が `main` に統合された後に Planner が着手する Task / Work Item から適用する。
既存の Task・report・Approval 欄・旧形式の `Analysis:` 行は書き換えない（§7.3 の適用範囲と同じ方針）。
着手前の Task（例: ENEMY-ATTACK-VIS-001。report が remote に無ければ、Orchestrator が Analyzer を再実行する）は、統合後に本節どおり扱う。

## 6. Approval Gate

**APPROVED でないものは実装禁止。** 承認は **承認単位** ごとに行う。
承認には2種類あり、標準は Agent Approval（§0）。

| 種類 | 使う場合 | 承認者 |
| --- | --- | --- |
| **Agent Approval**（標準） | Escalation Check（§17.3）でトリガーが無い承認単位 | Planner（Approval 欄に Escalation Check の結果を書く） |
| **Human Approval** | Escalation に当たった承認単位、Human が依頼文で段階承認を求めた Task、本節の追加前に Human Approval で運用していた承認単位の続き | Human |

| Task の形 | 承認単位 |
| --- | --- |
| Work Item を持たない Task | Task 全体 |
| Work Item（T-1, T-2 …）を持つ Task | **各 Work Item**（§7.2） |

承認単位ごとの Implementation 開始条件（すべて満たすこと）:

- [ ] その承認単位を扱う Analyzer report が存在する（Task 全体の analysis、または Work Item 専用の analysis）
- [ ] Planner task が存在し、その承認単位の計画が書かれている（`.ai/tasks/<ID>.md`）
- [ ] その承認単位の判断事項が AGENT DECISION として決定済みで、ESCALATION が残っていない（§8 / §17）
- [ ] その承認単位の実装範囲（Files To Change / Files Not To Change）が明確
- [ ] その承認単位に承認が明示されている（`Status: APPROVED` とチェック済みの Approval 欄。Agent Approval なら Escalation Check の結果つき）

### 6.1 Agent Approval（標準）

Planner は計画を書き終えた承認単位について Escalation Check（§17.3 の各トリガーに当たるか）を行う。

- トリガーが無い → Approval 欄に `Agent Approval` と Escalation Check の結果（`None`）を書き、`APPROVED` にして Implementer へ進む。Human を待たない
- トリガーがある → その事項を ESCALATION（§17.4 の形式）として書き、承認単位を `WAITING_APPROVAL` にして止まる。
  Escalation に関係しない他の承認単位は進めてよい
- Human の回答を受けたら `.ai/decisions/` に記録し（§18）、計画に反映して Agent Approval を行う（回答が計画そのものの GO なら Human Approval として記録）

**Persistence（commit / push の許可）**: Autonomous Execution では、Human が割り当てた **作業ブランチ** への commit / push を許可済みとして扱う。

- 作業ブランチ = Human が依頼文・セッション設定で指定したブランチ（例: Claude Code のセッションに割り当てられた開発ブランチ）。Approval 欄の Persistence に `許可（branch: <name>、根拠: <割当の出所>）` と書く
- 作業ブランチの指定が無い場合は、Orchestrator が `claude/<task-id 小文字>` 等の新規ブランチを作ってよい（既存ブランチを流用しない）
- 1つの `許可` が次の2つを許可する。どちらも同じブランチへだけ行う:
  - Orchestrator / Implementer の commit / push: Analyzer report・Task file の persist（§5.2）、承認範囲（Files To Change と Task file の Implementation Result・Status・Status History）
  - Reviewer の §7.3 の commit / push: review report・Task file の Status 更新・Status History への追記（必要な行だけ）。review report はこの範囲に限り承認範囲外のファイルとして扱わない
- `main` への push、force push、amend による公開済み履歴の書き換え、承認範囲外のファイルの commit は、Persistence が許可でも行わない
- PR の作成・merge は Human の指示がある場合だけ行う

同じ承認単位の CHANGES_REQUIRED 後の再実装（§9.1）・Debugger 後の修正（§9）は、既存の承認と Persistence を使い続けてよい。
承認範囲や Files To Change を変える場合は、Planner が計画を更新して Escalation Check と承認をやり直す（Goal の範囲内なら Agent Approval でよい）。

承認の範囲はその承認単位に書かれた範囲に限る。

- ある Work Item の承認は、同じ Task の他の Work Item の承認を意味しない
- 別の Task・別のフェーズへも及ばない
- Task 全体の Status が `PLANNED` のままでも、`APPROVED` の Work Item は実装してよい。未承認の Work Item は実装しない

### 6.2 Human Approval（例外）

Human Approval で運用する承認単位では、次の規則に従う（本節追加前の §6 の規則）。

- Planner は計画を書き終えた承認単位を `WAITING_APPROVAL` にして止まる
- `APPROVED` にしてよいのは人間の明示的な GO（会話・Issue・PR コメント等）があった場合だけで、その根拠（誰が・いつ・どこで・どの承認単位を）を Approval 欄に書く。AI が代わりに承認しない
- Persistence も人間の明示的な指示を根拠とする。`Persistence` が空欄・`許可しない`・行が無い（旧形式の Approval 欄）場合は、許可されていない
- 承認範囲や Files To Change を変える場合は、Human Approval と Persistence を取り直す

**適用範囲**: 本節（§6.1 / §6.2）は、DEC-002 が `main` に統合された後に承認へ進む承認単位から適用する。既存の Approval 欄は書き換えない。
既に `WAITING_APPROVAL` の承認単位は、Planner が Escalation Check を行い、トリガーが無ければ Agent Approval へ移ってよい（Status History に記録）。

## 7. Task State

```
DRAFT → ANALYZING → PLANNED → WAITING_APPROVAL → APPROVED → IMPLEMENTING → TESTING → REVIEWING → DONE
```

失敗時:

```
TESTING   → FAILED → DEBUGGING → TESTING            （§9 の上限つき）
REVIEWING → CHANGES_REQUIRED → IMPLEMENTING → TESTING
```

停止:

```
任意の状態 → BLOCKED   （外部要因・Escalation 中・ループ上限超過。理由を必ず書く）
```

| State | 意味 | 担当 | 次へ進む条件 |
| --- | --- | --- | --- |
| DRAFT | 依頼を受けた。未着手 | Orchestrator | Analyzer が着手 |
| ANALYZING | 調査中 | Analyzer | analysis レポート完成 |
| PLANNED | 計画作成済み | Planner | Escalation Check（§6.1）を終えた → Agent Approval なら APPROVED、トリガーありなら WAITING_APPROVAL |
| WAITING_APPROVAL | Escalation への Human の回答待ち（§17）、または Human Approval（§6.2）待ち。**実装禁止** | Human | 回答・承認 |
| APPROVED | 実装してよい | Planner（Agent Approval）/ Human | Implementer が着手 |
| IMPLEMENTING | 実装中 | Implementer | 実装完了 |
| TESTING | build / unit / E2E 実行中 | Tester（commit・push・Handoff は Implementer） | FAIL が無く、FLAKY / NOT_RUN があれば §14 の規則どおり記録して進めてよいと判断し、commit・push・Review Handoff を終えた（§7.3）→ REVIEWING、FAIL → FAILED |
| FAILED | テスト失敗 | － | Debugger が着手 |
| DEBUGGING | 原因分析・最小修正中 | Debugger | 修正後 TESTING |
| REVIEWING | 検証中 | Reviewer | PASS かつ §7.3 の DONE 条件 → DONE、指摘 → CHANGES_REQUIRED |
| CHANGES_REQUIRED | レビュー指摘あり | Reviewer | Orchestrator が Implementer へ自動で差し戻す（§9.1） |
| DONE | 完了 | － | － |
| BLOCKED | 停止中（理由を明記） | － | 外部要因の解消、または Escalation への Human の回答 |

Status を変えたら、同じ Task の「Status History」に1行追記する（テンプレートは `.ai/tasks/README.md`）。

旧表記の読み替え: `REQUESTED` = DRAFT、`REVIEW` = REVIEWING。

### 7.1 Task Level

Task ファイルの冒頭に `Status:` を1行で書く。

- **Work Item を持たない Task**: 上の状態遷移をそのまま Task の Status として使う（従来どおり）
- **Work Item を持つ Task**: Task の Status は **Task 全体の調査・計画の進み具合** を表し、
  使う値は `DRAFT` / `ANALYZING` / `PLANNED` / `DONE` / `BLOCKED` だけとする。
  承認・実装・テスト・レビューの状態（`WAITING_APPROVAL` 〜 `CHANGES_REQUIRED`）は Work Item 側に持たせる
  - `DONE`: すべての Work Item が `DONE`、または取り下げ・別 Task へ移動済み（Goal の範囲内での取り下げは Agent 裁量。Status History に理由を記録）
  - `BLOCKED`: Task 全体が止まっている場合だけ（個別の停止は Work Item の `BLOCKED`）

### 7.2 Work Item Level

Work Item は Task の中の個別の作業項目（`T-1` など、Task 内で一意の ID）。

- 各 Work Item は、上の状態遷移・状態表と同じ値の `Status` と、個別の Approval 欄（§6）を持つ
- 状態遷移のルール・§6 の開始条件・§9 の3サイクル上限・§10 の Scope は、Work Item ごとに適用する
- Work Item の Scope は、その Work Item の Files To Change / 計画に書かれた範囲。
  他の Work Item の範囲に踏み込む変更は OUT OF SCOPE（§10）
- Work Item の追加・分割・取り下げは、Goal を変えない範囲で Planner が決める（Agent 裁量。Status History に理由を記録）。Goal 自体を変える場合は Escalation。既存の Work Item の ID・履歴は書き換えない
- Work Item 専用の成果物の命名（`<ITEM>` は Work Item ID からハイフンを除いたもの。例: `T-1` → `T1`）:
  - 計画: `.ai/tasks/<ID>-<ITEM>.md`（例: `CHAPTER-STRUCTURE-T1.md`）。**独立した Task ではなく**、親 Task `<ID>.md` の Work Item の計画。
    冒頭に親 Task へのリンクを書き、Status と Approval の正本は親 Task の Work Items 表とする（計画側の Status は常にそれと一致させる）
  - レポート: `.ai/reports/<ID>-<ITEM>-analysis.md` / `-debug.md` / `-review.md`（例: `CHAPTER-STRUCTURE-T1-analysis.md`）
  - Task 全体の成果物は従来どおり `<ID>.md` / `<ID>-analysis.md`

表記は `.ai/tasks/README.md` のテンプレート（Work Items 表と Work Item ごとの Approval 欄）に従う。

**読み替え**: 本ファイル・`.ai/agents/*.md` で「Task の Status」「Task を BLOCKED にする」等と書いている箇所は、
Work Item を持つ Task では **該当する Work Item の Status** を指す（§7.1 の Task Level の値を除く）。

### 7.3 Handoff and Completion Gates

Status は増やさない。成果物の永続化は、既存の2つの遷移の条件として扱う。

**push 前の Status**: remote に push されていない commit に書かれた Status は、正式な Status として効力を持たない。
push が完了するまで、正式な Status は直前に remote 上にあった Status とする（Implementer の `REVIEWING`、Reviewer の `DONE` / `CHANGES_REQUIRED` のどちらにも適用）。
push できなかった local commit を削除・書き換えする必要は無い。

**`TESTING → REVIEWING`（担当 Implementer）** — 次の順で行う:

1. §14 のテストが完了し、Implementation Result（Test Report を含む）を書いた（IMPLEMENTATION COMPLETE）。FAIL が無い
2. 承認範囲の成果物（コード・テスト・Task file の Implementation Result・Status の `REVIEWING` 更新と Status History 行）を commit する。
   Status History の Note には Branch を書く。
   その承認単位の Analyzer report と Task file（計画本文・Approval 欄を含む）がブランチの remote にまだ無い場合は、承認時点の内容のまま同じ commit に含める（§6）。
   Artifact Handoff（§5.2）を受けた Artifact は次を満たしてから含める:
   - **I-1**: 作業ブランチ上の Path の blob が Blob SHA と一致する。無ければ `git show <Source SHA>:<Path>` で復元し、`git hash-object <Path>` が Blob SHA と一致することを確かめる
   - **I-2**: 一致しなければ commit しない。自分で書き換え・再コピーせず **BLOCKED（理由: Artifact Handoff 不備）** で Orchestrator へ戻す（扱いは §5.2）
   - **I-3**（Kind `plan`）: Task file は Plan Handoff の承認済み版を起点にし、変更は `Status:` 行・Status History への行追加・Implementation Result 節だけにする。検証した Plan Handoff は Implementation Result に記録する

   blob の無い旧形式の `Analysis:` 行を持つ承認単位は従来どおり（存在確認のみ）
3. Persistence のブランチへ push し、remote のブランチから Implementation SHA へ到達できることを確かめる
4. Review Handoff（§5.1）を作り Reviewer へ渡す。ここで `REVIEWING` が成立する

- テスト完了前に push しない
- Persistence が許可されていない、または push できない場合は `REVIEWING` にしない。`TESTING` のまま止まる。
  push の失敗がネットワーク等の一時的な障害なら再試行する。作業ブランチへ書き込めない状態が続く場合は `BLOCKED`（理由: Review Handoff 未完了）として Escalation（§17）

**Reviewer の commit 範囲** — Result が PASS でも CHANGES_REQUIRED でも、Reviewer の commit は次だけを含む1コミットとし、Handoff の Branch へ push する（Persistence の範囲）:

- review report（`.ai/reports/<ID>-review.md`。Work Item は `<ID>-<ITEM>-review.md`）
- Task file の Status 更新（Work Item を持つ Task では、親 Task の Work Items 表の Status と Work Item 計画の Status。§7.2）
- Task file の Status History への追記（必要な行だけ。例: Work Item の `REVIEWING → DONE` と、それにより Task Level が `DONE` になる行）

それ以外の変更を同じコミットに混ぜない。これにより、Reviewed SHA と review commit の差分が review report と Status 更新だけになる。

Reviewer の実行環境で Handoff の Branch へ push できない（別ブランチが割り当てられている等）場合、Reviewer は別ブランチへ push しない。
Reviewer は review report を Orchestrator へ渡し、Orchestrator（Handoff の Branch へ push できる実行環境）が同じ範囲の1コミットとして push する。それもできない場合だけ `REVIEWING` のまま Escalation（§17）。
DONE 条件の「remote の Branch」は Handoff の Branch のまま変わらない。

**`REVIEWING → DONE`（担当 Reviewer）** — 次をすべて満たすこと:

- [ ] review report の Result が PASS
- [ ] review report が remote の Branch に存在する（push を確認するまで、PASS は完了条件として成立しない）
- [ ] review report の Reviewed SHA が、その承認単位の最新の Implementation SHA と一致する（Reviewed SHA より後に、その承認単位の Files To Change を変更するコミットが無い。上の「Reviewer の commit 範囲」に従う Reviewer commit は除外する。それ以外のコミットが1つでもあれば満たさない）

- テストの要件は §14 のまま（Targeted を許容する）。Full Regression と、完了についての追加の Human Approval は DONE の条件にしない
- Reviewed SHA より後に実装が変わった場合は、新しい Implementation SHA で Handoff とレビューをやり直す
- push できない場合は `REVIEWING` のまま止まり、上と同じく Orchestrator が push する。できなければ Escalation（§17）

**適用範囲**: 本節は、本節の追加後に `TESTING → REVIEWING` へ進む承認単位から適用する。既存の Task・report・Approval 欄は書き換えない。

## 8. Fact / Inference / Decision

Analyzer と Planner の出力では、記述を次の種別に分ける。

| 種別 | 意味 | 書き方 |
| --- | --- | --- |
| **FACT** | コード・テスト・仕様書から確認した事実 | 根拠（`path:line`、テスト名、仕様書の節、検索語）を必ず添える |
| **INFERENCE** | FACT から推測したこと | 「推測」と明記し、どの FACT に基づくかを書く |
| **AGENT DECISION** | Agent が決めたこと（§17.1 の Agent 裁量） | 決定・根拠（§17.2 のどのソースから導いたか）・検討した代替案を1〜3行で書く。重要なものは §18 に従い記録する |
| **ESCALATION** | §17.3 のトリガーに当たり Human が決める必要があること | §17.4 の形式で書く（推奨案つき） |

旧表記の読み替え: 既存成果物の **DECISION**（人間が決める事項）は ESCALATION と同義。既存成果物は書き換えない。

次の4つを混同しない:

| 表現 | 使ってよい条件 |
| --- | --- |
| 実装されている | コード上で確認した（FACT） |
| 実装されていない | 検索して無いことを確認した（FACT。§3 の記録つき） |
| 仕様として決まっている | `docs/` または `.ai/decisions/` に記載がある（FACT） |
| 提案である | それ以外。Planner の案はすべてこれ |

「コードが残っている」と「その機能が有効に動く」も区別する（例: 無効化された旧システム）。

Implementer / Reviewer が Acceptance Criteria の充足を書くときは、確認方法を区別する:

| 表記 | 意味 |
| --- | --- |
| **VERIFIED** | 実行したテスト（unit / E2E / 手動操作）で確認した。テスト名を添える |
| **FACT (code)** | コードを読んで同じ経路を通ることを確認したが、テストでは確かめていない |

`FACT (code)` だけの AC は PASS にしてよいが、未検証である旨を Review の Risks に残す。

## 9. Debugger 3-Cycle Rule

Debugger → Implementer → Test → Debugger のループは **1 Task あたり原則3サイクルまで**。

| Cycle | 行うこと |
| --- | --- |
| 1/3 | 原因調査・最小修正 |
| 2/3 | 再現条件と根本原因を再確認し、1回目の仮説を検証し直す |
| 3/3 | 修正方針そのものを見直す。通らなければ Escalation（§17） |

1サイクルは「Debugger の分析 → Implementer の修正 → 再テスト」を1回とする。§14 のテスト単位の再実行（FAIL / FLAKY の判定）はサイクルに数えない。
`<ID>-debug.md` はサイクルごとに `## Cycle n/3` 節を追記する（前のサイクルの記述は書き換えない）。

Reviewer が再テストで FAIL を見つけた場合は `CHANGES_REQUIRED` とし、Implementer が再テストする。FAIL が再現すれば `FAILED` として本節のループへ入る。
サイクルの数は同じ承認単位で通算する。

3回で解決しない場合は修正を繰り返さず、Task を `BLOCKED`（理由: Escalation）にして次をまとめて停止し、§17.4 の形式で Escalation する
（`.ai/reports/<ID>-debug.md`）:

- Failure Summary
- Reproduction
- Root Cause Hypothesis
- Attempted Fixes
- Remaining Unknowns
- Recommended Human Decision

テストを skip・無効化・期待値の書き換えで通すことは修正ではない。
ただし、Goal・承認済み計画が **意図して変える挙動** を検証している期待値の更新は実装の一部（Agent 裁量）とし、計画の Files To Change と Test Plan に書き、Review で確認する。
ゲーム仕様を変えないと通らない場合は Escalation（§17.3）。

### 9.1 Review Fix Loop

Reviewer の `CHANGES_REQUIRED` は Human を介さず、Orchestrator が Implementer へ自動で差し戻す。

```
REVIEWING → CHANGES_REQUIRED → IMPLEMENTING → TESTING → REVIEWING
```

- Reviewer は review report の Required Changes に、ファイル・箇所・期待する状態・確認方法を具体的に書く（Implementer がそのまま着手できる粒度）
- Implementer は Required Changes だけを修正し（Scope は承認範囲のまま。§10）、Tester が再テストし、新しい Implementation SHA で Review Handoff を出し直す
- Reviewer は前回の report を読まずに新しい Handoff を独立に検証する（独立性 §5）。report は Round ごとに `<ID>-review.md` へ `## Round n/3` 節を追記する（前の Round は書き換えない）
- 1 Round = 「Reviewer の CHANGES_REQUIRED → Implementer の修正 → 再テスト → 再レビュー」。上限は **同じ承認単位で通算3 Round**（§9 の Debugger サイクルとは別に数える）
- Required Changes を満たすには承認範囲外の変更が必要な場合、Planner が計画を更新して承認をやり直す（§6.1）。これも Round に数える
- 3 Round で PASS にならない場合は修正を繰り返さず、承認単位を `BLOCKED`（理由: Escalation / Review Fix Loop 上限）にして §17.4 の形式で Escalation する

## 10. Scope Control

Task に含まれない変更をしない。

例: 「魔法使いの Skill 1 を変更する Task」で、次は行わない。

- 魔法使いシステム全体のリファクタリング
- 敵AIの全面改修
- UI の全面改修
- Chapter 1 全体の変更

必要だと分かった場合は実装せず、Task/レポートに **OUT OF SCOPE** として
「何が・なぜ必要か」を記録し、別 Task として扱う（Final Report の Follow-ups に列挙する。Human に質問しない）。

ただし、Goal の達成に **不可欠** で、ゲーム仕様を変えない最小の変更（例: 呼び出し側の引数追加、壊れる既存テストの追従）は、Planner が計画の Files To Change に含めて承認してよい（Agent 裁量）。

最小変更の原則:

- 既存コードを理解してから変更する
- 目的達成に必要な最小変更だけを行う。「ついでの改善」はしない

## 11. Token Efficiency

リポジトリ全体を最初から読むことは **禁止**。

1. まず検索（Grep / Glob）
2. 関係するファイルを特定
3. 必要な範囲だけ読む（巨大ファイルは行範囲指定）
4. 関連する既存テストを確認
5. 必要な場合のみ周辺コードを追加調査

Analyzer の標準調査順:

1. Task / User Request
2. 関連ドキュメント（`docs/`、関連する `.ai/reports/` `.ai/decisions/`）
3. 検索
4. 関連ソース
5. 関連テスト
6. 必要な場合のみ周辺コード

既知の情報を何度も再説明しない。前の成果物に書かれている事実は、参照して再利用する
（ただし実装が変わっている可能性がある場合は、該当箇所だけ再確認する）。

## 12. Review Checklist

Reviewer は「動いたから OK」ではなく **「要求仕様を満たしているか」** を判定する。

| # | 項目 | 見ること |
| --- | --- | --- |
| 1 | Specification compliance | Task の Acceptance Criteria と `docs/` の仕様を満たすか |
| 2 | Scope compliance | Files To Change の外に差分が無いか。OUT OF SCOPE を勝手にやっていないか |
| 3 | Regression | 既存の挙動・既存テストを壊していないか |
| 4 | Build | `npm run build` |
| 5 | Unit tests | `npm run test:unit` |
| 6 | E2E tests | `npm test`（関連 spec を優先。未実行なら理由） |
| 7 | Save/Load integrity | セーブ形式・既存セーブの読み込み・テストモードのセーブ保護 |
| 8 | Existing behavior | 本編の進行・通常起動・既存 UI が変わっていないか |
| 9 | Code duplication | 既存の関数・データを再実装していないか（§3） |
| 10 | Unnecessary architecture changes | 不要なモジュール分割・構造変更・リファクタリングが無いか（§13） |

結果は `PASS` または `CHANGES_REQUIRED`。

## 13. Repository Constraints

- `basefile.html` は凍結。変更禁止
- `src/legacy/parts/` は共有スコープで連結される。通常の ES Module として勝手に分離しない。
  共有変数・関数を不用意に変更しない。module 化が必要なら別 Task で分析・計画する
- `src/core/` は state・THREE・scene に依存しない純粋関数（`ARCHITECTURE.md`）
- ゲーム仕様の変更を伴う場合は Escalation（§17.3）し、決定後に `docs/` を更新する（その Task の範囲に含める）
- 実装済みの挙動・既存 Decision Record に `docs/` を合わせる整合修正は Agent 裁量（Final Report の主な判断に書く）

## 14. Testing

実装後は可能な範囲で実行する:

```sh
npm run build
npm run test:unit
npm test
```

結果は要約だけを残す（長大なログ全文は保存しない）。Tester が Test Report（テンプレートは `.ai/agents/implementer.md`、手順は `.ai/agents/tester.md`）に次を書く。

**Test Scope**

| 区分 | 意味 |
| --- | --- |
| Targeted | 変更の影響経路を通るテストだけを選んで実行した |
| Full Regression | `npm run build` / `npm run test:unit` / `npm test` をすべて実行した |

Targeted の場合は「実行したもの」「選んだ理由」「実行しなかったもの（とその理由）」を書く。

**結果の区分**（テスト単位。Task / Work Item の Status とは別物で、Status は増やさない）

| 結果 | 意味 | 扱い |
| --- | --- | --- |
| PASS | 初回で通った | － |
| FAIL | 失敗し、1回の再実行でも失敗 | Work Item を `FAILED` にして Debugger へ（§9） |
| FLAKY | 初回失敗・1回の再実行で通った | **PASS として数えない**。テスト名・初回の失敗内容・対象変更との関係（FACT / INFERENCE）・変更前コードで比較したかを記録する。対象変更と無関係と判断できれば Work Item は進めてよいが、Review の Risks に残す |
| NOT_RUN | 実行しなかった / できなかった | 理由を書く。**PASS として数えない**。Test Plan・Targeted の範囲として理由が妥当なら進めてよいが、必要なテストを実行できない場合は下の「実行環境の問題」に従う |

`TESTING → REVIEWING` へ進めるのは FAIL が無い場合だけ（§7）。FLAKY / NOT_RUN は上の扱いどおり記録し、進めてよいと判断した根拠を Test Report に書く。

**実行環境の問題**: テストが起動前に失敗する（ブラウザ未導入など）のはリポジトリではなく実行環境の問題として区別する。
回避策はスクラッチ領域など **リポジトリ外** に限り、その内容を Test Report に書く（Agent 裁量。Human に質問しない）。
回避できないテストは NOT_RUN と理由を記録し、残りの検証（build / unit / 実行できる E2E）で判定できるなら進めて Final Report に書く。
変更の正しさを確かめる手段が1つも無い場合だけ、Work Item を `BLOCKED`（理由: 実行環境）にして Escalation（§17）。

## 15. Communication

各成果物は次を優先する: 事実 / 根拠 / 対象ファイル / 最小変更案 / テスト結果 / 未確認事項。
長い一般論は書かない。

共有情報は GitHub 上の小さな Markdown（`.ai/tasks/` `.ai/reports/` `.ai/decisions/` `docs/`）で受け渡す。
巨大な会話履歴を AI 間で共有しない。

## 16. File Map

| 場所 | 中身 | ルールの正本 |
| --- | --- | --- |
| `.ai/AGENTS.md` | 運用ルール全体 | ここ |
| `.ai/agents/<role>.md` | 役割ごとの手順・出力テンプレート（orchestrator / analyzer / planner / implementer / tester / debugger / reviewer） | ルールはここを参照 |
| `.ai/tasks/` | Task（Status・計画・Approval） | 命名とテンプレート: `tasks/README.md` |
| `.ai/reports/` | analysis / debug / review / retrospective | 命名: `reports/README.md`（Work Item 分は §7.2） |
| `.ai/decisions/` | Human の決定と、Task を越えて効く Agent Decision の記録（§18） | 命名とテンプレート: `decisions/README.md` |
| `CLAUDE.md`（ルート） | Claude Code の起動時に Orchestrator として動くための入口 | ここ（§0） |

## 17. Human Escalation Policy

Human への質問は **Escalation** であり、通常動作ではない。「不明点がある＝Human に質問」ではない。

### 17.1 Agent が判断する事項（Human に質問しない）

次は §17.2 で調査し、Agent が決めて AGENT DECISION として記録する（§8 / §18）。

- 命名、ファイル構成、リファクタリング方法、実装方式、テスト方式
- 軽微な UI 調整・軽微な数値調整（既存の Decision Record・docs が定める方向・範囲の中で）
- 既存コードとの整合性を取るための実装判断、既存仕様を維持するための実装判断
- 既存 Decision Record・docs から導ける判断
- 複数の合理的な実装案から1つを選ぶこと（ゲーム体験が実質的に同じもの）
- バグ修正、Reviewer の指摘への対応、テスト失敗・build failure への対応
- Work Item の分割・追加・取り下げ（Goal を変えない範囲。§7.2）、Test Scope の選択（§14）、実行環境の回避策（§14）

実装詳細について Human に選択肢を提示して選ばせない。

### 17.2 Resolution Order（判断の手順）

不明点・選択肢があるときは、次の順で調べ、最初に答えが出たソースに従う（§2 の優先順位と同じ並び）。

1. 現在の実装・既存テスト（挙動の事実。テストが固定している挙動は仕様として扱う）
2. `docs/`、ルートの仕様書（`ARCHITECTURE.md` / `COMBAT_DESIGN.md` 等）
3. `.ai/decisions/`（Human Decision と Agent Decision）
4. 過去の Task / report（同種の問題での判断・Agent Decisions 節・Review の指摘）
5. コード構造の一貫性（近傍の同種実装の書き方に合わせる）、§3 / §10 / §13 の原則
6. ゲームデザインとの整合（docs に書かれた方針・体験目標から推論。推論は INFERENCE と明記）

1〜6 で1つに決まらなくても、案の違いがゲーム体験・仕様に実質的な差を生まないなら、より小さく・既存に近く・戻しやすい案を Agent が選ぶ。

### 17.3 Escalation トリガー（これらの場合だけ Human へ）

| # | トリガー |
| --- | --- |
| E-1 | ゲーム仕様そのもの（`docs/` に書かれた挙動・ルール・体験）を変える必要がある |
| E-2 | 既存 Decision Record と明確に矛盾する |
| E-3 | 複数案があり、ゲームデザイン上の意味が大きく異なり、§17.2 のどのソースからも判断できない |
| E-4 | 新しいゲームシステムの採用・不採用を決める必要がある |
| E-5 | 既存仕様同士が矛盾しており、どちらを優先するか判断できない |
| E-6 | データ破壊など重大な不可逆変更（既存セーブの互換性破壊・削除、履歴の書き換え、`main` / 共有ブランチへの破壊的操作）が必要 |
| E-7 | セキュリティ上重大な判断が必要（秘密情報・認証・外部公開範囲・依存の追加による供給網リスク等） |
| E-8 | ループ上限（§9 Debugger 3 サイクル / §9.1 Review Fix Loop 3 Round / §5.1 Handoff 出し直し2回）を超えた |
| E-9 | Human が明示的に判断を求めた事項（依頼文・Decision Record で「Human が決める」とされたもの） |
| E-10 | Agent の権限・実行環境の外にある障害で先へ進めない（作業ブランチへ書けない、必須の検証手段が皆無 等） |

Escalation Check（§6.1）は、承認単位の計画が E-1〜E-7 / E-9 に当たらないことを確かめる手続きである。
E-8 / E-10 は実行中に発生した時点で Escalation する。

Escalation は承認単位ごとに行う。Escalation 中の承認単位を `WAITING_APPROVAL`（計画段階）または `BLOCKED`（実行中）にし、関係しない承認単位は進める。
1回の Escalation に、その時点で Human の判断が要る事項をすべてまとめる（小出しに質問しない）。

### 17.4 Escalation の形式

「どうしますか？」だけの質問をしない。必ず次をすべて書く（Task file の `## Escalation` 節と、Human への報告の両方）。

```markdown
## Escalation E-<n>: <判断が必要な事項（1行）>
- Trigger: E-x（§17.3）
- Facts: Agent が調査した事実（根拠: path:line / docs 節 / Decision Record）
- Why Agent cannot decide: §17.2 のどのソースでも決まらない理由
- Options:
  - A（推奨）: <内容> — 影響: <ゲーム体験 / 実装 / テスト / 戻しやすさ>
  - B: <内容> — 影響: …
- Recommendation: A。理由: …
- Minimal answer: 「A で OK」/「B」/ 数値などの1語で答えられる形
```

Human の回答は §18 に従い記録し、Orchestrator がそのまま後続の段を再開する（Human に再開の操作を求めない）。

## 18. Decision Record as Agent Knowledge

Decision Record は Human 承認の記録であると同時に、**Agent が将来の判断に使う知識** である。

- Orchestrator（Context Loader）と Analyzer は、作業開始時に Goal に関係する `.ai/decisions/` を検索して読む（§17.2 の 3）
- Human の回答（Escalation への回答・Goal に含まれる仕様判断）は `.ai/decisions/` に Human Decision として記録する
- Agent の判断は、次のどちらかに記録する。将来の Agent の判断に影響しない細かい実装判断は記録しない（Repository を肥大化させない）

| 記録先 | 対象 |
| --- | --- |
| Task file の `## Agent Decisions` 節 | その Task の中で効く判断（実装方式の選択、Test Scope、Work Item 分割 等） |
| `.ai/decisions/AGENT-DECISIONS.md`（追記型の1ファイル） | Task を越えて再利用される判断（同じ問題が再発しうる規約・方針・解釈）。1件 3〜6 行 |

- Agent Decision は Human Decision を上書きしない。Agent Decision と矛盾する Human Decision が後から出たら Human Decision を優先し、Agent Decision に `Superseded by <ID>` を追記する
- 同じ問題で過去に Agent / Human Decision がある場合は、それに従う（再び Human に質問しない）

## 19. Final Report（Human への完成報告）

正常終了時、Human には途中経過を送らず、Orchestrator が次の形で1回だけ報告する（テンプレートは `.ai/agents/orchestrator.md`）。

- Goal / 実施内容 / 変更ファイル / 主な判断（Agent Decisions のうち Human が知るべきもの）/ テスト結果 / Reviewer 結果 / Commit・Branch / Follow-ups
- **Human Decision**: 判断が必要な事項。無ければ `Human Decision: None` と明記する

Escalation で止まった場合も同じ形で報告し、Human Decision 欄に §17.4 の Escalation を載せる。
