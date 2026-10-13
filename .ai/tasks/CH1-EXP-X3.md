# CH1-EXP-X3 — 非戦闘の歩行の腕振り

親 Task: `.ai/tasks/CH1-EXP.md` の Work Item X-3（正本は親の Work Items 表。親は PR #75）。
計画: `.ai/reports/CHAPTER-1-experience-plan.md` §2 X-3（PR #75）。Human Decision: DEC-006（PR #75）。

Status: REVIEWING

## 原因（監査 §4）
- 非戦闘の腕振りの係数（0.40〜0.50）では、歩く速さでの肩の振れが前後 ±7° ほどしかなかった。
- 休め姿勢（立ち止まったときの形）は、肩が少し前・肘を前へ 14〜24° 曲げている。それを基準に振るので、手がベルトの前に残って「張り付いて」見えた。
- 肘は、後ろへ振った腕のほうが曲がる式だった（構えの歩行と同じ）。

## Implementation（共通の歩行の式だけ。職ごとの実装は作らない）
- `src/core/relaxed-idle.js`
  - `RELAXED_WALK_ARM_SWING` を見直した（剣士 1.20・盗賊 0.95・魔法使い 1.25・弓師 1.00）。
    - 各職の素の速さ（`CLASSES.spd`）と体格（`BUILD`）で、非戦闘の肩の振れが ±20° 前後になる値。
  - `RELAXED_WALK_ARM_BASE` / `relaxedWalkStance()`: 歩くときだけ、肩の前後と肘を「腕を体の横へ下ろした形」にする。
    - 肩 −0.03 rad、肘 −0.16 rad。
    - 肩の横方向（開き・捻り）は休め姿勢のまま。体格・上位職の癖を保ち、腕が胴へめり込まない。
  - `locomotionElbowBend()`: 非戦闘は前へ振った腕の肘が曲がる。構え（combatW = 1）は従来の式に一致する。
  - `relaxedWalkArmAmplitude()` / `locomotionStrideSwing()`: 振れ幅の検算用（本番の式と同じ）。
- `src/legacy/parts/13-update-loop.js` `updateLocomotion()`
  - 歩いている間の休め側の腕の基準を `relaxedWalkStance(...)` にした。
  - 肘を `locomotionElbowBend(s, swing, walkW)` にした。
- `src/legacy/concat-plugin.js`: import を追加した。

**変えていないもの**

- 脚の振り・歩調（`strideT` の 2.7）・移動速度・入力。
- 胴の上下動・前傾（`RELAXED_WALK_UPPER`）。
- 戦闘態勢の歩行（walkW = 1 で従来の値に一致）。
- 攻撃クリップ・構え・武器の握り・収納・回避・ジャンプの姿勢。

**止まったときの遷移**

- 止まると、既存の `relaxStopBlend` が休め姿勢へ補間する（約 0.5 秒）。
- 歩き出したときも同じ係数で補間されるので、基準が切り替わっても跳ばない。

## Test
| 確認 | 結果 |
| --- | --- |
| `tests/unit/relaxed-idle.test.js`（下記） | PASS |
| `npm run test:unit` | 1785 PASS / 0 FAIL / 1 SKIP |
| `npm run build` | PASS |
| E2E `character-motion`・`weapon-stow`（8 職の収納・抜刀・カメラ）・`mansion-escort`（Relaxed Stance）・`character-clothing`（ローカル） | **37 passed** |
| モーションパネルの計測（酒場を歩く。約 0.5 秒ごと、3〜7fps の環境） | 下表 |

`relaxed-idle.test.js` で確かめていること:

- 4 職の振れ幅が、本番の速さと体格で ±18°〜±28°。
- 歩くときの休めは、肩の前後と肘だけを置き換える。
- 肘は、非戦闘で前へ振った側が曲がる。構えは従来の式のまま。

モーションパネルの計測（修正前と修正後）:

| 職 | 修正前の肩の前後（左 / 右） | 修正後 |
| --- | --- | --- |
| 剣士 | −13.2°〜−1.7°（同じ向きに小さく動くだけ） | 左 +13.7° / 右 −19.2° → 左 +5.9° / 右 −9.3°（左右が逆向き＝交互） |
| 魔法使い | −9.7°〜−8.6°（ほぼ動かない） | 左 +12.7° / 右 −16.2° |
| 弓師 | −18.3°〜+1.1° | 左 −22.0° / 右 +18.6°、肘は前へ出た側が −23° |
| 盗賊 | −14.7°〜−3.3° | 左 −13.0° 〜 +7.6° / 右 −14.0° 〜 +5.1° |

置き換えたテスト（弱めていない）:

- 旧「4 職すべてに非戦闘の腕振り係数がある（0 < v < 1）」の上限 1 は、張り付いて見える値を前提にした範囲だった。
- 「v > 0」と、新しい「振れ幅が ±18°〜±28°」の 2 つに置き換えた。

## 実機確認（Human）
- iPhone の横画面のカメラ距離で、歩くと左右の腕が交互に振れ、体の前に張り付かないこと。
- 止まると自然な休め姿勢へ戻ること。
- 向きを変える・急に止まる・攻撃へ移るときに、肘・武器が跳ばないこと。
- 上位 4 職・影の旅人でも、腕が胴・武器にめり込まないこと（`character-motion` の撮影 `test-results/motion-*.png` を参照）。
