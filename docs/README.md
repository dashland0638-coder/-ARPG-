# Game Documentation

## Purpose

このディレクトリはソウルフォージ・プロトタイプの正式なゲーム仕様を管理する。

AIエージェント（Analyzer / Planner / Claude Code / Debugger / Reviewer）は、
ゲーム仕様を判断する必要があるとき、まずここを参照する。

## Documents

### [GAME_DESIGN.md](./GAME_DESIGN.md)
ゲーム全体の基本方針。

### [CHARACTERS.md](./CHARACTERS.md)
キャラクター、職業、役割。

### [COMBAT.md](./COMBAT.md)
通常攻撃、ステップ、スキル、戦闘仕様。

### [PROGRESSION.md](./PROGRESSION.md)
成長、装備、スキル取得、クリア後要素。

### [SCENARIOS.md](./SCENARIOS.md)
Chapter 1、シナリオ、ダンジョン、進行。

### [CHAPTER1_STORY.md](./CHAPTER1_STORY.md)
Chapter 1 後半（村 → 幽霊船 → 時計塔 → 道）の物語接続。正体不明の人物の扱い。

### [CHAPTER1_PLAYTEST.md](./CHAPTER1_PLAYTEST.md)
Chapter 1 の実機通しプレイのチェックリストと Content Ready の判定基準（CQ-01）。

### [ARCHITECTURE.md](./ARCHITECTURE.md)
ゲーム実装上のアーキテクチャ（AIが実装変更時に守るルール）。

## Chapter 1 Index

Chapter 1 の仕様を追うときの入口。各項目の正本だけを指す（内容はリンク先）。

| 知りたいこと | 正本 | 補足 |
| --- | --- | --- |
| 5段の構成・主人公と支援・一本道 | [SCENARIOS.md](./SCENARIOS.md) Chapter 1 Main Scenarios | 判定の実装は `src/core/chapter1-progress.js` |
| 物語の接続（村 → 幽霊船 → 時計塔 → 道） | [CHAPTER1_STORY.md](./CHAPTER1_STORY.md) | 決定記録 `.ai/decisions/DEC-004-chapter1-story.md` |
| 森の洋館 | ルートの `MANSION_SCENARIO.md`（一次資料）、要点は [SCENARIOS.md](./SCENARIOS.md) Chapter 1-① | |
| 宵待ちの村 | `.ai/decisions/DEC-001-duskvillage-rebuild.md` | 実装の経緯は `.ai/reports/DUSKVILLAGE-WORK*-report.md` |
| 幽霊船・時計塔・道 | [CHAPTER1_STORY.md](./CHAPTER1_STORY.md) §4 / §7 | 数値と確認項目は `.ai/reports/CHAPTER1-GHOSTSHIP-balance.md` / `CHAPTER1-CLOCKTOWER-balance.md` / `CR-01-report.md` |
| 5人目（正体不明の人物 → 影の旅人） | [CHARACTERS.md](./CHARACTERS.md) 5人目、[CHAPTER1_STORY.md](./CHAPTER1_STORY.md) §3 | 攻撃の色は `.ai/decisions/DEC-005-wanderer-attack-color.md` |
| Chapter 1 の基本ルール（レベル無し・旧成長系は止める） | [PROGRESSION.md](./PROGRESSION.md) Level / Stats の「決定（WORK 12.1）」 | 判定は `src/core/chapter1-rules.js` の `legacyGrowthEnabled()` 一か所 |
| 装備（武器種の制限・鍛冶屋で出来ること・購入なし） | [PROGRESSION.md](./PROGRESSION.md) Equipment | `smithFacilityAvailable()` / `weaponUsableBy()` |
| スキル（Skill 1 固定・Skill 2 の閃き・付け替え不可） | [PROGRESSION.md](./PROGRESSION.md) Equipment、[COMBAT.md](./COMBAT.md) | `src/core/chapter1-skills.js`、`.ai/decisions/UI-002-human-decisions.md` |
| 異空間（裂け目）は第一章に無い | [PROGRESSION.md](./PROGRESSION.md) Level / Stats | PROGRESSION-008。洋館の「異常空間」（物語の一部）とは別物 |
| 進行と保存（scenarioClears から導く・新しいセーブ項目なし） | [SCENARIOS.md](./SCENARIOS.md) Chapter 1 Structure、[PROGRESSION.md](./PROGRESSION.md) Save Data | |
| 実機の通しと Content Ready 判定 | [CHAPTER1_PLAYTEST.md](./CHAPTER1_PLAYTEST.md) | CQ-01 |
| Chapter 1 の凍結（変えないもの） | `.ai/reports/CHAPTER1-CONTENT-plan.md` §0-2 | PROGRESSION-010 |

## Rule

このディレクトリに記載された仕様をゲーム仕様の正本とする。

仕様変更を行う場合は、実装変更だけでなく関連ドキュメントも更新する。

不明な仕様は推測で記載しない。確定していないものは **未確定** と明記する。

## Status Markers

各仕様には次のいずれかを付す。

| マーカー | 意味 |
| --- | --- |
| **確定** | 仕様として決定済み。実装もこれに従う |
| **確定（実装未反映）** | 仕様は決定済みだが、現在の実装がまだ追いついていない |
| **設計確定案** | 方向性は決まっているが、正式決定として実装を縛る段階ではない |
| **未確定** | 決まっていない。推測で埋めてはならない |
| **実装事実** | 現在の実装から確認できる事実。仕様としての是非は別途判断する |

## Related Directories

- `.ai/` — AI作業基盤（運用ルール・タスク・レポート・決定記録）。`.ai/AGENTS.md` 参照
- ルートの `ARCHITECTURE.md` / `ARPG_INTEGRATION.md` / `COMBAT_DESIGN.md` / `MANSION_SCENARIO.md` / `ASSETS.md`
  — 実装・設計の詳細記録（経緯つきの一次資料）。`docs/` はこれらを置き換えず、要点を整理して参照する

## Source Of Truth

AIエージェントは次の優先順位で情報を扱う。

1. `docs/` の正式仕様
2. `.ai/decisions/` の個別の設計決定
3. `.ai/tasks/` の作業指示
4. 現在の実装
5. AIの推測（原則として使わない）

ただし、**`docs/` の仕様と現在の実装が食い違う場合、勝手にどちらかを変更してはならない。**
差異は本ファイル末尾の Known Implementation Differences に記録し、対応は人間の判断を待つ。

## Known Implementation Differences

`docs/` に整理した仕様と、現在の実装（2026-09時点、調査済み）との差異。
**Action Required は本ドキュメント整備時点では未実施。** 実施可否は人間が判断する。

### D-01: 上位職の武器名

- **Specification**: 戦騎士は長剣（CHARACTERS.md）
- **Current Implementation**: 上位職は `state.job` の上乗せフラグで、武器種キーは基礎職のまま
  （戦騎士も `weaponType: 'greatsword'`）。見た目だけ「細く長い装飾剣」へ差し替えている
  （`src/legacy/parts/06-player-enemy.js`、`weaponKey==='greatsword' && state.job==='battleKnight'`）
- **Difference**: 仕様上の名称（長剣）と実装上の武器種キー（greatsword＝大剣）が一致しない。
  バーサーカー（両手斧）・鷹の目（大弓）は見た目・意匠とも仕様どおり
- **Action Required**: 表示名だけを仕様に合わせるか、仕様側を「大剣を細身化した意匠」と書き換えるかの判断。未実施

### D-02: Chapter 1 のスフィア盤（奥義の環）

- **Specification**: Chapter 1 ではスフィア盤を使用しない（PROGRESSION.md）
- **Current Implementation**: 奥義の環（旧称スフィア盤）は実装済みで、レベルアップごとに
  `state.spherePoints` が1点増え、鑑定所のタブから常時振れる
  （`src/legacy/parts/12-progression-ui.js` の `SPHERE_NODES` ほか）
- **Difference**: Chapter 1 の簡略化方針と、現行の常時開放が食い違う
- **Action Required**: Chapter 1 中のロック（またはクリア後解放）の要否を決定。
- **Status（2026-10-08）**: **解消**。WORK 12.1 で Chapter 1 の本編では奥義の環を動かさないと決定・実装済み（`sphereValue()` は本編で 0、画面も出ない。`core/chapter1-rules.js` の `legacyGrowthEnabled()`）。テストモードだけで動く

### D-03: 章進行とダンジョンの対応

- **Specification**: ③弓師＋魔法使い → 幽霊船／温室、④盗賊＋弓師 → 宵待ちの村の別展開（SCENARIOS.md）
- **Current Implementation**: `CHAPTER_CAST`（`src/legacy/parts/01-character-creation.js`）は
  ②mage＋guest warrior → `duskvillage`、③archer＋guest mage → `ghostship`、
  ④rogue＋guest archer → `clocktower`。章とダンジョンは 1:1 の暫定対応で、
  コメントに「章とダンジョンの1:1対応はまだ実装していない」と明記されている
- **Difference**: ②④の担当ダンジョンが仕様と実装で異なる。温室は章に紐づいていない
- **Action Required**: 章とダンジョンの正式な対応表を決定してから実装。
- **Status（2026-10-08）**: **解消**。HD-C1 で ④ = 時計塔、WORK 11 で ⑤ = 道、HD-C4 で温室 = 第一章クリア後の Extra と決まり、`CHAPTER_CAST` / `CHAPTER1_ORDER` が一致している（SCENARIOS.md）。温室への接続だけ未実装（CX-01）

### D-04: 章の自動進行・サポートAI

- **Specification**: 主人公が交代し、前章の主人公がサポートAIになる（SCENARIOS.md）
- **Current Implementation**: 実際に開始できるのは第一章（剣士・単独）のみ
  （`applyChapterCast(1)` の固定呼び出し）。`guestClassKey` は定義のみで未使用。
  同行AI自体は `companion`（`src/legacy/parts/08-loot-equipment.js`）として別途存在する
- **Difference**: 章の自動進行・ゲストのパーティAI・章連動のシナリオロックが未実装
- **Action Required**: 実装スコープが大きいため、別タスクとして分析・計画する。
- **Status（2026-10-08）**: **解消**。WORK 10 / WORK 11 で段の自動進行（`scenarioClears` から導く）・支援AIの切り替え・一本道の出撃制限を実装済み（`core/chapter1-progress.js`）

### D-05: ボス能力の取得者

- **Specification**: ボスから特殊能力を取得する仕組みは5人目のキャラクターだけが関係する（CHARACTERS.md）
- **Current Implementation**: `BOSS_ABILITIES`（`src/legacy/parts/12-progression-ui.js`）は
  ボス撃破で誰でも獲得できる常時パッシブ（回避無敵+20%、ゴールド+15% など6種）
- **Difference**: 取得者の限定が実装に無い
- **Action Required**: 5人目専用の仕組みを別系統で作るのか、既存 `BOSS_ABILITIES` を作り替えるのかを決定。未実施
- **Status（2026-10-08）**: Chapter 1 の本編ではボス能力は効かない（`bossAbilityValue()` は本編で 0）。差異が残るのはテストモードと Chapter 2 以降。決定は未実施のまま

### D-06: キャラメイクに関する README の記述

- **Specification**: 章ごとに主人公が固定される（SCENARIOS.md / CHARACTERS.md）
- **Current Implementation**: 2部制導入（#41）でキャラメイクは廃止済み。
  職業・性別・性格・名前は `CHAPTER_CAST` で固定され、名前入力欄も撤去されている
  （`src/legacy/parts/01-character-creation.js`）
- **Difference**: ルート `README.md` の「遊び方」が今も「職業・性別・性格・名前を決め、ダイスで能力値を割り振ってキャラを作る」と書いている
- **Action Required**: ルート README の更新（今回の docs/ 整備では対象外のため未実施）

### D-07: 「廃村」という名称

- **Specification**: 独立ステージ「廃村」は存在せず、「宵待ちの村」として扱う（SCENARIOS.md）
- **Current Implementation**: world key は `duskvillage`、表示名も「🏮 宵待ちの村」で仕様と一致。
  ただしシナリオ説明文とコード中コメントに「廃村」の語が残る
  （`src/legacy/parts/12-progression-ui.js` の `SCENARIO_DEFS`）
- **Difference**: 実装上の world key / 表示名に問題はない。説明文中の語のみ
- **Action Required**: 文言を直すかどうかの判断のみ。**world key `duskvillage` は変更しない**。未実施
