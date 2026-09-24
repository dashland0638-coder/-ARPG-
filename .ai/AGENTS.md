# AI Agent Operating Protocol

このファイルは AI エージェント運用ルールの **唯一の正本（Single Source of Truth）** である。
`.ai/agents/*.md` は各役割の入出力テンプレートだけを持ち、ルールはここを参照する。
`.ai/tasks/` `.ai/reports/` `.ai/decisions/` の README は命名とテンプレートだけを持つ。

同じルールを他のファイルへ書き写さない。変更はここで行う。

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

不明点を推測で埋めない。矛盾を発見したら報告する（自分で解消しない）。

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
User Request
  ↓
Director / Human Intent        … 目的・優先度・制約を示す
  ↓
Analyzer                        … 調査・事実確認（READ ONLY）
  ↓
Planner                         … 実装計画（READ ONLY）
  ↓
Human Approval  ◆ GATE          … GO 判断・仕様判断・未確定事項の決定
  ↓
Implementer                     … 承認済み範囲だけ実装
  ↓
Build / Unit Test / E2E Test
  ↓
Reviewer                        … 検証（READ ONLY）
  ↓
PASS → DONE
  │
  ├─ テスト失敗 → Debugger → 最小修正 → 再テスト → Reviewer
  └─ Review 指摘 → Implementer → 再テスト → Reviewer
```

Human Intent / Human Approval 以外の各段は、成果物（Markdown）を残してから次へ渡す。
前の段の成果物が無いまま次の段を始めない。

## 5. Roles and Permissions

| Role | 責務 | 入力 | 出力 | 変更権限 | 次工程 |
| --- | --- | --- | --- | --- | --- |
| Director / Human | 目的・優先度・承認・仕様判断 | User Request / 各成果物 | Task の指示、Approval、`.ai/decisions/` | 全権（判断） | Analyzer / Implementer |
| Analyzer | 調査・事実確認 | Task / User Request | `.ai/reports/<ID>-analysis.md` | **READ ONLY**（書くのはレポートだけ） | Planner |
| Planner | 実装計画 | Analysis | `.ai/tasks/<ID>.md`（計画・未確定事項） | **原則 READ ONLY**（書くのは Task だけ） | Human Approval |
| Implementer | 承認済み Task の実装 | APPROVED な Task | コード・テスト・Task の実装結果欄 | Task の Files To Change の範囲のみ | Test |
| Reviewer | 仕様適合・回帰・テストの検証 | Task / diff / テスト結果 | `.ai/reports/<ID>-review.md` | **READ ONLY** | DONE / Implementer |
| Debugger | 失敗の原因分析と修正案 | 失敗ログ / diff | `.ai/reports/<ID>-debug.md` | 原則 READ ONLY（修正は Implementer が行う。単独運用で兼務する場合も §9 の上限に従う） | Implementer → Test |

各役割の禁止事項:

- **Analyzer**: コード変更禁止。仕様変更禁止。FACT と INFERENCE を分離する（§8）。
- **Planner**: 実装しない。コード変更禁止。不明点は「未確定事項（DECISION）」として人間に提示する。
- **Implementer**:
  - Human Approval 済みの Task だけ実装する（§6）
  - Task の範囲を超えて仕様を変えない（§10）
  - 既存システムを優先して再利用する（§3）
  - 不要なリファクタリングをしない
- **Reviewer**: コード変更禁止。指摘は CHANGES_REQUIRED として返す。
- **Debugger**: 仕様を変えて通すことをしない。修正後は必ず再テストする。3サイクルで停止する（§9）。

Implementer の手順と出力テンプレートは `.ai/agents/implementer.md`。責務境界は上表と §6・§10 に従う。

1つの AI が複数の役割を兼ねてもよい。ただし **役割ごとの成果物と Gate は省略しない**。

**Reviewer の独立性**: Reviewer は Implementer の判断過程ではなく、Task / Plan / `git diff` / テスト結果だけを入力として検証する。
Review には独立性を1行で明記する（`別の人間` / `別 Agent・別セッション` / `同一セッションで兼務`）。
`同一セッションで兼務` の場合は、人間による差分確認を Review の推奨事項として必ず残す。

## 6. Human Approval Gate

**Human Approval が無いものは実装禁止。** 承認は **承認単位** ごとに行う。

| Task の形 | 承認単位 |
| --- | --- |
| Work Item を持たない Task | Task 全体 |
| Work Item（T-1, T-2 …）を持つ Task | **各 Work Item**（§7.2） |

承認単位ごとの Implementation 開始条件（すべて満たすこと）:

- [ ] その承認単位を扱う Analyzer report が存在する（Task 全体の analysis、または Work Item 専用の analysis）
- [ ] Planner task が存在し、その承認単位の計画が書かれている（`.ai/tasks/<ID>.md`）
- [ ] その承認単位の未確定事項（DECISION）が列挙され、実装に必要なものは決定済み
- [ ] その承認単位の実装範囲（Files To Change / Files Not To Change）が明確
- [ ] その承認単位に Human Approval が明示されている（`Status: APPROVED` とチェック済みの Approval 欄）

Planner は計画を書き終えた承認単位を `WAITING_APPROVAL` にして止まる。
`APPROVED` にしてよいのは人間の明示的な GO（会話・Issue・PR コメント等）があった場合だけで、
その根拠（誰が・いつ・どこで・どの承認単位を）を Approval 欄に書く。**AI が自分で承認しない。**

承認の範囲はその承認単位に書かれた範囲に限る。

- ある Work Item の承認は、同じ Task の他の Work Item の承認を意味しない
- 別の Task・別のフェーズへも及ばない
- Task 全体の Status が `PLANNED` のままでも、`APPROVED` の Work Item は実装してよい。未承認の Work Item は実装しない

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
任意の状態 → BLOCKED   （外部要因・人間の判断待ち・3サイクル超過。理由を必ず書く）
```

| State | 意味 | 担当 | 次へ進む条件 |
| --- | --- | --- | --- |
| DRAFT | 依頼を受けた。未着手 | Director | Analyzer が着手 |
| ANALYZING | 調査中 | Analyzer | analysis レポート完成 |
| PLANNED | 計画作成済み | Planner | 未確定事項を整理し終えた |
| WAITING_APPROVAL | 人間の GO 待ち。**実装禁止** | Human | 明示的な承認 |
| APPROVED | 実装してよい | Human | Implementer が着手 |
| IMPLEMENTING | 実装中 | Implementer | 実装完了 |
| TESTING | build / unit / E2E 実行中 | Implementer | 全て成功 → REVIEWING、失敗 → FAILED |
| FAILED | テスト失敗 | － | Debugger が着手 |
| DEBUGGING | 原因分析・最小修正中 | Debugger | 修正後 TESTING |
| REVIEWING | 検証中 | Reviewer | PASS → DONE、指摘 → CHANGES_REQUIRED |
| CHANGES_REQUIRED | レビュー指摘あり | Reviewer | Implementer が着手 |
| DONE | 完了 | － | － |
| BLOCKED | 停止中（理由を明記） | － | 人間の判断 |

Status を変えたら、同じ Task の「Status History」に1行追記する（テンプレートは `.ai/tasks/README.md`）。

旧表記の読み替え: `REQUESTED` = DRAFT、`REVIEW` = REVIEWING。

### 7.1 Task Level

Task ファイルの冒頭に `Status:` を1行で書く。

- **Work Item を持たない Task**: 上の状態遷移をそのまま Task の Status として使う（従来どおり）
- **Work Item を持つ Task**: Task の Status は **Task 全体の調査・計画の進み具合** を表し、
  使う値は `DRAFT` / `ANALYZING` / `PLANNED` / `DONE` / `BLOCKED` だけとする。
  承認・実装・テスト・レビューの状態（`WAITING_APPROVAL` 〜 `CHANGES_REQUIRED`）は Work Item 側に持たせる
  - `DONE`: すべての Work Item が `DONE`、または人間の判断で取り下げ・別 Task へ移動済み（Status History に記録）
  - `BLOCKED`: Task 全体が止まっている場合だけ（個別の停止は Work Item の `BLOCKED`）

### 7.2 Work Item Level

Work Item は Task の中の個別の作業項目（`T-1` など、Task 内で一意の ID）。

- 各 Work Item は、上の状態遷移・状態表と同じ値の `Status` と、個別の Human Approval 欄を持つ
- 状態遷移のルール・§6 の開始条件・§9 の3サイクル上限・§10 の Scope は、Work Item ごとに適用する
- Work Item の Scope は、その Work Item の Files To Change / 計画に書かれた範囲。
  他の Work Item の範囲に踏み込む変更は OUT OF SCOPE（§10）
- Work Item を追加・分割・取り下げするのは Planner の提案と人間の判断による。既存の Work Item の ID・履歴は書き換えない
- Work Item 専用の成果物の命名（`<ITEM>` は Work Item ID からハイフンを除いたもの。例: `T-1` → `T1`）:
  - 計画: `.ai/tasks/<ID>-<ITEM>.md`（例: `CHAPTER-STRUCTURE-T1.md`）。**独立した Task ではなく**、親 Task `<ID>.md` の Work Item の計画。
    冒頭に親 Task へのリンクを書き、Status と Human Approval の正本は親 Task の Work Items 表とする（計画側の Status は常にそれと一致させる）
  - レポート: `.ai/reports/<ID>-<ITEM>-analysis.md` / `-debug.md` / `-review.md`（例: `CHAPTER-STRUCTURE-T1-analysis.md`）
  - Task 全体の成果物は従来どおり `<ID>.md` / `<ID>-analysis.md`

表記は `.ai/tasks/README.md` のテンプレート（Work Items 表と Work Item ごとの Approval 欄）に従う。

**読み替え**: 本ファイル・`.ai/agents/*.md` で「Task の Status」「Task を BLOCKED にする」等と書いている箇所は、
Work Item を持つ Task では **該当する Work Item の Status** を指す（§7.1 の Task Level の値を除く）。

## 8. Fact / Inference / Decision

Analyzer と Planner の出力では、記述を次の3種に分ける。

| 種別 | 意味 | 書き方 |
| --- | --- | --- |
| **FACT** | コード・テスト・仕様書から確認した事実 | 根拠（`path:line`、テスト名、仕様書の節、検索語）を必ず添える |
| **INFERENCE** | FACT から推測したこと | 「推測」と明記し、どの FACT に基づくかを書く |
| **DECISION** | 人間が決める必要があること | 選択肢と、それぞれの影響を書く。AI は決めない |

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
| 3/3 | 修正方針そのものを見直す。通らなければ人間へエスカレーション |

3回で解決しない場合は修正を繰り返さず、Task を `BLOCKED` にして次をまとめて停止する
（`.ai/reports/<ID>-debug.md`）:

- Failure Summary
- Reproduction
- Root Cause Hypothesis
- Attempted Fixes
- Remaining Unknowns
- Recommended Human Decision

テストを skip・無効化・期待値の書き換えで通すことは修正ではない（仕様変更として人間の判断が要る）。

## 10. Scope Control

Task に含まれない変更をしない。

例: 「魔法使いの Skill 1 を変更する Task」で、次は行わない。

- 魔法使いシステム全体のリファクタリング
- 敵AIの全面改修
- UI の全面改修
- Chapter 1 全体の変更

必要だと分かった場合は実装せず、Task/レポートに **OUT OF SCOPE** として
「何が・なぜ必要か」を記録し、別 Task として扱う。

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
- 仕様変更を伴う場合は `docs/` の更新が必要（その Task の範囲に含めて承認を得る）

## 14. Testing

実装後は可能な範囲で実行する:

```sh
npm run build
npm run test:unit
npm test
```

結果は要約だけを残す（長大なログ全文は保存しない）。Implementer が Test Report（テンプレートは `.ai/agents/implementer.md`）に次を書く。

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
| FAIL | リトライ後も失敗 | Work Item を `FAILED` にして Debugger へ（§9） |
| FLAKY | 初回失敗・リトライで通った | **PASS として数えない**。テスト名・初回の失敗内容・対象変更との関係（FACT / INFERENCE）・変更前コードで比較したかを記録する。対象変更と無関係と判断できれば Work Item は進めてよいが、Review の Risks に残す |
| NOT_RUN | 実行しなかった / できなかった | 理由を書く |

**実行環境の問題**: テストが起動前に失敗する（ブラウザ未導入など）のはリポジトリではなく実行環境の問題として区別する。
回避策はスクラッチ領域など **リポジトリ外** に限り、その内容を Test Report に書く。回避できず必要なテストを実行できない場合は、
Work Item を `BLOCKED`（理由: 実行環境）にして人間に戻す。

## 15. Communication

各成果物は次を優先する: 事実 / 根拠 / 対象ファイル / 最小変更案 / テスト結果 / 未確認事項。
長い一般論は書かない。

共有情報は GitHub 上の小さな Markdown（`.ai/tasks/` `.ai/reports/` `.ai/decisions/` `docs/`）で受け渡す。
巨大な会話履歴を AI 間で共有しない。

## 16. File Map

| 場所 | 中身 | ルールの正本 |
| --- | --- | --- |
| `.ai/AGENTS.md` | 運用ルール全体 | ここ |
| `.ai/agents/<role>.md` | 役割ごとの手順・出力テンプレート（analyzer / planner / implementer / debugger / reviewer） | ルールはここを参照 |
| `.ai/tasks/` | Task（Status・計画・Approval） | 命名とテンプレート: `tasks/README.md` |
| `.ai/reports/` | analysis / debug / review / retrospective | 命名: `reports/README.md`（Work Item 分は §7.2） |
| `.ai/decisions/` | 人間の決定の記録 | 命名とテンプレート: `decisions/README.md` |
