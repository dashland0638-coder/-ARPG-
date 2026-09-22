/* Scenario Test Mode の「開始地点」(WORK 4)。

   ■ なぜ要るのか
   ヘッドレス環境は実プレイの1割ほどの速度しか出ず、村の入口から船小屋まで
   歩くだけで数分かかる(WORK 3 で住宅・船小屋の実機確認ができなかった)。
   開発中のシナリオを検証するには、途中から始められる必要がある。

   ■ 宵待ちの村専用にしない
   シナリオキー → 地点の表として持ち、幽霊船や時計塔でも同じ形で足せる。
   地点が登録されていないシナリオは、今までどおり入口から始まる。

   ■ 本編には出さない
   参照するのは Scenario Test Mode だけ(01-character-creation.js /
   14-hud-boot.js)。通常のゲームUI・セーブ・進行には一切現れない。

   state・THREE・scene に依存しない(ARCHITECTURE.md の core/ の作法)。 */

export const SCENARIO_WAYPOINTS = {
  duskvillage: [
    {id:'entry',    name:'村の入口',   x:0,    z:294},
    {id:'plaza',    name:'中央広場',   x:0,    z:350},
    {id:'fish',     name:'魚屋',       x:-45,  z:348},
    {id:'homes',    name:'住宅',       x:45,   z:348},
    {id:'boat',     name:'船小屋',     x:-40,  z:311},
    {id:'market',   name:'商店街',     x:0,    z:386},
    {id:'yard',     name:'水門前',     x:0,    z:416},
    {id:'sluice',   name:'水門',       x:0,    z:446},
    {id:'deep',     name:'村の奥',     x:0,    z:466},
    {id:'boss',     name:'水鏡の跡',   x:0,    z:515},
  ],
};

export function waypointsFor(scenarioKey){
  return SCENARIO_WAYPOINTS[scenarioKey] || [];
}

export function findWaypoint(scenarioKey, id){
  const list = waypointsFor(scenarioKey);
  for(let i=0;i<list.length;i++) if(list[i].id === id) return list[i];
  return null;
}
