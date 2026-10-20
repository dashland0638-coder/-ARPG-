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
