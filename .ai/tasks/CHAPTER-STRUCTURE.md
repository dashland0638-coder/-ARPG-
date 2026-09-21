# CHAPTER-STRUCTURE

Chapter構造の仕様修正と Scenario Test Mode の設計

Status: **PLANNED**（実装未着手。Unknowns の決定が必要な項目あり）

Analysis: [`../reports/CHAPTER-STRUCTURE-analysis.md`](../reports/CHAPTER-STRUCTURE-analysis.md)

## Goal

Chapter 1 / Chapter 2 と Scenario を正しく分離し、
各シナリオを直接起動できる Test Mode の基盤を設計する。

本タスクは **設計まで**。実装は行わない。

## Terminology

以降、仕様書・コード・レポートで次の語を厳密に使い分ける。

| 用語 | 定義 | 実装上の対応 |
| --- | --- | --- |
| **Chapter** | 物語・ゲーム進行上の大区分（第一章 / 第二章） | **実行時の状態は存在しない**（`state.chapter` は無い） |
| **Character Arc（主役パート）** | Chapter 内で特定キャラクターを主役として進める区間 | `CHAPTER_CAST` の各エントリが実質これを表している |
| **Scenario** | 具体的な物語・ゲームプレイ単位 | `SCENARIO_DEFS` のエントリ |
| **Dungeon / Stage** | 実際にプレイするステージ | `WORLD_DEFS` の world key |
| **Scenario Test** | 開発用に特定のシナリオを直接起動する仕組み | 本タスクで設計する（未実装） |

階層:

```
Chapter 1 → 魔法使い主役パート（Character Arc）→ 宵待ちの村 Scenario → duskvillage Stage
```

## Specification

### Chapter 1

- 開始時点では自由な3人パーティではない
- 主役キャラクターを順番に切り替えながら進行する
  （剣士 → 魔法使い → 弓師 → 盗賊 → 影の旅人）
- Arc クリア後は酒場へ戻り、次の主役キャラクターが登場する
- 以前の主役は、次の主役のサポートAIとして同行する
- キャラクター切り替えはメニューの自由選択ではなく、
  酒場・イベント・シナリオ進行によって自然に発生する

| Arc | 主役 | Support AI | シナリオ |
| --- | --- | --- | --- |
| 1 | 剣士 | なし（単独） | 森の洋館 |
| 2 | 魔法使い | 剣士 | 宵待ちの村 |
| 3 | 弓師 | 魔法使い | 幽霊船 → 温室 |
| 4 | 盗賊 | 弓師 | **未確定** |
| 5 | 影の旅人 | 盗賊 | **未確定** |

### Chapter 2

第一章とは異なる自由進行パート。以下を **段階的に解放** する。

- キャラクター自由選択 / 3人パーティ / ダンジョン自由選択
- 第一章より自由度の高い成長（スフィア盤・育成施設・エンドダンジョン）
- 周回による高難易度化・マップ変異・強モブ出現

解放条件・順序は **未確定**。

### Scenario Test Mode

- 開発者・テスト用機能
- **本編の Chapter 進行ルールを変更しない**
- 特定のシナリオ・キャラクター・戦闘システムを、本編を最初から
  プレイせずに直接検証できるようにする

## Current Implementation

| 項目 | 現状 |
| --- | --- |
| `state.chapter` | **存在しない**。章の進行を記録・参照するコードも無い |
| `CHAPTER_CAST` | 静的なキャスト表。実質「Chapter 1 の Character Arc 表」 |
| 章の進行 | `applyChapterCast(1)` の1箇所だけが定数 `1` で呼ばれる。他の Arc へ移る経路が無い |
| Support AI | **実体は実装済み**（`buildGuestCompanion` / `syncAlliesToState` / `state.guestClassKey`）。設定経路はテストモードの「同行ゲスト」のみ |
| 酒場の加入 | 鍛冶士のみ実装（`smithJoined`）。次の主役キャラクターの登場は未実装 |
| Chapter 2 | 存在しない。ダンジョン自由選択・周回・マップ変異・強モブ基盤は既に動いている一方、3人パーティ・育成施設・エンドダンジョンは未実装 |
| シナリオ起動 | `launchScenario(key)` → `launchScenarioNow(key)` が唯一の入口（`scenarioKey` → `routeReset` → `buildWorld` → 入場座標・カメラ・`repositionAlliesToPlayer`） |
| Test Mode | **実装済み**。タイトル → `#testmode-screen` で 職業 / 転身 / レベル / 同行ゲスト を指定し、`beginTestMode()` → `finishEnteringGame({world:'training'})` |
| セーブ保護 | `state.testMode` は `finishEnteringGame` の1行でのみ設定され、`saveGame()` が即 return する |
| E2E の現状 | 特定 world を直接起動する手段が無い。偽セーブ注入＋最大30回の歩行リトライ＋UI操作が必要（`tests/duskvillage.spec.js`、`test.setTimeout(210_000)`） |

## Required Changes

### (1) 用語・仕様の整理（ドキュメント側。本タスクでは未実施）

| # | 変更 | 対象 |
| --- | --- | --- |
| D-a | Chapter / Character Arc / Scenario / Stage の階層を明記 | `docs/SCENARIOS.md` |
| D-b | `CHAPTER_CAST` は「Chapter 1 の Arc 表」であると明記 | `docs/SCENARIOS.md` |
| D-c | D-03 の訂正（**Arc 2 は仕様と一致している**。実際の差異は Arc 3 の温室未紐付けと Arc 4 の仮置き） | `docs/README.md` |
| D-d | Chapter 2 の「未実装」と「既に動いている構成要素」を分けて記載 | `docs/PROGRESSION.md` |

> `docs/` の変更は本タスクでは禁止されているため未実施。別タスクで行う。

### (2) Scenario Test Mode（実装は別タスク）

本編の進行コードには触れず、テストモードの入口だけを拡張する。

### (3) 章進行の実装（本タスクの対象外）

Arc の自動進行・酒場での次主役登場・`guestClassKey` の書き換えは
**別タスク**。Unknowns の決定が先に必要。

## Scenario Test Mode

### Entry Point

既存のテストモード画面を拡張する。新しい画面・新しいモードを作らない。

```
タイトル画面
└─ 🛠 テストモード（#open-testmode-btn）        ← 既存
   └─ #testmode-screen                          ← 既存
      ├─ 職業 / 転身 / レベル / 同行ゲスト       ← 既存
      └─ シナリオ                                ← 追加する唯一のUI
         └─「開始」                              ← 既存ボタンのラベルを状況で変える
```

- シナリオ未選択 → 従来どおりトレーニング空間（現行の挙動を変えない）
- シナリオ選択 → トレーニング空間へ入った直後に、そのシナリオを起動する

**起動の順序が重要**:

```
beginTestMode(...)
  └─ finishEnteringGame({world:'training'})   ← ここで state.testMode = true
       └─ launchScenario(scenarioKey)          ← testMode を保ったままシナリオへ
```

`state.testMode` の書き換え箇所は `finishEnteringGame` の1行のままにする。
シナリオ world で `finishEnteringGame` を呼んではならない（`testMode` が false になり、
セーブが保護されなくなる）。

### Scenario Selection

- 一覧は `SCENARIO_DEFS` から生成する（表示名・推奨レベルをそのまま使う）
- `unlocked:false`（`pyramid` / `volcano`）は **出さない**（ワールド構築関数が無い）
- Character Arc の対応は `CHAPTER_CAST` から導出して **表示の補助** に使う
  （「Arc 2 / 魔法使い」など）。確定していない対応は「未確定」と表示する
- Chapter 2 は実体が無いため、選択肢として出さない（または「未実装」と明示する）。**未確定**

### Initial State

`beginTestMode()` が既に行っている初期化をそのまま使う
（派生スキル全解放・`spherePoints:999`・ポーション99・スターター装備・
`learnedSkill2:false`・`smithJoined:false`）。

シナリオ直起動で不足する前提（Skill 2 習得済み・鍛冶士加入済み・★周回数など）を
どこまで指定可能にするかは **未確定**。

### Player Character

既存UIで指定できる。追加不要。

- クラス（`CLASSES` の4種）
- 転身（基礎職 / 上位職）
- レベル（1〜99）

### Support Character

既存UIの「同行ゲスト」で指定できる。追加不要。

シナリオを選んだとき、そのArcの正式なゲスト（`CHAPTER_CAST[n].guestClassKey`）を
**既定値として提示する** かどうかは検討事項（実装方法は決め打ちしない）。

### World / Stage

`launchScenario(key)` に委ねる。入場座標・カメラ向き・味方の再配置・
`scenarioKey` の設定・`routeReset()` はすべて既存処理が行う。
**テストモード用に別経路を作らない。**

### Skills

`state.skillChoice` / `skill2Choice` / `ultChoice` / `learnedSkill2` を
直接指定できるようにするか。**未確定**（MAGE-001 の検証には
`skillChoice` の指定があると有用）。

### Equipment

現状は `grantStarterGear()` 固定。個別指定の要否は **未確定**。

### Progression

指定を検討する項目（いずれも既存フィールドで表現できる）。

| 項目 | 既存フィールド |
| --- | --- |
| ★（周回数） | `state.scenarioClears[key]` |
| Skill 2 習得済み | `state.learnedSkill2` |
| 鍛冶士加入済み | `state.smithJoined` / `smithToolsRecovered` |
| クリア済みシナリオ | `state.clearedScenarios` |

どれを既定で立てるかは **未確定**。

### Debug Options

既存を流用し、新設は最小限にする。

| 項目 | 既存 |
| --- | --- |
| 被ダメージ無効・計測表示 | `state.debugMode`（メニューのバージョン表記を5回叩く） |
| 戦闘不能にならない | テストモードでは既に HP1 で踏み止まる |
| 敵の任意スポーン | Combat Test Arena（`ARENA_ROSTER`）。ただし現状 training 空間前提 |
| HP / MP / スタミナ / CD の直接操作 | **未実装**。必要性の判断は未確定 |

## Implementation Plan

最小変更。既存の進行コードには触れない。

### Step 1. シナリオ一覧の提示元を決める

- ファイル: `src/legacy/parts/12-progression-ui.js`（参照のみ）
- 関数: `SCENARIO_DEFS`
- 変更内容: **変更しない。** テストモード側から読むだけ
- 理由: シナリオ一覧の情報源を二重化しない

### Step 2. テストモード画面にシナリオ選択UIを追加する

- ファイル: `index.html`
- 対象: `#testmode-screen` 内（`#testmode-guest-grid` の後ろ）
- 変更内容: シナリオ選択用のセクション（ラベル＋グリッド）を1つ追加
- 理由: 既存の選択UI（職業・転身・ゲスト）と同じ場所に置き、新しい画面を作らない
- 備考: `basefile.html` は凍結。触らない

### Step 3. シナリオ選択の組み立てと受け渡し

- ファイル: `src/legacy/parts/01-character-creation.js`
- 関数: `setupTestModeScreen()`
- 変更内容: `SCENARIO_DEFS`（`unlocked:true` のみ）からカードを生成し、
  選択値を `beginTestMode()` の追加引数として渡す。未選択は従来どおり training
- 理由: 既存のゲスト選択UIと同じ組み立て方で揃える

### Step 4. シナリオ起動を beginTestMode に接続する

- ファイル: `src/legacy/parts/14-hud-boot.js`
- 関数: `beginTestMode(classKey, jobKey, level, guestKey, scenarioKey)`
- 変更内容: 既存の初期化と `finishEnteringGame({world:'training'})` は **そのまま** 実行し、
  その直後、`scenarioKey` が指定されていれば `launchScenario(scenarioKey)` を呼ぶ
- 理由: `state.testMode` の設定箇所を増やさずに、テストモードのままシナリオへ入れる
- **禁止**: `finishEnteringGame({world: scenarioKey})` のような呼び方（`testMode` が false になる）

### Step 5. 本編側の非干渉を確認する

- ファイル: なし（変更しない）
- 変更内容: **無し。** `applyChapterCast` / `beginGame` / `continueGame` /
  `startScenarioTavernDialogue` / `launchScenarioNow` はいずれも変更しない
- 理由: 本編の Chapter 進行・加入順・酒場イベント・Support AI の正式進行を変えないため

### Step 6. E2E ヘルパーを追加する

- ファイル: `tests/helpers.js`（新関数を追加）、`tests/scenario-test-mode.spec.js`（新規）
- 変更内容: テストモード経由で「クラス・ゲスト・シナリオ」を指定して直接起動する
  ヘルパーを追加する。既存テストは変更しない
- 理由: 偽セーブ注入＋歩行リトライ（現行 `duskvillage.spec.js` は最大30回・210秒）を不要にする

### Step 7.（別タスク候補）Progression / Skills の指定

- Unknowns の決定後に着手。本タスクでは設計のみ

## Files To Change

| ファイル | 変更 |
| --- | --- |
| `index.html` | テストモード画面にシナリオ選択セクションを1つ追加 |
| `src/legacy/parts/01-character-creation.js` | `setupTestModeScreen()` にシナリオ選択の組み立てを追加し、`beginTestMode()` へ渡す |
| `src/legacy/parts/14-hud-boot.js` | `beginTestMode()` に引数を1つ追加し、`finishEnteringGame` の後に `launchScenario()` を呼ぶ |
| `src/styles/main.css` | 追加UIの最小限のスタイル（既存 `.testmode-job-card` を流用できるなら不要） |
| `tests/helpers.js` | シナリオ直起動ヘルパーを **追加**（既存関数は変更しない） |
| `tests/scenario-test-mode.spec.js` | 新規 |

## Files Not To Change

| ファイル / 対象 | 理由 |
| --- | --- |
| `basefile.html` | 凍結 |
| `src/legacy/parts/12-progression-ui.js` の `launchScenario` / `launchScenarioNow` / `startScenarioTavernDialogue` / `SCENARIO_DEFS` | 本編のシナリオ開始経路。読むだけで変更しない |
| `src/legacy/parts/01-character-creation.js` の `CHAPTER_CAST` / `applyChapterCast` | 本編の Chapter 進行。今回は触らない |
| `src/legacy/parts/14-hud-boot.js` の `finishEnteringGame` | `state.testMode` の唯一の書き換え箇所。行を増やさない |
| `src/legacy/parts/09-save-load.js` | セーブ保護は既に成立している |
| `src/legacy/parts/08-loot-equipment.js` | Support AI の実体は既存のまま使う |
| `src/core/**` | 章進行の状態を増やさない |
| `docs/**` | 仕様の更新は別タスク（Required Changes の D-a〜D-d） |
| `.ai/agents/` / `.ai/decisions/` | 対象外 |
| `package.json` / `package-lock.json` / `vite.config.js` / `playwright.config.js` / `.github/**` | 変更しない |
| 既存テスト一式 | 変更しない。新規追加のみ |

## Test Plan

### 新規E2E `tests/scenario-test-mode.spec.js`

| # | 確認項目 | 内容 |
| --- | --- | --- |
| 1 | Chapter 1 の各シナリオを直接起動できる | `mansion` / `duskvillage` / `ghostship` / `conservatory` を起動し、`currentWorldKey` が一致する |
| 2 | 指定キャラクターを操作できる | 魔法使いを指定して起動し、`state.classDef.key === 'mage'` |
| 3 | Support AI を設定できる | ゲストに剣士を指定し、`state.guestClassKey === 'warrior'`、実体が生成される |
| 4 | 指定 world が正しく生成される | 入場座標が当該シナリオの entry 定数の近傍にある。`console.error` が出ない |
| 5 | 本編の Chapter 進行に影響しない | テストモード起動の前後で `CHAPTER_CAST` 由来の本編開始（剣士 / `mansion`）が変わらない |
| 6 | save/load を破壊しない | 既存セーブを書き込んだ状態でテストモードを通し、`localStorage` の `soulforge_save_v1` が **一切変化しない** |
| 7 | 通常のゲーム起動に影響しない | 「はじめる」「つづきから」が従来どおり動く（既存 `save-load.spec.js` が通ること） |
| 8 | シナリオ未選択時の従来動作 | 従来どおりトレーニング空間へ入り、Arena パネルが出る |

### 回帰確認

```sh
npm run build      # 連結後の構文チェックを兼ねる
npm run test:unit
npm test
```

既存E2E（特に `save-load.spec.js` / `combat-test-arena.spec.js` / `duskvillage.spec.js`）が
すべて通ること。**既存テストは書き換えない。**

## Acceptance Criteria

1. テストモード画面からシナリオを選んで直接起動できる
2. 起動中も `state.testMode` が true のままで、`saveGame()` が何も書かない
3. 既存セーブがテスト前後で一切変化しない
4. シナリオ未選択時は従来どおりトレーニング空間へ入る（現行動作の非変更）
5. 指定したクラス・転身・レベル・ゲストがそのまま反映される
6. `launchScenarioNow()` / `startScenarioTavernDialogue()` / `applyChapterCast()` /
   `finishEnteringGame()` に差分が無い
7. `WORLD_DEFS` に world を追加していない
8. `state` に章進行用の新フィールドを追加していない
9. `basefile.html` に差分が無い
10. `npm run build` / `npm run test:unit` / `npm test` がすべて通る
11. Chapter 2 を「実装済み」として扱っていない

## Risks

| # | リスク | 緩和 |
| --- | --- | --- |
| R1 | シナリオ world で `finishEnteringGame` を呼び `state.testMode` が false になり、セーブが上書きされる | 必ず `world:'training'` で入ってから `launchScenario()`。Acceptance 2・3 で縛る |
| R2 | テストモード用の分岐が本編の進行コードへ混入する | 本編側の関数を変更しない。Acceptance 6 で縛る |
| R3 | 「Chapter」という語を実装へ導入し、Arc との混同が固定化する | 実行時の状態を増やさない。Acceptance 8 で縛る |
| R4 | `CHAPTER_CAST.dungeonKey` を確定情報として扱う | コメントどおり仮置きとして扱い、未確定は「未確定」と表示する |
| R5 | 前提状態（Skill 2 習得・鍛冶士加入・★）が欠けてシナリオイベントが壊れて見える | Progression 指定の要否を Unknowns として残し、決定後に別タスクで対応 |
| R6 | 低レベルで `duskvillage`（minLevel 26）を起動して検証にならない | 既存のレベル指定UIを使う。既定値は未確定 |
| R7 | UI追加が肥大し、テストモード画面が使いづらくなる | 追加は「シナリオ選択」1セクションに限定する |

## Rollback

- 変更はすべて **追加**（UI 1セクション・引数1つ・呼び出し1行・新規テスト）で構成し、
  既存の関数の振る舞いを書き換えない。該当コミットの revert だけで完全に戻せる
- 段階的に戻す場合:
  1. Step 4（`launchScenario` の呼び出し）だけ戻す → シナリオ選択UIは残るが従来どおり training へ入る
  2. Step 2/3（UI）を戻す → テストモードは元の姿に戻る
  3. Step 6（テスト）を戻す → 完全に元の状態
- セーブデータ形式に変更が無いため、ロールバック時のマイグレーションは不要

## Unknowns（実装前に人間の決定が必要）

1. 盗賊 Arc の正式なシナリオ（実装の `clocktower` は仮置き）
2. 弓師 Arc の2つ目（温室）の紐付け方
3. 時計塔・地下水路・古代神殿の Chapter 1 本編での位置づけ
4. 影の旅人 Arc の内容とプレイアブル化の条件
5. Chapter 2 の解放条件と、解放要素の順序
6. Scenario Test Mode に Chapter 2 の選択肢を出すか（実体が無いため）
7. Progression State / Skills / Equipment をどこまで指定可能にするか
8. シナリオごとの既定レベル・既定ゲスト

1〜4 は仕様そのもの、5〜8 は Test Mode の範囲に関わる。
決定は `.ai/decisions/` に記録し、`docs/` の更新（Required Changes D-a〜D-d）と
合わせて行う。

## Notes

- 本タスクは Analyzer → Planner までで停止している
- ゲームコードは一切変更していない
- Scenario Test Mode の実装・Chapter 進行の実装・Character 切替・Support AI の
  正式進行・world 追加は、いずれも未着手
