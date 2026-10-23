/* 宵待ちの村の敵の見た目の表(CH1-COMP W3-E)。

   ■ 何を持つか
   見た目だけの「数値の表」と、AI の状態から見た目(足元の輪・姿勢)を決める純粋関数。
   敵の数値(HP・攻撃力・判定の半径・時刻・速さ)は**変えない**。判定の半径は今の値を
   ここへ定数として移しただけで、AI(07-ai-combat.js)と足元の輪の両方がこの定数を読む
   ―― だから「見えている輪 = 当たる範囲」が作りの上で一致する。

   ■ 色の決め方(DEC-008「味方の色と離れている」)
   村の夜は青い。味方(プレイヤーの配色表 PLAYER_PALETTE と CLASSES の色)は紺・水色・
   深緑・炭・紫に集まっている。敵の主な色は「古い写真のような、褪せた記憶」の
   中間の明るさ(セピア・灰紫・オリーブ・錆・泡の白緑)に置き、
   CIE76 の ΔE で味方の色から 15 以上、敵どうしで 12 以上離す(tests/unit/dusk-enemies.test.js)。
   暗い色(L* < 35: 影・下地・水の裾)は面積が小さく「暗い所」として読まれ、
   味方どうしでも暗色は互いに近い(剣士の紺と魔導士の襟、旅人の炭など)ので、
   距離の検査から外す(表の shade / water に置く)。

   ■ 材質
   布は roughness ≥ 0.8・metalness 0(艶を出さない。洋館の敵の 0.74〜0.98 に合わせる)。
   光源は足さない(村の PointLight の数は tests/unit/village-load.test.js が見張っている)。

   state・THREE・scene に依存しない(ARCHITECTURE.md の core/ の作法)。 */
import { PROVISIONAL_ECHO_RADIUS, KEEPER_STRIKE_FRAC, ECHO_HARM_FRAC } from './warden-echo.js';

export const VILLAGE_KINDS = ['mirror', 'foam', 'copy', 'fisher', 'warden', 'echoBoss'];

/* =========================================================
   判定の半径(今の値のまま。ここへ移しただけ)
   ========================================================= */
export const MIRROR_STRIKE_RADIUS = 2.4;   // 水鏡の影・分身の一撃(全周)。以前は AI の中の 2.4
export const MIRROR_STRIKE_SEC = 0.22;     // 一撃の当たる窓(AI の strike の長さ。今の値)
export const FOAM_CONTACT_RADIUS = 1.5;    // 泡沫が触れて弾ける距離。以前は AI の中の 1.5
export const BOSS_MELEE_REACH_PAD = 0.4;   // ボスの近接: 当たるのは atkReach + 0.4 以内(全周)。今の値
export const DUSK_BOSS_ECHO_SCALE = 1.5;   // ボスの段階 3 の残響の大きさ(判定もこの倍率。今の値)
export const DUSK_BOSS_ECHO_RADIUS = PROVISIONAL_ECHO_RADIUS * DUSK_BOSS_ECHO_SCALE;   // 3.6
export const FOAM_SCALE = 0.62;            // 泡沫の大きさ(今の値)
export const WARDEN_SCALE = 1.18;          // 水門守の残響の大きさ(今の値)

/* ボスの近接の当たる距離。updateBossAI と足元の輪の両方が使う */
export function bossMeleeHitRadius(atkReach){
  const r = Number(atkReach);
  return (isFinite(r) && r > 0 ? r : 2.2) + BOSS_MELEE_REACH_PAD;
}

/* =========================================================
   足元の輪の色・太さ
   危険の色(暖色)で、既存の輪(漁師 0xff8a3a・水門守 0xff5a36・残響 0xffd04a・
   段階移行の爆発 0xff7a4a)と色相を分ける。
   ボスの近接はボスの分身(水鏡と同じ扱い)と同じ色 ―― 色で本体が分かってしまうと、
   「挙動の差で見分ける」が成り立たない(差は時刻と半径に残る)
   ========================================================= */
export const RING_COLORS = {
  mirror: 0xff5c8a,     // 薔薇色。水鏡の影・分身・ボスの分身
  foam: 0xffc27a,       // 淡い琥珀。触れると弾ける距離(薄く、満ちない)
  bossMelee: 0xff5c8a,  // ボスの近接(分身と同じ色)
  echo: 0xffd04a,       // 残響(水門守・ボスとも。W2-MB2 の黄のまま)
};
export const EXISTING_RING_COLORS = {
  fisher: 0xff8a3a, keeper: 0xff5a36, keeperEcho: 0xffd04a, phaseBurst: 0xff7a4a,
};
export const RING_STYLE = {
  mirror:    {width: 0.2,  ringOpacity: 0.85, fillOpacity: 0.28},
  foam:      {width: 0.08, ringOpacity: 0.34, fillOpacity: 0.0, noFill: true},
  bossMelee: {width: 0.24, ringOpacity: 0.9,  fillOpacity: 0.28},
};

/* =========================================================
   配色(主 main・差し色 accent は味方の色から離す。shade/water は暗い下地)
   ========================================================= */
export const VILLAGE_PALETTE = {
  // 水鏡の影: 夕暮れの水面に映った村人。濡れた灰紫の衣と、褪せた薔薇色の肩掛け・頭巾
  mirror: {main: 0x857590, accent: 0xc4a0b0, shade: 0x3a3242, water: 0x4c4458, face: 0x2b2433},
  // 泡沫: 水面の泡。白緑の泡と、少し濃い緑の芯
  foam:   {main: 0xb8c9a8, accent: 0x9cb88a, shade: 0x5e6e58},
  // 写し身: 色を抜かれた長い外套(魔法使いの青を使わない)。顔は暗い水
  copy:   {main: 0x7b7568, accent: 0xc8bfa8, shade: 0x45413a, face: 0x1d2629, orb: 0x9fd8ff},
  // 記憶漁師: 油引きの外套(オリーブ)、縄と網(麻色)
  fisher: {main: 0x7f7a48, accent: 0xc8a07a, shade: 0x3e3a2c, face: 0x2e2a24, hat: 0x5a5638},
  // 水門守の残響: 錆びた革の前掛けと上着、鈍い鉄の鎖
  warden: {main: 0x9a6a5a, accent: 0x908c84, shade: 0x3a2c28, face: 0x2c2624, iron: 0x5c5a56},
  // 村の残響(ボス): 褪せたセピアの胴と前掛け、漁師の帽子と門番の鎖、水の裾
  echoBoss: {main: 0xa39278, accent: 0xd8b88a, shade: 0x40382e, face: 0x232a2e, water: 0x2f3c44,
             hat: 0x7f7a48, chain: 0x908c84},
};
/* 残響(水門守・ボスの段階 3)の姿の色。演出の幽霊(spawnApparition、0x7fb0c4 などの青灰)
   と取り違えない暖かい琥珀。当たる残響も当たらない残響も同じ色で、差は濃さ・姿勢・輪 */
export const ECHO_FIGURE_COLOR = 0xe0b090;
export const APPARITION_COLOR = 0x7fb0c4;   // 参照用(演出の幽霊。変えない)
export const ECHO_OPACITY = {operate: 0.46, walk: 0.2};   // 引いた残響は濃く、歩いた跡は薄い

/* 材質(roughness / metalness)。布は ≥ 0.8 / 0 */
export const VILLAGE_FINISH = {
  cloth:   {roughness: 0.92, metalness: 0},
  skin:    {roughness: 0.9,  metalness: 0},
  foam:    {roughness: 0.86, metalness: 0},
  rope:    {roughness: 0.95, metalness: 0},
  iron:    {roughness: 0.8,  metalness: 0},   // 鎖・鉤も艶を出さない(濡れた鉄の鈍さ)
  water:   {roughness: 0.82, metalness: 0},
  emissiveIntensity: 0.04,                   // 胴の自発光(暗がりで潰れない最小限。強調表示の基準値になる)
};

/* 体つき(ローカル座標、group の拡大前)。dressVillageEnemy が読む */
/* footprint: 見た目の足元の水平の広がり(拡大前)。近接の当たりの半径(en.hitRadius)は
   これ × group の拡大。胴の外接球(measureHitRadius)は背丈に引っ張られて横に広くなりすぎるため */
export const VILLAGE_PROPORTIONS = {
  mirror: {height: 1.72, shoulderW: 0.46, torsoY: 1.18, armLen: 0.62, footprint: 0.4},
  foam:   {height: 0.9},
  copy:   {height: 2.05, shoulderW: 0.38, torsoY: 1.36, armLen: 0.66, footprint: 0.4},
  fisher: {height: 1.7,  shoulderW: 0.6,  torsoY: 1.2,  armLen: 0.86, hunch: 0.28, footprint: 0.4},
  warden: {height: 1.95, shoulderW: 0.8,  torsoY: 1.38, armLen: 0.8,  footprint: 0.46},
  echoBoss: {height: 4.3, shoulderW: 1.55, torsoY: 2.35, armLen: 2.0},
};
/* 人型の当たりの半径(ワールド)。拡大(水門守 1.18)を掛ける */
export function villageHitRadius(kind, scale){
  const p = VILLAGE_PROPORTIONS[kind];
  if(!p || p.footprint == null) return null;
  return p.footprint * (scale != null ? scale : 1);
}

/* 泡沫の塊(ローカル座標、拡大前)。1 つ目が胴(被弾の白が乗る)。
   当たりの半径は塊の水平方向の広がり × FOAM_SCALE */
export const FOAM_CLUSTER = [
  {x: 0.0,   y: 0.42, z: 0.0,   r: 0.34},
  {x: 0.3,   y: 0.28, z: 0.12,  r: 0.22},
  {x: -0.26, y: 0.26, z: -0.1,  r: 0.2},
  {x: 0.04,  y: 0.72, z: -0.14, r: 0.17},
];
export function foamVisualRadius(cluster){
  const c = cluster || FOAM_CLUSTER;
  let r = 0;
  for(const b of c) r = Math.max(r, Math.hypot(b.x, b.z) + b.r);
  return r;
}
export function foamHitRadius(scale){
  return foamVisualRadius() * (scale != null ? scale : FOAM_SCALE);
}

/* =========================================================
   足元の輪の出し入れ(AI の状態を読むだけ。null = 出さない、0..1 = 満ち具合)
   ========================================================= */
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

/* 水鏡の影・分身: 溜め(本体 0.72 / 分身 0.34 秒。観測の灯で伸び縮みしても AI が決めた長さ)
   の始めに 0、終わりに 1。一撃の窓(0.22 秒)のあいだ、まだ当たっていなければ満ちたまま残し、
   当たった・窓が閉じたら消す。倒れている・ダウン中・敵対していない間は出さない */
export function mirrorRingProgress(en){
  if(!en || en.dead || en.knockedDown || !en.triggered) return null;
  if(en.mirrorState === 'windup'){
    const dur = Number(en.mirrorWindupDur), T = Number(en.mirrorT);
    if(!isFinite(dur) || !isFinite(T) || dur <= 0) return null;
    return clamp01(1 - Math.max(0, T) / dur);
  }
  if(en.mirrorState === 'strike' && !en.mirrorHit && Number(en.mirrorT) > 0) return 1;
  return null;
}

/* 泡沫: 敵対している間ずっと、触れると弾ける距離を薄く見せる(時刻は示さない) */
export function foamRingVisible(en){
  return !!en && !en.dead && !en.knockedDown && !!en.triggered;
}

/* ボスの近接: 振りかぶり(0.55 / 段階 3 で 0.4 秒)の始めに 0、当たる瞬間に 1。
   当たった後(atkWindup が落ちる)・崩れている間は出さない */
export function bossMeleeRingProgress(en){
  if(!en || en.dead || en.knockedDown || !en.triggered || !en.atkWindup) return null;
  const dur = Number(en.atkWindupDur), T = Number(en.atkWindupT);
  if(!isFinite(dur) || !isFinite(T) || dur <= 0) return null;
  return clamp01(1 - Math.max(0, T) / dur);
}

/* =========================================================
   姿勢(見た目だけ。AI の状態を読む)
   ========================================================= */
export const MIRROR_PULL = 1.05;    // 溜めで腕を後ろへ引く量(rad)× 引きの深さ(本体 1 / 分身 0.45)

/* 水鏡の影: 溜めで腕を引き(深さに比例)、一撃で前へ振り抜く。arm は肩の x 回転(+ = 後ろ) */
export function mirrorPose(state, progress, depth){
  const k = clamp01(Number(progress) || 0);
  const d = Math.max(0, Number(depth) || 0);
  if(state === 'windup') return {arm: MIRROR_PULL * d * k, lean: -0.22 * d * k, spread: 0.25 * k};
  if(state === 'strike'){
    const from = MIRROR_PULL * d;
    const ease = 1 - (1 - k) * (1 - k);
    return {arm: from + (-1.35 - from) * ease, lean: 0.18 * ease, spread: 0.25 + 0.35 * ease};
  }
  return {arm: 0, lean: 0, spread: 0};
}

/* 水門守: 予備動作(windup)で両腕を上げて鎖を掴み、引く(operate)。
   引ききる(pull = 1)のは当たる瞬間(引いている間の KEEPER_STRIKE_FRAC)。
   その後は引いたまま、終わりにかけて腕が戻る */
export function keeperPose(keeperState, keeperT, keeperDur){
  const dur = Number(keeperDur), T = Number(keeperT);
  const prog = isFinite(dur) && dur > 0 && isFinite(T) ? clamp01(1 - Math.max(0, T) / dur) : 0;
  if(keeperState === 'windup') return {reach: prog, pull: 0};
  if(keeperState === 'operate'){
    if(prog <= KEEPER_STRIKE_FRAC) return {reach: 1, pull: clamp01(prog / KEEPER_STRIKE_FRAC)};
    const back = clamp01((prog - KEEPER_STRIKE_FRAC) / (1 - KEEPER_STRIKE_FRAC));
    return {reach: 1 - back, pull: 1 - back};
  }
  return {reach: 0, pull: 0};
}

/* 「引いた」残響: 出た瞬間に腕は上がっていて(予備動作が無い = 本体との差)、
   当たる瞬間(寿命の ECHO_HARM_FRAC)に引ききる */
export function echoPose(lifeProgress){
  const p = clamp01(Number(lifeProgress) || 0);
  if(p <= ECHO_HARM_FRAC) return {reach: 1, pull: clamp01(p / ECHO_HARM_FRAC)};
  const back = clamp01((p - ECHO_HARM_FRAC) / (1 - ECHO_HARM_FRAC));
  return {reach: 1 - back, pull: 1 - back};
}

/* 写し身: 写しの溜め(1.25 秒。灯りで伸びる)の進み具合。写していない時は null */
export function copyMimicProgress(copyState, copyT, copyDur){
  if(copyState !== 'mimic') return null;
  const dur = Number(copyDur), T = Number(copyT);
  if(!isFinite(dur) || dur <= 0 || !isFinite(T)) return null;
  return clamp01(1 - Math.max(0, T) / dur);
}

/* =========================================================
   色の距離(CIE76 ΔE、sRGB → Lab D65)。テストと調整用
   ========================================================= */
export function hexToLab(hex){
  const ch = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map(v => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const [r, g, b] = ch;
  let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  let y = (r * 0.2126 + g * 0.7152 + b * 0.0722);
  let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  x = f(x); y = f(y); z = f(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
export function deltaE(a, b){
  const A = hexToLab(a), B = hexToLab(b);
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}
export const ALLY_MIN_DELTA_E = 15;    // 敵の主な色 ↔ 味方の色
export const KIND_MIN_DELTA_E = 12;    // 敵の主な色どうし
export const DARK_L_MAX = 35;          // これより暗い色は距離の検査から外す(上の説明)

/* 残響の判定(=輪)の半径。水門守 2.4、ボス 3.6 */
export function echoRadiusFor(scale){
  return PROVISIONAL_ECHO_RADIUS * (scale || 1);
}
