# AI Agent Protocol T-1 Retrospective

## Status

DONE（振り返りと Protocol 変更を実施。ゲームコード・テスト・docs の変更なし）

## Scope

- 対象: CHAPTER-STRUCTURE / T-1（テストモードの Skill 1 既定値）の一周（Analyzer → Planner → Human Approval → Implementer → build / unit / E2E → Reviewer → DONE）
- 材料: `.ai/tasks/CHAPTER-STRUCTURE.md` / `CHAPTER-STRUCTURE-T1.md`、`.ai/reports/CHAPTER-STRUCTURE-T1-analysis.md` / `-review.md`、`.ai/AGENTS.md` と `agents/*.md`
- 対象外: T-1 の再実装、T-2〜T-4、MAGE-001、ゲーム仕様

## T-1 Process Result

| 工程 | 成果物 | 結果 |
| --- | --- | --- |
| Analyzer | `CHAPTER-STRUCTURE-T1-analysis.md` | 検索記録 14 行、FACT 14 / INFERENCE 6 / DECISION 5 / UNKNOWN 4 |
| Protocol 修正 | `AGENTS.md` §6 / §7.1 / §7.2 | Work Item 単位の Status・承認を追加（Analyzer で見つかった D-5 を受けて） |
| Planner | `CHAPTER-STRUCTURE-T1.md` | D-3 をコード調査で解決。人間の判断は D-1 / D-2 / D-4 の3つに縮小 |
| Human Approval | 親 Task の T-1 Approval 欄 | D-1 A / D-2 A / D-3 Planner 案 / D-4 A / D-5 T-1 のみ |
| Implementer | `14-hud-boot.js` 1行、`scenario-test-mode.spec.js` 1行 | Files To Change と一致 |
| Test | build PASS、unit 1490 PASS、E2E 8ファイル 43 passed / 1 flaky | 全体 `npm test` は未実行 |
| Reviewer | `CHAPTER-STRUCTURE-T1-review.md` | PASS。同一セッションで兼務 |

## FACT

| # | FACT | 根拠 |
| --- | --- | --- |
| F-1 | Analyzer の検索で既存の `defaultSkill1For` が見つかり、実装は既存関数の再利用1行で済んだ | T1 analysis Search Record / 差分 |
| F-2 | Human Approval 前に `src/` `tests/` の変更は行われなかった | Status History（APPROVED より前にコード差分を含むコミットが無い: `4841b7b` / `1c045d5` / `596032b` は `.ai/` のみ） |
| F-3 | 承認前の Protocol は Task に Status を1つしか持てず、Analyzer は T-1 の承認状態を Task 内の独自チェックボックスで表した | T1 analysis D-5、CHAPTER-STRUCTURE Status History 1行目 |
| F-4 | Planner は D-3（上位職）をコード（`12-progression-ui.js:1819-1821` / `:1954-1970`）から解決した | T1 plan Decisions Required |
| F-5 | Work Item 計画ファイルの命名規則は Protocol に無く、Planner が報告で指摘した | Planner フェーズの最終報告 |
| F-6 | 同一 AI・同一セッションが Implementation と Review を実行した | T1 review 冒頭の注記 |
| F-7 | E2E で `job-traits.spec.js:162` が初回失敗・自動リトライで通過した。Review ではこれを Regression「PASS（flaky 1件は無関係と判断）」と記録した | T1 review Test Result |
| F-8 | flaky テストについて変更前コードでの比較は行っていない | T1 review Risks |
| F-9 | この実行環境では Playwright 1.62.1 が要求するブラウザ（rev 1234）が無く、全 E2E が起動前に失敗した。スクラッチ領域にシンボリックリンクを置いて実行した（リポジトリは無変更） | T1 review Environment Note |
| F-10 | 全体 E2E は実行せず、Plan の Test Plan から選んだ8ファイルを実行した。Plan の実行コマンドには `npm test` が「時間が許す範囲で」と書かれていた | T1 plan Test Plan / T1 review |
| F-11 | AC-2（トレーニング空間・シナリオ起動の両方で 👣）のうち、トレーニング空間はコード経路の確認のみで E2E 未検査 | T1 review Checklist #1 |
| F-12 | 実装結果（変更ファイル・テスト結果）を書く場所が Protocol に無く、Status History と Review に分けて記録した | CHAPTER-STRUCTURE Status History / T1 review |
| F-13 | テスト実行中に stop hook が未コミット変更の push を求めたが、検証完了までコミットを保留した | セッション記録 |
| F-14 | `.ai/tasks/MAGE-001.md` の現状記述（幻影が無い）は古いまま | T1 analysis F-14 |

## INFERENCE

- **I-1**（F-6）同一セッションの兼務では、実装時の判断（「無関係な flaky」など）をレビューでそのまま追認しやすく、自己検証バイアスが入る可能性がある。今回それで問題が起きたことを示す事実は無い
- **I-2**（F-7）「リトライで通過」を PASS に含めた記録では、後から読んだときに不安定なテストの存在が埋もれる
- **I-3**（F-9）環境の回避策をリポジトリ側の問題と混同すると、不要なリポジトリ変更（設定・依存の書き換え）につながりうる
- **I-4**（F-10）Test Plan に「時間が許す範囲で」とあると、全体回帰を実行したかどうかが工程上あいまいになる
- **I-5**（F-11）「同じ経路を通るので効くはず」と「テストで確かめた」が同じ PASS で書かれると、未検証部分が見えなくなる
- **I-6**（F-1, F-4）Existing System First と Planner の追加調査により、人間の判断事項と変更量が小さくなった

## DECISION

本 Retrospective で Protocol に反映した判断（人間は差分で承認・却下できる）と、人間に残す判断:

| # | 問い | 扱い |
| --- | --- | --- |
| DC-1 | Reviewer を別セッション・別 Agent で実行することを **必須** にするか | **人間の判断に残す**。今回は必須にせず、「Reviewer は Task / Plan / diff / Test Report だけを入力にする」「独立性を明記し、兼務なら人間の差分確認を推奨事項に残す」までを採用 |
| DC-2 | 無関係な FLAKY を見つけたとき、別 Task を起票するか | 人間の判断に残す（今回は記録のみ） |
| DC-3 | 全体回帰（Full Regression）を DONE の必須条件にするか | 人間の判断に残す。今回は Targeted を許容し、範囲と未実行分の記録を必須化 |
| DC-4 | E2E 実行環境（ブラウザのリビジョン）をセッション環境側で直すか | 人間の判断（環境設定の問題であり、`.ai/` の範囲外） |

## What Worked

1. **Existing System First**: 既存の `defaultSkill1For` が検索で見つかり、新規コード無しで直せた（F-1）
2. **Human Approval Gate**: 承認前にゲームコードは変わらなかった（F-2）
3. **FACT / INFERENCE / DECISION の分離**: Planner がコードで解決できる判断（D-3）と人間の判断（D-1/2/4）を分けられた（F-4）
4. **Work Item 方式**: T-1 だけを承認・実装し、T-2〜T-4 を DRAFT・未承認のまま保てた
5. **Scope Control**: 差分は計画どおり2行。範囲外（MAGE-001 の古い記述、`beginGame()` の書き方）は OUT OF SCOPE として残した
6. **Token Efficiency**: 各フェーズとも検索 → 部分読み取りで進め、全ファイルの通読をしなかった
7. **検証前に push しない**: テスト完了までコミットを保留した（F-13）

## Problems Found

| # | 問題 | 根拠 | 実害 |
| --- | --- | --- | --- |
| P-1 | Work Item 計画の命名規則が無い | F-5 | 命名を都度判断した |
| P-2 | FLAKY を区別して記録する枠が無く、PASS に含めた | F-7 | 不安定テストが結果に埋もれる（I-2） |
| P-3 | テスト範囲（Targeted / Full）と未実行分の記録が任意 | F-10 | 全体回帰の有無があいまい（I-4） |
| P-4 | コード確認と実テスト確認の区別が無い | F-11 | 未検証部分が PASS に紛れる（I-5） |
| P-5 | 実行環境の問題の扱いが無い | F-9 | その場の判断で回避した |
| P-6 | 実装結果の記録場所が無い（Implementer の出力が未定義） | F-12 | 記録が Status History と Review に分散 |
| P-7 | Reviewer の独立性の要件が無い | F-6 | 実害は確認されていない（I-1） |
| P-8 | 承認前の Protocol では1 Task に複数 Work Item の承認を表せなかった | F-3 | **修正済み**（Phase 4 で §7.1 / §7.2 を追加） |

## MUST FIX

実運用で実際に問題になった／次の Work Item ですぐ同じ判断が要るもの。

- **P-1** Work Item 計画の命名規則 → AGENTS.md §7.2 に追加（実施）
- **P-2** テスト結果の区分（PASS / FAIL / FLAKY / NOT_RUN）と FLAKY を PASS に数えないルール → AGENTS.md §14（実施）
- **P-6** 実装結果の記録場所 → `.ai/agents/implementer.md` の Implementation Result（実施）

## SHOULD FIX

- **P-3** Test Scope（Targeted / Full Regression）と未実行分の記録 → AGENTS.md §14、planner.md の Test Plan に1語追加（実施）
- **P-4** VERIFIED / FACT (code) の区別 → AGENTS.md §8（実施）
- **P-5** 実行環境の問題の区別。新しい Status は作らず、回避はリポジトリ外に限定、回避不能なら既存の `BLOCKED`（理由: 実行環境）→ AGENTS.md §14（実施）
- **P-7** Reviewer は Task / Plan / diff / Test Report だけを入力とし、独立性を明記 → AGENTS.md §5、reviewer.md（実施。別セッション必須化は DC-1 として人間に残す）

## OPTIONAL

- FLAKY の一覧（テスト名・初出日・関係 Task）を1ファイルで管理する（DC-2 と合わせて判断）
- Analyzer が T-1 の Implementation Gate を `WAITING_APPROVAL` と記載した点（Protocol 上は Planner が設定する）の整理。今回は人間の指示どおりで実害なし
- stop hook（未コミット変更の push 要求）と「検証前に push しない」の優先順位の明文化
- `.ai/tasks/MAGE-001.md` の現状記述の更新（別 Task）

## NO CHANGE

- **Task / Work Item の Status 一覧**: `FLAKY` / `ENVIRONMENT_BLOCKED` などの Status は追加しない。テスト単位の結果区分と既存の `FAILED` / `BLOCKED` で表せる
- **Human Approval の記録方法**: 人間の明示的な GO を AI が根拠つきで Approval 欄へ転記する運用で問題は起きなかった
- **Debugger 3-Cycle Rule**: 今回は Debugger が起動していないため評価材料が無い
- **Existing System First / Token Efficiency / Scope Control**: 機能した
- **Agent の自動化・追加 Agent**: 作らない

## Proposed Protocol Changes

実施した変更（すべて `.ai/` 配下）:

| ファイル | 変更 | 対応 |
| --- | --- | --- |
| `.ai/AGENTS.md` §5 | Implementer ファイルへの参照。Reviewer の独立性（入力の限定・独立性の明記・兼務時は人間の差分確認を推奨） | P-6 / P-7 |
| `.ai/AGENTS.md` §7.2 | Work Item 計画 `<ID>-<ITEM>.md` の命名、親 Task との関係（独立 Task ではない・Status の正本は親） | P-1 |
| `.ai/AGENTS.md` §8 | AC の確認方法 VERIFIED / FACT (code) | P-4 |
| `.ai/AGENTS.md` §14 | Test Scope（Targeted / Full Regression）、結果区分（PASS / FAIL / FLAKY / NOT_RUN）、実行環境の問題の扱い | P-2 / P-3 / P-5 |
| `.ai/AGENTS.md` §16 | File Map に implementer / retrospective を追記 | － |
| `.ai/agents/implementer.md`（新規） | 責務・入出力・手順・Implementation Result テンプレート（Test Report を含む） | P-6 |
| `.ai/agents/reviewer.md` | 入力から Implementer の判断過程を除く、Independence 欄 | P-7 |
| `.ai/agents/planner.md` | Test Plan に Targeted / Full Regression の区分 | P-3 |
| `.ai/tasks/README.md` | Naming に Work Item 計画の命名（規則は §7.2 を参照） | P-1 |
| `.ai/reports/README.md` | retrospective の命名、Work Item レポートは §7.2 を参照 | － |

既存の T-1 成果物（analysis / plan / review）は履歴として書き換えていない。

## Remaining Risks

- FLAKY の `job-traits.spec.js:162` は未調査のまま（F-8、DC-2）
- 全体 E2E は T-1 では未実行（DC-3）
- トレーニング空間起動の 👣 は E2E 未検証（F-11）
- 実行環境のブラウザ不一致は未解決（DC-4）。次回 E2E でも同じ回避が必要
- Reviewer の兼務は引き続き許容（DC-1）

## Next Step

1. 人間: 本 Retrospective の Protocol 変更を確認し、DC-1〜DC-4 を判断する（必要なら `.ai/decisions/` に記録）
2. 次の Work Item（T-2 など）を新しい Protocol で運用し、Implementation Result / Test Report / Independence が実際に書けるかを確かめる
3. 別 Task 候補: MAGE-001 の再分析（記述が古い）、`job-traits.spec.js:162` の flaky 調査、docs の用語整理（CHAPTER-STRUCTURE Required Changes (1)）
