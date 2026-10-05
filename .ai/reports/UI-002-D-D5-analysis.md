# UI-002-D-D5 Analysis

## Task
UI-002-D / WI-D5 通知 / feedback（Human Goal 2026-10-02「WI-D5 を完遂」。Agent Protocol 2.0）

## Summary
- FACT: `spawnToast(text, color)`（`src/legacy/parts/11-combat-actions.js`）は中央トースト（`.item-pop`、top 30% から上へ積む、1.7 秒）を出し、同じ文言を必ず `pushMsgLog()` で左下ログ（`#msg-log`、最大 6 行、6.5 秒）にも積む。呼び出しは 14 ファイル・約 190 か所で、**すべての通知が 2 か所に出る**（HD-D17 の対象。D Analyzer O-02 / 実画面 15.2.6 で確認済み）
- FACT: `pushMsgLog` を直接呼ぶのは `spawnToast` だけ。拾得ポップ（`spawnPickupPopup`、拾った位置の上に出る `.item-pop`）とダメージ数値（`spawnDamagePopup`、`.dmg-pop`）は 1 か所にしか出ない（重複なし）
- 既に満たされている（変更不要）: ダメージ数値・拾得ポップ（重複なし）、中央への一時表示の許可（HD-D02）

## Existing System Search
| 探したもの | 検索語 / 範囲 | 結果 |
| --- | --- | --- |
| 通知の出し先 | `spawnToast\|pushMsgLog\|spawnPickupPopup\|spawnDamagePopup` / `src/legacy/parts` | `11-combat-actions.js` に 4 関数。重複は `spawnToast` → `pushMsgLog` だけ |
| 通知の種類の分類 | `channel\|kind` / 通知まわり | なし（全通知が同じ扱い） |
| 通知を読む E2E | `msg-log\|item-pop` / `tests/*.spec.js` | `#msg-log` を読む: air-actions（切り上げ・空中のスキル拒否・エネミーステップ）、Arena の `spawned`（base-class-* / character-motion / combat-test-arena / job-traits）、chapter1-legacy-ui（Skill 3 のトーストが出ない）、action-zone（回復の反応）、ui-proto-gate（不変の確認）。`.item-pop` を読む: chapter1-dusk-basics（閃いた）、character-weapon-visual（必殺技「）、dev-ui-gate（デバッグモード / Visual Freeze）、mansion-scenario（両方） |
| 通知履歴 UI | Decision Record | 「通知履歴」は Undecided（`UI-002-human-decisions.md`）。D5 では作らない |

## Expected Behavior（出典）
- HD-D17: 同じ通知を中央トーストとログの 2 か所へ出す方式を廃止し、情報の種類ごとに 1 つの表示先へ統合する。ログを単純に削除せず、役割と表示先を再設計する。必要な既存 E2E の変更は D の範囲として許可
- WI-D5 Forbidden: 通知の文言、`spawnToast` の呼び出し元のゲームロジック、ダメージ計算、テストの検証内容を弱めること（読み先の変更に限る）
- WI-D5 AC: 同じ通知が 2 か所に出ない / 種類ごとの表示先が表で定義され、そのとおりに表示される / 変更した E2E の検証内容が変更前と同等
- HD-D02: トースト等の一時表示は中央に出てよい
- HD-D28: 見た目（Feedback Zone の visual）は C2 / V。D は表示先・表示条件

## Root Cause
FACT: `spawnToast()` の末尾の `pushMsgLog(text, color)`（コメント「トーストは読み逃しやすいので同じ内容を左下に並行して積む」）。通知の種類を区別する仕組みが無い。

## Constraints
- 文言・呼び出し元のロジック・色を変えない（表示先だけ）
- 通知を読む E2E は、読み先を変えても検証内容（どの文言が出るか / 出ないか）を保つ
- 左下ログとタッチのスティックの縦の重なり（D Analyzer F-08 / HDR-11）は位置の問題で、AC には無い。D5 では位置を変えない（Known limitation として記録）

## Scope of Change
`src/legacy/parts/11-combat-actions.js`（`spawnToast` から `pushMsgLog` を外し、ログ専用の `spawnLog` を追加）、ログへ送る種類の呼び出し元（`spawnToast(` → `spawnLog(` の置き換えのみ）、`tests/helpers.js`（通知の監視）、通知を読む E2E の読み先、新規 E2E

## Unknowns
- ESCALATION 候補: なし（種類と表示先の再設計は HD-D17 が D に委ねている。文言・ロジックは変えない）

## Recommended Next Step
Planner: 種類 → 表示先の表を作り、呼び出し元をその表どおりに振り分ける。
