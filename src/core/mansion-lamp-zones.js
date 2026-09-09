/* 洋館のランプ(点光源)を区画ごとに束ね、「いまどの区画に居るか」を選ぶ。

   洋館は区画どうしがテレポートで繋がった離れ島で、プレイヤーが2つの区画を
   同時に見ることはない。それでも点光源はシーンに居るだけで全マテリアルの
   シェーダに畳み込まれるので、居ない区画のランプぶんまで毎フレーム払って
   いた。ここはその「どの区画のランプを点けるか」の判断だけを持つ純粋な
   計算で、three.js には触れない(実際のライトの付け替えは
   legacy/parts/02-world-common.js 側)。

   区画の範囲は座標表に書き写さず、その区画に登録されたランプ自身の位置
   から作る。間取りを動かしたときに、ここだけ古い座標のまま取り残される
   ことがないようにするため。 */

/* ランプの登録一覧を区画ごとにまとめ、区画の矩形も出す。
   budget は「1区画に必要なランプの最大数」= 使い回す実体の数。 */
export function groupMansionLamps(specs){
  const zones = new Map();
  for(const sp of specs){
    let z = zones.get(sp.zone);
    if(!z){ z = {specs:[], x0:sp.x, x1:sp.x, z0:sp.z, z1:sp.z}; zones.set(sp.zone, z); }
    z.specs.push(sp);
    if(sp.x < z.x0) z.x0 = sp.x;
    if(sp.x > z.x1) z.x1 = sp.x;
    if(sp.z < z.z0) z.z0 = sp.z;
    if(sp.z > z.z1) z.z1 = sp.z;
  }
  let budget = 0;
  for(const z of zones.values()) budget = Math.max(budget, z.specs.length);
  return {zones, budget};
}

// 矩形までの距離の二乗(中に居れば0)
export function zoneDistSq(zone, x, z){
  const dx = Math.max(zone.x0 - x, 0, x - zone.x1);
  const dz = Math.max(zone.z0 - z, 0, z - zone.z1);
  return dx*dx + dz*dz;
}

/* いま居る区画。区画は互いに遠く離れているので、矩形までの距離が最小の
   ものを選べばよい。屋外(森)からは玄関のランプが最も近いので、自然に
   一階の区画が点いたままになる ―― 前庭から見える玄関の灯りが消えない。 */
export function pickMansionLampZone(zones, x, z){
  let best = null, bestD = Infinity;
  for(const [name, zone] of zones){
    const d = zoneDistSq(zone, x, z);
    if(d < bestD){ bestD = d; best = name; }
  }
  return best;
}
