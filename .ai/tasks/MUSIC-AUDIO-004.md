# MUSIC-AUDIO-004

Status: REVIEWING（Reviewer PASS。PR 作成後に DONE。main への merge は Human）

Analysis: 本ファイルの「## Analysis」（branch `claude/cc0-sample-audio-engine-76noqo` @ `2089a88`）

## Approval
- [x] Approved
- Approval type: Agent Approval（`../AGENTS.md` §6.1）
- Escalation Check: None（方式 A は Human の Goal が第一候補として指定。既存実装に合う）
- Approved by / date / where: Planner (Agent) / 2026-10-12 / branch `claude/cc0-sample-audio-engine-76noqo`
- Scope of approval: `tools/music-composer/sample-hooks.js`・`tools/music-composer/README.md`・`tests/music-sample-engine.spec.js`・この Task file
- Persistence: 許可（branch: `claude/cc0-sample-audio-engine-76noqo`、根拠: セッションの割当。PR #71 は merge 済みのため `main` @ `2089a88` から作り直した）

## Goal
サンプル音源の読み込みが終わる前に再生ボタンが押されたときの挙動を決め、意図しない合成音での再生を防ぐ。

## Constraints
- v5.67.0 を変えない。本体版への統合・既定オン化はしない
- 譜面イベント・音符・音量・楽曲データを変えない
- main へ直接コミットしない。merge は Human の承認

## Analysis
| # | 調べたこと | 結果（`main` @ `2089a88`） |
| --- | --- | --- |
| A-1 | 合成音になる経路 | `sample-hooks.js` の `route()` は `S.isReady(name)`（その楽器の収録音が1つも読めていない）なら `false` を返し、呼び出し側が合成音を鳴らす。`playTrack` は読み込みを待たない（`refresh()` を呼ぶだけ）。読み込み前に押すと全部合成音（酒場完成版で サンプル 0 / 468） |
| A-2 | stats.fallback が数えない原因 | 数えるのは `played()` だけで、`route()` は `isReady` が偽のとき `played()` を呼ばずに返る。楽器の一部だけ読めている場合（`S.play()` が null）は fallback に入るが、「読み込み前」と「失敗」を区別しない |
| A-3 | 再生ボタン | `$("play").onclick = ()=>state.playing ? stopAudio() : playTrack()`。`playTrack` は呼ぶ時点の全域関数（フックが効く）。`$("stop").onclick = stopAudio` は起動時の元の関数を直接持つ（フックを通らない）。どちらの停止も `playbackToken` を進める |
| A-4 | 連打 | 読み込みを待つようにすると、待っている間は `state.playing` が偽なので、再押下で `playTrack` がもう一度呼ばれる |
| A-5 | 曲の変更 | `generate()` は `state.track` を差し替え、`renderEdit` のフックが新しい曲の読み込みを始める（`refreshing` が別の job になる） |
| A-6 | セル試聴 | `previewScoreEvent` は待たない。通し再生の開始時に `stopPreviews()` |
| A-7 | iPhone Safari | AudioContext はボタン操作の中で作る・再開する必要がある（`ensureAudio()`）。待った後に初めて作ると鳴らない恐れ |
| A-8 | 読み込み失敗 | `ensure()` は失敗しても reject せず、`status()` は `failed` / `partial`。待つ条件を「`loading` が無い」にすれば失敗で止まらない |

## Plan（方式の比較）
| 観点 | A: 読み込み完了まで待つ | B: 合成音で始めて明示する |
| --- | --- | --- |
| 意図しない合成音 | 防げる | 防げない（明示するだけ） |
| 既存仕様 | 「サンプル」を選んだ利用者にサンプルで聞かせる。合う | 1回目だけ別の音色になる |
| iPhone Safari | 押した時点で AudioContext を作れば、待った後も鳴る（実機は未確認） | 問題なし |
| 連打・停止 | 待ちを1つに限り、停止で取りやめる処理が要る | 既存のまま |
| 読み込み失敗 | 失敗は `loading` でないので待ちが終わり、既存の合成音に戻る | 既存のまま |

推奨・採用: **A**。待ち時間の上限（15 秒）を超えたら始め、間に合わなかった音は合成音で鳴らして `unloaded` に数える（ネットワークが止まったときに再生できなくなるのを防ぐ）。

## Implementation
`tools/music-composer/sample-hooks.js` だけ（エンジン・HTML・音源・楽曲データは変更なし）。
- `playTrack` のフック: 要る収録音に `loading` があれば、`ensureAudio()` を呼んでから待つ。ボタンは「… 読み込み中」、「音源」カードは「読み込みが終わったら再生します」。待ちの間の再押下は無視。待ち終わりに `playbackToken`・`state.track`・サンプルの有効を比べ、停止・曲の変更・合成音への切り替えがあれば始めない。上限 15 秒
- 統計: `stats.unloaded` を追加。合成音で鳴った音を、再生開始時の状態が `loading` なら `unloaded`、それ以外（失敗）なら `fallback` に数える。`isReady` が偽で合成音になった音も数えるようにした（これまで数えていなかった）。「計測」欄に「読み込み前で合成音 N音」
- 検証用: `SampleHooks.waiting()`、`SampleHooks.setWaitLimit(ms)`
- README の「使い方」に挙動を追記

## Test Result
| テスト | 結果 |
| --- | --- |
| 新規 E2E（`MUSIC-AUDIO-004 読み込み中の再生`、6 件） | PASS: 読み込み前の再生と連打（待ってから全部サンプルで1回だけ） / 読み込み中の停止（後から始まらない、その後の停止 → 再生で重複なし） / 読み込み中の曲の変更 / 読み込み失敗（合成音、fallback に数え unloaded は 0） / 上限超過（unloaded に数え表示） / 読み込み中のセル試聴 → 通し再生 |
| 既存 E2E `tests/music-sample-engine.spec.js`（21 件） | PASS |
| music E2E 全 27 件 × 3 回（`--repeat-each=3`） | 81 / 81 PASS |
| music E2E 全 27 件（コメント・README の修正後の1回） | **FLAKY: 26 passed / 1 failed**。出力の末尾行しか残しておらず、失敗したテスト名と内容は不明 |
| 同 × 1、× 5（retries 1）、× 10 | 27 / 27、135 / 135（retry なし）、270 / 270 PASS。失敗は再現しない |
| `npm run test:unit` | 1782 pass / 0 fail / 1 skipped（skipped は変更前から） |
| `npm run build` | PASS |
| ゲーム側の E2E | NOT_RUN（ローカル。ゲームのファイルに変更なし。CI で実行） |
| iPhone Safari 実機 | NOT_RUN（待った後に音が出るか・ボタン表示は実機で未確認） |

テスト用の一時スクリプトはリポジトリに置いていない。

## Review
Verdict: **PASS**（同一セッションで兼務。人間による差分確認を推奨）

| 観点 | 結果 |
| --- | --- |
| 変更範囲 | `sample-hooks.js`・README・E2E・Task file。v5.67.0〜v5.70.0 の HTML・エンジン・音源・楽曲データに差分なし |
| 合成音モード | `mode.enabled` が偽なら元の `playTrack` をそのまま呼ぶ。E2E「試作の合成音モードは基準 v5.68.0 と同じ」PASS |
| 読み込み済みの再生 | 待たずに同期で始まる（既存 E2E が `playTrack()` 直後に数えて PASS） |
| 統計の意味の変化 | `fallback` に「楽器の収録音が1つも読めていない（失敗）」が加わる。既存 E2E の fallback 0 の条件は変わらず PASS |

## Risks
- iPhone Safari で、押した時点に作った AudioContext が待った後も鳴るかは未確認
- 上限 15 秒は仮の値（遅い回線での実測なし）
- music E2E で1回だけ失敗があった（テスト名不明・未再現）。原因が今回の変更かどうかは分からない

## Rollback
この PR を revert する。

## Out of Scope
本体版への統合・既定オン化、iPhone 実機の確認、FLAKY の調査。

## Autonomy Metrics
- Human Escalation Count: 0
- Human Decision Count: 0
- Auto Fix Count: 2（新規 E2E の前提の誤り: 全部読んだ状態では待ちが起きない → 曲に要る音だけ読む / ピアノの試聴は別の層 → フルートで試聴）
- Reviewer Round Count: 1
- Test Retry Count: 1（music E2E の1回で1件失敗。テスト名不明・未再現。その後 432 件連続 PASS。既知の FLAKY〔MUSIC-AUDIO-001〕と同じかは不明: INFERENCE は記録しない）
- PR Created: Yes（本文に URL）

## Status History
| Date | Target | From → To | By | Note |
| --- | --- | --- | --- | --- |
| 2026-10-12 | Task | DRAFT → ANALYZING → APPROVED | Analyzer / Planner | A-1〜A-8。方式 A を採用。Agent Approval |
| 2026-10-12 | Task | IMPLEMENTING → TESTING → REVIEWING | Implementer / Tester | 新規 E2E 6 件、music E2E 81/81、unit PASS |
| 2026-10-12 | Task | REVIEWING（Reviewer PASS） | Reviewer | 指摘なし。music E2E の1回の失敗（テスト名不明・未再現）を FLAKY として記録 |
