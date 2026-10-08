/* 第一章③ 幽霊船の本筋と、物語の置き場所の並び(CG-04)。

   幽霊船はこの環境(software rendering)では歩いて回れない。そこで、本筋の
   入口・扉・階段・ボスの座標をソースから読み、CG-02/03 で置いた会話が
   本筋の「どの区間」に入っているかを、本筋の順番どおりに確かめる。
   扉・階段は鍵も関門も持たない(本筋で詰まらない)ことも見る。
   本筋: 桟橋 → dockDoor → 晩餐の間 → messDoor → 控えの廊下 → crewDoor →
         船長室 → cabinDoor → 甲板 → 階段(6,108) → 貨物室 → 階段(23,122) →
         船倉の奥 → bossHoldDoor → 船長
   (.ai/reports/CHAPTER1-GHOSTSHIP-checklist.md) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ship = fs.readFileSync(path.join(root, 'src/legacy/parts/04-dungeons-ship-waterway.js'), 'utf8');
const combat = fs.readFileSync(path.join(root, 'src/legacy/parts/07-ai-combat.js'), 'utf8');

const num = '(-?\\d+(?:\\.\\d+)?)';
function door(key){
  const m = ship.match(new RegExp(`buildDoor\\('${key}',\\s*${num},\\s*${num},\\s*${num},\\s*[^,)]+(?:,\\s*'(NS|EW)')?\\)`));
  assert.ok(m, key);
  return { x: +m[1], z: +m[2], w: +m[3], orient: m[4] || 'EW' };
}
function stairs(x, z){
  const re = new RegExp(`buildStairs\\(new THREE\\.Vector3\\(${x},0,${z}\\),\\s*new THREE\\.Vector3\\(${num},0,${num}\\),\\s*'[^']*',\\s*[^,]+,\\s*'(up|down)'(,\\s*[^)]+)?\\)`);
  const m = ship.match(re);
  assert.ok(m, `stairs ${x},${z}`);
  return { x, z, to: { x: +m[1], z: +m[2] }, gate: m[4] ? m[4].replace(/^,\s*/, '') : null };
}
const story = (() => {
  const a = ship.indexOf('function buildGhostShipChapter1Story(){');
  return ship.slice(a, ship.indexOf('\n  }\n', a));
})();
/* 物語の会話(registerProximityEvent)を、置き場所(点+半径 か 範囲)で拾う */
const events = [...story.matchAll(/registerProximityEvent\(new THREE\.Vector3\((-?[\d.]+),0,(-?[\d.]+)\),\s*(\d+(?:\.\d+)?),\s*(\w+),\s*\[\s*'([^']+)'([\s\S]*?)\}\);/g)]
  .map(m => {
    const area = m[6].match(/area:\{x0:(-?[\d.]+), x1:(-?[\d.]+), z0:(-?[\d.]+), z1:(-?[\d.]+)\}/);
    return { x: +m[1], z: +m[2], r: +m[3], first: m[5],
             area: area ? { x0: +area[1], x1: +area[2], z0: +area[3], z1: +area[4] } : null };
  });
const ev = text => {
  const e = events.find(e => e.first.includes(text));
  assert.ok(e, text);
  return e;
};

test('本筋の扉と階段: 鍵も関門も無く、桟橋から船長まで一続き', () => {
  const entry = ship.match(new RegExp(`const GHOST_SHIP_ENTRY = new THREE\\.Vector3\\(${num},0,${num}\\)`));
  assert.deepEqual([+entry[1], +entry[2]], [-13, 62], '入口は桟橋');
  const dock = door('dockDoor');
  assert.equal(dock.orient, 'NS');
  assert.ok(+entry[1] < dock.x && dock.z === 62, '桟橋 → dockDoor(東へ入る)');
  const mess = door('messDoor'), crew = door('crewDoor'), cabin = door('cabinDoor'), hold = door('bossHoldDoor');
  assert.ok(mess.z < crew.z && crew.z < cabin.z, 'messDoor(72) → crewDoor(80) → cabinDoor(95) と北へ進む');
  const toCargo = stairs(6, 108), toHold = stairs(23, 122);
  assert.ok(toCargo.z > cabin.z, '甲板の階段は cabinDoor の先');
  assert.equal(toCargo.gate, null); assert.equal(toHold.gate, null);
  assert.deepEqual(toCargo.to, { x: 30, z: 122 });
  assert.ok(Math.hypot(toCargo.to.x - toHold.x, toCargo.to.z - toHold.z) > 2.8, '貨物室に着いた所で、すぐ次の階段に乗らない');
  assert.deepEqual(toHold.to, { x: -32, z: 108 });
  assert.ok(toHold.to.z < hold.z && hold.x === toHold.to.x, '船倉の奥の着地点は bossHoldDoor の手前');
  assert.match(combat, /buildBoss\(new THREE\.Vector3\(-32,0,120\), \{\s*key:'ghostCaptain', bossDoorKey:'bossHoldDoor'/);
  /* 本筋の扉は、鍵(key)や撃破の関門(gateTag)を持たない ―― 6引数目以降は向きだけ */
  for (const k of ['dockDoor', 'messDoor', 'crewDoor', 'cabinDoor', 'bossHoldDoor']) {
    assert.doesNotMatch(ship, new RegExp(`(lockDoor|requireKey|keyDoor)\\('${k}'`), k);
  }
});

test('物語の会話は、本筋の区間に順番どおり入っている', () => {
  const mess = door('messDoor'), crew = door('crewDoor'), cabin = door('cabinDoor');
  const toCargo = stairs(6, 108);

  const corridor = ev('この船の人たちは、帰る場所');
  assert.ok(corridor.area.z0 >= mess.z && corridor.area.z1 <= crew.z, '晩餐の間を出た後、船長室の手前');
  assert.ok(corridor.area.x0 <= mess.x - mess.w / 2 && corridor.area.x1 >= mess.x + mess.w / 2,
    'messDoor の幅をまたぐ(扉を抜けたら必ず入る)');

  const clock = ev('七時十三分で止まって');
  assert.ok(clock.area.z0 > crew.z && clock.area.z1 < cabin.z, '船長室の中(crewDoor と cabinDoor の間)');
  assert.ok(clock.area.x0 < cabin.x - cabin.w / 2 && clock.area.x1 > cabin.x + cabin.w / 2, 'cabinDoor へ向かう道筋を覆う');

  const deckSeen = ev('陸のほうを見ていました');
  const deckMissed = ev('誰か立っていませんでしたか');
  for (const d of [deckSeen, deckMissed]) {
    const z = d.area ? d.area.z0 : d.z;
    assert.ok(z > cabin.z, '甲板(cabinDoor の先)');
  }
  assert.ok(deckMissed.area.z0 < toCargo.z - 2.8, '階段(半径2.8)に乗る前に、範囲へ入る');
  assert.ok(deckMissed.area.x0 < toCargo.x && deckMissed.area.x1 > toCargo.x, '階段へ向かう道筋の上');

  const holdLine = ev('分かっているつもりで');
  const landing = stairs(23, 122).to;
  assert.ok(Math.hypot(landing.x - holdLine.x, landing.z - holdLine.z) < holdLine.r, '船倉の奥の着地点で出る');

  /* 本筋の順番: 廊下 → 船長室 → 甲板 → 船倉の奥 */
  const order = [corridor.area.z0, clock.area.z0, deckMissed.area.z0];
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});
