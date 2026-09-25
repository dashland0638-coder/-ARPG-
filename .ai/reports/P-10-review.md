# P-10 Review

## Review Target
| 項目 | 値 |
| --- | --- |
| Task ID | P-10 |
| Branch | `claude/p10-artifact-handoff-implementation-xydzsl`（remote 先端 = `8ad9fd9441d3d9d92afbf30c7c0bb7f57c4b8861`、`git ls-remote` で確認） |
| Reviewed SHA | `8ad9fd9441d3d9d92afbf30c7c0bb7f57c4b8861`（Files To Change #12 の P-10.md を含む最終 commit。PASS ではないため DONE 条件の Reviewed Implementation SHA としては成立しない） |
| Diff range | `bd94a5f76dd886bc78d10eb0ae3f3752604a84fc..8ad9fd9441d3d9d92afbf30c7c0bb7f57c4b8861`（2 commits: `8ace518`, `8ad9fd9`。9 files、+1198 / -11） |
| Handoff Verification | V-1〜V-6 確認。V-4a / V-4b 確認。V-2a は Plan 部分の不変性は確認、ただし許容範囲外の節追加あり（F-4） |
| Analysis Source | `.ai/reports/P-10-artifact-handoff-analysis.md`（branch `claude/p10-artifact-handoff-analysis-enfr9v` @ `8f1b7872a10f6d2a0d55de84ecdabb9f95733691`、blob `b8034db115203c1947ac2e16789fabbbdac2e454`） |
| Plan Source | `.ai/tasks/P-10.md`（branch `claude/p10-artifact-handoff-planning-rtn8pj` @ `f68c9bae8e46d947a2f54ce435b0f6e99bd82ca2`、blob `b95908225ab9b1da13180cb9cf27814d5984ffcb`）。**`WAITING_APPROVAL` 版**（F-3） |

## Result
**CHANGES_REQUIRED**

Protocol 本文（§5.1 / §5.2 / §6 / §7.3 / agents / README）の変更内容は Plan（P10-D1〜D9）に適合しており、テスト・SHA 検証も独立に再現できた。
しかし P-10 自身の Task file が、現行 Protocol（P-9 由来の §6 / §7 / §7.1 / §7.3 と、P-10 が追加した §5.2 / I-3 / V-2a の両方）の
Status・Approval ゲートに適合していない（F-1〜F-3）。Status 問題は「固定 snapshot + Status History で現在 Status を追跡する」設計として正当化できない（下の「A. Status 問題」）。

## Independence
別セッションの Reviewer（本セッション）。Implementer / Planner / Analyzer のセッションとは別。
Implementation Result の検証結果は信用せず、以下をすべて git / npm から再計算した。

## Handoff / Artifact 独立検証

| # | 確認 | 結果 | 根拠（再計算） |
| --- | --- | --- | --- |
| 1 | Plan Source SHA | OK | `git cat-file -t f68c9ba…` = commit。`origin/claude/p10-artifact-handoff-planning-rtn8pj` の先端と一致（ls-remote）。`git diff --name-only f68c9ba^ f68c9ba` = `.ai/tasks/P-10.md` の1件（H-3）。1行目 `# P-10`（H-4） |
| 2 | Plan Blob SHA | OK | `git rev-parse f68c9ba:.ai/tasks/P-10.md` = `b95908225ab9b1da13180cb9cf27814d5984ffcb` |
| 3 | Analysis Source SHA | OK | `8f1b787…` = commit。`origin/claude/p10-artifact-handoff-analysis-enfr9v` の先端と一致。変更は Path 1件（H-3） |
| 4 | Analysis Blob SHA | OK | `git rev-parse 8f1b787:<Path>` = `8ad9fd9:<Path>` = `8ace518:<Path>` = `b8034db115203c1947ac2e16789fabbbdac2e454`（V-4a / I-1） |
| 5 | Implementation SHA | OK | `8ad9fd9` はブランチ先端。親 `8ace518`、その親 `bd94a5f`（V-1） |
| 6 | Diff range | OK | 空でなく、終点 = Implementation SHA（V-6）。`bd94a5f` は `8ad9fd9` の祖先 |
| 7 | Plan Artifact 不改変 | OK（内容） | `8ad9fd9:.ai/tasks/P-10.md` の先頭 52,684 byte が `f68c9ba` 版と byte 一致（`cmp`）、その部分の `git hash-object` = `b959082…`。`8ace518` 時点は blob 完全一致。変更は末尾追記のみ（544行 → 649行） |
| 8 | Implementation Record / Status History と snapshot の区別 | 一部 NG | 境界コメント（HTML コメント）と見出しで区別はされている。ただし Status の表現が snapshot と矛盾（F-1）、許容範囲外の節（F-4） |
| 9 | P-9 既存仕様との互換性 | 一部 NG | §7 状態表・DONE 条件・`.ai/agents/` 5ファイル・P-9.md（blob `b00ce72…` 不変）は維持。ただし P-10 Task 自身が §6 / §7.1 / §7.3 を満たしていない（F-1 / F-2） |
| 10 | H-1〜H-8 | OK（定義） / NG（適用: Kind plan） | §5.2 の表は Plan WI-3/4 と一致。Analysis Handoff は H-1〜H-8 を満たす（H-5 は P10-D9 例外）。Plan Handoff は H-1〜H-6/H-8 の機械的検査は通るが、pin 対象が §5.2 の「承認済み版」ではない（F-3） |
| 11 | I-1 | OK | analysis の blob 一致（#4） |
| 12 | V-2a | 条件付き | Plan 部分は不変（#7）。追加された `## Implementation Record`・`### Human Approval（実装）`・境界 HTML コメントは V-2a の許容範囲（`Status:` 行・Status History 行追加・Implementation Result 節）外（F-4）。一方、許容されている `Status:` 行の更新は行われていない（F-1） |
| 13 | V-4a | OK | #4 |
| 14 | V-4b | OK | Source Branch は remote に残存し、Source SHA はその先端 |
| 15 | Planner → Implementer Kind=plan | 定義 OK / 運用 NG | §5.2・I-3・V-2a・implementer.md 手順1・Implementation Result 表に反映（AC-14）。運用は F-3 |
| 16 | Analyzer → Planner Kind=analysis | OK | §4 の「残す」定義、§5.2、analyzer.md Template、planner.md 手順0 |
| 17 | 新版 Artifact 時の再承認 | OK | §5.2「新版」表（`APPROVED` 以降は BLOCKED + Human Approval 取り直し、DONE は新 Task）、amend / force push 禁止（P10-D5） |
| 18 | Blob SHA を同一性の正 | OK | §5.2 冒頭「blob SHA（同一性の正本）」、V-4a「同一性の正本」 |
| 19 | Branch 到達性を補助扱い | OK | §5.2 冒頭、V-4b「出所の補助。削除済みなら V-4a だけで判定」（P10-D4 副問 (ii)） |
| 20 | P10-D1〜D9 の実装 | OK | D1: §6 / §5.2 Persistence（Human）。D2: Pin-by-SHA、H-1 の HEAD 到達（C6'）。D3: H-1〜H-8 必須・planner.md 手順0。D4: I-1/I-2、V-4a/V-4b。D5: 新版表。D6: Kind plan・I-3・V-2a。D7: §5.2 適用範囲。D8: `bd94a5f` 起点、analysis を Source SHA から復元。D9: 命名規則不変・一回限り例外・改名なし |

## A. Status 問題（重点事項）

### 事実（`8ad9fd9:.ai/tasks/P-10.md`）

| 箇所 | 内容 |
| --- | --- |
| L5 | `Status: WAITING_APPROVAL` |
| L15-22 | `- [ ] Approved`、Approved by / Scope / `Persistence:` が空欄、`Implementation: BLOCKED until approval` |
| L531-535（`## Status` 節） | `Status: WAITING_APPROVAL`、「実装の承認（`APPROVED`）・Persistence はまだ無い」、`Implementation: BLOCKED until approval` |
| L545-548（Status History 追記） | `WAITING_APPROVAL → APPROVED → IMPLEMENTING → TESTING → REVIEWING` |
| Implementation Record | 実装承認と Persistence の根拠をここに記録（Approval 欄ではない） |

### 判定: Protocol 上正当ではない（CHANGES_REQUIRED）

「f68c9ba は固定 snapshot であり、現在 Status は Status History / Implementation Record から追跡する」という解釈は、Protocol のどこにも根拠が無く、次の規定と矛盾する。

1. **§7.1（AGENTS.md:335）**「Task ファイルの冒頭に `Status:` を1行で書く」。現在の Status を表す場所は冒頭の `Status:` 行である。
2. **§7（AGENTS.md:329）**「Status を変えたら、同じ Task の Status History に1行追記する」。Status History は Status 変更の**記録**であり、Status の正本ではない。
3. **§7.3 手順2（AGENTS.md:375）** Implementer の commit は「Status の `REVIEWING` 更新と Status History 行」を含む。`Status:` 行の更新が必須。
4. **§7.3「push 前の Status」** 正式な Status は remote 上の Status。remote の `Status:` 行は `WAITING_APPROVAL` のため、形式上 `REVIEWING` が成立していない（したがって Reviewer の `REVIEWING → DONE` 遷移の前提も欠ける）。
5. **P-10 自身の設計**: I-3（AGENTS.md:381）と V-2a（AGENTS.md:158）は、Plan pin からの変更として **`Status:` 行の更新を明示的に許容**している。
   つまり P-10 設計でも `Status:` 行は現在 Status を運ぶ行であり、snapshot として凍結される対象ではない。「Plan Artifact を変えない」ことと `Status:` 行の更新は両立するよう設計されている。
6. **Plan Files To Change #12（P-10.md:364）** は P-10.md の変更として「Approval（人間の GO 後）・Status・Status History・Implementation Result」を予定している。
7. **`.ai/tasks/README.md`（末尾）**「承認後は承認単位の Status を `APPROVED` にし、その Approval 欄をチェックし、対応する `Implementation:` 行を `ALLOWED` に変える」。

Implementer の Known Limitations は「Plan Artifact を変更しない人間の指示」を理由に挙げているが、上記 5 のとおり `Status:` 行は P-10 設計上 Plan Artifact の不変部分ではない。
また Approval 欄は Implementer が書く欄ではなく（§6「Implementer は…Approval 欄を変更しない」）、承認済み版として人間が記入・Persistence すべきものである（F-2 / F-3）。
Reviewer は Task file を修正しない（Reviewer 制約）。

## B. Plan Artifact integrity

- `f68c9ba:.ai/tasks/P-10.md`（52,684 byte、544行）は `8ad9fd9:.ai/tasks/P-10.md` の先頭と byte 一致。先頭部分の blob は `b95908225ab9…` と一致。
- 差分は末尾追記のみ: Status History 4行、境界 HTML コメント、`## Implementation Record`（`### Human Approval（実装）`）、`## Implementation Result`。
- 計画本文・Decision Record・Artifact Handoff Metadata・Analyzer Reference・Approval 欄の改変は無い。
- 境界の区別自体は明確だが、F-4 のとおり V-2a の許容カテゴリ外の節がある。

## C. DONE 条件（§7.3）

| 条件 | 結果 |
| --- | --- |
| review report の Result が PASS | **未達**（CHANGES_REQUIRED） |
| review report が remote の Branch に存在 | **未達**（下の「Persistence」参照。push していない） |
| Reviewed SHA = 最新 Implementation SHA | `8ad9fd9` は Handoff Branch の先端で、以後の commit は無い（条件としては満たす） |

→ DONE にしない。

## D. Tests（独立再実行）

`8ad9fd9` を detached worktree に checkout し実行（`npm ci` 後）。

| テスト | 結果 | メモ |
| --- | --- | --- |
| `npm run build` | PASS | exit 0。chunk size 警告のみ（従来どおり） |
| `npm run test:unit`（`node --test`） | PASS | tests 1490 / pass 1490 / fail 0 |
| E2E | NOT_RUN（妥当） | Diff range の変更ファイルは `.ai/` 配下の Markdown 9件のみ（`.ai/` 以外 0件）。`src/` / `tests/` / Playwright 設定 / package 定義に変更なし。§14 の Targeted として妥当 |
| Git desk checks | 再現 | 上の「Handoff / Artifact 独立検証」#1〜#7、#13、#14。H-3（両 Source commit が1ファイル）、`8ace518` 時点の analysis blob 一致、P-9.md blob 不変 |

## Checklist
| # | 項目 | 結果 | 根拠 |
| --- | --- | --- | --- |
| 1 | Specification compliance | NG | Protocol 文書は Plan に適合。P-10 Task file 自身が §6 / §7.1 / §7.3 / §5.2 Kind plan に不適合（F-1〜F-3） |
| 2 | Scope compliance | OK | 変更は Files To Change #1〜#12 の範囲。Out of Scope（src / tests / docs / .github / debugger.md / decisions / 既存 Task）変更なし |
| 3 | Regression | OK | §7 状態表・DONE 条件・agents ファイル数不変。旧形式 `Analysis:` は H-n / V-4a を要求しない |
| 4 | Build | PASS | 独立再実行 |
| 5 | Unit tests | PASS | 1490/1490 独立再実行 |
| 6 | E2E tests | NOT_RUN | Markdown のみの変更で妥当 |
| 7 | Save/Load integrity | N/A | ゲームコード変更なし |
| 8 | Existing behavior | OK | 同上 |
| 9 | Code duplication | OK | H-n の定義は §5.2 の1か所、他は参照のみ |
| 10 | Unnecessary architecture changes | OK | 新 Agent / 新 Status なし |

## Changed Files
`.ai/AGENTS.md`、`.ai/agents/analyzer.md`、`.ai/agents/implementer.md`、`.ai/agents/planner.md`、`.ai/agents/reviewer.md`、`.ai/reports/P-10-artifact-handoff-analysis.md`（追加、blob 一致）、`.ai/reports/README.md`、`.ai/tasks/P-10.md`（追加 + 追記）、`.ai/tasks/README.md`

## Out of Scope Changes
None

## Findings

### F-1（Blocking）Task file の `Status:` が現在 Status を表していない
- 該当: `8ad9fd9:.ai/tasks/P-10.md` L5 / L533（`WAITING_APPROVAL`）、L22 / L535（`Implementation: BLOCKED until approval`）と L545-548（History 上は `REVIEWING`）
- 違反: AGENTS.md §7.1（L335）、§7（Status History は変更記録）、§7.3 手順2（`REVIEWING` 更新を commit）、§7.3「push 前の Status」
- 詳細は「A. Status 問題」

### F-2（Blocking）Human Approval / Persistence が Approval 欄に無い状態で実装・commit・push された
- 該当: P-10.md L15-22（未チェック、Persistence 空欄）。承認と Persistence の根拠は `## Implementation Record` に記載
- 違反: AGENTS.md §6 開始条件（L262「`Status: APPROVED` とチェック済みの Approval 欄」）、§6 Persistence（「Approval 欄の `Persistence` が `許可` で、対象ブランチ名が書かれている場合に限り」「空欄…は許可されていない」）、`implementer.md` 手順1（「Approval 欄がチェック済みで、根拠が書かれている。無ければ着手しない」）
- 注記: Reviewer は Implementer セッションの会話を確認できないため、人間の GO と Persistence 指示の実在は検証していない（Implementer の自己申告）。人間の確認が必要

### F-3（Blocking）Plan Handoff の pin が承認済み版ではない
- 該当: Plan Source `f68c9ba`（`Status: WAITING_APPROVAL`、Approval 未チェック）
- 違反: AGENTS.md §5.2 Persistence「Kind `plan`: 人間が承認を Task file に記入した **承認済み版** を push し…Planner の `WAITING_APPROVAL` 版は pin しない」、I-3「Plan Handoff の承認済み版を起点にし」、Plan WI-8（P-10.md:303）、P10-D8 (a)（「本 Task file は人間が Persistence した版を起点にする（新規則の自己適用）」）
- 補足: §5.2 の適用範囲（P10-D7）上、P-10 自身は本来 §5.2 の強制対象ではないが、Implementer は Plan Handoff（Kind plan）として記録しており V-2a の対象になる。§5.2 を適用しない場合でも P-9 規則（§6 / §7.3 手順2「Human Approval 時点の内容」）で F-2 と同じく不適合

### F-4（Required）V-2a の許容範囲外の節が Task file に追加されている
- 該当: 境界 HTML コメント、`## Implementation Record（Implementer 追記。Plan Artifact ではない）`、`### Human Approval（実装）`
- 違反: V-2a（AGENTS.md:158）/ I-3（AGENTS.md:381）の許容は「`Status:` 行・Status History への行追加・Implementation Result 節だけ」
- 判定: Plan 部分の不変性（V-2a の目的）は byte 一致で確認でき、Review 対象（SHA / 範囲）の特定には支障が無いため、Review Handoff 不備（BLOCKED）ではなく CHANGES_REQUIRED の指摘として扱う。人間が V-2a の字義どおり BLOCKED と扱う判断も可能

## Risks
- F-1〜F-3 を放置すると、P-10 が新設した Kind plan / I-3 / V-2a の最初の実運用例が、自らの規定（承認済み版の pin、`Status:` 行の更新）に反した前例になる
- 「人間が Plan Artifact を変更しないと指示した」ことを理由に Approval 欄外で承認を記録する運用が前例化すると、§6 の Approval ゲート（Approval 欄が承認の正本）が形骸化する
- `Persisted by` は自己申告（Known Limitations のとおり。設計上の既知事項）

## Required Changes

AI は Approval 欄を記入しない（§6）。以下は人間の操作と Implementer の操作を分けて記す。

1. **Human**: `f68c9ba` 版を起点に P-10.md の Approval 欄を記入した承認済み版を作る（`- [x] Approved`、Approved by / date / where、Scope of approval、`Persistence: 許可（branch: claude/p10-artifact-handoff-implementation-xydzsl、根拠）`、`Status: APPROVED`、`Implementation: ALLOWED`、`## Status` 節の同内容）。
   Planning ブランチ（または人間が指定するブランチ）へ **P-10.md 1ファイルだけの新しい commit** として Persistence し（amend / force push しない）、新しい Plan Handoff（Source SHA / Blob SHA / `Persisted by: Human`）を Implementer へ渡す。
   remote 上の正式 Status は `WAITING_APPROVAL` のため、これは §5.2「新版」の `APPROVED` 以降の扱いには当たらない
2. **Implementer**: 新しい Plan Handoff を H-1〜H-8 で検証し、I-3 に従って承認済み版を起点に P-10.md を作り直す。変更は `Status:` 行（`REVIEWING`）・Status History 行追加・Implementation Result 節だけにする（F-1）。
   `## Implementation Record` / `### Human Approval（実装）` / 境界 HTML コメントは除き、必要な記録は Implementation Result 節内（Artifact Handoff 表・Test Report・Known Limitations）に置く（F-4）
3. **Implementer**: Protocol 本文（`8ace518` の #1〜#11）は変更不要。上の P-10.md 修正を新しい commit で push し、新しい Implementation SHA で Review Handoff を出し直す（Diff range は `bd94a5f..<新 SHA>`）
4. 代替案（非推奨）: 「Task file の Plan 部分は Approval 欄を含め完全凍結し、現在 Status は Status History で追跡する」運用を採るなら、§6 / §7.1 / §7.3 / I-3 / V-2a / tasks README の変更が必要で、P-10 の承認範囲外。別 Task と Human Approval が要る

## Persistence（Reviewer commit）
- 本 report は Reviewer のセッション作業ツリー（ブランチ `claude/p10-review-2ui9rk`）に作成した。**commit / push していない**
- §7.3「Reviewer の commit 範囲」: Reviewer の commit は Handoff の Branch（`claude/p10-artifact-handoff-implementation-xydzsl`）へ push するもの。本実行環境の割り当てブランチは異なるため、別ブランチへは push しない。人間が push 先を明示して承認するまで待つ
- Task file の Status 更新（`CHANGES_REQUIRED`）・Status History 追記も未実施（同上。加えて F-1 により現在の `Status:` 行が `WAITING_APPROVAL` のため、`REVIEWING → CHANGES_REQUIRED` の Status 更新の前提自体を人間に確認する必要がある）
