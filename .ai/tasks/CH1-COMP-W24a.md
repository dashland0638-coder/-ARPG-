# CH1-COMP-W24a — 村のボスの段階移行の爆発に予兆を付ける

親 Task: [`CH1-COMP.md`](CH1-COMP.md)（Work Item W2-4a。Status と Approval の正本は親の Work Items 表）

Status: REVIEWING

Analysis: `.ai/reports/CH1-COMP-W24a-analysis.md`（branch `claude/ch1-comp-w2-4a-phase-burst-telegraph`）

## Approval

- [x] Approved
- 種類: Human Approval（依頼文が実装を明示: 「Work A：ボスの段階移行時の爆発に予兆を追加する。これは今回の実装対象です」）
- Escalation Check: None
- Approved by / date / where: Human / 2026-10-20 / 会話
- 承認の範囲: 村の残響の段階移行の爆発の予兆だけ。設計 `.ai/reports/CH1-COMBAT-PROTO-design.md` の W2-4a のうち残響の床の円は含めない。HD-D6（予兆の補修）の「爆発」の部分にあたる
- Persistence: 許可（branch: `claude/ch1-comp-w2-4a-phase-burst-telegraph`）

## Goal

ボスの段階移行時の爆発に、プレイヤーが攻撃を認識して回避の判断ができる視覚的な予兆を追加する（Human、2026-10-20）。

## Constraints（依頼）

- 爆発のダメージ・範囲・判定、ボスの HP・攻撃力・追跡速度・攻撃頻度、支援 AI、回復・キャラクターの HP、セーブ・進行条件を変えない。
- 薙ぎ・踏み込み・床の円などの攻撃を足さない。他のボス・道中の敵へ広げない。
- `basefile.html`、legacy の連結構成を変えない。

## Implementation Plan

1. `src/core/phase-burst.js`（新規）: 予兆の長さ 0.8 秒、対象のボス（`duskEcho` だけ）、1 体のボスの予兆の待ち行列（同時に 1 つ、続けて来た爆発は前の爆発の直後に順に予兆）。
2. P07 `triggerBossPhaseSkill`: トースト・発光・段階の見た目は今までどおりその場で。爆発の処理を `detonateBossPhaseBurst` へそのまま移し、村の残響だけ `queueBossPhaseBurst` を通す。
3. P07 に予兆の表示（外周の輪 r4.5、内側の円が 0.8 秒で満ちる、ボスの発光の脈動、`castAim` の音）と、`updateEnemies` の最後で進める `updateBossPhaseBursts`（網・残響と同じ作法）。撃破・戦闘の仕切り直し・場所の移動で捨てる（`clearBossPhaseBursts` を場所の移動と地点ジャンプで呼ぶ）。
4. テストモードの Arena の記録に「PHASE BURST — TELEGRAPH / DETONATE」（通常プレイの画面には出ない）。

## Files To Change

| ファイル | 変更 |
| --- | --- |
| `src/core/phase-burst.js`（新規） | 予兆の時間と待ち行列 |
| `src/legacy/parts/07-ai-combat.js` | `triggerBossPhaseSkill` の分岐、`detonateBossPhaseBurst`（移しただけ）、予兆の表示と進行 |
| `src/legacy/concat-plugin.js` | `phase-burst.js` の import |
| `src/legacy/parts/02-world-common.js` | 場所の移動で予兆を捨てる（1 行） |
| `src/legacy/parts/14-hud-boot.js` | 地点ジャンプで予兆を捨てる（1 行） |
| `tests/unit/phase-burst.test.js`（新規） | 対象のボス、1 回だけ爆発、重ならない、捨てる |
| `tests/dusk-boss-phase-burst.spec.js`（新規） | 段階 2・3 の予兆 → 爆発の順と時間、ダメージ 30 は爆発の時だけ |
| `.ai/tasks/CH1-COMP.md`、本書、`.ai/reports/CH1-COMP-W24a-analysis.md`、`-review.md` | 記録 |

## Files Not To Change

`basefile.html`、`src/core/` の既存の数値（`stagger-math.js` ほか）、ボスの設定（`14-dungeon-duskvillage.js buildDuskVillageEcho`）、支援 AI（`08-loot-equipment.js`）、セーブ（`09-save-load.js`）、他のボスの AI。

## Acceptance Criteria

| # | 基準 | 確かめ方 |
| --- | --- | --- |
| 1 | 段階移行の爆発に、判定より前の視覚的な予兆がある | E2E（予兆の開始 → 0.75〜1.3 秒後に爆発）、unit |
| 2 | 段階 2・段階 3 の両方で予兆が出る | E2E（トーストが 2 つ、予兆が 2 つ） |
| 3 | 予兆の追加でダメージ・範囲が変わらない | コードの差分（`detonateBossPhaseBurst` は移しただけ）、E2E（爆発のダメージの数字 30） |
| 4 | 予兆の終わり・爆発・段階移行の順が合う | E2E（トースト → 予兆の開始 → 爆発。段階 3 が段階 2 の予兆中に来ても重ならない） |
| 5 | 予兆が二重に出ない・爆発の後に残らない | unit（同時に 1 つ、爆発の後に何も残らない）、コード（爆発のフレームで表示を外す） |
| 6 | 通常プレイとテストモードの両方 | コード（予兆の処理に `testMode` の分岐が無い。Arena の記録だけテストモード）。通常プレイのボス戦の E2E は無い（ボスまで歩けない）ので、実機で確かめる |
| 7 | 既存の戦闘・進行・セーブのテストを壊さない | unit 全件、関連 E2E |

## Test Plan

- `npm run build`、`npm run test:unit`
- E2E（Targeted）: `dusk-boss-phase-burst`（新規）、`duskvillage`、`execution-break`、`combat-events-layout`、`combat-test-arena`、`scenario-test-mode`、`notifications`、`combat-center-messages`、`save-load`、`chapter1-progression`、`production-build`、`chapter1-dusk-basics`
- 全件の E2E は実行しない（約 1.5 時間。変更はボスの段階移行の 1 経路に閉じる）

## Rollback

`PHASE_BURST_TELEGRAPH_BOSSES` を空にすると、村の残響も今までどおり即時の爆発に戻る。

## Agent Decisions

`.ai/reports/CH1-COMP-W24a-analysis.md` §判断 の 1〜7。

## Test Report

- Scope: Targeted（変更はボスの段階移行の 1 経路に閉じる）
- Environment: この環境の Playwright 1.62.1 は同梱の Chromium を起動できないため、`executablePath`（`/opt/pw-browsers/chromium-1194`）と webServer の cwd だけを scratchpad の設定で指定した（リポジトリの設定は変えていない）。

| テスト | 結果 | メモ |
| --- | --- | --- |
| `npm run build` | PASS | chunk size の警告のみ（従来どおり） |
| `npm run test:unit` | pass 1892 / fail 0 / skipped 1 | 新規 `phase-burst.test.js` 15 件を含む。skip は従来からの 1 件 |
| `tests/dusk-boss-phase-burst.spec.js`（新規） | PASS（単独 1 回、回帰の組の中で 1 回） | 段階 2: トースト 6.99 → 予兆 6.99 → 爆発 7.79 → 30 が 7.84。段階 3: 7.99 → 7.99 → 8.79 → 8.84（推定ゲーム内秒） |
| 関連 E2E 11 本（`duskvillage`、`execution-break`、`combat-events-layout`、`combat-test-arena`、`scenario-test-mode`、`notifications`、`combat-center-messages`、`save-load`、`chapter1-progression`、`production-build`、`chapter1-dusk-basics`） | 56 passed（19.7 分、新規を含む） | ― |
| E2E 全件 | NOT_RUN | 約 1.5 時間。変更が 1 経路に閉じ、関連する spec を選んで実行した |
| 通常プレイのボス戦 | NOT_RUN（自動化できない） | ボスまで歩く自動化はこの環境では現実的でない。予兆の処理に `testMode` の分岐が無いことはコードで確認（FACT (code)）。iPhone 実機で確かめる |

予兆の画面: `test-results/dusk-phase-burst-telegraph-1.png`（E2E が撮る。リポジトリには入れない）で、ボスの足元に半径 4.5 の輪が出ていることを目で確かめた。

## iPhone 実機で確かめること（自動テストでは分からない）

1. 段階が変わった時（「⚡ 村の残響が闘気を纏った!」「…最後の力を振り絞った!」）、ボスの足元に橙色の輪が出て、内側の円が満ちるのが見えるか。夜の村の床で見分けられるか。
2. 0.8 秒の間に輪の外へ出られるか（輪の外にいれば当たらない）。回避で抜けられるか。
3. 輪の一部が画面の外（カメラの手前）に切れて、範囲が読みにくくならないか。
4. 段階 2 と段階 3 が続けて来た時に、輪が 2 回、順に出るか（重ならない）。

## Round 1 Fix（独立 Reviewer の CHANGES_REQUIRED への対応）

1. R1: 予兆の途中でボスを倒すと、撃破の会話（`onBossDefeated` でゲームが止まる）の間、輪が残った → 1 体のボスの予兆を爆発させずに捨てる `cancelBossPhaseBurstFor(en)` を足し、`onBossDefeated`（`shockRing` / `chargeLane` の片付けの隣）から呼ぶ。
2. O1: 予兆の途中に戦闘不能になった場合も同じ → `triggerPlayerDown` のボスを戻す処理の最初で呼ぶ（予兆を捨ててから発光を 0.22 に戻すので、上書きされない）。
3. O3: `PHASE_BURST_RADIUS` を `PHASE_BURST_COLOR` の隣へ移した（値は同じ 4.5）。
4. 予兆を捨てたことを、テストモードの Arena の記録に「PHASE BURST — CANCEL」として出す（通常プレイの画面には出ない）。
5. O2: 「段階 2 の予兆の途中に段階 3 が来る」流れは、E2E（Lv30）では起きなかった（段階 2 の爆発の後に段階 3 が来た）。この流れは unit（`phase-burst.test.js`「段階 2 と段階 3 が続けて来た場合」）だけで確かめている。
6. 撃破の途中で予兆を捨てる経路の E2E は足していない（予兆の 0.8 秒の間に撃破を確実に起こす手段が無い）。呼ばれることはコードで確認（FACT (code)）。

| テスト（Round 1 の後） | 結果 |
| --- | --- |
| `npm run build` | PASS |
| `npm run test:unit` | pass 1892 / fail 0 / skipped 1 |
| E2E（`dusk-boss-phase-burst`、`duskvillage`、`execution-break`、`chapter1-progression`） | 19 passed（8.0 分） |

## Round 2 の後の修正（Round 2 は PASS。任意の指摘のうち、自分が持ち込んだ不具合 2 件を直した）

1. ~~発光の扱いの変更~~（**誤りだった。Round 3 で指摘され、元に戻した**）。予兆の脈動を「そのフレームに足すだけ」に変えたが、ボスは `updateEnemyVisibility` の先頭で抜けるので戦闘時ハイライトが走らず（`en.hlOn` は常に未設定）、脈動が一度も出なくなっていた。「段階移行の +0.25 はハイライトが毎フレーム上書きしていた」という記述も誤りだった（ボスの発光を毎フレーム書く処理は無い）。
2. 予兆の爆発でプレイヤーが戦闘不能になったとき、`triggerPlayerDown` が予兆を捨てた後に、待っていた次の予兆を作り直して音が鳴っていた → 爆発の後に予兆が捨てられていれば次を始めない。

| テスト | 結果 |
| --- | --- |
| `npm run build` | PASS |
| `npm run test:unit` | pass 1892 / fail 0 / skipped 1 |
| E2E（`dusk-boss-phase-burst`、`execution-break`、`duskvillage`） | 8 passed（4.3 分） |

## Round 3 Fix（Review Fix Loop の上限に達した後の対応）

- Round 3（`d0b101e`）は CHANGES_REQUIRED（R1: 予兆中のボスの発光の脈動が出ない。R2: 記録の誤り）。原因は Round 2 PASS の後に入れた発光の変更（上の 1）。
- 対応: 発光の処理を **Round 2 で PASS したコード（`669fe35`）にそのまま戻した**。爆発の後に予兆が捨てられていれば次を始めないガード（上の 2）は、Round 3 の Reviewer が「正しい」と確認したので残した。
  - `git diff 669fe35 -- src/` は、このガードの 2 行だけ。
- 既知の点（Round 3 の O2）: 段階 2 の予兆の途中に段階 3 が来た場合、段階 3 の発光の上乗せ（+0.25）は段階 2 の予兆の書き戻しで消える（見た目だけ。判定・ダメージには関係しない）。
- **Review Fix Loop の上限（3 Round）に達した。** 新しいコードは足さず、レビュー済みのコードへ戻す形で解消したが、AGENTS.md §9.1 の上限を超える扱いになるので、Human に報告する（Escalation E-1。PR 本文と最終報告に記載）。

| テスト（Round 3 Fix の後） | 結果 |
| --- | --- |
| `npm run build` | PASS |
| `npm run test:unit` | pass 1892 / fail 0 / skipped 1 |
| E2E（`dusk-boss-phase-burst`、`execution-break`） | 4 passed（3.1 分） |
