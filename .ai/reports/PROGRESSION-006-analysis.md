# PROGRESSION-006 Analyzer report（第一章の異空間報酬からランダム装備を外す）

| 項目 | 値 |
| --- | --- |
| Task ID | PROGRESSION-006 |
| Branch | `claude/progression-006-anomaly-reward`（最新 `main` = `c6d3259`、PR #32 の merge から作成） |
| Persisted by | Agent（Orchestrator。AGENTS.md §5.2） |
| 日付 | 2026-10-05 |
| 出典 | UI-002-F 再監査 W-2 / X-1 / X-2 / X-7、UI-002-A review F-3、Human Decision（第一章の装備は固定・少数。ランダム装備・強化・鍛造・クラフトは第一章クリア後） |

## 1. 異空間の流れ（FACT。すべて `src/legacy/parts/02-world-common.js`）

| 段階 | 場所 | 内容 |
| --- | --- | --- |
| 出現 | `buildWorld(key)` → `spawnAnomalyRiftForWorld(key)` | `ANOMALY_RIFT_SPOTS` に場所があるダンジョンだけ。`Math.random() < ANOMALY_SPAWN_CHANCE`（0.4）で裂け目 1 つ |
| 出現場所 | `ANOMALY_RIFT_SPOTS` | mansion（食堂）、ghostship、waterway、temple、conservatory。本編の段で入るのは mansion・ghostship |
| 入口 | `updateAnomalyRifts` | 裂け目から 1.6m 以内で `enterAnomalyRoom()`（フェード、隔離エリア `ANOMALY_HUB` へ移動、`worldBounds` を差し替え） |
| 敵 | `buildAnomalyRoom` | 「歪んだ」雑魚 2 体（`buildEnemy`、hp 140、`goldBonus:[16,24]`、`isAnomalyMonster`） |
| クリア条件 | `updateAnomalyRifts` | 2 体とも `dead` で `rewardGiven = true` → `grantAnomalyReward()`（1 回だけ） |
| 帰還 | `exitAnomalyRoom` | 帰還用の裂け目から元の位置へ。敵・壁を片付ける |
| 出現率の記録 | docs / 設計文書 | 「異空間」「40%」の記述は docs・ルートの設計文書に無い（`.ai/` の監査記録だけ）。今回は変えない |

### 1.1 `grantAnomalyReward()` が付与するもの（呼び出し元は `updateAnomalyRifts` の 1 か所だけ）

| 付与 | 呼び出し | 本編（第一章）での現在の挙動 |
| --- | --- | --- |
| 装備 1 つ（確定） | `addEquipmentItem(rollDropEquipment(0.4))` | **付与される**（ゲートなし）。`rollDropEquipment` は 10% で職業の特殊武器、それ以外は `rollEquipment`（Item Level・レア 40%＝未鑑定品・別武器種を含みうる） |
| 💎 魔宝石 / 🔩 武具の欠片 2〜4 | `addItem({type:'gem'|'shard'})` | 付与されない（`addItem` 冒頭の WI-A5 ゲート `!legacyGrowth() && LEGACY_LOOT_TYPES`） |
| 金貨 20〜39 | `grantGold` | 付与される |
| 演出 | `spawnLog('✨ 異空間の宝を手に入れた!')`・`sfx('levelUp')` | 出る |

### 1.2 ほかの装備の入手経路（比較）

| 経路 | 関数 | 本編 |
| --- | --- | --- |
| 敵撃破のドロップ（異空間の敵を含む） | `maybeDropEquipmentAt`（07 の撃破処理） | 止まっている（冒頭 `if(!legacyGrowth()) return;`、WORK 12.1） |
| 宝箱（通常・武具箱） | `maybeGrantEquipmentInstant` | 止まっている（同じゲート） |
| ボス報酬など（12-progression-ui） | 各所 | 既存のまま（本 Task の範囲外。再監査で漏れは W-2 だけ） |
| **異空間の報酬** | `grantAnomalyReward` が `addEquipmentItem` を直接呼ぶ | **止まっていない（唯一の漏れ）** |

## 2. 根本原因

装備ドロップの共通の入口（`maybeDropEquipmentAt` / `maybeGrantEquipmentInstant`）には WORK 12.1 で本編のゲートが入ったが、`grantAnomalyReward` だけはその入口を通らず `addEquipmentItem(rollDropEquipment(0.4))` を直接呼んでいる。そのため本編（新規・旧セーブを問わず）でも、異空間をクリアするとランダム装備が持ち物に加わる。

## 3. 第一章の判定（Chapter 判定を増やさない）

- `legacyGrowth()` = `legacyGrowthEnabled(state.testMode)`（`core/chapter1-rules.js`）。**旧セーブかどうかではなく「本編（第一章）かテストモードか」の判定**で、新規プレイでも旧セーブでも本編では false。
- Human の指示「legacyGrowth() だけで単純に抑制するのは禁止（新規プレイでも出るため）」の懸念は、この関数が旧セーブ判定だと捉えた場合のもの。実際は新規プレイも含めて本編で false なので、新規プレイの異空間も止まる。
- これは既存の Chapter 1 判定そのもので、敵ドロップ・宝箱・鑑定・素材（WI-A5）がすべて同じ判定で本編から外れている。新しい判定は作らない。
- Chapter 2: 実行時の Chapter 2 の状態は存在しない（再監査 X-7）。旧システム（ランダム装備）は Chapter 2 の基盤として残し、いまはテストモードからだけ動く（`chapter1-rules.js` 冒頭）。Chapter 2 の報酬仕様は記録に無いので新設しない。

## 4. 報酬の決定（Escalation の要否）

- 本編の異空間報酬から装備を外すと、残るのは **金貨 20〜39 と演出**（💎 / 🔩 は既に出ない）。
- 金貨は第一章の本編に既に存在する報酬（通常の宝箱の金貨 3〜6 枚 `rollCommonChestLoot`、敵の `goldBonus`）。異空間の金貨は変更前から報酬の一部で、量も変えない。
- したがって「ランダム装備だけを除外すれば仕様を満たす」「既存の第一章報酬（金貨）がそのまま残る」に当たり、新しい代替報酬を選ぶ必要がない → **Human Escalation 不要**。
- 金貨を増やす・回復薬を足すなどの置き換えはしない（新しい報酬の設計になるため。WI-A5 の「別の報酬には置き換えない」と同じ方針）。

## 5. 方針（Planner への入力）

- `grantAnomalyReward` の装備付与を、既存の本編ゲート付きの即時付与 `maybeGrantEquipmentInstant(1.0, 0.4)` に置き換える。テストモードでは変更前と同じ（確率 1.0 で必ず、レア率 40%、`rollDropEquipment(0.4)` → `addEquipmentItem`）。
- `grantAnomalyReward` 自体は残す。呼び出し元・出現・入口・敵・クリア判定・帰還・出現率は変えない。
- 旧セーブの `equipmentInventory` は読みも書き換えもしない（付与しないだけ）。
- テスト: 異空間は 40% の乱数で、食堂は本 CI 環境（software rendering）では歩いて到達できない（`tests/mansion-scenario.spec.js` / `mansion-escort.spec.js` の既存メモ）。そこで `grantAnomalyReward` の実物のソースを unit で実行し（依存は stub）、本編（新規・旧セーブ）とテストモードの付与を確かめる。あわせて構造（装備は本編ゲートの入口を通る・直接 `addEquipmentItem` を呼ばない・出現率 0.4 のまま）を固定する。E2E は関連 spec と全体で回帰を確認する。
