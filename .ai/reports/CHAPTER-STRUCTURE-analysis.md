# Chapter Structure Analysis

Analyzer / READ ONLY。本レポート作成にあたりゲームコード（`src/` / `docs/` / `tests/` / package）は一切変更していない。

関連 Task: [`../tasks/CHAPTER-STRUCTURE.md`](../tasks/CHAPTER-STRUCTURE.md)

> **改訂（WORK 12.1 後の再調査）**
> 本レポートの旧版は WORK 1 時点（章進行が Arc 1 しか無かった頃）の調査だった。
> その後 WORK 9〜12.1 で Chapter 1 の進行・主人公交代・支援AI・道（road）が実装され、
> 旧版の「Arc 2〜5 を開始する経路が無い」「Support AI の設定経路はテストモードのみ」は
> **事実でなくなった**。本版は現在の `main`（`501a320`）のコードを読み直して全面的に書き直したもの。

---

## Correct Concept

Chapter と Scenario は別の階層である。

```
Chapter 1（第一章全体・固定進行）
├─ Character Arc 1: 剣士 主役パート        Support AI: なし
│    └─ Scenario: 森の洋館        → Stage: mansion
├─ Character Arc 2: 魔法使い 主役パート    Support AI: 剣士
│    └─ Scenario: 宵待ちの村      → Stage: duskvillage
├─ Character Arc 3: 弓師 主役パート        Support AI: 魔法使い
│    ├─ Scenario: 幽霊船          → Stage: ghostship
│    └─ Scenario: 温室            → Stage: conservatory   ※仕様上。実装の本編には未接続
├─ Character Arc 4: 盗賊 主役パート        Support AI: 弓師
│    └─ Scenario: 【未確定】（仕様:「宵待ちの村の別展開・関連エリア」／実装: clocktower を仮置き）
└─ （実装側の追加）Arc 5: 影の旅人 ―― 道（road）の途中で出会い主人公になる

Chapter 2（第二章・自由進行）
└─ キャラ自由選択 / 3人パーティ / ダンジョン自由選択 / 高自由度の成長 … を段階的に解放
   ※ 現在は「入口のカード（🔒 準備中）」だけが存在する
```

| 用語 | 意味 | 実装上の対応 |
| --- | --- | --- |
| **Chapter** | 物語・ゲーム進行上の大区分 | **実行時の状態は無い**（`state.chapter` 無し）。Chapter 1 か否かは `scenarioClears` から導出 |
| **Character Arc（主役パート）** | Chapter 内で特定キャラが主役の区間 | `CHAPTER_CAST[n]`（n = 1..5）。フィールド名は `chapter` だが意味は Arc 番号 |
| **Scenario** | 具体的な物語・ゲームプレイ単位 | `SCENARIO_DEFS` の1エントリ（`key` / `name` / `desc`） |
| **Dungeon / Stage** | 実際にプレイするステージ | `WORLD_DEFS` の world key（`buildWorld(key)`） |
| **Scenario Test** | 特定シナリオを直接起動する開発用の仕組み | **既に実装済み**（テストモード画面の「シナリオ」欄。WORK 1 / 4 / 12.1） |

注意: 実装では **Scenario key と world key が同一の文字列**（`mansion` など）。
1 Scenario = 1 Stage が今は常に成り立っているため、両者を区別するデータ構造は無い。
仕様上 Arc 3 は「幽霊船 → 温室」の2 Scenario なので、将来 Arc : Scenario = 1 : N を表現する必要がある。

---

## Current Implementation

### 全体像（WORK 12.1 時点）

| 仕組み | 場所 | 概要 |
| --- | --- | --- |
| Chapter 1 の主役表 | `CHAPTER_CAST`（`src/legacy/parts/01-character-creation.js:273`） | 5段。`{chapter, classKey, gender, personality, guestClassKey, dungeonKey}` |
| Chapter 1 の順序と導出 | `src/core/chapter1-progress.js` | `CHAPTER1_ORDER = ['mansion','duskvillage','ghostship','clocktower','road']`。**状態を持たない**。`scenarioClears` から段・主人公・次の行き先を導く |
| Chapter 1 のルール | `src/core/chapter1-rules.js` | 旧ハクスラ系の隔離（`legacyGrowthEnabled(testMode)`）、武器制限、Skill 1 既定、HUD、交代の一幕のタイミング |
| Chapter 1 のスキル | `src/core/chapter1-skills.js` | Skill 2 の閃き（`hasSkill2` は `testMode` で常に true） |
| 主人公交代 | `advanceChapter1Cast()` / `switchProtagonist()` / `meetChapter1Protagonist()`（`14-hud-boot.js:1437〜`） | 酒場帰還時と道の出会いの一幕だけで交代 |
| 行き先 | `offeredScenarios()` → `renderScenarioList()`（`12-progression-ui.js:1531`） | 酒場の出撃メニューに **次の1つだけ** を出す。章を終えると「🧭 この先の旅 🔒 準備中」 |
| シナリオ起動 | `launchScenario(key)` → `launchScenarioNow(key)`（`12-progression-ui.js:1651`） | `scenarioKey` → `routeReset` → `buildWorld` → 入場座標・カメラ・味方再配置 |
| ワールド | `WORLD_DEFS`（`02-world-common.js:129`） | 10キー（下の Scenario List） |
| セーブ | `09-save-load.js` | Chapter 用の新規フィールドは無い。`saveGame()` は `state.testMode` で即 return（`:94`） |
| テストモード | `setupTestModeScreen()`（`01-character-creation.js`）→ `beginTestMode()`（`14-hud-boot.js:1326`） | 職業・転身・レベル・同行ゲスト・**シナリオ**・**開始地点** を指定して起動 |

### A. 現在「Chapter」と呼ばれているものの実体

コード上の「Chapter」は3種類ある。

| 出現 | 実際の意味 |
| --- | --- |
| `CHAPTER_CAST[n].chapter` | **Chapter 1 内の Character Arc 番号**（1..5）。コメント（`01-character-creation.js:248-252`）自身が「第1章〜第5章ではなく Chapter 1 の Scenario 1〜5」と明記し、WORK 10/11 の指示でフィールド名は変えていない |
| `chapter1-progress.js` / `chapter1-rules.js` / `chapter1-skills.js` の「Chapter 1」 | 正しい意味の **Chapter 1**（第一章全体） |
| `renderScenarioList()` の `scenario-chapter2` カード、`14-dungeon-road.js` のコメント | 正しい意味の **Chapter 2**（入口の表示だけ） |

→ **ランタイム上の Chapter は「`chapter1Complete(scenarioClears)` が false なら Chapter 1」という導出値のみ**。
`CHAPTER_CAST` のコメント冒頭には「各章の主人公」「第一章 / 第二章以降」という旧い言い回し（#41 当時）が残っており、
Arc と Chapter の混同はここが発生源。

### B. CHAPTER_CAST の意味

**「第一章（Chapter 1）の主役キャスト表」＝ Character Arc 表** である。「現在の Chapter」ではない。

根拠:
1. 5段すべてが Chapter 1 の主役交代順（剣士 → 魔法使い → 弓師 → 盗賊 → 影の旅人）
2. `guestClassKey` = 前の主役 ＝ Chapter 1 固有の「前の主役がサポートAI」ルール
3. `chapter1-progress.js` が「CHAPTER_CAST は Chapter 1 の固定設計データで、読むだけ」と明記
4. `dungeonKey` は `CHAPTER1_ORDER` と同じ並び（Arc ごとの代表 Scenario）。
   コメントに「③④は原案では2つのダンジョンにまたがるが…代表的な1つだけを仮に載せてある」

### C. 第一章の途中までしか進めない原因

**旧来の原因（`applyChapterCast(1)` しか呼ばれず Arc 1 から先へ行けない）は WORK 10 で解消済み。**
現在は本編で 洋館 → 宵待ちの村 → 幽霊船 → 時計塔 → 道 と Chapter 1 の最後まで経路がつながっている。

いま「第一章の途中まで」に見える／仕様どおりに進まない原因は次のとおり。

| # | 原因 | 根拠 |
| --- | --- | --- |
| C-1 | **Arc 3 の2つ目（温室）が本編に無い**。`CHAPTER1_ORDER` に `conservatory` が入っておらず、弓師 Arc は幽霊船1つで終わる | `chapter1-progress.js:36` |
| C-2 | **Arc 4 のシナリオが仕様と異なる（仮置き）**。仕様は「宵待ちの村の別展開」、実装は `clocktower` | `docs/SCENARIOS.md:38` / `CHAPTER_CAST[4]` |
| C-3 | **Chapter 1 の後が無い**。道を終えると出撃メニューは「🧭 この先の旅 🔒 準備中」だけで、行き先が0件 | `renderScenarioList()` / `offeredScenarios()` |
| C-4 | 洋館クリア → 酒場帰還 → 交代の一幕 を **実機で通した記録が無い**（SwiftShader 3〜7fps で洋館撃破まで到達できなかった） | `CHAPTER1-WORK12.1-report.md` §15/§16 |
| C-5 | 影の旅人は固有の戦闘キットを持たず、剣士の骨格を借りている（`CLASSES.wanderer.kit = 'warrior'`, `hidden:true`） | `01-character-creation.js:106` |

## Chapter 1

### Intended Structure

```
剣士（単独）→ 森の洋館 → クリア → 酒場 → 魔法使い登場
→ 魔法使い主役＋剣士支援 → 宵待ちの村 → クリア → 酒場 → 弓師登場
→ 弓師主役＋魔法使い支援 → 幽霊船 → 温室 → クリア → 酒場 → 盗賊登場
→ 盗賊主役＋弓師支援 → （未確定のシナリオ）→ …
```

- 開始時点で自由な3人パーティではない
- 主役は順番に切り替わり、前の主役がサポートAIとして同行する
- 切り替えは酒場・イベント・シナリオ進行で自然に発生（メニューからの自由選択ではない）

### Current Implementation

| 要素 | 状態 | 場所 |
| --- | --- | --- |
| 新規開始 = 剣士単独 | **実装済み** | `cc-start-btn` → `applyChapterCast(1)` → `beginGame()`（`guestClassKey = chapter1GuestKey()` = null） |
| 一本道（次の1つだけ出撃可） | **実装済み** | `offeredScenarios()`。クリア済みへの再訪・章外シナリオ（水路・神殿・温室）は本編では出ない |
| 進行の記録 | **実装済み（新フィールド無し）** | `state.scenarioClears` から `stageFor()` で導出。頭から連続クリア数で数える |
| 主人公交代（酒場帰還時） | **実装済み** | `returnToTownNow()` → `advanceChapter1Cast({rebuild:true, announce:!isDefeat})` |
| 交代の一幕（酒場で次の主役登場） | **実装済み**（mage / archer / rogue の3種の台詞） | `CHAPTER1_JOIN_LINES`、暗転明け後に開く `queueChapter1JoinScene` / `joinSceneReady` |
| ロード時の整合 | **実装済み** | `finishEnteringGame()` → `advanceChapter1Cast({rebuild:false})` → `normalizeChapter1Load()` |
| 5人目（影の旅人） | **実装済み（簡易）** | 道の途中の出会いで `meetChapter1Protagonist()`。撤退・全滅で盗賊＋弓師へ戻る |
| 旧ハクスラ系の隔離 | **実装済み** | `legacyGrowthEnabled(testMode)`：本編でレベル・ドロップ・転身・スフィア・パッシブ無効 |
| Skill 1 既定 | 魔法使い = 幻影歩法（`phantom`）、他は `retreat` | `defaultSkill1For()` |
| Skill 2 | 各主役がシナリオ中盤で閃く。交代で持ち越さない | `grantChapter1Skill2()`、宵待ちの村は商店街戦後 |

### Differences

| # | 仕様 | 実装 | 区分 |
| --- | --- | --- | --- |
| C1-1 | Arc 3 = 幽霊船 → 温室 | 幽霊船のみ。温室は本編に無い | 仕様との差 |
| C1-2 | Arc 4 = 宵待ちの村の別展開・関連エリア | `clocktower`（仮置き） | **未確定**（仕様の確定待ち） |
| C1-3 | 仕様の主役は4人（盗賊まで） | 実装は5段目に影の旅人（道で出会う）を追加 | 実装側の拡張（WORK 11）。仕様書への反映は未確認 |
| C1-4 | 「Chapter」と「Arc」の用語分離 | `CHAPTER_CAST.chapter` が Arc 番号を表す | 命名のみの差。挙動は正しい |
| C1-5 | 洋館クリア → 酒場の通し | unit / 部分 E2E のみ。実機未確認 | 検証の欠落 |

## Chapter 2

### Intended Structure

- キャラクター自由選択・3人パーティ・ダンジョン自由選択
- 第一章より自由度の高い成長（スフィア盤・育成施設・エンドダンジョン）
- 周回による高難易度化・マップ変異・強モブ出現
- 以上を **段階的に解放**

### Current Implementation

**Chapter 2 そのものは未実装。** 存在するのは「道を終えた後に出る 🔒 準備中 のカード」だけ。
構成要素の一部は旧コードとして残っているが、WORK 12.1 で **本編からは隔離され、テストモードでだけ動く**。

| 要素 | 状態 | 本編で動くか |
| --- | --- | --- |
| Chapter 2 の入口 | カードのみ（`scenario-chapter2`、押せない） | － |
| キャラクター自由選択 | **未実装** | ✕（テストモードでのみ任意クラス） |
| 3人パーティ | **未実装**。プレイヤー＋ゲスト1＋使い魔（companion）が上限 | ✕ |
| ダンジョン自由選択 | 旧UI（全シナリオ一覧）は WORK 11 で `offeredScenarios` に置き換え済み | ✕（テストモードでのみ全シナリオ） |
| スフィア盤（奥義の環） | コードは残存。鑑定所のタブは本編で非表示 | ✕（テストモードのみ） |
| レベル・装備ドロップ・転身・パッシブ | コードは残存。`legacyGrowthEnabled` で本編無効 | ✕（テストモードのみ） |
| 育成施設 | **未実装**（該当コード無し） | ✕ |
| エンドダンジョン / 深層ダンジョン | **未実装**（該当コード・world key 無し） | ✕ |
| 周回（★・`scenarioStars`・制限時間短縮） | コードは残存 | ✕（本編は一本道で再訪不可のため到達しない） |
| マップ変異 | 仕組みのみ（`ROUTE_MUTATABLE_NODES = {}` で休止） | ✕ |
| マップ追加（洋館★3/★4） | コードは残存 | ✕（周回不可のため到達しない） |
| 強モブ | 基盤あり（`core/enemy-tier.js` / Super Armor / Guardian）。周回連動の出現制御は未確認 | 基盤のみ |

### Differences

| # | 仕様 | 実装 |
| --- | --- | --- |
| C2-1 | Chapter 2 は自由進行パート | 入口のカードのみ。進入不可 |
| C2-2 | 3人パーティ | 未実装 |
| C2-3 | 育成施設・エンドダンジョン | 未実装 |
| C2-4 | 段階的解放 | 解放の順序・条件ともに未定義（仕様も未確定） |

**「実装済み」と誤記しないこと。** 上表で「コードは残存」とあるものは、Chapter 2 の基盤候補として旧コードが残っているだけで、Chapter 2 として動く状態ではない。

## Character Arcs

| Arc | 主役 | Support AI | 仕様上のシナリオ | 実装の Stage | 本編で到達 | 交代の場所 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 剣士 `warrior` | なし | 森の洋館 | `mansion` | ○ | 新規開始 |
| 2 | 魔法使い `mage` | 剣士 | 宵待ちの村 | `duskvillage` | ○ | 洋館クリア後の酒場 |
| 3 | 弓師 `archer` | 魔法使い | 幽霊船 → 温室 | `ghostship`（温室は未接続） | ○（幽霊船のみ） | 宵待ちの村クリア後の酒場 |
| 4 | 盗賊 `rogue` | 弓師 | **未確定** | `clocktower`（仮） | ○ | 幽霊船クリア後の酒場 |
| 4→5 | 盗賊 `rogue`（道の前半） | 弓師 | （実装のみ）道 | `road` | ○ | － |
| 5 | 影の旅人 `wanderer`（kit=warrior） | 盗賊 | **仕様に無い／未確定** | `road`（後半） | ○ | 道の途中の出会い（`MET_INSIDE`） |

## Scenario List

`SCENARIO_DEFS`（`12-progression-ui.js:1494`）と `WORLD_DEFS`（`02-world-common.js:129`）の突き合わせ。

| world key | 表示名（`SCENARIO_DEFS.name`） | `unlocked` | Chapter 1 本編 | Arc 対応 | 備考 |
| --- | --- | --- | --- | --- | --- |
| `mansion` | 🏚️ 囚われの洋館 | ○ | ○ 1番目 | Arc 1（確定） | 仕様名「森の洋館」。森＋洋館の一本道 |
| `duskvillage` | 🏮 宵待ちの村 | ○ | ○ 2番目 | Arc 2（確定） | **G. 宵待ちの村の world key は `duskvillage`**。開始地点10件登録済み |
| `ghostship` | 👻 幽霊船 | ○ | ○ 3番目 | Arc 3（確定） | |
| `clocktower` | 🕰️ 狂いの時計塔 | ○ | ○ 4番目 | Arc 4（**仮置き**） | |
| `road` | 🌅 道 | ○ | ○ 5番目（最後） | Arc 4→5（実装のみ） | ボス無し。影の旅人と出会う。開始地点3件。ミニマップ名「名もなき街道」 |
| `conservatory` | 🌿 硝子の温室 | ○ | ✕ | Arc 3（**仕様上**。実装は未接続） | 本編では出撃不可。テストモードからのみ |
| `waterway` | 💧 埠頭の地下水路 | ○ | ✕ | なし（本編外） | テストモードからのみ |
| `temple` | 🏛️ 古代神殿 | ○ | ✕ | なし（本編外） | テストモードからのみ |
| `pyramid` | 🏜️ 砂漠のピラミッド | ✕ | ✕ | なし | `WORLD_DEFS` に無い（構築関数無し） |
| `volcano` | 🌋 業火の火山 | ✕ | ✕ | なし | 同上 |
| `tavern` | （酒場） | － | 拠点 | － | `SCENARIO_DEFS` には無い |
| `training` | （トレーニング空間） | － | － | － | テストモード専用。`x>400` の領域 |

`WORLD_DEFS` のキーは `tavern / mansion / ghostship / waterway / temple / conservatory / clocktower / duskvillage / road / training` の10個。**新しい world を追加しない。**

## Support AI

**実装済み。** 本編の進行から自動で設定される。

| 要素 | 実装 | 場所 |
| --- | --- | --- |
| 状態 | `state.guestClassKey`（セーブ対象） | `09-save-load.js` |
| 本編での決定 | `chapter1GuestKey()` = `resolveCast(stage).guestClassKey` | `14-hud-boot.js:1453` |
| 実体 | `buildGuestCompanion(classKey)`、`syncAlliesToState()` | `08-loot-equipment.js` |
| 立ち位置 | プレイヤーの斜め後ろ約2.4m | WORK 12.1 §6 |
| 合流演出 | 宵待ちの村では剣士が木橋で待つ（`guestCompanion.waitAt`） | `14-dungeon-duskvillage.js` |
| 世界遷移 | `repositionAlliesToPlayer()`（`launchScenarioNow` が呼ぶ） | |
| HUD | `hudLabel()` →「魔法使い ｜ 支援: 剣士」 | `chapter1-rules.js` |
| テストモード | 「同行ゲスト」欄で任意指定。シナリオ選択時に Arc の正式な組み合わせを自動プリセット（`presetChapter1Cast`） | `01-character-creation.js` |
| 本編との分離 | `advanceChapter1Cast()` は `state.testMode` で即 return | `14-hud-boot.js:1468` |

別枠の `state.skills.companion`（「仲間を雇う」の使い魔）はゲストとは独立。

## Tavern Progression

| 対象 | 状態 | 仕組み |
| --- | --- | --- |
| 次の主役（魔法使い・弓師・盗賊） | **実装済み** | 酒場帰還時に交代 → 暗転明け後に `CHAPTER1_JOIN_LINES` の短い一幕（`dialogueKind = 'chapter1Join'`） |
| 影の旅人 | 酒場では NPC（`shadowGuideMet` / `shadowGuideTalks`）。**加入は道の途中** | `talkToShadowGuide` / `14-dungeon-road.js` |
| 鍛冶士 | 洋館クリアで加入（`smithJoined`）。交代後は再会イベントを起こさない（`smithGreeted = true`） | |
| 酒場の主人 | 出撃メニューの入口。次の行き先1つだけを出す | `renderScenarioList()` |
| 全滅して戻った場合 | `scenarioClears` は増えないので同じシナリオをやり直す。一幕は出さない（`announce:false`） | |

## Existing Test / Debug Systems

### (1) Scenario Test Mode（既存・WORK 1 / 4 / 12.1）

**12. テストモードは既に存在し、シナリオ直接起動も実装済み。**

| 項目 | 内容 |
| --- | --- |
| 入口 | タイトル `#open-testmode-btn` → `#testmode-screen` |
| 設定できるもの | 職業（`hidden` を除く4クラス）・転身・デバッグ用レベル（1〜99）・同行ゲスト・**シナリオ**（`SCENARIO_DEFS` の `unlocked:true`、平坦な一覧）・**開始地点**（`SCENARIO_WAYPOINTS` 登録分） |
| Arc プリセット | Chapter 1 のシナリオを選ぶと `presetChapter1Cast()` がその Arc の主役＋支援を自動選択（あとから変更可） |
| 起動順序 | `beginTestMode()` → `finishEnteringGame({world:'training'})`（`state.testMode = true`）→ `launchScenario(key)` → 開始地点へ `teleportTestModeTo()` |
| セーブ保護 | `state.testMode` の書き換えは `finishEnteringGame` の1行（`:1727`）のみ。`saveGame()` は即 return。`deleteSaveGame()` は呼ばない |
| 初期状態 | `scenarioClears = {}`、`smithJoined = false`、`learnedSkill2 = false`（ただし `hasSkill2` は testMode で常に true）、**`skillChoice = 'retreat'` 固定**、派生スキル全解放、`spherePoints 999`、ポーション99、スターター装備 |
| 進行への非干渉 | `advanceChapter1Cast` は testMode で何もしない。本編の交代・加入・一幕は走らない |
| 旧システム | `legacyGrowthEnabled(true)` なのでレベル・ドロップ・スフィア等が動く |

### (2) Combat Test Arena

`#arena-toggle-btn`（testMode 中のみ表示）。`ARENA_ROSTER` の Spawn / Clear / Debug Info。
テストモードでは戦闘不能にならず HP1 で踏み止まる。シナリオ内での Spawn の挙動（training 以外の world）は **未確認**。

### (3) Debug Mode

メニューのバージョン表記を素早く5回（`state.debugMode`、`02-world-common.js`）。被ダメージ0・計測表示など。本編でも使える。

### (4) E2E からのワールド起動

| 方法 | 使用例 | 特徴 |
| --- | --- | --- |
| `startTestMode(page, {classKey, guestKey, scenario, level, waypoint})` | `scenario-test-mode.spec.js` / `chapter1-dusk-basics.spec.js` など | UI 経由の直接起動。実セーブ不変 |
| 偽セーブ注入（`scenarioClears` を書いた `soulforge_save_v1`）→ つづきから → 酒場の主人へ歩いて出撃 | `chapter1-progression` / `duskvillage` / `road` など | **本編の進行ルールごと検証できる**。遅い |

## Reusable Systems

| # | 既存 | 再利用 |
| --- | --- | --- |
| R1 | `launchScenario(key)` | シナリオ起動の唯一の入口。テストモードも本編もこれ |
| R2 | `beginTestMode(classKey, jobKey, level, guestKey, scenarioKey, waypointId)` | 引数の追加だけで設定項目を増やせる |
| R3 | `finishEnteringGame({world:'training'})` | testMode を立てる唯一の場所。**ここを増やさない** |
| R4 | `CHAPTER1_ORDER` / `resolveCast()` / `CHAPTER_CAST` | Chapter 1 → Arc → Scenario の階層をテストモードの一覧に表示する情報源（新しい表は作らない） |
| R5 | `presetChapter1Cast()` | Arc の正式な主役＋支援を既定値にする処理が既にある |
| R6 | `defaultSkill1For(classKey)` | テストモードの Skill 1 既定を本編と揃えるのに使える |
| R7 | `SCENARIO_WAYPOINTS` / `teleportTestModeTo()` | 途中開始。宵待ちの村と道で登録済み |
| R8 | `state.testMode` + `saveGame()` 即 return | セーブ保護は完成済み |
| R9 | `legacyGrowthEnabled(testMode)` / `hasSkill2(progress)` | 「テストモードでだけ許す」分岐の前例。増やすならこの形 |
| R10 | `state.debugMode` / Arena | Debug Options の既存の受け皿 |
| R11 | `tests/helpers.js` の `startTestMode` | E2E からの直接起動は既にある |

## Scenario Test Mode Proposal

### 結論

**Scenario Test Mode の基盤は既に存在する。** 新しい管理システムは作らず、既存テストモードの
「シナリオ」欄を **Chapter → Character Arc → Scenario の階層で見せる**ことと、
**本編と同じ初期状態（Skill 1 など）で始められる**ことの2点を中心に最小差分で補う。

### 概念構造（実在する key のみ）

```
Scenario Test
├─ Chapter 1
│   ├─ Arc 1 剣士     / 森の洋館（mansion）            支援: なし
│   ├─ Arc 2 魔法使い / 宵待ちの村（duskvillage）      支援: 剣士
│   ├─ Arc 3 弓師     / 幽霊船（ghostship）            支援: 魔法使い
│   ├─ Arc 3 弓師     / 硝子の温室（conservatory）     支援: 魔法使い  ※仕様上の所属。本編未接続と表示
│   ├─ Arc 4 盗賊     / 狂いの時計塔（clocktower）     支援: 弓師      ※仮置きと表示
│   └─ Arc 4→5 盗賊   / 道（road）                     支援: 弓師
├─ 本編外（Chapter 未所属）
│   ├─ 埠頭の地下水路（waterway）
│   └─ 古代神殿（temple）
├─ Chapter 2 ―― 未実装（選択不可、または表示しない）
└─ トレーニング空間（training）
```

### 設定可能にすべき項目（何を、まで。実装方法は Planner 参照）

| 項目 | 現状 | 提案 |
| --- | --- | --- |
| Scenario | ○ 平坦な一覧 | Chapter / Arc で見出しを付ける（表示のみ） |
| Chapter | ✕ | Chapter 1 / 本編外 の区分表示。Chapter 2 は「未実装」 |
| Player Character | ○ | 変更不要（Arc プリセット済み） |
| Support Character | ○ | 変更不要（Arc プリセット済み） |
| World / Stage | ○（Scenario = world key） | 変更不要 |
| Start Point | ○ 開始地点 | 変更不要 |
| Skills | △ Skill 1 は `retreat` 固定、Skill 2 は常時使用可 | Skill 1 既定を `defaultSkill1For()` に揃える。Skill 2「本編どおり未習得」の選択肢は要判断 |
| Progression State | ✕（すべて空） | 「本編相当」プリセット（そのシナリオに到達した時点の `scenarioClears` / `smithJoined` 等）を要判断 |
| Equipment | △ スターター装備固定 | 当面変更なし（本編もスターター装備＋クラス武器のみのため） |
| Debug Options | △ Debug Mode / Arena | 当面は既存流用。HP/MP/スタミナ/CD の直接操作は未実装のまま |
| Level | ○ デバッグ用 | 変更不要（本編 Chapter 1 にはレベルが無いことは既に明記済み） |

### MAGE-001 との接続

```
Scenario Test → Chapter 1 → Arc 2 魔法使い → 宵待ちの村（duskvillage）
  Player: mage（自動プリセット） / Support: warrior（自動プリセット）
  開始地点: 任意（村の入口〜水鏡の跡）
  → Skill 1「幻影歩法（ステップ＋幻影デコイ）」を検証
```

**現状の欠落**: テストモードは `skillChoice = 'retreat'` 固定のため、魔法使いで入っても
Skill 1 は「退避」になり、幻影歩法を使うには鑑定所のスキル欄で付け替える必要がある。
本編（交代時）は `defaultSkill1For('mage') = 'phantom'`。**MAGE-001 の前提として、ここを揃えるのが最優先**。

## Risks

| # | リスク | 深刻度 | 緩和 |
| --- | --- | --- | --- |
| RK-1 | `finishEnteringGame({world:<シナリオ>})` を呼ぶと testMode が false になり実セーブが上書きされる | **高** | 起動順序（training → `launchScenario`）を維持。`state.testMode` の書き換え箇所を増やさない |
| RK-2 | テストモードで `scenarioClears` 等を「本編相当」に設定すると、`scenarioStars` / `isRepeatRun` が変わり敵の強さ・制限時間が本編と異なる | 中 | 対象シナリオ自身のクリア数は立てない（前のシナリオだけ）。unit で検証 |
| RK-3 | テスト用の分岐が本編の関数に混入 | 高 | 本編の関数（`advanceChapter1Cast` / `launchScenarioNow` / `renderScenarioList` / `offeredScenarios`）は変更しない |
| RK-4 | 仮置き（Arc 4 = clocktower）や未接続（温室）を確定情報として一覧に固定する | 中 | 一覧は `CHAPTER1_ORDER` / `CHAPTER_CAST` から導出し、表記に「仮」「本編未接続」を付ける |
| RK-5 | `hasSkill2` が testMode で常に true のため、閃きイベントの検証が本編と異なる | 中 | 「Skill 2 未習得で始める」選択肢は要判断（Unknown） |
| RK-6 | `SCENARIO_DEFS` は `01-character-creation.js` より後で初期化される（TDZ） | 低 | 既存の「画面を開いた瞬間に組み立てる」遅延を踏襲 |
| RK-7 | `CHAPTER_CAST.chapter` のリネームは影響範囲が広い | 低 | 今回はリネームしない。用語はドキュメント側で整理 |
| RK-8 | docs の記述が実装と食い違ったまま（`docs/SCENARIOS.md` の「②が仕様と異なる」、`docs/README.md` D-03/D-04） | 低 | 本タスクは docs 変更禁止。Action Required として記録 |

## Unknowns

**仕様として未確定（AIが決めてはならない）**

1. 盗賊 Arc の正式シナリオ（仕様:「宵待ちの村の別展開・関連エリア」／実装: `clocktower` 仮置き）
2. 温室を Arc 3 の本編へ接続するか、その順序（幽霊船 → 温室）
3. 影の旅人（Arc 5）と「道」を Chapter 1 の正式構成として仕様に取り込むか
4. 時計塔・地下水路・古代神殿の最終的な所属（Chapter 1 / Chapter 2 / 本編外）
5. Chapter 2 の解放条件・解放順序・最初に解放される要素
6. Chapter 2 のパーティ編成で影の旅人を選べるか（現在 `hidden:true`）

**Scenario Test Mode の範囲として要判断**

7. 「本編相当の Progression State」プリセットを持つか。持つなら既定にするか
8. Skill 2 を「本編どおり未習得で開始」できるようにするか（現在 testMode では常に使用可）
9. Chapter 2 を一覧に「未実装」として出すか、出さないか
10. 影の旅人を主人公としてテストモードで直接選べるようにするか（現在は道の出会いでのみ）

**調査で確認できなかったもの**

11. Combat Test Arena の Spawn が training 以外の world（シナリオ内）で正しく動くか
12. 周回（★）と強モブ出現の連動がどのダンジョンでどこまで効いているか
13. 洋館クリア → 酒場 → 交代の一幕 の実機通し（WORK 12.1 で未確認）

**docs 側の Action Required（本タスクでは未実施）**

14. `docs/SCENARIOS.md`: 「②が仕様と異なる」は誤り（現在 `CHAPTER_CAST[2].dungeonKey = 'duskvillage'` で一致）。Chapter / Arc / Scenario / Stage の階層、道・影の旅人の追記
15. `docs/README.md` D-03 / D-04: 章進行とサポートAIは WORK 10〜12.1 で実装済みに更新
16. `CHAPTER_CAST` 冒頭コメントの「各章の主人公」「第二章以降」などの旧表現（コード側。別タスク）
