# PROGRESSION-008 Analyzer report（第一章の異空間を全面廃止）

| 項目 | 値 |
| --- | --- |
| Task ID | PROGRESSION-008 |
| Branch | `claude/progression-008-chapter1-no-anomaly`（最新 `main` = `c6d3259` から作成） |
| Persisted by | Agent（Orchestrator。AGENTS.md §5.2） |
| 日付 | 2026-10-05 |
| 出典 | Human Decision（2026-10-05）: 第一章では異空間を全面廃止。第二章以降で再設計（今回は実装しない） |

## 1. 異空間の経路（FACT。`src/legacy/parts/02-world-common.js` ほか）

| 段階 | 場所 | 内容 |
| --- | --- | --- |
| 出現（40%） | `buildWorld(key)` → `spawnAnomalyRiftForWorld(key)` | `ANOMALY_RIFT_SPOTS[key]` がある世界だけ、`Math.random() < ANOMALY_SPAWN_CHANCE`（0.4）で `anomalyRifts.push(buildRift(spot))` |
| 出現場所 | `ANOMALY_RIFT_SPOTS` | mansion（食堂）・ghostship・waterway・temple・conservatory。本編の段で入るのは mansion・ghostship |
| 裂け目のオブジェクト | `buildRift` | 紫のリング・円盤・点光源を scene に追加 |
| ミニマップ | `14-hud-boot.js` | `anomalyRifts` の各要素に紫の点（`#a855f7`） |
| 入口 | `updateAnomalyRifts`（毎フレーム、`14-hud-boot.js` から） | 裂け目から 1.6m 以内で `enterAnomalyRoom()` |
| 異空間の部屋・敵 | `enterAnomalyRoom` → `buildAnomalyRoom` | 隔離エリア `ANOMALY_HUB`、八角形の壁、「歪んだ」雑魚 2 体（`isAnomalyMonster`）、帰還の裂け目。ログ「🌀 異空間に迷い込んだ……」 |
| クリア・報酬 | `updateAnomalyRifts` → `grantAnomalyReward` | 2 体とも倒すと 1 回だけ。ログ「✨ 異空間の宝を手に入れた!」、装備・素材・金貨（装備の本編ゲートは PR #33 の PROGRESSION-006。未 merge） |
| 帰還 | `exitAnomalyRoom` | 帰還の裂け目から元の位置へ。ログ「🌀 元の場所へ戻った」 |
| 片付け | `disposeWorld` | 裂け目・部屋を scene から外す |
| セーブ | `09-save-load.js` | 異空間の状態は保存しない（参照なし） |

**すべての経路は `anomalyRifts` に裂け目があることから始まる。** 裂け目を作るのは `spawnAnomalyRiftForWorld` だけ。入口・部屋・敵・報酬・ログ・帰還は、裂け目に入った後にしか起きない。

### 1.1 別物（触らない）
- 洋館の「歪んだ洋館」区画（`mansionZone('anomaly', buildMansionAnomaly)`、`core/mansion-anomaly.js`、`roomAnomalyStage` 等）は、洋館シナリオの物語上の「異常空間」で、本 Task の異空間（裂け目）とは別の仕組み。第一章の本編の進行そのもの。
- `14-dungeon-*.js` 等に異空間の参照は無い。

## 2. 第一章の判定

- `legacyGrowth()` = `legacyGrowthEnabled(state.testMode)`（`core/chapter1-rules.js`）。同ファイルの冒頭に「旧ハクスラ系の仕組みは Chapter 2 の基盤として残し、いまはテストモード（開発用）からだけ触れる。『本編で動くか』を答えるのがこのモジュール」とあり、**本編（= 第一章）か、第一章後の仕組みを試すテストモードか** の判定。旧セーブ判定ではない（新規プレイの本編でも false）。
- PROGRESSION-001〜007 の第一章の制限はすべてこの判定。Chapter 2 の実行時の状態は存在しない（UI-002-F 再監査 X-7）。
- → 新しい章の判定は作らず、`legacyGrowth()` を使う。「第一章では無効、それ以外（いまはテストモード）では既存挙動」の境界になる。

## 3. Test Mode
- トレーニング空間（`training`）には `ANOMALY_RIFT_SPOTS` が無く、異空間は出ない（変更前から）。
- テストモードのシナリオ出撃（洋館・幽霊船など）では `legacyGrowth()` が true なので、変更後も従来どおり 40% で出る。
- 既存の異空間の E2E・unit は無い（`tests/` を grep。`mansion-anomaly.test.js` は 1.1 の別物）。

## 4. PROGRESSION-006 との関係
- PROGRESSION-006（PR #33、未 merge）は `grantAnomalyReward` の装備を `maybeGrantEquipmentInstant` 経由にした。本 Task はその行に触れない（別の関数）。両 PR は独立に merge できる。
- 第一章で異空間に入れなくなるので、006 の本編ゲートは第一章では到達しない安全策として残る（Human の指示どおり削除しない）。

## 5. 方針（Planner への入力）
- `spawnAnomalyRiftForWorld` の冒頭で `if(!legacyGrowth()) return;`（40% の判定より前。乱数も引かない）。
- 処理側の二重の安全策として `enterAnomalyRoom` の冒頭にも同じ判定（裂け目が何らかの経路で残っていても入らない）。
- 異空間の本体（部屋・敵・報酬・帰還・出現率・場所）は削除・変更しない。
- テスト: 実物の `spawnAnomalyRiftForWorld` / `enterAnomalyRoom` を unit で stub 付き実行（乱数は常に当たり）。本編は裂け目 0・入らない・ログなし、テストモードは裂け目 1・入る。食堂は CI 環境で歩いて到達できないため（`mansion-scenario` のメモ）、裂け目そのものの E2E は作らない。本編のダンジョン攻略の回帰は既存の洋館 E2E（`mansion-*`）と E2E 全体で確認する。
