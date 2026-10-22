# CH1-COMP — Chapter 1 Comprehensive Improvement（第一章 総合改善）

Status: PR_OPEN（W1-1・W1-3・W2-T1。Reviewer PASS。実機確認は HUMAN DEVICE CHECK REQUIRED。他の Work Item は PLANNED）

Analysis: .ai/reports/CHAPTER-1-comprehensive-improvement-audit.md（branch `claude/chapter-1-comprehensive-audit-6cul2d`、base `origin/main` `afe234e`）
Plan: .ai/reports/CHAPTER-1-comprehensive-improvement-plan.md（Work Item ごとの目的・範囲・非対象・受け入れ条件・テスト・リスク）
Decision: .ai/decisions/DEC-007-chapter1-comprehensive.md（HD-1〜HD-7、2026-10-15）

## Goal

第一章を重点的に完成させる。採用方針は次のとおり（Human の依頼、2026-10-14）。

- 戦闘: アクションと戦術の融合。予備動作が分かりやすく、学習と上達を実感できる難易度。
- グラフィック: リアル寄りトゥーン。
- キャラクター: かわいさと職業の個性を保つ。

## Constraints

- `basefile.html` を変えない。`src/legacy/parts/` の連結構成を ES Module にしない。
- セーブの互換を保つ。形式・`scenarioClears`・交代の順番・進行の条件を変えない。
- 第一章に成長要素を入れない。
  - Level / XP
  - スフィア盤
  - パッシブ
  - 自由なスキル構成
  - 鍛冶の強化・クラフト
  - ランダム装備
- テストモード（`?dev=1`）と通常プレイを分ける。
- 敵・ボスの HP と攻撃力は、承認なしに変えない。
- 完成の判定は、E2E の PASS と、Human の iPhone 実機による通しプレイ。CONTENT READY = HUMAN DEVICE CHECK REQUIRED。

## Work Items（着手順。DEC-007）

| 順 | ID | Summary | 優先度 | Status | Approval | 依存 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | W1-1 | 移動中・戦闘中にサポートを見続ける首の追従を直す（会話中は維持） | P1 | PR_OPEN（Reviewer PASS） | [x] Human 2026-10-15 | ― |
| 2 | W1-3 | 通常コンボの「✨ フィニッシュ!」を出さない（重要な通知は残す） | P1 | PR_OPEN（Reviewer PASS） | [x] Human 2026-10-15 | ― |
| 3 | W2-T1 | 戦闘改修前のベースライン測定（宵待ちの村のボス戦） | P1 | PR_OPEN（Reviewer PASS） | [x] Human 2026-10-15 | ― |
| 4 | W2-D | 村のボス戦の試作の設計（数値・仕組みの提案） | P1 | DESIGN（`.ai/reports/CH1-COMBAT-PROTO-design.md`。Human の判断待ち） | [ ] Human の承認が必要 | W2-T1 |
| 4a | W2-T2 | 現行コード（`1205665`）でのベースライン再測定と、通常プレイの生存可能性の評価（測定だけ。ゲームは変えない） | P1 | DONE（PR #92 merged `e5d3464`、2026-10-20。iPhone 実機確認は HUMAN DEVICE CHECK REQUIRED） | [x] Human 2026-10-19（依頼文） | W2-T1 |
| 4b | W2-4a | 村のボスの段階移行の爆発に予兆（0.8 秒・足元の円）を付ける（`CH1-COMP-W24a.md`。残響の円は含めない） | P1 | DONE（PR #94 merged `1801f05`、2026-10-20。Human の受け入れ確認で ACCEPT。iPhone 実機確認は HUMAN DEVICE CHECK REQUIRED） | [x] Human 2026-10-20（依頼文） | W2-D |
| 4c | W2-MB | 宵待ちの村のボス直前の中ボス（記憶漁師・水門守の残響）の攻撃の分かりにくさの調査（調査のみ。`CH1-COMP-W2MB.md`） | P1 | DONE（PR #93 merged `8fd69cb`、2026-10-20。調査のみ） | [x] Human 2026-10-20（依頼文） | ― |
| 4d | W2-MB1 | 記憶漁師の近接に予兆（溜め＋足元の円）、網の輪を判定の範囲に合わせる（`CH1-COMP-W2MB1.md`。水門守は W2-MB2） | P1 | DONE（PR #96 merge `15fe597`。iPhone 確認は未） | [x] Human 承認 2026-10-20（溜め 0.5 秒・パニッシュ窓なし・観測の灯で伸ばさない） | W2-MB |
| 4e | W2-MB2 | 水門守の残響の本体と「引いた」残響に攻撃範囲の予兆（足元の円）（`CH1-COMP-W2MB2.md`） | P1 | DONE（PR 作成。branch `claude/ch1-comp-w2-mb2-keeper-telegraph`。iPhone 確認は未） | [x] Human 指示 2026-10-22（数値は変えない） | W2-MB |
| 5 | W0-5 | アートの完成見本の提示（見本の制作は村のボス戦に限り HD-4 の範囲。実装の開始は指示待ち。画像と全マップ展開は Human の承認が必要） | P2 | PLANNED | [ ] Human の承認が必要 | W0-3, W3-0（制作: W2-2・W3-1・W3-2 の村の範囲） |
| 5 | W0-6 | 出撃会話の台詞の候補の提示 | P1 | PLANNED | [ ] Human の承認が必要 | ― |
| 6 | W1-2, W1-4, W1-5, W2-1a〜W2-6, W3, W4, W5 | 計画のとおり | ― | PLANNED | 承認後に個別の Task にする | 計画を参照 |

各 Work Item は着手のときに個別の Task として起こし、次の順で進めて小さな PR に分ける。`main` へは merge しない。

1. Analyzer
2. Planner
3. Implementer
4. Tester
5. 独立 Reviewer

## Status History

- 2026-10-14: 監査・計画（PLANNED）。独立 Reviewer の判定は Round 1 が CHANGES_REQUIRED、Round 2 が PASS。
- 2026-10-15: HD-1〜HD-7 が確定した（DEC-007）。W1-1・W1-3・W2-T1 の詳細計画と受け入れ条件を計画書に記録した。実装は未着手。
- 2026-10-15: Human の指示（「CH1-COMP W1-1・W1-3・W2-T1 の実装開始」）で 3 項目を実装した（branch `claude/chapter-1-comprehensive-audit-6cul2d`）。IMPLEMENTING → TESTING → REVIEWING。
- 2026-10-15: 独立 Reviewer の Round 1 は CHANGES_REQUIRED、Round 2 は PASS（`.ai/reports/CH1-COMP-W1-W2T1-review.md`）。REVIEWING → PR_OPEN（PR #87）。

- 2026-10-19: W2-D の設計書を作成した（`.ai/reports/CH1-COMBAT-PROTO-design.md`、base `1205665`）。設計のみで、コード・テスト・数値は変えていない。推奨は案 B（読める攻撃表＋支援との連携）。HD-D1〜D6 は Human の判断待ち。
- 2026-10-19: Human の依頼（「CH1-COMP / W2-D 次工程：現行版ベースライン再測定」）で W2-T2 に着手した（branch `claude/ch1-comp-w2t2-baseline-remeasure`、base `1205665`）。ANALYZING → IMPLEMENTING（測定の spec の追加だけ）→ TESTING（測定 13 件）→ REVIEWING。PR #91（W2-D の設計書）は触っていない。
- 2026-10-19: W2-T2 独立 Reviewer Round 1・2 は CHANGES_REQUIRED、Round 3 は PASS（.ai/reports/CH1-COMP-W2T2-review.md）。REVIEWING（Reviewer PASS）。
- 2026-10-19: W2-T2 の PR #92 を作成した。REVIEWING → PR_OPEN。
- 2026-10-20: Human の依頼（「ボス爆発予兆の実装＋宵待ちの村の中ボス調査」の Work A）で W2-4a を実装した（branch `claude/ch1-comp-w2-4a-phase-burst-telegraph`、base `29c94da`）。ANALYZING → IMPLEMENTING → TESTING → REVIEWING。
- 2026-10-20: W2-4a 独立 Reviewer Round 1 は CHANGES_REQUIRED、Round 2 は PASS（.ai/reports/CH1-COMP-W24a-review.md）。REVIEWING（Reviewer PASS）。
- 2026-10-20: W2-4a Round 2 PASS の後の修正に、独立 Reviewer Round 3 が CHANGES_REQUIRED（発光の脈動が出ない）。発光の処理を Round 2 PASS のコードへ戻し、Round 3 で正しいと確認されたガードだけを残した。Review Fix Loop の上限に達したので Human に報告する（Escalation E-1）。
- 2026-10-20: Human の依頼（「ボス爆発予兆の実装＋宵待ちの村の中ボス調査」の Work B）で W2-MB の調査を行った（branch `claude/ch1-comp-dusk-midboss-investigation`、base `29c94da`）。調査のみ。ANALYZING → REVIEWING。
- 2026-10-20: W2-MB 独立 Reviewer Round 1: CHANGES_REQUIRED（.ai/reports/CH1-COMP-W2MB-review.md。FACT の誤り 4 件。結論は不変）。
- 2026-10-20: W2-MB 独立 Reviewer Round 1・2 は CHANGES_REQUIRED、Round 3 は PASS（.ai/reports/CH1-COMP-W2MB-review.md）。REVIEWING（Reviewer PASS）。
- 2026-10-20: W2-MB の PR #93 を作成した。REVIEWING → PR_OPEN。
- 2026-10-20: Human の指示（「PR #92・#94・#93 の受け入れとマージ、その後 W2-MB1 準備」）で、受け入れ確認の後に順に squash merge した: #92 → `e5d3464`、#94 → `1801f05`（Review Fix Loop の上限に達していたので、HEAD `3cd9d62` の独立した受け入れレビューで ACCEPT を確認してから）、#93 → `8fd69cb`。各 PR は最新 HEAD で CI 成功。GitHub Pages の Deploy は #92・#94 の merge で成功。
- 2026-10-20: W2-MB1 の計画を作成した（`.ai/tasks/CH1-COMP-W2MB1.md`、branch `claude/ch1-comp-w2-mb1-plan`）。計画のみ。PLANNED。
- 2026-10-20: W2-MB1 の計画の独立 Reviewer Round 1・2 は CHANGES_REQUIRED、Round 3 は PASS（.ai/reports/CH1-COMP-W2MB1-plan-review.md）。実装は Human の承認待ち。
- 2026-10-20: Human の指示（「PR #95の受け入れとW2-MB1実装」）で PR #95（W2-MB1 の計画）を受け入れ確認（HEAD `872bf54`・CI 成功・未解決コメントなし・Reviewer R3 PASS・計画が承認の内容と一致）の後に squash merge した → `c2e0894`。
- 2026-10-20: Human の承認（溜め 0.5 秒・パニッシュ窓なし・観測の灯で伸ばさない）で W2-MB1 を実装した（branch `claude/ch1-comp-w2-mb1-fisher-telegraph`）。IMPLEMENTING → TESTING → REVIEWING。独立 Reviewer Round 1 PASS（`.ai/reports/CH1-COMP-W2MB1-review.md`）。iPhone 確認は未。

## Approval（W1-1・W1-3・W2-T1）

- [x] Approved
- 種類: Human Approval
- Approved by / date / where: Human / 2026-10-15 / 会話（「指示：CH1-COMP W1-1・W1-3・W2-T1 の実装開始」）
- 承認の範囲: 計画 `.ai/reports/CHAPTER-1-comprehensive-improvement-plan.md` の W1-1・W1-3・W2-T1 と、指示文の仕様・受け入れ条件
- Persistence: 許可（branch: `claude/chapter-1-comprehensive-audit-6cul2d`）

## Implementation Result（W1-1・W1-3・W2-T1）

### Changed Files

| ファイル | Work Item | 変更 |
| --- | --- | --- |
| `src/core/look-rig.js` | W1-1 | 2 つを追加した。<br>・`lookTargetKind`（状態ごとに誰を見るか）<br>・`stepLookRig` / `initialLookState` / `zeroLookOutputs`（1 フレームの視線の更新）<br>`stepLookRig` は次の 2 つで、切り替わりの跳びを防ぐ（Round 1 で見直し）。<br>・配分の強さの追従 `LOOK_WEIGHT_FOLLOW = 12`、置き直しの閾値 `LOOK_RESCAN_WEIGHT`<br>・見ている向きの回る速さの上限 `LOOK_MAX_TURN_RATE = 6 rad/s`<br>既存の関数・可動域・配分の式は変えていない |
| `src/legacy/parts/13-update-loop.js` | W1-1 | `findLookTarget(moving)` は `lookTargetKind` を使う。<br>`updateLookRig(dt, moving)` は `stepLookRig` を呼んで書き込むだけにした。<br>Motion Panel の TARGET を `'enemy'` / `'ally'` に分けた（デバッグモードだけ） |
| `src/legacy/concat-plugin.js` | W1-1 | look-rig の import を差し替えた |
| `src/legacy/parts/11-combat-actions.js` | W1-3 | `swingOnce` の `if(isFinish) spawnToast('✨ フィニッシュ!')` を削除した（理由はコメント） |
| `tests/unit/look-rig.test.js` | W1-1 | `lookTargetKind` の 16 通り（＋敵の有無）と依頼の規則。<br>`stepLookRig` の切り替わり（60 / 30 / 20fps）。修正前の処理（`oldStep`）と比べる。<br>体の向きが 1 フレームで変わる場合と 13 rad/s で回る場合に、視線が相手からずれないこと。<br>歩行中の頭、到達値、linger |
| `tests/unit/motion-preview.test.js` | W1-1 | テストデータの `'enemy/ally'` を `'enemy'` に変えた |
| `tests/look-target.spec.js`（新規） | W1-1 | Motion Panel の TARGET と HEAD を、止まる・歩く・止まる・攻撃の順に読む（攻撃中は `ally` にならず、少なくとも 1 回 `enemy`） |
| `tests/unit/notification-channels.test.js` | W1-3 | `swingOnce` にフィニッシュのトーストが無いこと。<br>フィニッシュ段の効果（倍率・ゲージ・onFinishHit・styleKey・処刑の条件）が残っていること |
| `tests/combo-finish-toast.spec.js`（新規） | W1-3 | 剣士・魔法使いでカカシに通常コンボを 3 周振る。<br>「フィニッシュ」の通知が 0 件で、Ult ゲージが増えること |
| `tools/baseline/playwright.config.js`（新規） | W2-T1 | ベースライン専用の設定。既存の設定を読み込んで testDir・timeout・出力先・webServer の cwd だけ差し替える |
| `tools/baseline/ch1-combat-baseline.spec.js`（新規） | W2-T1 | 4 つの戦い方 × 2 回。読むのは画面の表示だけ |
| `.gitignore` | W2-T1 | `test-results-baseline/` を追加した（測定結果の出力先） |
| `.ai/reports/CH1-COMBAT-BASELINE.md`（新規） | W2-T1 | 8 試行の結果・制約・取得できなかった項目 |
| `.ai/reports/CH1-COMBAT-BASELINE-data.json`（新規） | W2-T1 | 8 試行の JSON |
| `.ai/reports/CHAPTER-1-comprehensive-improvement-audit.md` | W2-T1 | §4.2 の CALC に、ボスの HP の倍率（×1.2）の追記 |

変えていないもの:
- `basefile.html`
- 通常の `playwright.config.js` と CI の設定（`.github/`）
- 戦闘の数値・AI
- セーブの形式

### Test Report

- Scope: Full Regression（build・unit・E2E 全件）と、ベースライン専用の 8 試行
- Environment: この環境の Playwright 1.62.1 は同梱の Chromium を起動できない。そのため、`executablePath`（`/opt/pw-browsers/chromium-1194`）と webServer の cwd を指定する一時設定をリポジトリの外（scratchpad）に置いて実行した。リポジトリの設定は変えていない。

| テスト | 対象コミット | 結果 | メモ |
| --- | --- | --- | --- |
| `npm run build` | `f511bb7` | PASS | chunk size の警告のみ（従来どおり） |
| `npm run test:unit` | `f511bb7` | PASS | pass 1858 / fail 0 / skipped 1（skip は従来からの 1 件） |
| E2E 全件（`npx playwright test`） | `f511bb7` | PASS | 284 passed（1.5h）。既存 281 ＋ 新規 3（look-target 1、combo-finish-toast 2）。`f511bb7` から `06f0ad6` までの差分は `tools/baseline/` と `.gitignore` だけ |
| 通常の実行への混入 | `06f0ad6` | PASS | `npx playwright test --list` は 284 件。ベースラインの spec は含まれない |
| `tests/look-target.spec.js`（修正前のコード） | ― | FAIL（期待どおり） | 修正前は TARGET が `enemy/ally` を返し、止まった状態の `ally` の判定で落ちる |
| `tests/combo-finish-toast.spec.js`（修正前のコード） | ― | FAIL（期待どおり） | 通知に「✨ フィニッシュ!」が 3 回出る（同じ記録に「💫 体勢を崩した!」「💥 ダウン!」もある） |
| ベースライン 8 試行 | `06f0ad6` | 8 passed（1.2h） | 結果は `.ai/reports/CH1-COMBAT-BASELINE.md` |

### Acceptance Criteria

**W1-1**

| AC | 確認方法 | 結果 |
| --- | --- | --- |
| 移動中に視線の対象が仲間にならない | unit（`lookTargetKind` の moving）＋ E2E（歩行中の TARGET が scan / linger のみ） | VERIFIED |
| 戦闘態勢中・攻撃中は見えている敵が対象。敵がいなければ仲間を見ない | unit（combat × enemyVisible の組み合わせ）。E2E は攻撃中に `ally` にならないことを確認（訓練場のカカシが見えるので `enemy`） | VERIFIED（「敵がいない戦闘態勢」は unit だけ） |
| 会話・演出中と止まっている探索中の挙動を維持 | unit（dialogue と停止の行は旧規則と同じ答え）。E2E（止まると `ally`） | VERIFIED（会話中は unit だけ。E2E で会話は起こしていない） |
| 状態の切り替えで頭が 1 フレームで跳ばない | unit（stepLookRig の切り替えの列）。修正前の処理は、linger 切れと、止まった瞬間に後ろの仲間を見始めるときに、頭の yaw が 1 フレームで 38° 跳ぶ。新しい処理は 1 フレームの変化が `6 rad/s × dt + 1°` 以下（20fps でも上限 38° の半分未満）。体の向きの急変でも、視線のずれは修正前を超えない | VERIFIED（実機の見た目は未確認） |
| デバッグ表示は通常プレイの UI に影響しない | `motionDebugLook` はデバッグモードでだけ書く（既存の分岐）。既存の `character-motion.spec.js`「通常プレイでは出ず」が PASS | VERIFIED |
| 既存の移動・攻撃・回避のモーションを壊さない | E2E 全件 PASS（`character-motion` / `weapon-stow` / `air-actions` ほか） | VERIFIED（自動テストの範囲） |

**W1-3**

| AC | 確認方法 | 結果 |
| --- | --- | --- |
| 通常コンボでフィニッシュのトーストが 1 件も出ない | E2E（剣士・魔法使い、各 3 周以上）＋ unit | VERIFIED |
| ダメージ・コンボの条件・攻撃の動き | unit（`comboDmgMul` / `comboStaggerMul` / `styleKey` が残る）、E2E（ダメージの数字が出続ける）、`auto-combo.spec.js` PASS | VERIFIED |
| Ult ゲージの加算 | unit（`ultGauge: isFinish ? 6 : 3`）、E2E（ゲージの % が増える） | VERIFIED |
| 処刑・Break の通知と条件 | unit（`canExecute(en, {isFinish})`）、`execution-break.spec.js` PASS | VERIFIED |
| ボスの段階変化・召喚・特殊行動・撃破・結果の通知 | 削除は `swingOnce` の 1 行だけ（diff）。ベースラインの全 8 試行で段階変化のトーストが出た | VERIFIED |

**W2-T1**

| AC | 結果 |
| --- | --- |
| 4 つの戦い方 × 2 回の結果を記録 | VERIFIED（8 / 8） |
| 実行条件とテストモードの制約を明記 | VERIFIED（レポート §0・§1、JSON の conditions） |
| 逃げ回りと、攻撃・回避を組み合わせる戦い方を比べられる | VERIFIED（S1 / S3 / S4） |
| プレイヤーと支援のダメージ寄与を比べられる | VERIFIED（ダメージの数字の色で区別） |
| 画面に出ないデータは取得不能と記録 | VERIFIED（ボス本体の攻撃回数、通常プレイの生死など。レポート §3） |
| 専用 spec が通常の `npm test` に入らない | VERIFIED（`--list` 284 件） |
| ゲームのコード・戦闘の数値・通常の CI の設定を変えない | VERIFIED（W2-T1 の差分は `tools/baseline/`・`.gitignore`・`.ai/` だけ） |

### Round 1 Fix（独立 Reviewer の CHANGES_REQUIRED への対応）

1. **W1-1**
   - 指摘: 最終の角度を追従させていたため、体の向きの急な変化（`swingLockFacing`）で視線が相手を通り過ぎた。再現は最大 44.7°（修正前は 16.0°）。
   - 修正: 追従させるのを最終の角度から配分の強さに変えた。linger が切れたら、強さがほぼ 0 まで下がってから見回しへ置き直す。見ている向きの回る速さに上限（6 rad/s）を付けた。
   - 確認: unit で、体を 1 フレームで敵へ向ける場合と、13 rad/s で 90° 回す場合を回す。どちらも視線のずれが修正前の処理を超えない。1 フレームで敵へ向ける場合は 1° 未満。
2. **W2-T1**
   - 指摘: HP 10% 未満のときに会話やメニューが開くと、撃破と誤判定しうる。
   - 修正: 撃破は「結果画面」か「会話・メニューが無いまま、HP 10% 未満でバーが消えた状態が 2 回続けて読めた」ときとした。撃破の時刻は、バーが消えた最初の時刻。撃破後の会話は `afterDefeatDialogues` に分けて記録する。
   - 再測定: 8 試行すべて、この判定で撃破を確定した。
3. **推奨への対応**
   - E2E: 攻撃中に少なくとも 1 回は `enemy` を見ることを確かめる。
   - 推定ゲーム内時間には会話中の時間も含むことを、報告書と JSON に明記した。

| テスト（Round 1 の後） | 対象コミット | 結果 |
| --- | --- | --- |
| `npm run build` | `f5e189c` | PASS |
| `npm run test:unit` | `f5e189c` | pass 1860 / fail 0 / skipped 1 |
| E2E 全件 | `94ae28f`（`f5e189c` からの差分は `.ai/` だけ） | 284 passed（1.5h） |
| ベースライン 8 試行 | `f5e189c` | 8 passed（1.2h）。報告書の表を、この実行の値に差し替えた |

### Out of Scope Found

- 近づくと発火するイベント（`updateProximityEvents`、`02-world-common.js:2225`）は、会話中・一時停止中だけを止め、戦闘中は止めない。
  - 前回監査の「戦闘中は判定しない」は不正確だった。
  - 今回は、テストモードで「ボスの手前」の演出が戦闘中に始まる形で現れた。通常プレイではボスの前に必ず通るので起きない。対処は不要と判断し、記録だけにした。
- テストモードは `legacyGrowth()` が true で、ボスを倒すとレベルが上がる（測定の通知に出た）。テストモードの仕様どおりで、通常の第一章には影響しない。

## W2-T2 — 現行版のベースライン再測定（2026-10-19）

- Analysis: `.ai/reports/CH1-COMP-W2T2-analysis.md`
- Report: `.ai/reports/CH1-COMBAT-BASELINE-W2T2.md`、データ `.ai/reports/CH1-COMBAT-BASELINE-W2T2-data.json`
- Review: `.ai/reports/CH1-COMP-W2T2-review.md`

### Approval

- [x] Approved
- 種類: Human Approval（依頼文が範囲を明示: 調査・測定・記録・独立レビュー。ゲームのコード・数値は変えない）
- Approved by / date / where: Human / 2026-10-19 / 会話
- Persistence: 許可（branch: `claude/ch1-comp-w2t2-baseline-remeasure`）

### Plan（Agent Decision）

- 既存の W2-T1 の spec と報告書は残し、同じ条件の新しい spec を `tools/baseline/` に足す（旧い測定を再現できるように。依頼 §7「履歴を失わせない」）。
- 通常プレイでボスの前まで歩く自動化はしない（この環境では 1 区画に 40 秒前後。`tests/duskvillage.spec.js` の冒頭）。代わりに、
  1. テストモードの「HP1 で生存」の最初の記録を「通常プレイなら倒れていた時刻」とする（最初のレベルアップより前なら同じ条件。Analysis §F）。
  2. 通常プレイの HP・攻撃力は、洋館クリア後のセーブを仕込んで通常 URL で入り、メニューから読む。
- 戦い方を 2 つ足す: S3T（攻撃の連打。PR #89 の処刑の影響を見る）、S5（ボスの振りかぶりを見て回避 → 向き直って反撃）。
- 被弾の出どころは、ゲームのコードを変えずには取れない。1 撃の値が出どころごとに違うことを使って推定する（INFERENCE と明記）。

### Files

| ファイル | 変更 |
| --- | --- |
| `tools/baseline/ch1-combat-baseline-w2t2.spec.js`（新規） | 6 戦い方 × 2 回。読み取りと入力だけ |
| `tools/baseline/ch1-normal-play-stats.spec.js`（新規） | 通常プレイの HP・攻撃力をメニューから読む |
| `.ai/reports/CH1-COMP-W2T2-analysis.md`、`CH1-COMBAT-BASELINE-W2T2.md`、`-data.json`、`CH1-COMP-W2T2-review.md`（新規） | 調査・結果・レビュー |
| `.ai/tasks/CH1-COMP.md` | W2-T2 の行・Status History・この節 |

変えていないもの: `src/`、`tests/`、`playwright.config.js`、`tools/baseline/` の既存 2 ファイル、`basefile.html`、`.github/`、W2-T1 の報告書とデータ。

### Test Report（W2-T2）

- Scope: Targeted。ゲームのコードを変えていないので、測定と、変えていないことの確認だけ。
- Environment: この環境の Playwright 1.62.1 は同梱の Chromium を起動できないため、`executablePath`（`/opt/pw-browsers/chromium-1194`）と workers だけを scratchpad の設定で指定した（リポジトリの設定は変えていない）。

| テスト | 対象 | 結果 | メモ |
| --- | --- | --- | --- |
| 測定 `tools/baseline/ch1-combat-baseline-w2t2.spec.js`（S1〜S5 × 2）＋ `ch1-normal-play-stats.spec.js` | `1205665` ＋ spec | 13 passed（1.9h、workers 2） | 結果は `.ai/reports/CH1-COMBAT-BASELINE-W2T2.md` |
| 同上の S5 × 2（回避の後に向き直る手順を足した版） | 同上 | 2 passed（12 分） | 初版の S5 は報告書 §4.4 の S5x として残した |
| `npm run build` | 作業ブランチ | PASS | chunk size の警告のみ（従来どおり） |
| `npm run test:unit` | 作業ブランチ | pass 1877 / fail 0 / skipped 1 | skip は従来からの 1 件 |
| `npx playwright test --list` | 作業ブランチ | 296 件。`tools/baseline/` の spec は 0 件 | 通常の E2E・CI に測定が入らない |
| `git diff origin/main -- src tests playwright.config.js basefile.html .github` | 作業ブランチ | 差分なし | ゲームのコード・テスト・設定を変えていない |
| E2E 全件 | ― | NOT_RUN | ゲームのコードを変えていないため（依頼「測定に必要なテスト以外のフル E2E は無理に実行しない」） |

試走で見つけて直したもの（本測定の前。Auto Fix には数えない）:
1. メニューを閉じてから計測を始めるまでの間に被弾し、累計がずれた → 閉じるのと計測の開始を同じ JS の実行にした。
2. Break を数える手段が無かった（#89 でトーストが無くなった）→ ボスの体幹（Debug Info）と攻撃ボタンの「処刑」で数える。
3. S5 の回避の向き → ボス戦のカメラのロックオンに合わせて S（ボスから離れる）にした。
4. S5 で回避の後に体がボスと逆を向き、反撃が当たらなかった → 向き直る手順を足して測り直した（初版の値は補足として残した）。

### Round 1 Fix（W2-T2。独立 Reviewer の CHANGES_REQUIRED への対応）

1. 倒れた時点のボスの HP: 1 秒ごとの記録の前の値をそのまま書いていた → S3・S3T・S4 は段階 2 の爆発で倒れるので 65%、S1・S2 は前後の記録の線形補間（約 76〜77% / 約 85%）にし、読み方を注記した（報告書 §0・§4.1。§6 は Round 2 の指摘で同じ値にそろえた）。
2. 性格の差: 「被ダメージには効かない」だけでは不十分 → 与ダメージを通して段階移行の爆発の時刻がずれうること、S5 では爆発の当たり外れに効きうることを追記した（報告書 §5・§7.3、分析 Summary 3・§F）。
3. S5 の停止区間: ボスの AI 状態が変わらなかった区間（9.4〜18.0 秒 / 9.05〜17.3 秒）に直し、根拠を書いた（報告書 §4.4）。
4. 任意の指摘: レベルアップの記述を記録のある試行に限定、§4.2 の「毎分」を「毎分の被弾の回数」に、§8.1 に版の新旧の確かめ方を追記。

再測定はしていない（データは同じ）。

### Round 2 Fix（W2-T2）

1. 報告書 §6 の表に残っていた古い値（ボスの HP 78% / 70%）を §0・§4.1 と同じ値（約 76〜77% / 65%）にそろえた。
2. 任意の指摘: §4.4 の S5 #2 のボスの HP の記録の書き方を、16.0 秒の記録まで 30.0% に直した。分析 Summary 3 に、性格の差が S5 の爆発の当たり外れに効きうることを足した。

### Autonomy Metrics（W2-T2）

| 項目 | 値 |
| --- | --- |
| Human Escalation Count | 0 |
| Human Decision Count | 0 |
| Auto Fix Count | 2（Review Fix Loop の Round 1・2） |
| Reviewer Round Count | 3 |
| Test Retry Count | 0 |
| PR Created | Yes（#92） |
