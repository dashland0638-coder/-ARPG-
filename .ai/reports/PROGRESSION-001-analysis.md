# PROGRESSION-001 Analyzer report（次の開発項目の特定と、選んだ項目の調査）

| 項目 | 値 |
| --- | --- |
| Task ID | PROGRESSION-001 |
| Branch | `claude/agent-autonomous-execution-ewtk87` |
| 基準 SHA | `4baf9b12efb7597fb03af62a3fa3a2448cac2933`（PR #32 の head。CI green） |
| Persisted by | Agent（Orchestrator。AGENTS.md §5.2） |
| 日付 | 2026-10-02 |
| Goal（Human） | 現在のゲーム仕様に基づき、まだ未完成で、実装可能性が高く、ゲーム全体の完成度に寄与する次の開発項目を 1 つ選び、完成させる |

## 1. 調査範囲

- `CLAUDE.md`、`.ai/AGENTS.md`、`.ai/tasks/*.md`（全 Task の Status）、`.ai/reports/`（CHAPTER1-WORK9〜12.1、DUSKVILLAGE-WORK、UI-002-*、CI-001 等）、`.ai/decisions/`（UI-002-human-decisions、DEC-001〜003、AGENT-DECISIONS）
- 仕様: `docs/`（README・SCENARIOS・PROGRESSION・CHARACTERS・COMBAT・GAME_DESIGN）、ルートの `COMBAT_DESIGN.md`・`MANSION_SCENARIO.md`・`README.md`・`ARPG_INTEGRATION.md`
- 実装: `src/legacy/parts/`（成長系の値の参照箇所を全数 grep）、`src/core/chapter1-rules.js`
- PR #32（main との差分 = Agent Protocol 2.0・UI-002-D WI-D2〜D7・CI-001）。CI は green（run #35・#36）

## 2. 候補（既に Human が決めた仕様に対して未完成なもの）

| # | 候補 | 根拠となる決定 | 状態 | 判断 |
| --- | --- | --- | --- | --- |
| C-1 | **Chapter 1 本編で、旧セーブに残る成長系の値（スフィア盤の効果・能力のランク・ボス能力・ボススキル）が戦闘値に効いている** | UI-002-HD「第一章のゲームデザイン境界」「旧セーブを破壊しない原則（第一章: 表示・入力・使用・新規入手を抑制する）」、AP-8 N-5（旧セーブのスフィア解放・ボス能力が本編の戦闘値に影響 → 別ゲーム状態 Task 候補）、CHAPTER1-WORK12.1 §3（「古いセーブに残っている値も、本編では効かせない」） | 不完全な実装（下の §3） | **選択** |
| C-2 | 旧セーブの Skill 2・必殺技の派生（スフィア盤で解放した alt）の付け替え | AP-8 N-4（UI 部分は UI-002-F、ゲーム状態部分は別 Task 候補） | 派生技の選択は鑑定所の Skill 画面に表示されている。効果だけ止めると表示と食い違う | 今回は扱わない（UI-002-F と一緒に決める必要がある） |
| C-3 | 上位職の glyph の判定を `jobActive` に合わせる | UI-002-E の Out of Scope Found | 古いセーブの稀な状態で emoji へ fallback するだけ（表示の意味は保たれる）。実装報告に「仕様変更として別 Task」 | 優先度低 |
| C-4 | UI-002-F / G / H / I（Menu・Tavern・Dialog・最終調整） | HD-5（Task 起票）、AP-8 の送り先 | DRAFT。施設 UI・設定項目・通知履歴等が Undecided。画面の具体的な形は Human の UI 判断が要る | 今回は扱わない（Human 未決定の UI 仕様を決めることになる） |
| C-5 | 章とダンジョンの正式な対応（弓師の温室、盗賊の「宵待ちの村の別展開」）、影の旅人の戦闘の型、各職の Skill 2 の閃き、Chapter 2 | SCENARIOS.md「確定」の一部、CHAPTER-STRUCTURE Unknowns 1〜8、WORK 11 / 12 / 12.1 の要判断事項 | 内容（シナリオ・設定・ゲームデザイン）が未決定 | Human Decision が前提（今回は決めない） |
| C-6 | MAGE-001（魔法使い Skill 1 のデコイ） | docs/COMBAT.md（「設計確定案 ―― 正式決定ではない」） | Unknowns の決定が先 | Human Decision が前提 |
| C-7 | COMBAT_DESIGN の未着手（ボスの視線を予兆に使う、魔導士の設置型フィールド等） | 外部 design の番号のみ。具体仕様なし | 上位職（Chapter 2 側）の演出・新しい状態 | ゲームデザインの判断が要る |
| C-8 | 文書の古い記述（docs/README D-03 / D-04、ルート README のキャラメイク） | docs/README D-06（ルート README の更新） | 章の進行（WORK 10〜12）が実装済みになったのに未反映 | 完成度への寄与が小さい（ゲームの挙動は変わらない）。今回は扱わない |
| C-9 | UI-002-D の Task 全体の Status（PLANNED のまま。WI-D1〜D7 は DONE） | AGENTS.md §7.1 | 記録だけ | 次の UI-002 作業でまとめて扱う |

## 3. C-1 の調査（FACT = コードで確認）

- Chapter 1 の本編では `legacyGrowth()`（`01-character-creation.js`、`core/chapter1-rules.js` の `legacyGrowthEnabled(state.testMode)`）が false。テストモードだけ true
- **新規入手は止まっている（FACT）**: ボス撃破の 3 択（`renderBossChoicePanel`）は `if(legacy)` の中、初回クリアの「習得の証」（`grantFirstClearRank`）は `!legacyGrowth()` で return、鑑定所の stat / sphere タブ・Skill の passive / skill3 サブタブは本編で出ない
- **ステータスの一部は既に効かせていない（FACT）**: `recomputeStats` はレベル成長・振り分け・パッシブ・武具強化・上位職を `legacy` のときだけ数える（WORK 12.1）。必殺技の倍率のスフィア効果（`ultDmgSphereMul`）も `legacy ? sphereValue(...) : 0`
- **効いたままのもの（FACT）**:

| 値（旧セーブに残る） | 読む関数 | 参照箇所（効果） |
| --- | --- | --- |
| `unlockedSphereNodes`（スフィア盤） | `sphereValue(type)` | 攻撃力 `atkMul`（`recomputeStats`）、攻撃の間隔 `atkCooldownMul`、Skill 1 の再使用・威力、Skill 2 の再使用・威力、回避の無敵、回避後の攻撃猶予、バリアの回復、必殺ゲージ、スタミナ消費、体幹削り（計 14 箇所。`ultDmgSphereMul` の 1 箇所だけ gate 済み） |
| `ranks`（能力の強化 ★） | `rankOf(k)` → `rankDmg` / `rankArea` / `rankCD` | Skill 1・Skill 2・必殺技の威力・範囲・再使用 |
| `equippedBossAbilities`（ボス能力） | `bossAbilityValue(effect)` | 最大 HP、被ダメージ、回避の無敵、体幹削り、必殺ゲージ、ゴールド獲得 |
| `learnedBossSkills`（ボススキル） | `triggerBossSkills(hook)` | フィニッシュ命中・撃破・ダウン・必殺技の発動での自動発動（ゲージ・体幹・回復・トースト） |

- 本編で見える値: メニューの HP（`menu-hp`、最大 HP にボス能力「母樹の芯」+6%）と攻撃力（`menu-atk`、スフィア「剛力I」+5%）。どちらも旧セーブの値で上がる（INFERENCE: 上の式から。E2E で確認する）
- これらを表示・操作する UI（passive サブタブ・sphere タブ・ボス報酬）は本編では出ない。効果だけが残っている = 「表示・入力・新規入手は抑制済み、**使用だけが未抑制**」
- 新しく始めた Chapter 1 の本編では、これらの値は空（`beginGame` が初期化し、入手経路は止まっている）。影響を受けるのは旧セーブ（2 部制・WORK 12.1 より前のセーブ）だけ

## 4. 選択理由（C-1）

1. **仕様が既に決まっている**: 「第一章ではスフィア盤ライクな成長・キャラクター強化・スキル強化を存在させない」「旧セーブは本編で使用を抑制する（削除・変換はしない）」は Human Decision。WORK 12.1 も同じ方針で、同じ種類の値（レベル・振り分け・パッシブ・強化・上位職）を本編で効かせないようにしている。AP-8 N-5 で Human がこの食い違いを問題として送り先を決めている
2. **実装が不完全であることがコードで確定している**: 同じ `sphereValue` の 15 箇所のうち 1 箇所だけ gate があり、残りは無い。WORK 12.1 の報告（「Sphere Board / Passive / Crafting なし ✅（本編では開けない・効かない）」）と実装が食い違っている
3. **ゲームの完成度に直接効く**: 旧セーブで遊ぶプレイヤーの Chapter 1 の戦闘バランス（攻撃力・最大 HP・回避・ゲージ）が、Chapter 1 の設計値からずれている
4. **ゲームデザインを新しく決めない**: 新しい仕組み・数値・UI を足さない。既存の `legacyGrowth()` の判定を、既存の参照箇所の入口に足すだけ。テストモード（Chapter 2 の基盤）の挙動は変わらない
5. **実装可能性・Regression risk**: 変更は読み取り関数 4 つ（`sphereValue` / `rankOf` / `bossAbilityValue` / `triggerBossSkills`）の入口。新規ゲームでは値が空なので挙動は変わらない。E2E で旧セーブを読み込んで確かめられる

他の候補（C-2〜C-9）は、Human の未決定事項（UI・シナリオ・ゲームデザイン）が前提か、完成度への寄与が小さい（§2）。

## 5. 範囲

- 含める: スフィア盤の数値効果・能力のランク・ボス能力・ボススキル（自動発動）を、Chapter 1 の本編では効かせない。値は消さない・変換しない（テストモード・将来の Chapter 2 では今までどおり効く）
- 含めない: スフィア盤で解放した派生技（Skill 1 / Skill 2 / 必殺技の alt）の付け替え（C-2。鑑定所の Skill 画面の表示と一緒に UI-002-F で扱う）、Skill 3（UI-002-A WI-A2 で本編では止まっている）、旧セーブの正規化（Human Decision「別 Task」）
