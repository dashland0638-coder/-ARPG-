# CHAPTER-STRUCTURE

Chapter 構造の仕様修正と Scenario Test Mode の設計

Status: **PLANNED（Analyzer → Planner まで）** ／ 本タスクでのゲームコード変更なし

Analysis: [`../reports/CHAPTER-STRUCTURE-analysis.md`](../reports/CHAPTER-STRUCTURE-analysis.md)
Related: [`MAGE-001.md`](MAGE-001.md) / [`../decisions/DEC-001-duskvillage-rebuild.md`](../decisions/DEC-001-duskvillage-rebuild.md)

> **改訂（WORK 12.1 後）**
> 旧版は「Scenario Test Mode を新設する」計画だったが、WORK 1 / 4 / 12.1 で
> **シナリオ直接起動・開始地点・Arc の顔ぶれ自動プリセットは実装済み**になった。
> また WORK 10〜12.1 で Chapter 1 の本編進行（主人公交代・支援AI・酒場の一幕・道）も実装済み。
> 本版は「Chapter / Arc / Scenario を正しく分離した上で、既存テストモードに残っている欠落を最小差分で埋める」計画に改めた。

## Goal

Chapter 1 / Chapter 2 と Scenario を正しく分離し、
各シナリオを直接起動できる Test Mode の基盤を設計する。

具体的には:

1. 用語（Chapter / Character Arc / Scenario / Stage / Scenario Test）を固定する
2. 既存テストモードのシナリオ一覧を **Chapter → Arc → Scenario** の階層で見せる
3. テストモードの初期状態を、**本編でその Arc を始めた時と同じ**にできるようにする（MAGE-001 の前提）
4. 本編の Chapter 進行・セーブを一切変えない

## Terminology

| 用語 | 定義 | 実装上の対応 |
| --- | --- | --- |
| **Chapter** | 物語・ゲーム進行上の大区分（第一章 / 第二章） | 実行時の状態は無い。`chapter1Complete(scenarioClears)` から導出 |
| **Character Arc（主役パート）** | Chapter 内で特定キャラを主役として進める区間 | `CHAPTER_CAST[n]`（n=1..5）。**フィールド `chapter` は Arc 番号の意味** |
| **Scenario** | 具体的な物語・ゲームプレイ単位 | `SCENARIO_DEFS` のエントリ |
| **Dungeon / Stage** | 実際にプレイするステージ | `WORLD_DEFS` の world key（現状 Scenario key と同一文字列） |
| **Scenario Test** | 開発用に特定のシナリオを直接起動する仕組み | 既存テストモード（`#testmode-screen` → `beginTestMode()`） |

階層の例:

```
Chapter 1 → Character Arc 2（魔法使い主役 / 支援: 剣士）→ Scenario 宵待ちの村 → Stage duskvillage
```

今後の仕様書・レポート・コードコメントでは「第n章」を Arc の意味で使わない。Arc は「〇〇主役パート」または「Arc n」と書く。

## Specification

### Chapter 1（固定進行）

| Arc | 主役 | Support AI | Scenario（仕様） | Stage（実装） | 状態 |
| --- | --- | --- | --- | --- | --- |
| 1 | 剣士 | なし | 森の洋館 | `mansion` | 確定 |
| 2 | 魔法使い | 剣士 | 宵待ちの村 | `duskvillage` | 確定 |
| 3 | 弓師 | 魔法使い | 幽霊船 → 温室 | `ghostship`（温室 `conservatory` は本編未接続） | 幽霊船は確定、温室の接続は未確定 |
| 4 | 盗賊 | 弓師 | **未確定**（仕様案: 宵待ちの村の別展開・関連エリア） | `clocktower`（仮置き） | 未確定 |
| 4→5 | 盗賊 → 影の旅人 | 弓師 → 盗賊 | （実装のみ）道 | `road` | 実装側の拡張。仕様への取り込み未確定 |

- 開始時は剣士単独。自由な3人パーティではない
- シナリオクリア → 酒場 → 次の主役が登場 → 前の主役が Support AI になる
- 切り替えは酒場・イベント・シナリオ進行でのみ起こる（メニューから選ばない）

### Chapter 2（自由進行）

キャラ自由選択・3人パーティ・ダンジョン自由選択・スフィア盤・育成施設・エンドダンジョン・
周回高難易度化・マップ変異・強モブ を段階的に解放する。

**現状は未実装**（道の後に「🧭 この先の旅 🔒 準備中」のカードが出るだけ）。解放条件・順序は未確定。

### Scenario Test Mode

- 開発者・テスト用。**本編の Chapter 進行ルールを変更しない**
- 本編を最初から遊ばずに、特定の Chapter / Arc / Scenario / キャラクターを直接検証する
- セーブデータを読み書きしない

## Current Implementation

| 項目 | 現状 |
| --- | --- |
| Chapter 1 進行 | **実装済み**。`core/chapter1-progress.js`（`CHAPTER1_ORDER` / `stageFor` / `resolveCast` / `offeredScenarios`）。新しい state・save フィールド無し |
| 主人公交代 | **実装済み**。`returnToTownNow()` → `advanceChapter1Cast()`、道の出会いで `meetChapter1Protagonist()` |
| Support AI | **実装済み**。`state.guestClassKey = chapter1GuestKey()` → `syncAlliesToState()` |
| 酒場の一幕 | **実装済み**。`CHAPTER1_JOIN_LINES`（mage / archer / rogue）、暗転明け後に開く |
| Chapter 2 | **未実装**。入口カードのみ。旧ハクスラ系は `legacyGrowthEnabled(testMode)` で本編から隔離 |
| テストモード | **実装済み**。職業・転身・レベル・同行ゲスト・シナリオ（平坦な一覧）・開始地点。Chapter 1 のシナリオを選ぶと Arc の主役＋支援を自動プリセット |
| テストモードの欠落 | (a) 一覧が Chapter / Arc で整理されていない (b) Skill 1 が `retreat` 固定（本編の魔法使いは `phantom`） (c) 進行状態がすべて空（本編相当を作れない） (d) Skill 2 が常に使える（閃き前を再現できない） |
| セーブ保護 | `state.testMode` は `finishEnteringGame` の1行のみで設定、`saveGame()` は即 return |

## Required Changes

### (1) 仕様・用語（ドキュメント。本タスクでは未実施 ―― docs 変更禁止のため別タスク）

| # | 変更 | 対象 |
| --- | --- | --- |
| D-a | Chapter / Arc / Scenario / Stage / Scenario Test の階層を明記 | `docs/SCENARIOS.md` |
| D-b | 「②が仕様と異なる」の訂正（現在は一致）。道・影の旅人の扱いを追記 | `docs/SCENARIOS.md` |
| D-c | D-03 / D-04 を「WORK 10〜12.1 で実装済み」に更新 | `docs/README.md` |
| D-d | Chapter 2 は未実装、旧ハクスラ系は隔離中と明記 | `docs/PROGRESSION.md` |

### (2) Scenario Test Mode の欠落補完（ゲームコード。次の実装タスク）

| # | 変更 | 優先度 |
| --- | --- | --- |
| T-1 | テストモードの Skill 1 既定を `defaultSkill1For(classKey)` にする | **高**（MAGE-001 の前提） |
| T-2 | シナリオ一覧を Chapter 1（Arc 付き）/ 本編外 / Chapter 2（未実装）に分けて表示する | 中 |
| T-3 | 「進行状態: 空 / 本編相当」の選択を追加する | 中（Unknown 7 の決定後） |
| T-4 | 「Skill 2: 使用可 / 本編どおり未習得」の選択を追加する | 低（Unknown 8 の決定後） |

### (3) 対象外

Chapter 1 の構成変更（温室の接続・Arc 4 の差し替え）、Chapter 2 の実装、`CHAPTER_CAST` のリネームは行わない。いずれも仕様の確定が先。

## Scenario Test Mode

### Entry Point

**既存のまま**。新しい画面・モード・URL パラメータは作らない。

```
タイトル → 🛠 テストモード（#open-testmode-btn）→ #testmode-screen
  職業 / 転身 / デバッグ用レベル / 同行ゲスト / シナリオ / 開始地点 / [T-3 進行状態] / [T-4 Skill 2]
  → 開始（#testmode-start-btn）
```

起動順序（変更しない）:

```
beginTestMode(...)
  └ finishEnteringGame({world:'training'})   ← state.testMode = true（唯一の書き換え箇所）
     └ launchScenario(scenarioKey)            ← 本編と同じ起動経路
        └ teleportTestModeTo(waypoint)        ← 開始地点（任意）
```

### Scenario Selection

一覧は **既存データから導出** する。新しい表は作らない。

| 区分 | 導出元 | 表示 |
| --- | --- | --- |
| Chapter 1 | `CHAPTER1_ORDER` の順、Arc は `resolveCast(stage, CHAPTER_CAST)` | `Arc 2 魔法使い / 🏮 宵待ちの村` の形 |
| Chapter 1（仕様上の所属） | `conservatory` のみ。Arc 3 の2つ目 | 「本編未接続」と明示 |
| 仮置き | `clocktower`（Arc 4） | 「仮」と明示 |
| 本編外 | `SCENARIO_DEFS` の `unlocked:true` のうち上記に無いもの（`waterway` / `temple`） | 「本編外」 |
| Chapter 2 | 実体無し | 「未実装」見出しのみ、または非表示（Unknown 9） |
| トレーニング空間 | 既存の「🛠 トレーニング空間」 | 既定（未選択時） |

`conservatory` の Arc 対応（Arc 3）は `CHAPTER_CAST` にも `CHAPTER1_ORDER` にも無い。
表示のためだけに持つなら **テストモード UI 内のローカル定数1行**に留め、本編のデータ（`CHAPTER_CAST` / `CHAPTER1_ORDER`）へは足さない。

### Initial State

| 項目 | 現状 | 変更後 |
| --- | --- | --- |
| 共通の初期化 | `beginTestMode()` の既存処理 | そのまま |
| Skill 1 | `retreat` 固定 | `defaultSkill1For(classKey)`（T-1） |
| 進行状態 | すべて空 | 既定は空のまま。「本編相当」を選んだときだけ設定（T-3） |
| Skill 2 | `hasSkill2` が testMode で常に true | 既定は現状維持。「未習得」を選んだときだけ閃き前を再現（T-4） |

### Player Character

**既存のまま**（職業4種 / 転身 / デバッグ用レベル）。Chapter 1 のシナリオ選択時は `presetChapter1Cast()` が Arc の主役を自動選択。
影の旅人（`hidden:true`）は選べない（Unknown 10）。

### Support Character

**既存のまま**（同行ゲスト: なし＋4クラス）。Arc の正式な支援を自動プリセット済み。テストモードでは任意に変更可。

### World / Stage

**既存のまま**。`launchScenario(key)` に委ねる。world を追加しない。

### Skills

- T-1: Skill 1 既定 = `defaultSkill1For(classKey)`（魔法使い → 幻影歩法）
- 付け替えは既存の鑑定所スキル欄（testMode では派生スキル全解放済み）
- T-4（要判断）: Skill 2 を閃き前の状態で始める選択肢

### Equipment

**変更しない**。`grantStarterGear()` のクラス武器。Chapter 1 の本編もクラス武器のみなので、差は無い。

### Progression

T-3（要判断）。「本編相当」を選んだ場合に設定する値（すべて既存フィールド）:

| フィールド | 値 |
| --- | --- |
| `scenarioClears` | `CHAPTER1_ORDER` で **対象シナリオより前** のものを各 1。対象シナリオ自身は 0（★・制限時間を本編の初回と同じにするため） |
| `clearedScenarios` | 同上 |
| `smithJoined` / `smithGreeted` / `smithToolsRecovered` | 洋館より後のシナリオなら true |
| `mansionNormalized` | 洋館より後なら true |
| `shadowGuideMet` / `shadowGuideTalks` | 未確定（道の前提として必要か要確認） |

本編相当の値を作る関数は `core/` に純粋関数として置き、unit テストで固定する。
`advanceChapter1Cast()` は testMode で何もしないので、`scenarioClears` を書いても本編の交代は走らない。

### Debug Options

**新設しない**。既存の `state.debugMode`（被ダメージ0 など）・テストモードの HP1 踏み止まり・Combat Test Arena を使う。
HP / MP / スタミナ / クールダウンの直接操作・敵出現の制御は本タスクの対象外（必要になった検証タスクで個別に判断）。

## Implementation Plan

最小変更。本編の関数には触れない。**本タスクでは実装しない**（次タスクの計画）。

### Step 1（T-1）. テストモードの Skill 1 既定を本編に揃える

- ファイル: `src/legacy/parts/14-hud-boot.js`
- 関数: `beginTestMode()`
- 変更内容: `state.skillChoice = 'retreat'` を `state.skillChoice = defaultSkill1For(classKey)` に変える（1行）
- 理由: 本編の交代時と同じ Skill 1 で始まるようにする。MAGE-001 を宵待ちの村で付け替え無しに検証できる
- 備考: `defaultSkill1For` は既に `concat-plugin.js` で共有スコープへ公開済み。剣士・盗賊・弓師は `retreat` のままなので結果が変わるのは魔法使いだけ

### Step 2（T-2）. シナリオ一覧を Chapter / Arc で整理する

- ファイル: `src/legacy/parts/01-character-creation.js`
- 関数: `setupTestModeScreen()` 内の `buildScenarioGrid()`
- 変更内容: `SCENARIO_DEFS.forEach` の平坦な列挙を、(1) `CHAPTER1_ORDER` 順に Arc ラベル付きで Chapter 1、(2) 残りの `unlocked:true` を「本編外」、の順に並べる。見出しは既存 `.testmode-job-card` と同じ要素で、クリック不可のラベル行として差し込む。カードの `data-scenario-key` は変えない（既存 E2E / `startTestMode` の互換）
- 理由: 一覧で Chapter → Arc → Scenario の階層が見えるようにする。情報源は既存データのみ
- 備考: TDZ 回避のため既存どおり「画面を開いた瞬間」に組み立てる。`conservatory` の Arc 3 注記・`clocktower` の「仮」はこの関数内のローカル表示に留める

### Step 3（T-3）. 進行状態プリセット（Unknown 7 決定後）

- ファイル: `src/core/chapter1-progress.js`（関数追加）、`01-character-creation.js`、`14-hud-boot.js`、`index.html`
- 関数: 新規 `mainlineProgressBefore(scenarioKey)`（純粋関数。`scenarioClears` の形を返す）、`beginTestMode()` に引数 `progressPreset` を追加
- 変更内容: 選択が「本編相当」のときだけ、`beginTestMode()` の既存初期化の **後** に上表の値を上書きする。既定（空）の動作は変えない
- 理由: シナリオ内のイベント条件（鍛冶士・洋館正常化など）を本編と同じ前提で検証できるようにする
- 備考: `finishEnteringGame` は変更しない

### Step 4（T-4）. Skill 2 閃き前の再現（Unknown 8 決定後）

- ファイル: `src/core/chapter1-skills.js`、`14-hud-boot.js`、`01-character-creation.js`、`index.html`
- 関数: `hasSkill2(progress)`
- 変更内容: testMode でも「未習得で開始」を選んだ場合は `learnedSkill2` に従う（例: テスト専用フラグ `state.testSkill2Locked`。セーブされないことを確認）
- 理由: 宵待ちの村の閃きイベントをテストモードで再現する
- 備考: 本編の判定（`learnedSkill2`）は変えない。unit を追加

### Step 5. E2E ヘルパー

- ファイル: `tests/helpers.js`
- 関数: `startTestMode(page, opts)`
- 変更内容: Step 3 / 4 を入れた場合のみ `progress` / `skill2` オプションを **追加**（既存引数・既存呼び出しは不変）
- 理由: 新規 E2E から使う

## Files To Change

（次の実装タスクで。本タスクでは変更しない）

| ファイル | Step | 変更 |
| --- | --- | --- |
| `src/legacy/parts/14-hud-boot.js` | 1, 3, 4 | `beginTestMode()` のみ |
| `src/legacy/parts/01-character-creation.js` | 2, 3, 4 | `setupTestModeScreen()` / `buildScenarioGrid()` のみ |
| `src/core/chapter1-progress.js` | 3 | 純粋関数を1つ追加（既存関数は不変） |
| `src/core/chapter1-skills.js` | 4 | `hasSkill2` の testMode 分岐 |
| `src/legacy/concat-plugin.js` | 3 | 追加関数の公開（既存の並びに1語足すだけ） |
| `index.html` | 3, 4 | テストモード画面に選択欄を追加 |
| `tests/helpers.js` | 5 | オプション追加 |
| `tests/scenario-test-mode.spec.js` | 全 | テスト追加 |
| `tests/unit/*` | 3, 4 | 純粋関数のテスト追加 |

Step 1 だけなら `14-hud-boot.js` 1行＋テスト追加で完結する。

## Files Not To Change

| 対象 | 理由 |
| --- | --- |
| `CHAPTER_CAST` / `applyChapterCast()` | 本編の Arc 表。仕様確定前に変えない |
| `CHAPTER1_ORDER` / `stageFor` / `resolveCast` / `offeredScenarios` / `nextScenario` | 本編の進行 |
| `advanceChapter1Cast()` / `switchProtagonist()` / `meetChapter1Protagonist()` / `normalizeChapter1Load()` | 本編の交代 |
| `finishEnteringGame()` | `state.testMode` の唯一の書き換え箇所 |
| `launchScenario()` / `launchScenarioNow()` / `renderScenarioList()` / `startScenarioTavernDialogue()` / `returnToTownNow()` | 本編のシナリオ開始・帰還 |
| `SCENARIO_DEFS` / `WORLD_DEFS` | world・シナリオを追加しない |
| `src/legacy/parts/09-save-load.js` | セーブ形式・保護は変えない |
| `src/legacy/parts/08-loot-equipment.js` | Support AI の実体は既存のまま |
| `basefile.html` | 凍結 |
| `docs/**` / `.ai/agents/**` / `.ai/decisions/**` | 本タスクの対象外（docs は Required Changes (1) を別タスクで） |
| `package.json` / `package-lock.json` / 設定ファイル / `.github/**` | 変更しない |
| 既存テストの期待値 | 変更しない。追加のみ |

## Test Plan

### E2E（`tests/scenario-test-mode.spec.js` に追加）

| # | 確認項目 | 方法 |
| --- | --- | --- |
| 1 | Chapter 1 の各シナリオを直接起動できる | `mansion` / `duskvillage` / `ghostship` / `clocktower` / `road` をそれぞれ起動し、`#minimap-area` の場所名（AREA_NAMES 登録済みのもの）と `console.error` 無しを確認 |
| 2 | 指定キャラクターを操作できる | `duskvillage` 選択で HUD に「魔法使い ｜ 支援: 剣士」（プリセット）。職業を手動で変えた場合はそれが反映される |
| 3 | 必要な Support AI を設定できる | Arc プリセットのゲストが HUD に出る。「単独」を選ぶと支援表記が消える |
| 4 | 指定 world が正しく生成される | 開始地点（`duskvillage` の `market` など）への移動後に場所名が一致 |
| 5 | Skill 1 が本編と同じ（T-1） | 魔法使いで起動 → Skill 1 ボタンが 👣（幻影歩法）。剣士は従来どおり |
| 6 | 一覧が Chapter / Arc で整理される（T-2） | Chapter 1 見出し配下に 5件が `CHAPTER1_ORDER` 順、本編外に `waterway` / `temple` / `conservatory` 注記。`pyramid` / `volcano` は出ない |
| 7 | 本編の Chapter 進行に影響しない | テストモードで任意シナリオへ → タイトルへ戻る → 「はじめる」で剣士単独・行き先は洋館のみ |
| 8 | save/load を破壊しない | 偽セーブを置いた状態でテストモードを通し、`soulforge_save_v1` が1バイトも変わらない（既存テストの形） |
| 9 | 通常のゲーム起動に影響しない | 既存 `save-load.spec.js` / `chapter1-progression.spec.js` がそのまま通る |
| 10 | シナリオ未選択時は従来どおり | トレーニング空間・Arena ボタン表示（既存テスト） |

### Unit

- T-3: `mainlineProgressBefore(key)` が `CHAPTER1_ORDER` の前段だけを 1 にし、対象自身は 0
- T-4: `hasSkill2` が testMode＋未習得指定で false、本編の判定は不変

### 回帰

```sh
npm run build
npm run test:unit
npm test
```

## Acceptance Criteria

1. テストモードから Chapter 1 の全シナリオ（`mansion` / `duskvillage` / `ghostship` / `clocktower` / `road`）と本編外シナリオを直接起動できる
2. Chapter 1 のシナリオを選ぶと、その Arc の主役と Support AI が既定で選ばれる（既存動作の維持）
3. 魔法使いで起動すると Skill 1 が幻影歩法になっている（T-1）
4. 一覧で Chapter / Arc / Scenario の階層が読み取れ、仮置き・本編未接続・未実装が明示されている（T-2）
5. 起動中は `state.testMode` が true のままで、実セーブが一切変化しない
6. 本編の関数（Files Not To Change）に差分が無い
7. `WORLD_DEFS` / `SCENARIO_DEFS` / `CHAPTER_CAST` / `CHAPTER1_ORDER` に追加・変更が無い
8. `state` / セーブに Chapter 用の新フィールドが無い
9. Chapter 2 を実装済みとして扱っていない
10. `npm run build` / `npm run test:unit` / `npm test` がすべて通る

## Risks

| # | リスク | 緩和 |
| --- | --- | --- |
| RK-1 | シナリオ world で `finishEnteringGame` を呼び testMode が false → 実セーブ上書き | 起動順序を変えない。Acceptance 5 |
| RK-2 | 「本編相当」で対象シナリオ自身のクリア数を立てると ★2 扱いになり敵強化・制限時間が発生 | 前段だけ立てる。unit で固定 |
| RK-3 | テスト用分岐が本編関数へ混入 | 変更は `beginTestMode` / `setupTestModeScreen` / 純粋関数追加に限定。Acceptance 6 |
| RK-4 | 仮置き・未接続の対応を確定情報として UI に固定 | 表示に「仮」「本編未接続」を付け、データは既存から導出 |
| RK-5 | 一覧の見出し追加で既存 E2E のセレクタが壊れる | カードの `data-scenario-key` とクラスを維持。見出しは別属性 |
| RK-6 | T-4 のテスト専用フラグがセーブに混入 | `saveGame` は testMode で即 return するため書かれないが、`snapshot()` の対象にも入れない |
| RK-7 | T-1 で剣士等の Skill 1 が変わる | `defaultSkill1For` は魔法使い以外 `retreat` を返すので不変。E2E 5 で確認 |

## Rollback

- 各 Step は独立しており、コミット単位で revert できる
- Step 1 は1行の差し戻しで元に戻る
- Step 2 は `buildScenarioGrid()` の差し戻しのみ（カードの属性を変えていないので E2E ヘルパーは影響を受けない）
- Step 3 / 4 は追加引数・追加関数の削除で戻る。既定値は現行動作なので、UI を外すだけでも実質無効になる
- セーブ形式に変更が無いため、マイグレーション不要

## Unknowns（実装前に人間の決定が必要）

1. 盗賊 Arc の正式シナリオ（実装 `clocktower` は仮置き）
2. 温室を Arc 3 の本編へ接続するか
3. 影の旅人・道を Chapter 1 の正式仕様に取り込むか
4. 時計塔・地下水路・古代神殿の最終的な所属
5. Chapter 2 の解放条件と順序
6. Chapter 2 で影の旅人を選べるか
7. 進行状態「本編相当」プリセットを持つか（T-3）
8. Skill 2「未習得で開始」を持つか（T-4）
9. Chapter 2 を一覧に「未実装」として出すか
10. 影の旅人をテストモードの主人公として直接選べるようにするか

1〜6 は仕様、7〜10 は Test Mode の範囲。決定は `.ai/decisions/` に記録してから実装に入る。
**T-1 は Unknown に依存しないため、決定を待たずに着手できる。**

## Notes

- 本タスクは Analyzer → Planner までで停止している
- ゲームコード（`src/`）・`docs/`・テスト・package は一切変更していない
- Chapter 進行・Character 切替・Support AI・world 追加・新しい Chapter の追加は行っていない
