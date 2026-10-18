# UI-002-H 追補 — 戦闘中の中央メッセージ削減 Review（Round 1）

Role: Reviewer（独立）
Branch: `claude/chapter-1-comprehensive-audit-6cul2d`
Base: `origin/main` `412ba0319e0e2e5db8e1816e3b024ad0e48c5564`
Reviewed head: `2a9f44d0e1f2a5eb2490c278200aec9f1b18e1e1`（`git rev-parse HEAD` で確認）
- 依頼時の head は `1e73120`。レビュー中に作業ツリーの変更（`tests/helpers.js` の `attackDownUnlessExecutable` / `attackUp` と、Break のループ 7 ファイルの置き換え）が `2a9f44d` として commit された。`git diff 1e73120..2a9f44d` は、確認した作業ツリーの diff と同じ内容（8 files, +43 / -39）。

実行したもの: `npm run build`（成功）、`npm run test:unit`（1867 件: pass 1866 / fail 0 / skipped 1）。
Playwright は実行していない（別ジョブが実行中のため。指示どおり）。

## Verdict: **PASS WITH NOTES**

blocking の指摘は無い。以下はすべて non-blocking。

## 確認結果

### 1. 廃止したトーストの分類

- 廃止 16 件（`11-combat-actions.js` 11 件、`07-ai-combat.js` 5 件）は、どれも「技名だけ」「ダウン・大怯みだけ」「処刑の技名だけ」。レポート §2.2 の一覧と一致する。
- 「✨ フィニッシュ!」は復活していない（unit で確認）。
- 残っている `spawnToast` を全件見た。ボスの段階変化（07:4655）・中ボス / 連戦・大技の予兆・召喚・敵の攻撃（のしかかり・衝撃波 等）・痺れ・パリィ / ジャストドッジ / 受け流し / ガードブレイクを潰した・空中スキル不可・資源不足、はすべて維持。重要な通知の削除は無い。
- 残った技名系は Skill 3（亡霊の一閃・斉射・甲羅ダイブ・地烈の一撃・刻の一撃・癒しの開花、11:1092〜1146）だけ。第一章本編では Skill 3 を出さない（`skill3ButtonVisible`）ため対象外、というレポートの判断は妥当（指摘 4）。

### 2. ロジックの不変

- 削除した行はトーストの呼び出しだけ。瞬閃の踏み込み・壁補正、はやての `volley`、落下攻撃の VFX / shake / SE / ダメージ、`groundFlyingEnemy` の状態変更、`triggerKnockdown` の `openExecutionWindow` / shake / SE / hitStop / Ult、処刑の hitStop / flash / SE / `addUltGauge(EXECUTION_ULT_BONUS)` は残っている。
- `triggerEnemyStep` の `{bigFlinchToast:false}` を外したが、`applyStaggerResult` は `opts = opts || {}` で、`applyBigFlinch` の既定（大怯みを扱う）は変わらない。
- `tryJumpAttack` に足した `emitArenaFeedback('DIVE', …)` は `state.testMode` 以外では即 return。通常プレイへの影響なし。
- 処刑の条件（`canTryExecution` / `pickExecutionTarget` / `consumeExecutionWindow`）・ダメージ・Break・コンボ・Ult の数値に変更なし。

### 3. 攻撃 → 処刑の入力

- `attackInputDown` の位置は、開始状態・ポーズ・会話・回避・麻痺・押下済み・スキル中の判定の後、`attackHeldStart` の設定と `tryAttack()` の前。処刑が成立したら長押しのオートコンボは始めない。妥当。
- 入力の経路: タッチ `#btn-attack`（`bindHoldButton`）・`KeyJ`（`!e.repeat`）・canvas の左クリック・パッドの X（押した瞬間だけ）は、すべて `attackInputDown` を通る。
- `updateHoldInputs` のオートコンボと `dispatchQueuedAction` は `tryAttack()` を直接呼ぶ。`tryExecution()` は通らないので、押しっぱなしや抜刀待ちの入力で勝手に処刑されることは無い。押しっぱなしのまま Break しても処刑にはならず、一度離して押し直す必要がある（レポート §6-3 で実機確認項目に挙げてある）。
- 回帰の見込み: 「Break 後の次の攻撃入力が処刑になる」こと自体が今回の仕様。PC でも J / 左クリックで処刑するようになる（レポート §7 に記載あり）。

### 4. ボタンの戻り

- `setAttackButtonExecute` は `updateExecutePrompt` の切り替えの時だけ呼ばれ、`#execute-prompt` と同じ状態を持つ。窓が閉じる・対象が死ぬ・間合いや向きが外れる、のどれでも `currentExecutionTarget()` が null になり、次のフレームで「攻撃」に戻る。
- `updateExecutePrompt` は animate の通常プレイ分岐（`started && !paused && !dialogueActive`）でしか呼ばれない。会話・メニュー・タイトルへ戻る間は「処刑」が残ることがある。ただし、
  - その間は `attackInputDown` も `canTryExecution` も弾くので、押しても何も起きない。
  - 次に操作できる最初のフレームで戻る。
  - `#execute-prompt` の既存の挙動と同じで、それより悪くはない（指摘 2）。

### 5. CSS

- `#btn-attack.is-execute`（1,1,0）は `.action-btn.pressed`（0,2,0）より強い。処刑表示の間は、押した時の背景・縁の変化が消え、`transform:scale(0.88)` だけ残る（指摘 3）。
- `#touch-controls.pc-indicators #btn-attack{display:none}`（2,1,0）は上書きされない。PC ではボタンは出ず、`#execute-prompt` で伝わる。
- `.gamepad-min` の `opacity` / `pointer-events` は影響を受けない。
- 「処刑」2 文字、`#ffe6b0` on `rgba(58,22,10,0.88)` で読める。glyph は隠すので文字が詰まらない。

### 6. テスト

- unit `combat-center-messages.test.js`: 廃止した文言が legacy に無いこと、関数本体に `spawnToast` が無いこと、処理が残ること、`attackInputDown` での順番、ボタン切り替えの条件、維持する通知、を見ている。構造の検査としては十分。
- E2E `combat-center-messages.spec.js`: タッチで「処刑」に変わる・色が変わる・タップで処刑・「攻撃」に戻る、窓を逃して戻る、PC の J で処刑、ダウン・処刑のトーストが出ない、を見ている。
- `air-actions.spec.js`: 技名の確認先を中央トーストから Arena の記録（`UPPERCUT` / `DIVE` / `ENEMY STEP`）へ移し、さらに技名のトーストが出ないことを足した。判定は弱まっていない。
- 既存 spec（execution-break / combat-events-layout / mansion-* 4 件）の変更は、Break を削るループの J の押し方だけ。判定は変えていない。
  - 押してはいけないタイミング（窓が開いている間）に J を押して処刑していた件（全件実行の 1 fail）への対処として、`attackDownUnlessExecutable` は、窓の確認と keydown の発行を同じ `page.evaluate` の中で行う。JS は 1 スレッドなので、確認と押下の間にゲームのフレームは進まない。
  - リスナーは `window` の keydown / keyup で、`isTrusted` は見ていないので、合成イベントでも同じ経路を通る。
- 足りないもの（指摘 5）: 間合いから離れた時の戻りと、押しっぱなしのまま Break しても処刑しないことは、E2E では見ていない。どちらも条件が同じ関数（`currentExecutionTarget` / オートコンボが `tryAttack` 直呼び）なので unit の構造検査で代替されている。

### 7. 記録

- 実機確認を完了扱いにしていない（レポート §6 は HUMAN DEVICE CHECK REQUIRED、task も「実機では未確認」）。正しい。
- 廃止 16 件の数と内訳は、コードと一致する。
- レポート §3 末尾と §4 の表は、Break ループの変更を「押す前に窓を確かめる 1 行を足した」と書いている。`2a9f44d` で `tests/helpers.js` の `attackDownUnlessExecutable` / `attackUp` に置き換わったので、記述の更新が必要（指摘 6）。§5.1 は「実行後に記入」のまま。

## Findings

| # | 場所 | 重要度 | 内容 / 失敗のシナリオ |
| --- | --- | --- | --- |
| 1 | `src/legacy/parts/13-update-loop.js:145`（`state.paralyzed` / `skillHeldStart` の早期 return）と `11-combat-actions.js` `canTryExecution` | non-blocking | `canTryExecution` は麻痺を見ないので、痺れている間もボタンは「処刑」と出る。ところが攻撃ボタンは `attackInputDown` の麻痺判定で弾かれ、押しても処刑されない。一方で R/E キーと EXECUTE のタップでは処刑できる。表示と入力が一瞬食い違うが、麻痺は短く、仕様（処刑の条件は変えない）の範囲。必要なら後で、表示側の条件に麻痺を足すか、処刑の判定を麻痺判定の前へ出すかを決める |
| 2 | `src/legacy/parts/14-hud-boot.js:884-892`（呼び出しは animate の通常プレイ分岐のみ） | non-blocking | 窓が開いたまま会話・メニュー・タイトル帰還に入ると、「処刑」の表示が残る。その間の入力は弾かれ、次に操作できる最初のフレームで戻る。既存の `#execute-prompt` と同じ挙動で、悪化はしていない |
| 3 | `src/styles/main.css:887` | non-blocking | `#btn-attack.is-execute` の background / border-color が `.action-btn.pressed` を上書きする。処刑表示中にタップした時の色の手応えは無く、縮むだけになる。処刑の後はすぐ「攻撃」に戻るので実害は小さい。実機確認（§6-2/3）で気になれば `#btn-attack.is-execute.pressed` を足す |
| 4 | `src/legacy/parts/11-combat-actions.js:1092-1146` | non-blocking | Skill 3 の技名トーストは残っている。第一章本編では Skill 3 を出さないので、今回の範囲外という判断は妥当。第一章の外で同じ方針を取るなら、別タスクで扱う |
| 5 | `tests/combat-center-messages.spec.js` | non-blocking | 「間合いを外れたら戻る」「押しっぱなしで Break しても処刑しない」の E2E が無い。unit の構造検査で代替されている。必須ではない |
| 6 | `.ai/reports/UI-002-H-ch1-center-messages.md` §3 末尾・§4 表・§5.1 | non-blocking | Break ループの変更の記述が `2a9f44d` の helper 化を反映していない。§5.1（E2E 全件）が空欄。PR の前に更新すること。完了扱いの誤記は無い |
| 7 | `tests/helpers.js` `attackDownUnlessExecutable` | non-blocking（参考） | `#execute-prompt.show` は前のフレームの終わりの状態。窓が開くダメージの多くは `updateExecutePrompt` より前で解決するので一致する。後段の更新でダメージが入る経路があれば 1 フレームずれる可能性は理論上残るが、今回の 1 fail の原因（`page.keyboard` の確認〜押下間のフレーム進行）は解消している |

## 結論

- Human の要件は満たしている。技名・ダウン・処刑可能の中央トーストを廃止し、重要通知は維持し、攻撃ボタンが「処刑」に切り替わって戻る。ロジック・数値・basefile.html・セーブ形式・成長ルールは変えていない。
- 指摘 6（記録の更新）は PR の前に反映すること。その他は任意。
- Implementer への差し戻しは不要。
