# CH1-EXP-X6a — 宵待ちの村の光の色の段差をなくす

親 Task: `.ai/tasks/CH1-EXP.md` の Work Item X-6a（Status・Approval の正本は親の Work Items 表。親は PR #75 で管理）。
計画: `.ai/reports/CHAPTER-1-experience-plan.md` §2 X-6a（PR #75）。Human Decision: DEC-006（PR #75）。

Status: REVIEWING

## 原因（監査 §6）
`updateDuskVillage()` は、時間帯の値をプレイヤーの z で補間していた。

- 連続に変わっていたもの: 空・霧の色と、光の強さ。
- 跳んでいたもの: 太陽・半球光・リムの**色**。
  - `k < 0.5 ? a : b` で、帯の中間点（z ≈ 318 / 395 / 486）を境に選び替えていた。
  - 広場と船小屋を往復すると、z = 318 をまたぐたびに 1 フレームで入れ替わっていた。
- 夜明けの混ぜ方も `d > 0.5` で光の色を切り替えていた。

## Implementation
- 新規 `src/core/dusk-light.js`（state・THREE に依存しない）
  - 帯の表 `DUSK_BANDS` / `DUSK_DAWN` を legacy から移した（値は同じ）。
  - `duskBandPosAtZ(z)`: z を「帯の位置」（0〜3）へ変える。
  - `duskLight(bandPos, dawnT)`: その瞬間の色と値を返す。
    - 色は three.js の `Color.lerp` と同じ線形光の空間で補間する。今までの空の色と同じ見え方になる。
  - X-6b（物語の進行で暮れる）は、`bandPos` の作り方だけを差し替える。
- `src/legacy/parts/14-dungeon-duskvillage.js`
  - 表を削除し、時間帯の部分を `duskLight(duskBandPosAtZ(state.pos.z), duskDawnT)` の値を書くだけにした。
  - 時間帯を何で決めるか（今は z）は変えていない。
- `src/legacy/concat-plugin.js`: 上の 2 関数の import を追加した。

変えていないもの:

- 帯の色・霧・強さの値。帯の端点での値は今までと同じ。
- 時間帯の決め方（X-6b）、夜明けの進み方。

## Test
| 確認 | 結果 |
| --- | --- |
| 新規 `tests/unit/dusk-light.test.js`（6 件） | PASS |
| 　 | 帯の端点の値が表そのもの |
| 　 | z を 0.1 ずつ動かしても色が 2/255 以上跳ばない（旧実装の z = 318 の段差が無い） |
| 　 | 夜明けとの混ぜ方が連続 |
| 　 | three.js の `Color.lerp` と ±1/255 で一致 |
| 　 | legacy に選び替えの式が残っていない |
| `npm run test:unit` | 1788 PASS / 0 FAIL / 1 SKIP |
| `npm run build` | PASS |
| E2E `chapter1-dusk-basics`・`scenario-test-mode`（ローカル） | 8 passed |

## 実機確認（Human）
- 村の広場 ⇔ 船小屋を往復して、光の色が急に変わらないこと。
- 日没の色味そのものが今までと変わっていないこと。
