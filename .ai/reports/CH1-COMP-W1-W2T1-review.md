# CH1-COMP W1-1・W1-3・W2-T1 Review

Reviewer: 別 Agent・別セッション（READ ONLY）。この report は Orchestrator が Reviewer の判定を記録したもの。
Task file: `.ai/tasks/CH1-COMP.md`

## Round 1

- Review Target: `ef0ccdc3f1136576a308f4497943fafed1d3e359`（Diff range `a299b7b..ef0ccdc`）
- Handoff の検証 V-1〜V-6: すべて成立
- 判定: **CHANGES_REQUIRED**

### Required Changes

1. **W1-1 `stepLookRig`**: 最終の角度（体に対する相対角）を追従させていた。
   - 問題: 体の向きが急に変わると（振り始めの `swingLockFacing`）、視線が相手を通り過ぎる。
   - 再現: 体を 1 フレームで敵へ向けると視線が 42° 先へ跳ぶ。体を 13 rad/s で 90° 回す間のずれの最大値は 44.7°（修正前の処理は 16.0°）。
2. **W2-T1 `bossDefeated`**: ボスのバーは会話・メニューの間も消える。そのため、HP 10% 未満のときに会話が出ると、撃破と誤判定しうる。

### Recommendations

- E2E で、攻撃中に少なくとも 1 回は `enemy` を見ることを確かめる。
- 推定ゲーム内時間に会話中の時間が含まれることを明記する。
- 攻撃の振り始めの見た目を、実機で確認する。

## Round 2

- Review Target: `f58464f95c0d62550032de4ebc29d4054e0a45d3`（Diff range `ef0ccdc..f58464f`）
- 最初に Orchestrator が誤った SHA を渡したため、Reviewer は検証できなかった。正しい SHA に訂正した後、V-1 から検証し直した。
- Handoff の検証 V-1〜V-6: すべて成立
- unit 119 件 pass（`look-rig` / `notification-channels` / `motion-preview`）
- 判定: **PASS**

### 確認の要点

- **RC1 解消**
  - 体の向きを 1 フレームで変えたときの視線のずれは 0.00°。
  - 13 rad/s で回す間のずれの最大値は 16.0° で、修正前の処理と同じ。
  - 会話中と、止まっている探索中の「誰を見るか」は変わっていない。
- **回る速さの上限 6 rad/s**
  - 90° 先の敵を新しく見始めるとき、90% まで向くのにかかる時間が 0.15 秒から 0.25 秒に延びる。
  - 2 rad/s で回り込む敵を追う間は、上限は効いていない。
  - 判定と照準は `state.facing` を使うので、上限は見た目だけに効く。許容範囲。
- **RC2 解消**
  - 撃破と判定するのは次のどちらかのときだけ。
    - 結果画面が出た。
    - 会話・メニューが無い状態で、HP 10% 未満のバーが消えているのを 2 回続けて読んだ。
  - バーが再び出たら、撃破の候補は取り消される。
- **報告書と JSON**: 8 試行の数値はすべて一致した。推測を実測として書いた箇所は無い。

### Recommendations（非ブロッキング）

1. 撃破判定の 2 回の読み取りに、間隔の下限を設ける（例: 推定ゲーム内 0.1 秒）。
2. 敵を見始めるのが約 0.1 秒遅れる。攻撃の見た目を実機で 1 回確認する。

## 人間による差分確認

別 Agent による独立レビューだが、Human による差分の確認と iPhone 実機での確認を推奨する。HUMAN DEVICE CHECK REQUIRED。
