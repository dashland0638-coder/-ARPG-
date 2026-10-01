# UI-002-D WI-D4 Review

## Round 1/3

### Review Target
| 項目 | 値 |
| --- | --- |
| Task ID | UI-002-D / WI-D4 |
| Branch | `claude/agent-autonomous-execution-ewtk87` |
| Reviewed SHA | `1004df65a0599dc1eb2ceedea02e1e331c8e4ce9` |
| Diff range | `dbfbd1defb617bc20ca6027560118de46eb36162..1004df65a0599dc1eb2ceedea02e1e331c8e4ce9` |
| Handoff Verification | V-1〜V-6 OK（V-2a: 計画版からの Task file の変更は WI-D4 の Status・Status History・Implementation Result のみ / V-4a: blob `4bd1040…` 一致 / V-4b: Source Branch から到達可能） |
| Analysis Source | `.ai/reports/UI-002-D-D4-analysis.md`（@ `c8467d3`、blob `4bd10405f6369df3dff9cf37778dab242955ea87`） |
| Plan Source | `.ai/tasks/UI-002-D.md`（@ `dbfbd1d`、blob `80c0b3fb741239763f0d4e949c4c030fc50998d1`） |

### Result
CHANGES_REQUIRED

### Independence
同一セッションで兼務（Diff range・Task・Test Report を入力に、名前の文言の範囲を実測で検証。Human による差分確認を推奨）

### Checklist
| # | 項目 | 結果 | 根拠 |
| --- | --- | --- | --- |
| 1 | Specification compliance | FAIL | 下の #1（AC-D4-3 が名前の長さで崩れる） |
| 2 | Scope compliance | PASS | Files To Change のみ |
| 3 | Regression | PASS | 1280×800 は不変（実寸・`ui-foundation`） |
| 4 | Build | PASS | Test Report |
| 5 | Unit tests | PASS | Test Report |
| 6 | E2E tests | PASS（Targeted） | 52 / 52 |
| 7 | Save/Load integrity | PASS | 変更なし |
| 8 | Existing behavior | PASS | JS・id・文言の変更なし |
| 9 | Code duplication | PASS | — |
| 10 | Unnecessary architecture changes | PASS | 844×390 の media 条件の中だけ |

### Required Changes
| # | ファイル / 箇所 | 問題（根拠） | 期待する状態 | 確認方法 |
| --- | --- | --- | --- | --- |
| 1 | `src/styles/main.css` `@media (max-height: 500px)` の `.hud-bars .hud-name` | 名前は 2 列分（168px）で折り返す。`hudLabel()`（`core/chapter1-rules.js`）は「主人公 ｜ 支援: 支援者」を出し、上位職（例: バーサーカー）では長くなる。実測: 「バーサーカー ｜ 支援: 魔法使い」で名前が 2 行（17→34px）になり、パネル下端 74→87px で中央 60%×60%（y 78〜）に入る。E2E は「剣士」だけで検証していた | 名前は 1 行のまま（折り返さない）で、想定される最長の表示（上位職 ｜ 支援: 上位職）でもパネルが上の帯に収まる。階層表示と同じ行に出ても重ならない | E2E: 長い名前（上位職 ｜ 支援）・階層表示ありで、名前が 1 行・パネル下端 ≤ 78px・名前と階層表示が重ならない |
