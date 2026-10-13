# CH1-EXP-X6b — 宵待ちの村は、物語の進行で暮れる

親 Task: `.ai/tasks/CH1-EXP.md` の Work Item X-6b（正本は親の Work Items 表。親は PR #75）。
計画: `.ai/reports/CHAPTER-1-experience-plan.md` §2 X-6b（PR #75）。Human Decision: DEC-006 の EX-2 = A（PR #75）。
依存: X-6a（`claude/ch1-exp-x6a-dusk-light-lerp`）の上に積んである。X-6a を先に merge する。

Status: REVIEWING

## Implementation
- `src/core/dusk-light.js`（X-6a で作ったもの）に次を追加した。
  - `DUSK_BEAT_TARGET`: 4 つの出来事ごとの目標の帯の位置（夜 = 3）。
    - 入口 0.5
    - 閃き 1.5
    - 水門守の撃破 2.2
    - ボスの手前 3
  - `advanceDuskTarget(target, beat)`: 目標は max を取るので、上がるだけ。
  - `stepDuskBandPos(pos, target, dt)`: 1 帯を 3.5 秒で目標へ寄せる。行き過ぎず、戻らない。
- `src/legacy/parts/14-dungeon-duskvillage.js`
  - `duskBandPos` / `duskBandTarget` を持ち、`buildDuskVillage()` で出撃ごとに 0 へ戻す。
  - 4 つの出来事で `advanceDuskTime(beat)` を呼ぶ。
    - `playDuskEntranceScene` の先頭
    - 水門前の部屋のイベント（閃きの前）
    - `onDuskWardenDefeated` の先頭
    - `playDuskBossPrelude`（一度だけの判定の後）
  - `updateDuskVillage()` は `duskLight(duskBandPos, duskDawnT)` を使う。**プレイヤーの z では決めない**。
  - テストモードの開始地点（出来事を飛ばして途中から入る）だけは、その場所の帯まで目標を上げる。上げるだけなので、巻き戻らないのは同じ。

**状態の整合**

- 出来事は、もともと出撃 1 回につき 1 回（`*Done` フラグ・`fired`）。
- 目標は max なので、起き直しても下がらない。
- 時間帯はセーブに入れない。
  - 「つづきから」は必ず酒場から始まる。
  - 出撃のたびに出来事と時間帯が一緒に 0 から始まるので、食い違いが無い。
- 夜明け（`duskDawnT`）は今までどおり重ねる。

## Test
| 確認 | 結果 |
| --- | --- |
| `tests/unit/dusk-light.test.js`（10 件。X-6b で 4 件追加、1 件を新しい仕様に合わせて置き換え） | PASS |
| 　 | 出来事の順に目標が上がり、ボスの手前で夜 |
| 　 | 起き直し・順番の前後で下がらない |
| 　 | 帯 1 つを 3.5 秒で寄る。行き過ぎず、戻らない |
| 　 | legacy の 4 か所の呼び出し・出撃ごとの初期化・z を使うのはテストモードだけ |
| `npm run test:unit` | 1792 PASS / 0 FAIL / 1 SKIP |
| `npm run build` | PASS |
| E2E `chapter1-dusk-basics`・`scenario-test-mode`（ローカル） | 下記 |

置き換えたテスト（弱めていない）: X-6a の「legacy が `duskLight(duskBandPosAtZ(state.pos.z), …)` を使う」は、z で決めないという新しい仕様と矛盾するので、「`duskLight(duskBandPos, …)` を使い、z を使うのはテストモードだけ」に置き換えた。

E2E で往復を確かめていない理由:

- 時間帯の値（露出・空の色）はページから読める口が無い。
- この環境では村の中を往復するのに数分かかる。
- 巻き戻らないことは unit（目標の max・位置の単調）で固定した。

## 実機確認（Human）
- 入口の一幕で暮れ始め、閃き・水門守・ボスの手前で段階的に暗くなる。
- 広場 ⇔ 船小屋を往復しても戻らない。
- 色の変化が数秒かけて滑らか。
- ボス撃破後の夜明けが今までどおり。
