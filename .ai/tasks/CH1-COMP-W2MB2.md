# CH1-COMP-W2MB2 — 水門守の残響に攻撃範囲の予兆

親 Task: [`CH1-COMP.md`](CH1-COMP.md)（Work Item W2-MB2）

Status: DONE（PR 作成済み。CONTENT READY = HUMAN DEVICE CHECK REQUIRED。main への merge は Human の判断）

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

## Test Report（2026-10-22）

| 項目 | 結果 |
| --- | --- |
| `npm run build` | 成功 |
| `npm run test:unit` | 1961 pass / 0 fail（1 skip は既存）。予兆の 8 件を追加（既存の warden-echo のテストは変更なし） |
| E2E `dusk-keeper-telegraph`（新規） | passed。本体: TELEGRAPH → STRIKE 1.275 秒（推定ゲーム内時間。設計 1.225 秒＋1 フレーム）、ダメージ 40 は STRIKE (in range) の時だけ。残響: SPAWN operate (telegraph) → STRIKE 0.971 秒（設計 0.99 秒）、ダメージ 24 = round(40 × 0.6)。輪はどのフレームも `shown 2.40 / hit 2.40 center 0.00`、残響の輪も `2.40/2.40`、歩いた跡の輪 0。Clear の後の床の円 0 |
| E2E 回帰（`dusk-keeper-telegraph`・`dusk-boss-phase-burst`・`dusk-fisher-telegraph`・`combat-test-arena`・`duskvillage`・`chapter1-dusk-basics`・`execution-break`・`notifications`・`scenario-test-mode`・`save-load`・`chapter1-progression`・`production-build`） | 44 passed（R1 の修正の前）。修正の後に `dusk-keeper-telegraph`・`dusk-fisher-telegraph` を再実行して 3 passed |
| PR の CI | PR 作成後 |

E2E の注記: Arena は出すたびに左右へずらす（1 体目は左 2.6）。最初は水門守を 1 体目に出していたので、正面へ歩いても横 2.6 を素通りし、本体の判定（2.4）に入らなかった。Dummy を先に出して水門守を正面にした（テストの手順だけの修正）。

## Reviewer

Round 1 CHANGES_REQUIRED（R1: 敵対していない間の本体の輪）→ Round 2 **PASS**（`.ai/reports/CH1-COMP-W2MB2-review.md`）。

## Remaining Risks

- 浮き・大怯みの間は、本体の輪が止まったまま見え、再開すると当たる瞬間にちょうど満ちる（正確。漁師は溜めを取り消すのと違う）
- 本体の判定は 3D 距離、残響は 2D、輪は 2D（前からの式のまま）
- Arena で本体を倒しても、出ている残響は輪を持ったまま当たる（当たるので正しい。村では撃破で残響を消す）
- 輪が重なった時の見え方（本体は赤橙・太め、残響は黄・細め）は実機で確かめる

## HUMAN DEVICE CHECK REQUIRED（iPhone、未確認）

1. 本体の足元の円が、攻撃範囲とタイミングを分かりやすく伝えるか
2. 残響の円が、出てから攻撃までの猶予を直感的に伝えるか
3. 攻撃しない残響（歩いた跡）と攻撃する残響を見分けられるか
4. 円が重なった時も、横画面で危険な範囲を判断できるか
5. 予兆の表示でフレームレートが目立って下がらないか

### Autonomy Metrics

Human Escalation: 0 / Human Decision: 0 / Auto Fix: 2（E2E の手順 1、Review Fix 1）/ Reviewer Rounds: 2 / Test Retry: 0
