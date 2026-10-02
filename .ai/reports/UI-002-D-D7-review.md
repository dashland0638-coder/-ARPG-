# UI-002-D WI-D7 Review（UI-002-D 統合監査の修正）

## Round 1/3

### Review Target
| 項目 | 値 |
| --- | --- |
| Task ID | UI-002-D / WI-D7 |
| Branch | `claude/agent-autonomous-execution-ewtk87` |
| Reviewed SHA | `0a3dd44b44158ab343a7af098962f327a71dca17` |
| Diff range | `50fa4ed5317851b502d81b8eddedd2952ce2cf8f..0a3dd44b44158ab343a7af098962f327a71dca17` |
| Handoff Verification | V-1〜V-6 OK（Analysis `3db46c4`・Plan `50fa4ed` の blob 一致、Implementation Result・Test Report・Debugger Cycle 1 を Task file で確認） |

### Result
CHANGES_REQUIRED

### Independence
同一セッションで兼務（Analysis の結論を前提にせず、差分・実測値・E2E の FAIL→PASS を読み直した。Human による差分確認を推奨）

### Checklist
| # | 項目 | 結果 | 根拠 |
| --- | --- | --- | --- |
| 1 | Specification compliance | PASS | HD-D16（操作可能・戦闘を邪魔しない）、HD-D02 / D28 / D34 / D35、WI-D4 Round 1（名前を省略しない）を維持。AC-D7-1〜4 |
| 2 | Scope compliance | PASS | Files To Change ＋ 計画に記録した追加（`execution-break.spec.js`、T-4） |
| 3 | Regression | PASS | E2E 21 spec 92 PASS / 1 FAIL → T-4 修正後 PASS。1280×800 の規則は変更なし |
| 4〜6 | Build / Unit / E2E | PASS | Test Report |
| 7 | Save/Load integrity | PASS | 変更なし |
| 8 | Existing behavior | PASS | 判定・入力の経路（click → `interact()` / `tryExecution()`）・文言・`.show` は不変。押している間の固定は位置だけ |
| 9 | Code duplication | PASS | 避け方は既存の `placeAnchoredPrompt()` の avoid を使う |
| 10 | Unnecessary architecture changes | PASS | CSS 変数 1 つ（`--hud-tl-right`）。viewport の切り替えは従来どおり media query（HD-D04 の body 属性方式ではない） |

### Findings
- **Required #1（コメントの誤り）**: `14-hud-boot.js` のパネル右端の処理と `main.css` の 844×390 のコメントが「長い名前（上位職 ｜ 支援）でパネルが広がる」と書いている。実測（Implementation Result「Analysis の訂正」）では名前は最長の組でもバーの列 3 つ分に収まり、パネルを広げるのは洋館の階層表示（4 列目、「5F 主の間」で右端 x 409）。将来この処理を「名前の省略で不要になる」と誤って外す原因になる

### Risks
- ボスバーの幅: 844×390・safe-area で「3F 大広間(休憩)」の時は約 137px（ボス名の最長 7 文字は 1 行に入る）。ボス戦の部屋（5F 主の間）では約 164px
- CI（GitHub Actions）の恒常的な失敗（R-1）は UI-002-D の範囲外として残る

### Required Changes
1. コメントを実測どおり（パネルを広げるのは洋館の階層表示）に直す
