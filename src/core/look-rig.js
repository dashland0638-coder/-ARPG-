/* Eye Rig / Visual Look Offset の純粋計算。
   state・three.js・シーンに一切依存しないので tests/unit/ から直接呼べる
   (core/combat-stance.js などと同じ切り出し方)。

   ■ 何をする関数群か
   「どこを見ているか」という1つの角度を、身体の各部位へ配分する。
   視線だけがぬるりと動く不自然さを避けるため、配分は必ず

       target
        → body(stance)との差分
        → waist(体幹)
        → final waist との差分
        → head(頭)
        → 残りを eyes(目)

   の順に流す。上流で吸収し切れなかったぶんだけが下流へ落ちるので、
   小さく目を向けるだけの時は目しか動かず、大きく振り向く時は体幹から
   ついてくる ―― 同じ1本の式で両方が出る。

   ■ 可動域(設計値)
     目   : yaw ±10°, pitch ±7°、追従 16/s、見失っても 0.45 秒は保持
     頭   : yaw ±38°, pitch ±20°
     体幹 : 24° のデッドゾーンを超えたぶんの 45% を反映し、
            ±12.6° × 職業係数 でクランプ。pitch は ±5° × 職業係数
   職業係数は「どれだけ体幹で見るか」の性格付け:
     盗賊 0.60(体を開かない) / 剣士 0.70 / 弓師 0.80 / 魔法使い 1.00。
   魔法使いだけ pitch 係数を 0 にしてある ―― 杖を構えた上体を上下に
   振ると詠唱の姿勢が崩れて見えるため。 */

const DEG = Math.PI / 180;

export const EYE_YAW_LIMIT    = 10 * DEG;
export const EYE_PITCH_LIMIT  =  7 * DEG;
export const EYE_FOLLOW_SPEED = 16;      // 1/s(指数追従)
export const EYE_LINGER_SEC   = 0.45;    // 対象を見失ってから視線を戻すまで

export const HEAD_YAW_LIMIT   = 38 * DEG;
export const HEAD_PITCH_LIMIT = 20 * DEG;

export const WAIST_DEAD_ZONE    = 24 * DEG;
export const WAIST_EXCESS_RATIO = 0.45;
export const WAIST_YAW_CAP      = 12.6 * DEG;
export const WAIST_PITCH_CAP    =  5   * DEG;

// 体幹をどれだけ使うか(クラス)。上位職は基礎職の値を引き継ぐ
export const CLASS_WAIST_COEF = { rogue:0.60, warrior:0.70, archer:0.80, mage:1.00 };
// 体幹の pitch 係数。魔法使いだけ 0(上の設計メモ参照)
export const CLASS_WAIST_PITCH_COEF = { rogue:0.60, warrior:0.70, archer:0.80, mage:0 };

/* 頭をどれだけ回してよいか(上位職)。
   バーサーカー/魔導士/鷹の目の被り物・髪・髭は applyJobPromotionVisual()
   が頭ピボットへ載せているので、基礎職と同じく制限なし(= 表に載せない)。

   戦騎士だけ 0。あの職は頭身を詰めるために頭ピボット自体へ 0.86 の scale を
   掛けており、同じピボットへ兜を載せると兜まで二重に縮む。そのため兜は
   waist に残してあり、頭だけ回すと兜の中で素頭が回ってしまう。全面を覆う
   兜で頭の回転はそもそも見えない職なので、体幹と目だけで見る。 */
export const JOB_HEAD_LOOK_MUL = {
  battleKnight: 0,     // 全面を覆う兜。兜だけ waist に残っている(上記)
};

export function waistCoefFor(classKey){
  const c = CLASS_WAIST_COEF[classKey];
  return c != null ? c : CLASS_WAIST_COEF.warrior;
}
export function waistPitchCoefFor(classKey){
  const c = CLASS_WAIST_PITCH_COEF[classKey];
  return c != null ? c : CLASS_WAIST_PITCH_COEF.warrior;
}
export function headMulFor(jobKey){
  const m = JOB_HEAD_LOOK_MUL[jobKey];
  return m != null ? m : 1;
}

/* 角度を [-π, π] へ畳む。これを通さないと、北を跨いだ瞬間に
   「差分 350°」を見て身体が逆向きに一回転する。 */
export function normalizeAngle(a){
  return ((a + Math.PI) % (Math.PI*2) + Math.PI*2) % (Math.PI*2) - Math.PI;
}

export function clampAbs(v, limit){
  if(!(limit > 0)) return 0;
  return v > limit ? limit : (v < -limit ? -limit : v);
}

/* 体幹の振り分け。デッドゾーンの内側では体幹はまったく動かない ――
   少し目を向けただけで胴が回り出すと、立っているだけで落ち着きが無くなる。
   超えたぶんの 45% だけを、上限つきで反映する。 */
export function waistLookYaw(delta, coef, opts){
  const o = opts || {};
  const dead = o.deadZone != null ? o.deadZone : WAIST_DEAD_ZONE;
  const ratio = o.ratio != null ? o.ratio : WAIST_EXCESS_RATIO;
  const cap = (o.cap != null ? o.cap : WAIST_YAW_CAP) * (coef != null ? coef : 1);
  const d = normalizeAngle(delta);
  const excess = Math.abs(d) - dead;
  if(excess <= 0) return 0;
  return clampAbs(Math.sign(d) * excess * ratio, cap);
}

/* 体幹の pitch。yaw と違い、見上げ/見下ろしは元々小さい角度しか出ない
   (敵は同じ地面に立っている)ので、デッドゾーンは設けず比率と上限だけ。 */
export function waistLookPitch(deltaPitch, coef, opts){
  const o = opts || {};
  const ratio = o.ratio != null ? o.ratio : WAIST_EXCESS_RATIO;
  const cap = (o.cap != null ? o.cap : WAIST_PITCH_CAP) * (coef != null ? coef : 1);
  return clampAbs((deltaPitch || 0) * ratio, cap);
}

/* 視線の配分。冒頭の look chain をそのまま式にしたもの。
   戻り値はすべて「体の向きを基準にしたローカル角(ラジアン)」で、
   waist / head / eyes へそのまま加算できる。 */
export function distributeLook(opts){
  const {
    targetYaw = 0, bodyYaw = 0, targetPitch = 0,
    classKey = 'warrior', jobKey = null, weight = 1,
  } = opts || {};

  const w = Math.max(0, Math.min(1, weight));
  const dYaw = normalizeAngle(targetYaw - bodyYaw);
  const dPitch = targetPitch;

  // 1. 体幹が引き受けるぶん
  const waistYaw = waistLookYaw(dYaw, waistCoefFor(classKey));
  const waistPitch = waistLookPitch(dPitch, waistPitchCoefFor(classKey));

  /* 2. 残りを目と頭で分ける。

     引き継ぎ資料の chain は「waist → head → 残りを eyes」と書かれているが、
     これを字義どおり「頭が可動域いっぱいまで先に吸い、余りを目へ」と
     実装すると、頭の可動域(±38°)の内側では目がまったく動かない ――
     Eye Rig を入れる意味そのものが無くなる(実測: 15°を見ると頭だけが
     15°回り、目は中心のまま)。

     人間は小さく見る時はまず目が動き、目の可動域を超えたところから
     頭がついてくる。そこで「目に ±10° のリードを与え、その先を頭が
     引き受ける」形にした。角度が大きい領域では目は上限に張り付き、
     残りはすべて頭 ―― つまり資料の chain と同じ結果になる。
     違いが出るのは小さく見る領域だけで、そこは目が動くのが正しい。 */
  const headMul = headMulFor(jobKey);
  const remYaw = dYaw - waistYaw;
  const remPitch = dPitch - waistPitch;
  const eyeLeadYaw = clampAbs(remYaw, EYE_YAW_LIMIT);
  const eyeLeadPitch = clampAbs(remPitch, EYE_PITCH_LIMIT);
  const headYaw = clampAbs(remYaw - eyeLeadYaw, HEAD_YAW_LIMIT * headMul);
  const headPitch = clampAbs(remPitch - eyeLeadPitch, HEAD_PITCH_LIMIT * headMul);

  // 3. 頭が引き受けた後に残ったぶんが目の最終値(上限は超えない)
  const eyeYaw = clampAbs(remYaw - headYaw, EYE_YAW_LIMIT);
  const eyePitch = clampAbs(remPitch - headPitch, EYE_PITCH_LIMIT);

  return {
    waistYaw: waistYaw*w, waistPitch: waistPitch*w,
    headYaw: headYaw*w,   headPitch: headPitch*w,
    eyeYaw: eyeYaw*w,     eyePitch: eyePitch*w,
  };
}

/* 指数追従。dt に依存しない収束率にするため 1-exp(-speed*dt) を使う
   (1-k^dt と同じ形。フレームレートが変わっても追従の速さが変わらない)。 */
export function followAngle(current, target, speed, dt){
  if(!(dt > 0)) return current;
  const k = 1 - Math.exp(-Math.max(0, speed) * dt);
  return current + normalizeAngle(target - current) * k;
}

export function followValue(current, target, speed, dt){
  if(!(dt > 0)) return current;
  const k = 1 - Math.exp(-Math.max(0, speed) * dt);
  return current + (target - current) * k;
}

/* 対象を見失ってからの保持。見た瞬間に満タンへ戻し、いなくなったら
   0.45 秒かけて切れる。「敵が物陰へ入った瞬間に視線が正面へ戻る」のを
   防ぐためのもので、そのまま Combat Idle のウェイトのように使える。 */
export function stepLookLinger(prevT, dt, hasTarget, linger = EYE_LINGER_SEC){
  if(hasTarget) return linger;
  return Math.max(0, (prevT || 0) - (dt || 0));
}

export function lingerWeight(t, linger = EYE_LINGER_SEC){
  if(!(t > 0)) return 0;
  if(!(linger > 0)) return 1;
  const k = Math.min(1, t / linger);
  return k*k*(3 - 2*k);
}

/* 探索中に誰も見る相手がいない時の「見回し」。
   一定の周期でゆっくり左右を見るだけの、身体の向きからの相対角。
   振幅は目の可動域の内側に収めてあるので、体幹も頭もほとんど動かない
   ―― 歩いているだけで胴が揺れ続けるのを避けるため。 */
export const SCAN_PERIOD = 5.2;
export const SCAN_AMPLITUDE = 9 * DEG;

export function scanYaw(t, period = SCAN_PERIOD, amplitude = SCAN_AMPLITUDE){
  // 正弦2本を重ねて、行ったり来たりの単調さを崩す
  const a = Math.sin(t * (Math.PI*2/period));
  const b = Math.sin(t * (Math.PI*2/(period*0.37)) + 1.1);
  return (a*0.78 + b*0.22) * amplitude;
}
