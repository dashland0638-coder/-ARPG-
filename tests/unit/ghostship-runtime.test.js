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
import { hasSkill2, learnSkill2 } from '../../src/core/chapter1-skills.js';

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
  const log = { lines:[], sfx:[], hits:[], toasts:[], logs:[], fades:0, seq:[], doors:{} };
  let cutscene = null;
  const enemies = [];
  const stubs = {
    THREE, state, enemies, scene:{ children:[], add(){}, remove(){} }, getCamOffset:()=> new V3(),
    currentWorldObjects:[], walls:[], stairs:[], apparitions:[], proximityEvents:[],
    playCutscene:(steps)=>{ cutscene = steps; },
    cutsceneLine:(text, name)=>{ log.lines.push([name, text]); log.seq.push('line'); }, cutsceneHideLine(){}, clearMovementInput(){},
    getDoor:(k)=> (log.doors[k] = log.doors[k] || {key:k, opened:true}), closeDoor:(d)=>{ d.opened = false; log.seq.push('close:' + d.key); },
    findLockOnBoss:()=> null, lerpAngle:(a, b, t)=> a + (b - a) * t, cutsceneRunning:()=> false, camAutoOn:true, camAutoResumeT:0,
    camera:{ position:new V3(), lookAt(){} }, cutsceneRealDt:0.016,
    sfx:(n)=> log.sfx.push(n), ambient:(n)=> log.sfx.push('amb:' + n), ambienceHold(){}, addShake(){},
    spawnLog:(t)=> log.logs.push(t), spawnToast:(t)=> log.toasts.push(t),
    fadeTransition:(fn)=>{ log.fades++; fn(); }, repositionAlliesToPlayer(){},
    spawnApparition:()=> obj(), legacyGrowth:()=> false,
    CLASSES:{ archer:{ name:'弓師' }, mage:{ name:'魔法使い' } },
    lordHitPlayer:(en, dmg)=>{ if(state.orbShield){ log.hits.push('orb'); return false; } log.hits.push(dmg); return true; },
    tryPerfectDodge:()=> log.hits.push('dodge'),
    updateBossBark(){}, resolveWallCollisions(){}, turnBudget:(r, dt)=> r*dt, resolveTurnRate:()=> 3,
    turnTowardAngle:(a, b)=> b, bossVfx:(en, m)=>{ (en.vfx = en.vfx || []).push(m); return m; },
    buildEnemy:(p, v)=> ({ group:{ position:p }, variant:v, dead:false }), POST_ATTACK_RECOVERY_SEC:0.5,
    isGateEnemyDead:()=> true, isRoomCleared:(tag)=> !(log.alive || []).includes(tag), spawnTaggedGroup(){}, batchStatic:(fn)=> fn(),
    addWallBox(){}, addStaticBox(){}, addLowRailBox(){}, buildDoor(){}, buildLoreNote(){},
    makePlankTexture(){}, makeNoiseTexture(){}, returnToTown:()=> log.lines.push(['', '(酒場へ)']),
    setTimeout:(fn)=> fn(), ...MAP, ...CAP,
    hasSkill2, grantChapter1Skill2:()=>{ log.seq.push('grant'); const r = learnSkill2(state); if(r.changed) log.grants = (log.grants || 0) + 1; return r.changed; },
  };
  stubs.registerProximityEvent = (pos, r, name, lines, opts)=> stubs.proximityEvents.push(Object.assign({fired:false}, opts));
  const names = Object.keys(stubs);
  const api = new Function(...names, shipSrc + `
    return {
      flags: ()=> gsFlags, setFlags: f=>{ gsFlags = f; },
      resolve: p=> gsResolvePassage(p),
      onLoop: ()=> gsOnLoop(),
      captainAI: (en, dt)=> updateShipCaptainAI(en, dt),
      release: (boss, done)=> gsPlayRelease(boss, done),
      setActive: ()=>{ gsActive = true; },
      registerEvents: ()=>{ gsRegisterEvents(); return gsEvents; },
      knockdown: en=> shipCaptainEnterIdle(en),
      shot: ()=> gsShot,
      buildCells: ()=> gsBuildCells(),
      visibleAt: (x, z)=>{ state.pos.set(x, 0, z); return [...gsVisibleRooms().vis].sort(); },
      cellRect: (x0, x1, z0, z1)=> gsCellKeyRect(x0, x1, z0, z1),
      cellPoint: (x, z)=> gsCellKeyPoint(x, z),
      setGates: (list)=>{ gsGateEntries = list; },
      showChainDoor: ()=> gsShowChainDoor(),
      waypoint: (wp)=> gsTestWaypoint(wp),
      stepChain: (dt)=> gsStepChain(dt),
      chainState: ()=> ({ lit: gsChainLit.map(m => m.material === gsMaterials().chainLit), leads: gsChainLeads.map(l => l.group.visible) }),
    };`)(...names.map(k => stubs[k]));
  const runCutscene = ()=>{
    const steps = cutscene; cutscene = null;
    let last = api.shot();
    (steps || []).forEach(s => { s.run(); const now = api.shot(); if(now && now !== last) log.seq.push('shot'); last = now; });
  };
  return { api, state, log, enemies, runCutscene };
}

test('階層を移る通路: 段階で行き先が変わる。船倉へ下りる梯子は帰還不能の後に食堂……? へ。昇降口は撃破後だけ甲板へ', () => {
  const h = harness();
  const P = id => MAP.gsPassageById(id);
  h.api.setFlags({ phase:'pre', loopDone:false });
  const pre = h.api.resolve(P('quartersDown'));
  assert.equal(MAP.gsRoomAt(pre.targetPos.x, pre.targetPos.z, 'pre').id, 'gsHold');
  assert.equal(pre.label, '船倉へ下りた……');
  assert.ok(h.api.resolve(P('cabinHatch')).blocked);
  h.api.setFlags({ phase:'post', loopDone:false });
  const post = h.api.resolve(P('xqDown'));
  assert.equal(MAP.gsRoomAt(post.targetPos.x, post.targetPos.z, 'post').id, 'xMess');
  assert.equal(post.label, '船倉へ下りた……', '「船倉へ」と思って下りた梯子');
  assert.ok(h.api.resolve(P('cabinHatch')).blocked);
  assert.equal(h.api.resolve(P('xbChain')), null, 'ループの前は鎖の口が無い');
  h.api.setFlags({ phase:'released', loopDone:true });
  const hatch = h.api.resolve(P('cabinHatch'));
  assert.equal(MAP.gsRoomAt(hatch.targetPos.x, hatch.targetPos.z, 'released').id, 'gsDeck');
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
  assert.ok(h.log.logs.some(l => /さっきまで、そこは壁だった/.test(l)));
  assert.ok(h.api.resolve(MAP.gsPassageById('xbUp')).blocked, '二度目は開かない');
  const door = h.api.resolve(MAP.gsPassageById('xbChain'));
  assert.equal(MAP.gsRoomAt(door.targetPos.x, door.targetPos.z, 'post').id, 'xHold');
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

test('ダウン: 予兆の途中で崩されると攻撃相は捨てられ、起き上がっても予兆なしで振り抜かない', () => {
  const h = harness();
  const en = captain(h);
  h.state.pos.set(28, 0, 163);
  for(let t = 0; t < 4 && en.capState !== 'windup'; t += 0.05) h.api.captainAI(en, 0.05);
  assert.equal(en.capState, 'windup');
  h.api.captainAI(en, 0.3);                 // 予兆の途中
  h.api.knockdown(en);                      // 07 triggerKnockdown と同じ呼び出し
  assert.equal(en.capState, 'idle');
  assert.equal(en.capTele, null);
  // 起き上がり直後: 次の攻撃は新しい予兆(windup)から始まり、予兆の時間ぶんは当たらない
  let sawWindup = false;
  for(let t = 0; t < 0.9; t += 0.05){
    h.api.captainAI(en, 0.05);
    if(en.capState === 'windup') sawWindup = true;
    assert.notEqual(en.capState, 'strike', '予兆なしで振り抜かない');
  }
  assert.equal(h.log.hits.length, 0);
  for(let t = 0; t < 3 && !sawWindup; t += 0.05){ h.api.captainAI(en, 0.05); if(en.capState === 'windup') sawWindup = true; }
  assert.ok(sawWindup);
});

test('鎖の引き寄せ: 盾(オーブ)で止めた時は引き寄せない', () => {
  const h = harness();
  const en = captain(h);
  h.state.pos.set(28, 0, 163);
  h.state.orbShield = true;
  runAI(h, en, 4.5);
  assert.deepEqual(h.log.hits, ['orb']);
  assert.ok(Math.abs(h.state.pos.z - 163) < 1e-9);
});

test('帰還不能の異常は (1) → (2) → (3) → (4) の順でしか起きない(前の場面が済むまで次の条件は満たされない)', () => {
  const h = harness();
  h.api.setActive();
  const ev = h.api.registerEvents();
  h.api.setFlags({ phase:'post', loopDone:false });
  const order = ['wrongA', 'wrongB', 'wrongC', 'wrongD'];
  for(let i = 1; i < order.length; i++){
    for(const k of order) ev[k].fired = false;
    for(let j = 0; j < i - 1; j++) ev[order[j]].fired = true;
    assert.equal(ev[order[i]].condition(), false, `${order[i]} は ${order[i-1]} の前には起きない`);
    ev[order[i-1]].fired = true;
    assert.equal(ev[order[i]].condition(), true, `${order[i]} は ${order[i-1]} の後に起きる`);
  }
  // (3) を飛ばして (2) の後だけでは (4) は起きない
  for(const k of order) ev[k].fired = false;
  ev.wrongA.fired = ev.wrongB.fired = true;
  assert.equal(ev.wrongD.condition(), false);
  // (3) の範囲は、食堂……? から先へ出る開口(通路……?へ)の手前を横切って全部覆う(先へ進むと必ず (3) を通る)
  const op = MAP.gsOpening('xMess', 'xCorridor');
  const a = ev.wrongC.area;
  assert.ok(a.x0 <= op.seg[0] && a.x1 >= op.seg[1] && a.z1 >= op.z - 0.01, '開口の幅をすべて覆う');
  // 船長室の決断は往路だけ(撃破後に入り直しても段階を戻さない)
  h.api.setFlags({ phase:'released', loopDone:true });
  assert.equal(ev.cabin.condition(), false);
});

test('見せてから話す: 食堂(十五人分)・食堂……?(十七人分)・柱の印・穴の消えた船底は、カメラが見せてから一文目が出る', () => {
  const h = harness();
  h.api.setActive();
  const ev = h.api.registerEvents();
  const check = (key, phase, extra)=>{
    h.api.setFlags({ phase, loopDone:false });
    h.log.seq.length = 0;
    ev[key].onEnter();
    h.runCutscene();
    const iShot = h.log.seq.indexOf('shot'), iLine = h.log.seq.indexOf('line');
    assert.ok(iShot >= 0 && iShot < iLine, `${key}: カメラが先(${h.log.seq.join(',')})`);
  };
  check('mess', 'pre');
  check('wrongA', 'post');
  check('wrongB', 'post');
  check('wrongC', 'post');
  check('wrongD', 'post');
  check('roll', 'post');
});

test('帰還の決断: 船長室で「今日はここまで」と決めると帰還不能の段階へ。通ってきた食堂の扉が背後で閉まる', () => {
  const h = harness();
  h.api.setActive();
  const ev = h.api.registerEvents();
  h.api.setFlags({ phase:'pre', loopDone:false });
  ev.cabin.onEnter();
  h.runCutscene();
  assert.equal(h.api.flags().phase, 'post');
  assert.ok(h.log.seq.includes('close:gsMessDoor'), '食堂の扉が閉まる(開けた先は、もう食堂ではない)');
  assert.ok(h.log.logs.some(l => /扉の閉まる音/.test(l)));
});

test('GHOSTSHIP-REBUILD-004 / CAMERA-001 今いる空間だけを描く: 今いる部屋と、開口・開いた扉の先(距離を問わない)。閉じた扉・板の先と、別の階層は見せない', () => {
  const h = harness();
  h.api.setFlags({ phase:'pre', loopDone:false });
  h.api.buildCells();
  // 船底の真ん中: 船底だけ(船倉は別の階層。壁の向こうの小舟も見せない)
  assert.deepEqual(h.api.visibleAt(-29, 162), ['gsBilge']);
  // 船員室の、食堂への開口のそば: 食堂(同じ場所の船員室……? も同じ区画)が見えはじめる
  assert.deepEqual(h.api.visibleAt(-29, 55), ['gsMess', 'gsQuarters', 'xQuarters']);
  // 船員室の奥(開口から遠い)でも、開口の先の食堂は描く(離れても消えない。CAMERA-001)
  assert.deepEqual(h.api.visibleAt(-29, 46), ['gsMess', 'gsQuarters', 'xQuarters']);
  // 別の階層(船倉)は、船員室のどこからも描かない
  assert.ok(!h.api.visibleAt(-29, 46).includes('gsHold'));
  // 通路から食堂の扉のそば: 扉が閉じていれば食堂は見えない(getDoor の既定は開いている)
  assert.ok(h.api.visibleAt(-29, 76).includes('gsMess'));
  assert.ok(h.api.visibleAt(-29, 83).includes('gsMess'), '開いた扉の先は、通路の奥(扉から遠い所)からも描く');
  h.log.doors.gsMessDoor.opened = false;
  assert.ok(!h.api.visibleAt(-29, 76).includes('gsMess'), '閉じた扉の先は見せない');
  // 帰還不能の後: 船員室……? と本物の船員室の開口は板で塞がれる → 見せない
  h.api.setFlags({ phase:'post', loopDone:false });
  h.api.setGates([{ closed:true, g:MAP.GS_GATES.find(g => g.id === 'messArch') }]);
  assert.ok(!h.api.visibleAt(-29, 59).includes('gsQuarters'), '板で塞がった開口の先は見せない');
});

test('GHOSTSHIP-REBUILD-004 区画の鍵: 境の壁は両側の部屋、部屋の中の物はその部屋、小舟と船底の外壁は小舟からも見える', () => {
  const h = harness();
  { const k = h.api.cellRect(-31, -27, 73.75, 74.25).split('|'); assert.ok(k.includes('gsCorridor') && k.includes('gsMess'), '食堂と通路の境の壁'); assert.ok(!k.includes('gsHold')); }
  assert.equal(h.api.cellPoint(-29, 66), 'gsMess|xQuarters', '食堂の卓(同じ場所の入れ替わる部屋も)');
  assert.equal(h.api.cellPoint(-24, 120), 'gsHold');
  assert.ok(h.api.cellRect(-38.25, -37.75, 148, 176).split('|').includes('gsMoor'), '船底の左舷の外壁は小舟から見える');
});

test('GHOSTSHIP-REBUILD-004 鎖: ループの直後に鎖の口へ現れる鎖も、すぐ光り、床を這う鎖が見える(演出の途中で段階が変わっても)', () => {
  const h = harness();
  h.api.setFlags({ phase:'post', loopDone:true });
  h.api.stepChain(0.016);            // 先に「鎖を辿る段階」へ切り替わる
  h.api.showChainDoor();             // その後で鎖の口の鎖が足される
  h.api.stepChain(0.016);
  const st = h.api.chainState();
  assert.ok(st.lit.length > 0 && st.lit.every(Boolean), '足された鎖も光る材質');
  assert.ok(st.leads.length > 0 && st.leads.every(Boolean), '床を這う鎖が見える');
  h.api.setFlags({ phase:'released', loopDone:true });
  h.api.stepChain(0.016);
  assert.ok(h.api.chainState().lit.every(v => !v), '撃破後は元の鎖');
});

test('DEV-TEST-MOBILE-001 テストモードの検証地点: 食堂の手前(往路)・鎖を辿る道の始まり・点呼の廊下の手前に、段階を揃えて出る', async () => {
  const { findWaypoint } = await import('../../src/core/scenario-waypoints.js');
  const h = harness();
  h.api.setActive();
  const ev = h.api.registerEvents();
  const wp = id => { const w = findWaypoint('ghostship', id); assert.ok(w && w.ch1, id); return h.api.waypoint(w); };

  h.api.setFlags({ phase:'pre', loopDone:false });
  const mess = wp('mess');
  assert.equal(MAP.gsRoomAt(mess.x, mess.z, 'pre').id, 'gsQuarters');
  assert.equal(h.api.flags().phase, 'pre');
  assert.equal(ev.mess.fired, false, '食堂の場面(卓を見せてから一文)はこれから');

  h.api.setFlags({ phase:'pre', loopDone:false });
  const chain = wp('chain');
  assert.equal(MAP.gsRoomAt(chain.x, chain.z, 'post').id, 'xBilge');
  assert.deepEqual(h.api.flags(), { phase:'post', loopDone:true });
  assert.ok(h.api.resolve(MAP.gsPassageById('xbChain')).targetPos, '鎖の口が開いている');

  h.api.setFlags({ phase:'pre', loopDone:false });
  const roll = wp('rollcall');
  assert.equal(MAP.gsRoomAt(roll.x, roll.z, 'post').id, 'xQuartersDeep');
  assert.ok(Math.abs(roll.z - 150) < 4, '点呼の廊下への扉の前');
  assert.equal(ev.roll.fired, false, '点呼と甲板長はこれから');
});

/* ---- STORY-001: 弓師の閃き(Skill 2「爆弾投げ」) ---- */
test('STORY-001: 弓師の閃きは往路の食堂の戦いの後。済むまで「帰る場所」の会話は出ない。帰還不能の後には起きない', () => {
  const h = harness();
  h.api.setActive();
  const ev = h.api.registerEvents();
  h.api.setFlags({ phase:'pre', loopDone:false });
  assert.equal(ev.insight.condition(), false, '食堂の場面(十五人分の皿)の前には起きない');
  ev.mess.fired = true; ev.mess.onEnter(); h.runCutscene();   // 食堂の残影が起き上がる(この試験では倒した扱い)
  h.log.alive = ['gsMess'];
  assert.equal(ev.insight.condition(), false, '食堂の残影が残っている間は起きない(戦いの最中に話し出さない)');
  h.log.alive = [];
  assert.equal(ev.insight.condition(), true, '食堂の残影を倒した後');
  assert.equal(ev.home.condition(), false, '閃きの前に「帰る場所」の会話は出ない');
  ev.insight.onEnter();
  h.runCutscene();
  assert.equal(ev.insight.condition(), false, '一度だけ');
  assert.equal(ev.insightFallback.condition(), false, '通路の代わりの場面も起きない');
  assert.equal(ev.home.condition(), true, '閃きの後に「帰る場所」の会話');
  // 帰還不能の後(往路の食堂はもう無い)には起きない
  const h2 = harness(); h2.api.setActive();
  const ev2 = h2.api.registerEvents();
  h2.api.setFlags({ phase:'post', loopDone:false });
  ev2.mess.fired = true;
  assert.equal(ev2.insight.condition(), false);
  assert.equal(ev2.insightFallback.condition(), false);
});

test('STORY-001: 見せてから話す → 魔法使いの見方を聞く → 閃く(自動で装備)→ 弓師の一言。習得は一度だけ', () => {
  const h = harness();
  h.api.setActive();
  const ev = h.api.registerEvents();
  h.api.setFlags({ phase:'pre', loopDone:false });
  h.log.seq.length = 0;
  ev.insight.onEnter();
  h.runCutscene();
  const seq = h.log.seq;
  const iShot = seq.indexOf('shot'), iLine = seq.indexOf('line'), iGrant = seq.indexOf('grant');
  assert.ok(iShot >= 0 && iShot < iLine, `カメラが先(${seq.join(',')})`);
  assert.ok(iLine < iGrant, '話を聞いてから閃く');
  assert.ok(seq.lastIndexOf('line') > iGrant, '閃いた後に弓師の一言');
  assert.equal(h.log.grants, 1);
  assert.equal(h.state.learnedSkill2, true);
  const before = h.log.lines.slice(0, h.log.lines.length);
  const spoken = before.map(([n]) => n);
  assert.ok(spoken.includes('魔法使い') && spoken.includes('弓師'), '同行者の見方を聞く(教わるのではない)');
  // 二度目(同じ出撃で別の口から入っても)は何もしない
  h.log.seq.length = 0;
  ev.insightFallback.onEnter();
  h.runCutscene();
  assert.deepEqual(h.log.seq, []);
  assert.equal(h.log.grants, 1);
});

test('STORY-001: 既に Skill 2 を持っている出撃(周回・テストモード)では閃きの場面を出さず、先の会話は進む', () => {
  for (const extra of [{ learnedSkill2:true }, { testMode:true }]){
    const h = harness();
    Object.assign(h.state, extra);
    h.api.setActive();
    const ev = h.api.registerEvents();
    h.api.setFlags({ phase:'pre', loopDone:false });
    ev.mess.fired = true; ev.mess.onEnter(); h.runCutscene();
    h.log.seq.length = 0;
    ev.insight.onEnter();
    h.runCutscene();
    assert.deepEqual(h.log.seq, [], JSON.stringify(extra));
    assert.equal(h.log.grants, undefined);
    assert.equal(ev.home.condition(), true, '「帰る場所」の会話は止まらない');
  }
});

test('STORY-001: 食堂を戦わずに抜けても、船長室(帰還不能の決断)の前の通路で同じ場面が起きる', () => {
  const h = harness();
  h.api.setActive();
  const ev = h.api.registerEvents();
  h.api.setFlags({ phase:'pre', loopDone:false });
  // 船長室へは 食堂 → 通路 → 船長室 の一本道(通路を通らずに船長室へ行けない)
  const cor = MAP.gsRoomById('gsCorridor');
  const a = ev.insightFallback.area;
  const toCabin = MAP.gsOpening('gsCorridor', 'gsCabin'), fromMess = MAP.gsOpening('gsMess', 'gsCorridor');
  assert.ok(toCabin && fromMess, '食堂 → 通路 → 船長室');
  assert.ok(a.x0 <= Math.min(toCabin.seg[0], fromMess.seg[0]) && a.x1 >= Math.max(toCabin.seg[1], fromMess.seg[1]), '通路の幅を覆う');
  assert.ok(a.z0 > cor.z0 && a.z1 < cor.z1);
  const cabin = MAP.gsRoomById('gsCabin');
  for (const r of MAP.GS_ROOMS.filter(r => r.set === 'pre' && r.id !== 'gsCorridor')){
    assert.equal(MAP.gsOpening(r.id, 'gsCabin'), null, `${r.id} から船長室へ直接は入れない`);
  }
  assert.ok(cabin);
  assert.equal(ev.insightFallback.condition(), true);
  h.log.seq.length = 0;
  ev.insightFallback.onEnter();
  h.runCutscene();
  assert.equal(h.state.learnedSkill2, true);
  assert.ok(!h.log.seq.includes('shot'), '通路ではカメラを食堂へ飛ばさない');
  assert.equal(ev.insight.condition(), false);
});
