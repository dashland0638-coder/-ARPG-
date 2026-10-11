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
- 結果画面は本番と同じ `showBossResultScreen()` で描く。それが書き換える state（`lastDefeatedBossKey`・`bossClears`・`scenarioClears`・`clearedScenarios`・`freeRanks`・`smithJoined`・`inventory`・`equipmentInventory`・`routeCombosSeen`・`pendingAfterDefeat`・`scenarioKey`・`testMode`・`dialogueActive`）は描いた直後に `finally` で元へ戻す（同じ入れ物の中身を戻す。配列は要素の参照ごと戻すので、装備中の品の同一性も保つ）。「本編」の表示は描く間だけ `state.testMode` を外す（同期処理の中だけ）
- 戦闘不能画面は `triggerPlayerDown()` を呼ばない（所持金・ボスを書き換えるため）。既存の画面を開き、失う額の行だけ同じ式で埋める（差し引かない）
- 開いている間のボタン（3 択のカード・振り分けの ＋ / −・街に戻る・探索を続ける）は、画面の要素で捕捉段階（`pointerdown` / `click`）に受け止め、閉じるだけにする。振り分けの値（`allocPoints`）も閉じる時に戻す
- 本番の勝敗判定・進行ロジック（`showBossResultScreen` / `triggerPlayerDown` / 各ボタンの処理）は変更していない
- E2E: 入口で 3 画面を開き、3 択・振り分けを押し、閉じた後に、メニューの所持金・素材・経験値・HP・攻撃力・必殺技、鍛冶屋の装備一覧、localStorage、場所が開く前と同じ。2 回目にも「初制覇」が出る（クリア記録が戻っている）。通常 URL・`?dev=1` の本編では入口が使えない
- 残る副作用（表示だけ）: テストモードの「結果(テスト)」では、本番と同じく取得のログ（「未鑑定の装備を手に入れた!」）・拾得の表示・初制覇のトースト・効果音が出る（状態は戻っている）

## 撮影（1280×800 / 844×390）
撮影スクリプト `scripts/ui-screens/screens.spec.js`（`-g " H "`）。変更前は `main` `121b940`（結果・戦闘不能は H-D6 の入口を先に入れ、CSS を変える前に同じ手順で撮影。トーストは `main` の worktree で撮影）。画像は commit していない（PR にも添付する手段が無い）。生成場所: このセッションの scratchpad `ui-screens-h/{before,after}/`

| 画面 | 変更前 | 変更後 |
| --- | --- | --- |
| 会話 844×390 | 640×143（画面の 37%）、本文 14.5px、▼ が跳ねる、表記は常に「クリックして続ける」 | 640×103（26%）、本文 15px、話者名は札、▼ 静止、「タップして続ける」 |
| 会話 1280×800 | 640×143、グラデーションの面 | 640×143、プレート、「クリックして続ける」 |
| 確認 | 380×181、ぼかし・金のグラデーションのボタン | 380×187、プレート、罫＋菱形の見出し、主 / 沈んだ面のボタン |
| 結果（本編） | 440×285、ぼかし、ピルのボタン | 440×258（844）/ 277（1280）、ゴールドの行だけ（成長の UI なし）、表は沈んだ面 |
| 結果（テスト） | 440×343 / 704、3 択の説明 8.5px | 同じ高さ、3 択・振り分けも 11px 以上 |
| 戦闘不能 | 440×217、見出しの色は inline | 440×178 / 197、同じ色を class で |
| トースト（3〜4 件） | 文字＋影だけ、4 件積むと 844×390 でパネルの上まで届く | 小さなプレート、3 件まで、844×390 でもパネル・ミニマップに重ならない（基準 42%） |
| 撃破直後の背景 | `blur(9px) saturate(1.5) brightness(1.15)` | `brightness(0.55) saturate(0.4)` |

- トーストの撮影は、撮影そのものが 1.7 秒より長くかかるため、撮影の間だけ消去を止めてアニメーションを 0.5 秒の時点で止めている（撮影のための操作。寿命は E2E で計測）
- **書体**: Google Fonts が読み込めない環境で、OS の代替フォントで撮影・計測している

## テスト
| 確認 | 結果 |
| --- | --- |
| `npm run build` | PASS |
| `npm run test:unit` | 1710 pass / 0 fail / 1 skip（既存）。`dialogueAdvanceHint` の unit を追加 |
| 新規 `dialog-result-layout`（9 件） | **9 passed**（トースト × 2 サイズ・会話 × 2 サイズ・結果と戦闘不能 × 2 サイズ・状態が変わらない・通常モードで使えない・出撃画面のボタン） |
| 関連 E2E 17 spec（notifications, save-load, mansion-scenario, combat-hud-display-conditions, chapter1-progression, chapter1-legacy-ui, duskvillage, shadow-guide, road ほか名前の一致した chapter1-tower-to-road / chapter1-road 系, tavern-smith-greeting, chapter1-dusk-basics, character-weapon-visual, dev-ui-gate, ui-foundation, menu-character-layout, settings, dialog-result-layout） | 76 件中 74 passed / 2 failed → 下記 |
| ① `chapter1-progression.spec.js:80` | 実行中に私がソースを編集・ビルドし、開発サーバーがページを再読み込みしたため HUD が初期値「-」のまま（環境由来）。**単独で再実行して PASS**（`chapter1-progression` 全体 11 件＋新規 spec で 19 passed） |
| ② `chapter1-tower-to-road.spec.js:111` | `helpers.js:107` の待ちで 25 分のタイムアウト。UI-002-F で **変更前の `main` でも同じ場所で同じ失敗を再現済み**（この環境の低 fps。TF-04 の系統）。今回の変更とは無関係。CI で確認 |
| トーストの位置修正の後 | notifications / combat-hud-display-conditions / ui-foundation / dev-ui-gate: 13 passed、新規 spec の通知 2 件 PASS |
| CI（GitHub Actions の全体） | PR で実行 |

### E2E で確かめたことと、確かめていないこと
- 入口から開いた画面（H-D6）で確かめた: 2 サイズのレイアウト、本編の結果に成長の UI が出ない、テストモードの旧来の行、状態が変わらない、通常モードで使えない
- 実際のボス撃破・戦闘不能から開く経路は、既存の spec（洋館・村・道など。今回 PASS）で確かめている。結果・戦闘不能の **見た目** を実戦の経路で撮った画像は無い（入口からの画像だけ）

## Reviewer（独立。Agent Protocol 2.0）
- Round 1: **PASS**（`62daa46..d37103d`。範囲・通知の種類と文言・寿命・ピックアップ表示の不変・ぼかしなし・▼・デバイス別表記と入力仕様（キーボードでは会話は進まない）・id で絞った CSS・H-D6 の状態の監査（`showBossResultScreen` とその呼び出し先が書く全項目が復元対象）・入力の受け止め・テストの 10 項目）。非 blocking の注記: ① 配列を JSON で戻すと装備中の品の同一性が切れる → 参照ごと戻すよう修正（`08bc9c0`） ② 状態テストの 3 択・振り分けのクリックが条件付き → 表示を必須に（`08bc9c0`） ③ テストモードの「結果(テスト)」は本番と同じ取得のログ・トースト・効果音を出す（状態は戻る。下記に記載） ④ 3 件の上限で一瞬に 4 件以上出る場面のトーストを読む spec → 関連 E2E で PASS を確認
- Round 2: **PASS**（`d37103d..HEAD`。参照ごとの復元、トーストの基準の CSS 変数、2 サイズのトーストのテスト）

## 既知の制約・Human 実機確認が必要な事項
1. 実機（iPhone 横持ち・PC のブラウザ）で、正式な書体での見え方・トーストの読みやすさ（1.7 秒）・会話の高さ
2. パッドの実機で「A・× で続ける」の表記が出ること（E2E は仮のパッドの接続イベントで確認）。タッチとマウスの両方がある端末では「タップして続ける」になる（既存の `isTouchDevice` の判定のまま）
3. 実戦の経路（ボス撃破・戦闘不能）での結果・戦闘不能の見た目と、撃破直後の背景（暗転・彩度）の印象
4. テストモードの「結果(テスト)」は、表示のために本番と同じ取得のログ・初制覇のトースト・効果音が出る（状態は戻る。テストモードだけ）
5. 3 件の上限により、同じ瞬間に 4 件以上のトーストが出ると古いものから外れる（承認済み H-D2）
6. Safe area（ノッチ）のある実機での位置

## Autonomy Metrics
- Human Escalation Count: 0 / Human Decision Count: 0（承認済みの H-D1〜H-D7 の範囲）
- Auto Fix Count: 5（トーストの不透明度の保持時間、積み重ねの間隔、入口の `pointerdown` の受け止め（E2E が検出）、Reviewer R1 の注記 2 件、844×390 のトーストとパネルの重なり）
- Reviewer Rounds: 2（R1 PASS・R2 PASS） / Test Retries: 1（`chapter1-progression:80` の単独再実行。原因は実行中の再読み込み）
