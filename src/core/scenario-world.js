/* シナリオの鍵 → 建てるワールドの鍵(ROAD-VISUAL-003 R3-7、DEC-032)。
   第一章の「道」は、保存・進行(scenarioClears.road)・第一章の順番のためにシナリオの鍵 'road' のまま、
   ワールドは新しい道 'road2'(14-dungeon-road2.js)を建てる。旧道のワールドは消した。
   ここに無い鍵はシナリオの鍵とワールドの鍵が同じ。state・THREE・scene に依存しない */
export const SCENARIO_WORLD = Object.freeze({road: 'road2'});

export function scenarioWorldKey(key){
  return Object.prototype.hasOwnProperty.call(SCENARIO_WORLD, key) ? SCENARIO_WORLD[key] : key;
}
