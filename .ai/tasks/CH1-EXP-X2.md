# CH1-EXP-X2 — 宵待ちの村の演出テンポ

親 Task: `.ai/tasks/CH1-EXP.md` の Work Item X-2（正本は親の Work Items 表。親は PR #75）。
計画: `.ai/reports/CHAPTER-1-experience-plan.md` §2 X-2（PR #75）。Human Decision: DEC-006（PR #75）。
依存: X-4（`claude/ch1-exp-x4-cutscene-body`）の上に積んである。その下に X-3。X-3 → X-4 → X-2 の順に merge する。

Status: REVIEWING

## 原因（監査 §3）
1. 記憶の演出（魚屋・住宅・船小屋・商店街）は、声の後で会話欄を消し、0.8〜1.2 秒置いてから二人が話す。この間、台詞も操作も無い。
2. 最初の台詞までの前置きを一律 0.8 秒に詰める処理が、見せ場まで詰めていた。
   - ボスの手前の記憶が集まる場面は 8.7 秒が 0.8 秒に。
   - 撃破後の記憶が戻る場面、水門守のレバーが動く場面も同じ。
3. 演出の時間はゲーム内の時間（1 フレーム 50ms で頭打ち）で進むので、低 fps では待ちが実時間で延びる。
4. 演出中は主人公の姿勢が固まる（X-4 で対応済み）。

## Implementation
- 新規 `src/core/cutscene-timing.js`
  - `planCutsceneTiming(steps, isLine, opts)` は手順ごとの待ちを決める。
    - 最初の台詞までの前置き: `firstLineSec` まで詰める。
    - 台詞を送った後、次の台詞まで: `gapSec` を渡したときだけ、そこまで詰める。
    - `keep:true` の手順（見せ場）: 詰めない（1 区間 3.5 秒まで）。
  - `cutsceneStepDelta(dt, realDt, realtime)`: 見せ場以外の待ちは実時間で数える（dt と実時間の大きい方）。見せ場はゲーム内の時間で数え、画面の動きとそろえる。
- `src/legacy/parts/02-world-common.js`
  - `playCutscene(steps, opts)` は計画を使う。
  - `updateCutscene` は手順ごとの時計で進む。
  - `cutsceneRealDt` を追加した。
- `src/legacy/parts/14-hud-boot.js`: `animate` が `performance.now()` からフレームの実時間を測る（0.25 秒で頭打ち）。
  - dt の作り方（`simDeltaSeconds(clock.getDelta(), …)`）は変えていない。
- `src/legacy/parts/14-dungeon-duskvillage.js`
  - 村の演出 11 本すべてに `DUSK_TEMPO = {firstLineSec: 0.5, gapSec: 0.3}` を渡す。
  - 見せ場に `keep:true` を付けた。
    - 入口: 人影が見えてから声をかけるまで。
    - 水門守の登場: レバー・鎖・門・人影。
    - 水門守の撃破: 門が動き出す間。
    - ボスの手前: 記憶が集まる。
    - 撃破後: 記憶が戻る・「……ありがとう。」まで・夜明けの間。
- `src/legacy/concat-plugin.js`: import を追加した。

**変えていないもの**

- イベントの数・場所・台詞・発生の条件・回数・順序。
- 台詞は送るまで進まない（WORK 12.1）。
- 村以外の演出: 前置き 0.8 秒、台詞の間は詰めない。
  - ただし見せ場以外の待ちが実時間になるのは全演出に共通。速い端末では今までと同じ。
- 記憶のイベントを「止めない演出」へ変えること（Out of Scope）。

## Test
| 確認 | 結果 |
| --- | --- |
| 新規 `tests/unit/cutscene-timing.test.js`（7 件。下記） | PASS |
| `npm run test:unit` | 1795 PASS / 0 FAIL / 1 SKIP |
| `npm run build` | PASS |
| E2E `chapter1-dusk-basics`・`chapter1-skill2`・`chapter1-scripted-body`・`scenario-test-mode`（ローカル） | 下記 |

`cutscene-timing.test.js` で確かめていること:

- 計画の計算:
  - 前置き・台詞の間・keep・台詞の無い演出は触らない。
  - 実時間の時計。
- 実物の村の演出 11 本を組み立てて確かめる:
  - 台詞の間の無言の間が 0.3 秒以下。
  - 前置きが 0.5 秒以下。
  - 4 つの見せ場が 2 秒以上残る。
  - 記憶の演出には見せ場の印が無い。

## 実機確認（Human）
- 村の入口・魚屋・住宅・船小屋・商店街の記憶・水門前で、地点に入るとすぐ会話が始まること。
- 台詞の間に「止まった」と感じる間が無いこと。
- ボスの手前・撃破後・水門守の登場・撃破では、見せるための間が残っていること。
- 低性能の端末でも、待ちが延びないこと。
- 演出の後、操作に自然に戻ること。
