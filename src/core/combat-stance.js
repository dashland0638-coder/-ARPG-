/* Combat Idle と「攻撃後の自然なreturn」の純粋計算。
   state・three.js・シーンに一切依存しないので tests/unit/ から直接
   呼べる(core/swing-timing.js などと同じ切り出し方。ARCHITECTURE.md
   「core/damage-math.js と同じ考え方」の章を参照)。

   ■ 解析で実際に分かったこと(最初の見立ての訂正を含む)
   当初は「攻撃クリップが終わった瞬間に構えから休め姿勢へ1フレームで
   飛んでいる」と考えたが、コードを追うとそうではなかった。
   buildPlayer()(06-player-enemy.js)は腕の基準姿勢 armLBase/armRBase/
   elbowLBase を **activeStance() の構えそのもの** から取っており
   (「class stance, straight out of the choreography table」のブロック)、
   クリップの終端フレームも同じ構え(F(1.00, S(cls)))。つまり姿勢の
   不連続は元々起きていない。

   実際の問題は**時間**の方だった。剣士はクリップ 0.36 秒に対し攻撃CDが
   0.52 秒あり(swingGapSeconds() がこの差を返す)、連打していても毎回
   0.16 秒、構えたまま完全に静止した状態が挟まる。applyCombatPose() は
   この間、何のポーズも当てていない ―― 動いているのは updateLocomotion()
   の歩行サイクルだけで、立ち止まって連打していればそれもほぼ止まる。
   「一撃ごとに止まって見える」の実体はこの静止であって、ポーズの飛びではない。

   そこでここでは次の3つを数値として提供する:
     1. combatStanceWeight ―― 戦闘態勢の残り時間から求める適用ウェイト。
        攻撃・被弾・敵の接近で更新され、切れる時はフェードで抜ける。
     2. combatIdleOffsets ―― 構えたまま完全停止させないための微細な揺れ。
        重心移動・呼吸・武器の揺れを職業ごとの係数で出し分ける。
        上の「静止した 0.16 秒」を、止まった絵ではなく息をしている絵にする。
     3. settleBoost ―― 振り終わった直後だけ揺れの振幅を大きくし、
        attack → recovery → next attack という流れを作る。一撃ごとに
        ぴたりと同じ構えへ戻り切るのではなく、まだ身体が収まっていない
        ところへ次の一撃が入る。

   「攻撃間隔そのものを詰める」ことはここではやらない ―― クリップ長と
   atkCooldown を動かすのは DPS を含む戦闘バランスの変更で、影響範囲が
   別物になる(ARPG_INTEGRATION.md の PHASE 5-2 の順序を参照)。

   いずれも「既存ポーズへの加算値」しか返さない。クリップ(CLIPS)にも
   STANCE にも触れないので、攻撃・スキル・必殺技の型は一切変わらない。 */

// 攻撃/被弾のあと、この秒数だけ戦闘態勢を保つ
export const COMBAT_STANCE_HOLD = 2.6;
// 態勢が切れる最後のこの秒数をフェードに使う(0.75秒かけて休め姿勢へ戻る)
export const COMBAT_STANCE_FADE = 0.75;

/* 戦闘態勢の残り時間 → ポーズ適用ウェイト(0..1)。
   残り時間がフェード幅より長い間は 1(完全に構える)、
   フェード区間に入ると滑らかに 0 へ落ちる。smoothstep を通すのは、
   線形だと抜け際に「カクッ」と速度が変わって見えるため。 */
export function combatStanceWeight(remainT, fade = COMBAT_STANCE_FADE){
  if(!(remainT > 0)) return 0;
  if(!(fade > 0)) return 1;
  const k = Math.min(1, remainT / fade);
  return k*k*(3 - 2*k);
}

/* 戦闘態勢タイマーの更新。攻撃・被弾・敵接近のたびに呼び、
   「今より短くはならない」形で伸ばす(複数の理由が重なっても
   一番長いものが残る)。 */
export function refreshCombatStance(currentT, hold = COMBAT_STANCE_HOLD){
  const c = currentT > 0 ? currentT : 0;
  return Math.max(c, hold > 0 ? hold : 0);
}

/* 職業ごとの「構えたままの居ずまい」。
   資料の要求は「剣士/盗賊/魔法使い/弓師で重心・視線・攻撃前後の姿勢に
   差を出す」。ここは重心(sway)・呼吸(breath)・武器の揺れ(weapon)・
   周期(rate)・腰を落とす量(crouch)の5つで表現する:
     warrior : 大剣の重さ。ゆっくり大きく重心が移る
     rogue   : 細かく速い。いつでも跳べる小刻みな重心
     mage    : ほぼ静止。呼吸と杖の浮遊感だけが動く
     archer  : 上体は静止、下半身だけが微調整(狙いを外さない)
   上位職は基礎職の係数を土台に倍率で乗せるだけなので、将来
   JOB_IDLE_MUL にキーを足せば差別化を続けられる。 */
export const CLASS_IDLE = {
  warrior: {sway:0.030, breath:0.016, weapon:0.022, rate:0.85, crouch:0.020},
  rogue:   {sway:0.020, breath:0.013, weapon:0.030, rate:1.55, crouch:0.030},
  mage:    {sway:0.010, breath:0.020, weapon:0.026, rate:0.62, crouch:0.004},
  archer:  {sway:0.014, breath:0.011, weapon:0.012, rate:1.05, crouch:0.014},
};

// 上位職(#9)の上乗せ。基礎職の型は共有したまま、振れ幅と速さだけ変える
export const JOB_IDLE_MUL = {
  battleKnight: {sway:1.25, rate:0.82, crouch:1.10},   // 重い。ゆったり大きく
  berserker:    {sway:1.10, rate:1.45, crouch:1.80},   // 低く、落ち着かない
  archmage:     {weapon:1.35, rate:0.78},              // 杖まわりだけが揺れる
  hawkEye:      {sway:0.70, rate:0.90},                // より動かない = 精密さ
};

export function idleProfile(classKey, jobKey){
  const base = CLASS_IDLE[classKey] || CLASS_IDLE.warrior;
  const mul = JOB_IDLE_MUL[jobKey];
  if(!mul) return Object.assign({}, base);
  return {
    sway:   base.sway   * (mul.sway   || 1),
    breath: base.breath * (mul.breath || 1),
    weapon: base.weapon * (mul.weapon || 1),
    rate:   base.rate   * (mul.rate   || 1),
    crouch: base.crouch * (mul.crouch || 1),
  };
}

/* 構え中の微細な揺れ。phase は既存の strideT(距離ベースで進む歩幅位相、
   静止中も時間で進む)をそのまま渡す想定 ―― 新しいタイマーを増やすと
   歩行・呼吸・構えが別々の周期で動いて気持ち悪くなるため。
   戻り値はすべて「加算するラジアン/メートル」の小さな値。 */
export function combatIdleOffsets(phase, profile, weight = 1, amp = 1){
  const p = profile || CLASS_IDLE.warrior;
  /* weight は 0..1 の「どれだけ構えているか」。amp は振り終わり直後の
     上乗せ(settleBoost)のように 1 を超えてよい別軸の倍率なので、
     weight と一緒にクランプしてしまうと効かなくなる ―― 分けてある。 */
  const w = Math.max(0, Math.min(1, weight)) * Math.max(0, amp);
  const t = phase * p.rate;
  return {
    // 重心が左右へゆっくり移る(腰のroll + 横移動)
    waistRoll: Math.sin(t*0.55) * p.sway * w,
    waistShift: Math.sin(t*0.55) * p.sway * 0.35 * w,
    // 呼吸で上体がわずかに起き上がる/沈む
    waistPitch: Math.sin(t*1.00) * p.breath * w,
    // 武器を持つ側の肩・肘が生きている(完全静止させない)
    weaponSway: Math.sin(t*1.30 + 0.9) * p.weapon * w,
    elbowSway: Math.sin(t*1.30 + 1.7) * p.weapon * 0.55 * w,
    // 構えている間は腰を少し落とす
    crouch: -p.crouch * w,
  };
}

/* =========================================================
   上位職の恒久的な姿勢バイアス

   updateLocomotion(13-update-loop.js)は、バーサーカーの「常に敵へ
   飛びかかりそうなシルエット」を毎フレーム腰の前傾と膝の曲げへ足している。
   もともと applyJobPromotionVisual 側で一度だけ書いていたものが、歩行が
   毎フレーム上書きするせいで消えていた ―― という事故の再発防止として
   歩行側へ移された経緯がある。

   Combat Idle はその後に構えのポーズを**絶対値で**当てるため、同じ事故を
   一段上のレイヤーで起こしていた(構え中だけ前傾と低い膝が消え、沈み込み
   (crouch)だけが残って「沈むのに膝が伸びる」状態になっていた)。

   三度目を防ぐため、値の出どころをここ一箇所に集める。歩行も Combat Idle も
   この表を読む。値そのものは移設前と同一。 */
export const JOB_POSTURE_BIAS = {
  // バーサーカー: 前傾(腰pitch) + 低い構え(膝) + 全身をわずかに沈める
  berserker: { waistPitch: 0.10, knee: 0.20, bodyY: -0.045 },
};

export function jobPostureBias(jobKey){
  const b = JOB_POSTURE_BIAS[jobKey];
  return b ? b : { waistPitch: 0, knee: 0, bodyY: 0 };
}

/* 構えのターゲットへ恒久バイアスを載せる。バイアスを持たない職では
   渡されたものをそのまま返す(新しいオブジェクトも作らない)。 */
export function withJobPostureBias(target, jobKey){
  const b = JOB_POSTURE_BIAS[jobKey];
  if(!b || !target) return target;
  const out = Object.assign({}, target);
  if(b.waistPitch && Array.isArray(out.waist)){
    out.waist = [out.waist[0] + b.waistPitch, out.waist[1], out.waist[2]];
  }
  if(b.knee){
    if(out.kneeL != null) out.kneeL = out.kneeL + b.knee;
    if(out.kneeR != null) out.kneeR = out.kneeR + b.knee;
  }
  return out;
}

/* Combat Idle が当てるターゲットの組み立て。

   applyCombatIdlePose(05-rendering-rig.js)が実際に使う唯一の経路にして
   あるので、ユニットテストは「本番と同じ手順で作ったターゲット」を検査
   できる ―― テスト側で組み立てを書き写すと、片方だけ直して気づかない。

   戻り値の idle は腰の横移動(waistShift)を呼び出し側が別扱いするために
   返している(下の stepWaistShift の説明を参照)。 */
export function buildCombatIdleTarget(stance, profile, phase, weight, amp, jobKey){
  const idle = combatIdleOffsets(phase, profile, weight, amp);
  const out = Object.assign({}, stance);
  out.waist = [stance.waist[0] + idle.waistPitch, stance.waist[1], stance.waist[2] + idle.waistRoll];
  out.shR = [stance.shR[0] + idle.weaponSway, stance.shR[1], stance.shR[2]];
  out.shL = [stance.shL[0] - idle.weaponSway*0.4, stance.shL[1], stance.shL[2]];
  out.elR = stance.elR + idle.elbowSway;
  out.elL = stance.elL - idle.elbowSway*0.4;
  // 構えている間は腰を落とす。既存の drop チャンネルをそのまま使う
  out.drop = -idle.crouch;
  return { target: withJobPostureBias(out, jobKey), idle };
}

/* =========================================================
   腰の横移動(重心)の合成

   updateLocomotion は waist.position.x を「目標値へ毎フレーム寄せる」
   形(収束率 dt*12)で動かしている。Combat Idle の重心移動を、その lerp の
   **後で** position.x へ直接足していたのが問題だった ―― 足した分は次の
   フレームで 1-dt*12 しか戻らないので、収束率で割った分だけ積み上がる。
   結果として振幅が fps に比例して膨らむ:

     30fps 3.4cm / 60fps 6.0cm / 144fps 13.4cm (設計値 1.0cm)

   直し方は「加算をやめて、目標値の側へ合成する」。lerp の収束率 12/秒 は
   dt に対して正規化されているので、目標値さえ正しければ最終的な振幅は
   どの fps でも同じになる。

   歩行側の sway をこの関数へ渡す形にしてあるが、idleShift が 0 のときの
   計算は元の式と完全に一致する ―― 移動中の既存モーションは変わらない。 */
export const WAIST_FOLLOW_RATE = 12;

export function stepWaistShift(current, locomotionSway, idleShift, dt, rate = WAIST_FOLLOW_RATE){
  const a = Math.min(1, Math.max(0, dt) * rate);
  const target = (locomotionSway || 0) + (idleShift || 0);
  return current + (target - current) * a;
}

/* ポーズ(sampleClip が返す形)同士の線形補間。
   数値・配列チャンネルだけを混ぜ、grip のような文字列チャンネルは
   ウェイト 0.5 を境に切り替える(applyPose と同じ扱い)。
   a 側にしか無いキーはそのまま残す ―― 構えポーズには存在するが
   移動ポーズには無いチャンネル(draw など)を落とさないため。 */
export function blendPose(a, b, w){
  const k = Math.max(0, Math.min(1, w));
  const out = {};
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for(const key of keys){
    const av = a ? a[key] : undefined;
    const bv = b ? b[key] : undefined;
    if(av === undefined){ out[key] = bv; continue; }
    if(bv === undefined){ out[key] = av; continue; }
    if(Array.isArray(av) && Array.isArray(bv)){
      const n = Math.max(av.length, bv.length);
      const o = new Array(n);
      for(let i=0;i<n;i++){
        const x = av[i] !== undefined ? av[i] : bv[i];
        const y = bv[i] !== undefined ? bv[i] : av[i];
        o[i] = x + (y - x)*k;
      }
      out[key] = o;
    } else if(typeof av === 'number' && typeof bv === 'number'){
      out[key] = av + (bv - av)*k;
    } else {
      out[key] = k < 0.5 ? av : bv;
    }
  }
  return out;
}

/* 振り終わった直後の「まだ収まっていない」ぶんの上乗せ。
   sinceSwingEnd はクリップが終わってからの経過秒数。直後は揺れの振幅を
   大きく取り、SETTLE_SECONDS かけて通常の Combat Idle へ落ちる。
   これが attack → recovery → next attack の recovery にあたる ――
   毎回きっちり同じ構えへ戻り切ってから次を振る、という止まった印象を
   減らすためのもので、ダメージにもクールダウンにも一切関わらない。 */
export const SETTLE_SECONDS = 0.30;
export const SETTLE_PEAK = 2.4;

export function settleBoost(sinceSwingEnd, settle = SETTLE_SECONDS){
  if(!(sinceSwingEnd >= 0)) return 1;
  if(!(settle > 0) || sinceSwingEnd >= settle) return 1;
  const k = sinceSwingEnd / settle;
  return 1 + (SETTLE_PEAK - 1) * (1 - k) * (1 - k);
}
/* 高速連撃が成立しているかの判定材料。
   クリップ長(swingDur)が攻撃クールダウン(atkCooldown)より短いと、
   その差のあいだモーションが「終わって待っている」状態になる。
   gapSeconds が正の値になる組み合わせこそ Combat Idle が要る場所 ――
   この関数は調整とテストのために差を明示するだけで、ゲーム側の挙動は
   変えない。 */
export function swingGapSeconds(swingDur, atkCooldown){
  return Math.max(0, (atkCooldown || 0) - (swingDur || 0));
}
