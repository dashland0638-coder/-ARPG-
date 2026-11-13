# CLOCKTOWER-001 — 実装報告（第 2 段: 全面再設計）

Status: DONE（Agent 側）／ HUMAN DEVICE CHECK REQUIRED（iPhone 実機は未確認）
調査: `CLOCKTOWER-001-analysis.md` / 設計: `CLOCKTOWER-001-design.md`

## 1. 変更

| 場所 | 内容 |
| --- | --- |
| `03-dungeons-mansion-temple.js` 時計塔の節 | 作り直し: `TOWER_FLOORS` / `TOWER_SLABS` / `TOWER_ROOMS`（6 階 29 部屋 → 一階 3〜6 部屋）/ `TOWER_STAIRS` / `TOWER_HANDS` / `TOWER_GEAR` / `TOWER_PLATES` / `TOWER_BELLS` / `TOWER_FACE` / `TOWER_BOSS_POS` / `TOWER_KEEPER_POS` / `TOWER_HOME_DOOR` / `TOWER_KEY_HOOK`。`buildClocktower`（階ごとの床・壁の色、小物、2F 巨大歯車、3F 作業台と作業灯、4F 食卓と娘の部屋、5F 鐘と倉庫、6F 床の巨大な文字盤、雲を塔の外へ、手記、出来事、鍵の鉤）。`setTowerClock` / `updateTowerDecor`。`buildClocktowerChapter1Story`（本編の物語: 1F 時が止まる、記憶 6 つと代わりの通路、3F 灯りの記憶、4F 食卓・七時十三分の繰り返し・スケッチ帳、5F 鐘の綱の影、6F 外套・管理人、盗賊の過去）。`buildTowerKeeperNpc`。`playTowerInsight`（代わりの発生を 4F 踊り場に）。跳ぶ瞬間（管理人が鳴らす鐘）。島の位置 |
| `07-ai-combat.js` | 時計塔の敵の表を作り直し（19 体。どれも着地点から 8 以上）。ボス「止刻の残響」（管理人との対峙の台詞、名前、位置。数値と key は同じ）。新しい技: 歯車を飛ばす・止刻（足元の輪で 0.7 秒動けない）・残像の破裂・文字盤の針（`towerBossMinute` / `towerBossEcho` / `updateTowerBossClock`）。止刻の輪の片付け |
| `02-world-common.js` | `beginTowerCollapse` の本編の台詞（管理人が時間を動かし、鐘を鳴らしに残る）。テストモードは名前だけ止刻の残響 |
| `12-progression-ui.js` | 崩壊の会話を閉じたら文字盤の針を七時十四分へ。酒場の出撃（本編だけ主人の 2 行を足す）。翌朝の主人の一行（管理人は自分の足で降りてきた） |
| `08-loot-equipment.js` | 宝箱 5 つ（寄り道の小部屋とボスの手前）・回復結晶（4F 踊り場） |
| `14-hud-boot.js` | 毎フレーム `updateTowerDecor`（2F の歯車が回る） |
| `src/core/scenario-waypoints.js` | テストモードの開始地点（2F〜5F の踊り場、6F 文字盤の前室） |
| 第 1 段から継続 | 共通のカメラの床の高さ `y`（13・02）、塔の区画描画（02） |

## 2. 発生条件の要点

| 出来事 | 条件 |
| --- | --- |
| 本編の物語 | `clocktowerChapter1()`（本編かつ行き先が塔）。テストモードの旧成長では出ない |
| 記憶の会話 | 読んだらその部屋で / 読まずに次の通路へ出たらそこで（どちらか一方） |
| 4F 東の扉 | 鍵の鉤に近づけば誰でも開く（物語の場面より後に登録 ―― 同じ所に立った時は場面が先） |
| 盗賊の閃き | 3F の通路、起きなければ 4F の踊り場。出撃ごとに一度。既に持っていれば出さない |
| 盗賊の過去 | 崩壊が始まった後、文字盤の間で一度 |
| 止刻 | 輪が満ちた時に中・回避中でない・無敵でない・麻痺の直後でない |

## 3. 文書

`docs/CHAPTER1_STORY.md`（§4-4 を作り直し、§4-5 の跳ぶ理由・翌朝の主人）、`docs/SCENARIOS.md`、`docs/DUNGEON_RENDERING.md`、`docs/CHAPTER1_PLAYTEST.md`（§6 を作り直し D-01〜D-22、A-07/A-08、E-03）、`docs/PROGRESSION.md`（ボス能力の表の名前）、`.ai/reports/CHAPTER1-CLOCKTOWER-balance.md`。

## 4. 性能

- 一階の部屋・壁が大きく減った（以前の塔より描く物が少ない）。区画描画で見えていない部屋は描かない
- 新しい技はボス戦の間だけ（輪・歯車・残像は使い終わると外す）
- iPhone の FPS は未計測
