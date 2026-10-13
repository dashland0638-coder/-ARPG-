# CH1-EXP-X1 — 分離の台詞を「消えた……？」に

親 Task: `.ai/tasks/CH1-EXP.md` の Work Item X-1（Status・Approval の正本は親の Work Items 表。親は PR #75 で管理）。
計画: `.ai/reports/CHAPTER-1-experience-plan.md` §2 X-1（PR #75）。Human Decision: `.ai/decisions/DEC-006-chapter1-experience.md`（PR #75）。

Status: REVIEWING

## Implementation
- `src/legacy/parts/03-dungeons-mansion-temple.js`
  - `playMansionSplitScene()` の唯一の台詞を変えた。
    - 前: `cutsceneLine('「……鍛冶屋?」')`
    - 後: `cutsceneLine('「消えた……？」')`
  - 冒頭のコメントの流れ図も同じ文言にした。
- `MANSION_SCENARIO.md`・`docs/CHAPTER1_PLAYTEST.md`（B-12）: 同じ台詞の記述をそろえた。
- `tests/unit/mansion-scenes.test.js`
  - 分離の場面を実物のまま動かすテストで、台詞の数を確かめていた。
  - それを「台詞はこの 1 行だけ」（文面まで一致）に強めた。

変えていないもの:

- 再会の場面の鍛冶士の台詞、分離の直後のログ 2 行。
- 演出の時間・順序・条件（`shouldSeparate`）。

## Test
| 確認 | 結果 |
| --- | --- |
| 追加の確認を修正前のソースで実行 | FAIL（期待どおり。`line:「……鍛冶屋?」`） |
| `node --test tests/unit/mansion-scenes.test.js` | 12 PASS |
| `npm run test:unit` | 1782 PASS / 0 FAIL / 1 SKIP（既存） |
| `npm run build` | PASS |
| E2E | 新規なし。既存の E2E は分離まで歩き通せない（`mansion-escort.spec.js:15-17`）。全体は CI |

## 実機確認（Human）
- `docs/CHAPTER1_PLAYTEST.md` B-12: 暗転 → 振り返り → 「消えた……？」→ 向き直り。
