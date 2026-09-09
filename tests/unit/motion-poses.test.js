// 抜刀 / 戦闘終了の余韻 / 納刀の「途中のポーズ」まで含めて、関節破綻と
// 武器の身体貫通が無いことを固定するテスト。`npm run test:unit` で実行。
//
// 構えだけを検査しても、抜刀の途中で肘が胸へ潜り込む・刃が頭を横切る、
// といった破綻は拾えない。ここはクリップを実際にサンプリングして、
// 全フレームに対して core/pose-geometry.js を掛ける。
//
// 武器が背中や腰に収まっている間は刃の位置が手ではなく収納位置で決まる
// ので、刃の貫通判定は「武器が手にある」フレームだけに掛ける ――
// その境目は core/character-motion-state.js の holsterBlend が答える
// (見た目の受け渡しと、テストの判定基準が同じ1つの曲線を共有する)。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOTION_POSES, MOTION_STANCE_POSES } from '../../src/core/motion-poses.js';
import { COMBAT_STANCES, GRIP_OFFSETS } from '../../src/core/combat-stances.js';
import { rigFromBuild, poseIssues, armPoints, holsterAnchorLocal } from '../../src/core/pose-geometry.js';
import { HEAD_LIMITS, NECK_PIVOT_FRAC } from '../../src/core/head-rig.js';
import {
  CHARACTER_STATE, WEAPON_STATE, ATTACH, holsterBlend, timingFor, attachFor, MOTION_TIMING,
} from '../../src/core/character-motion-state.js';

const RIG = rigFromBuild(
  {height:0.80, hipY:1.10, chest:0.345, shoulderOut:0.105, headR:0.3705, headGap:0.27, hipR:0.265},
  {headBackZ:-0.05, headDepthMul:0.85, neckPivotFrac: NECK_PIVOT_FRAC});
const CLASSES = ['warrior', 'rogue', 'mage', 'archer'];

// 05-rendering-rig.js の sampleClip() と同じ補間(イージングは形の検査に
// 影響しないので線形で十分 ―― キーフレーム間のどこを見ても破綻しないことが
// 確かめたいこと)
function sampleLinear(frames, t) {
  let i = 0;
  while (i < frames.length - 1 && t > frames[i + 1].t) i++;
  const a = frames[i], b = frames[Math.min(i + 1, frames.length - 1)];
  const k = Math.max(0, Math.min(1, (t - a.t) / Math.max(1e-4, b.t - a.t)));
  const out = {};
  for (const key in a) {
    if (key === 't' || key === 'e') continue;
    const av = a[key], bv = b[key] !== undefined ? b[key] : av;
    if (Array.isArray(av)) out[key] = av.map((v, j) => v + ((bv[j] !== undefined ? bv[j] : v) - v) * k);
    else if (typeof av === 'number') out[key] = av + (bv - av) * k;
    else out[key] = k < 0.5 ? av : bv;
  }
  return out;
}

const clipsFor = (cls) => {
  const lib = MOTION_POSES[cls];
  const combat = COMBAT_STANCES[cls];
  return { draw: lib.draw(combat), post: lib.post(combat), sheathe: lib.sheathe(combat) };
};

/* そのクリップの t での「武器の居場所」。描画側(updateGrip /
   applyStanceWeapon)とまったく同じ考え方で、手と収納位置の間を
   holsterBlend で補間した位置を検査に渡す ―― こうしないと、背中に
   収まっている剣を「手が持っている」ものとして測ってしまう。 */
function holsterOpts(cls, kind, t) {
  const att = attachFor(cls);
  if (att.sheathed === ATTACH.HAND_BOTH) return {};   // 杖はしまわない
  const anchor = holsterAnchorLocal(RIG, att.sheathed, cls);
  let blend;
  if (kind === 'post') blend = 0;                     // 余韻の間、武器は手にある
  else {
    const drawing = kind === 'draw';
    blend = holsterBlend({
      classKey: cls,
      t: t * timingFor(cls)[drawing ? 'draw' : 'sheathe'],
      character: drawing ? CHARACTER_STATE.DRAWING : CHARACTER_STATE.SHEATHING,
      weapon: drawing ? WEAPON_STATE.DRAWING : WEAPON_STATE.SHEATHING,
    });
  }
  return {
    holsterBlend: blend, holsterPos: anchor.pos, holsterWep: anchor.wep,
    /* 抜き差しの最中(0 < blend < 1)だけ、刃が体表を擦るのを数ミリ許す。
       背中の鞘から引き抜く動作は定義からして刃が背中に沿って滑る動きで、
       胴体を円柱で近似している誤差もこの程度ある。収まりきっている時
       (blend=1)と手にある時(blend=0)は一切許さない。 */
    bladeTorsoTolerance: (blend > 0.001 && blend < 0.999) ? 0.012 : 0,
  };
}

test('立ち姿(酒場 / 探索 / 抜刀の途中 / 納刀の途中)に関節破綻が無い', () => {
  for (const name in MOTION_STANCE_POSES) {
    const pose = MOTION_STANCE_POSES[name];
    const cls = name.split('.')[0];
    // 武器の位置は状態によって変わるので、ここは関節だけを見る
    // (刃の位置はクリップ全域を追う次のテストが、収納位置とのブレンド
    //  込みで検査している)
    const issues = poseIssues(RIG, pose, {
      gripOffset: GRIP_OFFSETS[cls], tipLen: 0, grip: pose.grip || COMBAT_STANCES[cls].grip });
    assert.deepEqual(issues.filter(i => !i.startsWith('blade')), [], `${name}: ${issues.join(', ')}`);
  }
});

test('抜刀・納刀・余韻の全フレームで関節が破綻せず、手にある武器が体を貫通しない', async (t) => {
  for (const cls of CLASSES) {
    await t.test(cls, () => {
      const clips = clipsFor(cls);
      const st = COMBAT_STANCES[cls];
      for (const kind of ['draw', 'post', 'sheathe']) {
        for (let i = 0; i <= 40; i++) {
          const u = i / 40;
          const pose = sampleLinear(clips[kind], u);
          const issues = poseIssues(RIG, pose, Object.assign({
            gripOffset: GRIP_OFFSETS[cls],
            tipLen: st.tip,
            grip: pose.grip || st.grip,
            aimWorld: !!st.aimWorld,
          }, holsterOpts(cls, kind, u)));
          assert.deepEqual(issues, [], `${cls}/${kind} t=${u.toFixed(2)}: ${issues.join(', ')}`);
        }
      }
    });
  }
});

test('抜刀・納刀の途中で首を振っても、武器が頭を貫通しない', async (t) => {
  /* Head Rig を入れたことで頭は正面固定ではなくなった。抜刀で刃が顔の
     すぐ横を通る職(剣士)では、そこで首を振っているかどうかで当たり方が
     変わるため、可動域の端でも確かめる。 */
  const heads = [
    { yaw: 0, pitch: 0 },
    { yaw: HEAD_LIMITS.yaw, pitch: 0 },
    { yaw: -HEAD_LIMITS.yaw, pitch: 0 },
    { yaw: HEAD_LIMITS.yaw, pitch: HEAD_LIMITS.pitch },
    { yaw: -HEAD_LIMITS.yaw, pitch: -HEAD_LIMITS.pitch },
  ];
  for (const cls of CLASSES) {
    await t.test(cls, () => {
      const clips = clipsFor(cls);
      const st = COMBAT_STANCES[cls];
      for (const kind of ['draw', 'post', 'sheathe']) {
        for (let i = 0; i <= 24; i++) {
          const u = i / 24;
          const pose = sampleLinear(clips[kind], u);
          for (const head of heads) {
            const issues = poseIssues(RIG, pose, Object.assign({
              gripOffset: GRIP_OFFSETS[cls], tipLen: st.tip,
              grip: pose.grip || st.grip, aimWorld: !!st.aimWorld, head,
            }, holsterOpts(cls, kind, u))).filter(x => x.startsWith('bladeThroughHead'));
            assert.deepEqual(issues, [],
              `${cls}/${kind} t=${u.toFixed(2)} yaw=${(head.yaw * 180 / Math.PI).toFixed(0)}度: ${issues.join(', ')}`);
          }
        }
      }
    });
  }
});

test('クリップは 0 で始まり 1 で終わり、抜刀の終点が戦闘の構えと一致する', () => {
  for (const cls of CLASSES) {
    const clips = clipsFor(cls);
    for (const kind of ['draw', 'post', 'sheathe']) {
      const fr = clips[kind];
      assert.equal(fr[0].t, 0, `${cls}/${kind} の最初のフレーム`);
      assert.equal(fr[fr.length - 1].t, 1, `${cls}/${kind} の最後のフレーム`);
    }
    // 抜き切った瞬間の姿勢が戦闘の構えそのものでないと、抜刀の直後に
    // 構えが一段飛ぶ(=攻撃の開始姿勢と繋がらない)
    const last = clips.draw[clips.draw.length - 1];
    ['shL', 'shR', 'waist', 'wep'].forEach(k =>
      assert.deepEqual(last[k], COMBAT_STANCES[cls][k], `${cls}: 抜刀の終点 ${k}`));
    assert.equal(last.elL, COMBAT_STANCES[cls].elL);
    assert.equal(last.elR, COMBAT_STANCES[cls].elR);
    // 納刀の終点は探索の立ち姿。ここが合っていないと、しまい終えた瞬間に姿勢が飛ぶ
    const sheatheEnd = clips.sheathe[clips.sheathe.length - 1];
    assert.deepEqual(sheatheEnd.shL, MOTION_POSES[cls].explore.shL, `${cls}: 納刀の終点`);
    // 余韻の終点と納刀の始点も繋がっている必要がある
    const postEnd = clips.post[clips.post.length - 1];
    assert.deepEqual(postEnd.shL, clips.sheathe[0].shL, `${cls}: 余韻 → 納刀の繋ぎ`);
    assert.deepEqual(postEnd.waist, clips.sheathe[0].waist, `${cls}: 余韻 → 納刀の繋ぎ(腰)`);
  }
});

test('盗賊: 抜刀も納刀も必ず左右同時(片手だけ先に動かない)', () => {
  const clips = clipsFor('rogue');
  const mirrored = (a, b) => Math.abs(a[0] - b[0]) < 1e-6
                          && Math.abs(a[1] + b[1]) < 1e-6
                          && Math.abs(a[2] + b[2]) < 1e-6;
  for (const kind of ['draw', 'sheathe']) {
    for (let i = 0; i <= 40; i++) {
      const p = sampleLinear(clips[kind], i / 40);
      // 構えのフレームだけは左右非対称(戦闘の構えそのもの)。それ以外の
      // 抜き差しの区間は、左右の腕が常に鏡像でなければならない
      const t = i / 40;
      /* 構えそのものは左右非対称(戦闘の構え)なので、そこへ入る/そこから
         出る区間は除く。抜き差しそのもの ―― 両手を腰へ落とし、両短剣を
         同時に引き抜くところ(draw の 0〜0.66、sheathe の 0.34〜1.0)は、
         左右が常に鏡像でなければならない */
      const inGuard = (kind === 'draw' && t > 0.66) || (kind === 'sheathe' && t < 0.34);
      if (inGuard) continue;
      assert.ok(mirrored(p.shL, p.shR), `rogue/${kind} t=${t.toFixed(2)}: 左右の腕が非対称`);
      assert.ok(Math.abs(p.elL - p.elR) < 1e-6, `rogue/${kind} t=${t.toFixed(2)}: 左右の肘が非対称`);
    }
  }
});

test('盗賊: 抜刀開始で腰を落とす(低重心)', () => {
  const crouch = MOTION_STANCE_POSES['rogue.crouch'];
  const explore = MOTION_STANCE_POSES['rogue.explore'];
  assert.ok(crouch.kneeL > explore.kneeL + 0.2, '膝が明確に深く曲がる');
  assert.ok(crouch.kneeL === crouch.kneeR, '左右の膝は同じだけ曲げる');
  assert.ok(crouch.waist[0] > explore.waist[0], '上半身がわずかに前傾する');
});

/* 「武器をどちらの手基準で置くか」の連続値。05-rendering-rig.js の
   poseGripW() と同じ読み替え ―― 立ち姿は gripW を直接持ち、戦闘の構えは
   grip:'L'/'R'/'BOTH' で書かれているので、後者を同じ意味の数値に直す。 */
const gripW = (pose) => pose.gripW !== undefined
  ? pose.gripW
  : (pose.grip === 'BOTH' ? 0.5 : (pose.grip === 'L' ? 1 : 0));

test('武器を持つ手が、クリップのどこでも飛ばない(戦闘の構えへ入る所を含む)', () => {
  /* 実時間あたりの変化量で見る。両手の間は 60cm ほど離れているので、
     重み 1.0 の移動 = 武器の基準点が 60cm 動くこと。6/秒 なら
     持ち替えに最低 0.17 秒はかかる計算で、それより速ければ
     「持ち手が飛んだ」ように見える。 */
  const MAX_RATE = 6.0;
  for (const cls of CLASSES) {
    const clips = clipsFor(cls);
    const T = MOTION_TIMING[cls];
    for (const kind of ['draw', 'post', 'sheathe']) {
      const dur = kind === 'draw' ? T.draw : kind === 'post' ? T.postCombat : T.sheathe;
      const dt = dur / 120;
      let prev = null, worst = 0, at = 0;
      for (let i = 0; i <= 120; i++) {
        const w = gripW(sampleLinear(clips[kind], i / 120));
        if (prev !== null) {
          const rate = Math.abs(w - prev) / dt;
          if (rate > worst) { worst = rate; at = i / 120; }
        }
        prev = w;
      }
      assert.ok(worst < MAX_RATE,
        `${cls}/${kind} t=${at.toFixed(2)}: 持ち手が ${worst.toFixed(1)}/秒 で移る(速すぎる)`);
    }
    // 抜刀の終点は戦闘の構えの持ち手と一致していなければならない
    // (ここがずれていると、抜き終えた瞬間に武器が反対の手へ滑る)
    const drawEnd = clips.draw[clips.draw.length - 1];
    assert.equal(gripW(drawEnd), gripW(COMBAT_STANCES[cls]), `${cls}: 抜刀の終点の持ち手`);
    const sheatheEnd = clips.sheathe[clips.sheathe.length - 1];
    assert.equal(gripW(sheatheEnd), gripW(MOTION_POSES[cls].explore), `${cls}: 納刀の終点の持ち手`);
  }
});

test('魔法使い: 杖をしまわず、両手持ち ↔ 右手主体の持ち替えだけで表す', () => {
  const explore = MOTION_POSES.mage.explore;
  assert.equal(explore.gripW, 0.5, '探索中は両手の中点で杖を持つ');
  assert.equal(COMBAT_STANCES.mage.grip, 'R', '戦闘中は右手主体');
  // 持ち替えは連続値なので、クリップのどこにも 0.5 → 0 の飛びが無い
  const draw = MOTION_POSES.mage.draw(COMBAT_STANCES.mage);
  assert.equal(gripW(draw[0]), 0.5, '抜刀の始点は両手持ち');
  assert.equal(gripW(draw[draw.length - 1]), 0, '抜刀の終点は右手主体');
  // 探索中の杖は垂直でも中心線上でもない(「胸の前で斜めに持つ」)
  const dir = explore.wep;
  assert.ok(Math.abs(dir[1]) < 0.92, '杖が完全な垂直になっていない');
  assert.ok(Math.abs(dir[0]) > 0.2, '杖が体の中心線と完全には重ならない');
});

test('弓師: 納刀で体の向きを先に正面へ戻さない(残心)', () => {
  const sheathe = MOTION_POSES.archer.sheathe(COMBAT_STANCES.archer);
  const yawAt = (t) => sampleLinear(sheathe, t).waist[1];
  const combatYaw = COMBAT_STANCES.archer.waist[1];
  const stow = MOTION_TIMING.archer.stowFrac;
  // 弓が収まる瞬間(stowFrac)でも、半身はまだ崩れていない
  assert.ok(yawAt(stow) > combatYaw * 0.9,
    `弓を収める時点でまだ半身 (yaw=${yawAt(stow).toFixed(2)} / 構え=${combatYaw})`);
  // 収納後もしばらく維持する = 残心
  assert.ok(yawAt(0.78) > combatYaw * 0.8, '収納後も一拍そのままの姿勢を保つ');
  // 正面へ戻るのは最後だけ
  assert.ok(yawAt(1.0) < 0.05, '最後にようやく正面へ戻る');
  assert.ok(yawAt(0.9) > yawAt(1.0), '向き直しは単調に最後で起きる');
});

test('弓師: 納刀は「弓をしまう」→「姿勢を戻す」の順(逆にならない)', () => {
  const sheathe = MOTION_POSES.archer.sheathe(COMBAT_STANCES.archer);
  const yawAt = (t) => sampleLinear(sheathe, t).waist[1];
  const stow = MOTION_TIMING.archer.stowFrac;
  // 収納が終わる時点の残り半身 > その後の任意の時点の半身、という単調性
  let squaredUpBefore = false;
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    if (t < stow && yawAt(t) < COMBAT_STANCES.archer.waist[1] * 0.6) squaredUpBefore = true;
  }
  assert.equal(squaredUpBefore, false, '弓を収め終える前に体が正面へ戻り始めていない');
});

test('剣士: 抜刀は背中へ手を伸ばしてから武器が動く', () => {
  const reach = MOTION_STANCE_POSES['warrior.reach'];
  const L = armPoints(RIG, reach, 'L').hand, R = armPoints(RIG, reach, 'R').hand;
  assert.ok(L.z < -0.1 && R.z < -0.1, '両手とも体の後ろへ回っている');
  // 武器が背中を離れるのは、手が柄に届いた後(grabFrac)
  const grab = MOTION_TIMING.warrior.grabFrac;
  const draw = MOTION_POSES.warrior.draw(COMBAT_STANCES.warrior);
  const handsBehind = draw.filter(fr => {
    const l = armPoints(RIG, fr, 'L').hand, r = armPoints(RIG, fr, 'R').hand;
    return l.z < -0.1 && r.z < -0.1;
  });
  assert.ok(handsBehind.length > 0, '両手を背中へ回すフレームがある');
  assert.ok(handsBehind[0].t < grab,
    `柄を掴む(t=${grab})より前に手が背中へ届いている (t=${handsBehind[0].t})`);
});

test('4職の抜刀速度がすべて違う(同じ速度で抜かない)', () => {
  const draws = CLASSES.map(c => MOTION_TIMING[c].draw);
  assert.equal(new Set(draws).size, 4);
  assert.ok(MOTION_TIMING.rogue.draw < MOTION_TIMING.mage.draw);
  assert.ok(MOTION_TIMING.mage.draw < MOTION_TIMING.archer.draw);
  assert.ok(MOTION_TIMING.archer.draw < MOTION_TIMING.warrior.draw);
});
