# Chapter Structure Analysis

Analyzer / READ ONLY。本レポート作成にあたりゲームコードは一切変更していない。

関連 Task: [`../tasks/CHAPTER-STRUCTURE.md`](../tasks/CHAPTER-STRUCTURE.md)

## Correct Concept

Chapter と Scenario は別の階層である。混同してはならない。

```
Chapter 1（第一章全体）
├─ 剣士 主役パート（Character Arc）
│    └─ 森の洋館 Scenario → mansion Stage
├─ 魔法使い 主役パート
│    └─ 宵待ちの村 Scenario → duskvillage Stage
├─ 弓師 主役パート
│    └─ 幽霊船 Scenario → ghostship Stage
│    └─ 温室 Scenario → conservatory Stage
└─ 盗賊 主役パート
     └─ 対応シナリオ（未確定。下記 Scenario List 参照）

Chapter 2（第二章）
└─ 自由進行パート（キャラ自由選択・3人パーティ・ダンジョン自由選択）
```

用語の定義:

| 用語 | 意味 |
| --- | --- |
| **Chapter** | 物語・ゲーム進行上の大区分（第一章 / 第二章） |
| **Character Arc（主役パート）** | Chapter 内で特定キャラクターを主役として進める区間 |
| **Scenario** | 具体的な物語・ゲームプレイ単位 |
| **Dungeon / Stage** | 実際にプレイするステージ（実装上の world key） |
| **Scenario Test** | 開発用に特定のシナリオを直接起動する仕組み |

## Current Implementation

**実装に「Chapter」という実行時の状態は存在しない。**

- `state.chapter` は無い（`src/core/state.js` に該当フィールド無し。セーブにも無い）
- 「Chapter」の語が出てくるのは次の2つだけ
  1. `CHAPTER_CAST`（`src/legacy/parts/01-character-creation.js:230`）という **静的なキャスト表**
  2. `src/core/chapter1-skills.js`（Skill 1/2 の進行ルール。章の進行そのものは扱わない）
- 章を進める・記録する・参照するコードは存在しない

### A. 「Chapter」と呼ばれているものの実体

`CHAPTER_CAST` は1-indexed の5エントリで、各エントリは
`{chapter, classKey, gender, personality, guestClassKey, dungeonKey}` を持つ。

| index | classKey | guestClassKey | dungeonKey |
| --- | --- | --- | --- |
| 1 | warrior（剣士） | null | mansion |
| 2 | mage（魔法使い） | warrior | duskvillage |
| 3 | archer（弓師） | mage | ghostship |
| 4 | rogue（盗賊） | archer | clocktower |
| 5 | null（影の旅人・未実装） | rogue | null |

### B. CHAPTER_CAST は何を意味しているか

**「第一章の主役キャスト表」である。**「現在のChapter」ではない。

根拠:

1. 主役の交代順（剣士 → 魔法使い → 弓師 → 盗賊 → 影の旅人）が、
   正式概念の Chapter 1 の Character Arc の順序とそのまま一致する
2. `guestClassKey` が「1つ前の主役」を指しており、これは
   「前の主役がサポートAIとして同行する」という **Chapter 1 固有のルール** そのもの
3. `CHAPTER_CAST[5]` は「影の旅人」＝ Chapter 1 の5人目のキャラクターであり、
   第二章（自由進行）とは無関係

したがって **`CHAPTER_CAST` の `chapter` フィールドは、正しくは
「Chapter 1 内の Character Arc 番号」を指している。** 名前が誤解を招く状態にある。

`dungeonKey` にも「章とダンジョンの1:1対応はまだ実装していない」「代表的な1つだけを
仮に載せてある」とコード中コメントで明記されており、確定した対応表ではない。

### C. 第一章の途中までしか進めない原因

単一の原因が特定できた。

```js
// 01-character-creation.js:314（新規ゲーム開始時）
if(!applyChapterCast(1)) return;
```

- `applyChapterCast(n)` は **呼び出し箇所が1つだけ** で、引数は定数 `1`
- `applyChapterCast` は `selectedClass/Gender/Personality/playerName` を書き換えるだけで、
  `guestClassKey` も進行状態も触らない
- 「シナリオをクリアしたら次の Arc へ進む」処理は存在しない
- したがって「第一章の途中までしか進めない」のではなく、
  **常に Arc 1（剣士）だけが始まり、他の Arc へ移る経路が無い**

## Chapter 1

### Intended Structure

```
剣士 → 剣士主役パート（森の洋館）→ クリア → 酒場 → 次のキャラクター登場
→ 魔法使い主役パート（宵待ちの村）→ クリア → 酒場 → …
```

- 開始時点では自由な3人パーティではない
- 主役は順番に切り替わる
- 以前の主役はサポートAIとして同行する（魔法使い主役時: Player=魔法使い / Support AI=剣士）
- 切り替えはメニューの自由選択ではなく、酒場・イベント・シナリオ進行で自然に発生する

### Current Implementation

| 要素 | 状態 |
| --- | --- |
| Arc 1（剣士 / 森の洋館） | プレイ可能。シナリオ本体・ボス・演出・鍛冶屋加入まで実装済み |
| Arc 2〜5 | **開始する経路が無い**（キャスト表に定義があるだけ） |
| 主役の切り替え | 未実装 |
| Arc クリアの記録 | シナリオ単位の `clearedScenarios` / `scenarioClears` はあるが、Arc 単位の記録は無い |
| サポートAI（ゲスト） | **実体は実装済み**（下記 Support AI 参照）。ただし章進行から設定する経路が無い |
| 酒場での次キャラ登場 | 未実装（酒場に加わるのは鍛冶士のみ） |

### Differences

| # | 仕様 | 実装 |
| --- | --- | --- |
| C1-1 | Chapter 1 は複数の Arc を順に進む | Arc 1 のみ。進行の概念が存在しない |
| C1-2 | Arc クリアで次の主役が酒場に登場 | 未実装 |
| C1-3 | 前の主役がサポートAIになる | ゲストの実体はあるが、設定経路はテストモードのみ |
| C1-4 | 弓師 Arc は幽霊船と温室の2シナリオ | `CHAPTER_CAST[3].dungeonKey` は `ghostship` のみ（コメントで「代表的な1つだけを仮に」と明記） |
| C1-5 | 盗賊 Arc のシナリオ | `CHAPTER_CAST[4].dungeonKey` は `clocktower`。仕様側は「宵待ちの村の別展開」＝**未確定** |

## Chapter 2

### Intended Structure

- キャラクター自由選択 / 3人パーティ / ダンジョン自由選択
- 第一章より自由度の高い成長（スフィア盤・育成施設・エンドダンジョン）
- 周回による高難易度化・マップ変異・強モブ出現を **段階的に解放**

### Current Implementation

**Chapter 2 そのものは存在しない。** ただし構成要素の一部は既に動いている。

| 要素 | 状態 |
| --- | --- |
| キャラクター自由選択 | 未実装（新規ゲームは剣士固定。テストモードでのみ任意クラスを選べる） |
| 3人パーティ | 未実装（現在は主人公＋ゲスト1＋使い魔COMPANIONが上限） |
| ダンジョン自由選択 | **実装済み**（酒場の出撃メニュー。`SCENARIO_DEFS` の7ワールドが `minLevel` 制限つきで選べる） |
| スフィア盤（奥義の環） | **実装済みで常時開放**（Chapter 1 での不使用方針と矛盾。docs/README.md D-02） |
| 育成施設 | 未実装（該当コード無し） |
| エンドダンジョン | 未実装（該当コード無し。深層ダンジョンの定義も無い） |
| 周回による高難易度化 | **実装済み**（★最大8、`scenarioStars`、周回で制限時間が短縮） |
| マップ変異 | **仕組みは実装済み**。ただし `ROUTE_MUTATABLE_NODES.mansion` は空で休止中 |
| マップ追加 | **実装済み**（洋館: ★3で隠し部屋、★4で屋根裏） |
| 強モブ出現 | **基盤は実装済み**（`core/enemy-tier.js` / Super Armor / Guardian）。周回連動の出現制御は未確認 |

### Differences

| # | 仕様 | 実装 |
| --- | --- | --- |
| C2-1 | Chapter 2 は「解放される」自由進行パート | 解放の概念が無く、自由選択要素（ダンジョン選択・スフィア盤・周回）が最初から開いている |
| C2-2 | 3人パーティ | 未実装 |
| C2-3 | 育成施設・エンドダンジョン | 未実装 |

**「実装済み」と誤記しないこと。** 上表の「未実装」は該当コードが存在しないことを確認済み。

## Character Arcs

| Arc | 主役 | Support AI（前の主役） | 仕様上のシナリオ | 実装の `dungeonKey` | 状態 |
| --- | --- | --- | --- | --- | --- |
| 1 | 剣士 `warrior` | なし（単独） | 森の洋館 | `mansion` | **プレイ可能** |
| 2 | 魔法使い `mage` | 剣士 | 宵待ちの村 | `duskvillage` | 起動経路なし。ステージ自体は完成している |
| 3 | 弓師 `archer` | 魔法使い | 幽霊船 → 温室 | `ghostship`（温室は未紐付け） | 起動経路なし |
| 4 | 盗賊 `rogue` | 弓師 | **未確定**（「宵待ちの村の別展開」） | `clocktower`（仮） | 起動経路なし |
| 5 | 影の旅人 | 盗賊 | 未確定 | `null` | 専用クラス・戦闘キットとも未実装 |

Arc 1 は `guestClassKey:null`（単独）。コード中コメントに
「原案では『①剣士＋？？？』だったが、5人目は最初から一緒にいる仲間にせず、
剣士が単身で始める形に変更した」と経緯が明記されている ―― これは確定した設計判断。

## Scenario List

world key と表示名の対応（`SCENARIO_DEFS` / `WORLD_DEFS`）。

| world key | 表示名 | minLevel | 解放 | Arc 対応 | 備考 |
| --- | --- | --- | --- | --- | --- |
| `mansion` | 🏚️ 囚われの洋館 | 1 | ○ | Arc 1（確定） | 森＋洋館。一本道 |
| `duskvillage` | 🏮 宵待ちの村 | 26 | ○ | Arc 2（確定） | **G. 宵待ちの村の world key は `duskvillage`** |
| `ghostship` | 👻 幽霊船 | 6 | ○ | Arc 3（確定） | |
| `conservatory` | 🌿 硝子の温室 | 22 | ○ | Arc 3（仕様上）／実装では未紐付け | |
| `clocktower` | 🕰️ 狂いの時計塔 | 11 | ○ | **未確定**（実装は Arc 4 に仮置き） | |
| `waterway` | 💧 埠頭の地下水路 | 18 | ○ | 本編外の追加コンテンツ（docs/SCENARIOS.md） | |
| `temple` | 🏛️ 古代神殿 | 10 | ○ | 本編外の追加コンテンツ | |
| `pyramid` | 🏜️ 砂漠のピラミッド | 16 | ✕ | なし | ワールド構築関数自体が存在しない |
| `volcano` | 🌋 業火の火山 | 21 | ✕ | なし | 同上 |
| `tavern` | （酒場） | － | － | 拠点 | `WORLD_DEFS.tavern` |
| `training` | （トレーニング空間） | － | － | テストモード専用 | `x>400` の未使用領域 |

`WORLD_DEFS` に存在する world key は上記11種がすべて。**新しい world を勝手に増やさない。**

> **docs/README.md D-03 の記述に誤りがある。**
> 「②=duskvillage が仕様と不一致」としているが、Arc 2（魔法使い）＝宵待ちの村は
> 仕様・実装ともに一致している。実際に食い違うのは **Arc 3 の2つ目（温室）が
> 紐付いていないこと** と **Arc 4 のシナリオ（clocktower は仮置き）** の2点。
> `docs/` の修正は本タスクの対象外のため未実施。Action Required として記録する。

## Support AI

**E. サポートAI切替の実装状況 ―― 実体は実装済み、設定経路だけが無い。**

| 要素 | 実装 | 場所 |
| --- | --- | --- |
| ゲストの見た目 | `buildGuestCompanion(classKey)`。`CLASSES[].color/trim` を纏った人型NPC | `08-loot-equipment.js:990` |
| ゲストのAI | 追従・索敵・攻撃。ダメージは `state.classDef.atk` に比例 | 同ファイル |
| 敵対制御 | `isPartyHostile(en)` = `en.triggered` のみ攻撃対象。非敵対の強モブを勝手に起こさない | `src/core/enemy-aggro.js` |
| 実体の同期 | `syncAlliesToState()` が `state.guestClassKey` を見て生成・破棄 | `08-loot-equipment.js:1103` |
| 位置リセット | `repositionAlliesToPlayer()`（`launchScenarioNow` が各ワールドで呼ぶ） | |
| 状態 | `state.guestClassKey`（セーブ対象） | `09-save-load.js:80` |
| **設定経路** | **テストモード画面の「同行ゲスト」だけ** | `01-character-creation.js:383` |

コード中コメントに明記:
「章の自動進行（洋館クリア→魔法使いへ交代、等）はまだ実装しておらず、
`state.guestClassKey` を実際に書き換える経路が今は無い」

別枠で、`state.skills.companion`（「仲間を雇う」で購入する浮遊する使い魔）が
ゲストとは独立に存在する。両者は同時に出せる。

## Tavern Progression

**F. 酒場によるキャラクター加入の実装状況**

| 対象 | 状態 | フラグ |
| --- | --- | --- |
| 鍛冶士 | **実装済み**。洋館クリアで加入し、炉と本人が酒場に現れる | `state.smithJoined` / `smithToolsRecovered` |
| 影の旅人 | **NPCとして常駐**。会話のみ。仲間にはならない | `state.shadowGuideMet` / `shadowGuideTalks` |
| 酒場の主人 | 常駐。出撃メニューの入口 | － |
| **次の主役キャラクター** | **未実装**。酒場に登場させる処理は存在しない | － |

酒場の変化は「フラグ → 置かれる物・人が増える」という形で既に成立しており
（`MANSION_SCENARIO.md` の表）、Arc 進行による主役キャラクターの登場も
**同じパターンで足せる素地がある**。

## Existing Test / Debug Systems

**12. テストモード／開発者モードは既に存在する。**

### (1) Test Mode（タイトル画面 → 🛠テストモード）

| 項目 | 内容 |
| --- | --- |
| 入口 | `index.html` の `#open-testmode-btn` → `#testmode-screen` |
| UI組み立て | `setupTestModeScreen()`（`01-character-creation.js:366`） |
| 選択できるもの | **職業**（4クラス）・**転身**（基礎/上位職）・**レベル**（1〜99スライダー）・**同行ゲスト**（なし＋4クラス） |
| 実処理 | `beginTestMode(classKey, jobKey, level, guestKey)`（`14-hud-boot.js:1280`） |
| 行き先 | `finishEnteringGame({showIntro:false, world:'training'})` |
| セーブ保護 | `finishEnteringGame` が `state.testMode = (world==='training')` を設定。`saveGame()` は `state.testMode` で必ず即 return（`09-save-load.js:93`）。`deleteSaveGame()` は呼ばない |
| 初期状態 | 派生スキル全解放・`spherePoints:999`・ポーション99・スターター装備・`learnedSkill2:false` |

**`state.testMode` の書き換え箇所は `finishEnteringGame` の1行だけ** で、
「片方で立てて戻し忘れる事故」を避ける設計になっている（コメントに明記）。

### (2) Combat Test Arena（テストモード中のみ）

| 項目 | 内容 |
| --- | --- |
| 入口 | `#arena-toggle-btn`（`state.testMode` 以外では出ない） |
| 機能 | 敵ロスター（`ARENA_ROSTER`、7種）の Spawn / Clear All / Debug Info 表示 |
| 実装 | `07-ai-combat.js`（spawn/clear）＋ `14-training-ground.js`（DOM側） |
| 特記 | テストモードでは戦闘不能にならず HP1 で踏み止まる（`triggerPlayerDown`） |

### (3) Debug Mode（本編中でも使える）

- メニューのバージョン表記を素早く5回叩くとトグル（`state.debugMode`）
- 被ダメージ0・パフォーマンス計測表示・モーションフリーズなど
- `02-world-common.js:1546` が唯一のトグル箇所

### (4) E2E からのワールド起動（18の調査項目）

**現状、特定 world を直接起動する手段が無い。** 各 E2E は本編の手順をなぞっている。

`tests/duskvillage.spec.js` の実例:

1. `page.addInitScript` で `localStorage` に **Lv.30 の偽セーブを直接書き込む**
   （`duskvillage` の `minLevel` が26のため）
2. 「つづきから」で再開
3. 酒場の主人まで **最大30回リトライしながらキー入力で歩く**
4. 出撃メニューを開き `.scenario-sortie-btn[data-scenario="duskvillage"]` をクリック
5. 会話を送って出撃

`test.setTimeout(210_000)` が必要になっており、コメントにも
「ボス広場まで到達するのは現実的でない」と書かれている。
**Scenario Test Mode が最も強く必要とされているのはここ。**

## Reusable Systems

新しい進行管理システムを作らずに再利用できるもの。

| # | 既存システム | 再利用のしかた |
| --- | --- | --- |
| R1 | `launchScenario(key)` / `launchScenarioNow(key)`（`12-progression-ui.js:1552`） | **あらゆるシナリオ開始の唯一の入口**。`scenarioKey` 設定 → `routeReset` → `buildWorld` → world ごとの入場座標・カメラ向き・`repositionAlliesToPlayer` まで済ませる。レベル制限のチェックを持たないので、テストから直接呼べる |
| R2 | `beginTestMode(classKey, jobKey, level, guestKey)` | 引数を1つ足すだけでシナリオ指定に対応できる形になっている |
| R3 | `finishEnteringGame({world})` | `state.testMode` を立てる唯一の場所。`world:'training'` で入ってから R1 を呼べば、**testMode を保ったままシナリオへ移れる** |
| R4 | `state.guestClassKey` ＋ `syncAlliesToState()` | Support AI の指定がそのまま動く。テストモード画面に既に選択UIがある |
| R5 | テストモード画面（`#testmode-screen`） | 職業・転身・レベル・ゲストの選択UIが既にある。シナリオ選択の行を足すだけ |
| R6 | Combat Test Arena のパネル（testMode 限定表示） | 「テストモード中だけ出る操作パネル」の前例。ゲーム中からのシナリオ切替UIを足すならこの形 |
| R7 | `SCENARIO_DEFS` | シナリオ一覧・表示名・推奨レベルの唯一の情報源。テスト用の一覧もここから生成できる |
| R8 | `state.testMode` ＋ `saveGame()` の即 return | セーブ保護が既に完成している。**新しい保護機構を作る必要が無い** |
| R9 | `scenarioStars()` / `state.scenarioClears` | ★（周回難易度）をテスト用に指定するならこの既存フィールド |
| R10 | `state.debugMode` | HP・被ダメージ等のデバッグ挙動は既にここに集約されている |

## Scenario Test Mode Proposal

### 設計の核

> **新しい進行管理を作らない。**
> 「テストモードで training に入る」→「そのまま `launchScenario(key)` を呼ぶ」だけで、
> `state.testMode` を保ったまま任意のシナリオへ入れる。

理由: `state.testMode` は `finishEnteringGame` でのみ書き換わり、`buildWorld` /
`launchScenarioNow` は触らない。つまり training 経由で入った後にシナリオを起動しても
テストモードのままで、`saveGame()` は最後まで何も書かない。

### 本編への非干渉

Scenario Test Mode は次のいずれも **変更しない**。

- `applyChapterCast(1)` による本編の開始（剣士固定）
- キャラクター加入順・酒場イベント
- Support AI の正式な進行（`guestClassKey` を書き換えるのはテストモード内のみ）
- Chapter 2 への進行
- セーブデータ（`state.testMode` により保護）

### 設定可能にすべき項目（何を、の設計まで。実装方法は決め打ちしない）

| 分類 | 項目 | 既存で賄えるか |
| --- | --- | --- |
| Scenario | 対象シナリオ（＝ world key） | `SCENARIO_DEFS` から生成可。`launchScenario(key)` へ渡す |
| Chapter | Chapter 1 / Chapter 2 | **Chapter 2 は実体が無い**ため、当面は表示上の分類に留める |
| Character Arc | 主役パート（表示・既定値の提示用） | `CHAPTER_CAST` から導出可 |
| Player Character | 操作キャラクター（クラス・転身・レベル） | **既にUIがある** |
| Support Character | サポートAI | **既にUIがある**（`guestClassKey`） |
| World / Stage | 起動する world key | `launchScenario(key)` が入場座標・カメラまで面倒を見る |
| Progression State | ★（周回数）・Skill 2 習得済みか・鍛冶士加入済みか等 | `scenarioClears` / `learnedSkill2` / `smithJoined` を直接立てる |
| Equipment | テスト用装備 | 既定は `grantStarterGear()`。個別指定は未確定 |
| Skills | 検証対象スキルの装備（`skillChoice` 等） | `state.skillChoice` / `skill2Choice` / `ultChoice` に直接指定 |
| Debug Options | HP/MP/スタミナ/CD/敵出現 | `state.debugMode`・Arena の spawn を流用。新設は最小限に |

### 概念構造（実在する world key のみで構成する）

```
Scenario Test
├─ Chapter 1
│   ├─ Arc 1  剣士       / 森の洋館      → mansion
│   ├─ Arc 2  魔法使い   / 宵待ちの村    → duskvillage
│   ├─ Arc 3  弓師       / 幽霊船        → ghostship
│   ├─ Arc 3  弓師       / 硝子の温室    → conservatory  ※Arc対応は仕様上のもの
│   └─ Arc 4  盗賊       / （未確定）    → clocktower は仮置き
├─ 本編外の追加コンテンツ
│   ├─ 埠頭の地下水路 → waterway
│   └─ 古代神殿       → temple
└─ Chapter 2 ―― **未実装**。項目として出さない、または「未実装」と明示する
```

`pyramid` / `volcano` はワールド構築関数が無いため一覧に出さない。

### MAGE-001 との接続

```
Scenario Test → Chapter 1 → Arc 2（魔法使い）→ 宵待ちの村
  Player Character: mage / 基礎職 / 任意レベル
  Support AI: warrior（Arc 2 の正式なゲスト）
  → duskvillage を直接起動 → Skill 1「ステップ＋幻影デコイ」を検証
```

現状 MAGE-001 の検証は Combat Test Arena（training 空間のカカシ）でしか行えず、
実ステージの敵AI・地形・誘導は確認できない。本タスクはその前提条件にあたる。

## Risks

| # | リスク | 深刻度 | 緩和 |
| --- | --- | --- | --- |
| R1 | `finishEnteringGame({world:<シナリオ>})` を直接呼ぶと `state.testMode` が **false** になり、テスト中にセーブが上書きされる | **高** | 必ず `world:'training'` で入ってから `launchScenario(key)` を呼ぶ。`state.testMode` の書き換え箇所を増やさない |
| R2 | テストモード用の分岐が本編コードへ混入し、本編の進行を変えてしまう | 高 | 既存の `state.testMode` ガードの形に揃え、本編側の関数の振る舞いを変えない |
| R3 | 「Chapter」の語を実装に導入すると、Arc との混同が固定化する | 中 | 実行時の状態を増やさない。導入するなら `arc` と `chapter` を別の語として定義してから |
| R4 | `CHAPTER_CAST` の `dungeonKey` を確定情報として扱ってしまう | 中 | コメントどおり「仮置き」として扱う。Arc 3 の温室・Arc 4 は未確定のまま残す |
| R5 | シナリオ直起動で、本編なら成立している前提（Skill 2 習得済み・鍛冶士加入済み等）が欠けたまま入り、シナリオイベントが壊れて見える | 中 | Progression State を指定可能にする。既定値は「本編でそのシナリオに到達した時点の状態」に寄せる（具体値は未確定） |
| R6 | `duskvillage` は `minLevel:26`。低レベルで直起動すると敵が過剰に強い | 低 | レベル指定UIが既にある。既定値の決め方は未確定 |
| R7 | UI追加が `index.html` に及ぶ（`basefile.html` ではない） | 低 | `basefile.html` は凍結、変更しない。追加は `index.html` 側のみ |

## Unknowns

**仕様として未確定（AIが決めてはならない）**

1. 盗賊 Arc の正式なシナリオ（実装の `clocktower` は仮置き。仕様側は「宵待ちの村の別展開」）
2. 弓師 Arc の2つ目（温室）をどう Arc に紐付けるか
3. 時計塔・地下水路・古代神殿の Chapter 1 本編での位置づけ
4. 影の旅人 Arc（Arc 5）の内容と、プレイアブル化の条件
5. Chapter 2 の解放条件と、解放される要素の順序
6. Chapter 1 中にスフィア盤をロックするか（docs/README.md D-02 と同じ論点）
7. Scenario Test Mode で既定とすべき Progression State・レベル・装備
8. Chapter 2 を Scenario Test Mode の選択肢に出すか（実体が無いため）

**調査で確認できなかったもの**

9. 「名もなき街道」（影の旅人のプレイアブル化条件として実装コメントにのみ登場）の実体
10. 周回（★）と強モブ出現の連動が、どのダンジョンでどこまで効いているか

**docs 側の Action Required（本タスクでは未実施）**

11. `docs/README.md` D-03 の記述訂正（Arc 2 は一致している。実際の差異は Arc 3 の温室と Arc 4）
12. `docs/SCENARIOS.md` へ Chapter / Character Arc / Scenario / Stage の用語階層を追記
