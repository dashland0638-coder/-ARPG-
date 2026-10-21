# TEST-CHAPTER-SELECT-001 — 調査（Analyzer）

基準: `origin/main` `15fe597`（PR #96 の merge 後）。P01 = `src/legacy/parts/01-character-creation.js`、P02 = `02-world-common.js`、P07 = `07-ai-combat.js`、P09 = `09-save-load.js`、P10 = `10-input.js`、P12 = `12-progression-ui.js`、P14 = `14-hud-boot.js`、C = `src/core/`。

## 1. 既にあるもの（FACT）

| 仕組み | 場所 | 内容 |
| --- | --- | --- |
| テストモードの入口 | P01 `setupTestModeScreen`、`index.html` `#testmode-screen` | `?dev=1`（`DEV_UI`）の時だけ入口の行を出す。職業・転身・同行ゲスト・シナリオ・開始地点・レベルを選ぶ |
| 開始 | P14 `beginTestMode` | 状態を初期化 → `finishEnteringGame({world:'training'})`（ここで `state.testMode = true`）→ シナリオがあれば **本編の出撃と同じ `launchScenario`**（P12。`scenarioKey` → `routeReset` → `buildWorld` → 入場位置・カメラ・味方）→ 開始地点があれば `teleportTestModeTo`（位置だけを運ぶ） |
| 開始地点 | C `scenario-waypoints.js` | 宵待ちの村（10 地点）と道（3 地点）だけ |
| シナリオの一覧 | P12 `SCENARIO_DEFS` | `unlocked:false`（pyramid / volcano）はワールドが無い。第一章の順は C `chapter1-progress.js` `CHAPTER1_ORDER` |
| 顔ぶれ | P01 `presetChapter1Cast` | 第一章のシナリオを選ぶと、その章の主人公・支援を選び直す（`resolveCast`） |
| セーブの保護 | P09 `saveGame` | `state.testMode` なら書かない。`deleteSaveGame` は `beginGame`（新規）だけが呼ぶ |
| 読み込み | P09 `applySaveData` | `beginTestMode` が書いたものは、`bossSkill3CD`（一時値）以外すべてセーブの値で置き直す（`inventory`・`level`・`xp`・`levelGrowth`・`job`・`guestClassKey`・`spherePoints`・解放フラグなど） |

## 2. 足りないもの

| # | 足りないもの | 影響 |
| --- | --- | --- |
| G1 | チャプター → シナリオの階層が無い（全シナリオが 1 列） | 第一章のシナリオを選びにくい。将来のチャプターを足す場所が無い |
| G2 | ボス戦直前の開始地点が宵待ちの村にしか無く、その `boss`（0,515）はボス（0,520）から 5（< 6）なので**着いた瞬間に名乗りが始まる＝ボス戦の開始**で、直前ではない | 洋館・幽霊船・時計塔のボス戦の確認に、毎回入口から歩く |
| G3 | `teleportTestModeTo` は y を 0 に固定 | 上の階（時計塔の最上階 y:36）へ運ぶと床の下に出て落ち、入口へ戻される |
| G4 | `returnToTitle` が `state.testMode` を下ろさない | タイトルに戻った後もテストの印が残る（入場時に `finishEnteringGame` が立て直すので、今は実害なし） |
| G5 | `deleteSaveGame` に testMode の門番が無い | 今は呼ばれないが、守りが 1 か所だけ |
| G6 | メニューの「セーブ」はテストモードで「⚠️ セーブに失敗しました」と出る。「タイトルへ戻る」の確認文は「自動的にセーブされます」 | 実際には書いていないのに、失敗・保存に見える |
| G7 | 開始の可否の判定が UI と `beginTestMode` に散らばっている（`SCENARIO_DEFS.find` と `findWaypoint`）。知らない開始地点は黙って入口から始まる | 未対応の組み合わせを拒否できない。テストできない |
| G8 | iPhone の横画面（高さ 390）で、選んだ後に開始ボタンまでスクロールが要る | 実機で使いにくい |

## 3. ボス戦直前・開始の位置（独立した調査、読み取りのみ）

共通（FACT）:
- 各シナリオは 1 つのワールドで、階は x/z を分けて同時に作られる。階段は位置の移動だけ（P02 `stairMoveTo`）
- ボスはワールドの構築時に作られる（P07 `spawnEnemies`）。目覚めるのは、会話が無く、`bossDoorKey` の扉が無いか開いていて、3D の距離 < 6 で、見通しがある時（P07 `updateBossAI`）。名乗り（P12 `startBossDialogue`）の後に `triggered`
- 撃破の処理（P12 `onBossDefeated`）は進行フラグを要らない
- ボスの扉は調べると開く普通の扉（鍵は無い）

| シナリオ | 直前 | 開始（近づくと名乗る） | 根拠 |
| --- | --- | --- | --- |
| 洋館 | (80,137) 当主の間の前室。地下の最深部からの階段の着地点 | (80,161)。扉が無いので本編と同じ経路 | P03 部屋 bAnte/bLord、ボス (80,166)、階段 → (80,0,137) |
| 宵待ちの村 | (0,495) 扉（z:500）の手前 | (0,515)（既存の `boss`） | 14-dungeon-duskvillage ボス (0,520) |
| 幽霊船 | (-32,108) 船倉の階段の着地点。扉 `bossHoldDoor` の前 | 持たない（扉を閉じたまま中へ入ると、本編の経路ではボスが動かない） | P04 扉 (-32,110)、ボス (-32,120) |
| 時計塔 | (-288, **y:36**, 186) 最上階の控えの間。4 階からの階段の着地点 | 持たない（扉） | P03 床 y:36、扉 `towerBossDoor` x:-260、ボス (-228,36,196) |
| 道 | ボスはいない（既存の `rest` が山場） | ― | 14-dungeon-road「ボスは置かない」 |
| 神殿（章外） | (96,-119) 前室 | 付けない（今回は第一章を優先） | P03 |
| 地下水路（章外） | (-104,-108) 最奥の扉の前 | 持たない（扉） | P04 |
| 硝子の温室（章外） | (226,61) 扉の前の通路 | 持たない（扉） | P03 |

「ボス戦の途中から」（ボスの HP・段階を進めた状態）は、ボスの内部状態を作り直す経路が無いので持たない。

## 4. キャラクター・パーティー

既存の「職業」「転身」「同行ゲスト」の選択と、第一章のシナリオを選んだ時の顔ぶれの自動選択（`presetChapter1Cast`）をそのまま使う。新しい処理は足さない。

## 5. 計画（Planner）

1. C `test-scenario-select.js`（新規）: チャプターの表（id と表示名を分ける）、シナリオの一覧（`SCENARIO_DEFS` の name を使う）、開始地点の一覧と種類（入口 / ボス戦直前 / ボス戦開始 / 途中）、開始の可否の判定、通常セーブへ書いてよいかの判定
2. C `scenario-waypoints.js`: 上の表の地点を足す（`kind`、時計塔は `y`）
3. P14: `beginTestMode` は判定を通ってから `launchScenario`（拒否は console.error を出してトレーニング空間に留まる）。`teleportTestModeTo` は y と落下の時計（`voidT` / `lastSolid`）を階段と同じく置き直す
4. P09 / P10: `saveGame` / `deleteSaveGame` の門番を core の判定へ、`returnToTitle` で `state.testMode` を下ろす、メニューの文言をテストモード用に
5. P01 / `index.html` / CSS: チャプターの欄、開始地点の種類の印、選択の要約、開始・戻るを画面の下に留める帯
6. unit（表・判定・保護）、E2E（入口・一覧・拒否・戻る・各シナリオの開始・ボス直前/開始・セーブの保護・つづきから・iPhone 横画面）

Escalation Check: None（ゲームの数値・本編の進行・セーブの形式は変えない。テストモードの中だけ）。
