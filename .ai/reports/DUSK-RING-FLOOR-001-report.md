# DUSK-RING-FLOOR-001 — 宵待ちの村の予兆の輪が床の下に隠れる不具合(報告)

Status: CONTENT READY = HUMAN DEVICE CHECK REQUIRED

Task: `.ai/tasks/DUSK-RING-FLOOR-001.md`(調査・計画)。発見: CH1-DUSK-IMMERSION の独立レビュー(`.ai/reports/CH1-DUSK-IMMERSION-analysis.md` の「範囲外で見つけたもの」)。Human Decision 2026-10-27「別 PR で修正」

## 1. 原因と修正
- 村の部屋の床は y 0.08 の不透明な面。村は `groundSlabs` を登録しないので、`placeGroundTelegraph` は床の高さを 0 とみなし、輪を 0.06(床の下)に置いていた
- 隠れていた輪: 記憶漁師の近接・網の落ち先、水門守の残響、残響(水門守・ボスの段階 3)
- 修正: `telegraphFloorY()`(07)が、村の部屋の中では村の床の表(`duskFloorYAt` = 0.08)を使う。これらの輪は 0.14 に出る。`placeVillageRing` は「+0.08」を「最低 0.14」に置き換え(村・Arena とも今まで通り 0.14)
- 変えていない: 判定・時刻・半径・色・呼ぶ側、Arena・水の上・他のシナリオ(時計塔の groundSlabs を含む)

## 2. 試験
- `npm run build` 成功。unit: `tests/unit/dusk-ring-floor.test.js`(07 の `telegraphFloorY` を実際に動かし、村の部屋の中・水の上・Arena・groundSlabs の場合を確かめる。各呼び出しの高さ)。全体 2069 pass / fail 0(PR #104 と合わせても 2080 pass、merge は衝突なし)
- 画面(手元、844×390、本編の村・水門前・夜): 記憶漁師の網の落ち先の輪と、近接の溜めの橙の輪が床の上に見える(修正前は見えなかった)
- E2E: PR 本文に記録

## 3. 独立レビュー
- Round 1: **PASS**(MAJOR なし)。MINOR: この報告書が無い → 追加。NIT: 意味の無いアサーション → 実際の床の高さで確かめる形に、水門守・残響の更新の呼び出しも固定。既存の小さな点(水路の縁石・渡し板は 0.14 より高く、そこに重なる輪は一部隠れることがある。部屋の外の水の上に中心がある輪は 0.06 のまま)は範囲外として記録

## 4. iPhone での確認(横 844×390)
1. 宵待ちの村の水門前で記憶漁師と戦い、網を投げた時の落ち先の輪と、近接の溜めの橙の輪が足元に見えるか
2. 水門で水門守の残響と戦い、鎖を引く前の赤橙の輪と、残響の黄色い輪が見えるか
3. ボスの段階 3 の残響の黄色い輪が見えるか
4. 輪が見えるようになって、避けやすさ(難しさ)が変わりすぎていないか

## 5. Autonomy Metrics
Human Escalation: 0 / Human Decision: 0(着手の判断は CH1-DUSK-IMMERSION の E-1 回答で受けた)/ Auto Fix: 1 / Reviewer Rounds: 1 / PR: (PR 本文)
