# PROGRESSION-003

Status: IMPLEMENTING

Analysis: .ai/reports/PROGRESSION-003-analysis.md（branch `claude/agent-autonomous-execution-ewtk87` @ `787556f141ed5c6bd8ed4b864a00adec59adcee0`、blob `63586c73c32b1bbab70ad0b7b361e2e92eb9b9bf`）

## Approval
- [x] Approved
- Approval type: Agent Approval（`../AGENTS.md` §6.1。仕様は決定済み = UI-002-F audit の A 分類、Human の Goal で実施指示）
- Escalation Check: None（E-1: 決定済みの仕様の実装 / E-2: 矛盾なし / E-3: 新しい仕様なし（剣士・盗賊・弓師の Skill 1 は決めない）/ E-4: セーブは消さない・変換しない / E-6・E-7・E-9: 該当なし）
- Approved by / date / where: Planner (Agent) / 2026-10-04 / branch `claude/agent-autonomous-execution-ewtk87`
- Scope of approval: 下の Files To Change
- Persistence: 許可（branch: `claude/agent-autonomous-execution-ewtk87`、根拠: セッション割当の開発ブランチ。AD-003）。PR は #32 を更新する（AGENTS.md §21）

Implementation: ALLOWED

## Goal

第一章の本編では、旧セーブに残っている成長・変化系データのうち、まだ本編へ影響している A-1 Skill 2 の alt、A-2 必殺技の alt、A-3 Skill 1 の新技（skill1Alt）、A-4 上位職の Skill 1 を無効化する。旧セーブの値そのものは削除・変換しない（Human、2026-10-04）。

## Implementation Plan

| Step | ファイル | 変更 |
| --- | --- | --- |
| 1 | `src/legacy/parts/12-progression-ui.js` | 判定の関数を 3 つ置く: `skill2AltAvailable()` / `ultAltAvailable()`（`legacyGrowth()` かつ解放済み）、`skill1VariantUsable(v)`（解放条件の無い技は常に可。`skill1Alt` は `legacyGrowth()` かつ解放済み、`job` は `legacyGrowth()` かつ転身済み） |
| 2 | 同上 | 戦闘・HUD: `activeSkill2Def` と `recomputeStats` の ult が上の判定を使う。Skill 1 は `activeSkill1Variant()`（使えない技なら `defaultSkill1For(class)` の技）を新設し、同じ式の 4 か所（`updateSkillButtonIcon`・`releaseSkill`・溜めリング・`currentSwordsmanGlyphIds`）をこれに置き換える |
| 3 | 同上 | 鑑定所のスキル画面: スキル1・スキル2・必殺技のサブタブが同じ判定を使う（使えない alt・技は出さない・選べない。「固定」の表示は新規ゲームと同じ） |
| 4 | `tests/unit/chapter1-growth-effects.test.js` | legacy の構造（判定の関数・読む所が判定を通ること・`getChargeVariants()[state.skillChoice]` の直接参照が残っていないこと） |
| 5 | `tests/chapter1-old-save-growth.spec.js` | 旧セーブ（魔法使い、洋館クリア後。alt 3 つ解放・選択済み、上位職と上位職の技）と、alt の無いセーブで、HUD の Skill 1 / Skill 2 / 必殺技のアイコンが同じこと・鑑定所に alt・新技・上位職の技が出ないこと・セーブの値が残ること。テストモードでは alt が出て選べること |

## Files To Change
上の表のファイルと `.ai/` の記録（本 Task file、review report）

## Files Not To Change
`basefile.html`、`09-save-load.js`（ロードの復元・フォールバックは変えない）、`normalizeChapter1Load`・主人公の交代（`defaultSkill1For` / `learnedSkill2` のリセット）、`core/chapter1-rules.js`（`CHAPTER1_SKILL1` に行を足さない）、Skill 2 の閃き、鍛冶屋・施設の進行、装備タブ（UI-002-F C-4）、スキル1 の基本技の付け替え（C-1）、スフィア盤・テストモードの初期化

## Test Plan
- build / unit 全体 / `ai-protocol`
- 新規 unit・E2E が変更前の src で FAIL し、変更後に PASS
- E2E 全体（2 CPU）: `chapter1-skill2`・`chapter1-progression`・`chapter1-dusk-basics`・`auto-combo`・`job-traits`・`ui-production-glyphs`・`base-class-*`・`combat-test-arena` 等を含む

## Acceptance Criteria
- AC-R1〜R4 本編では、旧セーブの A-1〜A-4 の値が戦闘・HUD・鑑定所の表示と付け替えに出ない
- AC-R5 正常な第一章の Skill 1 / Skill 2 / 必殺技（新規ゲーム・閃き）は変わらない
- AC-R6 主人公の交代は変わらない（`defaultSkill1For` / `learnedSkill2 = false`）
- AC-R7 セーブの値は残る（`unlockedSkill1Alt / Skill2Alt / UltAlt`・`skill2Choice`・`ultChoice`・`skillChoice`）
- AC-R8 テストモードでは alt・新技・上位職の技を今まで通り選べて使える

## Risks
- 旧セーブで alt・新技を使っていたプレイヤーには、本編で技が既定に戻って見える（決定どおり）
- 本編で使えない技が選ばれた状態で、鑑定所のスキル1 は既定の技に「選択中」の印が付く（実際に使う技と同じ）。保存値は元の技のまま

## Rollback
PROGRESSION-003 の実装 commit を revert する

## Out of Scope
- UI-002-F の C-1〜C-5（Skill 1 の付け替え・剣士/盗賊/弓師の Skill 1・スキル画面の役割・装備の道具・`learnedSkill2` キー無し）
- 上位職の Skill 1 が保存された旧セーブで、本編のロード後のセーブに `job:null` が書かれ、次のロードで `skillChoice` が `retreat` に戻る既存の挙動（WORK 12.1 の `normalizeChapter1Load`。今回は変えない）
- Chapter 2 での alt・付け替え

## Agent Decisions
| # | 決定 | 根拠ソース（AGENTS.md §17.2） | 代替案 |
| --- | --- | --- | --- |
| R-1 | 読む所で止め、判定は 3 つの関数にまとめる | PROGRESSION-001 / 002 と同じ。戦闘と画面が同じ関数を使うので条件が散らばらない | ロード時に `state` の値を書き換える（保存値が変わる） |
| R-2 | Skill 1 の技の解決 4 か所を 1 つの関数へ置き換える | 同じ式の重複。1 か所でも gate が漏れると技とアイコンが食い違う | 4 か所それぞれに条件を足す |
| R-3 | 使えない技のときは `defaultSkill1For(class)` | 新規開始・交代で既に使っている既定。新しい既定を作らない（剣士・盗賊・弓師は従来どおり `retreat`、C-2 は未決定のまま） | `retreat` 固定（魔法使いだけ新規ゲームと食い違う） |
| R-4 | 上位職の技も `legacyGrowth()` で判定する | 本編では `normalizeChapter1Load` が `job` を外すが、ロードの順序に依存しない（判定を読む所に置く） | `state.job` だけを見る |
