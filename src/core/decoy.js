/* デコイ ―― 「敵が実際に向かっている先」を差し替えるための共通の仕組み。

   ■ なぜ汎用なのか
   最初に使うのは魔法使いの Skill 1「幻影歩法」(MAGE-001)だが、村の怪異は
   この先も「対象をずらす」ことを前提に増えていく(写し身は誰の動きを写すのか、
   泡沫は何に群がるのか)。幻影専用の分岐を敵ごとに書くと、敵が増えるたびに
   同じ判断が散らばるので、「今この敵は誰へ向かうか」だけをここに集約した。

   ■ 敵は一律に釣られない
   敵ごとに decoyPull(0..1)を持たせ、0 なら幻影を一切見ない。
   「全部の敵が必ず幻影へ行く」ようにすると、幻影歩法が必須の攻略法に
   なってしまう ―― 使わなくても勝てて、使うと有利、の幅をここで作る。

   ■ 当たり判定は動かさない
   このモジュールが答えるのは「接近・向き直り・攻撃を始める基準点」だけ。
   実際に命中するかどうかは今までどおりプレイヤーの座標で判定する
   (呼び出し側の責任)。だから敵は幻影へ向かって攻撃し、自然に空振りする。

   state・THREE・scene に依存しない(ARCHITECTURE.md の core/ の作法)。 */

// 幻影が残る時間と、引きつけられる距離。実機調整前の暫定値
export const PROVISIONAL_PHANTOM_LIFE_SEC = 5.0;
export const PROVISIONAL_PHANTOM_LURE_RADIUS = 11.0;

// 敵ごとの「幻影の見やすさ」。1 = そのまま釣られる / 0 = 一切見ない
export const DECOY_PULL = {
  mirror: 1.0,   // 水鏡の影: 水面に映るものを追う。いちばん素直に釣られる
  foam:   0.7,   // 泡沫の群れ: ゆらぎに群がるが、近くに本物がいれば戻る
  copy:   0.35,  // 写し身: プレイヤー本人を見ているので、釣られにくい
  fisher: 0.6,   // 記憶漁師: 網は幻影へも飛ぶが、本物の足取りを優先する
  keeper: 0.5,   // 水門守の残響: 水門のほうを見ている。寄れば気を逸らせる
  charge: 0.8,
};

export function decoyPullFor(kind){
  const v = DECOY_PULL[kind];
  return v == null ? 1 : v;
}

/* 幻影の寿命を進める。expired を返したら、呼び出し側が実体を片付ける。 */
export function stepDecoyLife(decoy, dt){
  const life = Math.max(0, (decoy && decoy.life != null ? decoy.life : 0) - dt);
  return {life, expired: life <= 0};
}

/* この敵がいま向かうべき先。デコイが無い/釣られない敵なら null を返し、
   呼び出し側はプレイヤーの座標へ落ちる。

   引きつけ距離は pull で伸び縮みする ―― 釣られにくい敵は、よほど近くに
   幻影が無いかぎり本物を見続ける。 */
export function pickLureTarget(pos, decoys, opts){
  opts = opts || {};
  const pull = opts.pull != null ? opts.pull : 1;
  if(pull <= 0 || !decoys || !decoys.length) return null;
  const radius = (opts.radius != null ? opts.radius : PROVISIONAL_PHANTOM_LURE_RADIUS) * pull;
  let best = null, bestD = radius;
  for(let i=0;i<decoys.length;i++){
    const d = decoys[i];
    if(!d || d.life <= 0) continue;
    const dx = d.x - pos.x, dz = d.z - pos.z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    if(dist < bestD){ bestD = dist; best = d; }
  }
  return best;
}

/* 敵の「向かう先」。デコイが選ばれればその座標、無ければプレイヤーの座標。
   呼び出し側はこの1関数だけを見ればよく、幻影の有無を意識しなくて済む。 */
export function aggroTarget(pos, playerPos, decoys, opts){
  const lure = pickLureTarget(pos, decoys, opts);
  return lure ? {x: lure.x, z: lure.z, decoy: lure} : {x: playerPos.x, z: playerPos.z, decoy: null};
}
