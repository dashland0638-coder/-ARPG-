# CH1-COMP-W2MB2 — 水門守の残響に攻撃範囲の予兆

親 Task: [`CH1-COMP.md`](CH1-COMP.md)（Work Item W2-MB2）

Status: REVIEWING（CONTENT READY = HUMAN DEVICE CHECK REQUIRED）

根拠の調査: `.ai/reports/CH1-COMP-W2MB-analysis.md`、`.ai/reports/CH1-COMP-W2MB2-analysis.md`

## Approval
- [x] Approved（Human 2026-10-22「CH1-COMP W2-MB2 — 水門守の残響に攻撃範囲の予兆を追加」）
- Escalation Check: None（HP・攻撃力・範囲・判定の時刻・残響の数・寿命は変えない。予兆の表示とテストモードの記録だけ）

## 受け入れ条件（実装前に決めたもの）

1. 本体: 予備動作の始めから、当たる瞬間（引く動作の 45%）まで足元に輪（外周 = 判定の半径 2.4）。内側の円が当たる瞬間に満ちる（合わせて 1.225 秒）
2. 「引いた」残響（水門守が出したもの）: 出た瞬間から当たる瞬間（0.99 秒）まで輪。外周 = 残響の判定の半径
3. 歩いた跡の残響・村の残響のボスが出す残響には出さない
4. 当たった後・寿命切れ・撃破・ダウン中・Arena の Clear・世界の破棄（場所の移動・タイトル経由の入り直し）で輪が残らない。Three.js の資源を増やさない
5. 判定・ダメージ・範囲・時刻・間隔・残響の数と寿命は今のまま（unit で値を固定、E2E で時刻とダメージの比）
6. 既存の円の予兆（W2-MB1 の漁師の近接）の部品を共用にして使い回す。別の描画の仕組みは作らない

## 実装

| ファイル | 内容 |
| --- | --- |
| `src/core/warden-echo.js` | `KEEPER_STRIKE_FRAC`(0.45)・`ECHO_HARM_FRAC`(0.45)・`KEEPER_ECHO_SOURCE`・`KEEPER_TELEGRAPH_LEAD_SEC`(1.225)・`echoHarmAt`・`keeperTelegraphProgress`・`echoHasTelegraph`・`echoTelegraphProgress`（値は今のまま定数へ移しただけ） |
| `src/legacy/parts/07-ai-combat.js` | 円の予兆の部品を共用に（`makeGroundTelegraph` / `placeGroundTelegraph`。ジオメトリ・マテリアルは半径・色ごとに 1 つを使い回す）。漁師はこれを使うように置き換え。水門守の本体（`en.meleeTelegraphMesh`、毎フレーム本体の位置へ）と、`source:'keeper'` の当たる残響に輪。残響の後片付け（当たった後・寿命切れ・`clearKeeperEchoes`）。Arena の Clear で残響も消す。判定の 0.45 を定数に（値は同じ）。テストモードの記録 `KEEPER — TELEGRAPH / STRIKE (in range|out of range)`、`KEEPER ECHO — SPAWN operate (telegraph) / SPAWN walk / STRIKE (…)` |
| `src/legacy/parts/14-training-ground.js` | Debug Info（テストモードだけ）: `Keeper Ring`・`Player Dist`・`Echo Rings`・`Ground Rings`。漁師の行は共用の部品の名前に合わせた |
| `src/legacy/concat-plugin.js` | import の追加 |
| `tests/unit/warden-echo.test.js` | 予兆の 7 件を追加（既存は変更なし） |
| `tests/dusk-keeper-telegraph.spec.js`（新規） | E2E |

色: 本体は赤みの強い橙（`0xff5a36`、太さ 0.24）、残響は黄（`0xffd04a`、太さ 0.16、内側の円は薄め）。漁師の近接（橙 `0xff8a3a`）・網（水色・砂色）とも分ける。
