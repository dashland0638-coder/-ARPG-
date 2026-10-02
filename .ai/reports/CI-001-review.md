# CI-001 Review（GitHub Actions E2E の安定化）

## Round 1/3

### Review Target
| 項目 | 値 |
| --- | --- |
| Task ID | CI-001 |
| Branch | `claude/agent-autonomous-execution-ewtk87` |
| Reviewed SHA | `831d6f3b53c1a3c291eb6fbc2a137eb428b0d2b0` |
| Diff range | `5368afacd969acf346a2d49ac005cf5d04cbe748..831d6f3b53c1a3c291eb6fbc2a137eb428b0d2b0` |
| Handoff Verification | V-1〜V-6 OK（Analysis `1f66830`・Plan `5368afa` の blob 一致、Implementation Result・Test Report を Task file で確認） |

### Result
CHANGES_REQUIRED

### Independence
同一セッションで兼務（実装の判断を前提にせず、CI のログ・2 CPU の再現・差分を読み直した。Human による差分確認を推奨）

### Checklist（Goal の観点）
| # | 観点 | 結果 | 根拠 |
| --- | --- | --- | --- |
| 1 | CI の失敗の原因が本当に解消されたか | PASS（ローカル） / CI は確認待ち | 2 CPU（CI 相当）で変更前 23 FAIL → 変更後、全 221 件が PASS（最後の 2 件は修正後に個別 6 / 6）。GitHub Actions の結果は push 後に確認する |
| 2 | 根本原因に対応しているか | PASS | 原因 = ゲーム内の時間と実時間の比が機械の速さで変わること。比を自動テストで固定し、比を保てる描画の速さ（5fps 以上）を解像度で確保した。待ち時間を延ばす・retry を足す対応ではない |
| 3 | flaky を隠していないか | PASS | retry の追加なし（`job-traits` の既存の `retries: 2` は不変。今回の 2 CPU の実行では 1 回目で PASS）、`test.skip` なし、既定の test timeout（45 秒）不変。test timeout の変更は `air-actions:140` の 150 → 240 秒だけで、待ちを状態（突進の溜め）への同期に変えたための上限 |
| 4 | 既存テストの検証力を弱めていないか | PASS | assertion・閾値は不変。変わったのは「いつ読むか」（決め打ちの待ちの後の 1 回 → 状態が満たされるまで読み直す / 書き直しをすべて記録する）。WI-D6 の処刑の位置の比較先を「最後のダメージ数値」から「同じフレームの、攻撃した敵の HP バーのどれか」に変えた（前者は別の敵の数値を拾うことがあった）。インタラクトの E2E の対象を鍛冶士から店主に変えたが、WI-D7 前の src で引き続き FAIL することを確認 |
| 5 | ローカルと CI の差が残っていないか | 一部 | 設定（`deviceScaleFactor`・比）はリポジトリにあり両方で同じ。残る差は Chromium の版（ローカルだけ AD-001）と機械の速さ。比を固定したので、速さの差は 5fps 以上なら結果に影響しない |
| 6 | UI-002-D 等への Regression | PASS | 通常のプレイの dt は不変（`navigator.webdriver` が false なら `min(0.05, フレーム間隔)`、unit で固定）。UI-002-D の E2E（`combat-events-layout`・`action-zone`・`character-zone`・`notifications`・`hud-zones-layout`）は 2 CPU の全体実行で PASS |
| 7 | Build / Unit / Protocol | PASS | 1609 / 0 / 1、16 / 16 |

### Findings
- **Required #1（コメントの誤り）**: `14-hud-boot.js` の PERFORMANCE DIAGNOSTIC の注記が「メインループの dt は `Math.min(0.05, clock.getDelta())`」のまま。自動テストでは `simDeltaSeconds(..., 0.25)` になっており、計測の注記として不正確

### Risks
- E2E はゲーム内 1/4 速で動く。実機の速さでのタイミングは E2E では見ていない（従来も機械しだいの 1/3〜1/10 速だった）
- 描画が 5fps を下回る機械では比が 1/4 を下回る（2 CPU のローカルで 7〜8fps）
- `navigator.webdriver` を立てた自動操作（Playwright 等）では、手動の確認でもゲームが 1/4 速になる（通常のブラウザでは起きない）
- GitHub Actions の結果は未確認（push 後に確認）

### Required Changes
1. 注記を `simDeltaSeconds(...)`（通常は `min(0.05, フレーム間隔)`）に直す

## Round 2/3

### Review Target
| 項目 | 値 |
| --- | --- |
| Task ID | CI-001 |
| Reviewed | Round 1 Fix（コメントのみ）と CI-001 の差分全体 |

### Result
PASS（ローカル）。GitHub Actions の結果は Task file の「CI の結果」に記録する

### Checklist
| # | 観点 | 結果 | 根拠 |
| --- | --- | --- | --- |
| 1〜7 | Round 1 と同じ | PASS | Round 1 Fix はコメントのみ。build / unit を再実行 |

### Required Changes
None
