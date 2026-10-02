# UI-002-D WI-D6 Review

## Round 1/3

### Review Target
| 項目 | 値 |
| --- | --- |
| Task ID | UI-002-D / WI-D6 |
| Branch | `claude/agent-autonomous-execution-ewtk87` |
| Reviewed SHA | `fba1be170e8caa18ad281018d933e6f2aca94fcd` |
| Diff range | `f988c66efbdc1fbd9d4a9851ac9c5c2ca25e0076..fba1be170e8caa18ad281018d933e6f2aca94fcd` |
| Handoff Verification | V-1〜V-6 OK（V-2a: 計画版からの Task file の変更は WI-D6 の Status・Status History・Implementation Result のみ / V-4a: blob `ab90366…` 一致 / V-4b: Source Branch から到達可能） |
| Analysis Source | `.ai/reports/UI-002-D-D6-analysis.md`（@ `c9ed2ed`、blob `ab90366520dea8857abcbee6ec7ef78c29464a69`） |
| Plan Source | `.ai/tasks/UI-002-D.md`（@ `f988c66`、blob `c9a38423a819d1340c9172ce8d8a64f7a26131e5`） |

### Result
CHANGES_REQUIRED

### Independence
同一セッションで兼務（Diff range と WI-D2〜D5 のゾーンの寸法から、3 viewport での各表示の矩形を計算し直して突き合わせた。Human による差分確認を推奨）

### Checklist
| # | 項目 | 結果 | 根拠 |
| --- | --- | --- | --- |
| 1 | Specification compliance | FAIL | 下の #1（AC-D6-3「互いに重ならない」の保証が不完全） |
| 2 | Scope compliance | PASS | Files To Change のみ |
| 3 | Regression | PASS | 19 spec 85 / 85 |
| 4〜6 | Build / Unit / E2E | PASS | Test Report |
| 7 | Save/Load integrity | PASS | 変更なし |
| 8 | Existing behavior | PASS | 判定・入力・`.show`・文言は不変 |
| 9 | Code duplication | PASS | 投影は既存と同じ方法、位置の計算は core の 1 か所 |
| 10 | Unnecessary architecture changes | PASS | — |

### Required Changes
| # | ファイル / 箇所 | 問題（根拠） | 期待する状態 | 確認方法 |
| --- | --- | --- | --- | --- |
| 1 | `src/legacy/parts/14-hud-boot.js` `updateCombatPromptPositions()` | 処刑・インタラクトは中央 60%×60% に収めるが、コンボは中央の領域と一部重なる位置にある（計算: 844×390 でコンボ x 674–738・y 308–326、中央の領域は x ≤ 675.2・y ≤ 312。safe-area 右 47 / 下 21 では x 627–691・y 287–305 で領域の右下に 48×18px 入る）。対象が画面右下にいると、領域の右下に寄せた処刑・インタラクトがコンボに重なりうる。現在の E2E は処刑とコンボの組だけを、たまたまの位置で確かめている | コンボが出ている間は、処刑・インタラクトがコンボの矩形を避ける（avoid に加える） | unit（領域の右下に寄せた処刑がコンボの矩形を避ける）。E2E の既存の確認が通る |
