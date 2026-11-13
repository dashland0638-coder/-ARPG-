/* 幽霊船・時計塔の敵(ENEMY-VISUAL-001)。

   core/sea-clock-foes.js の数値・判断と、配置(14-dungeon-ghostship.js の GS_ROOM_CREW、07 の時計塔の表)、
   見た目の作り(16-foes-sea-clock.js)を読み、
     ・敵ごとに役割・得意距離・予兆・隙・対処・組み合わせが決まっている(資料が読める)
     ・大振りには見える予兆と、振り抜いた後の隙がある(理不尽にしない)
     ・変異種は通常種と違う戦い方(攻撃・AI の数値)を持つ ―― 色替え・HP 増しではない
     ・二つの世界観を混ぜない(幽霊船の敵は船に、時計塔の敵は塔に)
     ・負荷: 部品は種類ごとに共有、点光源を足さない
   を確かめる */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FOE_SPECS, foeAttackKeys, ABYSS, ABYSS_MUTANT, abyssSpikeTargets, TIME_ECHO, TIME_ECHO_TWIN,
  PHANTOM_SAILOR_ATTACKS, GEAR_SPRINTER_ATTACKS,
} from '../../src/core/sea-clock-foes.js';
import { meleeProfile, meleeAttackChoice, meleeAttackPlan, meleeTelegraphShape } from '../../src/core/enemy-profiles.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const ship = read('src/legacy/parts/14-dungeon-ghostship.js');
const combat = read('src/legacy/parts/07-ai-combat.js');
const foes = read('src/legacy/parts/16-foes-sea-clock.js');
const MELEE = Object.values(FOE_SPECS).filter(s => s.melee).map(s => s.melee);

test('台帳: 12 種。どの敵も役割・得意距離・速さ・予兆・隙・対処・組み合わせを持つ', () => {
  assert.equal(Object.keys(FOE_SPECS).length, 12);
  for (const [k, s] of Object.entries(FOE_SPECS)) {
    for (const f of ['dungeon', 'name', 'tier', 'role', 'ai', 'range', 'tell', 'punish', 'counter', 'pairs']) assert.ok(s[f], `${k}.${f}`);
    assert.ok(['ghostship', 'clocktower'].includes(s.dungeon), k);
    assert.ok(['normal', 'elite', 'mutant'].includes(s.tier), k);
    assert.ok(['attacker', 'tank', 'range', 'tricky', 'support'].includes(s.role), k);
    assert.ok(s.speed > 0, k);
  }
  for (const d of ['ghostship', 'clocktower']) {
    const roles = new Set(Object.values(FOE_SPECS).filter(s => s.dungeon === d).map(s => s.role));
    assert.ok(roles.size >= 3, `${d}: 役割が 3 種以上 (${[...roles]})`);
  }
});

test('大振りは見て避けられる: heavy の予兆 0.7 秒以上・振り抜いた後の隙 0.9 秒以上。どの攻撃にも予兆がある', () => {
  for (const kind of MELEE) {
    const prof = meleeProfile(kind);
    assert.ok(prof, kind);
    const heavy = meleeAttackPlan(kind, prof.heavy);
    assert.ok(heavy.telegraph >= 0.7, `${kind}.${heavy.key} 予兆 ${heavy.telegraph}`);
    assert.ok(heavy.recovery >= 0.9 || heavy.followUp, `${kind}.${heavy.key} 隙 ${heavy.recovery}`);
    for (const a of Object.values(prof.attacks)) {
      assert.ok(a.telegraph >= 0.24, `${kind}.${a.key} にも予兆`);
      assert.ok(a.active > 0 && a.active <= 0.35, `${kind}.${a.key} 判定は短い`);
    }
    // 連撃は必ず終わる(最後の一撃に長い隙)
    let a = meleeAttackPlan(kind, prof.light), n = 0;
    while (a.followUp && n < 5) { a = meleeAttackPlan(kind, a.followUp); n++; }
    assert.ok(n < 5 && a.recovery >= 0.4, `${kind}: 連撃は ${n + 1} 手で終わり、最後に隙`);
  }
  for (const spec of [ABYSS, ABYSS_MUTANT]) {
    assert.ok(spec.spike.telegraph >= 1.0 && spec.lash.telegraph >= 0.6);
    assert.ok(spec.spike.radius <= 1.6, '触手の輪は回避操作で出られる大きさ');
  }
  for (const spec of [TIME_ECHO, TIME_ECHO_TWIN]) assert.ok(spec.burst.delay >= 1.0 && spec.slash.telegraph >= 0.5);
});

test('踏み込み(lunge)は、踏み込んだ先まで届く距離で選ばれ、床の弧もそこまで描く', () => {
  const lunge = PHANTOM_SAILOR_ATTACKS.lunge;
  assert.equal(meleeAttackChoice('phantomSailor', { dist: lunge.reach + lunge.lunge - 0.1, heavyCD: 0, atkCD: 0 }), 'lunge');
  assert.equal(meleeAttackChoice('phantomSailor', { dist: 1.5, heavyCD: 0, atkCD: 0 }), 'slash', '密着なら一太刀');
  assert.equal(meleeTelegraphShape('phantomSailor', 'lunge').reach, lunge.telegraphReach);
  assert.ok(lunge.telegraphReach >= lunge.reach + lunge.lunge - 0.1);
  const spin = GEAR_SPRINTER_ATTACKS.spin;
  assert.equal(meleeAttackChoice('gearSprinter', { dist: spin.reach + spin.lunge - 0.2, heavyCD: 0, atkCD: 0 }), 'spin');
  // 全周の振り回し・遠くまで届く突きは light でも弧を出す(見ないと避けられない)
  assert.ok(meleeTelegraphShape('anchorDrowned', 'swing'));
  assert.ok(meleeTelegraphShape('clockGuardian', 'thrust'));
  assert.equal(meleeTelegraphShape('gearSoldier', 'jab'), null, '通常の light は弧を出さない(既存の約束)');
  assert.match(combat, /if\(plan\.lunge\)\{/);
  assert.match(combat, /if\(en\.servantT <= 0 && plan\.followUp && !en\.guardBreak\)\{/);
});

test('変異種は通常種と違う戦い方: 攻撃のキー・AI の数値が違う(色替え・HP 増しではない)', () => {
  const mut = Object.entries(FOE_SPECS).filter(([, s]) => s.tier === 'mutant');
  assert.equal(mut.length, 5);
  for (const [k, s] of mut) {
    assert.ok(FOE_SPECS[s.base], `${k} の元 ${s.base}`);
    if (s.melee) {
      const a = new Set(foeAttackKeys(s.melee)), b = new Set(foeAttackKeys(FOE_SPECS[s.base].melee));
      const differs = [...a].some(x => !b.has(x)) ||
        [...a].some(x => JSON.stringify(meleeAttackPlan(s.melee, x)) !== JSON.stringify(meleeAttackPlan(FOE_SPECS[s.base].melee, x)));
      assert.ok(differs, `${k}: 攻撃が元と違う`);
    }
  }
  assert.ok(meleeAttackPlan('phantomEcho', 'lunge').followUp, '残像の亡霊: 二度踏み込む');
  assert.ok(meleeAttackPlan('gearSprinter', 'jab').followUp, '回転機兵: 三連突き');
  assert.ok(meleeAttackPlan('anchorDrowned', 'throw').reach >= 6, '錨: 一直線に遠く');
  assert.equal(ABYSS_MUTANT.spike.count, 3, '変異した異形: 輪が三つ');
  assert.ok(TIME_ECHO_TWIN.replay && !TIME_ECHO.replay, '分身する残響: 遅れて同じ一太刀');
  assert.equal(FOE_SPECS.clockGuardian.tier, 'elite');
});

test('触手の輪: 通常は今いる所に一つ。変異は三つ(今いる所と、動く先の左右)', () => {
  assert.deepEqual(abyssSpikeTargets(1, 2, 0, ABYSS.spike), [{ x: 1, z: 2 }]);
  const t = abyssSpikeTargets(0, 0, 0, ABYSS_MUTANT.spike);
  assert.equal(t.length, 3);
  assert.deepEqual(t[0], { x: 0, z: 0 });
  for (const p of t.slice(1)) {
    assert.ok(p.z > 0, '動く先(前)');
    assert.ok(Math.abs(Math.hypot(p.x, p.z) - ABYSS_MUTANT.spike.lead) < 1e-9);
  }
  assert.ok(t[1].x * t[2].x < 0, '左右に一つずつ ―― 真後ろ・真横は空いている');
});

test('配置(幽霊船): 往路は通常種(と強化種)、ループの後の船の奥は変異種が混ざる。数値は元の役の値のまま', () => {
  const a = ship.indexOf('const GS_ROOM_CREW = {');
  const block = ship.slice(a, ship.indexOf('\n  };', a));
  const rooms = {};
  const heads = [...block.matchAll(/^\s{4}(\w+):\s*\[/gm)];
  heads.forEach((h, i) => {
    const body = block.slice(h.index, i + 1 < heads.length ? heads[i + 1].index : block.length);
    rooms[h[1]] = [...body.matchAll(/gsFoe\('(\w+)', '(\w+)'/g)].map(x => ({ kind: x[1], stat: x[2] }));
  });
  const pre = ['gsHold', 'gsQuarters', 'gsMess'], post = ['xMess', 'xBilge', 'xHold', 'xRollcall', 'xAnte'];
  for (const r of pre) for (const f of rooms[r]) assert.equal(FOE_SPECS[f.kind].tier, 'normal', `${r}: ${f.kind}`);
  assert.ok(post.some(r => rooms[r].some(f => FOE_SPECS[f.kind].tier === 'mutant')), '船の奥に変異種');
  assert.equal(rooms.xRollcall[0].kind, 'anchorDrowned', '甲板長は錨を引く溺死船員');
  assert.equal(rooms.xBilge[0].stat, 'carpenter', '船底は強化種の溺死船員(船大工の枠 = strongMob)');
  for (const r of [...pre, ...post]) for (const f of rooms[r]) assert.equal(FOE_SPECS[f.kind].dungeon, 'ghostship', `${r}: ${f.kind}`);
  // 組み合わせ: 一部屋に二種類以上(前衛と後衛など)
  assert.ok(['gsHold', 'gsQuarters', 'gsMess', 'xMess', 'xHold', 'xAnte'].every(r => new Set(rooms[r].map(f => f.kind)).size >= 2));
  assert.match(fnBody(ship, 'function gsFoe(kind, statKey, extra){'), /GS_CREW_STATS\[statKey\]/, '数値は GS_CREW_STATS のまま');
});

test('配置(時計塔): 層ごとに違う組み合わせ。塔の敵だけ。射手は縦穴の向こう岸', () => {
  const block = combat.slice(combat.indexOf('/* --- the clocktower (CLOCKTOWER-002'), combat.indexOf('// --- the glass conservatory'));
  const list = [...block.matchAll(/Vector3\((-?[\d.]+),(\d+),(-?[\d.]+)\), variant:\{foe:'(\w+)'/g)].map(m => ({ y: +m[2], kind: m[4] }));
  assert.equal(list.length, 9);
  for (const e of list) assert.equal(FOE_SPECS[e.kind].dungeon, 'clocktower', e.kind);
  const byFloor = y => list.filter(e => e.y === y).map(e => e.kind).sort().join(',');
  const combos = [8, 16, 26, 34].map(byFloor);
  assert.equal(new Set(combos).size, 4, `層ごとに違う ${combos}`);
  assert.deepEqual(new Set(list.map(e => FOE_SPECS[e.kind].tier)), new Set(['normal', 'elite', 'mutant']), '三段階がそろう');
  assert.match(combat, /enemies\.push\(buildEnemy\(s\.pos, s\.variant\.foe \? foeVariant\(s\.variant\.foe, s\.variant\) : s\.variant\)\)/);
});

test('負荷: 部品の Geometry と色の Material は種類ごとに共有。点光源を足さない。影は印を付けた部品だけ', () => {
  assert.match(foes, /function foeGeo\(key, make\)\{ let g = foeCache\.get\(key\);/);
  assert.doesNotMatch(foes, /PointLight/);
  assert.match(foes, /m\.castShadow = !!opts\.shadow;/);
  assert.match(foes, /var foeRingList = \[\];/, '床の輪は使い回す(一体につき最大 3 つ)');
  // 透け具合はその個体の材質だけ(共有の材質を透けさせると、同じ種類の全員が消える)
  assert.match(foes, /if\(!o\.isMesh \|\| !o\.material \|\| !o\.material\.userData\.foeOwn\) return;/);
  assert.match(read('src/legacy/parts/02-world-common.js'), /clearFoeFx\(\);/);
});

test('ボス: 船長は難破船を纏い段で外套が変わる / 止刻の残響は歯車の光輪が七時十三分へ速まり、管理人の影が遅れて付く', () => {
  assert.match(foes, /function dressCaptainFlair\(g, cfg\)\{/);
  assert.match(foes, /g\.scale\.multiplyScalar\(1\.18\);/);
  assert.match(fnBody(foes, 'function poseCaptainFlair(en, P, t, dt){'), /phase >= 2 \? 0x2a6a8a/);
  assert.match(fnBody(foes, 'function poseWardenFlair(en, P, t, dt){'), /towerBossMinute\(en\.hp \/ en\.hpMax\)/);
  assert.match(ship, /parts:Object\.assign\(\{kind:'captain'/);
  assert.match(read('src/legacy/parts/06-player-enemy.js'), /if\(cfg\.key === 'towerWarden'\) Object\.assign\(parts, dressWardenFlair\(g, cfg\)\);/);
});

function fnBody(src, sig){
  const a = src.indexOf(sig);
  assert.ok(a >= 0, sig);
  return src.slice(a, src.indexOf('\n  }\n', a) + 4);
}

/* ---- 近接の状態機械を実際に動かす(独立レビュー R1・R6) ----
   07 の本物の updateShadowServantAI / servantEnterIdle を、最小の stub で一歩ずつ進める */
import * as profiles from '../../src/core/enemy-profiles.js';
class V3 {
  constructor(x = 0, y = 0, z = 0){ this.x = x; this.y = y; this.z = z; }
  set(x, y, z){ this.x = x; this.y = y; this.z = z; return this; }
  copy(v){ this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  clone(){ return new V3(this.x, this.y, this.z); }
  subVectors(a, b){ this.x = a.x - b.x; this.y = a.y - b.y; this.z = a.z - b.z; return this; }
  addScaledVector(v, s){ this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
  length(){ return Math.hypot(this.x, this.y, this.z); }
  lengthSq(){ return this.x * this.x + this.y * this.y + this.z * this.z; }
  normalize(){ const l = this.length() || 1; this.x /= l; this.y /= l; this.z /= l; return this; }
}
function servantHarness(kind, dist){
  const src = fnBody(combat, 'function servantEnterIdle(en){') + fnBody(combat, 'function servantGuardPhase(st){') + fnBody(combat, 'function updateShadowServantAI(en, dt){');
  const state = { pos: new V3(0, 0, dist), paralyzeInvulnT: 0, invulnerable: false, hp: 1000, debugMode: false };
  const log = { hits: 0, sfx: [] };
  const stubs = {
    THREE: { Vector3: V3 }, state,
    meleeProfile: profiles.meleeProfile, meleeAttackPlan: profiles.meleeAttackPlan, meleeAttackChoice: profiles.meleeAttackChoice,
    meleeHeavyCooldown: profiles.meleeHeavyCooldown,
    stepGuardHold: () => 0, butlerShouldShiftPhase: () => false, butlerPhaseFor: () => 1, butlerCanShadowStep: () => false, butlerStepTarget: () => null,
    BUTLER_PHASE_SHIFT_SEC: 1, BUTLER_FADE_SEC: 0.5, BUTLER_EMERGE_SEC: 0.4, BUTLER_STEP_COOLDOWN_SEC: 7,
    setEnemyOpacity(){}, resolveWallCollisions(){}, sfx: n => log.sfx.push(n),
    angleDiff: (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a)),
    hasLineOfSight: () => true, aggroOnDetect: () => true, updateWanderAI(){},
    turnBudget: (r, dt) => r * dt, resolveTurnRate: () => 99, turnTowardAngle: (a, b) => b,
    shouldUseGuardianBreak: () => false, guardBreakPlan: () => ({}),
    tryPerfectDodge(){}, tryConsumeOrbShield: () => false, applyIncomingDamageMul: d => d, chargeDamage: (en, d) => d,
    spawnDamagePopup(){}, flashScreen(){}, addShake(){}, triggerPlayerDown(){},
    POST_ATTACK_RECOVERY_SEC: 0.5,
  };
  const names = Object.keys(stubs);
  const api = new Function(...names, src + '\nreturn { step: (en, dt) => updateShadowServantAI(en, dt), idle: en => servantEnterIdle(en) };')(...names.map(n => stubs[n]));
  state.hp = 1000;
  const origHp = () => 1000 - state.hp;
  const en = { group: { position: new V3(), rotation: { y: 0 } }, meleeKind: kind, atk: 10, speed: 2,
    servantState: 'idle', servantT: 0, servantSweepCD: 0, servantAtkCD: 0, servantFacing: new V3(0, 0, 1) };
  return { api, en, state, log, hurt: origHp };
}

test('状態機械: 残像の亡霊の二度の踏み込みの後は heavy のクールダウンが掛かり、すぐ次の踏み込みは来ない', () => {
  const { api, en } = servantHarness('phantomEcho', 3.5);
  const seq = [];
  for (let i = 0; i < 400; i++){
    api.step(en, 0.02);
    const tag = en.servantState + ':' + (en.servantAttack || '');
    if (seq[seq.length - 1] !== tag) seq.push(tag);
    if (seq.length > 1 && en.servantState === 'idle') break;
  }
  assert.deepEqual(seq.slice(0, 6), ['windup:lunge', 'strike:lunge', 'windup:relunge', 'strike:relunge', 'recover:relunge', 'idle:']);
  // 連撃の終わり(二度目の踏み込みを振り抜いた時)に 3.6 秒。硬直 1.05 秒の間も減るので、待機に戻った時は約 2.5 秒残る
  assert.ok(en.servantSweepCD > 2.4, `連撃の後のクールダウン ${en.servantSweepCD}`);
  // クールダウン中はその距離(4 以内・一太刀より遠い)では踏み込まず、詰める
  api.step(en, 0.02);
  assert.notEqual(en.servantAttack, 'lunge');
});

test('状態機械: 踏み込みは振り抜く間に前へ詰め、離れた相手に届く(lunge)', () => {
  const { api, en, hurt } = servantHarness('phantomSailor', 3.7);
  const z0 = en.group.position.z;
  for (let i = 0; i < 120 && en.servantState !== 'recover'; i++) api.step(en, 0.02);
  assert.equal(en.servantAttack, 'lunge');
  assert.ok(en.group.position.z - z0 > 1.8, `踏み込んだ距離 ${en.group.position.z - z0}`);
  assert.ok(hurt() > 0, '踏み込んだ先から当たる');
});

test('状態機械: 回転機兵の三連突きは三手で終わり、最後に長い隙。湧き直し・崩されで連撃の印は消える', () => {
  const { api, en } = servantHarness('gearSprinter', 1.5);
  const atks = [];
  for (let i = 0; i < 300 && en.servantState !== 'recover'; i++){
    api.step(en, 0.02);
    if (en.servantState === 'strike' && atks[atks.length - 1] !== en.servantAttack) atks.push(en.servantAttack);
  }
  assert.deepEqual(atks, ['jab', 'jab2', 'jab3']);
  assert.ok(en.servantT >= 0.9, '三つ目の後の隙');
  en.servantChainHeavy = true; api.idle(en);
  assert.equal(en.servantChainHeavy, false);
});

test('湧き直し: 異形・残響の固有の AI と遅れて弾ける残像を持ち越さない(独立レビュー R3)', () => {
  const reset = fnBody(foes, 'function foeResetOnRespawn(en){');
  assert.match(reset, /en\.echoState = null; en\.echoBursts = \[\]; en\.abyssState = null;/);
  assert.match(reset, /foeSetOpacity\(en, 1\)/);
  assert.match(combat, /if\(en\.mob && en\.mob\.foeKind\) foeResetOnRespawn\(en\);/);
  // 世界の片付けは敵の表を空にする前に(残像の影は敵ごとに持つ。R2)
  const world = read('src/legacy/parts/02-world-common.js');
  const d = world.slice(world.indexOf('function disposeWorld(){'));
  assert.ok(d.indexOf('clearFoeFx();') < d.indexOf('enemies = [];'));
});
