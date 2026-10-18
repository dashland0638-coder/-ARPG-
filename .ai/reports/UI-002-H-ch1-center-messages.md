# UI-002-H 追補 — 第一章リファクタリング: 戦闘中の中央メッセージ削減

Role: Analyzer → Planner → Implementer → Tester（このファイル）/ Reviewer（`UI-002-H-ch1-center-messages-review.md`）
Base: `origin/main` `412ba03`（PR #88 の squash merge 後）
Branch: `claude/chapter-1-comprehensive-audit-6cul2d`（PR #88 の merge 後に `origin/main` から作り直した）
依頼: Human「第一章リファクタリング：戦闘中の中央メッセージ削減」（2026-10-17）

## 1. Human の方針（依頼の要約）

- 切り上げ・落下攻撃などの技名の中央メッセージは出さない
- 敵のダウンをメッセージで知らせない
- 処刑できる状態は、攻撃ボタンが自動で切り替わることで伝える
- 画面中央のメッセージはできるだけ減らす。ただし重要な通知は残す
- ゲームロジックは変えない。対象は攻撃・ダメージ・コンボ・Ult ゲージ・Break・処刑の条件・ボスの段階変化
- PR #87 で消した「✨ フィニッシュ!」を復活させない

## 2. Analyzer（FACT）

### 2.1 通知の仕組み

- 中央トーストは `spawnToast`（`11-combat-actions.js`）。最大 3 件、1.7 秒で消える（UI-002-H H-D2）。
- 左下ログは `spawnLog` だけ。テストモードには Arena の記録（`emitArenaFeedback`、`#arena-feedback-log`）もある。通常プレイには出ない。
- 処刑:
  - 窓は `triggerKnockdown` → `openExecutionWindow`（`core/break-window.js`）で開く。
  - 表示は `#execute-prompt`（「EXECUTE」）。`updateExecutePrompt` が `currentExecutionTarget()` を見て出し入れし、位置は敵の頭上（UI-002-D WI-D6）。
  - 入力は R/E キー（`interact()` → `tryExecution()`）か、`#execute-prompt` のタップ。
- **攻撃ボタンが処刑に切り替わる仕組みは無かった**（FACT）。
  - `#btn-attack` は `attackInputDown` → `tryAttack` だけを呼んでいた。
  - `docs/`・`.ai/decisions/`・ルートの設計資料のどこにも、そういう仕様の記述は無い。
  - Human の方針に合わせて最小限で追加した（§3）。

### 2.2 戦闘中の中央トーストの一覧と分類

`spawnToast(` は `07-ai-combat.js` に 38 件、`11-combat-actions.js` に 24 件。戦闘中に出るものを分類した（会話・施設・UI 操作の通知は対象外）。

**廃止（16 件）**

| 文言 | 場所 | 内容 | 分類の理由 |
| --- | --- | --- | --- |
| 🗡️ 切り上げ! | 11 `tryUppercut` | 空中攻撃（上昇中） | 技名だけ |
| ⤵️ 急降下! | 11 `tryJumpAttack` | 落下攻撃の開始 | 技名だけ |
| 💥 急降下斬り! / 🗡️ 急所突き! / 🔮 落下呪撃! / 🏹 矢の雨! | 11 `landJumpAttack` | 落下攻撃の着地 | 技名だけ |
| 🪶 撃ち落とした! | 11 `groundFlyingEnemy` | 切り上げで飛ぶ敵が落ちる | 攻撃の結果の説明。落ちる姿で分かる |
| ⚔️ 回避攻撃! | 11 回避攻撃 | 回避からの攻撃 | 技名だけ |
| 🩸 瞬閃! / 💨 疾風・三ノ矢! | 11 回避攻撃 | 武器固有の回避攻撃 | 技名だけ |
| 🌑 影踏み突き! | 11 `swingOnce` | 武器固有のコンボ 3 段目 | 技名だけ |
| 🦶 エネミーステップ! | 07 `triggerEnemyStep` | 敵を踏む | 技名だけ |
| 💥 ダウン! / 💥 体勢を崩した!畳み掛けろ! | 07 `triggerKnockdown` | 敵（ボス）のダウン | ダウンだけを伝える。処刑の可否は攻撃ボタンで伝える |
| 💫 体勢を崩した! | 07 `applyStaggerResult` | 大怯み（体幹 70%） | ダウンと同じ種類の状態の通知。怯む姿で分かる |
| ✦ 断ち斬り 等（`style.label`） | 07 `dealDamageToEnemy` | 処刑の技名 | 技名だけ |

- 「✨ フィニッシュ!」は PR #87 で廃止済み。復活していないことを unit で確かめる。
- テストモードの Arena の記録（`UPPERCUT`・`ENEMY STEP`・`EXECUTION`）は残した。切り上げと同じ扱いで、落下攻撃にも `DIVE` を足した。どれもテストモード専用のデバッグ記録で、通常プレイには出ない。

**維持（中央トーストのまま）**

| 種類 | 例 | 理由 |
| --- | --- | --- |
| ボスの段階変化 | `⚡ ${名前}が${label}!`（07 `4656`） | 気付かないと戦況が分からない |
| 中ボス・連戦の告知 | `⚔️ ${名前}が立ちはだかる!`、水路の連戦 | 戦闘の始まり・区切り |
| ボス・敵の大技の予兆と召喚 | 天井の石・薙ぎ払い・針・秒針・歯車・胞子、乗員を呼び寄せた、時を巻き戻した、同じ影が増えた、背後に気配 | 避けるための情報 |
| 敵の攻撃・状態の変化 | のしかかり、蔓に掴まれた、水を吐いた、衝撃波、盾持ちが構えを変えた、守護神像が身を固めた | 被弾や攻撃が通らない理由 |
| プレイヤーの状態異常 | ⚡ 体が痺れて動けない! | 操作できない理由 |
| 操作の結果 | ジャストドッジ、パリィ成功（HP 回復量）、受け流し成功、ガードブレイクを潰した、魔球が身代わりになった | 防御の操作が成功したことと効果 |
| 操作できない理由 | ⚠ 空中ではスキルを使えない、⚠ ○○が足りない! | 押しても出ない理由 |
| Skill 2 の効果 | 🔍 灯りを掲げた ―― 周りの動きがよく見える | 効果の説明 |

**今回は対象外（テストモード・旧成長系だけ）**

- Skill 3（ボスから習得する技）の技名: 亡霊の一閃・斉射・甲羅ダイブ・地烈の一撃・刻の一撃・癒しの開花。
- 第一章の本編では Skill 3 を出さない（UI-002-A WI-A2、`legacyHudVisible`）。そのため、本編の戦闘画面には影響しない。

## 3. Planner

| WI | 内容 | ファイル |
| --- | --- | --- |
| M1 | §2.2 の廃止 16 件の `spawnToast` を消す。処理（ダメージ・体幹・Ult・VFX・SE・hitStop・窓）は残す。使われなくなった `bigFlinchToast` の指定も消す | `07-ai-combat.js`、`11-combat-actions.js` |
| M2 | 処刑できる間は攻撃の入力（タッチの攻撃ボタン・J キー・左クリック・パッド）が処刑になる。`attackInputDown` の冒頭（スキル中の判定の後、長押しの開始の前）で `tryExecution()` を見る。長押しのオートコンボは始めない | `13-update-loop.js` |
| M3 | `updateExecutePrompt` と同じ条件で、`#btn-attack` に `.is-execute` を付け、文字を「処刑」にする。窓が閉じたら「攻撃」に戻す。色は `#execute-prompt` と同じ系統で、脈動も同じ。glyph は隠す | `14-hud-boot.js`、`main.css` |
| M4 | テスト: unit（文言が無い・処理が残る・入力の順番・ボタンの切り替え・維持する通知）、E2E（タッチ 844×390 で処刑に切り替わる・タップで処刑・戻る、窓を逃しても戻る、PC の J キーで処刑）、`air-actions.spec.js` の技名の確認を Arena の記録へ移す | `tests/` |

- 処刑の成立条件（`canTryExecution`・`pickExecutionTarget`・窓の長さ）・ダメージ・Break・ボスの段階変化は変えない。
- `#execute-prompt`（敵の頭上の「EXECUTE」）は残す。
  - 中央トーストではなく、敵の位置に出るタップできる表示（UI-002-D HD-D16）。
  - PC にはタッチの攻撃ボタンが出ないので、PC で処刑できることを伝える表示はこれだけになる。
  - 消すかどうかは Human の判断事項として報告する（§7）。
- E2E の既存の Break の手順（体幹を削るまで J を押し続ける）は、窓が開いたまま次の J を押すと処刑になる。そのため `tests/helpers.js` に `attackDownUnlessExecutable` / `attackUp` を足した。窓の確認と J の押下を同じ `page.evaluate` の中で行う（間にゲームのフレームが進まない）。対象は `execution-break`・`combat-events-layout`・`combat-center-messages`・`mansion-{warden,enemies,butler,lord}`。テストの判定は変えていない。

## 4. Implementation Result

| ファイル | 変更 |
| --- | --- |
| `src/legacy/parts/11-combat-actions.js` | 技名のトースト 11 件を削除。`tryJumpAttack` に Arena の記録 `DIVE`（テストモード専用）を追加 |
| `src/legacy/parts/07-ai-combat.js` | エネミーステップ・大怯み・ダウン（通常 / ボス）・処刑の技名のトーストを削除。`bigFlinchToast` の指定と説明を整理 |
| `src/legacy/parts/13-update-loop.js` | `attackInputDown` で `tryExecution()` を先に見る |
| `src/legacy/parts/14-hud-boot.js` | `setAttackButtonExecute(on)` を追加。`updateExecutePrompt` の切り替え時に呼ぶ |
| `src/styles/main.css` | `#btn-attack.is-execute`（暗い赤茶の地・金の縁・`execPulse`。glyph を隠す）。押下中の色（Review R1 注記 3） |
| `tests/unit/combat-center-messages.test.js` | 新規（6 件） |
| `tests/combat-center-messages.spec.js` | 新規（3 件） |
| `tests/helpers.js` | `watchNotifications` が Arena の記録を channel `'arena'` として記録する。`attackDownUnlessExecutable` / `attackUp` を追加 |
| `tests/air-actions.spec.js` | 技名の確認を Arena の記録（`UPPERCUT`・`DIVE`・`ENEMY STEP`）へ移す。技名・ダウンの中央トーストが出ないことを確かめる |
| `tests/unit/notification-channels.test.js` | コメントだけ（影踏み突きの記述） |
| `tests/execution-break.spec.js` ほか 5 件 | 処刑の窓が開いていれば J を押さない（上記の helper） |

変えていないもの:

- `basefile.html`
- `index.html`（`#btn-attack` の構造と文言。文字は JS が書き換える）
- セーブの形式
- Chapter 1 の成長のルール
- 処刑・Break・ダメージ・Ult の数値と条件
- `#execute-prompt`

## 5. テスト結果

| 種類 | 結果 |
| --- | --- |
| build（`npm run build`） | 成功 |
| unit（`npm run test:unit`） | 1867 件: pass 1866 / fail 0 / skipped 1（skipped は既存） |
| E2E 対象分（`combat-center-messages`・`air-actions`・`execution-break`・`notifications`・`combo-finish-toast`） | 14 / 14 passed（6.4 分） |
| E2E 全件 | §5.1 |

撮影（844×390、`hasTouch`、テストモード・剣士・Dummy）:

- 処刑できる間: 攻撃ボタンが「処刑」（暗い赤茶の地・金の縁）、敵の頭上に「✦ EXECUTE」。
- 処刑の後: 「攻撃」（glyph つき）に戻る。

### 5.1 E2E 全件

- 1 回目（head `7d7b77f`、291 件、1.5 時間）: **289 passed / 1 failed / 1 skipped**（skipped は既存）。
  - 失敗: `execution-break.spec.js` の「通常敵: 体幹を削る → Break → EXECUTE …」。
  - 原因: 体幹を削る途中、窓の確認から J の押下までの間にゲームのフレームが進んだ。その結果、J で一度処刑していた（崩すまでの最大の一撃がすでに処刑の 25200 だった）。テストの手順の競合で、ゲームの不具合ではない。攻撃ボタンで処刑するのは今回の仕様どおり。
  - 修正: `2a9f44d`。確認と押下を同じ `page.evaluate` の中で行う helper に置き換えた。
- 2 回目（head `2a9f44d`、Break の手順を使う spec の全件）: `execution-break`・`combat-center-messages`・`combat-events-layout`・`mansion-{warden,enemies,butler,lord}` で **40 / 40 passed**（22.6 分）。
- その後の `bfb17f9` の変更は CSS の 1 行（押下中の色）と記録だけ。E2E 全件は再実行していない。

## 6. iPhone 実機の確認（HUMAN DEVICE CHECK REQUIRED）

実機では確認していない。次の点は完了扱いにしない。

1. 戦闘中、切り上げ・落下攻撃・回避攻撃・エネミーステップ・敵のダウン・大怯み・処刑の中央メッセージが出ないこと。
2. 敵を崩すと、攻撃ボタンが「処刑」（色・縁・脈動）に変わり、ひと目で気付けること。
3. 「処刑」をタップすると処刑になること。押しっぱなしで攻撃していた指を一度離して押し直す必要がある。その操作感が自然か。
4. 窓が閉じる（処刑した・逃した・離れた）と「攻撃」に戻ること。
5. ボスの段階変化・大技の予兆・状態異常・パリィ・ジャストドッジの中央メッセージは今までどおり出ること。

## 7. Human への報告事項（判断が必要なら）

- 敵の頭上の「✦ EXECUTE」（`#execute-prompt`）は残した。
  - 中央トーストではなく、PC で処刑できることを伝える唯一の表示のため。
  - タッチで攻撃ボタンだけに寄せたい場合は、別途の判断事項になる。
- 攻撃ボタンが処刑に切り替わる仕組みは、既存の仕様に無かったため新しく足した（§2.1）。
  - 攻撃ボタン（タッチ・J キー・左クリック・パッド）で処刑できるようになった。
  - 既存の R/E キーと EXECUTE のタップも、そのまま使える。
