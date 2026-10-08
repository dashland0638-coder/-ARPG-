# CQ-01 Report — Chapter 1 Full Playthrough QA（＋ CD-01）

| 項目 | 内容 |
| --- | --- |
| Work Item ID | CQ-01（＋ CD-01） |
| 目的 | Human が iPhone 実機で Chapter 1 を最後まで遊び、Content Ready / Not Ready を判定できる状態にする |
| 実施内容 | Analyzer（`.ai/reports/CQ-01-analysis.md`）、iPhone 用の通しプレイ手順・チェックリスト・判定基準（`docs/CHAPTER1_PLAYTEST.md`）、docs の整理（`.ai/reports/CD-01-report.md`） |
| 変更ファイル | 新規 `docs/CHAPTER1_PLAYTEST.md`、`.ai/reports/CQ-01-analysis.md` / `CQ-01-report.md` / `CD-01-report.md`、`.ai/tasks/CQ-01.md`。更新 `docs/README.md` / `SCENARIOS.md` / `CHARACTERS.md` / `PROGRESSION.md` / `GAME_DESIGN.md` / `CHAPTER1_STORY.md`（§7）。**ゲームのコードは変更なし** |

## チェックリスト（`docs/CHAPTER1_PLAYTEST.md`）
| 区分 | 項目数 | 元の確認表 |
| --- | --- | --- |
| A 全体進行 | 19 | 指示の A-1〜A-19 |
| B 森の洋館 | 23 | CM-05 / CM-07（5つの戦闘・館の主の3形態・瓦礫・Skill 2 の閃き・鍛冶士の合流と分離・再会・結果・酒場・UI） |
| V 宵待ちの村 | 8 | CV-02 |
| C 幽霊船 | 17 | CG-05 S-1〜S-8・B-1〜B-5 ＋ 第一章で出ないもの（異空間・★4 の船倉・周回・Chapter 2 の成長） |
| D 時計塔 | 20 | CT-05 H-1〜H-12（対応を列で表示）＋ 島の遠景の人物の視認 ＋ ★3 の奥 |
| E 道 | 24 | CR-02 / CR-03（朝の鐘・時計・管理人・「？？？」・正式加入・遅れる影・紫の斬撃・戦闘1/2・湧き直さない・丘・酒場・12行・セーブ） |
| G 全体・禁止要素 | 7 | `core/chapter1-rules.js` / `chapter1-progress.js` |
| 合計 | 118 | |

- 判定: PASS / FAIL / OBSERVATION / NOT TESTED。OBSERVATION =「動くが見た目・テンポ・分かりやすさを直した方がよい」
- FAIL の重さ: Critical / Major / Minor（§9）
- Content Ready の YES / NOT READY 条件（§10）。Minor と OBSERVATION だけでは NO にしない
- iPhone で上から順に見られるよう、準備 → 全体 → 区間 → 判定 → 記録用紙（コピー用）の順

## テスト
| 確認 | 結果 |
| --- | --- |
| `npm run test:unit` | 1708 件: 1707 pass / 0 fail / 1 skip（既存） |
| `npm run build` | PASS |
| E2E（Chapter 1 回帰） | `chapter1-progression` / `road` / `shadow-guide` / `save-load` / `chapter1-facility-access` / `chapter1-legacy-ui` / `chapter1-skill2` / `chapter1-dusk-basics`: **35 passed**（18.1 分）。`chapter1-tower-to-road`: 短い方 PASS（一括実行の中）、長い方 PASS（単独 6.8 分。一括実行では時間切れ → TF-04） |

## 既知の技術課題（判定に混ぜない）
| ID | 内容 |
| --- | --- |
| TF-02 | `mansion-enemies.spec.js:220` 猟犬の予兆（既知の不安定） |
| TF-03 | `combat-events-layout.spec.js:263 / :296` タッチのインタラクト表示の重なり（既知の不安定） |
| TF-04（新規） | `chapter1-tower-to-road.spec.js` の長い方（休憩所 → 最後の酒場）は単独で 3.6〜6.8 分だが、長い一括実行の後半では 15 分を超えることがある（今回のローカル一括実行で外側の 40 分の時間切れに当たった）。CI（#63）では PASS。低 fps で戦闘の所要時間が伸びるため。ゲームの不具合ではない |

## Reviewer
- PASS（Round 1）
  - ゲームのコードを変えていない。凍結対象・Skill・成長・装備・異空間・交代の順・影の旅人の未決定事項に触れていない
  - チェックリストは指示の A〜E と全体を網羅し、既存の CM-05 / CM-07 / CV-02 / CG-05 / CT-05 / CR-03 の項目を統合している
  - Content Ready を YES と書いていない（CODE READY = YES / CONTENT READY = HUMAN DEVICE CHECK REQUIRED）
  - docs の修正は決定済み・実装済みの事実に合わせるだけ（CD-01-report）

## Status
- **CODE READY = YES**
- **CONTENT READY = HUMAN DEVICE CHECK REQUIRED**（`docs/CHAPTER1_PLAYTEST.md` の通しを Human が実施するまで）
- 関係する未 merge の PR: #38〜#49（洋館・村のテストと手順、CA-01 の BGM）。merge 前に通す場合、村・道の BGM は N（NOT TESTED）
