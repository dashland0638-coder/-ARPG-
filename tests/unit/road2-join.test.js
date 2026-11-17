/* 道(新)の出会いと正式加入(ROAD-VISUAL-003 R3-4)。本物のソースを stub 付きで動かす:
   ・出会いの一幕の台詞(加入前は「？？？」、正体・由来を語らない、剣士が決める)
   ・正式な加入処理は 1 か所・1 回だけ(一幕・開始地点「加入後」・出撃し直した時の復元)
   ・加入で到達 4 を記録。出撃し直すと到達から加入を復元
   ・野営地の支援の選択(候補だけ、戦闘は 2 人、前の支援は同行者へ)
   ・セーブに到達の番号を書き、読む(旧セーブは 0) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as party from '../../src/core/road-party.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = f => fs.readFileSync(path.join(root, 'src/legacy/parts', f), 'utf8');
const road2 = read('14-dungeon-road2.js');
const save = read('09-save-load.js');

function fn(src, signature){
  const a = src.indexOf(signature);
  assert.ok(a >= 0, signature);
  return src.slice(a, src.indexOf('\n  }\n', a) + 4);
}
function line(src, start){
  const a = src.indexOf(start);
  assert.ok(a >= 0, start);
  return src.slice(a, src.indexOf('\n', a));
}

const CAST = [null,
  {classKey:'warrior', guestClassKey:null}, {classKey:'mage', guestClassKey:'warrior'},
  {classKey:'archer', guestClassKey:'mage'}, {classKey:'rogue', guestClassKey:'archer'},
  {classKey:'wanderer', guestClassKey:'rogue'}];
const CLASSES = Object.fromEntries(['warrior', 'mage', 'archer', 'rogue', 'wanderer'].map(k => [k, {key:k, name:k, icon:'*'}]));

function harness({ cls = 'rogue', guest = 'archer', roadArea = 0, testMode = false, legacy = false } = {}){
  const src = [
    line(road2, "const ROAD_SWORD = '剣士'"),
    "const ROAD_THIEF = '盗賊', ROAD_ARCHER = '弓師', ROAD_TRAVELER = '影の旅人', ROAD_STRANGER = '？？？';",
    'let road2Joined = false; let road2TalkCount = {};',
    line(road2, 'let road2Stranger = null;'),
    line(road2, 'const ROAD2_STRANGER_POS'),
    line(road2, 'let road2MeetingActive'),
    line(road2, 'let road2JoinCount'),
    line(road2, 'let road2CompanionFigs'),
    line(road2, 'let road2CompanionArea'),
    line(road2, 'const ROAD2_CAMP_SPOTS'),
    fn(road2, 'function road2RemoveStranger(){'),
    fn(road2, 'function road2StrangerStands(){'),
    fn(road2, 'function road2PlayMeeting(){'),
    fn(road2, 'function road2Join(opts){'),
    fn(road2, 'function road2EnterCast(){'),
    fn(road2, 'function road2ForceJoin(){'),
    fn(road2, 'function road2RecordReach(){'),
    fn(road2, 'function road2RefreshCompanions(){'),
    fn(road2, 'function road2ChooseSupport(key){'),
    `return {
      get joined(){ return road2Joined; }, get joinCount(){ return road2JoinCount; }, get stranger(){ return road2Stranger; },
      get meeting(){ return road2MeetingActive; }, get companions(){ return road2CompanionFigs.map(f => f.userData.road2Companion); },
      set area(v){ road2CurrentAreaId = v; road2CompanionArea = v; },
      setStranger(v){ road2Stranger = v; },
      road2PlayMeeting, road2Join, road2EnterCast, road2ForceJoin, road2RecordReach, road2RefreshCompanions, road2ChooseSupport,
    };`,
  ].join('\n');
  const log = { lines: [], meet: 0, sync: 0, logs: [] };
  const vec = (x = 0, y = 0, z = 0) => ({ x, y, z, clone(){ return vec(this.x, this.y, this.z); }, set(a, b, c){ this.x = a; this.y = b; this.z = c; return this; },
    copy(o){ return this.set(o.x, o.y, o.z); }, add(){ return this; } });
  const group = () => ({ children: [], add(o){ o.parent = this; this.children.push(o); }, remove(o){ this.children = this.children.filter(c => c !== o); o.parent = null; } });
  const groups = { 1: group(), 2: group(), 3: group(), 4: group(), 5: group() };
  const env = {
    state: { pos: vec(1094, 1, 456), vel: vec(), roadArea, guestClassKey: guest, testMode, classDef: { icon: '*' }, facing: 0, dialogueActive: false },
    selectedClass: cls,
    CLASSES, CHAPTER_CAST: CAST, CHAPTER1_ORDER: ['mansion', 'duskvillage', 'ghostship', 'clocktower', 'road'],
    ROAD2_CAMPS: [{area:1, x:1092, z:8, y:0}, {area:2, x:1094, z:118, y:1}, {area:3, x:1094, z:322, y:-2}, {area:4, x:1094, z:458, y:1}, {area:5, x:1094, z:648, y:8}],
    road2AreaGroups: groups, road2CurrentAreaId: 4,
    THREE: { Vector3: function(x, y, z){ return vec(x, y, z); } },
    ...party,
    legacyGrowth: () => legacy,
    cutsceneTurnTo(){}, cutsceneHideLine(){}, clearMovementInput(){},
    cutsceneLine: (text, name) => log.lines.push([name, text]),
    playCutscene: steps => steps.forEach(s => s.run()),
    fadeTransition: f => f(),
    meetChapter1Protagonist(stage){ log.meet++; env.selectedClass = CAST[stage].classKey; env.state.guestClassKey = CAST[stage].guestClassKey; return true; },
    syncAlliesToState(){ log.sync++; },
    repositionAlliesToPlayer(){}, getCamOffset: () => vec(), camera: { position: vec() },
    spawnLog: t => log.logs.push(t),
    setOverlay(){},
    buildRoadTravelerFigure: seated => ({ seated, position: vec(1088, 1, 466), rotation: { y: 0 }, userData: {} }),
    trackPreJoinShadow(){},
    buildCastFigure: k => ({ position: vec(), rotation: { y: 0 }, userData: {} }),
    road2GroundAt: () => 1,
  };
  // selectedClass は関数の中で書き換わる(meetChapter1Protagonist)ので、with で同じ束縛を共有する
  const api = new Function('env', `with(env){ ${src} }`)(env);
  api.setStranger(env.buildRoadTravelerFigure(true));
  groups[4].add(api.stranger);
  return { api, env, log, groups };
}

test('出会いの一幕: 加入前は「？？？」、剣士が決め、加入の後に「影の旅人」の名前が出る', () => {
  const { api, env, log } = harness();
  api.road2PlayMeeting();
  const names = log.lines.map(l => l[0]);
  const joinAt = log.lines.findIndex(l => l[1] === '「前は二人で歩け。後ろは、俺たちが見る」');
  assert.deepEqual(log.lines[0], ['弓師', '「……焚き火が、もう点いています」'], '伏線: 焚き火');
  assert.deepEqual(log.lines[1], ['？？？', '「……こんにちは」']);
  assert.ok(joinAt > 0);
  assert.ok(!names.slice(0, joinAt).includes('影の旅人'), '加入前は名前を出さない');
  assert.deepEqual(log.lines[joinAt - 2], ['剣士', '「……一緒に来るか」']);
  assert.deepEqual(log.lines[joinAt - 1], ['？？？', '「……はい」']);
  assert.deepEqual(log.lines[joinAt + 1], ['影の旅人', '「……はい」']);
  assert.ok(log.lines.some(l => l[0] === '魔法使い' && l[1] === '「……見てから決めても、遅くはありません」'));
  assert.ok(log.lines.some(l => l[1] === '「朝の鐘で出てったんだろ」'));
  // 正体・怪異・羅針盤の由来は語らない(DEC-026 HD-3 = A、DEC-027)
  const all = log.lines.map(l => l[1]).join('');
  for (const w of ['羅針盤', '盗', '怪異', '正体', '影の旅人']) assert.ok(!all.includes(w), w);
  assert.equal(api.joined, true);
  assert.equal(log.meet, 1);
  assert.equal(env.selectedClass, 'wanderer');
  assert.equal(env.state.guestClassKey, 'rogue');
  assert.equal(env.state.roadArea, 4, '加入で到達 4');
  assert.equal(api.stranger, null);
  assert.equal(api.meeting, false);
  assert.deepEqual(log.logs, ['* 影の旅人']);
});

test('出会いの一幕(旧成長のルール): 第一章の台詞(朝の鐘・魔法使い)は出さない。加入は同じ', () => {
  const { api, log } = harness({ legacy: true });
  api.road2PlayMeeting();
  const all = log.lines.map(l => l[1]);
  assert.ok(!all.includes('「朝の鐘で出てったんだろ」'));
  assert.ok(!log.lines.some(l => l[0] === '魔法使い'));
  assert.ok(log.lines.some(l => l[0] === '剣士' && l[1] === '「……一緒に来るか」'));
  assert.equal(api.joined, true);
});

test('加入は 1 回だけ: 一幕の後・開始地点「加入後」・出撃し直しで二重に走らない', () => {
  const { api, log } = harness();
  api.road2PlayMeeting();
  api.road2PlayMeeting();
  api.road2ForceJoin();
  assert.equal(api.road2Join(), false);
  api.road2EnterCast();
  assert.equal(log.meet, 1);
  assert.equal(api.joinCount, 1);
});

test('出撃し直した時: 到達 4 以上なら一幕なしで正規の加入。3 以下なら加入前のまま', () => {
  let h = harness({ roadArea: 4 });
  h.api.road2EnterCast();
  assert.equal(h.api.joined, true);
  assert.equal(h.env.selectedClass, 'wanderer');
  assert.equal(h.log.meet, 1);
  assert.equal(h.api.stranger, null, '加入前の人物は出さない');
  assert.deepEqual(h.log.logs, [], '一幕なしの加入はログを出さない');
  h = harness({ roadArea: 3 });
  h.api.road2EnterCast();
  assert.equal(h.api.joined, false);
  assert.equal(h.env.selectedClass, 'rogue');
  assert.ok(h.api.stranger);
});

test('テストモードの顔ぶれ: ゲスト無しなら道の段の支援。影の旅人で入れば加入の後(支援は盗賊)', () => {
  let h = harness({ cls: 'warrior', guest: null, testMode: true });
  h.api.road2EnterCast();
  assert.equal(h.env.state.guestClassKey, 'archer');
  assert.equal(h.api.joined, false);
  h = harness({ cls: 'archer', guest: null, testMode: true });
  h.api.road2EnterCast();
  assert.equal(h.env.state.guestClassKey, 'rogue', '主人公が弓師なら盗賊');
  h = harness({ cls: 'wanderer', guest: null, testMode: true });
  h.api.road2EnterCast();
  assert.equal(h.api.joined, true);
  assert.equal(h.env.state.guestClassKey, 'rogue');
  assert.equal(h.log.meet, 0, '既に影の旅人なので持ち替えない');
  assert.equal(h.env.state.roadArea, 4);
  // 本編(テストモードでない)は支援を書き換えない
  h = harness({ cls: 'rogue', guest: 'archer', testMode: false });
  h.api.road2EnterCast();
  assert.equal(h.env.state.guestClassKey, 'archer');
});

test('到達の記録: 野営地のそばで記録。加入前はエリア 4・5 にならない', () => {
  const h = harness();
  const at = (area, x, z) => { h.api.area = area; h.env.state.pos.set(x, 1, z); h.api.road2RecordReach(); return h.env.state.roadArea; };
  assert.equal(at(2, 1100, 140), 0, '野営地から離れていれば記録しない');
  assert.equal(at(2, 1094, 120), 2);
  assert.equal(at(3, 1094, 322), 3);
  assert.equal(at(4, 1094, 458), 3, '加入前のエリア 4 は記録しない');
  assert.equal(at(5, 1094, 648), 3, '加入せずに北へ抜けても 3');
  assert.equal(at(2, 1094, 118), 3, '戻らない');
});

test('同行者: 戦闘に出ない仲間が、今いるエリアの野営地に立つ。支援を替えると入れ替わる', () => {
  const h = harness();
  h.api.area = 4;
  h.api.road2RefreshCompanions();
  assert.deepEqual(h.api.companions, ['warrior', 'mage'], '加入前: 盗賊 + 弓師が戦い、剣士と魔法使いが同行');
  h.api.road2PlayMeeting();
  assert.deepEqual(h.api.companions, ['warrior', 'mage', 'archer'], '加入後: 影の旅人 + 盗賊が戦う');
  assert.equal(h.api.road2ChooseSupport('mage'), true);
  assert.equal(h.env.state.guestClassKey, 'mage');
  assert.deepEqual(h.api.companions, ['warrior', 'archer', 'rogue']);
  assert.equal(h.api.road2ChooseSupport('wanderer'), false, '主人公は支援に選べない');
  assert.equal(h.api.road2ChooseSupport('smith'), false);
  assert.equal(h.env.state.guestClassKey, 'mage');
  assert.equal(h.groups[4].children.filter(c => c.userData.road2Companion).length, 3, '前の姿は片づく');
});

test('セーブ: 到達の番号を書き、読む。旧セーブ・壊れた値は 0(最初から)', () => {
  assert.ok(save.includes('roadArea:sanitizeRoadArea(state.roadArea),'));
  const apply = line(save, 'state.roadArea = sanitizeRoadArea(data.roadArea);');
  const run = data => { const state = {}; new Function('state', 'data', 'sanitizeRoadArea', apply)(state, data, party.sanitizeRoadArea); return state.roadArea; };
  assert.equal(run({ roadArea: 4 }), 4);
  assert.equal(run({}), 0, '旧セーブ');
  assert.equal(run({ roadArea: 'broken' }), 0);
  assert.equal(run({ roadArea: 12 }), 5);
});
