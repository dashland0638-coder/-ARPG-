# CH1-DUSK-IMMERSION — 宵待ちの村の物語・街灯・第二スキルの体感改善

親 Task: [`CH1-COMP.md`](CH1-COMP.md)

Status: IMPLEMENTING(CONTENT READY = HUMAN DEVICE CHECK REQUIRED)

調査と計画: `.ai/reports/CH1-DUSK-IMMERSION-analysis.md`。決定: `.ai/decisions/DEC-010-dusk-immersion.md`

## Approval
- [x] Approved(Human 2026-10-26)

## 単位
- A 台詞(村の 11 の演出の会話・手記 2 枚)
- B 外壁ランプ・街灯・電線(光源を増やさない)
- C 観測の灯の見え方(効果は変えない)

## Files To Change
- `src/legacy/parts/14-dungeon-duskvillage.js`(演出の台詞・手記・灯り・電線・怪異の頭上の粒・波紋)
- `src/legacy/parts/11-combat-actions.js`(観測の灯の届く範囲の輪)、`src/legacy/parts/07-ai-combat.js`(水鏡の影の波紋の呼び出し)
- `src/legacy/concat-plugin.js`(HEADER の import)
- 新規 `src/core/dusk-night-lights.js`・`src/core/observe-light-cues.js`
- 新規 `tests/unit/dusk-night-lights.test.js`・`tests/unit/observe-light-cues.test.js`
- `docs/CHAPTER1_STORY.md` §1、`.ai/AGENTS.md` §12.1、`.ai/decisions/DEC-010-dusk-immersion.md`、`.ai/reports/CH1-DUSK-IMMERSION-*.md`

## Files Not To Change
- `basefile.html`、セーブ(09-save-load.js)、敵の数値・AI の判定(core/mirror-shade.js などの数値)、洋館・他のシナリオのファイル、敵の見た目(dress*)

## 受け入れ条件
- 台詞から村の異変・目的・因果が具体的に分かる。正体は断定しない。イベントの数・条件・順番は不変
- 夜の村に外壁ランプ・街灯・電線。PointLight 19 のまま。予兆を隠さない
- 観測の灯を使った結果が画面で分かる。効果・数値は不変
- build・unit・関連 E2E・CI・独立 Reviewer PASS

## Escalation
- E-1: 観測の灯は村の怪異以外には何も起きない(このままでよいか)。詳細と選択肢は `.ai/reports/CH1-DUSK-IMMERSION-analysis.md` の末尾。推奨 A(このまま)。**作業は止めない**

## Result

- Reviewer PASS(Round 4)。CONTENT READY = HUMAN DEVICE CHECK REQUIRED。報告: `.ai/reports/CH1-DUSK-IMMERSION-report.md`
