# CH1-COMP W0-6 / W1-5 — 第一章の出撃会話の台詞の書き直し（報告）

基準: `main` `844f1d8`。branch `claude/w06-sortie-lines`。Work Item: [`../tasks/CH1-COMP-W15.md`](../tasks/CH1-COMP-W15.md)、決定: [DEC-016](../decisions/DEC-016-chapter1-sortie-lines.md)。

Status: CONTENT READY = HUMAN DEVICE CHECK REQUIRED

## 1. 経緯

1. W0-6（調査・設計）: 現状の出撃会話と人物設定の食い違いを調べ、台詞の候補を出した。あわせて、プレイヤーが選ぶ 3 択も提案した。
2. Human Decision（2026-11-03）: 範囲は B 案（固定の台詞の書き直しのみ）。選ぶ会話・支援 AI の新しい発言・分岐は入れない。
3. 台詞案の見直し: 独立の確認で、後の台詞の先取り（村の「見てから決める」、塔の中の盗賊の台詞、道の「今度は、置いていかない」）と、断定しすぎる言い方を直した。
4. 最終承認: 宵待ちの村の締めは「……確かめてきます。」（Human 指定）。変更は 12 行（受け答え 7 行＋締め 5 つ。報告で 13 行と書いた集計の誤りを直した）。

## 2. 変更

文言は DEC-016 の表のとおり。

- `src/legacy/parts/12-progression-ui.js`
  - 宵待ちの村・幽霊船・時計塔のエントリ: `const ch1 = !legacyGrowth()`。受け答え 7 行を本編だけ新しい文言にする（旧い文言は旧成長用に残す）。
  - `CHAPTER1_SORTIE_CLOSING`: シナリオごとの締めの一言 5 つ。本編はこれ、旧成長・第二章以降は `PERSONALITY_LINES`。
- 変えていないもの: 主人の台詞・会話の順序・行数、洋館と道の受け答え、交代・帰還・道の会話、ボスの口上、`PERSONALITY_LINES` の中身、セーブ（`selectedPersonality`）、進行、UI、入力。

## 3. テスト

| 種類 | 結果 |
| --- | --- |
| build | OK |
| unit 全体 | 2111 pass / 0 fail / 1 skip（既存の skip） |
| unit `sortie-lines.test.js`（2、新規） | `SCENARIO_TAVERN_DIALOGUE` を本編と旧成長の両方で評価し、5 つの出撃の全行を突き合わせる。変わったのは承認した 7 行だけ（同じ位置）、主人の台詞・行数・話者の順は同じ、旧成長は旧い文言。締めは承認した 5 つで、旧成長は性格の決まり文句 |
| 変異の確認 | 時計塔の 1 行を旧い文言に戻すと unit が落ちる |
| E2E `chapter1-late-scenarios.spec.js` | 洋館・宵待ちの村（新規）・幽霊船・時計塔の出撃会話の全行と順番、道の最後の 3 行（締め）。出撃会話の 4 件は pass |
| E2E 関連（5 ファイル） | 28 pass / 0 fail（`chapter1-late-scenarios`（道の締めを含む）・`chapter1-progression`・`chapter1-tower-to-road`・`mansion-butler`・`duskvillage`。1 worker・16.4 分） |
| 独立 Reviewer | PASS（ブロッキング 0）。12 行を 3 ファイルで文字単位に照合。非ブロッキング: 報告の作成、第二章の本編を作るときの分岐の注意（DEC-016 決定 5 に記載） |

## 4. 実機で確かめること（iPhone）

新しく始めて第一章を進め、5 つの出撃会話を読む（`docs/CHAPTER1_PLAYTEST.md` の各出撃）。

- 洋館（剣士）: 最後が「……行ってくる。」
- 宵待ちの村（魔法使い）: 丁寧語。最後が「……確かめてきます。」
- 幽霊船（弓師）: 丁寧語。最後が「では、行ってきます。」
- 時計塔（盗賊）: 最後が「登るさ。降りるのは、そのとき考える。」
- 道（盗賊）: 最後が「ああ。日が落ちる前にな。」
- 文字が欄からはみ出さない・読みやすい。


## 5. 未解決

- なし（第二章の本編を作るときの分岐の注意は DEC-016 決定 5）。
