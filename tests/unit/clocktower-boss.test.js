/* 第一章④ 時計塔の最上階のボス「止刻の残響」(CLOCKTOWER-001)。

   以前のボス(時喰らい)の技 ―― 針を投げる・床を掃く針・巻き戻り ―― を残し、
     ・歯車を飛ばす(七時十三分は扇に三つ)
     ・止刻: 足元の輪(予兆 1.1 秒)。満ちた時に中にいると 0.7 秒だけ動けない(ダメージ無し。回避中・無敵中は掛からない)
     ・過去の残像: 巻き戻る前の場所に残像が残り、1 秒後に弾ける(輪の予兆つき)
     ・文字盤の針: 体力が減るほど七時十三分へ。七時十三分で間合いが詰まる
   を足した。本物の 07-ai-combat.js から関数・分岐を取り出して stub 付きで動かす */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const combat = fs.readFileSync(path.join(root, 'src/legacy/parts/07-ai-combat.js'), 'utf8');
function fn(src, signature){
  const a = src.indexOf(signature);
  assert.ok(a >= 0, signature);
  return src.slice(a, src.indexOf('\n  }\n', a) + 4);
}
const constLine = name => combat.match(new RegExp(`const ${name} = [^;]*;`))[0];
const minute = new Function(constLine('TOWER_STOP_R') + fn(combat, 'function towerBossMinute(hpRatio){') + 'return towerBossMinute;')();

test('文字盤の針: 満タンで七時十分、体力が四分の一減るごとに一分進み、四分の一以下で七時十三分', () => {
  assert.equal(minute(1), 10);
  assert.equal(minute(0.8), 10);
  assert.equal(minute(0.74), 11);
  assert.equal(minute(0.5), 12);
  assert.equal(minute(0.26), 12);
  assert.equal(minute(0.25), 13);
  assert.equal(minute(0), 13);
  assert.equal(minute(-0.1), 13);
});

function clockHarness(){
  const log = { toasts: [], clock: [], hits: [], bursts: 0, scene: new Set() };
  const apparitions = [];
  const code = [
    constLine('TOWER_STOP_R'), constLine('TOWER_ECHO_R'),
    fn(combat, 'function towerBossMinute(hpRatio){'),
    fn(combat, 'function towerBossEcho(en, from){'),
    fn(combat, 'function clearTowerBossFx(en){'),
    fn(combat, 'function updateTowerBossClock(en, dt){'),
    'return { echo: towerBossEcho, tick: updateTowerBossClock, clear: clearTowerBossFx };',
  ].join('\n');
  const V3 = class { constructor(x=0,y=0,z=0){ this.x=x; this.y=y; this.z=z; } };
  const state = { pos: { x: 0, z: 0 } };
  const api = new Function('THREE', 'state', 'scene', 'apparitions', 'spawnApparition', 'bossVfx', 'spawnToast', 'setTowerClock',
    'spawnUltimateVFX', 'sfx', 'bossHitPlayer', code)(
    { Vector3: V3, Mesh: class { constructor(){ this.position = { set(){} }; this.rotation = {}; } }, RingGeometry: class {}, MeshBasicMaterial: class {}, DoubleSide: 2 },
    state, { add: m => log.scene.add(m), remove: m => log.scene.delete(m) }, apparitions,
    () => { const g = {}; apparitions.push({ group: g, state: 'in' }); return g; },
    (en, m) => { (en.vfx = en.vfx || []).push(m); return m; },
    t => log.toasts.push(t), (h, m) => log.clock.push(`${h}:${m}`),
    () => { log.bursts++; }, () => {}, (en, dmg) => log.hits.push(dmg));
  return { api, log, state, apparitions };
}

test('文字盤の針: 分が進むたびにトーストと巨大時計の針。最初の一回は黙って合わせる', () => {
  const h = clockHarness();
  const en = { hp: 1180, hpMax: 1180, atk: 48, group: { position: { x: 0, y: 45, z: 0 } } };
  h.api.tick(en, 0.016);
  assert.deepEqual(h.log.clock, ['7:10']);
  assert.equal(h.log.toasts.length, 0);
  en.hp = 590; h.api.tick(en, 0.016);
  assert.deepEqual(h.log.clock, ['7:10', '7:12']);
  assert.match(h.log.toasts[0], /七時12分/);
  en.hp = 200; h.api.tick(en, 0.016);
  assert.match(h.log.toasts[1], /七時十三分を指した/);
  h.api.tick(en, 0.016);
  assert.equal(h.log.toasts.length, 2, '同じ分では繰り返さない');
});

test('過去の残像: 巻き戻る前の場所に残り、1 秒後に弾ける。範囲の中にいると当たる(外なら当たらない)', () => {
  for (const [px, hit] of [[1, true], [6, false]]) {
    const h = clockHarness();
    const en = { hp: 500, hpMax: 1180, atk: 48, towerMinute: 12, group: { position: { x: 0, y: 45, z: 0 } } };
    h.api.echo(en, { x: 0, z: 0 });
    h.state.pos = { x: px, z: 0 };
    h.api.tick(en, 0.5);
    assert.equal(h.log.bursts, 0, 'まだ弾けない(予兆の間)');
    h.api.tick(en, 0.6);
    assert.equal(h.log.bursts, 1);
    assert.equal(h.log.hits.length, hit ? 1 : 0, `x=${px}`);
    assert.equal(en.towerEcho, null);
    assert.equal(h.apparitions[0].state, 'out', '残像は消える');
    assert.equal(h.log.scene.size, 0, '予兆の輪も外す');
    assert.equal(en.vfx, undefined, '輪は en.vfx に載せない(巻き戻りの終わりの clearBossVfx で先に消えないように)');
  }
});

test('倒れた時: 止刻の輪・残像の輪と残像を残さない(12 onBossDefeated が呼ぶ)', () => {
  const h = clockHarness();
  const en = { hp: 500, hpMax: 1180, atk: 48, group: { position: { x: 0, y: 45, z: 0 } } };
  h.api.echo(en, { x: 0, z: 0 });
  const ring = {}; en.stopRing = ring; h.log.scene.add(ring);
  h.api.clear(en);
  assert.equal(h.log.scene.size, 0);
  assert.equal(en.stopRing, null); assert.equal(en.towerEcho, null);
  assert.equal(h.apparitions[0].state, 'out');
  const ui = fs.readFileSync(path.join(root, 'src/legacy/parts/12-progression-ui.js'), 'utf8');
  assert.match(fn(ui, 'function onBossDefeated(boss, levelBefore){'), /if\(boss\.key === 'towerWarden'\) clearTowerBossFx\(boss\);/);
  // 世界を畳む時(撃破前に倒れて酒場へ戻った等)も外す(レビュー Round 2 の N-1)
  const world = fs.readFileSync(path.join(root, 'src/legacy/parts/02-world-common.js'), 'utf8');
  assert.match(world, /if\(en\.isBoss\)\{ clearBossVfx\(en\); if\(en\.key === 'towerWarden'\) clearTowerBossFx\(en\); \}/);
});

/* 止刻: updateBossSpecial の 'stopTime' の分岐を取り出して動かす */
const stopBranch = (() => {
  const a = combat.indexOf("      if(s === 'stopTime'){");
  const b = combat.indexOf("      if(s === 'rewind'){", a);
  return combat.slice(a, b);
})();
function stop(en, st, dt){
  const toasts = [];
  const run = new Function('en', 'state', 'dt', 'scene', 'spawnToast', 'sfx', 'TOWER_STOP_R',
    `en.specialT -= dt; const s = en.special;\n${stopBranch}\nreturn 'none';`);
  const r = run(en, st, dt, { remove(){} }, t => toasts.push(t), () => {}, 3.2);
  return { r, toasts };
}
test('止刻: 輪が満ちた時に中にいると 0.7 秒だけ動けない(ダメージは無い)。外・回避中・無敵中・麻痺の直後は掛からない', () => {
  const mk = () => ({ special: 'stopTime', specialT: 1.1, stopAt: { x: 0, z: 0 }, stopRing: { material: { opacity: 0 } } });
  // 予兆の間は何も起きない
  let en = mk(), st = { pos: { x: 0, z: 0 } };
  assert.equal(stop(en, st, 0.5).r, true);
  assert.equal(st.paralyzed, undefined);
  // 満ちた: 中にいる
  stop(en, st, 0.7);
  assert.equal(st.paralyzed, true); assert.equal(st.paralyzeT, 0.7); assert.equal(st.paralyzeInvulnT, 1.4);
  assert.equal(st.hp, undefined, 'ダメージは無い');
  assert.equal(en.special, null);
  for (const extra of [{ pos: { x: 4, z: 0 } }, { pos: { x: 0, z: 0 }, dodging: true }, { pos: { x: 0, z: 0 }, invulnerable: true },
                       { pos: { x: 0, z: 0 }, paralyzeInvulnT: 0.5 }]) {
    en = mk(); st = Object.assign({}, extra);
    stop(en, st, 1.2);
    assert.ok(!st.paralyzed, JSON.stringify(extra));
  }
});

test('技の並び: 針を投げる・床を掃く針・歯車・止刻、体力が半分を切ると巻き戻り(残像)。七時十三分は歯車が三つ', () => {
  const block = combat.slice(combat.indexOf("    if(en.key==='towerWarden'){\n      // Clockwork"), combat.indexOf("    en.specialCD = 5;\n    return false;\n  }", combat.indexOf("if(en.key==='towerWarden'){\n      // Clockwork")));
  assert.match(block, /en\.specialIdx = \(\(en\.specialIdx\|\|0\) \+ 1\) % 5;/);
  assert.match(block, /const late = towerBossMinute\(hpRatio\) >= 13;/);
  assert.match(block, /const n = late \? 3 : 1;/);
  assert.match(block, /en\.special = 'stopTime'; en\.specialT = 1\.1;/);
  assert.match(block, /hpRatio <= 0\.55 && en\.rewindHistory/);
  assert.match(block, /towerBossEcho\(en, en\.rewindFrom\);/);
  assert.match(combat, /if\(en\.stopRing\)\{ scene\.remove\(en\.stopRing\); en\.stopRing = null; \}/, '倒れた時・片付けの時に止刻の輪も外す');
  assert.match(combat, /if\(en\.key==='towerWarden'\)\{\s*updateTowerBossClock\(en, dt\);/);
});
