/* 影の旅人の戦い方(WANDERER-RENEWAL-001、AD-005)。core/wanderer-style.js の
   数値・判定の形・キーフレームと、legacy への差し込み(表の行・鍵・閃き)を確かめる */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  WANDERER_KEY, WANDERER_ECHO_LAG, WANDERER_ECHO_MAX, WANDERER_ECHO, WANDERER_COMBAT,
  WANDERER_COMBO_LENGTH, WANDERER_COMBO_CLIPS, WANDERER_SKILL1, WANDERER_SKILL2,
  WANDERER_STANCE, WANDERER_CLIP_DUR, WANDERER_CLIP_CONTACT, WANDERER_DRAW_TIME,
  WANDERER_STRIKE, WANDERER_HAND_SCALE, SHADOW_HAND_SHAPE,
  wandererRigKey, planEcho, planStrike, handTargetPoint, pushEcho, stepEchoes, echoArcHit, echoCircleHit, lineHit, shadowPassEnd,
  buildWandererClips,
} from '../../src/core/wanderer-style.js';
import { drawTimesFor } from '../../src/core/weapon-state.js';
import { defaultSkill1For } from '../../src/core/chapter1-rules.js';
import { ULT_IMPACT_FRAC } from '../../src/core/ult-clips.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

test('遅れは加入前の影と同じ 0.45 秒(DEC-004 N-4 / DEC-030)', () => {
  assert.equal(WANDERER_ECHO_LAG, 0.45);
  const road = read('src/legacy/parts/14-dungeon-road.js');
  assert.match(road, /const PRE_JOIN_SHADOW_LAG = 0\.45;/);
  const wall = read('src/core/road-wall-shadow.js');
  assert.match(wall, /lag: 0\.45/);
});

test('モーションの鍵: 影の旅人だけ自分の表、4 人と上位職は classDef.key のまま', () => {
  assert.equal(wandererRigKey('warrior', 'wanderer'), WANDERER_KEY);
  for (const k of ['warrior', 'rogue', 'mage', 'archer']) assert.equal(wandererRigKey(k, undefined), k);
  assert.equal(wandererRigKey('warrior', null), 'warrior');
});

test('追撃: 予定 → 0.45 秒後に解決。上限を超えたら古いものから捨てる', () => {
  const list = [];
  const e = planEcho('finish', {x: 1, z: 2, yaw: 0.5}, 100);
  assert.equal(e.t, WANDERER_ECHO_LAG);
  assert.equal(e.dmg, 60);
  assert.equal(e.staggerMul, WANDERER_ECHO.finish.staggerMul);
  pushEcho(list, e);
  assert.deepEqual(stepEchoes(list, 0.30), []);
  const due = stepEchoes(list, 0.16);
  assert.equal(due.length, 1);
  assert.equal(list.length, 0);
  for (let i = 0; i < WANDERER_ECHO_MAX; i++) pushEcho(list, planEcho('finish', {x: i, z: 0}, 10));
  const dropped = pushEcho(list, planEcho('skill1', {x: 9, z: 0}, 10));
  assert.equal(dropped.length, 1);
  assert.equal(dropped[0].x, 0);
  assert.equal(list.length, WANDERER_ECHO_MAX);
  assert.equal(planEcho('nope', {x: 0, z: 0}, 1), null);
});

test('追撃の倍率: 3 段目は控えめ、影渡りの斬り返しが一番重い', () => {
  assert.ok(WANDERER_ECHO.finish.dmgMul < 1);
  assert.ok(WANDERER_ECHO.skill2.dmgMul > WANDERER_ECHO.skill1.dmgMul);
  assert.equal(WANDERER_ECHO.skill1.shape, 'circle');
  assert.equal(WANDERER_ECHO.skill2.shape, 'back');
});

test('判定: 弧は原点を自由に取れる(影の位置から測る)', () => {
  const base = {ox: 10, oz: 10, yaw: 0, radius: 0.5, range: 3.2, angle: Math.PI / 3};
  assert.equal(echoArcHit({...base, tx: 10, tz: 12.5}), true);    // 正面
  assert.equal(echoArcHit({...base, tx: 10, tz: 7.5}), false);    // 背後
  assert.equal(echoArcHit({...base, tx: 10, tz: 14.0}), false);   // 遠い
  assert.equal(echoArcHit({...base, tx: 10.3, tz: 10.2}), true);  // 重なっている
  assert.equal(echoCircleHit({ox: 0, oz: 0, tx: 2.6, tz: 0, radius: 0.3, r: 2.4}), true);
  assert.equal(echoCircleHit({ox: 0, oz: 0, tx: 3.0, tz: 0, radius: 0.3, r: 2.4}), false);
  assert.equal(lineHit({ox: 0, oz: 0, yaw: 0, tx: 0.5, tz: 4, length: 6.5, width: 1.8}), true);
  assert.equal(lineHit({ox: 0, oz: 0, yaw: 0, tx: 1.2, tz: 4, length: 6.5, width: 1.8}), false);
  assert.equal(lineHit({ox: 0, oz: 0, yaw: 0, tx: 0, tz: -1, length: 6.5, width: 1.8}), false);
});

test('影渡り: 線の先は壁の手前で止まる(壁を抜けない)', () => {
  const free = shadowPassEnd(0, 0, 0, 6.5, () => false);
  assert.ok(Math.abs(free.z - 6.5) < 1e-6);
  const wall = shadowPassEnd(0, 0, 0, 6.5, (x, z) => z > 3.2);
  assert.ok(wall.z <= 3.2 && wall.z >= 2.5, `stops before the wall (${wall.z})`);
  const at = shadowPassEnd(0, 0, 0, 6.5, () => true);
  assert.equal(at.reach, 0);
});

test('Skill 1「影残し」は第一章の固定枠 retreat、Skill 2「影渡り」は閃きの枠', () => {
  assert.equal(WANDERER_SKILL1.key, defaultSkill1For('warrior'));
  assert.equal(WANDERER_SKILL1.movement, 'retreat');
  assert.equal(WANDERER_SKILL1.echo, 'skill1');
  assert.equal(WANDERER_SKILL2.key, 'shadowPass');
  assert.equal(WANDERER_SKILL2.echo, 'skill2');
  assert.ok(WANDERER_SKILL2.cd > 0);
  assert.equal(WANDERER_SKILL2.mode, undefined, '専用の発動(castShadowPass)を通る');
});

test('抜刀/納刀: 影が刃になるのは速く、ほどけるのはゆっくり', () => {
  assert.deepEqual(drawTimesFor('wanderer', null), WANDERER_DRAW_TIME);
  assert.ok(WANDERER_DRAW_TIME.draw < drawTimesFor('warrior', null).draw);
  assert.ok(WANDERER_DRAW_TIME.sheathe > WANDERER_DRAW_TIME.draw);
});

test('キーフレーム: 全クリップが構えで始まり構えで終わる・片手(影の刃)・素手の型', () => {
  const clips = buildWandererClips(WANDERER_STANCE);
  const need = ['basic', 'basic2', 'basic3', 'retreat', 'shadowPass', 'dash', 'spin', 'ult', 'hold'];
  for (const name of need) {
    const f = clips[name];
    assert.ok(Array.isArray(f) && f.length >= 2, name);
    assert.ok(clips.dur[name] > 0, `${name} dur`);
    for (let i = 1; i < f.length; i++) assert.ok(f[i].t > f[i - 1].t, `${name} t ascending`);
    for (const k of f) if (k.grip) assert.equal(k.grip, 'R', `${name}: 両手持ち(大剣)の型を使わない`);
    if (name !== 'basic2') assert.deepEqual(f[0].shL, WANDERER_STANCE.shL, `${name} starts in guard`);
    if (name !== 'hold') {
      const last = f[f.length - 1];
      assert.deepEqual(last.shR, WANDERER_STANCE.shR, `${name} ends in guard`);
      assert.deepEqual(last.wep, WANDERER_STANCE.wep, `${name} ends in guard`);
    }
  }
  // コンボの段とクリップ
  assert.equal(WANDERER_COMBO_LENGTH, 3);
  for (let s = 1; s <= 3; s++) assert.ok(clips[WANDERER_COMBO_CLIPS[s]], `stage ${s}`);
});

test('キーフレーム: 本人の決めの姿勢 → 少し遅れて影の手が当たる(DEC-034 §1「適度な時間差」)', () => {
  const clips = buildWandererClips(WANDERER_STANCE);
  for (const [name, t] of Object.entries(WANDERER_CLIP_CONTACT)) {
    assert.ok(clips[name].some(f => Math.abs(f.t - t) < 1e-9), `${name} has a key at ${t}`);
  }
  // 必殺技は core/ult-clips.js の 'ult' の接触と同じ位置(判定の遅れと見た目が重なる)
  assert.equal(WANDERER_CLIP_CONTACT.ult, ULT_IMPACT_FRAC.ult);
  // 通常攻撃: 影の手は本人の動作より後に当たる(delay > 0)。本人が動き出してから当たるまでの間がある
  for (const [kind, s] of Object.entries(WANDERER_STRIKE)) {
    assert.ok(s.delay > 0.08 && s.delay < 0.3, `${kind} delay ${s.delay}`);
    assert.ok(s.scale >= 2.0, `${kind}: 影の手は主人公より大きい`);
  }
  assert.equal(WANDERER_STRIKE.basic.hand, 'rise');
  assert.equal(WANDERER_STRIKE.basic2.hand, 'sweep');
  assert.equal(WANDERER_STRIKE.basic3.hand, 'grab');
  assert.ok(WANDERER_STRIKE.basic3.delay < WANDERER_ECHO_LAG, '握砕は手が出てから閉じる');
  // 大振り: 1 段目は右腕を頭上近くまで振り上げる・2 段目は腰が大きく回る・3 段目は両腕を大きく広げる
  const b1 = clips.basic.find(f => f.t === WANDERER_CLIP_CONTACT.basic);
  assert.ok(b1.shR[0] < -2.0, '1 段目: 右手を前上へ振り上げる');
  const b2a = clips.basic2[1], b2b = clips.basic2.find(f => f.t === WANDERER_CLIP_CONTACT.basic2);
  assert.ok(Math.abs(b2a.waist[1] - b2b.waist[1]) > 1.2, '2 段目: 腰と上体が回る');
  const b3 = clips.basic3.find(f => f.t === WANDERER_CLIP_CONTACT.basic3);
  assert.ok(b3.shL[2] > 1.0 && b3.shR[2] < -1.0, '3 段目: 両腕を大きく広げる');
  // 影残しは前へ出てから後ろへ(push が正 → 負)
  const r = clips.retreat;
  assert.ok(r.find(f => f.t === WANDERER_CLIP_CONTACT.retreat).push > 0);
  assert.ok(r.some(f => f.push < 0));
  // 構えは静かな立ち姿(腕を下ろす)。武器を持たない(軌跡を出さない)
  assert.ok(WANDERER_STANCE.shR[0] > -0.5 && WANDERER_STANCE.shL[0] > -0.5);
  assert.equal(WANDERER_STANCE.trail, false);
  assert.equal(WANDERER_CLIP_DUR.basic3 > WANDERER_CLIP_DUR.basic, true, '3 段目は重い');
});

test('影の手: 人間の手の形(4 本の指 + 外へ開く親指)、指は長く指先だけ鋭い', () => {
  const H = SHADOW_HAND_SHAPE;
  assert.equal(H.fingers.length, 4);
  const middle = H.palm.len + H.segs[0] + H.segs[1] + H.tip;
  assert.ok(H.segs[0] + H.segs[1] + H.tip > H.palm.len * 1.4, '指が長い(手のひらの 1.4 倍以上)');
  assert.ok(H.tip > H.segs[0], '指先の節がいちばん長く尖る');
  assert.ok(H.radius[2] < H.radius[0], '先へ細くなる');
  assert.ok(H.thumb.spread < -0.8, '親指は大きく外へ開く');
  assert.ok(Math.abs(middle - 1) < 0.15, '手首〜中指の先 ≒ 1(大きさは倍率で決める)');
  for (const k of ['basic', 'grab', 'skill1', 'skill2', 'ult']) assert.ok(WANDERER_HAND_SCALE[k] >= 2.0, k);
  assert.ok(WANDERER_HAND_SCALE.ult > WANDERER_HAND_SCALE.basic, '必殺技はいちばん大きい');
  assert.ok(WANDERER_HAND_SCALE.dodge < WANDERER_HAND_SCALE.basic, '回避は小さな手');
});

test('影の手の出る場所: 扇の中の一番近い敵の足元。いなければ前方', () => {
  const c = [{x: 0, z: 3, r: 0.4}, {x: 0, z: 1.8, r: 0.4}, {x: 0, z: -2, r: 0.4}];
  assert.deepEqual(handTargetPoint(0, 0, 0, c, 3.2, Math.PI / 3), {x: 0, z: 1.8, target: true});
  const none = handTargetPoint(0, 0, 0, [{x: 0, z: -2, r: 0.4}], 3.2, Math.PI / 3, 2.0);
  assert.equal(none.target, false);
  assert.ok(Math.abs(none.z - 2.0) < 1e-9);
  const s = planStrike('basic3', {x: 1, z: 2, yaw: 0, ox: 0, oz: 0}, 50, {staggerMul: 1.6, isFinish: true});
  assert.equal(s.t, WANDERER_STRIKE.basic3.delay);
  assert.equal(s.strike, true);
  assert.equal(s.isFinish, true);
  assert.equal(planStrike('nope', {x: 0, z: 0}, 1), null);
});

test('legacy への差し込み: 表の行・鍵・コンボ・Skill・閃き', () => {
  const rig = read('src/legacy/parts/05-rendering-rig.js');
  const wnd = read('src/legacy/parts/17-wanderer-style.js');
  const cmb = read('src/legacy/parts/11-combat-actions.js');
  const ui = read('src/legacy/parts/12-progression-ui.js');
  const road2 = read('src/legacy/parts/14-dungeon-road2.js');
  const pe = read('src/legacy/parts/06-player-enemy.js');
  // 表を引く鍵は 1 つの関数(CLIPS を classDef.key で直接引く箇所を残さない)
  assert.match(rig, /function rigKeyOf\(cdef\)/);
  assert.doesNotMatch(rig + cmb, /CLIPS\[state\.classDef(\s*&&\s*state\.classDef)?\.key\]/);
  for (const t of ['STANCE.wanderer', 'STANCE_RELAXED.wanderer', 'GRIP_OFFSET.wanderer', 'CLIPS.wanderer', 'MOVE_SFX.wanderer']) {
    assert.ok(wnd.includes(t), t);
  }
  assert.match(cmb, /wanderer:WANDERER_COMBO_LENGTH/);
  assert.match(cmb, /castWandererCombo\(stage, comboLen, dmg, staggerOpts\)/);
  assert.match(wnd, /queueWandererEcho\('finish'/);
  assert.match(cmb, /castShadowPass\(/);
  assert.match(ui, /CHARGE_VARIANTS_BY_CLASS\.wanderer = \{ retreat:/);
  assert.match(ui, /if\(classKey === 'wanderer'\) return WANDERER_SKILL2;/);
  assert.match(road2, /grantChapter1Skill2\(\)/);
  assert.match(road2, /ROAD2_INSIGHT_GATE = 'F4-2'/);
  // 武器を一切持たない(大剣を隠すのではなく、武器の枠そのものを空にする。DEC-034)
  assert.doesNotMatch(pe, /charKey === 'wanderer'\) weapon\.visible = false/);
  assert.match(pe, /buildWandererEmptyWeapon\(\)/);
  assert.doesNotMatch(wnd, /shadowBlade|Afterimage/);
  // 影の旅人では斬撃の弧を出さない(影の手を単なる紫の斬撃エフェクトにしない)
  assert.match(cmb, /if\(isWandererStyle\(\)\) spawnWandererQuickHand/);
  // 影の手は影の紫(atkColorHex)の輪郭。衣服の配色表(trim)を読まない
  assert.match(wnd, /CLASSES\.wanderer\.atkColorHex/);
  assert.doesNotMatch(wnd, /resolvePalette|PLAYER_PALETTE/);
});

test('加入前の姿: 球の組み合わせを使わず、加入後と同じ頭部・髪の部品で組む', () => {
  const road = read('src/legacy/parts/14-dungeon-road.js');
  const a = road.indexOf('function buildRoadTravelerFigure(');
  const b = road.indexOf('function trackPreJoinShadow(');
  const body = road.slice(a, b);
  assert.doesNotMatch(body, /SphereGeometry/);
  assert.match(body, /makeCharacterHead\(/);
  assert.match(body, /makeCharacterHairShell\(/);
  assert.match(body, /userData\.pool = pool/);
  // 酒場の隅の人物も同じ関数
  const tavern = read('src/legacy/parts/03-dungeons-mansion-temple.js');
  assert.match(tavern, /const shadowGuide = buildRoadTravelerFigure\(true\);/);
});
