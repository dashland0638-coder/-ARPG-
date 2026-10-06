/* 第一章(本編)には異空間が存在しない(PROGRESSION-008、Human Decision 2026-10-05)。
   「存在するが報酬だけ制限」ではなく、裂け目そのものが出ない ―― 入口・戦闘・報酬・ログ・
   帰還はすべて裂け目に入った後の出来事なので、出現と入口で止める。
   本編/テストモードの切り替えは legacyGrowth()(= core/chapter1-rules.js の legacyGrowthEnabled。
   旧セーブ判定ではなく、新規プレイでも本編なら false)。異空間の本体は第二章以降のために残す。

   食堂はこの環境(software rendering)では歩いて着かない(tests/mansion-scenario.spec.js の
   メモ)ので、実物のソースを stub 付きで動かして確かめる。乱数は常に当たり(=変更前なら必ず出る) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const world = fs.readFileSync(path.join(root, 'src/legacy/parts/02-world-common.js'), 'utf8');

function fn(signature){
  const a = world.indexOf(signature);
  assert.ok(a >= 0, signature);
  return world.slice(a, world.indexOf('\n  }\n', a) + 4);
}
const constLine = name => world.split('\n').find(l => l.includes(`const ${name} =`));

function run({ testMode, key = 'mansion', enter = false }){
  const state = { testMode, pos: { clone: () => ({}) } };
  const logs = [];
  let rooms = 0;
  const code = [
    'let anomalyRifts = []; let inAnomalyRoom = false;',
    constLine('ANOMALY_SPAWN_CHANCE'),
    'const ANOMALY_RIFT_SPOTS = {mansion:{x:0}, ghostship:{x:1}};',
    fn('function spawnAnomalyRiftForWorld(key){'),
    fn('function enterAnomalyRoom(){'),
    `spawnAnomalyRiftForWorld(${JSON.stringify(key)});`,
    enter ? 'enterAnomalyRoom();' : '',
    'return { rifts: anomalyRifts.length, inAnomalyRoom };',
  ].join('\n');
  const deps = {
    state,
    legacyGrowth: () => !!state.testMode,
    Math: Object.assign(Object.create(Math), { random: () => 0 }),
    buildRift: spot => ({ spot }),
    // 入口から先(部屋の構築・敵・移動・ログ)は fadeTransition の中で起きる。呼ばれた回数を数える
    fadeTransition: () => { rooms++; },
    spawnLog: m => logs.push(m),
  };
  const out = new Function(...Object.keys(deps), code)(...Object.values(deps));
  return { ...out, rooms, logs };
}

test('第一章(本編): 乱数が当たっても異空間の裂け目は生成されない', () => {
  for (const key of ['mansion', 'ghostship']) {
    assert.equal(run({ testMode: false, key }).rifts, 0, key);
  }
});

test('第一章(本編): 異空間へ入る処理は動かず、部屋・敵・ログが生じない', () => {
  const r = run({ testMode: false, enter: true });
  assert.equal(r.inAnomalyRoom, false);
  assert.equal(r.rooms, 0);
  assert.deepEqual(r.logs, []);
});

test('テストモード(第一章後の基盤): 既存どおり 40% の判定で裂け目が出て、入れる', () => {
  const r = run({ testMode: true, enter: true });
  assert.equal(r.rifts, 1);
  assert.equal(r.inAnomalyRoom, true);
  assert.equal(r.rooms, 1);
});

test('異空間の本体(出現率・場所・部屋・敵・報酬・帰還)は残す', () => {
  assert.match(world, /const ANOMALY_SPAWN_CHANCE = 0\.4;/);
  for (const sig of ['function buildAnomalyRoom(){', 'function grantAnomalyReward(){',
    'function exitAnomalyRoom(){', 'function updateAnomalyRifts(dt){', 'function buildRift(pos){']) {
    assert.ok(world.includes(sig), sig);
  }
  const a = world.indexOf('const ANOMALY_RIFT_SPOTS = {');
  const spots = world.slice(a, world.indexOf('};', a));
  for (const k of ['mansion:', 'ghostship:', 'waterway:', 'temple:', 'conservatory:']) assert.ok(spots.includes(k), k);
});

test('判定は既存の第一章判定(legacyGrowth)で、出現の乱数より前に置く', () => {
  const lines = fn('function spawnAnomalyRiftForWorld(key){').split('\n').map(l => l.trim());
  assert.match(lines[1], /^if\(!legacyGrowth\(\)\) return;/);
  const enter = fn('function enterAnomalyRoom(){').split('\n').map(l => l.trim());
  assert.match(enter[1], /^if\(!legacyGrowth\(\)\) return;/);
});
