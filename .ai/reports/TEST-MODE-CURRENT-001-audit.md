# TEST-MODE-CURRENT-001 — テストモードの現状監査と変更方針

基準: main `0d33bdb`（PR #100 の merge 後）。根拠は現行コード（過去の報告は参照だけ）。

## 1. 起動とアクセス制御（変更しない）

| 項目 | 現行 | 根拠 |
| --- | --- | --- |
| 入口 | `?dev=1` の時だけタイトルに「🛠 テストモード」。`DEV_UI = devUiEnabled(location.search)`、保存しない | `01-character-creation.js:135`、`core/dev-ui.js` |
| テスト専用アプリ | `?dev=1&app=test` は「はじめる」「つづきから」を出さない | `01:139`、`core/pwa-entry.js` |
| testMode | `finishEnteringGame` の `state.testMode = (world==='training')` だけが立てる。シナリオへは training 経由の `launchScenario` | `14-hud-boot.js:2230`、`:1696` |
| セーブ | `saveGame()` はテストモードで何もしない | `09-save-load.js`、`core/test-scenario-select.js canWriteNormalSave` |
| DEBUG / PERF / Motion | `toggleDebugMode()` は `DEV_UI` が偽なら何もしない（` キー・版表記 5 連打） | `02-world-common.js:1627` |
| Arena | `state.testMode` の時だけ表示（`updateArenaPanel`） | `14-training-ground.js` |

## 2. 本編とテストモードの分岐 — 主な問題

**`legacyGrowth()` = `legacyGrowthEnabled(state.testMode)` = テストモードなら常に真**（`01:131`、`core/chapter1-rules.js:23`）。
テストモードは「開発用だから旧ハクスラ系を全部動かす」設計のままで、**現行の第一章の本編とは別のゲームとして動いている**。分岐は 60 か所以上。

| 分類 | テストモードで起きること（本編では起きない） | 主な場所 |
| --- | --- | --- |
| 強さ | **ステータスにレベル成長・振り分け・パッシブ・強化・上位職が乗る**（本編はクラスの基礎値＋装備だけ）。テストの既定レベルは 50 → 本編よりはるかに強い | `12-progression-ui.js:1803`（recomputeStats）、`index.html` 既定 `value="50"` |
| 成長 | 経験値・レベルアップ・スフィアのポイント・転身 | `12:1892`（grantXP）、`:1932` |
| HUD | 名前に `Lv.N`、XP バー、Skill 3 ボタン、操作ヒントの Skill 3 | `12:1885`、`core/combat-hud-visibility.js legacyHudVisible`、`14-hud-boot.js:473` |
| 戦利品 | 装備ドロップ・宝箱の装備・未鑑定・魔宝石・欠片・Lv 制限 | `08-loot-equipment.js:26,232,248,338,441,782` |
| 物語 | 第一章の台詞・一幕の差し替えが起きない（幽霊船・時計塔の本編の仕掛けを置かない、船長・道の台詞が旧版） | `03:1054`、`04:276`、`07:438-499`、`14-dungeon-road.js:417,449`、`12:91,232,255,1486` |
| 世界 | 異空間（裂け目）が出る | `02:1131,1188` |
| 鍛冶屋 | 鑑定所の全タブ（スフィア盤・振り分け・強化・Skill 付け替え）、題名「鑑定所」 | `12:2599,2614,3174,3273` |

結果として、テストモードで確かめた戦闘の手応え・HUD・物語・戦利品は本編と一致しない。PR #100 の実機確認で「自キャラが強すぎてボスが段階 3 の前に倒れる」のも、この強さの分岐（既定 Lv 50 の成長）が原因。

### テストモード専用の利便（本編との差だが、デバッグの道具として残す）

- Skill 2 を最初から持つ（`core/chapter1-skills.js hasSkill2`）
- 鍛冶屋の画面をどこでも I キーで開ける（`smithFacilityAvailable`）
- 被ダメージで倒れず HP 1 で残る、潤沢な薬、セーブしない
- Arena（敵の出現・Debug Info・結果画面の確認・支援AIの休止・村の残響の段階 3）

## 3. テストモードの UI

| 画面 | 現行 | 問題 |
| --- | --- | --- |
| 開始画面 | 職業／転身／同行ゲスト／チャプター／シナリオ／開始地点／デバッグ用レベル（既定 50） | 説明文が「職業・転身・レベルを直接指定して」のまま。転身とレベルは本編に無い。見出し「同行ゲスト(2部制#41…)」が古い |
| Arena | ロスター（訓練用・洋館・村の敵）／Clear／Debug Info／スキル・スフィア盤／結果画面の確認／支援AI休止・村の残響を段階3へ | 「スフィア盤」は本編に無い。段階の操作が村の残響だけ |
| Debug Info | 最も近い敵の HP・体幹・AI 状態・当たり・予兆の輪 | どのルール・どの場所・どのボス段階で動いているかが出ない |

UI の更新はテストモードと本編で共有している（HUD・鍛冶屋の画面は同じ DOM・同じ関数）。二重実装は無い。分岐は `legacyGrowth()` による表示の出し分けだけ。

## 4. 既存のテスト

- 66 本の E2E のうち 51 本がテストモードを使う。`tests/helpers.js startTestMode({classKey, guestKey, scenario, waypoint, level})`
- 旧成長系の表示をテストモードで確かめる E2E がある（`chapter1-legacy-ui.spec.js`「テストモード: 旧成長系の UI は従来どおり出る」、`chapter1-facility-access.spec.js`「テストモード: どこでも I キーで鑑定所が開く」など）
- unit: `chapter1-rules.test.js`（`legacyGrowthEnabled(true) === true`）ほか、`legacyGrowth()` の分岐をソースで確かめるもの

## 5. 変更方針（Planner）

**テストモードの既定を「現行の第一章の本編ルール」にし、旧成長系は明示して選んだ時だけ動かす。** 旧成長系のコードは消さない（第二章以降の基盤、`chapter1-rules.js` の方針どおり）。

1. **ルールを 2 つに分ける**（`core/chapter1-rules.js`）
   - `TEST_RULES = {CURRENT:'current', LEGACY:'legacy'}`
   - `legacyGrowthEnabled(testMode, testRules)` は「テストモード かつ 旧成長ルール」の時だけ真。本編は常に偽（変わらない）
   - `legacyGrowth()` と HUD の表示条件はこの判定だけを通す（呼び出し側の分岐は今のまま）
2. **開始画面**: 「ルール」を足す。既定は「第一章（本編と同じ）」。転身・レベルは「旧成長システム」を選んだ時だけ出す（見出しに「本編の第一章には無い」と書く）。説明文と見出しを現行に合わせる
3. **テスト用の強さ**: 本編ルールでは、レベルの代わりに Arena の 1 ボタン `💪 強さ ×1 / ×0.5 / ×2`（HP と攻撃力だけ、テストモードの間だけ、`recomputeStats` の最後に掛ける）。成長の仕組みとは別物と分かる表記にする
4. **ボスの段階**: `🌊 村の残響を段階3へ` を `⏭ ボスを次の段階へ` に広げる（どのボスでも HP を次の境目 65% / 30% へ。段階の移り変わりは本編の処理。村の残響の段階 3 は今までどおり分身が出るまで攻撃を止める）
5. **Debug Info の見出し**: ルール・強さ・場所（ワールド／部屋）・ボスの段階・支援AIを、敵の行の上に 4 行で出す
6. **鍛冶屋の入口の表記**: Arena の `🎛 スキル / スフィア盤` を、ルールに合わせて `🎛 装備・スキル` / `🎛 スキル / スフィア盤` にする
7. **テストの扱い**: `startTestMode` に `rules` を足す。`level` を指定したテスト（レベルの強さに頼る従来のテスト）は旧成長ルールのまま動かす（`level` を渡す＝旧成長ルールの指定）。指定の無いテストは本編ルールで動く。旧成長系を確かめるテストは `rules:'legacy'` を明示する

### 変えないもの

`?dev=1` の門番、セーブの形式（`testRules`・強さはセーブに書かない）、本編の挙動、DOM の既存 ID（足すだけ。`arena-dusk-phase3-btn` は `arena-boss-phase-btn` に置き換え、旧 ID を参照するテストを更新）、basefile.html、legacy の連結構成、旧成長系のコード。
