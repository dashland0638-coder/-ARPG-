# CH1-COMP W1-2 — 弓師の歩行姿勢の計測（必要なら調整）

Status: PR（計測の結果、調整は不要。CONTENT READY = HUMAN DEVICE CHECK REQUIRED）

## Approval

- [x] Approved（Human 2026-11-04「W1-2：弓師の歩行姿勢の計測と必要な調整」。計画上も人間の判断は不要）

## Goal

弓師の歩行時の前傾が強く見える問題（監査 M-02）を、W1-1（視線の改善）を入れた後の状態で計測し、剣士と比べる。感覚で係数を変えず、計測で判断する。

## 調査（Analyzer）

- W1-1 は main に入っている（`0079dc2`）。歩いている間は仲間を見ない（`core/look-rig.js` の `lookTargetKind`: `moving` なら `null`）。止まっているときと会話中は従来どおり仲間を見る。
- 歩行中の体幹の前傾は職業によらず同じ式: `0.02 + runUpper×0.11` rad（`13-update-loop.js` `updateLocomotion`。`runUpper = run × locomotionMix(RELAXED_WALK_UPPER.run, 1, walkW)`）。
- 全身の傾きも同じ式: `player.rotation.x = -leanZ×0.55`、`targetLean = min(0.13, 速さ×0.019) × locomotionMix(RELAXED_WALK_UPPER.lean, 1, walkW)`。
- 職業で変わるのは次の 3 つ。
  - 視線が体幹に足す pitch（`CLASS_WAIST_PITCH_COEF`: 弓師 0.80・剣士 0.70。上限 5°×職業係数 = 弓師 4.0°・剣士 3.5°）
  - 歩く速さ（剣士 5.0・弓師 5.6 m/s）
  - 体格の歩幅の係数 `strideAmp`（剣士 1.00・弓師 0.93、`05-rendering-rig.js` の `BUILD`）。歩幅の振れ → `run` → 体幹の前傾に入る
- Motion Panel（デバッグモード）には体幹の pitch・全身の傾きの行が無い。今回はゲームのコードを変えずに計測した（下の方法）。

## 計測（Tester）

報告: [`../reports/CH1-COMP-W12-report.md`](../reports/CH1-COMP-W12-report.md)

## 判断

**A（操作中の歩行では解消している）**。同じ速さでは弓師と剣士の歩行姿勢の差は 0.15° 以下（弓師の方が 0.14° 小さい。`strideAmp` による）で、視線の寄与は 0°。職業の速さのままの差は、速さ（+）と `strideAmp`（−）の合計。係数は変えない。

演出中の徒歩と戦闘態勢の移動では、Look Rig の積み上がりが今も残る（報告 §4）。原因は歩行の係数ではないので W1-2 では変えず、別の Work Item を提案する。

## Files To Change

- 本ファイル、報告、`.ai/tasks/CH1-COMP.md`（進捗の表）。ゲームのコード・テストは変えない。

## Files Not To Change

- `CLASS_WAIST_PITCH_COEF`・`RELAXED_WALK_UPPER`・`STANCE.archer`・弓師の攻撃・射撃・鷹の目・他職業のモーション・モデル・リグ・セーブ・進行・入力・戦闘の数値・`basefile.html`・legacy の連結方式

## 受け入れ条件

1. 計測の表が残る（弓師と剣士、W1-1 の前後、同じ速さ）。
2. 判断（調整した／不要だった）と理由が残る。
3. build・unit・モーションの E2E・独立 Reviewer PASS。
