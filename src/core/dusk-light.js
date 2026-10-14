/* 宵待ちの村の時間帯の光(CH1-EXP X-6a)。

   ■ 何を直したか
   旧実装(14-dungeon-duskvillage.js の updateDuskVillage)は、空・霧の色と
   光の強さは帯の間で補間していたが、**太陽・半球光・リムライトの色だけ**は
   `k < 0.5 ? a : b` で帯の中間点を境に選び替えていた。広場(z 332〜370)と
   船小屋(z 300〜322)を行き来すると z ≈ 318 をまたぐたびに光の色が
   1 フレームで入れ替わり、空は連続して変わるのに景色だけ跳んで見えた
   (.ai/reports/CHAPTER-1-experience-audit.md §6)。

   ここでは光の色も、空と同じ補間にそろえる。
     - 帯の値そのもの(DUSK_BANDS / DUSK_DAWN)は旧実装から動かしていない。
       帯の端点(z = 284 / 352 / 438 / 534)での色・強さは旧実装と同じ
     - 色の補間は three.js の Color.lerp と同じ「線形光の空間」で行う
       (ColorManagement が有効な r154 では、setHex した sRGB を線形へ直して
       から lerp する)。旧実装の空の色はそのやり方で補間されていたので、
       空の見え方は変わらない
     - 夜明け(duskDawnT)との混ぜ方も、強さと同じく連続にする。旧実装は
       d > 0.5 で光の色を夜明けへ切り替えていた

   何で時間帯を決めるか(今はプレイヤーの z)は、この関数の外の話
   (bandPos を渡す側)。X-6b(物語の進行で暮れる)は bandPos の作り方だけを
   差し替える。

   state・THREE・scene には依存しない(ARCHITECTURE.md の core/ の作法)。 */

// 時間帯の帯。夕暮れ(入口)→薄暮(広場/商店街)→夜に近づく(水門)→夜(奥/ボス)
export const DUSK_BANDS = Object.freeze([
  Object.freeze({z:284, sky:0x3a2038, fog:0.013, sun:0xff9a5a, sunI:0.58, hemi:0.34, hemiSky:0x9a6a6a, hemiGnd:0x1e1420, rim:0xff8a4a, rimI:0.24, exp:0.84}),  // 夕暮れ
  Object.freeze({z:352, sky:0x2a1d3c, fog:0.018, sun:0xd08aa8, sunI:0.44, hemi:0.28, hemiSky:0x76629a, hemiGnd:0x18122a, rim:0xa06ac8, rimI:0.22, exp:0.78}),  // 薄暮
  Object.freeze({z:438, sky:0x141428, fog:0.026, sun:0x6a7ac0, sunI:0.26, hemi:0.19, hemiSky:0x3a4a7a, hemiGnd:0x0a0a16, rim:0x5a7ad0, rimI:0.20, exp:0.70}),  // 夜に近づく
  Object.freeze({z:534, sky:0x080814, fog:0.034, sun:0x3a4a90, sunI:0.15, hemi:0.13, hemiSky:0x22305a, hemiGnd:0x06060c, rim:0x3a5ac0, rimI:0.18, exp:0.64}),  // 夜
]);
// 撃破後の夜明け
export const DUSK_DAWN = Object.freeze({sky:0x5a6a8a, fog:0.016, sun:0xffd2a0, sunI:0.62, hemi:0.42, hemiSky:0xbcc8e0, hemiGnd:0x2a2a30, rim:0xffb070, rimI:0.22, exp:0.88});

export const DUSK_COLOR_KEYS = Object.freeze(['sky', 'sun', 'hemiSky', 'hemiGnd', 'rim']);
export const DUSK_NUMBER_KEYS = Object.freeze(['fog', 'sunI', 'hemi', 'rimI', 'exp']);

const clamp01 = v => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));

/* z を「帯の位置」へ。0 = 夕暮れの帯、1 = 薄暮、2 = 夜に近づく、3 = 夜。
   帯の間は線形。範囲の外は端の帯に張り付く(旧実装と同じ) */
export function duskBandPosAtZ(z, bands = DUSK_BANDS){
  const n = bands.length;
  if(!(z > bands[0].z)) return 0;
  if(z >= bands[n-1].z) return n - 1;
  for(let i = 0; i < n - 1; i++){
    if(z >= bands[i].z && z <= bands[i+1].z){
      const span = bands[i+1].z - bands[i].z;
      return i + (span > 0 ? (z - bands[i].z) / span : 0);
    }
  }
  return n - 1;
}

/* sRGB ⇔ 線形光(three.js の SRGBToLinear / LinearToSRGB と同じ式) */
function toLinear(c){ return c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4); }
function toSRGB(c){ return c < 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 0.41666) - 0.055; }
function hexToLinear(hex){
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map(v => toLinear(v / 255));
}
function linearToHex(rgb){
  const [r, g, b] = rgb.map(v => Math.round(clamp01(toSRGB(clamp01(v))) * 255));
  return (r << 16) | (g << 8) | b;
}
/* 2 色の補間(Color.lerp と同じく線形光の空間で)。t は 0..1 */
export function lerpHex(a, b, t){
  const k = clamp01(t);
  if(k <= 0) return a;
  if(k >= 1) return b;
  const A = hexToLinear(a), B = hexToLinear(b);
  return linearToHex(A.map((v, i) => v + (B[i] - v) * k));
}

/* 帯の位置と夜明けの進み(0..1)から、その瞬間の光を返す。
   色は 16 進(setHex にそのまま渡せる)、ほかは数値 */
export function duskLight(bandPos, dawnT = 0, bands = DUSK_BANDS, dawn = DUSK_DAWN){
  const n = bands.length;
  const p = Math.max(0, Math.min(n - 1, Number.isFinite(bandPos) ? bandPos : 0));
  const i = Math.min(n - 2, Math.floor(p));
  const a = bands[i], b = bands[i + 1];
  const k = p - i;
  const d = clamp01(dawnT);
  const out = {};
  for(const key of DUSK_NUMBER_KEYS){
    out[key] = (a[key] + (b[key] - a[key]) * k) * (1 - d) + dawn[key] * d;
  }
  for(const key of DUSK_COLOR_KEYS){
    out[key] = lerpHex(lerpHex(a[key], b[key], k), dawn[key], d);
  }
  return out;
}

/* =========================================================
   物語の進行で暮れる(CH1-EXP X-6b、DEC-006 EX-2 = A)

   時間帯の帯の位置を、プレイヤーの z ではなく **村で起きた出来事** で決める。
   出来事は 4 つ。どれも出撃 1 回につき 1 回だけ起きる:
     入口の一幕(村に入る)/ 閃き(商店街の戦闘の後、または水門前)/ 水門守の撃破 / ボスの手前
   出来事が起きると「目標の帯の位置」が上がり、実際の帯の位置はそこへ
   数秒かけて近づく(色は duskLight が帯の間を連続に補間する)。

   - 目標は上がるだけで、下がらない。引き返しても、出来事が起き直しても
     時間帯は巻き戻らない(advanceDuskTarget は max を取る)
   - 実際の帯の位置も、目標の手前から戻らない(stepDuskBandPos)
   - 値はセーブに入れない。出撃のたびに夕暮れ(0)から始まる ―― 出来事も
     出撃のたびに起き直すので、時間帯と出来事が食い違わない
   - 夜明け(duskDawnT)はこれまでどおり別に重ねる

   目標の値は、旧実装の z による帯の位置で、それぞれの出来事が起きる場所に
   おおむね合わせてある(入口 z≈312 → 0.4、水門前 z≈402 → 1.6、水門 z≈446
   → 2.1、村の奥の終点 z≈496 → 2.6)。ボスの手前で夜(3)まで暮れる。 */
export const DUSK_BEAT_TARGET = Object.freeze({
  entrance: 0.5,   // 村に入る。夕暮れから薄暮へ向かい始める
  insight:  1.5,   // 閃き。薄暮の終わり
  warden:   2.2,   // 水門守の撃破。夜に近づく
  prelude:  3,     // ボスの手前。夜
});
// 帯 1 つぶんを何秒で進むか。3.5 秒で 1 帯(色の変化が数秒で見える速さ)
export const DUSK_BAND_SEC = 3.5;

/* 出来事が起きたあとの目標。知らない出来事・数値でない値は無視する */
export function advanceDuskTarget(currentTarget, beat){
  const cur = Number.isFinite(currentTarget) ? currentTarget : 0;
  const t = DUSK_BEAT_TARGET[beat];
  return Number.isFinite(t) ? Math.max(cur, t) : cur;
}

/* 実際の帯の位置を目標へ近づける。後ろへは戻さない。dt は秒 */
export function stepDuskBandPos(pos, target, dt, bandSec = DUSK_BAND_SEC){
  const p = Number.isFinite(pos) ? pos : 0;
  const t = Number.isFinite(target) ? target : p;
  if(!(t > p) || !(dt > 0)) return p;
  return Math.min(t, p + dt / Math.max(0.001, bandSec));
}
