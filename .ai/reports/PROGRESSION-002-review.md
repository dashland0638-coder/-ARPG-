# PROGRESSION-002 Review（旧セーブの「仲間を雇う」を第一章本編へ持ち越さない）

## Round 1/3

### Review Target
| 項目 | 値 |
| --- | --- |
| Task ID | PROGRESSION-002 |
| Branch | `claude/agent-autonomous-execution-ewtk87` |
| Reviewed SHA | `1a5097040406ee5136dd0f8cb591646afa04a4f9` |
| Diff range | `b5a6d5b..1a50970` |
| Handoff Verification | V-1〜V-6 OK（Analysis `4c0dc37`・Plan `b5a6d5b` の blob 一致） |

### Result
PASS

### Independence
同一セッションで兼務（`companion` の参照を全数 grep し直し、生成・削除・表示の経路を読み直した。Human による差分確認を推奨）

### Checklist（Human 指定の観点）
| # | 観点 | 結果 | 根拠 |
| --- | --- | --- | --- |
| 1 | 第一章仕様との整合性 | PASS | Human Decision「本編では雇用状態を戦闘・同行へ反映しない」。雇った仲間の生成は `syncAlliesToState()` の 1 か所だけで、本編（`legacyGrowth()` が false）では生成しない。生成されなければ戦闘（`updateCompanion`）・ミニマップ・視線の向き先にも出ない |
| 2 | 旧セーブ互換性 | PASS | 雇用状態なしのセーブは従来どおり（E2E）。雇用状態ありのセーブも読み込め、エラーなし |
| 3 | 正式な仲間加入進行への Regression | PASS | 支援 AI（`guestClassKey`）の生成条件は不変（unit で固定）。洋館クリア後のセーブで「魔法使い ｜ 支援: 剣士」と支援 AI の点が出る（E2E）。`chapter1-progression`・`chapter1-*`・`mansion-*`・`tavern-*` を含む E2E 全体 PASS |
| 4 | Chapter 2 以降への影響 | PASS（影響なし） | Chapter 2 は未実装。判定は PROGRESSION-001 と同じ `legacyGrowth()` で、Chapter 2 の扱いはここでは決めていない |
| 5 | Test Mode への影響 | PASS | `finishEnteringGame` が `state.testMode` を決めてから `syncAlliesToState()` を呼ぶ（順序を確認）。テストモードでは `legacyGrowth()` が true で条件は変更前と同じ。購入経路（鑑定所）は不変。テストモードの開始時は `companion: 0`（既存） |
| 6 | セーブデータを壊していないか | PASS | `syncAlliesToState()` は `state.skills` を書き換えない（unit）。続きから入ってセーブし直しても `skills.companion: 1` が残る（E2E） |
| 7 | テストの検証力 | PASS | 新規 unit 1 件（変更前の src で FAIL）。新規 E2E 3 件のうち雇用状態ありの 2 件が変更前の src で FAIL（雇った仲間の点が出る）。雇用状態なしの 1 件は変更前でも PASS（従来どおりの確認） |
| 8 | Build / Unit / Protocol / E2E | PASS | 1616 / 0 / 1、16 / 16、E2E 全体（2 CPU）224 passed / 1 flaky、GitHub Actions（`1a50970`）success |

### Findings
- Info: E2E 全体の `job-traits:162`（テストモードの Predictive Aim、既存の `retries: 2` の spec）が 1 回目 FAIL・retry で PASS（flaky）。テストモードでは `skills.companion` が 0 で、今回の gate の結果は変更前と同じ。同じ commit の GitHub Actions、PROGRESSION-001 の E2E 全体では 1 回目で PASS。今回の変更とは無関係と判断（retry・timeout の変更はしていない）
- Info: テストモードで実際に仲間を雇って同行することは E2E では見ていない（テストモードの開始時の魔宝石が 0 で、購入には敵を倒して集める必要がある）。unit が条件式を固定している

### Required Changes
None
