# CH1-COMP-W2MB — 宵待ちの村のボス直前の中ボスの攻撃の調査（調査のみ）

親 Task: [`CH1-COMP.md`](CH1-COMP.md)（Work Item W2-MB。Status と Approval の正本は親の Work Items 表）

Status: PR_OPEN（PR #93）

Analysis: `.ai/reports/CH1-COMP-W2MB-analysis.md`（branch `claude/ch1-comp-dusk-midboss-investigation`）

## Approval

- [x] Approved
- 種類: Human Approval（依頼文「Work B：ボス直前の中ボスの攻撃問題を調査する。これは調査・報告のみです」）
- 承認の範囲: 調査と改善案の提示。**ゲームのコード・数値・判定・アニメーションは変えない**
- Approved by / date / where: Human / 2026-10-20 / 会話
- Persistence: 許可（branch: `claude/ch1-comp-dusk-midboss-investigation`）

## Goal

宵待ちの村のボス直前の中ボスについて、ユーザーの報告（爆破物を投げる・近接の判定が見えない・タイミングが分からない・ボスより強い）を、現行コードを根拠に説明し、改善案を比べる。

## Result

- 報告書: `.ai/reports/CH1-COMP-W2MB-analysis.md`
- 次の Work Item 案（W2-MB1〜MB3）は報告書 §9。**Human の承認なしに実装しない。**

## Files

| ファイル | 変更 |
| --- | --- |
| `.ai/reports/CH1-COMP-W2MB-analysis.md`（新規） | 調査の報告 |
| `.ai/tasks/CH1-COMP-W2MB.md`（新規）、`.ai/tasks/CH1-COMP.md` | 記録 |
| `.ai/reports/CH1-COMP-W2MB-review.md`（新規） | 独立 Reviewer |

ゲームのコード・テスト・設定は変えていない。

## Test Report

- ゲームのコードを変えていないので、テストは実行していない（NOT_RUN。理由: 調査のみ）。
- 報告書の FACT は、`origin/main` `29c94da` のコードの行で確かめた。

## Round 1 Fix（独立 Reviewer の CHANGES_REQUIRED への対応）

1. `core/memory-fisher.js` の行番号を直した（lookback `:26`、planNet `:58-70`、arm `:28`、CD `:31`、netHits `:96-100`）。
2. 記憶漁師の近接の手がかりから「画面の閃光」を外した（近接には閃光も効果音も無い）。
3. 「大怯みで溜めを潰せる」を直した（網の溜めは取り消されず再開し、パニッシュ窓にも入らない）。
4. 追跡の規則に、元の位置から 30 の条件と、解いた後の再検知を足した。
5. 任意の指摘: P07`:593`、`enemy-tier.js:51-53`、×1.3 の定義 `stagger-math.js:21`、「発動の直前」、HP 96 の出典（W2-T2 の実画面）、12.6% は重なりを無視した上限。

## Round 2 Fix

1. 水門守の残響の「最大 4 つが重なる（12.6%）」を直した。上限には当たらない歩いた跡も数え、同時に当たりうる残響は 1 つまで（約 3%）（報告書 §4.2・§6 #6）。
2. 任意の指摘: `warden-echo.js` の行番号を `:39-49` に直した。

## Autonomy Metrics

| 項目 | 値 |
| --- | --- |
| Human Escalation Count | 0 |
| Human Decision Count | 0 |
| Auto Fix Count | 2（Review Fix Loop の Round 1・2） |
| Reviewer Round Count | 3 |
| Test Retry Count | 0 |
| PR Created | Yes（#93） |
