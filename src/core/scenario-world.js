/* シナリオの鍵 → 建てるワールドの鍵(ROAD-VISUAL-003 R3-7、DEC-032)。
   第一章の「道」は、保存・進行(scenarioClears.road)・第一章の順番のためにシナリオの鍵 'road' のまま、
   ワールドは新しい道 'road2'(14-dungeon-road2.js)を建てる。旧道のワールドは消した。
   ここに無い鍵はシナリオの鍵とワールドの鍵が同じ。state・THREE・scene に依存しない */
export const SCENARIO_WORLD = Object.freeze({road: 'road2'});

export function scenarioWorldKey(key){
  return Object.prototype.hasOwnProperty.call(SCENARIO_WORLD, key) ? SCENARIO_WORLD[key] : key;
}

/* 逆向き: ワールドの鍵 → シナリオの鍵。敵の★(difficultyFor)は湧いたワールドの鍵で引くが、
   クリアの数はシナリオの鍵(scenarioClears.road)に数えるので、ここでそろえる */
export function scenarioKeyForWorld(worldKey){
  for(const k in SCENARIO_WORLD) if(SCENARIO_WORLD[k] === worldKey) return k;
  return worldKey;
}
