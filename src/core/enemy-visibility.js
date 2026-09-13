/* 遮蔽物による視界制限の純粋計算(探索・視界システムの土台)。
   three.js・scene・state に依存しないので tests/unit/ から直接呼べる。

   ■ 設計方針
   「見えない」ではなく「情報が限定されている」状態を作る。真っ暗にして
   遊びづらくするのは禁止、という要求があるので、可視段階を3つに分ける:

     'visible' … 遮蔽が無く索敵距離の内側。今まで通り完全に見える
     'sensed'  … 直前まで見えていた / 交戦中で気配だけは分かる。
                 輪郭(xrayシェル)とミニマップの点だけが薄く残る
     'hidden'  … 壁の向こうで、こちらを認識もしていない。情報を出さない

   'sensed' を挟むのが肝で、これが無いと「壁の陰に入った瞬間に敵が消える」
   という理不尽になる。逆に、交戦中(triggered)の敵は必ず 'sensed' 以上を
   保証するので、追ってきている敵を見失って一方的に殴られることは無い。

   遮蔽判定そのものは既存の hasLineOfSight()(02-world-common.js、
   walls の AABB を線分サンプリングする)をそのまま使う。新しい遮蔽
   システムは作らない ―― 既に敵AIが「壁越しにプレイヤーを見つけない」
   ために使っている、実績のある同じ判定を、描画側にも共有させるだけ。 */

// 遮蔽が無くてもこの距離を超えたら見えない(探索時の「奥は霞む」)
export const SIGHT_RANGE = 34;
// 見失ってから気配が消えるまで
export const MEMORY_SECONDS = 2.2;
// 交戦中の敵の気配が届く距離(この内側なら壁越しでも必ず 'sensed' 以上)
export const THREAT_SENSE_RANGE = 14;

export const VIS_ALPHA = { visible: 1, sensed: 0.38, hidden: 0 };

/* 1体ぶんの可視状態を進める。
   prevMemoryT は前フレームのこの関数が返した memoryT をそのまま渡す。

   引数:
     los        … hasLineOfSight(敵, プレイヤー) の結果
     distance   … 敵とプレイヤーの水平距離
     dt         … 前フレームからの秒数
     triggered  … 交戦状態(既存の en.triggered)
     isBoss     … ボスは演出・ダイアログ・ロックオンカメラがすべて
                  「見えている」前提なので常に 'visible'。既存のボス戦を
                  一切変えないための例外
     sightRange … 索敵距離(ダンジョンごとに霧が濃ければ縮められる)
*/
export function stepVisibility(opts){
  const {
    los = true, distance = 0, dt = 0, triggered = false, isBoss = false,
    prevMemoryT = 0, sightRange = SIGHT_RANGE,
    memorySeconds = MEMORY_SECONDS, threatRange = THREAT_SENSE_RANGE,
  } = opts || {};

  if(isBoss) return { level:'visible', alpha:1, memoryT:memorySeconds };

  const inSight = !!los && distance <= sightRange;
  if(inSight) return { level:'visible', alpha:1, memoryT:memorySeconds };

  const memoryT = Math.max(0, (prevMemoryT || 0) - (dt || 0));
  // 交戦中で近い敵は気配が消えない ―― 追跡されている事実は必ず伝える
  const threatSensed = triggered && distance <= threatRange;
  if(memoryT > 0 || threatSensed){
    // 記憶が薄れるほど輪郭も薄くなる。交戦中は下限を持たせる
    const fade = memorySeconds > 0 ? memoryT / memorySeconds : 0;
    const alpha = Math.max(threatSensed ? VIS_ALPHA.sensed : 0, VIS_ALPHA.sensed * fade);
    return { level:'sensed', alpha, memoryT };
  }
  return { level:'hidden', alpha:0, memoryT:0 };
}

/* ミニマップに出してよいか。
   現状は生きている敵をすべて正確な位置で描いていて、「壁の向こうに何か
   いるかもしれない」という緊張感を丸ごと打ち消していた。見えている敵
   だけを出す。 */
export function minimapVisible(level){
  return level === 'visible';
}

/* 戦闘時ハイライト(優先度S-6「敵の視認/戦闘時ハイライト」)の強さ。
   通常時は静か、重要な瞬間だけ光る、という方針どおり:
     ふつうに見えている       … 0(光らせない)
     こちらに気づいて交戦中   … 弱く
     攻撃の予兆中             … 強く(危険の伝達)
     瀕死(処刑可能)         … 強く(フィニッシュの合図)
   数値はそのまま emissiveIntensity 等へ渡せる 0..1。 */
export function threatHighlight(opts){
  const { level = 'visible', triggered = false, windup = false, finishable = false } = opts || {};
  if(level === 'hidden') return 0;
  let v = 0;
  if(triggered) v = 0.18;
  if(windup) v = Math.max(v, 0.75);
  if(finishable) v = Math.max(v, 0.60);
  return level === 'sensed' ? v * 0.5 : v;
}

/* ネームド(既存の midbossName 個体)の方向マーキング。
   正確な位置は出さず、8方位の文字列だけを返す。 */
const COMPASS = ['北','北東','東','南東','南','南西','西','北西'];
export function bearingLabel(fromX, fromZ, toX, toZ){
  const dx = toX - fromX, dz = toZ - fromZ;
  if(dx === 0 && dz === 0) return null;
  // three.js のワールドは +Z が手前(南)、-Z が奥(北)
  const deg = (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360;
  return COMPASS[Math.round(deg / 45) % 8];
}
