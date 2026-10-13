# CH1-EXP-X4 — 演出中・会話中も主人公の身体を止めない

親 Task: `.ai/tasks/CH1-EXP.md` の Work Item X-4（正本は親の Work Items 表。親は PR #75）。
計画: `.ai/reports/CHAPTER-1-experience-plan.md` §2 X-4（PR #75）。Human Decision: DEC-006（PR #75）。
依存: X-3（`claude/ch1-exp-x3-walk-arms`）の上に積んである。X-3 → X-4 の順に merge する。

Status: PR_OPEN（Reviewer PASS）

## 原因（監査 §3.1）
- 演出中・会話中は `updatePlayer` が回らない。
  - 主人公の呼吸・待機の揺れが止まり、最後の姿勢のまま固まる。
  - 演出で歩かせる（`state.walkTo`）と、足を動かさずに滑る。
- 村の演出で歩く同行者（剣士）は、位置と向きが変わるだけで揺れが無い。

## Implementation
- `src/legacy/parts/13-update-loop.js` に `updateBodyWhileScripted(dt)` を追加した。
  - `player.position` / `rotation.y` / `visualFacing` を `state` に合わせる。
  - その後 `updateLocomotion(dt, 演出の徒歩の速さ)` を呼ぶ。
  - 入力・移動・攻撃・カメラの処理は呼ばない。
  - 位置を毎回置き直すので、上下動が積み上がらない。
- `src/legacy/parts/14-hud-boot.js` の `animate`: 演出中の分岐（`updateCutscenePhysics` の後）と、会話中の分岐から呼ぶ。
- `src/legacy/parts/14-dungeon-duskvillage.js` の `stepDuskGuestWalk`: 支援 AI と同じ上下の揺れ（`08-loot-equipment.js` と同じ式）を付ける。

変えていないもの:

- 演出の時間・順序・台詞。
- 支援 AI の見た目・動き（古い監査の E-3）。

## Test
| 確認 | 結果 |
| --- | --- |
| 新規 `tests/unit/scripted-body.test.js`（3 件。配線・位置の置き直し・禁止の処理・同行者の揺れ） | 修正前のソースで 3 件 FAIL、修正後 3 件 PASS |
| 新規 E2E `tests/chapter1-scripted-body.spec.js` | PASS。`updateBodyWhileScripted` の呼び出しを外すと FAIL |
| 　 | 村の住宅の記憶の演出で台詞を待つ間、モーションパネルの腰・肩の値が変わり続ける |
| 　 | 会話中はキー入力を受け付けないので、デバッグモードはバージョン表記の5連打で出す |
| `npm run test:unit` | 1788 PASS / 0 FAIL / 1 SKIP |
| `npm run build` | PASS |

## Review
- Round 1: CHANGES_REQUIRED。
  - blocking 1: 記録ファイルが無い。この記録を追加した。
  - non-blocking 1: 会話中に見た目の向き（`visualFacing`）を合わせていなかった。反映した。

## 実機確認（Human）
- 演出・会話の間、主人公が固まらず、呼吸していること。
- 演出で歩くとき、足が動くこと。
- 演出の後、操作に戻った瞬間に姿勢・向きが跳ばないこと。
