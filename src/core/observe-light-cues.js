/* 観測の灯の見え方(CH1-DUSK-IMMERSION C、DEC-010)。

   観測の灯(core/mirror-shade.js の OBSERVE_*)の**効果は変えない**。使った結果を画面で
   読み取れるように、見え方だけを足す:
     1. 届く範囲: 掲げた瞬間、足元から半径 OBSERVE_RADIUS まで淡い寒色の輪が一度だけ広がって消える
     2. 効いている怪異: 灯りが届いていて、灯りで挙動が変わる怪異の頭上に灯の粒。
        本体と分身は同じ粒(どれが本物かは出さない)。灯りで変わらない敵には出さない
     3. 差そのもの: 灯りの下の水鏡の影・分身の波紋を、灯りの色で少し濃くする
     4. 効果中: 頭上の球・粒は、残り 1/4 で一緒に薄れて消える

   色は灯りと同じ寒色。敵の予兆の輪(暖色・縁あり・満ちる)と、色と動き(広がって消える)で分ける。
   state・three.js に依存しない定数と計算だけ。 */
import { OBSERVE_LIGHT_SEC } from './mirror-shade.js';

export const OBSERVE_CUE = Object.freeze({
  color: 0xbfe6ff,          // 掲げた灯り(spawnObserveLightVFX の球)と同じ色
  pulseSec: 1.1,            // 届く範囲の輪が広がって消えるまで
  pulseOpacity: 0.45,
  moteOpacity: 0.8,
  rippleOpacity: 0.46,      // 灯りの下の波紋(ふだんは 0.32)
});

/* 灯りで挙動が変わる怪異(村の印 villageKind)。それぞれの AI が observeReaches を読む:
   mirror = updateMirrorShadeAI(波紋・向き直り・溜め)、copy = updateCopyShadeAI(写しの溜め)、
   fisher = updateFisherAI(網の溜め)、warden = updateKeeperAI(残響の遅れ)。
   泡沫(foam)は灯りで変わらないので入れない */
export const OBSERVE_AFFECTED_KINDS = Object.freeze(['mirror', 'copy', 'fisher', 'warden']);

/* 頭上の粒の高さ(group の拡大前のローカル座標)。帽子・頭巾の少し上 */
export const OBSERVE_MOTE_Y = Object.freeze({mirror: 2.05, copy: 2.45, fisher: 2.0, warden: 2.4});

/* 残り秒数 → 濃さ(0..1)。最後の 1/4 で薄れる(頭上の球と同じ) */
export function observeFade(remainSec, totalSec = OBSERVE_LIGHT_SEC){
  if(!(remainSec > 0)) return 0;
  const t = 1 - Math.min(1, remainSec / totalSec);
  return t < 0.75 ? 1 : Math.max(0, 1 - (t - 0.75) / 0.25);
}

/* 粒を出すか。灯りが効いている(残りがある・届いている)、灯りで変わる種類、倒れていない */
export function showObserveMote(kind, {observing, dead}){
  return !!observing && !dead && OBSERVE_AFFECTED_KINDS.includes(kind);
}

/* 届く範囲の輪の大きさ(経過 0..pulseSec → 半径 0.6..radius、濃さ pulseOpacity..0) */
export function observePulse(elapsedSec, radius, cue = OBSERVE_CUE){
  const k = Math.min(1, Math.max(0, elapsedSec / cue.pulseSec));
  const ease = 1 - (1 - k) * (1 - k);
  return {radius: 0.6 + (radius - 0.6) * ease, opacity: cue.pulseOpacity * (1 - k), done: k >= 1};
}
