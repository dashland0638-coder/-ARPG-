# WANDERER-RENEWAL-002 Analysis

## Task
WANDERER-RENEWAL-002 / Human の「影の旅人・最終キャラクター設計書」（DEC-034）を、PR #145（WANDERER-RENEWAL-001）の上に実装する。

## Summary
- FACT: PR #145 の表現は「右手の影の刃（武器の枠）＋本人の複製の残像＋紫の斬撃弧」。DEC-034 はこれを「地面から出る巨大な影の手」に置き換え、武器・斬撃エフェクトとしての表現を禁じる。
- FACT: PR #145 の判定・数値・タイミングの土台（`core/wanderer-style.js` の追撃の予定と判定、Skill 1 / 2 の定義、閃き、`rigKeyOf`）はそのまま使える。DEC-034 も「スキル性能・基本構造を原則維持」。
- FACT: 加入後の外見は T-4 / T-5 の衣服（ショートコート × 白いシャツ、Charcoal）。DEC-034 は加入前のフード外套姿を基本デザインにし、配色も外套 #654F86 ほかへ変える。
- 結論: 置き換えるのは「表現（影の手・本人のモーション・外見・配色）」。判定の形は、影の手の見た目と一致させるために 1 段目・3 段目だけ「手の出た場所の円」にする（攻撃範囲は同程度）。

## Existing System Search
| 探したもの | 検索語 / 範囲 | 結果 |
| --- | --- | --- |
| 輪郭だけ光らせる仕組み | `makeOutlineMat` / `05-rendering-rig.js` | `05:2095`（法線方向に押し出す BackSide のシェル。色と太さを指定できる）→ 影の手の紫の輪郭に再利用 |
| 地面から出る演出 | `rise` / `spawnUltimateVFX` / 敵の出現 | 専用の仕組みなし（確認済み: `src/legacy/parts/*.js`）。床より下から持ち上げるだけで表せる（床が下を隠す） |
| 判定の保留 | `pendingSwing` / `impactFrac` | `11:141`（入力 → 一定時間後に swingOnce）。影の手の時間差は、影の旅人の追撃の待ち行列（17）で同じ作法で表せる |
| 遅れる影 | `trackPreJoinShadow` / `PRE_JOIN_SHADOW_LAG` | `14-dungeon-road.js`。加入後の足元の影も同じ作り（履歴から 0.45 秒前の位置）で表せる |
| フード | `makeRogueHood` / `rogueHoodCoverageAt` / 加入前のフード | 加入前の姿のフード（`makeOpenGarmentLoft`、14-dungeon-road.js）。加入後も同じ部品で組む |
| 配色 | `PLAYER_PALETTE.wanderer` | `src/render/player-palette.js:80`。行を変えるだけで役割別 Material に反映 |
| 斬撃の弧 | `spawnMeleeSwingVFX` | `10-input.js:637`。影の旅人では出さない（DEC-034 §9） |
| 必殺技の命中の瞬間 | `resolveUltimate` | `11-combat-actions.js:2028〜`。影の旅人だけ影の手を足す差し込み口 |
| 勝利の専用ポーズ | `victory` | なし（WANDERER-RENEWAL-001 analysis で確認済み）。全員共通の構え → 休めのまま |

## Current Behavior（FACT）
PR #145 時点: 武器の枠 = 影の刃。3 段は払い / 返し / 振り下ろし（弧の判定、3 段目の 0.45 秒後に同じ弧の追撃）。追撃と回避には本人の複製の残像。加入後の服は Charcoal のショートコートと白いシャツ。

## Expected Behavior
DEC-034（§1〜§11）。

## Differences / Scope of Change
1. 武器の枠を空にする（影の刃・刃の軌跡をやめる）。影の旅人では紫の斬撃弧を出さない
2. 影の手（人間の手の形・長い指・尖った指先・外へ開く親指・黒紫の内部＋紫の輪郭）を作り、出現・動き・消え方を手ごとに持たせる
3. 3 段・Skill 1・Skill 2・必殺技・回避に影の手を割り当て、判定を手の位置・時刻と一致させる
4. 本人のモーションを大振りの「影を呼ぶ」動作へ（突き上げ・薙ぎ払い・握り込み・差し出し・両腕を広げる）
5. 外見: 加入前・加入後を同じフード外套の部品で組む（加入前は深く、加入後は少し後ろ）。外套は腰丈。配色を DEC-034 へ
6. 足元の影: 加入後も 0.45 秒遅れてついてくる影、待機で揺れ、走ると伸びる
7. 外套の裾・マフラーの揺れ（体の動きより遅れて）

## Risks
- R-1 巨大な手が見下ろしカメラで主人公や敵を隠す → 手は敵の足元・攻撃範囲の上に出し、短時間で沈める。大きさはカメラで確かめて決める
- R-2 描画負荷 → ジオメトリと Material は全ての手で共有し、手は使い回す（作り直さない）
- R-3 他職への影響 → 影の旅人の分岐だけで足す

## Unknowns
ESCALATION 候補なし（DEC-034 が WHAT を決めている。大きさは「調整する」と委ねられている）。

## Recommended Next Step
Planner: 1 承認単位として計画（Human Approval = DEC-034）。
