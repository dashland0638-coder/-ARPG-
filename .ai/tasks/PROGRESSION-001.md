# PROGRESSION-001

Status: IMPLEMENTING

Analysis: .ai/reports/PROGRESSION-001-analysis.md（branch `claude/agent-autonomous-execution-ewtk87` @ `d225e9e0de82d48462dbb85d75879d856ea73752`、blob `4c56d188f0aae9a85dfb7be09a4e299cd1796471`）

## Approval
- [x] Approved
- Approval type: Agent Approval（`../AGENTS.md` §6.1）
- Escalation Check: None（E-1: 仕様は変えない。Human Decision「第一章: 表示・入力・使用・新規入手を抑制する」の未実装部分を実装する / E-2: Decision Record との矛盾なし（UI-002-HD・AP-8 N-5・CHAPTER1-WORK12.1 §3 と同じ方向）/ E-3: 新しい仕様・数値・UI の追加なし / E-4: 破壊的変更なし（セーブの値は消さない・変換しない）/ E-6・E-7・E-9: 該当なし）
- Approved by / date / where: Planner (Agent) / 2026-10-02 / branch `claude/agent-autonomous-execution-ewtk87`
- Scope of approval: 下の Files To Change
- Persistence: 許可（branch: `claude/agent-autonomous-execution-ewtk87`、根拠: セッション割当の開発ブランチ。AD-003）。PR は #32 を更新する（AGENTS.md §21）

Implementation: ALLOWED

## Goal

現在のゲーム仕様に基づき、まだ未完成で、実装可能性が高く、ゲーム全体の完成度に寄与する次の開発項目を Agent が 1 つ選び、完成させる（Human、2026-10-02）。選んだ項目: Chapter 1 の本編で、旧セーブに残る成長系の値（スフィア盤・能力のランク・ボス能力・ボススキル）を効かせない（Analysis §4）。

## Analysis の追補（計画中の確認）

- スフィア盤の数値効果を読む関数は `sphereValue` のほかに `sphereVariantBonus(variantKey)`（Skill 1 の派生ごとの強化。`13-update-loop.js:259`）がある。同じ値（`unlockedSphereNodes`）の数値効果なので同じ扱いにする
- `rankOf` は鑑定所の「能力の強化」画面（本編では出ない passive サブタブ）の表示・購入判定でも使う。表示・購入はそのまま（テストモードの画面の挙動を変えない）、効果の 3 つ（`rankDmg` / `rankArea` / `rankCD`）だけを gate する

## Implementation Plan

| Step | ファイル | 変更 |
| --- | --- | --- |
| 1 | `src/legacy/parts/12-progression-ui.js` | `sphereValue` / `sphereVariantBonus` / `bossAbilityValue` の入口に `if(!legacyGrowth()) return 0;`、`triggerBossSkills` の入口に `if(!legacyGrowth()) return;` |
| 2 | 同上 | `rankDmg` / `rankArea` / `rankCD` は `rankEffect(k)`（`legacyGrowth() ? rankOf(k) : 0`）を使う。`rankOf` 自体（画面の表示・購入）は変えない |
| 3 | 同上 | `recomputeStats` の `legacy ? sphereValue('ultDmgSphereMul') : 0` は `sphereValue` の gate と重複するが、動作は同じなので変えない（不要なリファクタリングをしない） |
| 4 | `tests/unit/chapter1-growth-effects.test.js`（新規） | legacy の構造: 5 関数の入口に gate があり、rank の効果が `rankEffect` を通ること（変更前の src で FAIL） |
| 5 | `tests/chapter1-old-save-growth.spec.js`（新規） | 旧セーブ（スフィア「剛力I」・ボス能力「母樹の芯」・ランク・ボススキル）と、成長の値が空のセーブを本編で続きから始め、メニューの最大 HP・攻撃力が同じであること（変更前は異なる）。値はセーブに残る（セーブし直しても消えない） |

## Files To Change
上の表のファイルと、`.ai/` の記録（本 Task file、review report）

## Files Not To Change
`basefile.html`、`src/core/chapter1-rules.js`（判定 `legacyGrowthEnabled` はそのまま使う）、セーブの読み書き（`09-save-load.js`。値を消さない・変換しない）、鑑定所の画面（表示・タブの出し分けは UI-002 の範囲）、派生技の付け替え（`activeSkill2Def`・必殺技の alt。Analysis C-2）、既存の spec・assertion、`playwright.config.js`、workflow

## Test Plan
- build / unit 全体 / `ai-protocol`
- 新規 unit が変更前の src で FAIL し、変更後に PASS すること
- 新規 E2E が変更前の src で FAIL し、変更後に PASS すること（2 CPU、`taskset -c 0-1`）
- 関連 E2E（2 CPU）: `save-load`、`base-class-*`、`job-traits`、`execution-break`、`air-actions`、`mansion-*`、`combat-test-arena`（テストモードで成長が効くこと）、`chapter1-*`・`tavern-smith-greeting`

## Acceptance Criteria
- AC-P1 Chapter 1 の本編（`state.testMode` が false）では、旧セーブのスフィア盤・能力のランク・装着中のボス能力・習得済みのボススキルが戦闘値・自動発動に影響しない
- AC-P2 テストモードでは今までどおり効く（`legacyGrowth()` が true の時の式は変更前と同じ）
- AC-P3 セーブの値は消えない・変わらない（続きから始めてセーブし直しても残る）
- AC-P4 新しく始めた本編の挙動は変わらない（値が空なので gate の前後で同じ）
- AC-P5 既存の unit・E2E に回帰が無い

## Risks
- 旧セーブで遊ぶプレイヤーには、本編の攻撃力・最大 HP 等が下がって見える（仕様どおり。Human Decision の「使用を抑制する」）
- `legacyGrowth()` は毎回 `state.testMode` を読むだけで、呼び出しの頻度が増えても負荷は無視できる

## Rollback
PROGRESSION-001 の実装 commit を revert する

## Out of Scope
- 派生技（Skill 1 / Skill 2 / 必殺技の alt）の付け替え（Analysis C-2。UI-002-F と一緒に）
- 旧セーブの正規化（Human Decision「別 Task」）、鑑定所の画面の変更

## Agent Decisions
| # | 決定 | 根拠ソース（AGENTS.md §17.2） | 代替案 |
| --- | --- | --- | --- |
| P-1 | 値を読む関数の入口で gate する（参照箇所ごとには書かない） | WORK 12.1 と同じ判定（`legacyGrowth()`）。参照箇所は 22 か所あり、1 か所ずつ書くと漏れる（現に `ultDmgSphereMul` の 1 か所だけ書かれていた） | 参照箇所ごとに `legacy ?` を書く |
| P-2 | `rankOf` は変えず、効果の 3 関数だけ gate | `rankOf` は画面の表示・購入判定でも使う。画面の挙動（テストモード）を変えない | `rankOf` を gate（画面の表示が 0 になる） |
| P-3 | `sphereVariantBonus` も対象に含める | Analysis の対象（スフィア盤の数値効果）と同じ値・同じ種類の効果 | 含めない（同じ値の一部だけが効き続ける） |
| P-4 | E2E の観測はメニューの HP・攻撃力 | 本編で見える既存の表示（`refreshMenuStats`）。テスト用の hook を足さない | `window` へテスト用の値を出す（src の変更が増える） |
