/* 影の旅人の戦い方(WANDERER-RENEWAL-001 / 002、AD-005・DEC-034)。

   「半拍遅れて歩く、静かな旅人」(DEC-034) ―― 武器を持たない。本人が手を振ると、
   少し遅れて地面から巨大な影の手が現れて敵を襲う。本人は静か、影は獰猛。
   3 段目・Skill 1・Skill 2 では、影の手が 0.45 秒後にもう一度動く(握り潰す /
   薙ぐ / 薙ぎ戻す。「影の追撃」)。

   ここに置くのは数値・判定の形・時刻・キーフレームだけ(純関数。state・THREE・scene に
   依存しない。ARCHITECTURE.md の core/ の作法)。実際に敵へ当てる・影の手を描くのは
   src/legacy/parts/17-wanderer-style.js。

   遅れ(0.45 秒)は、加入前の人物の「本人より遅れてついていく影」(DEC-004 N-4、
   14-dungeon-road.js の PRE_JOIN_SHADOW_LAG、DEC-030 の lag)と同じ値。加入の前と
   後で同じ性質を見せるだけで、言葉では説明しない(DEC-031)。 */

export const WANDERER_KEY = 'wanderer';

/* 影の追撃の遅れ(秒)。加入前の影(PRE_JOIN_SHADOW_LAG)と同じ値 */
export const WANDERER_ECHO_LAG = 0.45;

/* 同時に待っていられる追撃の数。超えたら古いものから消す(雑魚戦で増えすぎない) */
export const WANDERER_ECHO_MAX = 3;

/* モーション・コンボ・Skill の表を引く鍵。影の旅人は kit(基礎職キー 'warrior')を
   装備・配色・セーブのために持ったまま、動きだけ自分の表を引く。
   charKey を持たない 4 人は今までどおり基礎職キーを返す。 */
export function wandererRigKey(classKey, charKey){
  return charKey === WANDERER_KEY ? WANDERER_KEY : classKey;
}

/* 戦闘の数値(CLASSES.wanderer に載せる。剣士 3.6 / 106° / 0.52 / 1.3、
   盗賊 2.8 / 39° / 0.38 / 0.7 の間の「中間の間合い」) */
export const WANDERER_COMBAT = Object.freeze({
  range: 'melee',
  meleeRange: 3.2,
  meleeAngle: Math.PI / 3,   // 半角 60°
  cleave: true,              // 影の刃は通り抜ける
  atkCooldown: 0.44,
  staggerMul: 0.9,
});

/* 通常攻撃: 3 段(払い → 返し → 踏み込みの振り下ろし)。3 段目だけ影が追う */
export const WANDERER_COMBO_LENGTH = 3;
export const WANDERER_COMBO_CLIPS = Object.freeze({1: 'basic', 2: 'basic2', 3: 'basic3'});
export const WANDERER_LUNGE = 0.30;   // 1 段ごとの踏み込み(m)。剣士 0.45 / 盗賊 0

/* 抜刀 / 納刀(秒)。影が刃になるのは速く、ほどけるのはゆっくり */
export const WANDERER_DRAW_TIME = Object.freeze({draw: 0.12, sheathe: 0.30});

/* 追撃の種類ごとの形と倍率。dmgMul は元の一撃のダメージに掛ける。
   circle … 影の手のまわり / back … 影の手の側からこちらへ向かう弧 */
export const WANDERER_ECHO = Object.freeze({
  // 3 段目の握砕: 足元から出た手が指を閉じて握り潰す(手の場所の円。DEC-034 §4)
  finish: {shape: 'circle', dmgMul: 0.6, staggerMul: 1.0, ultGauge: 2, radius: 1.6},
  skill1: {shape: 'circle', dmgMul: 0.8, staggerMul: 1.4, ultGauge: 2, radius: 2.4},
  skill2: {shape: 'back',   dmgMul: 1.5, staggerMul: 1.6, ultGauge: 3, range: 3.4, angle: Math.PI * 70 / 180},
});

/* Skill 1「影残し」 ―― 第一章の固定 Skill 1 の枠('retreat'。UI-002 HD-1 の各職の
   'retreat' と同じキー)。前へ一撃を入れて退き、元の場所に影を残す */
export const WANDERER_SKILL1 = Object.freeze({
  key: 'retreat', name: '影残し', icon: '🌘',
  desc: '前へ手を振って大きく退く。元の場所から巨大な影の手が現れ、少し遅れて周りを薙ぐ',
  baseMult: 1.2, maxMult: 2.4, mode: 'single', vfxColor: 0x8a5ad6,
  movement: 'retreat', dist: 2.8, duration: 0.24, echo: 'skill1',
});

/* Skill 2「影渡り」(道で閃く) ―― 影を地面に走らせ、線の先から斬り返させる */
export const WANDERER_SKILL2 = Object.freeze({
  key: 'shadowPass', name: '影渡り', icon: '👥',
  desc: '影の手が地面を這って前へ進み、先端で向きを変えてこちらへ薙ぎ戻す(挟み撃ち)',
  cd: 9, mult: 1.0, length: 6.5, width: 1.8, passStaggerMul: 1.2, echo: 'skill2',
});

/* ---- 追撃の予定 ----
   at: {x, z, yaw}(元の一撃の位置と向き)、dmg: 元の一撃のダメージ。
   戻り値は 17-wanderer-style.js が t を減らしていき、0 になったら解決する */
export function planEcho(kind, at, dmg){
  const spec = WANDERER_ECHO[kind];
  if(!spec || !at) return null;
  return {
    kind, t: WANDERER_ECHO_LAG, x: at.x, z: at.z, yaw: at.yaw || 0,
    dmg: Math.max(1, Math.round((dmg || 0) * spec.dmgMul)),
    staggerMul: spec.staggerMul, ultGauge: spec.ultGauge,
  };
}

/* 待ち行列へ足す。上限を超えたら古いものを捨てる(捨てた分を返す) */
export function pushEcho(list, echo){
  if(!echo) return [];
  list.push(echo);
  const dropped = [];
  while(list.length > WANDERER_ECHO_MAX) dropped.push(list.shift());
  return dropped;
}

/* 時間を進め、時刻が来たものを取り出す(順序は予定順) */
export function stepEchoes(list, dt){
  const due = [];
  for(let i = 0; i < list.length;){
    list[i].t -= dt;
    if(list[i].t <= 0){ due.push(list[i]); list.splice(i, 1); }
    else i++;
  }
  return due;
}

function angleBetween(yaw, dx, dz){
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const d = Math.hypot(dx, dz);
  if(d < 1e-4) return 0;
  const c = Math.max(-1, Math.min(1, (fx * dx + fz * dz) / d));
  return Math.acos(c);
}

/* 弧の判定(meleeHitTest と同じ考え方: 表面までの距離と、半径ぶん広がる角度)。
   origin を自由に取れる ―― 影の位置から測るため */
export function echoArcHit({ox, oz, yaw, tx, tz, radius = 0, range, angle}){
  const dx = tx - ox, dz = tz - oz;
  const dist = Math.hypot(dx, dz);
  if(dist - radius > range) return false;
  if(dist <= radius) return true;
  const spread = Math.asin(Math.min(1, radius / dist));
  return angleBetween(yaw, dx, dz) <= angle + spread;
}

export function echoCircleHit({ox, oz, tx, tz, radius = 0, r}){
  return Math.hypot(tx - ox, tz - oz) - radius <= r;
}

/* 線の判定(executeVariant の 'line' と同じ形: 前方距離 0〜length、横幅 width/2) */
export function lineHit({ox, oz, yaw, tx, tz, length, width}){
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const dx = tx - ox, dz = tz - oz;
  const fwd = dx * fx + dz * fz;
  const side = Math.abs(dx * fz - dz * fx);
  return fwd > 0 && fwd <= length && side <= width / 2;
}

/* ---- 通常攻撃の影の手(DEC-034 §4) ----
   本人の動作から少し遅れて手が当たる(delay 秒後)。形は手の見た目と一致させる:
     1 段目 突き上げ … 敵の足元から下から突き上げる手(手のまわりの円)
     2 段目 薙ぎ払い … 横向きの手が前方の扇を薙ぐ(従来の扇)
     3 段目 握砕     … 敵の足元に開いた手。当たった後、0.45 秒(予定から)で握り潰す
   scale は影の手の大きさ(手首〜中指の先 = 1 の型に掛ける倍率。主人公の身長 2.54) */
export const WANDERER_STRIKE = Object.freeze({
  basic:  {hand: 'rise',  delay: 0.16, shape: 'circle', radius: 1.5, scale: 3.4},
  basic2: {hand: 'sweep', delay: 0.14, shape: 'arc',                  scale: 3.4},
  basic3: {hand: 'grab',  delay: 0.18, shape: 'circle', radius: 1.6, scale: 4.7},
});
/* 影の手の大きさ(手首〜中指の先 ≒ 1.08 の型への倍率。手首から先の高さ ≒ 倍率 × 1.08 m)。
   DEC-034 §3-3 の目安と WANDERER-RENEWAL-002 WR2-2(主人公の身長 2.54 に対し、通常 約 1.4〜1.5 倍・
   強い一撃 約 2 倍・必殺技 約 2.2 倍)。見下ろしカメラで主人公と対象が隠れないよう、手は敵の足元・
   攻撃範囲の上に出し、短時間で沈める */
export const WANDERER_HAND_SCALE = Object.freeze({
  basic: 3.4, grab: 4.7, skill1: 4.7, skill2: 3.6, ult: 5.2, dodge: 1.0, small: 2.4,
});

export function planStrike(kind, at, dmg, opts){
  const spec = WANDERER_STRIKE[kind];
  if(!spec || !at) return null;
  const o = opts || {};
  return {
    kind, strike: true, t: spec.delay, x: at.x, z: at.z, yaw: at.yaw || 0,
    ox: at.ox != null ? at.ox : at.x, oz: at.oz != null ? at.oz : at.z,
    dmg: Math.max(1, Math.round(dmg || 0)),
    staggerMul: o.staggerMul || 1, ultGauge: o.ultGauge || 3, isFinish: !!o.isFinish,
  };
}

/* 影の手の出る場所: 扇(range / 半角 angle)の中で一番近い敵の足元。いなければ前方 fallback m。
   candidates: [{x, z, r}](r = 敵の当たり半径) */
export function handTargetPoint(px, pz, yaw, candidates, range, angle, fallback){
  let best = null, bestD = Infinity;
  (candidates || []).forEach(c=>{
    if(!echoArcHit({ox: px, oz: pz, yaw, tx: c.x, tz: c.z, radius: c.r || 0, range, angle})) return;
    const d = Math.hypot(c.x - px, c.z - pz);
    if(d < bestD){ bestD = d; best = c; }
  });
  if(best) return {x: best.x, z: best.z, target: true};
  const f = fallback != null ? fallback : range * 0.65;
  return {x: px + Math.sin(yaw) * f, z: pz + Math.cos(yaw) * f, target: false};
}

/* 影渡りの到達点。blocked(x, z) が真になる手前で止まる(壁を抜けない)。
   step ごとに調べ、最後に通れた点を返す。向きは本人と同じ */
export function shadowPassEnd(ox, oz, yaw, length, blocked, step = 0.5){
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  let reach = 0;
  for(let d = step; d <= length + 1e-6; d += step){
    if(blocked && blocked(ox + fx * d, oz + fz * d)) break;
    reach = d;
  }
  return {x: ox + fx * reach, z: oz + fz * reach, reach};
}

/* ---- 構え・休め・キーフレーム ----
   座標の約束は 05-rendering-rig.js の STANCE / CLIPS と同じ(waist [前傾, ひねり, 傾き]、
   shL / shR 肩の Euler、elL / elR 肘、hip / knee、wep = 武器の向き(影の旅人は空の枠)、
   push / drop / lift は見た目だけの体の移動)。

   DEC-034 §5: 攻撃は腕だけでなく身体全体の大振り。ただし力任せの格闘家にしない ――
   影を呼ぶ動作。構えは腕を自然に下ろした静かな立ち姿(わずかに手を開く)。 */
export const WANDERER_STANCE = Object.freeze({
  waist: [0.05, 0.08, 0.00],
  shL: [-0.22, 0.06, 0.30], elL: -0.42,
  shR: [-0.24, -0.06, -0.30], elR: -0.46,
  wep: [0.000, -1.000, 0.000, 0.000, 0.000, 1.000],
  hipL: 0.08, hipR: -0.06, kneeL: 0.16, kneeR: 0.10,
  grip: 'R', armSwing: 0.45, tip: 0.1, trail: false,
});

/* 休め: 腕を自然に下ろし、静かに立つ(呼吸の揺れは共通の仕組み) */
export const WANDERER_RELAXED = Object.freeze({
  waist: [0.03, 0.04, 0.00],
  shL: [-0.08, 0.04, 0.12], elL: -0.18,
  shR: [-0.08, -0.04, -0.12], elR: -0.20,
  hipL: 0.04, hipR: -0.02, kneeL: 0.10, kneeR: 0.04,
});

/* 武器の枠(空)の握りのずれ */
export const WANDERER_GRIP_OFFSET = Object.freeze([0, 0, 0]);

function F(t, o){ const out = Object.assign({}, o); out.t = t; return out; }

/* 各クリップの長さ(秒)と、手の動作が決まる(影の手を呼ぶ)キーフレームの位置。
   影の手は本人の動作から少し遅れて当たる(WANDERER_STRIKE の delay)ので、本人の
   決めの姿勢は delay より少し前に置く */
/* WANDERER-RENEWAL-003(重量感): 巨大な影の手に見合うよう、本人の動作を少し遅くした
   (旧: basic 0.40 / basic2 0.40 / basic3 0.62 / retreat 0.40 / shadowPass 0.50 / dash 0.34 /
   spin 0.38 / ult 0.80)。キーフレームの位置(割合)は変えないので、溜め(slow)と余韻(settle)が
   そのまま長くなる。攻撃間隔(atkCooldown 0.44)・影の手の当たる時刻(WANDERER_STRIKE.delay)・
   握砕の 0.45 秒は変えない ―― 決めの姿勢は手が当たる時刻とほぼ重なる(unit テストで検査)。
   1 段目と 2 段目は同じテンポ。3 段目は両腕を広げてから握り込むまでを長く取り、握り込みの姿勢が
   握り潰す瞬間(0.45 秒)に重なる */
export const WANDERER_CLIP_DUR = Object.freeze({
  basic: 0.50, basic2: 0.50, basic3: 0.78, retreat: 0.48, shadowPass: 0.60,
  dash: 0.38, spin: 0.44, ult: 0.95, hold: 1,
});
/* 3 段目の「握り込み」のキーフレームの位置(握り潰す瞬間 = WANDERER_ECHO_LAG に重なる) */
export const WANDERER_GRAB_CLOSE_FRAC = 0.56;
export const WANDERER_CLIP_CONTACT = Object.freeze({
  basic: 0.30, basic2: 0.30, basic3: 0.24, retreat: 0.24, shadowPass: 0.30,
  dash: 0.24, spin: 0.26, ult: 0.45,
});

/* st: 構え(05 では STANCE.wanderer = WANDERER_STANCE)。各クリップは構えで始まり、
   構えで終わる(どの技の後も必ず静かな立ち姿へ戻る) */
export function buildWandererClips(st){
  const S = Object.assign({}, st || WANDERER_STANCE);
  const at = (o) => Object.assign({}, S, o);
  return {
    dur: Object.assign({}, WANDERER_CLIP_DUR),

    // 1 段目 影の突き上げ: 右手を大きく下から前上へ振り上げ、体を少し反らして腕を伸ばす
    basic: [
      F(0.00, at({e: 'slow', drop: 0.04})),
      F(0.14, {e: 'slow', push: -0.06, drop: 0.14, waist: [0.30, 0.30, 0.06],
        shL: [-0.30, 0.10, 0.50], elL: -0.70,
        shR: [0.40, -0.10, -0.30], elR: -0.30,
        hipL: -0.20, hipR: 0.10, kneeL: 0.36, kneeR: 0.12}),
      F(0.30, {e: 'snap', push: 0.20, lift: 0.04, waist: [-0.22, -0.18, -0.04],
        shL: [-0.40, 0.10, 0.70], elL: -0.50,
        shR: [-2.30, -0.10, -0.10], elR: -0.10,
        hipL: -0.30, hipR: 0.20, kneeL: 0.20, kneeR: 0.06}),
      F(0.62, {e: 'settle', push: 0.14, waist: [-0.10, -0.10, -0.02],
        shL: [-0.30, 0.08, 0.50], elL: -0.50,
        shR: [-1.40, -0.08, -0.20], elR: -0.40,
        hipL: -0.18, hipR: 0.12, kneeL: 0.18, kneeR: 0.08}),
      F(1.00, at({})),
    ],

    // 2 段目 影の薙ぎ払い: 右腕を大きく横へ払う。腰と上体が先に回り、腕が後から振り抜ける
    basic2: [
      F(0.00, at({e: 'slow'})),
      F(0.14, {e: 'slow', drop: 0.10, waist: [0.10, 0.75, 0.10],
        shL: [-0.40, 0.10, 0.80], elL: -0.90,
        shR: [-1.20, 0.30, 0.90], elR: -0.80,
        hipL: 0.20, hipR: -0.20, kneeL: 0.20, kneeR: 0.30}),
      F(0.30, {e: 'snap', push: 0.22, drop: 0.12, waist: [0.14, -0.85, -0.12],
        shL: [-0.60, 0.10, 0.40], elL: -0.60,
        shR: [-1.45, -0.30, -1.30], elR: -0.05,
        hipL: -0.30, hipR: 0.30, kneeL: 0.30, kneeR: 0.12}),
      F(0.62, {e: 'settle', push: 0.16, drop: 0.06, waist: [0.08, -0.60, -0.08],
        shL: [-0.40, 0.08, 0.40], elL: -0.60,
        shR: [-1.10, -0.20, -1.00], elR: -0.20,
        hipL: -0.20, hipR: 0.22, kneeL: 0.22, kneeR: 0.10}),
      F(1.00, at({})),
    ],

    // 3 段目 影の握砕: 両腕を大きく広げ、前傾しながら右手をゆっくり握り込む(影の手が閉じる)
    basic3: [
      F(0.00, at({e: 'slow'})),
      F(0.24, {e: 'snap', push: 0.10, lift: 0.02, waist: [-0.12, 0.00, 0.00],
        shL: [-0.70, 0.00, 1.30], elL: -0.15,
        shR: [-0.70, 0.00, -1.30], elR: -0.15,
        hipL: -0.10, hipR: 0.10, kneeL: 0.14, kneeR: 0.14}),
      F(WANDERER_GRAB_CLOSE_FRAC, {e: 'slow', push: 0.24, drop: 0.12, waist: [0.36, 0.10, 0.00],
        shL: [-0.60, 0.00, 1.00], elL: -0.30,
        shR: [-1.40, 0.00, -0.20], elR: -1.20,
        hipL: -0.34, hipR: 0.26, kneeL: 0.38, kneeR: 0.10}),
      F(0.78, {e: 'settle', push: 0.20, drop: 0.10, waist: [0.30, 0.08, 0.00],
        shL: [-0.40, 0.00, 0.70], elL: -0.40,
        shR: [-1.20, 0.00, -0.30], elR: -1.50,
        hipL: -0.28, hipR: 0.22, kneeL: 0.32, kneeR: 0.10}),
      F(1.00, at({})),
    ],

    // Skill 1 影残し: 前へ手を振り、そのまま低く後ろへ滑る(左手は前へ残す)
    retreat: [
      F(0.00, at({e: 'slow', push: 0.04})),
      F(0.24, {e: 'snap', push: 0.24, drop: 0.08, waist: [0.20, -0.30, 0.00],
        shL: [-0.40, 0.10, 0.60], elL: -0.80,
        shR: [-1.55, -0.20, -0.60], elR: -0.05,
        hipL: -0.30, hipR: 0.25, kneeL: 0.35, kneeR: 0.12}),
      F(0.54, {e: 'settle', push: -0.30, drop: 0.16, waist: [0.24, 0.20, 0.06],
        shL: [-1.10, 0.05, 0.30], elL: -0.30,
        shR: [-0.50, -0.10, -0.40], elR: -0.70,
        hipL: 0.35, hipR: -0.30, kneeL: 0.30, kneeR: 0.50}),
      F(0.80, {e: 'settle', push: -0.12, drop: 0.08, waist: [0.12, 0.10, 0.02],
        shL: [-0.70, 0.06, 0.36], elL: -0.50,
        shR: [-0.36, -0.08, -0.30], elR: -0.60,
        hipL: 0.18, hipR: -0.14, kneeL: 0.22, kneeR: 0.26}),
      F(1.00, at({})),
    ],

    // Skill 2 影渡り: 前へ手を差し出す(掌を下へ向けて、影の手を送り出す)。本人はその場
    shadowPass: [
      F(0.00, at({e: 'slow'})),
      F(0.30, {e: 'snap', push: 0.12, drop: 0.20, waist: [0.36, 0.06, 0.00],
        shL: [-0.30, 0.10, 0.60], elL: -0.70,
        shR: [-1.50, -0.05, -0.10], elR: -0.05,
        hipL: -0.50, hipR: 0.10, kneeL: 0.70, kneeR: 0.40}),
      F(0.66, {e: 'settle', push: 0.10, drop: 0.16, waist: [0.30, 0.06, 0.00],
        shL: [-0.30, 0.10, 0.60], elL: -0.70,
        shR: [-1.40, -0.05, -0.12], elR: -0.12,
        hipL: -0.42, hipR: 0.08, kneeL: 0.60, kneeR: 0.34}),
      F(1.00, at({})),
    ],

    // 回避攻撃: 低く踏み込み、下から手を払い上げる
    dash: [
      F(0.00, at({e: 'slow', push: 0.08, drop: 0.08})),
      F(0.24, {e: 'snap', push: 0.40, drop: 0.20, waist: [0.30, -0.20, 0.00],
        shL: [-0.30, 0.20, 0.70], elL: -0.90,
        shR: [-1.70, -0.10, -0.30], elR: -0.10,
        hipL: -0.55, hipR: 0.40, kneeL: 0.55, kneeR: 0.10}),
      F(0.54, {e: 'settle', push: 0.42, drop: 0.12, waist: [0.20, -0.10, 0.00],
        shL: [-0.40, 0.15, 0.60], elL: -0.80,
        shR: [-1.30, -0.05, -0.30], elR: -0.30,
        hipL: -0.40, hipR: 0.30, kneeL: 0.42, kneeR: 0.10}),
      F(1.00, at({})),
    ],

    // 切り上げ: 両手を下から頭上へ掬い上げる
    spin: [
      F(0.00, at({e: 'slow', drop: 0.08})),
      F(0.26, {e: 'snap', lift: 0.10, waist: [-0.24, 0.00, 0.00],
        shL: [-2.30, -0.05, 0.30], elL: -0.20,
        shR: [-2.30, 0.05, -0.30], elR: -0.20,
        hipL: -0.10, hipR: 0.10, kneeL: 0.10, kneeR: 0.16}),
      F(0.58, {e: 'settle', lift: 0.04, waist: [-0.12, 0.00, 0.00],
        shL: [-1.60, 0.00, 0.40], elL: -0.50,
        shR: [-1.60, 0.00, -0.40], elR: -0.50,
        hipL: 0.00, hipR: 0.02, kneeL: 0.14, kneeR: 0.16}),
      F(1.00, at({})),
    ],

    // 必殺技 影送り: 低く沈んで腕を抱え(影を集める)、両腕を大きく広げる。
    //   接触(=判定)は t 0.45(core/ult-clips.js の 'ult' と同じ位置)
    ult: [
      F(0.00, at({e: 'slow'})),
      F(0.30, {e: 'slow', drop: 0.26, waist: [0.40, 0.00, 0.00],
        shL: [-0.80, 0.30, 0.90], elL: -1.80,
        shR: [-0.80, -0.30, -0.90], elR: -1.80,
        hipL: -0.50, hipR: -0.50, kneeL: 0.90, kneeR: 0.90}),
      F(0.45, {e: 'snap', lift: 0.08, waist: [-0.18, 0.00, 0.00],
        shL: [-0.90, 0.00, 1.40], elL: -0.10,
        shR: [-0.90, 0.00, -1.40], elR: -0.10,
        hipL: -0.08, hipR: 0.08, kneeL: 0.10, kneeR: 0.10}),
      F(0.80, {e: 'settle', lift: 0.02, waist: [-0.06, 0.00, 0.00],
        shL: [-0.60, 0.00, 1.10], elL: -0.30,
        shR: [-0.60, 0.00, -1.10], elR: -0.30,
        hipL: -0.02, hipR: 0.04, kneeL: 0.14, kneeR: 0.14}),
      F(1.00, at({})),
    ],

    // 溜め(Skill 1 のボタンを押している間): 右手を引き、左手を前へ
    hold: [
      F(0.00, at({e: 'slow'})),
      F(1.00, {push: -0.08, drop: 0.10, waist: [0.14, -0.40, 0.06],
        shL: [-1.20, 0.08, 0.20], elL: -0.30,
        shR: [-0.20, -0.20, -0.80], elR: -1.20,
        hipL: -0.20, hipR: 0.14, kneeL: 0.30, kneeR: 0.18}),
    ],
  };
}

/* ---- 影の手の型(手首〜中指の先 = 約 1)。17-wanderer-style.js が組む ----
   人間の手を基本に、指を長く、指先だけ鋭く尖らせる(DEC-034 §3-1)。
   fingers: [付け根の x, 付け根の y, 長さの倍率, 開き(z 回転)] */
export const SHADOW_HAND_SHAPE = Object.freeze({
  palm: {len: 0.40, wristW: 0.15, knuckleW: 0.21, depth: 0.075},
  segs: [0.20, 0.16],         // 第 1・第 2 節の長さ(中指)
  tip: 0.30,                  // 指先の尖った節(長く鋭い)
  radius: [0.050, 0.040, 0.032],
  fingers: [[-0.150, 0.40, 0.78, -0.16], [-0.052, 0.42, 0.97, -0.05], [0.050, 0.42, 1.00, 0.05], [0.148, 0.40, 0.90, 0.15]],
  thumb: {x: 0.17, y: 0.10, len: 0.82, spread: -1.05},   // 大きく外へ開く
});
