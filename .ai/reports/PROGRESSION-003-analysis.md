# PROGRESSION-003 Analyzer report（旧セーブの Skill 2 alt・必殺技 alt・Skill 1 新技・上位職 Skill 1 を第一章本編で使わない）

| 項目 | 値 |
| --- | --- |
| Task ID | PROGRESSION-003 |
| Branch | `claude/agent-autonomous-execution-ewtk87` |
| 基準 SHA | `4f7c8f5`（UI-002-F decision audit） |
| Persisted by | Agent（Orchestrator。AGENTS.md §5.2） |
| 日付 | 2026-10-04 |
| 出典 | `.ai/reports/UI-002-F-decision-audit.md` A-1〜A-4、Human の Goal（2026-10-04） |

## 1. 決定（根拠）

- 第一章に「スキル習得・変化システム」「スフィア盤ライクな成長」は存在しない（UI-002-HD「第一章のゲームデザイン境界」）
- 旧セーブは本編で表示・入力・使用・新規入手を抑制する。削除・変換しない（UI-002-HD「旧セーブを破壊しない原則」）
- 上位職は Chapter 1 で使わない（WORK 12.1、docs/PROGRESSION.md「決定（WORK 12.1）」）
- 剣士・盗賊・弓師の第一章の Skill 1 は Human Decision 待ち（UI-002-F audit C-2）→ 今回は「既定技を正式とする」決定をしない

## 2. 根本原因（FACT）

| # | 値（保存） | 読む所 | 原因 |
| --- | --- | --- | --- |
| A-1 | `unlockedSkill2Alt` / `skill2Choice` | `activeSkill2Def`（12-progression-ui.js。戦闘・HUD の Skill 2）、スキル2 サブタブ（表示・付け替え） | 本編の判定（`legacyGrowth()`）が無い |
| A-2 | `unlockedUltAlt` / `ultChoice` | `recomputeStats` の ult（戦闘・HUD の必殺技）、必殺技サブタブ（表示・付け替え） | 同上（上位職の ult だけ `jobActive` で判定済み） |
| A-3 | `unlockedSkill1Alt` / `skillChoice`（`unlockKey:'skill1Alt'` の技） | Skill 1 の技の解決 4 か所（`releaseSkill`・溜めリング・Skill 1 ボタンの icon・glyph の解決）、スキル1 サブタブ | 技の解決は `getChargeVariants()[state.skillChoice]` をそのまま使い、解放条件を見ない。サブタブは `unlockedSkill1Alt` だけを見る |
| A-4 | `job` / `skillChoice`（`unlockKey:'job'` の技） | 同上 | ロード時の Skill 1 復元（09-save-load.js）は `state.job` が残っている時点で判定され、その後 `normalizeChapter1Load` が `job = null` にする。`skillChoice` は戻されないので、技の解決 4 か所はそのまま上位職の技を使う |

## 3. 旧セーブから本編への経路（ロードの順序）

1. `loadGame`: `unlockedSkill1Alt / Skill2Alt / UltAlt`、`skill2Choice` / `ultChoice`（解放済みなら alt）、`job`、`skillChoice`（解放済み・転身済みなら新技・上位職の技）を復元 → `recomputeStats()`（この時点の `state.testMode` は前回の値のまま）
2. `finishEnteringGame`: `state.testMode = (world==='training')` → `advanceChapter1Cast({rebuild:false})`（交代があれば `defaultSkill1For` / `learnedSkill2=false`。alt の値は全職共通のまま）→ `normalizeChapter1Load`（本編: `job = null`、`recomputeStats()`）
3. 以降: 戦闘・HUD は毎回 `activeSkill2Def()` / `state.classDef.ult` / `getChargeVariants()[state.skillChoice]` を読む

- 1 の `recomputeStats()` は本編判定が古い値で走る可能性があるが、2 の `normalizeChapter1Load` が本編判定で計算し直してから操作が始まる（PROGRESSION-001 の gate も同じ）→ 操作可能な時点で旧セーブの値が残る経路は、上の表の読む所だけ
- テストモード: 開始時に alt を全解放（開発用）。`legacyGrowth()` が true

## 4. 方針（Planner への入力）

- 読む所で止める（PROGRESSION-001 / 002 と同じ）。判定は `legacyGrowth()` に揃え、判定を 1 か所ずつの小さな関数にまとめて、戦闘と画面の両方から使う（条件を散らばらせない）
- Skill 1 の技の解決 4 か所は同じ式の重複なので、1 つの関数に置き換える
- 使えない技のときは、新規開始・交代で既に使っている `defaultSkill1For(class)` の技にする（新しい既定は作らない。剣士・盗賊・弓師は従来どおり `retreat`）
- セーブ: 値は書き換えない（`state.skillChoice` 等はそのまま保存される）
