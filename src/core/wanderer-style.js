/* 影の旅人の戦い方(WANDERER-RENEWAL-001、AD-005)。

   「影と半拍ずれて戦う旅人」 ―― 本人が斬り、足元の影が 0.45 秒遅れて同じ所を
   もう一度斬る。本人は素手で、戦っている間だけ右手の影が細い刃になる。

   ここに置くのは数値・判定の形・キーフレームだけ(純関数。state・THREE・scene に
   依存しない。ARCHITECTURE.md の core/ の作法)。実際に敵へ当てる・残像を描くのは
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
   arc … 元の位置・向きの弧 / circle … 残像のまわり / back … 影の側からこちらへ向かう弧 */
export const WANDERER_ECHO = Object.freeze({
  finish: {shape: 'arc',    dmgMul: 0.6, staggerMul: 1.0, ultGauge: 2},
  skill1: {shape: 'circle', dmgMul: 0.8, staggerMul: 1.4, ultGauge: 2, radius: 2.4},
  skill2: {shape: 'back',   dmgMul: 1.5, staggerMul: 1.6, ultGauge: 3, range: 3.4, angle: Math.PI * 70 / 180},
});

/* Skill 1「影残し」 ―― 第一章の固定 Skill 1 の枠('retreat'。UI-002 HD-1 の各職の
   'retreat' と同じキー)。前へ一撃を入れて退き、元の場所に影を残す */
export const WANDERER_SKILL1 = Object.freeze({
  key: 'retreat', name: '影残し', icon: '🌘',
  desc: '前へ一撃を入れて大きく退く。元の場所に残った影が、少し遅れて周りを薙ぐ',
  baseMult: 1.2, maxMult: 2.4, mode: 'single', vfxColor: 0x8a5ad6,
  movement: 'retreat', dist: 2.8, duration: 0.24, echo: 'skill1',
});

/* Skill 2「影渡り」(道で閃く) ―― 影を地面に走らせ、線の先から斬り返させる */
export const WANDERER_SKILL2 = Object.freeze({
  key: 'shadowPass', name: '影渡り', icon: '👥',
  desc: '影を前へ走らせる。影は線の先に立ち、少し遅れてこちらへ斬り返す(挟み撃ち)',
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
   shL / shR 肩の Euler、elL / elR 肘、hip / knee、wep = [刃の軸 xyz, 刃の平 xyz]、
   push / drop / lift は見た目だけの体の移動)。

   構え: 低く半身、重心は後ろ足。右手は腰の高さで影の刃を前下へ向け、左手は胸の前で
   開く(盾でも拳でもない「影に触れる手」)。片手持ち(grip 'R')。 */
export const WANDERER_STANCE = Object.freeze({
  waist: [0.10, 0.20, 0.00],
  shL: [-0.95, 0.10, 0.40], elL: -1.25,
  shR: [-0.30, -0.06, -0.22], elR: -0.70,
  wep: [0.250, -0.350, 0.900, 0.050, -0.930, -0.350],
  hipL: 0.12, hipR: -0.14, kneeL: 0.22, kneeR: 0.16,
  grip: 'R', armSwing: 0.55, tip: 0.85,
});

/* 休め: 両手を下ろし、片足に重心。肩は落とす(刃はほどけているので wep は構えのまま) */
export const WANDERER_RELAXED = Object.freeze({
  waist: [0.04, 0.06, 0.01],
  shL: [-0.10, 0.05, 0.16], elL: -0.22,
  shR: [-0.10, -0.05, -0.16], elR: -0.24,
  hipL: 0.06, hipR: -0.02, kneeL: 0.14, kneeR: 0.04,
});

/* 武器(影の刃)の握りのずれ */
export const WANDERER_GRIP_OFFSET = Object.freeze([0, 0.02, 0.03]);

function F(t, o){ const out = Object.assign({}, o); out.t = t; return out; }

/* 各クリップの長さ(秒)と、最初の振り抜き(当たり)のキーフレームの位置。
   影の旅人は Hit 遅延なし(入力と同時に判定。盗賊と同じ)なので、振り抜きは
   クリップの前半(0.16〜0.30)に置く */
export const WANDERER_CLIP_DUR = Object.freeze({
  basic: 0.30, basic2: 0.28, basic3: 0.40, retreat: 0.34, shadowPass: 0.46,
  dash: 0.30, spin: 0.34, ult: 0.70, hold: 1,
});
export const WANDERER_CLIP_CONTACT = Object.freeze({
  basic: 0.20, basic2: 0.16, basic3: 0.24, retreat: 0.22, shadowPass: 0.30,
  dash: 0.20, spin: 0.22, ult: 0.45,
});

/* st: 構え(05 では STANCE.wanderer = WANDERER_STANCE)。各クリップは構えで始まり、
   構えで終わる(どの技の後も必ず構えへ戻る) */
export function buildWandererClips(st){
  const S = Object.assign({}, st || WANDERER_STANCE);
  const at = (o) => Object.assign({}, S, o);
  return {
    dur: Object.assign({}, WANDERER_CLIP_DUR),

    // ① 払い: 体を先に左へひねって溜め、右の刃を左前から右へ払い抜ける
    basic: [
      F(0.00, at({e: 'slow', push: -0.04})),
      F(0.20, {e: 'snap', push: 0.26, drop: 0.08, waist: [0.02, -0.58, 0.10],
        shL: [-0.70, 0.12, 0.62], elL: -1.40,
        shR: [-1.10, -0.20, -0.45], elR: -0.55, wep: [-0.750, 0.120, 0.650, -0.100, -0.980, 0.120],
        hipL: 0.18, hipR: -0.20, kneeL: 0.20, kneeR: 0.22, grip: 'R'}),
      F(0.48, {e: 'settle', push: 0.32, drop: 0.06, waist: [0.12, 0.66, -0.10],
        shL: [-0.85, 0.08, 0.30], elL: -1.10,
        shR: [-0.60, 0.26, 0.85], elR: -1.05, wep: [0.780, 0.120, -0.610, 0.150, -0.980, 0.050],
        hipL: -0.18, hipR: 0.22, kneeL: 0.26, kneeR: 0.10, grip: 'R'}),
      F(1.00, at({})),
    ],

    // ② 返し: 左の掌で影を押し出し(左腕が伸びる)、右の刃で下から斬り上げる
    basic2: [
      F(0.00, {e: 'snap', push: 0.24, drop: 0.06, waist: [0.10, 0.62, -0.10],
        shL: [-0.85, 0.08, 0.30], elL: -1.10,
        shR: [-0.60, 0.26, 0.85], elR: -1.05, wep: [0.780, 0.120, -0.610, 0.150, -0.980, 0.050],
        hipL: -0.16, hipR: 0.20, kneeL: 0.24, kneeR: 0.10, grip: 'R'}),
      F(0.16, {e: 'snap', push: 0.34, drop: 0.12, waist: [0.16, -0.28, 0.04],
        shL: [-1.48, 0.04, 0.08], elL: -0.12,
        shR: [-0.36, -0.10, -0.36], elR: -1.25, wep: [0.300, -0.800, 0.520, 0.000, -0.540, -0.840],
        hipL: -0.26, hipR: 0.18, kneeL: 0.34, kneeR: 0.12, grip: 'R'}),
      F(0.44, {e: 'settle', push: 0.30, lift: 0.04, waist: [-0.10, 0.30, -0.05],
        shL: [-0.80, 0.10, 0.45], elL: -1.20,
        shR: [-1.62, 0.10, -0.12], elR: -0.30, wep: [0.200, 0.900, 0.380, 0.100, -0.400, 0.910],
        hipL: 0.10, hipR: -0.12, kneeL: 0.16, kneeR: 0.18, grip: 'R'}),
      F(1.00, at({})),
    ],

    // ③ 踏み込みの振り下ろし: 右の刃を高く上げ、深く踏み込んで左下へ振り下ろして止まる。
    //   ここで影が残り、0.45 秒後に同じ弧をもう一度斬る(WANDERER_ECHO.finish)
    basic3: [
      F(0.00, at({e: 'slow', push: -0.08})),
      F(0.24, {e: 'snap', push: 0.12, lift: 0.04, waist: [-0.12, -0.45, 0.10],
        shL: [-1.20, 0.10, 0.30], elL: -0.60,
        shR: [-2.10, -0.20, -0.30], elR: -1.00, wep: [0.350, 0.800, -0.480, 0.900, -0.300, 0.300],
        hipL: 0.20, hipR: -0.20, kneeL: 0.14, kneeR: 0.20, grip: 'R'}),
      F(0.46, {e: 'settle', push: 0.56, drop: 0.22, waist: [0.34, 0.55, -0.14],
        shL: [-0.50, 0.20, 0.85], elL: -1.40,
        shR: [-0.70, 0.20, 0.70], elR: -0.25, wep: [-0.550, -0.550, 0.620, -0.600, 0.780, 0.150],
        hipL: -0.45, hipR: 0.40, kneeL: 0.50, kneeR: 0.08, grip: 'R'}),
      F(0.72, {e: 'settle', push: 0.46, drop: 0.16, waist: [0.30, 0.50, -0.12],
        shL: [-0.55, 0.18, 0.80], elL: -1.35,
        shR: [-0.75, 0.18, 0.62], elR: -0.30, wep: [-0.520, -0.580, 0.620, -0.600, 0.780, 0.150],
        hipL: -0.40, hipR: 0.36, kneeL: 0.46, kneeR: 0.08, grip: 'R'}),
      F(1.00, at({})),
    ],

    // Skill 1 影残し: 刃を前へ一閃 → 低いまま後ろへ滑る(左手は前へ残す)
    retreat: [
      F(0.00, at({e: 'slow', push: 0.04})),
      F(0.22, {e: 'snap', push: 0.30, drop: 0.10, waist: [0.20, 0.10, 0.00],
        shL: [-0.40, 0.10, 0.60], elL: -1.40,
        shR: [-1.45, -0.05, -0.15], elR: -0.10, wep: [0.050, 0.050, 1.000, 0.000, -1.000, 0.050],
        hipL: -0.30, hipR: 0.25, kneeL: 0.35, kneeR: 0.12, grip: 'R'}),
      F(0.50, {e: 'settle', push: -0.30, drop: 0.18, waist: [0.25, -0.30, 0.06],
        shL: [-1.10, 0.05, 0.30], elL: -0.60,
        shR: [-0.50, -0.10, -0.40], elR: -0.90, wep: [0.250, -0.450, 0.860, 0.050, -0.880, -0.470],
        hipL: 0.35, hipR: -0.30, kneeL: 0.30, kneeR: 0.50, grip: 'R'}),
      F(0.78, {e: 'settle', push: -0.15, drop: 0.10, waist: [0.16, 0.05, 0.02],
        shL: [-1.00, 0.08, 0.36], elL: -0.95,
        shR: [-0.36, -0.08, -0.28], elR: -0.80, wep: [0.250, -0.380, 0.890, 0.050, -0.920, -0.380],
        hipL: 0.20, hipR: -0.18, kneeL: 0.24, kneeR: 0.30, grip: 'R'}),
      F(1.00, at({})),
    ],

    // Skill 2 影渡り: しゃがみ込み、左の掌を床へ当てて影を送る(本人はその場)
    shadowPass: [
      F(0.00, at({e: 'slow'})),
      F(0.30, {e: 'snap', drop: 0.26, waist: [0.50, 0.12, 0.00],
        shL: [-1.05, 0.05, 0.12], elL: -0.20,
        shR: [-0.20, -0.10, -0.60], elR: -1.00, wep: [0.200, -0.600, -0.770, 0.000, -0.790, 0.610],
        hipL: -0.62, hipR: 0.02, kneeL: 0.95, kneeR: 0.62, grip: 'R'}),
      F(0.64, {e: 'settle', drop: 0.20, waist: [0.42, 0.10, 0.00],
        shL: [-1.00, 0.05, 0.14], elL: -0.28,
        shR: [-0.24, -0.10, -0.55], elR: -0.95, wep: [0.200, -0.600, -0.770, 0.000, -0.790, 0.610],
        hipL: -0.52, hipR: 0.00, kneeL: 0.82, kneeR: 0.52, grip: 'R'}),
      F(1.00, at({})),
    ],

    // 回避攻撃: 低く飛び込んで突く
    dash: [
      F(0.00, at({e: 'slow', push: 0.08, drop: 0.08})),
      F(0.20, {e: 'snap', push: 0.40, drop: 0.22, waist: [0.30, -0.10, 0.00],
        shL: [-0.30, 0.20, 0.70], elL: -1.60,
        shR: [-1.50, -0.05, -0.10], elR: -0.05, wep: [0.050, -0.050, 1.000, 0.900, 0.300, 0.000],
        hipL: -0.55, hipR: 0.40, kneeL: 0.55, kneeR: 0.10, grip: 'R'}),
      F(0.50, {e: 'settle', push: 0.45, drop: 0.12, waist: [0.24, 0.10, 0.00],
        shL: [-0.60, 0.15, 0.60], elL: -1.30,
        shR: [-1.20, -0.05, -0.20], elR: -0.30, wep: [0.150, -0.200, 0.970, 0.900, 0.300, 0.000],
        hipL: -0.40, hipR: 0.30, kneeL: 0.42, kneeR: 0.10, grip: 'R'}),
      F(1.00, at({})),
    ],

    // 切り上げ: 左手と一緒に、右の刃で下から掬い上げる
    spin: [
      F(0.00, at({e: 'slow', drop: 0.06})),
      F(0.22, {e: 'snap', lift: 0.10, waist: [-0.20, -0.20, 0.04],
        shL: [-1.60, -0.05, 0.20], elL: -0.30,
        shR: [-2.20, 0.10, -0.20], elR: -0.40, wep: [0.100, 0.950, 0.280, 0.000, -0.280, 0.960],
        hipL: -0.10, hipR: 0.10, kneeL: 0.10, kneeR: 0.16, grip: 'R'}),
      F(0.55, {e: 'settle', lift: 0.04, waist: [-0.10, -0.10, 0.02],
        shL: [-1.20, 0.00, 0.30], elL: -0.70,
        shR: [-1.70, 0.05, -0.20], elR: -0.60, wep: [0.150, 0.900, 0.400, 0.000, -0.400, 0.920],
        hipL: 0.00, hipR: 0.02, kneeL: 0.14, kneeR: 0.16, grip: 'R'}),
      F(1.00, at({})),
    ],

    // 必殺技 影送り: 低く沈んで腕を抱え(影を集める)、両手を一気に広げる。
    //   接触(=判定)は t 0.45(core/ult-clips.js の 'ult' と同じ位置)
    ult: [
      F(0.00, at({e: 'slow'})),
      F(0.30, {e: 'slow', drop: 0.28, waist: [0.40, 0.00, 0.00],
        shL: [-0.80, 0.30, 0.90], elL: -1.80,
        shR: [-0.80, -0.30, -0.90], elR: -1.80, wep: [-0.300, -0.900, 0.300, 0.000, 0.320, 0.950],
        hipL: -0.50, hipR: -0.50, kneeL: 0.90, kneeR: 0.90, grip: 'R'}),
      F(0.45, {e: 'snap', lift: 0.08, waist: [-0.15, 0.00, 0.00],
        shL: [-0.50, 0.00, -1.20], elL: -0.10,
        shR: [-0.50, 0.00, 1.20], elR: -0.10, wep: [0.950, 0.000, 0.300, 0.000, -1.000, 0.000],
        hipL: -0.08, hipR: 0.08, kneeL: 0.10, kneeR: 0.10, grip: 'R'}),
      F(0.78, {e: 'settle', lift: 0.02, waist: [-0.04, 0.00, 0.00],
        shL: [-0.40, 0.00, -0.80], elL: -0.30,
        shR: [-0.40, 0.00, 0.80], elR: -0.30, wep: [0.900, -0.200, 0.380, 0.000, -1.000, 0.000],
        hipL: -0.02, hipR: 0.04, kneeL: 0.14, kneeR: 0.14, grip: 'R'}),
      F(1.00, at({})),
    ],

    // 溜め(Skill 1 のボタンを押している間): 刃を後ろへ引き、左手を前へ
    hold: [
      F(0.00, at({e: 'slow'})),
      F(1.00, {push: -0.10, drop: 0.12, waist: [0.16, -0.50, 0.08],
        shL: [-1.30, 0.08, 0.20], elL: -0.40,
        shR: [-0.10, -0.20, -0.70], elR: -1.40, wep: [-0.200, -0.300, -0.930, 0.000, -0.950, 0.300],
        hipL: -0.20, hipR: 0.14, kneeL: 0.34, kneeR: 0.20, grip: 'R'}),
    ],
  };
}
