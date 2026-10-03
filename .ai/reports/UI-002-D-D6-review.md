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

## Round 2/3

### Review Target
| 項目 | 値 |
| --- | --- |
| Task ID | UI-002-D / WI-D6 |
| Branch | `claude/agent-autonomous-execution-ewtk87` |
| Reviewed SHA | `50c081aff79bb57f1e47a16fff0166fc46b78377` |
| Diff range | `f988c66efbdc1fbd9d4a9851ac9c5c2ca25e0076..50c081aff79bb57f1e47a16fff0166fc46b78377` |
| Handoff Verification | V-1〜V-6 OK（Round 1 Fix・Re-test を Task file で確認） |

### Result
PASS

### Independence
同一セッションで兼務（Round 1 の指摘を前提にせず、WI-D2〜D5 の各ゾーン・PC 操作ヒント・トースト・ログ・ボスバー・制限時間と、処刑・インタラクト・コンボの矩形を 3 viewport で再計算して突き合わせた。Human による差分確認を推奨）

### Checklist
| # | 項目 | 結果 | 根拠 |
| --- | --- | --- | --- |
| 1 | Specification compliance | PASS | HD-D16（役割ごとの分離・対象との関係・操作可能・戦闘を邪魔しない）、HD-D02 / D28 / D34 / D35、AC-D6-1〜6。WI-D4 / WI-D5 の Known Limitation（ボスバー×Character Zone、ログ×スティック）を解消 |
| 2 | Scope compliance | PASS | Files To Change のみ |
| 3 | Regression | PASS | 19 spec 85 / 85、Round 1 後 4 spec PASS 17・FLAKY 1（`execution-break`、入力・判定は不変、既存 FAIL 扱いの spec） |
| 4〜6 | Build / Unit / E2E | PASS | Test Report / Round 1 Fix |
| 7 | Save/Load integrity | PASS | 変更なし |
| 8 | Existing behavior | PASS | 判定・入力・文言・`.show` 不変。1280×800 のボスバーの位置は不変、制限時間はボスバーの下へ（重なりの解消） |
| 9 | Code duplication | PASS | 投影は既存の方法、配置は core の 1 関数 |
| 10 | Unnecessary architecture changes | PASS | core に純粋関数 1 ファイル |

### Risks
- 処刑・インタラクトは中央 60%×60% に収めるため、同じ領域に出る一時表示（中央トースト、844×390 の制限時間 y 84–112、844×390 のログ）とは重なりうる（いずれも一時表示・`pointer-events:none`、処刑・インタラクトが上に描かれ、タップを受け取る）
- 対象の高さは一定値（敵 2.6 / インタラクト 1.6）。大きいボスでは頭より低い位置に出る
- 正式サイズ外（大きいタッチ画面・小さい PC 画面）では、コンボと従来の Action ボタン / PC 能力表示が重なりうる
- `execution-break.spec.js:99` の FLAKY（入力のタイミング）。変更前コードとの比較は未実施

### Required Changes
None
