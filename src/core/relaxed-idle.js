/* 非戦闘時の待機(Exploration / Social Idle)の純粋計算。
   state・three.js・シーンに一切依存しないので tests/unit/ から直接呼べる
   (core/combat-stance.js と同じ切り出し方)。

   ■ なぜ Combat Idle と別ファイルなのか
   調査の結果、この実装には「非戦闘時の立ち姿」というものが**存在しな
   かった**。buildPlayer() が腕の基準姿勢 armLBase/armRBase/elbowLBase を
   activeStance()(= 戦闘の構え)から複製しており、更に updateLocomotion は
   停止中 swing=0 になるため、腕・肘・脚・膝へ書く値がすべて基準姿勢
   そのものになる ―― つまり酒場でも探索でも、キャラクターは戦闘の構えの
   まま1ミリも動かずに立っていた。動いていたのは呼吸(胴体スケール)・
   全身の上下(bob)・腰のごく小さな傾き/横移動の4つだけで、腕も武器も
   完全に固定だった。

   ここで足すのはその欠けていた1段だけで、Combat Idle の設計には触れない。
   同じファイルへ書くと「Combat Idle を弱めたもの」に寄っていきやすいので、
   最初から別ファイルにしてある ―― 両者は別物として設計する:

     Combat Idle   : 構えたまま止まらない。武器を敵へ向けたまま動く
     Relaxed Idle  : 構えを解いて力を抜く。武器は下がり、重心が片側へ寄る

   ■ 揺れの計算そのものは Combat Idle と共有する
   combatIdleOffsets() は「プロファイル(振幅の表)と位相をもらって、
   加算値を返す」だけの関数で、戦闘専用の判断を何も持っていない。
   非戦闘側で同じ式を使い回せば、周期の取り方・fps 非依存性・
   チャンネルの意味がそのまま揃う ―― 新しい揺れの仕組みは増やさない。 */

import { combatIdleOffsets, withJobPostureBias } from './combat-stance.js';

/* 非戦闘の揺れの振幅。チャンネルの意味は CLASS_IDLE と同じで、
   値だけが別(すべて戦闘時より小さく、そして遅い)。

     sway   : 重心の左右移動(腰の roll + 横移動)
     breath : 呼吸で上体がわずかに起きる/沈む
     weapon : 武器を持つ側の肩・肘
     rate   : 周期の倍率。小さいほどゆっくり
     crouch : 腰を落とす量。非戦闘では 0 ―― 沈み込みは戦闘の構えの印
     handL  : 空いている手(肩)。combat-stance.js の opt-in チャンネル
     wrist  : 武器を握る手首。同上

   handL / wrist は combatIdleOffsets が「プロファイルが持っていれば出す」
   任意チャンネルなので、ここで全職に持たせても Combat Idle 側(archmage
   以外は持たない)の計算は一切変わらない。

   設計の指示「Exploration Idle < Combat Idle < Attack」を数値で守るため、
   sway / breath / weapon / rate はすべて CLASS_IDLE の対応値より小さい。
   tests/unit/relaxed-idle.test.js がこの大小関係を固定している。 */
export const CLASS_RELAXED_IDLE = {
  // 剣士: 大剣の重さを腕と肩が受けている。ゆっくり、大きくは動かない
  warrior: {sway:0.018, breath:0.012, weapon:0.013, rate:0.62, crouch:0,
            handL:0.009, wrist:0.005},
  // 盗賊: 脱力しているが手数は速い。周期だけは4職で一番速い
  rogue:   {sway:0.016, breath:0.011, weapon:0.016, rate:0.95, crouch:0,
            handL:0.010, wrist:0.006},
  // 魔法使い: 考えながら待っている。呼吸が主で、杖はほとんど動かない
  mage:    {sway:0.008, breath:0.014, weapon:0.012, rate:0.48, crouch:0,
            handL:0.008, wrist:0.005},
  // 弓師: 射手の癖。上体は静かで、動くのは重心と弓を提げた手だけ
  archer:  {sway:0.011, breath:0.009, weapon:0.008, rate:0.72, crouch:0,
            handL:0.007, wrist:0.004},
};

/* 上位職の上乗せ。基礎職の非戦闘プロファイルへ倍率で乗せるだけなので、
   将来キーを足せば8職ぶんの差別化を続けられる(Combat Idle 側の
   JOB_IDLE_MUL と同じ作法)。 */
export const JOB_RELAXED_MUL = {
  battleKnight: {sway:0.65, breath:0.90, rate:0.85},   // 重厚。ほとんど揺れない
  berserker:    {sway:1.25, breath:1.15, rate:1.10},   // 呼吸が一番荒い
  archmage:     {sway:0.70, weapon:0.80, rate:0.85},   // 静か。杖を持て余さない
  hawkEye:      {sway:0.70, rate:0.90},                // 観察している。動かない
};

export function relaxedIdleProfile(classKey, jobKey){
  const base = CLASS_RELAXED_IDLE[classKey] || CLASS_RELAXED_IDLE.warrior;
  const mul = JOB_RELAXED_MUL[jobKey];
  if(!mul) return Object.assign({}, base);
  return {
    sway:   base.sway   * (mul.sway   || 1),
    breath: base.breath * (mul.breath || 1),
    weapon: base.weapon * (mul.weapon || 1),
    rate:   base.rate   * (mul.rate   || 1),
    crouch: base.crouch * (mul.crouch || 1),
    handL:  base.handL  * (mul.handL  || 1),
    wrist:  base.wrist  * (mul.wrist  || 1),
  };
}

/* 非戦闘の待機ターゲットの組み立て。

   buildCombatIdleTarget() と同じ形で「構え + 揺れ」を返すが、違いが3つある:

     1. 土台が STANCE ではなく STANCE_RELAXED(力を抜いた立ち姿)
     2. settleBoost(振り終わり直後の上乗せ)を取らない ―― 非戦闘には
        「振り終わった直後」が無い
     3. drop を常に 0 にする ―― 腰を落とすのは構えの印なので、
        非戦闘で沈ませると結局「戦闘態勢の弱い版」に見える

   戻り値の形(target / idle)は buildCombatIdleTarget と揃えてある。
   呼び出し側(05-rendering-rig.js)が2つを同じ手順で混ぜられるようにする
   ため ―― クロスフェードの実装を分岐だらけにしないための取り決め。 */
export function buildRelaxedIdleTarget(stance, profile, phase, weight, jobKey){
  const idle = combatIdleOffsets(phase, profile, weight, 1);
  const out = Object.assign({}, stance);
  out.waist = [stance.waist[0] + idle.waistPitch, stance.waist[1], stance.waist[2] + idle.waistRoll];
  /* 武器を持つ側。手首(wristSway)は肩の roll へ載せる ―― この実装に
     手首ピボットは無く、前腕から先を捻る一番近いチャンネルがここ。
     Combat Idle の魔導士と同じ扱いにしてあるので、見え方の理屈が揃う。 */
  out.shR = [stance.shR[0] + idle.weaponSway, stance.shR[1],
             stance.shR[2] + (idle.wristSway || 0)];
  /* 空いている手は武器側の巻き添えではなく、独立した位相で動く。
     力が抜けている手は武器の揺れに同調しない ―― そこが「構えている」
     との違いとして読めるので、非戦闘では全職にこのチャンネルを持たせる。 */
  out.shL = [stance.shL[0] - idle.weaponSway*0.25 + (idle.handSway || 0),
             stance.shL[1], stance.shL[2]];
  out.elR = stance.elR + idle.elbowSway;
  out.elL = stance.elL - idle.elbowSway*0.25 + (idle.handElbowSway || 0);
  out.drop = 0;   // 非戦闘では腰を落とさない(上記3)
  /* 恒久バイアス(バーサーカーの前傾と低い膝)はここでも載せ直す。
     この関数は姿勢を絶対値で当てるので、載せないと歩行側が書いた分を
     消してしまう ―― Combat Idle で実際に起きた事故と同じ理屈。
     これは「戦闘の構え」ではなくそのキャラクターの常時のシルエットなので、
     非戦闘でも維持するのが正しい。 */
  return { target: withJobPostureBias(out, jobKey), idle };
}

/* Relaxed ↔ Combat のクロスフェード速度(1/秒、指数追従)。
   1-exp(-k*t) なので、k=4.5 なら約 0.67 秒で 95% まで寄る ――
   指示の「0.5〜0.8秒程度」に収まる。戦闘態勢が切れる側は、これに加えて
   combatStanceWeight の smoothstep(0.75秒)も掛かるので更に緩やかになる。 */
export const REST_BLEND_RATE = 4.5;

/* 移動 ↔ 停止 の追従速度。構えの切り替えより少しだけ速い ―― 歩き出しは
   本人の意思なので、戦闘態勢が抜けるときのようにためらう理由が無い。
   k=6.0 で約 0.50 秒。 */
export const REST_STOP_RATE = 6.0;

/* dt に依存しない収束率。updateLocomotion / look-rig の followValue と
   同じ形(1-exp(-k*dt))で、フレームレートが変わっても寄る速さが変わらない。 */
export function stepRestBlend(current, target, dt, rate = REST_BLEND_RATE){
  if(!(dt > 0)) return current;
  const k = 1 - Math.exp(-Math.max(0, rate) * dt);
  return current + (target - current) * k;
}
