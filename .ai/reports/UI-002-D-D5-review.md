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

## Round 2/3

### Review Target
| 項目 | 値 |
| --- | --- |
| Task ID | UI-002-D / WI-D5 |
| Branch | `claude/agent-autonomous-execution-ewtk87` |
| Reviewed SHA | `635f847a568b48de3b4167e792ce82511faa010a` |
| Diff range | `51d2856b95753d188f81b1eb71a1bbe17becd716..635f847a568b48de3b4167e792ce82511faa010a` |
| Handoff Verification | V-1〜V-6 OK（Round 1 Fix を Task file で確認） |

### Result
PASS

### Independence
同一セッションで兼務（Round 1 の指摘を前提にせず、`spawnLog` の 73 か所と、中央に残した呼び出しのうちログ向きの語（手に入れた・売却・鑑定・使った・セーブ・開いた）を含むものを表と再照合。Human による差分確認を推奨）

### Checklist
| # | 項目 | 結果 | 根拠 |
| --- | --- | --- | --- |
| 1 | Specification compliance | PASS | HD-D17（重複の廃止・種類ごとに 1 か所・ログを残す）、AC-D5-1〜5。中央に残した「売却できる装備がない」「鑑定できる装備がない」「資金が足りず」は (b) 入力を受け付けなかった理由、「必殺技「…」」は (e)、ボス能力の発動（🪙+ を含む）は (a) で表どおり |
| 2 | Scope compliance | PASS | Files To Change（+ Round 1 で記録した unit）のみ |
| 3 | Regression | PASS | 通知を読む 18 spec（初回）+ 修正後の `air-actions`・`notifications` |
| 4〜6 | Build / Unit / E2E | PASS | Round 1 Fix の Re-test |
| 7 | Save/Load integrity | PASS | `save-load.spec.js` PASS |
| 8 | Existing behavior | PASS | 文言・色・時間・位置は不変 |
| 9 | Code duplication | PASS | — |
| 10 | Unnecessary architecture changes | PASS | 関数 1 つの追加のみ |

### Risks
- 探索・物語の描写（洋館の物音など）は中央から左下ログへ移った。読める時間は 1.7 秒 → 6.5 秒に延びるが、画面中央では目立たなくなる（表 (h) の判断）
- 844×390 で左下ログとスティックの領域が縦に重なる（HDR-11。Out of Scope Found）
- `base-class-identity.spec.js:413` の FLAKY は変更前コードとの比較未実施

### Required Changes
None
