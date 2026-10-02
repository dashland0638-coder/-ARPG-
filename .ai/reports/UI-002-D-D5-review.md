# UI-002-D WI-D5 Review

## Round 1/3

### Review Target
| 項目 | 値 |
| --- | --- |
| Task ID | UI-002-D / WI-D5 |
| Branch | `claude/agent-autonomous-execution-ewtk87` |
| Reviewed SHA | `91bd43fedf99fb637039de9fa8459d4963dfbbb9` |
| Diff range | `51d2856b95753d188f81b1eb71a1bbe17becd716..91bd43fedf99fb637039de9fa8459d4963dfbbb9` |
| Handoff Verification | V-1〜V-6 OK（V-2a: 計画版からの Task file の変更は WI-D5 の Status・Status History・Implementation Result のみ / V-4a: blob `11debdd…` 一致 / V-4b: Source Branch から到達可能） |
| Analysis Source | `.ai/reports/UI-002-D-D5-analysis.md`（@ `d839a2b`、blob `11debddff792b13a58220a9b5ddd0c28e27948d9`） |
| Plan Source | `.ai/tasks/UI-002-D.md`（@ `51d2856`、blob `04fcf87fd00159708d6fc47d2e6abb08a099cf61`） |

### Result
CHANGES_REQUIRED

### Independence
同一セッションで兼務（`spawnLog` へ移した 74 か所の文言と呼び出しの前後を、計画の表の (a)〜(i) と 1 件ずつ突き合わせた。Human による差分確認を推奨）

### Checklist
| # | 項目 | 結果 | 根拠 |
| --- | --- | --- | --- |
| 1 | Specification compliance | FAIL | 下の #1（表の (a) に当たる危険の予兆が 1 件ログへ移っている） |
| 2 | Scope compliance | PASS | 置き換えのみ。文言・引数・ロジックの差分なし |
| 3 | Regression | PASS | 通知を読む spec はすべて PASS（Test Report）。FLAKY 1 件は戦闘タイミング |
| 4〜6 | Build / Unit / E2E | PASS | Test Report |
| 7 | Save/Load integrity | PASS | `save-load.spec.js` PASS |
| 8 | Existing behavior | PASS | ダメージ数値・拾得ポップ・位置・時間は不変 |
| 9 | Code duplication | PASS | 表示先は 2 関数、表は Task file の 1 か所 |
| 10 | Unnecessary architecture changes | PASS | — |

### Required Changes
| # | ファイル / 箇所 | 問題（根拠） | 期待する状態 | 確認方法 |
| --- | --- | --- | --- | --- |
| 1 | `src/legacy/parts/07-ai-combat.js` `updateGauntlet()` の「🌀 五体すべてを退けた。足場が不気味に軋んでいる……」 | 連戦の終わりの記録であると同時に、この後の足場の崩落（危険）の予兆。計画の表 (a)「戦闘・危険のフィードバック（敵の予兆・罠）」に当たり、中央トーストが正しい。ログへ移したことで、崩落の直前に危険を知らせる表示が左下の小さい文字になった | `spawnToast` に戻す（中央） | 差分の確認 |
| 2 | `tests/unit/` | AC-D5-1（重複しない）の構造上の保証が E2E 2 件と FACT (code) だけ。将来 `spawnToast` に `pushMsgLog` を戻したり、別の関数から `pushMsgLog` を呼んだりすると重複が戻るが、unit では検出できない | `spawnToast` が `pushMsgLog` を呼ばないこと、`pushMsgLog` の呼び出しが `spawnLog` だけであることを unit で検証する | unit 追加 |
