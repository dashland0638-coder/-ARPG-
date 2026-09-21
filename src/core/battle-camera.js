/* 戦闘 / 非戦闘のカメラ距離。
   state・three.js・シーンに一切依存しないので tests/unit/ から直接呼べる
   (core/combat-stance.js と同じ切り出し方)。

   ■ ここが扱うのは「距離と高さ」だけ
   カメラには既に3つの別の仕組みがある:

     向きの自動回転   updateInput()      camAutoOn / camAutoResumeT
     注視点のずらし   getCombatCameraFocusOffset()
     ボスのロックオン findLockOnBoss()

   このファイルはそのどれにも触らない。触るのは camDist / camHeight
   だけで、camYaw(カメラがどちらに居るか)は一切変えない ―― 移動は
   カメラ相対なので、向きを触ると操作の対応関係まで変わってしまう。

   ■ なぜ状態 enum ではなくスカラーなのか
   EXPLORE / COMBAT_TRANSITION / COMBAT / COMBAT_EXIT を enum で持つと、
   遷移の途中で敵に再遭遇したときに「COMBAT_EXIT の 60% から COMBAT へ
   戻る」という場合分けが要る。0..1 のスカラー1本なら、目標値が
   入れ替わるだけで途中反転が自然に繋がる ―― 武器の blend
   (core/weapon-state.js)と同じ理屈。

   ■ 距離は camAutoOn と独立(仕様 17)
   camAutoOn は「カメラの向きを自動で回すか」の設定であって、距離の
   設定ではない。自動回転を切っている人にも、戦闘 / 非戦闘の距離の
   違いは効く。 */

/* 非戦闘。現行より約1m引き、俯角を約2度寝かせる ――
   背中の武器と Relaxed Idle を見せるための余白。
     距離 √(7.0²+8.6²) = 11.09m / 俯角 atan(8.6/7.0) = 50.9° */
export const EXPLORE_CAMERA = {dist: 7.0, height: 8.6};

/* 戦闘。**現行値そのまま**(core/state.js の camDist 6 / camHeight 8)。
     距離 √(6²+8²) = 10.0m / 俯角 atan(8/6) = 53.1°
   ここを動かさないのは、既に調整済みの戦闘の手触りを変えないため ――
   「戦闘時は非戦闘時より少し寄る」は、非戦闘側を引くことで成立する。 */
export const COMBAT_CAMERA = {dist: 6.0, height: 8.0};

/* EXPLORE ↔ COMBAT の寄り速度(1/秒、指数追従)。
   1-exp(-k*t) なので、k=10 で約0.30秒、k=7.5 で約0.40秒で95%まで寄る。
   入り(戦闘へ)を速く、抜け(非戦闘へ)を遅くしてあるのは、戦闘に
   入るのは本人の意思で、終わるのはためらいがあってよいため。
   抜け側には combatStanceWeight の smoothstep(0.75秒)も重なる。 */
export const COMBAT_CAM_IN_RATE  = 10.0;
export const COMBAT_CAM_OUT_RATE = 7.5;

export function stepCombatCamBlend(current, wantsCombat, dt,
                                   inRate = COMBAT_CAM_IN_RATE,
                                   outRate = COMBAT_CAM_OUT_RATE){
  const c = Math.max(0, Math.min(1, current || 0));
  if(!(dt > 0)) return c;
  const target = wantsCombat ? 1 : 0;
  const rate = wantsCombat ? inRate : outRate;
  const k = 1 - Math.exp(-Math.max(0, rate) * dt);
  return c + (target - c) * k;
}

/* blend(0 = 探索、1 = 戦闘)→ 距離と高さ。
   ユーザーのカメラ高さ設定(CAMHEIGHT_STEPS)はここでは足さない ――
   足すのは呼び出し側(14-hud-boot.js の applyCamHeightSetting が
   唯一の持ち主)で、二重加算を避けるため責務を分けてある。 */
export function cameraProfileAt(blend, distBonus = 0){
  const b = Math.max(0, Math.min(1, blend || 0));
  return {
    dist:   EXPLORE_CAMERA.dist   + (COMBAT_CAMERA.dist   - EXPLORE_CAMERA.dist)   * b
            + Math.max(0, distBonus || 0),
    height: EXPLORE_CAMERA.height + (COMBAT_CAMERA.height - EXPLORE_CAMERA.height) * b,
  };
}

/* =========================================================
   戦闘中の自動距離(仕様 14)

   敵が離れるほど少しだけ引く。「敵を必ず画面に収める」ためではない ――
   収めようとすると、敵が1体増えるたび、逃げるたびにプレイヤーが
   小さくなる。上限を先に決めて、その中だけで動かす。

     ～3m      +0.0   通常の戦闘距離
     3〜7m     線形
     7m以上    +1.2   上限。ここで頭打ち
     範囲外    +1.2   追わない(上限のまま留まる)
========================================================= */
export const COMBAT_DIST_NEAR = 3.0;
export const COMBAT_DIST_FAR  = 7.0;
export const COMBAT_DIST_BONUS_MAX = 1.2;
// 追従(1/秒)。位置追従(k≒6.9/s)よりはっきり遅い ―― ズームは反応では
// なくゆっくりした落ち着きとして見せたい(仕様 17)
export const COMBAT_DIST_RATE = 1.8;
// 1秒あたりに変えてよい距離の上限。敵の瞬間移動で一気に引かないための蓋
export const COMBAT_DIST_MAX_SPEED = 0.8;

export function targetDistanceBonus(targetDist, max = COMBAT_DIST_BONUS_MAX){
  if(targetDist == null || !(targetDist >= 0)) return 0;
  if(targetDist <= COMBAT_DIST_NEAR) return 0;
  if(targetDist >= COMBAT_DIST_FAR)  return max;
  const k = (targetDist - COMBAT_DIST_NEAR) / (COMBAT_DIST_FAR - COMBAT_DIST_NEAR);
  return max * k;
}

/* 現在の追加距離を目標へ寄せる。指数追従にレート制限を重ねてあるのは、
   指数追従だけだと「目標が大きく飛んだ最初の一瞬」が速すぎるため。 */
export function stepDistanceBonus(current, target, dt,
                                  rate = COMBAT_DIST_RATE,
                                  maxSpeed = COMBAT_DIST_MAX_SPEED){
  const c = current || 0;
  if(!(dt > 0)) return c;
  const k = 1 - Math.exp(-Math.max(0, rate) * dt);
  let next = c + ((target || 0) - c) * k;
  const cap = Math.max(0, maxSpeed) * dt;
  if(next - c >  cap) next = c + cap;
  if(next - c < -cap) next = c - cap;
  return next;
}

/* =========================================================
   階層別のカメラ(仕様 19)

   将来 強モブ / ネームド / ボス で違うカメラにできる余地だけ残す。
   Chapter 1 では通常敵・強モブ・ネームドを同じ値にしてあり、実際の
   見え方は現在と変わらない ―― 過剰な演出を入れないため。
   ボスは既存の findLockOnBoss() が専用のカメラを持っているので、
   ここは通らない(混ぜない)。
========================================================= */
export const CAMERA_TIER = {
  normal: {distBonusMax: COMBAT_DIST_BONUS_MAX, maxOffset: 1.60},
  elite:  {distBonusMax: COMBAT_DIST_BONUS_MAX, maxOffset: 1.60},
  named:  {distBonusMax: COMBAT_DIST_BONUS_MAX, maxOffset: 1.60},
  // ボスは既存のロックオンカメラが担当する。表に載せてあるのは
  // 「まだ決めていない」と「通らない」を取り違えないため
  boss:   {distBonusMax: COMBAT_DIST_BONUS_MAX, maxOffset: 1.60},
};

export function cameraTierParams(tier){
  return CAMERA_TIER[tier] || CAMERA_TIER.normal;
}
