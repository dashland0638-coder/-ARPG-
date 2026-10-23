# CH1-COMP-W2MB2 — 調査（Analyzer）

基準: `origin/main` `6e09800`。P07 = `src/legacy/parts/07-ai-combat.js`、C = `src/core/warden-echo.js`。

## 本体（FACT）

`updateKeeperAI`（P07）: `move`（持ち場へ歩く。0.9 秒ごとに「歩いた」記録）→ `windup`（0.55 秒。身体の沈み込み）→ `operate`（1.5 秒）。`operate` の `prog >= 0.45`（引き始めから 0.675 秒）で 1 回だけ、`state.pos.distanceTo(本体) < 2.4` なら攻撃力そのままのダメージ。→ 予備動作の始めから当たるまで **1.225 秒**。判定の中心は当たる瞬間の本体の位置。

本体は強モブ（`strongMob`）。大怯みは無く、ダウン（体幹）では AI が止まる（相の残り時間は進まない）。身体は 1.18 倍に拡大（輪を group の子にすると半径がずれるので、scene 直下に置く）。

## 残響（FACT）

`spawnKeeperEcho`（P07）が本体の記録を `echoDelay`（1.6 秒、観測の灯で 2.4 秒）遅れて再生する。寿命 2.2 秒。`harmAt` は「引いた」記録だけ `2.2 × 0.45 = 0.99` 秒、歩いた記録は null（当たらない）。判定は C `echoStrikes`（harmAt を跨いだフレームで 1 回、`<=` 半径）。半径は `2.4 × scale`。

**生成元は 2 つ**: 水門守（`updateKeeperAI`、scale なし）と、村の残響のボス（段階 3、`spawnKeeperEcho(boss, rec, {scale:1.5})`）。両方とも同じ `keeperEchoes` に入る。今回は水門守のものだけに予兆を出すため、`source:'keeper'` の印を足す（ボスの呼び出しは変えない = 印なし）。

## 後片付け（FACT）

- `clearKeeperEchoes` は世界の破棄（P02）・テストモードの開始地点への移動（P14 `teleportTestModeTo`）で呼ばれる。Arena の Clear では呼ばれていなかった（残響は寿命で消える）→ Clear でも呼ぶ
- 本体の `en.meleeTelegraphMesh` は撃破（`finishEnemyDeath`）・Arena の Clear・世界の破棄で片付く（W2-MB1 と同じ持ち主）
- タイトルへ戻った後に入り直す時は世界を作り直す（P02 の破棄を通る）

## 予兆の部品

W2-MB1 の漁師の近接の輪（外周の輪＋満ちる円の Group）を共用の部品にし、ジオメトリとマテリアルを半径・色ごとに使い回す。W2-4a の段階移行の爆発の予兆はボス専用で、発光の演出も持つので今回は触らない。
