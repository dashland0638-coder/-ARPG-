/* 敵プロファイルの汎用基盤(core/enemy-profiles.js)の回帰テスト。
   `npm run test:unit` で実行。

   このファイルが固定したいのは「森の洋館の数値」ではなく、
   **器としての性質** ―― つまり:

     ・洋館以外のダンジョンが、洋館に一切触れずに敵を登録できること
     ・登録した敵が、既存の戦闘基盤(パニッシュ窓/体幹/大怯み/階層)へ
       そのまま乗ること
     ・フェーズ差分・hold・クールダウンの解決規則が、登録元を問わず
       同じように効くこと
     ・variant の組み立てが「プロファイルのフィールドをそのまま写し、
       役割ごとの追加分(variant)を重ね、最後に配置側の stats を重ねる」
       という1つの規則だけで説明できること

   洋館の敵そのものの回帰は mansion-enemies / mansion-warden /
   mansion-butler / mansion-lord の各テストが引き続き担当する。
   ここでは意図的に、洋館とは無関係の**架空の敵**を登録して検証する ――
   基盤が特定のダンジョンを知らないことを、テスト自身が示すため。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MELEE_PROFILES, ENEMY_PROFILES,
  defineMeleeProfile, defineEnemyProfile, defineEnemyProfiles,
  setFallbackMeleeKind, fallbackMeleeKind,
  meleeProfile, meleeAttackPlan, meleeHeavyCooldown, meleeAttackChoice, meleeWindupProgress,
  enemyProfile, enemyVariant, isProfileMeleeWindup,
  meleeTelegraphShape, groundFanRotationZ,
} from '../../src/core/enemy-profiles.js';
import { punishWindowState } from '../../src/core/punish-window.js';
import { enemyTier, TIER, bigFlinchInterrupt } from '../../src/core/enemy-tier.js';
import { mobPostureMax } from '../../src/core/stagger-math.js';
/* 登録は「読み込まれたダンジョンの分だけ」行われる ―― 基盤は自分から
   ダンジョンを探しに行かない。実際のゲーム(src/legacy/concat-plugin.js の
   HEADER)は洋館を読み込むので、ここでも同じ状態を作ってから検証する。
   この import 自体が「洋館と架空のダンジョンが同じ台帳に共存できる」
   ことの確認でもある。 */
import '../../src/core/mansion-enemies.js';

/* 架空のダンジョン(幽霊船を想定した仮の敵)。洋館の数値は一切使わない。
   テスト専用の名前空間 'spec:' を前置して、実際の敵と衝突させない。 */
const DECKHAND = 'spec:deckhand';
const LANTERN = 'spec:lantern';

defineMeleeProfile(DECKHAND, {
  attacks: {
    jab:   { key:'jab',   telegraph:0.40, active:0.12, recovery:0.35, reach:2.20,
             damageMul:1.0, halfAngle:1.00, hold:0 },
    cleave:{ key:'cleave',telegraph:0.90, active:0.24, recovery:0.95, reach:3.50,
             damageMul:1.3, halfAngle:1.70, hold:0.25,
             phase2:{ telegraph:0.70, reach:4.40, recovery:0.80 } },
  },
  light:'jab', heavy:'cleave',
  heavyCooldown: 3.0,
  heavyCooldownByPhase: { 2: 1.2 },
  attackCooldown: 0.9,
  detectRange: 9,
  approachFactor: 0.8,
  phases: 2,
});

defineEnemyProfiles({
  [DECKHAND]: {
    key: DECKHAND, name: '仮・甲板員', role: 'melee',
    theme: 'deckhand', atkType: 'servant', meleeKind: DECKHAND,
    color: 0x112233, material: 'ghost', speed: 2.0,
    strongMob: true, turnRate: 3.0,
  },
  [LANTERN]: {
    key: LANTERN, name: '仮・提灯', role: 'ranged',
    theme: 'lantern', atkType: 'kite',
    color: 0x445566, projColor: 0x99ccff, material: 'ghost', speed: 1.2,
    variant: { shotWindupSec: 0.8, shotRootSec: 0.5, shotSfx: 'cast' },
  },
});

/* ---- 器としての登録 ---------------------------------------------------- */

test('他ダンジョンの敵を、洋館に触れずに登録できる', () => {
  assert.ok(MELEE_PROFILES[DECKHAND], '近接プロファイルが登録されていない');
  assert.ok(ENEMY_PROFILES[DECKHAND], '敵プロファイルが登録されていない');
  assert.ok(ENEMY_PROFILES[LANTERN], '引き撃ち役が登録されていない');
  // 洋館の敵も同じ台帳に居る = 台帳がダンジョンを区別していない
  assert.ok(ENEMY_PROFILES.servant, '洋館の敵が同じ台帳に居ない');
  assert.equal(enemyProfile(DECKHAND).name, '仮・甲板員');
  assert.equal(enemyProfile('spec:nope'), null, '未登録キーは null');
});

test('未知のキーは既定のプロファイルへ落ちる', () => {
  // 洋館が setFallbackMeleeKind('servant') を呼んでいる
  assert.equal(fallbackMeleeKind(), 'servant');
  assert.equal(meleeProfile('spec:unknown'), MELEE_PROFILES.servant);
  assert.equal(meleeProfile(undefined), MELEE_PROFILES.servant);
  // 落とし先は差し替えられる(基盤が特定の敵に固定されていない)
  setFallbackMeleeKind(DECKHAND);
  assert.equal(meleeProfile('spec:unknown'), MELEE_PROFILES[DECKHAND]);
  setFallbackMeleeKind('servant');   // 他のテストへ影響させない
  assert.equal(meleeProfile('spec:unknown'), MELEE_PROFILES.servant);
});

/* ---- 攻撃表の解決規則 -------------------------------------------------- */

test('攻撃表: 未知の攻撃キーは light へ落ちる', () => {
  const light = meleeAttackPlan(DECKHAND, 'jab');
  assert.equal(meleeAttackPlan(DECKHAND, 'bogus').key, light.key);
});

test('攻撃表: phase 差分は指定フェーズでだけ効き、元の表を壊さない', () => {
  const p1 = meleeAttackPlan(DECKHAND, 'cleave', 1);
  const p2 = meleeAttackPlan(DECKHAND, 'cleave', 2);
  assert.equal(p1.telegraph, 0.90);
  assert.equal(p2.telegraph, 0.70, 'phase2 の差し替えが効いていない');
  assert.equal(p2.reach, 4.40);
  // 差分に書いていないフィールドは引き継がれる
  assert.equal(p2.damageMul, p1.damageMul);
  assert.equal(p2.halfAngle, p1.halfAngle);
  // 元の表は書き換わっていない(差分は毎回コピーで返る)
  assert.equal(meleeAttackPlan(DECKHAND, 'cleave', 1).telegraph, 0.90);
  // 差分を持たない攻撃はフェーズを無視する
  assert.equal(meleeAttackPlan(DECKHAND, 'jab', 2).telegraph,
               meleeAttackPlan(DECKHAND, 'jab', 1).telegraph);
});

test('heavy のクールダウンはフェーズ別の上書きを見る', () => {
  assert.equal(meleeHeavyCooldown(DECKHAND, 1), 3.0);
  assert.equal(meleeHeavyCooldown(DECKHAND, 2), 1.2);
  // 上書きを持たないフェーズは既定値
  assert.equal(meleeHeavyCooldown(DECKHAND, 3), 3.0);
});

/* ---- 攻撃選択 ---------------------------------------------------------- */

test('攻撃選択: 間合い・クールダウン・呼吸の3条件だけで決まる', () => {
  const jab = meleeAttackPlan(DECKHAND, 'jab');
  const cleave = meleeAttackPlan(DECKHAND, 'cleave');

  // light の間合いなら light(至近で必ず heavy が出たりしない)
  assert.equal(meleeAttackChoice(DECKHAND, { dist: 0.5 }), 'jab');
  assert.equal(meleeAttackChoice(DECKHAND, { dist: jab.reach }), 'jab');
  // light が届かず heavy なら届く距離 → heavy
  assert.equal(meleeAttackChoice(DECKHAND, { dist: jab.reach + 0.2 }), 'cleave');
  assert.equal(meleeAttackChoice(DECKHAND, { dist: cleave.reach }), 'cleave');
  // heavy も届かない → 何も出さずに詰め直す
  assert.equal(meleeAttackChoice(DECKHAND, { dist: cleave.reach + 0.1 }), null);
  // heavy がクールダウン中なら、その距離では出さない
  assert.equal(meleeAttackChoice(DECKHAND, { dist: jab.reach + 0.2, heavyCD: 1 }), null);
  // 呼吸(atkCD)が残っていれば何も出さない
  assert.equal(meleeAttackChoice(DECKHAND, { dist: 0.5, atkCD: 0.3 }), null);
  // 距離が無い/不正なら何も出さない
  assert.equal(meleeAttackChoice(DECKHAND, {}), null);
  assert.equal(meleeAttackChoice(DECKHAND, { dist: NaN }), null);
});

test('攻撃選択: phase 2 で伸びたリーチがそのまま選択へ効く', () => {
  const between = 4.0;   // phase1 の cleave(3.50)では届かず、phase2(4.40)なら届く
  assert.equal(meleeAttackChoice(DECKHAND, { dist: between, phase: 1 }), null);
  assert.equal(meleeAttackChoice(DECKHAND, { dist: between, phase: 2 }), 'cleave');
});

/* ---- 予兆の進行度 ------------------------------------------------------ */

test('予兆の進行度: 0→1 で、hold を持つ攻撃は引ききって静止する', () => {
  const cleave = meleeAttackPlan(DECKHAND, 'cleave');
  // 始まった瞬間は 0、振り出す瞬間は 1
  assert.equal(meleeWindupProgress(DECKHAND, 'cleave', cleave.telegraph), 0);
  assert.equal(meleeWindupProgress(DECKHAND, 'cleave', 0), 1);
  // hold の区間(残り時間が telegraph*hold 未満)では 1 に張り付く
  assert.equal(meleeWindupProgress(DECKHAND, 'cleave', cleave.telegraph * cleave.hold * 0.5), 1);
  // hold を持たない攻撃は最後まで線形
  const jab = meleeAttackPlan(DECKHAND, 'jab');
  const mid = meleeWindupProgress(DECKHAND, 'jab', jab.telegraph / 2);
  assert.ok(mid > 0.45 && mid < 0.55, `線形になっていない: ${mid}`);
  // 単調増加(残り時間が減るほど進む)
  let prev = -1;
  for (let remain = cleave.telegraph; remain >= 0; remain -= 0.05) {
    const k = meleeWindupProgress(DECKHAND, 'cleave', remain);
    assert.ok(k >= prev, '進行度が巻き戻っている');
    assert.ok(k >= 0 && k <= 1, `0..1 の外: ${k}`);
    prev = k;
  }
});

/* ---- variant の組み立て ------------------------------------------------ */

test('variant: プロファイルの値を写し、追加分を重ね、最後に stats を重ねる', () => {
  const v = enemyVariant(LANTERN, { hp: 120, atk: 20, xp: 30, roomTag: 'spec:deck' });
  // プロファイルの値がそのまま乗る
  assert.equal(v.theme, 'lantern');
  assert.equal(v.atkType, 'kite');
  assert.equal(v.projColor, 0x99ccff);
  assert.equal(v.speed, 1.2);
  // 役割ごとの追加分(variant)が乗る
  assert.equal(v.shotWindupSec, 0.8);
  assert.equal(v.shotRootSec, 0.5);
  assert.equal(v.shotSfx, 'cast');
  // 配置側の stats が乗る
  assert.equal(v.hp, 120);
  assert.equal(v.atk, 20);
  assert.equal(v.roomTag, 'spec:deck');
  // メタ情報は variant へ漏らさない
  ['key', 'name', 'role', 'material', 'variant'].forEach(k =>
    assert.equal(v[k], undefined, `${k} が variant へ漏れている`));
});

test('variant: stats がプロファイルより優先される(配置側の数値を動かさない)', () => {
  const v = enemyVariant(DECKHAND, { speed: 9.9, hp: 50 });
  assert.equal(v.speed, 9.9, '配置側の上書きが効いていない');
  assert.equal(v.hp, 50);
});

test('variant: 未登録キーは stats だけを返す', () => {
  const v = enemyVariant('spec:nope', { hp: 10 });
  assert.deepEqual(v, { hp: 10 });
  assert.deepEqual(enemyVariant('spec:nope'), {});
});

test('variant: 既存のフラグ(strongMob/guardian/turnRate)がそのまま立つ', () => {
  const v = enemyVariant(DECKHAND, {});
  assert.equal(v.strongMob, true);
  assert.equal(v.turnRate, 3.0);
  assert.equal(v.meleeKind, DECKHAND);
  // 立てていないフラグは生えない(新しい階層を勝手に作らない)
  assert.equal(v.guardian, undefined);
});

/* ---- 既存の戦闘基盤への接続 -------------------------------------------- */

test('予兆が既存のパニッシュ窓の定義へそのまま乗る', () => {
  const en = { servantState: 'windup' };
  assert.equal(isProfileMeleeWindup(en), true);
  assert.equal(punishWindowState(en).midWindup, true,
    'プロファイル方式の予兆がパニッシュ窓に乗っていない');

  // 振り抜いた後は窓が閉じ、共通の postAtkRecoveryT 側へ移る
  const after = { servantState: 'recover', postAtkRecoveryT: 0.2 };
  assert.equal(isProfileMeleeWindup(after), false);
  const st = punishWindowState(after);
  assert.equal(st.midWindup, false);
  assert.equal(st.postAttackRecovery, true);

  // ダウン中・死亡中は窓を開けない(既存ルールのまま)
  assert.equal(punishWindowState({ servantState: 'windup', knockedDown: true }).midWindup, false);
  assert.equal(punishWindowState({ servantState: 'windup', dead: true }).midWindup, false);
  // 壊れた入力で落ちない
  assert.equal(isProfileMeleeWindup(null), false);
  assert.equal(isProfileMeleeWindup(undefined), false);
  assert.equal(isProfileMeleeWindup({}), false);
});

test('登録した敵が既存の階層・体幹の規則へそのまま乗る', () => {
  const mob = enemyVariant(LANTERN, { hp: 120 });
  const elite = enemyVariant(DECKHAND, { hp: 200 });

  // 階層は既存の enemy-tier の判定そのまま(新しい階層を作っていない)
  assert.equal(enemyTier(mob), TIER.NORMAL);
  assert.equal(enemyTier(elite), TIER.ELITE, 'strongMob が ELITE に効いていない');

  // 通常敵だけが大怯みで中断される、という既存ルールが保たれている
  assert.equal(bigFlinchInterrupt(mob).interrupt, true);
  assert.equal(bigFlinchInterrupt(elite).interrupt, false, 'ELITE が大怯みで止まっている');

  // 体幹上限も既存の stagger-math の計算のまま(強モブの方が高い)
  assert.ok(mobPostureMax(elite, 1) > mobPostureMax(mob, 1),
    '強モブの体幹が通常敵より高くない');
});

test('予兆中の一撃は、登録元を問わず体幹が余計に入る', () => {
  // 「敵を見る」報酬が特定のダンジョンに閉じていないことの確認
  const windup = punishWindowState({ servantState: 'windup' });
  assert.equal(windup.midWindup, true);
  assert.equal(windup.postAttackRecovery, false);
});

/* ---- 器そのものの防御的な性質 ------------------------------------------ */

test('defineEnemyProfile / defineMeleeProfile は登録した spec を返す', () => {
  const spec = { key: 'spec:tmp', theme: 'tmp', atkType: 'charge', speed: 1 };
  assert.equal(defineEnemyProfile('spec:tmp', spec), spec);
  assert.equal(enemyProfile('spec:tmp'), spec);
  const mspec = { attacks: { a: { key:'a', telegraph:0.1, reach:1 } }, light:'a', heavy:'a',
                  heavyCooldown:1, attackCooldown:1, detectRange:1, approachFactor:1 };
  assert.equal(defineMeleeProfile('spec:tmpm', mspec), mspec);
  assert.equal(meleeProfile('spec:tmpm'), mspec);
});

/* ---- 予兆中の床の弧(ENEMY-ATTACK-VIS-001) ------------------------------
   表示は判定と同じ形・同じ向きでなければ意味が無い。形は meleeAttackPlan
   と一致すること、向きは判定の規約 atan2(x, z)(0 = +Z)で servantFacing と
   一致することをここで固定する。 */

test('床の弧の形: heavy は meleeAttackPlan の reach / halfAngle と一致する(U-1)', () => {
  const heavy = [
    ['servant', 'sweep', 3.30, 1.60],
    ['warden',  'sweep', 3.90, 1.85],
    ['butler',  'lash',  3.60, 1.25],
  ];
  for (const [kind, attack, reach, half] of heavy) {
    const shape = meleeTelegraphShape(kind, attack, 1);
    const plan = meleeAttackPlan(kind, attack, 1);
    assert.ok(shape, `${kind} ${attack} に形が無い`);
    assert.equal(shape.reach, plan.reach);
    assert.equal(shape.halfAngle, plan.halfAngle);
    assert.equal(shape.reach, reach);       // 外周 = reach ちょうど(D-3)
    assert.equal(shape.halfAngle, half);
  }
  // light の判定値そのものは変わっていない(表示が無いだけ)
  assert.equal(meleeAttackPlan('servant', 'strike', 1).reach, 2.05);
  assert.equal(meleeAttackPlan('warden', 'slam', 1).reach, 2.95);
  assert.equal(meleeAttackPlan('butler', 'candle', 1).reach, 2.55);
});

test('床の弧の形: 執事 Phase 2 の lash はフェーズ差分込みの値になる(U-2)', () => {
  const shape = meleeTelegraphShape('butler', 'lash', 2);
  const plan = meleeAttackPlan('butler', 'lash', 2);
  assert.equal(shape.reach, 4.60);
  assert.equal(shape.halfAngle, 1.35);
  assert.equal(shape.reach, plan.reach);
  assert.equal(shape.halfAngle, plan.halfAngle);
});

test('床の弧は heavy だけ。light には出さない(U-3、D-2)', () => {
  for (const [kind, light] of [['servant', 'strike'], ['warden', 'slam'], ['butler', 'candle']]) {
    assert.equal(meleeTelegraphShape(kind, light, 1), null, `${kind} ${light} に形がある`);
    assert.equal(meleeTelegraphShape(kind, light, 2), null, `${kind} ${light}(phase 2) に形がある`);
  }
  // 未知の攻撃キーは light へ落ちるので、表示も出ない
  assert.equal(meleeTelegraphShape('servant', 'nope', 1), null);
  // ガードブレイクは heavy の plan で振る(07-ai-combat.js)ので heavy と同じ形
  assert.deepEqual(meleeTelegraphShape('warden', meleeProfile('warden').heavy, 1),
                   meleeTelegraphShape('warden', 'sweep', 1));
});

/* rotation.x = -π/2 → rotation.z = ρ(three の Euler 'XYZ' = Rx·Ry·Rz)を
   局所角 θ の点へ数値で適用し、その方位を atan2(x, z) で読む */
function fanBearing(rhoZ, theta) {
  const lx = Math.cos(theta), ly = Math.sin(theta);
  const x1 = lx * Math.cos(rhoZ) - ly * Math.sin(rhoZ);   // Rz
  const y1 = lx * Math.sin(rhoZ) + ly * Math.cos(rhoZ);
  const a = -Math.PI / 2;                                  // Rx(-π/2)
  const x = x1, z = y1 * Math.sin(a);
  return Math.atan2(x, z);
}
function wrapDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
const FAN_FACINGS = [0, Math.PI / 2, -Math.PI / 2, Math.PI, 0.70, 2.50, -1.20];

test('床の弧の向き: 中心の方位が servantFacing と一致する(U-4)', () => {
  for (const h of [1.00, 1.25, 1.35, 1.60, 1.85]) {
    for (const f of FAN_FACINGS) {
      const center = fanBearing(groundFanRotationZ(f, h), h);
      assert.ok(Math.abs(wrapDiff(center, f)) < 1e-9, `f=${f} h=${h} → 中心 ${center}`);
    }
  }
});

test('床の弧の向き: 両端の方位が facing ± halfAngle になる(U-5)', () => {
  for (const h of [1.00, 1.60, 1.85]) {
    for (const f of FAN_FACINGS) {
      const rho = groundFanRotationZ(f, h);
      const ends = [fanBearing(rho, 0), fanBearing(rho, 2 * h)];
      const want = [f - h, f + h];
      for (const w of want) {
        assert.ok(ends.some(e => Math.abs(wrapDiff(e, w)) < 1e-9),
          `f=${f} h=${h} → 端 ${ends} に ${w} が無い`);
      }
    }
  }
});
