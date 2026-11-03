# CH1-COMP W0-6 / W1-5 — 第一章の出撃会話の台詞の書き直し

Status: PR（CONTENT READY = HUMAN DEVICE CHECK REQUIRED）

## Approval

- [x] W0-6（候補の提示）: Human Decision 2026-11-03。範囲は B 案（固定の台詞の書き直しのみ）。文言は [DEC-016](../decisions/DEC-016-chapter1-sortie-lines.md)
- [x] W1-5（実装）: 同日、上記の確認（変更は 12 行）の後に実装を承認

## Goal

第一章の出撃会話で、主人公の受け答えと締めの一言を、人物の性格・口調と場面に合わせる。

## 調査（Analyzer）

- 出撃会話: 店主に話しかけてシナリオを選ぶ → `startScenarioTavernDialogue` → `SCENARIO_TAVERN_DIALOGUE[key]`（主人と主人公が交互）＋締めの一言（`PERSONALITY_LINES[selectedPersonality]`）→ 閉じると `launchScenario`。
- 第一章の 5 つ: 洋館（剣士・慎重）、宵待ちの村（魔法使い・陽気）、幽霊船（弓師・冷静）、時計塔と道（盗賊・勇敢）。
- 食い違い: 魔法使い・弓師は交代の会話では丁寧語なのに、出撃会話ではくだけた口調・時代劇調。人が戻らない場面に「面白い」。
- 変更前の 7 行はどれもソースに 1 回だけあり、他の場所には無い。締めの 5 つはすべて `PERSONALITY_LINES` から来ている。
- 独立の確認で、後の台詞の先取り（村の「見てから決める」、塔の中の盗賊の台詞、道の「今度は、置いていかない」）を避けるよう文言を直した。

## 計画（Planner）

- `src/legacy/parts/12-progression-ui.js`
  - 宵待ちの村・幽霊船・時計塔のエントリに `const ch1 = !legacyGrowth()` を足し、7 行を本編だけ新しい文言にする（旧い文言は旧成長用に残す。構造・行数は同じ）。
  - `CHAPTER1_SORTIE_CLOSING`（シナリオごとの締め）を足し、本編はこれ、旧成長・第二章以降は `PERSONALITY_LINES`。
- テスト: unit `sortie-lines.test.js`（新規。本編と旧成長の両方で 5 つの全行を突き合わせる）、E2E `chapter1-late-scenarios.spec.js`（幽霊船・時計塔の期待値、洋館・宵待ちの村の出撃会話を新しく、道の締め）。

## Files To Change

- `src/legacy/parts/12-progression-ui.js`
- `tests/unit/sortie-lines.test.js`（新規）、`tests/chapter1-late-scenarios.spec.js`
- DEC-016、本ファイル、報告、`.ai/tasks/CH1-COMP.md`（進捗の表）

## Files Not To Change

- 主人の台詞、交代・帰還・道の会話、ボスの口上、`PERSONALITY_LINES` の中身
- セーブ（`selectedPersonality` の値を含む）、進行、報酬、ステータス、UI、入力、テストモードの旧成長、第二章以降

## 受け入れ条件

1. 第一章の本編の出撃会話 5 つで、承認された 12 行がそのとおりに出る。順序・行数・主人の台詞は変わらない。
2. 旧成長では旧い文言と性格の決まり文句のまま。
3. build・unit・関連 E2E・CI・独立 Reviewer PASS。iPhone の確認が終わるまで CONTENT READY = HUMAN DEVICE CHECK REQUIRED。

## Result

報告: [`../reports/CH1-COMP-W15-report.md`](../reports/CH1-COMP-W15-report.md)
