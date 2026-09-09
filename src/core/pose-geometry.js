/* ポーズの幾何チェック(関節破綻・武器の身体貫通の検出)

   これまで構えの調整は「実機で見て角度を少し直す」の繰り返しだった。
   05-rendering-rig.js の STANCE.warrior に積み上がったコメントがその記録で、
   shL.z を 0.66→0.56、shR.z を -0.22→-0.14 …… と、一つ直すたびに別の
   場所が破綻する、という直し方をしていた。

   原因は、腕・手・武器がどこへ行くのかを**測る手段が無かった**こと。
   ここはその手段だけを用意する純粋モジュール ―― ポーズ(shL/elL/…/wep)と
   体格(BUILD)から、手の位置・刃の線分・頭の球を実際に計算し、
   「刃が頭を貫いている」「肘が逆に折れている」を数値で答える。

   ゲーム側もこの計算を使う: 武器の収納位置(背中・腰)は、この同じ
   骨格寸法から導いた座標でなければ、背中に浮いた剣や腰にめり込んだ短剣に
   なる(holsterAnchorLocal)。テストだけのための足場ではない。

   座標系はすべて**waist ローカル**。頭・両腕・武器はすべて waist の
   子なので(buildPlayer の最後の付け替え参照)、waist 自身の回転は
   これら全部に等しく掛かる ―― つまり貫通の有無は waist ローカルで
   判定すれば足りる。 */

import * as THREE from 'three';

// 肩→肘、肘→手 の骨の長さ(buildPlayer の el.position.y / hand.position.y)
export const UPPER_ARM_LEN = 0.32;
export const FOREARM_LEN = 0.32;

/* BUILD(体格)から、ポーズ計算に必要な寸法だけを取り出す。
   buildPlayer() が実際に使っている式をそのまま写したもの:
     肩ピボット  (±(chest + shoulderOut), hipY + height*0.90, 0)
     頭          (0, hipY + height + headGap, HEAD_BACK_Z)
   いずれも waist(y = hipY)の子になるので、y から hipY を引く。 */
export function rigFromBuild(B, opts) {
  const o = opts || {};
  const headBackZ = o.headBackZ !== undefined ? o.headBackZ : -0.05;
  const headDepthMul = o.headDepthMul !== undefined ? o.headDepthMul : 0.85;
  return {
    shoulderX: B.chest + B.shoulderOut,
    shoulderY: B.height * 0.90,
    upperLen: UPPER_ARM_LEN,
    foreLen: FOREARM_LEN,
    torsoTop: B.height,          // 襟(waist ローカル)
    torsoR: B.chest,
    headY: B.height + B.headGap,
    headZ: headBackZ,
    headR: B.headR,
    headDepthR: B.headR * headDepthMul,
    hipR: B.hipR,
  };
}

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();

/* 片腕の順運動学。side は 'L' | 'R'。
   戻り値は waist ローカルの {shoulder, elbow, hand}。 */
export function armPoints(rig, pose, side) {
  const sh = side === 'L' ? pose.shL : pose.shR;
  const el = side === 'L' ? pose.elL : pose.elR;
  const sx = (side === 'L' ? -1 : 1) * rig.shoulderX;
  const shoulder = new THREE.Vector3(sx, rig.shoulderY, 0);
  const qs = new THREE.Quaternion().setFromEuler(_e.set(sh[0], sh[1], sh[2], 'XYZ'));
  const elbowLocal = new THREE.Vector3(0, -rig.upperLen, 0).applyQuaternion(qs);
  const elbow = shoulder.clone().add(elbowLocal);
  const qe = qs.clone().multiply(_q.setFromEuler(_e.set(el || 0, 0, 0, 'XYZ')));
  const hand = elbow.clone().add(new THREE.Vector3(0, -rig.foreLen, 0).applyQuaternion(qe));
  return { shoulder, elbow, hand };
}

/* 武器の握り位置と切っ先。updateGrip()/aimWeapon() と同じ手順:
     位置 = 握っている手(BOTH なら両手の中点) + gripOffset
     向き = wep[0..2] が刃の向き
   aimWorld(弓)の wep はキャラクター座標系で書かれているので、waist の
   回転を打ち消して waist ローカルへ戻す(aimWeapon() と同じ処理)。 */
export function weaponSegment(rig, pose, opts) {
  const o = opts || {};
  const gripOffset = o.gripOffset || [0, 0, 0];
  const tipLen = o.tipLen !== undefined ? o.tipLen : 0.4;
  const hands = { L: armPoints(rig, pose, 'L').hand, R: armPoints(rig, pose, 'R').hand };
  /* どちらの手を基準に置くか。gripW は連続値(0=右手, 0.5=両手の中点,
     1=左手)で、両手持ちから片手持ちへ移る間はこれが小数になる ――
     描画側(updateGrip)がまさにこの重みで位置を出しているので、検査も
     同じものを見る。gripW が無いポーズは従来どおり 'L'/'R'/'BOTH' から。 */
  const gw = o.gripW !== undefined ? o.gripW
           : (pose.gripW !== undefined ? pose.gripW : null);
  let at;
  if (gw !== null) {
    at = hands.R.clone().lerp(hands.L, Math.max(0, Math.min(1, gw)));
  } else {
    const grip = o.grip || pose.grip || 'R';
    at = grip === 'BOTH'
      ? hands.L.clone().add(hands.R).multiplyScalar(0.5)
      : (grip === 'L' ? hands.L.clone() : hands.R.clone());
  }
  at.add(new THREE.Vector3(gripOffset[0], gripOffset[1], gripOffset[2]));

  const dir = new THREE.Vector3(pose.wep[0], pose.wep[1], pose.wep[2]);
  if (dir.lengthSq() < 1e-8) dir.set(0, 1, 0);
  dir.normalize();
  if (o.aimWorld && pose.waist) {
    const inv = new THREE.Quaternion()
      .setFromEuler(_e.set(pose.waist[0], pose.waist[1], pose.waist[2], 'XYZ')).invert();
    dir.applyQuaternion(inv);
  }
  /* 収納位置とのブレンド。抜刀/納刀の途中では、武器は手でも収納位置でも
     なくその間にある ―― 描画側(updateGrip / applyStanceWeapon)がまさに
     この補間で位置と向きを出しているので、検査もそこを見ないと、
     背中の剣を「手が持っている」ものとして測ってしまう。 */
  const hb = o.holsterBlend || 0;
  if (hb > 0 && o.holsterPos) {
    at.lerp(o.holsterPos, hb).addScaledVector(
      new THREE.Vector3(gripOffset[0], gripOffset[1], gripOffset[2]), -hb);
    if (o.holsterWep) {
      const hd = new THREE.Vector3(o.holsterWep[0], o.holsterWep[1], o.holsterWep[2]).normalize();
      dir.lerp(hd, hb).normalize();
    }
  }
  return { grip: at, tip: at.clone().addScaledVector(dir, tipLen), dir, hands };
}

// 線分と点の最短距離(貫通判定の土台)
export function pointToSegment(p, a, b) {
  const ab = b.clone().sub(a);
  const len2 = ab.lengthSq();
  if (len2 < 1e-9) return p.distanceTo(a);
  let t = p.clone().sub(a).dot(ab) / len2;
  t = Math.max(0, Math.min(1, t));
  return p.distanceTo(a.clone().addScaledVector(ab, t));
}

/* 線分が「頭の球」にどれだけ食い込むか。頭は前後だけ潰れているので、
   z を headR/headDepthR 倍に伸ばしてから球として測る。
   戻り値 > 0 が貫通量(メートル)。 */
export function bladeHeadPenetration(rig, seg) {
  const zs = rig.headR / rig.headDepthR;
  const warp = v => new THREE.Vector3(v.x, v.y, (v.z - rig.headZ) * zs + rig.headZ);
  const d = pointToSegment(
    new THREE.Vector3(0, rig.headY, rig.headZ), warp(seg.grip), warp(seg.tip));
  return rig.headR - d;
}

/* 高さ y における胴体の半径。胴は円柱ではなく、ベルト(y=0)から胸へ
   向かって広がり、そこから襟へ向かって絞られた形(旋盤の輪郭)。
   一律 chest 半径で見ると、腰の短剣も鎖骨の高さにある弓の引き手も
   まとめて「胴の中」と判定してしまう。 */
export const TORSO_CHEST_FRAC = 0.44;      // ここまでで胸幅まで広がる
export const TORSO_SHOULDER_FRAC = 0.72;   // ここから上が襟へ向かって絞られる
export function torsoRadiusAt(rig, y) {
  if (y < -0.05 || y > rig.torsoTop) return 0;
  const chestY = rig.torsoTop * TORSO_CHEST_FRAC;
  const collarY = rig.torsoTop * TORSO_SHOULDER_FRAC;
  if (y <= chestY) {
    const k = Math.max(0, y) / Math.max(1e-4, chestY);
    return rig.hipR + (rig.torsoR - rig.hipR) * k;
  }
  if (y <= collarY) return rig.torsoR;
  const k = (y - collarY) / Math.max(1e-4, rig.torsoTop - collarY);
  return rig.torsoR * (1 - 0.45 * k);
}

/* 線分が胴体へ食い込む量。刃の線分をサンプリングし、胴の高さ範囲に
   ある点で軸からの距離を見る。 */
export function bladeTorsoPenetration(rig, seg, samples) {
  const n = samples || 24;
  let worst = -Infinity;
  for (let i = 0; i <= n; i++) {
    const p = seg.grip.clone().lerp(seg.tip, i / n);
    const r0 = torsoRadiusAt(rig, p.y);
    if (r0 <= 0) continue;
    worst = Math.max(worst, r0 - Math.hypot(p.x, p.z));
  }
  return worst === -Infinity ? -1 : worst;
}

/* 肘の可動域。elbow.x は負で前腕を前へ折り畳む。
   正 = 逆方向に折れている(関節が折れて見える)。
   -2.7 より深い = 前腕が二の腕へめり込む。 */
export const ELBOW_MIN = -2.65;
export const ELBOW_MAX = 0.12;
export function elbowBroken(el) {
  return !(el >= ELBOW_MIN && el <= ELBOW_MAX);
}

/* ポーズ1つの検査。問題があった項目名の配列を返す(空配列 = 問題なし)。
   opts:
     gripOffset / tipLen / grip / aimWorld  weaponSegment と同じ
     headClearance   刃と頭の間に最低限空けたい距離(m)
     handClearance   手が胴体の内側へ入り込むのを許す量(m)
     noCross         true なら左右の手が体の中心線を越えていないか見る */
export function poseIssues(rig, pose, opts) {
  const o = opts || {};
  const issues = [];
  const headClear = o.headClearance !== undefined ? o.headClearance : 0.02;
  const handClear = o.handClearance !== undefined ? o.handClearance : 0.06;

  if (elbowBroken(pose.elL)) issues.push('elbowL:' + pose.elL);
  if (elbowBroken(pose.elR)) issues.push('elbowR:' + pose.elR);

  const seg = weaponSegment(rig, pose, o);
  const headPen = bladeHeadPenetration(rig, seg);
  if (headPen > -headClear) issues.push('bladeThroughHead:' + headPen.toFixed(3));
  /* 鞘から抜いている最中だけは、刃が体表を擦るのが正しい ―― 背中の鞘から
     引き抜く動作は、定義からして刃が背中に沿って滑る動きだから。胴体を
     円柱で近似している誤差もこの程度あるので、受け渡しの最中に限って
     数ミリの接触を許す(呼び出し側が明示的に渡した時だけ)。 */
  const torsoTol = o.bladeTorsoTolerance || 0;
  const torsoPen = bladeTorsoPenetration(rig, seg);
  if (torsoPen > torsoTol) issues.push('bladeThroughTorso:' + torsoPen.toFixed(3));

  ['L', 'R'].forEach(side => {
    const a = armPoints(rig, pose, side);
    // 手・肘が胴体へ埋まっていないか。手だけ見ていると、前で組んだ腕の
    // 肘が胸へ潜り込んでいるのを見落とす
    [['hand', a.hand], ['elbow', a.elbow]].forEach(([what, p]) => {
      const r0 = torsoRadiusAt(rig, p.y);
      if (r0 <= 0) return;
      const r = Math.hypot(p.x, p.z);
      if (r < r0 - handClear) {
        issues.push(what + 'InsideTorso' + side + ':' + r.toFixed(3));
      }
    });
    if (o.noCross) {
      const cross = side === 'L' ? a.hand.x > 0.04 : a.hand.x < -0.04;
      if (cross) issues.push('handCrossesCentre' + side + ':' + a.hand.x.toFixed(3));
    }
  });
  return issues;
}

/* 武器の収納位置と、そこでの向き(waist ローカル)。ゲーム側
   (05-rendering-rig.js の refreshHolsterAnchors)もテストも同じここを見るので、
   体格を変えても収納位置だけが置き去りにならない。

   pos は武器の原点(= 手が握る位置)。背中の大剣なら「右肩の上に出た柄」、
   腰の短剣なら「ベルトの横に立った柄」がここに来る ―― どちらも手が
   実際に届く場所でなければ、抜刀が「宙を掴む」動きになる。
   wep は aimWeapon() と同じ [刃の向き ×3, 刃筋 ×3]。 */
export function holsterAnchorLocal(rig, attach, classKey) {
  switch (attach) {
    case 'BACK':
      if (classKey === 'archer') {
        // 弓は背中の左寄りへ斜めに掛ける(矢筒が右背にあるため左側)
        return { pos: new THREE.Vector3(-0.24, rig.torsoTop * 0.40, -rig.torsoR - 0.02),
                 wep: [0.38, 0.86, -0.34, 0, 0, -1] };
      }
      // 大剣: 柄が右肩の上に出て、刃が背中を左下へ斜めに横切る
      return { pos: new THREE.Vector3(0.24, rig.torsoTop * 0.74, -rig.torsoR - 0.02),
               wep: [-0.42, -0.88, -0.22, 0.90, -0.43, 0] };
    case 'HIP_RIGHT':
      // ベルトの真横。柄が上、刃は太腿に沿って下へ
      return { pos: new THREE.Vector3(rig.hipR * 1.24, 0.15, 0.03),
               wep: [0.10, -0.90, -0.42, 0.99, 0.10, 0] };
    case 'HIP_LEFT':
      return { pos: new THREE.Vector3(-rig.hipR * 1.24, 0.15, 0.03),
               wep: [-0.10, -0.90, -0.42, 0.99, -0.10, 0] };
    default:
      return { pos: new THREE.Vector3(0, 0, 0), wep: [0, 1, 0, 1, 0, 0] };
  }
}
