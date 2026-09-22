/* Attack Snapshot ―― 「直前にプレイヤーが出した攻撃」を、あとで別の誰かが
   再生できる最小限の形で控えておくための仕組み(WORK 4)。

   最初に使うのは写し身(船小屋の怪異)だが、攻撃を丸ごと再現する仕組みを
   写し身専用に作らない ―― 記録するのは「何を・どこから・どちらへ・どれくらい」
   の4つだけで、再生の仕方は使う側が決める。記録できない攻撃は無理に
   写さない(isCopyable が false を返し、写し身はその回を見送る)。

   ■ 記録するもの
     kind  … 攻撃の種類。今は 'magicBolt'(魔法弾)だけが写せる
     x, z  … 撃った位置
     dirX, dirZ … 撃った向き(正規化済み)
     power … 威力。再生側は copyPowerMul を掛けて使う

   ■ 記録しないもの
     プレイヤーの装備・スフィア・ランク・クリティカル判定。写し身は
     「同じ形の攻撃を返す」だけで、プレイヤーの育成をそのまま鏡写しに
     しない ―― 強くなるほど自分の攻撃で死ぬ、にはしない。

   state・THREE・scene に依存しない(ARCHITECTURE.md の core/ の作法)。 */

// いまコピーできる攻撃。増やすときはここへ足す(未対応は安全に無視される)
export const COPYABLE_KINDS = ['magicBolt'];

// 写し身が返してくるまでの間と、威力の倍率。実機調整前の暫定値
export const PROVISIONAL_COPY_DELAY_SEC = 1.25;
export const PROVISIONAL_COPY_POWER_MUL = 0.8;

export function isCopyable(kind){
  return COPYABLE_KINDS.indexOf(kind) >= 0;
}

/* 記録を作る。写せない攻撃・壊れた入力には null を返す ――
   呼び出し側は「null なら何も控えない」だけでよい。 */
export function makeAttackSnapshot(src){
  if(!src || !isCopyable(src.kind)) return null;
  const dx = Number(src.dirX), dz = Number(src.dirZ);
  const len = Math.sqrt(dx*dx + dz*dz);
  if(!isFinite(len) || len < 1e-6) return null;
  const power = Number(src.power);
  if(!isFinite(power) || power <= 0) return null;
  return {
    kind: src.kind,
    x: Number(src.x) || 0,
    z: Number(src.z) || 0,
    dirX: dx / len,
    dirZ: dz / len,
    power,
    at: Number(src.at) || 0,
  };
}

/* 写し身が返す一撃。向きは「記録した向き」ではなく、再生する本人から
   狙った先へ向け直す ―― 記録の向きをそのまま使うと、プレイヤーが動いた
   あとでは明後日の方向へ撃つだけになり、「真似されている」と読めない。 */
export function replayPlan(snapshot, fromX, fromZ, toX, toZ, opts){
  if(!snapshot) return null;
  opts = opts || {};
  const dx = toX - fromX, dz = toZ - fromZ;
  const len = Math.sqrt(dx*dx + dz*dz);
  const dirX = len > 1e-6 ? dx/len : snapshot.dirX;
  const dirZ = len > 1e-6 ? dz/len : snapshot.dirZ;
  const mul = opts.powerMul != null ? opts.powerMul : PROVISIONAL_COPY_POWER_MUL;
  return {
    kind: snapshot.kind,
    dirX, dirZ,
    power: Math.max(1, Math.round(snapshot.power * mul)),
  };
}

/* 一度使ったら消える。写し身は「直前の一撃を1回だけ返す」ので、
   同じ記録を撃ち続けられないことをここで保証する。 */
export function consumeSnapshot(holder, field){
  const key = field || 'attackSnapshot';
  if(!holder) return null;
  const snap = holder[key] || null;
  holder[key] = null;
  return snap;
}
