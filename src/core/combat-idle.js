/* 立ち姿の上に足す、ごく小さな揺れ ―― 戦闘中の Combat Idle と、
   酒場・探索中の何気ない立ち方の両方をここが持つ。

   ================ Combat Idle ================
   「戦闘中だが、次の行動を選んでいる状態」

   構え(core/combat-stances.js)はあくまで1枚の静止ポーズなので、それを
   そのまま出すと、敵を前にした人物が置き物のように固まって見える。かと
   いって大きく動かすと、今度は攻撃の予備動作と区別がつかなくなる。

   ここが持つのは、その構えの上に足すごく小さな揺れだけ。振幅はすべて
   0.03rad(約1.7度)以下 ―― 見て「動いている」と分かるより先に「生きて
   いる」と感じる程度に抑えてある。跳ね続けるアイドルにしないため、
   上下動(bob)には一切触らない(あれは updateLocomotion の呼吸が持つ)。

   職業ごとの個性は「何を動かすか」で出す:

     warrior  Weight  遅い。肩と重心がゆっくり移り、大剣が一拍遅れて追う
     rogue    Reflex  速い。膝と重心がこまめに入れ替わる。上体は固めない
     mage     Focus   体は動かさない。敵を捉えている左手だけが微調整する
     archer   Aim     半身と弓手はほぼ静止。引き手と弦の張りだけが息づく

   武器の揺れ(wep)は「目標の向き」への上乗せとして使う ―― 実際の武器は
   職業ごとの追従速度(05-rendering-rig.js の WEAPON_FOLLOW_RATE)で
   遅れて付いてくるので、剣士の大剣ほど大きく遅れる。「重い＝ゆっくり
   動かす」ではなく「動かした結果として遅れて付いてくる」を作るための
   分担で、ここでは速度を落としていない。 */

export const COMBAT_IDLE = {
  // 遅く、大きく、安定。重心が左右へゆっくり移り、大剣がそれを追う
  warrior: {
    rate: 0.85,
    shoulder: 0.020, shoulderPhase: 0.35,
    elbow: 0.013,
    waistPitch: 0.010, waistRoll: 0.013, waistYaw: 0.009,
    hip: 0.008, knee: 0.011,
    wepYaw: 0.020, wepPitch: 0.016,
    draw: 0,
  },
  // 速く、小さく、低い。膝と重心がこまめに入れ替わる
  rogue: {
    rate: 1.75,
    shoulder: 0.015, shoulderPhase: 1.9,
    elbow: 0.019,
    waistPitch: 0.007, waistRoll: 0.019, waistYaw: 0.012,
    hip: 0.013, knee: 0.023,
    wepYaw: 0.017, wepPitch: 0.012,
    draw: 0,
  },
  // 体はほとんど動かさない。敵を捉えている左手側だけが微調整を続ける
  mage: {
    rate: 1.25,
    shoulder: 0.013, shoulderPhase: 2.6,
    elbow: 0.024,
    waistPitch: 0.005, waistRoll: 0.006, waistYaw: 0.005,
    hip: 0.003, knee: 0.005,
    wepYaw: 0.013, wepPitch: 0.011,
    draw: 0,
  },
  // 弓手と半身は据えたまま。引き手と弦の張りだけが息づく
  archer: {
    rate: 1.05,
    shoulder: 0.009, shoulderPhase: 3.0,
    elbow: 0.015,
    waistPitch: 0.005, waistRoll: 0.007, waistYaw: 0.006,
    hip: 0.010, knee: 0.008,
    wepYaw: 0.010, wepPitch: 0.009,
    draw: 0.030,          // 弦の張りがわずかに上下する(引き切りはしない)
  },
};

// どの職業でも、これを超える揺れは Combat Idle ではなく予備動作に見える
export const IDLE_MAX_AMPLITUDE = 0.030;

/* 上位職の専用プロファイル。基礎職の型をそのまま使う職は書かない
   (書かなければ自動的に基礎職を継承する)。

   魔導士(archmage)= Control。魔法使いの Focus は「敵に集中している」
   だったが、魔導士は「強い力を余裕を持って制御している」方向にする。
   だから速くしない ―― むしろ4職+上位職の中でいちばん遅い。

     速さ      1.25 → 0.75   魔法使いより明確に遅い
     肩        0.013 → 0.008 最小。上体はほとんど動かさない
     肘        0.024 → 0.020 左手の制御だけは残す
     重心      魔法使いの約6割(waistRoll 0.006 → 0.0035)
     杖(左右) 0.013 → 0.024 大きな杖をゆっくり大きく振る振り子

   杖の上下(wepPitch)だけは魔法使いより小さくしてある。魔弾は杖頭から
   出て水平に飛び、当たり判定は敵の足元との高さの差 1.8m 未満で見ている
   ―― 上位職は武器が 1.32 倍に拡大されるため杖頭が 1.78m まで上がって
   おり、窓まで 2cm しか残っていない(実測)。左右の振りは高さを変えない
   ので大きく取れるが、上下方向は動かす余地がない。
   tests/unit/mage-lord-idle.test.js が「揺れが杖頭を持ち上げないこと」を、
   tests/unit/stance-geometry.test.js が構え側の高さを固定している。 */
export const JOB_COMBAT_IDLE = {
  archmage: {
    rate: 0.75,
    shoulder: 0.008, shoulderPhase: 2.6,
    elbow: 0.020,
    waistPitch: 0.003, waistRoll: 0.0035, waistYaw: 0.003,
    hip: 0.002, knee: 0.003,
    wepYaw: 0.024, wepPitch: 0.006,
    draw: 0,
  },
};

export function combatIdleProfile(classKey, job) {
  return JOB_COMBAT_IDLE[job] || COMBAT_IDLE[classKey] || COMBAT_IDLE.warrior;
}

/* 位相の違う2つの正弦を重ねる。1つだけだと一定の往復に見え、
   ランダムにすると「震えている」ように見えるため。 */
function wave(t, rate, phase) {
  return Math.sin(t * rate + phase) * 0.72
       + Math.sin(t * rate * 1.63 + phase * 1.7 + 0.9) * 0.28;
}

/* 構えへ足す差分。amount は 0〜1 で、歩き出すと 0 へ落ちる
   (歩行サイクルが腕を振り始めたら、その上に揺れを重ねない)。 */
export function combatIdleOffsets(classKey, t, amount, job) {
  return offsetsFromProfile(combatIdleProfile(classKey, job), t, amount);
}

function offsetsFromProfile(p, t, amount) {
  const a = Math.max(0, Math.min(1, amount === undefined ? 1 : amount));
  if (a <= 0) {
    return { shLx: 0, shRx: 0, elL: 0, elR: 0, waistPitch: 0, waistRoll: 0,
             waistYaw: 0, hipL: 0, hipR: 0, kneeL: 0, kneeR: 0,
             wepYaw: 0, wepPitch: 0, draw: 0 };
  }
  const w0 = wave(t, p.rate, 0);
  const wL = wave(t, p.rate, p.shoulderPhase);
  const wR = wave(t, p.rate, p.shoulderPhase + Math.PI);
  const wSlow = Math.sin(t * p.rate * 0.41 + 0.3);      // 重心の移り(ゆっくり)
  return {
    shLx: wL * p.shoulder * a,
    shRx: wR * p.shoulder * a,
    elL: wL * p.elbow * a,
    elR: wR * p.elbow * a,
    waistPitch: w0 * p.waistPitch * a,
    waistRoll: wSlow * p.waistRoll * a,
    waistYaw: wSlow * p.waistYaw * a,
    // 重心が乗っている方の脚が伸び、反対の膝がゆるむ
    hipL: wSlow * p.hip * a,
    hipR: -wSlow * p.hip * a,
    kneeL: (0.5 - wSlow * 0.5) * p.knee * a,
    kneeR: (0.5 + wSlow * 0.5) * p.knee * a,
    // 武器は身体の動きより一拍あとに効かせたいので、位相を少し遅らせる
    wepYaw: wave(t, p.rate, -0.55) * p.wepYaw * a,
    wepPitch: wave(t, p.rate, -0.9) * p.wepPitch * a,
    draw: (0.5 + w0 * 0.5) * p.draw * a,
  };
}

/* 攻撃・回避を終えた直後の「収まり」。

   クリップの最後のフレームは構えそのものなので、関節の値としては
   既に滑らかに繋がっている ―― けれど、そこで止まると「振り切った反動が
   どこへも行かない」不自然さが残る。ここは振り抜いた勢いが抜けていく
   減衰振動を、構えの上に一時的に足すためのもの。

   肩と武器の両方へ同じ振動を足すが、武器はさらに職業ごとの追従速度
   (WEAPON_FOLLOW_RATE)を通るので必ず遅れて動く。結果として

     斬撃 → 肩・腕が戻る → 大剣が追って収まる

   という順に見える。剣士はいちばん長く尾を引き、盗賊はほとんど残さない。 */
export const ATTACK_SETTLE = {
  warrior: { dur: 0.46, amp: 2.6, rate: 8.5 },   // 大剣。振り切った勢いが長く残る
  rogue:   { dur: 0.20, amp: 1.4, rate: 17.0 },  // 双短剣。手首で止まり、すぐ次へ
  mage:    { dur: 0.32, amp: 1.7, rate: 11.0 },  // 杖を戻し、左手が敵へ戻る
  archer:  { dur: 0.36, amp: 1.9, rate: 10.0 },  // 弦を放った反動が上体へ抜ける
};

/* 魔導士は攻撃後に大きく反動を取らない。魔法使いより振幅を落とし、
   代わりに長くゆっくり収束させる ―― 「勢いを持て余している」のではなく
   「出した力を収めている」ように見せるため。 */
export const JOB_ATTACK_SETTLE = {
  archmage: { dur: 0.42, amp: 1.1, rate: 7.0 },
};

export function attackSettleProfile(classKey, job) {
  return JOB_ATTACK_SETTLE[job] || ATTACK_SETTLE[classKey] || ATTACK_SETTLE.warrior;
}

/* 経過秒 t に対する減衰の強さ(0〜1)。dur を過ぎたら 0。 */
export function attackSettleAmount(classKey, t, job) {
  const p = attackSettleProfile(classKey, job);
  if (!(t >= 0) || t >= p.dur) return 0;
  const k = 1 - t / p.dur;
  return k * k;                 // 終わりに向けてなめらかに消える
}

/* 収まりの差分。combatIdleOffsets と同じ形なので、そのまま足し合わせられる。 */
export function attackSettleOffsets(classKey, t, job) {
  const p = attackSettleProfile(classKey, job);
  const a = attackSettleAmount(classKey, t, job);
  if (a <= 0) return combatIdleOffsets(classKey, 0, 0, job);
  const idle = combatIdleProfile(classKey, job);
  const osc = Math.sin(t * p.rate) * a * p.amp;
  return {
    shLx: osc * idle.shoulder,
    shRx: osc * idle.shoulder,
    elL: osc * idle.elbow * 0.7,
    elR: osc * idle.elbow * 0.7,
    waistPitch: osc * idle.waistPitch,
    waistRoll: osc * idle.waistRoll * 0.6,
    waistYaw: osc * idle.waistYaw * 0.6,
    hipL: osc * idle.hip * 0.5,
    hipR: -osc * idle.hip * 0.5,
    kneeL: Math.abs(osc) * idle.knee,
    kneeR: Math.abs(osc) * idle.knee,
    wepYaw: osc * idle.wepYaw * 1.4,
    wepPitch: osc * idle.wepPitch * 1.4,
    draw: 0,
  };
}

/* ================ 酒場 / 探索の立ち方 ================

   戦闘の構えと違い、こちらは「構えていない人間がただ立っている」ことを
   見せる。姿勢そのものの差(腕の下ろし方・膝・前傾)は
   core/motion-poses.js の social / explore が持っていて、ここはその上に
   乗る重心の移り方だけ。

   酒場ほど大きく・ゆっくり体重を移し替え、探索では小さく・こまめに
   周囲を気にする ―― 同じ立ち方でも、この差だけで「くつろいでいる人」と
   「警戒している冒険者」に見える。首の動き(core/head-rig.js の
   IDLE_LOOK)も同じ方向で差を付けてある。 */
export const AMBIENT_IDLE = {
  SOCIAL: {
    rate: 0.55,
    shoulder: 0.022, shoulderPhase: 0.8,
    elbow: 0.014,
    waistPitch: 0.011, waistRoll: 0.019, waistYaw: 0.010,
    hip: 0.015, knee: 0.017,
    wepYaw: 0.006, wepPitch: 0.005,
    draw: 0,
  },
  EXPLORATION: {
    rate: 0.95,
    shoulder: 0.013, shoulderPhase: 1.4,
    elbow: 0.009,
    waistPitch: 0.008, waistRoll: 0.011, waistYaw: 0.015,
    hip: 0.010, knee: 0.011,
    wepYaw: 0.005, wepPitch: 0.004,
    draw: 0,
  },
};

/* その状態で使う揺れの型。戦闘まわりは職業ごと、酒場・探索は状態ごと
   (くつろぎ方に職業差を付けても読み取れないため、共通にしてある)。 */
export function idleProfileFor(characterState, classKey, job) {
  const ambient = AMBIENT_IDLE[characterState];
  return ambient || combatIdleProfile(classKey, job);
}

export function idleOffsetsFor(characterState, classKey, t, amount, job) {
  return offsetsFromProfile(idleProfileFor(characterState, classKey, job), t, amount);
}
