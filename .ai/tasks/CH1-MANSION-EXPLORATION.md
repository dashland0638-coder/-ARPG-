# CH1-MANSION-EXPLORATION — 森の洋館の一本道解消

Status: PR（Reviewer PASS Round 2。CONTENT READY = HUMAN DEVICE CHECK REQUIRED）

## Approval
- [x] Approved（Human 2026-10-27「洋館の一本道解消を進めて」。森の洋館のマップ構造・探索導線に限った仕様変更の承認として扱う）

## Goal
森の洋館を、入口からボスまでほぼ直進する構造から、部屋を探索し、道を見つけ、寄り道にも意味があるダンジョンに変える。迷路にはしない。

## 調査（Analyzer）
[`../reports/CH1-MANSION-EXPLORATION-analysis.md`](../reports/CH1-MANSION-EXPLORATION-analysis.md)
- 過去の分析（`5887772`）以降、03 に変更は無い。結論はそのまま有効。

## 計画（Planner）
過去の推奨「A の軽量版 + C」に、B の一部（大広間・地下）を加える（[DEC-011](../decisions/DEC-011-mansion-exploration.md)）。

- 二階
  - 廊下の突き当たり（作業室の扉）は塞がれている（見た目だけで、扉の仕組みは無い）。
  - 書斎の北に書庫（`uArch`）を新設し、作業室の南の入口を書庫の側に付け替える。
  - 音（廊下・書斎の奥の金属音）と書庫の手記で道を示す。
- 一階: 大広間の出口と大階段を東寄りへ。封鎖扉は表の出入口から位置と幅を引く。
- 地下
  - 通路を東へずらす。
  - 地下室の西に酒蔵（`bWine`）、保管庫の東に小礼拝室（`bChapel`）を足す。
  - 保管庫の樽は固定の位置にする（通り道をテストで確かめられるように）。
- 宝箱: 保管庫の armoury を小礼拝室へ移し、酒蔵に通常の宝箱を 1 つ足す。
- 手記: 書庫・酒蔵・礼拝室に 1 点ずつ足し、5 → 8 点にする。

## Files To Change
- `src/legacy/parts/03-dungeons-mansion-temple.js`、`src/legacy/parts/08-loot-equipment.js`、`src/core/mansion-anomaly.js`
- `tests/unit/mansion-scenes.test.js`（25 → 28 部屋）、`mansion-presentation.test.js`（手記 5 → 8、環境音）、`mansion-anomaly.test.js`（通る順）
- 新規 `tests/unit/mansion-exploration.test.js`
- `MANSION_SCENARIO.md`、`docs/SCENARIOS.md`、`docs/CHAPTER1_PLAYTEST.md`（B-06a / B-07a / B-14a）
- `.ai/decisions/DEC-011-mansion-exploration.md`、報告

## 受け入れ条件
- 二階: 廊下から作業室へ直接入れない。書斎 → 書庫 → 作業室で合流でき、家具で塞がらない。
- 大広間・保管庫・書庫は、入口と出口が一直線に並ばない。
- 寄り道（食堂・厨房・客室・酒蔵・小礼拝室）は行き止まりで、宝箱か手記がある。すべて歩いて届く。
- イベントの順（森 → 戦闘② → 合流 → 瓦礫 → 戦闘③ → 分離 → 番人 → 戦闘④ → ボス）が変わらない。
- 飛ばせない条件（合流前の瓦礫、番人前の地下、戦闘④前のボス前）が変わらない。
- 分離の後、新しい部屋から分離前の館へ戻れない。
- 階段は 8 本のまま。到着点はどの階段の判定圏の外にある。
- テストモードの開始地点（bossante / bosshall）は変わらない。
- 敵・戦闘の数値、セーブ、他シナリオ、`basefile.html`、legacy の連結方式は変えない。
- build・unit・関連 E2E・CI・独立 Reviewer PASS。

## Result
- Reviewer: Round 1 FAIL（ミニマップの地下の区画）→ 修正 → Round 2 PASS
（報告: [`../reports/CH1-MANSION-EXPLORATION-report.md`](../reports/CH1-MANSION-EXPLORATION-report.md)）
