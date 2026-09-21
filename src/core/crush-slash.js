/* 崩し斬り ―― 剣士の Skill 2(D-04)。

   物語側の位置づけは MANSION_SCENARIO.md のとおり:
   鍛冶屋が瓦礫を「力任せではなく、効いている一点へ梃子を入れて」外す
   のを見た剣士が、その理屈を戦いへ翻訳したもの。だから目的は大ダメージ
   ではなく、**相手の足元を崩して姿勢(体幹)を大きく削ること**。

   ■ モーション上の最重要事項(仕様 6-2)
   回転斬りにしない。これは禁止事項であって、好みの話ではない。

     ✗ 360度回転攻撃 / 身体を先に回して剣を振る / 大きく円を描く
     ✗ 周囲全方向を攻撃する / 空中で身体を大きく捻る
     ✓ 剣を後ろへ引く予備動作 → 一歩の鋭い踏み込み → 足元を狙った
       水平に近い横薙ぎ → 振り抜いた勢いで**結果として**身体が回る
       → 綺麗に通常姿勢へ戻る

   「回転して斬る」のではなく「踏み込み＋横薙ぎの結果として回る」。
   この差はコメントでは守れないので、下の validateCrushSlashClip() が
   キーフレームから機械的に検査し、tests/unit/crush-slash.test.js が
   それを固定している ―― 将来モーションを調整しても、回転斬りへ
   寄っていったらテストが落ちる。

   ■ 数値について(仕様 6-3)
   ダメージ倍率・ダウン値・踏み込み距離・発生・硬直・クールダウン・
   敵階層ごとの補正は**まだ確定していない**。ここに置いてあるのは
   「既存の地裂斬(skill2)の枠をそのまま借りた暫定値」で、正式な数値が
   決まるまでの仮置きであることを PROVISIONAL_* という名前で明示して
   ある。勝手に本仕様として確定させないこと。

   state・three.js に依存しない純粋な定義と計算だけを置く
   (ARCHITECTURE.md の core/ の作法)。 */

/* ---- クリップ(キーフレーム) ----
   05-rendering-rig.js の CLIPS と同じ形。stance:true のフレームは
   「その職業の通常の構えをそのまま使う」という意味で、実際の値は
   リグ側が STANCE から差し込む ―― STANCE は描画側の定数なので、
   core からは参照しない。

   waist は [pitch, yaw, roll]。yaw がこの技の主役で、
   引く(+) → 薙ぐ(0を通過して −) → 振り抜きの余勢で回る(−が最大)
   という一方向の流れになっている。円を描いて戻ってはこない。 */
export const CRUSH_SLASH_CLIP = [
  // 予備動作: 軸足に乗って、剣を右後方へ引く。まだ踏み込まない
  {t:0.00, e:'slow', stance:true, push:-0.10, drop:0.04},
  /* 引き切り。腰を深く落とし、刃を**寝かせて**右後ろへ担ぐ。
     wep の第1ベクトル(刃の向き)の y が負 = 切っ先が床側を向いている ――
     ここが「足元を薙ぐ」の実体で、validateCrushSlashClip が検査する */
  {t:0.22, e:'snap', push:-0.04, drop:0.30,
   waist:[0.20, 0.78, 0.12],
   shL:[-0.26, 0.28, 0.92], elL:-2.10,
   shR:[ 0.26,-0.22,-0.50], elR:-2.45,
   wep:[0.845,-0.190,-0.500, -0.150,0.972,0.180],
   hipL:-0.34, hipR:0.26, kneeL:0.52, kneeR:0.12, grip:'BOTH'},
  /* 一閃を薙ぎ抜けた直後。刃は左前方へ抜け、まだ床すれすれ。
     踏み込み(push)はここが最大で、腰も一番低い ―― 上から斬り下ろす
     のではなく、低い姿勢のまま横へ払い抜ける */
  {t:0.42, e:'settle', push:0.52, drop:0.34,
   waist:[0.26,-0.42,-0.06],
   shL:[-0.98,-0.26, 0.16], elL:-0.28,
   shR:[-0.92, 0.26,-0.22], elR:-0.30,
   wep:[-0.760,-0.235,0.606, -0.055,-0.962,-0.267],
   hipL:-0.52, hipR:0.42, kneeL:0.22, kneeR:0.30, grip:'BOTH'},
  // 振り抜き。勢いはまだ殺さない。刃も低いまま
  {t:0.66, e:'settle', push:0.34, drop:0.20,
   waist:[0.16,-1.00,-0.12],
   shL:[-1.02,-0.32, 0.08], elL:-0.22,
   shR:[-0.86, 0.32,-0.12], elR:-0.36,
   wep:[-0.945,-0.130,0.300, -0.028,-0.985,0.170],
   hipL:-0.36, hipR:0.34, kneeL:0.28, kneeR:0.14, grip:'BOTH'},
  /* ここが「結果として回る」ところ。ヨーの最大はこのフレームで、
     一閃(CRUSH_SLASH_STRIKE_T)より必ず後ろにある ―― 先に回ってから
     斬ってはいない。85度ぶんで止める。一周させない */
  {t:0.84, e:'settle', push:0.14, drop:0.06,
   waist:[0.06,-1.48,-0.05],
   shL:[-0.88,-0.30, 0.10], elL:-0.44,
   shR:[-0.66, 0.30,-0.16], elR:-0.58,
   wep:[-0.560,0.260,-0.787, -0.140,0.955,0.260],
   hipL:-0.16, hipR:0.20, kneeL:0.18, kneeR:0.06, grip:'BOTH'},
  // 綺麗に通常姿勢へ戻す
  {t:1.00, stance:true},
];

/* 一閃が「当たる」瞬間(クリップ内の位置)。0.22→0.42 の区間は e:'snap'
   ―― 移動のほとんどが最初の1/3で終わる ―― なので、刃が front を
   通過するのはこのあたり。判定・SE・VFX を全部ここに揃える。

   以前は入力フレームでそのまま判定していたため、「先に当たってから
   剣が振られる」順序で見えていた(実機レビューの指摘)。既存の
   pendingUlt / pendingSwing と同じ「一撃が届く瞬間まで保留する」型へ
   合わせてある。 */
export const CRUSH_SLASH_STRIKE_T = 0.30;
// 薙ぎ抜けが完成するフレーム(検査と作図の基準点)
export const CRUSH_SLASH_SWEEP_T = 0.42;

export const CRUSH_SLASH_ARC = 1.15;      // 半扇角(rad)
export const CRUSH_SLASH_RANGE = 3.4;     // 踏み込みぶんを含む到達距離

/* ---- 暫定値(正式な数値は未確定。仕様 6-3) ----
   地裂斬(既存 skill2)の枠をそのまま借りている。cd/mult は同じ値で、
   変えてあるのは「ダメージではなく体幹を削る技」という配分だけ。 */
export const PROVISIONAL_CD = 9;          // = 既存 skill2 の cd
export const PROVISIONAL_DMG_MUL = 1.15;  // 地裂斬(2.0)より低い ―― 火力技ではない
/* 通常攻撃1発ぶんのダウン値に対する倍率。「通常攻撃よりダウン値を
   大きくする」(仕様 6-1)を満たす最小限の値で、吹き飛ばしは伴わない */
export const PROVISIONAL_STAGGER_MUL = 3.2;
export const PROVISIONAL_LUNGE = 1.9;     // 踏み込み距離(m)

export const CRUSH_SLASH = {
  key: 'crushSlash',
  name: '崩し斬り',
  icon: '🌀',
  desc: '低く踏み込んで足元を薙ぐ。ダメージより姿勢を大きく崩す',
  cd: PROVISIONAL_CD,
  mult: PROVISIONAL_DMG_MUL,
  staggerMul: PROVISIONAL_STAGGER_MUL,
  arc: CRUSH_SLASH_ARC,
  range: CRUSH_SLASH_RANGE,
  lunge: PROVISIONAL_LUNGE,
  provisional: true,   // 正式な数値が決まるまでの仮置きであることの印
};

/* 前方扇に入っているか。dx/dz は敵 - 自分、facing はプレイヤーの向き。
   戻り値は {hit, dist, angle}。判定そのものは呼び出し側が使う */
export function crushSlashHit(dx, dz, facing, range = CRUSH_SLASH_RANGE, arc = CRUSH_SLASH_ARC){
  const dist = Math.hypot(dx, dz);
  if(dist > range) return {hit:false, dist, angle:null};
  // 向き 0 が +z、facing は atan2(x, z) 系(この実装の共通則)
  const to = Math.atan2(dx, dz);
  let d = to - facing;
  while(d >  Math.PI) d -= Math.PI*2;
  while(d < -Math.PI) d += Math.PI*2;
  const angle = Math.abs(d);
  return {hit: angle <= arc, dist, angle};
}

/* ---- 「回転斬りにしない」の機械的な検査 ----
   仕様 6-2 の NG リストをキーフレームから直接見る。violations は
   破っている規則の名前の配列で、空なら合格。 */
export function validateCrushSlashClip(clip, strikeT = CRUSH_SLASH_STRIKE_T){
  const violations = [];
  const frames = (clip || []).filter(f=> Array.isArray(f.waist));
  if(!frames.length){ return {ok:false, violations:['no-waist-frames'], maxYaw:0, yawTravel:0, maxYawT:0}; }

  let maxYaw = 0, maxYawT = 0, yawTravel = 0, prev = 0;
  // stance フレーム(= 構え)のヨーは 0 として扱う ―― 実値はリグ側だが、
  // どの職業の構えも正面を向いているという前提はこの技の設計そのもの
  const seq = (clip || []).map(f => Array.isArray(f.waist) ? f.waist[1] : 0);
  (clip || []).forEach((f, i)=>{
    const yaw = seq[i];
    yawTravel += Math.abs(yaw - prev);
    prev = yaw;
    if(Math.abs(yaw) > Math.abs(maxYaw)){ maxYaw = yaw; maxYawT = f.t; }
  });

  // 1. 360度回転攻撃にしない
  if(Math.abs(maxYaw) >= Math.PI) violations.push('full-spin');
  // 2. 大きく円を描いて戻ってこない(往復ぶんを足しても一周に満たない)
  if(yawTravel >= Math.PI*2) violations.push('circular-travel');
  // 3. 身体を先に回して剣を振らない ―― ヨーの頂点は一閃より後
  if(!(maxYawT > strikeT)) violations.push('body-leads-blade');
  // 4. 空中で身体を大きく捻らない ―― 跳ね上がるフレームを持たない
  if((clip || []).some(f => f.lift)) violations.push('airborne-lift');
  // 5. 最後は綺麗に通常姿勢へ戻る
  const last = (clip || [])[clip.length - 1];
  if(!last || last.t !== 1 || !last.stance) violations.push('no-return-to-stance');
  // 6. 踏み込みが実際にある(「シュッと踏み込んで一閃する」)
  if(!(clip || []).some(f => (f.push || 0) >= 0.4)) violations.push('no-step-in');

  /* 7. **足元を薙いでいる**こと。実機レビューで「足元を横薙ぎしている
        ように見えない」と指摘された点を、見た目ではなく数値で縛る。
        wep の第1ベクトルが刃の向き(切っ先が指す方)なので、薙いでいる
        区間ではその y が 0 以下 ―― 切っ先が水平か、床側を向いている。 */
  const swung = (clip || []).filter(f => Array.isArray(f.wep) && f.t > 0 && f.t <= CRUSH_SLASH_SWEEP_T);
  if(!swung.length) violations.push('no-blade-frames');
  else if(swung.some(f => f.wep[1] > 0)) violations.push('blade-not-low');

  /* 8. **横薙ぎ**であること。刃が身体の片側からもう片側へ抜ける ――
        切っ先の左右成分(wep[0])の符号が、振り抜きまでに反転する。
        上から下ろす斬撃や突きはここで落ちる。 */
  const sides = (clip || [])
    .filter(f => Array.isArray(f.wep) && f.t > 0 && f.t <= CRUSH_SLASH_SWEEP_T)
    .map(f => Math.sign(f.wep[0]));
  if(!(sides.some(v => v > 0) && sides.some(v => v < 0))) violations.push('not-a-horizontal-sweep');

  /* 9. 低い姿勢で振り抜く。薙いでいる間、腰が落ちていること */
  const sweep = (clip || []).find(f => f.t === CRUSH_SLASH_SWEEP_T);
  if(!sweep || !((sweep.drop || 0) > 0.15)) violations.push('not-crouched');

  return {ok: violations.length === 0, violations, maxYaw, yawTravel, maxYawT};
}

/* 前方限定の扇であること(周囲全方向にしない)。判定側の禁止事項。 */
export function validateCrushSlashArc(arc = CRUSH_SLASH_ARC){
  const violations = [];
  if(!(arc > 0)) violations.push('no-arc');
  if(arc >= Math.PI) violations.push('omnidirectional');
  return {ok: violations.length === 0, violations};
}
