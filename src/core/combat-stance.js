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
