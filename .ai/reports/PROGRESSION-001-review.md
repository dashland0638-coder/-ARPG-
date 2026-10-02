# PROGRESSION-001 Review（Chapter 1 本編で旧セーブの成長系の値を効かせない）

## Round 1/3

### Review Target
| 項目 | 値 |
| --- | --- |
| Task ID | PROGRESSION-001 |
| Branch | `claude/agent-autonomous-execution-ewtk87` |
| Reviewed SHA | `7d410648fbe12f3d7f59ebcbb1cade6ab1db0cc5` |
| Diff range | `041a4d3..7d41064` |
| Handoff Verification | V-1〜V-6 OK（Analysis `d225e9e`・Plan `041a4d3` の blob 一致、Implementation Result を Task file で確認） |

### Result
PASS

### Independence
同一セッションで兼務（実装の判断を前提にせず、参照箇所を grep で数え直し、差分と変更前の src での失敗を確認した。Human による差分確認を推奨）

### Checklist（Goal の観点）
| # | 観点 | 結果 | 根拠 |
| --- | --- | --- | --- |
| 1 | 決定済みの仕様の未実装部分か（新しいデザインを決めていないか） | PASS | UI-002-HD「第一章: 使用を抑制する」・WORK 12.1 §3・AP-8 N-5。数値・UI・仕組みの追加なし。判定は既存の `legacyGrowth()` |
| 2 | 漏れ | PASS | `sphereValue`（22 か所）・`sphereVariantBonus`・`bossAbilityValue`・`triggerBossSkills`・`rankDmg/Area/CD` の参照箇所は入口の gate で全数が止まる。パッシブを直接読む `chargeUp`・`ultUp` も gate。`state.skills.companion` は数値ではないため対象外（Agent Decision P-6、Known Limitation） |
| 3 | テストモード（Chapter 2 の基盤）の回帰 | PASS | `legacyGrowth()` が true の時の式は変更前と同じ。`rankOf`（画面の表示・購入）は不変。E2E 全体（テストモードの spec を含む）PASS |
| 4 | 新規ゲームの回帰 | PASS | 新規の値は `root`（効果 null）・ランク 0・空配列・パッシブ 0 で、gate の前後で同じ値 |
| 5 | セーブを壊さないか | PASS | gate は読み取りだけ。E2E でセーブし直しても値が残ることを確認 |
| 6 | テストの検証力 | PASS | 新規 unit 6 件（変更前の src で 4 件 FAIL）、新規 E2E（変更前の src で最大 HP 161 ≠ 152・攻撃力 29 ≠ 28 の 2 点で FAIL） |
| 7 | Build / Unit / Protocol / E2E | PASS | 1615 / 0 / 1、16 / 16、E2E 全体（2 CPU）222 passed、GitHub Actions（`7d41064`）success |

### Findings
- Optional: `recomputeStats` の `legacy ? sphereValue('ultDmgSphereMul') : 0` は `sphereValue` の gate と重複する。動作は同じで、計画どおり変えない（不要なリファクタリングをしない）
- Optional: ランク・ボススキル・パッシブの効果は E2E では観測していない（本編で見える表示が無い）。unit が構造を固定している

### Required Changes
None
