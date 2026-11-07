/* 第一章③ 幽霊船の実行時の流れ(GHOSTSHIP-REBUILD-002)。

   幽霊船はヘッドレスの E2E では歩いて回れず、ボスも倒し切れない。そこで本物の
   14-dungeon-ghostship.js を、three.js・シーン・音・会話の口だけを差し替えて動かし、
     ・通路の行き先が段階どおりに切り替わる(扉・梯子・昇降口・ループ)
     ・船長の鎖の引き寄せ: 線に乗った時だけ当たり、船長の手前で止まり、その後は硬直する
     ・船長の段の移行(点呼で水夫の残影を呼ぶ・鎖を両手で握る)
     ・撃破後の解放: 鎖を手放す → 錨が落ちる → 構造が戻る(本物の船長室)→ 昇降口が開く
   を確かめる。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as MAP from '../../src/core/ghostship-map.js';
import * as CAP from '../../src/core/ghostship-captain.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// parts は連結前提で、このファイルは前のファイルが開いた見出しのコメントの続きから始まり、
// 次のファイルの見出しを開いて終わる。単独で評価するために両端を閉じる
const shipSrc = '/*\n' + fs.readFileSync(path.join(root, 'src/legacy/parts/14-dungeon-ghostship.js'), 'utf8') + '\n*/';

class V3 {
  constructor(x = 0, y = 0, z = 0){ this.x = x; this.y = y; this.z = z; }
  set(x, y, z){ this.x = x; this.y = y; this.z = z; return this; }
  copy(v){ this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  clone(){ return new V3(this.x, this.y, this.z); }
  setScalar(s){ this.x = this.y = this.z = s; return this; }
  add(v){ this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  addScaledVector(v, s){ this.x += v.x*s; this.y += v.y*s; this.z += v.z*s; return this; }
  subVectors(a, b){ this.x = a.x - b.x; this.y = a.y - b.y; this.z = a.z - b.z; return this; }
  length(){ return Math.hypot(this.x, this.y, this.z); }
  normalize(){ const l = this.length() || 1; this.x /= l; this.y /= l; this.z /= l; return this; }
  distanceTo(v){ return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
}
function obj(){
  return { position:new V3(), rotation:new V3(), scale:new V3(1,1,1), userData:{}, children:[], visible:true,
    material:{opacity:0}, color:{setHex(){}},
    add(c){ this.children.push(c); }, traverse(fn){ fn(this); this.children.forEach(c => c.traverse ? c.traverse(fn) : fn(c)); },
    clone(){ return obj(); }, rotateX(){ return this; }, setMatrixAt(){} };
}
const THREE = new Proxy({}, { get: (_, k) => k === 'Vector3' ? V3 : function(){ return obj(); } });

function harness(){
  const state = { pos:new V3(), vel:new V3(), facing:0, dialogueActive:false, invulnerable:false, paralyzeInvulnT:0, scenarioKey:'ghostship' };
  const log = { lines:[], sfx:[], hits:[], toasts:[], logs:[], fades:0 };
  let cutscene = null;
  const enemies = [];
  const stubs = {
    THREE, state, enemies, scene:{ children:[], add(){}, remove(){} }, camera:{ position:new V3() }, getCamOffset:()=> new V3(),
    currentWorldObjects:[], walls:[], stairs:[], apparitions:[], proximityEvents:[],
    playCutscene:(steps)=>{ cutscene = steps; },
    cutsceneLine:(text, name)=> log.lines.push([name, text]), cutsceneHideLine(){}, clearMovementInput(){},
    sfx:(n)=> log.sfx.push(n), ambient:(n)=> log.sfx.push('amb:' + n), ambienceHold(){}, addShake(){},
    spawnLog:(t)=> log.logs.push(t), spawnToast:(t)=> log.toasts.push(t),
    fadeTransition:(fn)=>{ log.fades++; fn(); }, repositionAlliesToPlayer(){},
    spawnApparition:()=> obj(), registerProximityEvent(){}, legacyGrowth:()=> false,
    CLASSES:{ archer:{ name:'弓師' }, mage:{ name:'魔法使い' } },
    lordHitPlayer:(en, dmg)=> log.hits.push(dmg), tryPerfectDodge:()=> log.hits.push('dodge'),
    updateBossBark(){}, resolveWallCollisions(){}, turnBudget:(r, dt)=> r*dt, resolveTurnRate:()=> 3,
    turnTowardAngle:(a, b)=> b, bossVfx:(en, m)=>{ (en.vfx = en.vfx || []).push(m); return m; },
    buildEnemy:(p, v)=> ({ group:{ position:p }, variant:v, dead:false }), POST_ATTACK_RECOVERY_SEC:0.5,
    isGateEnemyDead:()=> true, isRoomCleared:()=> true, spawnTaggedGroup(){}, batchStatic:(fn)=> fn(),
    addWallBox(){}, addStaticBox(){}, addLowRailBox(){}, buildDoor(){}, buildLoreNote(){},
    makePlankTexture(){}, makeNoiseTexture(){}, returnToTown:()=> log.lines.push(['', '(酒場へ)']),
    setTimeout:(fn)=> fn(), ...MAP, ...CAP,
  };
  const names = Object.keys(stubs);
  const api = new Function(...names, shipSrc + `
    return {
      flags: ()=> gsFlags, setFlags: f=>{ gsFlags = f; },
      resolve: p=> gsResolvePassage(p),
      onLoop: ()=> gsOnLoop(),
      captainAI: (en, dt)=> updateShipCaptainAI(en, dt),
      release: (boss, done)=> gsPlayRelease(boss, done),
      setActive: ()=>{ gsActive = true; },
    };`)(...names.map(k => stubs[k]));
  const runCutscene = ()=>{ const steps = cutscene; cutscene = null; (steps || []).forEach(s => s.run()); };
  return { api, state, log, enemies, runCutscene };
}

test('通路: 段階で行き先が変わる。食堂の扉は帰還不能の後に船員室……? へ。昇降口は撃破後だけ甲板へ', () => {
  const h = harness();
  const P = id => MAP.gsPassageById(id);
  h.api.setFlags({ phase:'pre', loopDone:false });
  const pre = h.api.resolve(P('corridorToMess'));
  assert.deepEqual([pre.targetPos.x, pre.targetPos.z], [MAP.GS_ARRIVALS.messFromCorridor.x, MAP.GS_ARRIVALS.messFromCorridor.z]);
  assert.ok(h.api.resolve(P('cabinHatch')).blocked);
  h.api.setFlags({ phase:'post', loopDone:false });
  const post = h.api.resolve(P('corridorToMess'));
  assert.equal(MAP.gsRoomAt(post.targetPos.x, post.targetPos.z).id, 'xQuarters');
  assert.equal(post.label, '食堂へ……', '「食堂へ」と思って開けた扉');
  assert.ok(h.api.resolve(P('cabinHatch')).blocked);
  assert.equal(h.api.resolve(P('xbChainDoor')), null, 'ループの前は鎖の扉が無い');
  h.api.setFlags({ phase:'released', loopDone:true });
  const hatch = h.api.resolve(P('cabinHatch'));
  assert.equal(MAP.gsRoomAt(hatch.targetPos.x, hatch.targetPos.z).id, 'gsDeck');
  assert.ok(typeof h.api.resolve(P('deckRope')).run === 'function', '縄梯子は脱出');
});

test('ループ: 船底……? の梯子で同じ船底へ。着くと一度だけ規則の会話が出て、鎖の扉が現れる。二度目は開かない', () => {
  const h = harness();
  h.api.setFlags({ phase:'post', loopDone:false });
  const up = h.api.resolve(MAP.gsPassageById('xbUp'));
  assert.equal(MAP.gsRoomAt(up.targetPos.x, up.targetPos.z).id, 'xBilge');
  up.onArrive();
  assert.equal(h.api.flags().loopDone, true);
  h.runCutscene();
  const text = h.log.lines.map(l => l[1]).join('\n');
  assert.match(text, /戻ってきました。同じ場所に/);
  assert.match(text, /外に向かうと、内側へ戻されます/);
  assert.match(text, /鎖を辿りましょう/);
  assert.ok(h.log.logs.some(l => /さっきまで無かった扉/.test(l)));
  assert.ok(h.api.resolve(MAP.gsPassageById('xbUp')).blocked, '二度目は開かない');
  const door = h.api.resolve(MAP.gsPassageById('xbChainDoor'));
  assert.equal(MAP.gsRoomAt(door.targetPos.x, door.targetPos.z).id, 'xHold');
  const before = h.log.lines.length;
  h.api.onLoop();
  h.runCutscene();
  assert.equal(h.log.lines.length, before, 'ループの会話は一度だけ');
});

function captain(h, x = 28, z = 173){
  const en = { group:{ position:new V3(x, 0, z), rotation:new V3() }, hp:820, hpMax:820, atk:40, speed:1.95, parts:{}, vfx:[] };
  return en;
}
function runAI(h, en, sec, dt = 0.05){ for(let t = 0; t < sec; t += dt) h.api.captainAI(en, dt); }

test('鎖の引き寄せ: 遠くにいると、予兆(床の帯)のあと線の上なら当たり、船長の手前(keepDist)まで引き寄せられる', () => {
  const h = harness();
  const en = captain(h);
  h.state.pos.set(28, 0, 163);             // 南へ 10
  runAI(h, en, 4.5);                        // 最初は間合いを詰め、鎖の準備ができたら予兆 → 引き寄せ
  assert.ok(h.log.sfx.includes('chainRattle'), '予兆の音');
  assert.equal(h.log.hits.length, 1, '一度だけ当たる');
  assert.equal(h.log.hits[0], Math.round(40 * CAP.CAPTAIN_ATTACKS.chainPull.damageMul));
  const d = h.state.pos.distanceTo(en.group.position);
  assert.ok(d >= CAP.CAPTAIN_ATTACKS.chainPull.keepDist - 0.01, `手前で止まる: ${d}`);
  assert.ok(d <= 10 - CAP.CAPTAIN_ATTACKS.chainPull.pull + 0.3, `引き寄せられた: ${d}`);
});

test('鎖の引き寄せ: 予兆の間に横へ避ければ当たらない。回避中(無敵)ならジャストドッジの判定へ', () => {
  const h = harness();
  const en = captain(h);
  h.state.pos.set(28, 0, 163);
  // 予兆が始まるまで待つ
  for(let t = 0; t < 3 && en.capState !== 'windup'; t += 0.05) h.api.captainAI(en, 0.05);
  assert.equal(en.capState, 'windup');
  assert.equal(en.capAttack, 'chainPull');
  h.state.pos.set(30.5, 0, 163);            // 横へ 2.5
  runAI(h, en, 1.2);
  assert.equal(h.log.hits.length, 0, '避けた');
  const h2 = harness();
  const en2 = captain(h2);
  h2.state.pos.set(28, 0, 163);
  for(let t = 0; t < 3 && en2.capState !== 'windup'; t += 0.05) h2.api.captainAI(en2, 0.05);
  h2.state.invulnerable = true;
  runAI(h2, en2, 1.2);
  assert.deepEqual(h2.log.hits, ['dodge']);
  assert.ok(Math.abs(h2.state.pos.z - 163) < 1e-9, '避けたら引き寄せない');
});

test('引き寄せの後は硬直: 次の攻撃の予兆が始まるまで 1.5 秒以上(反撃・離脱の余地)', () => {
  const h = harness();
  const en = captain(h);
  h.state.pos.set(28, 0, 163);
  let t = 0;
  for(; t < 4 && !h.log.hits.length; t += 0.05) h.api.captainAI(en, 0.05);
  assert.equal(h.log.hits.length, 1);
  let free = 0;
  for(; free < 5; free += 0.05){
    h.api.captainAI(en, 0.05);
    if(en.capState === 'windup') break;
  }
  assert.ok(free >= 1.5, `次の予兆まで ${free.toFixed(2)} 秒`);
});

test('段の移行: 65% で止まって「総員、点呼!」→ 点呼で水夫の残影を二体呼ぶ。30% で鎖を両手で握る', () => {
  const h = harness();
  const en = captain(h);
  h.state.pos.set(28, 0, 171);              // 近く
  runAI(h, en, 0.5);
  en.hp = 820 * 0.6;
  h.api.captainAI(en, 0.05);
  assert.equal(en.capState, 'shift');
  assert.equal(en.phase, 2);
  assert.ok(h.log.toasts.some(t => /総員、点呼/.test(t)));
  runAI(h, en, CAP.CAPTAIN_SHIFT_SEC + CAP.CAPTAIN_ATTACKS.rollcall.telegraph + 0.6);
  const crew = h.enemies.filter(e => e.summonedBy === en);
  assert.equal(crew.length, 2, '水夫の残影を二体');
  assert.equal(crew[0].variant.shipRole, 'deckhand');
  en.hp = 820 * 0.25;
  for(let t = 0; t < 5 && en.phase !== 3; t += 0.05) h.api.captainAI(en, 0.05);
  assert.equal(en.phase, 3);
  assert.ok(h.log.toasts.some(t => /この鎖だけは/.test(t)));
  runAI(h, en, CAP.CAPTAIN_SHIFT_SEC + 0.5);
  assert.equal(en.capAttack, 'chainSweep', '段3 は床をなぞる薙ぎ払い');
});

test('撃破後の解放: 鎖を手放す → 錨が海の底へ → 構造が戻り本物の船長室へ → 昇降口が開く → 結果画面へ', () => {
  const h = harness();
  h.api.setActive();
  h.api.setFlags({ phase:'post', loopDone:true });
  h.state.pos.set(28, 0, 172);
  let done = false;
  h.api.release({}, ()=>{ done = true; });
  h.runCutscene();
  const text = h.log.lines.map(l => l[1]).join('\n');
  assert.match(text, /数が、合わんな/);
  assert.match(text, /降りて、いい/);
  assert.ok(h.log.sfx.indexOf('chainRun') < h.log.sfx.indexOf('anchorSplash'), '鎖が走ってから、錨が落ちる');
  assert.ok(h.log.logs.some(l => /錨が、海の底へ落ちていった/.test(l)));
  assert.equal(h.api.flags().phase, 'released');
  assert.equal(MAP.gsRoomAt(h.state.pos.x, h.state.pos.z).id, 'gsCabin', '本物の船長室');
  assert.match(text, /上が、開いています/);
  assert.ok(done, '結果画面へ渡す');
  const hatch = h.api.resolve(MAP.gsPassageById('cabinHatch'));
  assert.equal(MAP.gsRoomAt(hatch.targetPos.x, hatch.targetPos.z).id, 'gsDeck');
});
