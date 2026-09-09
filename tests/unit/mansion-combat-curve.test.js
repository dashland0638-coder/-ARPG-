// 「森の洋館」の戦闘学習曲線の回帰テスト。`npm run test:unit` で実行。
//
// 洋館は5戦(森の奇襲 → 大広間 → 使用人区画 → 地下奥 → 主の間)で
// 「敵の攻撃を読む → 隙を突く → 体勢を崩す → 大怯み → 追撃 → ダウン」を
// 教える(MANSION_SCENARIO.md / COMBAT_DESIGN.md 9章)。この曲線が
// 数値として成立しているかは、実際に地下まで歩かなくても、実装済みの
// 純粋関数(体幹・パニッシュ窓・Enemy Step)を敵AIと同じ秒数で回せば確認
// できる ―― E2Eで地下まで歩き通すのはこの環境では現実的でない
// (tests/mansion-scenario.spec.js の冒頭に同じ判断のメモがある)。
//
// ここが固定するのは「関係」であって、特定フレームでの絶対値ではない:
//   ・通常敵 < 強敵 < ガード持ち < ボス という体幹の段差
//   ・隙を突いた一撃が素の一撃より重い(倍率は既存のまま)
//   ・連打でも崩せるが、読んで動くほうが速く、かつ被弾しない
//   ・Enemy Step → 大怯み(70%) → 追撃 → ダウン(100%)が繋がる
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  gainPosture, stepPostureRecovery, staggerGain, punishWindowMultiplier,
  mobPostureMax, bossPostureMax, isBigFlinchThreshold, isKnockdownThreshold,
  BOSS_POSTURE_MIN,
} from '../../src/core/stagger-math.js';
import { punishWindowState, POST_ATTACK_RECOVERY_SEC } from '../../src/core/punish-window.js';
import { ENEMY_STEP_STAGGER } from '../../src/core/enemy-step.js';

const DT = 1 / 60;
// 第1章の主人公(剣士): atkCooldown 0.52 / classDef.staggerMul 1.3
const ATK_CD = 0.52, WARRIOR_STAGGER_MUL = 1.3;

/* updateChargerAI() の状態機械を、同じ秒数でそのまま回す簡易モデル。
   溜め(telegraph) → 突進(dash 0.4) → 硬直(cooldown) の3拍で、
   突進を振り抜いた瞬間に postAtkRecoveryT が立つところまで実装と同じ。 */
function charger({ telegraph = 0.65, cooldown = 1.5, postureMax = 55 } = {}) {
  return {
    posture: 0, postureMax, postureGraceT: 0, postureRecoveryDelayT: 0,
    knockedDown: false, bigFlinched: false, hurtT: 0, isBoss: false,
    chargeState: 'telegraph', chargeT: telegraph, postAtkRecoveryT: 0,
    _telegraph: telegraph, _cooldown: cooldown,
  };
}
function tickChargerAI(en, dt) {
  if (en.postAtkRecoveryT > 0) en.postAtkRecoveryT -= dt;
  en.chargeT -= dt;
  if (en.chargeT > 0) return;
  if (en.chargeState === 'telegraph') { en.chargeState = 'dash'; en.chargeT = 0.4; }
  else if (en.chargeState === 'dash') {
    en.chargeState = 'cooldown'; en.chargeT = en._cooldown;
    en.postAtkRecoveryT = POST_ATTACK_RECOVERY_SEC;
  } else { en.chargeState = 'telegraph'; en.chargeT = en._telegraph; }
}
function swing(en) {
  const mul = punishWindowMultiplier(punishWindowState(en));
  return gainPosture(en, staggerGain({ classMul: WARRIOR_STAGGER_MUL, punishBonusMul: mul }));
}

/* style:
     'mash' … 突進中だろうと構わず振り続ける(＝突進を毎回もらう)
     'read' … 突進の間は回避に専念し、溜めと硬直に当てる
     'step' … 'read' に加えて、突進をEnemy Stepで踏む            */
function fight(en, style) {
  let t = 0, nextSwing = 0, hits = 0, hitsTaken = 0, flinchAt = null, knockdownAt = null, stepped = false;
  while (t < 60 && !isKnockdownThreshold(en.posture, en.postureMax)) {
    const dashing = en.chargeState === 'dash';
    if (style === 'step' && dashing && !stepped) {
      // triggerEnemyStep(): 体幹+55、踏まれた側は突進を中断して硬直へ
      gainPosture(en, ENEMY_STEP_STAGGER);
      stepped = true;
      en.chargeState = 'cooldown'; en.chargeT = en._cooldown;
      en.postAtkRecoveryT = POST_ATTACK_RECOVERY_SEC;
    } else if (t >= nextSwing && !(style !== 'mash' && dashing)) {
      swing(en); hits++; nextSwing = t + ATK_CD;
    }
    if (style === 'mash' && dashing && Math.abs(en.chargeT - 0.4) < DT) hitsTaken++;
    if (flinchAt === null && isBigFlinchThreshold(en.posture, en.postureMax)) {
      flinchAt = t; en.bigFlinched = true; en.hurtT = 0.5;   // applyStaggerResult の大怯み
    }
    if (en.hurtT > 0) en.hurtT -= DT;
    const wasDash = dashing;
    tickChargerAI(en, DT);
    if (wasDash && en.chargeState !== 'dash') stepped = false;   // 次の突進はまた踏める
    stepPostureRecovery(en, DT);
    t += DT;
  }
  if (isKnockdownThreshold(en.posture, en.postureMax)) knockdownAt = t;
  return { sec: t, hits, hitsTaken, flinchAt, knockdownAt, broke: knockdownAt !== null };
}

test('体幹の段差(通常敵 → 強敵 → ガード持ち → ボス)', async (t) => {
  await t.test('森・大広間・使用人区画の雑魚は55', () => {
    assert.equal(mobPostureMax({}), 55);
  });

  await t.test('「燭台を提げた影」は強敵(130)かつガード持ち(×1.3)で169', () => {
    // 07-ai-combat.js の manorDeep: strongMob:true, guardian:true
    assert.equal(mobPostureMax({ strongMob: true, guardian: true }), 169);
    assert.ok(mobPostureMax({ strongMob: true, guardian: true }) > mobPostureMax({ strongMob: true }));
  });

  await t.test('「屋敷の主」(HP620)は bossPostureMax の下限clampで180', () => {
    // 620*0.28 = 173.6 → BOSS_POSTURE_MIN で頭打ち。個別ハードコードはしない
    assert.equal(bossPostureMax(620), BOSS_POSTURE_MIN);
    assert.equal(bossPostureMax(620), 180);
  });

  await t.test('段差が単調に上がる(強敵→ボスでいきなり跳ね上がらない)', () => {
    const mob = mobPostureMax({});
    const shade = mobPostureMax({ strongMob: true, guardian: true });
    const boss = bossPostureMax(620);
    assert.ok(mob < shade && shade < boss);
    assert.ok(boss < mob * 4, 'ボスでも通常敵4体ぶん未満に収まっていること');
  });
});

test('戦闘②(大広間): 隙を突くと体幹の伸びが変わる', async (t) => {
  await t.test('突進の溜め・振り抜きに当てた一撃は、素の一撃より重い', () => {
    const neutral = charger(); neutral.chargeState = 'cooldown'; neutral.chargeT = 1.5;
    const windup = charger();                                     // telegraph
    const recovery = charger(); recovery.chargeState = 'cooldown'; recovery.postAtkRecoveryT = 0.4;
    const g = (en) => staggerGain({ classMul: WARRIOR_STAGGER_MUL, punishBonusMul: punishWindowMultiplier(punishWindowState(en)) });
    assert.ok(g(windup) > g(recovery));
    assert.ok(g(recovery) > g(neutral));
  });

  await t.test('雑魚(体幹55)は普通に殴っていても崩れる ―― 体幹を意識させる必要はない', () => {
    const r = fight(charger(), 'mash');
    assert.equal(r.broke, true);
    assert.ok(r.hits <= 5, `通常攻撃${r.hits}発で崩れること(体幹ゲージを見せない敵)`);
  });
});

test('戦闘④(地下奥): 燭台を提げた影が体幹チュートリアルとして機能する', async (t) => {
  // 溜めだけ chargeTelegraphOverride で 1.0秒(初見でも読み切れる長さ)
  const shade = () => charger({ telegraph: 1.0, postureMax: mobPostureMax({ strongMob: true, guardian: true }) });

  await t.test('Enemy Step 1回では崩れない ―― 追撃してはじめてダウンする', () => {
    const en = shade();
    gainPosture(en, ENEMY_STEP_STAGGER);
    assert.equal(ENEMY_STEP_STAGGER, 55);
    assert.equal(isBigFlinchThreshold(en.posture, en.postureMax), false, '+55だけでは大怯みにも届かない');
    assert.ok(en.posture / en.postureMax > 0.3, 'それでも一撃で3割は削れる(踏む価値がある)');
  });

  await t.test('連打でも崩せる(体幹を狙わないと倒せない敵にはしない)', () => {
    const r = fight(shade(), 'mash');
    assert.equal(r.broke, true);
    assert.ok(r.hitsTaken > 0, 'ただし突進をまともに受け続けることになる');
  });

  await t.test('読んで動くほうが無傷で崩せる', () => {
    const r = fight(shade(), 'read');
    assert.equal(r.broke, true);
    assert.equal(r.hitsTaken, 0);
  });

  await t.test('Enemy Stepを混ぜるのが最速かつ無傷 ―― 理想の攻略が実際に最良手になる', () => {
    const step = fight(shade(), 'step');
    const read = fight(shade(), 'read');
    const mash = fight(shade(), 'mash');
    assert.equal(step.broke, true);
    assert.equal(step.hitsTaken, 0);
    assert.ok(step.sec < read.sec, `Enemy Step ${step.sec.toFixed(2)}s < 読み ${read.sec.toFixed(2)}s`);
    assert.ok(step.sec < mash.sec, `Enemy Step ${step.sec.toFixed(2)}s < 連打 ${mash.sec.toFixed(2)}s`);
  });

  await t.test('大怯み(70%)を経てからダウン(100%)へ届く', () => {
    const r = fight(shade(), 'step');
    assert.ok(r.flinchAt !== null && r.knockdownAt !== null);
    assert.ok(r.flinchAt < r.knockdownAt, '70%の大怯みが先、そこから追撃して100%');
    assert.ok(r.knockdownAt - r.flinchAt > 0.4, '大怯みからダウンまでに追撃の一拍があること');
  });
});

test('戦闘⑤(主の間): 体幹削りゲームにならない', async (t) => {
  await t.test('ボスの体幹は雑魚より深く、通常攻撃だけでは時間がかかる', () => {
    const boss = { posture: 0, postureMax: bossPostureMax(620), postureGraceT: 0, postureRecoveryDelayT: 0,
      knockedDown: false, bigFlinched: false, hurtT: 0, isBoss: true };
    let hits = 0;
    while (!isKnockdownThreshold(boss.posture, boss.postureMax) && hits < 100) {
      gainPosture(boss, staggerGain({ classMul: WARRIOR_STAGGER_MUL }));
      hits++;
      stepPostureRecovery(boss, ATK_CD);   // 攻撃間隔ぶん時間を進める
    }
    assert.equal(isKnockdownThreshold(boss.posture, boss.postureMax), true);
    assert.ok(hits > 10, `通常攻撃だけなら${hits}発 ―― 雑魚のように数発では崩れない`);
  });

  await t.test('隙を突けば明確に短縮される(既存のパニッシュ倍率のまま)', () => {
    const run = (punishMul) => {
      const boss = { posture: 0, postureMax: bossPostureMax(620), postureGraceT: 0, postureRecoveryDelayT: 0,
        knockedDown: false, bigFlinched: false, hurtT: 0, isBoss: true };
      let hits = 0;
      while (!isKnockdownThreshold(boss.posture, boss.postureMax) && hits < 100) {
        gainPosture(boss, staggerGain({ classMul: WARRIOR_STAGGER_MUL, punishBonusMul: punishMul }));
        hits++;
        stepPostureRecovery(boss, ATK_CD);
      }
      return hits;
    };
    assert.ok(run(1.6) < run(1) * 0.75, '振りかぶりを突き続ければ必要打数が明確に減る');
  });
});

test('職業ごとの役割(体幹倍率は変更していない)', async (t) => {
  await t.test('剣士以外も、隙を突けば洋館の敵を崩しきれる', () => {
    // 盗賊0.7 / 魔法使い1.0 / 弓師0.8(01-character-creation.js)
    for (const [job, classMul, cd] of [['盗賊', 0.7, 0.38], ['魔法使い', 1.0, 0.6], ['弓師', 0.8, 0.5]]) {
      const en = charger({ telegraph: 1.0, postureMax: mobPostureMax({ strongMob: true, guardian: true }) });
      let t = 0, next = 0, guard = 0;
      while (t < 60 && !isKnockdownThreshold(en.posture, en.postureMax)) {
        if (t >= next && en.chargeState !== 'dash') {
          const mul = punishWindowMultiplier(punishWindowState(en));
          gainPosture(en, staggerGain({ classMul, punishBonusMul: mul }));
          next = t + cd;
        }
        tickChargerAI(en, DT); stepPostureRecovery(en, DT); t += DT; guard++;
      }
      assert.equal(isKnockdownThreshold(en.posture, en.postureMax), true,
        `${job}でも燭台の影を崩せること(${t.toFixed(1)}秒)`);
      assert.ok(guard < 3600);
    }
  });
});
