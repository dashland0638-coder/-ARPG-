# CH1-COMP-W3-GHOST — 宵待ちの村の怪異デザイン統一(幽霊・人型の影)

親 Task: [`CH1-COMP-W3.md`](CH1-COMP-W3.md)(履歴・承認はそちらのまま。この Work Item は追加改修)

Status: IMPLEMENTING(CONTENT READY = HUMAN DEVICE CHECK REQUIRED)

調査: `.ai/reports/CH1-COMP-W3-GHOST-analysis.md`

## Approval
- [x] Approved(Human 2026-10-26「CH1-COMP-W3 追加改修：宵待ちの村の怪異デザイン統一」。デザイン方針は Human 承認済み)

## 計画(Planner)
1. 記憶漁師・水門守の残響: 脚を透ける影に、裾から薄布、足元に霧の映り込み(水鏡の影と共通の素材)。姿勢・歩き・色・大きさ・当たりは変えない
2. 泡沫: 塊の上に、泡から半身を起こす透ける人影(頭と肩)。塊の水平の広がりの内側(当たり 0.34 のまま)
3. 定数は `src/core/dusk-enemies.js`(`VILLAGE_GHOST`・`FOAM_FIGURE`)。unit で「透ける・数値と当たりが変わらない・光源なし・新しい色なし」を固定。E2E で目視用の画面
4. 水鏡の影・写し身・ボス・分身・残響・演出の幽霊は変えない

## 受け入れ条件
- ゾンビ的・グロテスクな造形が無い。6 種が幽霊・人型の影(泡沫は霊的な泡)にそろう
- シルエット・姿勢・装備・色・動作で見分けられる
- 予兆 = 判定、戦闘の数値・AI は今のまま。光源を足さない
- build・unit・関連 E2E・CI、独立 Reviewer PASS

## Result

- Reviewer PASS(Round 1)。CONTENT READY = HUMAN DEVICE CHECK REQUIRED。報告: `.ai/reports/CH1-COMP-W3-GHOST-report.md`
