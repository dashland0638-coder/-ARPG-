/* 森の洋館の演出の検算(CM-05)。

   演出の出来そのもの(見え方・聞こえ方・間)は人が実機で見るもので、CM-07 の
   確認項目に入れてある。ここで固定するのは「黙って壊れる」種類のもの:

     ・sfx('名前') は名前を間違えても何も言わずに鳴らないだけ(audio.js の sfx)。
       洋館の場面で使う効果音が、すべて実在する
     ・環境音の区画が、森・前庭・館・地下・主の間・異常空間で正しく切り替わり、
       主の間と異常空間は無音(MANSION_SCENARIO.md「分離の見せ方」)
     ・BGM(手続き生成)の項目が洋館と酒場にある(実音源は CA-90、本 Work Item の外)
     ・館の主の登場・不意打ち・戦闘中の一言・撃破後の独白が揃っている
     ・手記は読まなくても進める補助で、5点(すべて館の部屋の中)

   ゲームのコードは読むだけで、変えない。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAnomalyRoom } from '../../src/core/mansion-anomaly.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const src = read('src/legacy/parts/03-dungeons-mansion-temple.js');
const world = read('src/legacy/parts/02-world-common.js');
const ui = read('src/legacy/parts/12-progression-ui.js');
const enemy = read('src/legacy/parts/06-player-enemy.js');
const audio = read('src/audio/audio.js');
const bgm = read('src/audio/procedural-bgm.js');

function fn(text, signature){
  const a = text.indexOf(signature);
  assert.ok(a >= 0, signature);
  return text.slice(a, text.indexOf('\n  }\n', a) + 4);
}
/* audio.js の表(SFX / AMBIENT)のキー。「    name(){」「    name(arg){」の形 */
function tableKeys(name){
  const a = audio.indexOf(`const ${name} = {`);
  assert.ok(a >= 0, name);
  const body = audio.slice(a, audio.indexOf('\n  };', a));
  return new Set([...body.matchAll(/^ {4}([A-Za-z0-9_]+)\s*\(/gm)].map(m => m[1]));
}
const SFX = tableKeys('SFX');
const AMBIENT = tableKeys('AMBIENT');

const ROOMS = (()=>{
  const a = src.indexOf('const MANSION_ROOMS = [');
  const b = src.indexOf('\n  ];', a);
  return new Function(`return ${src.slice(src.indexOf('[', a), b + 4).replace(/\/\*[\s\S]*?\*\//g, '')}`)();
})();
const roomAt = (x, z) => ROOMS.find(r => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1);

/* 洋館の本体(一階前半〜主の間)。屋根裏(★4)は第一章では出ないので含めない */
const MANSION_SRC = src.slice(src.indexOf('const MANSION_ROOMS = ['), src.indexOf('function buildMansionAttic('));

test('効果音: 洋館の場面で鳴らす音は、すべて実在する(名前違いは無音になるだけで気づけない)', () => {
  const used = new Set([...MANSION_SRC.matchAll(/sfx\('([A-Za-z0-9_]+)'/g)].map(m => m[1]));
  // 閃いた瞬間の音(12-progression-ui.js の grantChapter1Skill2)も洋館の場面の一部
  for (const n of [...fn(ui, 'function grantChapter1Skill2(){').matchAll(/sfx\('([A-Za-z0-9_]+)'/g)].map(m => m[1])) used.add(n);
  assert.ok(used.size >= 8, [...used].join(','));
  for (const name of used) assert.ok(SFX.has(name), `sfx('${name}') が audio.js の SFX に無い`);
});

test('環境音: 洋館の区画が使う音はすべて実在し、主の間は無音', () => {
  const a = world.indexOf('const AMBIENCE_ZONES = {');
  const zones = new Function(`return ${world.slice(world.indexOf('{', a), world.indexOf('\n  };', a) + 4)}`)();
  for (const z of ['forest', 'yard', 'manor', 'basement', 'lord']) {
    assert.ok(Array.isArray(zones[z]), z);
    for (const c of zones[z]) assert.ok(AMBIENT.has(c.cue), `${z}: ${c.cue}`);
  }
  assert.deepEqual(zones.lord, []);
});

test('環境音: 森 → 前庭 → 館 → 地下 → 主の間 と切り替わり、異常空間は主の間と同じく無音', () => {
  const code = [
    fn(src, 'function mansionRoomAt(x, z){'),
    fn(src, 'function currentAmbienceZone(){'),
    'return currentAmbienceZone;',
  ].join('\n');
  const at = (x, z) => {
    const state = { pos: { x, z } };
    return new Function('MANSION_ROOMS', 'state', 'currentWorldKey', 'isAnomalyRoom', 'duskAmbienceZone', code)(
      ROOMS, state, 'mansion', isAnomalyRoom, () => null)();
  };
  const center = id => { const r = ROOMS.find(o => o.id === id); return [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2]; };
  assert.equal(at(0, 0), 'forest');                 // 森の道(部屋の外)
  assert.equal(at(0, -36), 'yard');                 // 前庭(正面玄関の手前)
  for (const id of ['mFoyer', 'mHall', 'uWork', 'sQuart']) assert.equal(at(...center(id)), 'manor', id);
  for (const id of ['bCellar', 'bDeep']) assert.equal(at(...center(id)), 'basement', id);
  for (const id of ['bAnte', 'bLord', 'xFoyer', 'xCor', 'xHall']) assert.equal(at(...center(id)), 'lord', id);
  assert.equal(roomAt(0, -36), undefined);
});

test('BGM: 洋館と酒場に手続き生成の項目がある(実音源は未登録で、それで良い)', () => {
  const moods = bgm.slice(bgm.indexOf('const MOODS = {'), bgm.indexOf('\n};', bgm.indexOf('const MOODS = {')));
  assert.match(moods, /\n\s+mansion:\s*\{/);
  assert.match(moods, /\n\s+tavern:\s*\{/);
  // ワールドに入るたびに、そのワールドの鍵で BGM を切り替える
  assert.match(world, /playBgm\(key\);/);
});

test('館の主: 登場・不意打ち・戦闘中の一言・撃破後の独白が揃い、名前が一致する', () => {
  const cfg = enemy.slice(enemy.indexOf("key:'mansionBoss'"), enemy.indexOf("rewardLoot:{type:'gem', name:'主の袖飾り'"));
  const name = cfg.match(/dialogueName:'([^']+)'/)[1];
  assert.equal(cfg.match(/clearName:'([^']+)'/)[1], name);
  assert.match(cfg, /dialogueLines:\[\s*'/);
  assert.match(cfg, /ambushDialogueLines:\[\s*'/);
  const barks = ui.slice(ui.indexOf('const BOSS_BARK_LINES = {'));
  assert.match(barks.slice(0, barks.indexOf('ghostCaptain')), /mansionBoss: \{\s*hi: '[^']+',\s*lo: '[^']+'/);
  const endings = ui.slice(ui.indexOf('const BOSS_ENDING_LINES = {'), ui.indexOf('const BOSS_BARK_LINES'));
  assert.match(endings, /mansionBoss: \[\s*'/);
});

test('手記: 洋館には5点。どれも館の部屋の中にあり、読まなくても進める(進行の条件にしない)', () => {
  const notes = [...MANSION_SRC.matchAll(/buildLoreNote\(new THREE\.Vector3\((-?[\d.]+), *0, *(-?[\d.]+)\), '([^']+)', \[[\s\S]*?\], \{([^}]*)\}\)/g)];
  assert.equal(notes.length, 5, notes.map(m => m[3]).join(','));
  for (const m of notes) {
    assert.ok(roomAt(+m[1], +m[2]), `${m[3]} は館の部屋の中`);
    // 付けてよいのは見た目の種類(kind)と置き方(wall)だけ。条件や進行のフラグは持たない
    for (const key of m[4].split(',').map(s => s.split(':')[0].trim()).filter(Boolean)) {
      assert.ok(['kind', 'wall'].includes(key), `${m[3]}: ${key}`);
    }
  }
});
