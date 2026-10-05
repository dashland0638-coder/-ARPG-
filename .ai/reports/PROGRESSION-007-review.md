# PROGRESSION-007 Review（HD-2 鍛冶屋施設 / HD-3 ショップ）

## Round 1/3

### Review Target
| 項目 | 値 |
| --- | --- |
| Task ID | PROGRESSION-007 |
| Branch | `claude/chapter1-smith-shop-hd2-hd3` |
| Reviewed SHA | `ffea540e4926f2b9b71860384a5af7b63d2e6a1e` |
| Diff range | `c6d3259..ffea540` |
| Handoff Verification | V-1〜V-6 OK（Analysis `3595b00`・Plan `ce313e2` の blob 一致） |

### Result
PASS

### Independence
同一セッションで兼務（ゴールドを使う全 6 か所・鑑定所の全タブ・`cycleApTab` / `syncApTabsVisibility` を見直した。Human による差分確認を推奨）

### Checklist
| # | 観点 | 結果 | 根拠 |
| --- | --- | --- | --- |
| 1 | HD-2: 加入後に装備する・外す・性能・売却・スキル確認ができる | PASS | 処理は無変更。E2E: 外す→装備し直す、HP+6 の表示、売却で 🪙+12・持ち物から消える、スキルの 3 サブタブ |
| 2 | HD-2: 付け替え・Skill 3・強化・鍛造・クラフト・ランダム装備・スフィア盤・パッシブが無い | PASS | E2E: タブは装備品とスキルだけ、`[data-variant]` / `[data-skill2-choice]` 0、サブタブに skill3 / passive 無し、鑑定ボタン 0。強化は DOM なし、鍛造・クラフトは処理なし、ランダム装備は WORK 12.1 / PR #33 |
| 3 | HD-3: 第一章で購入できない（表示だけでなく処理側でも） | PASS | `LEGACY_AP_TABS` に `shop`。`renderShopPanel` は本編でボタンを作らない、クリック処理も `apTabAvailable('shop')`。購入の経路は商店タブだけ（ゴールド支出 6 か所を確認）。`cycleApTab` も `apTabAvailable` で隠れたタブを飛ばす |
| 4 | 加入前の施設封鎖（PROGRESSION-004） | PASS | `toggleAppraisal` / `smithFacilityAvailable` 無変更。`chapter1-facility-access` 4 / 4 |
| 5 | Skill 1 の固定は第一章だけ | PASS | ロジックは `legacyGrowth()` 側（PROGRESSION-005 のまま）。`chapter1-rules.js`・Decision Record・docs に「第一章だけ、クリア後は自由編成」を明記 |
| 6 | 第一章判定と Test Mode 判定を混同しない・判定を増やさない | PASS | 新しい判定なし。すべて既存の `legacyGrowth()` |
| 7 | Test Mode を壊していない | PASS | E2E: 見出し「鑑定所」、5 タブ、商店に 3 品。既存のテストモード系 spec PASS |
| 8 | 第一章後（Chapter 2）の既存機能を壊していない | PASS | 商店・鑑定・強化等の処理は削除・変更なし（テストモードで従来どおり） |
| 9 | PROGRESSION-006 を壊していない | PASS | 異空間の報酬のコードに触れていない（PR #33 と別の行） |
| 10 | 誤解を招く表示が無い | PASS | 本編の見出し「鍛冶屋」、インタラクト「🔨 鍛冶士と話す(装備の管理)」、メニュー「鍛冶屋(鍛冶士の前で)」 |

### Findings
- Info: 本編で隠れた商店タブを DOM 操作で直接押しても、パネルは空でボタンが無く、購入処理も同じ判定で止まる
- Info: E2E 全体（2 CPU）の flaky 1 件は `job-traits:162`（テストモードの Arena、既存の `retries: 2`、本変更の経路外。PROGRESSION-002 でも同じ）

### Required Changes
None
