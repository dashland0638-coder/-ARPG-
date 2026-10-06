# PROGRESSION-010 第一章 完成版の最終統合・確定

| 項目 | 値 |
| --- | --- |
| Task ID | PROGRESSION-010 |
| Branch / PR | `claude/progression-010-chapter1-final` / #36（base `main` = `c6d3259`） |
| 日付 | 2026-10-06 |
| 種別 | 統合・記録（新しいゲームデザインなし） |

## 1. 統合
| 順 | 内容 | PR | 状態 |
| --- | --- | --- | --- |
| 1 | PROGRESSION-006 異空間の報酬でランダム装備を出さない | #33 | #36 に統合（#33 自体は open。#36 の merge で merged 扱いになる） |
| 2 | PROGRESSION-007 鍛冶屋は装備管理だけ・ショップなし（HD-2 / HD-3） | #34 | 同上 |
| 3 | PROGRESSION-008 第一章の異空間を全面廃止 | #35 | 同上。Decision Record の競合を両方残して解消 |
| 4 | PROGRESSION-009 第一章の最終監査（記録） | — | 同上 |
| 5 | HD-1 の確定・第一章の凍結の記録、Skill 1 の技名の unit | #36 | 本 Task |

ゲームのコードの差分は #33・#34・#35 の和だけ（`chapter1-rules.js` は HD-1 のコメントのみ追加）。

## 2. 第一章の完成仕様（正）
- **Character**: 剣士 → 魔法使い → 弓師 → 盗賊。前の主人公は支援 AI。自由なキャラクター選択・転職なし
- **Skill 1（第一章だけ固定）**: 剣士 切り下がり / 盗賊 影退きの一閃 / 弓師 五月雨射ち / 魔法使い 幻影歩法
- **Skill 2**: 閃きで習得・第一章では固定。**Ult**: 職業固定。**Skill 3**: 第一章では未解禁
- **第一章クリア後**: 習得済みの技から Skill 1 / Skill 2 を自由に編成（Skill 1 固定はゲーム全体の仕様ではない）
- **Equipment**: 開始時の固定装備だけ。ランダム装備・強化・鍛造・クラフトなし
- **Smith**: 加入前は施設なし。加入後は装備・解除・性能・売却・スキル確認だけ
- **Shop**: 第一章では購入不可（テストモードは維持）。消耗品は宝箱・敵・イベント
- **Anomaly**: 第一章では完全廃止。本体と 006 の報酬の安全策は第二章以降のために残す
- **Old Save**: 成長系の値は保存したまま第一章では使わない
- **Test Mode**: 別扱い（`?dev=1` からだけ入れ、保存しない）

## 3. 検証
| 項目 | 結果 |
| --- | --- |
| Build | PASS |
| Unit | 1647 件中 1646 PASS / 0 FAIL / 1 SKIP（既存） |
| Local E2E 全体（2 CPU、`faa10a7`） | **239 passed / 0 failed / 0 flaky** |
| GitHub Actions（`faa10a7`） | 1 回目 238 passed / 1 failed（`base-class-identity:413`）。失敗した job の再実行（1 回）: 238 passed / 1 failed —— `base-class-identity:413` は PASS、代わりに `combat-events-layout:263`（844×390 のタッチで、カメラを回す間インタラクトがスティックの領域 `#joy-zone` に重なる）が FAIL |

### 3.1 CI の失敗の切り分け
| テスト | 本 PR の経路 | 根拠 | 判定 |
| --- | --- | --- | --- |
| `base-class-identity:413` | 外（テストモードの Arena） | PR #32 / #33 でも同じ失敗。再実行・ローカル全体で PASS | 既知の flaky |
| `combat-events-layout:263` | 外（新規ゲームで酒場の店主のインタラクト。表示の配置 `combat-prompt-layout` と店主の文言は差分なし。本 PR の文言の変更は鍛冶士の加入後だけ） | 同じ commit の 1 回目の CI で PASS。ローカルで 6 回中 1 回 FAIL。**PR 前の `main`（`c6d3259`）でも同じ assertion が 10 回中 1 回 FAIL** | 既存の間欠的な失敗（本 PR の Regression ではない）。新しく既知の flaky に加える |

## 4. Reviewer（Round 1）
- 統合後のゲームのコードの差分 = #33 + #34 + #35 の差分（行数で一致を確認）+ `chapter1-rules.js` の HD-1 のコメント
- PROGRESSION-009 の監査の観点（漏れなし）は、統合後のコードでも変わらない（ゲームのコードの追加変更なし）
- 「HD-1 未決定」の記述は、現行の記録（Decision Record・`chapter1-rules.js`・docs・再監査）に残っていない。各 Task の過去の記録（PROGRESSION-005〜008）はその時点の記録として残す
- 結果: PASS

## 5. Remaining Human Decisions / Technical Debt
- C-1 第一章の追加の固定装備 / C-2 影の旅人の Skill 1（剣士の切り下がりを借用）/ C-3 第一章のゴールドの使い道
- R-1 `legacyGrowth()` を章の判定へ（第二章）/ R-2 名前の見直し（第二章）/ B-4 育成系の関数の第一章の判定（第二章）

## 6. 判定
**Chapter 1 Ready: YES** —— 第一章を完成版として凍結可能（PR #36 の merge 後に main で有効。main への merge は Human）

- 統合: #33〜#35 を #36 に統合済み。HD-1 を正式に記録。第一章に第二章の要素の漏れなし（PROGRESSION-009 の監査、統合後もゲームのコードの追加変更なし）
- 検証: Build PASS、Unit PASS、ローカル E2E 全体 239 / 239、CI の失敗は既知・既存の間欠的な失敗だけ（Regression なし）
- 既知の flaky: `job-traits:162`・`base-class-identity:413`・`mansion-enemies:220`・`combat-events-layout:263`（4 件とも第一章の変更の経路外。修正は別の Work Item）
