# UI-002-H PR #90 Minor 1 / Minor 2 修正 再レビュー

- Reviewer: 独立 Reviewer(Agent Protocol 2.0)
- 対象: PR #90 `claude/chapter-1-comprehensive-audit-6cul2d`
- 前回 head: `49aa318`(pre-merge review: YES / Minor 1・Minor 2)
- **確認した head: `258ec746bc72d5139ba735cb0ea5ce6ca9978227`**(`git rev-parse HEAD` で一致を確認)
- 差分: `git diff 49aa318..258ec74`(5 files, +131 / -13)
  - `src/core/build-check.js` / `src/legacy/concat-plugin.js`(import 追加のみ) / `src/legacy/parts/14-hud-boot.js` / `tests/production-build.spec.js` / `tests/unit/build-check.test.js`
- 実行: `npm run build` 成功、`npm run test:unit` 1878 件中 pass 1877 / fail 0 / skip 1(skip は既存の「SVG catalog がこの checkout に無い」で本差分と無関係)
- Playwright は指示により未実行(Orchestrator 報告: production-build 5/5、ロジックを戻すと新 E2E 2 件が失敗することを確認済み)

## 判定: **PASS WITH NOTES**

両 Minor とも要件を満たしており、マージを妨げる問題は無い。以下の Notes はいずれも任意対応。

## Minor 1(新旧交互配信での往復 reload)の確認

- `buildCheckAction` は `reloadedFor` が truthy なら(どの remote build でも)`'none'`。`checkForNewerBuild` は `reloadMarker(location.search)` があれば fetch 自体をしない。→ 自動 reload は「印の無いページ」からの 1 回のみに構造的に限定される。
- cookie / storage 不使用。既存の `?build=` URL 印の設計をそのまま強めただけで最小。
- fetch 失敗(`.catch`)・`r.ok` でない・`build` が非文字列/空 → `'none'`。印の付いたページではそもそも fetch しない。繰り返しは起きない。
- 単体テスト: `[local, remote]` の交互列を回して reload 回数 = 1、印付きページでは `A/B/別build/null/''/42/undefined` すべて `'none'` を確認。E2E は version.json を `fffffff`/`eeeeeee` 交互で返し、reload 後の visibilitychange で fetch 回数が増えないことまで見ている。妥当。

## Minor 2(タイトル以外の開始前画面での reload)の確認

- `titleScreenIdle()` = `!started && #title-screen.style.display==='flex'` かつ `#testmode-screen` 非表示・`#confirm-overlay.active` 無し・`state.activeOverlay==='none'`・`!state.dialogueActive`。
- タイトルから到達できる画面を洗い出した:
  - テストモード(`#open-testmode-btn` → title を `none`、testmode を `flex`): 両条件で除外される。
  - 「はじめる」(セーブあり時)の `askConfirm` → `#confirm-overlay.active` で除外。
  - メニュー(`toggleMenu` は started を見ないので Esc/ゲームパッド Start でタイトル上でも開き得る)→ `activeOverlay==='menu'` で除外。appraisal/scenario も `activeOverlay` で除外。
  - 「はじめる」/「つづきから」→ `finishEnteringGame` が同期的に title を `none` にし `started=true`。非同期の隙間は無い。
  - `returnToTitle()` は `started/dialogueActive/activeOverlay` をリセットし各 overlay を閉じてから title を `flex` にする → 戻った後は正しく idle 判定になる。
  - `#rotate-overlay`(縦向き警告)は対象外だが、選択状態を持たないので reload しても失うものは無い。問題なし。
  - 取りこぼしは見つからなかった。
- 判定タイミング: `onTitle: titleScreenIdle()` はレスポンス到着時に評価される(fetch 中に開始/画面遷移した場合も reload しない)。
- 起動順: `bindSettings()` 内で `checkForNewerBuild()` → fetch 開始。直後の同じ同期ブロックで `#title-screen` を `flex` にしており、fetch の resolve は必ずその後(マイクロタスク以降)。初回起動の reload は従来どおり動く。`refreshContinueBanner` 等が例外を出して title が `flex` にならない場合は reload しないが、安全側なので可。
- visibilitychange は `titleScreenIdle()` を throttle 更新より前に判定するため、職業選択中の復帰で 30 秒の throttle を消費しない(E2E 後半の「戻ってから 1 回 reload」が成立する理由でもある)。
- プレイ中・会話・カットシーン・戦闘・リザルト・ダウン: `started` / `dialogueActive` / title 非表示のいずれかで従来どおり reload しない。

## 回帰・無関係変更

- 開発サーバー: `appBuildId()==='dev'` の早期 return は不変。影響なし。
- 表示: `versionLabel` 不変。
- 差分は上記 5 ファイルのみ。中央メッセージ削除・残す通知・execute ボタン/条件・セーブ形式・Chapter 1 進行には一切触れていない。
- テスト: skip/retry/`.only` の追加なし。E2E の旧アサーション「同じ build への読み直しは 1 回だけ」は「読み直しは最大 1 回」+ fetch 回数不変に置き換わり、強化されている。

## Findings(Notes)

1. **[Note / テスト] 既存の否定系単体テストが `onTitle` 未指定のため空振りしている。**
   `tests/unit/build-check.test.js` の「同じ build・…・読み直し済み・プレイ中は読み直さない」の `reloadedFor` / `started:true` の 2 行と、「読み直しても古いビルドのままなら…」は `onTitle` を渡しておらず、新しい `onTitle !== true` ガードだけで `'none'` になる。対象の分岐を単独では検証していない。ただし同じ観点は新テスト(印付き + `onTitle:true`、`started:true` + `onTitle:true`)で押さえられているので実害は無い。次に触れる時に `onTitle: true` を足すと良い。
2. **[Note / トレードオフ] 1 回 reload した後のページでは、以後の新ビルドを検出しない。**
   iOS のホーム画面アプリはバックグラウンド復帰で `?build=` 付きのページのまま再開するため、次の公開はアプリを完全に終了して開き直す(`start_url` に印なし)まで拾われない。Safari のタブ/ブックマークで印付き URL が残る場合も同様。ただし (a) Minor 1 の要件「最大 1 回・storage 不使用」と両立する最小の設計であること、(b) 失敗方向が「古いビルドが続く」=従来挙動であり往復 reload より遥かに安全なこと、(c) 公開頻度に対して 1 回目の reload で最新に揃うのが通常ケースであること、から**許容できる**と判断する。改善するなら、印の値と異なる新 build を「一定時間経過後のみ」許す等が考えられるが、時間ベースの状態保持には storage が要るため現時点では推奨しない。
3. **[Note / コメント] `reloadUrl` テストの「古い印が残っていても新しい build へ 1 回だけ」というコメント**は、印付きページから reload しなくなった現在の挙動では到達しない経路の説明になっている。`reloadUrl` 単体の上書き仕様としては正しいので、テスト自体は残してよい。

Human Decision: None(Note 2 のトレードオフは許容と判断)
