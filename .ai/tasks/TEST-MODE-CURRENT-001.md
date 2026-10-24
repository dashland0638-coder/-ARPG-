# TEST-MODE-CURRENT-001 — テストモードの現行仕様への追従とデバッグ環境刷新

Status: IMPLEMENTING（CONTENT READY = HUMAN DEVICE CHECK REQUIRED）

## Approval
- [x] Approved（Human 2026-10-24「WI: TEST-MODE-CURRENT-001」）
- 決定記録: `.ai/decisions/DEC-009-test-mode-current.md`

## 監査（Analyzer）
`.ai/reports/TEST-MODE-CURRENT-001-audit.md`。要点: `legacyGrowth()` がテストモードなら常に真で、テストモードは旧ハクスラ系のまま本編と別のゲームとして動いていた（強さ・HUD・戦利品・物語・異空間・鍛冶屋）。

## 計画（Planner）
1. ルールを分ける（既定 = 本編と同じ、旧成長システムは選んだ時だけ）
2. 開始画面: ルールの選択。転身・レベルは旧成長システムだけ。説明・見出しを現行に
3. Arena: `💪 強さ`（デバッグ用の倍率）、`⏭ ボスを次の段階へ`（村の残響だけだった段階の操作を広げる）、鍛冶屋の入口の表記をルールに合わせる
4. Debug Info の見出し（ルール・強さ・場所・ボスの段階・支援AI）
5. テスト: helper に `rules`、旧成長系のテストは明示。新しい unit / E2E

## 受け入れ条件
- 通常 URL で開発用の機能が出ない。`?dev=1` でテストモードと Arena が使える
- テストモードの既定で、HUD・強さ・戦利品・物語が本編の第一章と同じ
- 旧成長システムを選ぶと、従来の検証ができる
- デバッグ用の強さ・段階の操作はテストモードの間だけ。セーブに書かない
- 844×390 と 1280×800 で、開始画面の主な操作と Arena の先頭の操作が画面に収まる
- ビルド・unit・関連 E2E が通る。独立レビュー PASS
