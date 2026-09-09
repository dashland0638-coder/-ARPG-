// 4職の戦闘構えを幾何で固定するテスト。`npm run test:unit` で実行。
//
// 「剣が顔を貫通する」「腕の関節が折れて見える」といった指摘は、これまで
// 実機で見て角度を少しずつ直す、という直し方しかできなかった ―― 手や刃が
// どこへ行くのかを測る手段が無かったため。core/pose-geometry.js がその
// 手段で、ここはそれを4職ぶんの構えへ当てているだけ。
//
// 実装前の実測値(このテストが最初に落とした値):
//   剣士: 刀身が頭を 9.3cm、胴を 8.9cm 貫通していた
//   盗賊・魔法使い・弓師: 貫通そのものは無し(この3職の問題は貫通ではなく
//   「戦闘の構えに見えない」ことだった ―― そちらは形の作り直しで対処し、
//   ここでは新しい構えでも貫通が発生していないことを固定する)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMBAT_STANCES, ALT_WEAPON_STANCES, GRIP_OFFSETS } from '../../src/core/combat-stances.js';
import { MOTION_POSES, MOTION_STANCE_POSES } from '../../src/core/motion-poses.js';
import {
  rigFromBuild, armPoints, weaponSegment, poseIssues,
  bladeHeadPenetration, bladeTorsoPenetration, elbowBroken,
  holsterAnchorLocal, UPPER_ARM_LEN, FOREARM_LEN,
} from '../../src/core/pose-geometry.js';

/* buildPlayer() が使う体格。BUILD(05-rendering-rig.js)の male/female を
   そのまま写したもので、寸法が変わればこのテストも一緒に更新する必要が
   ある ―― 逆に言えば、体格を変えたのに構えを見直さなければここが落ちる。 */
const BUILDS = {
  male:   {height:0.80, hipY:1.10, chest:0.345, shoulderOut:0.105, headR:0.3705, headGap:0.27, hipR:0.265},
  female: {height:0.74, hipY:1.05, chest:0.320, shoulderOut:0.098, headR:0.3515, headGap:0.26, hipR:0.250},
};
const RIGS = {
  male: rigFromBuild(BUILDS.male, {headBackZ:-0.05, headDepthMul:0.85}),
  female: rigFromBuild(BUILDS.female, {headBackZ:-0.05, headDepthMul:0.85}),
};
const ARM_REACH = UPPER_ARM_LEN + FOREARM_LEN;
const CLASSES = ['warrior', 'rogue', 'mage', 'archer'];

const optsFor = (cls) => {
  const st = COMBAT_STANCES[cls];
  return { gripOffset: GRIP_OFFSETS[cls], tipLen: st.tip, grip: st.grip, aimWorld: !!st.aimWorld };
};

test('4職の戦闘構えに関節破綻・武器の身体貫通が無い', async (t) => {
  for (const cls of CLASSES) {
    await t.test(cls, () => {
      for (const build of ['male', 'female']) {
        const issues = poseIssues(RIGS[build], COMBAT_STANCES[cls], optsFor(cls));
        assert.deepEqual(issues, [], `${cls}/${build}: ${issues.join(', ')}`);
      }
    });
  }
});

test('サブ武器(槍・刀・魔法の剣・ボウガン)の構えも同様に破綻しない', () => {
  const byClass = { spear:'warrior', katana:'rogue', spellblade:'mage', crossbow:'archer' };
  for (const key in ALT_WEAPON_STANCES) {
    const st = ALT_WEAPON_STANCES[key];
    const issues = poseIssues(RIGS.male, st, {
      gripOffset: GRIP_OFFSETS[byClass[key]], tipLen: st.tip, grip: st.grip, aimWorld: !!st.aimWorld });
    assert.deepEqual(issues, [], `${key}: ${issues.join(', ')}`);
  }
});

test('剣士: 大剣が顔・頭を貫通しない(旧構えは 9.3cm 貫通していた)', () => {
  const seg = weaponSegment(RIGS.male, COMBAT_STANCES.warrior, optsFor('warrior'));
  const clear = -bladeHeadPenetration(RIGS.male, seg);
  assert.ok(clear > 0.25, `頭とのクリアランスが ${clear.toFixed(3)}m しかない`);
  assert.ok(-bladeTorsoPenetration(RIGS.male, seg) > 0, '胴も貫通しない');
  // 刃は体の片側(右)に寄っていて、顔の正面には無い
  assert.ok(seg.tip.x > 0.35, '切っ先が体の右側にある');
  assert.ok(Math.abs(seg.grip.x) < 0.30, '握りは体の中心からそれほど離れない(両手持ちが成立する)');
});

test('剣士: 両手が届く位置で大剣を握っている(伸ばし切りでも届かなくもない)', () => {
  const st = COMBAT_STANCES.warrior;
  assert.equal(st.grip, 'BOTH');
  for (const side of ['L', 'R']) {
    const a = armPoints(RIGS.male, st, side);
    const reach = a.hand.distanceTo(a.shoulder);
    assert.ok(reach < ARM_REACH * 0.97, `${side}腕が伸び切っている (${(reach/ARM_REACH*100).toFixed(0)}%)`);
    assert.ok(reach > ARM_REACH * 0.45, `${side}腕が畳まれすぎている`);
  }
});

test('盗賊: 短剣が体の中心を横切らない・肘が逆に折れていない', () => {
  const st = COMBAT_STANCES.rogue;
  const issues = poseIssues(RIGS.male, st, Object.assign({ noCross: true }, optsFor('rogue')));
  assert.deepEqual(issues, [], issues.join(', '));
  const L = armPoints(RIGS.male, st, 'L').hand, R = armPoints(RIGS.male, st, 'R').hand;
  assert.ok(L.x < 0 && R.x > 0, '左手は左側、右手は右側にある');
  const seg = weaponSegment(RIGS.male, st, optsFor('rogue'));
  assert.ok(seg.grip.x > 0 && seg.tip.x > 0, '主武器の短剣が体の中心線を越えて左へ出ない');
});

test('魔法使い: 右手主体の片手持ち + 左手を敵方向へ', () => {
  const st = COMBAT_STANCES.mage;
  assert.equal(st.grip, 'R', '戦闘中の杖は右手の片手持ち');
  const L = armPoints(RIGS.male, st, 'L').hand;
  const R = armPoints(RIGS.male, st, 'R').hand;
  assert.ok(L.z > R.z + 0.15, '左手が右手より明確に前(敵方向)へ出ている');
  assert.ok(!elbowBroken(st.elL) && st.elL < -0.15, '左肘は伸ばし切らず、少し曲げたまま');
  assert.ok(st.elL > -1.0, '左腕は折り畳まず、前へ差し出している');
});

test('弓師: 半身の射撃姿勢(弓が体の真正面に立たない)', () => {
  const st = COMBAT_STANCES.archer;
  assert.ok(st.waist[1] > 0.30, '腰が捻れて半身になっている');
  assert.equal(st.grip, 'L', '弓は左手');
  assert.equal(st.aimWorld, true, '射線はキャラクターの向きに乗る');
  const L = armPoints(RIGS.male, st, 'L').hand;
  const R = armPoints(RIGS.male, st, 'R').hand;
  // 引き手(右)が顔の高さ近くにあることが「射撃姿勢」と「パチンコ」を分ける
  assert.ok(R.y > L.y, '引き手が弓手より高い(頬付けの位置にある)');
  assert.ok(R.y > 0.5, `引き手が腰の高さに落ちていない (y=${R.y.toFixed(2)})`);
  assert.ok(L.z > 0.35, '弓手は前方へ出ている');
  assert.ok(st.draw > 0 && st.draw < 0.3, 'Combat Idle では引き絞らない(いつでも引ける程度)');
});

/* 魔弾は杖頭(weaponTip)から出て水平に飛び、当たり判定は
   「弾と敵の足元の高さの差が 1.8m 未満」で見ている(updateProjectiles、
   13-update-loop.js)。杖を胸より高く掲げるとこの窓を越え、まっすぐ
   狙っても弾が一切当たらなくなる ―― 構えを作り直した際に実際にこれを
   踏み、tests/base-class-identity.spec.js の魔法使いの命中テストが
   落ちて分かった(溜め弾 isChargeOrb も過去に同じ理由で直されている)。

   ここはその制約を構えの側に明示して固定する。1.8 そのものではなく
   余裕を持たせた 1.72 を上限にしているのは、歩行の上下動(bob、最大
   約 5cm)と呼吸の分がこの上に乗るため。 */
const STAFF_HEAD_MAX_Y = 1.72;
const staffHeadWorldY = (pose, gripW) => {
  const rig = RIGS.male;
  const L = armPoints(rig, pose, 'L').hand, R = armPoints(rig, pose, 'R').hand;
  const w = gripW !== undefined ? gripW
          : (pose.gripW !== undefined ? pose.gripW
          : (pose.grip === 'BOTH' ? 0.5 : (pose.grip === 'L' ? 1 : 0)));
  const y = R.y + (L.y - R.y) * w + GRIP_OFFSETS.mage[1];
  return BUILDS.male.hipY + y + COMBAT_STANCES.mage.tip * pose.wep[1];
};

test('魔法使い: 杖頭が弾の当たり判定の高さに収まる(戦闘・探索・酒場のすべて)', () => {
  const cases = {
    '戦闘の構え': COMBAT_STANCES.mage,
    '探索(両手持ち)': MOTION_POSES.mage.explore,
    '酒場': MOTION_POSES.mage.social,
    '持ち替えの途中': MOTION_STANCE_POSES['mage.release'],
    '戦闘直後': MOTION_POSES.mage.settle,
  };
  for (const label in cases) {
    const y = staffHeadWorldY(cases[label]);
    assert.ok(y <= STAFF_HEAD_MAX_Y,
      `${label}: 杖頭が ${y.toFixed(2)}m ―― 弾が敵に届かなくなる高さ`);
    assert.ok(y > 1.2, `${label}: 杖頭が ${y.toFixed(2)}m ―― 低すぎて杖に見えない`);
  }
});

test('武器の収納位置が骨格から導かれ、手の届く場所にある', () => {
  const rig = RIGS.male;
  const back = holsterAnchorLocal(rig, 'BACK', 'warrior');
  assert.ok(back.pos.z < -rig.torsoR, '大剣の柄は背中側にある');
  assert.ok(back.pos.x > 0, '柄は右肩側に出る');
  const bowBack = holsterAnchorLocal(rig, 'BACK', 'archer');
  assert.ok(bowBack.pos.x < 0, '弓は(右背の矢筒を避けて)左寄りに掛ける');

  // 「手が届く場所」であること ―― ここが届かないと抜刀が宙を掴む動きになる
  const shoulder = (sx) => ({ x: sx * rig.shoulderX, y: rig.shoulderY, z: 0 });
  const dist = (p, s) => Math.hypot(p.x - s.x, p.y - s.y, p.z - s.z);
  assert.ok(dist(back.pos, shoulder(1)) < ARM_REACH, '大剣の柄に右手が届く');
  assert.ok(dist(bowBack.pos, shoulder(-1)) < ARM_REACH, '弓に左手が届く');
  for (const [attach, sx] of [['HIP_RIGHT', 1], ['HIP_LEFT', -1]]) {
    const h = holsterAnchorLocal(rig, attach, 'rogue');
    assert.ok(dist(h.pos, shoulder(sx)) < ARM_REACH, `${attach} の柄に手が届く`);
    assert.ok(Math.sign(h.pos.x) === sx, `${attach} は対応する側の腰にある`);
  }
});

test('肘の可動域チェックそのもの', () => {
  assert.equal(elbowBroken(-1.2), false);
  assert.equal(elbowBroken(0.5), true, '正の値 = 逆方向に折れている');
  assert.equal(elbowBroken(-3.0), true, '深すぎ = 前腕が二の腕へめり込む');
});
