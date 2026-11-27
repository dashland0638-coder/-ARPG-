# CHARACTER-VIS-002 T-2R-1 Review（BGM: 裏に回ったら一時停止・?dev=1 の BGM の数の表示）

## Review Target
| 項目 | 値 |
| --- | --- |
| Task ID | CHARACTER-VIS-002 / T-2R-1 |
| Branch | `claude/character-vis-002-t2` |
| Reviewed SHA | `a51c40fdef074e5ad9335bf6adefabbf9addb32f` |
| Diff range | `e3aeffd..a51c40f` |
| Handoff Verification | V-5 **未充足**（Task の T-2R-1 行が「下の Implementation Result（T-2R-1）」を参照しているが、a51c40f の Task file にその節が無い）。他は Diff と DEC-038 から確認 |
| Decision | DEC-038 H-3、`.ai/reports/CHARACTER-VIS-002-T2-human-review.md` §7 |

## Result
**CHANGES_REQUIRED**

## Independence
別 Agent・別セッション（独立 Reviewer）

## 要旨
方針（suspend / resume のみ、音響の仕組みは作り直さない、タイトルは無音、dev だけの表示、E2E と iPhone の範囲を分ける）は DEC-038 H-3 に沿っている。既存の E2E は全て通り、新しい E2E は修正を外すと落ちる（効いていることを確認）。ただし「戻る → すぐ裏に回る」で **suspend が飛ばされ、裏で鳴り続ける競合** を Chromium で再現した。これは H-3 の目的そのもの（裏に回ったら止める）を破るので must-fix。あわせて Implementation Result の欠落（V-5）。

## Findings

### must-fix

**M-1. resume の完了前に裏に回ると suspend されず、裏で鳴り続ける** — `src/audio/audio.js:99-101`（`suspendAudio`）、`src/audio/audio.js:86`（`resumeAudio`）
- `suspendAudio()` は `audioCtx.state === 'running'` の時だけ `suspend()` を呼ぶ。`resume()` を呼んでから promise が解決するまで `state` は `'suspended'` のまま（Chromium で確認）。
- 再現（Chromium、素の AudioContext で本実装と同じ条件分岐）: suspended → `resume()`（visible / pageshow / pointerdown）→ その直後に hidden → `state==='running'` ではないので suspend を呼ばない → 300ms 後の状態 **`running`（裏で鳴る）**。
  - 結果: `{"preB":"suspended","afterResumeCall":"suspended","caseB_final":"running"}`
- iOS では resume の解決が遅い（割り込みからの復帰は特に）ので、アプリスイッチャーを開きかけて戻る・すぐ別のアプリへ、などで起こりうる。DEC-038 H-3「裏に回ったら音を一時停止」に反する。
- 同じ理由で iOS の `'interrupted'` の間に裏に回った場合も suspend されない（割り込みが終わると WebKit が自動で running に戻すことがあり、裏で鳴りうる）。
- 期待する状態: `suspendAudio()` は `audioCtx && audioCtx.state !== 'closed'` なら常に `suspend()` を呼ぶ（WebAudio は suspend / resume を呼んだ順に処理するので、最後の呼び出しが勝つ）。Chromium で確認: `resume(); suspend();` → `suspended`、`suspend(); resume();` → `running`。
  - 逆向き（suspend の解決前に戻る）は Chromium では state が同期的に `suspended` になるので問題にならなかったが、実装依存。resume 側も「ページが止めた」フラグで判定するか、`state !== 'running'` を条件にするとより堅い（should-fix 相当、M-1 と一緒に直すのが安い）。
- 確認方法: `tests/bgm-lifecycle.spec.js` に「開始後、1 回の `page.evaluate` の中で visible → hidden を続けて送る → `suspended` になる」を足す（現状の実装では落ち、修正後に通ること）。

**M-2. Implementation Result（T-2R-1）が無い（V-5）** — `.ai/tasks/CHARACTER-VIS-002.md:88`
- T-2R-1 の行は「IMPLEMENTING（下の Implementation Result（T-2R-1）…）」と書くが、その節が存在しない。Test Report・Changed Files・iPhone 実機の確認手順（Human 向け: 古いタブ / ホーム画面のアプリを閉じてから確認する、?dev=1 の左下表示の読み方）の記録が無い。
- reviewer.md の手順では Handoff 不備（BLOCKED）に当たる。Orchestrator が補完すれば Round には数えない（AGENTS.md §5.1）。
- 期待する状態: Implementation Result（T-2R-1）を追加。「iOS の重複は未確認、修正完了とは断定しない」を明記（DEC-038 H-3）。また **この修正は新しいビルドにしか入らない**ので、iPhone に残っている古いビルド（以前の PR プレビュー・ホーム画面のアプリ）のタブは鳴り続けうること、確認前に閉じることを手順に書く。

### should-fix

**S-1. ?dev=1 の表示が iPhone 横持ちで角・ホームインジケータに隠れうる** — `src/legacy/parts/14-hud-boot.js:2484-2485`
- `index.html:5` は `viewport-fit=cover`。`left:4px; bottom:4px` は safe-area を考えていないので、横持ちの iPhone では左下の角の丸み・ノッチ側の inset・ホームインジケータの下に入る。この表示の目的は「iPhone で目で確かめる」なので読めないと意味が無い。
- 期待する状態: `left:calc(4px + env(safe-area-inset-left)); bottom:calc(4px + env(safe-area-inset-bottom))`。
- なお `.joy-base`（left 56px / bottom 56px、`src/styles/main.css:870`）とは重ならず、`pointer-events:none` なので `#joy-zone` のタッチも妨げない（`elementFromPoint` も pointer-events:none の要素を返さない）。

**S-2. E2E が競合と未カバーの経路を確かめていない** — `tests/bgm-lifecycle.spec.js`
- M-1 の連続切り替え（上記）。
- タイトルで裏 → 戻った後の **タップ**（pointerdown）で再開しないこと（最後のブロックは pageshow の後に状態を見るだけで、クリックを送っていない。冒頭のタイトルでのクリックは裏に回る前）。
- タイトルで裏 → 戻った後に「つづきから」で開始すると running・BGM 1 に戻ること（開始の経路 `14-hud-boot.js:2389` の resumeAudio に依存している）。
- `pagehide` の経路は送っていない（visibilitychange と同じ関数なので軽微）。
- `setVisible(page,false)` 直後の `expect(await bgmCount(page)).toBe(1)`（:60）は 500ms ごとの表示を読むので古い値でも通る。`expect.poll` か `bgmDebugInfo` を直接読む形が望ましい（期待値自体は緩めていない）。

### note

- N-1. `pointerdown` での再開（`14-hud-boot.js:2475`）は `state.started` と visible で守られており、タイトルでは再開しない。ポーズメニュー中は元々 BGM を止めていない（ポーズで suspend する処理は無い）ので、メニュー操作で再開しても挙動は変わらない。キーボード / ゲームパッドは既存の `attackInputDown` / `tryDodge` / `usePotion` が無条件に `resumeAudio()` を呼ぶので、iOS で resume が拒まれた後もタップ以外で復帰できる。
- N-2. 既存の visibilitychange（`02-world-common.js:114` の onResize、`09-save-load.js:294` の saveGame、`14-hud-boot.js:368` の checkForNewerBuild）とは独立したリスナーで、互いの状態に触れない。干渉なし。
- N-3. 手続き生成の BGM は `ctx.state !== 'running'` の間イベントを作らない（`procedural-bgm.js:165`）ので、suspend 中に音が溜まって復帰時に一斉に鳴ることは無い。デコード済みの曲は同じ位置から続く。クロスフェード中に裏に回った場合、古い声部は setTimeout の保険（`killVoice`）で切られる（壁時計なので裏でも切れる）ので重複は残らない。
- N-4. SFX / 環境音: suspend 中に `sfx()` が呼ばれると凍った `currentTime` に予約され、復帰時にまとめて鳴りうる。裏では rAF が止まるので実害はほぼ無い。
- N-5. `<audio>` の代替（WebAudio が無い環境のみ）: pause して `pendingBgmEl` に入れ、`resumeAudio()` で再生。タイトルでは `stopBgm()` が `bgmEl` / `pendingBgmEl` を消すので、タイトルのクリックで代替が鳴り出すことは無い。iOS は WebAudio があるのでこの経路は通らない。
- N-6. 既存の E2E が DOM を列挙する箇所（`action-zone.spec.js:123` の `body *` で「NN%」を探す）は表示の文言「BGM 1 tavern …」に一致しない。action-zone / hud-zones-layout を実行して通過を確認。
- N-7. 表示の `setInterval(tick, 500)` は ?dev=1 の時だけ。本番 URL には出ない（E2E で確認）。
- N-8. `.ai/decisions/DEC-038` と Task の記録は「iPhone 実機の確認は Human」「修正完了と断定しない」を守っている（M-2 の欠落を除く）。

## Tests（独立 worktree、Vite 開発サーバー port 5391、共有の 5173/4173 は不使用）
| テスト | 結果 |
| --- | --- |
| `npm run test:unit` | 2342 件: pass 2338 / fail 0 / skipped 4 |
| `tests/bgm-lifecycle.spec.js` `tests/bgm-regression.spec.js` `tests/tavern-bgm.spec.js` `tests/audio.spec.js` | **16 passed**（3.9m）|
| `tests/action-zone.spec.js` `tests/hud-zones-layout.spec.js`（?dev=1 の表示が常に出るため追加で実行）| **19 passed**（4.7m）|
| 変異確認: `bindAudioLifecycle()` の呼び出しを外して `bgm-lifecycle` の 1 本目 | **failed**（`Expected: "suspended" / Received: "running"`）→ E2E は修正の効果を実際に検出する |
| 競合の再現（Chromium、素の AudioContext、本実装と同じ条件分岐）| resume 直後に hidden → `running`（M-1）。`state !== 'closed'` で suspend すると `suspended` |

worktree は削除済み。`/home/user/-ARPG-` は変更していない。

## Required Changes
| # | ファイル / 箇所 | 問題 | 期待する状態 | 確認方法 |
| --- | --- | --- | --- | --- |
| 1 | `src/audio/audio.js:99-101` | resume の解決前・'interrupted' の間に裏に回ると suspend されない（DEC-038 H-3 違反、Chromium で再現）| `state !== 'closed'` なら常に `suspend()`（resume 側の条件も合わせて見直すと堅い）| bgm-lifecycle に visible→hidden 連続送信のケースを追加し、修正前に落ち・修正後に通る |
| 2 | `.ai/tasks/CHARACTER-VIS-002.md` | 参照先の Implementation Result（T-2R-1）が無い（V-5）| Test Report・Changed Files・iPhone 手順（古いビルドのタブ / ホーム画面のアプリを閉じる、表示の読み方）、「未確認・完了と断定しない」を記録 | Task file を読む |
| 3（should）| `src/legacy/parts/14-hud-boot.js:2484` | 表示が safe-area を考えず iPhone 横持ちで隠れうる | `env(safe-area-inset-left/bottom)` を足す | 844×390・safe-area の E2E で表示が画面内・inset の内側 |
| 4（should）| `tests/bgm-lifecycle.spec.js` | タイトルで裏→戻り後のタップで再開しない／その後の開始で 1 に戻る、が未確認。:60 は古い表示でも通る | ケース追加、poll 化 | E2E |
