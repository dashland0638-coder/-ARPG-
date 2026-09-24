# P-10 Analysis — Artifact Handoff Automation（Analyzer → Planner）

- Phase: Analyzer only（READ ONLY。このファイル以外は変更していない。commit / push していない。テスト・Task file 作成・実装はしていない）
- Protocol baseline: `origin/main` @ `bd94a5f76dd886bc78d10eb0ae3f3752604a84fc`（P-9 統合済み）。本文の `path:line` はすべてこの時点
- 作業ブランチ: `claude/p10-artifact-handoff-analysis-enfr9v`（`main` @ `bd94a5f` と同一）
- 調査日: 2026-09-24

## Task

P-10 / P-9 で導入した Artifact Handoff（Implementer → Reviewer）を、Analyzer / Planner 間のセッション分離を保ったまま
自動化する方法を分析する。直接の契機は、Analyzer セッションで作られた `.ai/reports/ENEMY-ATTACK-VIS-001-analysis.md` を
別セッションの Planner が参照できず BLOCKED になったこと。

## Summary

- P-9 は **Implementer → Reviewer** と **Reviewer → DONE** の受け渡しだけを「remote に push 済み」と定義した。
  **Analyzer → Planner** と **Planner → Implementer** は「成果物（Markdown）を残してから次へ渡す」（`.ai/AGENTS.md:93-94`）のままで、
  「残す」の意味が定義されていない（FACT）
- 同時に P-9 は「Analyzer / Planner に commit / push の権限は無い」（`.ai/AGENTS.md:199`）と明記した。
  その結果、別セッションで動く Analyzer の report が remote へ出る **正規の経路が存在しない**（FACT）
- P-9 Final Audit F-01 の対処（Analyzer report を「最初の実装 commit」に含める。`.ai/AGENTS.md:195-196`）は、
  Analyzer / Planner / Implementer が **同じ working tree を持つ** ことを暗黙の前提にしている（INFERENCE）。別セッションでは成立しない
- 推奨は **「Pin-by-SHA Analysis Handoff」**: 永続化（誰が push するか）と受け渡し（どの版を読むか）と承認（内容が正しいか）を分離する。
  Analyzer report は 1ファイルだけの commit として source branch に置き、Planner は **コピーせず** `branch + commit SHA + blob SHA` で
  固定した版を READ ONLY で読む。物理的なコピーは既存の §7.3 手順2（Implementer の最初の実装 commit）で行い、blob 一致で改変を検知する。
  新しい Status・Agent は作らない。P-9 の Review Handoff（§5.1）と同型の定義を1つ足す
- 残る根本判断は1つ: **source branch への push を誰が行うか**（Human / Analyzer に report 1ファイル限定の Persistence を与える）。これは P-9 の §6 を変える判断で、AI は決めない（DECISION P10-D1）

## Existing System Search

| 探したもの | 検索語 / 範囲 | 結果 |
| --- | --- | --- |
| Analyzer → Planner の受け渡し定義 | `残す` `Handoff` `remote` / `.ai/AGENTS.md` `.ai/agents/*.md` | あり（未定義の形）: `.ai/AGENTS.md:93-94` は「成果物を残してから次へ渡す」のみ。remote の定義は Implementer→Reviewer / Reviewer→DONE に限定（`.ai/AGENTS.md:96-97`） |
| Review Handoff（再利用候補） | `Review Handoff` `V-1` / 同上 | あり: `.ai/AGENTS.md:131-166`（5項目・V-1〜V-6・BLOCKED（理由: Review Handoff 不備））。Analyzer / Planner 向けの同等物は **無いことを確認** |
| Analyzer / Planner の push 権限 | `commit / push の権限` `Persistence` / `.ai/AGENTS.md` | あり: `.ai/AGENTS.md:199`「Analyzer / Planner に commit / push の権限は無い。Human Approval より前に … push する規定も設けない（人間が自分で行うことは妨げない）」 |
| Analyzer report を remote に載せる既存経路 | `Analyzer report` / `.ai/AGENTS.md` `.ai/agents/implementer.md` | あり: `.ai/AGENTS.md:195-196`、`.ai/AGENTS.md:296`、`.ai/agents/implementer.md:20`（Implementer の最初の実装 commit に含める） |
| Task file の Analysis 参照形式 | `^Analysis` / `.ai/tasks/*.md` | あり: テンプレートは相対パスのみ（`.ai/tasks/README.md:19`）。**P-9.md だけが branch @ SHA つき**（`.ai/tasks/P-9.md:7`） |
| 過去の cross-branch 受け渡しの実例 | `git log` / `9044dcc` `7a94624` | あり: P-9 Analyzer セッションが自ブランチ `claude/artifact-handoff-protocol-4gfgjg` に report を commit・push（`9044dcc`）→ Planner が「copied unchanged from 9044dcc」として別ブランチへ持ち込んだ（`7a94624`、cherry-pick 元 `9e738d0`）。P-9.md Status History（`.ai/tasks/P-9.md:348`）に「人間の承認による」と記録 |
| Artifact 専用ブランチ / 自動同期の仕組み | `artifact` `sync` / `git ls-remote origin`、`.github/workflows/` | **無いことを確認**。remote ブランチ一覧に専用ブランチなし。workflow は `deploy.yml`（main push → Pages）と `test.yml`（PR → build/unit/E2E）のみ、いずれも `permissions: contents: read` |
| Artifact の改変検知 | `blob` `hash` `sha256` / `.ai/` | **無いことを確認**。V-4 は「存在する」ことだけを確認（`.ai/AGENTS.md:157`） |
| ENEMY-ATTACK-VIS-001 の成果物 | `enemy-attack`（大文字小文字無視）/ 全 `refs/remotes/origin/*` の `.ai/reports` と、作業ツリーの `*.md` | **無いことを確認**（2026-09-24 に `git fetch origin` 後、全 remote ブランチを走査） |
| P-9 で本件を扱ったか | `Analyzer / Planner の成果物` / `.ai/tasks/P-9.md` | あり: Out of Scope（`.ai/tasks/P-9.md:303`、`:474`）。P-9-analysis I-8 と「同型の問題だが本題外。必要なら別 Task」 |

## Relevant Files

- `.ai/AGENTS.md` §4（L93-97）/ §5.1（L131-166）/ §6（L189-205）/ §7.3（L283-326）/ §15（L495-496）: 受け渡し・権限・完了条件の正本
- `.ai/agents/analyzer.md:8-12`: READ ONLY、Output、Next=Planner
- `.ai/agents/planner.md:9`: Input = Analyzer report（所在の定義なし）
- `.ai/agents/implementer.md:18-21`: Analyzer report を最初の実装 commit に含める
- `.ai/agents/reviewer.md`: Review Order 0（V-1〜V-6）
- `.ai/tasks/README.md:19`: `Analysis:` 行の形式
- `.ai/reports/README.md`: 命名 `TASK-ID-analysis.md`
- `.ai/tasks/P-9.md`、`.ai/reports/P-9-analysis.md` / `P-9-review.md` / `P-9-review-2.md` / `P-9-final-audit.md`: P-9 の設計と証跡

## Problem

A. **可視性**: Analyzer と Planner を別セッション・別ブランチで動かすと、Analyzer report は Analyzer コンテナの working tree にだけ存在し、
Planner のブランチからは見えない。

B. **権限との衝突**: Protocol 上、Analyzer は report を remote へ出せない（§6 L199）。Planner は「Analyzer report の FACT だけを前提にする」
（`.ai/agents/planner.md` 手順1）ため、report が無ければ正しく BLOCKED になる。つまり **Protocol どおりに動くほど詰まる**。

C. **同一性**: 仮に report がどこかに push されても、Planner がどの版を読んだのか・後で改変されていないかを記録・検証する規定が無い。

## FACT

| # | 事実 | 根拠 |
| --- | --- | --- |
| F-1 | 「残す」が remote への commit・push を意味するのは Implementer → Reviewer と Reviewer → DONE だけ | `.ai/AGENTS.md:96-97` |
| F-2 | 他の段は「成果物（Markdown）を残してから次へ渡す。前の段の成果物が無いまま次の段を始めない」 | `.ai/AGENTS.md:93-94` |
| F-3 | Analyzer / Planner に commit / push の権限は無い。Human Approval 前に Analyzer report・Task file を push する規定も無い。人間が自分で行うことは妨げない | `.ai/AGENTS.md:199` |
| F-4 | Analyzer report と Task file を remote へ載せる唯一の規定経路は、Implementer の最初の実装 commit（remote に無い場合、Human Approval 時点の内容のまま） | `.ai/AGENTS.md:195-196`、`:296`、`.ai/agents/implementer.md:20` |
| F-5 | Analyzer の Output は `.ai/reports/<ID>-analysis.md`、Next は Planner。所在（branch）の定義は無い | `.ai/agents/analyzer.md:10-12` |
| F-6 | Planner の Input は Analyzer report。取得方法の定義は無い | `.ai/agents/planner.md:9` |
| F-7 | Task Template の `Analysis:` は相対パスのみ | `.ai/tasks/README.md:19` |
| F-8 | P-9.md の `Analysis:` は `branch @ 40桁SHA` 付きで記録されている（Protocol 上の規定ではなく実例） | `.ai/tasks/P-9.md:7` |
| F-9 | P-9 の Analyzer report は Analyzer セッションが自ブランチへ commit・push した（`9044dcc`、本文には「commit / push していない」と記載。push は P-9 の §6 導入前） | `git show 9044dcc`、`.ai/reports/P-9-analysis.md:5` |
| F-10 | Planner 側では「copied unchanged from 9044dcc」として別ブランチに持ち込み、人間の承認で push した | `7a94624`（cherry-pick 元 `9e738d0`）のメッセージ、`.ai/tasks/P-9.md:348` |
| F-11 | P-9 は Analyzer / Planner 成果物の push 規則を Out of Scope とした | `.ai/tasks/P-9.md:303`、`:474` |
| F-12 | Final Audit F-01「Analyzer / Planner の成果物が remote へ残る経路が無い」は、F-4 の規定で RESOLVED とされた。Analyzer / Planner の push 権限は追加していない | `.ai/reports/P-9-final-audit.md:40` |
| F-13 | Reviewer の V-4 は「Analyzer report が存在する」ことだけを確認する。内容の同一性は確認しない | `.ai/AGENTS.md:157` |
| F-14 | `ENEMY-ATTACK-VIS-001-analysis.md` は、`origin` のどのブランチにも存在しない | 2026-09-24、全 `refs/remotes/origin/*` の `ls-tree` 走査 |
| F-15 | 実行環境のセッションブランチは `claude/<topic>-<6文字の suffix>` 形式でセッションごとに割り当てられる（例: 本セッション `claude/p10-artifact-handoff-analysis-enfr9v`、P-9 Analyzer `claude/artifact-handoff-protocol-4gfgjg`） | `git ls-remote origin` |
| F-16 | remote 実行環境ではコンテナ間で working tree を共有できない | P-9-analysis FACT 17（`.ai/reports/P-9-analysis.md`） |
| F-17 | GitHub Actions は `contents: read` のみで、ブランチ間の同期を行う workflow は無い | `.github/workflows/deploy.yml`、`test.yml` |
| F-18 | Reviewer の commit 範囲は「review report・Status 更新・Status History 追記」だけに限定され、Persistence の `許可` 1つで Implementer と共に許可される（P-9 の「レポートだけを commit する READ ONLY 役割」の前例） | `.ai/AGENTS.md:193-198`、`:304-310` |

## INFERENCE

- **I-1**（F-3 / F-4 / F-16）: F-01 の対処は「Implementer の working tree に Analyzer report がある」ことを前提にしている。
  別セッションでは Implementer もそれを持たないため、F-4 は同一セッション兼務でしか機能しない
- **I-2**（F-9 / F-10 / F-3）: P-9 以前は Analyzer セッションの push（実行環境の既定動作）が非公式の受け渡し経路として働いていた。
  P-9 が §6 L199 で Analyzer の push を明示的に否定したため、その非公式経路が閉じ、ENEMY-ATTACK-VIS-001 で初めて顕在化した
- **I-3**（F-14 / F-16）: ENEMY-ATTACK-VIS-001 の report は Analyzer コンテナにしか無い。コンテナが回収されていれば失われており、Analyzer の再実行が必要（未確認）
- **I-4**（F-15）: ブランチ名はセッションごとに変わるため、「同じブランチに積めば見える」運用は、人間がセッション作成時に明示的に同じブランチ（または起点 SHA）を指定しない限り成立しない
- **I-5**（F-13）: 現状、Implementer が Analyzer report を「持ち込む」際に書き換えても（意図的でなくても）Reviewer は検知できない
- **I-6**（F-18）: 「READ ONLY 役割がレポート1ファイルだけを commit する」ことは P-9 で Reviewer に前例がある。
  Analyzer に同型の限定 Persistence を与えても、コード・仕様に対する READ ONLY は保たれる。ただし §6 L199 の明示的な否定を変えることになる

## Existing System First

新しい仕組みの前に、既存機能だけで解決できるかを検討した。

| 既存機能 | そのまま使えるか | 使えない / 不足する理由 |
| --- | --- | --- |
| §4「成果物を残してから渡す」 | 不足 | 「残す」の意味が Analyzer → Planner で未定義（F-1 / F-2） |
| §5.1 Review Handoff（Branch / SHA / Diff range / Task file / V-1〜V-6） | **形式は再利用できる** | 対象が Implementer → Reviewer に限定。Analysis 用の項目（Artifact path・blob）と検証が無い |
| §6「人間が自分で行うことは妨げない」 | **永続化の手段としては使える** | 手順・記録形式が無く、Planner が「人間が push した版」を特定・検証できない。毎回人間の手作業になる |
| §6 / §7.3 手順2（Implementer が最初の commit に含める） | **物理コピーの段として再利用できる** | Planner より後の段なので Planner の開始条件を満たさない。別セッションでは Implementer も report を持たない（I-1） |
| P-9.md の `Analysis: path（branch @ SHA）` 実例 | **参照形式として再利用できる** | Protocol に定義が無い。blob（内容同一性）を含まない |
| P-9 の「copied unchanged from 9044dcc」運用 | 手順の原型 | 「unchanged」を検証する手段が無い（I-5） |
| git の不変性（commit SHA / blob SHA / `merge-base --is-ancestor`） | **検証手段としてそのまま使える** | — |
| GitHub Actions | 使えない | 同期 workflow は無く、`contents: read`（F-17）。書き込み権限付き bot の追加は新しい仕組み |

結論（INFERENCE）: 新規に要るのは **(1) source を remote に置く主体の決定** と **(2) Analysis Handoff の項目・検証の定義** の2つだけ。
取得・同一性検証・物理コピーは既存の git 操作と §5.1 / §7.3 の構造を再利用できる。

## Current P-9 Handoff

```
Analyzer ──(未定義: working tree)──▶ Planner ──(未定義)──▶ Human Approval ──▶ Implementer
                                                                              │ §7.3 手順2: 最初の commit に
                                                                              │ Analyzer report / Task file を含める
                                                                              ▼ push（Persistence 許可）
                                                              Review Handoff §5.1（Branch / SHA / Diff range / Task file）
                                                                              ▼
                                                              Reviewer: V-1〜V-6 → review commit push → DONE（§7.3）
```

- 定義済み（P-9）: Implementer → Reviewer、Reviewer → DONE
- 未定義: Analyzer → Planner、Planner → Human / Implementer（本 Task の主対象は前者。後者は同型の問題として Open Questions に残す）

## Failure Scenario

1. Analyzer セッション（ブランチ A）が `.ai/reports/ENEMY-ATTACK-VIS-001-analysis.md` を working tree に作成。§6 L199 に従い commit / push しない
2. 人間が Planner を別セッション（ブランチ B、`main` 起点）で起動
3. Planner は `.ai/reports/ENEMY-ATTACK-VIS-001-analysis.md` を読もうとするが、ブランチ B にも remote のどのブランチにも無い（F-14）
4. `.ai/AGENTS.md:94`「前の段の成果物が無いまま次の段を始めない」に従い BLOCKED

どの段も Protocol に違反していない。欠けているのは「Analyzer の成果物が Planner に届く経路」そのもの。

派生する失敗（仮に人間が手で push した場合でも起こりうる）:

| # | 事象 | 現行で検知できるか |
| --- | --- | --- |
| FS-1 | Planner がブランチ先端を読み、後から Analyzer report が更新されて Planner の前提と食い違う | できない（版の記録が無い） |
| FS-2 | 別 Task の report、または別種別（debug / review）を誤って参照 | できない（Task ID・種別の検証が無い） |
| FS-3 | Implementer が report を持ち込む際に内容が変わる | できない（F-13、I-5） |
| FS-4 | 同じ report を2回持ち込む／2つのブランチに別版が存在する | できない |
| FS-5 | source branch と Task file に書かれたブランチが違う | できない |

## Candidate Solutions

要件（依頼 D 項）を R-1〜R-11 とする:
R-1 Analyzer READ ONLY 維持 / R-2 Human Approval を代行しない / R-3 未 Handoff では Planner 開始不可 / R-4 Task ID 検証 /
R-5 種別検証 / R-6 source・destination 追跡 / R-7 二重 Handoff で破綻しない / R-8 Handoff 後の改変検知 /
R-9 branch mismatch 検知 / R-10 Reviewer が出所を追跡 / R-11 P-9 の DONE 条件を壊さない。

| 案 | 内容 | 長所 | 短所 | 要件 |
| --- | --- | --- | --- | --- |
| **C1** source → destination 自動同期 | bot / Action が Analyzer ブランチの report を Planner ブランチへ commit | 人手不要 | 書き込み権限付き bot が新設（F-17 で現状 read のみ）。destination は Planner 起動時まで決まらない（I-4）。bot の commit が「誰の承認で」行われたかが曖昧。P-9 の「Persistence は人間が branch 名つきで明示」と衝突 | R-2 △、R-6 ○、R-8 △（検証は別途要る）、R-11 ○ |
| **C2** Artifact 専用ブランチ（例 `ai-artifacts`） | 全 Analyzer report を1本のブランチへ push | 所在が一意 | Analyzer に push 権限が要る（R-1 / §6 と衝突）。並行セッションで同一ブランチへの push 競合。Task の作業ブランチと系譜が切れ、Reviewer の V-4（Implementation SHA から到達）と整合しない | R-1 ✕、R-10 △ |
| **C3** 人間が Artifact commit を行う | Analyzer 終了後、人間が report 1ファイルを commit・push | 現行 §6 L199「人間が自分で行うことは妨げない」の範囲で **Protocol 変更なしに今すぐ可能** | 毎回人手。どの版を渡したかが記録されない（FS-1〜5 は残る） | R-1 ○、R-2 ○、R-4〜R-9 ✕（検証定義が無い） |
| **C4** GitHub PR / commit を利用 | Analyzer ブランチの PR、または commit SHA を受け渡しの単位にする | commit SHA は不変で改変検知の基礎になる。PR は人間の可視性が高い | PR は「承認（merge）」の意味を帯び、受け渡しと内容承認を混同しやすい。merge 先（main）へ未承認の分析が入る | SHA 参照部分は R-6〜R-10 ○。PR merge は R-2 と混同リスク |
| **C5** Protocol に Handoff Agent / Step を追加 | 専用 Agent が受け渡しを担当 | 責務が明確 | P-9 AC-10「新しい Status・Agent を追加しない」の方針と逆行。Agent を足しても push 主体の問題は解決しない（その Agent の権限を誰が与えるか） | R-11 △ |
| **C6** Pin-by-SHA Analysis Handoff（推奨） | source 側: report 1ファイルだけの commit を source branch に push（主体は P10-D1）。Analyzer が Analysis Handoff（Task ID / Kind / Source Branch / Source SHA / Path / Blob SHA）を出力。Planner は `git fetch` と `git show <SHA>:<Path>` で **コピーせず** 読み、検証 H-1〜H-8 を満たさなければ開始しない。Task file の `Analysis:` 行に同じ参照を記録。物理コピーは既存 §7.3 手順2 で Implementer が行い、blob 一致を確認。Reviewer は V-4 で blob 一致を追加確認 | 既存の §5.1 形式・§7.3 手順2・P-9.md の実例をそのまま拡張。新しい Status / Agent / bot 不要。Planner は READ ONLY のまま（working tree に書かない） | source への push 主体の判断が残る（P10-D1）。Analysis Handoff の定義を1つ追加 | R-1〜R-11 すべて ○（R-1 は D1 の選択次第、下記） |
| C6' Branch chaining（C6 の変形） | 人間が Planner セッションを Analyzer の Source SHA を起点に作成 | report が物理的に存在し、系譜（ancestor）で出所が自明 | 起点指定はセッション作成時の人間操作に依存。Planner が複数 Analysis を読む場合に使えない | C6 と同じ検証で成立。C6 の運用オプションとして扱う |

C6 の R-1 について: P10-D1 で (a) 人間が push を選べば Analyzer は完全に READ ONLY のまま。
(b) Analyzer に report 1ファイル限定の Persistence を与える場合も、コード・仕様・他の Markdown への READ ONLY は保たれる（Reviewer と同型、I-6）。
ただし §6 L199 の文言変更を伴う。

## Recommended Architecture

**C6: Pin-by-SHA Analysis Handoff**（提案。決定は人間）

3つの概念を分けて扱う:

| 概念 | 意味 | 担い手 | 正本 |
| --- | --- | --- | --- |
| Persistence（永続化） | Analyzer report を remote の source branch に1ファイル commit として置く | Human、または P10-D1 で許可された Analyzer | source commit |
| Handoff（受け渡し） | どの版を次段が読むかを `branch + SHA + blob` で固定し、検証する | Analyzer が出力、Planner が検証 | Task file の `Analysis:` 行 |
| Approval（承認） | 内容に基づく計画を実装してよいか | Human のみ（既存 §6、変更なし） | Task file の Human Approval 欄 |

### Analysis Handoff（案。§5.1 と同じ場所に1か所だけ定義する想定）

| 項目 | 内容 | 検証で使う |
| --- | --- | --- |
| Task ID | `<ID>`（Work Item 専用 analysis は `<ID> / T-n`） | H-4 |
| Kind | `analysis`（将来 `debug` 等へ拡張可能） | H-5 |
| Source Branch | report を push したブランチ | H-1 |
| Source SHA | report を追加・更新した commit（40桁） | H-1 / H-3 |
| Path | `.ai/reports/<ID>-analysis.md`（Work Item は `<ID>-<ITEM>-analysis.md`） | H-2 / H-4 / H-5 |
| Blob SHA | `git rev-parse <Source SHA>:<Path>` | H-6 / 改変検知 |

出力例（書式案）:

```text
Analysis Handoff
- Task ID: <ID>
- Kind: analysis
- Source Branch: <branch>
- Source SHA: <40桁>
- Path: .ai/reports/<ID>-analysis.md
- Blob SHA: <40桁>
```

Task file の記録形式（P-9.md L7 の実例を正式化する案）:

```text
Analysis: .ai/reports/<ID>-analysis.md（branch `<Source Branch>` @ `<Source SHA>`、blob `<Blob SHA>`）
```

### データの流れ

```
Analyzer (session A, branch A)
  │ report を作成（READ ONLY: 書くのは report だけ）
  │ Persistence: report 1ファイルだけの commit を branch A へ push   ← 主体は P10-D1
  │ Analysis Handoff を出力
  ▼
Planner (session B, branch B)                         … コピーしない
  │ git fetch origin <Source Branch>
  │ H-1〜H-8 を検証（すべて read-only の git 操作）
  │ git show <Source SHA>:<Path> で読む
  │ Task file を作成し Analysis: 行に Handoff の参照を記録 → WAITING_APPROVAL
  ▼
Human Approval（内容の承認。既存 §6 のまま）
  ▼
Implementer（既存 §7.3 手順2 を拡張）
  │ remote の作業ブランチに Path が無ければ git show <Source SHA>:<Path> から復元して最初の commit に含める
  │ git hash-object <Path> == Blob SHA を確認（不一致なら commit しない）
  ▼
Reviewer（V-4 を拡張）
  │ git rev-parse <Implementation SHA>:<Path> == Task file の Blob SHA
  │ Source SHA が Source Branch から到達可能（出所の追跡）
```

## Automation Boundary

「受け渡し」と「承認」を混同しないため、処理ごとに分ける。

| 処理 | 区分 | 担当 |
| --- | --- | --- |
| Analyzer report の作成 | 自動（AI） | Analyzer |
| report 1ファイルの commit・push（source branch） | **Human 操作**、または P10-D1 (b) 採用時のみ Analyzer（許可の記録つき） | Human / Analyzer |
| Blob SHA の計算と Analysis Handoff の出力 | 自動 | Analyzer（push が人間の場合は人間の push 後に出力、または人間が `git rev-parse` で得る） |
| `git fetch`・到達性・パス・Task ID・種別・blob の検証（H-1〜H-8） | 自動（read-only） | Planner |
| Analyzer report の読込み（`git show`） | 自動（read-only） | Planner |
| Task file への `Analysis:` 参照の記録 | 自動 | Planner（Planner の既存の書き込み範囲内） |
| 検証失敗時の BLOCKED 報告 | 自動 | Planner |
| 検証失敗の解消（再 push、正しい Handoff の再提示、Analyzer 再実行の判断） | **Human 判断** | Human |
| Handoff の内容に基づく計画の承認 | **Human のみ**（§6、変更なし） | Human |
| Persistence（Implementer / Reviewer の push）の許可 | **Human のみ**（§6、変更なし） | Human |
| Analyzer report の物理コピーと blob 確認 | 自動 | Implementer（§7.3 手順2 の範囲） |
| 出所・同一性の検証 | 自動 | Reviewer（V-4 拡張） |

原則:

- **Handoff の成功は「どの版を読んだか」が確定・検証されたことだけを意味する。内容の正しさの承認ではない。**
  Planner は従来どおり FACT / INFERENCE を区別して扱い、内容の承認は Human Approval でのみ行う
- AI は Handoff 検証の失敗を「承認済み」で上書きしない。Blob 不一致を自分で解消（再コピー・書き換え）しない
- Analyzer と Planner の間に Human Approval Gate を新設しない（現行 §4 のワークフローを変えない）

## Security / Integrity Considerations

| 観点 | 対策（C6） |
| --- | --- |
| 改変検知 | Blob SHA（git の内容ハッシュ）で固定。Planner / Implementer / Reviewer の3点で照合。ブランチ先端ではなく Source SHA を読む（FS-1 を排除） |
| 出所 | `git merge-base --is-ancestor <Source SHA> origin/<Source Branch>` で source branch 由来を確認。commit の `Claude-Session:` trailer（実例 F-9）で Analyzer セッションを追跡可能 |
| Analyzer の READ ONLY の証跡 | H-3: `git diff --name-only <Source SHA>^ <Source SHA>` が Path 1件だけ。Analyzer commit にコード・Protocol 変更が混ざっていれば Handoff を不成立にする |
| 取り違え | H-4 / H-5: Path がテンプレート命名（`.ai/reports/README.md`）に一致、report 見出し `# <ID> Analysis`（`.ai/agents/analyzer.md` テンプレート）と Task ID が一致 |
| 二重 Handoff | 識別キーを `(Task ID, Kind, Blob SHA)` とする。同じキーの再 Handoff は no-op（冪等）。同じ `(Task ID, Kind)` で Blob が異なるものは「新しい版」として扱い、Planner が Task file の `Analysis:` を更新するのは `WAITING_APPROVAL` 前だけ。承認後の差し替えは Human Approval の取り直し（§6 の既存規則「承認範囲を変える場合は取り直す」を適用） |
| force push / 履歴改変 | Source SHA が source branch から到達不能になれば H-1 で検知。SHA 自体は Task file に残るため、到達不能を BLOCKED として人間へ返す |
| 権限の拡大 | C1 / C2 のような書き込み権限付き bot・共有ブランチを作らない。P10-D1 (b) を選ぶ場合も「自分の report 1ファイル・自分の source branch・`main` 不可・force push 不可」に限定 |
| 外部入力 | Handoff ブロックは会話で渡る。Planner は Handoff の記載を信用せず、すべて git から再計算して照合する |

## Branch / Commit Strategy

- **Source**: Analyzer セッションのブランチ（F-15 の `claude/<topic>-<suffix>`）。commit は report 1ファイルだけ。`main` へは push しない
- **Destination**: Planner は destination branch に何も書き込まない（Task file の作成は現行どおり Planner の working tree）。
  Analyzer report が destination に物理的に入るのは Implementer の最初の実装 commit（既存 §7.3 手順2）
- **Branch mismatch 検知**:
  - H-1 で Source SHA が Source Branch から到達可能であること
  - Implementer 段で、Task file の `Analysis:` に書かれた Source Branch / SHA / Blob と、自分が復元したファイルの blob が一致すること
  - Reviewer 段で、Implementation SHA 時点のファイル blob が Task file の Blob と一致すること
- **C6'（Branch chaining）** は人間の任意の運用として許容できる。この場合、Planner ブランチが Source SHA の子孫になり H-1 は `merge-base --is-ancestor <Source SHA> HEAD` でも満たせる
- **Planner → Implementer の Task file** も同型の問題を持つ（Open Questions Q-2）。本分析では Analyzer → Planner に限定し、同じ Handoff 形式を後で拡張できる形にとどめる

## Planner Start Conditions

Planner は次をすべて満たすまで Task file を作らない（案。満たせなければ「BLOCKED（理由: Analysis Handoff 不備）」と満たせない H-n を人間へ報告して止まる。§5.1 の BLOCKED と同じ扱い）。

| # | 確認 | 例 |
| --- | --- | --- |
| H-1 | Source Branch が remote に存在し、Source SHA がそこから到達可能 | `git fetch origin <branch>` / `git merge-base --is-ancestor <sha> origin/<branch>` |
| H-2 | Source SHA 時点に Path が存在する | `git cat-file -e <sha>:<path>` |
| H-3 | Source commit の変更が Path だけ（Analyzer READ ONLY の証跡） | `git diff --name-only <sha>^ <sha>` |
| H-4 | Path と report 見出しの Task ID が Handoff の Task ID と一致 | ファイル名・`# <ID> Analysis` |
| H-5 | Kind が `analysis` で、Path が `-analysis.md` 命名に一致 | `.ai/reports/README.md` |
| H-6 | Blob SHA が一致 | `git rev-parse <sha>:<path>` |
| H-7 | 同じ `(Task ID, Kind)` の Handoff を既に記録済みの場合、Blob が同じなら no-op、違うなら新版として扱う（承認後なら BLOCKED） | Task file の `Analysis:` |
| H-8 | Planner は Source SHA の内容だけを読む（ブランチ先端・working tree の同名ファイルを読まない） | `git show <sha>:<path>` |

## Reviewer Verification

既存 V-4（`.ai/AGENTS.md:157`）の拡張案（新しい V 番号を増やさず、V-4 の確認内容を追加する想定）:

- V-4a: Task file の `Analysis:` に Source Branch / Source SHA / Blob がある場合、Implementation SHA 時点の Path の blob がそれと一致する
- V-4b: Source SHA が Source Branch から到達可能（出所の追跡）
- `Analysis:` が旧形式（パスのみ）の Task は従来どおり「存在する」確認だけ（遡及しない）

Review report の Review Target 表に `Analysis Source`（branch @ SHA、blob）を1行追加する案。
**§7.3 の DONE 条件3項目は変更しない**（V-4 は Handoff 検証なので、不一致は BLOCKED（理由: Review Handoff 不備）となり、PASS / CHANGES_REQUIRED の判定・DONE 条件に影響しない）。

## Migration Impact

変更候補（P-10 Planner が計画し、人間が承認する範囲。ここでは変更しない）:

| ファイル | 想定される変更 |
| --- | --- |
| `.ai/AGENTS.md` §4 | Analyzer → Planner の「残す」を Analysis Handoff で定義（1〜2行） |
| `.ai/AGENTS.md` §5（新 §5.2 等） | Analysis Handoff の項目と H-1〜H-8。定義は1か所だけ（P-9 AC-11 と同じ方針） |
| `.ai/AGENTS.md` §6 L199 | P10-D1 の結果に応じて文言を調整（(a) なら「人間が source branch へ push する」と手順を明記、(b) なら Analyzer の限定 Persistence を追加） |
| `.ai/AGENTS.md` §7.3 手順2 / §5.1 V-4 | Source SHA から復元し blob を確認／V-4 に blob・出所確認 |
| `.ai/agents/analyzer.md` | Output に Analysis Handoff、Procedure 末尾に出力手順 |
| `.ai/agents/planner.md` | Input を「Analysis Handoff」に、手順0に H-1〜H-8 |
| `.ai/agents/implementer.md` 手順4 | 復元元と blob 確認 |
| `.ai/agents/reviewer.md` | Review Order 0 と Review Target の1行 |
| `.ai/tasks/README.md` | `Analysis:` 行の形式 |

影響しないもの（FACT: 以下は本提案で変更の必要が無い）: §7 の状態列・状態表、§7.3 の DONE 条件3項目、§14、Reviewer の commit 範囲、`src/`・`tests/`・`docs/`・`basefile.html`。

既存 Task: 遡及しない。P-9 と同じく「P-10 の変更後に Planner が着手する Task から適用」。旧形式の `Analysis:` 行（CHAPTER-STRUCTURE / MAGE-001 / P-9）は書き換えない。
P-9.md L7 は新形式にほぼ一致するが、blob が無いため旧形式として扱う。

## ENEMY-ATTACK-VIS-001 Example

前提（FACT）: 2026-09-24 時点で `ENEMY-ATTACK-VIS-001-analysis.md` は remote のどこにも無い（F-14）。Analyzer のブランチ名は本セッションからは確認できない（未確認）。

C6 を適用した場合の手順（本 Task では実行しない）:

1. **Persistence**（P10-D1 の主体）: Analyzer セッションのブランチ `<analyzer-branch>` に、`.ai/reports/ENEMY-ATTACK-VIS-001-analysis.md` **1ファイルだけ** の commit を作り push する。
   Analyzer コンテナが既に回収されていれば report は失われているため（I-3）、Analyzer を再実行する（人間の判断）
2. **Handoff 出力**（Analyzer）:
   ```text
   Analysis Handoff
   - Task ID: ENEMY-ATTACK-VIS-001
   - Kind: analysis
   - Source Branch: <analyzer-branch>
   - Source SHA: <40桁>
   - Path: .ai/reports/ENEMY-ATTACK-VIS-001-analysis.md
   - Blob SHA: <git rev-parse <Source SHA>:.ai/reports/ENEMY-ATTACK-VIS-001-analysis.md>
   ```
3. **Planner**（別セッション・ブランチ B）: `git fetch origin <analyzer-branch>` → H-1〜H-8 → `git show <Source SHA>:.ai/reports/ENEMY-ATTACK-VIS-001-analysis.md` で読む。
   ブランチ B の working tree へファイルをコピーしない
4. Planner が `.ai/tasks/ENEMY-ATTACK-VIS-001.md` を作り、
   `Analysis: .ai/reports/ENEMY-ATTACK-VIS-001-analysis.md（branch \`<analyzer-branch>\` @ \`<Source SHA>\`、blob \`<Blob SHA>\`）` と記録 → `WAITING_APPROVAL`
5. Human Approval（内容の承認。Handoff とは別）
6. Implementer: 作業ブランチの remote に report が無ければ `git show <Source SHA>:<Path>` から復元し、`git hash-object` が Blob と一致することを確かめて最初の実装 commit に含める
7. Reviewer: V-4 で `git rev-parse <Implementation SHA>:<Path>` == Blob、Source SHA の到達性を確認

失敗時の振る舞い（例）:

| 状況 | 検知 | 結果 |
| --- | --- | --- |
| report が未 push | H-1 / H-2 | Planner BLOCKED（理由: Analysis Handoff 不備）→ 人間へ |
| `MAGE-001-analysis.md` を誤って指定 | H-4 | 同上 |
| Analyzer commit に `src/` の変更が混入 | H-3 | 同上（READ ONLY 違反の疑いを人間へ） |
| Handoff 後に Analyzer が report を追記・再 push | Blob 不一致／H-7 | 承認前: Planner が新版として再読込み。承認後: BLOCKED、Human Approval の取り直し |
| Implementer が別ブランチの同名ファイルを持ち込んだ | Implementer の blob 確認 / Reviewer V-4a | commit しない／Reviewer BLOCKED |

## Risks

- **P-9 原則との緊張**: P10-D1 (b) は §6 L199 の明示的な否定を覆す。P-9 レビュー済みの設計判断を変える位置づけになる
- **人手の残存**: P10-D1 (a) を選ぶと、Analyzer ごとに人間の push 操作が1回残る（「自動化」の範囲は検証と参照までになる）
- **実行環境との不一致**: セッション既定の指示（作業ブランチへの commit / push）と Analyzer の READ ONLY 指示が衝突しうる（本セッションでもユーザー指示で commit / push 禁止を優先した）。環境側の stop hook 等が未 commit 変更の push を促す例もある（T-1 Retrospective F-13）。Protocol だけでは制御できない
- **コンテナ回収による喪失**: push 前に Analyzer セッションが回収されると report は失われる（I-3）。Handoff の定義だけでは防げない
- **Protocol の肥大**: §5.1 と §5.2 の2つの Handoff 定義が並ぶ。共通部分（Branch / SHA / BLOCKED 規則）を共有しないと重複が生じる（AGENTS.md 冒頭の「同じルールを書き写さない」）
- **本レポート自身も同じ問題を持つ**: 本 report は本セッションの working tree にしか無い（commit / push 禁止のため）。P-10 Planner を別セッションで動かすには、人間による永続化が必要

## Open Questions

- **Q-1** ENEMY-ATTACK-VIS-001 の Analyzer セッションのブランチ名と、report がまだ存在するか（本セッションから確認不能）
- **Q-2** Planner → Human Approval → Implementer の Task file も同型の問題を持つ（Implementer が別セッションの場合、Task file が remote に無い）。P-10 の範囲に含めるか、別 Task にするか
- **Q-3** Kind を `analysis` 以外（`debug`、Work Item 専用 analysis）へ最初から一般化するか
- **Q-4** 1つの Planner が複数 Analysis（Task 全体 + Work Item）を受け取る場合の `Analysis:` 行の複数記録形式
- **Q-5** Analyzer が report を更新する運用（追記・再分析）を許すか。許す場合、新版の Handoff を誰が Planner へ通知するか
- **Q-6** 実行環境（セッション作成時の起点 SHA 指定、stop hook）側の設定を P-10 の対象にするか（P-9 は対象外とした）

## Human Approval Required

本分析は Analyzer の成果物であり、以下の判断を行っていない。**P-10 で Human Approval が必要な設計判断:**

| ID | 決定事項 | 選択肢と影響 |
| --- | --- | --- |
| **P10-D1** | Analyzer report の source branch への push 主体 | **(a)** 人間が push（§6 L199 のまま。Analyzer は完全 READ ONLY。毎回人手1回）／ **(b)** Analyzer に「自分の report 1ファイル・自分のセッションブランチ・`main` と force push 不可」の限定 Persistence を、Task ごとに人間が明示許可（Reviewer と同型。§6 L199 の変更）／ **(c)** 書き込み権限付き bot / Action（C1。新しい仕組みと権限の追加） |
| **P10-D2** | 受け渡し方式 | C6（Pin-by-SHA、Planner はコピーしない）／ C6'（Branch chaining を標準にする）／ C3（人間の push のみで検証定義を足さない）／ その他 |
| **P10-D3** | Planner の開始条件に H-1〜H-8 を必須化し、満たせない場合を「BLOCKED（理由: Analysis Handoff 不備）」とするか | 必須化（R-3 を満たす）／ 推奨にとどめる |
| **P10-D4** | Blob SHA による同一性検証を Implementer（§7.3 手順2）と Reviewer（V-4）に追加するか | 追加（R-8 / R-10）／ Planner 段だけ |
| **P10-D5** | 承認後に Analyzer report の新版が出た場合の扱い | Human Approval の取り直し（§6 既存規則の適用）／ 別 Task |
| **P10-D6** | 範囲: Planner → Implementer の Task file 受け渡し（Q-2）を P-10 に含めるか | 含める／ 別 Task（P-11 等） |
| **P10-D7** | 適用範囲 | P-10 変更後に Planner が着手する Task から（遡及なし。P-9 と同じ）／ 実行中の ENEMY-ATTACK-VIS-001 にも適用 |
| **P10-D8** | P-10 の Protocol 変更を載せるブランチと、本 report・P-10 Task file の永続化方法（本 report は未 commit） | 人間が指定 |

いずれも AI は決定しない。P10-D1 は他の判断の前提になるため最初に決める必要がある。

## Recommended Next Step

1. 人間: 本 report を永続化する（P10-D8）。P-10 Planner を別セッションで動かすならその前に必要
2. 人間: P10-D1 と P10-D6 を決める
3. Planner: `.ai/tasks/P-10.md` として C6 を計画（Migration Impact の各ファイル・節、AC は R-1〜R-11 を文書確認で判定、ENEMY-ATTACK-VIS-001 への机上適用）

Analyzer はここで停止する。
