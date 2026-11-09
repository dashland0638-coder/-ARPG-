# CLOCKTOWER-001 — 実装報告

Status: DONE（Agent 側）／ HUMAN DEVICE CHECK REQUIRED（iPhone 実機は未確認）
調査・計画: `CLOCKTOWER-001-analysis.md`

物語の台詞（既存の §4-4/§4-5）・謎解き・封鎖戦・ボスと敵の数値・セーブ形式・道は変えていない。

## 1. 変更

| WI | 場所 | 内容 |
| --- | --- | --- |
| A 盗賊の閃き | `03-dungeons-mansion-temple.js` `playTowerInsight` / `buildClocktowerChapter1Story` | 3F 針の回廊を抜けた先の通路（`t3cor2`）で起きる。カメラで針の回廊を映す → 盗賊が尋ね、弓師が自分のやり方を言う → `grantChapter1Skill2()`（習得 = 自動装備、トースト「✴️ 閃いた ―― 🔪 三連投げナイフ(自動で装備した)」）→ 盗賊の一言。出撃ごとに一度、既に持っていれば場面を出さない。本編の物語の中だけで登録（テストモードの旧成長では塔の物語ごと出ない） |
| B 共通のカメラ | `13-update-loop.js` `sceneCamShot` / `sceneCameraShot`、`02` `playShowThenEvent` | `opts.y`（見せる物の床の高さ、既定 0）。見る点とカメラの高さに足す。他の世界は 0 のまま変わらない。`show` も `y` を渡せる |
| C 見せてから話す | `03` 2F 歯車の間・3F 針の回廊・4F 鐘の広間の部屋の出来事 | 金属板・回る針・三つの鐘を映してから一文（自動カメラ OFF の人には映さない）。3F は雲の層（高さ 24）の下から見る |
| D 区画描画 | `02` WORLD_DEFS.clocktower、`03` `TOWER_CELL_ROOMS` | `roomCellBatch(TOWER_CELL_ROOMS, buildClocktower)` → `initRoomCells`。塔の中の部屋（見晴台・島を除く）。雲・霞・海・泡・文字盤は `rcAlways`。洋館と同じ規則（今いる部屋＋開口・開いている扉の先、境の上は直前の部屋） |
| E 強モブ | `07-ai-combat.js` | 5F 前室の強モブ (-288,36,180) → (-280,36,179)。着地点 (-288,186) から約 10.6。数値は同じ |
| F 開始地点 | `src/core/scenario-waypoints.js` | テストモードの 2F・3F・4F の踊り場（階段の着地点）。ボス直前の地点はそのまま |

## 2. 発生条件（盗賊の閃き）

| 場面 | 条件 |
| --- | --- |
| 起きる | 本編の時計塔（`clocktowerChapter1()`）・その出撃でまだ起きていない・通路 `t3cor2` に入った |
| 場面を出さない | 既に Skill 2 を持っている（閃いてから撤退して出直した・テストモードの第一章ルール） |
| 起きない | テストモードの旧成長（塔の物語ごと無い）・他の行き先 |
| 順番 | 同じ通路の「書き置き」の会話（読まずに来た時）が先、閃きは次のフレーム |

## 3. 文書

`docs/CHAPTER1_STORY.md` §4-4（3F の閃きの行）、`docs/SCENARIOS.md`（閃きの一覧: ④ 実装、⑤ 未実装）、`docs/COMBAT.md`（Skill 2 の表）、`docs/DUNGEON_RENDERING.md`（§2・§3 の時計塔、共通のカメラの `y`、残件）、`docs/CHAPTER1_PLAYTEST.md` §6（開始地点、D-09 更新、D-21〜D-24 追加）、`.ai/reports/CHAPTER1-CLOCKTOWER-balance.md`（強モブの位置）。

## 4. 性能

- 区画: 見えていない部屋は描画・影の対象から外れる。塔の壁・床の箱は以前は一枚ずつ別のメッシュだった（静的バッチ無し）ので、部屋ごとにまとめたぶん描画の呼び出しは減る
- 閃き・見せる演出は出来事と会話だけ（毎フレームの処理は増えない）
- iPhone の FPS は未計測
