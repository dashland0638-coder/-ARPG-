# CQ-01 / CD-01 追補 Report（Phase 7 の続き）

| 項目 | 内容 |
| --- | --- |
| Work Item ID | CQ-01 / CD-01（追補） |
| 目的 | #64 で入れたチェックリストと文書整理の、足りない部分だけを足す。#65（TF-03 の診断）の merge を反映する |
| 基準 | `main` `632949e`（#65 の merge まで） |
| 変更ファイル | `docs/CHAPTER1_PLAYTEST.md`、`docs/CHAPTER1_STORY.md`（§7）、`.ai/reports/CQ-01-analysis.md`、`.ai/reports/CQ-01-report.md`、`.ai/reports/CHAPTER1-CONTENT-plan.md`、`.ai/reports/CHAPTER1-CONTENT-analysis.md`（注記のみ）、`.ai/tasks/TF-03.md`、`.ai/tasks/CQ-01.md`、本ファイル。**ゲームのコードとテストは変更なし** |

## Analyzer: #64 の成果との差分

| 要求 | #64 の時点 | この追補 |
| --- | --- | --- |
| 確認範囲 1〜11（剣士の開始 → Chapter 2 の解放状態） | A-01〜A-19 と B / V / C / D / E / G の 118 項目で網羅済み | 変更なし（重複して作らない） |
| PASS / FAIL / OBSERVATION / NOT TESTED | §0 にあり | 変更なし |
| 操作・期待結果・失敗時の記録項目 | 「確認すること」の1列だけ。操作と失敗時の記録項目が無い | 各区間に **操作** の1行。列名を **期待結果** に。§0 に **FAIL のときに書くこと**（7項目）、記録用紙の FAIL 欄を同じ項目に |
| 自動テストで確認済みの事実と、実機でしか見られない項目の区別 | §12 の1行と analysis §4 の表だけ（項目ごとには分からない） | 全 118 項目の ID の横に印: 🤖 E2E 47 / 🧪 unit 30 / 👁 実機のみ 41。「🤖 / 🧪 も実機で見るまでは P にしない」と明記 |
| 道の2戦闘・敵の再出現が進行を妨げない | E-16（戦闘2は復活しない）のみ | E-06 に実装事実を追記: 戦闘1の獣は約20秒で戻るが、先へ進む条件ではない。戻っても休憩所へ進めるか・煩わしすぎないかを見る |
| TF-03 の状態 | 「既知の不安定」 | 「診断を merge 済み（#65）・根本原因は未確定」→ その後 #67 で原因を確定・修正したため「修正済み」に更新。TF-04 も既知の課題として併記 |

印の根拠（どのテストが何を見ているか）: E2E は `chapter1-progression`、`chapter1-tower-to-road`、`road`、`shadow-guide`、`save-load`、`chapter1-skill2`、`chapter1-smith-shop`、`chapter1-legacy-ui`、`chapter1-dusk-basics`、`duskvillage`、`mansion-*`。unit は `ghostship-*`、`clocktower-*`、`road-*`、`chapter1-no-anomaly`。洋館の瓦礫・分離・再会などのテスト（CM-02〜CM-06）は未 merge の PR #39〜#43 にあるので、`main` の時点では 👁 にした。

## CD-01: 整合性の監査と対応

| # | 文書 | 古い記述・誤った参照 | 対応 |
| --- | --- | --- | --- |
| 1 | `CHAPTER1_PLAYTEST.md` 冒頭 | 「§8 の Content Ready 判定」（実際は §10） | §10 に修正 |
| 2 | `CHAPTER1_PLAYTEST.md` §0 | 「§7 の重さ」（実際は §9） | §9 に修正 |
| 3 | `CHAPTER1_PLAYTEST.md` §4 の注 | 「V-08 / R-24」（R という区分は無い。道は E） | E-24 に修正 |
| 4 | `CHAPTER1_PLAYTEST.md` §12、`CQ-01-analysis.md` §8、`CQ-01-report.md` | TF-03 が「既知の不安定」のまま | 「診断を merge 済み・根本原因は未確定」→ #67 の merge 後に「修正済み（#67）」へ（原因と修正が `main` に入ってから更新） |
| 5 | `.ai/tasks/TF-03.md` | merge 後の状態が無い | Status を追記（未解決のまま） |
| 6 | `CHAPTER1_STORY.md` §7 | CD-01「実施（CQ-01 と同じ PR）」、CQ-01 の行が無い | CD-01 = 実施済み（#64）、CQ-01 = 手順は用意済み・**実機プレイは未実施** |
| 7 | `CHAPTER1-CONTENT-plan.md` CQ-01 / CD-01 | 状態が無い。Expected Files の `CHAPTER1-FULL-run.md` は作っていない | Status を追記。Agent の5段の一本通しは未実施（この環境では時計塔を登り切れない）と正直に記録 |
| 8 | `CHAPTER1-CONTENT-analysis.md` | 2026-10-06 時点の「幽霊船・時計塔・道 = 足りない 1、3、4」などが現在の状態に読める | 冒頭に日付の注記と現在の状態への参照だけを追加（当時の判定は経緯として残す） |

### 状態の区別（この時点）
| 区分 | 範囲 |
| --- | --- |
| 実装済み | Chapter 1 の5段と、酒場 → 道 → 最後の酒場 → 「この先の旅」（#50〜#63） |
| テストで確認済み | 区間ごとの E2E（セーブを差し込んで見ている）と unit。CI は `main` で green |
| 実機で確認済み | **Chapter 1 の通しとしては無し**（村だけは WORK 12 の時点で区間ごとの実機確認の記録がある。`CHAPTER1-WORK12-report.md`） |
| 未確認 | 実機の通し全体。とくに 👁 の 41 項目（島の遠景・跳躍の間・手触り・テンポ・BGM） |

## 変えていないもの
- ゲームのコード・テスト。Chapter 1 System Freeze、Skill 1 / Skill 2、成長・装備・パーティ進行・異空間のルール、影の旅人の Skill 1 と戦闘スタイル（未決定のまま）
- チェックリストの項目・判定基準（§9 / §10）の中身。項目は増減なし（118）
- `MANSION_SCENARIO.md`（未 merge の #38 / #42 と衝突するため）
- TF-02 / TF-03 の調査（混ぜていない）

## テスト
| 確認 | 結果 |
| --- | --- |
| unit（`node --test tests/unit/*.test.js`） | 1707 pass / 0 fail / 1 skip（既存） |
| build（`npx vite build`） | PASS |
| E2E（チェックリストの 🤖 の根拠になる本編進行・道・？？？） | `chapter1-progression` / `road` / `shadow-guide`: 14 passed（6.7 分） |

## Autonomy Metrics
- Human Escalation Count: 0 / Human Decision Count: 0 / Auto Fix Count: 1 / Reviewer Rounds: 2 / Test Retries: 0

## Reviewer
- Round 1: FAIL（Auto Fix 1）
  - A-15「戦闘1・戦闘2を抜けられる」に 🤖 → E2E は戦闘2だけ。項目に「自動テストは戦闘2だけ」と追記
  - V-05「村の残響を倒せる」に 🤖 → E2E は「戦える」まで。👁 に変更
  - 🤖 / 🧪 が項目の一部だけを見ている場合があることを凡例に追記
- Round 2: PASS
  - 実機で未確認の項目を PASS / 確認済みとして書いていない。Content Ready を YES にしていない
  - 項目数（118）・判定基準（§9 / §10）の中身を変えていない。ゲームのコード・テストに触れていない
  - TF-03 を解決済みにしていない。TF-02 / TF-03 の調査を混ぜていない
  - 文書の修正は誤った参照・古い状態の整理だけで、仕様の意味を変えていない（凍結対象・影の旅人の未決定事項はそのまま）
