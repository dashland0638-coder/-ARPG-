# CHARACTER-VIS-002 / T-2R-1 追加調査: iOS のアプリ内ブラウザでの BGM の重複（2026-11-27）

- 対象: PR #149（`claude/character-vis-002-t2`）。BGM の修正 `f9fc4e5`、レビューの記録 `a6e827e`。本調査の修正は本書の後の commit
- 表記: **FACT**（コード・テスト）/ **INFERENCE**（仮説）/ **HUMAN**（Human の実機の確認）

## 1. Human の実機の確認（HUMAN、確定情報）
| 環境 | 結果 |
| --- | --- |
| iPhone Safari で PR #149 のプレビューを直接開く | BGM は正常 |
| ChatGPT の iOS アプリの中から同じプレビューを開く | BGM の問題が起きる |
| Claude の iOS アプリの中から同じプレビューを開く | 同じ問題が起きる |
- Safari とアプリ内ブラウザで挙動が違う。アプリ内ブラウザでの詳しい再現条件は**未確定**

## 2. ページの中で確認できた事実（FACT）
| 項目 | 事実 | 根拠 |
| --- | --- | --- |
| AudioContext | 1 ページに 1 つ。作るのは `initAudio()` だけ（2 回目以降は同じものを返す）。手続き生成の BGM も同じ context を使う | `src/audio/audio.js` の `initAudio`、`procedural-bgm.js:12`。リポジトリ全体で `new AudioContext` はここだけ |
| BGM の開始 | `playBgm` を呼ぶのは `buildWorld` だけ。同じキーなら段の切り替えだけ。違うキーなら前の BGM をすべて止めてから。遅れて読み込みが終わった古い要求は世代の番号で捨てる | `02-world-common.js:471`、`playBgm` / `bgmToken` |
| タイトル | 起動時に `stopBgm()`、タイトルへ戻るときも `stopBgm()`。タイトルで BGM を鳴らす経路は無い | `14-hud-boot.js` の起動処理、`10-input.js:481` |
| 同時に鳴る数 | 登録曲の音源は最大 2（段の切り替えの 2 秒のクロスフェード中だけ）。止めた音源は出力から外す | `bgmVoices` / `killVoice`、E2E `bgm-regression` |
| Chromium | タイトル 0・開始後 1。裏 / 表 / pagehide / bfcache でも増えない | E2E `bgm-lifecycle` |

→ **FACT から言えること**: 1 つのページの中では、タイトルで BGM は鳴らず、BGM は 1 系統。**タイトルで BGM が聞こえる・開始後に別の音が重なる**なら、その音は**今のページの外**（前に開いた同じゲームのページ、または別のアプリの音）から来ている。

## 3. Safari とアプリ内ブラウザの違い（INFERENCE、実機で未確認）
| 観点 | Safari | アプリ内ブラウザ（SFSafariViewController / WKWebView）|
| --- | --- | --- |
| タブ・ページの寿命 | タブを切り替える・閉じると `visibilitychange`（hidden）/ `pagehide` が出る → `f9fc4e5` で音を止める | 閉じる・チャットへ戻る・最小化のときに、ページが壊されずに残る、あるいは hidden / pagehide を出さないことがある（アプリの作りによる）→ `f9fc4e5` の対策が働かず、前のページの BGM が鳴り続ける |
| 開き直し | 同じタブを使う / ユーザーが閉じられる | リンクを押すたびに新しいブラウザのインスタンスで開くことが多い → 前のページ（ゲームを始めた状態）が裏で生きたまま、新しいページのタイトルが開く |
| 区別 | userAgent に `Safari/` | WKWebView は userAgent に `Safari/` が無いことが多い。SFSafariViewController は Safari と区別できない |
| 音の扱い | ページの音は Safari が管理 | ホストのアプリの音声セッションの設定の影響を受ける |

### BGM の重複の経路（仮説、最有力）
1. アプリ内ブラウザでプレビューを開き、ゲームを始める（ページ A が BGM を鳴らす）
2. アプリ内ブラウザを閉じる・チャットへ戻る。**ページ A は破棄されず、hidden / pagehide も出ない**ので、`f9fc4e5` の一時停止が働かず BGM が鳴り続ける
3. もう一度リンクを押す → 新しいページ B のタイトル。**ページ A の酒場の BGM が聞こえる**（Human の「タイトルで酒場の BGM」）
4. ページ B で始める → ページ B の BGM が重なる（Human の「開始後に別の音」）
- Safari では 2 で hidden / pagehide が出るので起きない（Human の確認と一致）

### まだ仮説のもの
- アプリ内ブラウザを閉じたときにページが残るか・どのイベントが出るか（ChatGPT / Claude のアプリの実装による。外から確かめられない）
- 残ったページの JavaScript（タイマー）が動き続けるか（止まっていると、下の対策 ① ② が届かない）
- ホストのアプリの音（読み上げ等）との競合の可能性

## 4. 修正（音の持ち主とライフサイクルを明確にする。音響の仕組みは作り直さない）
| # | 内容 | ファイル |
| --- | --- | --- |
| ① 音の持ち主は 1 ページ | 同じ origin（`dashland0638-coder.github.io`、本番とプレビューを含む）で BGM を鳴らすのは**最後に始めた・戻った・タップしたページ 1 つ**。そのページが `BroadcastChannel('soulforge-audio')` で claim を送り、受け取った他のページは自分の AudioContext を一時停止する（曲は捨てない。表に戻ってタップすれば claim し直して同じ位置から鳴る）| `14-hud-boot.js`（`claimAudio` / `audioGameStarted`、開始時に `state.started = true` の直後で claim）|
| ② 描画が止まったら一時停止 | `requestAnimationFrame` が 3 秒来ない（見えないのに visibilitychange が来ない WebView）ときに一時停止。描画が戻れば、ゲーム開始後だけ再開。重い処理でスレッドが詰まっただけ（タイマー自体が遅れた）ときは止めない | `14-hud-boot.js` |
| ③ 止めるときにフェード中の古い音源を切る | 止めている間は音の時計が進まずフェードが終わらないので、戻ったときに古い段が一瞬重ならないよう、一時停止のときにフェード中の音源を切る | `audio.js` `suspendAudio` |
| ④ 診断の表示（`?dev=1` のみ）| 左下の 2 行目: 実行環境の大まかな区別（`ios-safari` / `ios-webview` / `ios-other-browser` / `chromium`。userAgent そのものは出さない・保存しない）、`visibilityState`、AudioContext を作った数、BGM の開始 / 停止の呼び出し数、hidden / visible / pagehide / pageshow / 描画停止の回数、**生きている他のページの数（他 n）**、受け取った claim の数、最後の音の状態の変更（例 `suspend:other-instance`）。他のページがあると赤 | `14-hud-boot.js`、`audio.js` `bgmDebugInfo` |
- 本番の画面には何も出ない。ページの区別の ID は乱数で、保存・送信しない（同じ端末の同じ origin のページの間だけ）
- AudioContext を作り直さない。自動再生はしない（再開は、開始後のページが表に戻ったとき・タップしたときだけ。iOS が拒めば次のタップ）

### 制約（正直な限界）
- この修正を含まない**古いビルドのページ**（本番・以前のプレビュー）は claim を受け取らない → 確認の前に閉じる必要がある
- 残ったページの JavaScript が完全に止まっている場合、① ② は届かない。そのときは「他 n」にも数えられない（pong が返らない）。ホストのアプリがページを残しても JS を止める場合は、その音もアプリ側で止まっている可能性が高いが、未確認
- BroadcastChannel は iOS 15.4 以降。無い環境では ① が働かない（表示は「他?」）

## 5. 検証
| 環境 | 確かめること | 方法 |
| --- | --- | --- |
| Chromium | 既存の回帰（タイトル 0・開始後 1・段の切り替え・タイトルへ戻る）、裏 / 表、**2 つのページで後から始めた方が持ち主・前のページは一時停止・タップで持ち主が戻る**、**描画が止まると一時停止・戻ると再開**、通常の URL に表示なし | E2E `bgm-lifecycle`（4 件）・`bgm-regression`・`tavern-bgm`・`audio` |
| iPhone Safari | タイトル・開始・裏・戻り（f9fc4e5 で正常 → 変わらないこと）| Human |
| ChatGPT のアプリ内ブラウザ | 同上 + 閉じて開き直したとき | Human（下の手順）|
| Claude のアプリ内ブラウザ | 同上 | Human |
- アプリ内ブラウザは自動テストできない（ホストのアプリの WebView を Playwright から動かせない）。**Chromium の PASS は iOS 実機での解決の証明ではない**

## 6. iPhone で Human に確かめてほしいこと
1. 準備: Safari のタブ・ホーム画面のアプリ・**ChatGPT / Claude のアプリ**をすべて終了する（アプリを上へスワイプ）。古いビルドのページを残さないため
2. ChatGPT のアプリの中で `https://dashland0638-coder.github.io/-ARPG-/pr/149/?dev=1` を開く。左下の 2 行目の先頭が `ios-webview` か `ios-safari` かを記録
3. タイトル: 1 行目が「BGM 0」、音が鳴らないこと。2 行目の「他0」
4. 始める → 「BGM 1」で音が重ならないこと
5. アプリ内ブラウザを閉じてチャットへ戻る → 音が止まるか（止まらなければ、そのまま次へ）
6. もう一度リンクを押して開く → タイトルで音が鳴らないか。**2 行目の「他 n」と最後の項目**（例 `suspend:other-instance`）を記録（スクリーンショットが一番助かる）
7. 始める → 音が 1 つだけか
8. 同じことを Claude のアプリでも
- 6 で「他1」以上なのに音が重なる、または「他0」なのにタイトルで音が鳴る場合は、表示のスクリーンショットを送ってほしい（次の手がかり: 前のページの JS が止まっている / ホストのアプリの音）

## 7. T-2R-1 の完了の判定
- 自動テスト・Reviewer の後も、**Human の iPhone（Safari・ChatGPT・Claude のアプリ内ブラウザ）での確認まで T-2R-1 は完了にしない**
