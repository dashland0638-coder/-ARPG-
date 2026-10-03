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

## Round 2/3

### Review Target
| 項目 | 値 |
| --- | --- |
| Task ID | UI-002-D / WI-D4 |
| Branch | `claude/agent-autonomous-execution-ewtk87` |
| Reviewed SHA | `376643cb92d12c2b810aefa2960dedb628325b95` |
| Diff range | `dbfbd1defb617bc20ca6027560118de46eb36162..376643cb92d12c2b810aefa2960dedb628325b95` |
| Handoff Verification | V-1〜V-6 OK（Round 1 Fix・Re-test を Task file で確認） |

### Result
PASS

### Independence
同一セッションで兼務（Round 1 の指摘を前提にせず Diff range 全体を再確認し、名前の長さとパネル寸法を実測。Human による差分確認を推奨）

### Checklist
| # | 項目 | 結果 | 根拠 |
| --- | --- | --- | --- |
| 1 | Specification compliance | PASS | AC-D4-1〜6（`character-zone.spec.js` 6 件、`hud-zones-layout`）。HD-D02 / D09 / D25 / D28 / D29 / D30 / D34 を満たす。実測: 844×390 のパネル 348×66（空の階層表示の列の間隔 8px を含む）、最長の名前でも 1 行・下端 74px、HP バー 78px |
| 2 | Scope compliance | PASS | `main.css`（844×390 の media 条件の中のみ）・`index.html`（クラス追加のみ）・テスト |
| 3 | Regression | PASS | 1280×800 の実寸 254×130・バー 168px は不変、`ui-foundation` PASS。名前の完全一致（`chapter1-progression`）PASS |
| 4 | Build | PASS | Test Report / Round 1 Fix |
| 5 | Unit tests | PASS | 1581 PASS / 0 FAIL / 1 SKIP（既存） |
| 6 | E2E tests | PASS（Targeted） | 初回 52 / 52、Round 1 後 42 / 42 + `character-zone` 6 / 6、FLAKY なし |
| 7 | Save/Load integrity | PASS | セーブ・ロジックの変更なし |
| 8 | Existing behavior | PASS | JS・id・文言・兄弟関係（スタミナの見出しとトラック）は不変。スタミナの必要時表示（D1）は `combat-hud-display-conditions` で PASS |
| 9 | Code duplication | PASS | — |
| 10 | Unnecessary architecture changes | PASS | 新しい token・body 属性なし |

### Risks
- 844×390 のボス戦ではボスバー（x 162–682, y 14–約 50）と Character Zone（x 16–364）が重なる。WI-D4 前（x 16–270）から重なりがあり、ボスバーの位置は WI-D6 の範囲（A-4）
- バーの長さは 844×390 で 168px → 78px（位置と並びのための変更。バーの高さ・色は不変。最終的な見せ方は V / C2）
- iPhone 実機・safe-area の実機値は未確認（HD-D35）

### Required Changes
None
