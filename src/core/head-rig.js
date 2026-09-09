/* Head Rig ―― 首から上の向きだけを扱う純粋な計算。

   これまでプレイヤーの頭は body group 直下の単なるメッシュで、頭・髪・
   帽子・目がそれぞれ独立に置かれていた。そのため「頭だけを回す」と顔と
   髪が分離してしまい、視線という表現そのものが使えなかった ―― 弓師の
   残心で「体は半身のまま、視線だけ敵へ」を作れなかったのはこれが理由。

   ここは three.js にも state にも触らない角度計算だけを持つ。実際の
   ピボット(HeadPivot)の生成とメッシュの付け替えは buildPlayer()、
   毎フレームの適用は 05-rendering-rig.js の updateHeadRig() が行う。

   座標系: 頭は waist の子、waist は player(キャラクター全体)の子。
   つまり頭のワールド向きは

     visualFacing(体の向き) + waist.rotation.y(上半身の捻り) + headYaw

   の合成になる。狙った方向を見るには、体と上半身が既に向いている分を
   差し引いた残りだけを頭に持たせればよい ―― これがそのまま
   「体 → 肩 → 頭」の連動になる。上半身が半身に捻れていれば頭は少し
   戻し、体が正面を向けば頭も自然に正面へ戻る。 */

// 首の可動域(ラジアン)。人間の首はもっと回るが、この頭身では
// 見た目が破綻するより手前で止める方が自然に見える
export const HEAD_LIMITS = {
  yaw: 0.60,     // ±34度
  pitch: 0.30,   // ±17度
  roll: 0.09,    // ±5度
};

/* 首の追従の速さ(1秒あたり)。上半身の追従(updateLocomotion の腰は
   15/秒)より遅くしてある ―― 頭が体より先に目標へ着いてしまうと、
   「体が向いてから頭がついていく」ではなく「頭だけ独立に動く」人形に
   見えるため。逆に遅すぎると視線が置き去りになるので、体のすぐ後ろを
   追う程度に取ってある。 */
export const HEAD_FOLLOW_RATE = 7.0;
// 敵を見失った直後など、目標が消えて正面へ戻る時はさらにゆっくり
export const HEAD_RELEASE_RATE = 3.2;

/* HeadPivot を首のどこに置くか。頭の中心(waist ローカルで
   height + headGap)ではなく、首の付け根との間に取る。

   中心に置くと頭がその場で回るだけで首が無いように見え、逆に付け根
   ちょうどに置くと、この頭身では首の長さぶんの腕(0.27m)で頭が大きく
   振り回されてしまう。間を取ると、わずかに首が傾きながら顔が向く。 */
export const NECK_PIVOT_FRAC = 0.45;
export function neckPivotY(build) {
  return build.height + build.headGap * NECK_PIVOT_FRAC;
}

// -π〜π へ畳む
export function wrapAngle(a) {
  let d = a % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function clampAngle(v, limit) {
  if (!(limit >= 0)) return 0;
  return Math.max(-limit, Math.min(limit, v || 0));
}

export function clampHead(angles, limits) {
  const L = limits || HEAD_LIMITS;
  return {
    yaw: clampAngle(angles.yaw, L.yaw),
    pitch: clampAngle(angles.pitch, L.pitch),
    roll: clampAngle(angles.roll, L.roll),
  };
}

// 目標角へ減衰で近づく(角度は最短経路で)
export function approachAngle(current, target, rate, dt) {
  const k = Math.min(1, Math.max(0, (rate || 0) * (dt || 0)));
  return current + wrapAngle(target - current) * k;
}

// 世界座標で from から to を見る向き(three.js の yaw と同じ取り方)
export function yawToTarget(fromX, fromZ, toX, toZ) {
  return Math.atan2(toX - fromX, toZ - fromZ);
}

/* 見たい世界向きを、頭のローカル yaw へ落とす。
   体と上半身が既に向いている分を差し引いた残りだけが頭の仕事。 */
export function localHeadYaw({ targetYaw, bodyYaw, waistYaw, limits }) {
  const L = limits || HEAD_LIMITS;
  return clampAngle(wrapAngle((targetYaw || 0) - (bodyYaw || 0) - (waistYaw || 0)), L.yaw);
}

/* 高さの差と水平距離から見下ろし/見上げ角。three.js の +X 回転は顔を
   下へ向けるので、目標が下にある(dy<0)ほど正の値になる。
   waistPitch は上半身が既に前傾している分で、これも差し引く。 */
export function localHeadPitch({ dy, dist, waistPitch, limits }) {
  const L = limits || HEAD_LIMITS;
  const d = Math.max(0.2, dist || 0);
  return clampAngle(Math.atan2(-(dy || 0), d) - (waistPitch || 0), L.pitch);
}

/* 目標を持たない時の、生きて見える程度のわずかな首の動き。
   状態ごとに「どれくらい周りを見ているか」が違う ―― 酒場では
   ゆっくり周囲へ視線を送り、探索では進行方向を中心に軽く警戒する。 */
export const IDLE_LOOK = {
  SOCIAL:      { yawAmp: 0.34, yawRate: 0.24, pitchAmp: 0.05, pitchRate: 0.31 },
  EXPLORATION: { yawAmp: 0.20, yawRate: 0.41, pitchAmp: 0.04, pitchRate: 0.53 },
  DEFAULT:     { yawAmp: 0.06, yawRate: 0.60, pitchAmp: 0.02, pitchRate: 0.80 },
};

export function idleLookFor(characterState) {
  return IDLE_LOOK[characterState] || IDLE_LOOK.DEFAULT;
}

/* 目標が無い時の首の向き。単純な正弦ではなく、周期の違う2つを重ねて
   一定の往復に見えないようにしてある。 */
export function idleHeadAngles(characterState, t) {
  const s = idleLookFor(characterState);
  const yaw = (Math.sin(t * s.yawRate) * 0.7 + Math.sin(t * s.yawRate * 2.3 + 1.1) * 0.3) * s.yawAmp;
  const pitch = Math.sin(t * s.pitchRate + 0.6) * s.pitchAmp;
  return { yaw, pitch, roll: yaw * 0.12 };
}
