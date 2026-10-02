# PROGRESSION-002 Analyzer report（旧セーブの「仲間を雇う」が第一章本編へ持ち越される）

| 項目 | 値 |
| --- | --- |
| Task ID | PROGRESSION-002 |
| Branch | `claude/agent-autonomous-execution-ewtk87` |
| 基準 SHA | `f53e30e`（PROGRESSION-001 完了） |
| Persisted by | Agent（Orchestrator。AGENTS.md §5.2） |
| 日付 | 2026-10-02 |
| 出典 | PROGRESSION-001 の Known Limitation / Agent Decision P-6 |
| Human Decision | 第一章本編では、旧セーブに保存されている「仲間を雇う」状態を戦闘・同行へ反映しない。第一章の正式な加入・同行の進行は既存仕様のまま（Human、2026-10-02） |

## 1. 関係するコード（FACT）

| 項目 | 場所 | 内容 |
| --- | --- | --- |
| 雇用状態 | `state.skills.companion`（0 / 1） | パッシブ `SKILL_DEFS` の 1 つ「仲間を雇う」（💎25、`12-progression-ui.js`） |
| セーブ / ロード | `09-save-load.js` | `saveGame` が `skills` を保存、`loadGame` が `state.skills = Object.assign({…, companion:0, …}, data.skills)` で復元 |
| 新規開始 | `14-hud-boot.js`（本編の開始・テストモードの開始） | どちらも `state.skills.companion = 0` に初期化 |
| 本編の開始・再開 | `finishEnteringGame`（`14-hud-boot.js`） | `state.testMode = (world==='training')` を決めた後、`syncAlliesToState()` を呼ぶ |
| 同行者の再構築 | `syncAlliesToState()`（`08-loot-equipment.js`） | `state.skills.companion>=1` なら **雇った仲間（`companion`）を生成**。続いて `state.guestClassKey` から正式な支援 AI（`guestCompanion`）を生成 |
| 他の呼び出し | `14-hud-boot.js` の主人公の交代（加入の一幕）・`meetChapter1Protagonist`（道の出会い） | どちらも `syncAlliesToState()` で組み直す（同じ判定を通る） |
| 雇った仲間の行動 | `updateCompanion`（毎フレーム） | 近くの敵へ寄って `dealDamageToEnemy` で攻撃する（戦闘へ介入） |
| その他の表示 | ミニマップ（`#8ae0c0` の点）、視線の向き先（`13-update-loop.js` の `companion || guestCompanion`） | 雇った仲間がいれば出る |
| 購入 | 鑑定所 Skill の passive サブタブ（`12-progression-ui.js`） | 本編では出ない（UI-002-A / WORK 12.1）。テストモードでは購入できる |
| 第一章の正式な同行 | `state.guestClassKey`（`chapter1GuestKey()`・加入の一幕・道の出会い） | 雇用状態とは独立 |

## 2. 根本原因

`syncAlliesToState()` が、第一章の本編かどうか（`legacyGrowth()`）を見ずに `state.skills.companion` だけで雇った仲間を生成している。PROGRESSION-001 / WORK 12.1 で他の成長系の値（パッシブの数値を含む）は本編で効かなくしたが、同じ `state.skills` に入っている `companion` だけは、数値ではなく同行者の生成に使われていたため残っていた。

## 3. 旧セーブの状態が第一章へ影響する経路

1. 旧セーブ（`skills.companion: 1`）→ タイトルの「続きから」→ `loadGame` が `state.skills.companion = 1` を復元
2. → `finishEnteringGame`（`state.testMode = false`）→ `syncAlliesToState()` → `buildCompanion()`
3. → 雇った仲間が酒場・ダンジョンに同行し、`updateCompanion` で敵を攻撃し、ミニマップに出る
4. 加入の一幕・道の出会いで `syncAlliesToState()` が呼ばれるたびに、同じ判定で作り直される

新規ゲーム・テストモードの開始時は 0 なので、影響を受けるのは旧セーブだけ。テストモードで購入した場合（鑑定所）は、テストモードの中だけで同行する（セーブは `saveGame` が `state.testMode` で弾く）。

## 4. 方針（Planner への入力）

- `syncAlliesToState()` の雇った仲間の生成を `legacyGrowth() && state.skills.companion>=1` にする（PROGRESSION-001 と同じ判定）。正式な支援 AI（`guestClassKey`）の生成はそのまま
- セーブの値（`skills.companion`）は消さない・変換しない
- テストモードの購入経路（鑑定所）・テストモードの同行は変えない（`legacyGrowth()` が true）
- Chapter 2 は未実装。判定は PROGRESSION-001 と同じ `legacyGrowth()` に揃え、Chapter 2 の扱いはここでは決めない
