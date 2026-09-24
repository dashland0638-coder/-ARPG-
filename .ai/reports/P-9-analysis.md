# P-9 Analysis

Artifact Handoff Between Implementer and Independent Reviewer

- Phase: Analyzer only（READ ONLY。このファイル以外は変更していない。commit / push していない。テストは実行していない）
- 調査対象の Protocol: `origin/claude/chapter-structure-scenario-test-q6oj4l` @ `4d7662f`（後述 FACT-1 のとおり、現行 Protocol はこのブランチにしか無い）
- 行番号は上記コミット時点のもの

## Problem

MAGE-002 で、Implementer の成果物が **作業コンテナの未 commit の working tree にしか存在しない** 状態のまま、
Independent Reviewer が **別セッション・別コンテナ** で開始された。
Reviewer はリポジトリ（remote）から成果物を取得できず、実装内容と無関係な理由で BLOCKER / MAJOR を出した。
commit / push 後に SHA を指定して再レビューし PASS となった。

同様に、Reviewer の成果物（review report）も Reviewer コンテナにしか存在しない状態が生じ、
別途 commit / push して初めて追跡可能になった。

問題は2つに分かれる。

| 区分 | 内容 |
| --- | --- |
| Implementation persistence | Implementer の成果物を Reviewer が取得できる状態にすること |
| Review persistence | Reviewer の結果を後から追跡できる状態にすること |

## Evidence

| # | 事実 | 根拠 |
| --- | --- | --- |
| E-1 | Analyzer / Planner / Implementer は同一セッション `session_01N5dXBiKyW2vJNgTHU8daFD` で実行された | `88fb6fc` の Claude-Session、`MAGE-002-review.md` N-3 |
| E-2 | Status History の ANALYZING / WAITING_APPROVAL / REVIEWING の各行に「未コミット」と記録されている | `.ai/tasks/MAGE-002.md` Status History（ファイル L217 / L218 / L222） |
| E-3 | Human Approval の Scope に「自動 commit・push はしない」と書かれている | `.ai/tasks/MAGE-002.md` L202 |
| E-4 | Implementer は `TESTING → REVIEWING` に遷移させ、「Reviewer 待ち。未コミット」で停止した | 同 L222 |
| E-5 | 別セッションの Reviewer は成果物不在を理由に F-01 BLOCKER（成果物がリポジトリに存在しない）/ F-02 MAJOR（Status・承認記録を確認できない）を出した | `MAGE-002-review.md` Previous Findings |
| E-6 | Reviewer 自身が「どちらも成果物が受け渡されていなかったことが原因で、実装内容の不備ではなかった」と記録している | 同上 |
| E-7 | Implementation commit: `88fb6fc924bb5f7120401480a3874d45efd3c08b`（3ファイル +615: `.ai/reports/MAGE-002-analysis.md` / `.ai/tasks/MAGE-002.md` / `tests/mage-phantom.spec.js`） | `git show --stat 88fb6fc` |
| E-8 | 再レビューは Branch `claude/chapter-structure-scenario-test-q6oj4l`、Commit `88fb6fc…`、差分 `88fb6fc^..88fb6fc` を明記して行われた | `MAGE-002-review.md` Review Scope 表 |
| E-9 | Review commit: `4d7662f20b8bd8da0a996c31c1a2c26644d63cee`（`.ai/reports/MAGE-002-review.md` のみ、+185）。別セッション `session_01CZ2cLcXbSKR9gUtE4Ru8Fu` | `git show --stat 4d7662f` |
| E-10 | Review は「Final Review Decision: PASS」「Task Status: REVIEWING」「DONE にする操作は、このレビューでは行わない」で終わっている | `MAGE-002-review.md` 末尾 |
| E-11 | ブランチ先端（`4d7662f`）の `MAGE-002.md` は `Status: REVIEWING` / `Reviewer gate: pending` のまま | `MAGE-002.md` L5 / L191 / L195 |

## Current Protocol

現行 Protocol（`@4d7662f`）で handoff に関係する記述の全量。

| 箇所 | 記述 |
| --- | --- |
| `AGENTS.md` §4 L91-92 | 「各段は、成果物（Markdown）を残してから次へ渡す。前の段の成果物が無いまま次の段を始めない」 |
| `AGENTS.md` §5 L96-103 | Implementer 出力 = コード・テスト・Task の実装結果欄、次工程 Test。Reviewer 入力 = Task / diff / テスト結果、出力 = `<ID>-review.md` |
| `AGENTS.md` §5 L121-123 | Reviewer の独立性: 入力は Task / Plan / `git diff` / テスト結果だけ。独立性を1行で明記（`別の人間` / `別 Agent・別セッション` / `同一セッションで兼務`） |
| `AGENTS.md` §7 L179 / L182 | TESTING: 全て成功 → REVIEWING（担当 Implementer）。REVIEWING: PASS → DONE（担当 Reviewer） |
| `AGENTS.md` §15 L381 | 「共有情報は GitHub 上の小さな Markdown で受け渡す」 |
| `agents/implementer.md` L11 / L19 | Status `APPROVED → IMPLEMENTING → TESTING → REVIEWING`。手順4「Status と Status History を更新して Reviewer へ渡す」 |
| `agents/reviewer.md` L9 / L11 | Input: Task、`git diff`、Test Report。Task Status: `REVIEWING → DONE または CHANGES_REQUIRED` |
| `agents/reviewer.md` L8 | Permission: READ ONLY |
| `agents/reviewer.md` Output Template | Result / Independence / Checklist / Changed Files / …。**レビュー対象の branch・commit を書く欄は無い** |

## FACT

1. 現行 Protocol（`implementer.md`、§5 独立性、§14 Test Report 等）は `origin/claude/chapter-structure-scenario-test-q6oj4l` にだけ存在し、`origin/main`（`d93eb09`）には無い。本 Analyzer の作業ブランチ `claude/artifact-handoff-protocol-4gfgjg` も `main` 起点で、`.ai/agents/implementer.md` が存在しない。（`git ls-tree`、`git merge-base HEAD <branch>` = `501a320`）
2. `.ai/AGENTS.md` / `.ai/agents/*.md` / `.ai/tasks/README.md` / `.ai/reports/README.md` / `.ai/decisions/README.md` を `commit|push|sha|branch|ブランチ|コミット|worktree|working tree|session|セッション` で検索した結果、該当は §5 L121-123 と `reviewer.md` L9 / L21 / L36 の `git diff` と「別セッション」のみ。**commit / push / branch / SHA の規則は存在しない**。
3. Protocol は Reviewer 入力を `git diff` と定義しているが、diff の範囲（どの base からどの commit まで）を定義していない（`AGENTS.md` L121、`reviewer.md` L9）。
4. §15 は「GitHub 上の Markdown で受け渡す」と書くが、どの時点で GitHub（remote）へ載せるかを定めていない（L381）。
5. §4 は「成果物を残してから次へ渡す」と書くが、「残す」の意味（working tree への書き込み / commit / push）を定めていない（L91）。
6. Implementer の手順は「Status を更新して Reviewer へ渡す」で終わり、commit / push の手順が無い（`implementer.md` L19）。
7. 独立性の選択肢として `別 Agent・別セッション` が明記されている一方、その場合の成果物受け渡し方法は定義されていない（L122）。
8. `TESTING → REVIEWING` は Implementer が行う遷移で、条件は「全て成功」だけ（L179）。成果物が取得可能かは条件に含まれない。
9. Reviewer は READ ONLY（`reviewer.md` L8）だが、出力として `<ID>-review.md` を書き、Task Status を `REVIEWING → DONE / CHANGES_REQUIRED` に進める担当とされている（L11、§7 L182）。Reviewer がリポジトリへ書く（commit / push する）ことの可否は定義されていない。
10. MAGE-002 では Human Approval の Scope に「自動 commit・push はしない」が書かれ（E-3）、Implementer はそれに従い未コミットで REVIEWING にした（E-4）。
11. 別セッション Reviewer は成果物を取得できず、F-01 BLOCKER / F-02 MAJOR を出した（E-5）。原因は成果物の受け渡しで、実装不備ではないと Reviewer が記録した（E-6）。
12. commit / push 後、Reviewer は branch と SHA と diff 範囲を Review Scope に自主的に明記した（E-8）。これは Protocol 上の要求ではない（FACT-2、`reviewer.md` Output Template）。
13. Reviewer は review report を `4d7662f` として同じブランチに push した（E-9）。Protocol 上 Reviewer は READ ONLY で、この push を規定する記述は無い（FACT-9）。
14. Reviewer は PASS を出したが Task の Status を DONE にしなかった（E-10 / E-11）。一方、CHAPTER-STRUCTURE T-1（同一セッション兼務）では Reviewer が `REVIEWING → DONE` を記録している（`CHAPTER-STRUCTURE.md` Status History L56）。**DONE を Task ファイルに書く主体の運用が2件で異なる**。
15. T-1 Retrospective は「テスト実行中に stop hook が未コミット変更の push を求めたが、検証完了までコミットを保留した」を FACT F-13 とし、OPTIONAL に「stop hook と『検証前に push しない』の優先順位の明文化」を残している（`AI-AGENT-PROTOCOL-T1-retrospective.md`）。
16. T-1 Retrospective の DC-1「Reviewer を別セッションで実行することを必須にするか」は人間の判断に残されたまま（同上）。MAGE-002 は別セッション Reviewer の初回適用である（E-1 / E-9、T-1 は兼務: `CHAPTER-STRUCTURE-T1-review.md` L6）。
17. 両セッションは Claude Code の remote 実行環境で、コンテナ間で working tree を共有しない（各コミットの Claude-Session が別。Reviewer が remote のブランチを取得して初めて成果物を確認できた: E-5 → E-8）。
18. MAGE-002 の Review は `88fb6fc` を基準にした PASS であり、ブランチ先端 `4d7662f` と `88fb6fc` の差分は `.ai/reports/MAGE-002-review.md` の追加のみ（E-9）。
19. `MAGE-002-review.md` N-1 は、`88fb6fc` が `origin/main` の WORK 12.1 を含まないことを NOTE として記録している。

## INFERENCE

- **I-1**（FACT 2, 5, 6, 8）Protocol は「成果物を残す」を暗黙に **同じ working tree への書き込み** と同一視している。同一セッション兼務（T-1）ではこの前提が成り立つため、問題が表面化しなかった。
- **I-2**（FACT 7, 16, 17）`別 Agent・別セッション` を選択肢として認めながら、その場合に必要な「remote への永続化」を要求していない。Reviewer independence の導入（P-7）と handoff 規則の間に欠落がある。
- **I-3**（FACT 8, 10）`Implementation = COMPLETE`（テスト通過）と `Reviewer-ready`（Reviewer が取得可能）が同じ `TESTING → REVIEWING` 遷移に畳み込まれている。MAGE-002 では前者は満たされ後者は満たされないまま REVIEWING になった。
- **I-4**（FACT 3, 12）Review 対象が SHA で固定されていないため、「何をレビューしたか」が Review report から再現できる保証が無い。MAGE-002 で再現できたのは Reviewer が自主的に書いたため。
- **I-5**（FACT 10, 15）「自動 commit・push をしない」という人間の制約と、「検証前に push しない」という運用は、別セッション Reviewer と組み合わせると必ず handoff を止める。Protocol が **push のタイミング** を定義していないため、Approval Scope の一文がそのまま handoff 禁止として働いた。
- **I-6**（FACT 9, 13, 14）Reviewer の「READ ONLY」は「コード変更禁止」の意味で運用されており、report の commit / push は実際に行われている。ただし規定が無いので、report が Reviewer コンテナに残ったまま終わる可能性がある（MAGE-002 では人間の指示で回避された）。
- **I-7**（FACT 14）DONE を誰が Task ファイルへ書くかが未定義で、PASS 後に Task が REVIEWING のまま残る。Review persistence（report の存在）と Task state persistence（Status: DONE）は別の問題として扱う必要がある。
- **I-8**（FACT 1）Protocol 自体が未統合ブランチにしか無いため、別ブランチから開始したセッション（本 Analyzer を含む）は現行 Protocol を参照できない。これも「成果物が別の場所にあって見えない」同型の問題だが、P-9 の本題（Implementer → Reviewer）とは別。

## UNKNOWN

- **U-1** 「自動 commit・push はしない」は、(a) 検証前の push 禁止、(b) handoff 時も含む全 push の禁止、(c) 人間の明示 GO まで保留、のどれを意図していたか。MAGE-002.md からは判定できない。
- **U-2** 今後 Reviewer を別セッションで行うことを標準にするか（DC-1 は未決）。標準になるなら push 必須の頻度が上がる。
- **U-3** 共有 worktree（同一コンテナで別 Agent、ローカル環境で複数セッション）を運用で使う予定があるか。現時点の実績（T-1 / MAGE-002）はいずれも remote 実行環境。
- **U-4** Implementer / Reviewer が共通の作業ブランチに push する運用を続けるか、Task ごとにブランチを切るか。現状は複数 Task（CHAPTER-STRUCTURE / MAGE-001 / MAGE-002）が同じブランチに積まれている。
- **U-5** Review 後に DONE を Task ファイルへ書く主体（Reviewer / 人間 / Implementer）と、その記録をどのコミットで行うか。
- **U-6** Reviewer 起動時に branch / SHA を渡す経路（人間がプロンプトに書く / Task ファイルに書く / 両方）。Task ファイルに実装 SHA を書くと、そのコミット自身には自分の SHA を含められない（後述 Options の注記）。

## Options

共通の前提: remote 実行環境ではコンテナ間で working tree を共有できない（FACT 17）。

| 案 | 内容 | 利点 | 欠点 | 現行 Protocol との整合 |
| --- | --- | --- | --- | --- |
| **A** | Implementer 完了時に必ず commit / push し、branch + SHA を Reviewer へ渡す | 別セッション・別コンテナ・別の人間のどれでも同じ手順で成立。SHA で対象が固定され、Review が再現可能（I-4）。§15「GitHub 上で受け渡す」と一致 | 同一セッション兼務でも push が必要になる（コストは小さい）。レビュー前のコードが remote に載る（ただしブランチ上であり main ではない） | §15 と一致。§4「残してから渡す」の具体化として自然 |
| **B** | commit のみ必須。共有 worktree なら push 不要 | ローカル共有環境では push を省ける。SHA による対象固定は得られる | remote 実行環境では成立しない（MAGE-002 そのもの）。「共有 worktree か」の判定を各 Agent が行う必要がある | §15 と部分的に不一致。現行の実行環境では効果なし |
| **C** | Reviewer は同じ working tree を使うことを必須 | 追加手順が無い | 別セッション・別コンテナの Reviewer を事実上禁止する。§5 の `別 Agent・別セッション` と矛盾し、P-7 / DC-1 の方向と逆行。対象が SHA で固定されない | §5 L122 と矛盾 |
| **D** | A を基本とし、同一 working tree を確実に共有する場合（同一セッション兼務など）だけ B / C を許可 | A の利点を保ちつつ兼務時の手間を減らせる | 例外条件の判定が増える。例外時は remote に何も残らず、後から Review 対象を検証できない。規則が長くなる | 整合するが、例外分の規定追加が必要 |

補足:

- どの案でも **Review persistence** は別に規定が要る（A〜D はいずれも Implementer 側の規則）。
- 実装 SHA を Task ファイル自身に書くことはできない（書いた時点で SHA が変わる）。SHA は「Reviewer への引き渡し情報」または「Review report」に記録する方が無理がない。
- A でも「検証前に push しない」（T-1 F-13）とは矛盾しない。push の時点を **テスト完了後・REVIEWING への遷移時** に置けばよい。

## Recommended Protocol Change

**案 A**（例外は設けない、または例外を「同一セッション兼務」に限り、その場合も commit は必須）を推奨する。
理由: 現行の実行環境では B / C は成立せず（FACT 17）、C は §5 と矛盾し、D の例外は MAGE-002 の再発条件を残す。A は §4 / §15 の既存の意図を具体化するだけで、新しい Status も新しい Agent も要らない。

### 1. Implementer 完了時の成果物永続化

- テスト完了後、`TESTING → REVIEWING` に進める **前** に、Task の成果物（コード・テスト・Task ファイルの Implementation Result / Status History・その Task の analysis）を commit し、作業ブランチへ push する
- push できない場合（人間の制約、権限、ネットワーク）は REVIEWING に進めず、`TESTING` のまま「Reviewer-ready でない」旨を報告して止める（新しい Status は作らない。長引くなら既存の `BLOCKED`、理由: handoff 未完了）
- 「検証前に push しない」は維持する（push はテスト完了後だけ）

これにより `Implementation = COMPLETE`（テスト通過）と `Reviewer-ready`（remote で取得可能）を、同じ遷移の **2つの条件** として区別する。

### 2. Reviewer へ渡す branch / SHA

Implementer は完了報告（会話）に次の Review Handoff を出す。Task ファイルの Status History の `TESTING → REVIEWING` 行にも branch と SHA を書く（SHA は push 済みコミットのもの。Status History 行を含むコミット自身の SHA は書けないため、行には「このコミット」ではなく **直前の実装コミット** を書くか、実装と Status 更新を1コミットにして SHA は Handoff にのみ書く。どちらにするかは Planner で決める）。

最小の Review Handoff（重複を避け、パスと SHA だけ）:

| 項目 | 例（MAGE-002） |
| --- | --- |
| Task ID | `MAGE-002` |
| Branch | `claude/chapter-structure-scenario-test-q6oj4l` |
| Implementation commit SHA | `88fb6fc924bb5f7120401480a3874d45efd3c08b` |
| Diff range | `88fb6fc^..88fb6fc`（複数コミットなら `<base>..<sha>`） |
| Task / Plan | `.ai/tasks/MAGE-002.md`（Approval・Plan・Implementation Result・Test Report を含む） |
| Analysis | `.ai/reports/MAGE-002-analysis.md` |

Test Report・Approval・Plan は Task ファイル内にあるので、別項目として渡さない（重複を避ける）。

### 3. Reviewer がレビュー対象を特定する方法

- Reviewer は Handoff の Branch を fetch し、**指定 SHA を checkout / 参照** してレビューする。ブランチ先端ではなく SHA を正とする
- 指定 SHA が取得できない、または Task / Plan / Test Report がその SHA に無い場合は、内容のレビューを行わず「Handoff 不備」として Implementer / 人間へ戻す（BLOCKER を内容の指摘として出さない。MAGE-002 の F-01 / F-02 相当を区別する）
- Review report に Branch / Reviewed commit SHA / Diff range を必須欄として書く（MAGE-002 の Review Scope 表を正式化）

### 4. Reviewer report の永続化

- Reviewer の「READ ONLY」は **ゲームコード・テスト・Task の計画本文を変更しない** 意味と明記し、`.ai/reports/<ID>-review.md` の追加だけは commit / push してよい（してから終わる）とする
- push するブランチはレビュー対象と同じブランチ。Review commit はレビュー対象 SHA の子孫になり、差分は review report だけになる（MAGE-002 の `4d7662f` と同じ形）
- PASS / CHANGES_REQUIRED は review report の `Result` 欄を正本とする（会話だけで終わらせない）

### 5. DONE へ進む前の必要条件

`REVIEWING → DONE` の条件を次のすべてとする:

- [ ] Review report が remote のブランチに存在する（push 済み）
- [ ] Result が PASS
- [ ] Review report の Reviewed commit SHA が、Task の最終実装コミットと一致する（レビュー後にコード差分が追加されていない）
- [ ] Task ファイルの Status を DONE にし Status History に1行追記したコミットが push されている

DONE を Task ファイルへ書く主体（U-5）は Human Decision とする。

## Required File Changes

実際にはまだ変更しない。変更するとしたら次の箇所（すべて `.ai/` 配下、現行 Protocol のあるブランチ上）。

| ファイル | セクション | 変更内容 |
| --- | --- | --- |
| `.ai/AGENTS.md` | §4 Standard Workflow（L91-92 付近） | 「成果物を残す」を「commit し作業ブランチへ push する」と定義（1〜2行） |
| `.ai/AGENTS.md` | §5 Reviewer の独立性（L121-123） | Reviewer 入力を「Handoff の branch / SHA の内容」に固定。Reviewer が review report だけを commit / push してよいこと |
| `.ai/AGENTS.md` | §7 状態表 TESTING / REVIEWING 行（L179 / L182） | TESTING → REVIEWING の条件に「push 済み・Handoff 提示」、REVIEWING → DONE の条件に「review report push 済み・SHA 一致」を追加 |
| `.ai/AGENTS.md` | §15 Communication（L381） | 新節を作らず、ここに Review Handoff の項目（上の表）を置くか、§5 に置く（どちらか1か所。重複させない） |
| `.ai/agents/implementer.md` | Procedure 手順4（L19）、Output Template | 手順に commit / push と Review Handoff 出力を追加。Implementation Result に `Branch` / `Commit` 行（または Handoff 欄） |
| `.ai/agents/reviewer.md` | Input（L9）、Review Order 1 の前、Output Template | Input に branch / SHA。最初の手順として「指定 SHA の取得と成果物の存在確認（不備なら Handoff 不備として戻す）」。Output に `## Review Target`（Branch / Reviewed commit / Diff range）と「report を push して終える」 |
| `.ai/tasks/README.md` | Status History の説明 | 必要なら `TESTING → REVIEWING` / `REVIEWING → DONE` の Note に SHA を書く例を1行（Planner で要否判断） |

変更しないもの: `.ai/agents/analyzer.md` / `planner.md` / `debugger.md`、`.ai/reports/README.md`（命名は変わらない）、Status 一覧（新 Status は追加しない）。

## Migration / Existing Tasks

- **MAGE-002**: やり直し不要。
  - Implementation persistence: `88fb6fc` に3成果物が存在し、Review はその SHA を対象に PASS（E-7 / E-8）。推奨案の条件 1〜3 を事後的に満たしている
  - Review persistence: `4d7662f` に review report が存在し、`88fb6fc` からの差分は report のみ（FACT 18）。条件 4 を満たす
  - 未了なのは Task ファイルの `Status: REVIEWING` → `DONE` の記録だけ（E-11）。これは P-9 の範囲外の通常の状態更新として、人間の判断で行えばよい（条件 5 の「DONE を書く主体」次第）
  - N-1（`origin/main` の WORK 12.1 を含まない）は統合時の確認事項であり、P-9 とは無関係
- **CHAPTER-STRUCTURE T-1**: 同一セッション兼務で DONE 済み。遡及修正は不要（Retrospective の方針どおり既存成果物は書き換えない）
- **MAGE-001**: 実装を伴わない移行 Task。影響なし
- **進行中・今後の Task**: 変更後の Protocol は、次に `TESTING → REVIEWING` に遷移する承認単位から適用する
- **Protocol 自体の所在（I-8）**: 現行 Protocol は未統合ブランチにしか無い。P-9 の変更も同じブランチに載せるのか、先に `main` へ統合するのかは Planner / 人間の判断（下記 H-5）

## Human Decisions

- **H-1** 案の選択: A（例外なし）/ D（同一セッション兼務のみ push 免除、commit は必須）
- **H-2** 「自動 commit・push はしない」系の Approval Scope 文言の扱い: 今後は「検証完了前の push をしない」に限定し、handoff 時の push は Protocol 上の必須手順として Approval とは別扱いにするか。それとも handoff の push ごとに人間の GO を求めるか
- **H-3** Reviewer が review report を commit / push してよいか（READ ONLY の定義の明確化）
- **H-4** `REVIEWING → DONE` を Task ファイルへ書く主体（Reviewer / 人間 / Implementer）
- **H-5** P-9 の Protocol 変更をどのブランチに載せるか（現行 Protocol のある `claude/chapter-structure-scenario-test-q6oj4l` か、`main` 統合後か）
- **H-6** MAGE-002 の `Status: DONE` 記録をいつ・誰が行うか（P-9 と切り離して行ってよいか）

## Out of Scope

- Game code
- E2E implementation
- Test changes
- Existing game behavior
- MAGE-002 reimplementation
- Unrelated Protocol redesign（Task ごとのブランチ運用 U-4、Protocol の main 統合そのもの、DC-1〜DC-4 の決定）

## Recommendation

次の Planner で、`.ai/tasks/P-9.md` として以下を計画する。

1. H-1〜H-5 の決定を前提条件として列挙する（未決なら WAITING_APPROVAL で止める）
2. Required File Changes の7箇所だけを Files To Change とし、各箇所の追記文案（数行ずつ）を示す。新節・新 Status・新 Agent は作らない
3. Review Handoff の項目は1か所（§5 または §15）にだけ定義し、implementer.md / reviewer.md からは参照する（§ 冒頭の「同じルールを他のファイルへ書き写さない」に従う）
4. Completion Criteria: 変更後の Protocol を MAGE-002 の実績（`88fb6fc` → `4d7662f`）に当てはめて、条件 1〜5 がすべて判定可能であることを机上確認する
5. ゲームコード・テストは Files Not To Change に明記する

## Protocol Status

Status: ANALYZING
Human Approval: NOT REQUIRED YET
Implementation: NOT AUTHORIZED
Tests: NOT RUN
