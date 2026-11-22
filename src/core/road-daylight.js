/* 道(新)の「一日の旅路」の時間帯の光(ROAD-VISUAL-004 T1〜T5、DEC-028)。
   設計 `.ai/reports/ROAD-VISUAL-004-design.md` §3・§5-1。宵待ちの村(core/dusk-light.js)の作法を広げる:
   色は線形光の空間で補間(lerpHex)、目標は上がるだけ(戻らない)、実際の位置は数秒で追いつく。

   ■ 時間帯の「位置」(0〜5 の一本の数)
     0 DAY / 1 AFTERNOON / 2 SUNSET / 3 NIGHT / 4 DAWN(紺 → 薄紫)/ 4.5 朝焼け(橙)/ 5 金(低い朝日)
   ■ DEEP_NIGHT は位置とは別の重み(古き守り手の戦闘の間だけ 1 へ。村の duskDawnT と同じ形)
   ■ 結末の重み(T6)も別。最終戦の後に 0 → 1 で太陽を少し上げる

   ■ 守ること(DEC-028 E-2・K-11)
     光の強さは既存のマップの値の範囲の中(半球光 0.13〜0.52、太陽 0.15〜0.95、リム 0.14〜0.30)。
     露出は固定(今の道の値 0.96。設定の明るさは呼ぶ側が掛ける)。道(新)だけに当てる。

   state・THREE・scene に依存しない(ARCHITECTURE.md の core/ の作法)。 */
import { lerpHex } from './dusk-light.js';

export const ROAD_EXPOSURE = 0.96;
export const ROAD_SUN_DIST = Math.hypot(30, 45, 20);   // 太陽の位置(プレイヤーからの足し算)の長さ。今の既定 (30, 45, 20) と同じ(約 57.7。影のカメラ far 90 の中)

/* 時間帯の値。sunDir は太陽の方向(プレイヤーから見て。+x 東・+z 北・+y 上)。強さは範囲の中 */
export const ROAD_DAYLIGHT = Object.freeze([
  Object.freeze({pos:0,   name:'DAY',       sky:0x9ab8d0, fog:0.0048, sun:0xfff0d0, sunI:0.95, hemi:0.52, hemiSky:0xcfe0ee, hemiGnd:0x4a5a3a, rim:0xffd9a0, rimI:0.16, glow:0xffb050, sunDir:Object.freeze([30, 45, 20])}),
  Object.freeze({pos:1,   name:'AFTERNOON', sky:0xb0b4b8, fog:0.0055, sun:0xffd890, sunI:0.85, hemi:0.46, hemiSky:0xd6d0c0, hemiGnd:0x4a4a34, rim:0xffc080, rimI:0.18, glow:0xffb050, sunDir:Object.freeze([-28, 32, -12])}),
  Object.freeze({pos:2,   name:'SUNSET',    sky:0x9a6a70, fog:0.0070, sun:0xff9a5a, sunI:0.62, hemi:0.36, hemiSky:0xb08a90, hemiGnd:0x2a2028, rim:0xff8a4a, rimI:0.24, glow:0xffa040, sunDir:Object.freeze([-44, 12, -14])}),
  Object.freeze({pos:3,   name:'NIGHT',     sky:0x1a2240, fog:0.0100, sun:0x9aaae0, sunI:0.28, hemi:0.40, hemiSky:0x6070a8, hemiGnd:0x14141e, rim:0x7a9af0, rimI:0.30, glow:0xffc070, sunDir:Object.freeze([12, 50, -18])}),
  Object.freeze({pos:4,   name:'DAWN',      sky:0x46466a, fog:0.0095, sun:0xc0a0d0, sunI:0.32, hemi:0.32, hemiSky:0x8a8ab8, hemiGnd:0x221e2a, rim:0xc8a0d0, rimI:0.24, glow:0xffb060, sunDir:Object.freeze([30, 3, 40])}),
  Object.freeze({pos:4.5, name:'DAWN_ORANGE', sky:0xc08a70, fog:0.0080, sun:0xffa060, sunI:0.55, hemi:0.34, hemiSky:0xd0a090, hemiGnd:0x3a2a28, rim:0xffa060, rimI:0.24, glow:0xffb050, sunDir:Object.freeze([30, 5, 40])}),
  Object.freeze({pos:5,   name:'DAWN_GOLD', sky:0xe0c090, fog:0.0062, sun:0xffd090, sunI:0.80, hemi:0.42, hemiSky:0xe8d4b0, hemiGnd:0x4a4030, rim:0xffd080, rimI:0.20, glow:0xffb050, sunDir:Object.freeze([30, 7, 40])}),
]);
/* DEEP_NIGHT(重み 1 の時の値)。古き守り手の戦闘の間の重さ。見やすさの下限: 半球光 0.16 以上(T7 で主人公の周りの明るさを測って決めた) */
export const ROAD_DEEP_NIGHT = Object.freeze({sky:0x0e1226, fog:0.0135, sun:0x8090d0, sunI:0.22, hemi:0.24, hemiSky:0x46549a, hemiGnd:0x0c0c14, rim:0x6a8af0, rimI:0.30, glow:0xffd080, sunDir:Object.freeze([8, 52, -16])});
/* 結末の値(重み 1 の時)。太陽の高さ約 12°、光が白に近づく */
export const ROAD_ENDING = Object.freeze({sky:0xd8d0b8, fog:0.0055, sun:0xfff0d8, sunI:0.88, hemi:0.46, hemiSky:0xe8e0cc, hemiGnd:0x4a4a3a, rim:0xffe0a0, rimI:0.18, glow:0xffb050, sunDir:Object.freeze([30, 11, 40])});

export const ROAD_COLOR_KEYS = Object.freeze(['sky', 'sun', 'hemiSky', 'hemiGnd', 'rim', 'glow']);
export const ROAD_NUMBER_KEYS = Object.freeze(['fog', 'sunI', 'hemi', 'rimI']);
export const ROAD_LIMITS = Object.freeze({hemi:[0.13, 0.52], sunI:[0.15, 0.95], rimI:[0.14, 0.30]});

/* z(北へ進んだ距離)による昼 → 夕暮れの位置(戻らないのは呼ぶ側が max を取る)
   N-2(z 146)までは昼。原野の後半で午後、谷の入口(R3-01、z 304)から夕暮れへ、山道の野営地(z 458)で最も深い夕暮れ */
export const ROAD_DAY_Z = Object.freeze([[146, 0], [280, 1], [310, 1.5], [458, 2]]);
/* 夜明けの位置: 古き守り手の撃破(遺構の中庭 z 592)で 4.0 → 峠(R4-06、z 632)で 4.5 → R5-01(z 650)で 4.8 → 石環(R5-02、z 706)で 5.0 */
export const ROAD_DAWN_Z = Object.freeze([[592, 4.0], [632, 4.5], [650, 4.8], [706, 5.0]]);
/* 夜が始まる所(森に入る R4-01 の帯の始まり)と、守り手を倒さずに抜けた時に夜明けが始まる所(遺構の北の端) */
export const ROAD_NIGHT_Z = 468;
export const ROAD_DAWN_PASS_Z = 615;

function interpZ(table, z){
  if(!(z > table[0][0])) return table[0][1];
  for(let i = 1; i < table.length; i++){
    const [z1, v1] = table[i], [z0, v0] = table[i - 1];
    if(z <= z1) return v0 + (v1 - v0) * (z - z0) / (z1 - z0);
  }
  return table[table.length - 1][1];
}

/* 目標の位置。area はエリアの番号、z はプレイヤーの z。
   nightBegun: 森に入った(または森の中にいる)。dawnBegun: 古き守り手を倒した(または遺構の北の端を過ぎた・道の果てにいる) */
export function roadDaylightTarget({area, z, nightBegun, dawnBegun}){
  const zz = Number.isFinite(z) ? z : 0;
  if(dawnBegun || area >= 5 || zz >= ROAD_DAWN_PASS_Z) return Math.max(4, interpZ(ROAD_DAWN_Z, zz));
  if(nightBegun || (area === 4 && zz >= ROAD_NIGHT_Z)) return 3;
  return Math.min(2, interpZ(ROAD_DAY_Z, zz));
}

/* 出撃し直した時の初めの位置(設計 §3-1)。到達したエリアから。保存は増やさない */
export function roadDaylightStart(roadArea){
  const a = Math.floor(Number(roadArea) || 0);
  if(a >= 5) return 4.6;
  if(a === 4) return 2;
  if(a === 3) return 1.5;
  return 0;
}

/* 目標は上がるだけ(戻らない) */
export function advanceRoadDaylight(cur, target){
  const c = Number.isFinite(cur) ? cur : 0;
  return Number.isFinite(target) ? Math.max(c, target) : c;
}

/* 実際の位置を目標へ。1 位置ぶんを secPer 秒で。dt は 0.1 秒で頭打ち。後ろへは戻らない */
export function stepRoadDaylight(pos, target, dt, secPer = 3.5){
  const p = Number.isFinite(pos) ? pos : 0, t = Number.isFinite(target) ? target : p;
  const d = Math.min(0.1, Math.max(0, Number.isFinite(dt) ? dt : 0));
  if(!(t > p) || !(d > 0)) return p;
  return Math.min(t, p + d / Math.max(0.001, secPer));
}

/* 重み(DEEP_NIGHT・結末)を 0/1 の目標へ sec 秒で近づける */
export function stepRoadWeight(w, on, dt, sec = 3){
  const v = Number.isFinite(w) ? w : 0, d = Math.min(0.1, Math.max(0, Number.isFinite(dt) ? dt : 0));
  const t = on ? 1 : 0;
  if(v === t) return v;
  const s = d / Math.max(0.001, sec);
  const r = on ? Math.min(1, v + s) : Math.max(0, v - s);
  return Math.abs(r - t) < 1e-9 ? t : r;   // 端で止める(小数の残りで重みが 0 に戻らないことが無いように)
}

function mix(a, b, k){
  const out = {};
  for(const key of ROAD_NUMBER_KEYS) out[key] = a[key] + (b[key] - a[key]) * k;
  for(const key of ROAD_COLOR_KEYS) out[key] = lerpHex(a[key], b[key], k);
  out.sunDir = a.sunDir.map((v, i)=> v + (b.sunDir[i] - v) * k);
  return out;
}

/* 位置と重みから、その瞬間の光。sunDir は長さ ROAD_SUN_DIST にそろえる。exposure は固定 */
export function roadDaylight(pos, deepW = 0, endW = 0){
  const T = ROAD_DAYLIGHT;
  const p = Math.max(0, Math.min(5, Number.isFinite(pos) ? pos : 0));
  let i = 0;
  while(i < T.length - 2 && p > T[i + 1].pos) i++;
  const a = T[i], b = T[i + 1], k = Math.max(0, Math.min(1, (p - a.pos) / (b.pos - a.pos)));
  let L = mix(a, b, k);
  const dw = Math.max(0, Math.min(1, deepW || 0)), ew = Math.max(0, Math.min(1, endW || 0));
  if(dw > 0) L = mix(L, ROAD_DEEP_NIGHT, dw);
  if(ew > 0) L = mix(L, ROAD_ENDING, ew);
  const n = Math.hypot(L.sunDir[0], L.sunDir[1], L.sunDir[2]) || 1;
  L.sunDir = L.sunDir.map(v => v / n * ROAD_SUN_DIST);
  L.exp = ROAD_EXPOSURE;
  return L;
}
