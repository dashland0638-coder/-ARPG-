// 魔導士(Mage Lord)専用 Combat Idle のユニットテスト。
// `npm run test:unit` で実行。
//
// 魔法使い = Focus(敵に集中している)に対し、魔導士 = Control
// (強い力を余裕を持って制御している)。ここで固定したいのは、その差が
// 「速く/大きく動く」ではなく「遅く、体を動かさず、杖だけをゆっくり
// 大きく動かす」方向に付いていること。
//
// もう一つ、この職には数値の制約がある。魔弾は杖頭から出て水平に飛び、
// 当たり判定は敵の足元との高さの差 1.8m 未満で見ているが、上位職は武器が
// 1.32 倍に拡大されるため杖頭が 1.78m まで上がっている(実測)。窓まで
// 2cm しかないので、Idle が杖を上へ動かしてはいけない。
import { test } from 'node:test';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import {
  COMBAT_IDLE, JOB_COMBAT_IDLE, ATTACK_SETTLE, JOB_ATTACK_SETTLE, IDLE_MAX_AMPLITUDE,
  combatIdleProfile, combatIdleOffsets, idleProfileFor,
  attackSettleProfile, attackSettleAmount,
} from '../../src/core/combat-idle.js';
import { COMBAT_STANCES, GRIP_OFFSETS } from '../../src/core/combat-stances.js';
import { rigFromBuild, weaponSegment } from '../../src/core/pose-geometry.js';

const require = createRequire(import.meta.url);

const MAGE = combatIdleProfile('mage');
const LORD = combatIdleProfile('mage', 'archmage');
const RIG = rigFromBuild(
  { height: 0.80, hipY: 1.10, chest: 0.345, shoulderOut: 0.105,
    headR: 0.3705, headGap: 0.27, hipR: 0.265 },
  { headBackZ: -0.05, headDepthMul: 0.85 });

// 上位職の武器はどれも 1.32 倍に拡大される(applyJobPromotionVisual)
// 上位職の武器はどれも 1.32 倍に拡大される(applyJobPromotionVisual)
const UPPER_JOB_WEAPON_SCALE = 1.32;
/* 弾が当たると見なす高さの差。src/legacy/parts/13-update-loop.js の
   PROJECTILE_HEIGHT_WINDOW と同じ値。ここを変える時は両方直すこと
   (下の「同じ値を使っている」テストが drift を検出する)。 */
const PROJECTILE_HEIGHT_WINDOW = 1.8;
/* この骨格モデルで出る魔導士の杖頭の高さ。実機の計測値(デバッグ表示の
   TipWorldY)は 1.784m で、モデルはそれを 2cm ほど高く見積もる(握りの
   補正と体格の差)。だからこの数値は「窓までの本当の余裕」ではなく、
   構えや杖の長さが動いた時に気付くための固定値として使う。
   本当の余裕は実機の 1.784m と窓 1.80m の差 = 約 1.6cm。 */
const ARCHMAGE_STAFF_MODEL_MAX_Y = 1.82;

/* 杖頭のワールド高さ。描画側(updateGrip → aimWeapon)と同じ手順を
   weaponSegment に通す ―― 握り位置は右手 + GRIP_OFFSET、杖の向きは wep を
   正規化したもの、杖頭はそこから tip × 武器スケール ぶん先。 */
function staffHeadWorldY({ wepBias = [0, 0, 0], scale = 1 } = {}) {
  const st = COMBAT_STANCES.mage;
  const pose = { ...st, wep: st.wep.map((v, i) => v + (wepBias[i] || 0)) };
  const seg = weaponSegment(RIG, pose, {
    gripOffset: GRIP_OFFSETS.mage, tipLen: st.tip * scale });
  return 1.10 /* hipY */ + seg.tip.y;
}

test('魔導士: 専用のプロファイルを持っている(魔法使いの使い回しではない)', () => {
  assert.ok(JOB_COMBAT_IDLE.archmage, '専用プロファイルが存在する');
  assert.notEqual(LORD, MAGE);
  assert.equal(LORD, JOB_COMBAT_IDLE.archmage);
  // 書いていない上位職は基礎職をそのまま継承する(壊さないための既定)
  ['battleKnight', 'berserker', 'hawkEye'].forEach(job => {
    const base = { battleKnight: 'warrior', berserker: 'rogue', hawkEye: 'archer' }[job];
    assert.equal(combatIdleProfile(base, job), COMBAT_IDLE[base], `${job} は基礎職を継承`);
  });
  // 転身していなければ基礎職のまま
  assert.equal(combatIdleProfile('mage', null), MAGE);
  assert.equal(combatIdleProfile('mage', undefined), MAGE);
});

test('魔導士: 魔法使いより遅い(Control は速さで出さない)', () => {
  assert.ok(LORD.rate < MAGE.rate, `魔導士 ${LORD.rate} / 魔法使い ${MAGE.rate}`);
  assert.ok(LORD.rate >= 0.65 && LORD.rate <= 0.85, `速度 ${LORD.rate} が指定の範囲外`);
  // 4基礎職の中でもいちばん遅い(剣士 0.85 より遅い or 同等)
  const rates = ['warrior', 'rogue', 'mage', 'archer'].map(c => COMBAT_IDLE[c].rate);
  assert.ok(LORD.rate <= Math.min(...rates), '基礎職のどれよりも遅い');
});

test('魔導士: 体をさらに動かさない(重心・肩・前後傾)', () => {
  // 重心は魔法使いの 50〜70%
  const ratio = LORD.waistRoll / MAGE.waistRoll;
  assert.ok(ratio >= 0.5 && ratio <= 0.7, `重心の比 ${ratio.toFixed(2)} が指定の範囲外`);
  assert.ok(LORD.hip < MAGE.hip && LORD.knee < MAGE.knee, '脚もさらに動かさない');
  assert.ok(LORD.shoulder < MAGE.shoulder, '肩は最小');
  // 「呼吸しているように上下に揺れる」を避ける ―― 前後傾は魔法使いより小さい
  assert.ok(LORD.waistPitch < MAGE.waistPitch, `前後傾 ${LORD.waistPitch} / ${MAGE.waistPitch}`);
  // 4職+魔導士の中でいちばん体が動かない
  ['warrior', 'rogue', 'mage', 'archer'].forEach(c => {
    assert.ok(LORD.waistRoll <= COMBAT_IDLE[c].waistRoll, `${c} より重心が動かない`);
    assert.ok(LORD.shoulder <= COMBAT_IDLE[c].shoulder, `${c} より肩が動かない`);
  });
});

test('魔導士: 杖はゆっくり大きく、左手の制御は残す', () => {
  // 杖(左右)は魔法使いより大きく、指定の範囲(0.015〜0.025)に収まる
  assert.ok(LORD.wepYaw > MAGE.wepYaw, '杖の振りは魔法使いより大きい');
  assert.ok(LORD.wepYaw >= 0.015 && LORD.wepYaw <= 0.025, `杖 ${LORD.wepYaw} が指定の範囲外`);
  // 左手(肘)は残す ―― 「魔力を制御している」のはここ
  assert.ok(LORD.elbow > 0.015, `左手の制御が消えている (${LORD.elbow})`);
  assert.ok(LORD.elbow <= MAGE.elbow, '左手は魔法使いより大きくしない');
  // 動かす優先順位: 杖 > 左手(肘) > 肩 > 重心
  assert.ok(LORD.wepYaw > LORD.elbow, '杖がいちばん動く');
  assert.ok(LORD.elbow > LORD.shoulder, '左手が肩より動く');
  assert.ok(LORD.shoulder > LORD.waistRoll, '肩が重心より動く');
  // 揺れの域は超えない
  const keys = ['shoulder', 'elbow', 'waistPitch', 'waistRoll', 'waistYaw', 'hip', 'knee', 'wepYaw', 'wepPitch'];
  keys.forEach(k => assert.ok(LORD[k] <= IDLE_MAX_AMPLITUDE + 1e-9, `${k} ${LORD[k]}`));
});

test('魔導士: 杖の揺れが魔弾の発射高さを持ち上げない', () => {
  /* 魔弾は杖頭から出て水平に飛び、当たり判定は「弾と敵の足元の高さの差が
     1.8m 未満」で見ている。上位職は杖が 1.32 倍に拡大されるので杖頭は
     実機で 1.784m ―― 窓まで 1.6cm しか残っていない。ここで Idle が杖を
     上へ振ると、まっすぐ狙っても弾が当たらなくなる。前フェーズで魔法使いで
     実際に踏んだ不具合の、上位職版。 */
  const rest = staffHeadWorldY({ scale: UPPER_JOB_WEAPON_SCALE });
  assert.ok(rest < ARCHMAGE_STAFF_MODEL_MAX_Y,
    `杖頭が ${rest.toFixed(3)}m まで上がっている(構えか杖の長さが動いた)`);

  // 揺れを一周期ぶん通して、杖頭がいちばん高くなる時刻を探す
  let worst = rest;
  for (let t = 0; t < 40; t += 1 / 90) {
    const o = combatIdleOffsets('mage', t, 1, 'archmage');
    worst = Math.max(worst, staffHeadWorldY({
      wepBias: [o.wepYaw, 0, o.wepPitch], scale: UPPER_JOB_WEAPON_SCALE }));
  }
  const lift = worst - rest;
  /* 余裕(実機で約 1.6cm)に対して、揺れが食う量は一桁小さくしておく。
     杖は左右(x)と前後(z)にしか振っていないので、残るのは正規化を
     通るぶんのわずかな高さ変化だけ。 */
  assert.ok(lift < 0.004,
    `Idle が杖頭を ${(lift * 1000).toFixed(1)}mm 持ち上げている(実機の余裕は約 16mm)`);

  // 揺れが縦(wep[1])に掛かっていないこと ―― 上の数値がそうなる理由
  const fs = require('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/legacy/parts/05-rendering-rig.js', import.meta.url), 'utf8');
  assert.match(src, /i === 0 \? _idle\.wepYaw : i === 2 \? _idle\.wepPitch : 0/,
    '杖の揺れが縦成分(wep[1])にも掛かるようになっている');

  // 基礎の魔法使いにも同じ検査(こちらは拡大が無いので余裕がある)
  const mageRest = staffHeadWorldY({ scale: 1 });
  let mageWorst = mageRest;
  for (let t = 0; t < 40; t += 1 / 90) {
    const o = combatIdleOffsets('mage', t, 1);
    mageWorst = Math.max(mageWorst, staffHeadWorldY({ wepBias: [o.wepYaw, 0, o.wepPitch], scale: 1 }));
  }
  assert.ok(mageWorst < PROJECTILE_HEIGHT_WINDOW - 0.05,
    `魔法使いの杖頭 ${mageWorst.toFixed(3)}m の余裕が薄い`);
});

test('魔導士: 攻撃後に大きく反動を取らず、長くゆっくり収束する', () => {
  const mage = attackSettleProfile('mage');
  const lord = attackSettleProfile('mage', 'archmage');
  assert.ok(JOB_ATTACK_SETTLE.archmage, '専用の収まりを持っている');
  assert.notEqual(lord, mage);
  assert.ok(lord.amp < mage.amp, `振幅 ${lord.amp} / ${mage.amp}`);
  assert.ok(lord.dur > mage.dur, `長さ ${lord.dur} / ${mage.dur}`);
  assert.ok(lord.rate < mage.rate, '揺れ自体もゆっくり');
  // 有限時間で必ず消える
  assert.equal(attackSettleAmount('mage', lord.dur, 'archmage'), 0);
  assert.equal(attackSettleAmount('mage', lord.dur + 1, 'archmage'), 0);
  // 4基礎職の収まりには影響していない
  ['warrior', 'rogue', 'mage', 'archer'].forEach(c => {
    assert.equal(attackSettleProfile(c), ATTACK_SETTLE[c]);
  });
});

test('魔導士: 酒場・探索では状態ごとの立ち方に戻る(戦闘だけが職業固有)', () => {
  // 酒場・探索のくつろぎ方に職業差は付けていない ―― そこは状態が決める
  assert.equal(idleProfileFor('SOCIAL', 'mage', 'archmage'),
               idleProfileFor('SOCIAL', 'warrior', null));
  assert.equal(idleProfileFor('EXPLORATION', 'mage', 'archmage'),
               idleProfileFor('EXPLORATION', 'rogue', null));
  // 戦闘まわりの状態では専用プロファイル
  ['COMBAT', 'DRAWING', 'POST_COMBAT', 'SHEATHING'].forEach(st => {
    assert.equal(idleProfileFor(st, 'mage', 'archmage'), LORD, st);
  });
});

test('弾が当たる高さの窓は、ゲーム側と同じ値を使っている', async () => {
  // 数値を2箇所に書いているので、片方だけ動いたら落ちるようにしておく
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/legacy/parts/13-update-loop.js', import.meta.url), 'utf8');
  const m = /PROJECTILE_HEIGHT_WINDOW\s*=\s*([\d.]+)/.exec(src);
  assert.ok(m, 'ゲーム側に PROJECTILE_HEIGHT_WINDOW が見つからない');
  assert.equal(Number(m[1]), PROJECTILE_HEIGHT_WINDOW,
    'ゲーム側の窓とテストの値がずれている');
  // その定数が実際に当たり判定で使われていること
  assert.ok(src.includes('< PROJECTILE_HEIGHT_WINDOW'),
    '定数が当たり判定で使われていない');
});
