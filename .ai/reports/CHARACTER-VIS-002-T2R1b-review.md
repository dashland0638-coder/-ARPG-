# Review: CHARACTER-VIS-002 T-2R-1 追加調査（アプリ内ブラウザの BGM）

- Verdict: **CHANGES_REQUIRED**
- Reviewed SHA: `edac383`（差分 `a6e827e..edac383`）
- Reviewer: 独立 Reviewer（Agent Protocol 2.0）
- 範囲: `src/audio/audio.js`、`src/legacy/parts/14-hud-boot.js`、`tests/bgm-lifecycle.spec.js`、`.ai/reports/CHARACTER-VIS-002-T2R1-inapp-browser.md`、`.ai/tasks/CHARACTER-VIS-002.md`

## 総評
方針（同じ origin の音の持ち主を 1 ページにする BroadcastChannel の claim、rAF の停止の監視、`?dev=1` だけの診断）は Human の制約に合っている。音響の仕組みは作り直しておらず、AudioContext は作り直さず（`ctxCreated` で確認できる）、タイトルでは鳴らさない、Safari の hidden / pagehide の経路は変わらない。診断に識別情報は出ない。ただし、持ち主を決める処理を通らずに音を再開する経路が残っていて、同じ origin で 2 つのページが同時に鳴ることを実機で確かめた（M-1）。直すのは数行で済む。

## Must-fix
### M-1 持ち主の処理を通らない `resumeAudio()` で、claim を受けて止まったページが claim を送らずに鳴り出す → 2 ページが同時に鳴る
- 場所: `src/legacy/parts/13-update-loop.js:148`（`attackInputDown`）、`src/legacy/parts/10-input.js:553`（`tryDodge`）、`src/legacy/parts/08-loot-equipment.js:470`（`usePotion`）。呼び出し元はキーボード（`09-save-load.js:333/341/349`）とゲームパッド（`13-update-loop.js:37/45/50`）。claim を送るのは `14-hud-boot.js:2501` の `pointerdown` だけ
- 再現（Reviewer の一時プローブ、Chromium、同じ context の 2 ページ）: page1 で開始 → page2 で開始（page1 は `suspend:other-instance`）→ page1 を前に出してキー `J` / Space を押す → **page1 も page2 も `running`**。page1 の診断の最後の項目は `suspend:other-instance` のまま（`resumeAudio()` に reason が無いので `last` が更新されない）
- 影響: 「最後に操作したページが持ち主」という設計が崩れ、まさに直したい症状（BGM が重なる）が起きる。さらに `audioSuspendedFor` が `'other-instance'` のまま実際には鳴っているので、このページでは描画停止の監視も働かない（`14-hud-boot.js:2532` の条件 `audioSuspendedFor == null`）。iPhone のタッチ操作では `pointerdown` が先に claim を送るので起きにくいが、キーボード付きの iPad、デスクトップで 2 つのウィンドウを並べた場合、ゲームパッドで起きる
- 直し方の案（どれか 1 つ）: (a) `document` の `keydown` でも `resumeIfPlaying('key')` を呼ぶ。ゲームパッドは、ボタンを押した最初のフレームで同じ処理を呼ぶ。(b) ゲーム中の `resumeAudio()` 呼び出しを、`state.started` なら `audioSuspendedFor = null` にして claim する小さな関数にまとめる。どちらでも、`bgm-lifecycle` の 2 ページのテストに「止まったページでキーを押す → そのページが持ち主になり、もう一方は suspended」を足すこと

## Should-fix
### S-1 表に戻った直後に、古い `lastFrame` のせいで描画停止と誤って判定されることがある
- 場所: `14-hud-boot.js:2484-2489`（`resumeIfPlaying`）、`2524-2535`（監視）
- 裏にいる間は rAF が来ないので `lastFrame` は裏に回る前の時刻のまま。`visible` / `pageshow` で `audioSuspendedFor = null` にした後、最初のフレームより先に監視の interval が来ると、`now - lastFrame > 3000` で `render-stopped` として一時停止し、次のフレームで `resume('render')` と claim を送る。WebKit では戻った直後の最初のフレームが数百 ms 遅れることがあり、ちょうど resume の途中で suspend → resume が挟まる（R2-N2 の「戻った直後に無音」と区別しにくくなる）。E2E は `visibilityState` を差し替えるだけで rAF は止まらないので、このケースは検出できない
- 案: `resumeIfPlaying` と `audioGameStarted` で `lastFrame = performance.now()` に戻す（または、続けて 2 回止まっていたら一時停止にする）

### S-2 2 ページのテストで「タイトルのページは持ち主を奪わない」ことを確かめていない
- 場所: `tests/bgm-lifecycle.spec.js:141` 付近
- page2 がタイトルにいる間、page1 が `running` のままであることを確かめていない。page2 のタイトルでタップしても page1 が止まらないこともテストしていない。いまのコードは正しい（`!state.started` で早く抜ける）が、回帰を防ぐために 2 行足すのがよい。M-1 のキー入力のケースも合わせて足す
- なお、新しい 2 件は機能を外すと落ちる。claim が無ければ page1 は `running` のまま、監視が無ければ `suspended` にならない。コードを読んで確認した

### S-3 報告の記述が実装と合っていない
- `.ai/reports/CHARACTER-VIS-002-T2R1-inapp-browser.md:53`「再開は、開始後のページが表に戻ったとき・タップしたときだけ」→ 実装では、描画が戻ったとき（rAF のコールバック、ユーザーの操作ではない）にも再開する。攻撃・回避・回復薬・設定のボタンからの再開もある（M-1）
- 同 `:48`「最後に始めた・戻った・タップしたページ」→ 描画が戻ったときにも claim を送る（`14-hud-boot.js:2530` → `resumeIfPlaying` → `claimAudio`）。M-1 を直した後の実装に合わせて書き直すこと

## Note
- N-1 描画の停止による誤判定（重い処理の場合）: 2.0〜2.95 s の同期処理でメインスレッドを止めるプローブを各 3 回行い、Chromium では誤判定は 0 件（長い処理の後は、タイマーより先に描画が走る）。計算の上では、interval が 3 s 未満だけ遅れ、そこまでの rAF も来ていない場合に誤判定しうる。WebKit の順序は未確認。起きても suspend → 次のフレームで resume だけで、壊れはしない
- N-2 描画が戻ったときの claim で持ち主が逆転しうる: `render-stopped` のページ A が、その後 B の claim を受け取らないまま描画が戻ると、A が claim して、ユーザーが使っている B が止まる（B はタップで戻る）。A の JS が凍結されていてメッセージの順序が前後した場合などで、理論上のみ。Human の確認で「操作中のページが急に無音」が出たら、これを疑う
- N-3 iOS のジェスチャー: 描画が戻ったとき・`visible` のときの `resume()` はユーザーの操作の外で呼ばれる。一度ユーザーの操作で開始した context の再開なので自動再生の規則に反しないが、拒まれた場合は次のタップに頼る（既存の方針と同じ）。iPhone で要確認
- N-4 claim を受け取った**タイトルのページ**: AudioContext が suspended になり、開始の `resumeAudio()`（`14-hud-boot.js:2389`）で戻る。開始の流れは「resume → buildWorld → `state.started = true` → claim（`2409`）」で正しく、二重に始まることも無い。タイトルにいる間は、そのページの UI の効果音が鳴らないことがある（タッチでは `pointerdown` で再開しない）。影響は小さい
- N-5 `suspendAudio` でフェード中の音源を切る処理（`audio.js:108`）: クロスフェードの途中で一時停止すると、古い段は即座に切られ（gain 0）、新しい段は途中の音量から立ち上がりの続きを再生する（戻った直後に一瞬音量が下がる）。いつでも最大 2 音源、`bgmCurrent` は残る、という不変条件は保たれる。`bgm-regression` / `tavern-bgm` も PASS
- N-6 診断のプライバシー: `uaKind()` が出すのは区分だけ。インスタンス ID は乱数で、表示・保存しない。ping は `DEV_UI` のときだけ。pong は本番のページも返すが、中身は乱数の ID だけで画面には何も出ない。問題なし
- N-7 2 つの見えているページの間で claim が往復し続けることは無い。claim を送るのは自分のページのイベント（開始・visible・pageshow・tap・描画が戻ったとき）だけで、受け取った側は送り返さない。テストの最後（page2 が suspended のまま）でも確認できる
- N-8 任務と報告の扱いは正確: 「Chromium の PASS は iOS での解決の証明ではない」「T-2R-1 は完了にしない」「Human の確認の手順」が書かれ、FACT / INFERENCE が分けられている

## Human の iPhone で確かめること（残り）
- Safari での回帰が無いこと。ChatGPT / Claude のアプリ内ブラウザで閉じてから開き直したときに、「他 n」が出て音が止まるか（報告 §6 の手順）
- S-1 / N-3: 戻った直後に、一瞬止まってからまた鳴る・無音のまま、ということが無いか

## 実行したテスト（使い捨ての worktree `edac383`、Vite は 5291 番ポート、5173 / 4173 は使っていない。終わった後に worktree は削除）
| 対象 | 結果 |
| --- | --- |
| `bgm-lifecycle`（5）・`bgm-regression`（3）・`tavern-bgm`（9）・`audio`（1） | 18 passed |
| `npm run test:unit` | 2338 pass / 0 fail / 4 skipped |
| `chapter1-progression`・`road2-join`・`character-motion` | 28 passed（11.0 分）。監視によるエラーなし |
| Reviewer の一時プローブ（commit していない） | 重い処理による誤判定 0 件（N-1）。キー入力で 2 ページが同時に `running` を再現（M-1） |
