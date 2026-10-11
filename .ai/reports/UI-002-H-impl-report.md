# UI-002-H Implementation Report — Dialog / Notification / Result UI（H0〜H6）

| 項目 | 内容 |
| --- | --- |
| Work Item ID | UI-002-H（H0〜H6） |
| 目的 | 会話・確認・通知・結果・戦闘不能を、UI-002-F と同じプレートの視覚言語にそろえる。仕様・文言・表示条件は変えない |
| 承認 | Human 2026-10-10（`.ai/tasks/UI-002-H.md` Human Approval、H-D1〜H-D7） |
| ブランチ | `claude/ui-002-h-impl`（`main` `121b940` から。`main` への merge は禁止） |
| 分析 / 計画 | `.ai/reports/UI-002-H-analysis.md` / `.ai/reports/UI-002-H-plan.md`（`claude/ui-002-h-analysis` @ `6a2159c` を引き継ぎ） |

## 実施内容

| WI | 内容 | 主な変更 |
| --- | --- | --- |
| H0 | 撮影スクリプトに会話・トースト・確認・結果（本編 / テスト）・戦闘不能・撃破直後の背景を追加 | `scripts/ui-screens/screens.spec.js`（CI の `npm test` に含めない。画像は commit しない） |
| H1 | 共通: 背景のぼかしを外し単色の暗幕に。パネル = F のプレート（単色の面・3px の輪郭・2px の内縁・角丸 8px・落ち影 1 種）。見出し = 罫＋小さな菱形 | `main.css`（`#dialogue-overlay` / `#confirm-overlay` / `#clear-overlay` / `#down-overlay` に限定。`.event-*` は出撃画面と共有なので id で絞る） |
| H2 | 会話: 話者名は札、本文 15px、背の低い画面で 4 割以内。▼ は静止（H-D4）。「続ける」はデバイス別（H-D5） | `main.css`、`10-input.js` `syncDialogueHint`、`src/core/combat-hud-visibility.js` `dialogueAdvanceHint`（＋ `concat-plugin.js` の import 1 行） |
| H3 | 確認: 封をした書付。OK = 主ボタン（塗り）、やめる = 沈んだ面 | `main.css` |
| H4 | 結果・戦闘不能: 結果の表を沈んだ面に。inline style → class（`down-title` / `down-penalty`、値は同じ。結果のパネルの inline は CSS と重複していたので削除）。テストモードだけの部品（3 択・振り分け）も 11px 以上 | `index.html`、`main.css` |
| H5 | 通知（H-D1 B / H-D2 a）: トーストは文字の下に小さなプレート（発光なし）、見えている時間 = DOM の寿命 = 1.7 秒、同時に 3 件まで。左下ログも同じプレート（寿命・行数・位置は D のまま）。撃破直後の背景はぼかし → 暗転と彩度（H-D3） | `11-combat-actions.js`（`TOAST_LIFE_MS` / `TOAST_MAX`、`.is-toast`）、`main.css` |
| H-D6 | テストモードの Arena パネルに「結果(本編)」「結果(テスト)」「戦闘不能」 | `index.html`（ボタン 3 つ）、`14-training-ground.js` |
| H6 | テスト | 新規 `tests/dialog-result-layout.spec.js`（8 件）、`tests/ui-foundation.spec.js`（H の対象の期待値だけ更新）、unit 1 件 |

### 記録の訂正（H-D2）
UI-002-D WI-D5 の表・`helpers.js` の注記は「中央トーストは 1.7 秒で消える」としていたが、実際は CSS の `itemfloat 1.1s` で **1.1 秒で見えなくなり、DOM だけが 1.7 秒残っていた**。今回、見えている時間を 1.7 秒にそろえたので、記録の「1.7 秒」は実装と一致した。訂正は `.ai/decisions/UI-002-human-decisions.md`（H-D2）に記録。

## H-D6: テスト用入口の安全性
- 入口は Arena パネルの中だけ。Arena パネルは `state.testMode` の時だけ出る（`updateArenaPanel`）。テストモードには `?dev=1` でしか入れない。関数側でも `DEV_UI && state.testMode` を確認する（隠れたボタンを直接押しても何も起きない ―― E2E で確認）
- 結果画面は本番と同じ `showBossResultScreen()` で描く。それが書き換える state（`lastDefeatedBossKey`・`bossClears`・`scenarioClears`・`clearedScenarios`・`freeRanks`・`smithJoined`・`inventory`・`equipmentInventory`・`routeCombosSeen`・`pendingAfterDefeat`・`scenarioKey`・`testMode`・`dialogueActive`）は描いた直後に `finally` で元へ戻す（配列・オブジェクトは中身を戻す）。「本編」の表示は描く間だけ `state.testMode` を外す（同期処理の中だけ）
- 戦闘不能画面は `triggerPlayerDown()` を呼ばない（所持金・ボスを書き換えるため）。既存の画面を開き、失う額の行だけ同じ式で埋める（差し引かない）
- 開いている間のボタン（3 択のカード・振り分けの ＋ / −・街に戻る・探索を続ける）は、画面の要素で捕捉段階（`pointerdown` / `click`）に受け止め、閉じるだけにする。振り分けの値（`allocPoints`）も閉じる時に戻す
- 本番の勝敗判定・進行ロジック（`showBossResultScreen` / `triggerPlayerDown` / 各ボタンの処理）は変更していない
- E2E: 入口で 3 画面を開き、3 択・振り分けを押し、閉じた後に、メニューの所持金・素材・経験値・HP・攻撃力・必殺技、鍛冶屋の装備一覧、localStorage、場所が開く前と同じ。2 回目にも「初制覇」が出る（クリア記録が戻っている）。通常 URL・`?dev=1` の本編では入口が使えない
- 残る副作用（表示だけ）: テストモードの「結果(テスト)」では、本番と同じく取得のログ（「未鑑定の装備を手に入れた!」）・拾得の表示・初制覇のトースト・効果音が出る（状態は戻っている）

## 撮影（1280×800 / 844×390）
（Tester の結果で更新）

## テスト
（Tester の結果で更新）

## Reviewer
（Reviewer の結果で更新）

## 既知の制約・Human 実機確認が必要な事項
（更新）

## Autonomy Metrics
（更新）
