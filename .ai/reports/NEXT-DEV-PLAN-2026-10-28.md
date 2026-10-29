# 次期開発計画の更新（2026-10-28）

- 確認したコミット: `main` `1cad92d`（PR #106 の merge、2026-10-28）
- 計画の正本: [`CHAPTER-1-comprehensive-improvement-plan.md`](CHAPTER-1-comprehensive-improvement-plan.md)
  - 進捗の表は [`../tasks/CH1-COMP.md`](../tasks/CH1-COMP.md)。ここで照合した状態に合わせて更新した。
  - 以前の第一章の内容計画（[`CHAPTER1-CONTENT-plan.md`](CHAPTER1-CONTENT-plan.md)。CM / CA / CV / CG / CT / CR / CQ / CD）は完了済み。新しいロードマップは作らない。
- 照合した資料
  - `git log origin/main`
  - GitHub の PR 一覧（#62〜#106）
  - `.ai/tasks/*.md` の Status
  - `docs/CHAPTER1_PLAYTEST.md` の結果欄
  - この会話での Human の実機確認の報告

## 1. 以前の第一章の内容計画（CHAPTER1-CONTENT-plan）— すべて main に入っている

| ID | main | 状態 |
| --- | --- | --- |
| CM-01〜CM-06（洋館） | `4e7c692`〜`9a5f4dc` | 完了 |
| CM-07（洋館の実機の通し） | `e8b1b1d`（手順・記録用紙） | **実機未確認**（Human の通しが未記録） |
| CA-01（村と道の手続き生成 BGM） | `42526f2` | 完了 |
| CV-01 / CV-02（村の負荷・手触りの計測） | `c3adad4` / `6e86084`（手順） | **実機未確認**（数値が未記録） |
| CV-03 | `c7fb05d` | 完了 |
| CG-01〜CG-05（幽霊船） | `5918abb`〜`d2855fc` | 完了。CG-05 の実機の通しは CQ-01 に含む |
| CT-01〜CT-05（時計塔） | `8d0900b`〜`d40a3b5` | 完了。CT-05 の実機の通しは CQ-01 に含む |
| CR-01〜CR-03（道） | `19b6c1e`〜`0b4c001` | 完了 |
| CQ-01 / CD-01（通しのチェックリスト・文書整理） | PR #64・#66 | 完了。**実機の通し（Content Ready の判定）は未実施**（`docs/CHAPTER1_PLAYTEST.md` の結果欄が空） |

- 注: `CG-02`〜`CG-05`、`CT-01`〜`CT-05`、`CR-01`〜`CR-03`、`CQ-01` の Task file には `Status:` 行が無い（古い書式）。
- 上の表を照合の結果とする。Task file 自体は書き換えない（記録だけの変更を増やさない）。

## 2. 第一章 総合改善（CH1-COMP / DEC-007）の現状

| ID | 内容 | main | 状態 |
| --- | --- | --- | --- |
| W1-1 / W1-3 / W2-T1 | 視線・フィニッシュ表示・ベースライン | PR #87 | 完了（Task の表は PR_OPEN のまま → 更新した） |
| W1-4 | 鍛冶屋の装備一覧（横持ち） | PR #88（UI-002-J） | 完了（実装は UI-002-J として入った） |
| W2-D | 村のボス戦の試作の設計 | PR #91（設計書のみ） | **Human の承認待ち**（HD-D1〜。`CH1-COMBAT-PROTO-design.md` は「未承認」） |
| W2-T2 / W2-4a / W2-MB | 再計測・段階移行の予兆・中ボスの調査 | #92 / #94 / #93 | 完了 |
| W2-MB1 / W2-MB2 | 記憶漁師・水門守の予兆 | #96 / #99 | 完了（iPhone は未記録） |
| W3（村） | 村の敵デザインと探索マップ | #100・#103・#104・#105 | 完了。#104・#105 は iPhone 確認済み（Human 2026-10-27） |
| W4-7（マップ） | 村 → 他のマップ | 村（#100）・洋館（#106 `1cad92d`） | 村・洋館は完了。洋館の iPhone 確認は未記録。幽霊船・時計塔・道は未着手 |
| W1-2 | 弓師の姿勢の計測 | ― | 未着手（Human の判断は不要） |
| W1-5 / W0-6 | 出撃会話の台詞（候補の提示 → 承認 → 実装） | ― | 未着手。W0-6 は Human の判断不要で始められる（候補を出すまで） |
| W0-5 / W3-0〜W3-3 | アートの完成見本 | ― | 未着手（HD-4: 見本の承認が必要） |
| W2-1a〜W2-6 | サポートの被弾・行動相・見た目、汎用ボスの攻撃表、予兆の統一、評価 | ― | **W2-D の承認待ちでブロック** |
| W4-1〜W4-6、W4-8、W5 | 第一章への段階展開・回帰・実機の通し | ― | 未着手（フェーズ2 の後） |
| MUSIC-BGM-TAVERN-001 | 完成済みの酒場 BGM をゲームで鳴らす | 本 PR | 実装・テスト済み。iPhone でループの継ぎ目が途切れた（Human 2026-10-29）→ 002 で対処 |
| MUSIC-BGM-TAVERN-002 | 酒場 BGM の継ぎ目の修正と、加入段階の 6 段階の組み込み | 本 PR | 実装・テスト済み。**実機未確認** |

- 開いている PR: **#72**（MUSIC-AUDIO-004、作曲アプリのサンプル読み込み中の再生）。2026-10-12 から開いたまま。
- Human の指示で今回は触らない。ゲーム本体にも酒場 BGM の書き出しにも影響しない。

## 3. 次に着手する Work Item

**推奨: W0-6 出撃会話の台詞の候補の提示**（P1）

- 理由
  - Human の判断を待たずに始められる。Agent が候補を作り、Human が選ぶ。
  - 第一章の台詞の一貫性（W1-5）と全人物の台詞（W4-8）の前提になる。
  - 戦闘（W2-D の承認待ち）・アート（HD-4）・マップのどれとも衝突しない。
- 成果物: 人物ごとの出撃前の返答の候補（最新の性格設定、HD-6 の方向性）と、採否の表。ゲームのコードは変えない。

**次の候補（並べて進められる）**

- **W4-7 の続き: 幽霊船の探索導線の分析（調査のみ）**
  - 村・洋館と同じ手順。実装は Human の承認の後。
- **W1-2 弓師の姿勢の計測**
  - 計測だけ。必要なら修正案を出す。

## 4. 依存関係・リスク・Human の判断が必要な点

| # | 判断事項 | 何が止まっているか | 推奨 |
| --- | --- | --- | --- |
| HD-A | W2-D の設計（ボスの行動表・支援の HP 120・復帰のルール）を承認するか | W2-1a〜W2-6（戦闘のプロトタイプ）、W4-1〜W4-5 | 設計書 §5〜§7 の推奨値で承認し、W2-1a から 1 つずつ |
| HD-B | ~~酒場 BGM を仲間の加入に合わせて段階で切り替えるか~~ | ― | **解決**（Human 2026-10-29 の依頼で組み込み。MUSIC-BGM-TAVERN-002、[DEC-013](../decisions/DEC-013-tavern-bgm-stages.md)） |
| HD-C | 他の場面の BGM（洋館・村・幽霊船・温室）を作曲アプリの曲にするか | 実音源の BGM（今は手続き生成） | 作曲アプリで Human が曲を承認してから、同じ方法で書き出す |
| HD-D | PR #72 をどうするか（merge / close） | 作曲アプリのサンプル読み込み中の再生の修正 | Human の判断 |
| HD-E | 第一章の iPhone の通し（CQ-01）をいつ行うか | Content Ready の判定 | 洋館（#106）と酒場 BGM（本 PR）の確認の後に、通しで行う |

**リスク**

- 戦闘の改修が W2-D の承認待ちで止まっている間は、マップ・台詞・音の改善が先に進む。
- 第一章の Content Ready の判定（CQ-01）は、実機の通しが無いと出せない。
- 実機確認の記録が会話に残っているだけのものがある（#104・#105）。
  - 確認の結果は、PR 本文か Task の Status に書く運用を続ける。

## 5. 酒場 BGM（今回の実装）

- 現状・書き出し方法・組み込み・テスト: [`MUSIC-BGM-TAVERN-001-report.md`](MUSIC-BGM-TAVERN-001-report.md)
- 決定: [DEC-012](../decisions/DEC-012-tavern-bgm.md)、[DEC-013](../decisions/DEC-013-tavern-bgm-stages.md)（継ぎ目・加入段階。[`MUSIC-BGM-TAVERN-002-report.md`](MUSIC-BGM-TAVERN-002-report.md)）
- 変更したファイル
  - 音源と記録: `public/audio/bgm/tavern-1-swordsman.mp3` 〜 `tavern-6-complete.mp3`、`tools/music-composer/scripts/render-bgm.mjs`、`tools/music-composer/exports/tavern-stages.json`（002 で 1 曲版から置き換え）
  - ゲーム本体: `src/audio/asset-manifest.js`、`src/audio/audio.js`
  - テスト: `tests/unit/tavern-bgm.test.js`、`tests/tavern-bgm.spec.js`、`tests/production-build.spec.js`
  - 文書: `ASSETS.md`、`tools/music-composer/README.md`、`docs/CHAPTER1_PLAYTEST.md`
  - 記録: `.ai/`（本ファイル・Task・DEC・報告、`CH1-COMP.md` の表）
- テストの結果: unit 2095 pass / 0 fail / 1 skip。関連 E2E 36 pass。CI は PR で確認する。
