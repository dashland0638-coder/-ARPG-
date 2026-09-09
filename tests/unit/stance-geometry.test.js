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
  holsterAnchorLocal, headCenterAt, UPPER_ARM_LEN, FOREARM_LEN,
} from '../../src/core/pose-geometry.js';
import {
  HEAD_LIMITS, NECK_PIVOT_FRAC, VISUAL_WAIST_LIMITS, waistLookPitchMul,
} from '../../src/core/head-rig.js';

/* buildPlayer() が使う体格。BUILD(05-rendering-rig.js)の male/female を
   そのまま写したもので、寸法が変わればこのテストも一緒に更新する必要が
   ある ―― 逆に言えば、体格を変えたのに構えを見直さなければここが落ちる。 */
const BUILDS = {
  male:   {height:0.80, hipY:1.10, chest:0.345, shoulderOut:0.105, headR:0.3705, headGap:0.27, hipR:0.265},
  female: {height:0.74, hipY:1.05, chest:0.320, shoulderOut:0.098, headR:0.3515, headGap:0.26, hipR:0.250},
};
const RIG_OPTS = { headBackZ: -0.05, headDepthMul: 0.85, neckPivotFrac: NECK_PIVOT_FRAC };
const RIGS = {
  male: rigFromBuild(BUILDS.male, RIG_OPTS),
  female: rigFromBuild(BUILDS.female, RIG_OPTS),
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

/* Head Rig を入れたことで、頭は正面固定ではなくなった ―― 首を振り切った
   先で武器と当たらないかは、正面向きで測っていては分からない。可動域の
   隅々まで振ってから、同じ幾何チェックを掛ける。 */
const HEAD_SWEEP = [];
for (let i = -1; i <= 1; i += 0.5) {
  for (let j = -1; j <= 1; j += 0.5) {
    HEAD_SWEEP.push({ yaw: HEAD_LIMITS.yaw * i, pitch: HEAD_LIMITS.pitch * j });
  }
}

test('首を可動域いっぱいに振っても、武器が頭を貫通しない', async (t) => {
  for (const cls of CLASSES) {
    await t.test(cls, () => {
      const seg = weaponSegment(RIGS.male, COMBAT_STANCES[cls], optsFor(cls));
      for (const head of HEAD_SWEEP) {
        const clear = -bladeHeadPenetration(RIGS.male, seg, head);
        assert.ok(clear > 0,
          `${cls}: yaw ${(head.yaw * 180 / Math.PI).toFixed(0)}度 / pitch ${(head.pitch * 180 / Math.PI).toFixed(0)}度 で ${clear.toFixed(3)}m`);
      }
    });
  }
});

test('頭を振っても、頭が首から離れない(ピボットの腕の長さが妥当)', () => {
  const rig = RIGS.male;
  const rest = headCenterAt(rig, { yaw: 0, pitch: 0 });
  for (const head of HEAD_SWEEP) {
    const c = headCenterAt(rig, head);
    // ピボットからの距離は回転で変わらない(＝首が伸び縮みしない)
    const lever = Math.hypot(c.x, c.y - rig.neckY, c.z);
    const restLever = Math.hypot(rest.x, rest.y - rig.neckY, rest.z);
    assert.ok(Math.abs(lever - restLever) < 1e-9, '首の長さが変わっている');
    // 振り切っても、頭の球は首の付け根を覆ったまま(＝隙間ができない)
    const gap = Math.hypot(c.x, c.y - rig.neckY, c.z) - rig.headR;
    assert.ok(gap < 0.0, `首と頭の間に ${gap.toFixed(3)}m の隙間ができる`);
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

test('魔法使い: 上体の見た目上の前後傾は杖頭の高さを動かさない', () => {
  /* 上体を傾けると杖頭がその分だけ上下し、至近距離の敵を見下ろした時に
     弾の当たり判定の窓(1.8m)を越えてしまう ―― 前フェーズで実際に踏んだ
     不具合の再発防止。左右の捻りは高さを変えないので制限していない。 */
  assert.equal(waistLookPitchMul('mage'), 0, '魔法使いの上体は前後に傾けない');
  ['warrior', 'rogue', 'archer'].forEach(c =>
    assert.ok(waistLookPitchMul(c) > 0, `${c} は前後傾を許してよい`));
  // 仮に傾いたとして、他職なら杖頭は何 m 動くか(制限の根拠を数値で残す)
  const armReach = 0.9;   // 腰から杖頭までのおよその距離
  const lift = armReach * Math.sin(VISUAL_WAIST_LIMITS.pitch);
  assert.ok(lift > 0.05,
    `前後傾で杖頭が ${lift.toFixed(3)}m 動く ―― 無視できる量ではない(だから 0 にしている)`);
});

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

/* 見た目だけの上体の追従(Visual Look Offset)を入れた状態での検査。

   腰より上は腕・武器・頭ごと1つのグループで回るので、腰を捻っても
   互いの位置関係は変わらない ―― 貫通の有無は原理的に影響を受けない。
   ただし例外が1つある: 弓とボウガン(aimWorld)は「キャラクターの向きに
   射線を乗せる」ため、腰の回転を打ち消す向きに姿勢が付け直される。
   つまり腰を捻ると弓だけが体に対して相対的に動く。ここはそこを見る。 */
const WAIST_LOOK_SWEEP = [];
for (let i = -1; i <= 1; i += 0.25) WAIST_LOOK_SWEEP.push(VISUAL_WAIST_LIMITS.yaw * i);

test('上体を見た目上捻っても、弓が体を貫通しない(aimWorld の武器)', () => {
  for (const [cls, stance] of [['archer', COMBAT_STANCES.archer],
                               ['crossbow', ALT_WEAPON_STANCES.crossbow]]) {
    assert.equal(stance.aimWorld, true, `${cls} は aimWorld のはず`);
    const gripKey = cls === 'crossbow' ? 'archer' : cls;
    for (const extra of WAIST_LOOK_SWEEP) {
      const pose = Object.assign({}, stance, {
        waist: [stance.waist[0], stance.waist[1] + extra, stance.waist[2]] });
      const issues = poseIssues(RIGS.male, pose, {
        gripOffset: GRIP_OFFSETS[gripKey], tipLen: stance.tip,
        grip: stance.grip, aimWorld: true });
      assert.deepEqual(issues, [],
        `${cls}: 上体を ${(extra * 180 / Math.PI).toFixed(0)}度 余分に捻ると ${issues.join(', ')}`);
    }
  }
});

test('上体を見た目上捻っても、腰より上の位置関係は変わらない(近接武器)', () => {
  /* 剣士の大剣・盗賊の短剣・魔法使いの杖は腰と一緒に回るだけなので、
     腰を捻っても頭との距離も中心線との関係も一切変わらない。
     「捻ったら剣が顔に当たるようになった」が起きないことの根拠。 */
  for (const cls of ['warrior', 'rogue', 'mage']) {
    const stance = COMBAT_STANCES[cls];
    const base = weaponSegment(RIGS.male, stance, optsFor(cls));
    const baseHead = bladeHeadPenetration(RIGS.male, base);
    const baseTorso = bladeTorsoPenetration(RIGS.male, base);
    for (const extra of WAIST_LOOK_SWEEP) {
      const pose = Object.assign({}, stance, {
        waist: [stance.waist[0], stance.waist[1] + extra, stance.waist[2]] });
      const seg = weaponSegment(RIGS.male, pose, optsFor(cls));
      assert.ok(Math.abs(bladeHeadPenetration(RIGS.male, seg) - baseHead) < 1e-9,
        `${cls}: 腰を捻ると頭との距離が変わっている`);
      assert.ok(Math.abs(bladeTorsoPenetration(RIGS.male, seg) - baseTorso) < 1e-9,
        `${cls}: 腰を捻ると胴との距離が変わっている`);
    }
    // 盗賊は左右の短剣が中心線を越えないことも、捻っても変わらない
    if (cls === 'rogue') {
      for (const extra of WAIST_LOOK_SWEEP) {
        const pose = Object.assign({}, stance, {
          waist: [stance.waist[0], stance.waist[1] + extra, stance.waist[2]] });
        const issues = poseIssues(RIGS.male, pose,
          Object.assign({ noCross: true }, optsFor('rogue')));
        assert.deepEqual(issues, [], `rogue: ${issues.join(', ')}`);
      }
    }
  }
});

test('首・目・上体を同時に振り切っても、武器が頭を貫通しない', () => {
  for (const cls of CLASSES) {
    const stance = COMBAT_STANCES[cls];
    for (const extra of WAIST_LOOK_SWEEP) {
      const pose = Object.assign({}, stance, {
        waist: [stance.waist[0], stance.waist[1] + extra, stance.waist[2]] });
      const seg = weaponSegment(RIGS.male, pose, optsFor(cls));
      for (const head of HEAD_SWEEP) {
        const clear = -bladeHeadPenetration(RIGS.male, seg, head);
        assert.ok(clear > 0,
          `${cls}: 腰 ${(extra * 180 / Math.PI).toFixed(0)}度 / 首 yaw ${(head.yaw * 180 / Math.PI).toFixed(0)}度 で ${clear.toFixed(3)}m`);
      }
    }
  }
});

test('肘の可動域チェックそのもの', () => {
  assert.equal(elbowBroken(-1.2), false);
  assert.equal(elbowBroken(0.5), true, '正の値 = 逆方向に折れている');
  assert.equal(elbowBroken(-3.0), true, '深すぎ = 前腕が二の腕へめり込む');
});
