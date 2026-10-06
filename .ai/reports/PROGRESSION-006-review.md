# PROGRESSION-006 Review（第一章の異空間報酬からランダム装備を外す）

## Round 1/3

### Review Target
| 項目 | 値 |
| --- | --- |
| Task ID | PROGRESSION-006 |
| Branch | `claude/progression-006-anomaly-reward` |
| Reviewed SHA | `4728635d8e893c9b0e2b4adaa471f11e1d196a0a` |
| Diff range | `c6d3259..4728635`（`main` との差分: `02-world-common.js` の 1 か所、新規 unit 1 本、`.ai/` の記録） |
| Handoff Verification | V-1〜V-6 OK（Analysis `0ca114f`・Plan `0a61063` の blob 一致） |

### Result
PASS

### Independence
同一セッションで兼務（装備を足す全経路 `addEquipmentItem` / `maybeDropEquipmentAt` / `maybeGrantEquipmentInstant` / `rollBossSignatureGear` の呼び出し元を grep し直した。Human による差分確認を推奨）

### Checklist（Human 指定の 10 観点）
| # | 観点 | 結果 | 根拠 |
| --- | --- | --- | --- |
| 1 | Chapter 1 の異空間からランダム装備が本編へ入らない | PASS | 装備は `maybeGrantEquipmentInstant(1.0, 0.4)` を通り、冒頭 `if(!legacyGrowth()) return;` で本編は付与しない。unit で実物の関数を実行: 本編（新規・旧セーブ）で `equipmentInventory` が増えない（変更前の src で FAIL） |
| 2 | 異空間そのものは維持 | PASS | `spawnAnomalyRiftForWorld` / `enterAnomalyRoom` / `buildAnomalyRoom` / `updateAnomalyRifts` / `exitAnomalyRoom` の差分なし。unit で呼び出し元（全滅で 1 回だけ）を固定 |
| 3 | 固定・少数装備設計を壊していない | PASS | 開始時の固定装備（`grantStarterGear`）・宝箱・敵ドロップ・ボス報酬は差分なし。本編で装備を足す経路はゲート付きだけになった（ボス報酬は `if(legacy) renderBossChoicePanel` / `if(legacy){ gearDrop … }`） |
| 4 | 既存装備を削除していない | PASS | `equipmentInventory` は push しかしない経路で、本編では呼ばれない。unit: 旧セーブの装備（未鑑定品を含む）が deepEqual で残る |
| 5 | Test Mode を壊していない | PASS | `maybeGrantEquipmentInstant(1.0, 0.4)` は `Math.random() > 1.0` が成り立たないので必ず `addEquipmentItem(rollDropEquipment(0.4))`（変更前と同じ）。unit: テストモードで 1 つ増え、レア率 0.4 が渡る。E2E のテストモード系（`scenario-test-mode`・`base-class-identity` ほか）PASS |
| 6 | Chapter 2 を勝手に変更していない | PASS | Chapter 2 の実行時の状態は無い（再監査 X-7）。旧システム（ランダム装備の生成）は差分なし。新しい章の判定・報酬は作っていない |
| 7 | 出現率を変更していない | PASS | `ANOMALY_SPAWN_CHANCE = 0.4`・`ANOMALY_RIFT_SPOTS` 差分なし（unit で 0.4 を固定） |
| 8 | 既存報酬を利用する場合、その理由が明確 | PASS | 代替報酬は足していない。本編に残る金貨 20〜39 は変更前から異空間の報酬で、金貨は第一章の本編の既存報酬（宝箱 `rollCommonChestLoot`・敵の `goldBonus`）。Analysis §4 / Task R-2 |
| 9 | Regression Test がある | PASS | `tests/unit/anomaly-reward.test.js`（6 件、変更前の src で 3 件 FAIL）。異空間の E2E は乱数・到達不能のため作らない判断を Task file に記録 |
| 10 | `grantAnomalyReward` の影響範囲を確認 | PASS | 定義 1・呼び出し 1（`updateAnomalyRifts`）。関数は残し、中の装備の 1 行だけを変更。💎 / 🔩・金貨・ログ・効果音は変更前と同じ |

### Findings
- Info: `legacyGrowth()` は名前に反して旧セーブ判定ではなく、`legacyGrowthEnabled(state.testMode)` = 本編/テストモードの判定（新規プレイの本編でも false）。Human の「legacyGrowth() だけで単純に抑制するのは禁止」の懸念（新規プレイで漏れる）は当たらないため、既存の Chapter 1 判定として再利用した（判定を増やさない指示に従う）
- Info: 本編のログ「✨ 異空間の宝を手に入れた!」は残る（報酬は金貨）。文言の変更は報酬演出の設計になるため行わない
- Info: GitHub Actions の 1 回目は `base-class-identity:413`（テストモードの Arena の乱数向きの spec、本変更の経路外。PR #32 の `b1afaa1` でも同じ失敗、再監査 W-4）だけが FAIL。PR にコメントし 1 回再実行。ローカル全体（2 CPU）では PASS

### Required Changes
None
