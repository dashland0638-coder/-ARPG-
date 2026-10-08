/* 道の敵の数値(CR-01、HD-C3 = a)。今の敵のまま数値だけを確定する ――
   新しい敵・強敵・ボスは無い。決めた根拠(時計塔 4F 鐘の広間との比較、
   第一章の本編の主人公の強さ)も本物のソースから確かめる */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = f => fs.readFileSync(path.join(root, 'src/legacy/parts', f), 'utf8');
const road = read('14-dungeon-road.js');
const combat = read('07-ai-combat.js');
const cc = read('01-character-creation.js');

const lit = name => {
  const a = road.indexOf(`const ${name} = {`);
  assert.ok(a >= 0, name);
  return new Function(`return ${road.slice(road.indexOf('{', a), road.indexOf('};', a) + 1)};`)();
};
const BEAST = lit('ROAD_BEAST'), SPITTER = lit('ROAD_SPITTER');

test('道の敵は既存の型(突進・射撃)だけ。強敵・ボスの印は無い', () => {
  assert.equal(BEAST.atkType, 'charge');
  assert.equal(SPITTER.atkType, 'fire');
  for (const v of [BEAST, SPITTER]) {
    for (const k of ['strongMob', 'isBoss', 'boss', 'elite', 'guardian']) assert.ok(!(k in v), k);
  }
  assert.doesNotMatch(road, /buildBoss\(/, '道にボスは置かない');
  assert.doesNotMatch(road, /PROVISIONAL/, '暫定値の名前は残さない');
  assert.doesNotMatch(combat, /PROVISIONAL_ROAD/);
});

test('確定値(CR-01)', () => {
  assert.deepEqual([BEAST.hp, BEAST.atk, BEAST.speed], [190, 30, 2.6]);
  assert.deepEqual([SPITTER.hp, SPITTER.atk, SPITTER.speed], [150, 26, 0.9]);
  assert.deepEqual(BEAST.goldBonus, [16, 24]);
  assert.deepEqual(SPITTER.goldBonus, [16, 24]);
});

test('二つの戦闘は「突進2 + 射撃1」で、確定定数だけを使う', () => {
  const a = combat.indexOf("if(_spawnWorldKey==='road'){");
  const block1 = combat.slice(a, combat.indexOf('\n    }', a));
  assert.deepEqual(block1.match(/ROAD_(BEAST|SPITTER)/g), ['ROAD_BEAST', 'ROAD_BEAST', 'ROAD_SPITTER']);
  assert.equal((block1.match(/buildEnemy\(/g) || []).length, 3);
  const h = road.indexOf('function roadHandOff(){');
  const block2 = road.slice(h, road.indexOf('\n  }\n', h));
  assert.deepEqual(block2.match(/ROAD_(BEAST|SPITTER)\]/g), ['ROAD_BEAST]', 'ROAD_BEAST]', 'ROAD_SPITTER]']);
  assert.equal((block2.match(/buildEnemy\(/g) || []).length, 1, '3体を1つのループで出す');
});

/* 根拠: 時計塔 4F 鐘の広間(同じ「突進2 + 射撃1」、y=27 の3体)との比較 */
test('根拠: 塔 4F より HP の合計は多め(+0〜30%)、ATK の合計は少なめ', () => {
  const spots = [...combat.matchAll(/pos:new THREE\.Vector3\(-?\d+,27,(?:102|112)\), variant:\{[^}]*hp:(\d+), atk:(\d+)[^}]*atkType:'(\w+)'/g)];
  assert.equal(spots.length, 3, '塔 4F 鐘の広間');
  assert.deepEqual(spots.map(m => m[3]).sort(), ['charge', 'charge', 'fire']);
  const towerHp = spots.reduce((s, m) => s + +m[1], 0), towerAtk = spots.reduce((s, m) => s + +m[2], 0);
  const roadHp = BEAST.hp * 2 + SPITTER.hp, roadAtk = BEAST.atk * 2 + SPITTER.atk;
  assert.ok(roadHp >= towerHp && roadHp <= towerHp * 1.3, `${roadHp} vs ${towerHp}`);
  assert.ok(roadAtk < towerAtk, `${roadAtk} vs ${towerAtk}`);
});

/* 根拠: 第一章の本編は成長しない(配分・成長・装備・パッシブ 0)ので、
   主人公の HP / ATK は基礎値だけで決まる。戦闘2の影の旅人は、戦闘1の盗賊と
   ほぼ同じ強さ(同じ敵の組でよい) */
test('根拠: 本編の主人公の強さ(盗賊 102/22、影の旅人 109/21)', () => {
  const pick = (start, end) => cc.slice(cc.indexOf(start), cc.indexOf(end, cc.indexOf(start)) + end.length);
  const env = new Function([
    pick('const CLASSES = {', '\n  };\n'),
    pick("const STAT_KEYS = [", ';'),
    pick('const STAT_COEF = {', '};'),
    pick('const WEAPON_AFFINITY = {', '};'),
    pick('function affinityStatValue(classKey, stats){', '\n  }'),
    'return {CLASSES, STAT_COEF, affinityStatValue};',
  ].join('\n'))();
  const stats = key => {
    const own = env.CLASSES[key], kit = own.kit || key, base = Object.assign({}, env.CLASSES[kit], own);
    return { hp: Math.round(env.STAT_COEF.hpBase + base.vit * env.STAT_COEF.hpPerVit),
             atk: Math.round(env.affinityStatValue(kit, base) * env.STAT_COEF.atkCoef) };
  };
  assert.deepEqual(stats('rogue'), { hp: 102, atk: 22 });
  assert.deepEqual(stats('wanderer'), { hp: 109, atk: 21 });
});

/* CR-03: 丘へ進む条件は「最後の戦闘の3体がすべて倒れている」。普通の雑魚は
   20 秒で湧き直すので、印(roomTag)が無いと条件を満たせないことがあった */
test('最後の戦闘の3体は倒したら復活しない(roomTag)。丘の条件と噛み合う', () => {
  const h = road.indexOf('function roadHandOff(){');
  const block2 = road.slice(h, road.indexOf('\n  }\n', h));
  assert.match(block2, /buildEnemy\([^;]*Object\.assign\(\{roomTag:'roadFight2'\}, v\)\)/);
  // 07 の復活処理は roomTag の付いた個体を飛ばす
  assert.match(combat, /if\(en\.dead\)\{[\s\S]{0,200}if\(en\.roomTag\) return;[\s\S]{0,80}en\.respawnT -= dt;/);
  // 丘の条件は roadFight2Done、それは3体すべての dead から
  assert.match(road, /condition: \(\)=> roadMet && roadFight2Done/);
  assert.match(road, /roadFight2\.every\(en=> en\.dead\)/);
  // 戦闘1は今までどおり(印なし)
  const a = combat.indexOf("if(_spawnWorldKey==='road'){");
  assert.doesNotMatch(combat.slice(a, combat.indexOf('\n    }', a)), /roomTag/);
});
